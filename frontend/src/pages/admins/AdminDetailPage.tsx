import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ShieldCheck,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
} from 'lucide-react'
import { adminService } from '../../services/admin.service'
import type { Admin } from '../../types/admin'
import type { Rol } from '../../types/enums'

export default function AdminDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Edit form
  const [editForm, setEditForm] = useState({
    nombre: '',
    email: '',
    rol: 'ADMIN' as Rol,
  })
  const [saving, setSaving] = useState(false)

  // Password form
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' })
  const [changingPassword, setChangingPassword] = useState(false)

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const fetchAdmin = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      setError(null)
      const response = await adminService.getById(id)
      const data = response.data
      setAdmin(data)
      setEditForm({
        nombre: data.nombre,
        email: data.email,
        rol: data.rol,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar administrador'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchAdmin()
  }, [fetchAdmin])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return

    try {
      setSaving(true)
      setError(null)
      await adminService.update(id, {
        nombre: editForm.nombre.trim(),
        email: editForm.email.trim(),
        rol: editForm.rol,
      })
      showSuccess('Administrador actualizado exitosamente')
      await fetchAdmin()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setError(axiosErr.response?.data?.message || 'Error al actualizar administrador')
      } else {
        const message = err instanceof Error ? err.message : 'Error al actualizar administrador'
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return

    if (!passwordForm.password.trim()) {
      setError('La contrasena es obligatoria')
      return
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError('Las contrasenas no coinciden')
      return
    }

    try {
      setChangingPassword(true)
      setError(null)
      await adminService.changePassword(id, { password: passwordForm.password })
      showSuccess('Contrasena actualizada exitosamente')
      setPasswordForm({ password: '', confirmPassword: '' })
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setError(axiosErr.response?.data?.message || 'Error al cambiar contrasena')
      } else {
        const message = err instanceof Error ? err.message : 'Error al cambiar contrasena'
        setError(message)
      }
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    )
  }

  if (!admin) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/admins')}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>Administrador no encontrado</p>
        </div>
      </div>
    )
  }

  const ROL_BADGE: Record<string, { bg: string; text: string }> = {
    SUPERADMIN: { bg: 'bg-red-100', text: 'text-red-400' },
    ADMIN: { bg: 'bg-blue-100', text: 'text-blue-400' },
    MONITOR: { bg: 'bg-green-100', text: 'text-emerald-400' },
    CUADRANTE: { bg: 'bg-purple-100', text: 'text-purple-400' },
  }

  const rolBadge = ROL_BADGE[admin.rol] || { bg: 'bg-gray-100', text: 'text-gray-300' }

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/admins')}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a administradores
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-white">{admin.nombre}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">{admin.email}</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rolBadge.bg} ${rolBadge.text}`}
            >
              {admin.rol}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Info */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Informacion del Administrador</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">ID</dt>
              <dd className="font-mono text-xs text-white text-xs">{admin.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Nombre</dt>
              <dd className="text-white">{admin.nombre}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="text-white">{admin.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Rol</dt>
              <dd className="text-white">{admin.rol}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Activo</dt>
              <dd className="text-white">{admin.activo ? 'Si' : 'No'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Creado</dt>
              <dd className="text-white">
                {new Date(admin.created_at).toLocaleDateString('es-ES')}
              </dd>
            </div>
          </dl>
        </div>

        {/* Edit form */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Editar Informacion</h3>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
              <input
                type="text"
                value={editForm.nombre}
                onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Rol</label>
              <select
                value={editForm.rol}
                onChange={(e) => setEditForm({ ...editForm, rol: e.target.value as Rol })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="SUPERADMIN">SUPERADMIN</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MONITOR">MONITOR</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Cambios
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 lg:col-span-2 max-w-2xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-gray-500" />
            Cambiar Contrasena
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nueva Contrasena
                </label>
                <input
                  type="password"
                  value={passwordForm.password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, password: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Minimo 6 caracteres"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Confirmar Contrasena
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Repetir contrasena"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={changingPassword}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {changingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              Cambiar Contrasena
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
