import api from './api'
import type { Cliente } from '../types/cliente'
import type { PaginatedResponse, PaginationParams } from '../types/pagination'

export const clienteService = {
  list: (params?: Record<string, string>) => api.get<Cliente[]>('/clientes', { params }),
  getPaginated: (params: PaginationParams) => api.get<PaginatedResponse<Cliente>>('/clientes/paginado', { params }),
  getById: (id: string) => api.get<Cliente>(`/clientes/${id}`),
  create: (data: { nombre: string; celular: string; identificador: string; comunidad_id: string }) => api.post<Cliente>('/clientes', data),
  update: (id: string, data: Partial<{ nombre: string; celular: string; identificador: string }>) => api.put<Cliente>(`/clientes/${id}`, data),
  delete: (id: string) => api.delete(`/clientes/${id}`),
  activar: (id: string) => api.post(`/clientes/${id}/activar`),
  desactivar: (id: string) => api.post(`/clientes/${id}/desactivar`),
  desasignar: (id: string, comunidad_id: string) => api.post(`/clientes/${id}/desasignar`, { comunidad_id }),
  transferir: (id: string, data: { origen_id: string; destino_id: string; motivo?: string }) => api.post(`/clientes/${id}/transferir`, data),
  getHistorialCambios: (id: string) => api.get(`/clientes/${id}/historial-cambios`),
  bloquear: (id: string, data: { motivo?: string; duracion: number }) => api.post(`/clientes/${id}/bloquear`, data),
  desbloquear: (id: string) => api.post(`/clientes/${id}/desbloquear`),
}
