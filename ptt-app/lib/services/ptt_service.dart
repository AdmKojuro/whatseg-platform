import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:path_provider/path_provider.dart';
import 'ptt_sounds.dart';

const String kWsUrl = 'wss://reportes.whatseg.com/ws/ptt';

enum PttState { idle, recording, saving }

enum WsState { disconnected, connecting, connected }

class PttService extends ChangeNotifier {
  final String token;
  final String communityId;
  final String guardianName;

  WebSocketChannel? _ws;
  WsState wsState = WsState.disconnected;
  PttState pttState = PttState.idle;

  final AudioRecorder _recorder = AudioRecorder();
  String? _recordPath;
  DateTime? _recordStart;
  double pttDuration = 0;
  Timer? _durationTimer;
  Timer? _pingTimer;

  // Events from server
  final List<Map<String, dynamic>> events = [];
  String? lastSavedReporteId;
  Map<String, dynamic>? lastAdminAlert; // último admin_alert (para disparar dialog)
  final List<Map<String, dynamic>> adminAlerts = []; // historial de alertas

  // Multi-channel PTT
  String currentCanal = 'GENERAL';
  static const List<String> canales = ['GENERAL', 'EMERGENCIA', 'CANAL 1', 'CANAL 2'];

  // Online users in same community channel
  final Map<String, Map<String, String>> onlineUsers = {}; // key = nombre

  // Broadcast reception state (escuchar transmisiones de otros)
  bool broadcastActive = false;
  String? broadcastFrom;
  String? broadcastRol; // #1: rol del emisor
  String _broadcastFormat = 'm4a';
  final List<Uint8List> _broadcastChunks = [];
  Timer? _broadcastTimeout;
  AudioPlayer? _broadcastPlayer;

  // #2: Cola de audio para broadcasts simultáneos
  final List<_BroadcastItem> _audioQueue = [];
  bool _isPlayingQueue = false;

  // #6: Cola offline para audios no enviados
  final List<_OfflineAudio> _offlineQueue = [];

  PttService({
    required this.token,
    required this.communityId,
    required this.guardianName,
  }) {
    PttSounds.init(); // Prepara sonidos al crear el servicio
  }

  // ── WebSocket ────────────────────────────────────────────────────────
  void connect() {
    if (wsState == WsState.connecting) return; // Evitar doble conexión
    wsState = WsState.connecting;
    notifyListeners();

    // Cancelar ping timer anterior y cerrar WS anterior
    _pingTimer?.cancel();
    _pingTimer = null;
    _ws?.sink.close();

    try {
      _ws = WebSocketChannel.connect(Uri.parse(kWsUrl));
      wsState = WsState.connected;
      notifyListeners();

      // Send join
      _wsSend({'type': 'join', 'token': token, 'community_id': communityId, 'canal': currentCanal});

      _ws!.stream.listen(
        (data) {
          if (data is String) {
            _handleMsg(data);
          } else if (data is List<int>) {
            _handleBinary(Uint8List.fromList(data));
          }
        },
        onDone: _onWsClose,
        onError: (_) => _onWsClose(),
      );

      // #5: Keepalive más agresivo — 15s en vez de 25s
      _pingTimer = Timer.periodic(const Duration(seconds: 15), (t) {
        if (wsState != WsState.connected) { t.cancel(); return; }
        _wsSend({'type': 'ping'});
      });
    } catch (e) {
      wsState = WsState.disconnected;
      notifyListeners();
      _reconnect();
    }
  }

  void _onWsClose() {
    wsState = WsState.disconnected;
    // Limpiar estado al desconectar
    broadcastActive = false;
    broadcastFrom = null;
    broadcastRol = null;
    _broadcastChunks.clear();
    _broadcastTimeout?.cancel();
    onlineUsers.clear();
    notifyListeners();
    _reconnect();
  }

  void _reconnect() {
    Future.delayed(const Duration(seconds: 4), () {
      if (wsState == WsState.disconnected) {
        connect();
      }
    });
  }

  void _wsSend(Map<String, dynamic> msg) {
    _ws?.sink.add(jsonEncode(msg));
  }

