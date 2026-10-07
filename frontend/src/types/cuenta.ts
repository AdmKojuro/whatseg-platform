export interface CuentaTuya {
  id: string
  nombre: string
  client_id: string
  secret: string
  base_url: string
  activa: boolean
  created_at: string
  updated_at: string
}

export interface CuentaThinmoo {
  id: string
  nombre: string
  app_id: string
  app_secret: string
  base_url: string
  webhook_secret?: string
  mqtt_broker_url?: string
  mqtt_username?: string
  mqtt_password?: string
  mqtt_enabled: boolean
  file_upload_secret?: string
  activa: boolean
  created_at: string
  updated_at: string
}

export interface CuentaDolynk {
  id: string
  nombre: string
  serial?: string
  access_key: string
  secret_access_key: string
  product_id: string
  base_url: string
  activa: boolean
  created_at: string
  updated_at: string
}

export interface CuentaImou {
  id: string
  nombre: string
  app_id: string
  app_secret: string
  base_url: string
  activa: boolean
  created_at: string
  updated_at: string
}
