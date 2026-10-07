import api from './api'
import type { AlertaIA } from '../types/alerta-ia'

const BASE = '/ext/alertas-ia'

interface PaginatedAlertas {
  data: AlertaIA[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export const alertasIAService = {
  list: (params?: {
    tipo?: string
    comunidad_id?: string
    reconocido?: boolean
    page?: number
    limit?: number
  }) => api.get<PaginatedAlertas>(BASE, { params }),
  getById: (id: string) => api.get<AlertaIA>(`${BASE}/${id}`),
  reconocer: (id: string) => api.patch(`${BASE}/${id}/reconocer`),
}
