import api from './api'

export interface CuentaEzcloud {
  id: string
  nombre: string
  app_key: string
  app_secret: string
  base_url: string
  activa: boolean
  created_at: string
  updated_at: string
}

export interface CreateCuentaEzcloudInput {
  nombre: string
  app_key: string
  app_secret: string
  base_url?: string
}

export const ezcloudService = {
  listarCuentas: () => api.get<CuentaEzcloud[]>('/ext/ezcloud/cuentas'),
  crearCuenta: (data: CreateCuentaEzcloudInput) => api.post<CuentaEzcloud>('/ext/ezcloud/cuentas', data),
  actualizarCuenta: (id: string, data: Partial<CreateCuentaEzcloudInput & { activa: boolean }>) =>
    api.put<CuentaEzcloud>(`/ext/ezcloud/cuentas/${id}`, data),
  eliminarCuenta: (id: string) => api.delete(`/ext/ezcloud/cuentas/${id}`),
  getStream: (serial: string, channel?: string) =>
    api.get<{ url: string }>(`/ext/ezcloud/stream/${serial}`, { params: { channel } }),
  getSnapshot: (serial: string, channel = '1') =>
    api.get<{ url: string }>(`/ext/ezcloud/snapshot/${serial}/${channel}`),
}
