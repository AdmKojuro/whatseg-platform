import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { comunidadService } from '../../services/comunidad.service'
import { jefeService } from '../../services/jefe.service'
import type { Jefe } from '../../types/jefe'
import { DireccionAutocomplete } from '../../components/ui/DireccionAutocomplete'

export default function ComunidadCreatePage() {
  const navigate = useNavigate()
  const [jefes, setJefes] = useState<Jefe[]>([])

  const [form, setForm] = useState({
    nombre: '',
    codigo: '',
    direccion: '',
    latitud: '',
    longitud: '',
    jefe_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchJefes = useCallback(async () => {
    try {
      const response = await jefeService.list()
      setJefes(response.data)
    } catch {
      // silent - jefe list is supplementary
    }
  }, [])

  useEffect(() => {
    fetchJefes()
  }, [fetchJefes])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.nombre.trim() || !form.codigo.trim()) {
      setError('El nombre y el codigo son obligatorios')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const payload: {
        nombre: string
        codigo: string
        direccion?: string
        latitud?: number
        longitud?: number
      } = {
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim(),
      }

      if (form.direccion.trim()) payload.direccion = form.direccion.trim()
      if (form.latitud) payload.latitud = parseFloat(form.latitud)
      if (form.longitud) payload.longitud = parseFloat(form.longitud)

      const response = await comunidadService.create(payload)

      // If a jefe was selected, assign it to the new community
      if (form.jefe_id && response.data?.id) {
        try {
          await jefeService.asignarComunidad(form.jefe_id, response.data.id)
        } catch {
          // community created but jefe assignment failed - not critical
        }
      }

      navigate('/comunidades')
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setError(axiosErr.response?.data?.message || 'Error al crear comunidad')
      } else {
        const message = err instanceof Error ? err.message : 'Error al crear comunidad'
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
        onClick={() => navigate('/comunidades')}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a comunidades
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Building2 className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-white">Nueva Comunidad</h1>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nombre de la comunidad"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Codigo</label>
              <input
                type="text"
                name="codigo"
                value={form.codigo}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Codigo unico"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Direccion</label>
            <DireccionAutocomplete
              value={form.direccion}
              latitud={form.latitud}
              longitud={form.longitud}
              onChange={(dir, lat, lng) =>
                setForm({ ...form, direccion: dir, latitud: lat, longitud: lng })
              }
              placeholder="Buscar dirección..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Latitud</label>
              <input
                type="number"
                name="latitud"
                value={form.latitud}
                onChange={handleChange}
                step="any"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Auto al seleccionar dirección"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Longitud</label>
              <input
                type="number"
                name="longitud"
                value={form.longitud}
                onChange={handleChange}
                step="any"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Auto al seleccionar dirección"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Jefe de Comunidad (opcional)
            </label>
            <select
              name="jefe_id"
              value={form.jefe_id}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar jefe...</option>
              {jefes.map((jefe) => (
                <option key={jefe.id} value={jefe.id}>
                  {jefe.nombre} - {jefe.celular}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Crear Comunidad
            </button>
            <button
              type="button"
              onClick={() => navigate('/comunidades')}
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
