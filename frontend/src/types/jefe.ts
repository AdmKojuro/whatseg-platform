export interface Jefe {
  id: string
  nombre: string
  celular: string
  activo: boolean
  puede_registrar: boolean
  created_at: string
  updated_at: string
  comunidades?: JefeComunidad[]
}

export interface JefeComunidad {
  id: string
  jefe_id: string
  comunidad_id: string
  created_at: string
  comunidad?: { id: string; nombre: string; codigo: string }
}

export interface CreateJefeInput {
  nombre: string
  celular: string
}
