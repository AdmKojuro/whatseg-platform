import type { Rol } from './enums'

export interface AuthUser {
  id: string
  nombre: string
  email: string
  rol: Rol
}

export interface LoginInput {
  email: string
  password: string
}

export interface LoginOutput {
  token: string
  admin: AuthUser
}
