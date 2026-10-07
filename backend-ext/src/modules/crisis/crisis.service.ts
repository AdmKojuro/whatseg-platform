import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { Server } from 'http'
import jwt from 'jsonwebtoken'
import { ENV } from '../../shared/config/env'

/**
 * Sala de crisis virtual — señalización WebRTC peer-to-peer.
 * El servidor solo retransmite mensajes entre participantes (no media).
 *
 * Protocolo:
 *   JOIN  { type:'join',  room_id, user_id, rol }
 *   OFFER { type:'offer', room_id, to, sdp }
 *   ANSWER{ type:'answer',room_id, to, sdp }
 *   ICE   { type:'ice',   room_id, to, candidate }
 *   LEAVE { type:'leave', room_id }
 */

interface Participant {
  ws: WebSocket
  user_id: string
  rol: string
  room_id: string
}

const rooms = new Map<string, Map<string, Participant>>() // room_id → Map<user_id, Participant>

export function initCrisisSignaling(_server: Server) {
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://localhost`)
    const token = url.searchParams.get('token') ?? ''
    let userId = 'anon'
    let userRol = 'UNKNOWN'
    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as { sub: string; rol: string }
      userId = decoded.sub
      userRol = decoded.rol
    } catch {
      ws.close(4001, 'Token inválido')
      return
    }

    let currentRoom: string | null = null

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        const { type, room_id } = msg

        if (type === 'join' && room_id) {
          currentRoom = room_id
          if (!rooms.has(room_id)) rooms.set(room_id, new Map())
          const room = rooms.get(room_id)!
          room.set(userId, { ws, user_id: userId, rol: userRol, room_id })

          // Notificar a los demás participantes
          broadcast(room_id, userId, {
            type: 'participant_joined',
            user_id: userId, rol: userRol,
            participants: [...room.keys()],
          })
          return
        }

        if (!currentRoom) return

        if (type === 'offer' || type === 'answer' || type === 'ice') {
          const target = msg.to
          const room = rooms.get(currentRoom)
          const peer = room?.get(target)
          if (peer?.ws.readyState === WebSocket.OPEN) {
            peer.ws.send(JSON.stringify({ ...msg, from: userId }))
          }
          return
        }

        if (type === 'leave') {
          leaveRoom(currentRoom, userId)
          currentRoom = null
        }

      } catch { /* malformed message */ }
    })

    ws.on('close', () => {
      if (currentRoom) leaveRoom(currentRoom, userId)
    })
  })

  return wss
}

function leaveRoom(room_id: string, user_id: string) {
  const room = rooms.get(room_id)
  if (!room) return
  room.delete(user_id)
  if (room.size === 0) {
    rooms.delete(room_id)
  } else {
    broadcast(room_id, user_id, { type: 'participant_left', user_id, participants: [...room.keys()] })
  }
}

function broadcast(room_id: string, from_id: string, payload: object) {
  const room = rooms.get(room_id)
  if (!room) return
  const msg = JSON.stringify(payload)
  room.forEach((p, uid) => {
    if (uid !== from_id && p.ws.readyState === WebSocket.OPEN) p.ws.send(msg)
  })
}

export function getRooms() {
  return [...rooms.entries()].map(([room_id, participants]) => ({
    room_id,
    participants: [...participants.values()].map(p => ({ user_id: p.user_id, rol: p.rol })),
  }))
}
