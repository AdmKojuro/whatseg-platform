import api from './api'
import type { GuardiaCheckIn, AlertaGuardia, EstadoGuardia } from '../types/guardia'

const BASE = '/ext/guardia'

export const guardiaService = {
  checkIn: (tipo: 'OK' | 'PANICO' | 'COACCION' = 'OK', notas?: string) =>
    api.post<GuardiaCheckIn>(`${BASE}/checkin`, { tipo, notas }),
  historial: (guardiaId: string) =>
    api.get<GuardiaCheckIn[]>(`${BASE}/checkin/${guardiaId}`),
  estado: () => api.get<EstadoGuardia[]>(`${BASE}/estado`),
  alertas: (resuelto?: boolean) =>
    api.get<AlertaGuardia[]>(`${BASE}/alertas`, { params: resuelto !== undefined ? { resuelto } : {} }),
  resolverAlerta: (id: string) => api.patch(`${BASE}/alertas/${id}/resolver`),
}
