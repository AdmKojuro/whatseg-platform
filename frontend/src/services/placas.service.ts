import api from './api'
import type { PlacaDenegada, PlacaAlerta } from '../types/placa'

const BASE = '/ext/placas'

export const placasService = {
  listarDenegadas: () => api.get<PlacaDenegada[]>(`${BASE}/denegadas`),
  crearDenegada: (data: { placa: string; descripcion?: string; nivel?: string }) =>
    api.post<PlacaDenegada>(`${BASE}/denegadas`, data),
  actualizarDenegada: (id: string, data: { nivel?: string; descripcion?: string; activa?: boolean }) =>
    api.patch<PlacaDenegada>(`${BASE}/denegadas/${id}`, data),
  eliminarDenegada: (id: string) => api.delete(`${BASE}/denegadas/${id}`),
  syncVision: () => api.post(`${BASE}/denegadas/sync-vision`),

  listarAlertas: (params?: { reconocido?: boolean; page?: number; limit?: number }) =>
    api.get<{ data: PlacaAlerta[]; total: number; page: number; limit: number; total_pages: number }>(
      `${BASE}/alertas`, { params }
    ),
  reconocerAlerta: (id: string) => api.patch(`${BASE}/alertas/${id}/reconocer`),
}
