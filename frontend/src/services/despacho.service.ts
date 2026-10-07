import api from './api'
import type { Despacho, CreateDespachoInput } from '../types/despacho'
import type { EstadoDespacho } from '../types/enums'

const BASE = '/ext/despacho'

export const despachoService = {
  list: (params?: { zona_id?: string; cuadrante_id?: string; estado?: string }) =>
    api.get<Despacho[]>(BASE, { params }),
  getById: (id: string) => api.get<Despacho>(`${BASE}/${id}`),
  create: (data: CreateDespachoInput) => api.post<Despacho>(BASE, data),
  actualizarEstado: (id: string, estado: EstadoDespacho, notas?: string) =>
    api.patch<Despacho>(`${BASE}/${id}/estado`, { estado, notas }),
  porCuadrante: (id: string) => api.get<Despacho[]>(`${BASE}/cuadrante/${id}`),
}
