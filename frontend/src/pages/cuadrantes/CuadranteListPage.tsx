import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Link2,
  Search,
  AlertCircle,
  X,
  Building2,
} from 'lucide-react'
import { cuadranteService } from '../../services/cuadrante.service'
import { comunidadService } from '../../services/comunidad.service'
import type { Comunidad } from '../../types/comunidad'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Input } from '../../components/ui/Input'

const TIPO_LABELS: Record<string, string> = {
  POLICIA: 'Policía',
  BOMBEROS: 'Bomberos',
  MEDICA: 'Médica',
}

const TIPOS_DISPONIBLES = ['POLICIA', 'BOMBEROS', 'MEDICA'] as const

interface Cuadrante {
  id: string
  nombre: string
  email: string
  telefono?: string
  activo: boolean
  tipos_emergencia?: string[]
  comunidades?: { id: string; comunidad_id: string; comunidad?: { nombre: string } }[]
  created_at: string
}

export default function CuadranteListPage() {
  const [cuadrantes, setCuadrantes] = useState<Cuadrante[]>([])
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '' })
  const [formError, setFormError] = useState<string | null>(null)

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCuadrante, setEditingCuadrante] = useState<Cuadrante | null>(null)
  const [editData, setEditData] = useState({ nombre: '', email: '', activo: true, nuevaPassword: '', tipos_emergencia: [] as string[] })
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedCuadrante, setSelectedCuadrante] = useState<Cuadrante | null>(null)
  const [selectedComunidadId, setSelectedComunidadId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [desassigning, setDesassigning] = useState<string | null>(null)

  // Delete
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchCuadrantes = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await cuadranteService.list()
      setCuadrantes(data as unknown as Cuadrante[])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar cuadrantes'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchComunidades = useCallback(async () => {
    try {
      const { data } = await comunidadService.list()
      setComunidades(data as unknown as Comunidad[])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchCuadrantes()
    fetchComunidades()
  }, [fetchCuadrantes, fetchComunidades])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.nombre.trim() || !formData.email.trim() || !formData.password.trim()) {
      setFormError('Todos los campos son obligatorios')
      return
    }

    try {
      setCreating(true)
      await cuadranteService.create(formData)
      setShowCreateModal(false)
      setFormData({ nombre: '', email: '', password: '' })
      await fetchCuadrantes()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear cuadrante'
      setFormError(message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Estas seguro de eliminar este cuadrante?')) return

    try {
      setDeleting(id)
      await cuadranteService.delete(id)
      await fetchCuadrantes()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar cuadrante'
      setError(message)
    } finally {
      setDeleting(null)
    }
  }

  const handleAssignCommunity = async () => {
    if (!selectedCuadrante || !selectedComunidadId) return

    try {
      setAssigning(true)
      await cuadranteService.asignarComunidad(selectedCuadrante.id, selectedComunidadId)
      setShowAssignModal(false)
      setSelectedCuadrante(null)
      setSelectedComunidadId('')
      await fetchCuadrantes()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al asignar comunidad'
      setFormError(message)
    } finally {
      setAssigning(false)
    }
  }

  const openEditModal = (cuadrante: Cuadrante) => {
    setEditingCuadrante(cuadrante)
    // Empty tipos_emergencia means "no restriction" (all allowed) — pre-select all in the editor
    const tipos = cuadrante.tipos_emergencia && cuadrante.tipos_emergencia.length > 0
      ? cuadrante.tipos_emergencia
      : [...TIPOS_DISPONIBLES]
    setEditData({ nombre: cuadrante.nombre, email: cuadrante.email, activo: cuadrante.activo, nuevaPassword: '', tipos_emergencia: tipos })
    setEditError(null)
    setShowEditModal(true)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCuadrante) return
    setEditError(null)
    try {
      setSaving(true)
      // Base update (nombre, email, activo)
      await cuadranteService.update(editingCuadrante.id, {
        nombre: editData.nombre,
        email: editData.email,
        activo: editData.activo,
      })
      // Tipos de alarma — endpoint en backend-ext (requiere deploy al VPS)
      // Si todos los tipos están seleccionados, guardar [] = "sin restricción" (igual que el panel anterior)
      const tiposToSave = editData.tipos_emergencia.length === TIPOS_DISPONIBLES.length
        ? []
        : editData.tipos_emergencia
      try {
        await cuadranteService.updateTiposEmergenciaAdmin(editingCuadrante.id, tiposToSave)
      } catch {
        // silencioso hasta que el backend-ext esté actualizado en el VPS
      }
      // Contraseña opcional
      if (editData.nuevaPassword.trim()) {
        await cuadranteService.changePassword(editingCuadrante.id, { password: editData.nuevaPassword.trim() })
      }
      setShowEditModal(false)
      setEditingCuadrante(null)
      await fetchCuadrantes()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al actualizar cuadrante'
      setEditError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDesassignCommunity = async (comunidadId: string) => {
    if (!selectedCuadrante) return
    try {
      setDesassigning(comunidadId)
      await cuadranteService.desasignarComunidad(selectedCuadrante.id, comunidadId)
      // update local state immediately so list refreshes inside modal
      setSelectedCuadrante((prev) =>
        prev
          ? { ...prev, comunidades: prev.comunidades?.filter((c) => c.comunidad_id !== comunidadId) }
          : prev
      )
      await fetchCuadrantes()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al desasignar comunidad'
      setFormError(message)
    } finally {
      setDesassigning(null)
    }
  }

  const openAssignModal = (cuadrante: Cuadrante) => {
    // use latest data from cuadrantes list
    const fresh = cuadrantes.find((c) => c.id === cuadrante.id) ?? cuadrante
    setSelectedCuadrante(fresh)
    setSelectedComunidadId('')
    setFormError(null)
    setShowAssignModal(true)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const filtered = cuadrantes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.telefono || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-white">Cuadrantes</h1>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setFormData({ nombre: '', email: '', password: '' })
            setFormError(null)
            setShowCreateModal(true)
          }}
          icon={<Plus className="w-4 h-4" />}
        >
          Nuevo Cuadrante
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, email o telefono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto -mx-6 -my-4">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/40 border-b border-gray-700">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-300">Nombre</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-300">Email</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-300">Telefono</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-300">Comunidades</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-300">Tipos de Alarma</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-300">Registrado</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    No se encontraron cuadrantes
                  </td>
                </tr>
              ) : (
                filtered.map((cuadrante) => (
                  <tr key={cuadrante.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{cuadrante.nombre}</td>
                    <td className="px-6 py-4 text-gray-400">{cuadrante.email}</td>
                    <td className="px-6 py-4 text-gray-400">{cuadrante.telefono || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {cuadrante.comunidades && cuadrante.comunidades.length > 0 ? (
                          cuadrante.comunidades.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            >
                              <Building2 className="w-3 h-3" />
                              {c.comunidad?.nombre ?? c.comunidad_id.slice(0, 8)}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-xs">Sin asignar</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {cuadrante.tipos_emergencia && cuadrante.tipos_emergencia.length > 0 ? (
                          cuadrante.tipos_emergencia.map((tipo) => (
                            <Badge
                              key={tipo}
                              size="sm"
                              variant={
                                tipo === 'POLICIA'
                                  ? 'info'
                                  : tipo === 'BOMBEROS'
                                    ? 'warning'
                                    : 'danger'
                              }
                            >
                              {TIPO_LABELS[tipo] ?? tipo}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">Todos (sin restricción)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      {formatDate(cuadrante.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(cuadrante)}
                          className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openAssignModal(cuadrante)}
                          className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors"
                          title="Asignar comunidad"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cuadrante.id)}
                          disabled={deleting === cuadrante.id}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                          title="Eliminar"
                        >
                          {deleting === cuadrante.id ? (
                            <Spinner size="sm" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Editar: ${editingCuadrante?.nombre || ''}`}
      >
        <form onSubmit={handleEdit} className="space-y-4">
          {editError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{editError}</p>
            </div>
          )}
          <Input
            label="Nombre"
            value={editData.nombre}
            onChange={(e) => setEditData({ ...editData, nombre: e.target.value })}
            placeholder="Nombre del cuadrante"
          />
          <Input
            label="Email"
            type="email"
            value={editData.email}
            onChange={(e) => setEditData({ ...editData, email: e.target.value })}
            placeholder="email@ejemplo.com"
          />
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-300">Estado</label>
            <button
              type="button"
              onClick={() => setEditData({ ...editData, activo: !editData.activo })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                editData.activo ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  editData.activo ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-400">{editData.activo ? 'Activo' : 'Inactivo'}</span>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Tipos de Alarma</label>
            <div className="flex flex-wrap gap-2">
              {TIPOS_DISPONIBLES.map((tipo) => {
                const checked = editData.tipos_emergencia.includes(tipo)
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => {
                      const next = checked
                        ? editData.tipos_emergencia.filter((t) => t !== tipo)
                        : [...editData.tipos_emergencia, tipo]
                      setEditData({ ...editData, tipos_emergencia: next })
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      tipo === 'POLICIA'
                        ? checked
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                          : 'bg-transparent border-gray-600 text-gray-500 hover:border-gray-500'
                        : tipo === 'BOMBEROS'
                          ? checked
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                            : 'bg-transparent border-gray-600 text-gray-500 hover:border-gray-500'
                          : checked
                            ? 'bg-red-500/20 border-red-500/50 text-red-300'
                            : 'bg-transparent border-gray-600 text-gray-500 hover:border-gray-500'
                    }`}
                  >
                    {checked && <span>✓</span>}
                    {TIPO_LABELS[tipo]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <p className="text-xs text-gray-500 mb-3">Dejar vacío para no cambiar la contraseña</p>
            <Input
              label="Nueva contraseña"
              type="password"
              value={editData.nuevaPassword}
              onChange={(e) => setEditData({ ...editData, nuevaPassword: e.target.value })}
              placeholder="Nueva contraseña (opcional)"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuevo Cuadrante"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{formError}</p>
            </div>
          )}
          <Input
            label="Nombre"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            placeholder="Nombre del cuadrante"
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@ejemplo.com"
          />
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Contrasena"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={creating}>
              Crear
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Community Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={`Comunidades — ${selectedCuadrante?.nombre || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{formError}</p>
            </div>
          )}

          {/* Assigned communities */}
          {selectedCuadrante?.comunidades && selectedCuadrante.comunidades.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Ya asignadas
              </p>
              <div className="space-y-2">
                {selectedCuadrante.comunidades.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm text-white">
                        {c.comunidad?.nombre ?? c.comunidad_id.slice(0, 8)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDesassignCommunity(c.comunidad_id)}
                      disabled={desassigning === c.comunidad_id}
                      className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors disabled:opacity-40"
                      title="Desasignar"
                    >
                      {desassigning === c.comunidad_id ? (
                        <Spinner size="sm" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-700 mt-4 pt-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                  Agregar otra comunidad
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Comunidad</label>
            <select
              value={selectedComunidadId}
              onChange={(e) => setSelectedComunidadId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar comunidad...</option>
              {comunidades
                .filter((c) => !selectedCuadrante?.comunidades?.some((ac) => ac.comunidad_id === c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.codigo})
                  </option>
                ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>
              Cerrar
            </Button>
            <Button
              variant="primary"
              onClick={handleAssignCommunity}
              loading={assigning}
              disabled={!selectedComunidadId}
            >
              Asignar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
