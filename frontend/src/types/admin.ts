import type { Rol, TipoEmergencia } from './enums'

export interface Admin {
  id: string
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  tipos_emergencia: TipoEmergencia[]
  created_at: string
  updated_at: string
  comunidades?: AdminComunidad[]
}

export interface AdminComunidad {
  id: string
  admin_id: string
  comunidad_id: string
  created_at: string
  comunidad?: { id: string; nombre: string; codigo: string }
}

export interface CreateAdminInput {
  nombre: string
  email: string
  password: string
  rol: Rol
}

export interface UpdateAdminInput {
  nombre?: string
  email?: string
  rol?: Rol
  activo?: boolean
}
