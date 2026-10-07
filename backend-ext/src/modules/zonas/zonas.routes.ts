import { Router } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './zonas.controller'

const router = Router()
router.use(authMiddleware)

router.get('/', ctrl.listarHandler)
router.post('/', requireRole('SUPERADMIN', 'ADMIN'), ctrl.crearHandler)
router.get('/:id', ctrl.obtenerPorIdHandler)
router.put('/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.actualizarHandler)
router.delete('/:id', requireRole('SUPERADMIN'), ctrl.eliminarHandler)
router.post('/:id/comunidades', requireRole('SUPERADMIN', 'ADMIN'), ctrl.asignarComunidadHandler)
router.delete('/:id/comunidades/:comunidadId', requireRole('SUPERADMIN', 'ADMIN'), ctrl.desasignarComunidadHandler)
router.get('/:id/mapa-calor', ctrl.mapaCalorHandler)

export default router
