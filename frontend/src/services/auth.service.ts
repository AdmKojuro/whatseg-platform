import api from './api'
import type { LoginInput, LoginOutput } from '../types/auth'

export const authService = {
  login: (data: LoginInput) => api.post<LoginOutput>('/auth/login', data),
  logout: () => api.post('/auth/logout'),
}
