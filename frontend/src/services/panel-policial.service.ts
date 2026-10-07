import api from './api'
import type { AlertaIA } from '../types/alerta-ia'
import type { Despacho } from '../types/despacho'

const BASE = '/ext/panel'

interface MetricasTurno {
  activaciones_hoy: number
  despachos_hoy: number
  tiempo_promedio_respuesta_seg: number
  falsas_alarmas_hoy: number
  alertas_ia_hoy: number
}

interface AlertasActivas {
  activaciones: Array<{
    id: string
    created_at: string
    tipo_emergencia: string | null
    resultado: string
    comunidad_id: string
    nombre_comunidad: string
    lat: number | null
    lng: number | null
  }>
  alertas_ia: AlertaIA[]
}

export const panelPolicialService = {
  alertasActivas: () => api.get<AlertasActivas>(`${BASE}/alertas-activas`),
  despachosActivos: () => api.get<Despacho[]>(`${BASE}/despachos-activos`),
  metricas: () => api.get<MetricasTurno>(`${BASE}/metricas`),
  exportarSies: (desde?: string, hasta?: string) => {
    const params = new URLSearchParams()
    if (desde) params.append('desde', desde)
    if (hasta) params.append('hasta', hasta)
    window.open(`/api/ext/panel/exportar-sies?${params.toString()}`, '_blank')
  },
}
