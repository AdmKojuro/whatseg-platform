import api from './api'
import type { Jefe } from '../types/jefe'

export const jefeService = {
  list: () => api.get<Jefe[]>('/jefes'),
  getById: (id: string) => api.get<Jefe>(`/jefes/${id}`),
  create: (data: { nombre: string; celular: string }) => api.post<Jefe>('/jefes', data),
  update: (id: string, data: Partial<{ nombre: string; celular: string; activo: boolean; puede_registrar: boolean }>) => api.put<Jefe>(`/jefes/${id}`, data),
  delete: (id: string) => api.delete(`/jefes/${id}`),
  asignarComunidad: (id: string, comunidadId: string) => api.post(`/jefes/${id}/asignar-comunidad`, { comunidad_id: comunidadId }),
  desasignarComunidad: (id: string, comunidadId: string) => api.delete(`/jefes/${id}/desasignar-comunidad`, { data: { comunidad_id: comunidadId } }),
}
