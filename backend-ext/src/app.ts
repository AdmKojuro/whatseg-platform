import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import path from 'path'

import { errorHandler } from './shared/middleware/error.middleware'

import zonasRouter from './modules/zonas/zonas.routes'
import visitasRouter from './modules/visitas/visitas.routes'
import evidenciaRouter from './modules/evidencia/evidencia.routes'
import analiticaRouter from './modules/analitica/analitica.routes'
import panelRouter from './modules/panel-policial/panel.routes'
import expedientesRouter from './modules/expedientes/expedientes.routes'
import despachoRouter from './modules/despacho/despacho.routes'
import alertasIARouter from './modules/alertas-ia/alertas-ia.routes'
import visionBridgeRouter from './modules/vision-bridge/vision-bridge.routes'
import placasRouter from './modules/placas/placas.routes'
import guardiaRouter from './modules/guardia/guardia.routes'
import comportamientoRouter from './modules/comportamiento/comportamiento.routes'
import prediccionRouter from './modules/prediccion/prediccion.routes'
import crisisRouter from './modules/crisis/crisis.routes'
import federacionRouter from './modules/federacion/federacion.routes'
import rondasRouter from './modules/rondas/rondas.routes'
import modulosRouter from './modules/modulos/modulos.routes'
import reportesPttRouter from './modules/reportes-ptt/reportes-ptt.routes'
import asistenteRouter from './modules/asistente/asistente.routes'
import botonRouter from './modules/boton/boton.routes'
import soporteRouter from './modules/soporte/soporte.routes'
import incidentesRouter from './modules/incidentes/incidentes.routes'
import cuadranteAppRouter from './modules/cuadrante-app/cuadrante-app.routes'
import adminAppRouter from './modules/admin-app/admin-app.routes'
import videoporteroRouter from './modules/videoportero/videoportero.routes'
import ezcloudRouter from './modules/ezcloud/ezcloud.routes'
import domoticaWaRouter from './modules/domotica-wa/domotica-wa.routes'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)  // confiar en el proxy nginx

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({ origin: '*' }))
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(morgan('dev'))

  app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true }))

  // Archivos estáticos — fotos de checkpoints y otros uploads
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), { maxAge: '7d' }))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'whatseg-backend-ext', version: '1.0.0' })
  })

  // Módulos del backend-ext (prefijo /ext)
  app.use('/ext/zonas', zonasRouter)
  app.use('/ext/visitas', visitasRouter)
  app.use('/ext/evidencia', evidenciaRouter)
  app.use('/ext/analitica', analiticaRouter)
  app.use('/ext/panel', panelRouter)
  app.use('/ext/expedientes', expedientesRouter)
  app.use('/ext/despacho', despachoRouter)
  app.use('/ext/alertas-ia', alertasIARouter)
  app.use('/ext/vision', visionBridgeRouter)
  app.use('/ext/placas', placasRouter)
  app.use('/ext/guardia', guardiaRouter)
  app.use('/ext/comportamiento', comportamientoRouter)
  app.use('/ext/prediccion', prediccionRouter)
  app.use('/ext/crisis', crisisRouter)
  app.use('/ext/federacion', federacionRouter)
  app.use('/ext/rondas', rondasRouter)
  app.use('/ext/modulos', modulosRouter)
  app.use('/ext/reportes-ptt', reportesPttRouter)
  app.use('/ext/asistente', asistenteRouter)
  app.use('/ext/boton', botonRouter)
  app.use('/ext/soporte', soporteRouter)
  app.use('/ext/incidentes', incidentesRouter)
  app.use('/ext/cuadrante-app', cuadranteAppRouter)
  app.use('/ext/admin-app', adminAppRouter)
  app.use('/ext/videoportero', videoporteroRouter)
  app.use('/ext/ezcloud', ezcloudRouter)
  app.use('/ext/domotica-wa', domoticaWaRouter)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'whatseg-backend-ext', version: '2.0.0' })
  })

  app.use(errorHandler)

  return app
}
