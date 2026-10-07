import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Clock, RefreshCw, Loader2, AlertTriangle,
  Mic, MapPin, Camera, Shield, Car, UserCheck,
  Siren, Truck, ShieldAlert, Info, ChevronDown, ChevronUp,
  CheckCircle2,
} from 'lucide-react'
import { incidenteService } from '../../services/incidente.service'
import type {
  Incidente, EventoTimeline, TipoEvento, SeveridadEvento,
  EstadoIncidente, SeveridadIncidente,
} from '../../types/incidente'

const API_BASE = (import.meta.env.VITE_API_EXT_URL || import.meta.env.VITE_API_BASE_URL || '/api').replace('/ext', '')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEV_BORDER: Record<SeveridadEvento, string> = {
  CRITICAL: 'border-l-red-500',
  WARNING:  'border-l-yellow-400',
  INFO:     'border-l-blue-400',
}

const SEV_BG: Record<SeveridadEvento, string> = {
  CRITICAL: 'bg-red-50',
  WARNING:  'bg-yellow-50',
  INFO:     'bg-blue-50',
}

const SEV_BADGE: Record<SeveridadEvento, string> = {
  CRITICAL: 'bg-red-100 text-red-400',
  WARNING:  'bg-yellow-100 text-yellow-400',
  INFO:     'bg-blue-100 text-blue-400',
}

const TIPO_ICON: Record<TipoEvento, React.ReactNode> = {
  PTT_REPORT:         <Mic className="w-4 h-4" />,
  PATROL_CHECKPOINT:  <MapPin className="w-4 h-4" />,
  AI_ALERT:           <Camera className="w-4 h-4" />,
  BEHAVIOR_ALERT:     <Shield className="w-4 h-4" />,
  GUARD_ALERT:        <ShieldAlert className="w-4 h-4" />,
  GUARD_PANIC:        <Siren className="w-4 h-4" />,
  PLATE_ALERT:        <Car className="w-4 h-4" />,
  VISITOR:            <UserCheck className="w-4 h-4" />,
  PANIC_BUTTON:       <AlertTriangle className="w-4 h-4" />,
  DISPATCH:           <Truck className="w-4 h-4" />,
}

const TIPO_LABEL: Record<TipoEvento, string> = {
  PTT_REPORT:         'Radio PTT',
  PATROL_CHECKPOINT:  'Checkpoint',
  AI_ALERT:           'Alerta IA',
  BEHAVIOR_ALERT:     'Comportamiento',
  GUARD_ALERT:        'Alerta Guardia',
  GUARD_PANIC:        'Pánico Guardia',
  PLATE_ALERT:        'Placa',
  VISITOR:            'Visita',
  PANIC_BUTTON:       'Botón Pánico',
  DISPATCH:           'Despacho',
}

const ESTADO_COLORS: Record<EstadoIncidente, string> = {
  ABIERTO:           'bg-red-100 text-red-400',
  EN_INVESTIGACION:  'bg-yellow-100 text-yellow-400',
  CERRADO:           'bg-green-100 text-green-400',
  ARCHIVADO:         'bg-gray-100 text-gray-400',
}

const SEV_INC_COLORS: Record<SeveridadIncidente, string> = {
  BAJA:   'bg-blue-100 text-blue-400',
  MEDIA:  'bg-yellow-100 text-yellow-400',
  ALTA:   'bg-orange-100 text-orange-400',
  CRITICA:'bg-red-100 text-red-400',
}

