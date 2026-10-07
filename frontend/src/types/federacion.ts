export interface FederacionPar {
  id: string
  nombre: string
  comunidad_local_id: string
  endpoint_remoto: string
  clave_compartida: string
  activa: boolean
  patrones_recibidos: number
  alertas_compartidas: number
  created_at: string
}

export interface PatronAnonimo {
  id: string
  federacion_id: string
  tipo: 'ROSTRO' | 'PLACA'
  tipo_patron: string
  nivel_alerta: 'ALTA' | 'MEDIA' | 'BAJA'
  reportes: number
  activo: boolean
  vector_ruidoso: number[]
  ultima_similitud?: number
  created_at: string
  federacion?: { nombre: string }
}

export interface AlertaComportamiento {
  id: string
  camera_id: string
  comunidad_id?: string
  tipo: 'MERODEO' | 'VIGILANCIA_ESTACIONARIA' | 'INTERCAMBIO_RAPIDO'
  descripcion: string
  duracion_seg?: number
  track_ids: string[]
  snapshot_path?: string
  reconocido: boolean
  reconocido_at?: string
  created_at: string
}
