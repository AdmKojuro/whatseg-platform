import { useState, useEffect, useCallback } from 'react'
import {
  UserCog, Plus, Search, Trash2, Loader2, AlertCircle,
  Building2, Link2, Unlink, CheckCircle2, Pencil, X, Save,
  Phone, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { jefeService } from '../../services/jefe.service'
import { comunidadService } from '../../services/comunidad.service'
import type { Jefe } from '../../types/jefe'
import type { Comunidad } from '../../types/comunidad'

const PAGE_SIZE = 10

export default function JefeListPage() {
  const [jefes, setJefes] = useState<Jefe[]>([])
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [selected, setSelected] = useState<Jefe | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [toggling, setToggling] = useState<'activo' | 'registro' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ nombre: '', celular: '' })
  const [saving, setSaving] = useState(false)

  const [assignId, setAssignId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [unassigningId, setUnassigningId] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ nombre: '', celular: '' })
  const [creating, setCreating] = useState(false)

  const showMsg = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const fetchJefes = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [jefesRes, comsRes] = await Promise.all([
        jefeService.list(),
        comunidadService.list(),
      ])
      setJefes(jefesRes.data)
      setComunidades(comsRes.data)
    } catch {
      setError('Error al cargar jefes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchJefes() }, [fetchJefes])

  const loadDetail = async (jefe: Jefe) => {
    setSelected(jefe)
    setConfirmDelete(false)
    setShowEdit(false)
    setAssignId('')
    try {
      setDetailLoading(true)
      const res = await jefeService.getById(jefe.id)
      setSelected(res.data)
    } catch {
      // keep selected with list data
    } finally {
      setDetailLoading(false)
    }
  }

  const handleToggleActivo = async () => {
    if (!selected) return
    try {
      setToggling('activo')
      setError(null)
      await jefeService.update(selected.id, { activo: !selected.activo })
      const updated = { ...selected, activo: !selected.activo }
      setSelected(updated)
      setJefes(prev => prev.map(j => j.id === selected.id ? { ...j, activo: updated.activo } : j))
      showMsg(updated.activo ? 'Jefe activado' : 'Jefe desactivado')
    } catch { setError('Error al cambiar estado') }
    finally { setToggling(null) }
  }

  const handleToggleRegistro = async () => {
    if (!selected) return
    try {
      setToggling('registro')
      setError(null)
      await jefeService.update(selected.id, { puede_registrar: !selected.puede_registrar })
      const updated = { ...selected, puede_registrar: !selected.puede_registrar }
      setSelected(updated)
      setJefes(prev => prev.map(j => j.id === selected.id ? { ...j, puede_registrar: updated.puede_registrar } : j))
      showMsg(updated.puede_registrar ? 'Registro habilitado' : 'Registro revocado')
    } catch { setError('Error al cambiar registro') }
    finally { setToggling(null) }
  }

  const handleDelete = async () => {
    if (!selected) return
    try {
      setDeleting(true)
      setError(null)
      await jefeService.delete(selected.id)
      setJefes(prev => prev.filter(j => j.id !== selected.id))
      setSelected(null)
      setConfirmDelete(false)
      showMsg('Jefe eliminado')
    } catch { setError('Error al eliminar jefe') }
    finally { setDeleting(false) }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    try {
      setSaving(true)
      setError(null)
      await jefeService.update(selected.id, { nombre: editForm.nombre.trim(), celular: editForm.celular.trim() })
      const updated = { ...selected, nombre: editForm.nombre.trim(), celular: editForm.celular.trim() }
      setSelected(updated)
      setJefes(prev => prev.map(j => j.id === selected.id ? { ...j, ...updated } : j))
      setShowEdit(false)
      showMsg('Jefe actualizado')
    } catch { setError('Error al guardar cambios') }
    finally { setSaving(false) }
  }

  const handleAsignar = async () => {
    if (!selected || !assignId) return
    try {
      setAssigning(true)
      setError(null)
      await jefeService.asignarComunidad(selected.id, assignId)
      const res = await jefeService.getById(selected.id)
      setSelected(res.data)
      setAssignId('')
      showMsg('Comunidad asignada')
    } catch { setError('Error al asignar comunidad') }
    finally { setAssigning(false) }
  }

  const handleDesasignar = async (comunidadId: string) => {
    if (!selected) return
    try {
      setUnassigningId(comunidadId)
      setError(null)
      await jefeService.desasignarComunidad(selected.id, comunidadId)
      const res = await jefeService.getById(selected.id)
      setSelected(res.data)
      showMsg('Comunidad desasignada')
    } catch { setError('Error al desasignar comunidad') }
    finally { setUnassigningId(null) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setCreating(true)
      setError(null)
      await jefeService.create({ nombre: createForm.nombre.trim(), celular: createForm.celular.trim() })
      setShowCreate(false)
      setCreateForm({ nombre: '', celular: '' })
      showMsg('Jefe creado')
      fetchJefes()
    } catch { setError('Error al crear jefe') }
    finally { setCreating(false) }
  }

  const filtered = jefes.filter(j => {
    const t = search.toLowerCase()
    return !search || j.nombre.toLowerCase().includes(t) || j.celular.toLowerCase().includes(t)
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const assignedIds = new Set(selected?.comunidades?.map(jc => jc.comunidad_id) ?? [])
  const availableComs = comunidades.filter(c => !assignedIds.has(c.id))

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCog className="w-7 h-7 text-blue-500" />
          <h1 className="text-xl font-bold text-white">Jefes de Comunidad</h1>
        </div>
        <button
          onClick={() => { setShowCreate(true); setError(null) }}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Crear jefe
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /><p>{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" /><p>{success}</p>
        </div>
      )}

      {/* Split layout */}
      <div className="flex gap-4" style={{ height: 'calc(100vh - 190px)' }}>

        {/* LEFT — list */}
        <div className="w-72 shrink-0 flex flex-col bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-3 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar jefe..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              </div>
            ) : paginated.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Sin resultados</p>
            ) : (
              paginated.map(jefe => (
                <button
                  key={jefe.id}
                  onClick={() => loadDetail(jefe)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-700 transition-colors ${
                    selected?.id === jefe.id
                      ? 'bg-brand-600/20 border-l-2 border-l-brand-500'
                      : 'hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${jefe.activo ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                    <span className="font-medium text-white text-sm truncate">{jefe.nombre}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 pl-4">
                    <span className="text-xs text-gray-400">{jefe.celular}</span>
                    {jefe.comunidades && jefe.comunidades.length > 0 && (
                      <span className="text-xs text-gray-500">{jefe.comunidades.length} com.</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700 text-xs text-gray-400">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 hover:text-white disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 hover:text-white disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — detail */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <UserCog className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-sm">Selecciona un jefe para ver el detalle</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Jefe header */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selected.nombre}</h2>
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-400">
                      <Phone className="w-3.5 h-3.5" />
                      {selected.celular}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {selected.activo ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">
                          Inactivo
                        </span>
                      )}
                      {selected.puede_registrar && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30">
                          Puede registrar
                        </span>
                      )}
                    </div>
                  </div>
                  {detailLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 mt-1" />}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => { setEditForm({ nombre: selected.nombre, celular: selected.celular }); setShowEdit(true) }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>

                  <button
                    onClick={handleToggleActivo}
                    disabled={toggling === 'activo'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    {toggling === 'activo' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {selected.activo ? 'Desactivar' : 'Activar'}
                  </button>

                  <button
                    onClick={handleToggleRegistro}
                    disabled={toggling === 'registro'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    {toggling === 'registro' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {selected.puede_registrar ? 'Revocar registro' : 'Permitir registro'}
                  </button>

                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Communities */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  Comunidades asignadas
                </h3>

                <div className="flex gap-2 mb-4">
                  <select
                    value={assignId}
                    onChange={e => setAssignId(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar comunidad...</option>
                    {availableComs.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} {c.codigo}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAsignar}
                    disabled={assigning || !assignId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                    + Asignar
                  </button>
                </div>

                {selected.comunidades && selected.comunidades.length > 0 ? (
                  <div className="divide-y divide-gray-700">
                    {selected.comunidades.map(jc => (
                      <div key={jc.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-white">{jc.comunidad?.nombre || 'Comunidad'}</p>
                            {jc.comunidad?.codigo && (
                              <p className="text-xs text-gray-500">{jc.comunidad.codigo}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDesasignar(jc.comunidad_id)}
                          disabled={unassigningId === jc.comunidad_id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {unassigningId === jc.comunidad_id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Unlink className="w-3 h-3" />}
                          Desasignar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4 text-center">Sin comunidades asignadas</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h2 className="font-semibold text-white">Editar jefe</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                <input type="text" required value={editForm.nombre}
                  onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Celular</label>
                <input type="text" required value={editForm.celular}
                  onChange={e => setEditForm(f => ({ ...f, celular: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600">Cancelar</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h2 className="font-semibold text-white">Crear jefe</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                <input type="text" required value={createForm.nombre}
                  onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Celular</label>
                <input type="text" required value={createForm.celular}
                  onChange={e => setCreateForm(f => ({ ...f, celular: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600">Cancelar</button>
                <button type="submit" disabled={creating} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Eliminar jefe</h2>
            <p className="text-sm text-gray-400 mb-6">
              ¿Seguro que deseas eliminar a <span className="text-white font-medium">{selected.nombre}</span>? Esta accion no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
