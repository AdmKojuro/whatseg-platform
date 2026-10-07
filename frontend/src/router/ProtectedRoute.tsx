import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}
