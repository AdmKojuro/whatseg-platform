import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../services/api_service.dart';

// ─── Data models ─────────────────────────────────────────────────────────────

class PlanoJson {
  final int width;
  final int height;
  final List<PlanoFloor> floors;

  PlanoJson({required this.width, required this.height, required this.floors});

  factory PlanoJson.fromJson(Map<String, dynamic> j) {
    // Handle both wrapped {"plano_json":{...}} and unwrapped {"width":...} formats
    Map<String, dynamic> data = j;
    if (j.containsKey('plano_json') && !j.containsKey('floors')) {
      final raw = j['plano_json'];
      data = raw is String
          ? jsonDecode(raw) as Map<String, dynamic>
          : raw as Map<String, dynamic>;
    }
    return PlanoJson(
      width:  (data['width']  as num?)?.toInt() ?? 1000,
      height: (data['height'] as num?)?.toInt() ?? 700,
      floors: (data['floors'] as List? ?? [])
          .map((f) => PlanoFloor.fromJson(f as Map<String, dynamic>))
          .toList(),
    );
  }
}

class PlanoFloor {
  final String nombre;
  final List<PlanoShape> shapes;
  final List<PlanoCheckpointPin> checkpoints;

  PlanoFloor({required this.nombre, required this.shapes, required this.checkpoints});

  factory PlanoFloor.fromJson(Map<String, dynamic> j) => PlanoFloor(
    nombre: j['nombre'] as String? ?? 'Piso',
    shapes: (j['shapes'] as List? ?? [])
        .map((s) => PlanoShape.fromJson(s as Map<String, dynamic>))
        .toList(),
    checkpoints: (j['checkpoints'] as List? ?? [])
        .map((c) => PlanoCheckpointPin.fromJson(c as Map<String, dynamic>))
        .toList(),
  );
}

class PlanoShape {
  final double x, y, w, h;
  final String? label;
  final String color;

  PlanoShape({
    required this.x, required this.y,
    required this.w, required this.h,
    this.label,
    this.color = '#334155',
  });

  factory PlanoShape.fromJson(Map<String, dynamic> j) => PlanoShape(
    x: (j['x'] as num?)?.toDouble() ?? 0,
    y: (j['y'] as num?)?.toDouble() ?? 0,
    w: (j['w'] as num?)?.toDouble() ?? 0,
    h: (j['h'] as num?)?.toDouble() ?? 0,
    label: j['label'] as String?,
    color: j['color'] as String? ?? '#334155',
  );
}

class PlanoCheckpointPin {
  final String id;
  final String nombre;
  final double px, py;

  PlanoCheckpointPin({
    required this.id, required this.nombre,
    required this.px, required this.py,
  });

  factory PlanoCheckpointPin.fromJson(Map<String, dynamic> j) => PlanoCheckpointPin(
    id:     j['id']     as String? ?? '',
    nombre: j['nombre'] as String? ?? '',
    px: (j['px'] as num?)?.toDouble() ?? 0,
    py: (j['py'] as num?)?.toDouble() ?? 0,
  );
}

Color _hexColor(String hex) {
  try {
    final h = hex.replaceAll('#', '');
    return Color(int.parse('FF$h', radix: 16));
  } catch (_) {
    return const Color(0xFF334155);
  }
}

// ─── CustomPainter ───────────────────────────────────────────────────────────

class PlanoPainter extends CustomPainter {
  final PlanoFloor floor;
  final int planoWidth;
  final int planoHeight;
  final Set<String> visitedIds;
  final String? highlightId;

