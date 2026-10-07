import api from './api'
import type { Incidente, TimelineResponse, CreateIncidenteInput } from '../types/incidente'

const BASE = '/ext/incidentes'

export const incidenteService = {
  list: (params?: {
    comunidad_id?: string
    estado?: string
    tipo?: string
    severidad?: string
    limit?: number
    offset?: number
  }) => api.get<{ items: Incidente[]; total: number }>(BASE, { params }),

  getById: (id: string) => api.get<Incidente>(`${BASE}/${id}`),

  create: (data: CreateIncidenteInput) => api.post<Incidente>(BASE, data),

  update: (id: string, data: Partial<Incidente>) =>
    api.patch<Incidente>(`${BASE}/${id}`, data),

  delete: (id: string) => api.delete(`${BASE}/${id}`),

  getTimeline: (id: string) => api.get<TimelineResponse>(`${BASE}/${id}/timeline`),
}
