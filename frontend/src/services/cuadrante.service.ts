import api, { extApi } from './api'

export const cuadranteService = {
  list: () => api.get('/cuadrantes'),
  getById: (id: string) => api.get(`/cuadrantes/${id}`),
  create: (data: { nombre: string; email: string; password: string }) => api.post('/cuadrantes', data),
  update: (id: string, data: Partial<{ nombre: string; email: string; activo: boolean }>) => api.put(`/cuadrantes/${id}`, data),
  changePassword: (id: string, data: { password: string }) => api.post(`/cuadrantes/${id}/change-password`, data),
  delete: (id: string) => api.delete(`/cuadrantes/${id}`),
  asignarComunidad: (id: string, comunidadId: string) => api.post(`/cuadrantes/${id}/asignar-comunidad`, { comunidad_id: comunidadId }),
  desasignarComunidad: (id: string, comunidadId: string) => api.delete(`/cuadrantes/${id}/desasignar-comunidad`, { data: { comunidad_id: comunidadId } }),
  getMiPerfil: () => api.get('/cuadrantes/mi-perfil'),
  getMisComunidades: () => extApi.get('/ext/cuadrante-app/mis-comunidades'),
  updateTiposEmergencia: (tipos: string[]) => api.post('/cuadrantes/tipos-emergencia', { tipos_emergencia: tipos }),
  updateTiposEmergenciaAdmin: (id: string, tipos: string[]) => api.put(`/ext/guardia/cuadrante/${id}/tipos-emergencia`, { tipos_emergencia: tipos }),
  saveFcmToken: (token: string, platform: string) => api.post('/cuadrantes/fcm-token', { fcm_token: token, platform }),
  deleteFcmToken: (tokenId: string) => api.delete(`/cuadrantes/fcm-token/${tokenId}`),
  getMisAlarmas: () => extApi.get('/ext/cuadrante-app/mis-alarmas'),
}
