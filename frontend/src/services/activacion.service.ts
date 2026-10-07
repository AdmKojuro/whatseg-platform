import api from './api'
import type { Activacion } from '../types/activacion'
import type { PaginatedResponse, PaginationParams } from '../types/pagination'

export const activacionService = {
  activar: (data: { dispositivo_id: string; cliente_id?: string; tipo_emergencia?: string }) => api.post('/activaciones', data),
  getByComunidad: (comunidadId: string) => api.get<Activacion[]>(`/activaciones/comunidad/${comunidadId}`),
  getByComunidadPaginado: (comunidadId: string, params: PaginationParams) => api.get<PaginatedResponse<Activacion>>(`/activaciones/comunidad/${comunidadId}/paginado`, { params }),
  getByCliente: (clienteId: string) => api.get<Activacion[]>(`/activaciones/cliente/${clienteId}`),
  contarByComunidad: (comunidadId: string) => api.get<{ total: number }>(`/activaciones/comunidad/${comunidadId}/contar`),
  submitVeredicto: (activacionId: string, data: { veredicto: string; observacion?: string }) => api.post(`/activaciones/${activacionId}/veredicto`, data),
  delete: (activacionId: string) => api.delete(`/activaciones/${activacionId}`),
}
