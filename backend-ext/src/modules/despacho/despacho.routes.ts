import { Router } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './despacho.controller'

const router = Router()
router.use(authMiddleware)

router.get('/', ctrl.listarHandler)
router.post('/', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE'), ctrl.crearHandler)
router.get('/:id', ctrl.obtenerHandler)
router.patch('/:id/estado', ctrl.actualizarEstadoHandler)
router.get('/cuadrante/:id', ctrl.porCuadranteHandler)

export default router
