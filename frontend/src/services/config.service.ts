import api from './api'

export const configService = {
  get: () => api.get('/config'),
  getTiposDispositivo: () => api.get('/tipos-dispositivo'),
}
