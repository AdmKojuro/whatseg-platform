import api from './api'
import type { Camara } from '../types/camara'

export const camaraService = {
  list: () => api.get<Camara[]>('/camaras'),
  getById: (id: string) => api.get<Camara>(`/camaras/${id}`),
  create: (data: { nombre: string; tipo: string; url_rtsp?: string; url_http?: string; comunidad_id?: string }) => api.post<Camara>('/camaras', data),
  update: (id: string, data: Partial<Camara>) => api.put<Camara>(`/camaras/${id}`, data),
  delete: (id: string) => api.delete(`/camaras/${id}`),
  getSnapshot: (id: string) => api.get(`/camaras/${id}/snapshot`),
  getStreamUrl: (id: string) => api.get<{ url: string }>(`/camaras/${id}/stream-url`),
}
