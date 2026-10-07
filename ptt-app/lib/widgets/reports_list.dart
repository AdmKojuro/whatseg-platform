import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:audioplayers/audioplayers.dart';
import 'package:path_provider/path_provider.dart';
import '../models/models.dart';
import '../services/api_service.dart';

class ReportsList extends StatefulWidget {
  final List<ReportePTT> reportes;
  final bool loading;
  final String token;

  const ReportsList({
    super.key,
    required this.reportes,
    required this.loading,
    required this.token,
  });

  @override
  State<ReportsList> createState() => _ReportsListState();
}

class _ReportsListState extends State<ReportsList> {
  final AudioPlayer _player = AudioPlayer();
  String? _playingId;
  bool _playerLoading = false;

  @override
  void initState() {
    super.initState();
    _player.onPlayerComplete.listen((_) {
      if (mounted) setState(() => _playingId = null);
    });
  }

  Future<void> _playReport(ReportePTT r) async {
    if (_playingId == r.id) {
      await _player.stop();
      setState(() { _playingId = null; });
      return;
    }

    setState(() { _playerLoading = true; _playingId = r.id; });

    try {
      final url = ApiService(widget.token).audioUrl(r.id);
      final response = await http.get(
        Uri.parse(url),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );

      if (response.statusCode != 200) throw Exception('HTTP ${response.statusCode}');

      final dir = await getTemporaryDirectory();
      // Flutter/Android graba en contenedor M4A aunque el formato sea 'aac'
      final tmpFile = File('${dir.path}/ptt_play_${r.id}.m4a');
      await tmpFile.writeAsBytes(response.bodyBytes);

      await _player.stop();
      await _player.play(DeviceFileSource(tmpFile.path));
      if (mounted) setState(() => _playerLoading = false);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error reproduciendo audio: $e')),
        );
        setState(() { _playingId = null; _playerLoading = false; });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.loading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF3b82f6)),
      );
    }

    if (widget.reportes.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.inbox, size: 48, color: Color(0xFF94a3b8)),
            SizedBox(height: 12),
            Text('Sin reportes', style: TextStyle(color: Color(0xFF94a3b8), fontSize: 15)),
            SizedBox(height: 4),
            Text('Los reportes PTT aparecerán aquí', style: TextStyle(color: Color(0xFF475569), fontSize: 13)),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: widget.reportes.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) => _buildCard(widget.reportes[i]),
    );
  }

  Widget _buildCard(ReportePTT r) {
    final isPlaying = _playingId == r.id;
    final tipoColor = _tipoColor(r.tipo);

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1a2744),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isPlaying ? tipoColor.withOpacity(.4) : const Color(0xFF243358),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Tipo badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: tipoColor.withOpacity(.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    r.tipo,
                    style: TextStyle(
                      color: tipoColor,
                      fontSize: 11, fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Estado badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _estadoColor(r.estado).withOpacity(.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    r.estado.replaceAll('_', ' '),
                    style: TextStyle(
                      color: _estadoColor(r.estado),
                      fontSize: 11, fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  _fmtDate(r.createdAt),
                  style: const TextStyle(color: Color(0xFF94a3b8), fontSize: 11),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              r.guardiaNombre,
              style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
            ),
            if (r.puestoNombre != null && r.puestoNombre!.isNotEmpty) ...[
              const SizedBox(height: 2),
              Row(children: [
                const Icon(Icons.location_on_outlined, size: 12, color: Color(0xFF3b82f6)),
                const SizedBox(width: 3),
                Text(r.puestoNombre!, style: const TextStyle(color: Color(0xFF3b82f6), fontSize: 11, fontWeight: FontWeight.w500)),
              ]),
            ],
            if (r.descripcion != null && r.descripcion!.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(r.descripcion!, style: const TextStyle(color: Color(0xFF94a3b8), fontSize: 12)),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                // Duration
                if (r.duracionSeg != null)
                  Row(
                    children: [
                      const Icon(Icons.timer_outlined, size: 13, color: Color(0xFF94a3b8)),
                      const SizedBox(width: 3),
                      Text(
                        _fmtDur(r.duracionSeg!),
                        style: const TextStyle(color: Color(0xFF94a3b8), fontSize: 12),
                      ),
                      const SizedBox(width: 12),
                    ],
                  ),
                const Spacer(),
                // Play button
                ElevatedButton.icon(
                  onPressed: _playerLoading && isPlaying ? null : () => _playReport(r),
                  icon: _playerLoading && isPlaying
                      ? const SizedBox(
                          width: 14, height: 14,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : Icon(
                          isPlaying ? Icons.stop : Icons.play_arrow,
                          size: 16,
                        ),
                  label: Text(isPlaying ? 'Detener' : 'Escuchar', style: const TextStyle(fontSize: 12)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isPlaying
                        ? const Color(0xFFef4444)
                        : const Color(0xFF3b82f6),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _tipoColor(String tipo) {
    switch (tipo) {
      case 'NOVEDAD':    return const Color(0xFF3b82f6);
      case 'INCIDENTE':  return const Color(0xFFf59e0b);
      case 'EMERGENCIA': return const Color(0xFFef4444);
      default:           return const Color(0xFF94a3b8);
    }
  }

  Color _estadoColor(String estado) {
    switch (estado) {
      case 'PENDIENTE':   return const Color(0xFFf59e0b);
      case 'EN_REVISION': return const Color(0xFF3b82f6);
      case 'APROBADO':    return const Color(0xFF10b981);
      default:            return const Color(0xFF94a3b8);
    }
  }

  String _fmtDate(DateTime d) {
    final local = d.toLocal();
    final now = DateTime.now();
    if (local.day == now.day && local.month == now.month && local.year == now.year) {
      return 'Hoy ${local.hour.toString().padLeft(2,'0')}:${local.minute.toString().padLeft(2,'0')}';
    }
    return '${local.day}/${local.month} ${local.hour.toString().padLeft(2,'0')}:${local.minute.toString().padLeft(2,'0')}';
  }

  String _fmtDur(double sec) {
    final s = sec.floor();
    if (s < 60) return '${s}s';
    return '${s ~/ 60}m ${s % 60}s';
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }
}
