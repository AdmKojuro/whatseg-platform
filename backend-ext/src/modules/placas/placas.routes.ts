import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import * as ctrl from './placas.controller'

const router = Router()

// Interna: vision service POST alertas sin auth
router.post('/alerta', ctrl.recibirAlertaHandler)

router.use(authMiddleware)

// Lista negra
router.get('/denegadas', ctrl.listarDenegadasHandler)
router.post('/denegadas', ctrl.crearDenegadaHandler)
router.patch('/denegadas/:id', ctrl.actualizarDenegadaHandler)
router.delete('/denegadas/:id', ctrl.eliminarDenegadaHandler)
router.post('/denegadas/sync-vision', ctrl.syncVisionHandler)

// Alertas
router.get('/alertas', ctrl.listarAlertasHandler)
router.patch('/alertas/:id/reconocer', ctrl.reconocerAlertaHandler)

export default router
