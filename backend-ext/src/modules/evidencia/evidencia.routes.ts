import { Router } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './evidencia.controller'

const router = Router()
router.use(authMiddleware)

router.post('/', ctrl.registrarHandler)
router.get('/:id/verificar', ctrl.verificarHandler)
router.get('/activacion/:id', ctrl.listarPorActivacionHandler)
router.get('/alerta/:id', ctrl.listarPorAlertaHandler)
router.post('/exportar', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE'), ctrl.exportarHandler)

export default router
