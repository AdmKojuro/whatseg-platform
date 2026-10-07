import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

const _kToken    = 'boton_token';
const _kNombre   = 'boton_nombre';
const _kRol      = 'boton_rol';
const _kId       = 'boton_id';
const _kComId    = 'boton_comunidad_id';
const _kTelefono = 'boton_telefono';
const _kQueue    = 'boton_offline_queue';

class StorageService {
  // ── Sesión ────────────────────────────────────────────────────────────────

  static Future<void> guardarSesion({
    required String token,
    required String nombre,
    required String rol,
    required String id,
    String? comunidadId,
    String? telefono,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kToken,  token);
    await prefs.setString(_kNombre, nombre);
    await prefs.setString(_kRol,    rol);
    await prefs.setString(_kId,     id);
    if (comunidadId != null) await prefs.setString(_kComId,    comunidadId);
    if (telefono    != null) await prefs.setString(_kTelefono, telefono);
  }

  static Future<Map<String, String?>> leerSesion() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'token':       prefs.getString(_kToken),
      'nombre':      prefs.getString(_kNombre),
      'rol':         prefs.getString(_kRol),
      'id':          prefs.getString(_kId),
      'comunidadId': prefs.getString(_kComId),
      'telefono':    prefs.getString(_kTelefono),
    };
  }

  static Future<void> borrarSesion() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kToken);
    await prefs.remove(_kNombre);
    await prefs.remove(_kRol);
    await prefs.remove(_kId);
    await prefs.remove(_kComId);
    await prefs.remove(_kTelefono);
  }

  // ── Cola offline ──────────────────────────────────────────────────────────

  static Future<void> encolarEvento(Map<String, dynamic> evento) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_kQueue) ?? [];
    raw.add(jsonEncode(evento));
    await prefs.setStringList(_kQueue, raw);
  }

  static Future<List<Map<String, dynamic>>> leerCola() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_kQueue) ?? [];
    return raw.map((s) => jsonDecode(s) as Map<String, dynamic>).toList();
  }

  static Future<void> limpiarCola() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kQueue);
  }
}
