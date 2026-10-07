class UsuarioInfo {
  final String id;
  final String nombre;
  final String rol; // GUARDIA | PARTICULAR | SUPERVISOR | ADMIN
  final String token;
  final String? comunidadId;
  final String? telefono;

  const UsuarioInfo({
    required this.id,
    required this.nombre,
    required this.rol,
    required this.token,
    this.comunidadId,
    this.telefono,
  });

  factory UsuarioInfo.fromGuardia(Map<String, dynamic> json, String token) {
    final g = json['guardia'] as Map<String, dynamic>? ?? json;
    return UsuarioInfo(
      id: g['id']?.toString() ?? '',
      nombre: g['nombre']?.toString() ?? '',
      rol: g['rol']?.toString() ?? 'GUARDIA',
      token: token,
      comunidadId: g['comunidad_id']?.toString(),
    );
  }

  factory UsuarioInfo.fromParticular(Map<String, dynamic> json) {
    return UsuarioInfo(
      id: json['id']?.toString() ?? '',
      nombre: json['nombre']?.toString() ?? '',
      rol: 'PARTICULAR',
      token: json['token']?.toString() ?? '',
      telefono: json['telefono']?.toString(),
    );
  }

  bool get esParticular => rol == 'PARTICULAR';
}
