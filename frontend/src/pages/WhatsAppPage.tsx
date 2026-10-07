import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MessageCircle,
  CheckCircle2,
  XCircle,
  QrCode,
  LogOut,
  RefreshCw,
} from 'lucide-react'
import { whatsappService } from '../services/whatsapp.service'
import type { WaStatus, WaConversacion, WaMensaje } from '../services/whatsapp.service'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'

const POLL_INTERVAL = 4000

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WaStatus | null>(null)
  const [conversaciones, setConversaciones] = useState<WaConversacion[]>([])
  const [activeCelular, setActiveCelular] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<WaMensaje[]>([])
  const [loadingMensajes, setLoadingMensajes] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchStatus = useCallback(() => {
    whatsappService.status().then(r => setStatus(r.data)).catch(() => {})
  }, [])

  const fetchConversaciones = useCallback(() => {
    whatsappService.conversaciones().then(r => setConversaciones(r.data)).catch(() => {})
  }, [])

  const fetchMensajes = useCallback((celular: string, showSpinner = false) => {
    if (showSpinner) setLoadingMensajes(true)
    whatsappService
      .mensajes(celular)
      .then(r => setMensajes(r.data))
      .catch(() => {})
      .finally(() => setLoadingMensajes(false))
  }, [])

  // Poll status + conversaciones
  useEffect(() => {
    fetchStatus()
    fetchConversaciones()
    const t = setInterval(() => {
      fetchStatus()
      fetchConversaciones()
    }, POLL_INTERVAL)
    return () => clearInterval(t)
  }, [fetchStatus, fetchConversaciones])

  // Poll mensajes when conversation is open
  useEffect(() => {
    if (!activeCelular) return
    fetchMensajes(activeCelular, true)
    const t = setInterval(() => fetchMensajes(activeCelular), POLL_INTERVAL)
    return () => clearInterval(t)
  }, [activeCelular, fetchMensajes])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const handleLogout = async () => {
    if (!confirm('¿Cerrar la sesión de WhatsApp? El bot quedará desconectado hasta que escanees un nuevo código QR.')) return
    setCerrando(true)
    try {
      await whatsappService.logout()
      setStatus(s => s ? { ...s, status: 'connecting', qrDataUrl: null } : s)
    } catch {
      alert('No se pudo cerrar la sesión. Intenta de nuevo.')
    } finally {
      setCerrando(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircle className="text-brand-500" size={22} />
        <h1 className="text-xl font-semibold text-white">WhatsApp — Bot Domótica</h1>
      </div>

      {/* Connection status */}
      <Card title="Estado de conexión">
        {!status && (
          <div className="flex items-center gap-2 text-surface-400 text-sm">
            <Spinner size="sm" /> Consultando estado...
          </div>
        )}

        {status?.status === 'connected' && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-green-400">
              <CheckCircle2 size={20} />
              <div>
                <p className="font-medium">Conectado</p>
                {status.phone && (
                  <p className="text-xs text-surface-400">Número: +{status.phone}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={cerrando}
              className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-red-400 border border-surface-700 hover:border-red-500/40 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              {cerrando ? <Spinner size="sm" /> : <LogOut size={14} />}
              Cerrar sesión
            </button>
          </div>
        )}

        {status?.status === 'connecting' && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <QrCode size={18} />
              Escanea este código QR desde WhatsApp → Dispositivos vinculados
            </div>
            {status.qrDataUrl ? (
              <img
                src={status.qrDataUrl}
                alt="QR WhatsApp"
                className="rounded-lg border border-surface-700"
                width={240}
                height={240}
              />
            ) : (
              <Spinner size="md" />
            )}
          </div>
        )}

        {status?.status === 'disconnected' && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <XCircle size={18} />
            Desconectado. Esperando que el bot genere un nuevo QR...
            <button onClick={fetchStatus} className="ml-2 text-surface-400 hover:text-white">
              <RefreshCw size={14} />
            </button>
          </div>
        )}
      </Card>

      {/* Conversations */}
      <Card className="!p-0 overflow-hidden" title="Conversaciones">
        <div className="flex h-[560px] -mx-6 -my-4">
          {/* Left: list */}
          <div className="w-72 border-r border-surface-800 overflow-y-auto flex-shrink-0">
            {conversaciones.length === 0 && (
              <p className="text-surface-500 text-sm p-4">Aún no hay conversaciones.</p>
            )}
            {conversaciones.map(conv => (
              <button
                key={conv.celular}
                onClick={() => setActiveCelular(conv.celular)}
                className={`w-full text-left px-4 py-3 border-b border-surface-800/60 transition-colors ${
                  activeCelular === conv.celular
                    ? 'bg-brand-600/15'
                    : 'hover:bg-surface-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white truncate">
                    {conv.nombre || conv.celular}
                  </span>
                  <span className="text-[10px] text-surface-500 flex-shrink-0">
                    {formatHora(conv.ultima_fecha)}
                  </span>
                </div>
                <p className="text-xs text-surface-400 truncate mt-0.5">
                  {conv.ultima_direccion === 'OUT' ? 'Tú: ' : ''}
                  {conv.ultimo_mensaje}
                </p>
                <p className="text-[10px] text-surface-600 mt-0.5">{conv.celular}</p>
              </button>
            ))}
          </div>

          {/* Right: messages */}
          <div className="flex-1 flex flex-col bg-surface-950/40">
            {!activeCelular && (
              <div className="flex-1 flex items-center justify-center text-surface-500 text-sm">
                Selecciona una conversación para ver el historial
              </div>
            )}

            {activeCelular && (
              <>
                <div className="px-4 py-3 border-b border-surface-800 text-sm text-white font-medium">
                  {conversaciones.find(c => c.celular === activeCelular)?.nombre || activeCelular}
                  <span className="text-surface-500 font-normal ml-2">{activeCelular}</span>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {loadingMensajes && (
                    <div className="flex justify-center py-6">
                      <Spinner size="sm" />
                    </div>
                  )}
                  {!loadingMensajes &&
                    mensajes.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direccion === 'OUT' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                            msg.direccion === 'OUT'
                              ? 'bg-brand-600 text-white rounded-br-none'
                              : 'bg-surface-800 text-surface-100 rounded-bl-none'
                          }`}
                        >
                          {msg.media_url && (
                            <img
                              src={msg.media_url}
                              alt="Foto adjunta"
                              className="rounded-md mb-1.5 max-w-full max-h-64 object-cover"
                              onError={e => {
                                ;(e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          )}
                          {msg.texto}
                          <div
                            className={`text-[10px] mt-1 ${
                              msg.direccion === 'OUT'
                                ? 'text-brand-100/70'
                                : 'text-surface-500'
                            }`}
                          >
                            {formatFecha(msg.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  <div ref={bottomRef} />
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
