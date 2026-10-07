export interface Comunidad {
  id: string
  nombre: string
  codigo: string
  activa: boolean
  visible_monitor: boolean
  direccion?: string
  latitud?: number
  longitud?: number
  place_id?: string
  created_at: string
  updated_at: string
  _count?: {
    dispositivos: number
    clientes: number
    jefes: number
    activaciones: number
  }
}

export interface CreateComunidadInput {
  nombre: string
  codigo: string
  direccion?: string
  latitud?: number
  longitud?: number
  place_id?: string
}

export interface UpdateComunidadInput {
  nombre?: string
  codigo?: string
  activa?: boolean
  visible_monitor?: boolean
  direccion?: string
  latitud?: number
  longitud?: number
  place_id?: string
}
