import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { adminService } from '../../services/admin.service'
import type { Rol } from '../../types/enums'

export default function AdminCreatePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'ADMIN' as Rol,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.nombre.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Todos los campos son obligatorios')
      return
    }

    try {
      setSaving(true)
      setError(null)
      await adminService.create({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
        rol: form.rol,
      })
      navigate('/admins')
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setError(axiosErr.response?.data?.message || 'Error al crear administrador')
      } else {
        const message = err instanceof Error ? err.message : 'Error al crear administrador'
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

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
        <h1 className="text-2xl font-bold text-white">Nuevo Administrador</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nombre completo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="admin@ejemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Contrasena</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Minimo 6 caracteres"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Rol</label>
            <select
              name="rol"
              value={form.rol}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="SUPERADMIN">SUPERADMIN</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MONITOR">MONITOR</option>
            </select>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Crear Administrador
            </button>
            <button
              type="button"
              onClick={() => navigate('/admins')}
              className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
