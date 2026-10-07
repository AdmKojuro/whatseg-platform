export interface GuardiaCheckIn {
  id: string
  guardia_id: string
  tipo: 'OK' | 'PANICO' | 'COACCION'
  notas?: string
  created_at: string
}

export interface AlertaGuardia {
  id: string
  guardia_id: string
  tipo: 'SIN_CHECKIN' | 'COACCION' | 'PANICO'
  nivel: string
  resuelto: boolean
  resuelto_at?: string
  resuelto_por?: string
  created_at: string
}

export interface EstadoGuardia {
  guardia_id: string
  ultimo_checkin: string
  tipo: string
  activo: boolean
}
