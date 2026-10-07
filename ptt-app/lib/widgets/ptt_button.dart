import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/ptt_service.dart';

class PttButton extends StatelessWidget {
  final PttService service;
  final PttTipo tipo;
  final VoidCallback onStart;
  final VoidCallback onStop;

  const PttButton({
    super.key,
    required this.service,
    required this.tipo,
    required this.onStart,
    required this.onStop,
  });

  Color get _color {
    switch (tipo) {
      case PttTipo.novedad:    return const Color(0xFF3b82f6);
      case PttTipo.incidente:  return const Color(0xFFf59e0b);
      case PttTipo.emergencia: return const Color(0xFFef4444);
      case PttTipo.prueba:     return const Color(0xFF94a3b8);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state   = service.pttState;
    final wsState = service.wsState;
    final duration = service.pttDuration;

    final isRecording = state == PttState.recording;
    final isSaving    = state == PttState.saving;
    final disabled    = wsState != WsState.connected || isSaving;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Status text
        Text(
          isRecording
              ? _formatDur(duration)
              : isSaving
                  ? 'Guardando reporte...'
                  : wsState == WsState.connected
                      ? 'Mantén presionado para transmitir'
                      : wsState == WsState.connecting
                          ? 'Conectando...'
                          : 'Sin conexión',
          style: TextStyle(
            color: isRecording
                ? _color
                : const Color(0xFF94a3b8),
            fontSize: 14,
            fontWeight: isRecording ? FontWeight.w700 : FontWeight.w400,
          ),
        ),
        const SizedBox(height: 32),

        // PTT Button
        GestureDetector(
          onTapDown: disabled ? null : (_) => onStart(),
          onTapUp:   disabled ? null : (_) => onStop(),
          onTapCancel: isRecording ? onStop : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: isRecording ? 160 : 140,
            height: isRecording ? 160 : 140,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: disabled
                  ? const Color(0xFF243358)
                  : isRecording
                      ? _color
                      : _color.withOpacity(.15),
              border: Border.all(
                color: disabled
                    ? const Color(0xFF243358)
                    : _color,
                width: isRecording ? 4 : 2,
              ),
              boxShadow: isRecording
                  ? [
                      BoxShadow(
                        color: _color.withOpacity(.4),
                        blurRadius: 40,
                        spreadRadius: 10,
                      ),
                    ]
                  : null,
            ),
            child: isSaving
                ? const CircularProgressIndicator(
                    color: Colors.white, strokeWidth: 3,
                  )
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.radio,
                        size: isRecording ? 60 : 52,
                        color: disabled
                            ? const Color(0xFF94a3b8)
                            : isRecording
                                ? Colors.white
                                : _color,
                      ),
                      if (isRecording)
                        const Text(
                          'AL AIRE',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 2,
                          ),
                        ),
                    ],
                  ),
          ),
        ),

        const SizedBox(height: 28),

        // Hint
        if (!isRecording && !isSaving && wsState == WsState.connected)
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.touch_app, size: 14, color: const Color(0xFF94a3b8)),
              const SizedBox(width: 4),
              const Text(
                'Mantén presionado para transmitir por radio',
                style: TextStyle(color: Color(0xFF94a3b8), fontSize: 12),
              ),
            ],
          ),
      ],
    );
  }

  String _formatDur(double sec) {
    final s = sec.floor();
    final m = s ~/ 60;
    final r = s % 60;
    return '${m.toString().padLeft(2, '0')}:${r.toString().padLeft(2, '0')}';
  }
}
