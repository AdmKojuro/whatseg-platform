import api from './api'
import type { ScoringTurno, PatronesTemporales, RutaPatrulla } from '../types/prediccion'

const BASE = '/ext/prediccion'

export const prediccionService = {
  scoring: (zona_id?: string) =>
    api.get<ScoringTurno>(`${BASE}/scoring`, { params: zona_id ? { zona_id } : {} }),
  patrones: (comunidad_id?: string) =>
    api.get<PatronesTemporales>(`${BASE}/patrones`, { params: comunidad_id ? { comunidad_id } : {} }),
  rutaPatrulla: (zona_id: string) =>
    api.get<RutaPatrulla>(`${BASE}/ruta-patrulla`, { params: { zona_id } }),
}
