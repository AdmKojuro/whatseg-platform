import { useState, useEffect } from 'react'
import { placasService } from '../../services/placas.service'
import type { PlacaDenegada, PlacaAlerta } from '../../types/placa'
import { Car, ShieldAlert, Plus, RefreshCw, CheckCircle2, Trash2 } from 'lucide-react'

const NIVEL_CONFIG = {
  ALTA:  { color: 'bg-red-50 text-red-400',    badge: 'bg-red-500' },
  MEDIA: { color: 'bg-yellow-500/20 text-yellow-300', badge: 'bg-yellow-500' },
  BAJA:  { color: 'bg-blue-500/20 text-blue-300',  badge: 'bg-blue-500' },
}

export default function PlacasPage() {
  const [denegadas, setDenegadas] = useState<PlacaDenegada[]>([])
  const [alertas, setAlertas] = useState<PlacaAlerta[]>([])
  const [tab, setTab] = useState<'lista-negra' | 'alertas'>('alertas')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ placa: '', descripcion: '', nivel: 'MEDIA' })
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      placasService.listarDenegadas().then(r => setDenegadas(r.data)),
      placasService.listarAlertas({ page: 1, limit: 50 }).then(r => setAlertas(r.data.data)),
    ]).finally(() => setLoading(false))
  }, [])

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const res = await placasService.crearDenegada(form)
      setDenegadas(prev => [res.data, ...prev])
      setForm({ placa: '', descripcion: '', nivel: 'MEDIA' })
      setShowForm(false)
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Error al crear')
    }
  }

  async function handleEliminar(id: string) {
    await placasService.eliminarDenegada(id)
    setDenegadas(prev => prev.filter(p => p.id !== id))
  }

  async function handleReconocer(id: string) {
    await placasService.reconocerAlerta(id)
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, reconocido: true } : a))
  }

  async function handleSync() {
    await placasService.syncVision()
  }

  const alertasPendientes = alertas.filter(a => !a.reconocido)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-500 border-t-transparent" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-500/20"><Car className="text-yellow-400" size={24} /></div>
          <div>
            <h1 className="text-xl font-semibold text-white">ALPR — Control Vehicular</h1>
            <p className="text-sm text-gray-400">Lista negra y reconocimiento automático de placas</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300">
            <RefreshCw size={14} /> Sync Visión
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm text-white">
            <Plus size={14} /> Añadir Placa
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{alertasPendientes.length}</p>
          <p className="text-xs text-gray-400 mt-1">Alertas pendientes</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{denegadas.filter(d => d.activa).length}</p>
          <p className="text-xs text-gray-400 mt-1">Placas en lista negra</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{alertas.length}</p>
          <p className="text-xs text-gray-400 mt-1">Detecciones totales</p>
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <form onSubmit={handleCrear} className="bg-gray-800 rounded-xl p-5 border border-yellow-500/20 space-y-3">
          <h3 className="text-sm font-medium text-white">Añadir placa a lista negra</h3>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-400">Placa (ABC123)</label>
              <input value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))}
                placeholder="ABC123" maxLength={6}
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                required />
            </div>
            <div>
              <label className="text-xs text-gray-400">Nivel de amenaza</label>
              <select value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: e.target.value }))}
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Media</option>
                <option value="BAJA">Baja</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Motivo..."
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
            <button type="submit"
              className="px-4 py-2 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg">
              Registrar
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-0">
        {(['alertas', 'lista-negra'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${tab === t ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t === 'alertas' ? `Alertas ${alertasPendientes.length > 0 ? `(${alertasPendientes.length})` : ''}` : 'Lista Negra'}
          </button>
        ))}
      </div>

      {tab === 'alertas' && (
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/50 text-gray-400 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Placa</th>
                <th className="px-4 py-3 font-medium">Cámara</th>
                <th className="px-4 py-3 font-medium">Confianza</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {alertas.map(a => (
                <tr key={a.id} className={`text-gray-300 ${!a.reconocido && a.placa_denegada_id ? 'bg-red-500/5' : ''}`}>
                  <td className="px-4 py-3 font-mono font-bold text-white">{a.placa_detectada}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{a.camera_id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-700 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-yellow-500" style={{ width: `${Math.round(a.confianza * 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{Math.round(a.confianza * 100)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {a.placa_denegada_id ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-400 flex items-center gap-1 w-fit">
                        <ShieldAlert size={10} /> DENEGADA
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">Sin coincidencia</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(a.created_at).toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3">
                    {!a.reconocido && (
                      <button onClick={() => handleReconocer(a.id)}
                        className="p-1 text-gray-500 hover:text-green-400 transition-colors">
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'lista-negra' && (
        <div className="space-y-2">
          {denegadas.map(d => (
            <div key={d.id} className="bg-gray-800 rounded-xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-mono text-xl font-bold text-white tracking-widest">{d.placa}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${NIVEL_CONFIG[d.nivel as keyof typeof NIVEL_CONFIG]?.color}`}>
                  {d.nivel}
                </span>
                {d.descripcion && <span className="text-sm text-gray-400">{d.descripcion}</span>}
              </div>
              <button onClick={() => handleEliminar(d.id)}
                className="p-2 text-gray-400 hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {denegadas.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Car size={40} className="mx-auto mb-3 opacity-30" />
              <p>Lista negra vacía</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
