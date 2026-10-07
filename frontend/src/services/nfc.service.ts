import api from './api'

export interface NfcTarjeta {
  id: string
  uid: string
  etiqueta: string
  activa: boolean
  comunidad_id?: string | null
  comunidad_nombre?: string | null
  checkpoint_nombre?: string | null
  notas?: string | null
  created_at: string
  updated_at: string
}

const BASE = '/ext/rondas/nfc'

export const nfcService = {
  list: (comunidad_id?: string) =>
    api.get<NfcTarjeta[]>(BASE, { params: comunidad_id ? { comunidad_id } : {} }),

  create: (data: { uid: string; etiqueta: string; comunidad_id?: string | null; notas?: string | null }) =>
    api.post<NfcTarjeta>(BASE, data),

  update: (id: string, data: { etiqueta?: string; activa?: boolean; comunidad_id?: string | null; notas?: string | null }) =>
    api.patch<NfcTarjeta>(`${BASE}/${id}`, data),

  delete: (id: string) => api.delete(`${BASE}/${id}`),
}
