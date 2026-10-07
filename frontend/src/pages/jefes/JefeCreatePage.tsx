import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserCog,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { jefeService } from '../../services/jefe.service'

export default function JefeCreatePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre: '',
    celular: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.nombre.trim() || !form.celular.trim()) {
      setError('El nombre y el celular son obligatorios')
      return
    }

    try {
      setSaving(true)
      setError(null)
      await jefeService.create({
        nombre: form.nombre.trim(),
        celular: form.celular.trim(),
      })
      navigate('/jefes')
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setError(axiosErr.response?.data?.message || 'Error al crear jefe')
      } else {
        const message = err instanceof Error ? err.message : 'Error al crear jefe'
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
        onClick={() => navigate('/jefes')}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a jefes
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <UserCog className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-white">Nuevo Jefe de Comunidad</h1>
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
            <label className="block text-sm font-medium text-gray-300 mb-1">Celular</label>
            <input
              type="text"
              name="celular"
              value={form.celular}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Numero de celular"
            />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Crear Jefe
            </button>
            <button
              type="button"
              onClick={() => navigate('/jefes')}
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
