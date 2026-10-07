import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/models.dart';
import '../models/ronda_models.dart';

const String kApiBase    = 'https://api.whatseg.com/api/ext/reportes-ptt';
const String kRondasBase = 'https://api.whatseg.com/api/ext/rondas';
const String kModulosBase = 'https://api.whatseg.com/api/ext/modulos';
const String kBotonBase  = 'https://api.whatseg.com/api/ext/boton';

class ApiService {
  final String token;

  ApiService(this.token);

  /// Returns the puesto_id(s) embedded in the JWT, or null if not present.
  String? get puestoId {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload = String.fromCharCodes(
        base64Url.decode(base64Url.normalize(parts[1])),
      );
      final data = jsonDecode(payload) as Map<String, dynamic>;
      final v = data['puesto_id'];
      if (v == null) return null;
      return v.toString();
    } catch (_) {
      return null;
    }
  }

  Map<String, String> get _headers => {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      };

  // ── Auth ──────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> login(String cedula, String password) async {
    final r = await http.post(
      Uri.parse('$kApiBase/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'cedula': cedula, 'password': password}),
    );
    final data = jsonDecode(r.body) as Map<String, dynamic>;
    if (r.statusCode != 200) throw Exception(data['error'] ?? 'Error de autenticación');
    return data;
  }

  // ── Módulos activos para una comunidad ────────────────────────────────
  Future<Map<String, bool>> modulosComunidad(String comunidadId) async {
    if (comunidadId.isEmpty) return {'REPORTES_PTT': true, 'RONDAS': true};
    try {
      final r = await http.get(
        Uri.parse('$kModulosBase/comunidad/$comunidadId/activos'),
        headers: _headers,
      );
      if (r.statusCode != 200) return {'REPORTES_PTT': true, 'RONDAS': true};
      final data = jsonDecode(r.body) as Map<String, dynamic>;
      return data.map((k, v) => MapEntry(k, v == true));
    } catch (_) {
      return {'REPORTES_PTT': true, 'RONDAS': true};
    }
  }

  // ── Comunidades ────────────────────────────────────────────────────────
  Future<List<Comunidad>> misComunidades() async {
    final r = await http.get(Uri.parse('$kApiBase/mis-comunidades'), headers: _headers);
    if (r.statusCode != 200) throw Exception('Error cargando comunidades');
    final list = jsonDecode(r.body) as List;
    return list.map((j) => Comunidad.fromJson(j)).toList();
  }

  // ── Reportes ───────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> listarReportes({
    String? comunidadId,
    int limit = 20,
    int offset = 0,
  }) async {
    final params = {
      'limit': '$limit',
      'offset': '$offset',
      if (comunidadId != null) 'comunidad_id': comunidadId,
    };
    final uri = Uri.parse('$kApiBase/reportes').replace(queryParameters: params);
    final r = await http.get(uri, headers: _headers);
    if (r.statusCode != 200) throw Exception('Error cargando reportes');
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> estadisticas() async {
    final r = await http.get(Uri.parse('$kApiBase/stats'), headers: _headers);
    if (r.statusCode != 200) throw Exception('Error en estadísticas');
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  String audioUrl(String id) => '$kApiBase/reportes/$id/audio';

  // ── Rondas ─────────────────────────────────────────────────────────────
  Future<List<RutaRonda>> listarRutas() async {
    final r = await http.get(Uri.parse('$kRondasBase/rutas'), headers: _headers);
    if (r.statusCode != 200) throw Exception('Error cargando rutas');
    final list = jsonDecode(r.body) as List;
    return list.map((j) => RutaRonda.fromJson(j as Map<String, dynamic>)).toList();
  }

  Future<RondaActiva?> rondaActiva() async {
    final r = await http.get(Uri.parse('$kRondasBase/activa'), headers: _headers);
    if (r.statusCode == 404 || r.statusCode == 204) return null;
    if (r.statusCode != 200) return null;
    final body = r.body.trim();
    if (body == 'null' || body.isEmpty) return null;
    final data = jsonDecode(body);
    if (data == null) return null;
    // Backend devuelve { activa: false } cuando no hay ronda activa
    if (data is Map && data['activa'] == false) return null;
    return RondaActiva.fromJson(data as Map<String, dynamic>);
  }

  Future<RondaActiva> iniciarRonda(String rutaId, {File? fotoVerificacion}) async {
    final body = <String, dynamic>{'ruta_id': rutaId};
    if (fotoVerificacion != null) {
      final bytes = await fotoVerificacion.readAsBytes();
      body['foto_base64'] = 'data:image/jpeg;base64,${base64Encode(bytes)}';
    }
    final r = await http.post(
      Uri.parse('$kRondasBase/iniciar'),
      headers: _headers,
      body: jsonEncode(body),
    );
    final data = jsonDecode(r.body) as Map<String, dynamic>;
    if (r.statusCode != 200 && r.statusCode != 201) {
      throw Exception(data['error'] ?? 'Error al iniciar ronda');
    }
    return RondaActiva.fromJson(data);
  }

  Future<void> finalizarRonda(String ejecucionId, {String? notas}) async {
    final r = await http.post(
      Uri.parse('$kRondasBase/finalizar/$ejecucionId'),
      headers: _headers,
      body: jsonEncode({'notas': notas ?? ''}),
    );
    if (r.statusCode != 200 && r.statusCode != 201) {
      final body = jsonDecode(r.body) as Map<String, dynamic>;
      throw Exception(body['error'] ?? 'Error al finalizar ronda');
    }
  }

  Future<Map<String, dynamic>> marcarCheckpoint({
    String? qrCode,
    String? nfcTag,
    double? latitud,
    double? longitud,
    String? observaciones,
    File? foto,
  }) async {
    assert(qrCode != null || nfcTag != null, 'Se requiere qrCode o nfcTag');
    final body = <String, dynamic>{};
    if (qrCode != null) body['qr_code'] = qrCode;
    if (nfcTag != null) body['nfc_tag'] = nfcTag;
    if (latitud != null) body['latitud'] = latitud;
    if (longitud != null) body['longitud'] = longitud;
    if (observaciones != null && observaciones.isNotEmpty) body['notas'] = observaciones;
    if (foto != null) {
      final bytes = await foto.readAsBytes();
      body['foto_base64'] = base64Encode(bytes);
    }

    final r = await http.post(
      Uri.parse('$kRondasBase/marcar'),
      headers: _headers,
      body: jsonEncode(body),
    );
    final data = jsonDecode(r.body) as Map<String, dynamic>;
    if (r.statusCode != 200 && r.statusCode != 201) {
      throw Exception(data['error'] ?? 'Error al marcar checkpoint');
    }
    return data;
  }

  // ── Monitoreo (Supervisor) ──────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> rondasEnCurso() async {
    try {
      final r = await http.get(Uri.parse('$kRondasBase/en-curso'), headers: _headers);
      if (r.statusCode != 200) return [];
      final list = jsonDecode(r.body) as List;
      return list.cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  Future<List<CheckpointInfo>> checkpointsRuta(String rutaId) async {
    final r = await http.get(
      Uri.parse('$kRondasBase/rutas/$rutaId/checkpoints'),
      headers: _headers,
    );
    if (r.statusCode != 200) return [];
    final list = jsonDecode(r.body) as List;
    return list.map((j) => CheckpointInfo.fromJson(j as Map<String, dynamic>)).toList();
  }

  // ── Plano de planta ────────────────────────────────────────────────────
  /// Returns the floor plan JSON for a puesto, or null if not configured.
  Future<Map<String, dynamic>?> getPlano(String puestoId) async {
    try {
      final r = await http.get(
        Uri.parse('$kRondasBase/puestos/$puestoId/plano'),
        headers: _headers,
      );
      if (r.statusCode != 200) return null;
      final data = jsonDecode(r.body) as Map<String, dynamic>;
      if (data['sin_plano'] == true || data['plano_json'] == null) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  // ── Alertas ────────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> alertasPendientes(String comunidadId) async {
    try {
      final uri = Uri.parse('$kApiBase/alertas/pendientes')
          .replace(queryParameters: {'comunidad_id': comunidadId});
      final r = await http.get(uri, headers: _headers);
      if (r.statusCode != 200) return [];
      final list = jsonDecode(r.body) as List;
      return list.cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  Future<void> marcarAlertaVista(String alertaId) async {
    try {
      await http.post(
        Uri.parse('$kApiBase/alertas/$alertaId/vista'),
        headers: _headers,
      );
    } catch (_) {}
  }

  // ── SOS / Botón de Pánico ──────────────────────────────────────────────
  Future<Map<String, dynamic>> crearEventoPanico({
    double? lat,
    double? lng,
    String? descripcion,
  }) async {
    final body = <String, dynamic>{'tipo': 'PANICO'};
    if (lat != null) body['lat'] = lat;
    if (lng != null) body['lng'] = lng;
    if (descripcion != null && descripcion.isNotEmpty) body['descripcion'] = descripcion;
    final r = await http.post(
      Uri.parse('$kBotonBase/eventos'),
      headers: _headers,
      body: jsonEncode(body),
    );
    final data = jsonDecode(r.body) as Map<String, dynamic>;
    if (r.statusCode != 200 && r.statusCode != 201) {
      throw Exception(data['error'] ?? 'Error al enviar SOS');
    }
    return data;
  }

  // ── Novedades de texto ─────────────────────────────────────────────────
  Future<void> crearNovedadTexto({
    required String tipo,
    String? descripcion,
    File? foto,
    double? latitud,
    double? longitud,
  }) async {
    final body = <String, dynamic>{'tipo': tipo};
    if (descripcion != null && descripcion.isNotEmpty) body['descripcion'] = descripcion;
    if (latitud != null) body['latitud'] = latitud;
    if (longitud != null) body['longitud'] = longitud;
    if (foto != null) {
      final bytes = await foto.readAsBytes();
      body['foto_base64'] = base64Encode(bytes);
    }
    final r = await http.post(
      Uri.parse('$kApiBase/novedades'),
      headers: _headers,
      body: jsonEncode(body),
    );
    final data = jsonDecode(r.body) as Map<String, dynamic>;
    if (r.statusCode != 200 && r.statusCode != 201) {
      throw Exception(data['error'] ?? 'Error al enviar novedad');
    }
  }

  // ── Checkpoint Campos (Formularios configurables) ────────────────────
  Future<List<Map<String, dynamic>>> getCamposCheckpoint(String checkpointId) async {
    final r = await http.get(
      Uri.parse('$kRondasBase/checkpoints/$checkpointId/campos'),
      headers: _headers,
    );
    if (r.statusCode != 200) return [];
    final data = jsonDecode(r.body);
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  Future<void> guardarRespuestasVisita(String visitaId, List<Map<String, String>> respuestas) async {
    await http.post(
      Uri.parse('$kRondasBase/visitas/$visitaId/respuestas'),
      headers: _headers,
      body: jsonEncode({'respuestas': respuestas}),
    );
  }

  // ── Programaciones de Ronda ──────────────────────────────────────────
  Future<List<Map<String, dynamic>>> listarProgramaciones() async {
    final r = await http.get(
      Uri.parse('$kRondasBase/programaciones'),
      headers: _headers,
    );
    if (r.statusCode != 200) return [];
    final data = jsonDecode(r.body);
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }
}
