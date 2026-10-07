import api from './api'
import type { Admin } from '../types/admin'

export const adminService = {
  list: () => api.get<Admin[]>('/admins'),
  getById: (id: string) => api.get<Admin>(`/admins/${id}`),
  create: (data: { nombre: string; email: string; password: string; rol: string }) => api.post<Admin>('/admins', data),
  update: (id: string, data: Partial<{ nombre: string; email: string; rol: string; activo: boolean }>) => api.put<Admin>(`/admins/${id}`, data),
  changePassword: (id: string, data: { password: string }) => api.post(`/admins/${id}/change-password`, data),
  delete: (id: string) => api.delete(`/admins/${id}`),
}

export const adminComunidadService = {
  asignar: (data: { admin_id: string; comunidad_id: string }) => api.post('/admin-comunidades/asignar', data),
  desasignar: (data: { admin_id: string; comunidad_id: string }) => api.delete('/admin-comunidades/desasignar', { data }),
  getByAdmin: (adminId: string) => api.get(`/admin-comunidades/por-admin/${adminId}`),
}
