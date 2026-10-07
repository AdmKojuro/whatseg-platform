import axios from 'axios'
import { STORAGE_KEYS } from '../config/constants'

const attachToken = (config: import('axios').InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}

const handleUnauthorized = (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER)
    window.location.href = '/login'
  }
  return Promise.reject(error)
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})
api.interceptors.request.use(attachToken)
api.interceptors.response.use((r) => r, handleUnauthorized)

// Direct-to-VPS instance for backend-ext endpoints that the Vite proxy
// fails to forward correctly. backend-ext has cors({ origin: '*' }).
export const extApi = axios.create({
  baseURL: import.meta.env.VITE_EXT_BASE_URL || 'https://api.whatseg.com/api',
  headers: { 'Content-Type': 'application/json' },
})
extApi.interceptors.request.use(attachToken)
extApi.interceptors.response.use((r) => r, handleUnauthorized)

export default api
