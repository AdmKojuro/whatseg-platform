import api from './api'
import type { MapaCalorPoint } from '../types/zona'

const BASE = '/ext/analitica'

export const analiticaService = {
  mapaCalor: (dias?: number) =>
    api.get<MapaCalorPoint[]>(`${BASE}/mapa-calor`, { params: { dias } }),
  patrones: (comunidad_id?: string) =>
    api.get<{
      por_hora: { hora: number; total: number }[]
      por_dia: { dia: number; total: number }[]
      por_tipo: { tipo: string; total: number }[]
    }>(`${BASE}/patrones`, { params: { comunidad_id } }),
  tendencias: () =>
    api.get<{
      mes_actual: { total: number; exitosas: number; falsas: number }
      mes_anterior: { total: number; exitosas: number; falsas: number }
      variacion_pct: number
    }>(`${BASE}/tendencias`),
  ranking: (limite?: number) =>
    api.get<
      { comunidad_id: string; nombre: string; total: number; falsas: number; efectividad: number }[]
    >(`${BASE}/ranking`, { params: { limite } }),
}
