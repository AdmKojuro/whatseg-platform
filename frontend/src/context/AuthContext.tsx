import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { STORAGE_KEYS } from '../config/constants'
import type { AuthUser, LoginInput, LoginOutput } from '../types/auth'
import { authService } from '../services/auth.service'

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (data: LoginInput) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN)
    // trd_user = set by React login; trd_admin = set by modulos.html login (same data, different key)
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER) ?? localStorage.getItem('trd_admin')
    if (savedToken && savedUser) {
      try {
        setToken(savedToken)
        setUser(JSON.parse(savedUser))
        // Normalise: ensure trd_user is always set so future checks succeed
        if (!localStorage.getItem(STORAGE_KEYS.USER)) {
          localStorage.setItem(STORAGE_KEYS.USER, savedUser)
        }
      } catch {
        localStorage.removeItem(STORAGE_KEYS.TOKEN)
        localStorage.removeItem(STORAGE_KEYS.USER)
      }
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (data: LoginInput) => {
    const response = await authService.login(data)
    const { token: newToken, admin } = response.data as LoginOutput
    localStorage.setItem(STORAGE_KEYS.TOKEN, newToken)
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(admin))
    setToken(newToken)
    setUser(admin)
  }, [])

  const logout = useCallback(() => {
    authService.logout().catch(() => {})
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
