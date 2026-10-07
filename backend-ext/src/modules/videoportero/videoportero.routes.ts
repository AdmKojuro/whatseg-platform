import { Router } from 'express'
import multer from 'multer'
import os from 'os'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './videoportero.controller'
import { runCodigosAccesoMigrations } from './videoportero.repository'

const router = Router()

// Migración idempotente: añade max_usos/usos_actuales si la columna no existe aún
runCodigosAccesoMigrations().catch((e) => console.error('[VP migrations]', e))

// Temporary disk storage; subirFotoResidente moves file to final location
const upload = multer({ dest: os.tmpdir() })

// ─── Perfil ───────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, ctrl.getMe)

// ─── Unidades ─────────────────────────────────────────────────────────────────
router.get('/unidades', authMiddleware, ctrl.listarUnidades)
router.post('/unidades', authMiddleware, requireRole('SUPERADMIN'), ctrl.crearUnidad)
router.get('/unidades/:id', authMiddleware, ctrl.getUnidad)
router.put('/unidades/:id/config', authMiddleware, requireRole('SUPERADMIN'), ctrl.actualizarConfig)
router.get('/unidades/:id/admin', authMiddleware, requireRole('SUPERADMIN'), ctrl.getAdminDeUnidad)
router.get('/unidades/:id/permisos', authMiddleware, requireRole('SUPERADMIN'), ctrl.getPermisos)
router.put('/unidades/:id/permisos', authMiddleware, requireRole('SUPERADMIN'), ctrl.actualizarPermisos)

// ─── Torres ───────────────────────────────────────────────────────────────────
router.get('/torres', authMiddleware, ctrl.listarTorres)
router.post('/torres', authMiddleware, ctrl.crearTorre)
router.put('/torres/:id', authMiddleware, ctrl.actualizarTorre)
router.delete('/torres/:id', authMiddleware, ctrl.eliminarTorre)

// ─── Apartamentos ─────────────────────────────────────────────────────────────
router.get('/apartamentos', authMiddleware, ctrl.listarApartamentos)
router.post('/apartamentos', authMiddleware, ctrl.crearApartamento)
router.put('/apartamentos/:id', authMiddleware, ctrl.actualizarApartamento)
router.delete('/apartamentos/:id', authMiddleware, ctrl.eliminarApartamento)

// ─── Residentes ───────────────────────────────────────────────────────────────
router.get('/residentes', authMiddleware, ctrl.listarResidentes)
router.post('/residentes', authMiddleware, ctrl.crearResidente)
router.put('/residentes/:id', authMiddleware, ctrl.actualizarResidente)
router.delete('/residentes/:id', authMiddleware, ctrl.eliminarResidente)
router.put('/residentes/:id/photo', authMiddleware, upload.single('photo'), ctrl.subirFotoResidente)

// ─── Llamadas ─────────────────────────────────────────────────────────────────
router.get('/llamadas', authMiddleware, ctrl.listarLlamadas)
router.post('/llamadas', ctrl.crearLlamada)   // público: lo llama la tablet

// ─── Endpoints para la tablet (API key) ──────────────────────────────────────
router.get('/unidades-tablet', ctrl.listarUnidadesTablet)
router.get('/unit-config', ctrl.getUnitConfig)
router.get('/residents-by-apartment', ctrl.getResidentsByApartment)
router.post('/llamadas-tablet', ctrl.crearLlamadaTablet)
router.put('/llamadas/:id/visitor-photo', ctrl.actualizarFotoLlamada)
router.post('/encomiendas', ctrl.crearEncomiendaTablet)

// ─── Reconocimiento facial (autenticados con API key de la tablet) ────────────
router.get('/face-config', ctrl.getFaceConfig)
router.get('/face-data', ctrl.getFaceData)
router.put('/residentes/:id/embedding', ctrl.subirEmbeddingResidente)

// ─── Dispositivos / Relays ────────────────────────────────────────────────────
router.get('/dispositivos', authMiddleware, ctrl.listarDispositivos)
router.post('/dispositivos', authMiddleware, requireRole('SUPERADMIN'), ctrl.crearDispositivo)
router.put('/dispositivos/:id', authMiddleware, requireRole('SUPERADMIN'), ctrl.actualizarDispositivo)
router.delete('/dispositivos/:id', authMiddleware, requireRole('SUPERADMIN'), ctrl.eliminarDispositivo)
router.post('/trigger-relay', ctrl.triggerRelayTablet)   // público: API key de tablet

// ─── Historial VideoPortero ────────────────────────────────────────────────────
router.post('/historial-vp', ctrl.crearHistorialVpHandler)          // público: API key de tablet
router.get('/historial-vp', authMiddleware, ctrl.listarHistorialVpHandler)

// ─── Códigos de acceso para visitas (QR + PIN) ────────────────────────────────
router.post('/codigos-acceso/validar', ctrl.validarCodigoAccesoHandler)          // público: API key de tablet
router.post('/codigos-acceso', authMiddleware, ctrl.crearCodigoAccesoHandler)
router.get('/codigos-acceso', authMiddleware, ctrl.listarCodigosAccesoHandler)
router.get('/codigos-acceso/:id', authMiddleware, ctrl.obtenerCodigoAccesoHandler)
router.post('/codigos-acceso/:id/salida', authMiddleware, ctrl.registrarSalidaHandler)
router.delete('/codigos-acceso/:id', authMiddleware, ctrl.revocarCodigoAccesoHandler)

export default router
