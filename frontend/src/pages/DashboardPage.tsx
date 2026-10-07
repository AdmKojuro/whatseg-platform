import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, Navigate } from 'react-router-dom'
import ConfigModulosModal from '../components/ConfigModulosModal'
import {
  LayoutDashboard, Building2, Users, UserCheck, Cpu, Bell,
  Radio, Map, Grid3X3, Truck, HeartPulse, Settings,
  RefreshCw, Phone, Wifi, WifiOff, Zap, TrendingUp, CalendarDays,
  X, ExternalLink, Camera, ShieldCheck, Clock, AlertTriangle,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { dashboardService } from '../services/dashboard.service'
import { useAuth } from '../hooks/useAuth'
import type { DashboardStats, ActivacionesPorComunidad } from '../types/dashboard'
import type { Activacion } from '../types/activacion'
import type { Rol } from '../types/enums'

// ── Módulos / Tabs ────────────────────────────────────────────────────────────

type TabDef = {
  to: string
  label: string
  icon: React.ElementType
  roles: Rol[]
  countKey?: keyof DashboardStats
}

const TABS: TabDef[] = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard, roles: ['SUPERADMIN','ADMIN','MONITOR','COMANDANTE'] },
  { to: '/admins',       label: 'Configuración',icon: Settings,        roles: ['SUPERADMIN'] },
  { to: '/comunidades',  label: 'Comunidades',  icon: Building2,       roles: ['ADMIN'],      countKey: 'totalComunidades' },
  { to: '/dispositivos', label: 'Dispositivos', icon: Cpu,             roles: ['ADMIN'],      countKey: 'totalDispositivos' },
  { to: '/clientes',     label: 'Clientes',     icon: UserCheck,       roles: ['ADMIN'],      countKey: 'totalClientes' },
  { to: '/jefes',        label: 'Jefes',        icon: Users,           roles: ['ADMIN'], countKey: 'totalJefes' },
  { to: '/cuadrantes',   label: 'Cuadrantes',   icon: Grid3X3,         roles: ['ADMIN'] },
  { to: '/mqtt-devices', label: 'MQTT Broker',  icon: Radio,           roles: ['ADMIN'] },
  { to: '/mapa',         label: 'Mapa',         icon: Map,             roles: ['ADMIN'] },
  { to: '/activaciones', label: 'Activaciones', icon: Bell,            roles: ['ADMIN','MONITOR'], countKey: 'totalActivaciones' },
  { to: '/despacho',     label: 'Despachos',    icon: Truck,           roles: ['ADMIN','COMANDANTE'] },
  { to: '/guardia',      label: 'Guardia',      icon: HeartPulse,      roles: ['ADMIN'] },
]

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: 'Panel de Super Administrador',
  ADMIN:      'Panel de Administrador',
  MONITOR:    'Panel de Monitor',
  COMANDANTE: 'Panel de Comandante',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (days  > 0) return `hace ${days}d`
  if (hours > 0) return `hace ${hours}h`
  if (mins  > 0) return `hace ${mins}m`
  return 'ahora'
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const RESULTADO_STYLE: Record<string, string> = {
  EXITOSO:             'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  FALLIDO:             'bg-red-500/15 text-red-400 border-red-500/30',
  DISPOSITIVO_OFFLINE: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
}

const TIPO_STYLE: Record<string, string> = {
  POLICIA:           'bg-blue-500/15 text-blue-400 border-blue-500/30',
  ASISTENCIA_MEDICA: 'bg-red-500/15 text-red-400 border-red-500/30',
  BOMBEROS:          'bg-orange-500/15 text-orange-400 border-orange-500/30',
}

// bar chart gradient colors by index
const BAR_COLORS = ['#60a5fa','#34d399','#f59e0b','#f472b6','#a78bfa','#fb923c']

// ── Defaults ──────────────────────────────────────────────────────────────────

