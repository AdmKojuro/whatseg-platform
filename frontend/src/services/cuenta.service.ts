import api from './api'
import type { CuentaTuya, CuentaThinmoo, CuentaDolynk, CuentaImou } from '../types/cuenta'

export const cuentaTuyaService = {
  list: () => api.get<CuentaTuya[]>('/cuentas-tuya'),
  getById: (id: string) => api.get<CuentaTuya>(`/cuentas-tuya/${id}`),
  create: (data: Partial<CuentaTuya>) => api.post<CuentaTuya>('/cuentas-tuya', data),
  update: (id: string, data: Partial<CuentaTuya>) => api.put<CuentaTuya>(`/cuentas-tuya/${id}`, data),
  delete: (id: string) => api.delete(`/cuentas-tuya/${id}`),
}

export const cuentaThinmooService = {
  list: () => api.get<CuentaThinmoo[]>('/cuentas-thinmoo'),
  getById: (id: string) => api.get<CuentaThinmoo>(`/cuentas-thinmoo/${id}`),
  create: (data: Partial<CuentaThinmoo>) => api.post<CuentaThinmoo>('/cuentas-thinmoo', data),
  update: (id: string, data: Partial<CuentaThinmoo>) => api.put<CuentaThinmoo>(`/cuentas-thinmoo/${id}`, data),
  delete: (id: string) => api.delete(`/cuentas-thinmoo/${id}`),
}

export const cuentaDolynkService = {
  list: () => api.get<CuentaDolynk[]>('/cuentas-dolynk'),
  getById: (id: string) => api.get<CuentaDolynk>(`/cuentas-dolynk/${id}`),
  create: (data: Partial<CuentaDolynk>) => api.post<CuentaDolynk>('/cuentas-dolynk', data),
  update: (id: string, data: Partial<CuentaDolynk>) => api.put<CuentaDolynk>(`/cuentas-dolynk/${id}`, data),
  delete: (id: string) => api.delete(`/cuentas-dolynk/${id}`),
  getDispositivos: (id: string) => api.get(`/cuentas-dolynk/${id}/dispositivos`),
}

export const cuentaImouService = {
  list: () => api.get<CuentaImou[]>('/cuentas-imou'),
  getById: (id: string) => api.get<CuentaImou>(`/cuentas-imou/${id}`),
  create: (data: Partial<CuentaImou>) => api.post<CuentaImou>('/cuentas-imou', data),
  update: (id: string, data: Partial<CuentaImou>) => api.put<CuentaImou>(`/cuentas-imou/${id}`, data),
  delete: (id: string) => api.delete(`/cuentas-imou/${id}`),
}
