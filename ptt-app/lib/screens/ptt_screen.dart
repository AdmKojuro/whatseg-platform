import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import '../models/ronda_models.dart';
import '../services/api_service.dart';
import '../services/background_service.dart';
import '../services/ptt_service.dart';
import '../widgets/reports_list.dart';
import 'login_screen.dart';
import 'rondas_screen.dart';
import 'supervisor_rondas_screen.dart';

class PttScreen extends StatefulWidget {
  final GuardiaInfo guardia;
  const PttScreen({super.key, required this.guardia});

  @override
  State<PttScreen> createState() => _PttScreenState();
}

class _PttScreenState extends State<PttScreen> with WidgetsBindingObserver {
  late PttService _pttService;
  late ApiService _apiService;

  List<Comunidad> _comunidades = [];
  Comunidad? _selectedComunidad;
  PttTipo _selectedTipo = PttTipo.novedad;
  List<ReportePTT> _reportes = [];
  bool _loadingReportes = false;

  // 0=Inicio, 1=Rondas, 2=PTT, 3=Novedades, 4=Más
  int _tab = 0;
  int _pttSubTab = 0; // 0=Canales, 1=Contactos
  String? _selectedUser;

  Map<String, bool> _modules = {'REPORTES_PTT': true, 'RONDAS': true};
  bool _modulesLoaded = false;

  bool _sendingSos = false;

  // Home screen
  RondaActiva? _homeRonda;

  // Novedades form
  String? _novedadTipo;
  final _novedadDescCtrl = TextEditingController();
  File? _novedadFoto;
  bool _enviandoNovedad = false;

  static const List<Map<String, dynamic>> _novedadTipos = [
    {'tipo': 'PERSONA_SOSPECHOSA',  'label': 'Persona\nsospechosa',     'icon': Icons.person_off_rounded},
    {'tipo': 'VEHICULO_SOSPECHOSO', 'label': 'Vehículo\nsospechoso',    'icon': Icons.directions_car_rounded},
    {'tipo': 'INCENDIO',            'label': 'Incendio',                'icon': Icons.local_fire_department_rounded},
    {'tipo': 'FUGA_AGUA',           'label': 'Fuga de\nagua',           'icon': Icons.water_drop_rounded},
    {'tipo': 'DANO_ELECTRICO',      'label': 'Daño\neléctrico',         'icon': Icons.electrical_services_rounded},
    {'tipo': 'PUERTA_ABIERTA',      'label': 'Puerta\nabierta',         'icon': Icons.door_front_door_rounded},
    {'tipo': 'CAMARA_DANADA',       'label': 'Cámara\ndañada',          'icon': Icons.videocam_off_rounded},
    {'tipo': 'ILUMINACION',         'label': 'Iluminación',             'icon': Icons.lightbulb_outline_rounded},
    {'tipo': 'ALTERACION_ORDEN',    'label': 'Alteración\ndel orden',   'icon': Icons.groups_rounded},
    {'tipo': 'ELEMENTO_ENCONTRADO', 'label': 'Elemento\nencontrado',    'icon': Icons.search_rounded},
    {'tipo': 'OTRA',                'label': 'Otra\nnovedad',           'icon': Icons.more_horiz_rounded},
  ];

