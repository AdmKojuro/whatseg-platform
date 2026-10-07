import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class SupervisorRondasScreen extends StatefulWidget {
  final ApiService api;
  const SupervisorRondasScreen({super.key, required this.api});

  @override
  State<SupervisorRondasScreen> createState() => _SupervisorRondasScreenState();
}

class _SupervisorRondasScreenState extends State<SupervisorRondasScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _rondas = [];
  String? _error;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _load();
    // Auto-refresh cada 30 segundos
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _load());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() { _loading = true; _error = null; });
    try {
      final rondas = await widget.api.rondasEnCurso();
      if (mounted) setState(() { _rondas = rondas; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

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
              : _buildContent(),
    );
  }

  Widget _buildError() {
    return ListView(
      children: [
        const SizedBox(height: 80),
        Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.error_outline, color: Color(0xFFef4444), size: 48),
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Color(0xFF94a3b8)), textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF3b82f6),
                foregroundColor: Colors.white,
              ),
              onPressed: _load,
              child: const Text('Reintentar'),
            ),
          ]),
        ),
      ],
    );
  }

  Widget _buildContent() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Header de estado
        _buildHeader(),
        const SizedBox(height: 16),
        if (_rondas.isEmpty)
          _buildEmpty()
        else
          ..._rondas.map((r) => _buildRondaCard(r)),
      ],
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1a2744),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF243358)),
      ),
      child: Row(children: [
        Container(
          width: 38, height: 38,
          decoration: BoxDecoration(
            color: const Color(0xFF3b82f6).withOpacity(.15),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.monitor_heart, color: Color(0xFF3b82f6), size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('MONITOREO DE RONDAS',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
            Text(
              _rondas.isEmpty
                  ? 'Sin rondas activas'
                  : '${_rondas.length} ronda${_rondas.length != 1 ? 's' : ''} en curso',
              style: const TextStyle(color: Color(0xFF94a3b8), fontSize: 12),
            ),
          ]),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: _rondas.isNotEmpty
                ? const Color(0xFF10b981).withOpacity(.15)
                : const Color(0xFF475569).withOpacity(.15),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            _rondas.isNotEmpty ? 'EN VIVO' : 'SIN ACTIVIDAD',
            style: TextStyle(
              color: _rondas.isNotEmpty ? const Color(0xFF10b981) : const Color(0xFF475569),
              fontSize: 9,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ]),
    );
  }

  Widget _buildEmpty() {
    return Container(
      margin: const EdgeInsets.only(top: 48),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(
            color: const Color(0xFF1a2744),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF243358)),
          ),
          child: const Icon(Icons.route, color: Color(0xFF475569), size: 32),
        ),
        const SizedBox(height: 16),
        const Text('Sin rondas en curso', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        const Text('Cuando un guardia inicie una ronda\naparecerá aquí en tiempo real.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF94a3b8), fontSize: 13)),
        const SizedBox(height: 24),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF3b82f6),
            side: const BorderSide(color: Color(0xFF3b82f6)),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Actualizar'),
          onPressed: _load,
        ),
      ]),
    );
  }

  Widget _buildRondaCard(Map<String, dynamic> ronda) {
    final rutaNombre = (ronda['ruta'] as Map<String, dynamic>?)?['nombre'] as String? ?? 'Ruta';
    final guardiaNombre = ronda['guardia_nombre'] as String? ?? 'Guardia';
    final total = (ronda['checkpoints_total'] as num?)?.toInt() ?? 0;
    final marcados = (ronda['checkpoints_marcados'] as num?)?.toInt() ?? 0;
    final progreso = total > 0 ? marcados / total : 0.0;
    final inicioStr = ronda['inicio_at'] as String?;
    final inicio = inicioStr != null ? DateTime.tryParse(inicioStr)?.toLocal() : null;
    final tiempoStr = inicio != null ? _tiempoTranscurrido(inicio) : '';

    // Checkpoints visitados
    final visitas = (ronda['visitas'] as List?) ?? [];
    final allCps = (ronda['ruta'] as Map<String, dynamic>?)?['checkpoints'] as List? ?? [];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1a2744),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF243358)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header de la card
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Row(children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFF3b82f6).withOpacity(.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.person, color: Color(0xFF3b82f6), size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(guardiaNombre,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
                  Row(children: [
                    const Icon(Icons.route, size: 11, color: Color(0xFF64748b)),
                    const SizedBox(width: 4),
                    Text(rutaNombre,
                        style: const TextStyle(color: Color(0xFF64748b), fontSize: 12)),
                  ]),
                ]),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF10b981).withOpacity(.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text('EN CURSO',
                    style: TextStyle(color: Color(0xFF10b981), fontSize: 9, fontWeight: FontWeight.w700)),
              ),
            ]),
          ),

          // Progreso
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text('$marcados / $total checkpoints',
                    style: const TextStyle(color: Color(0xFF94a3b8), fontSize: 12)),
                Text('${(progreso * 100).toStringAsFixed(0)}%',
                    style: const TextStyle(color: Color(0xFF3b82f6), fontWeight: FontWeight.w700, fontSize: 12)),
              ]),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progreso,
                  backgroundColor: const Color(0xFF243358),
                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF3b82f6)),
                  minHeight: 5,
                ),
              ),
            ]),
          ),

          // Tiempo transcurrido + checkpoints visitados
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
            child: Row(children: [
              const Icon(Icons.schedule, size: 12, color: Color(0xFF64748b)),
              const SizedBox(width: 4),
              Text(tiempoStr, style: const TextStyle(color: Color(0xFF64748b), fontSize: 11)),
              const Spacer(),
              if (allCps.isNotEmpty) ...[
                // Iconos de checkpoints (pequeños)
                ...allCps.take(8).map((cp) {
                  final cpId = (cp as Map<String, dynamic>)['id'] as String?;
                  final visited = visitas.any((v) {
                    final vc = (v as Map<String, dynamic>)['checkpoint'] as Map<String, dynamic>?;
                    return vc?['id'] == cpId;
                  });
                  return Container(
                    margin: const EdgeInsets.only(left: 3),
                    width: 8, height: 8,
                    decoration: BoxDecoration(
                      color: visited ? const Color(0xFF10b981) : const Color(0xFF243358),
                      shape: BoxShape.circle,
                    ),
                  );
                }),
                if (allCps.length > 8) ...[
                  const SizedBox(width: 4),
                  Text('+${allCps.length - 8}', style: const TextStyle(color: Color(0xFF64748b), fontSize: 10)),
                ],
              ],
            ]),
          ),
        ],
      ),
    );
  }

  String _tiempoTranscurrido(DateTime inicio) {
    final diff = DateTime.now().difference(inicio);
    if (diff.inHours >= 1) return 'Hace ${diff.inHours}h ${diff.inMinutes % 60}m';
    if (diff.inMinutes >= 1) return 'Hace ${diff.inMinutes} min';
    return 'Recién iniciada';
  }
}
