import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import 'ptt_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _cedulaCtrl = TextEditingController();
  final _passCtrl   = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _requestAllPermissions() async {
    await [
      Permission.camera,
      Permission.location,
      Permission.microphone,
      Permission.notification,
    ].request();
  }

  Future<void> _login() async {
    final cedula = _cedulaCtrl.text.trim();
    final pass   = _passCtrl.text;
    if (cedula.isEmpty || pass.isEmpty) {
      setState(() => _error = 'Completa los campos');
      return;
    }

    setState(() { _loading = true; _error = null; });

    try {
      final data    = await ApiService.login(cedula, pass);
      final token   = data['token'] as String;
      final guardia = GuardiaInfo.fromJson(data['guardia'] as Map<String, dynamic>, token);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('ptt_token', token);
      await prefs.setString('ptt_nombre', guardia.nombre);
      await prefs.setString('ptt_rol', guardia.rol);
      await prefs.setString('ptt_id', guardia.id);
      if (guardia.comunidadId != null) {
        await prefs.setString('ptt_comunidad_id', guardia.comunidadId!);
      }

      if (!mounted) return;

      // Solicitar todos los permisos necesarios al iniciar sesión
      await _requestAllPermissions();

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => PttScreen(guardia: guardia)),
      );
    } catch (e) {
      setState(() { _error = e.toString().replaceFirst('Exception: ', ''); });
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f1729),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Logo
                ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: Image.asset(
                    'assets/logo.webp',
                    width: 72, height: 72,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'REPORTES PTT',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Central de Reportes',
                  style: TextStyle(color: Color(0xFF94a3b8), fontSize: 14),
                ),
                const SizedBox(height: 40),

                // Cédula
                _inputField(
                  controller: _cedulaCtrl,
                  label: 'Cédula',
                  icon: Icons.badge_outlined,
                  keyboardType: TextInputType.number,
                  onSubmit: (_) => FocusScope.of(context).nextFocus(),
                ),
                const SizedBox(height: 14),

                // Contraseña
                _inputField(
                  controller: _passCtrl,
                  label: 'Contraseña',
                  icon: Icons.lock_outline,
                  obscure: true,
                  onSubmit: (_) => _login(),
                ),
                const SizedBox(height: 24),

                // Error
                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFef4444).withOpacity(.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFef4444).withOpacity(.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: Color(0xFFef4444), size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(_error!, style: const TextStyle(color: Color(0xFFef4444), fontSize: 13)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Login button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _login,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF3b82f6),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _loading
                        ? const SizedBox(
                            width: 20, height: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Text('Ingresar', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _inputField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    bool obscure = false,
    TextInputType keyboardType = TextInputType.text,
    void Function(String)? onSubmit,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboardType,
      style: const TextStyle(color: Colors.white),
      onSubmitted: onSubmit,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Color(0xFF94a3b8)),
        prefixIcon: Icon(icon, color: const Color(0xFF94a3b8), size: 20),
        filled: true,
        fillColor: const Color(0xFF1a2744),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF243358)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF243358)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF3b82f6), width: 2),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _cedulaCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }
}
