import { useState, useEffect } from 'react'
import { guardiaService } from '../../services/guardia.service'
import type { AlertaGuardia, EstadoGuardia } from '../../types/guardia'
import { Shield, AlertTriangle, CheckCircle2, Clock, PhoneCall } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const TIPO_CONFIG: Record<string, { label: string; color: string }> = {
  SIN_CHECKIN: { label: 'Sin Check-in', color: 'bg-orange-500/20 text-orange-400' },
  COACCION:    { label: '⚠ COACCIÓN', color: 'bg-red-50 text-red-400' },
  PANICO:      { label: '🆘 PÁNICO', color: 'bg-red-600/30 text-red-300' },
}

export default function GuardiaPage() {
  const { user } = useAuth()
  const esCuadrante = user?.rol === 'CUADRANTE'

  const [estado, setEstado] = useState<EstadoGuardia[]>([])
  const [alertas, setAlertas] = useState<AlertaGuardia[]>([])
  const [loading, setLoading] = useState(true)
  const [checkInStatus, setCheckInStatus] = useState<string | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const [alertasRes, estadoRes] = await Promise.all([
        guardiaService.alertas(false),
        guardiaService.estado(),
      ])
      setAlertas(alertasRes.data)
      setEstado(estadoRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function handleCheckIn(tipo: 'OK' | 'PANICO' | 'COACCION') {
    await guardiaService.checkIn(tipo)
    setCheckInStatus(tipo === 'OK' ? 'Check-in registrado' : tipo === 'PANICO' ? 'Alerta de pánico enviada' : 'Alerta de coacción silenciosa enviada')
    setTimeout(() => setCheckInStatus(null), 4000)
  }

  async function handleResolver(id: string) {
    await guardiaService.resolverAlerta(id)
    setAlertas(prev => prev.filter(a => a.id !== id))
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-green-500/20"><Shield className="text-green-400" size={24} /></div>
        <div>
          <h1 className="text-xl font-semibold text-white">Protocolo de Seguridad del Guarda</h1>
          <p className="text-sm text-gray-400">Dead-man switch · Código de coacción · Monitoreo de bienestar</p>
        </div>
      </div>

      {/* Panel del guarda — botones de check-in */}
      {esCuadrante && (
        <div className="bg-gray-800 rounded-xl p-6 border border-green-500/20 space-y-4">
          <h2 className="text-sm font-medium text-gray-300">Mi Protocolo de Seguridad</h2>
          {checkInStatus && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 text-green-400 text-sm">
              {checkInStatus}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => handleCheckIn('OK')}
              className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 size={20} /> Estoy Bien (Check-in)
            </button>
            <button onClick={() => handleCheckIn('PANICO')}
              className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
              <PhoneCall size={20} /> Pánico
            </button>
            <button onClick={() => handleCheckIn('COACCION')}
              className="flex-1 py-4 bg-gray-600 hover:bg-gray-700/500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 text-sm"
              title="Alerta silenciosa — para usar cuando es coaccionado">
              <AlertTriangle size={18} /> Coacción (silenciosa)
            </button>
          </div>
          <p className="text-xs text-gray-500">
            El sistema espera tu check-in cada 10 minutos. Si no hay reporte en 5 minutos adicionales,
            se genera una alerta automática. La opción "Coacción" no activa ninguna alarma visible.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas activas */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${alertas.length > 0 ? 'bg-red-400 animate-pulse' : 'bg-gray-600'}`} />
            Alertas Activas ({alertas.length})
          </h2>
          {alertas.length === 0 && (
            <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-500">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-green-500/40" />
              <p className="text-sm">Todos los guardas reportan normal</p>
            </div>
          )}
          {alertas.map(a => (
            <div key={a.id} className={`bg-gray-800 rounded-xl p-4 border ${
              a.tipo === 'PANICO' || a.tipo === 'COACCION' ? 'border-red-500/40' : 'border-orange-500/20'
            }`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_CONFIG[a.tipo]?.color}`}>
                    {TIPO_CONFIG[a.tipo]?.label}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    Guarda: <span className="text-white font-mono">{a.guardia_id.slice(0, 8)}...</span>
                  </p>
                </div>
                <button onClick={() => handleResolver(a.id)}
                  className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">
                  Resolver
                </button>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Clock size={10} /> {new Date(a.created_at).toLocaleString('es-CO')}
              </p>
            </div>
          ))}
        </div>

        {/* Estado de guardias */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-300">Estado de Guardias Activos</h2>
          {estado.length === 0 && (
            <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
              Sin guardas con actividad reciente
            </div>
          )}
          {estado.map(g => {
            const minutos = Math.round((Date.now() - new Date(g.ultimo_checkin).getTime()) / 60000)
            return (
              <div key={g.guardia_id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${g.activo ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
                  <div>
                    <p className="text-sm text-white font-mono">{g.guardia_id.slice(0, 8)}...</p>
                    <p className="text-xs text-gray-500">Último: {minutos}min ago · {g.tipo}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${g.activo ? 'bg-green-500/20 text-green-400' : 'bg-red-50 text-red-400'}`}>
                  {g.activo ? 'ACTIVO' : 'SIN SEÑAL'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
