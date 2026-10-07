import { useState, useEffect, useCallback } from 'react'
import {
  Nfc, Plus, Trash2, ToggleLeft, ToggleRight,
  AlertTriangle, Loader2, CheckCircle2, Building2,
  MapPin, Info,
} from 'lucide-react'
import { nfcService, type NfcTarjeta } from '../../services/nfc.service'
import { comunidadService } from '../../services/comunidad.service'
import type { Comunidad } from '../../types/comunidad'

export default function NfcTarjetasPage() {
  const [tarjetas, setTarjetas] = useState<NfcTarjeta[]>([])
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filtroComunidad, setFiltroComunidad] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todas' | 'activas' | 'inactivas'>('todas')

  const [form, setForm] = useState({
    uid: '',
    etiqueta: '',
    comunidad_id: '',
    notas: '',
  })

  const fetchTarjetas = useCallback(async () => {
    try {
      const { data } = await nfcService.list(filtroComunidad || undefined)
      setTarjetas(data)
    } catch {
      setError('Error al cargar tarjetas NFC')
    } finally {
      setLoading(false)
    }
  }, [filtroComunidad])

  useEffect(() => { fetchTarjetas() }, [fetchTarjetas])
  useEffect(() => {
    comunidadService.list().then(r => setComunidades(r.data))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.uid || !form.etiqueta) return
    try {
      setSubmitting(true)
      await nfcService.create({
        uid: form.uid.trim().toUpperCase(),
        etiqueta: form.etiqueta,
        comunidad_id: form.comunidad_id || null,
        notas: form.notas || null,
      })
      setShowForm(false)
      setForm({ uid: '', etiqueta: '', comunidad_id: '', notas: '' })
      setSuccess('Tarjeta registrada correctamente')
      setTimeout(() => setSuccess(null), 3000)
      fetchTarjetas()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Error al crear tarjeta'
      setError(msg)
      setTimeout(() => setError(null), 4000)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActiva = async (t: NfcTarjeta) => {
    try {
      await nfcService.update(t.id, { activa: !t.activa })
      fetchTarjetas()
    } catch {
      setError('Error al actualizar tarjeta')
    }
  }

  const handleDelete = async (t: NfcTarjeta) => {
    if (!window.confirm(`¿Eliminar tarjeta "${t.etiqueta}" (${t.uid})?`)) return
    try {
      await nfcService.delete(t.id)
      fetchTarjetas()
    } catch {
      setError('Error al eliminar tarjeta')
    }
  }

  const filtradas = tarjetas.filter(t => {
    if (filtroEstado === 'activas' && !t.activa) return false
    if (filtroEstado === 'inactivas' && t.activa) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Nfc className="w-8 h-8 text-teal-600" />
          <div>
            <h1 className="text-2xl font-bold text-white">Tarjetas NFC</h1>
            <p className="text-sm text-gray-500">Solo tarjetas registradas aquí pueden ser usadas en rondas</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Registrar Tarjeta
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-800">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Cuando un guardia escanea un tag NFC, el backend verifica que el UID esté en esta lista y esté <strong>activo</strong>.
          Si no está registrado, el marcaje se rechaza con error 403.
          Luego también debe coincidir con el <code className="bg-blue-100 px-1 rounded">nfc_tag</code> del checkpoint.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-wrap gap-3 items-center">
        <select value={filtroComunidad} onChange={e => setFiltroComunidad(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
          <option value="">Todas las comunidades</option>
          {comunidades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {(['todas', 'activas', 'inactivas'] as const).map(opt => (
            <button key={opt}
              onClick={() => setFiltroEstado(opt)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                filtroEstado === opt ? 'bg-teal-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-700/50'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500 ml-auto">
          {filtradas.length} tarjeta{filtradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <Nfc className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Sin tarjetas NFC registradas</p>
          <p className="text-gray-400 text-sm mt-1">Registra un UID para permitir su uso en rondas</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/40 border-b border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-400">UID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Etiqueta</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Comunidad</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Checkpoint asignado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Notas</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filtradas.map(t => (
                <tr key={t.id} className={`hover:bg-gray-700/50 transition-colors ${!t.activa ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-700 px-2 py-0.5 rounded font-mono text-gray-300">{t.uid}</code>
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{t.etiqueta}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {t.comunidad_nombre
                      ? <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-gray-400" />{t.comunidad_nombre}</span>
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {t.checkpoint_nombre
                      ? <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-green-500" />{t.checkpoint_nombre}</span>
                      : <span className="text-amber-500 text-xs">Sin checkpoint</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">{t.notas ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActiva(t)}
                      className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                        t.activa
                          ? 'bg-green-100 text-green-400 hover:bg-green-200'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {t.activa
                        ? <><ToggleRight className="w-3.5 h-3.5" /> Activa</>
                        : <><ToggleLeft className="w-3.5 h-3.5" /> Inactiva</>
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(t)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/20 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal creación */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-white">Registrar Tarjeta NFC</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-400 text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">UID de la tarjeta *</label>
                <input type="text" required value={form.uid}
                  onChange={e => setForm(f => ({ ...f, uid: e.target.value }))}
                  placeholder="Ej: 04A1B2C3D4E5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
                <p className="text-xs text-gray-400 mt-1">El UID se lee con la app Flutter al escanear la tarjeta física</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Etiqueta / Descripción *</label>
                <input type="text" required value={form.etiqueta}
                  onChange={e => setForm(f => ({ ...f, etiqueta: e.target.value }))}
                  placeholder="Ej: Tarjeta Entrada Principal Bloque A"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Comunidad</label>
                <select value={form.comunidad_id}
                  onChange={e => setForm(f => ({ ...f, comunidad_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500">
                  <option value="">Sin comunidad específica</option>
                  {comunidades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notas</label>
                <textarea rows={2} value={form.notas}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  placeholder="Ubicación física, observaciones..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-400 border border-gray-300 rounded-lg hover:bg-gray-700/50">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting}
                  className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
