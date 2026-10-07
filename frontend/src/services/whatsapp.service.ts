import api from './api'

export interface WaStatus {
  status: 'connected' | 'connecting' | 'disconnected'
  phone?: string
  qrDataUrl?: string | null
}

export interface WaConversacion {
  celular: string
  nombre?: string
  ultima_fecha: string
  ultimo_mensaje: string
  ultima_direccion: string
}

export interface WaMensaje {
  id: string
  texto: string
  direccion: 'IN' | 'OUT'
  media_url?: string
  created_at: string
}

const BASE = '/ext/domotica-wa'

export const whatsappService = {
  status: () => api.get<WaStatus>(`${BASE}/status`),
  logout: () => api.post(`${BASE}/logout`),
  conversaciones: () => api.get<WaConversacion[]>(`${BASE}/conversaciones`),
  mensajes: (celular: string) =>
    api.get<WaMensaje[]>(`${BASE}/conversaciones/${encodeURIComponent(celular)}/mensajes`),
}
