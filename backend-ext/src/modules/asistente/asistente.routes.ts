import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import * as ctrl from './asistente.controller'

const router = Router()

// Health check de IA (sin auth para monitoreo)
router.get('/health', ctrl.health)

// Todo lo demás requiere JWT
router.use(authMiddleware)

// Reportes con datos IA
router.get('/reportes', ctrl.listarReportes)

// Datos IA de un reporte específico
router.get('/reportes/:id/ia', ctrl.obtenerIA)

// Procesar manualmente un reporte
router.post('/procesar/:id', ctrl.procesarReporte)

// Chatbot (SSE streaming)
router.post('/chat', ctrl.chat)

// Comunicados programados
router.get('/comunicados', ctrl.listarComunicados)
router.post('/comunicados', ctrl.crearComunicado)
router.put('/comunicados/:id', ctrl.editarComunicado)
router.delete('/comunicados/:id', ctrl.borrarComunicado)
router.post('/comunicados/:id/enviar-ahora', ctrl.enviarAhora)

export default router
