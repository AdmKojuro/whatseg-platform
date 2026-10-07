import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Building2,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Users,
  UserCheck,
  Cpu,
  MapPin,
  Info,
  Bell,
  Plus,
  X,
  Phone,
  Clock,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  UserMinus,
  Monitor,
} from 'lucide-react'
import { comunidadService } from '../../services/comunidad.service'
import { clienteService } from '../../services/cliente.service'
import { dispositivoService } from '../../services/dispositivo.service'
import { dashboardService } from '../../services/dashboard.service'
import { activacionService } from '../../services/activacion.service'
import { jefeService } from '../../services/jefe.service'
import { extApi } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import type { Comunidad } from '../../types/comunidad'
import type { Cliente } from '../../types/cliente'
import type { Dispositivo } from '../../types/dispositivo'
import { getPlataforma } from '../../types/dispositivo'
import type { Activacion } from '../../types/activacion'
import type { Jefe } from '../../types/jefe'
import { DireccionAutocomplete } from '../../components/ui/DireccionAutocomplete'

type TabKey = 'info' | 'jefes' | 'clientes' | 'dispositivos' | 'activaciones'

export default function ComunidadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.rol === 'ADMIN'

  const [comunidad, setComunidad] = useState<Comunidad | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [jefes, setJefes] = useState<any[]>([])
  const [activaciones, setActivaciones] = useState<Activacion[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingClientes, setLoadingClientes] = useState(false)
  const [loadingDispositivos, setLoadingDispositivos] = useState(false)
  const [loadingJefes, setLoadingJefes] = useState(false)
  const [loadingActivaciones, setLoadingActivaciones] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('info')

  // Edit form
  const [editForm, setEditForm] = useState({
    nombre: '',
    codigo: '',
    direccion: '',
    latitud: '',
    longitud: '',
  })
  const [saving, setSaving] = useState(false)

  // Create client modal
  const [showCreateCliente, setShowCreateCliente] = useState(false)
  const [createClienteForm, setCreateClienteForm] = useState({ nombre: '', celular: '', identificador: '' })
  const [creatingCliente, setCreatingCliente] = useState(false)

  // Edit / delete / toggle cliente
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [editClienteForm, setEditClienteForm] = useState({ nombre: '', celular: '', identificador: '' })
  const [savingCliente, setSavingCliente] = useState(false)
  const [deleteClienteId, setDeleteClienteId] = useState<string | null>(null)
  const [deletingCliente, setDeletingCliente] = useState(false)
  const [togglingClienteId, setTogglingClienteId] = useState<string | null>(null)
  const [desasignarClienteId, setDesasignarClienteId] = useState<string | null>(null)
  const [desasignandoCliente, setDesasignandoCliente] = useState(false)

  // Activacion evidence modal
  const [selectedActivacion, setSelectedActivacion] = useState<Activacion | null>(null)
  const [deletingActivacionId, setDeletingActivacionId] = useState<string | null>(null)

  // Delete / toggle comunidad
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingComunidad, setDeletingComunidad] = useState(false)
  const [togglingActiva, setTogglingActiva] = useState(false)

  // Assign device modal
  const [showAsignarDispositivo, setShowAsignarDispositivo] = useState(false)
  const [todosDispositivos, setTodosDispositivos] = useState<Dispositivo[]>([])
  const [loadingTodosDisp, setLoadingTodosDisp] = useState(false)
  const [asignandoDispositivoId, setAsignandoDispositivoId] = useState<string | null>(null)
  const [desasignandoDispositivoId, setDesasignandoDispositivoId] = useState<string | null>(null)
  const [dispSearch, setDispSearch] = useState('')

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleCreateCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      setCreatingCliente(true)
      await clienteService.create({
        nombre: createClienteForm.nombre.trim(),
        celular: createClienteForm.celular.trim(),
        identificador: createClienteForm.identificador.trim(),
        comunidad_id: id,
      })
      setShowCreateCliente(false)
      setCreateClienteForm({ nombre: '', celular: '', identificador: '' })
      showSuccess('Cliente creado exitosamente')
      await fetchClientes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear cliente'
      setError(msg)
    } finally {
      setCreatingCliente(false)
    }
  }

  const openEditCliente = (c: Cliente) => {
    setEditingCliente(c)
    setEditClienteForm({ nombre: c.nombre, celular: c.celular, identificador: c.identificador })
  }

  const handleSaveCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCliente) return
    try {
      setSavingCliente(true)
      await clienteService.update(editingCliente.id, {
        nombre: editClienteForm.nombre.trim(),
        celular: editClienteForm.celular.trim(),
        identificador: editClienteForm.identificador.trim(),
      })
      setEditingCliente(null)
      showSuccess('Cliente actualizado')
      await fetchClientes()
    } catch {
      setError('Error al actualizar cliente')
    } finally {
      setSavingCliente(false)
    }
  }

  const handleToggleCliente = async (c: Cliente) => {
    try {
      setTogglingClienteId(c.id)
      if (c.activo) await clienteService.desactivar(c.id)
      else await clienteService.activar(c.id)
      await fetchClientes()
    } catch {
      setError('Error al cambiar estado del cliente')
    } finally {
      setTogglingClienteId(null)
    }
  }

  const handleDeleteActivacion = async (activacionId: string) => {
    if (!window.confirm('¿Eliminar esta activación? Esta acción no se puede deshacer.')) return
    try {
      setDeletingActivacionId(activacionId)
      await activacionService.delete(activacionId)
      setActivaciones(prev => prev.filter(a => a.id !== activacionId))
    } catch {
      showSuccess('Error al eliminar la activación')
    } finally {
      setDeletingActivacionId(null)
    }
  }

  const handleDeleteCliente = async () => {
    if (!deleteClienteId) return
    try {
      setDeletingCliente(true)
      await clienteService.delete(deleteClienteId)
      setDeleteClienteId(null)
      showSuccess('Cliente eliminado')
      await fetchClientes()
    } catch {
      setError('Error al eliminar cliente')
    } finally {
      setDeletingCliente(false)
    }
  }

  const handleDesasignarCliente = async () => {
    if (!desasignarClienteId) return
    try {
      setDesasignandoCliente(true)
      await clienteService.desasignar(desasignarClienteId, id!)
      setDesasignarClienteId(null)
      showSuccess('Cliente desasignado de la comunidad')
      await fetchClientes()
    } catch {
      setError('Error al desasignar cliente')
    } finally {
      setDesasignandoCliente(false)
    }
  }

  const handleDeleteComunidad = async () => {
    if (!id) return
    try {
      setDeletingComunidad(true)
      await comunidadService.delete(id)
      navigate('/comunidades')
    } catch {
      setError('Error al eliminar comunidad')
      setDeletingComunidad(false)
      setConfirmDelete(false)
    }
  }

  const handleToggleActiva = async () => {
    if (!id || !comunidad) return
    try {
      setTogglingActiva(true)
      await comunidadService.update(id, { activa: !comunidad.activa } as Partial<Comunidad>)
      showSuccess(`Comunidad ${comunidad.activa ? 'desactivada' : 'activada'} exitosamente`)
      await fetchComunidad()
    } catch {
      setError('Error al cambiar estado de la comunidad')
    } finally {
      setTogglingActiva(false)
    }
  }

  const handleOpenAsignarDispositivo = async () => {
    setShowAsignarDispositivo(true)
    setDispSearch('')
    try {
      setLoadingTodosDisp(true)
      const res = await dispositivoService.list()
      const all: Dispositivo[] = res.data
      setTodosDispositivos(all.filter((d) => !d.comunidad_id))
    } catch {
      setError('Error al cargar dispositivos disponibles')
    } finally {
      setLoadingTodosDisp(false)
    }
  }

  const handleAsignarDispositivo = async (dispositivo: Dispositivo) => {
    if (!id) return
    try {
      setAsignandoDispositivoId(dispositivo.id)
      await dispositivoService.asignar(dispositivo.id, {
        comunidad_id: id,
        nombre: dispositivo.nombre || dispositivo.id_interno || dispositivo.id,
      })
      setShowAsignarDispositivo(false)
      showSuccess('Dispositivo asignado a la comunidad')
      await fetchDispositivos()
    } catch {
      setError('Error al asignar dispositivo')
    } finally {
      setAsignandoDispositivoId(null)
    }
  }

  const handleDesasignarDispositivo = async (dispositivo: Dispositivo) => {
    if (!window.confirm(`¿Desasignar "${dispositivo.nombre || dispositivo.id}" de esta comunidad?`)) return
    try {
      setDesasignandoDispositivoId(dispositivo.id)
      await dispositivoService.desasignar(dispositivo.id)
      showSuccess('Dispositivo desasignado')
      await fetchDispositivos()
    } catch {
      setError('Error al desasignar dispositivo')
    } finally {
      setDesasignandoDispositivoId(null)
    }
  }

  const fetchComunidad = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      setError(null)
      const response = await comunidadService.getById(id)
      const data = response.data
      setComunidad(data)
      setEditForm({
        nombre: data.nombre,
        codigo: data.codigo,
        direccion: data.direccion || '',
        latitud: data.latitud?.toString() || '',
        longitud: data.longitud?.toString() || '',
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar comunidad'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchClientes = useCallback(async () => {
    if (!id) return
    try {
      setLoadingClientes(true)
      if (isAdmin) {
        const res = await extApi.get<Cliente[]>('/ext/admin-app/mis-clientes')
        setClientes(res.data ?? [])
      } else {
        const response = await clienteService.list({ comunidad_id: id })
        const data: Cliente[] = response.data
        const filtered = data.filter(
          (c) => !c.comunidades || c.comunidades.some((cc) => cc.comunidad_id === id)
        )
        setClientes(filtered)
      }
    } catch {
      // silent
    } finally {
      setLoadingClientes(false)
    }
  }, [id, isAdmin])

  const fetchDispositivos = useCallback(async () => {
    if (!id) return
    try {
      setLoadingDispositivos(true)
      if (isAdmin) {
        const res = await extApi.get<Dispositivo[]>('/ext/admin-app/mis-dispositivos')
        setDispositivos(res.data ?? [])
      } else {
        const response = await dispositivoService.list()
        const allDispositivos: Dispositivo[] = response.data
        const filtered = allDispositivos.filter((d) => d.comunidad_id === id)
        setDispositivos(filtered)
      }
    } catch {
      // silent
    } finally {
      setLoadingDispositivos(false)
    }
  }, [id, isAdmin])

  const fetchJefes = useCallback(async () => {
    if (!id) return
    try {
      setLoadingJefes(true)
      if (isAdmin) {
        const res = await extApi.get<any[]>('/ext/admin-app/mis-jefes')
        setJefes(res.data ?? [])
      } else {
        const res = await jefeService.list()
        const allJefes = res.data as unknown as Jefe[]
        setJefes(allJefes.filter((j) => j.comunidades?.some((jc) => jc.comunidad_id === id)))
      }
    } catch {
      // silent
    } finally {
      setLoadingJefes(false)
    }
  }, [id, isAdmin])

  useEffect(() => {
    fetchComunidad()
  }, [fetchComunidad])

  const fetchActivaciones = useCallback(async () => {
    if (!id) return
    try {
      setLoadingActivaciones(true)
      let data: Activacion[] = []
      if (isAdmin) {
        const res = await dashboardService.getActivacionesRecientesAdmin()
        data = res.data ?? []
      } else {
        const res = await dashboardService.getActivacionesFiltradas({ comunidad_id: id })
        // Backend returns { data: [...], total, page, limit } — extract the array
        data = (res.data as any)?.data ?? []
      }
      setActivaciones(data)
    } catch {
      // silent
    } finally {
      setLoadingActivaciones(false)
    }
  }, [id, isAdmin])

  // Load all tab data eagerly so counts are correct from the start
  useEffect(() => {
    fetchClientes()
    fetchDispositivos()
    fetchActivaciones()
    fetchJefes()
  }, [fetchClientes, fetchDispositivos, fetchActivaciones, fetchJefes])

  // Auto-refresh activaciones y dispositivos cada 5 s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActivaciones()
      fetchDispositivos()
    }, 5_000)
    return () => clearInterval(interval)
  }, [fetchActivaciones, fetchDispositivos])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return

    try {
      setSaving(true)
      setError(null)

      const payload: {
        nombre?: string
        codigo?: string
        direccion?: string
        latitud?: number
        longitud?: number
      } = {
        nombre: editForm.nombre.trim(),
        codigo: editForm.codigo.trim(),
      }

      if (editForm.direccion.trim()) payload.direccion = editForm.direccion.trim()
      if (editForm.latitud) payload.latitud = parseFloat(editForm.latitud)
      if (editForm.longitud) payload.longitud = parseFloat(editForm.longitud)

      await comunidadService.update(id, payload)
      showSuccess('Comunidad actualizada exitosamente')
      await fetchComunidad()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setError(axiosErr.response?.data?.message || 'Error al actualizar comunidad')
      } else {
        const message = err instanceof Error ? err.message : 'Error al actualizar comunidad'
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    )
  }

  if (!comunidad) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/comunidades')}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>Comunidad no encontrada</p>
        </div>
      </div>
    )
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'info',         label: 'Informacion',                                                        icon: <Info className="w-4 h-4" /> },
    { key: 'jefes',       label: `Jefes (${loadingJefes ? '…' : jefes.length})`,                      icon: <Users className="w-4 h-4" /> },
    { key: 'clientes',    label: `Clientes (${loadingClientes ? '…' : clientes.length})`,              icon: <UserCheck className="w-4 h-4" /> },
    { key: 'dispositivos', label: `Dispositivos (${loadingDispositivos ? '…' : dispositivos.length})`, icon: <Cpu className="w-4 h-4" /> },
    { key: 'activaciones', label: `Activaciones (${loadingActivaciones ? '…' : activaciones.length})`, icon: <Bell className="w-4 h-4" /> },
  ]

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-white">{comunidad.nombre}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">{comunidad.codigo}</span>
              {comunidad.activa ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                  Activa
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">
                  Inactiva
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/guardia')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Monitor className="w-3.5 h-3.5" />
            Ver en monitor
          </button>
          <button
            onClick={handleToggleActiva}
            disabled={togglingActiva}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50 ${
              comunidad.activa
                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            {togglingActiva
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : comunidad.activa
              ? <PowerOff className="w-3.5 h-3.5" />
              : <Power className="w-3.5 h-3.5" />}
            {comunidad.activa ? 'Desactivar' : 'Activar'}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar
          </button>
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

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-700 p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Info section */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Datos de la Comunidad</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">ID</dt>
                <dd className="font-mono text-xs text-white text-xs">{comunidad.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Nombre</dt>
                <dd className="text-white">{comunidad.nombre}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Codigo</dt>
                <dd className="text-white">{comunidad.codigo}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Direccion</dt>
                <dd className="text-white flex items-center gap-1">
                  {comunidad.direccion ? (
                    <>
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {comunidad.direccion}
                    </>
                  ) : (
                    '-'
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Coordenadas</dt>
                <dd className="font-mono text-xs text-white text-xs">
                  {comunidad.latitud && comunidad.longitud
                    ? `${comunidad.latitud}, ${comunidad.longitud}`
                    : '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Clientes</dt>
                <dd className="text-white">{loadingClientes ? '…' : clientes.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Dispositivos</dt>
                <dd className="text-white">{loadingDispositivos ? '…' : dispositivos.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Creado</dt>
                <dd className="text-white">
                  {new Date(comunidad.created_at).toLocaleDateString('es-ES')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Edit form */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Editar Comunidad</h3>
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
                <label className="block text-sm font-medium text-gray-300 mb-1">Codigo</label>
                <input
                  type="text"
                  value={editForm.codigo}
                  onChange={(e) => setEditForm({ ...editForm, codigo: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Direccion</label>
                <DireccionAutocomplete
                  value={editForm.direccion}
                  latitud={editForm.latitud}
                  longitud={editForm.longitud}
                  onChange={(dir, lat, lng) =>
                    setEditForm({ ...editForm, direccion: dir, latitud: lat, longitud: lng })
                  }
                  placeholder="Buscar dirección..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Latitud</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.latitud}
                    onChange={(e) => setEditForm({ ...editForm, latitud: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Auto"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Longitud</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.longitud}
                    onChange={(e) => setEditForm({ ...editForm, longitud: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Auto"
                  />
                </div>
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
        </div>
      )}

      {activeTab === 'clientes' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700">
            <span className="text-sm text-gray-400">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''}</span>
            <button
              onClick={() => setShowCreateCliente(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear Cliente
            </button>
          </div>
          {loadingClientes ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700/40 border-b border-gray-700">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Nombre</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Celular</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Identificador</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Estado</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Creado</th>
                    <th className="text-right px-6 py-3 font-semibold text-gray-300">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {clientes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500">
                        No hay clientes en esta comunidad
                      </td>
                    </tr>
                  ) : (
                    clientes.map((cliente) => (
                      <tr key={cliente.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{cliente.nombre}</td>
                        <td className="px-6 py-4 text-gray-400">{cliente.celular}</td>
                        <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                          {cliente.identificador}
                        </td>
                        <td className="px-6 py-4">
                          {cliente.activo ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                          {new Date(cliente.created_at).toLocaleDateString('es-ES')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditCliente(cliente)}
                              title="Editar"
                              className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleCliente(cliente)}
                              disabled={togglingClienteId === cliente.id}
                              title={cliente.activo ? 'Desactivar' : 'Activar'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                cliente.activo
                                  ? 'text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/20'
                                  : 'text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/20'
                              }`}
                            >
                              {togglingClienteId === cliente.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Power className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => setDesasignarClienteId(cliente.id)}
                              title="Desasignar de comunidad"
                              className="p-1.5 text-gray-500 hover:text-orange-400 hover:bg-orange-500/20 rounded-lg transition-colors"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteClienteId(cliente.id)}
                              title="Eliminar"
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'jefes' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {loadingJefes ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700/40 border-b border-gray-700">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Nombre</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Celular</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Estado</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Creado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {jefes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-gray-500">
                        No hay jefes asignados a esta comunidad
                      </td>
                    </tr>
                  ) : (
                    jefes.map((j) => (
                      <tr key={j.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{j.nombre}</td>
                        <td className="px-6 py-4 text-gray-400">{j.celular}</td>
                        <td className="px-6 py-4">
                          {j.activo ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">Activo</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">Inactivo</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                          {new Date(j.created_at).toLocaleDateString('es-ES')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'activaciones' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {loadingActivaciones ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700/40 border-b border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-300">Usuario</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-300">Celular</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-300">ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-300">Dispositivo</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-300">Resultado</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-300">Foto</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-300">Fecha</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {activaciones.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-500">
                        No hay activaciones recientes
                      </td>
                    </tr>
                  ) : (
                    activaciones.map((a) => {
                      const foto = a.snapshot_url || a.snapshot_urls?.[0]
                      return (
                        <tr key={a.id} className="hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-2 font-medium text-white">
                            {a.cliente?.nombre ?? <span className="text-gray-500">—</span>}
                          </td>
                          <td className="px-4 py-2 text-gray-400 text-xs whitespace-nowrap">
                            {a.cliente?.celular ?? '—'}
                          </td>
                          <td className="px-4 py-2">
                            {a.cliente?.identificador ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
                                {a.cliente.identificador}
                              </span>
                            ) : (
                              <span className="text-gray-500 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-400 text-xs">
                            {a.dispositivo?.nombre ?? a.dispositivo_id?.slice(0, 8) ?? '—'}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              a.resultado === 'EXITOSO'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : a.resultado === 'FALLIDO'
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                            }`}>
                              {a.resultado}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {foto ? (
                              <img
                                src={foto}
                                alt="snapshot"
                                className="h-10 w-14 object-cover rounded border border-gray-700 cursor-pointer hover:opacity-80 hover:border-blue-500 transition-all"
                                onClick={() => setSelectedActivacion(a)}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                            ) : (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-400 whitespace-nowrap text-xs">
                            {new Date(a.created_at).toLocaleString('es-ES')}
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => handleDeleteActivacion(a.id)}
                              disabled={deletingActivacionId === a.id}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                              title="Eliminar activación"
                            >
                              {deletingActivacionId === a.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'dispositivos' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700">
            <span className="text-sm text-gray-400">{dispositivos.length} dispositivo{dispositivos.length !== 1 ? 's' : ''}</span>
            {!isAdmin && (
              <button
                onClick={handleOpenAsignarDispositivo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Asignar dispositivo
              </button>
            )}
          </div>
          {loadingDispositivos ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700/40 border-b border-gray-700">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Nombre</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Tipo</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Estado</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Configurado</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-300">Creado</th>
                    {!isAdmin && <th className="text-right px-6 py-3 font-semibold text-gray-300">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {dispositivos.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 6} className="text-center py-12 text-gray-500">
                        No hay dispositivos en esta comunidad
                      </td>
                    </tr>
                  ) : (
                    dispositivos.map((dispositivo) => (
                      <tr
                        key={dispositivo.id}
                        className="hover:bg-gray-700/30 transition-colors"
                      >
                        <td
                          className="px-6 py-4 font-medium text-white cursor-pointer"
                          onClick={() => navigate(`/dispositivos/${dispositivo.id}`)}
                        >
                          {dispositivo.nombre || 'Sin nombre'}
                        </td>
                        <td
                          className="px-6 py-4 text-gray-400 cursor-pointer"
                          onClick={() => navigate(`/dispositivos/${dispositivo.id}`)}
                        >{dispositivo.tipo || '-'}</td>
                        <td
                          className="px-6 py-4 cursor-pointer"
                          onClick={() => navigate(`/dispositivos/${dispositivo.id}`)}
                        >
                          {dispositivo.online ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">
                              Offline
                            </span>
                          )}
                        </td>
                        <td
                          className="px-6 py-4 cursor-pointer"
                          onClick={() => navigate(`/dispositivos/${dispositivo.id}`)}
                        >
                          {dispositivo.configurado ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <span className="text-gray-400 text-xs">No</span>
                          )}
                        </td>
                        <td
                          className="px-6 py-4 text-gray-400 whitespace-nowrap cursor-pointer"
                          onClick={() => navigate(`/dispositivos/${dispositivo.id}`)}
                        >
                          {new Date(dispositivo.created_at).toLocaleDateString('es-ES')}
                        </td>
                        {!isAdmin && (
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDesasignarDispositivo(dispositivo)}
                              disabled={desasignandoDispositivoId === dispositivo.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Desasignar de esta comunidad"
                            >
                              {desasignandoDispositivoId === dispositivo.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <UserMinus className="w-3.5 h-3.5" />}
                              Desasignar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Asignar Dispositivo ───────────────────────────────── */}
      {showAsignarDispositivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Asignar dispositivo</h2>
              <button onClick={() => setShowAsignarDispositivo(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre o plataforma..."
              value={dispSearch}
              onChange={(e) => setDispSearch(e.target.value)}
              className="w-full px-3 py-2 mb-4 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {loadingTodosDisp ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                {todosDispositivos.filter((d) => {
                  const q = dispSearch.toLowerCase()
                  return !q
                    || (d.nombre || '').toLowerCase().includes(q)
                    || getPlataforma(d).toLowerCase().includes(q)
                    || (d.id_interno || '').toLowerCase().includes(q)
                }).length === 0 ? (
                  <p className="text-center text-gray-500 py-8 text-sm">
                    {todosDispositivos.length === 0
                      ? 'No hay dispositivos sin asignar disponibles'
                      : 'No se encontraron dispositivos con ese filtro'}
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-700/40">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-gray-400">Nombre</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-400">Plataforma</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-400">Estado</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {todosDispositivos
                        .filter((d) => {
                          const q = dispSearch.toLowerCase()
                          return !q
                            || (d.nombre || '').toLowerCase().includes(q)
                            || getPlataforma(d).toLowerCase().includes(q)
                            || (d.id_interno || '').toLowerCase().includes(q)
                        })
                        .map((d) => (
                          <tr key={d.id} className="hover:bg-gray-700/30 transition-colors">
                            <td className="px-4 py-3 text-white font-medium">{d.nombre || 'Sin nombre'}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{getPlataforma(d)}</td>
                            <td className="px-4 py-3">
                              {d.online ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">Online</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">Offline</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleAsignarDispositivo(d)}
                                disabled={asignandoDispositivoId === d.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                              >
                                {asignandoDispositivoId === d.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Plus className="w-3.5 h-3.5" />}
                                Asignar
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Editar Cliente ───────────────────────────────────── */}
      {editingCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Editar Cliente</h2>
              <button onClick={() => setEditingCliente(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCliente} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={editClienteForm.nombre}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Celular</label>
                <input
                  type="text"
                  required
                  value={editClienteForm.celular}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, celular: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Identificador</label>
                <input
                  type="text"
                  required
                  value={editClienteForm.identificador}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, identificador: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingCliente(null)}
                  className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={savingCliente}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50">
                  {savingCliente && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar Eliminar Cliente ────────────────────────── */}
      {deleteClienteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Eliminar cliente</h2>
            <p className="text-sm text-gray-400 mb-6">
              ¿Confirmas que deseas eliminar este cliente? Esta accion no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteClienteId(null)}
                className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                Cancelar
              </button>
              <button onClick={handleDeleteCliente} disabled={deletingCliente}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                {deletingCliente && <Loader2 className="w-4 h-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar Desasignar Cliente ─────────────────────── */}
      {desasignarClienteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Desasignar cliente</h2>
            <p className="text-sm text-gray-400 mb-6">
              El cliente sera removido de esta comunidad pero no sera eliminado del sistema. ¿Deseas continuar?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDesasignarClienteId(null)}
                className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                Cancelar
              </button>
              <button onClick={handleDesasignarCliente} disabled={desasignandoCliente}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50">
                {desasignandoCliente && <Loader2 className="w-4 h-4 animate-spin" />}
                Desasignar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Crear Cliente ─────────────────────────────────────── */}
      {showCreateCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Crear Cliente</h2>
              <button onClick={() => setShowCreateCliente(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCliente} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={createClienteForm.nombre}
                  onChange={(e) => setCreateClienteForm({ ...createClienteForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Celular</label>
                <input
                  type="text"
                  required
                  value={createClienteForm.celular}
                  onChange={(e) => setCreateClienteForm({ ...createClienteForm, celular: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+57..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Identificador</label>
                <input
                  type="text"
                  required
                  value={createClienteForm.identificador}
                  onChange={(e) => setCreateClienteForm({ ...createClienteForm, identificador: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ej. SUPERVISOR CC02"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCliente(false)}
                  className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingCliente}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {creatingCliente && <Loader2 className="w-4 h-4 animate-spin" />}
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar Eliminar Comunidad ─────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Eliminar comunidad</h2>
            <p className="text-sm text-gray-400 mb-1">
              ¿Confirmas que deseas eliminar <span className="text-white font-medium">{comunidad.nombre}</span>?
            </p>
            <p className="text-xs text-red-400 mb-6">Esta accion eliminara todos los datos asociados y no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                Cancelar
              </button>
              <button onClick={handleDeleteComunidad} disabled={deletingComunidad}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                {deletingComunidad && <Loader2 className="w-4 h-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Evidencia de Activacion ──────────────────────────── */}
      {selectedActivacion && (() => {
        const a = selectedActivacion
        const foto = a.snapshot_url || a.snapshot_urls?.[0]
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
            onClick={() => setSelectedActivacion(null)}
          >
            <div
              className="flex rounded-xl overflow-hidden shadow-2xl max-w-4xl w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image */}
              <div className="flex-1 bg-black flex items-center justify-center min-h-[400px]">
                {foto ? (
                  <img src={foto} alt="evidencia" className="w-full h-full object-contain max-h-[80vh]" />
                ) : (
                  <span className="text-gray-600 text-sm">Sin imagen</span>
                )}
              </div>

              {/* Info panel */}
              <div className="w-72 bg-gray-800 p-6 flex flex-col gap-4 relative">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">Evidencia de activacion</h3>
                  <button
                    onClick={() => setSelectedActivacion(null)}
                    className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Cliente
                    </p>
                    <p className="text-white font-medium">{a.cliente?.nombre ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Celular
                    </p>
                    <p className="text-gray-300">{a.cliente?.celular ?? '—'}</p>
                  </div>
                  {a.cliente?.identificador && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-0.5">Identificador</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
                        {a.cliente.identificador}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> Dispositivo
                    </p>
                    <p className="text-gray-300">{a.dispositivo?.nombre ?? '—'}</p>
                  </div>
                  {a.comunidad?.nombre && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> Comunidad
                      </p>
                      <p className="text-gray-300">{a.comunidad.nombre}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Resultado</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      a.resultado === 'EXITOSO'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : a.resultado === 'FALLIDO'
                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                    }`}>
                      {a.resultado}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Fecha
                    </p>
                    <p className="text-gray-300">{new Date(a.created_at).toLocaleString('es-ES')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
