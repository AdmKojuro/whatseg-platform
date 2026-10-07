import type { ResultadoActivacion, VeredictoTipo, TipoEmergencia } from './enums'

export interface Activacion {
  id: string
  cliente_id?: string
  jefe_id?: string
  dispositivo_id: string
  comunidad_id: string
  resultado: ResultadoActivacion
  detalle?: string
  created_at: string
  snapshot_url?: string
  snapshot_urls: string[]
  tipo_emergencia?: TipoEmergencia
  veredicto?: VeredictoTipo
  veredicto_observacion?: string
  veredicto_admin_id?: string
  veredicto_at?: string
  cliente?: { id: string; nombre: string; celular: string; identificador?: string }
  jefe?: { id: string; nombre: string }
  dispositivo?: { id: string; nombre?: string; tipo?: string }
  comunidad?: { id: string; nombre: string; codigo: string }
  veredicto_admin?: { id: string; nombre: string }
}
