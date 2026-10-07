import api from './api'

const BASE = '/ext/vision'

export interface VisionCamera {
  id: string
  nombre: string
  rtsp_url: string
  comunidad_id?: string
  lat?: number
  lng?: number
  online: boolean
}

export interface VisionFace {
  id: number
  face_track_id: string
  snapshot_path?: string
  camera_id?: string
  comunidad_id?: string
  first_seen: string
  last_seen: string
  detection_count: number
  label?: string
}

export interface VisionStats {
  camaras: { total: number; online: number }
  identidades: number
  expedientes: number
  alertas_hoy: number
  alertas_criticas_hoy: number
}

export const visionService = {
  status: () => api.get<{ online: boolean; url: string }>(`${BASE}/status`),
  stats: () => api.get<VisionStats>(`${BASE}/stats`),
  cameras: () => api.get<VisionCamera[]>(`${BASE}/cameras`),
  addCamera: (data: { id: string; nombre: string; rtsp_url: string; comunidad_id?: string }) =>
    api.post(`${BASE}/cameras/add`, data),
  removeCamera: (id: string) => api.post(`${BASE}/cameras/remove`, { id }),
  syncCameras: () => api.post(`${BASE}/sync-cameras`),
  faces: (params?: { page?: number; limit?: number; q?: string }) =>
    api.get<{ data: VisionFace[]; total: number; page: number; limit: number; total_pages: number }>(
      `${BASE}/faces`, { params }
    ),
  searchFace: (foto: File) => {
    const form = new FormData()
    form.append('image', foto)
    return api.post<VisionFace[]>(`${BASE}/faces/search`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  snapshotUrl: (camId: string) => `/api/ext/vision/cameras/${camId}/snapshot`,
}
