export interface Visita {
  id: string
  nombre: string
  documento?: string
  motivo?: string
  comunidad_id: string
  qr_token: string
  qr_usado: boolean
  foto_path?: string
  valido_desde: string
  valido_hasta: string
  created_by: string
  created_at: string
  usado_at?: string
  portero_id?: string
  qr_base64?: string
}

export interface CreateVisitaInput {
  nombre: string
  documento?: string
  motivo?: string
  comunidad_id: string
  valido_desde: string
  valido_hasta: string
}
