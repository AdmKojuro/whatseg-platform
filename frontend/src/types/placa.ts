export interface PlacaDenegada {
  id: string
  placa: string
  descripcion?: string
  nivel: 'ALTA' | 'MEDIA' | 'BAJA'
  activa: boolean
  created_by: string
  created_at: string
}

export interface PlacaAlerta {
  id: string
  camera_id: string
  comunidad_id?: string
  placa_detectada: string
  confianza: number
  placa_denegada_id?: string
  snapshot_path?: string
  reconocido: boolean
  created_at: string
  placa_denegada?: { descripcion?: string; nivel: string }
}
