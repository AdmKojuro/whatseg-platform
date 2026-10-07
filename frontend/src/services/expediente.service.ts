import api from './api'
import type { Expediente, CreateExpedienteInput, UpdateExpedienteInput } from '../types/expediente'
import type { AlertaIA } from '../types/alerta-ia'

const BASE = '/ext/expedientes'

export const expedienteService = {
  list: () => api.get<Expediente[]>(BASE),
  getById: (id: string) => api.get<Expediente>(`${BASE}/${id}`),
  create: (data: CreateExpedienteInput) => api.post<Expediente>(BASE, data),
  update: (id: string, data: UpdateExpedienteInput) => api.put<Expediente>(`${BASE}/${id}`, data),
  delete: (id: string) => api.delete(`${BASE}/${id}`),
  subirFoto: (id: string, foto: File) => {
    const form = new FormData()
    form.append('foto', foto)
    return api.post<{ vision_id: number }>(`${BASE}/${id}/foto`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  detecciones: (id: string) => api.get<AlertaIA[]>(`${BASE}/${id}/detecciones`),
}
