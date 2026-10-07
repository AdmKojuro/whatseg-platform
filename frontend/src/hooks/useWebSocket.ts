import { useEffect, useRef, useState, useCallback } from 'react'
import { STORAGE_KEYS } from '../config/constants'

interface UseWebSocketOptions {
  onMessage?: (data: unknown) => void
  enabled?: boolean
}

export function useWebSocket({ onMessage, enabled = true }: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const connect = useCallback(() => {
    if (!enabled) return

    const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
    if (!token) return

    const wsBase = import.meta.env.VITE_WS_BASE_URL || `ws://${window.location.host}`
    const ws = new WebSocket(`${wsBase}/api/monitor-ws?token=${token}`)

    ws.onopen = () => setIsConnected(true)
    ws.onclose = () => {
      setIsConnected(false)
      reconnectTimeout.current = setTimeout(connect, 5000)
    }
    ws.onerror = () => ws.close()
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage?.(data)
      } catch { /* ignore parse errors */ }
    }

    wsRef.current = ws
  }, [enabled, onMessage])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimeout.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { isConnected }
}
