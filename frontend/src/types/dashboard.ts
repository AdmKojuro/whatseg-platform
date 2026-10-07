export interface DashboardStats {
  totalComunidades: number
  totalClientes: number
  totalDispositivos: number
  totalActivaciones: number
  dispositivosOnline: number
  dispositivosOffline: number
  activacionesHoy: number
  activacionesSemana: number
  activacionesMes: number
  totalJefes?: number
}

export interface NotificacionDashboard {
  id: string
  mensaje: string
  comunidad_id: string
  activacion_id: string
  jefe_nombre?: string
  leida: boolean
  created_at: string
}

export interface ActivacionesPorComunidad {
  comunidad_id: string
  comunidad_nombre: string
  total: number
}
