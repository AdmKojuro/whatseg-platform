import { useState, useEffect } from 'react'
import { analiticaService } from '../../services/analitica.service'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'
import { BarChart3, TrendingUp, TrendingDown, MapPin } from 'lucide-react'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const TIPO_COLORS: Record<string, string> = {
  POLICIA: '#3b82f6',
  ASISTENCIA_MEDICA: '#22c55e',
  BOMBEROS: '#ef4444',
}
const PIE_COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6']

interface Patrones {
  por_hora: { hora: number; total: number }[]
  por_dia: { dia: number; total: number }[]
  por_tipo: { tipo: string; total: number }[]
}

interface Tendencias {
  mes_actual: { total: number; exitosas: number; falsas: number }
  mes_anterior: { total: number; exitosas: number; falsas: number }
  variacion_pct: number
}

interface Ranking {
  comunidad_id: string; nombre: string; total: number; falsas: number; efectividad: number
}

export default function AnaliticaPage() {
  const [patrones, setPatrones] = useState<Patrones | null>(null)
  const [tendencias, setTendencias] = useState<Tendencias | null>(null)
  const [ranking, setRanking] = useState<Ranking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analiticaService.patrones(),
      analiticaService.tendencias(),
      analiticaService.ranking(10),
    ]).then(([p, t, r]) => {
      setPatrones(p.data)
      setTendencias(t.data)
      setRanking(r.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
    </div>
  )

  const variacion = tendencias?.variacion_pct ?? 0
  const tendenciaArriba = variacion > 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-500/20">
          <BarChart3 className="text-purple-400" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Analítica de Seguridad</h1>
          <p className="text-sm text-gray-400">Inteligencia criminal — patrones y tendencias</p>
        </div>
      </div>

      {/* Tendencia mensual */}
      {tendencias && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-xl p-5 md:col-span-1">
            <p className="text-sm text-gray-400 mb-1">Variación vs mes anterior</p>
            <div className={`flex items-center gap-2 ${tendenciaArriba ? 'text-red-400' : 'text-green-400'}`}>
              {tendenciaArriba ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
              <span className="text-3xl font-bold">{Math.abs(variacion)}%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {tendenciaArriba ? 'Aumento' : 'Disminución'} de activaciones
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-3">Mes actual vs anterior</p>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={[
                { name: 'Anterior', total: tendencias.mes_anterior.total, falsas: tendencias.mes_anterior.falsas },
                { name: 'Actual', total: tendencias.mes_actual.total, falsas: tendencias.mes_actual.falsas },
              ]}>
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }} />
                <Bar dataKey="total" fill="#3b82f6" radius={4} name="Total" />
                <Bar dataKey="falsas" fill="#f59e0b" radius={4} name="Falsas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-2">Tipo de emergencias (mes actual)</p>
            {patrones && (
              <ResponsiveContainer width="100%" height={80}>
                <PieChart>
                  <Pie data={patrones.por_tipo} cx="50%" cy="50%" outerRadius={35}
                    dataKey="total" nameKey="tipo">
                    {patrones.por_tipo.map((entry, i) => (
                      <Cell key={i} fill={TIPO_COLORS[entry.tipo] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1f2937', border: 'none' }}
                    formatter={(v: number, n: string) => [v, n]} />
                  <Legend formatter={(v) => <span className="text-xs text-gray-400">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Patrones */}
      {patrones && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Por hora */}
          <div className="bg-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-300 mb-4">Activaciones por Hora del Día</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={patrones.por_hora}>
                <XAxis dataKey="hora" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v}h`} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
                  labelFormatter={(v) => `${v}:00 hrs`} />
                <Bar dataKey="total" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Activaciones" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Por día de semana */}
          <div className="bg-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-300 mb-4">Activaciones por Día de la Semana</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={patrones.por_dia.map((d) => ({ ...d, nombre: DIAS[d.dia] }))}>
                <XAxis dataKey="nombre" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }} />
                <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Activaciones" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Ranking de comunidades */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-blue-400" />
          Ranking de Comunidades — Últimos 30 días
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left">
                <th className="pb-3 font-medium">#</th>
                <th className="pb-3 font-medium">Comunidad</th>
                <th className="pb-3 font-medium text-right">Total</th>
                <th className="pb-3 font-medium text-right">Falsas</th>
                <th className="pb-3 font-medium text-right">Efectividad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {ranking.map((r, i) => (
                <tr key={r.comunidad_id} className="text-gray-300">
                  <td className="py-2 text-gray-500">{i + 1}</td>
                  <td className="py-2 font-medium text-white">{r.nombre}</td>
                  <td className="py-2 text-right">{r.total}</td>
                  <td className="py-2 text-right text-orange-400">{r.falsas}</td>
                  <td className="py-2 text-right">
                    <span className={`font-semibold ${r.efectividad >= 70 ? 'text-green-400' : r.efectividad >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {r.efectividad}%
                    </span>
                  </td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
