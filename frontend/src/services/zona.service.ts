import api from './api'
import type { Zona, CreateZonaInput, UpdateZonaInput, MapaCalorPoint } from '../types/zona'

const BASE = '/ext/zonas'

export const zonaService = {
  list: () => api.get<Zona[]>(BASE),
  getById: (id: string) => api.get<Zona>(`${BASE}/${id}`),
  create: (data: CreateZonaInput) => api.post<Zona>(BASE, data),
  update: (id: string, data: UpdateZonaInput) => api.put<Zona>(`${BASE}/${id}`, data),
  delete: (id: string) => api.delete(`${BASE}/${id}`),
  asignarComunidad: (id: string, comunidad_id: string) =>
    api.post(`${BASE}/${id}/comunidades`, { comunidad_id }),
  desasignarComunidad: (id: string, comunidadId: string) =>
    api.delete(`${BASE}/${id}/comunidades/${comunidadId}`),
  mapaCalor: (id: string) => api.get<MapaCalorPoint[]>(`${BASE}/${id}/mapa-calor`),
}
