import type { TipoExpediente, EstadoExpediente } from './enums'

export interface Expediente {
  id: string
  nombre?: string
  descripcion?: string
  tipo: TipoExpediente
  estado: EstadoExpediente
  vision_id?: number
  foto_path?: string
  notas?: string
  alerta_nivel: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface CreateExpedienteInput {
  nombre?: string
  descripcion?: string
  tipo?: TipoExpediente
  notas?: string
  alerta_nivel?: string
}

export interface UpdateExpedienteInput {
  nombre?: string
  descripcion?: string
  tipo?: TipoExpediente
  estado?: EstadoExpediente
  notas?: string
  alerta_nivel?: string
}
