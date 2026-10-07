import { useState, useEffect } from 'react'
import {
  X, Shield, AlertOctagon, Mic, Bot, MessageSquare,
  LayoutDashboard, CheckCircle2, Video,
} from 'lucide-react'
import api from '../services/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModuloConfig {
  modulo: string
  activo: boolean
}

interface ComunidadConfig {
  id: string
  nombre: string
  codigo?: string
  modulos: ModuloConfig[] | null
}

// ── Module metadata ───────────────────────────────────────────────────────────

const MODULOS_META: Record<string, { nombre: string; icon: React.ElementType }> = {
  RONDAS:           { nombre: 'Monitoreo de Rondas',   icon: Shield },
  BOTON_PANICO:     { nombre: 'Botón de Pánico',        icon: AlertOctagon },
  REPORTES_PTT:     { nombre: 'Reportes PTT',           icon: Mic },
  ASISTENTE_IA:     { nombre: 'PTT con Asistente IA',  icon: Bot },
  SOPORTE_BILINGUE: { nombre: 'Soporte Bilingüe',       icon: MessageSquare },
  VIDEOPORTERO:     { nombre: 'Videoportero',            icon: Video },
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export default function ConfigModulosModal({ onClose }: Props) {
  const [comunidades, setComunidades] = useState<ComunidadConfig[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(false)
  const [toast, setToast]             = useState('')
  const [saving, setSaving]           = useState<string | null>(null) // "comunidadId:MODULO"

  useEffect(() => {
    api.get<ComunidadConfig[]>('/ext/modulos/comunidades-config')
      .then(res => setComunidades(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const toggleModulo = async (comunidadId: string, modulo: string, activo: boolean) => {
    const key = `${comunidadId}:${modulo}`
    setSaving(key)

    // Optimistic update
    setComunidades(prev => prev.map(c => {
      if (c.id !== comunidadId) return c
      const mods = Array.isArray(c.modulos) ? c.modulos : []
      const exists = mods.find(m => m.modulo === modulo)
      return {
        ...c,
        modulos: exists
          ? mods.map(m => m.modulo === modulo ? { ...m, activo } : m)
          : [...mods, { modulo, activo }],
      }
    }))

    try {
      await api.put(`/ext/modulos/comunidad/${comunidadId}`, {
        modulos: [{ modulo, activo }],
      })
      showToast(activo ? 'Módulo activado' : 'Módulo desactivado')
    } catch {
      // Revert on error
      setComunidades(prev => prev.map(c => {
        if (c.id !== comunidadId) return c
        const mods = Array.isArray(c.modulos) ? c.modulos : []
        return {
          ...c,
          modulos: mods.map(m => m.modulo === modulo ? { ...m, activo: !activo } : m),
        }
      }))
      showToast('Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Configuración de Módulos</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Activa o desactiva módulos por comunidad. El Dashboard siempre está activo.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <p className="text-sm text-red-400 font-medium">Error al cargar comunidades</p>
              <p className="text-xs text-gray-500">Verifica que el servidor esté disponible</p>
            </div>
          ) : comunidades.length === 0 ? (
            <p className="text-center text-gray-500 py-12 text-sm">No se encontraron comunidades</p>
          ) : comunidades.map(comunidad => {
            const mods = Array.isArray(comunidad.modulos) ? comunidad.modulos : []
            return (
              <div
                key={comunidad.id}
                className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-colors"
              >
                {/* Community name */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-bold text-white">{comunidad.nombre}</span>
                  {comunidad.codigo && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-700 text-gray-400 font-medium">
                      {comunidad.codigo}
                    </span>
                  )}
                </div>

                {/* Modules grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">

                  {/* Dashboard — always active, non-configurable */}
                  <div className="flex items-center justify-between p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
                        <LayoutDashboard size={14} className="text-green-400" />
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-white leading-tight">Dashboard</p>
                        <p className="text-[10px] text-green-400 font-bold uppercase tracking-wide mt-0.5">Siempre activo</p>
                      </div>
                    </div>
                    {/* Toggle disabled */}
                    <div className="relative w-9 h-5 bg-green-500/40 rounded-full opacity-60 cursor-not-allowed shrink-0">
                      <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-green-400" />
                    </div>
                  </div>

                  {/* Configurable modules */}
                  {Object.entries(MODULOS_META).map(([key, meta]) => {
                    const modConfig = mods.find(m => m.modulo === key)
                    const activo    = modConfig?.activo ?? false
                    const isSaving  = saving === `${comunidad.id}:${key}`
                    const Icon      = meta.icon

                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                          activo
                            ? 'bg-green-500/5 border-green-500/20'
                            : 'bg-gray-700/20 border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            activo ? 'bg-green-500/15' : 'bg-gray-600/40'
                          }`}>
                            <Icon size={14} className={activo ? 'text-green-400' : 'text-gray-500'} />
                          </div>
                          <p className="text-[12px] font-semibold text-gray-200 leading-tight truncate">
                            {meta.nombre}
                          </p>
                        </div>

                        {/* Toggle */}
                        <button
                          disabled={isSaving}
                          onClick={() => toggleModulo(comunidad.id, key, !activo)}
                          className={`relative w-9 h-5 rounded-full transition-all shrink-0 ml-2 ${
                            activo ? 'bg-green-500' : 'bg-gray-600'
                          } ${isSaving ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:opacity-90'}`}
                        >
                          <span
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow-sm"
                            style={{ left: activo ? '18px' : '2px' }}
                          />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Toast notification */}
        {toast && (
          <div className="absolute bottom-5 right-5 flex items-center gap-2 bg-green-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">
            <CheckCircle2 size={14} />
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
