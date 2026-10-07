import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' show FontFeature;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:permission_handler/permission_handler.dart';
import '../models/ronda_models.dart';
import '../services/api_service.dart';
import '../services/ronda_gps_service.dart';
import '../widgets/plano_viewer.dart';

class RondasScreen extends StatefulWidget {
  final ApiService api;
  final VoidCallback? onRondaChanged;
  const RondasScreen({super.key, required this.api, this.onRondaChanged});

  @override
  State<RondasScreen> createState() => _RondasScreenState();
}

class _RondasScreenState extends State<RondasScreen> {
  bool _loading = true;
  RondaActiva? _activa;
  List<RutaRonda> _rutas = [];
  String? _error;
  final RondaGpsService _gpsService = RondaGpsService();

  // ── Lone Worker Timer (dead-man switch) ──────────────────────────────────
  Timer? _loneWorkerTimer;
  int _loneWorkerSeconds = 1800; // 30 minutos por defecto
  static const int _loneWorkerDefault = 1800;
  bool _loneWorkerTriggered = false;

  // ── GPS Map ───────────────────────────────────────────────────────────────
  Position? _myPosition;
  StreamSubscription<Position>? _posSub;
  final List<LatLng> _trail = [];
  final MapController _mapCtrl = MapController();
  bool _mapFollow = true; // auto-centrar en mi posición

  // ── NFC ──────────────────────────────────────────────────────────────────
  bool _nfcAvailable = false;
  bool _nfcScanning = false;

  @override
  void initState() {
    super.initState();
    _load();
    _checkNfc();
    _startGpsMap();
  }

