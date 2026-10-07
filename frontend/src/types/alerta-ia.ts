import type { TipoAlertaIA, SeveridadAlerta } from './enums'

export interface AlertaIA {
  id: string
  camera_id: string
  comunidad_id?: string
  tipo_alerta: TipoAlertaIA
  severidad: SeveridadAlerta
  descripcion: string
  face_track_id?: string
  expediente_id?: string
  vision_alert_id?: number
  similitud?: number
  snapshot_path?: string
  reconocido: boolean
  created_at: string
}
