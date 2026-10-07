import { Router } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './rondas.controller'

const router = Router()

// ─── Login de guardia/supervisor (SIN auth) ──────────────────────────────
router.post('/auth/login', ctrl.loginRonda)

// ─── Todo lo demás requiere auth ─────────────────────────────────────────
router.use(authMiddleware)

// ─── Comunidades del admin (lectura directa de BD compartida) ────────────
router.get('/mis-comunidades', ctrl.misComunidades)

// ─── Personal (CRUD supervisores/guardias — solo admin) ──────────────────
router.get('/personal', requireRole('SUPERADMIN', 'ADMIN'), ctrl.listarPersonal)
router.post('/personal', requireRole('SUPERADMIN', 'ADMIN'), ctrl.crearPersonal)
router.patch('/personal/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.actualizarPersonal)
router.delete('/personal/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.eliminarPersonal)

// ─── Puestos (puntos de vigilancia dentro de una comunidad) ───────────────
router.get('/puestos', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE'), ctrl.listarPuestos)
router.post('/puestos', requireRole('SUPERADMIN', 'ADMIN'), ctrl.crearPuesto)
router.patch('/puestos/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.actualizarPuesto)
router.delete('/puestos/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.eliminarPuesto)
router.get('/puestos/:id/checkpoints', requireRole('SUPERADMIN', 'ADMIN'), ctrl.getPuestoCheckpoints)
router.post('/puestos/:id/checkpoints', requireRole('SUPERADMIN', 'ADMIN'), ctrl.setPuestoCheckpoints)

// ─── Plano de planta del puesto ───────────────────────────────────────────────
router.get('/puestos/:id/plano', requireRole('SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'GUARDIA'), ctrl.getPuestoPlano)
router.post('/puestos/:id/plano', requireRole('SUPERADMIN', 'ADMIN'), ctrl.uploadPuestoPlano)
router.post('/puestos/:id/plano/calibrate', requireRole('SUPERADMIN', 'ADMIN'), ctrl.calibratePuestoPlano)
router.get('/puestos/:id/plano/checkpoints', requireRole('SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'GUARDIA'), ctrl.getPuestoPlanoCheckpoints)
router.post('/puestos/:id/plano/checkpoints', requireRole('SUPERADMIN', 'ADMIN'), ctrl.setPuestoPlanoCheckpoint)
router.post('/puestos/:id/plano/json', requireRole('SUPERADMIN', 'ADMIN'), ctrl.savePuestoPlanoJson)

// ─── Rutas de ronda (lectura: guardia/supervisor también necesitan ver las rutas) ──
router.get('/rutas', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE', 'SUPERVISOR', 'GUARDIA'), ctrl.listarRutas)
router.get('/rutas/:id', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE', 'SUPERVISOR', 'GUARDIA'), ctrl.obtenerRuta)
router.post('/rutas', requireRole('SUPERADMIN', 'ADMIN'), ctrl.crearRuta)
router.patch('/rutas/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.actualizarRuta)
router.delete('/rutas/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.eliminarRuta)

// ─── Checkpoints ───────────────────────────────────────────────────────────
router.get('/rutas/:rutaId/checkpoints', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE', 'CUADRANTE', 'SUPERVISOR', 'GUARDIA'), ctrl.listarCheckpoints)
router.post('/rutas/:rutaId/checkpoints', requireRole('SUPERADMIN', 'ADMIN'), ctrl.crearCheckpoint)
router.patch('/checkpoints/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.actualizarCheckpoint)
router.delete('/checkpoints/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.eliminarCheckpoint)
router.get('/checkpoints/:id/qr', requireRole('SUPERADMIN', 'ADMIN'), ctrl.obtenerCheckpointQR)
router.get('/checkpoints/:id/campos', requireRole('SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'GUARDIA'), ctrl.getCamposCheckpoint)
router.post('/checkpoints/:id/campos', requireRole('SUPERADMIN', 'ADMIN'), ctrl.setCamposCheckpoint)

// ─── Visitas — respuestas de formulario ─────────────────────────────────
router.get('/visitas/:id/respuestas', requireRole('SUPERADMIN', 'ADMIN', 'SUPERVISOR'), ctrl.getRespuestasVisita)
router.post('/visitas/:id/respuestas', ctrl.guardarRespuestasVisita)

// ─── Programaciones de ronda ───────────────────────────────────────────
router.get('/programaciones', requireRole('SUPERADMIN', 'ADMIN'), ctrl.listarProgramaciones)
router.post('/programaciones', requireRole('SUPERADMIN', 'ADMIN'), ctrl.crearProgramacion)
router.patch('/programaciones/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.actualizarProgramacion)
router.delete('/programaciones/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.eliminarProgramacion)
router.get('/programaciones/alertas', requireRole('SUPERADMIN', 'ADMIN'), ctrl.listarAlertasRonda)
router.get('/programaciones/verificar', requireRole('SUPERADMIN', 'ADMIN'), ctrl.verificarProgramaciones)

// ─── Ejecución de rondas (guardia/supervisor) ────────────────────────────
router.post('/iniciar', ctrl.iniciarRonda)
router.post('/marcar', ctrl.marcarCheckpoint)
router.post('/finalizar/:ejecucionId', ctrl.finalizarRonda)
router.get('/activa', ctrl.rondaActiva)

// ─── Historial y monitoreo (admin) ─────────────────────────────────────────
router.get('/en-curso', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE', 'SUPERVISOR'), ctrl.rondasEnCurso)
router.get('/ejecuciones', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE', 'SUPERVISOR'), ctrl.listarEjecuciones)
router.get('/ejecuciones/:id', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE', 'SUPERVISOR'), ctrl.detalleEjecucion)
router.get('/ejecuciones/:id/gps-track', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE', 'SUPERVISOR'), ctrl.getGpsTrack)
router.get('/ejecuciones/:id/pdf', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE', 'SUPERVISOR'), ctrl.exportarPDF)
router.delete('/ejecuciones/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.eliminarEjecucion)
router.get('/estadisticas', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE', 'SUPERVISOR'), ctrl.estadisticas)

// ─── Gestión de Tarjetas NFC ────────────────────────────────────────────────
router.get('/nfc',              requireRole('SUPERADMIN', 'ADMIN'), ctrl.listarNFCHandler)
router.post('/nfc',             requireRole('SUPERADMIN', 'ADMIN'), ctrl.crearNFCHandler)
router.patch('/nfc/:id',        requireRole('SUPERADMIN', 'ADMIN'), ctrl.actualizarNFCHandler)
router.delete('/nfc/:id',       requireRole('SUPERADMIN', 'ADMIN'), ctrl.eliminarNFCHandler)

export default router
