import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter/services.dart';
import '../models/usuario_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import 'login_screen.dart';

enum TipoEvento { panico, alarma, sos, prueba }

extension TipoEventoExt on TipoEvento {
  String get nombre {
    switch (this) {
      case TipoEvento.panico: return 'PANICO';
      case TipoEvento.alarma: return 'ALARMA';
      case TipoEvento.sos:    return 'SOS';
      case TipoEvento.prueba: return 'PRUEBA';
    }
  }

  Color get color {
    switch (this) {
      case TipoEvento.panico: return const Color(0xFFdc2626);
      case TipoEvento.alarma: return const Color(0xFFf97316);
      case TipoEvento.sos:    return const Color(0xFF3b82f6);
      case TipoEvento.prueba: return const Color(0xFF6b7280);
    }
  }

  IconData get icon {
    switch (this) {
      case TipoEvento.panico: return Icons.emergency;
      case TipoEvento.alarma: return Icons.warning_amber_rounded;
      case TipoEvento.sos:    return Icons.sos;
      case TipoEvento.prueba: return Icons.check_circle_outline;
    }
  }
}

class HomeScreen extends StatefulWidget {
  final UsuarioInfo usuario;
  const HomeScreen({super.key, required this.usuario});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with TickerProviderStateMixin {
  TipoEvento _tipoSeleccionado = TipoEvento.panico;
  bool _enviando = false;
  String? _estadoMensaje;
  bool _exitoReciente = false;
  bool _online = true;
  int _colaOffline = 0;

  // Animación del botón
  late AnimationController _pulseCtrl;
  late Animation<double> _pulseAnim;

  // Long-press para PÁNICO
  Timer? _holdTimer;
  double _holdProgress = 0.0;
  Timer? _holdProgressTimer;
  bool _holding = false;

  // Reintentar cola offline
  Timer? _retryTimer;


  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
    _solicitarPermisos();
    _cargarCola();
    _retryTimer = Timer.periodic(const Duration(seconds: 30), (_) => _reintentarCola());
  }

  Future<void> _solicitarPermisos() async {
    await Permission.location.request();
  }

  Future<void> _cargarCola() async {
    final cola = await StorageService.leerCola();
    if (mounted) setState(() => _colaOffline = cola.length);
  }

  Future<Position?> _obtenerUbicacion() async {
    try {
      final perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return null;
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
    } catch (_) { return null; }
  }

  Future<void> _enviarEvento(TipoEvento tipo) async {
    if (_enviando) return;
    setState(() { _enviando = true; _estadoMensaje = 'Obteniendo ubicación...'; _exitoReciente = false; });

    final pos = await _obtenerUbicacion();

    setState(() => _estadoMensaje = 'Enviando ${tipo.nombre}...');

    final api = ApiService(widget.usuario.token);

    try {
      await api.crearEvento(
        tipo: tipo.nombre,
        lat:  pos?.latitude,
        lng:  pos?.longitude,
      );
      setState(() {
        _estadoMensaje = '✓ ${tipo.nombre} enviado';
        _exitoReciente  = true;
        _online         = true;
      });
      // Vibración de confirmación
      try { HapticFeedback.heavyImpact(); } catch (_) {}
    } catch (_) {
      // Sin conexión → encolar
      await StorageService.encolarEvento({
        'tipo': tipo.nombre,
        'lat':  pos?.latitude,
        'lng':  pos?.longitude,
        'ts':   DateTime.now().toIso8601String(),
      });
      await _cargarCola();
      setState(() {
        _estadoMensaje = '⚠ Sin conexión — guardado (${_colaOffline})';
        _online        = false;
      });
    } finally {
      setState(() => _enviando = false);
      // Limpiar mensaje después de 4s
      Future.delayed(const Duration(seconds: 4), () {
        if (mounted) setState(() { _estadoMensaje = null; _exitoReciente = false; });
      });
    }
  }

  Future<void> _reintentarCola() async {
    final cola = await StorageService.leerCola();
    if (cola.isEmpty) return;
    final api = ApiService(widget.usuario.token);
    bool exito = true;
    for (final ev in cola) {
      try {
        await api.crearEvento(
          tipo: ev['tipo'] as String,
          lat:  ev['lat'] as double?,
          lng:  ev['lng'] as double?,
        );
      } catch (_) { exito = false; break; }
    }
    if (exito) {
      await StorageService.limpiarCola();
      if (mounted) setState(() { _colaOffline = 0; _online = true; });
    }
  }

  void _onHoldStart() {
    if (_tipoSeleccionado != TipoEvento.panico || _enviando) return;
    _holding = true;
    _holdProgress = 0;
    _holdProgressTimer = Timer.periodic(const Duration(milliseconds: 40), (t) {
      if (!mounted || !_holding) { t.cancel(); return; }
      setState(() => _holdProgress = (_holdProgress + 40 / 2000).clamp(0.0, 1.0));
      if (_holdProgress >= 1.0) {
        t.cancel();
        _onHoldComplete();
      }
    });
  }

  void _onHoldEnd() {
    if (!_holding) return;
    _holding = false;
    _holdProgressTimer?.cancel();
    if (_holdProgress < 1.0) setState(() => _holdProgress = 0);
  }

  void _onHoldComplete() {
    _holding = false;
    setState(() => _holdProgress = 0);
    _enviarEvento(TipoEvento.panico);
  }

