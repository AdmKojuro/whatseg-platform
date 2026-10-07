import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  UserCog,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Building2,
  Link2,
  Unlink,
} from 'lucide-react'
import { jefeService } from '../../services/jefe.service'
import { comunidadService } from '../../services/comunidad.service'
import type { Jefe } from '../../types/jefe'
import type { Comunidad } from '../../types/comunidad'

export default function JefeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [jefe, setJefe] = useState<Jefe | null>(null)
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Edit form
  const [editForm, setEditForm] = useState({
    nombre: '',
    celular: '',
  })
  const [saving, setSaving] = useState(false)

  // Assign community
  const [assignComunidadId, setAssignComunidadId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [unassigning, setUnassigning] = useState<string | null>(null)

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const fetchJefe = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      setError(null)
      const response = await jefeService.getById(id)
      const data = response.data
      setJefe(data)
      setEditForm({
        nombre: data.nombre,
        celular: data.celular,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar jefe'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchComunidades = useCallback(async () => {
    try {
      const response = await comunidadService.list()
      setComunidades(response.data)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchJefe()
    fetchComunidades()
  }, [fetchJefe, fetchComunidades])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return

    try {
      setSaving(true)
      setError(null)
      await jefeService.update(id, {
        nombre: editForm.nombre.trim(),
        celular: editForm.celular.trim(),
      })
      showSuccess('Jefe actualizado exitosamente')
      await fetchJefe()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setError(axiosErr.response?.data?.message || 'Error al actualizar jefe')
      } else {
        const message = err instanceof Error ? err.message : 'Error al actualizar jefe'
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAsignarComunidad = async () => {
    if (!id || !assignComunidadId) return

    try {
      setAssigning(true)
      setError(null)
      await jefeService.asignarComunidad(id, assignComunidadId)
      showSuccess('Comunidad asignada exitosamente')
      setAssignComunidadId('')
      await fetchJefe()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setError(axiosErr.response?.data?.message || 'Error al asignar comunidad')
      } else {
        const message = err instanceof Error ? err.message : 'Error al asignar comunidad'
        setError(message)
      }
    } finally {
      setAssigning(false)
    }
  }

  const handleDesasignarComunidad = async (comunidadId: string) => {
    if (!id) return

    try {
      setUnassigning(comunidadId)
      setError(null)
      await jefeService.desasignarComunidad(id, comunidadId)
      showSuccess('Comunidad desasignada exitosamente')
      await fetchJefe()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setError(axiosErr.response?.data?.message || 'Error al desasignar comunidad')
      } else {
        const message = err instanceof Error ? err.message : 'Error al desasignar comunidad'
        setError(message)
      }
    } finally {
      setUnassigning(null)
    }
  }

  // Filter out already-assigned communities from the select
  const assignedComunidadIds = new Set(
    jefe?.comunidades?.map((jc) => jc.comunidad_id) || []
  )
  const availableComunidades = comunidades.filter(
    (c) => !assignedComunidadIds.has(c.id)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    )
  }

  if (!jefe) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/jefes')}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>Jefe no encontrado</p>
        </div>
      </div>
    )
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
        <div>
          <h1 className="text-2xl font-bold text-white">{jefe.nombre}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">{jefe.celular}</span>
            {jefe.activo ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-400">
                Activo
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">
                Inactivo
              </span>
            )}
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
          <h3 className="text-lg font-semibold text-white mb-4">Informacion del Jefe</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">ID</dt>
              <dd className="font-mono text-xs text-white text-xs">{jefe.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Nombre</dt>
              <dd className="text-white">{jefe.nombre}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Celular</dt>
              <dd className="text-white">{jefe.celular}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Activo</dt>
              <dd className="text-white">{jefe.activo ? 'Si' : 'No'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Puede registrar</dt>
              <dd className="text-white">{jefe.puede_registrar ? 'Si' : 'No'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Comunidades</dt>
              <dd className="text-white">{jefe.comunidades?.length ?? 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Creado</dt>
              <dd className="text-white">
                {new Date(jefe.created_at).toLocaleDateString('es-ES')}
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
              <label className="block text-sm font-medium text-gray-300 mb-1">Celular</label>
              <input
                type="text"
                value={editForm.celular}
                onChange={(e) => setEditForm({ ...editForm, celular: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
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

        {/* Assigned communities */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-500" />
            Comunidades Asignadas
          </h3>

          {/* Assign new community */}
          <div className="flex gap-2 mb-4">
            <select
              value={assignComunidadId}
              onChange={(e) => setAssignComunidadId(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar comunidad para asignar...</option>
              {availableComunidades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.codigo})
                </option>
              ))}
            </select>
            <button
              onClick={handleAsignarComunidad}
              disabled={assigning || !assignComunidadId}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Asignar
            </button>
          </div>

          {/* List of assigned communities */}
          {jefe.comunidades && jefe.comunidades.length > 0 ? (
            <div className="space-y-2">
              {jefe.comunidades.map((jc) => (
                <div
                  key={jc.id}
                  className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="font-medium text-white text-sm">
                        {jc.comunidad?.nombre || 'Comunidad'}
                      </p>
                      {jc.comunidad?.codigo && (
                        <p className="text-xs text-gray-500">{jc.comunidad.codigo}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDesasignarComunidad(jc.comunidad_id)}
                    disabled={unassigning === jc.comunidad_id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {unassigning === jc.comunidad_id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Unlink className="w-3 h-3" />
                    )}
                    Desasignar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">
              Este jefe no tiene comunidades asignadas
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
