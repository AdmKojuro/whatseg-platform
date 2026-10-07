import api from './api'
import type { FederacionPar, PatronAnonimo, AlertaComportamiento } from '../types/federacion'

const BASE = '/ext/federacion'
const COMP = '/ext/comportamiento'

export const federacionService = {
  listarPares: () => api.get<FederacionPar[]>(`${BASE}/pares`),
  crearPar: (data: { nombre: string; comunidad_local_id: string; endpoint_remoto: string }) =>
    api.post<FederacionPar>(`${BASE}/pares`, data),
  activarPar: (id: string, activa: boolean) => api.patch(`${BASE}/pares/${id}`, { activa }),
  eliminarPar: (id: string) => api.delete(`${BASE}/pares/${id}`),
  listarPatrones: (federacion_id?: string) =>
    api.get<PatronAnonimo[]>(`${BASE}/patrones`, { params: federacion_id ? { federacion_id } : {} }),
}

export const comportamientoService = {
  listar: (params?: { tipo?: string; reconocido?: boolean; page?: number; limit?: number }) =>
    api.get<{ data: AlertaComportamiento[]; total: number; page: number }>(`${COMP}`, { params }),
  reconocer: (id: string) => api.patch(`${COMP}/${id}/reconocer`),
}
