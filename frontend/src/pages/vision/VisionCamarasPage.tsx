import { useState, useEffect, useCallback } from 'react'
import { visionService, type VisionCamera, type VisionStats } from '../../services/vision.service'
import { alertasIAService } from '../../services/alertas-ia.service'
import { Camera, Wifi, WifiOff, RefreshCw, Plus, AlertTriangle, Eye } from 'lucide-react'
import type { AlertaIA } from '../../types/alerta-ia'

const SEVERIDAD_COLOR: Record<string, string> = {
  CRITICA: 'bg-red-500/20 text-red-300 border border-red-500/30',
  ALTA: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  MEDIA: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  BAJA: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
}

function CameraCard({ cam }: { cam: VisionCamera }) {
  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      {/* Stream placeholder */}
      <div className="relative bg-gray-900 aspect-video flex items-center justify-center">
        <img
          src={visionService.snapshotUrl(cam.id)}
          alt={cam.nombre}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <Camera size={32} className="text-gray-400" />
        </div>
        <div className="absolute top-2 right-2">
          {cam.online
            ? <span className="flex items-center gap-1 text-xs bg-green-500/80 text-white px-2 py-0.5 rounded-full"><Wifi size={10} />Online</span>
            : <span className="flex items-center gap-1 text-xs bg-red-500/80 text-white px-2 py-0.5 rounded-full"><WifiOff size={10} />Offline</span>
          }
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-white truncate">{cam.nombre}</p>
        <p className="text-xs text-gray-500 truncate">{cam.rtsp_url}</p>
      </div>
    </div>
  )
}

export default function VisionCamarasPage() {
  const [stats, setStats] = useState<VisionStats | null>(null)
  const [cameras, setCameras] = useState<VisionCamera[]>([])
  const [alertas, setAlertas] = useState<AlertaIA[]>([])
  const [visionOnline, setVisionOnline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCam, setNewCam] = useState({ id: '', nombre: '', rtsp_url: '', comunidad_id: '' })

  const cargar = useCallback(async () => {
    try {
      const [statusRes, statsRes, camasRes, alertasRes] = await Promise.allSettled([
        visionService.status(),
        visionService.stats(),
        visionService.cameras(),
        alertasIAService.list({ reconocido: false, limit: 10 }),
      ])

      if (statusRes.status === 'fulfilled') setVisionOnline(statusRes.value.data.online)
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data)
      if (camasRes.status === 'fulfilled') setCameras(camasRes.value.data)
      if (alertasRes.status === 'fulfilled') setAlertas(alertasRes.value.data.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    const interval = setInterval(cargar, 15_000)
    return () => clearInterval(interval)
  }, [cargar])

  async function agregarCamara() {
    if (!newCam.rtsp_url) return
    try {
      await visionService.addCamera({ ...newCam, id: newCam.id || `cam_${Date.now()}` })
      setNewCam({ id: '', nombre: '', rtsp_url: '', comunidad_id: '' })
      setShowAddForm(false)
      await cargar()
    } catch (e) { console.error(e) }
  }

  async function reconocer(id: string) {
    try {
      await alertasIAService.reconocer(id)
      setAlertas(prev => prev.filter(a => a.id !== id))
    } catch (e) { console.error(e) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20"><Camera className="text-blue-400" size={24} /></div>
          <div>
            <h1 className="text-xl font-semibold text-white">Centro de Visión IA</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`h-2 w-2 rounded-full ${visionOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <p className="text-xs text-gray-400">Servicio de IA: {visionOnline ? 'Online' : 'Offline'}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => visionService.syncCameras().then(cargar)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm">
            <RefreshCw size={14} />Sincronizar
          </button>
          <button onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">
            <Plus size={14} />Añadir Cámara
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Cámaras', value: `${stats.camaras.online}/${stats.camaras.total}`, sub: 'online' },
            { label: 'Identidades', value: stats.identidades, sub: 'detectadas' },
            { label: 'Expedientes', value: stats.expedientes, sub: 'activos' },
            { label: 'Alertas Hoy', value: stats.alertas_hoy, sub: 'total' },
            { label: 'Alertas Críticas', value: stats.alertas_criticas_hoy, sub: 'hoy' },
          ].map((s, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-4">
              <p className="text-lg font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label} <span className="text-gray-400">({s.sub})</span></p>
            </div>
          ))}
        </div>
      )}

      {/* Formulario nueva cámara */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-xl p-5 border border-blue-500/30">
          <h3 className="text-sm font-medium text-white mb-4">Nueva Cámara RTSP</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={newCam.nombre} onChange={e => setNewCam(p => ({...p, nombre: e.target.value}))}
              placeholder="Nombre" className="col-span-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500" />
            <input value={newCam.rtsp_url} onChange={e => setNewCam(p => ({...p, rtsp_url: e.target.value}))}
              placeholder="rtsp://..." className="col-span-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={agregarCamara} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Agregar</button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Grid de cámaras */}
        <div className="xl:col-span-2">
          <h2 className="text-sm font-medium text-gray-300 mb-3">Cámaras Activas</h2>
          {cameras.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-12 text-center text-gray-500">
              <Camera size={40} className="mx-auto mb-3 opacity-30" />
              <p>No hay cámaras configuradas</p>
              <p className="text-xs mt-1">Usa "Sincronizar" para importar cámaras RTSP de WhatsEg</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cameras.map(cam => <CameraCard key={cam.id} cam={cam} />)}
            </div>
          )}
        </div>

        {/* Alertas IA recientes */}
        <div className="xl:col-span-1">
          <h2 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-orange-400" />
            Alertas IA Pendientes ({alertas.length})
          </h2>
          <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
            {alertas.length === 0 && (
              <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-500">Sin alertas pendientes</div>
            )}
            {alertas.map(a => (
              <div key={a.id} className="bg-gray-800 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERIDAD_COLOR[a.severidad]}`}>
                    {a.severidad}
                  </span>
                  <button onClick={() => reconocer(a.id)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-400 transition-colors">
                    <Eye size={12} />Reconocer
                  </button>
                </div>
                <p className="text-xs text-gray-300">{a.descripcion}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">{a.camera_id}</p>
                  <p className="text-xs text-gray-500">{new Date(a.created_at).toLocaleTimeString('es-CO')}</p>
                </div>
                {a.similitud && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-700 rounded-full h-1">
                      <div className="bg-orange-500 h-1 rounded-full" style={{ width: `${a.similitud * 100}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">Similitud: {(a.similitud * 100).toFixed(0)}%</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
