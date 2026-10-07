import { Router } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './boton.controller'

const router = Router()

// Auth particulares (pública)
router.post('/auth/login', ctrl.loginParticular)

// ─── Eventos ─────────────────────────────────────────────────────────────────
// Cualquier usuario autenticado puede crear un evento (guardia o particular)
router.post('/eventos', authMiddleware, ctrl.crearEvento)

// Consulta y gestión solo para personal de monitoreo
router.get('/eventos',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.listarEventos)

router.get('/eventos/:id',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.obtenerEvento)

router.put('/eventos/:id/atender',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.atenderEvento)

router.put('/eventos/:id/cerrar',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN'),
  ctrl.cerrarEvento)

router.delete('/eventos/:id',
  authMiddleware,
  requireRole('ADMIN', 'SUPERADMIN'),
  ctrl.eliminarEvento)

// ─── Particulares ─────────────────────────────────────────────────────────────
router.get('/particulares',
  authMiddleware,
  requireRole('ADMIN', 'SUPERADMIN'),
  ctrl.listarParticulares)

router.post('/particulares',
  authMiddleware,
  requireRole('ADMIN', 'SUPERADMIN'),
  ctrl.crearParticular)

router.put('/particulares/:id',
  authMiddleware,
  requireRole('ADMIN', 'SUPERADMIN'),
  ctrl.actualizarParticular)

router.delete('/particulares/:id',
  authMiddleware,
  requireRole('ADMIN', 'SUPERADMIN'),
  ctrl.eliminarParticular)

// ─── Mapa ─────────────────────────────────────────────────────────────────────
router.get('/mapa-data',
  authMiddleware,
  requireRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN', 'COMANDANTE'),
  ctrl.mapaData)

export default router
