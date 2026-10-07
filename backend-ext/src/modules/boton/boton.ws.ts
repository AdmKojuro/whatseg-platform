import { WebSocket, WebSocketServer } from 'ws'
import { Server } from 'http'
import { IncomingMessage } from 'http'
import jwt from 'jsonwebtoken'
import { ENV } from '../../shared/config/env'

const panelClients = new Set<WebSocket>()

export function initBotonWs() {
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://localhost`)
    const token = url.searchParams.get('token') ?? ''

    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as { sub: string; rol: string }
      const allowedRoles = ['ADMIN', 'SUPERVISOR', 'SUPERADMIN']
      if (!allowedRoles.includes(decoded.rol)) {
        ws.close(4003, 'Rol no autorizado')
        return
      }
    } catch {
      ws.close(4001, 'Token inválido')
      return
    }

    panelClients.add(ws)
    ws.send(JSON.stringify({ type: 'connected', panelClients: panelClients.size }))

    // Keepalive ping cada 30s
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping()
      else clearInterval(interval)
    }, 30_000)

    ws.on('pong', () => { /* vivo */ })

    ws.on('close', () => {
      panelClients.delete(ws)
      clearInterval(interval)
    })

    ws.on('error', () => {
      panelClients.delete(ws)
      clearInterval(interval)
    })
  })

  console.log('[BOTON] WebSocket panel activo en /ws/boton')
  return wss
}

export function broadcastEvento(evento: any) {
  if (panelClients.size === 0) return
  const payload = JSON.stringify({ type: 'nuevo_evento', evento })
  for (const c of panelClients) {
    if (c.readyState === WebSocket.OPEN) c.send(payload)
  }
}

export function broadcastUpdate(eventoId: string, cambios: any) {
  if (panelClients.size === 0) return
  const payload = JSON.stringify({ type: 'evento_actualizado', eventoId, cambios })
  for (const c of panelClients) {
    if (c.readyState === WebSocket.OPEN) c.send(payload)
  }
}

export function getPanelClientsCount() {
  return panelClients.size
}