  void _handleMsg(String data) {
    try {
      final msg = jsonDecode(data) as Map<String, dynamic>;
      events.insert(0, msg);
      if (events.length > 50) events.removeRange(50, events.length);

      if (msg['type'] == 'online_list') {
        onlineUsers.clear();
        final users = msg['users'] as List<dynamic>? ?? [];
        for (final u in users) {
          final nombre = u['guardia_nombre'] as String? ?? '';
          if (nombre.isNotEmpty) {
            onlineUsers[nombre] = {
              'rol': u['rol'] ?? 'GUARDIA',
              'puesto': u['puesto_nombre'] as String? ?? '',
            };
          }
        }
      } else if (msg['type'] == 'user_joined') {
        final nombre = msg['guardia_nombre'] as String? ?? '';
        if (nombre.isNotEmpty) {
          onlineUsers[nombre] = {
            'rol': msg['rol'] ?? 'GUARDIA',
            'puesto': msg['puesto_nombre'] as String? ?? '',
          };
        }
      } else if (msg['type'] == 'user_left') {
        final nombre = msg['guardia_nombre'] as String? ?? '';
        onlineUsers.remove(nombre);
      } else if (msg['type'] == 'canal_changed') {
        currentCanal = msg['canal'] as String? ?? 'GENERAL';
      } else if (msg['type'] == 'joined') {
        // #6: Enviar cola offline al reconectar
        _flushOfflineQueue();
      } else if (msg['type'] == 'ptt_saved') {
        lastSavedReporteId = msg['reporte']?['id'];
        if (pttState == PttState.saving) {
          pttState = PttState.idle;
        }
        // Solo reproducir whatseg_sound.mp3 para EMERGENCIA
        final savedTipo = (msg['reporte']?['tipo'] as String?) ?? '';
        if (savedTipo == 'EMERGENCIA') {
          _playNotificationSound();
        }
      } else if (msg['type'] == 'admin_alert') {
        lastAdminAlert = msg;
        adminAlerts.insert(0, msg);
        if (adminAlerts.length > 20) adminAlerts.removeLast();
      } else if (msg['type'] == 'ptt_start' || msg['type'] == 'admin_ptt_start') {
        // Alguien más está transmitiendo (el server excluye al emisor)
        broadcastActive = true;
        broadcastFrom = msg['guardia_nombre'] ?? msg['from'] ?? 'Guardia';
        broadcastRol = msg['rol'] as String?; // #1: guardar rol
        _broadcastFormat = msg['formato'] ?? (msg['type'] == 'admin_ptt_start' ? 'webm' : 'm4a');
        _broadcastChunks.clear();
        _startBroadcastTimeout();
        PttSounds.playStart();
        // #10: Vibración al recibir broadcast
        HapticFeedback.mediumImpact();
      } else if (msg['type'] == 'ptt_end' || msg['type'] == 'admin_ptt_end') {
        if (broadcastActive) {
          _enqueueBroadcast(); // #2: encolar en vez de reproducir directo
        }
      }
      notifyListeners();
    } catch (_) {}
  }

  // ── Canal switching ──────────────────────────────────────────────────
  void switchCanal(String canal) {
    currentCanal = canal;
    if (wsState == WsState.connected) {
      _wsSend({'type': 'switch_canal', 'canal': canal});
    }
    notifyListeners();
  }

  // ── PTT Recording ────────────────────────────────────────────────────
  String? _pttTarget; // usuario destino para PTT dirigido

  Future<bool> startPTT({String tipo = 'NOVEDAD', String? descripcion, String? target}) async {
    if (pttState != PttState.idle) return false;
    if (wsState != WsState.connected) return false;

    // #3: Bloquear PTT mientras otro transmite
    if (broadcastActive) return false;

    final micStatus = await Permission.microphone.request();
    if (!micStatus.isGranted) return false;

    try {
      final dir = await getTemporaryDirectory();
      _recordPath = '${dir.path}/ptt_${DateTime.now().millisecondsSinceEpoch}.aac';
      _recordStart = DateTime.now();
      pttDuration = 0;

      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 32000,
          sampleRate: 16000,
          numChannels: 1,
        ),
        path: _recordPath!,
      );

