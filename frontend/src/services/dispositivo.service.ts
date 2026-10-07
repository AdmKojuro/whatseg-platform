import api from './api'
import type { Dispositivo } from '../types/dispositivo'

export const dispositivoService = {
  list: () => api.get<Dispositivo[]>('/dispositivos'),
  sinConfigurar: () => api.get<Dispositivo[]>('/dispositivos/sin-configurar'),
  getEstado: (id: string) => api.get(`/dispositivos/${id}/estado`),
  getFunciones: (id: string) => api.get(`/dispositivos/${id}/funciones`),
  probar: (id: string) => api.post(`/dispositivos/${id}/probar`),
  configurar: (id: string, data: Record<string, unknown>) => api.post(`/dispositivos/${id}/configurar`, data),
  asignar: (id: string, data: { comunidad_id: string; nombre: string; tipo?: string }) => api.post(`/dispositivos/${id}/asignar`, data),
  desasignar: (id: string) => api.post(`/dispositivos/${id}/desasignar`),
  asignarCamara: (id: string, data: { camara_id: string }) => api.post(`/dispositivos/${id}/asignar-camara`, data),
  desasignarCamara: (id: string) => api.post(`/dispositivos/${id}/desasignar-camara`),
  vincularCamara: (id: string, data: { camara_dispositivo_id: string }) => api.post(`/dispositivos/${id}/vincular-camara`, data),
  desvincularCamara: (id: string) => api.post(`/dispositivos/${id}/desvincular-camara`),
  getSnapshot: (id: string) => api.get(`/dispositivos/${id}/snapshot`),
  getStreamUrl: (id: string) => api.get(`/dispositivos/${id}/stream-url`),
  sincronizar: () => api.post('/dispositivos/sync'),
  sincronizarThinmoo: () => api.post('/dispositivos/sync-thinmoo'),
  sincronizarDolynk: () => api.post('/dispositivos/sync-dolynk'),
  sincronizarImou: () => api.post('/dispositivos/sync-imou'),
  getCamaras: () => api.get('/dispositivos/camaras'),
  crearThinmoo: (data: Record<string, unknown>) => api.post('/dispositivos/crear-thinmoo', data),
}
