import { Router } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './soporte.controller'

const router = Router()

// ─── Stats y utilidades ────────────────────────────────────────────────────────
router.get('/stats',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.statsCasos)

router.get('/comunidades',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.listarComunidades)

// ─── Casos ─────────────────────────────────────────────────────────────────────
router.get('/casos',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.listarCasos)

router.post('/casos',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.crearCaso)

router.get('/casos/:id',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.obtenerCaso)

router.put('/casos/:id/atender',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.atenderCaso)

router.put('/casos/:id/cerrar',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.cerrarCaso)

router.put('/casos/:id/reabrir',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.reabrirCaso)

router.delete('/casos/:id',
  authMiddleware,
  requireRole('ADMIN', 'SUPERADMIN'),
  ctrl.eliminarCaso)

// ─── Mensajes ──────────────────────────────────────────────────────────────────
router.get('/casos/:id/mensajes',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.listarMensajes)

router.post('/casos/:id/mensajes',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.crearMensaje)

router.delete('/casos/:id/mensajes/:msgId',
  authMiddleware,
  requireRole('ADMIN', 'SUPERADMIN'),
  ctrl.eliminarMensaje)

// ─── WhatsApp ──────────────────────────────────────────────────────────────────
router.get('/wa/status',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.waStatus)

router.post('/casos/:id/enviar-wa',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.waSend)

router.post('/wa/logout',
  authMiddleware,
  requireRole('ADMIN', 'SUPERADMIN'),
  ctrl.waLogout)

router.post('/wa/init',
  authMiddleware,
  requireRole('ADMIN', 'SUPERADMIN'),
  ctrl.waInit)

export default router
