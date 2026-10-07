import 'dart:async';
import 'dart:convert';
import 'package:geolocator/geolocator.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/ronda_models.dart';

const String kRondasWsBase = 'wss://api.whatseg.com/ws/rondas';

/// Servicio que envía la posición GPS del guardia al panel en tiempo real
/// mientras hay una ronda activa.
/// También detecta proximidad a checkpoints pendientes (≤15 m)
/// y llama a [onProximityAlert] para ofrecer auto-check-in.
class RondaGpsService {
  WebSocketChannel? _ws;
  Timer? _timer;
  String? _ejecucionId;
  String? _token;
  bool _reconnecting = false;

  /// Callback llamado cuando el guardia está a ≤15 m de un checkpoint pendiente.
  void Function(CheckpointInfo cp)? onProximityAlert;

  /// IDs de checkpoints que ya dispararon alerta en esta ronda (evita spam).
  final Set<String> _proximityAlerted = {};

  /// Lista de checkpoints pendientes para verificar proximidad.
  List<CheckpointInfo> _pendingCheckpoints = [];

  /// Actualiza los checkpoints pendientes (llamar tras cada marcado).
  void updatePendingCheckpoints(List<CheckpointInfo> cps) {
    _pendingCheckpoints = cps.where((cp) => !cp.visitado).toList();
    // Limpiar alertas de checkpoints que ya no están pendientes
    _proximityAlerted.removeWhere(
      (id) => !_pendingCheckpoints.any((cp) => cp.id == id),
    );
  }

  /// Inicia el tracking GPS para la ejecución indicada.
  void iniciar(String ejecucionId, String token) {
    _ejecucionId = ejecucionId;
    _token = token;
    _conectar();
    // Enviar posición cada 15 segundos
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _enviarPosicion());
  }

  /// Detiene el tracking y cierra el WebSocket.
  void detener() {
    _timer?.cancel();
    _timer = null;
    try { _ws?.sink.close(); } catch (_) {}
    _ws = null;
    _ejecucionId = null;
    _token = null;
    _reconnecting = false;
    _pendingCheckpoints = [];
    _proximityAlerted.clear();
    onProximityAlert = null;
  }

  void _conectar() {
    if (_token == null) return;
    try {
      _ws = WebSocketChannel.connect(
        Uri.parse('$kRondasWsBase?token=${_token!}'),
      );
      _ws!.stream.listen(
        (_) {},
        onDone: _onDisconnect,
        onError: (_) => _onDisconnect(),
        cancelOnError: true,
      );
    } catch (_) {}
  }

  void _onDisconnect() {
    if (_reconnecting || _ejecucionId == null) return;
    _reconnecting = true;
    Future.delayed(const Duration(seconds: 5), () {
      _reconnecting = false;
      if (_ejecucionId != null) _conectar();
    });
  }

  Future<void> _enviarPosicion() async {
    if (_ws == null || _ejecucionId == null) return;
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 5),
      );
      final msg = jsonEncode({
        'type': 'GPS_UPDATE',
        'ejecucion_id': _ejecucionId,
        'latitud': pos.latitude,
        'longitud': pos.longitude,
        'accuracy': pos.accuracy,
        'heading': pos.heading,
      });
      _ws!.sink.add(msg);

      // Verificar proximidad a checkpoints pendientes
      _checkProximity(pos);
    } catch (_) {
      // GPS no disponible temporalmente — silencioso
    }
  }

  void _checkProximity(Position pos) {
    if (onProximityAlert == null || _pendingCheckpoints.isEmpty) return;
    for (final cp in _pendingCheckpoints) {
      if (cp.latitud == null || cp.longitud == null) continue;
      if (_proximityAlerted.contains(cp.id)) continue;
      final dist = Geolocator.distanceBetween(
        pos.latitude, pos.longitude,
        cp.latitud!, cp.longitud!,
      );
      if (dist <= 15.0) {
        _proximityAlerted.add(cp.id);
        onProximityAlert!(cp);
      }
    }
  }
}
