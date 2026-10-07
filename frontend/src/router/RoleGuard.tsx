import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { Rol } from '../types/enums'

export function RoleGuard({ roles }: { roles: Rol[] }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.rol)) return <Navigate to="/" replace />
  return <Outlet />
}
