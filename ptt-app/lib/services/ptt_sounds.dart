import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'package:audioplayers/audioplayers.dart';
import 'package:path_provider/path_provider.dart';

/// Genera y reproduce sonidos tipo walkie-talkie para PTT.
/// Usa AndroidAudioFocus.none para no interrumpir la grabación del micrófono.
class PttSounds {
  static AudioPlayer? _playerStart;
  static AudioPlayer? _playerEnd;
  static String? _startPath;
  static String? _endPath;
  static bool _ready = false;

  static Future<void> init() async {
    if (_ready) return;
    try {
      final dir = await getTemporaryDirectory();

      // Generar archivos WAV de chirp
      final startFile = File('${dir.path}/_ptt_on.wav');
      await startFile.writeAsBytes(_chirp(400, 1100, 0.30));
      _startPath = startFile.path;

      final endFile = File('${dir.path}/_ptt_off.wav');
      await endFile.writeAsBytes(_chirp(900, 300, 0.25));
      _endPath = endFile.path;

      // Configurar audio context sin audio focus para no interrumpir la grabación
      final ctx = AudioContext(
        android: AudioContextAndroid(
          isSpeakerphoneOn: false,
          stayAwake: false,
          contentType: AndroidContentType.sonification,
          usageType: AndroidUsageType.notificationEvent,
          audioFocus: AndroidAudioFocus.none,
        ),
      );

      _playerStart = AudioPlayer()..setAudioContext(ctx);
      _playerEnd   = AudioPlayer()..setAudioContext(ctx);

      _ready = true;
    } catch (_) {}
  }

  static Future<void> playStart() async {
    if (!_ready || _startPath == null) return;
    try {
      await _playerStart?.play(DeviceFileSource(_startPath!));
    } catch (_) {}
  }

  static Future<void> playEnd() async {
    if (!_ready || _endPath == null) return;
    try {
      await _playerEnd?.play(DeviceFileSource(_endPath!));
    } catch (_) {}
  }

  static void dispose() {
    _playerStart?.dispose();
    _playerEnd?.dispose();
    _playerStart = null;
    _playerEnd   = null;
    _ready       = false;
  }

  // ── Generador interno ────────────────────────────────────────────────────

  static Uint8List _chirp(double f0, double f1, double duration, {int sr = 8000}) {
    final n      = (sr * duration).round();
    final dataSz = n * 2;
    final buf    = Uint8List(44 + dataSz);
    final bd     = ByteData.sublistView(buf);

    _writeStr(buf, 0,  'RIFF');
    bd.setUint32(4,    36 + dataSz, Endian.little);
    _writeStr(buf, 8,  'WAVE');
    _writeStr(buf, 12, 'fmt ');
    bd.setUint32(16, 16,     Endian.little);
    bd.setUint16(20, 1,      Endian.little);
    bd.setUint16(22, 1,      Endian.little);
    bd.setUint32(24, sr,     Endian.little);
    bd.setUint32(28, sr * 2, Endian.little);
    bd.setUint16(32, 2,      Endian.little);
    bd.setUint16(34, 16,     Endian.little);
    _writeStr(buf, 36, 'data');
    bd.setUint32(40, dataSz, Endian.little);

    const amp   = 0.75;
    const fadeN = 400;
    for (int i = 0; i < n; i++) {
      final t    = i / sr;
      final freq = f0 + (f1 - f0) * (i / n);
      final fade = i < fadeN
          ? i / fadeN
          : (i > n - fadeN ? (n - i) / fadeN : 1.0);
      final v = sin(2 * pi * freq * t) * amp * fade;
      bd.setInt16(44 + i * 2, (v * 32767).round().clamp(-32768, 32767), Endian.little);
    }
    return buf;
  }

  static void _writeStr(Uint8List buf, int offset, String s) {
    for (int i = 0; i < s.length; i++) buf[offset + i] = s.codeUnitAt(i);
  }
}
