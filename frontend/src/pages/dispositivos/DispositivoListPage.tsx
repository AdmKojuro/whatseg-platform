import { useState, useEffect, useCallback } from 'react'
import {
  Cpu, RefreshCw, Search, Wifi, WifiOff, CheckCircle2, XCircle,
  AlertCircle, Filter, Settings, Zap, Unlink, Link2, Camera,
  Play, X, Save, Loader2, Clock, ChevronLeft, ChevronRight,
  Video, ExternalLink,
} from 'lucide-react'
import { dispositivoService } from '../../services/dispositivo.service'
import { comunidadService } from '../../services/comunidad.service'
import { ezcloudService } from '../../services/ezcloud.service'
import type { CuentaEzcloud, CreateCuentaEzcloudInput } from '../../services/ezcloud.service'
import type { Dispositivo } from '../../types/dispositivo'
import { getPlataforma } from '../../types/dispositivo'
import type { Comunidad } from '../../types/comunidad'

const PLATFORM_COLOR: Record<string, string> = {
  Tuya:            'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  Thinmoo:         'bg-red-500/15 text-red-400 border border-red-500/30',
  Dolynk:          'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  Imou:            'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
  MQTT:            'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  'EZCloud (UNV)': 'bg-violet-500/15 text-violet-400 border border-violet-500/30',
  Desconocido:     'bg-gray-700 text-gray-400',
}

const PAGE_SIZE = 12

interface TuyaFunction { code: string; desc: string; name: string; type: string; values: string }

