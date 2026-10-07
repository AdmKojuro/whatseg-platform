import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'models/models.dart';
import 'screens/login_screen.dart';
import 'screens/ptt_screen.dart';
import 'services/api_service.dart';
import 'services/background_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Inicializar servicio en segundo plano
  initForegroundTask();
  await initNotifications();

  // Force portrait
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Color(0xFF0f1729),
    statusBarIconBrightness: Brightness.light,
  ));

  runApp(const WhatsEgPttApp());
}

class WhatsEgPttApp extends StatelessWidget {
  const WhatsEgPttApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'WhatsEg PTT',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFF3b82f6),
          surface: const Color(0xFF1a2744),
        ),
        scaffoldBackgroundColor: const Color(0xFF0f1729),
        fontFamily: 'Roboto',
      ),
      home: const SplashRouter(),
    );
  }
}

class SplashRouter extends StatefulWidget {
  const SplashRouter({super.key});

  @override
  State<SplashRouter> createState() => _SplashRouterState();
}

class _SplashRouterState extends State<SplashRouter> {
  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('ptt_token');

    if (token == null || token.isEmpty) {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
      }
      return;
    }

    // Validate token is still good by decoding expiry
    try {
      final parts = token.split('.');
      if (parts.length != 3) throw Exception('bad token');
      final payload = String.fromCharCodes(
        base64Url.decode(base64Url.normalize(parts[1])),
      );
      final Map<String, dynamic> json = _parseJson(payload);
      final exp = json['exp'] as int?;
      if (exp != null && DateTime.now().millisecondsSinceEpoch ~/ 1000 > exp) {
        throw Exception('expired');
      }

      // Token looks good, restore session
      final guardia = GuardiaInfo(
        id: json['sub'] ?? prefs.getString('ptt_id') ?? '',
        cedula: '',
        nombre: json['nombre'] ?? prefs.getString('ptt_nombre') ?? '',
        rol: json['rol'] ?? prefs.getString('ptt_rol') ?? 'GUARDIA',
        comunidadId: json['comunidad_id'] ?? prefs.getString('ptt_comunidad_id'),
        token: token,
      );

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => PttScreen(guardia: guardia)),
        );
      }
    } catch (_) {
      await prefs.clear();
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
      }
    }
  }

  Map<String, dynamic> _parseJson(String s) {
    // Simple JSON parse
    final result = <String, dynamic>{};
    final pairs = s.replaceAll(RegExp(r'[{}]'), '').split(',');
    for (final p in pairs) {
      final kv = p.split(':');
      if (kv.length < 2) continue;
      final k = kv[0].trim().replaceAll('"', '');
      final v = kv.sublist(1).join(':').trim().replaceAll('"', '');
      final vNum = int.tryParse(v);
      if (vNum != null) result[k] = vNum;
      else if (v == 'true') result[k] = true;
      else if (v == 'false') result[k] = false;
      else result[k] = v;
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Color(0xFF0f1729),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.radio, size: 56, color: Color(0xFF3b82f6)),
            SizedBox(height: 16),
            Text(
              'WhatsEg PTT',
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
            SizedBox(height: 8),
            SizedBox(
              width: 24, height: 24,
              child: CircularProgressIndicator(
                color: Color(0xFF3b82f6), strokeWidth: 2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
