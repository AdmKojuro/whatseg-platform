export interface MqttDriver {
  kind: string
  label: string
  description: string
}

export interface MqttDeviceChannel {
  id: string
  channel: number
  nombre: string | null
  tipo: string | null
  online: boolean
}

export interface MqttDevice {
  kind: string
  device_id: string
  // backend returns channels[] (MqttDeviceGroup format)
  channels?: MqttDeviceChannel[]
  // legacy fields kept for register form
  relay_count?: number
  nombres?: string[]
  tipos?: string[]
  online: boolean
  last_seen?: string
  comunidad?: { id: string; nombre: string; codigo: string } | null
}

export interface RegisterMqttDeviceInput {
  kind: string
  device_id: string
  comunidad_id?: string
  relay_count: number
  nombres: string[]
  tipos: string[]
}

export interface BrokerStatus {
  connected: boolean
  url: string
}
