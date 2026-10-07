import { Router } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './domotica-wa.controller'

const router = Router()

router.get('/status',                       authMiddleware, requireRole('ADMIN', 'SUPERADMIN'), ctrl.waStatus)
router.post('/logout',                      authMiddleware, requireRole('ADMIN', 'SUPERADMIN'), ctrl.waLogout)
router.get('/conversaciones',               authMiddleware, requireRole('ADMIN', 'SUPERADMIN'), ctrl.listarConversaciones)
router.get('/conversaciones/:celular/mensajes', authMiddleware, requireRole('ADMIN', 'SUPERADMIN'), ctrl.listarMensajes)

export default router
