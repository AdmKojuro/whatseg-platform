import { useState, useEffect } from 'react'
import { despachoService } from '../../services/despacho.service'
import { Truck, Clock, CheckCircle2, MapPin } from 'lucide-react'
import type { Despacho } from '../../types/despacho'

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  ASIGNADO: { label: 'Asignado', color: 'bg-blue-500/20 text-blue-300' },
  EN_CAMINO: { label: 'En Camino', color: 'bg-yellow-500/20 text-yellow-300' },
  EN_SITIO: { label: 'En Sitio', color: 'bg-green-500/20 text-green-300' },
  CERRADO: { label: 'Cerrado', color: 'bg-gray-500/20 text-gray-400' },
  CANCELADO: { label: 'Cancelado', color: 'bg-red-50 text-red-400' },
}

function Timeline({ despacho }: { despacho: Despacho }) {
  const steps = [
    { label: 'Asignado', ts: despacho.asignado_at, done: true },
    { label: 'En Camino', ts: despacho.en_camino_at, done: !!despacho.en_camino_at },
    { label: 'En Sitio', ts: despacho.en_sitio_at, done: !!despacho.en_sitio_at },
    { label: 'Cerrado', ts: despacho.cierre_at, done: !!despacho.cierre_at },
  ]
  return (
    <div className="flex items-center gap-1 mt-3">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1 flex-1">
          <div className={`flex-shrink-0 h-2 w-2 rounded-full ${s.done ? 'bg-blue-400' : 'bg-gray-600'}`} />
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px ${steps[i+1].done ? 'bg-blue-400' : 'bg-gray-600'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function DespachosPage() {
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')

  useEffect(() => {
    despachoService.list(filtroEstado ? { estado: filtroEstado } : undefined)
      .then(r => setDespachos(r.data))
      .finally(() => setLoading(false))
  }, [filtroEstado])

  async function cambiarEstado(id: string, estado: 'EN_CAMINO' | 'EN_SITIO' | 'CERRADO' | 'CANCELADO') {
    try {
      const res = await despachoService.actualizarEstado(id, estado)
      setDespachos(prev => prev.map(d => d.id === id ? res.data : d))
    } catch (e) { console.error(e) }
  }

  const activos = despachos.filter(d => ['ASIGNADO', 'EN_CAMINO', 'EN_SITIO'].includes(d.estado))
  const cerrados = despachos.filter(d => ['CERRADO', 'CANCELADO'].includes(d.estado))

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20"><Truck className="text-blue-400" size={24} /></div>
          <div>
            <h1 className="text-xl font-semibold text-white">Gestión de Despachos</h1>
            <p className="text-sm text-gray-400">Seguimiento de patrullas y tiempos de respuesta</p>
          </div>
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Despachos activos */}
      {activos.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            Patrullas en Campo ({activos.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activos.map(d => (
              <div key={d.id} className="bg-gray-800 rounded-xl p-5 border border-blue-500/20">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Cuadrante</p>
                    <p className="font-medium text-white">{d.cuadrante_id}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_CONFIG[d.estado]?.color}`}>
                    {ESTADO_CONFIG[d.estado]?.label}
                  </span>
                </div>

                {d.zona && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                    <MapPin size={10} />{d.zona.nombre}
                  </p>
                )}

                <p className="text-xs text-gray-500 flex items-center gap-1 mb-3">
                  <Clock size={10} />{new Date(d.asignado_at).toLocaleString('es-CO')}
                </p>

                {d.notas_despacho && <p className="text-xs text-gray-400 mb-3">{d.notas_despacho}</p>}

                <Timeline despacho={d} />

                <div className="flex gap-2 mt-3">
                  {d.estado === 'ASIGNADO' && (
                    <button onClick={() => cambiarEstado(d.id, 'EN_CAMINO')}
                      className="flex-1 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg">
                      En Camino
                    </button>
                  )}
                  {d.estado === 'EN_CAMINO' && (
                    <button onClick={() => cambiarEstado(d.id, 'EN_SITIO')}
                      className="flex-1 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg">
                      En Sitio
                    </button>
                  )}
                  {['EN_CAMINO', 'EN_SITIO'].includes(d.estado) && (
                    <button onClick={() => cambiarEstado(d.id, 'CERRADO')}
                      className="flex-1 py-1.5 text-xs bg-gray-600 hover:bg-gray-700/500 text-white rounded-lg">
                      Cerrar
                    </button>
                  )}
                  {d.estado === 'ASIGNADO' && (
                    <button onClick={() => cambiarEstado(d.id, 'CANCELADO')}
                      className="py-1.5 px-3 text-xs bg-red-500/20 hover:bg-red-500/200/30 text-red-400 rounded-lg">✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico */}
      {cerrados.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-gray-500" />
            Histórico ({cerrados.length})
          </h2>
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr className="text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Cuadrante</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">T. Respuesta</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {cerrados.map(d => (
                  <tr key={d.id} className="text-gray-300">
                    <td className="px-4 py-3">{d.cuadrante_id}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_CONFIG[d.estado]?.color}`}>
                        {ESTADO_CONFIG[d.estado]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {d.tiempo_respuesta_seg ? `${Math.round(d.tiempo_respuesta_seg / 60)}m` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{new Date(d.created_at).toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {despachos.length === 0 && (
        <div className="bg-gray-800 rounded-xl p-12 text-center text-gray-500">
          <Truck size={40} className="mx-auto mb-3 opacity-30" />
          <p>Sin despachos registrados</p>
          <p className="text-xs mt-1">Los despachos se crean desde el Panel Policial al atender activaciones</p>
        </div>
      )}
    </div>
  )
}
