import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'models/usuario_model.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Color(0xFF1a0505),
    statusBarIconBrightness: Brightness.light,
  ));
  runApp(const BotonApp());
}

class BotonApp extends StatelessWidget {
  const BotonApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'WhatsEg Botón',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFdc2626),
          surface: Color(0xFF0f0505),
        ),
        scaffoldBackgroundColor: const Color(0xFF0f0505),
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
    _init();
  }

  Future<void> _init() async {
    await Future.delayed(const Duration(milliseconds: 800));
    if (!mounted) return;

    final prefs  = await SharedPreferences.getInstance();
    final token  = prefs.getString('boton_token');
    final nombre = prefs.getString('boton_nombre');
    final rol    = prefs.getString('boton_rol');
    final id     = prefs.getString('boton_id');

    if (token == null || nombre == null || id == null) { _irLogin(); return; }

    // Validar expiración del JWT
    try {
      final parts = token.split('.');
      if (parts.length == 3) {
        final payload = jsonDecode(
          utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
        ) as Map<String, dynamic>;
        final exp = payload['exp'] as int?;
        if (exp != null &&
            DateTime.fromMillisecondsSinceEpoch(exp * 1000).isBefore(DateTime.now())) {
          _irLogin(); return;
        }
      }
    } catch (_) { _irLogin(); return; }

    final usuario = UsuarioInfo(
      id:          id,
      nombre:      nombre,
      rol:         rol ?? 'GUARDIA',
      token:       token,
      comunidadId: prefs.getString('boton_comunidad_id'),
      telefono:    prefs.getString('boton_telefono'),
    );

    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => HomeScreen(usuario: usuario)),
    );
  }

  void _irLogin() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f0505),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: Image.asset('assets/boton.png', width: 96, height: 96, fit: BoxFit.cover),
            ),
            const SizedBox(height: 24),
            const CircularProgressIndicator(color: Color(0xFFdc2626), strokeWidth: 3),
          ],
        ),
      ),
    );
  }
}
