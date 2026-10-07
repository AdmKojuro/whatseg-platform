import api from './api'
import type { Comunidad } from '../types/comunidad'

export const comunidadService = {
  list: () => api.get<Comunidad[]>('/comunidades'),
  getById: (id: string) => api.get<Comunidad>(`/comunidades/${id}`),
  create: (data: { nombre: string; codigo: string; direccion?: string; latitud?: number; longitud?: number; place_id?: string }) => api.post<Comunidad>('/comunidades', data),
  update: (id: string, data: Partial<Comunidad>) => api.put<Comunidad>(`/comunidades/${id}`, data),
  delete: (id: string) => api.delete(`/comunidades/${id}`),
  getMapa: (id: string) => api.get(`/comunidades/${id}/mapa`),
}
