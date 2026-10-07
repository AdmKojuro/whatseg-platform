export interface Zona {
  id: string
  nombre: string
  codigo: string
  descripcion?: string
  activa: boolean
  created_at: string
  comunidades: ZonaComunidad[]
  _count?: { comunidades: number; despachos: number }
}

export interface ZonaComunidad {
  zona_id: string
  comunidad_id: string
  assigned_at: string
}

export interface CreateZonaInput {
  nombre: string
  codigo: string
  descripcion?: string
}

export interface UpdateZonaInput {
  nombre?: string
  descripcion?: string
  activa?: boolean
}

export interface MapaCalorPoint {
  comunidad_id: string
  nombre?: string
  lat: number | null
  lng: number | null
  weight: number
}