  PlanoPainter({
    required this.floor,
    required this.planoWidth,
    required this.planoHeight,
    required this.visitedIds,
    this.highlightId,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final double scaleX = size.width  / planoWidth;
    final double scaleY = size.height / planoHeight;
    final double scale  = math.min(scaleX, scaleY);

    // Background
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = const Color(0xFF0f172a),
    );

    // Shapes — draw any shape that has valid dimensions (no type check required)
    for (final s in floor.shapes) {
      if (s.w <= 0 || s.h <= 0) continue;
      final rect = Rect.fromLTWH(s.x * scale, s.y * scale, s.w * scale, s.h * scale);
      canvas.drawRect(rect, Paint()..color = _hexColor(s.color).withOpacity(.85));
      canvas.drawRect(rect, Paint()
        ..color = const Color(0xFF64748b)
        ..strokeWidth = 0.8
        ..style = PaintingStyle.stroke);
      if (s.label != null && s.label!.isNotEmpty && s.w * scale > 30) {
        final tp = TextPainter(
          text: TextSpan(
            text: s.label,
            style: TextStyle(
              color: Colors.white70,
              fontSize: math.max(7, 10 * scale).clamp(7, 13).toDouble(),
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout(maxWidth: s.w * scale - 4);
        tp.paint(canvas,
            Offset(s.x * scale + (s.w * scale - tp.width) / 2,
                   s.y * scale + (s.h * scale - tp.height) / 2));
      }
    }

    // Checkpoint pins
    final pinPaint  = Paint();
    final ringPaint = Paint()..color = Colors.white..strokeWidth = 1.5..style = PaintingStyle.stroke;
    final r = math.max(7, 9 * scale).clamp(7, 14).toDouble();

    for (int i = 0; i < floor.checkpoints.length; i++) {
      final cp = floor.checkpoints[i];
      final cx = cp.px * scale;
      final cy = cp.py * scale;
      final visited     = visitedIds.contains(cp.id);
      final isHighlight = cp.id == highlightId;

      pinPaint.color = isHighlight
          ? const Color(0xFFf59e0b)   // amarillo — próximo
          : visited
              ? const Color(0xFF10b981) // verde — visitado
              : const Color(0xFF6366f1); // morado — pendiente

      canvas.drawCircle(Offset(cx, cy), r, pinPaint);
      canvas.drawCircle(Offset(cx, cy), r, ringPaint);

      // Número de orden
      final numTp = TextPainter(
        text: TextSpan(
          text: '${i + 1}',
          style: TextStyle(
            color: Colors.white,
            fontSize: math.max(6, 8 * scale).clamp(6, 11).toDouble(),
            fontWeight: FontWeight.bold,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      numTp.paint(canvas, Offset(cx - numTp.width / 2, cy - numTp.height / 2));
    }
  }

  @override
  bool shouldRepaint(PlanoPainter old) =>
      old.floor != floor ||
      old.visitedIds != visitedIds ||
      old.highlightId != highlightId;
}

// ─── Widget ──────────────────────────────────────────────────────────────────

class PlanoViewer extends StatefulWidget {
  final ApiService api;
  final Set<String> visitedIds;
  final String? highlightId;
  /// ID explícito del puesto — si no se pasa, se extrae del JWT
  final String? puestoId;

  const PlanoViewer({
    super.key,
    required this.api,
    required this.visitedIds,
    this.highlightId,
    this.puestoId,
  });

  @override
  State<PlanoViewer> createState() => _PlanoViewerState();
}

class _PlanoViewerState extends State<PlanoViewer> {
  PlanoJson? _plano;
  bool _loading = true;
  bool _sinCheckpoints = false;
  int _currentFloor = 0;
  String? _errorMsg;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(PlanoViewer old) {
    super.didUpdateWidget(old);
    // Recargar si cambió el puestoId
    if (old.puestoId != widget.puestoId) _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);

    // Prioridad: puestoId explícito → JWT
    String? id = widget.puestoId ?? widget.api.puestoId;

    // El JWT puede devolver un array JSON  ["uuid"]  → extraer el primero
    if (id != null && id.startsWith('[')) {
      try {
        final list = jsonDecode(id) as List;
        if (list.isNotEmpty) id = list.first as String;
      } catch (_) {}
    }

    // ignore: avoid_print
    print('[PlanoViewer] puestoId=$id');

    if (id == null || id.isEmpty) {
      // ignore: avoid_print
      print('[PlanoViewer] sin puestoId → no se carga plano');
      if (mounted) setState(() { _loading = false; _errorMsg = 'Sin puesto_id en el token'; });
      return;
    }

    try {
      final data = await widget.api.getPlano(id);
      // ignore: avoid_print
      print('[PlanoViewer] getPlano response null=${data == null}');
      if (data != null && mounted) {
        final plano = PlanoJson.fromJson(data);
        // ignore: avoid_print
        print('[PlanoViewer] floors=${plano.floors.length}');
        // Verificar si algún piso tiene checkpoints pintados
        final tienePins = plano.floors.any((f) => f.checkpoints.isNotEmpty);
        setState(() {
          _plano           = plano;
          _sinCheckpoints  = !tienePins;
          _loading         = false;
          _errorMsg        = null;
        });
      } else {
        if (mounted) setState(() { _loading = false; _errorMsg = 'Sin datos de plano'; });
      }
    } catch (e) {
      // ignore: avoid_print
      print('[PlanoViewer] error: $e');
      if (mounted) setState(() { _loading = false; _errorMsg = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SizedBox(
        height: 100,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6366f1))),
      );
    }
    if (_plano == null || _plano!.floors.isEmpty) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: const Color(0xFF1a2744),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFF243358)),
        ),
        child: Row(children: [
          const Icon(Icons.map_outlined, color: Color(0xFF475569), size: 14),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              _errorMsg ?? 'Sin plano configurado',
              style: const TextStyle(color: Color(0xFF475569), fontSize: 10),
            ),
          ),
          GestureDetector(
            onTap: _load,
            child: const Icon(Icons.refresh, color: Color(0xFF6366f1), size: 18),
          ),
        ]),
      );
    }

    final floor    = _plano!.floors[_currentFloor.clamp(0, _plano!.floors.length - 1)];
    final hasFloors = _plano!.floors.length > 1;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF0f172a),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1e3a5f)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: Row(children: [
              const Icon(Icons.map_outlined, color: Color(0xFF6366f1), size: 15),
              const SizedBox(width: 6),
              const Text('Plano del Puesto',
                  style: TextStyle(
                      color: Color(0xFF94a3b8),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: .4)),
              const Spacer(),
              if (hasFloors) ...[
                IconButton(
                  icon: const Icon(Icons.chevron_left, size: 18, color: Color(0xFF6366f1)),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                  onPressed: _currentFloor > 0
                      ? () => setState(() => _currentFloor--)
                      : null,
                ),
                Text(floor.nombre,
                    style: const TextStyle(color: Color(0xFF94a3b8), fontSize: 11)),
                IconButton(
                  icon: const Icon(Icons.chevron_right, size: 18, color: Color(0xFF6366f1)),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                  onPressed: _currentFloor < _plano!.floors.length - 1
                      ? () => setState(() => _currentFloor++)
                      : null,
                ),
              ],
            ]),
          ),

          // Canvas del plano
          Padding(
            padding: const EdgeInsets.all(8),
            child: AspectRatio(
              aspectRatio: _plano!.width / _plano!.height,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: CustomPaint(
                  painter: PlanoPainter(
                    floor:       floor,
                    planoWidth:  _plano!.width,
                    planoHeight: _plano!.height,
                    visitedIds:  widget.visitedIds,
                    highlightId: widget.highlightId,
                  ),
                ),
              ),
            ),
          ),

          // Aviso si no hay checkpoints pintados en el plano
          if (_sinCheckpoints)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
              child: Row(children: const [
                Icon(Icons.info_outline, size: 12, color: Color(0xFFf59e0b)),
                SizedBox(width: 4),
                Expanded(
                  child: Text(
                    'El administrador aún no ha ubicado los puntos en el plano',
                    style: TextStyle(color: Color(0xFFf59e0b), fontSize: 9),
                  ),
                ),
              ]),
            ),

          // Leyenda
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
            child: Row(children: [
              _legendDot(const Color(0xFF10b981), 'Visitado'),
              const SizedBox(width: 12),
              _legendDot(const Color(0xFF6366f1), 'Pendiente'),
              const SizedBox(width: 12),
              _legendDot(const Color(0xFFf59e0b), 'Próximo'),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _legendDot(Color color, String label) => Row(children: [
    Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
    const SizedBox(width: 4),
    Text(label, style: const TextStyle(color: Color(0xFF64748b), fontSize: 9)),
  ]);
}
