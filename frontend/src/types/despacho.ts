import type { EstadoDespacho } from './enums'
import type { Zona } from './zona'

export interface Despacho {
  id: string
  activacion_id?: string
  alerta_ia_id?: string
  zona_id?: string
  cuadrante_id: string
  estado: EstadoDespacho
  prioridad: number
  notas_despacho?: string
  notas_cierre?: string
  tiempo_respuesta_seg?: number
  created_at: string
  asignado_at: string
  en_camino_at?: string
  en_sitio_at?: string
  cierre_at?: string
  created_by: string
  zona?: Zona
}

export interface CreateDespachoInput {
  activacion_id?: string
  alerta_ia_id?: string
  zona_id?: string
  cuadrante_id: string
  prioridad?: number
  notas_despacho?: string
}
