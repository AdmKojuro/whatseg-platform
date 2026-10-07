class GuardiaInfo {
  final String id;
  final String cedula;
  final String nombre;
  final String rol;
  final String? comunidadId;
  final String token;

  GuardiaInfo({
    required this.id,
    required this.cedula,
    required this.nombre,
    required this.rol,
    this.comunidadId,
    required this.token,
  });

  factory GuardiaInfo.fromJson(Map<String, dynamic> j, String token) {
    return GuardiaInfo(
      id: j['id'] ?? '',
      cedula: j['cedula'] ?? '',
      nombre: j['nombre'] ?? '',
      rol: j['rol'] ?? 'GUARDIA',
      comunidadId: j['comunidad_id'],
      token: token,
    );
  }
}

class Comunidad {
  final String id;
  final String nombre;
  final String? codigo;

  Comunidad({required this.id, required this.nombre, this.codigo});

  factory Comunidad.fromJson(Map<String, dynamic> j) {
    return Comunidad(
      id: j['id'] ?? '',
      nombre: j['nombre'] ?? '',
      codigo: j['codigo'],
    );
  }
}

class ReportePTT {
  final String id;
  final String comunidadId;
  final String guardiaNombre;
  final String? puestoNombre;
  final String tipo;
  final String? descripcion;
  final String estado;
  final double? duracionSeg;
  final int? tamanioBytes;
  final String formato;
  final DateTime createdAt;

  ReportePTT({
    required this.id,
    required this.comunidadId,
    required this.guardiaNombre,
    this.puestoNombre,
    required this.tipo,
    this.descripcion,
    required this.estado,
    this.duracionSeg,
    this.tamanioBytes,
    this.formato = 'aac',
    required this.createdAt,
  });

  factory ReportePTT.fromJson(Map<String, dynamic> j) {
    return ReportePTT(
      id: j['id'] ?? '',
      comunidadId: j['comunidad_id'] ?? '',
      guardiaNombre: j['guardia_nombre'] ?? '',
      puestoNombre: j['puesto_nombre'] as String?,
      tipo: j['tipo'] ?? 'NOVEDAD',
      descripcion: j['descripcion'],
      estado: j['estado'] ?? 'PENDIENTE',
      duracionSeg: (j['duracion_seg'] as num?)?.toDouble(),
      tamanioBytes: j['tamanio_bytes'] as int?,
      formato: j['formato'] as String? ?? 'aac',
      createdAt: DateTime.tryParse(j['created_at'] ?? '') ?? DateTime.now(),
    );
  }
}

enum PttTipo { novedad, incidente, emergencia, prueba }

extension PttTipoExt on PttTipo {
  String get label {
    switch (this) {
      case PttTipo.novedad:    return 'NOVEDAD';
      case PttTipo.incidente:  return 'INCIDENTE';
      case PttTipo.emergencia: return 'EMERGENCIA';
      case PttTipo.prueba:     return 'PRUEBA';
    }
  }

  String get displayName {
    switch (this) {
      case PttTipo.novedad:    return 'Novedad';
      case PttTipo.incidente:  return 'Incidente';
      case PttTipo.emergencia: return 'Emergencia';
      case PttTipo.prueba:     return 'Prueba';
    }
  }
}
