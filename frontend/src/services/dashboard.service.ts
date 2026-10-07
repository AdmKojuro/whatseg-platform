import api, { extApi } from './api'
import type { DashboardStats, NotificacionDashboard, ActivacionesPorComunidad } from '../types/dashboard'
import type { Activacion } from '../types/activacion'

// Normaliza la respuesta del backend: soporta formato plano y anidado
function normalizeStats(d: Record<string, any>): DashboardStats {
  return {
    totalComunidades:  d.totalComunidades  ?? d.comunidades                   ?? 0,
    totalClientes:     d.totalClientes     ?? d.clientes                      ?? 0,
    totalDispositivos: d.totalDispositivos ?? d.dispositivos?.total ?? (typeof d.dispositivos === 'number' ? d.dispositivos : 0),
    dispositivosOnline:  d.dispositivosOnline  ?? d.dispositivos?.online  ?? 0,
    dispositivosOffline: d.dispositivosOffline ?? d.dispositivos?.offline ?? 0,
    totalActivaciones: d.totalActivaciones ?? d.activaciones?.mes ?? (typeof d.activaciones === 'number' ? d.activaciones : 0),
    activacionesHoy:    d.activacionesHoy    ?? d.activaciones?.hoy    ?? 0,
    activacionesSemana: d.activacionesSemana ?? d.activaciones?.semana ?? 0,
    activacionesMes:    d.activacionesMes    ?? d.activaciones?.mes    ?? 0,
    totalJefes: d.totalJefes ?? undefined,
  }
}

export const dashboardService = {
  getStats: async () => {
    const res = await api.get<any>('/dashboard/stats')
    return { ...res, data: normalizeStats(res.data) as DashboardStats }
  },
  getActivacionesRecientes: () => api.get<Activacion[]>('/dashboard/activaciones-recientes'),
  getActivacionesPorComunidad: async () => {
    const res = await api.get<any[]>('/dashboard/activaciones-por-comunidad')
    const normalized: ActivacionesPorComunidad[] = (res.data ?? []).map((d: any) => ({
      comunidad_id:     d.comunidad_id    ?? d.comunidad?.id    ?? '',
      comunidad_nombre: d.comunidad_nombre ?? d.comunidad?.nombre ?? d.nombre ?? '',
      total:            d.total            ?? d.count             ?? 0,
    }))
    return { ...res, data: normalized }
  },
  // ── ADMIN (extApi → backend-ext, filtrado por comunidades del admin) ──────────
  getStatsAdmin: async () => {
    const res = await extApi.get<any>('/ext/admin-app/dashboard/stats')
    return { ...res, data: normalizeStats(res.data) as DashboardStats }
  },
  getActivacionesRecientesAdmin: () =>
    extApi.get<Activacion[]>('/ext/admin-app/dashboard/activaciones-recientes'),
  getActivacionesPorComunidadAdmin: async () => {
    const res = await extApi.get<any[]>('/ext/admin-app/dashboard/activaciones-por-comunidad')
    const normalized: ActivacionesPorComunidad[] = (res.data ?? []).map((d: any) => ({
      comunidad_id:     d.comunidad_id    ?? '',
      comunidad_nombre: d.comunidad_nombre ?? d.nombre ?? '',
      total:            d.total           ?? 0,
    }))
    return { ...res, data: normalized }
  },
  getHardware:                 () => api.get('/dashboard/hardware'),
  getNotificaciones:           () => api.get<NotificacionDashboard[]>('/dashboard/notificaciones'),
  getActivacionesFiltradas:    (params: Record<string, string>) => api.get<Activacion[]>('/dashboard/activaciones-filtradas', { params }),
  getActivacionesPendientes:   () => api.get<Activacion[]>('/dashboard/activaciones-pendientes'),
}
