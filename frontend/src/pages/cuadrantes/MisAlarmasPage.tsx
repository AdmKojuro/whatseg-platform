import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Bell, AlertTriangle, ShieldCheck, CheckCircle2,
  Send, Navigation, Share2, ChevronDown, ChevronUp,
  Building2, LogOut, MapPin,
} from 'lucide-react'
import { cuadranteService } from '../../services/cuadrante.service'
import { activacionService } from '../../services/activacion.service'
import { useAuth } from '../../hooks/useAuth'
import type { Activacion } from '../../types/activacion'
import type { VeredictoTipo } from '../../types/enums'


function makeCommunityMarker(hasAlarm = false, isNew = false) {
  const fill = hasAlarm ? '#dc2626' : '#16a34a'
  const pulse = isNew ? `
    <div style="position:absolute;top:-8px;left:-8px;width:56px;height:56px;border-radius:50%;
      border:3px solid #dc2626;animation:alarmPulse 1s ease-out infinite;pointer-events:none;"></div>
    <div style="position:absolute;top:-8px;left:-8px;width:56px;height:56px;border-radius:50%;
      border:3px solid #dc2626;animation:alarmPulse 1s ease-out 0.5s infinite;pointer-events:none;"></div>` : ''
  const html = `
    <div style="position:relative;width:40px;height:50px;">
      ${pulse}
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50" style="display:block;">
        <path d="M20 0C8.95 0 0 8.95 0 20c0 16 20 30 20 30S40 36 40 20C40 8.95 31.05 0 20 0z"
          fill="${fill}" stroke="white" stroke-width="1.5"/>
      </svg>
      <img src="/whatseg_favicon.webp"
        style="position:absolute;top:5px;left:50%;transform:translateX(-50%);width:24px;height:24px;object-fit:contain;border-radius:3px;" />
    </div>`
  return L.divIcon({ html, className: '', iconSize: [40, 50], iconAnchor: [20, 50], popupAnchor: [0, -52] })
}

// ─── Map controller: fly-to on new alarm ────────────────────────────────────
function MapController({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.flyTo(target, 17, { duration: 1.5 })
    }
  }, [target, map])
  return null
}

// ─── Community type ──────────────────────────────────────────────────────────
type Community = { id: string; nombre: string; codigo?: string; latitud?: number; longitud?: number; direccion?: string }

// ─── Community marker — triple-trigger click for maximum reliability ─────────
function CommunityMarker({ community, isNew, onSelect }: {
  community: Community
  isNew: boolean
  onSelect: (c: Community) => void
}) {
  const markerRef = useRef<L.Marker>(null)

  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return

    const trigger = () => onSelect(community)

    // Trigger 1: Leaflet event system
    marker.on('click', trigger)

    // Trigger 2: direct DOM listener on _icon after Leaflet adds it to the DOM
    let iconEl: HTMLElement | null = null
    const domFn = () => trigger()
    const t = setTimeout(() => {
      iconEl = (marker as any)._icon as HTMLElement | null
      if (iconEl) iconEl.addEventListener('click', domFn, true)
    }, 0)

    return () => {
      marker.off('click', trigger)
      clearTimeout(t)
      if (iconEl) iconEl.removeEventListener('click', domFn, true)
    }
  }, [community, onSelect])

  return (
    // Trigger 3: react-leaflet eventHandlers prop
    <Marker
      ref={markerRef}
      position={[community.latitud!, community.longitud!]}
      icon={makeCommunityMarker(isNew, isNew)}
      eventHandlers={{ click: () => onSelect(community) }}
    >
      <Tooltip permanent interactive={false} direction="top" offset={[0, -46]} className="leaflet-community-label">
        {community.nombre}
      </Tooltip>
    </Marker>
  )
}

// ─── Constants ───────────────────────────────────────────────────────────────
type FiltroTipo = 'TODAS' | 'POLICIA' | 'ASISTENCIA_MEDICA' | 'BOMBEROS'

