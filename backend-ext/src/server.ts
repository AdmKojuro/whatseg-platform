import 'dotenv/config'
import http from 'http'
import { ENV } from './shared/config/env'
import { createApp } from './app'
import { prisma } from './shared/config/prisma'
import { initCrisisSignaling } from './modules/crisis/crisis.service'
import { iniciarMonitoreo } from './modules/guardia/guardia.service'
import { syncConVision } from './modules/placas/placas.service'
import { iniciarAutoProcess, iniciarSchedulerComunicados } from './modules/asistente/asistente.service'
import { initBotonWs } from './modules/boton/boton.ws'
import { initBotonWA } from './modules/soporte/soporte.wa'
import { initRondasWs } from './modules/rondas/rondas.ws'
import jwt from 'jsonwebtoken'

async function main() {
  const app = createApp()

  // Usar http.Server para montar WebSocket de crisis y botón de pánico sobre el mismo puerto
  const server = http.createServer(app)
  const wssCrisis = initCrisisSignaling(server)
  const wssBoton  = initBotonWs()
  const wssRondas = initRondasWs(server)

  // Enrutar manualmente los upgrades para evitar que el primer WS rechace paths del segundo
  server.on('upgrade', (req, socket, head) => {
    const url      = new URL(req.url!, 'http://localhost')
    const pathname = url.pathname
    if (pathname === '/ws/crisis') {
      wssCrisis.handleUpgrade(req, socket, head, (ws) => wssCrisis.emit('connection', ws, req))
    } else if (pathname === '/ws/boton') {
      wssBoton.handleUpgrade(req, socket, head, (ws) => wssBoton.emit('connection', ws, req))
    } else if (pathname === '/ws/rondas') {
      // Verificar JWT del guardia o admin
      const token = url.searchParams.get('token') || ''
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!)
        wssRondas.handleUpgrade(req, socket, head, (ws) => wssRondas.emit('connection', ws, req, payload))
      } catch { socket.destroy() }
    } else {
      socket.destroy()
    }
  })

  await prisma.$connect()
  console.log('[DB] Conectado a PostgreSQL')

  server.listen(ENV.PORT_EXT, async () => {
    console.log(`[SERVER] WhatsEg Backend-Ext v2.0 en http://localhost:${ENV.PORT_EXT}`)
    console.log(`[CRISIS] WebSocket señalización en ws://localhost:${ENV.PORT_EXT}/ws/crisis`)

    // Iniciar dead-man switch para guardias activos
    await iniciarMonitoreo()
    console.log('[GUARDIA] Dead-man switch activo')

    // Sincronizar lista negra de placas con vision service (si está corriendo)
    await syncConVision()
    console.log('[ALPR] Lista negra sincronizada con vision service')

    // Iniciar auto-procesamiento IA de reportes PTT
    iniciarAutoProcess(30_000)

    // Iniciar scheduler de comunicados programados
    iniciarSchedulerComunicados(60_000)

    // Iniciar WhatsApp Soporte Bilingüe (Baileys)
    initBotonWA().catch(e => console.error('[SOPORTE-WA] Init error:', e.message))
    console.log('[SOPORTE-WA] Iniciando conexión WhatsApp…')
  })
}

main().catch((err) => {
  console.error('[FATAL]', err)
  process.exit(1)
})