  // ── Admin alert dedup ─────────────────────────────────────────────────
  Map<String, dynamic>? _lastShownAlert;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _apiService = ApiService(widget.guardia.token);
    _loadModules();
  }

  Future<void> _loadModules() async {
    final mods = await _apiService.modulosComunidad(widget.guardia.comunidadId ?? '');
    if (mounted) {
      setState(() {
        _modules = mods;
        _modulesLoaded = true;
      });
    }
    if (_modules['REPORTES_PTT'] != false) {
      await _initPtt();
      _loadComunidades();
      _loadReportes();
    } else {
      final communityId = widget.guardia.comunidadId ?? '';
      _pttService = PttService(
        token: widget.guardia.token,
        communityId: communityId,
        guardianName: widget.guardia.nombre,
      );
      _pttService.addListener(_onPttChange);
      if (mounted) setState(() {});
    }
    _checkAlertas();
    _loadHomeRonda();
  }

  Future<void> _loadHomeRonda() async {
    if (_modules['RONDAS'] == false) return;
    try {
      final ronda = await _apiService.rondaActiva();
      if (mounted) setState(() => _homeRonda = ronda);
    } catch (_) {}
  }

  Future<void> _checkAlertas() async {
    final comunidadId = widget.guardia.comunidadId ?? '';
    if (comunidadId.isEmpty) return;
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;
    final alertas = await _apiService.alertasPendientes(comunidadId);
    if (!mounted || alertas.isEmpty) return;
    _showAlertasDialog(alertas);
  }

  Future<void> _showAlertasDialog(List<Map<String, dynamic>> alertas) async {
    for (final alerta in alertas) {
      if (!mounted) return;
      final tipo = alerta['tipo'] as String? ?? 'INFO';
      final color = tipo == 'URGENTE'
          ? const Color(0xFFef4444)
          : tipo == 'ALERTA'
              ? const Color(0xFFf59e0b)
              : const Color(0xFF3b82f6);
      await showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => AlertDialog(
          backgroundColor: const Color(0xFF1a2744),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(children: [
            Icon(Icons.notifications_active, color: color, size: 22),
            const SizedBox(width: 8),
            Expanded(child: Text(alerta['titulo'] as String? ?? 'Alerta',
                style: const TextStyle(color: Colors.white, fontSize: 16))),
          ]),
          content: Text(alerta['mensaje'] as String? ?? '',
              style: const TextStyle(color: Color(0xFF94a3b8), fontSize: 14)),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: color, foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () {
                _apiService.marcarAlertaVista(alerta['id'] as String);
                Navigator.pop(context);
              },
              child: const Text('Entendido'),
            ),
          ],
        ),
      );
    }
  }

  Future<void> _initPtt() async {
    final status = await Permission.microphone.request();
    if (!status.isGranted && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Se necesita permiso de micrófono para usar PTT'),
          backgroundColor: Color(0xFFef4444),
        ),
      );
    }
    final communityId = _selectedComunidad?.id ?? widget.guardia.comunidadId ?? '';
    _pttService = PttService(
      token: widget.guardia.token,
      communityId: communityId,
      guardianName: widget.guardia.nombre,
    );
    _pttService.addListener(_onPttChange);
    _pttService.connect();
    startForegroundService();
    if (mounted) setState(() {});
  }

  void _onPttChange() {
    setState(() {});
    if (_pttService.lastSavedReporteId != null && _tab == 4) {
      _loadReportes();
    }
    final wsText = _pttService.wsState == WsState.connected
        ? 'Conectado — recibiendo reportes'
        : 'Reconectando…';
    updateForegroundNotification(wsText);
    final alert = _pttService.lastAdminAlert;
    if (alert != null && alert != _lastShownAlert) {
      _lastShownAlert = alert;
      final from = alert['from'] as String? ?? 'Central de Monitoreo';
      final msg  = alert['mensaje'] as String? ?? '';
      showReportNotification(title: 'Alerta: $from', body: msg);
      WidgetsBinding.instance.addPostFrameCallback((_) => _showAdminAlert(alert));
    }
  }

  void _showAdminAlert(Map<String, dynamic> alert) {
    if (!mounted) return;
    final mensaje       = alert['mensaje']        as String? ?? '';
    final from          = alert['from']           as String? ?? 'Central de Monitoreo';
    final communityName = alert['community_name'] as String? ?? '';
    final title = communityName.isNotEmpty ? '$from · $communityName' : from;
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1a2744),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(children: [
          const Icon(Icons.warning_amber_rounded, color: Color(0xFFef4444), size: 24),
          const SizedBox(width: 8),
          Expanded(child: Text(title, style: const TextStyle(color: Colors.white, fontSize: 14))),
        ]),
        content: Text(mensaje, style: const TextStyle(color: Color(0xFF94a3b8), fontSize: 14)),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFef4444), foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(context),
            child: const Text('Entendido'),
          ),
        ],
      ),
    );
  }

  Future<void> _loadComunidades() async {
    try {
      final comunidades = await _apiService.misComunidades();
      if (mounted) {
        setState(() {
          _comunidades = comunidades;
          if (_selectedComunidad == null && comunidades.isNotEmpty) {
            _selectedComunidad = comunidades.firstWhere(
              (c) => c.id == widget.guardia.comunidadId,
              orElse: () => comunidades.first,
            );
          }
        });
        _loadReportes();
      }
    } catch (_) {}
  }

  Future<void> _loadReportes() async {
    final comunidadId = _selectedComunidad?.id ?? widget.guardia.comunidadId;
    if (comunidadId == null || comunidadId.isEmpty) return;
    setState(() => _loadingReportes = true);
    try {
      final result = await _apiService.listarReportes(comunidadId: comunidadId, limit: 20);
      final items = (result['items'] as List).map((j) => ReportePTT.fromJson(j)).toList();
      if (mounted) setState(() => _reportes = items);
    } catch (_) {}
    if (mounted) setState(() => _loadingReportes = false);
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    _pttService.dispose();
    await stopForegroundService();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  Future<void> _crearSOS() async {
    final confirm = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1a2744),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(children: [
          Icon(Icons.warning_rounded, color: Color(0xFFef4444), size: 26),
          SizedBox(width: 10),
          Text('ALERTA SOS', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
        ]),
        content: const Text(
          '¿Enviar alerta de pánico a la central de monitoreo?\n\nSe notificará tu ubicación y nombre inmediatamente.',
          style: TextStyle(color: Color(0xFF94a3b8), fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar', style: TextStyle(color: Color(0xFF64748b))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFef4444), foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('ENVIAR SOS', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1)),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    setState(() => _sendingSos = true);
    double? lat, lng;
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high, timeLimit: const Duration(seconds: 5));
      lat = pos.latitude; lng = pos.longitude;
    } catch (_) {}
    try {
      await _apiService.crearEventoPanico(lat: lat, lng: lng);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Row(children: [
            Icon(Icons.check_circle, color: Colors.white, size: 18),
            SizedBox(width: 8),
            Text('Alerta SOS enviada a la central', style: TextStyle(fontWeight: FontWeight.w600)),
          ]),
          backgroundColor: Color(0xFFef4444),
          duration: Duration(seconds: 4),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}'),
          backgroundColor: const Color(0xFF1a2744),
        ));
      }
    }
    if (mounted) setState(() => _sendingSos = false);
  }

  // ── Novedades helpers ─────────────────────────────────────────────────
  Future<void> _pickNovedadFoto() async {
    final picker = ImagePicker();
    final xfile = await picker.pickImage(source: ImageSource.camera, imageQuality: 70);
    if (xfile != null && mounted) setState(() => _novedadFoto = File(xfile.path));
  }

  Future<void> _enviarNovedad() async {
    if (_novedadTipo == null) return;
    setState(() => _enviandoNovedad = true);
    try {
      double? lat, lng;
      try {
        final pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high, timeLimit: const Duration(seconds: 5));
        lat = pos.latitude; lng = pos.longitude;
      } catch (_) {}

      await _apiService.crearNovedadTexto(
        tipo: _novedadTipo!,
        descripcion: _novedadDescCtrl.text.trim(),
        foto: _novedadFoto,
        latitud: lat,
        longitud: lng,
      );

      if (mounted) {
        setState(() { _novedadTipo = null; _novedadFoto = null; _enviandoNovedad = false; });
        _novedadDescCtrl.clear();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Row(children: [
            Icon(Icons.check_circle, color: Colors.white, size: 18),
            SizedBox(width: 8),
            Text('Novedad enviada correctamente', style: TextStyle(fontWeight: FontWeight.w600)),
          ]),
          backgroundColor: Color(0xFF10b981),
          duration: Duration(seconds: 3),
        ));
      }
    } catch (e) {
      if (mounted) {
        setState(() => _enviandoNovedad = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}'),
          backgroundColor: const Color(0xFFef4444),
        ));
      }
    }
  }

  // ── BUILD ─────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    if (!_modulesLoaded) {
      return Scaffold(
        backgroundColor: const Color(0xFF0f1729),
        body: const Center(child: CircularProgressIndicator(color: Color(0xFF3b82f6))),
      );
    }
    return ChangeNotifierProvider.value(
      value: _pttService,
      child: Scaffold(
        backgroundColor: const Color(0xFF0f1729),
        appBar: _buildAppBar(),
        body: _buildBody(),
        bottomNavigationBar: _buildBottomNav(),
      ),
    );
  }

  Widget _buildBody() {
    switch (_tab) {
      case 0: return _buildHomeTab();
      case 1: return _buildRondasTab();
      case 2: return _buildPttMainTab();
      case 3: return _buildNovedadesTab();
      case 4: return _buildMasTab();
      default: return _buildHomeTab();
    }
  }

  // ── APP BAR ───────────────────────────────────────────────────────────
  AppBar _buildAppBar() {
    return AppBar(
      backgroundColor: const Color(0xFF1a2744),
      elevation: 0,
      title: Row(children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.asset('assets/logo.webp', width: 32, height: 32, fit: BoxFit.cover),
        ),
        const SizedBox(width: 10),
        const Text('WhatsEg',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
      ]),
      actions: [
        if (_modules['REPORTES_PTT'] != false)
          Consumer<PttService>(
            builder: (_, svc, __) => Container(
              margin: const EdgeInsets.only(right: 6),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: svc.wsState == WsState.connected
                    ? const Color(0xFF10b981).withOpacity(.15)
                    : const Color(0xFFef4444).withOpacity(.15),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 7, height: 7,
                  decoration: BoxDecoration(
                    color: svc.wsState == WsState.connected
                        ? const Color(0xFF10b981)
                        : const Color(0xFFef4444),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  svc.wsState == WsState.connected ? 'EN LÍNEA' :
                  svc.wsState == WsState.connecting ? 'CONECTANDO' : 'SIN SEÑAL',
                  style: TextStyle(
                    fontSize: 10, fontWeight: FontWeight.w700,
                    color: svc.wsState == WsState.connected
                        ? const Color(0xFF10b981)
                        : const Color(0xFFef4444),
                  ),
                ),
              ]),
            ),
          ),
        Padding(
          padding: const EdgeInsets.only(right: 4),
          child: Material(
            color: _sendingSos ? const Color(0xFF7f1d1d) : const Color(0xFFef4444),
            borderRadius: BorderRadius.circular(8),
            child: InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: _sendingSos ? null : _crearSOS,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                child: _sendingSos
                    ? const SizedBox(width: 18, height: 18,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.warning_rounded, color: Colors.white, size: 20),
              ),
            ),
          ),
        ),
        IconButton(
          icon: const Icon(Icons.logout, color: Color(0xFF94a3b8), size: 20),
          onPressed: _logout,
        ),
      ],
    );
  }

  // ── BOTTOM NAV ────────────────────────────────────────────────────────
  BottomNavigationBar _buildBottomNav() {
    return BottomNavigationBar(
      currentIndex: _tab,
      onTap: (i) {
        setState(() => _tab = i);
        if (i == 0) _loadHomeRonda();
        if (i == 4) _loadReportes();
      },
      backgroundColor: const Color(0xFF1a2744),
      selectedItemColor: const Color(0xFF3b82f6),
      unselectedItemColor: const Color(0xFF64748b),
      type: BottomNavigationBarType.fixed,
      selectedFontSize: 11,
      unselectedFontSize: 10,
      items: const [
        BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Inicio'),
        BottomNavigationBarItem(icon: Icon(Icons.route_rounded), label: 'Rondas'),
        BottomNavigationBarItem(icon: Icon(Icons.radio_rounded), label: 'PTT'),
        BottomNavigationBarItem(icon: Icon(Icons.report_problem_rounded), label: 'Novedades'),
        BottomNavigationBarItem(icon: Icon(Icons.menu_rounded), label: 'Más'),
      ],
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 0 — INICIO (HOME DASHBOARD)
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildHomeTab() {
    return Consumer<PttService>(
      builder: (_, svc, __) {
        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildGuardCard(svc),
              const SizedBox(height: 12),
              _buildStatsRow(svc),
              const SizedBox(height: 20),
              if (_modules['RONDAS'] != false) ...[
                _buildHomeActionBtn(
                  icon: Icons.route_rounded,
                  label: 'INICIAR RONDA',
                  color: const Color(0xFF3b82f6),
                  onTap: () => setState(() => _tab = 1),
                ),
                const SizedBox(height: 10),
              ],
              if (_modules['REPORTES_PTT'] != false) ...[
                _buildHomePttBtn(svc),
                const SizedBox(height: 10),
                _buildHomeActionBtn(
                  icon: Icons.report_problem_rounded,
                  label: 'REGISTRAR NOVEDAD',
                  color: const Color(0xFF3b82f6),
                  outlined: true,
                  onTap: () => setState(() => _tab = 3),
                ),
                const SizedBox(height: 10),
              ],
              _buildHomeActionBtn(
                icon: Icons.warning_rounded,
                label: 'SOS EMERGENCIA',
                color: const Color(0xFFef4444),
                onTap: _crearSOS,
                loading: _sendingSos,
              ),
              if (svc.adminAlerts.isNotEmpty || svc.broadcastActive) ...[
                const SizedBox(height: 16),
                if (svc.broadcastActive) _buildBroadcastBanner(svc),
                if (svc.adminAlerts.isNotEmpty) _buildAlertsPanel(svc),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildGuardCard(PttService svc) {
    final rol = widget.guardia.rol;
    final isSup = rol == 'SUPERVISOR' || rol == 'COMANDANTE';
    final rolColor = isSup ? const Color(0xFF7c3aed) : const Color(0xFF3b82f6);
    final wsOk = svc.wsState == WsState.connected;
    final completados = _homeRonda?.checkpointsMarcados ?? 0;
    final totalCp = _homeRonda?.allCheckpoints.length ?? 0;
    final hasRonda = _homeRonda != null;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1a2744),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF243358)),
      ),
      child: Column(
        children: [
          Row(children: [
            // Avatar
            Container(
              width: 54, height: 54,
              decoration: BoxDecoration(
                color: rolColor.withOpacity(.15),
                borderRadius: BorderRadius.circular(27),
                border: Border.all(color: rolColor.withOpacity(.4), width: 2),
              ),
              child: Icon(isSup ? Icons.shield_rounded : Icons.person_rounded, color: rolColor, size: 28),
            ),
            const SizedBox(width: 14),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.guardia.nombre,
                    style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 5),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: rolColor.withOpacity(.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: rolColor.withOpacity(.3)),
                  ),
                  child: Text(rol,
                      style: TextStyle(color: rolColor, fontSize: 10, fontWeight: FontWeight.w700)),
                ),
              ],
            )),
            // EN SERVICIO badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF10b981).withOpacity(.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF10b981).withOpacity(.4)),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 7, height: 7,
                    decoration: const BoxDecoration(color: Color(0xFF10b981), shape: BoxShape.circle)),
                const SizedBox(width: 5),
                const Text('EN SERVICIO',
                    style: TextStyle(color: Color(0xFF10b981), fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: .5)),
              ]),
            ),
          ]),
          const SizedBox(height: 14),
          // Info strip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF0f1729).withOpacity(.6),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(children: [
              _infoChip(Icons.wifi_rounded, 'PTT',
                  wsOk ? 'Conectado' : 'Sin señal',
                  wsOk ? const Color(0xFF10b981) : const Color(0xFFef4444)),
              _divider(),
              _infoChip(Icons.route_rounded, 'Ronda',
                  hasRonda ? '$completados/$totalCp' : 'Sin ronda',
                  hasRonda ? const Color(0xFF3b82f6) : const Color(0xFF64748b)),
              _divider(),
              _infoChip(Icons.people_rounded, 'Equipo',
                  '${svc.onlineUsers.length} en línea',
                  const Color(0xFF6366f1)),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _infoChip(IconData icon, String label, String value, Color color) => Expanded(
    child: Column(children: [
      Icon(icon, color: color, size: 16),
      const SizedBox(height: 3),
      Text(label, style: const TextStyle(color: Color(0xFF64748b), fontSize: 9)),
      Text(value,
          style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600),
          overflow: TextOverflow.ellipsis, textAlign: TextAlign.center),
    ]),
  );

  Widget _divider() => Container(width: 1, height: 32, color: const Color(0xFF243358),
      margin: const EdgeInsets.symmetric(horizontal: 6));

  Widget _buildStatsRow(PttService svc) {
    final completados = _homeRonda?.checkpointsMarcados ?? 0;
    final totalCp = _homeRonda?.allCheckpoints.length ?? 0;
    return Row(children: [
      _statCard(Icons.route_rounded,
          _homeRonda != null ? '$completados/$totalCp' : '--', 'Ronda actual',
          _homeRonda != null ? const Color(0xFF3b82f6) : const Color(0xFF64748b)),
      const SizedBox(width: 8),
      _statCard(Icons.people_rounded, '${svc.onlineUsers.length}', 'En línea',
          const Color(0xFF10b981)),
      const SizedBox(width: 8),
      _statCard(Icons.notifications_rounded, '${svc.adminAlerts.length}', 'Alertas',
          svc.adminAlerts.isNotEmpty ? const Color(0xFFef4444) : const Color(0xFF64748b)),
    ]);
  }

  Widget _statCard(IconData icon, String value, String label, Color color) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF1a2744),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF243358)),
      ),
      child: Column(children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(height: 6),
        Text(value,
            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: Color(0xFF64748b), fontSize: 10),
            textAlign: TextAlign.center),
      ]),
    ),
  );

  Widget _buildHomeActionBtn({
    required IconData icon,
    required String label,
    required Color color,
    bool outlined = false,
    required VoidCallback onTap,
    bool loading = false,
  }) {
    return Material(
      color: outlined ? Colors.transparent : color,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: loading ? null : onTap,
        child: Container(
          height: 56,
          decoration: outlined
              ? BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: color, width: 1.5),
                )
              : null,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            if (loading)
              SizedBox(width: 20, height: 20,
                  child: CircularProgressIndicator(
                      color: outlined ? color : Colors.white, strokeWidth: 2))
            else ...[
              Icon(icon, color: outlined ? color : Colors.white, size: 20),
              const SizedBox(width: 10),
              Text(label, style: TextStyle(
                color: outlined ? color : Colors.white,
                fontSize: 14, fontWeight: FontWeight.w700, letterSpacing: .5,
              )),
            ],
          ]),
        ),
      ),
    );
  }

  Widget _buildHomePttBtn(PttService svc) {
    final isRecording = svc.pttState == PttState.recording;
    final isSaving    = svc.pttState == PttState.saving;
    return GestureDetector(
      onLongPressStart: isSaving ? null : (_) async {
        if (svc.broadcastActive) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Canal ocupado — espera a que termine la transmisión'),
            backgroundColor: Color(0xFFf59e0b),
            duration: Duration(seconds: 2),
          ));
          return;
        }
        await svc.startPTT(tipo: _selectedTipo.label);
      },
      onLongPressEnd: isSaving ? null : (_) => svc.stopPTT(),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        height: 60,
        decoration: BoxDecoration(
          color: isRecording ? const Color(0xFFef4444) : const Color(0xFF3b82f6),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [BoxShadow(
            color: (isRecording ? const Color(0xFFef4444) : const Color(0xFF3b82f6)).withOpacity(.35),
            blurRadius: 14, spreadRadius: 1,
          )],
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          if (isSaving) ...[
            const SizedBox(width: 20, height: 20,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
            const SizedBox(width: 10),
            const Text('Enviando...', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
          ] else if (isRecording) ...[
            const Icon(Icons.mic, color: Colors.white, size: 22),
            const SizedBox(width: 10),
            Text('AL AIRE  ${svc.pttDuration.toStringAsFixed(1)}s',
                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
          ] else ...[
            const Icon(Icons.mic_none, color: Colors.white, size: 22),
            const SizedBox(width: 10),
            const Text('MANTENER PARA HABLAR',
                style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700, letterSpacing: .5)),
          ],
        ]),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 1 — RONDAS
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildRondasTab() {
    if (_modules['RONDAS'] == false) {
      return const Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.route_rounded, color: Color(0xFF475569), size: 48),
          SizedBox(height: 12),
          Text('Módulo Rondas no activo', style: TextStyle(color: Color(0xFF64748b), fontSize: 15)),
        ]),
      );
    }
    final rol = widget.guardia.rol;
    if (rol == 'SUPERVISOR' || rol == 'COMANDANTE' || rol == 'ADMIN' || rol == 'SUPERADMIN') {
      return SupervisorRondasScreen(api: _apiService);
    }
    return RondasScreen(
      api: _apiService,
      onRondaChanged: () => _loadHomeRonda(),
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 2 — PTT (Canales / Contactos)
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildPttMainTab() {
    if (_modules['REPORTES_PTT'] == false) {
      return const Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.radio_rounded, color: Color(0xFF475569), size: 48),
          SizedBox(height: 12),
          Text('Módulo PTT no activo', style: TextStyle(color: Color(0xFF64748b), fontSize: 15)),
        ]),
      );
    }
    return Column(children: [
      _buildPttSubTabBar(),
      Expanded(child: _pttSubTab == 0 ? _buildPttCanalesTab() : _buildEquipoTab()),
    ]);
  }

  Widget _buildPttSubTabBar() {
    return Container(
      color: const Color(0xFF1a2744),
      child: Row(children: [
        _pttSubBtn(0, Icons.radio_rounded, 'Canales'),
        _pttSubBtn(1, Icons.people_rounded, 'Contactos'),
      ]),
    );
  }

  Widget _pttSubBtn(int idx, IconData icon, String label) {
    final sel = _pttSubTab == idx;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _pttSubTab = idx),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(
              color: sel ? const Color(0xFF3b82f6) : Colors.transparent,
              width: 2,
            )),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 16, color: sel ? const Color(0xFF3b82f6) : const Color(0xFF64748b)),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(
              color: sel ? const Color(0xFF3b82f6) : const Color(0xFF64748b),
              fontSize: 13, fontWeight: sel ? FontWeight.w600 : FontWeight.w400,
            )),
          ]),
        ),
      ),
    );
  }

  Widget _buildPttCanalesTab() {
    return Consumer<PttService>(
      builder: (_, svc, __) {
        return Column(children: [
          if (_comunidades.length > 1) _buildCommunitySelector(),
          _buildCanalSelector(svc),
          _buildTipoSelector(),
          if (svc.adminAlerts.isNotEmpty) _buildAlertsPanel(svc),
          if (svc.broadcastActive) _buildBroadcastBanner(svc),
          if (svc.onlineUsers.isNotEmpty) _buildOnlinePanel(svc),
          Expanded(child: Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              _buildPttMainButton(svc),
              const SizedBox(height: 16),
              const Text('Mantén presionado para transmitir',
                  style: TextStyle(color: Color(0xFF64748b), fontSize: 12)),
            ]),
          )),
          if (svc.events.isNotEmpty) _buildEventsLog(svc),
        ]);
      },
    );
  }

  Widget _buildPttMainButton(PttService svc) {
    final isRecording = svc.pttState == PttState.recording;
    final isSaving    = svc.pttState == PttState.saving;
    final color       = _tipoColor(_selectedTipo);

    return GestureDetector(
      onLongPressStart: isSaving ? null : (_) async {
        if (svc.broadcastActive) {
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Canal ocupado — espera a que termine la transmisión'),
            backgroundColor: Color(0xFFf59e0b),
            duration: Duration(seconds: 2),
          ));
          return;
        }
        final ok = await svc.startPTT(tipo: _selectedTipo.label);
        if (!ok && mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('No se pudo iniciar la grabación'),
          backgroundColor: Color(0xFFef4444),
        ));
      },
      onLongPressEnd: isSaving ? null : (_) => svc.stopPTT(),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 170, height: 170,
        decoration: BoxDecoration(
          color: isRecording ? const Color(0xFFef4444) : color,
          shape: BoxShape.circle,
          boxShadow: [BoxShadow(
            color: (isRecording ? const Color(0xFFef4444) : color).withOpacity(.4),
            blurRadius: 30, spreadRadius: 4,
          )],
        ),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          if (isSaving) ...[
            const SizedBox(width: 32, height: 32,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3)),
            const SizedBox(height: 10),
            const Text('Enviando...', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
          ] else if (isRecording) ...[
            const Icon(Icons.mic, color: Colors.white, size: 42),
            const SizedBox(height: 6),
            Text('${svc.pttDuration.toStringAsFixed(1)}s',
                style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
          ] else ...[
            const Icon(Icons.mic_none, color: Colors.white, size: 42),
            const SizedBox(height: 6),
            const Text('PTT', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
          ],
        ]),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 3 — NOVEDADES
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildNovedadesTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('TIPO DE NOVEDAD',
            style: TextStyle(color: Color(0xFF64748b), fontSize: 11,
                fontWeight: FontWeight.w700, letterSpacing: 1.2)),
        const SizedBox(height: 12),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 3,
          childAspectRatio: 1.05,
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          children: _novedadTipos.map((t) {
            final sel = _novedadTipo == t['tipo'];
            return GestureDetector(
              onTap: () => setState(() => _novedadTipo = sel ? null : t['tipo'] as String),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                decoration: BoxDecoration(
                  color: sel
                      ? const Color(0xFF3b82f6).withOpacity(.15)
                      : const Color(0xFF1a2744),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: sel ? const Color(0xFF3b82f6) : const Color(0xFF243358),
                    width: sel ? 1.5 : 1,
                  ),
                ),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(t['icon'] as IconData,
                      color: sel ? const Color(0xFF3b82f6) : const Color(0xFF64748b),
                      size: 26),
                  const SizedBox(height: 6),
                  Text(
                    t['label'] as String,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: sel ? Colors.white : const Color(0xFF94a3b8),
                      fontSize: 9,
                      fontWeight: sel ? FontWeight.w600 : FontWeight.w400,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ]),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 20),
        const Text('DESCRIPCIÓN',
            style: TextStyle(color: Color(0xFF64748b), fontSize: 11,
                fontWeight: FontWeight.w700, letterSpacing: 1.2)),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFF1a2744),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF243358)),
          ),
          child: TextField(
            controller: _novedadDescCtrl,
            maxLines: 3,
            style: const TextStyle(color: Colors.white, fontSize: 14),
            decoration: const InputDecoration(
              hintText: 'Describe la novedad detalladamente...',
              hintStyle: TextStyle(color: Color(0xFF475569)),
              border: InputBorder.none,
              contentPadding: EdgeInsets.all(14),
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text('ADJUNTAR',
            style: TextStyle(color: Color(0xFF64748b), fontSize: 11,
                fontWeight: FontWeight.w700, letterSpacing: 1.2)),
        const SizedBox(height: 10),
        Row(children: [
          _mediaBtn(Icons.photo_camera_rounded, 'Foto',
              _novedadFoto != null ? const Color(0xFF10b981) : const Color(0xFF3b82f6),
              _pickNovedadFoto),
          const SizedBox(width: 8),
          _mediaBtn(Icons.mic_rounded, 'Audio PTT', const Color(0xFF6366f1),
              () => setState(() => _tab = 2)),
        ]),
        if (_novedadFoto != null) ...[
          const SizedBox(height: 12),
          Stack(children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.file(_novedadFoto!, height: 130,
                  width: double.infinity, fit: BoxFit.cover),
            ),
            Positioned(top: 6, right: 6,
              child: GestureDetector(
                onTap: () => setState(() => _novedadFoto = null),
                child: Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                      color: Colors.black.withOpacity(.65), shape: BoxShape.circle),
                  child: const Icon(Icons.close, color: Colors.white, size: 16),
                ),
              ),
            ),
          ]),
        ],
        const SizedBox(height: 24),
        // ENVIAR button
        Material(
          color: _novedadTipo != null
              ? const Color(0xFF3b82f6)
              : const Color(0xFF243358),
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: _novedadTipo == null || _enviandoNovedad ? null : _enviarNovedad,
            child: SizedBox(
              height: 56, width: double.infinity,
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                if (_enviandoNovedad)
                  const SizedBox(width: 22, height: 22,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                else ...[
                  Icon(Icons.send_rounded,
                      color: _novedadTipo != null ? Colors.white : const Color(0xFF64748b),
                      size: 20),
                  const SizedBox(width: 10),
                  Text('ENVIAR NOVEDAD',
                      style: TextStyle(
                        color: _novedadTipo != null ? Colors.white : const Color(0xFF64748b),
                        fontSize: 14, fontWeight: FontWeight.w700, letterSpacing: .5,
                      )),
                ],
              ]),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _mediaBtn(IconData icon, String label, Color color, VoidCallback onTap) => Expanded(
    child: GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 13),
        decoration: BoxDecoration(
          color: color.withOpacity(.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withOpacity(.35)),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
        ]),
      ),
    ),
  );

  // ══════════════════════════════════════════════════════════════════════
  // TAB 4 — MÁS (Perfil + Reportes)
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildMasTab() {
    return Column(children: [
      Container(
        color: const Color(0xFF1a2744),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
        child: Row(children: [
          Container(
            width: 46, height: 46,
            decoration: BoxDecoration(
              color: const Color(0xFF3b82f6).withOpacity(.15),
              borderRadius: BorderRadius.circular(23),
            ),
            child: const Icon(Icons.person_rounded, color: Color(0xFF3b82f6), size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.guardia.nombre,
                  style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
              Text(widget.guardia.rol,
                  style: const TextStyle(color: Color(0xFF64748b), fontSize: 12)),
            ],
          )),
          GestureDetector(
            onTap: _logout,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFef4444).withOpacity(.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFef4444).withOpacity(.3)),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: const [
                Icon(Icons.logout, color: Color(0xFFef4444), size: 16),
                SizedBox(width: 6),
                Text('Cerrar sesión',
                    style: TextStyle(color: Color(0xFFef4444), fontSize: 12, fontWeight: FontWeight.w600)),
              ]),
            ),
          ),
        ]),
      ),
      Container(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
        child: Row(children: [
          const Text('HISTORIAL DE REPORTES',
              style: TextStyle(color: Color(0xFF64748b), fontSize: 11,
                  fontWeight: FontWeight.w700, letterSpacing: 1.2)),
          const Spacer(),
          GestureDetector(
            onTap: _loadReportes,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF3b82f6).withOpacity(.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF3b82f6).withOpacity(.3)),
              ),
              child: const Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.refresh, color: Color(0xFF3b82f6), size: 14),
                SizedBox(width: 4),
                Text('Actualizar', style: TextStyle(color: Color(0xFF3b82f6), fontSize: 11)),
              ]),
            ),
          ),
        ]),
      ),
      Expanded(child: RefreshIndicator(
        onRefresh: _loadReportes,
        color: const Color(0xFF3b82f6),
        backgroundColor: const Color(0xFF1a2744),
        child: ReportsList(
          reportes: _reportes,
          loading: _loadingReportes,
          token: widget.guardia.token,
        ),
      )),
    ]);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SHARED WIDGETS (used by multiple tabs)
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildEquipoTab() {
    final isSup = widget.guardia.rol == 'SUPERVISOR' || widget.guardia.rol == 'COMANDANTE';
    return Consumer<PttService>(builder: (_, svc, __) {
      final targetUsers = <String, Map<String, String>>{};
      svc.onlineUsers.forEach((nombre, info) {
        final rol = info['rol'] ?? 'GUARDIA';
        final puesto = info['puesto'] ?? '';
        if (isSup) {
          if (rol != 'SUPERVISOR' && rol != 'COMANDANTE') {
            targetUsers[nombre] = {'rol': rol, 'puesto': puesto};
          }
        } else {
          if (rol == 'SUPERVISOR' || rol == 'COMANDANTE') {
            targetUsers[nombre] = {'rol': rol, 'puesto': puesto};
          }
        }
      });
      if (_selectedUser != null && !targetUsers.containsKey(_selectedUser)) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) setState(() => _selectedUser = null);
        });
      }
      final total = targetUsers.length;
      final headerLabel = isSup ? 'GUARDIAS' : 'SUPERVISORES';
      final emptyLabel  = isSup ? 'No hay guardias en línea' : 'No hay supervisores en línea';
      final accentColor = isSup ? const Color(0xFF3b82f6) : const Color(0xFF7c3aed);
      final accentLight = isSup ? const Color(0xFF60a5fa) : const Color(0xFFa78bfa);

      return Column(children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 12),
          decoration: const BoxDecoration(
            color: Color(0xFF1a2744),
            border: Border(bottom: BorderSide(color: Color(0xFF243358))),
          ),
          child: Row(children: [
            Icon(isSup ? Icons.security : Icons.shield, color: accentLight, size: 18),
            const SizedBox(width: 10),
            Text('$headerLabel EN LÍNEA',
                style: TextStyle(color: accentLight, fontSize: 12,
                    fontWeight: FontWeight.w700, letterSpacing: 1)),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: total > 0
                    ? const Color(0xFF10b981).withOpacity(.15)
                    : const Color(0xFF475569).withOpacity(.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 8, height: 8,
                  decoration: BoxDecoration(
                    color: total > 0 ? const Color(0xFF10b981) : const Color(0xFF475569),
                    shape: BoxShape.circle,
                  )),
                const SizedBox(width: 6),
                Text('$total', style: TextStyle(
                  color: total > 0 ? const Color(0xFF10b981) : const Color(0xFF475569),
                  fontSize: 13, fontWeight: FontWeight.w700,
                )),
              ]),
            ),
          ]),
        ),
        Expanded(
          child: total == 0
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.people_outline, color: const Color(0xFF475569), size: 48),
                  const SizedBox(height: 12),
                  Text(emptyLabel, style: const TextStyle(color: Color(0xFF64748b), fontSize: 14)),
                  const SizedBox(height: 6),
                  const Text('Aparecerán aquí cuando se conecten',
                      style: TextStyle(color: Color(0xFF475569), fontSize: 12)),
                ]))
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 100),
                  itemCount: targetUsers.length,
                  itemBuilder: (context, index) {
                    final nombre = targetUsers.keys.elementAt(index);
                    final info   = targetUsers[nombre]!;
                    final rol    = info['rol'] ?? 'GUARDIA';
                    final puesto = info['puesto'] ?? '';
                    final isSelected = _selectedUser == nombre;
                    final rolLabel = (rol == 'SUPERVISOR' || rol == 'COMANDANTE') ? 'Supervisor' : 'Guardia';
                    final subtitle = puesto.isNotEmpty ? '$rolLabel  -  $puesto' : rolLabel;
                    return GestureDetector(
                      onTap: () => setState(() => _selectedUser = isSelected ? null : nombre),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          color: isSelected ? accentColor.withOpacity(.12) : const Color(0xFF1a2744),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isSelected ? accentColor.withOpacity(.5) : const Color(0xFF243358),
                            width: isSelected ? 1.5 : 1,
                          ),
                        ),
                        child: Row(children: [
                          Container(
                            width: 42, height: 42,
                            decoration: BoxDecoration(
                              color: isSelected ? accentColor.withOpacity(.2) : const Color(0xFF1e3a5f),
                              borderRadius: BorderRadius.circular(21),
                            ),
                            child: Icon(isSup ? Icons.person : Icons.shield,
                                color: isSelected ? accentLight : const Color(0xFF64748b), size: 22),
                          ),
                          const SizedBox(width: 14),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(nombre, style: TextStyle(
                              color: isSelected ? Colors.white : const Color(0xFFcbd5e1),
                              fontSize: 15, fontWeight: FontWeight.w600,
                            )),
                            const SizedBox(height: 3),
                            Text(subtitle, style: TextStyle(color: accentLight.withOpacity(.7), fontSize: 11),
                                overflow: TextOverflow.ellipsis),
                          ])),
                          if (isSelected)
                            Icon(Icons.check_circle, color: accentColor, size: 24)
                          else
                            Container(width: 10, height: 10,
                                decoration: const BoxDecoration(color: Color(0xFF10b981), shape: BoxShape.circle)),
                        ]),
                      ),
                    );
                  },
                ),
        ),
        if (_selectedUser != null) _buildDirectedPttPanel(svc, accentColor, accentLight),
      ]);
    });
  }

  Widget _buildDirectedPttPanel(PttService svc, Color accentColor, Color accentLight) {
    final isRecording = svc.pttState == PttState.recording;
    final isSaving    = svc.pttState == PttState.saving;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
      decoration: BoxDecoration(
        color: const Color(0xFF1a2744),
        border: const Border(top: BorderSide(color: Color(0xFF243358))),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(.3), blurRadius: 10, offset: const Offset(0, -4))],
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.call, color: accentLight, size: 16),
          const SizedBox(width: 8),
          Text(_selectedUser!, style: TextStyle(color: accentLight, fontSize: 14, fontWeight: FontWeight.w600)),
        ]),
        const SizedBox(height: 12),
        GestureDetector(
          onLongPressStart: isSaving ? null : (_) async {
            if (svc.broadcastActive) {
              if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                content: Text('Canal ocupado -- espera a que termine la transmisión'),
                backgroundColor: Color(0xFFf59e0b),
                duration: Duration(seconds: 2),
              ));
              return;
            }
            final ok = await svc.startPTT(tipo: _selectedTipo.label, target: _selectedUser);
            if (!ok && mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
              content: Text('No se pudo iniciar la grabación'),
              backgroundColor: Color(0xFFef4444),
            ));
          },
          onLongPressEnd: isSaving ? null : (_) => svc.stopPTT(),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: double.infinity, height: 56,
            decoration: BoxDecoration(
              color: isRecording ? const Color(0xFFef4444) : accentColor,
              borderRadius: BorderRadius.circular(16),
              boxShadow: isRecording
                  ? [BoxShadow(color: const Color(0xFFef4444).withOpacity(.4), blurRadius: 12)]
                  : [BoxShadow(color: accentColor.withOpacity(.3), blurRadius: 8)],
            ),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              if (isSaving) ...[
                const SizedBox(width: 18, height: 18,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                const SizedBox(width: 10),
                const Text('Enviando...', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
              ] else if (isRecording) ...[
                const Icon(Icons.mic, color: Colors.white, size: 22),
                const SizedBox(width: 8),
                Text('AL AIRE  ${svc.pttDuration.toStringAsFixed(1)}s',
                    style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
              ] else ...[
                const Icon(Icons.mic_none, color: Colors.white, size: 22),
                const SizedBox(width: 8),
                const Text('MANTENER PARA HABLAR',
                    style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: .5)),
              ],
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _buildCommunitySelector() => Container(
    margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
    decoration: BoxDecoration(
      color: const Color(0xFF1a2744),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: const Color(0xFF243358)),
    ),
    child: DropdownButtonHideUnderline(
      child: DropdownButton<Comunidad>(
        value: _selectedComunidad,
        isExpanded: true,
        dropdownColor: const Color(0xFF1a2744),
        style: const TextStyle(color: Colors.white, fontSize: 14),
        icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF94a3b8)),
        hint: const Text('Seleccionar comunidad', style: TextStyle(color: Color(0xFF94a3b8))),
        items: _comunidades.map((c) => DropdownMenuItem(value: c, child: Text(c.nombre))).toList(),
        onChanged: (c) => setState(() => _selectedComunidad = c),
      ),
    ),
  );

  Widget _buildCanalSelector(PttService svc) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
    child: Row(
      children: PttService.canales.map((canal) {
        final selected = svc.currentCanal == canal;
        final color = canal == 'EMERGENCIA'
            ? const Color(0xFFef4444)
            : canal == 'GENERAL'
                ? const Color(0xFF10b981)
                : const Color(0xFF6366f1);
        return Expanded(
          child: GestureDetector(
            onTap: () => svc.switchCanal(canal),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              margin: const EdgeInsets.symmetric(horizontal: 2),
              padding: const EdgeInsets.symmetric(vertical: 6),
              decoration: BoxDecoration(
                color: selected ? color.withOpacity(.2) : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: selected ? color : const Color(0xFF243358),
                  width: selected ? 1.5 : 1,
                ),
              ),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(
                  canal == 'EMERGENCIA' ? Icons.warning_rounded :
                  canal == 'GENERAL' ? Icons.radio : Icons.headset,
                  size: 14,
                  color: selected ? color : const Color(0xFF64748b),
                ),
                const SizedBox(height: 2),
                Text(canal, textAlign: TextAlign.center,
                    style: TextStyle(
                      color: selected ? color : const Color(0xFF94a3b8),
                      fontSize: 9, fontWeight: FontWeight.w600,
                    )),
              ]),
            ),
          ),
        );
      }).toList(),
    ),
  );

  Widget _buildTipoSelector() {
    final tipos = PttTipo.values.where((t) => t != PttTipo.prueba).toList();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: tipos.map((t) {
          final selected = _selectedTipo == t;
          final color = _tipoColor(t);
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedTipo = t),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: selected ? color.withOpacity(.15) : const Color(0xFF1a2744),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: selected ? color : const Color(0xFF243358),
                    width: selected ? 1.5 : 1,
                  ),
                ),
                child: Text(t.displayName, textAlign: TextAlign.center,
                    style: TextStyle(
                      color: selected ? color : const Color(0xFF94a3b8),
                      fontSize: 11, fontWeight: FontWeight.w600,
                    )),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Color _tipoColor(PttTipo t) {
    switch (t) {
      case PttTipo.novedad:    return const Color(0xFF3b82f6);
      case PttTipo.incidente:  return const Color(0xFFf59e0b);
      case PttTipo.emergencia: return const Color(0xFFef4444);
      case PttTipo.prueba:     return const Color(0xFF94a3b8);
    }
  }

  Widget _buildAlertsPanel(PttService svc) => Container(
    margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
    decoration: BoxDecoration(
      color: const Color(0xFF2d1515),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: const Color(0xFFef4444).withOpacity(.5)),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
        child: Row(children: [
          const Icon(Icons.warning_amber_rounded, color: Color(0xFFef4444), size: 14),
          const SizedBox(width: 6),
          const Text('ALERTAS DE CENTRAL', style: TextStyle(
              color: Color(0xFFef4444), fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1)),
          const Spacer(),
          GestureDetector(
            onTap: () { for (final a in List.from(svc.adminAlerts)) svc.dismissAlert(a); },
            child: const Text('Limpiar', style: TextStyle(color: Color(0xFF94a3b8), fontSize: 10)),
          ),
        ]),
      ),
      ...svc.adminAlerts.take(3).map((alert) {
        final comunidad = alert['community_name'] as String? ?? '';
        final mensaje   = alert['mensaje']        as String? ?? '';
        final ts        = alert['timestamp']      as String? ?? '';
        String hora = '';
        if (ts.isNotEmpty) {
          try {
            final dt = DateTime.parse(ts).toLocal();
            hora = '${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
          } catch (_) {}
        }
        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 2, 8, 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                comunidad.isNotEmpty ? 'Central · $comunidad${hora.isNotEmpty ? "  $hora" : ""}' : 'Central de Monitoreo',
                style: const TextStyle(color: Color(0xFFfca5a5), fontSize: 10, fontWeight: FontWeight.w600),
              ),
              Text(mensaje, style: const TextStyle(color: Colors.white, fontSize: 12)),
            ])),
            GestureDetector(
              onTap: () => svc.dismissAlert(alert),
              child: const Padding(padding: EdgeInsets.only(left: 8, top: 2),
                  child: Icon(Icons.close, color: Color(0xFF94a3b8), size: 16)),
            ),
          ]),
        );
      }),
    ]),
  );

  Widget _buildBroadcastBanner(PttService svc) => Container(
    margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    decoration: BoxDecoration(
      color: const Color(0xFF7c3aed).withOpacity(.15),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: const Color(0xFF7c3aed).withOpacity(.6)),
    ),
    child: Row(children: [
      const Icon(Icons.volume_up, color: Color(0xFFa78bfa), size: 20),
      const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${svc.broadcastFrom ?? "Alguien"} transmitiendo...',
            style: const TextStyle(color: Color(0xFFa78bfa), fontSize: 13, fontWeight: FontWeight.w600)),
        if (svc.broadcastRol != null)
          Text(svc.broadcastRol!,
              style: TextStyle(color: const Color(0xFFa78bfa).withOpacity(.6), fontSize: 10)),
      ])),
      const SizedBox(width: 16, height: 16,
          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFa78bfa))),
    ]),
  );

  Widget _buildOnlinePanel(PttService svc) {
    final supervisores = <String>[];
    final guardias = <String>[];
    svc.onlineUsers.forEach((nombre, info) {
      final rol = info['rol'] ?? 'GUARDIA';
      if (rol == 'SUPERVISOR' || rol == 'COMANDANTE') supervisores.add(nombre);
      else guardias.add(nombre);
    });
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1a2744),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF243358)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.people, color: Color(0xFF10b981), size: 14),
          const SizedBox(width: 6),
          Text('EN LÍNEA (${svc.onlineUsers.length})',
              style: const TextStyle(color: Color(0xFF10b981), fontSize: 10,
                  fontWeight: FontWeight.w700, letterSpacing: 1)),
        ]),
        if (supervisores.isNotEmpty) ...[
          const SizedBox(height: 6),
          Wrap(spacing: 8, runSpacing: 4,
            children: supervisores.map((nombre) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFF7c3aed).withOpacity(.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF7c3aed).withOpacity(.3)),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 6, height: 6,
                    decoration: const BoxDecoration(color: Color(0xFFa78bfa), shape: BoxShape.circle)),
                const SizedBox(width: 5),
                Text(nombre, style: const TextStyle(color: Color(0xFFa78bfa), fontSize: 11, fontWeight: FontWeight.w600)),
                const SizedBox(width: 4),
                const Text('SUP', style: TextStyle(color: Color(0xFF7c3aed), fontSize: 9, fontWeight: FontWeight.w700)),
              ]),
            )).toList(),
          ),
        ],
        if (guardias.isNotEmpty) ...[
          const SizedBox(height: 4),
          Wrap(spacing: 6, runSpacing: 4,
            children: guardias.map((nombre) => Row(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 5, height: 5,
                  decoration: const BoxDecoration(color: Color(0xFF10b981), shape: BoxShape.circle)),
              const SizedBox(width: 4),
              Text(nombre, style: const TextStyle(color: Color(0xFF94a3b8), fontSize: 11)),
              const SizedBox(width: 8),
            ])).toList(),
          ),
        ],
      ]),
    );
  }

  Widget _buildEventsLog(PttService svc) => Container(
    height: 110,
    margin: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFF1a2744),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: const Color(0xFF243358)),
    ),
    child: ListView.builder(
      reverse: true,
      padding: const EdgeInsets.symmetric(vertical: 6),
      itemCount: svc.events.length.clamp(0, 8),
      itemBuilder: (_, i) {
        final ev = svc.events[i];
        final text = _eventText(ev);
        if (text.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          child: Text(text, style: const TextStyle(color: Color(0xFF94a3b8), fontSize: 11)),
        );
      },
    ),
  );

  String _eventText(Map<String, dynamic> ev) {
    final tipo   = ev['type']           ?? '';
    final nombre = ev['guardia_nombre'] ?? '';
    switch (tipo) {
      case 'joined':          return '✓ Conectado al canal';
      case 'user_joined':     return '● $nombre se conectó';
      case 'user_left':       return '○ $nombre se desconectó';
      case 'ptt_start':       return '▶ $nombre transmitiendo...';
      case 'ptt_end':         return '⏹ $nombre terminó';
      case 'ptt_saved':       return '💾 Reporte guardado';
      case 'pong':            return '';
      case 'admin_ptt_start':
        return '▶ ${ev['from'] ?? 'Central'} transmitiendo...';
      case 'admin_ptt_end':
        return '⏹ ${ev['from'] ?? 'Central'} terminó';
      case 'admin_alert':
        final cn = ev['community_name'] as String? ?? '';
        final m  = ev['mensaje']        as String? ?? '';
        return '⚠ Alerta${cn.isNotEmpty ? " · $cn" : ""}: $m';
      default: return tipo;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pttService.removeListener(_onPttChange);
    _pttService.dispose();
    _novedadDescCtrl.dispose();
    super.dispose();
  }
}