function formatTs(ts: string) {
  return new Date(ts).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

// ─── EventCard ───────────────────────────────────────────────────────────────

function EventCard({ ev, apiBase }: { ev: EventoTimeline; apiBase: string }) {
  const [expanded, setExpanded] = useState(false)
  const [imgError, setImgError] = useState(false)

  const hasMedia = !!ev.media_url
  const isAudio = ev.tipo === 'PTT_REPORT'
  const hasImg = hasMedia && !isAudio

  return (
    <div className={`border-l-4 ${SEV_BORDER[ev.severidad]} ${SEV_BG[ev.severidad]} rounded-r-xl p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        {/* Ícono tipo */}
        <div className="mt-0.5 text-gray-400">{TIPO_ICON[ev.tipo]}</div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">{ev.titulo}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SEV_BADGE[ev.severidad]}`}>
              {ev.severidad}
            </span>
            <span className="text-xs text-gray-400 bg-gray-700 px-1.5 py-0.5 rounded">
              {TIPO_LABEL[ev.tipo]}
            </span>
            {ev.actor && (
              <span className="text-xs text-gray-500 ml-auto">{ev.actor}</span>
            )}
          </div>

          {/* Timestamp */}
          <p className="text-xs text-gray-500 mt-0.5">{formatTs(ev.timestamp)}</p>

          {/* Description */}
          <p className="text-sm text-gray-300 mt-1">{ev.descripcion}</p>

          {/* Audio player */}
          {isAudio && hasMedia && (
            <div className="mt-2">
              <audio
                controls
                src={`${apiBase}${ev.media_url}`}
                className="w-full h-8 rounded"
              />
            </div>
          )}

          {/* Image */}
          {hasImg && !imgError && (
            <div className="mt-2">
              <img
                src={`${apiBase}${ev.media_url}`}
                alt="evidencia"
                className="max-h-32 rounded-lg border border-gray-700 object-cover"
                onError={() => setImgError(true)}
              />
            </div>
          )}

          {/* Metadata expandible */}
          {ev.metadata && Object.keys(ev.metadata).length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-400 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Ocultar' : 'Ver'} metadata
            </button>
          )}
          {expanded && ev.metadata && (
            <pre className="mt-1 text-xs bg-white border border-gray-700 rounded p-2 overflow-x-auto text-gray-400">
              {JSON.stringify(ev.metadata, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

const ALL_TIPOS: TipoEvento[] = [
  'PTT_REPORT', 'PATROL_CHECKPOINT', 'AI_ALERT', 'BEHAVIOR_ALERT',
  'GUARD_ALERT', 'GUARD_PANIC', 'PLATE_ALERT', 'VISITOR', 'PANIC_BUTTON', 'DISPATCH',
]

export default function IncidenteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [incidente, setIncidente] = useState<Incidente | null>(null)
  const [eventos, setEventos] = useState<EventoTimeline[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTl, setLoadingTl] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<TipoEvento[]>([])
  const [filtroSev, setFiltroSev] = useState<SeveridadEvento[]>([])

  // Estado editable
  const [updatingEstado, setUpdatingEstado] = useState(false)

  const fetchTimeline = useCallback(async () => {
    if (!id) return
    try {
      setLoadingTl(true)
      const [incRes, tlRes] = await Promise.all([
        incidenteService.getById(id),
        incidenteService.getTimeline(id),
      ])
      setIncidente(incRes.data)
      setEventos(tlRes.data.eventos)
    } catch {
      setError('Error al cargar el incidente')
    } finally {
      setLoading(false)
      setLoadingTl(false)
    }
  }, [id])

  useEffect(() => { fetchTimeline() }, [fetchTimeline])

  const handleEstado = async (estado: EstadoIncidente) => {
    if (!id) return
    try {
      setUpdatingEstado(true)
      const { data } = await incidenteService.update(id, { estado })
      setIncidente(data)
    } catch { /* noop */ }
    finally { setUpdatingEstado(false) }
  }

  const toggleTipo = (t: TipoEvento) =>
    setFiltroTipo(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const toggleSev = (s: SeveridadEvento) =>
    setFiltroSev(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const filtrados = eventos.filter(ev => {
    if (filtroTipo.length > 0 && !filtroTipo.includes(ev.tipo)) return false
    if (filtroSev.length > 0 && !filtroSev.includes(ev.severidad)) return false
    return true
  })

  // Agrupar por fecha
  const porFecha: Record<string, EventoTimeline[]> = {}
  for (const ev of filtrados) {
    const d = ev.timestamp.slice(0, 10)
    if (!porFecha[d]) porFecha[d] = []
    porFecha[d].push(ev)
  }

  const stats = {
    total: eventos.length,
    criticos: eventos.filter(e => e.severidad === 'CRITICAL').length,
    advertencias: eventos.filter(e => e.severidad === 'WARNING').length,
    info: eventos.filter(e => e.severidad === 'INFO').length,
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error || !incidente) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl text-red-400">
        <AlertTriangle className="w-5 h-5" />
        {error ?? 'Incidente no encontrado'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => navigate('/incidentes')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-100 transition-colors mt-1">
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{incidente.titulo}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {incidente.comunidad_nombre ?? incidente.comunidad_id} · {formatTs(incidente.fecha_inicio)} · ±{incidente.ventana_horas}h
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${SEV_INC_COLORS[incidente.severidad]}`}>
            {incidente.severidad}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_COLORS[incidente.estado]}`}>
            {incidente.estado.replace('_', ' ')}
          </span>
          <button onClick={() => fetchTimeline()} disabled={loadingTl}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTl ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Descripción e info */}
      {incidente.descripcion && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          {incidente.descripcion}
        </div>
      )}

      {/* Cambiar estado */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center gap-3 flex-wrap">
        <p className="text-sm font-medium text-gray-300">Cambiar estado:</p>
        {(['ABIERTO', 'EN_INVESTIGACION', 'CERRADO', 'ARCHIVADO'] as EstadoIncidente[]).map(est => (
          <button
            key={est}
            disabled={updatingEstado || incidente.estado === est}
            onClick={() => handleEstado(est)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              incidente.estado === est
                ? ESTADO_COLORS[est] + ' border-transparent font-semibold'
                : 'border-gray-300 text-gray-400 hover:bg-gray-700/50'
            }`}
          >
            {incidente.estado === est && <CheckCircle2 className="inline w-3 h-3 mr-1" />}
            {est.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total eventos', value: stats.total, color: 'text-white' },
          { label: 'Críticos', value: stats.criticos, color: 'text-red-600' },
          { label: 'Advertencias', value: stats.advertencias, color: 'text-yellow-600' },
          { label: 'Informativos', value: stats.info, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros de timeline */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtrar timeline</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-400 self-center mr-1">Tipo:</span>
          {ALL_TIPOS.map(t => (
            <button key={t}
              onClick={() => toggleTipo(t)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
                filtroTipo.includes(t)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 text-gray-400 hover:bg-gray-700/50'
              }`}
            >
              {TIPO_ICON[t]}
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-400 self-center mr-1">Severidad:</span>
          {(['CRITICAL', 'WARNING', 'INFO'] as SeveridadEvento[]).map(s => (
            <button key={s}
              onClick={() => toggleSev(s)}
              className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                filtroSev.includes(s)
                  ? SEV_BADGE[s] + ' border-transparent'
                  : 'border-gray-300 text-gray-400 hover:bg-gray-700/50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {filtrados.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-10 text-center">
          <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Sin eventos en el período especificado</p>
          <p className="text-gray-400 text-sm mt-1">
            Ajusta la ventana de tiempo o los filtros
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(porFecha).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, evs]) => (
            <div key={fecha}>
              {/* Separador de fecha */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-900 px-3 py-1 rounded-full border border-gray-700">
                  {formatDate(fecha + 'T12:00:00')}
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* Eventos del día */}
              <div className="space-y-2">
                {evs.map(ev => (
                  <EventCard key={ev.id} ev={ev} apiBase={API_BASE} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
