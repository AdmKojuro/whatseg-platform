import 'dart:convert';
import 'package:http/http.dart' as http;

const String kBotonBase   = 'https://api.whatseg.com/api/ext/boton';
const String kGuardiaBase = 'https://api.whatseg.com/api/ext/reportes-ptt';

class ApiService {
  final String token;
  ApiService(this.token);

  Map<String, String> get _headers => {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  };

  // ── Auth ──────────────────────────────────────────────────────────────────

  /// Login guardia (cedula + password) — usa el endpoint de reportes-ptt
  static Future<Map<String, dynamic>> loginGuardia(
    String cedula,
    String password,
  ) async {
    final r = await http
        .post(
          Uri.parse('$kGuardiaBase/auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'cedula': cedula, 'password': password}),
        )
        .timeout(const Duration(seconds: 15));
    final data = jsonDecode(r.body) as Map<String, dynamic>;
    if (r.statusCode != 200) throw Exception(data['error'] ?? 'Error de autenticación');
    return data;
  }

  /// Login particular (teléfono + password) — endpoint propio del módulo botón
  static Future<Map<String, dynamic>> loginParticular(
    String telefono,
    String password,
  ) async {
    final r = await http
        .post(
          Uri.parse('$kBotonBase/auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'telefono': telefono, 'password': password}),
        )
        .timeout(const Duration(seconds: 15));
    final data = jsonDecode(r.body) as Map<String, dynamic>;
    if (r.statusCode != 200) throw Exception(data['error'] ?? 'Error de autenticación');
    return data;
  }

  // ── Eventos de pánico ─────────────────────────────────────────────────────

  Future<Map<String, dynamic>> crearEvento({
    required String tipo,
    double? lat,
    double? lng,
    String? descripcion,
  }) async {
    final body = <String, dynamic>{'tipo': tipo};
    if (lat != null) body['lat'] = lat;
    if (lng != null) body['lng'] = lng;
    if (descripcion != null && descripcion.isNotEmpty) body['descripcion'] = descripcion;

    final r = await http
        .post(
          Uri.parse('$kBotonBase/eventos'),
          headers: _headers,
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 20));

    final data = jsonDecode(r.body) as Map<String, dynamic>;
    if (r.statusCode != 201 && r.statusCode != 200) {
      throw Exception(data['error'] ?? 'Error al enviar evento');
    }
    return data;
  }
}
