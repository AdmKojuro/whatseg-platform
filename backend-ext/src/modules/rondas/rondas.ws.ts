import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import * as repo from './rondas.repository'

// ─── Clientes del panel (admin/supervisor — solo reciben) ─────────────────────
const panelClients = new Set<WebSocket>()

// ─── Checker de checkpoints perdidos (Feature 4) ──────────────────────────────
let _checkInterval: ReturnType<typeof setInterval> | null = null

function startMissedCheckpointChecker() {
  if (_checkInterval) return
  _checkInterval = setInterval(async () => {
    if (panelClients.size === 0) return
    try {
      const enCurso = await repo.rondasEnCurso()
      for (const ronda of enCurso) {
        const intervaloMs = ((ronda as any).ruta?.intervalo_min ?? 60) * 60_000
        const limite = intervaloMs * 1.5 // alertar tras 150% del intervalo sin actividad

        const visitas = (ronda as any).visitas as any[]
        const ultimaActividadAt = visitas.length > 0
          ? new Date(visitas[visitas.length - 1].marcado_at).getTime()
          : new Date((ronda as any).inicio_at).getTime()

        const atrasoMs = Date.now() - ultimaActividadAt
        if (atrasoMs < limite) continue

        const minAtraso = Math.round(atrasoMs / 60_000)
        const alerta = JSON.stringify({
          type:            'CHECKPOINT_ALERTA',
          ejecucion_id:    String((ronda as any).id),
          guardia_nombre:  (ronda as any).guardia_nombre ?? 'Guardia',
          ruta_nombre:     (ronda as any).ruta?.nombre ?? 'Ruta',
          minutos_atraso:  minAtraso,
          ts:              new Date().toISOString(),
        })

        for (const c of panelClients) {
          if (c.readyState === WebSocket.OPEN) c.send(alerta)
        }
      }
    } catch { /* silencioso */ }
  }, 60_000)
}

// ─── Inicialización ───────────────────────────────────────────────────────────

export function initRondasWs(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', (ws: WebSocket, _req: http.IncomingMessage, payload: any) => {
    const rol = payload?.rol as string | undefined

    if (rol === 'GUARDIA' || rol === 'SUPERVISOR') {
      // ── Guardia/Supervisor: envía posición GPS ───────────────────────────────
      console.log(`[RONDAS-WS] Guard conectado: ${payload?.nombre ?? payload?.sub}`)

      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(String(raw))
          if (msg.type !== 'GPS_UPDATE') return

          const { ejecucion_id, latitud, longitud, accuracy, heading } = msg
          if (!ejecucion_id || latitud == null || longitud == null) return

          // Guardar en BD
          await repo.guardarGPS({
            ejecucion_id,
            guardia_id: String(payload.sub),
            latitud:    Number(latitud),
            longitud:   Number(longitud),
            accuracy:   accuracy != null ? Number(accuracy) : null,
            heading:    heading  != null ? Number(heading)  : null,
          })

          // Broadcast al panel en tiempo real
          const out = JSON.stringify({
            type:           'GUARD_POSITION',
            guardia_id:     String(payload.sub),
            guardia_nombre: payload.nombre ?? 'Guardia',
            ejecucion_id,
            latitud:  Number(latitud),
            longitud: Number(longitud),
            heading:  heading != null ? Number(heading) : null,
            ts:       new Date().toISOString(),
          })
          for (const c of panelClients) {
            if (c.readyState === WebSocket.OPEN) c.send(out)
          }
        } catch { /* silencioso */ }
      })

      ws.on('close', () => {
        console.log(`[RONDAS-WS] Guard desconectado: ${payload?.nombre ?? payload?.sub}`)
      })

    } else {
      // ── Panel admin/supervisor: solo recibe broadcasts ──────────────────────
      panelClients.add(ws)
      console.log(`[RONDAS-WS] Panel conectado (${panelClients.size} activos)`)
      startMissedCheckpointChecker()

      ws.on('close', () => {
        panelClients.delete(ws)
        console.log(`[RONDAS-WS] Panel desconectado (${panelClients.size} activos)`)
        if (panelClients.size === 0 && _checkInterval) {
          clearInterval(_checkInterval)
          _checkInterval = null
        }
      })
    }
  })

  console.log('[RONDAS-WS] WebSocket GPS activo en /ws/rondas')
  return wss
}