  Future<void> _startGpsMap() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return;
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.bestForNavigation,
      );
      if (mounted) setState(() { _myPosition = pos; _trail.add(LatLng(pos.latitude, pos.longitude)); });
      _posSub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 5),
      ).listen((p) {
        if (!mounted) return;
        final ll = LatLng(p.latitude, p.longitude);
        setState(() {
          _myPosition = p;
          // Solo agregar al rastro si la precisión es aceptable
          if (p.accuracy < 50) {
            _trail.add(ll);
            if (_trail.length > 500) _trail.removeAt(0);
          }
        });
        if (_mapFollow) {
          try {
            // Centrar entre yo y el próximo checkpoint pendiente
            final cps = _activa?.allCheckpoints
                .where((c) => c.latitud != null && c.longitud != null && !c.visitado)
                .toList() ?? [];
            if (cps.isNotEmpty) {
              final next = cps.first;
              final mid = LatLng(
                (p.latitude  + next.latitud!)  / 2,
                (p.longitude + next.longitud!) / 2,
              );
              final d = Geolocator.distanceBetween(
                  p.latitude, p.longitude, next.latitud!, next.longitud!);
              final z = d < 50 ? 19.0 : d < 150 ? 18.0 : d < 400 ? 17.0 : 16.0;
              _mapCtrl.move(mid, z);
            } else {
              _mapCtrl.move(ll, _mapCtrl.camera.zoom);
            }
          } catch (_) {}
        }
      });
    } catch (_) {}
  }

  Future<void> _checkNfc() async {
    try {
      final available = await NfcManager.instance.isAvailable();
      if (mounted) setState(() => _nfcAvailable = available);
    } catch (_) {}
  }

  @override
  void dispose() {
    _stopLoneWorker();
    _posSub?.cancel();
    _gpsService.detener();
    try { NfcManager.instance.stopSession(); } catch (_) {}
    super.dispose();
  }

  // ── Data loading ─────────────────────────────────────────────────────────

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final activa = await widget.api.rondaActiva();
      final rutas = activa == null ? await widget.api.listarRutas() : <RutaRonda>[];
      if (mounted) {
        setState(() {
          _activa = activa;
          _rutas = rutas;
          _loading = false;
        });
        // Actualizar checkpoints pendientes en el GPS service (auto-checkin)
        if (activa != null) {
          _gpsService.updatePendingCheckpoints(activa.allCheckpoints);
        }
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _iniciar(String rutaId) async {
    // Feature 9: Selfie de verificación de identidad antes de iniciar
    File? fotoVerificacion;
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 60,
        maxWidth: 640,
      );
      if (picked != null) fotoVerificacion = File(picked.path);
    } catch (_) {
      // Si no hay cámara frontal disponible, continuar sin foto
    }

    setState(() => _loading = true);
    try {
      await widget.api.iniciarRonda(rutaId, fotoVerificacion: fotoVerificacion);
      await _load();
      widget.onRondaChanged?.call();
      if (_activa != null) {
        // Iniciar tracking GPS en tiempo real para el panel
        _gpsService.iniciar(_activa!.id, widget.api.token);
        // Configurar auto-checkin por proximidad GPS
        _gpsService.onProximityAlert = _onProximityAlert;
        _gpsService.updatePendingCheckpoints(_activa!.allCheckpoints);
        // Iniciar lone worker timer
        _startLoneWorker();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        _showError(e.toString());
      }
    }
  }

  Future<void> _finalizar() async {
    if (_activa == null) return;
    final ok = await _confirm('¿Finalizar la ronda?');
    if (!ok) return;
    _gpsService.detener();
    _stopLoneWorker();
    setState(() => _loading = true);
    try {
      await widget.api.finalizarRonda(_activa!.id);
      await _load();
      widget.onRondaChanged?.call();
    } catch (e) {
      if (mounted) { setState(() => _loading = false); _showError(e.toString()); }
    }
  }

  // ── Lone Worker Timer ─────────────────────────────────────────────────────

  void _startLoneWorker() {
    _loneWorkerTriggered = false;
    _loneWorkerSeconds = _loneWorkerDefault;
    _loneWorkerTimer?.cancel();
    _loneWorkerTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _loneWorkerSeconds--);
      if (_loneWorkerSeconds <= 0 && !_loneWorkerTriggered) {
        _triggerLoneWorkerSOS();
      }
    });
  }

  void _resetLoneWorker() {
    if (!mounted) return;
    setState(() {
      _loneWorkerSeconds = _loneWorkerDefault;
      _loneWorkerTriggered = false;
    });
  }

  void _stopLoneWorker() {
    _loneWorkerTimer?.cancel();
    _loneWorkerTimer = null;
  }

  Future<void> _triggerLoneWorkerSOS() async {
    _loneWorkerTriggered = true;
    try {
      double? lat, lng;
      try {
        final pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 5),
        );
        lat = pos.latitude;
        lng = pos.longitude;
      } catch (_) {}
      await widget.api.crearEventoPanico(
        lat: lat, lng: lng,
        descripcion: 'Alerta automatica — guardia solitario sin respuesta',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Alerta de guardia solitario enviada a la central'),
            backgroundColor: Color(0xFFef4444),
            duration: Duration(seconds: 6),
          ),
        );
      }
    } catch (_) {}
    // Reiniciar timer para seguir alertando si siguen sin responder
    if (mounted) _startLoneWorker();
  }

  // ── Auto GPS Check-in ────────────────────────────────────────────────────

  void _onProximityAlert(CheckpointInfo cp) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Estas cerca de: ${cp.nombre}'),
        backgroundColor: const Color(0xFF1e3a5f),
        duration: const Duration(seconds: 8),
        action: SnackBarAction(
          label: 'MARCAR',
          textColor: const Color(0xFF60a5fa),
          onPressed: () => _irAFormularioCp(cp),
        ),
      ),
    );
  }

  // ── QR / NFC Scanner ─────────────────────────────────────────────────────

  Future<void> _openQrScanner() async {
    // Intentar obtener permiso — si está permanentemente denegado, abrir ajustes
    var status = await Permission.camera.status;
    if (status.isPermanentlyDenied) {
      if (!mounted) return;
      final abrir = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Permiso de camara'),
          content: const Text(
            'El permiso de camara fue denegado permanentemente.\n\n'
            'Toca "Abrir Ajustes", busca "Permisos" y activa la Camara.\n'
            'Luego vuelve a la app e intenta de nuevo.',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
            ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Abrir Ajustes')),
          ],
        ),
      );
      if (abrir == true) await openAppSettings();
      return;
    }
    if (!status.isGranted) {
      status = await Permission.camera.request();
      if (!mounted) return;
      if (!status.isGranted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Se necesita permiso de camara para escanear QR')),
        );
        return;
      }
    }
    if (!mounted) return;
    final qrCode = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const _QrScannerPage()),
    );
    if (qrCode != null && qrCode.isNotEmpty && mounted) {
      await _irAFormulario(qrCode: qrCode);
    }
  }

  Future<void> _openNfcScanner() async {
    if (!_nfcAvailable) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('NFC no disponible en este dispositivo')),
      );
      return;
    }
    if (!mounted) return;
    setState(() => _nfcScanning = true);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Acerca el telefono al tag NFC del checkpoint…'),
        duration: Duration(seconds: 10),
        backgroundColor: Color(0xFF1e3a5f),
      ),
    );
    try {
      await NfcManager.instance.startSession(
        onDiscovered: (NfcTag tag) async {
          String? nfcValue;
          // Intentar leer NDEF
          final ndef = Ndef.from(tag);
          if (ndef != null && ndef.cachedMessage != null) {
            for (final record in ndef.cachedMessage!.records) {
              if (record.typeNameFormat == NdefTypeNameFormat.nfcWellknown) {
                final payload = record.payload;
                if (payload.isNotEmpty) {
                  final langLen = payload[0];
                  nfcValue = String.fromCharCodes(payload.skip(1 + langLen));
                }
              } else {
                nfcValue = String.fromCharCodes(record.payload);
              }
              if (nfcValue != null && nfcValue.isNotEmpty) break;
            }
          }
          // Fallback: usar identificador hex del tag
          if (nfcValue == null || nfcValue.isEmpty) {
            final identifier = tag.data.entries
                .expand((e) => e.value is Map
                    ? (e.value as Map).entries.where((me) => me.key == 'identifier').map((me) => me.value)
                    : <dynamic>[])
                .whereType<List<int>>()
                .firstOrNull;
            if (identifier != null) {
              nfcValue = identifier.map((b) => b.toRadixString(16).padLeft(2, '0')).join(':');
            }
          }

          await NfcManager.instance.stopSession();
          if (!mounted) return;
          setState(() => _nfcScanning = false);
          ScaffoldMessenger.of(context).clearSnackBars();

          if (nfcValue != null && nfcValue.isNotEmpty) {
            await _irAFormulario(nfcTag: nfcValue);
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('No se pudo leer el tag NFC')),
            );
          }
        },
        onError: (error) async {
          await NfcManager.instance.stopSession();
          if (!mounted) return;
          setState(() => _nfcScanning = false);
          ScaffoldMessenger.of(context).clearSnackBars();
        },
      );
    } catch (e) {
      if (mounted) {
        setState(() => _nfcScanning = false);
        ScaffoldMessenger.of(context).clearSnackBars();
        _showError('Error NFC: $e');
      }
    }
  }

  Future<void> _irAFormulario({String? qrCode, String? nfcTag}) async {
    final confirmed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _CheckpointFormPage(
          qrCode: qrCode,
          nfcTag: nfcTag,
          api: widget.api,
        ),
      ),
    );
    if (confirmed == true && mounted) {
      _resetLoneWorker(); // Guardia sigue activo
      await _load();
    }
  }

  Future<void> _irAFormularioCp(CheckpointInfo cp) async {
    // Auto-checkin desde proximidad GPS
    final confirmed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _CheckpointFormPage(
          qrCode: cp.id,
          nfcTag: null,
          api: widget.api,
          isProximity: true,
          checkpointNombre: cp.nombre,
        ),
      ),
    );
    if (confirmed == true && mounted) {
      _resetLoneWorker();
      await _load();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Future<bool> _confirm(String msg) async {
    return await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            backgroundColor: const Color(0xFF1a2744),
            title: const Text('Confirmar', style: TextStyle(color: Colors.white)),
            content: Text(msg, style: const TextStyle(color: Color(0xFF94a3b8))),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Cancelar')),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF3b82f6),
                  foregroundColor: Colors.white,
                ),
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Confirmar'),
              ),
            ],
          ),
        ) ??
        false;
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: const Color(0xFFef4444)),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      color: const Color(0xFF3b82f6),
      backgroundColor: const Color(0xFF1a2744),
      child: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF3b82f6)))
          : _error != null
              ? _buildError()
              : _activa != null
                  ? _buildRondaActiva()
                  : _buildSinRonda(),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.error_outline, color: Color(0xFFef4444), size: 48),
        const SizedBox(height: 12),
        Text(_error!, style: const TextStyle(color: Color(0xFF94a3b8))),
        const SizedBox(height: 16),
        ElevatedButton(onPressed: _load, child: const Text('Reintentar')),
      ]),
    );
  }

  Widget _buildSinRonda() {
    if (_rutas.isEmpty) {
      return const Center(
        child: Text('No hay rutas disponibles',
            style: TextStyle(color: Color(0xFF94a3b8), fontSize: 16)),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('RUTAS DISPONIBLES',
            style: TextStyle(
                color: Color(0xFF94a3b8),
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1)),
        const SizedBox(height: 12),
        ..._rutas.map((r) => _buildRutaCard(r)),
      ],
    );
  }

  Widget _buildRutaCard(RutaRonda ruta) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1a2744),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF243358)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: const Color(0xFF3b82f6).withOpacity(.15),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.route, color: Color(0xFF3b82f6), size: 22),
        ),
        title: Text(ruta.nombre,
            style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w600,
                fontSize: 15)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (ruta.descripcion != null && ruta.descripcion!.isNotEmpty)
              Text(ruta.descripcion!,
                  style:
                      const TextStyle(color: Color(0xFF94a3b8), fontSize: 12)),
            const SizedBox(height: 4),
            Row(children: [
              const Icon(Icons.location_on, size: 12, color: Color(0xFF64748b)),
              const SizedBox(width: 4),
              Text(
                '${ruta.checkpointsTotal} puntos  •  c/~${ruta.intervaloMin} min',
                style:
                    const TextStyle(color: Color(0xFF64748b), fontSize: 11),
              ),
            ]),
          ],
        ),
        trailing: ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF3b82f6),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          onPressed: () => _iniciar(ruta.id),
          child:
              const Text('Iniciar', style: TextStyle(fontWeight: FontWeight.w700)),
        ),
      ),
    );
  }

  Widget _buildRondaActiva() {
    final ronda = _activa!;
    final progreso = ronda.progreso;
    final checkpoints = ronda.allCheckpoints;

    return Column(
      children: [
        // ── Progress card ────────────────────────────────────────────────
        Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1a2744),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF243358)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.route, color: Color(0xFF3b82f6), size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(ronda.rutaNombre,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 15)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF10b981).withOpacity(.15),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text('EN CURSO',
                    style: TextStyle(
                        color: Color(0xFF10b981),
                        fontSize: 10,
                        fontWeight: FontWeight.w700)),
              ),
            ]),
            const SizedBox(height: 12),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('${ronda.checkpointsMarcados} / ${ronda.checkpointsTotal} puntos',
                  style: const TextStyle(color: Color(0xFF94a3b8), fontSize: 13)),
              Text('${(progreso * 100).toStringAsFixed(0)}%',
                  style: const TextStyle(
                      color: Color(0xFF3b82f6),
                      fontWeight: FontWeight.w700,
                      fontSize: 13)),
            ]),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progreso,
                backgroundColor: const Color(0xFF243358),
                valueColor:
                    const AlwaysStoppedAnimation<Color>(Color(0xFF3b82f6)),
                minHeight: 6,
              ),
            ),
          ]),
        ),

        // ── Lone Worker Timer ────────────────────────────────────────────
        if (_loneWorkerTimer != null) _buildLoneWorkerCard(),

        // ── GPS Map ───────────────────────────────────────────────────────
        _buildGpsMap(checkpoints),

        // ── Checkpoint list ───────────────────────────────────────────────
        Expanded(
          child: checkpoints.isEmpty
              ? const Center(
                  child: Text('Sin puntos en esta ruta',
                      style: TextStyle(color: Color(0xFF94a3b8))))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: checkpoints.length,
                  itemBuilder: (_, i) {
                    final cp = checkpoints[i];
                    final done = cp.visitado;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: done
                            ? const Color(0xFF10b981).withOpacity(.08)
                            : const Color(0xFF1a2744),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: done
                              ? const Color(0xFF10b981).withOpacity(.3)
                              : const Color(0xFF243358),
                        ),
                      ),
                      child: Row(children: [
                        Icon(
                            done
                                ? Icons.check_circle
                                : Icons.radio_button_unchecked,
                            color: done
                                ? const Color(0xFF10b981)
                                : const Color(0xFF475569),
                            size: 20),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(cp.nombre,
                              style: TextStyle(
                                color: done
                                    ? const Color(0xFF10b981)
                                    : Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              )),
                        ),
                        Text('${cp.orden}',
                            style: const TextStyle(
                                color: Color(0xFF475569), fontSize: 12)),
                      ]),
                    );
                  },
                ),
        ),

        // ── Bottom action bar ─────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            color: Color(0xFF1a2744),
            border: Border(top: BorderSide(color: Color(0xFF243358))),
          ),
          child: Column(children: [
            Row(children: [
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF3b82f6),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(Icons.qr_code, size: 20),
                  label: const Text('QR',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  onPressed: _openQrScanner,
                ),
              ),
              if (_nfcAvailable) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _nfcScanning
                          ? const Color(0xFF475569)
                          : const Color(0xFF6366f1),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: _nfcScanning
                        ? const SizedBox(
                            width: 18, height: 18,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2))
                        : const Icon(Icons.nfc, size: 20),
                    label: Text(_nfcScanning ? 'Leyendo…' : 'NFC',
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w700)),
                    onPressed: _nfcScanning ? null : _openNfcScanner,
                  ),
                ),
              ],
            ]),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF94a3b8),
                  side: const BorderSide(color: Color(0xFF243358)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: _finalizar,
                child: const Text('Finalizar Ronda',
                    style: TextStyle(fontSize: 14)),
              ),
            ),
          ]),
        ),
      ],
    );
  }

  Widget _buildGpsMap(List<CheckpointInfo> checkpoints) {
    final cpsConGps = checkpoints
        .where((c) => c.latitud != null && c.longitud != null)
        .toList();

    // Sin checkpoints con GPS → plano interior
    if (cpsConGps.isEmpty) {
      return PlanoViewer(
        api: widget.api,
        puestoId: widget.api.puestoId,
        visitedIds: checkpoints.where((c) => c.visitado).map((c) => c.id).toSet(),
        highlightId: checkpoints.any((c) => !c.visitado)
            ? checkpoints.firstWhere((c) => !c.visitado).id
            : null,
      );
    }

    // Próximo checkpoint pendiente con GPS
    CheckpointInfo? nextCp;
    for (final cp in cpsConGps) {
      if (!cp.visitado) { nextCp = cp; break; }
    }

    // Distancia al próximo checkpoint
    double? distMetros;
    String? distText;
    if (_myPosition != null && nextCp != null) {
      distMetros = Geolocator.distanceBetween(
        _myPosition!.latitude, _myPosition!.longitude,
        nextCp.latitud!, nextCp.longitud!,
      );
      distText = distMetros < 1000
          ? '${distMetros.round()} m'
          : '${(distMetros / 1000).toStringAsFixed(1)} km';
    }

    // Centro del mapa: punto medio entre yo y próximo checkpoint
    LatLng center;
    double zoom = 17;
    if (_myPosition != null && nextCp != null) {
      center = LatLng(
        (_myPosition!.latitude  + nextCp.latitud!)  / 2,
        (_myPosition!.longitude + nextCp.longitud!) / 2,
      );
      final d = distMetros ?? 100;
      zoom = d < 50 ? 19 : d < 150 ? 18 : d < 400 ? 17 : d < 900 ? 16 : 14;
    } else if (_myPosition != null) {
      center = LatLng(_myPosition!.latitude, _myPosition!.longitude);
    } else {
      final cp = nextCp ?? cpsConGps.first;
      center = LatLng(cp.latitud!, cp.longitud!);
    }

    // Línea de guía: yo → próximo checkpoint
    final navLine = (_myPosition != null && nextCp != null)
        ? [
            LatLng(_myPosition!.latitude, _myPosition!.longitude),
            LatLng(nextCp.latitud!, nextCp.longitud!),
          ]
        : <LatLng>[];

    return Container(
      height: 250,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF243358)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          children: [
            FlutterMap(
              mapController: _mapCtrl,
              options: MapOptions(
                initialCenter: center,
                initialZoom: zoom,
                onMapEvent: (e) {
                  if (e is MapEventMove &&
                      e.source != MapEventSource.mapController) {
                    if (_mapFollow) setState(() => _mapFollow = false);
                  }
                },
              ),
              children: [
                TileLayer(
                  urlTemplate:
                      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.whatseg.ptt',
                ),
                // Círculo de precisión GPS
                if (_myPosition != null)
                  CircleLayer(circles: [
                    CircleMarker(
                      point: LatLng(_myPosition!.latitude, _myPosition!.longitude),
                      radius: _myPosition!.accuracy.clamp(8, 80),
                      useRadiusInMeter: true,
                      color: const Color(0xFF3b82f6).withOpacity(0.12),
                      borderColor: const Color(0xFF3b82f6).withOpacity(0.5),
                      borderStrokeWidth: 1,
                    ),
                  ]),
                // Rastro del recorrido (gris sutil)
                if (_trail.length > 1)
                  PolylineLayer(polylines: [
                    Polyline(
                      points: _trail,
                      color: const Color(0xFF64748b).withOpacity(0.55),
                      strokeWidth: 2.5,
                    ),
                  ]),
                // Línea de guía hacia próximo checkpoint (naranja punteada)
                if (navLine.length == 2)
                  PolylineLayer(polylines: [
                    Polyline(
                      points: navLine,
                      color: const Color(0xFFf59e0b),
                      strokeWidth: 3,
                    ),
                  ]),
                // Pins de checkpoints
                MarkerLayer(
                  markers: cpsConGps.map((cp) {
                    final isNext = nextCp?.id == cp.id;
                    final color = cp.visitado
                        ? const Color(0xFF10b981)
                        : isNext
                            ? const Color(0xFFf59e0b)
                            : const Color(0xFF6366f1);
                    return Marker(
                      point: LatLng(cp.latitud!, cp.longitud!),
                      width: isNext ? 38 : 32,
                      height: isNext ? 38 : 32,
                      child: Container(
                        decoration: BoxDecoration(
                          color: color,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: isNext ? 3 : 2),
                          boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4)],
                        ),
                        child: Center(
                          child: Text(
                            '${cp.orden}',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: isNext ? 14 : 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                // Mi posición (punto azul con halo)
                if (_myPosition != null)
                  MarkerLayer(markers: [
                    Marker(
                      point: LatLng(_myPosition!.latitude, _myPosition!.longitude),
                      width: 24,
                      height: 24,
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF3b82f6),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF3b82f6).withOpacity(0.4),
                              blurRadius: 8,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ]),
              ],
            ),

            // Badge distancia al próximo checkpoint
            if (distText != null)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFf59e0b),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4)],
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.near_me, size: 13, color: Colors.white),
                    const SizedBox(width: 4),
                    Text(
                      distText,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ]),
                ),
              ),

            // Botón centrar (seguir mi posición)
            Positioned(
              bottom: 8,
              right: 8,
              child: GestureDetector(
                onTap: () {
                  setState(() => _mapFollow = true);
                  if (_myPosition != null && nextCp != null) {
                    final mid = LatLng(
                      (_myPosition!.latitude  + nextCp.latitud!)  / 2,
                      (_myPosition!.longitude + nextCp.longitud!) / 2,
                    );
                    final d = Geolocator.distanceBetween(
                      _myPosition!.latitude, _myPosition!.longitude,
                      nextCp.latitud!, nextCp.longitud!,
                    );
                    final z = d < 50 ? 19.0 : d < 150 ? 18.0 : d < 400 ? 17.0 : 16.0;
                    _mapCtrl.move(mid, z);
                  } else if (_myPosition != null) {
                    _mapCtrl.move(
                      LatLng(_myPosition!.latitude, _myPosition!.longitude), 17);
                  }
                },
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: _mapFollow ? const Color(0xFF3b82f6) : Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4)],
                  ),
                  child: Icon(
                    Icons.my_location,
                    size: 18,
                    color: _mapFollow ? Colors.white : const Color(0xFF3b82f6),
                  ),
                ),
              ),
            ),

            // Leyenda inferior izquierda
            Positioned(
              bottom: 8,
              left: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.55),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  _mapDot(const Color(0xFF3b82f6)),
                  const SizedBox(width: 3),
                  const Text('Yo', style: TextStyle(color: Colors.white, fontSize: 9)),
                  const SizedBox(width: 7),
                  _mapDot(const Color(0xFFf59e0b)),
                  const SizedBox(width: 3),
                  const Text('Próximo', style: TextStyle(color: Colors.white, fontSize: 9)),
                  const SizedBox(width: 7),
                  _mapDot(const Color(0xFF10b981)),
                  const SizedBox(width: 3),
                  const Text('OK', style: TextStyle(color: Colors.white, fontSize: 9)),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _mapDot(Color c) => Container(
    width: 8, height: 8,
    decoration: BoxDecoration(color: c, shape: BoxShape.circle),
  );

  Widget _buildLoneWorkerCard() {
    final mins = _loneWorkerSeconds ~/ 60;
    final secs = _loneWorkerSeconds % 60;
    final timeStr =
        '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
    final Color timerColor;
    if (_loneWorkerSeconds > 600) {
      timerColor = const Color(0xFF10b981); // verde > 10 min
    } else if (_loneWorkerSeconds > 300) {
      timerColor = const Color(0xFFf59e0b); // amarillo 5-10 min
    } else {
      timerColor = const Color(0xFFef4444); // rojo < 5 min
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: timerColor.withOpacity(.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: timerColor.withOpacity(.3)),
      ),
      child: Row(children: [
        Icon(Icons.person_outline, color: timerColor, size: 18),
        const SizedBox(width: 8),
        const Text('Guardia solitario',
            style: TextStyle(color: Color(0xFF94a3b8), fontSize: 12)),
        const Spacer(),
        Text(timeStr,
            style: TextStyle(
                color: timerColor,
                fontSize: 16,
                fontWeight: FontWeight.w700,
                fontFeatures: const [FontFeature.tabularFigures()])),
        const SizedBox(width: 10),
        GestureDetector(
          onTap: _resetLoneWorker,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: timerColor.withOpacity(.15),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: timerColor.withOpacity(.4)),
            ),
            child: Text('Estoy Bien',
                style: TextStyle(
                    color: timerColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w700)),
          ),
        ),
      ]),
    );
  }
}

