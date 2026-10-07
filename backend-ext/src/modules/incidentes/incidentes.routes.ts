import { Router } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './incidentes.controller'

const router = Router()

router.use(authMiddleware)
router.use(requireRole('SUPERADMIN', 'ADMIN'))

router.get('/',           ctrl.listarHandler)
router.post('/',          ctrl.crearHandler)
router.get('/:id',        ctrl.obtenerHandler)
router.patch('/:id',      ctrl.actualizarHandler)
router.delete('/:id',     ctrl.eliminarHandler)
router.get('/:id/timeline', ctrl.timelineHandler)

export default router
