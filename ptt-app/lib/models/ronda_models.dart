class RutaRonda {
  final String id;
  final String nombre;
  final String? descripcion;
  final int intervaloMin;
  final int checkpointsTotal;

  RutaRonda({
    required this.id,
    required this.nombre,
    this.descripcion,
    required this.intervaloMin,
    required this.checkpointsTotal,
  });

  factory RutaRonda.fromJson(Map<String, dynamic> j) {
    // La API devuelve checkpoints como array incluido (no _count)
    final cpList = j['checkpoints'] as List?;
    final cpTotal = cpList?.length ?? 0;
    // Para supervisores: checkpoints_para_mi indica cuántos deben completar
    final cpParaMi = j['checkpoints_para_mi'] as int?;
    return RutaRonda(
      id: (j['id'] ?? '') as String,
      nombre: (j['nombre'] ?? '') as String,
      descripcion: j['descripcion'] as String?,
      intervaloMin: (j['intervalo_min'] is int) ? j['intervalo_min'] : 60,
      checkpointsTotal: cpParaMi ?? cpTotal,
    );
  }
}

class CheckpointInfo {
  final String id;
  final String nombre;
  final int orden;
  final double? latitud;
  final double? longitud;
  final bool visitado;

  CheckpointInfo({
    required this.id,
    required this.nombre,
    required this.orden,
    this.latitud,
    this.longitud,
    this.visitado = false,
  });

  factory CheckpointInfo.fromJson(Map<String, dynamic> j, {bool visitado = false}) =>
      CheckpointInfo(
        id: (j['id'] ?? '') as String,
        nombre: (j['nombre'] ?? '') as String,
        orden: (j['orden'] is int) ? j['orden'] : int.tryParse(j['orden']?.toString() ?? '0') ?? 0,
        latitud: (j['latitud'] as num?)?.toDouble(),
        longitud: (j['longitud'] as num?)?.toDouble(),
        visitado: visitado,
      );
}

class RondaActiva {
  final String id;
  final String rutaId;
  final String rutaNombre;
  final String estado;
  final int checkpointsTotal;
  final int checkpointsMarcados;
  /// Checkpoints a mostrar: todos para guardias, solo los obligatorios para supervisores
  final List<CheckpointInfo> allCheckpoints;

  RondaActiva({
    required this.id,
    required this.rutaId,
    required this.rutaNombre,
    required this.estado,
    required this.checkpointsTotal,
    required this.checkpointsMarcados,
    required this.allCheckpoints,
  });

  factory RondaActiva.fromJson(Map<String, dynamic> j) {
    final ruta = j['ruta'] as Map<String, dynamic>? ?? {};

    // IDs de checkpoints ya visitados (de visitas[].checkpoint.id)
    final visitasList = j['visitas'] as List? ?? [];
    final visitedIds = visitasList.map((v) {
      final cp = v['checkpoint'] as Map<String, dynamic>? ?? {};
      return (cp['id'] ?? '') as String;
    }).toSet();

    // Para supervisores: filtrar por sus checkpoints obligatorios
    final superIds = (j['supervisor_checkpoint_ids'] as List?)?.cast<String>().toSet();

    // Todos los checkpoints de la ruta
    final cpList = ruta['checkpoints'] as List? ?? [];
    final allCps = cpList.map((cp) {
      final m = cp as Map<String, dynamic>;
      return CheckpointInfo.fromJson(m, visitado: visitedIds.contains(m['id']));
    }).toList()
      ..sort((a, b) => a.orden.compareTo(b.orden));

    // Filtrar para supervisores si hay IDs asignados
    final displayCheckpoints = (superIds != null && superIds.isNotEmpty)
        ? allCps.where((cp) => superIds.contains(cp.id)).toList()
        : allCps;

    return RondaActiva(
      id: (j['id'] ?? '') as String,
      rutaId: (j['ruta_id'] ?? '') as String,
      rutaNombre: (ruta['nombre'] ?? '') as String,
      estado: (j['estado'] ?? 'EN_CURSO') as String,
      checkpointsTotal: (j['checkpoints_total'] is int) ? j['checkpoints_total'] : cpList.length,
      checkpointsMarcados: (j['checkpoints_marcados'] is int) ? j['checkpoints_marcados'] : visitedIds.length,
      allCheckpoints: displayCheckpoints,
    );
  }

  double get progreso =>
      checkpointsTotal > 0 ? checkpointsMarcados / checkpointsTotal : 0;
}