// ─── Formulario de confirmación (foto + observaciones) ────────────────────────

class _CheckpointFormPage extends StatefulWidget {
  final String? qrCode;
  final String? nfcTag;
  final ApiService api;
  final bool isProximity;
  final String? checkpointNombre;

  const _CheckpointFormPage({
    this.qrCode,
    this.nfcTag,
    required this.api,
    this.isProximity = false,
    this.checkpointNombre,
  });

  @override
  State<_CheckpointFormPage> createState() => _CheckpointFormPageState();
}

class _CheckpointFormPageState extends State<_CheckpointFormPage> {
  final _obsController = TextEditingController();
  File? _foto;
  bool _submitting = false;
  Position? _position;
  bool _gpsLoading = true;

  // Feature 5: Configurable form fields
  List<Map<String, dynamic>> _campos = [];
  final Map<String, String> _respuestas = {}; // campo_id → valor

  @override
  void initState() {
    super.initState();
    _getGPS();
    _loadCampos();
  }

  @override
  void dispose() {
    _obsController.dispose();
    super.dispose();
  }

  Future<void> _loadCampos() async {
    final cpId = widget.qrCode;
    if (cpId == null || cpId.isEmpty) return;
    try {
      final campos = await widget.api.getCamposCheckpoint(cpId);
      if (mounted && campos.isNotEmpty) setState(() => _campos = campos);
    } catch (_) {}
  }

