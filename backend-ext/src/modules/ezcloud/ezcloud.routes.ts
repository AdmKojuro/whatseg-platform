import { Router } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './ezcloud.controller'

const router = Router()

// Cuentas EZCloud — solo SUPERADMIN puede crear/editar/eliminar
router.get('/cuentas', authMiddleware, ctrl.listarCuentasHandler)
router.post('/cuentas', authMiddleware, requireRole('SUPERADMIN'), ctrl.crearCuentaHandler)
router.put('/cuentas/:id', authMiddleware, requireRole('SUPERADMIN'), ctrl.actualizarCuentaHandler)
router.delete('/cuentas/:id', authMiddleware, requireRole('SUPERADMIN'), ctrl.eliminarCuentaHandler)

// Sincronización — SUPERADMIN o ADMIN
router.post('/sync', authMiddleware, requireRole('SUPERADMIN', 'ADMIN'), ctrl.syncHandler)

// Stream y snapshot (autenticados)
router.get('/stream/:serial', authMiddleware, ctrl.streamHandler)
router.get('/snapshot/:serial/:channel', authMiddleware, ctrl.snapshotHandler)
router.get('/snapshot/:serial', authMiddleware, ctrl.snapshotHandler)

export default router
