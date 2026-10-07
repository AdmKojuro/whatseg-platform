export interface CrearPuestoDto {
  comunidad_id: string
  nombre: string
  descripcion?: string
  latitud?: number
  longitud?: number
  direccion?: string
}

export interface ActualizarPuestoDto {
  nombre?: string
  descripcion?: string
  latitud?: number
  longitud?: number
  direccion?: string
  activo?: boolean
}

export interface CrearRutaDto {
  nombre: string
  comunidad_id: string
  descripcion?: string
  intervalo_min?: number
}

export interface ActualizarRutaDto {
  nombre?: string
  descripcion?: string
  intervalo_min?: number
  activa?: boolean
}

export interface CrearCheckpointDto {
  nombre: string
  orden: number
  latitud?: number
  longitud?: number
  nfc_tag?: string
  hora_programada?: string
}

export interface ActualizarCheckpointDto {
  nombre?: string
  orden?: number
  latitud?: number
  longitud?: number
  nfc_tag?: string
  hora_programada?: string
}

export interface MarcarCheckpointDto {
  qr_code?: string
  nfc_tag?: string
  latitud?: number
  longitud?: number
  notas?: string
  foto_url?: string
}

export interface FiltroEjecuciones {
  comunidad_id?: string
  guardia_id?: string
  estado?: string
  desde?: string
  hasta?: string
}

// ─── USUARIOS (Personal de seguridad) ────────────────────────────────────

export interface CrearUsuarioRondaDto {
  comunidad_id: string
  cedula: string
  nombre: string
  telefono?: string
  password: string
  rol: 'SUPERVISOR' | 'GUARDIA'
  turno?: string
  puesto_id?: string
}

export interface ActualizarUsuarioRondaDto {
  nombre?: string
  telefono?: string
  password?: string
  rol?: 'SUPERVISOR' | 'GUARDIA'
  turno?: string
  puesto_id?: string
  activo?: boolean
}

export interface LoginRondaDto {
  cedula: string
  password: string
}