      pttState = PttState.recording;
      notifyListeners();

      PttSounds.playStart(); // Sonido "abre canal"

      // Notify server
      _pttTarget = target;
      final startMsg = <String, dynamic>{'type': 'ptt_start', 'tipo': tipo, 'descripcion': descripcion, 'formato': 'm4a'};
      if (target != null) startMsg['target'] = target;
      _wsSend(startMsg);

      // Duration timer
      _durationTimer = Timer.periodic(const Duration(milliseconds: 200), (t) {
        if (pttState != PttState.recording) { t.cancel(); return; }
        pttDuration = DateTime.now().difference(_recordStart!).inMilliseconds / 1000;
        notifyListeners();
      });

      return true;
    } catch (e) {
      debugPrint('[PTT] startPTT error: $e');
      return false;
    }
  }

  Future<void> stopPTT() async {
    if (pttState != PttState.recording) return;
    _durationTimer?.cancel();

    final duration = DateTime.now().difference(_recordStart!).inMilliseconds / 1000;
    pttState = PttState.saving;
    notifyListeners();

    final path = await _recorder.stop();

    if (path == null) {
      pttState = PttState.idle;
      notifyListeners();
      return;
    }

    PttSounds.playEnd(); // Sonido "cierra canal"

    // Enviar audio binario PRIMERO, luego ptt_end como señal de cierre.
    try {
      final file = File(path);
      final bytes = await file.readAsBytes();

      // #6: Si no hay conexión, guardar en cola offline
      if (wsState != WsState.connected || _ws == null) {
        _offlineQueue.add(_OfflineAudio(bytes: bytes, duration: duration));
        debugPrint('[PTT] Audio guardado en cola offline (${bytes.length} bytes)');
        pttState = PttState.idle;
        notifyListeners();
        try { await file.delete(); } catch (_) {}
        return;
      }

      _ws?.sink.add(bytes); // audio binario completo

      // Señal de fin — el servidor guarda todo al recibir este mensaje
      _wsSend({'type': 'ptt_end', 'duracion_seg': duration});

      // Cleanup temp file
      await file.delete();
    } catch (e) {
      debugPrint('[PTT] stopPTT send error: $e');
    }

    // State will be set to idle when server confirms ptt_saved
    // Fallback: if no response in 10s
    Future.delayed(const Duration(seconds: 10), () {
      if (pttState == PttState.saving) {
        pttState = PttState.idle;
        notifyListeners();
      }
    });
  }

  void dismissAlert(Map<String, dynamic> alert) {
    adminAlerts.remove(alert);
    notifyListeners();
  }

  // ── Notification sound ─────────────────────────────────────────────
  AudioPlayer? _notifPlayer;

  void _playNotificationSound() {
    try {
      _notifPlayer?.dispose();
      _notifPlayer = AudioPlayer();
      _notifPlayer!.setVolume(0.5);
      _notifPlayer!.play(AssetSource('whatseg_sound.mp3'));
    } catch (e) {
      debugPrint('[PTT] notification sound error: $e');
    }
  }

  // ── Broadcast reception ──────────────────────────────────────────────

  void _handleBinary(Uint8List data) {
    if (broadcastActive) {
      _broadcastChunks.add(data);
    }
  }

  void _startBroadcastTimeout() {
    _broadcastTimeout?.cancel();
    _broadcastTimeout = Timer(const Duration(seconds: 120), () {
      if (broadcastActive) {
        broadcastActive = false;
        broadcastFrom = null;
        broadcastRol = null;
        _broadcastChunks.clear();
        notifyListeners();
        debugPrint('[PTT] broadcast timeout — limpiado');
      }
    });
  }

  // #2: Encolar broadcast para reproducción secuencial
  void _enqueueBroadcast() {
    _broadcastTimeout?.cancel();
    final chunks = List<Uint8List>.from(_broadcastChunks);
    final fmt = _broadcastFormat;
    broadcastActive = false;
    broadcastFrom = null;
    broadcastRol = null;
    _broadcastChunks.clear();
    notifyListeners();

    if (chunks.isEmpty) {
      PttSounds.playEnd();
      return;
    }

    // Concatenar chunks
    int totalLen = chunks.fold(0, (sum, c) => sum + c.length);
    final allBytes = Uint8List(totalLen);
    int offset = 0;
    for (final chunk in chunks) {
      allBytes.setRange(offset, offset + chunk.length, chunk);
      offset += chunk.length;
    }

    _audioQueue.add(_BroadcastItem(bytes: allBytes, format: fmt));
    _processAudioQueue();
  }

  // #2: Procesar cola de audio secuencialmente
  Future<void> _processAudioQueue() async {
    if (_isPlayingQueue || _audioQueue.isEmpty) return;
    _isPlayingQueue = true;

    while (_audioQueue.isNotEmpty) {
      final item = _audioQueue.removeAt(0);
      try {
        final dir = await getTemporaryDirectory();
        final ext = item.format == 'webm' ? 'webm' : item.format == 'mp3' ? 'mp3' : 'm4a';
        final file = File('${dir.path}/ptt_bc_${DateTime.now().millisecondsSinceEpoch}.$ext');
        await file.writeAsBytes(item.bytes);

        // Chirp de fin antes de reproducir
        await PttSounds.playEnd();
        await Future.delayed(const Duration(milliseconds: 350));

        // Reproducir el audio recibido
        _broadcastPlayer?.dispose();
        final ctx = AudioContext(
          android: AudioContextAndroid(
            isSpeakerphoneOn: true,
            stayAwake: false,
            contentType: AndroidContentType.music,
            usageType: AndroidUsageType.media,
            audioFocus: AndroidAudioFocus.gainTransient,
          ),
        );
        _broadcastPlayer = AudioPlayer()..setAudioContext(ctx);

        final completer = Completer<void>();
        _broadcastPlayer!.onPlayerComplete.listen((_) {
          if (!completer.isCompleted) completer.complete();
        });

        await _broadcastPlayer!.play(DeviceFileSource(file.path));

        // Esperar a que termine de reproducir antes del siguiente en la cola
        await completer.future.timeout(
          const Duration(seconds: 120),
          onTimeout: () {},
        );

        // Cleanup
        try { await file.delete(); } catch (_) {}

        debugPrint('[PTT] broadcast reproducido: ${item.bytes.length} bytes ($ext)');
      } catch (e) {
        debugPrint('[PTT] broadcast play error: $e');
      }
    }

    _isPlayingQueue = false;
  }

  // #6: Enviar audios pendientes de la cola offline
  void _flushOfflineQueue() {
    if (_offlineQueue.isEmpty || wsState != WsState.connected) return;
    debugPrint('[PTT] Enviando ${_offlineQueue.length} audios offline pendientes');

    for (final item in _offlineQueue) {
      try {
        // Enviar ptt_start → binario → ptt_end por cada audio pendiente
        _wsSend({'type': 'ptt_start', 'tipo': 'NOVEDAD', 'formato': 'm4a'});
        _ws?.sink.add(item.bytes);
        _wsSend({'type': 'ptt_end', 'duracion_seg': item.duration});
      } catch (e) {
        debugPrint('[PTT] Error enviando offline: $e');
      }
    }
    _offlineQueue.clear();
  }

  @override
  void dispose() {
    _pingTimer?.cancel();
    _durationTimer?.cancel();
    _broadcastTimeout?.cancel();
    _broadcastPlayer?.dispose();
    _notifPlayer?.dispose();
    _recorder.dispose();
    _ws?.sink.close();
    PttSounds.dispose();
    super.dispose();
  }
}

// #2: Item de la cola de audio
class _BroadcastItem {
  final Uint8List bytes;
  final String format;
  _BroadcastItem({required this.bytes, required this.format});
}

// #6: Audio pendiente de envío offline
class _OfflineAudio {
  final Uint8List bytes;
  final double duration;
  _OfflineAudio({required this.bytes, required this.duration});
}
