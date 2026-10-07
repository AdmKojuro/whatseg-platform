import { Router } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './panel.controller'

const router = Router()
router.use(authMiddleware)
router.use(requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE'))

router.get('/alertas-activas', ctrl.alertasActivasHandler)
router.get('/despachos-activos', ctrl.despachosActivosHandler)
router.get('/metricas', ctrl.metricasHandler)
router.get('/exportar-sies', ctrl.exportarSiesHandler)

export default router