const EMPTY_STATS: DashboardStats = {
  totalComunidades: 0, totalClientes: 0, totalDispositivos: 0,
  dispositivosOnline: 0, dispositivosOffline: 0, totalActivaciones: 0,
  activacionesHoy: 0, activacionesSemana: 0, activacionesMes: 0,
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const role = user?.rol as Rol | undefined

  const [stats, setStats]         = useState<DashboardStats>(EMPTY_STATS)
  const [recientes, setRecientes] = useState<Activacion[]>([])
  const [porComunidad, setPorComunidad] = useState<ActivacionesPorComunidad[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [countdown, setCountdown] = useState(30)
  const [showConfigModulos, setShowConfigModulos] = useState(false)
  const [selectedActivacion, setSelectedActivacion] = useState<Activacion | null>(null)

  const fetchAll = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true)
    try {
      const isAdmin = role === 'ADMIN'
      const [s, r, p] = await Promise.all([
        isAdmin ? dashboardService.getStatsAdmin()                   : dashboardService.getStats(),
        isAdmin ? dashboardService.getActivacionesRecientesAdmin()   : dashboardService.getActivacionesRecientes(),
        isAdmin ? dashboardService.getActivacionesPorComunidadAdmin(): dashboardService.getActivacionesPorComunidad(),
      ])
      setStats(s.data)
      setRecientes(r.data ?? [])
      setPorComunidad(p.data ?? [])
    } catch {
      // keep EMPTY_STATS; recientes/porComunidad stay empty arrays
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [role])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-refresh every 30 s + countdown ticker
  useEffect(() => {
    setCountdown(30)
    const tick = setInterval(() => setCountdown(c => c - 1), 1_000)
    const refresh = setInterval(() => {
      fetchAll(true)
      setCountdown(30)
    }, 30_000)
    return () => { clearInterval(tick); clearInterval(refresh) }
  }, [fetchAll])

  // CUADRANTE → redirect to full-screen alarm map
  if (role === 'CUADRANTE') return <Navigate to="/cuadrantes/mis-alarmas" replace />

  const misTabs = TABS.filter(t => role && t.roles.includes(role))

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight">
            Bienvenido, {user?.nombre ?? 'Usuario'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {role ? (ROLE_LABEL[role] ?? role) : ''}
          </p>
        </div>
        <button
          onClick={() => { fetchAll(true); setCountdown(30) }}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40 mt-1"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Actualizando...' : `Actualizar · ${countdown}s`}
        </button>
      </div>

      {/* ── Module tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {/* Dashboard tab (active — current page) */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center gap-1 px-5 py-3 rounded-xl bg-blue-600 text-white min-w-[96px] cursor-default select-none">
          <LayoutDashboard size={18} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Dashboard</span>
        </div>

        {/* Other module tabs */}
        {misTabs.filter(t => t.to !== '/').map(t => {
          const Icon = t.icon
          const count = t.countKey ? stats?.[t.countKey] : undefined
          const handleClick = t.to === '/admins'
            ? () => setShowConfigModulos(true)
            : t.to === '/clientes' && role === 'ADMIN' && porComunidad[0]?.comunidad_id
              ? () => navigate(`/clientes?comunidad_id=${porComunidad[0].comunidad_id}`)
              : () => navigate(t.to)
          return (
            <button
              key={t.to}
              onClick={handleClick}
              className="flex-shrink-0 flex flex-col items-start justify-between gap-1 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-gray-600 transition-all min-w-[96px] group"
            >
              {count !== undefined ? (
                <span className="text-xl font-bold text-white">{count}</span>
              ) : (
                <Icon size={18} className="text-gray-500 group-hover:text-gray-300 transition-colors" />
              )}
              <div className="flex items-center gap-1.5">
                {count !== undefined && (
                  <Icon size={12} className="text-gray-500 group-hover:text-gray-400 transition-colors flex-shrink-0" />
                )}
                <span className="text-[10px] text-gray-500 group-hover:text-gray-300 uppercase tracking-wider font-medium transition-colors truncate">
                  {t.label}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Stats bar ── */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* LIVE indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-bold text-emerald-400 tracking-widest">LIVE</span>
        </div>

        <div className="w-px h-4 bg-gray-600 flex-shrink-0 hidden sm:block" />

        {stats ? (
          <>
            <StatPill icon={Building2}   label="Comunidades" value={stats.totalComunidades}    color="text-white"        iconColor="text-gray-400" />
            <StatPill icon={Wifi}        label="Online"      value={stats.dispositivosOnline}  color="text-emerald-400"  iconColor="text-emerald-500" />
            <StatPill icon={WifiOff}     label="Offline"     value={stats.dispositivosOffline} color="text-red-400"      iconColor="text-red-500" />
            <StatPill icon={UserCheck}   label="Clientes"    value={stats.totalClientes}       color="text-cyan-400"     iconColor="text-gray-400" />
            <StatPill icon={Zap}         label="Hoy"         value={stats.activacionesHoy}     color="text-yellow-300"   iconColor="text-yellow-400" />
            <StatPill icon={TrendingUp}  label="Semana"      value={stats.activacionesSemana}  color="text-amber-400"    iconColor="text-gray-400" />
            <StatPill icon={CalendarDays}label="Mes"         value={stats.activacionesMes}     color="text-orange-400"   iconColor="text-gray-400" />
          </>
        ) : (
          <span className="text-xs text-gray-500">Cargando estadísticas...</span>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Activaciones recientes */}
          <div className="lg:col-span-3 bg-gray-800 rounded-xl border border-gray-700 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold text-white">Activaciones Recientes</h2>
              <span className="text-xs text-gray-500">{recientes.length} registros</span>
            </div>
            <div className="divide-y divide-gray-700 overflow-y-auto" style={{ maxHeight: 380 }}>
              {recientes.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">Sin activaciones recientes</div>
              ) : recientes.map(a => {
                const personName    = a.cliente?.nombre ?? a.jefe?.nombre
                const identificador = a.cliente?.identificador
                const phone         = a.cliente?.celular
                const resStyle      = RESULTADO_STYLE[a.resultado] ?? 'bg-gray-700 text-gray-300 border-gray-600'
                const tipoStyle     = TIPO_STYLE[a.tipo_emergencia ?? '']
                return (
                  <div key={a.id} onClick={() => setSelectedActivacion(a)} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-700/40 transition-colors cursor-pointer">
                    {personName ? (
                      <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5">
                        {initials(personName)}
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Bell size={14} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-white truncate">
                          {personName ?? a.comunidad?.nombre ?? '—'}
                        </span>
                        {identificador && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase tracking-wide">
                            {identificador}
                          </span>
                        )}
                        {a.detalle && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-700 text-gray-300 border border-gray-600">
                            {a.detalle}
                          </span>
                        )}
                        {tipoStyle && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${tipoStyle}`}>
                            {a.tipo_emergencia?.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {phone && (
                          <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
                            <Phone size={9} /> {phone}
                          </span>
                        )}
                        {a.comunidad?.nombre && personName && (
                          <span className="text-[11px] text-gray-400">→ {a.comunidad.nombre}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${resStyle}`}>
                        {a.resultado}
                      </span>
                      <span className="text-[11px] text-gray-400">{timeAgo(a.created_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bar chart */}
          <div className="lg:col-span-2 bg-gray-800 rounded-xl border border-gray-700 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-700 shrink-0">
              <h2 className="text-sm font-semibold text-white">Activaciones por Comunidad</h2>
            </div>
            <div className="flex-1 p-4" style={{ minHeight: 260 }}>
              {porComunidad.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  Sin datos disponibles
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={porComunidad}
                    margin={{ top: 8, right: 8, bottom: 48, left: -16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis
                      dataKey="comunidad_nombre"
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#4b5563' }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#111827',
                        border: '1px solid #374151',
                        borderRadius: 8,
                        color: '#f9fafb',
                        fontSize: 12,
                      }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      formatter={(val) => [val, 'Activaciones']}
                      labelFormatter={(l) => `📍 ${l}`}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {porComunidad.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Config Módulos modal ── */}
      {showConfigModulos && (
        <ConfigModulosModal onClose={() => setShowConfigModulos(false)} />
      )}

      {/* ── Activacion detail modal ── */}
      {selectedActivacion && createPortal(
        <ActivacionModal
          activacion={selectedActivacion}
          onClose={() => setSelectedActivacion(null)}
          onVerComunidad={(id) => { setSelectedActivacion(null); navigate(`/comunidades/${id}`) }}
        />,
        document.body
      )}
    </div>
  )
}

// ── StatPill helper ───────────────────────────────────────────────────────────

function StatPill({ icon: Icon, label, value, color, iconColor }: {
  icon: React.ElementType; label: string; value: number; color: string; iconColor?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={13} className={iconColor ?? 'text-gray-400'} />
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xs font-bold ${color}`}>{value}</span>
    </div>
  )
}

// ── ActivacionModal ───────────────────────────────────────────────────────────

const VEREDICTO_STYLE: Record<string, string> = {
  REAL:        'bg-red-500/15 text-red-400 border-red-500/30',
  NOVEDAD:     'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  FALSA:       'bg-gray-500/15 text-gray-400 border-gray-500/30',
  PRUEBA:      'bg-blue-500/15 text-blue-400 border-blue-500/30',
}

function ActivacionModal({ activacion: a, onClose, onVerComunidad }: {
  activacion: Activacion
  onClose: () => void
  onVerComunidad: (id: string) => void
}) {
  const resStyle = RESULTADO_STYLE[a.resultado] ?? 'bg-gray-700 text-gray-300 border-gray-600'
  const tipoStyle = TIPO_STYLE[a.tipo_emergencia ?? '']
  const verStyle = a.veredicto ? (VEREDICTO_STYLE[a.veredicto] ?? 'bg-gray-700 text-gray-300 border-gray-600') : null
  const allSnapshots = [
    ...(a.snapshot_url ? [a.snapshot_url] : []),
    ...(a.snapshot_urls ?? []).filter(u => u !== a.snapshot_url),
  ]
  const personName = a.cliente?.nombre ?? a.jefe?.nombre

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] px-2 py-0.5 rounded font-semibold border ${resStyle}`}>
              {a.resultado.replace('_', ' ')}
            </span>
            {tipoStyle && (
              <span className={`text-[11px] px-2 py-0.5 rounded font-semibold border ${tipoStyle}`}>
                {a.tipo_emergencia?.replace(/_/g, ' ')}
              </span>
            )}
            {verStyle && (
              <span className={`text-[11px] px-2 py-0.5 rounded font-semibold border ${verStyle}`}>
                {a.veredicto}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors ml-2">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: '70vh' }}>

          {/* Timestamp */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock size={13} />
            {new Date(a.created_at).toLocaleString('es-MX', {
              dateStyle: 'medium', timeStyle: 'short',
            })}
            <span className="text-gray-600">·</span>
            <span className="text-gray-500">{timeAgo(a.created_at)}</span>
          </div>

          {/* Person */}
          {personName && (
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {initials(personName)}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{personName}</p>
                {a.cliente?.identificador && (
                  <p className="text-xs text-indigo-300 font-mono">{a.cliente.identificador}</p>
                )}
                {a.cliente?.celular && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Phone size={10} /> {a.cliente.celular}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Detalle */}
          {a.detalle && (
            <div className="flex items-start gap-2 bg-gray-800 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-300">{a.detalle}</p>
            </div>
          )}

          {/* Dispositivo */}
          {a.dispositivo && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Cpu size={13} className="shrink-0" />
              <span>{a.dispositivo.nombre ?? a.dispositivo.id}</span>
              {a.dispositivo.tipo && (
                <span className="text-gray-600">· {a.dispositivo.tipo}</span>
              )}
            </div>
          )}

          {/* Comunidad */}
          {a.comunidad && (
            <div className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">{a.comunidad.nombre}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{a.comunidad.codigo}</p>
                </div>
              </div>
              <button
                onClick={() => onVerComunidad(a.comunidad_id)}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
              >
                <ExternalLink size={13} />
                Ver comunidad
              </button>
            </div>
          )}

          {/* Veredicto observacion */}
          {a.veredicto_observacion && (
            <div className="flex items-start gap-2 bg-gray-800 rounded-lg px-3 py-2">
              <ShieldCheck size={13} className="text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-300">{a.veredicto_observacion}</p>
            </div>
          )}

          {/* Snapshots */}
          {allSnapshots.length > 0 && (
            <div>
              <p className="text-[11px] text-gray-500 flex items-center gap-1 mb-2">
                <Camera size={11} /> Capturas ({allSnapshots.length})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {allSnapshots.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={url}
                      alt={`Captura ${i + 1}`}
                      className="w-full h-28 object-cover rounded-lg border border-gray-700 hover:border-blue-500 transition-colors"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
