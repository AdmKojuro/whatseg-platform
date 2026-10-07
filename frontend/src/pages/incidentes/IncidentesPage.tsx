import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock, Plus, Filter, AlertTriangle, Search,
  ChevronDown, Building2, Loader2,
} from 'lucide-react'
import { incidenteService } from '../../services/incidente.service'
import { comunidadService } from '../../services/comunidad.service'
import type { Incidente, TipoIncidente, SeveridadIncidente, EstadoIncidente, CreateIncidenteInput } from '../../types/incidente'
import type { Comunidad } from '../../types/comunidad'

const TIPO_LABELS: Record<TipoIncidente, string> = {
  INCIDENTE: 'Incidente',
  EMERGENCIA: 'Emergencia',
  NOVEDAD: 'Novedad',
  SOSPECHA: 'Sospecha',
}

const ESTADO_LABELS: Record<EstadoIncidente, string> = {
  ABIERTO: 'Abierto',
  EN_INVESTIGACION: 'En Investigación',
  CERRADO: 'Cerrado',
  ARCHIVADO: 'Archivado',
}

const SEV_COLORS: Record<SeveridadIncidente, string> = {
  BAJA: 'bg-blue-100 text-blue-400',
  MEDIA: 'bg-yellow-100 text-yellow-400',
  ALTA: 'bg-orange-100 text-orange-400',
  CRITICA: 'bg-red-100 text-red-400',
}

const ESTADO_COLORS: Record<EstadoIncidente, string> = {
  ABIERTO: 'bg-red-100 text-red-400',
  EN_INVESTIGACION: 'bg-yellow-100 text-yellow-400',
  CERRADO: 'bg-green-100 text-green-400',
  ARCHIVADO: 'bg-gray-100 text-gray-400',
}

const now = () => {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

export default function IncidentesPage() {
  const navigate = useNavigate()
  const [incidentes, setIncidentes] = useState<Incidente[]>([])
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [filtroComunidad, setFiltroComunidad] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroSeveridad, setFiltroSeveridad] = useState('')
  const [filtroBuscar, setFiltroBuscar] = useState('')

  // Form
  const [form, setForm] = useState<CreateIncidenteInput>({
    comunidad_id: '',
    titulo: '',
    descripcion: '',
    tipo: 'INCIDENTE',
    severidad: 'MEDIA',
    fecha_inicio: now(),
    ventana_horas: 6,
    radio_metros: 500,
  })

  const fetchIncidentes = useCallback(async () => {
    try {
      const { data } = await incidenteService.list({
        comunidad_id: filtroComunidad || undefined,
        estado: filtroEstado || undefined,
        tipo: filtroTipo || undefined,
        severidad: filtroSeveridad || undefined,
        limit: 100,
      })
      setIncidentes(data.items)
    } catch {
      setError('Error al cargar incidentes')
    } finally {
      setLoading(false)
    }
  }, [filtroComunidad, filtroEstado, filtroTipo, filtroSeveridad])

  useEffect(() => { fetchIncidentes() }, [fetchIncidentes])

  useEffect(() => {
    comunidadService.list().then(r => setComunidades(r.data))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.comunidad_id || !form.titulo || !form.fecha_inicio) return
    try {
      setSubmitting(true)
      const { data } = await incidenteService.create(form)
      setShowForm(false)
      setForm({ comunidad_id: '', titulo: '', descripcion: '', tipo: 'INCIDENTE', severidad: 'MEDIA', fecha_inicio: now(), ventana_horas: 6, radio_metros: 500 })
      navigate(`/incidentes/${data.id}`)
    } catch {
      setError('Error al crear incidente')
    } finally {
      setSubmitting(false)
    }
  }

  const filtrados = incidentes.filter(i =>
    !filtroBuscar || i.titulo.toLowerCase().includes(filtroBuscar.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Clock className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-white">Línea de Tiempo Forense</h1>
            <p className="text-sm text-gray-500">Reconstrucción automática de incidentes</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Incidente
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-1 border border-gray-300 rounded-lg px-2 flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={filtroBuscar}
            onChange={e => setFiltroBuscar(e.target.value)}
            className="text-sm py-1.5 outline-none flex-1 min-w-0"
          />
        </div>
        <select value={filtroComunidad} onChange={e => setFiltroComunidad(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
          <option value="">Todas las comunidades</option>
          {comunidades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO_LABELS) as EstadoIncidente[]).map(k =>
            <option key={k} value={k}>{ESTADO_LABELS[k]}</option>
          )}
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
          <option value="">Todos los tipos</option>
          {(Object.keys(TIPO_LABELS) as TipoIncidente[]).map(k =>
            <option key={k} value={k}>{TIPO_LABELS[k]}</option>
          )}
        </select>
        <select value={filtroSeveridad} onChange={e => setFiltroSeveridad(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
          <option value="">Toda severidad</option>
          {(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as SeveridadIncidente[]).map(k =>
            <option key={k} value={k}>{k}</option>
          )}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Sin incidentes registrados</p>
          <p className="text-gray-400 text-sm mt-1">Crea uno para reconstruir el timeline automáticamente</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/40 border-b border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Título</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Comunidad</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Severidad</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Ventana</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filtrados.map(inc => (
                <tr key={inc.id} className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{inc.titulo}</td>
                  <td className="px-4 py-3 text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      {inc.comunidad_nombre ?? inc.comunidad_id}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{TIPO_LABELS[inc.tipo]}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SEV_COLORS[inc.severidad]}`}>
                      {inc.severidad}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[inc.estado]}`}>
                      {ESTADO_LABELS[inc.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(inc.fecha_inicio).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-gray-500">±{inc.ventana_horas}h</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/incidentes/${inc.id}`)}
                      className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 text-xs font-medium transition-colors"
                    >
                      Ver Timeline
                      <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de creación */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-white">Nuevo Incidente</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-400 text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Título *</label>
                <input type="text" required value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ej: Robo en entrada principal"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Comunidad *</label>
                  <select required value={form.comunidad_id}
                    onChange={e => setForm(f => ({ ...f, comunidad_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                    <option value="">Seleccionar...</option>
                    {comunidades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                  <select value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoIncidente }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                    {(Object.keys(TIPO_LABELS) as TipoIncidente[]).map(k =>
                      <option key={k} value={k}>{TIPO_LABELS[k]}</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Severidad</label>
                  <select value={form.severidad}
                    onChange={e => setForm(f => ({ ...f, severidad: e.target.value as SeveridadIncidente }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                    {(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as SeveridadIncidente[]).map(k =>
                      <option key={k} value={k}>{k}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Ventana (horas ±)</label>
                  <input type="number" min={1} max={48} value={form.ventana_horas}
                    onChange={e => setForm(f => ({ ...f, ventana_horas: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Fecha / Hora del incidente *</label>
                <input type="datetime-local" required value={form.fecha_inicio}
                  onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
                <textarea rows={2} value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción breve del incidente..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-400 border border-gray-300 rounded-lg hover:bg-gray-700/50">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Crear y Ver Timeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
