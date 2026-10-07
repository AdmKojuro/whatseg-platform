import { useState, useEffect, useCallback } from 'react'
import { panelPolicialService } from '../../services/panel-policial.service'
import { despachoService } from '../../services/despacho.service'
import { Siren, Truck, Clock, AlertTriangle, Download, RefreshCw, CheckCircle2 } from 'lucide-react'
import type { Despacho } from '../../types/despacho'

interface Metrica {
  activaciones_hoy: number
  despachos_hoy: number
  tiempo_promedio_respuesta_seg: number
  falsas_alarmas_hoy: number
  alertas_ia_hoy: number
}

interface Activacion {
  id: string
  created_at: string
  tipo_emergencia: string | null
  resultado: string
  comunidad_id: string
  nombre_comunidad: string
  lat: number | null
  lng: number | null
}

const TIPO_COLORS: Record<string, string> = {
  POLICIA: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  ASISTENCIA_MEDICA: 'bg-green-500/20 text-green-300 border border-green-500/30',
  BOMBEROS: 'bg-red-500/20 text-red-300 border border-red-500/30',
}

function segundosAMinutos(seg: number) {
  if (seg < 60) return `${seg}s`
  return `${Math.floor(seg / 60)}m ${seg % 60}s`
}

export default function PanelPolicialPage() {
  const [metricas, setMetricas] = useState<Metrica | null>(null)
  const [activaciones, setActivaciones] = useState<Activacion[]>([])
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [loading, setLoading] = useState(true)
  const [despachando, setDespachando] = useState<string | null>(null)
  const [cuadranteId, setCuadranteId] = useState('')

  const cargar = useCallback(async () => {
    try {
      const [alertasRes, despachosRes, metricasRes] = await Promise.all([
        panelPolicialService.alertasActivas(),
        panelPolicialService.despachosActivos(),
        panelPolicialService.metricas(),
      ])
      setActivaciones(alertasRes.data.activaciones)
      setDespachos(despachosRes.data)
      setMetricas(metricasRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    const interval = setInterval(cargar, 30_000)
    return () => clearInterval(interval)
  }, [cargar])

  async function despacharActivacion(activacionId: string) {
    if (!cuadranteId.trim()) return
    try {
      setDespachando(activacionId)
      await despachoService.create({ activacion_id: activacionId, cuadrante_id: cuadranteId, prioridad: 1 })
      await cargar()
    } catch (e) {
      console.error(e)
    } finally {
      setDespachando(null)
    }
  }

  async function cambiarEstado(id: string, estado: 'EN_CAMINO' | 'EN_SITIO' | 'CERRADO') {
    try {
      await despachoService.actualizarEstado(id, estado)
      await cargar()
    } catch (e) { console.error(e) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <Siren className="text-blue-400" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Panel de Comando Policial</h1>
            <p className="text-sm text-gray-400">Monitoreo en tiempo real — actualización cada 30s</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm transition-colors">
            <RefreshCw size={14} />
            Actualizar
          </button>
          <button
            onClick={() => panelPolicialService.exportarSies()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors"
          >
            <Download size={14} />
            Exportar SIES-C
          </button>
        </div>
      </div>

      {/* Métricas del turno */}
      {metricas && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Activaciones Hoy', value: metricas.activaciones_hoy, icon: <Bell size={16} />, color: 'text-yellow-400' },
            { label: 'Despachos Hoy', value: metricas.despachos_hoy, icon: <Truck size={16} />, color: 'text-blue-400' },
            { label: 'T. Respuesta Promedio', value: segundosAMinutos(metricas.tiempo_promedio_respuesta_seg), icon: <Clock size={16} />, color: 'text-green-400' },
            { label: 'Falsas Alarmas', value: metricas.falsas_alarmas_hoy, icon: <AlertTriangle size={16} />, color: 'text-orange-400' },
            { label: 'Alertas IA Hoy', value: metricas.alertas_ia_hoy, icon: <Siren size={16} />, color: 'text-purple-400' },
          ].map((m, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-4">
              <div className={`flex items-center gap-2 ${m.color} mb-2`}>
                {m.icon}
                <span className="text-xs font-medium">{m.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Activaciones sin atender */}
        <div className="bg-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="text-red-400" size={18} />
              Activaciones Pendientes ({activaciones.length})
            </h2>
          </div>

          {/* Input cuadrante para despachar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="ID Cuadrante para despachar..."
              value={cuadranteId}
              onChange={(e) => setCuadranteId(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {activaciones.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-green-500/50" />
                <p>Sin activaciones pendientes</p>
              </div>
            )}
            {activaciones.map((a) => (
              <div key={a.id} className="bg-gray-700/50 rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {a.tipo_emergencia && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLORS[a.tipo_emergencia] ?? 'bg-gray-600 text-gray-300'}`}>
                        {a.tipo_emergencia.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white font-medium truncate">{a.nombre_comunidad}</p>
                  <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString('es-CO')}</p>
                </div>
                <button
                  onClick={() => despacharActivacion(a.id)}
                  disabled={!cuadranteId.trim() || despachando === a.id}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
                >
                  {despachando === a.id ? '...' : 'Despachar'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Despachos activos */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-white flex items-center gap-2 mb-4">
            <Truck className="text-blue-400" size={18} />
            Patrullas en Campo ({despachos.length})
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {despachos.length === 0 && (
              <p className="text-center py-8 text-gray-500">Sin patrullas despachadas</p>
            )}
            {despachos.map((d) => (
              <div key={d.id} className="bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    d.estado === 'EN_SITIO' ? 'bg-green-500/20 text-green-300' :
                    d.estado === 'EN_CAMINO' ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-blue-500/20 text-blue-300'
                  }`}>
                    {d.estado.replace('_', ' ')}
                  </span>
                  <div className="flex gap-1">
                    {d.estado === 'ASIGNADO' && (
                      <button onClick={() => cambiarEstado(d.id, 'EN_CAMINO')}
                        className="px-2 py-1 text-xs rounded bg-yellow-600 hover:bg-yellow-700 text-white">
                        En Camino
                      </button>
                    )}
                    {d.estado === 'EN_CAMINO' && (
                      <button onClick={() => cambiarEstado(d.id, 'EN_SITIO')}
                        className="px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-700 text-white">
                        En Sitio
                      </button>
                    )}
                    {(d.estado === 'EN_SITIO' || d.estado === 'EN_CAMINO') && (
                      <button onClick={() => cambiarEstado(d.id, 'CERRADO')}
                        className="px-2 py-1 text-xs rounded bg-gray-600 hover:bg-gray-700/500 text-white">
                        Cerrar
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400">Cuadrante: {d.cuadrante_id}</p>
                <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleString('es-CO')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Bell({ size, className }: { size: number; className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
}
