import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import * as ctrl from './analitica.controller'

const router = Router()
router.use(authMiddleware)

router.get('/mapa-calor', ctrl.mapaCalorHandler)
router.get('/patrones', ctrl.patronesHandler)
router.get('/tendencias', ctrl.tendenciasHandler)
router.get('/ranking', ctrl.rankingHandler)

export default router
