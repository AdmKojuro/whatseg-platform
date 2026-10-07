export type TipoIncidente = 'INCIDENTE' | 'EMERGENCIA' | 'NOVEDAD' | 'SOSPECHA'
export type EstadoIncidente = 'ABIERTO' | 'EN_INVESTIGACION' | 'CERRADO' | 'ARCHIVADO'
export type SeveridadIncidente = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'

export type TipoEvento =
  | 'PTT_REPORT'
  | 'PATROL_CHECKPOINT'
  | 'AI_ALERT'
  | 'BEHAVIOR_ALERT'
  | 'GUARD_ALERT'
  | 'GUARD_PANIC'
  | 'PLATE_ALERT'
  | 'VISITOR'
  | 'PANIC_BUTTON'
  | 'DISPATCH'

export type SeveridadEvento = 'INFO' | 'WARNING' | 'CRITICAL'

export interface Incidente {
  id: string
  comunidad_id: string
  comunidad_nombre?: string
  titulo: string
  descripcion?: string | null
  tipo: TipoIncidente
  estado: EstadoIncidente
  severidad: SeveridadIncidente
  fecha_inicio: string
  fecha_cierre?: string | null
  ventana_horas: number
  latitud?: number | null
  longitud?: number | null
  radio_metros: number
  created_by: string
  notas_cierre?: string | null
  created_at: string
  updated_at: string
}

export interface EventoTimeline {
  id: string
  tipo: TipoEvento
  timestamp: string
  titulo: string
  descripcion: string
  actor?: string
  severidad: SeveridadEvento
  media_url?: string | null
  metadata?: Record<string, any>
}

export interface TimelineResponse {
  incidente_id: string
  total: number
  eventos: EventoTimeline[]
}

export interface CreateIncidenteInput {
  comunidad_id: string
  titulo: string
  descripcion?: string
  tipo?: TipoIncidente
  severidad?: SeveridadIncidente
  fecha_inicio: string
  ventana_horas?: number
  latitud?: number | null
  longitud?: number | null
  radio_metros?: number
}
