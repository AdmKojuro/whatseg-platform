import api from './api'
import type { Visita, CreateVisitaInput } from '../types/visita'

const BASE = '/ext/visitas'

export const visitaService = {
  list: (comunidad_id?: string) =>
    api.get<Visita[]>(BASE, { params: { comunidad_id } }),
  listByComunidad: (id: string) => api.get<Visita[]>(`${BASE}/comunidad/${id}`),
  create: (data: CreateVisitaInput) => api.post<Visita & { qr_base64: string }>(BASE, data),
  getById: (id: string) => api.get<Visita>(`${BASE}/${id}`),
  getQr: (id: string) => api.get<{ qr_base64: string; token: string }>(`${BASE}/${id}/qr`),
  cancelar: (id: string) => api.delete(`${BASE}/${id}`),
}