const FILTROS: { key: FiltroTipo; label: string; activeClass: string }[] = [
  { key: 'TODAS',             label: 'Todas',    activeClass: 'bg-white text-gray-900' },
  { key: 'POLICIA',           label: 'Policía',  activeClass: 'bg-blue-600 text-white' },
  { key: 'ASISTENCIA_MEDICA', label: 'Médica',   activeClass: 'bg-red-500 text-white' },
  { key: 'BOMBEROS',          label: 'Bomberos', activeClass: 'bg-orange-500 text-white' },
]

const TIPO_INFO: Record<string, { label: string; badge: string }> = {
  POLICIA:           { label: 'Policía',  badge: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  ASISTENCIA_MEDICA: { label: 'Médica',   badge: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  BOMBEROS:          { label: 'Bomberos', badge: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
}

const DEFAULT_CENTER: [number, number] = [4.7110, -74.0721]
const HEADER_H = 48 // px — altura del header

// ─── Component ───────────────────────────────────────────────────────────────
export default function MisAlarmasPage() {
  const { user, logout } = useAuth()
  const [alarmas, setAlarmas]       = useState<Activacion[]>([])
  const [comunidades, setComunidades] = useState<Community[]>([])
  const [loading, setLoading]       = useState(true)
  const [filtro, setFiltro]         = useState<FiltroTipo>('TODAS')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [veredictos, setVeredictos] = useState<Record<string, { tipo: VeredictoTipo; obs: string }>>({})
  const [successId, setSuccessId]   = useState<string | null>(null)
  const [apiError, setApiError]     = useState<string | null>(null)
  const [newAlarmTarget, setNewAlarmTarget] = useState<[number, number] | null>(null)
  const [newAlarmIds, setNewAlarmIds] = useState<Set<string>>(new Set())
  const [selectedCom, setSelectedCom] = useState<Community | null>(null)
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevAlarmIds   = useRef<Set<string>>(new Set())
  const newAlarmTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const initDone       = useRef(false)  // prevents animation before initial seed completes
  const audioUnlocked  = useRef(false)

  // Desbloquea el audio en móvil con el primer gesto del usuario
  const unlockAudio = useCallback(() => {
    if (audioUnlocked.current) return
    const audio = new Audio('/whatseg_sound.mp3')
    audio.volume = 0
    audio.play()
      .then(() => { audio.pause(); audio.currentTime = 0; audioUnlocked.current = true })
      .catch(() => {})
  }, [])

  // Inject CSS keyframe for pulse animation once
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'alarm-pulse-style'
    style.textContent = `
      @keyframes alarmPulse {
        0%   { transform: scale(0.5); opacity: 0.8; }
        100% { transform: scale(1.6); opacity: 0; }
      }
    `
    if (!document.getElementById('alarm-pulse-style')) {
      document.head.appendChild(style)
    }
    return () => { document.getElementById('alarm-pulse-style')?.remove() }
  }, [])

  const fetchAlarmas = useCallback(async () => {
    try {
      const res = await cuadranteService.getMisAlarmas()
      const raw = res.data
      const fetched: Activacion[] = Array.isArray(raw) ? raw : ((raw as any)?.data ?? [])

      // Detect new alarms (not yet seen and without veredicto)
      // Only after init() has seeded prevAlarmIds to avoid animating pre-existing alarms on page load
      const currentIds = new Set(fetched.filter(a => !a.veredicto).map(a => a.id))
      const brandNew = initDone.current
        ? fetched.filter(a => !a.veredicto && !prevAlarmIds.current.has(a.id))
        : []
      prevAlarmIds.current = currentIds

      if (brandNew.length > 0) {
        // Play alarm sound
        try {
          const audio = new Audio('/whatseg_sound.mp3')
          audio.play().catch(() => {})
        } catch {}

        const ids = new Set(brandNew.map(a => a.id))
        setNewAlarmIds(prev => new Set([...prev, ...ids]))

        // Clear "new" status after 15 s
        const timer = setTimeout(() => {
          setNewAlarmIds(prev => {
            const next = new Set(prev)
            ids.forEach(id => next.delete(id))
            return next
          })
          setNewAlarmTarget(null)
        }, 15000)
        newAlarmTimers.current.push(timer)

        // Fly to first new alarm's community
        setComunidades(coms => {
          const firstNew = brandNew[0]
          const com = coms.find(c => c.id === firstNew.comunidad_id)
          if (com?.latitud && com?.longitud) {
            setNewAlarmTarget([com.latitud, com.longitud])
          }
          return coms
        })
      }

      setAlarmas(fetched)
    } catch (e) {
      console.warn('[MisAlarmas] fetchAlarmas error:', e)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const errors: string[] = []

      // Alarmas — falla independiente de comunidades
      try {
        const res = await cuadranteService.getMisAlarmas()
        const raw = res.data
        const initial: Activacion[] = Array.isArray(raw) ? raw : ((raw as any)?.data ?? [])
        // Seed prevAlarmIds so initial load doesn't trigger animations
        prevAlarmIds.current = new Set(initial.filter(a => !a.veredicto).map(a => a.id))
        setAlarmas(initial)
        initDone.current = true  // allow fetchAlarmas to detect new alarms from here on
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`Alarmas: ${msg}`)
        console.error('[MisAlarmas] getMisAlarmas error:', e)
      }

      // Comunidades — falla independiente de alarmas
      try {
        const res = await cuadranteService.getMisComunidades()
        const raw = res.data
        setComunidades(Array.isArray(raw) ? raw : ((raw as any)?.data ?? []))
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`Comunidades: ${msg}`)
        console.error('[MisAlarmas] getMisComunidades error:', e)
      }

      if (errors.length > 0) setApiError(errors.join(' | '))
      setLoading(false)
    }
    init()
    intervalRef.current = setInterval(fetchAlarmas, 1_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      newAlarmTimers.current.forEach(t => clearTimeout(t))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const alarmasFiltradas = filtro === 'TODAS'
    ? alarmas
    : alarmas.filter(a => a.tipo_emergencia === filtro)

  const pendientes = alarmas.filter(a => !a.veredicto).length

  const policia  = alarmas.filter(a => a.tipo_emergencia === 'POLICIA').length
  const medica   = alarmas.filter(a => a.tipo_emergencia === 'ASISTENCIA_MEDICA').length
  const bomberos = alarmas.filter(a => a.tipo_emergencia === 'BOMBEROS').length

  const handleVeredicto = (id: string, field: 'tipo' | 'obs', value: string) =>
    setVeredictos(prev => ({
      ...prev,
      [id]: { tipo: prev[id]?.tipo ?? 'FALSA_ALARMA', obs: prev[id]?.obs ?? '', [field]: value },
    }))

  const submitVeredicto = async (activacionId: string) => {
    const v = veredictos[activacionId]
    if (!v?.tipo) return
    try {
      setSubmittingId(activacionId)
      await activacionService.submitVeredicto(activacionId, { veredicto: v.tipo, observacion: v.obs || undefined })
      setSuccessId(activacionId)
      setTimeout(() => setSuccessId(null), 3000)
      await fetchAlarmas()
    } catch { /* ignore */ }
    finally { setSubmittingId(null) }
  }

  const mapCenter: [number, number] = (() => {
    const withCoords = comunidades.filter(c => c.latitud && c.longitud)
    if (withCoords.length === 0) return DEFAULT_CENTER
    return [
      withCoords.reduce((s, c) => s + c.latitud!, 0) / withCoords.length,
      withCoords.reduce((s, c) => s + c.longitud!, 0) / withCoords.length,
    ]
  })()

  const formatTime = (d: string) =>
    new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `hace ${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `hace ${hrs}h`
    return `hace ${Math.floor(hrs / 24)}d`
  }

  const openInMaps = (a: Activacion) => {
    const com = comunidades.find(c => c.id === a.comunidad_id)
    if (com?.latitud && com?.longitud)
      window.open(`https://www.google.com/maps/search/?api=1&query=${com.latitud},${com.longitud}`, '_blank')
  }

  const shareAlarm = (a: Activacion) => {
    const com = comunidades.find(c => c.id === a.comunidad_id)
    const tipo = TIPO_INFO[a.tipo_emergencia ?? '']?.label ?? ''
    const ubicacion = com?.direccion
      ? `📍 ${com.direccion}`
      : (com?.latitud && com?.longitud ? `📍 ${com.latitud.toFixed(6)}, ${com.longitud.toFixed(6)}` : '')
    const mapsLink = com?.latitud && com?.longitud
      ? `https://www.google.com/maps/search/?api=1&query=${com.latitud},${com.longitud}`
      : ''
    const parts = [
      `🚨 Alarma: ${a.comunidad?.nombre ?? ''}`,
      tipo ? `Tipo: ${tipo}` : '',
      `Hora: ${formatTime(a.created_at)}`,
      ubicacion,
      mapsLink,
    ].filter(Boolean).join('\n')
    if (navigator.share) navigator.share({ title: 'Alarma WhatsEg', text: parts })
    else navigator.clipboard.writeText(parts)
  }

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-surface-900">
      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <>
    <div className="h-screen flex flex-col bg-surface-900 overflow-hidden" onClick={unlockAudio}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-surface-900 border-b border-surface-700">
        {/* Fila principal */}
        <div className="px-4 flex items-center justify-between gap-2" style={{ height: HEADER_H }}>
          {/* LEFT: avatar + nombre */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user?.nombre?.charAt(0).toUpperCase()}
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.nombre}</p>
              <p className="text-[10px] text-surface-400">Cuadrante de seguridad</p>
            </div>
          </div>

          {/* CENTER: LIVE + filtros (solo desktop) */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-1.5 pr-3 border-r border-gray-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-[10px] font-bold text-red-400 tracking-widest">LIVE</span>
            </div>
            <div className="flex gap-1">
              {FILTROS.map(f => {
                const count = f.key === 'POLICIA' ? policia : f.key === 'ASISTENCIA_MEDICA' ? medica : f.key === 'BOMBEROS' ? bomberos : null
                return (
                  <button
                    key={f.key}
                    onClick={() => setFiltro(f.key)}
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                      filtro === f.key
                        ? f.activeClass
                        : 'bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-white'
                    }`}
                  >
                    {f.label}
                    {count !== null && count > 0 && <span className="ml-1 opacity-80">({count})</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* RIGHT: stats + salir */}
          <div className="flex items-center gap-3 text-[11px] text-surface-300">
            {/* LIVE dot (solo móvil) */}
            <div className="flex sm:hidden items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-[10px] font-bold text-red-400 tracking-widest">LIVE</span>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Building2 size={11} />
                <span className="text-white font-semibold">{comunidades.length}</span> sucursales
              </span>
              <span className="flex items-center gap-1">
                <Bell size={11} />
                <span className={alarmas.length > 0 ? 'text-amber-400 font-semibold' : 'text-white font-semibold'}>{alarmas.length}</span> alarmas
              </span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-surface-300 hover:text-red-400 transition-colors font-medium"
            >
              <LogOut size={14} />
              <span className="text-xs">Salir</span>
            </button>
          </div>
        </div>

        {/* Fila de filtros (solo móvil) */}
        <div className="sm:hidden px-3 pb-2 flex items-center gap-1 overflow-x-auto scrollbar-none">
          {FILTROS.map(f => {
            const count = f.key === 'POLICIA' ? policia : f.key === 'ASISTENCIA_MEDICA' ? medica : f.key === 'BOMBEROS' ? bomberos : null
            return (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className={`shrink-0 text-[11px] px-3 py-1 rounded-full font-medium transition-colors ${
                  filtro === f.key
                    ? f.activeClass
                    : 'bg-surface-800 text-surface-300'
                }`}
              >
                {f.label}
                {count !== null && count > 0 && <span className="ml-1 opacity-80">({count})</span>}
              </button>
            )
          })}
        </div>
      </header>

      {/* ── ERROR BANNER ─────────────────────────────────────────────────── */}
      {apiError && (
        <div className="shrink-0 bg-red-900/80 border-b border-red-700 px-4 py-2 text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle size={12} className="shrink-0 text-red-400" />
          <span>{apiError}</span>
          <button onClick={() => setApiError(null)} className="ml-auto text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ── MAP + PANEL ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">

        {/* Mapa */}
        <div className="flex-1 min-h-0 relative z-0">
          <MapContainer
            center={mapCenter}
            zoom={comunidades.filter(c => c.latitud).length > 0 ? 13 : 6}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            <MapController target={newAlarmTarget} />
            {(() => {
              // Communities with new (just-arrived) alarms — for pulse animation only
              const newAlarmCommunities = new Set(
                alarmas.filter(a => !a.veredicto && newAlarmIds.has(a.id)).map(a => a.comunidad_id)
              )
              return comunidades.filter(c => c.latitud && c.longitud).map(c => {
                const isNew = newAlarmCommunities.has(c.id)
                return (
                  <CommunityMarker
                    key={`${c.id}-${isNew}`}
                    community={c}
                    isNew={isNew}
                    onSelect={setSelectedCom}
                  />
                )
              })
            })()}
          </MapContainer>

          {/* Overlay comunidad seleccionada — renderizado via portal sobre document.body */}

          {/* Badge sobre el mapa */}
          <div className="absolute top-3 left-3 z-[1000] bg-surface-900/90 backdrop-blur border border-surface-700 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs font-semibold text-white">
              {pendientes > 0 ? `${pendientes} sin resolver` : 'Sin alarmas pendientes'}
            </span>
          </div>
        </div>

        {/* Panel de alarmas */}
        <div className="h-64 md:h-auto w-full md:w-80 bg-surface-900 border-t md:border-t-0 md:border-l border-surface-700 flex flex-col shrink-0 z-10">
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-surface-700 shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-red-400" />
              <h2 className="text-sm font-semibold text-white flex-1">Alarmas Recientes</h2>
              {pendientes > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{pendientes}</span>
              )}
            </div>
            <div className="flex gap-4 mt-1.5 text-[11px] text-surface-400">
              <span><span className="text-white font-semibold">{comunidades.length}</span> Sucursales</span>
              <span><span className={alarmas.length > 0 ? 'text-amber-400 font-semibold' : 'text-white font-semibold'}>{alarmas.length}</span> Alarmas</span>
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto divide-y divide-surface-800">
            {alarmasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-surface-500">
                <ShieldCheck size={32} className="mb-2 opacity-40" />
                <p className="text-sm">Sin alarmas</p>
              </div>
            ) : alarmasFiltradas.map(a => {
              const tipo = TIPO_INFO[a.tipo_emergencia ?? '']
              const isPending = !a.veredicto
              const isExpanded = expandedId === a.id
              const v = veredictos[a.id]
              const com = comunidades.find(c => c.id === a.comunidad_id)
              const contacto = a.cliente ?? (a.jefe ? { nombre: a.jefe.nombre, celular: undefined } : null)

              return (
                <div
                  key={a.id}
                  className={`px-3 py-3 space-y-2 ${isPending ? 'border-l-2 border-red-500/70' : 'border-l-2 border-transparent'}`}
                >
                  {/* Nombre + tipo + tiempo */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5 flex-1 min-w-0">
                      <AlertTriangle size={12} className={`mt-0.5 shrink-0 ${isPending ? 'text-red-400' : 'text-surface-500'}`} />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-white truncate block">{a.comunidad?.nombre ?? '—'}</span>
                        {a.detalle && <p className="text-[10px] text-surface-400 truncate">{a.detalle}</p>}
                        {com?.direccion && <p className="text-[10px] text-surface-500 truncate">{com.direccion}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {tipo && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${tipo.badge}`}>{tipo.label}</span>
                      )}
                      <span className="text-[10px] text-surface-500">{timeAgo(a.created_at)}</span>
                    </div>
                  </div>

                  {/* Botones Ir + Compartir */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openInMaps(a)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-medium rounded-lg transition-colors"
                    >
                      <Navigation size={11} /> Ir
                    </button>
                    <button
                      onClick={() => shareAlarm(a)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-surface-700 hover:bg-surface-600 text-surface-300 text-[11px] font-medium rounded-lg transition-colors"
                    >
                      <Share2 size={11} /> Compartir
                    </button>
                  </div>

                  {/* Contacto con teléfono */}
                  {contacto && (
                    <div className="flex items-center gap-2 bg-surface-800 rounded-lg px-2 py-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[11px] font-medium text-white truncate">{contacto.nombre}</p>
                          {a.cliente?.identificador && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                              {a.cliente.identificador}
                            </span>
                          )}
                        </div>
                        {contacto.celular && <p className="text-[10px] text-surface-400">{contacto.celular}</p>}
                      </div>
                      {contacto.celular && (
                        <div className="flex gap-1 shrink-0">
                          <a
                            href={`tel:${contacto.celular}`}
                            className="p-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                            title="Llamar"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                            </svg>
                          </a>
                          <button
                            onClick={() => navigator.clipboard.writeText(contacto.celular!)}
                            className="p-1.5 rounded-md bg-surface-700 hover:bg-surface-600 text-surface-300 transition-colors"
                            title="Copiar número"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Veredicto (colapsable) */}
                  {!a.veredicto ? (
                    <>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        className="w-full flex items-center justify-between text-[10px] text-surface-500 hover:text-surface-300 transition-colors pt-1 border-t border-surface-800"
                      >
                        <span>Dar veredicto</span>
                        {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                      {isExpanded && (
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleVeredicto(a.id, 'tipo', 'FALSA_ALARMA')}
                              className={`flex-1 py-1 text-[10px] rounded font-medium border transition-colors ${v?.tipo === 'FALSA_ALARMA' ? 'bg-surface-200 text-surface-900 border-surface-200' : 'bg-surface-800 text-surface-400 border-surface-600 hover:bg-surface-700'}`}
                            >
                              Falsa Alarma
                            </button>
                            <button
                              onClick={() => handleVeredicto(a.id, 'tipo', 'NOVEDAD')}
                              className={`flex-1 py-1 text-[10px] rounded font-medium border transition-colors ${v?.tipo === 'NOVEDAD' ? 'bg-red-600 text-white border-red-600' : 'bg-surface-800 text-surface-400 border-surface-600 hover:bg-surface-700'}`}
                            >
                              Novedad
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Observación (opcional)..."
                            value={v?.obs ?? ''}
                            onChange={e => handleVeredicto(a.id, 'obs', e.target.value)}
                            className="w-full bg-surface-700 border border-surface-600 rounded-lg px-2 py-1.5 text-[11px] text-white placeholder-surface-500 resize-none focus:outline-none focus:border-brand-500"
                          />
                          <button
                            onClick={() => submitVeredicto(a.id)}
                            disabled={!v?.tipo || submittingId === a.id}
                            className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-[11px] font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Send size={10} />
                            {submittingId === a.id ? 'Enviando...' : 'Enviar Veredicto'}
                          </button>
                          {successId === a.id && (
                            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 size={10} /> Veredicto enviado
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] pt-1 border-t border-surface-800">
                      <CheckCircle2 size={11} className="text-emerald-400" />
                      <span className="text-emerald-400 font-medium">
                        {a.veredicto === 'FALSA_ALARMA' ? 'Falsa Alarma' : 'Novedad'}
                      </span>
                      {a.veredicto_observacion && (
                        <span className="text-surface-500 truncate">· {a.veredicto_observacion}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>

    {/* ── OVERLAY comunidad — portal sobre document.body ───────────────── */}
    {selectedCom && createPortal(
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] rounded-xl overflow-hidden shadow-2xl border border-gray-200"
        style={{ minWidth: 230 }}
      >
        <div className="flex items-center justify-between px-3 py-2" style={{ background: '#16a34a' }}>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">{selectedCom.nombre}</span>
            {selectedCom.codigo && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: 'rgba(255,255,255,0.25)' }}>
                {selectedCom.codigo}
              </span>
            )}
          </div>
          <button
            onClick={() => setSelectedCom(null)}
            className="text-white/80 hover:text-white text-lg leading-none ml-3"
          >✕</button>
        </div>
        <div className="bg-white px-3 py-2 space-y-2">
          {selectedCom.direccion && (
            <p className="text-xs text-surface-400 flex items-start gap-1">
              <MapPin size={12} className="shrink-0 mt-0.5 text-surface-300" />
              <span>{selectedCom.direccion}</span>
            </p>
          )}
          {selectedCom.latitud && selectedCom.longitud && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${selectedCom.latitud},${selectedCom.longitud}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs font-bold text-white py-1.5 rounded-lg"
              style={{ background: '#16a34a' }}
            >
              <Navigation size={12} />
              Abrir ruta en Maps
            </a>
          )}
        </div>
      </div>,
      document.body
    )}
    </>
  )
}
