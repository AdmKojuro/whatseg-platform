import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Cpu,
  ArrowLeft,
  Wifi,
  WifiOff,
  Save,
  CheckCircle2,
  Camera,
  Link2,
  Unlink,
  Play,
  Image,
  Video,
  Settings,
  Zap,
  Radio,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { dispositivoService } from '../../services/dispositivo.service'
import { comunidadService } from '../../services/comunidad.service'
import type { Dispositivo } from '../../types/dispositivo'
import { getPlataforma } from '../../types/dispositivo'
import type { Comunidad } from '../../types/comunidad'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'

const PLATFORM_BADGE: Record<string, { variant: 'info' | 'warning' | 'success' | 'danger' | 'neutral'; label: string }> = {
  Tuya: { variant: 'info', label: 'Tuya' },
  Thinmoo: { variant: 'danger', label: 'Thinmoo' },
  Dolynk: { variant: 'success', label: 'Dolynk' },
  Imou: { variant: 'info', label: 'Imou' },
  MQTT: { variant: 'warning', label: 'MQTT' },
  Desconocido: { variant: 'neutral', label: 'Desconocido' },
}

interface TuyaFunction {
  code: string
  desc: string
  name: string
  type: string
  values: string
}

export default function DispositivoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [dispositivo, setDispositivo] = useState<Dispositivo | null>(null)
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Config form
  const [configForm, setConfigForm] = useState({ nombre: '', tipo: '', id_interno: '' })
  const [configuring, setConfiguring] = useState(false)

  // Assignment
  const [assignComunidadId, setAssignComunidadId] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Camera
  const [camaraDeviceId, setCamaraDeviceId] = useState('')
  const [linkingCamera, setLinkingCamera] = useState(false)
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [loadingSnapshot, setLoadingSnapshot] = useState(false)
  const [loadingStream, setLoadingStream] = useState(false)

  // Functions (Tuya)
  const [funciones, setFunciones] = useState<TuyaFunction[]>([])
  const [loadingFunctions, setLoadingFunctions] = useState(false)

  // Test
  const [testing, setTesting] = useState(false)

  const fetchDispositivo = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      setError(null)
      const { data } = await dispositivoService.getEstado(id)
      const dev = data as unknown as Dispositivo
      setDispositivo(dev)
      setConfigForm({
        nombre: dev.nombre || '',
        tipo: dev.tipo || '',
        id_interno: dev.id_interno || '',
      })
      setAssignComunidadId(dev.comunidad_id || '')
    } catch {
      // Fallback to simple getById-like list
      try {
        const { data: listData } = await dispositivoService.list()
        const allDevices = listData as unknown as Dispositivo[]
        const found = allDevices.find((d) => d.id === id)
        if (found) {
          setDispositivo(found)
          setConfigForm({
            nombre: found.nombre || '',
            tipo: found.tipo || '',
            id_interno: found.id_interno || '',
          })
          setAssignComunidadId(found.comunidad_id || '')
        } else {
          setError('Dispositivo no encontrado')
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al cargar dispositivo'
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchComunidades = useCallback(async () => {
    try {
      const { data } = await comunidadService.list()
      setComunidades(data as unknown as Comunidad[])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchDispositivo()
    fetchComunidades()
  }, [fetchDispositivo, fetchComunidades])

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleConfigure = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return

    try {
      setConfiguring(true)
      setError(null)
      await dispositivoService.configurar(id, {
        nombre: configForm.nombre,
        tipo: configForm.tipo,
        id_interno: configForm.id_interno || undefined,
      })
      showSuccess('Dispositivo configurado exitosamente')
      await fetchDispositivo()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al configurar dispositivo'
      setError(message)
    } finally {
      setConfiguring(false)
    }
  }

  const handleAssign = async () => {
    if (!id || !assignComunidadId) return

    try {
      setAssigning(true)
      setError(null)
      await dispositivoService.asignar(id, {
        comunidad_id: assignComunidadId,
        nombre: configForm.nombre || 'Dispositivo',
      })
      showSuccess('Dispositivo asignado exitosamente')
      await fetchDispositivo()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al asignar dispositivo'
      setError(message)
    } finally {
      setAssigning(false)
    }
  }

  const handleUnassign = async () => {
    if (!id) return
    if (!window.confirm('Desasignar dispositivo de la comunidad?')) return

    try {
      setAssigning(true)
      setError(null)
      await dispositivoService.desasignar(id)
      showSuccess('Dispositivo desasignado')
      await fetchDispositivo()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al desasignar dispositivo'
      setError(message)
    } finally {
      setAssigning(false)
    }
  }

  const handleLinkCamera = async () => {
    if (!id || !camaraDeviceId) return

    try {
      setLinkingCamera(true)
      setError(null)
      await dispositivoService.vincularCamara(id, { camara_dispositivo_id: camaraDeviceId })
      showSuccess('Camara vinculada exitosamente')
      setCamaraDeviceId('')
      await fetchDispositivo()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al vincular camara'
      setError(message)
    } finally {
      setLinkingCamera(false)
    }
  }

  const handleUnlinkCamera = async () => {
    if (!id) return
    if (!window.confirm('Desvincular la camara de este dispositivo?')) return

    try {
      setLinkingCamera(true)
      setError(null)
      await dispositivoService.desvincularCamara(id)
      showSuccess('Camara desvinculada')
      await fetchDispositivo()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al desvincular camara'
      setError(message)
    } finally {
      setLinkingCamera(false)
    }
  }

  const handleSnapshot = async () => {
    if (!id) return
    try {
      setLoadingSnapshot(true)
      const { data } = await dispositivoService.getSnapshot(id)
      setSnapshotUrl(data as unknown as string)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al obtener snapshot'
      setError(message)
    } finally {
      setLoadingSnapshot(false)
    }
  }

  const handleStreamUrl = async () => {
    if (!id) return
    try {
      setLoadingStream(true)
      const { data } = await dispositivoService.getStreamUrl(id)
      const result = data as unknown as { url: string }
      setStreamUrl(result.url || (result as unknown as string))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al obtener stream URL'
      setError(message)
    } finally {
      setLoadingStream(false)
    }
  }

  const handleFetchFunctions = async () => {
    if (!id) return
    try {
      setLoadingFunctions(true)
      const { data } = await dispositivoService.getFunciones(id)
      setFunciones(data as unknown as TuyaFunction[])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al obtener funciones'
      setError(message)
    } finally {
      setLoadingFunctions(false)
    }
  }

  const handleTest = async () => {
    if (!id) return
    try {
      setTesting(true)
      setError(null)
      await dispositivoService.probar(id)
      showSuccess('Prueba de dispositivo ejecutada exitosamente')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al probar dispositivo'
      setError(message)
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!dispositivo) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/dispositivos')}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>Dispositivo no encontrado</p>
        </div>
      </div>
    )
  }

  const platform = getPlataforma(dispositivo)
  const platformBadge = PLATFORM_BADGE[platform] || PLATFORM_BADGE['Desconocido']

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <button
        onClick={() => navigate('/dispositivos')}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a dispositivos
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Cpu className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-white">
              {dispositivo.nombre || 'Dispositivo sin nombre'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={platformBadge.variant}>{platformBadge.label}</Badge>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  dispositivo.online
                    ? 'bg-emerald-50 text-emerald-400'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {dispositivo.online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {dispositivo.online ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        <div className="sm:ml-auto flex gap-2">
          <Button
            variant="primary"
            onClick={handleTest}
            loading={testing}
            icon={<Zap className="w-4 h-4" />}
          >
            Probar
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Info section */}
        <Card
          title="Informacion del Dispositivo"
          actions={<Settings className="w-5 h-5 text-gray-400" />}
        >
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">ID</dt>
              <dd className="font-mono text-xs text-white text-xs">{dispositivo.id}</dd>
            </div>
            {dispositivo.tuya_id && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Tuya ID</dt>
                <dd className="font-mono text-xs text-white text-xs">{dispositivo.tuya_id}</dd>
              </div>
            )}
            {dispositivo.thinmoo_dev_sn && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Thinmoo SN</dt>
                <dd className="font-mono text-xs text-white text-xs">{dispositivo.thinmoo_dev_sn}</dd>
              </div>
            )}
            {dispositivo.dolynk_device_id && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Dolynk ID</dt>
                <dd className="font-mono text-xs text-white text-xs">{dispositivo.dolynk_device_id}</dd>
              </div>
            )}
            {dispositivo.imou_device_id && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Imou ID</dt>
                <dd className="font-mono text-xs text-white text-xs">{dispositivo.imou_device_id}</dd>
              </div>
            )}
            {dispositivo.id_interno && (
              <div className="flex justify-between">
                <dt className="text-gray-500">ID Interno</dt>
                <dd className="font-mono text-xs text-white text-xs">{dispositivo.id_interno}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Tipo</dt>
              <dd className="text-white">{dispositivo.tipo || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Categoria</dt>
              <dd className="text-white">{dispositivo.categoria || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Configurado</dt>
              <dd>{dispositivo.configurado ? 'Si' : 'No'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Comunidad</dt>
              <dd className="text-white">{dispositivo.comunidad?.nombre || 'Sin asignar'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Creado</dt>
              <dd className="text-white">
                {new Date(dispositivo.created_at).toLocaleDateString('es-ES')}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Configuration section */}
        <Card title="Configuracion">
          <form onSubmit={handleConfigure} className="space-y-4">
            <Input
              label="Nombre"
              value={configForm.nombre}
              onChange={(e) => setConfigForm({ ...configForm, nombre: e.target.value })}
              placeholder="Nombre del dispositivo"
            />
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
              <select
                value={configForm.tipo}
                onChange={(e) => setConfigForm({ ...configForm, tipo: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Seleccionar tipo...</option>
                <option value="ALARMA">ALARMA</option>
                <option value="PUERTA">PUERTA</option>
                <option value="CAMARA">CAMARA</option>
              </select>
            </div>
            <Input
              label="ID Interno (opcional)"
              value={configForm.id_interno}
              onChange={(e) => setConfigForm({ ...configForm, id_interno: e.target.value })}
              placeholder="ID interno"
            />
            <Button
              type="submit"
              variant="primary"
              loading={configuring}
              disabled={!configForm.nombre || !configForm.tipo}
              icon={<Save className="w-4 h-4" />}
            >
              Configurar
            </Button>
          </form>
        </Card>

        {/* Assignment section */}
        <Card title="Asignacion de Comunidad">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Comunidad</label>
              <select
                value={assignComunidadId}
                onChange={(e) => setAssignComunidadId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Seleccionar comunidad...</option>
                {comunidades.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.codigo})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleAssign}
                loading={assigning}
                disabled={!assignComunidadId}
                icon={<Link2 className="w-4 h-4" />}
              >
                Asignar
              </Button>
              {dispositivo.comunidad_id && (
                <Button
                  variant="danger"
                  onClick={handleUnassign}
                  loading={assigning}
                  icon={<Unlink className="w-4 h-4" />}
                >
                  Desasignar
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Camera section */}
        <Card title="Camara Vinculada">
          <div className="space-y-4">
            {dispositivo.camara_dispositivo_id ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Camara vinculada:{' '}
                  <span className="font-mono text-xs">{dispositivo.camara_dispositivo_id}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSnapshot}
                    loading={loadingSnapshot}
                    icon={<Image className="w-3.5 h-3.5" />}
                  >
                    Snapshot
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStreamUrl}
                    loading={loadingStream}
                    icon={<Video className="w-3.5 h-3.5" />}
                  >
                    Stream URL
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleUnlinkCamera}
                    loading={linkingCamera}
                    icon={<Unlink className="w-3.5 h-3.5" />}
                  >
                    Desvincular
                  </Button>
                </div>
                {snapshotUrl && (
                  <div className="mt-3">
                    <img
                      src={snapshotUrl}
                      alt="Snapshot"
                      className="rounded-lg max-w-full border border-gray-700"
                    />
                  </div>
                )}
                {streamUrl && (
                  <div className="mt-3 p-3 bg-gray-900 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Stream URL:</p>
                    <a
                      href={streamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline break-all font-mono"
                    >
                      {streamUrl}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Sin camara vinculada</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={camaraDeviceId}
                    onChange={(e) => setCamaraDeviceId(e.target.value)}
                    placeholder="ID del dispositivo camara"
                    className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleLinkCamera}
                    loading={linkingCamera}
                    disabled={!camaraDeviceId}
                    icon={<Link2 className="w-3.5 h-3.5" />}
                  >
                    Vincular
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Tuya Functions */}
        {platform === 'Tuya' && (
          <Card title="Funciones Tuya">
            <Button
              variant="secondary"
              onClick={handleFetchFunctions}
              loading={loadingFunctions}
              icon={<Play className="w-4 h-4" />}
              className="mb-4"
            >
              Obtener Funciones
            </Button>
            {funciones.length > 0 && (
              <div className="space-y-2">
                {funciones.map((fn) => (
                  <div key={fn.code} className="p-3 bg-gray-900 rounded-lg text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{fn.name}</span>
                      <span className="text-xs font-mono text-gray-500">{fn.code}</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">{fn.desc}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      Tipo: {fn.type} | Valores: {fn.values}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* MQTT Info */}
        {platform === 'MQTT' && (
          <Card title="Informacion MQTT">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Kind</dt>
                <dd className="font-mono text-xs text-white">{dispositivo.mqtt_kind}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Device ID</dt>
                <dd className="font-mono text-xs text-white">{dispositivo.mqtt_device_id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Channel</dt>
                <dd className="text-white">{dispositivo.mqtt_channel ?? '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Ultima conexion
                </dt>
                <dd className="text-white">
                  {dispositivo.mqtt_last_seen
                    ? new Date(dispositivo.mqtt_last_seen).toLocaleString('es-ES')
                    : 'Nunca'}
                </dd>
              </div>
            </dl>
          </Card>
        )}
      </div>
    </div>
  )
}
