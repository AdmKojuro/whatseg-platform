export interface Dispositivo {
  id: string
  tuya_id?: string
  thinmoo_dev_sn?: string
  thinmoo_community_id?: string
  id_interno?: string
  nombre?: string
  tipo?: string
  categoria?: string
  parametros_activar?: Record<string, unknown> | null
  parametros_desactivar?: Record<string, unknown> | null
  comunidad_id?: string
  cuenta_tuya_id?: string
  cuenta_thinmoo_id?: string
  camara_id?: string
  dolynk_device_id?: string
  dolynk_channel_id?: string
  cuenta_dolynk_id?: string
  url_rtsp?: string
  url_http?: string
  imou_device_id?: string
  imou_channel_id?: string
  cuenta_imou_id?: string
  camara_dispositivo_id?: string
  mqtt_kind?: string
  mqtt_device_id?: string
  mqtt_channel?: number
  mqtt_last_seen?: string
  ezcloud_serial?: string
  ezcloud_channel?: string
  cuenta_ezcloud_id?: string
  configurado: boolean
  online: boolean
  created_at: string
  updated_at: string
  comunidad?: { id: string; nombre: string; codigo: string }
  camara?: { id: string; nombre: string }
}

export interface TipoDispositivo {
  id: string
  nombre: string
  modo_activacion: string
  created_at: string
}

export function getPlataforma(d: Dispositivo): string {
  if (d.tuya_id) return 'Tuya'
  if (d.thinmoo_dev_sn) return 'Thinmoo'
  if (d.dolynk_device_id) return 'Dolynk'
  if (d.imou_device_id) return 'Imou'
  if (d.mqtt_kind) return 'MQTT'
  if (d.id_interno?.startsWith('ezcloud:')) return 'EZCloud (UNV)'
  return 'Desconocido'
}
