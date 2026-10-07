import { useState, useEffect } from 'react'
import { prediccionService } from '../../services/prediccion.service'
import type { ScoringTurno, PatronesTemporales } from '../../types/prediccion'
import { TrendingUp, Clock, MapPin, RefreshCw } from 'lucide-react'

export default function PrediccionPage() {
  const [scoring, setScoring] = useState<ScoringTurno | null>(null)
  const [patrones, setPatrones] = useState<PatronesTemporales | null>(null)
  const [loading, setLoading] = useState(true)

  const cargar = async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([
        prediccionService.scoring(),
        prediccionService.patrones(),
      ])
      setScoring(s.data)
      setPatrones(p.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const maxHora = patrones ? Math.max(...patrones.por_hora.map(h => h.cnt), 1) : 1
  const maxDia = patrones ? Math.max(...patrones.por_dia.map(d => d.cnt), 1) : 1

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20"><TrendingUp className="text-purple-400" size={24} /></div>
          <div>
            <h1 className="text-xl font-semibold text-white">IA Predictiva de Patrullaje</h1>
            <p className="text-sm text-gray-400">Scoring de riesgo por turno · Rutas de patrulla sugeridas</p>
          </div>
        </div>
        <button onClick={cargar}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Turno actual */}
      {scoring && (
        <div className="bg-gradient-to-r from-purple-900/30 to-gray-800 rounded-xl p-5 border border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-400">Análisis de turno</p>
              <p className="text-lg font-semibold text-white">{scoring.dia} · {scoring.turno}</p>
            </div>
            <Clock className="text-purple-400" size={28} />
          </div>
          <p className="text-xs text-gray-500">Generado: {new Date(scoring.generado_at).toLocaleTimeString('es-CO')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top comunidades de riesgo */}
        {scoring && (
          <div className="bg-gray-800 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <MapPin size={14} className="text-purple-400" />
              Zonas de Mayor Riesgo — Próximas 8h
            </h2>
            {scoring.comunidades.slice(0, 8).map((c, i) => (
              <div key={c.comunidad_id} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-300 font-mono">{c.comunidad_id.slice(0, 8)}...</span>
                    <span className="text-xs font-bold text-white">{c.score}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${c.score >= 80 ? 'bg-red-500' : c.score >= 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                  {c.horas_riesgo.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Pico: {c.horas_riesgo.map(h => `${h.toString().padStart(2,'0')}h`).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Patrón por día de semana */}
        {patrones && (
          <div className="bg-gray-800 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-medium text-gray-300">Incidentes por Día de la Semana (90 días)</h2>
            {patrones.por_dia.map(d => (
              <div key={d.dia} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-8">{d.label}</span>
                <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-4 rounded-full bg-purple-600/70 flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${Math.round((d.cnt / maxDia) * 100)}%` }}
                  >
                    {d.cnt > 0 && <span className="text-xs text-white font-bold">{d.cnt}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Patrón por hora */}
      {patrones && (
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Distribución Horaria de Incidentes (90 días)</h2>
          <div className="flex items-end gap-0.5 h-24">
            {patrones.por_hora.map(h => {
              const pct = maxHora > 0 ? (h.cnt / maxHora) : 0
              const isHigh = pct > 0.6
              return (
                <div key={h.hora} className="flex-1 flex flex-col items-center gap-0.5" title={`${h.label}: ${h.cnt} incidentes`}>
                  <div
                    className={`w-full rounded-sm transition-all ${isHigh ? 'bg-red-500' : 'bg-purple-600/60'}`}
                    style={{ height: `${Math.max(pct * 88, h.cnt > 0 ? 4 : 0)}px` }}
                  />
                  {h.hora % 4 === 0 && (
                    <span className="text-xs text-gray-400">{h.hora.toString().padStart(2, '0')}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