  Future<void> _cerrarSesion() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1a0a0a),
        title: const Text('Cerrar sesión', style: TextStyle(color: Colors.white)),
        content: const Text('¿Deseas salir?', style: TextStyle(color: Color(0xFF94a3b8))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar', style: TextStyle(color: Color(0xFF94a3b8)))),
          TextButton(onPressed: () => Navigator.pop(context, true),
            child: const Text('Salir', style: TextStyle(color: Color(0xFFdc2626)))),
        ],
      ),
    );
    if (ok == true) {
      await StorageService.borrarSesion();
      if (mounted) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f0505),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1a0505),
        elevation: 0,
        title: Row(children: [
          // Ícono boton.png circular
          Container(
            width: 32, height: 32,
            decoration: const BoxDecoration(shape: BoxShape.circle),
            clipBehavior: Clip.antiAlias,
            child: Image.asset('assets/boton.png', fit: BoxFit.cover),
          ),
          const SizedBox(width: 8),
          // Punto de estado online/offline
          Container(
            width: 8, height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _online ? const Color(0xFF22c55e) : const Color(0xFF6b7280),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              widget.usuario.nombre,
              style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (_colaOffline > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFf97316).withOpacity(.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('$_colaOffline pendiente${_colaOffline > 1 ? 's' : ''}',
                style: const TextStyle(color: Color(0xFFf97316), fontSize: 11)),
            ),
        ]),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Color(0xFF94a3b8)),
            onPressed: _cerrarSesion,
          ),
        ],
      ),
      body: Column(
        children: [
          // Botón principal de pánico (centro)
          Expanded(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_tipoSeleccionado == TipoEvento.panico) ...[
                    // Hold progress ring + botón grande
                    _buildPanicoButton(),
                    const SizedBox(height: 12),
                    const Text('Mantén presionado 2 segundos',
                      style: TextStyle(color: Color(0xFF64748b), fontSize: 12)),
                  ] else ...[
                    // Tap simple para otros tipos
                    _buildSimpleButton(),
                    const SizedBox(height: 12),
                    const Text('Toca para activar',
                      style: TextStyle(color: Color(0xFF64748b), fontSize: 12)),
                  ],
                  const SizedBox(height: 20),
                  // Estado
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    child: _estadoMensaje != null
                      ? Container(
                          key: ValueKey(_estadoMensaje),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                          decoration: BoxDecoration(
                            color: _exitoReciente
                              ? const Color(0xFF22c55e).withOpacity(.15)
                              : const Color(0xFFf97316).withOpacity(.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(_estadoMensaje!,
                            style: TextStyle(
                              color: _exitoReciente ? const Color(0xFF22c55e) : const Color(0xFFf97316),
                              fontWeight: FontWeight.w600,
                            )),
                        )
                      : const SizedBox(key: ValueKey('empty'), height: 40),
                  ),
                ],
              ),
            ),
          ),

          // Botones de tipo
          Container(
            color: const Color(0xFF1a0505),
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
            child: Row(
              children: TipoEvento.values.map((tipo) {
                final active = _tipoSeleccionado == tipo;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _tipoSeleccionado = tipo),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: active ? tipo.color.withOpacity(.2) : const Color(0xFF0f0505),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: active ? tipo.color : const Color(0xFF3d1515),
                          width: active ? 2 : 1,
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(tipo.icon, color: active ? tipo.color : const Color(0xFF64748b), size: 22),
                          const SizedBox(height: 4),
                          Text(tipo.nombre,
                            style: TextStyle(
                              color: active ? tipo.color : const Color(0xFF64748b),
                              fontSize: 10,
                              fontWeight: active ? FontWeight.w700 : FontWeight.w400,
                            )),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPanicoButton() {
    return GestureDetector(
      onLongPressStart: (_) => _onHoldStart(),
      onLongPressEnd:   (_) => _onHoldEnd(),
      onLongPressCancel: _onHoldEnd,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Ring de progreso
          SizedBox(
            width: 220, height: 220,
            child: CircularProgressIndicator(
              value: _holdProgress,
              strokeWidth: 6,
              backgroundColor: const Color(0xFF3d1515),
              valueColor: AlwaysStoppedAnimation<Color>(
                _holding ? const Color(0xFFdc2626) : Colors.transparent,
              ),
            ),
          ),
          ScaleTransition(
            scale: _pulseAnim,
            child: _botonCircular(TipoEvento.panico, 190),
          ),
        ],
      ),
    );
  }

  Widget _buildSimpleButton() {
    return GestureDetector(
      onTap: _enviando ? null : () => _enviarEvento(_tipoSeleccionado),
      child: _botonCircular(_tipoSeleccionado, 190),
    );
  }

  Widget _botonCircular(TipoEvento tipo, double size) {
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: _enviando ? tipo.color.withOpacity(.4) : tipo.color,
        boxShadow: [
          BoxShadow(color: tipo.color.withOpacity(.5), blurRadius: 30, spreadRadius: 5),
        ],
      ),
      child: _enviando
        ? const Center(child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3))
        : Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(tipo.icon, color: Colors.white, size: 56),
              const SizedBox(height: 6),
              Text(tipo.nombre,
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900,
                    letterSpacing: 2)),
            ],
          ),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _holdTimer?.cancel();
    _holdProgressTimer?.cancel();
    _retryTimer?.cancel();
    super.dispose();
  }
}