export default function DispositivoListPage() {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterComunidad, setFilterComunidad] = useState('')
  const [filterPlataforma, setFilterPlataforma] = useState('')
  const [page, setPage] = useState(1)
  const [syncing, setSyncing] = useState<string | null>(null)

  // Selected device
  const [selected, setSelected] = useState<Dispositivo | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Reconfigurar modal
  const [showReconfig, setShowReconfig] = useState(false)
  const [configForm, setConfigForm] = useState({ nombre: '', tipo: '', id_interno: '' })
  const [configuring, setConfiguring] = useState(false)

  // Vincular cámara modal
  const [showCamera, setShowCamera] = useState(false)
  const [camaraId, setCamaraId] = useState('')
  const [linking, setLinking] = useState(false)

  // Probar
  const [testing, setTesting] = useState(false)

  // Desasignar
  const [unassigning, setUnassigning] = useState(false)

  // Asignar a comunidad
  const [showAsignar, setShowAsignar] = useState(false)
  const [asignarComunidadId, setAsignarComunidadId] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Funciones (Tuya)
  const [funciones, setFunciones] = useState<TuyaFunction[]>([])
  const [loadingFn, setLoadingFn] = useState(false)
  const [showFunciones, setShowFunciones] = useState(false)

  // EZCloud cuentas modal
  const [showEzcloud, setShowEzcloud] = useState(false)
  const [cuentasEz, setCuentasEz] = useState<CuentaEzcloud[]>([])
  const [loadingEz, setLoadingEz] = useState(false)
  const [ezForm, setEzForm] = useState<CreateCuentaEzcloudInput & { id?: string }>({ nombre: '', app_key: '', app_secret: '', base_url: 'https://os.ezcloud.uniview.com' })
  const [savingEz, setSavingEz] = useState(false)
  const [ezStreamUrl, setEzStreamUrl] = useState<string | null>(null)
  const [loadingStream, setLoadingStream] = useState(false)

  const showMsg = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [devRes, comRes] = await Promise.all([
        dispositivoService.list(),
        comunidadService.list(),
      ])
      setDispositivos(devRes.data as unknown as Dispositivo[])
      setComunidades(comRes.data as unknown as Comunidad[])
    } catch { setError('Error al cargar dispositivos') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-refresh cada 5 s
  useEffect(() => {
    const interval = setInterval(() => fetchAll(), 5_000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const loadDetail = (dev: Dispositivo) => {
    setSelected(dev)
    setShowFunciones(false)
    setFunciones([])
    setDetailLoading(false)
    setConfigForm({ nombre: dev.nombre || '', tipo: dev.tipo || '', id_interno: dev.id_interno || '' })
  }

  const handleSync = async (platform: string) => {
    try {
      setSyncing(platform)
      setError(null)
      switch (platform) {
        case 'tuya':    await dispositivoService.sincronizar(); break
        case 'thinmoo': await dispositivoService.sincronizarThinmoo(); break
        case 'dolynk':  await dispositivoService.sincronizarDolynk(); break
        case 'imou':    await dispositivoService.sincronizarImou(); break
        case 'ezcloud': {
          const res = await dispositivoService.sincronizarEzcloud()
          const { total, created, updated } = res.data as { total: number; created: number; updated: number }
          showMsg(`EZCloud: ${total} cámaras (${created} nuevas, ${updated} actualizadas)`)
          fetchAll()
          return
        }
      }
      showMsg(`Sincronizacion de ${platform} completada`)
      fetchAll()
    } catch { setError(`Error al sincronizar ${platform}`) }
    finally { setSyncing(null) }
  }

  const fetchCuentasEz = async () => {
    setLoadingEz(true)
    try {
      const res = await ezcloudService.listarCuentas()
      setCuentasEz(res.data as unknown as CuentaEzcloud[])
    } catch { setError('Error al cargar cuentas EZCloud') }
    finally { setLoadingEz(false) }
  }

  const handleSaveEzCuenta = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingEz(true)
    try {
      if (ezForm.id) {
        await ezcloudService.actualizarCuenta(ezForm.id, { nombre: ezForm.nombre, app_key: ezForm.app_key, app_secret: ezForm.app_secret, base_url: ezForm.base_url })
        showMsg('Cuenta EZCloud actualizada')
      } else {
        await ezcloudService.crearCuenta({ nombre: ezForm.nombre, app_key: ezForm.app_key, app_secret: ezForm.app_secret, base_url: ezForm.base_url })
        showMsg('Cuenta EZCloud creada')
      }
      setEzForm({ nombre: '', app_key: '', app_secret: '', base_url: 'https://os.ezcloud.uniview.com' })
      fetchCuentasEz()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al guardar cuenta EZCloud')
    } finally { setSavingEz(false) }
  }

  const handleDeleteEzCuenta = async (id: string) => {
    if (!confirm('¿Eliminar esta cuenta EZCloud?')) return
    try {
      await ezcloudService.eliminarCuenta(id)
      showMsg('Cuenta eliminada')
      fetchCuentasEz()
    } catch { setError('Error al eliminar cuenta') }
  }

  const handleGetStream = async () => {
    const serial = selected?.ezcloud_serial || selected?.id_interno?.replace('ezcloud:', '')
    if (!serial) return
    setLoadingStream(true)
    setEzStreamUrl(null)
    try {
      const res = await ezcloudService.getStream(serial, selected?.ezcloud_channel ?? '1')
      const url = (res.data as { url: string }).url
      setEzStreamUrl(url)
    } catch { setError('No se pudo obtener la URL de stream') }
    finally { setLoadingStream(false) }
  }

  const handleAsignar = async () => {
    if (!selected || !asignarComunidadId) return
    try {
      setAssigning(true)
      setError(null)
      await dispositivoService.asignar(selected.id, {
        comunidad_id: asignarComunidadId,
        nombre: selected.nombre || selected.id_interno || selected.id,
        tipo: selected.tipo || 'CAMARA',
      })
      setShowAsignar(false)
      setAsignarComunidadId('')
      showMsg('Dispositivo asignado a la comunidad')
      fetchAll()
      const com = comunidades.find(c => c.id === asignarComunidadId)
      setSelected(s => s ? { ...s, comunidad_id: asignarComunidadId, comunidad: com ? { id: com.id, nombre: com.nombre, codigo: com.codigo } : undefined } : null)
    } catch { setError('Error al asignar dispositivo') }
    finally { setAssigning(false) }
  }

  const handleReconfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    try {
      setConfiguring(true)
      setError(null)
      await dispositivoService.configurar(selected.id, { nombre: configForm.nombre, tipo: configForm.tipo, id_interno: configForm.id_interno || undefined })
      setShowReconfig(false)
      showMsg('Dispositivo reconfigurado')
      fetchAll()
    } catch { setError('Error al reconfigurar') }
    finally { setConfiguring(false) }
  }

  const handleDesasignar = async () => {
    if (!selected || !window.confirm('¿Desasignar este dispositivo de la comunidad?')) return
    try {
      setUnassigning(true)
      setError(null)
      await dispositivoService.desasignar(selected.id)
      showMsg('Dispositivo desasignado')
      fetchAll()
      setSelected(s => s ? { ...s, comunidad_id: undefined, comunidad: undefined } : null)
    } catch { setError('Error al desasignar') }
    finally { setUnassigning(false) }
  }

  const handleProbar = async () => {
    if (!selected) return
    try {
      setTesting(true)
      setError(null)
      await dispositivoService.probar(selected.id)
      showMsg('Prueba ejecutada correctamente')
    } catch { setError('Error al probar dispositivo') }
    finally { setTesting(false) }
  }

  const handleVincularCamara = async () => {
    if (!selected || !camaraId) return
    try {
      setLinking(true)
      setError(null)
      await dispositivoService.vincularCamara(selected.id, { camara_dispositivo_id: camaraId })
      setShowCamera(false)
      setCamaraId('')
      showMsg('Cámara vinculada')
      fetchAll()
    } catch { setError('Error al vincular cámara') }
    finally { setLinking(false) }
  }

  const handleDesvincularCamara = async () => {
    if (!selected || !window.confirm('¿Desvincular la cámara?')) return
    try {
      setLinking(true)
      await dispositivoService.desvincularCamara(selected.id)
      showMsg('Cámara desvinculada')
      fetchAll()
      setSelected(s => s ? { ...s, camara_dispositivo_id: undefined } : null)
    } catch { setError('Error al desvincular cámara') }
    finally { setLinking(false) }
  }

  const handleFunciones = async () => {
    if (!selected) return
    try {
      setLoadingFn(true)
      setShowFunciones(true)
      const { data } = await dispositivoService.getFunciones(selected.id)
      setFunciones(data as unknown as TuyaFunction[])
    } catch { setError('Error al obtener funciones') }
    finally { setLoadingFn(false) }
  }

  // Filtered + paginated list
  const filtered = dispositivos.filter(d => {
    const plat = getPlataforma(d)
    const term = search.toLowerCase()
    const matchSearch = !search ||
      (d.nombre || '').toLowerCase().includes(term) ||
      (d.tipo || '').toLowerCase().includes(term) ||
      (d.tuya_id || '').toLowerCase().includes(term) ||
      (d.thinmoo_dev_sn || '').toLowerCase().includes(term) ||
      (d.mqtt_device_id || '').toLowerCase().includes(term) ||
      (d.id_interno || '').toLowerCase().includes(term)
    const matchCom = !filterComunidad || d.comunidad_id === filterComunidad
    const matchPlat = !filterPlataforma || plat === filterPlataforma
    return matchSearch && matchCom && matchPlat
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const syncButtons = [
    { key: 'tuya', label: 'Tuya' },
    { key: 'thinmoo', label: 'Thinmoo' },
    { key: 'dolynk', label: 'Dolynk' },
    { key: 'imou', label: 'Imou' },
    { key: 'ezcloud', label: 'EZCloud' },
  ]

  const plataforma = selected ? getPlataforma(selected) : ''

  const deviceLabel = (d: Dispositivo) =>
    d.nombre || d.tuya_id || d.thinmoo_dev_sn || d.mqtt_device_id || d.dolynk_device_id || d.imou_device_id || d.ezcloud_serial || 'Sin nombre'

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Cpu className="w-7 h-7 text-blue-500" />
          <h1 className="text-xl font-bold text-white">Dispositivos</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {syncButtons.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleSync(key)}
              disabled={syncing !== null}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              {syncing === key
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <RefreshCw className="w-3 h-3" />}
              Sync {label}
            </button>
          ))}
          <button
            onClick={() => { setShowEzcloud(true); fetchCuentasEz() }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-violet-700/40 text-violet-300 border border-violet-600/40 rounded-lg hover:bg-violet-700/60 transition-colors"
          >
            <Video className="w-3 h-3" />
            Cuentas EZCloud
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /><p>{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" /><p>{success}</p>
        </div>
      )}

      {/* Split layout */}
      <div className="flex gap-4" style={{ height: 'calc(100vh - 190px)' }}>

        {/* LEFT — list */}
        <div className="w-80 shrink-0 flex flex-col bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {/* Filters */}
          <div className="p-3 space-y-2 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar dispositivo..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterPlataforma}
                onChange={e => { setFilterPlataforma(e.target.value); setPage(1) }}
                className="flex-1 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded-lg text-gray-300 focus:outline-none"
              >
                <option value="">Plataforma</option>
                <option>Tuya</option><option>Thinmoo</option>
                <option>Dolynk</option><option>Imou</option><option>MQTT</option>
                <option>EZCloud (UNV)</option>
              </select>
              <select
                value={filterComunidad}
                onChange={e => { setFilterComunidad(e.target.value); setPage(1) }}
                className="flex-1 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded-lg text-gray-300 focus:outline-none"
              >
                <option value="">Comunidad</option>
                {comunidades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {(filterPlataforma || filterComunidad || search) && (
                <button onClick={() => { setSearch(''); setFilterPlataforma(''); setFilterComunidad(''); setPage(1) }}
                  className="p-1 text-gray-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              </div>
            ) : paginated.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Sin resultados</p>
            ) : (
              paginated.map(dev => {
                const plat = getPlataforma(dev)
                return (
                  <button
                    key={dev.id}
                    onClick={() => loadDetail(dev)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-700 transition-colors ${
                      selected?.id === dev.id
                        ? 'bg-brand-600/20 border-l-2 border-l-brand-500'
                        : 'hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dev.online ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                      <span className="font-medium text-white text-sm truncate">{deviceLabel(dev)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 pl-4">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PLATFORM_COLOR[plat] || PLATFORM_COLOR['Desconocido']}`}>
                        {plat}
                      </span>
                      {dev.tipo && <span className="text-[10px] text-gray-400">{dev.tipo}</span>}
                      {dev.configurado && <span className="text-[10px] text-emerald-500">Configurado</span>}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700 text-xs text-gray-400">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 hover:text-white disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{page} / {totalPages} · {filtered.length} total</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 hover:text-white disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — detail */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Cpu className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-sm">Selecciona un dispositivo para ver el detalle</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header card */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white truncate">{deviceLabel(selected)}</h2>

                    {/* Subtitle tags */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-gray-400">
                      {selected.id_interno && <span className="font-mono">{selected.id_interno}</span>}
                      {selected.mqtt_channel !== undefined && selected.mqtt_channel !== null && (
                        <><span className="text-gray-600">·</span><span>C{selected.mqtt_channel}</span></>
                      )}
                      {selected.tipo && <><span className="text-gray-600">·</span><span className="uppercase">{selected.tipo}</span></>}
                      <span className="text-gray-600">·</span>
                      <span className={selected.online ? 'text-emerald-400' : 'text-gray-500'}>
                        {selected.online ? 'Online' : 'Offline'}
                      </span>
                      {selected.configurado && (
                        <><span className="text-gray-600">·</span><span className="text-emerald-400">Configurado</span></>
                      )}
                      <><span className="text-gray-600">·</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PLATFORM_COLOR[plataforma] || PLATFORM_COLOR['Desconocido']}`}>
                        {plataforma}
                      </span></>
                      {selected.mqtt_kind && <><span className="text-gray-600">·</span><span className="font-mono">{selected.mqtt_kind}</span></>}
                    </div>

                    {/* Comunidad */}
                    {selected.comunidad && (
                      <p className="mt-2 text-sm text-gray-400">
                        <span className="text-gray-500">Comunidad:</span>{' '}
                        <span className="text-white">{selected.comunidad.nombre}</span>
                        <span className="text-gray-600 ml-1">{selected.comunidad.codigo}</span>
                      </p>
                    )}
                  </div>
                  {detailLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0 ml-3" />}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => setShowReconfig(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Reconfigurar
                  </button>

                  {selected.comunidad_id ? (
                    <button
                      onClick={handleDesasignar}
                      disabled={unassigning}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                    >
                      {unassigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                      Desasignar
                    </button>
                  ) : (
                    <button
                      onClick={() => { setAsignarComunidadId(''); setShowAsignar(true) }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-300 bg-brand-500/10 border border-brand-500/20 rounded-lg hover:bg-brand-500/20 transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Asignar a comunidad
                    </button>
                  )}

                  <button
                    onClick={handleProbar}
                    disabled={testing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
                  >
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    Probar
                  </button>

                  {selected.camara_dispositivo_id ? (
                    <button
                      onClick={handleDesvincularCamara}
                      disabled={linking}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
                    >
                      {linking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                      Desvincular cámara
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowCamera(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Vincular cámara
                    </button>
                  )}

                  {plataforma === 'Tuya' && (
                    <button
                      onClick={handleFunciones}
                      disabled={loadingFn}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
                    >
                      {loadingFn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Funciones
                    </button>
                  )}
                </div>
              </div>

              {/* Estado / MQTT info */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Estado actual</h3>
                {plataforma === 'MQTT' ? (
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Device ID</dt>
                      <dd className="font-mono text-xs text-white">{selected.mqtt_device_id || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Canal</dt>
                      <dd className="text-white">{selected.mqtt_channel ?? '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />Última conexión</dt>
                      <dd className="text-white text-xs">
                        {selected.mqtt_last_seen
                          ? new Date(selected.mqtt_last_seen).toLocaleString('es-ES')
                          : 'Nunca'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Driver</dt>
                      <dd className="font-mono text-xs text-white">{selected.mqtt_kind || '-'}</dd>
                    </div>
                  </dl>
                ) : plataforma === 'EZCloud (UNV)' ? (
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Serial</dt>
                      <dd className="font-mono text-xs text-white">{selected.ezcloud_serial || selected.id_interno?.replace('ezcloud:', '') || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Canal</dt>
                      <dd className="text-white">{selected.ezcloud_channel ?? '1'}</dd>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                      <button
                        onClick={handleGetStream}
                        disabled={loadingStream}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-700/30 text-violet-300 border border-violet-600/30 rounded-lg hover:bg-violet-700/50 disabled:opacity-50 transition-colors"
                      >
                        {loadingStream ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
                        Obtener URL de stream
                      </button>
                      {ezStreamUrl && (
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={ezStreamUrl}
                            className="flex-1 px-2 py-1 text-xs font-mono bg-gray-900 border border-gray-600 rounded text-gray-300 truncate"
                          />
                          <a href={ezStreamUrl} target="_blank" rel="noopener noreferrer"
                            className="p-1 text-gray-400 hover:text-white">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-gray-500">Sin datos de estado</p>
                )}
              </div>

              {/* Tuya functions */}
              {showFunciones && (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Funciones Tuya</h3>
                  {loadingFn ? (
                    <div className="flex items-center justify-center h-16">
                      <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
                    </div>
                  ) : funciones.length === 0 ? (
                    <p className="text-sm text-gray-500">Sin funciones disponibles</p>
                  ) : (
                    <div className="space-y-2">
                      {funciones.map(fn => (
                        <div key={fn.code} className="p-3 bg-gray-900 rounded-lg text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-white">{fn.name}</span>
                            <span className="text-xs font-mono text-gray-500">{fn.code}</span>
                          </div>
                          <p className="text-gray-500 text-xs mt-1">{fn.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reconfigurar modal */}
      {showReconfig && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h2 className="font-semibold text-white">Reconfigurar dispositivo</h2>
              <button onClick={() => setShowReconfig(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleReconfig} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                <input type="text" required value={configForm.nombre}
                  onChange={e => setConfigForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                <select value={configForm.tipo}
                  onChange={e => setConfigForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccionar...</option>
                  <option value="ALARMA">ALARMA</option>
                  <option value="PUERTA">PUERTA</option>
                  <option value="CAMARA">CAMARA</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">ID Interno (opcional)</label>
                <input type="text" value={configForm.id_interno}
                  onChange={e => setConfigForm(f => ({ ...f, id_interno: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowReconfig(false)} className="px-4 py-2 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600">Cancelar</button>
                <button type="submit" disabled={configuring || !configForm.nombre || !configForm.tipo}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {configuring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EZCloud cuentas modal */}
      {showEzcloud && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-violet-400" />
                Cuentas EZCloud (Uniview)
              </h2>
              <button onClick={() => setShowEzcloud(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Form */}
              <form onSubmit={handleSaveEzCuenta} className="space-y-3 bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                  {ezForm.id ? 'Editar cuenta' : 'Nueva cuenta'}
                </p>
                <p className="text-xs text-gray-500">
                  Usa el mismo correo y contraseña de la <span className="text-violet-300">app EZView</span>.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Nombre de la cuenta</label>
                    <input type="text" required value={ezForm.nombre}
                      onChange={e => setEzForm(f => ({ ...f, nombre: e.target.value }))}
                      placeholder="Mi cuenta UNV"
                      className="w-full px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Correo EZCloud</label>
                    <input type="text" required value={ezForm.app_key}
                      onChange={e => setEzForm(f => ({ ...f, app_key: e.target.value }))}
                      placeholder="correo@ejemplo.com"
                      className="w-full px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Contraseña EZCloud</label>
                    <input type="password" required={!ezForm.id} value={ezForm.app_secret}
                      onChange={e => setEzForm(f => ({ ...f, app_secret: e.target.value }))}
                      placeholder={ezForm.id ? '(sin cambios)' : 'Contraseña'}
                      className="w-full px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {ezForm.id && (
                    <button type="button"
                      onClick={() => setEzForm({ nombre: '', app_key: '', app_secret: '', base_url: 'https://os.ezcloud.uniview.com' })}
                      className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">
                      Cancelar edición
                    </button>
                  )}
                  <button type="submit" disabled={savingEz}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
                    {savingEz ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {ezForm.id ? 'Actualizar' : 'Crear cuenta'}
                  </button>
                </div>
              </form>

              {/* List */}
              {loadingEz ? (
                <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
              ) : cuentasEz.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No hay cuentas configuradas. Agrega tu correo y contraseña de la <span className="text-violet-400">app EZView</span>.
                </p>
              ) : (
                <div className="space-y-2">
                  {cuentasEz.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-900/50 rounded-lg border border-gray-700">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{c.nombre}</p>
                        <p className="text-xs text-gray-500 font-mono truncate">{c.app_key}</p>
                        <p className="text-[10px] text-gray-600">{c.base_url}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.activa ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-600 text-gray-400'}`}>
                          {c.activa ? 'Activa' : 'Inactiva'}
                        </span>
                        <button
                          onClick={() => setEzForm({ id: c.id, nombre: c.nombre, app_key: c.app_key, app_secret: '', base_url: c.base_url })}
                          className="p-1 text-gray-400 hover:text-white">
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEzCuenta(c.id)}
                          className="p-1 text-gray-400 hover:text-red-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vincular cámara modal */}
      {showCamera && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h2 className="font-semibold text-white">Vincular cámara</h2>
              <button onClick={() => setShowCamera(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">ID del dispositivo cámara</label>
                <input type="text" value={camaraId} onChange={e => setCamaraId(e.target.value)}
                  placeholder="UUID del dispositivo cámara..."
                  className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCamera(false)} className="px-4 py-2 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600">Cancelar</button>
                <button onClick={handleVincularCamara} disabled={linking || !camaraId}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  Vincular
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Asignar a comunidad ── */}
      {showAsignar && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Asignar a comunidad</h2>
              <button onClick={() => setShowAsignar(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Dispositivo: <span className="text-white font-medium">{selected.nombre || selected.id_interno || selected.id}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">Selecciona la comunidad</label>
              <select
                value={asignarComunidadId}
                onChange={e => setAsignarComunidadId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Seleccionar --</option>
                {comunidades.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAsignar(false)} className="px-4 py-2 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600">Cancelar</button>
              <button
                onClick={handleAsignar}
                disabled={assigning || !asignarComunidadId}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
