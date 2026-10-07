// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface CrearIncidenteDto {
  comunidad_id: string
  titulo: string
  descripcion?: string
  tipo?: 'INCIDENTE' | 'EMERGENCIA' | 'NOVEDAD' | 'SOSPECHA'
  severidad?: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'
  fecha_inicio: string        // ISO string
  ventana_horas?: number      // default 6
  latitud?: number | null
  longitud?: number | null
  radio_metros?: number       // default 500
}

export interface ActualizarIncidenteDto {
  titulo?: string
  descripcion?: string
  tipo?: 'INCIDENTE' | 'EMERGENCIA' | 'NOVEDAD' | 'SOSPECHA'
  estado?: 'ABIERTO' | 'EN_INVESTIGACION' | 'CERRADO' | 'ARCHIVADO'
  severidad?: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'
  fecha_inicio?: string
  fecha_cierre?: string | null
  ventana_horas?: number
  latitud?: number | null
  longitud?: number | null
  radio_metros?: number
  notas_cierre?: string | null
}

export interface FiltroIncidentes {
  comunidad_id?: string
  estado?: string
  tipo?: string
  severidad?: string
  limit?: number
  offset?: number
}

// ─── Timeline ────────────────────────────────────────────────────────────────

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

export interface EventoTimeline {
  id: string
  tipo: TipoEvento
  timestamp: string          // ISO string
  titulo: string
  descripcion: string
  actor?: string             // guardia, cliente, sistema…
  severidad: SeveridadEvento
  media_url?: string | null
  metadata?: Record<string, any>
}
