import 'package:flutter/material.dart';
import '../models/usuario_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  // 0 = Guardia, 1 = Particular
  int _modo = 0;

  final _cedulaCtrl   = TextEditingController();
  final _telefonoCtrl = TextEditingController();
  final _passCtrl     = TextEditingController();
  bool _loading = false;
  bool _obscure = true;
  String? _error;

  Future<void> _login() async {
    final pass = _passCtrl.text;
    if (pass.isEmpty) { setState(() => _error = 'Ingresa tu contraseña'); return; }

    setState(() { _loading = true; _error = null; });

    try {
      UsuarioInfo usuario;

      if (_modo == 0) {
        // Guardia
        final cedula = _cedulaCtrl.text.trim();
        if (cedula.isEmpty) { setState(() { _error = 'Ingresa tu cédula'; _loading = false; }); return; }
        final data  = await ApiService.loginGuardia(cedula, pass);
        final token = data['token'] as String;
        usuario = UsuarioInfo.fromGuardia(data, token);
      } else {
        // Particular
        final tel = _telefonoCtrl.text.trim();
        if (tel.isEmpty) { setState(() { _error = 'Ingresa tu teléfono'; _loading = false; }); return; }
        final data = await ApiService.loginParticular(tel, pass);
        usuario = UsuarioInfo.fromParticular(data);
      }

      await StorageService.guardarSesion(
        token:       usuario.token,
        nombre:      usuario.nombre,
        rol:         usuario.rol,
        id:          usuario.id,
        comunidadId: usuario.comunidadId,
        telefono:    usuario.telefono,
      );

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => HomeScreen(usuario: usuario)),
      );
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f0505),
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
                  borderRadius: BorderRadius.circular(24),
                  child: Image.asset('assets/boton.png', width: 88, height: 88, fit: BoxFit.cover),
                ),
                const SizedBox(height: 18),
                const Text(
                  'WHATSEG BOTÓN',
                  style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 1.5),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Sistema de Emergencias',
                  style: TextStyle(color: Color(0xFF94a3b8), fontSize: 13),
                ),
                const SizedBox(height: 32),

                // Toggle modo
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF1a0a0a),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      _modoBtn('Guardia', 0, Icons.shield_outlined),
                      _modoBtn('Particular', 1, Icons.person_outline),
                    ],
                  ),
                ),
                const SizedBox(height: 28),

                // Campo de identificación
                if (_modo == 0)
                  _campo(
                    controller: _cedulaCtrl,
                    label: 'Cédula',
                    icon: Icons.badge_outlined,
                    tipo: TextInputType.number,
                  )
                else
                  _campo(
                    controller: _telefonoCtrl,
                    label: 'Teléfono',
                    icon: Icons.phone_outlined,
                    tipo: TextInputType.phone,
                  ),
                const SizedBox(height: 14),

                // Contraseña
                TextField(
                  controller: _passCtrl,
                  obscureText: _obscure,
                  style: const TextStyle(color: Colors.white),
                  onSubmitted: (_) => _login(),
                  decoration: _inputDeco('Contraseña', Icons.lock_outline).copyWith(
                    suffixIcon: IconButton(
                      icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                          color: const Color(0xFF94a3b8), size: 20),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
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
                    child: Row(children: [
                      const Icon(Icons.error_outline, color: Color(0xFFef4444), size: 16),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_error!, style: const TextStyle(color: Color(0xFFef4444), fontSize: 13))),
                    ]),
                  ),
                  const SizedBox(height: 16),
                ],

                // Botón ingresar
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _login,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFdc2626),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _loading
                        ? const SizedBox(width: 22, height: 22,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                        : const Text('Ingresar', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _modoBtn(String label, int idx, IconData icon) {
    final active = _modo == idx;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() { _modo = idx; _error = null; }),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: active ? const Color(0xFFdc2626) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: active ? Colors.white : const Color(0xFF94a3b8)),
              const SizedBox(width: 6),
              Text(label,
                style: TextStyle(
                  color: active ? Colors.white : const Color(0xFF94a3b8),
                  fontWeight: active ? FontWeight.w700 : FontWeight.w400,
                  fontSize: 13,
                )),
            ],
          ),
        ),
      ),
    );
  }

  Widget _campo({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType tipo = TextInputType.text,
  }) {
    return TextField(
      controller: controller,
      keyboardType: tipo,
      style: const TextStyle(color: Colors.white),
      onSubmitted: (_) => FocusScope.of(context).nextFocus(),
      decoration: _inputDeco(label, icon),
    );
  }

  InputDecoration _inputDeco(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Color(0xFF94a3b8)),
      prefixIcon: Icon(icon, color: const Color(0xFF94a3b8), size: 20),
      filled: true,
      fillColor: const Color(0xFF1a0a0a),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF3d1515))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF3d1515))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFdc2626), width: 2)),
    );
  }

  @override
  void dispose() {
    _cedulaCtrl.dispose();
    _telefonoCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }
}