  Widget _buildCampoWidget(Map<String, dynamic> campo) {
    final id = campo['id'] as String;
    final etiqueta = campo['etiqueta'] as String? ?? '';
    final tipo = campo['tipo'] as String? ?? 'texto';
    final requerido = campo['requerido'] == true;
    final label = '$etiqueta${requerido ? ' *' : ''}';

    if (tipo == 'seleccion') {
      List<String> opciones = [];
      try {
        final raw = campo['opciones'];
        if (raw is String && raw.isNotEmpty) {
          opciones = (jsonDecode(raw) as List).cast<String>();
        }
      } catch (_) {}

      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: DropdownButtonFormField<String>(
          value: _respuestas[id]?.isNotEmpty == true ? _respuestas[id] : null,
          dropdownColor: const Color(0xFF1a2744),
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            labelText: label,
            labelStyle: const TextStyle(color: Color(0xFF94a3b8), fontSize: 13),
            filled: true,
            fillColor: const Color(0xFF1a2744),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFF243358)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFF243358)),
            ),
          ),
          items: opciones.map((o) => DropdownMenuItem(value: o, child: Text(o))).toList(),
          onChanged: (v) => setState(() => _respuestas[id] = v ?? ''),
        ),
      );
    }

    if (tipo == 'numero') {
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextField(
          keyboardType: TextInputType.number,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            labelText: label,
            labelStyle: const TextStyle(color: Color(0xFF94a3b8), fontSize: 13),
            filled: true,
            fillColor: const Color(0xFF1a2744),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFF243358)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFF243358)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFF3b82f6)),
            ),
          ),
          onChanged: (v) => _respuestas[id] = v,
        ),
      );
    }

    // Default: texto
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        style: const TextStyle(color: Colors.white, fontSize: 14),
        maxLines: tipo == 'foto' ? 1 : 2,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(color: Color(0xFF94a3b8), fontSize: 13),
          filled: true,
          fillColor: const Color(0xFF1a2744),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFF243358)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFF243358)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFF3b82f6)),
          ),
        ),
        onChanged: (v) => _respuestas[id] = v,
      ),
    );
  }

  Future<void> _getGPS() async {
    try {
      bool enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) { setState(() => _gpsLoading = false); return; }
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
        if (perm == LocationPermission.denied) {
          setState(() => _gpsLoading = false);
          return;
        }
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 8),
      );
      if (mounted) setState(() { _position = pos; _gpsLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _gpsLoading = false);
    }
  }

  Future<void> _tomarFoto() async {
    final picker = ImagePicker();
    try {
      final XFile? img = await picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1280,
        maxHeight: 960,
        imageQuality: 75,
      );
      if (img != null && mounted) {
        setState(() => _foto = File(img.path));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error al tomar foto: $e'),
              backgroundColor: const Color(0xFFef4444)),
        );
      }
    }
  }

  Future<void> _confirmar() async {
    // Validate required configurable fields
    for (final campo in _campos) {
      if (campo['requerido'] == true) {
        final val = _respuestas[campo['id'] as String] ?? '';
        if (val.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Campo requerido: ${campo['etiqueta']}'),
              backgroundColor: const Color(0xFFef4444),
            ),
          );
          return;
        }
      }
    }

    setState(() => _submitting = true);
    try {
      final result = await widget.api.marcarCheckpoint(
        qrCode: widget.qrCode,
        nfcTag: widget.nfcTag,
        latitud: _position?.latitude,
        longitud: _position?.longitude,
        observaciones: _obsController.text.trim().isEmpty
            ? null
            : _obsController.text.trim(),
        foto: _foto,
      );

      // Feature 5: Submit form responses if any
      if (_campos.isNotEmpty && _respuestas.isNotEmpty) {
        final visitaId = result['visita']?['id']?.toString();
        if (visitaId != null && visitaId.isNotEmpty) {
          final respList = _respuestas.entries
              .where((e) => e.value.isNotEmpty)
              .map((e) => {'campo_id': e.key, 'valor': e.value})
              .toList();
          if (respList.isNotEmpty) {
            try {
              await widget.api.guardarRespuestasVisita(visitaId, respList);
            } catch (_) {} // Non-critical, checkpoint already marked
          }
        }
      }

      if (!mounted) return;

      final nombre = result['checkpoint'] ?? 'Checkpoint';
      final progreso = result['progreso'] ?? '';
      final completada = result['completada'] == true;

      final msg = completada
          ? '¡Ronda completada! Todos los checkpoints marcados.'
          : '$nombre marcado. $progreso';

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: const Color(0xFF10b981)),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: const Color(0xFFef4444),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.isProximity
        ? 'Confirmar: ${widget.checkpointNombre ?? 'Checkpoint'}'
        : 'Confirmar Checkpoint';
    final icon = widget.nfcTag != null ? Icons.nfc : Icons.qr_code;
    final codeLabel = widget.nfcTag != null ? 'Tag NFC' : 'Codigo escaneado';
    final codeValue = (widget.nfcTag ?? widget.qrCode) ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1a2744),
        foregroundColor: Colors.white,
        title: Text(title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Code info ─────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF1a2744),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF243358)),
              ),
              child: Row(children: [
                Icon(icon, color: const Color(0xFF3b82f6), size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(codeLabel,
                            style: const TextStyle(
                                color: Color(0xFF64748b), fontSize: 11)),
                        Text(
                          codeValue.length > 36
                              ? '${codeValue.substring(0, 36)}…'
                              : codeValue,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w600),
                        ),
                      ]),
                ),
              ]),
            ),
            const SizedBox(height: 12),

            // ── GPS ──────────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF1a2744),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF243358)),
              ),
              child: Row(children: [
                Icon(
                  _position != null ? Icons.location_on : Icons.location_off,
                  color: _position != null
                      ? const Color(0xFF10b981)
                      : const Color(0xFF64748b),
                  size: 18,
                ),
                const SizedBox(width: 8),
                _gpsLoading
                    ? const Text('Obteniendo GPS…',
                        style: TextStyle(color: Color(0xFF64748b), fontSize: 12))
                    : _position != null
                        ? Text(
                            'GPS: ${_position!.latitude.toStringAsFixed(5)}, ${_position!.longitude.toStringAsFixed(5)}',
                            style: const TextStyle(
                                color: Color(0xFF10b981), fontSize: 12),
                          )
                        : const Text('GPS no disponible',
                            style: TextStyle(
                                color: Color(0xFF64748b), fontSize: 12)),
              ]),
            ),
            const SizedBox(height: 20),

            // ── Foto ────────────────────────────────────────────────
            const Text('FOTO (opcional)',
                style: TextStyle(
                    color: Color(0xFF94a3b8),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1)),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _submitting ? null : _tomarFoto,
              child: Container(
                width: double.infinity,
                height: _foto != null ? 200 : 100,
                decoration: BoxDecoration(
                  color: const Color(0xFF1a2744),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: _foto != null
                        ? const Color(0xFF3b82f6)
                        : const Color(0xFF243358),
                  ),
                ),
                child: _foto != null
                    ? Stack(
                        fit: StackFit.expand,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(9),
                            child: Image.file(_foto!, fit: BoxFit.cover),
                          ),
                          Positioned(
                            top: 8, right: 8,
                            child: GestureDetector(
                              onTap: () => setState(() => _foto = null),
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: Colors.black54,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: const Icon(Icons.close,
                                    color: Colors.white, size: 16),
                              ),
                            ),
                          ),
                          Positioned(
                            bottom: 8, right: 8,
                            child: GestureDetector(
                              onTap: _tomarFoto,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF3b82f6),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: const Text('Cambiar',
                                    style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600)),
                              ),
                            ),
                          ),
                        ],
                      )
                    : const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.camera_alt,
                              color: Color(0xFF3b82f6), size: 28),
                          SizedBox(height: 6),
                          Text('Toque para tomar foto',
                              style: TextStyle(
                                  color: Color(0xFF64748b), fontSize: 13)),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 20),

            // ── Feature 5: Configurable form fields ─────────────────
            if (_campos.isNotEmpty) ...[
              const Text('FORMULARIO DEL CHECKPOINT',
                  style: TextStyle(
                      color: Color(0xFF94a3b8),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1)),
              const SizedBox(height: 8),
              ..._campos.map((campo) => _buildCampoWidget(campo)),
              const SizedBox(height: 12),
            ],

            // ── Observaciones ───────────────────────────────────────
            const Text('OBSERVACIONES (opcional)',
                style: TextStyle(
                    color: Color(0xFF94a3b8),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1)),
            const SizedBox(height: 8),
            TextField(
              controller: _obsController,
              enabled: !_submitting,
              maxLines: 4,
              maxLength: 500,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText:
                    'Ej: "Puerta abierta", "Luz apagada", "Sin novedad"…',
                hintStyle:
                    const TextStyle(color: Color(0xFF475569), fontSize: 13),
                filled: true,
                fillColor: const Color(0xFF1a2744),
                counterStyle: const TextStyle(color: Color(0xFF475569)),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFF243358)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFF243358)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFF3b82f6)),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // ── Confirmar ───────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10b981),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  disabledBackgroundColor:
                      const Color(0xFF10b981).withOpacity(.5),
                ),
                onPressed: _submitting ? null : _confirmar,
                child: _submitting
                    ? const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 2)),
                          SizedBox(width: 10),
                          Text('Enviando…',
                              style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700)),
                        ],
                      )
                    : const Text('CONFIRMAR VISITA',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

// ─── Pantalla de escaneo QR ───────────────────────────────────────────────────

class _QrScannerPage extends StatefulWidget {
  const _QrScannerPage();

  @override
  State<_QrScannerPage> createState() => _QrScannerPageState();
}

class _QrScannerPageState extends State<_QrScannerPage> {
  // Controller se crea inmediatamente — el widget MobileScanner llama start()
  late MobileScannerController _ctrl;
  bool _scanned = false;
  bool _torchOn = false;

  @override
  void initState() {
    super.initState();
    _ctrl = MobileScannerController(
      autoStart: true,
      torchEnabled: false,
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_scanned) return;
    final code = capture.barcodes.firstOrNull?.rawValue;
    if (code != null && code.isNotEmpty) {
      _scanned = true;
      _ctrl.stop();
      Navigator.of(context).pop(code);
    }
  }

  /// Fallback: tomar foto del QR con la cámara nativa y decodificar
  Future<void> _tomarFotoQR() async {
    // Pausar el scanner para liberar la cámara
    try { await _ctrl.stop(); } catch (_) {}
    await Future.delayed(const Duration(milliseconds: 300));

    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.camera,
        imageQuality: 90,
        maxWidth: 1280,
      );
      if (picked == null || !mounted) return;

      // Decodificar QR de la imagen
      final analizar = MobileScannerController(autoStart: false);
      try {
        final result = await analizar.analyzeImage(picked.path);
        await analizar.dispose();
        if (!mounted) return;
        final code = result?.barcodes.firstOrNull?.rawValue;
        if (code != null && code.isNotEmpty) {
          Navigator.of(context).pop(code);
          return;
        }
      } catch (_) {
        try { await analizar.dispose(); } catch (_) {}
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se detecto un codigo QR en la foto.\nIntenta con mejor enfoque.'),
          duration: Duration(seconds: 3),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error al tomar foto: $e')),
      );
    }

    // Reiniciar el scanner
    if (mounted) {
      try { await _ctrl.start(); } catch (_) {}
    }
  }

  void _entradaManual() {
    final tc = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Codigo QR manual'),
        content: TextField(
          controller: tc,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Ingresa el codigo del checkpoint',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () {
              final v = tc.text.trim();
              if (v.isNotEmpty) {
                Navigator.pop(ctx);
                Navigator.of(context).pop(v);
              }
            },
            child: const Text('Aceptar'),
          ),
        ],
      ),
    );
  }

  Future<void> _reintentar() async {
    try { await _ctrl.stop(); } catch (_) {}
    try { await _ctrl.dispose(); } catch (_) {}
    if (!mounted) return;
    setState(() {
      _ctrl = MobileScannerController(
        autoStart: true,
        torchEnabled: _torchOn,
      );
    });
  }

  Widget _buildErrorUI(String errorMsg) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.camera_alt_outlined, color: Color(0xFF64748b), size: 64),
            const SizedBox(height: 16),
            Text(
              errorMsg,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF94a3b8), fontSize: 14),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10b981),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: _tomarFotoQR,
                icon: const Icon(Icons.camera_alt, size: 20),
                label: const Text('Tomar foto del QR', style: TextStyle(fontSize: 16)),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF3b82f6),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: _reintentar,
                icon: const Icon(Icons.refresh, size: 20),
                label: const Text('Reintentar camara', style: TextStyle(fontSize: 16)),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: _entradaManual,
                icon: const Icon(Icons.keyboard, size: 20),
                label: const Text('Ingresar codigo manualmente', style: TextStyle(fontSize: 16)),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: openAppSettings,
              child: const Text('Abrir Ajustes de Permisos',
                  style: TextStyle(color: Color(0xFF6366f1))),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0f172a),
        foregroundColor: Colors.white,
        title: const Text('Escanear QR del Punto'),
        actions: [
          IconButton(
            icon: Icon(_torchOn ? Icons.flash_off : Icons.flash_on),
            tooltip: 'Linterna',
            onPressed: () {
              setState(() => _torchOn = !_torchOn);
              try { _ctrl.toggleTorch(); } catch (_) {}
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          // El widget MobileScanner maneja start() internamente
          MobileScanner(
            controller: _ctrl,
            onDetect: _onDetect,
            placeholderBuilder: (ctx) => const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: Color(0xFF3b82f6)),
                  SizedBox(height: 16),
                  Text('Iniciando camara...', style: TextStyle(color: Color(0xFF94a3b8))),
                ],
              ),
            ),
            errorBuilder: (ctx, error) {
              String msg;
              switch (error.errorCode) {
                case MobileScannerErrorCode.permissionDenied:
                  msg = 'Permiso de camara denegado.\nVe a Ajustes > Apps > WhatsEg PTT > Permisos\ny activa la Camara.';
                  break;
                default:
                  msg = 'Error de camara: ${error.errorCode.name}\n${error.errorDetails?.message ?? ''}\n\nUsa "Tomar foto del QR" como alternativa.';
              }
              return _buildErrorUI(msg);
            },
          ),
          // Marco de escaneo centrado
          IgnorePointer(
            child: Center(
              child: Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFF3b82f6), width: 3),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: const BoxDecoration(
                        color: Color(0xCC0f172a),
                        borderRadius: BorderRadius.only(
                          bottomLeft: Radius.circular(13),
                          bottomRight: Radius.circular(13),
                        ),
                      ),
                      child: const Text(
                        'Apunta al codigo QR del checkpoint',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.white, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Botones flotantes inferiores
          Positioned(
            bottom: 24,
            left: 24,
            right: 24,
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10b981),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: _tomarFotoQR,
                    icon: const Icon(Icons.camera_alt, size: 18),
                    label: const Text('Foto del QR'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white54),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: _entradaManual,
                    icon: const Icon(Icons.keyboard, size: 18),
                    label: const Text('Manual'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
