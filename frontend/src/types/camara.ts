export interface Camara {
  id: string
  nombre: string
  tipo: string
  url_rtsp?: string
  url_http?: string
  dolynk_device_id?: string
  dolynk_channel_id?: string
  cuenta_dolynk_id?: string
  comunidad_id?: string
  activa: boolean
  created_at: string
  updated_at: string
  comunidad?: { id: string; nombre: string }
}
