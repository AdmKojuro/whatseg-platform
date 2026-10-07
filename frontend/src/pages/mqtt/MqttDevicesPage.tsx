import { useState, useEffect, useCallback } from 'react'
import {
  Radio,
  AlertCircle,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  CheckCircle2,
  Server,
  Cpu,
  Hash,
  RefreshCw,
  Zap,
  Pencil,
} from 'lucide-react'
import { mqttService } from '../../services/mqtt.service'
import { comunidadService } from '../../services/comunidad.service'
import { dispositivoService } from '../../services/dispositivo.service'
import type { MqttDriver, MqttDevice, MqttDeviceChannel, BrokerStatus } from '../../types/mqtt'
import type { Comunidad } from '../../types/comunidad'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'

export default function MqttDevicesPage() {
  const [devices, setDevices] = useState<MqttDevice[]>([])
  const [drivers, setDrivers] = useState<MqttDriver[]>([])
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [brokerStatus, setBrokerStatus] = useState<BrokerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingDevice, setEditingDevice] = useState<MqttDevice | null>(null)
  const [editForm, setEditForm] = useState({
    comunidad_id: '',
    channels: [] as { id: string; channel: number; nombre: string; tipo: string }[],
  })
  const [saving, setSaving] = useState(false)

  // Register form
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [registerForm, setRegisterForm] = useState({
    kind: '',
    device_id: '',
    comunidad_id: '',
    relay_count: 1,
    nombres: [''] as string[],
    tipos: [''] as string[],
  })

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true); else setLoading(true)
      setError(null)
      const [devicesRes, driversRes, comunidadesRes] = await Promise.all([
        mqttService.getDevices(),
        mqttService.getDrivers(),
        comunidadService.list(),
      ])
      setDevices((devicesRes.data as unknown as MqttDevice[]) || [])
      setDrivers((driversRes.data as unknown as MqttDriver[]) || [])
      setComunidades(comunidadesRes.data || [])
      // Broker status is optional — endpoint may not be available
      mqttService.getBrokerStatus()
        .then(res => setBrokerStatus(res.data as unknown as BrokerStatus))
        .catch(() => { /* endpoint not available */ })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar dispositivos MQTT'
      setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const showSuccessMsg = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleRelayCountChange = (count: number) => {
    const clampedCount = Math.max(1, Math.min(8, count))
    setRegisterForm((prev) => {
      const nombres = [...prev.nombres]
      const tipos = [...prev.tipos]
      while (nombres.length < clampedCount) {
        nombres.push('')
        tipos.push('')
      }
      return {
        ...prev,
        relay_count: clampedCount,
        nombres: nombres.slice(0, clampedCount),
        tipos: tipos.slice(0, clampedCount),
      }
    })
  }

  const handleNombreChange = (index: number, value: string) => {
    setRegisterForm((prev) => {
      const nombres = [...prev.nombres]
      nombres[index] = value
      return { ...prev, nombres }
    })
  }

  const handleTipoChange = (index: number, value: string) => {
    setRegisterForm((prev) => {
      const tipos = [...prev.tipos]
      tipos[index] = value
      return { ...prev, tipos }
    })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!registerForm.kind || !registerForm.device_id) {
      setError('Kind y Device ID son obligatorios')
      return
    }

    try {
      setRegistering(true)
      setError(null)
      await mqttService.register({
        kind: registerForm.kind,
        device_id: registerForm.device_id,
        comunidad_id: registerForm.comunidad_id || undefined,
        relay_count: registerForm.relay_count,
        nombres: registerForm.nombres.filter((n) => n.trim()),
        tipos: registerForm.tipos.filter((t) => t.trim()),
      })
      showSuccessMsg('Dispositivo MQTT registrado exitosamente')
      setShowRegisterModal(false)
      setRegisterForm({ kind: '', device_id: '', comunidad_id: '', relay_count: 1, nombres: [''], tipos: [''] })
      await fetchData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al registrar dispositivo'
      setError(message)
    } finally {
      setRegistering(false)
    }
  }

  const handleTest = async (device: MqttDevice) => {
    const firstChannel = device.channels?.[0]
    if (!firstChannel) { setError('El dispositivo no tiene canales registrados'); return }
    const key = `${device.kind}:${device.device_id}`
    try {
      setTesting(key)
      setError(null)
      await dispositivoService.probar(firstChannel.id)
      showSuccessMsg(`Pulso enviado a ${device.device_id} canal ${firstChannel.channel}`)
    } catch {
      setError('Error al probar el dispositivo')
    } finally {
      setTesting(null)
    }
  }

  const openEditModal = (device: MqttDevice) => {
    setEditingDevice(device)
    setEditForm({
      comunidad_id: device.comunidad?.id ?? '',
      channels: (device.channels ?? []).map(ch => ({
        id: ch.id,
        channel: ch.channel,
        nombre: ch.nombre ?? '',
        tipo: ch.tipo ?? '',
      })),
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingDevice) return
    try {
      setSaving(true)
      setError(null)
      await Promise.all(
        editForm.channels.map(ch =>
          dispositivoService.asignar(ch.id, {
            comunidad_id: editForm.comunidad_id,
            nombre: ch.nombre || `Canal ${ch.channel}`,
            tipo: ch.tipo || undefined,
          })
        )
      )
      showSuccessMsg('Dispositivo actualizado')
      setShowEditModal(false)
      setEditingDevice(null)
      await fetchData()
    } catch {
      setError('Error al guardar cambios')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (kind: string, deviceId: string) => {
    if (!window.confirm(`Eliminar el dispositivo MQTT ${deviceId}?`)) return

    const deleteKey = `${kind}:${deviceId}`
    try {
      setDeleting(deleteKey)
      await mqttService.delete(kind, deviceId)
      showSuccessMsg('Dispositivo eliminado')
      await fetchData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar dispositivo'
      setError(message)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Radio className="w-8 h-8 text-amber-600" />
          <h1 className="text-2xl font-bold text-white">Dispositivos MQTT</h1>
        </div>
        <div className="flex items-center gap-3">
          {brokerStatus && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                brokerStatus.connected
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              Broker {brokerStatus.connected ? 'Conectado' : 'Desconectado'}
            </span>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <Button
            variant="primary"
            onClick={() => {
              setRegisterForm({
                kind: '',
                device_id: '',
                comunidad_id: '',
                relay_count: 1,
                nombres: [''],
                tipos: [''],
              })
              setShowRegisterModal(true)
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            Registrar Dispositivo
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

      {/* Devices table */}
      <Card title="Dispositivos Registrados">
        <div className="overflow-x-auto -mx-6 -my-4">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/40 border-b border-gray-700">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-300">Kind</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-300">Device ID</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-300">Comunidad</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-300">Canales</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-300">Estado</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    <Radio className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>No hay dispositivos MQTT registrados</p>
                  </td>
                </tr>
              ) : (
                devices.map((device) => {
                  const deleteKey = `${device.kind}:${device.device_id}`
                  return (
                    <tr key={deleteKey} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <Badge variant="warning">
                          <span className="flex items-center gap-1">
                            <Cpu className="w-3 h-3" />
                            {device.kind}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-white">
                        {device.device_id}
                      </td>
                      <td className="px-6 py-4">
                        {device.comunidad ? (
                          <div>
                            <p className="text-sm text-white">{device.comunidad.nombre}</p>
                            <p className="text-[10px] text-gray-500 font-mono">{device.comunidad.codigo}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {device.channels && device.channels.length > 0 ? (
                          <>
                            <div className="flex items-center gap-1 text-gray-400 mb-1">
                              <Hash className="w-3.5 h-3.5" />
                              {device.channels.length} canal(es)
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {device.channels.map((ch) => (
                                <span
                                  key={ch.id}
                                  className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded"
                                >
                                  C{ch.channel} {ch.nombre ? `· ${ch.nombre}` : ''}
                                  {ch.tipo ? ` (${ch.tipo})` : ''}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5" />
                            {device.relay_count ?? '—'} canal(es)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            device.online
                              ? 'bg-emerald-50 text-emerald-400'
                              : 'bg-gray-700 text-gray-400'
                          }`}
                        >
                          {device.online ? (
                            <Wifi className="w-3 h-3" />
                          ) : (
                            <WifiOff className="w-3 h-3" />
                          )}
                          {device.online ? 'Online' : 'Offline'}
                        </span>
                        {device.last_seen && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(device.last_seen).toLocaleString('es-ES')}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleTest(device)}
                            disabled={testing === deleteKey || !device.channels?.length}
                            className="p-1.5 text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Probar (pulso canal 0)"
                          >
                            {testing === deleteKey ? <Spinner size="sm" /> : <Zap className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => openEditModal(device)}
                            className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(device.kind, device.device_id)}
                            disabled={deleting === deleteKey}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Eliminar"
                          >
                            {deleting === deleteKey ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Available Drivers */}
      {drivers.length > 0 && (
        <Card title="Drivers Disponibles">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {drivers.map((driver) => (
              <div
                key={driver.kind}
                className="p-4 rounded-lg border border-gray-700 hover:border-brand-500/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-white">{driver.label}</span>
                </div>
                <div className="space-y-1 text-xs text-gray-500">
                  <p>
                    Kind: <span className="font-mono">{driver.kind}</span>
                  </p>
                  {driver.description && <p>{driver.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingDevice(null) }}
        title={`Editar — ${editingDevice?.device_id ?? ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Comunidad</label>
            <select
              value={editForm.comunidad_id}
              onChange={(e) => setEditForm({ ...editForm, comunidad_id: e.target.value })}
              className="w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin comunidad</option>
              {comunidades.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} — {c.codigo}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-300">Canales</p>
            {editForm.channels.map((ch, idx) => (
              <div key={ch.id} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-8 shrink-0">C{ch.channel}</span>
                <input
                  type="text"
                  value={ch.nombre}
                  onChange={(e) => {
                    const channels = [...editForm.channels]
                    channels[idx] = { ...channels[idx], nombre: e.target.value }
                    setEditForm({ ...editForm, channels })
                  }}
                  placeholder={`Nombre canal ${ch.channel}`}
                  className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={ch.tipo}
                  onChange={(e) => {
                    const channels = [...editForm.channels]
                    channels[idx] = { ...channels[idx], tipo: e.target.value }
                    setEditForm({ ...editForm, channels })
                  }}
                  className="w-36 px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tipo...</option>
                  <option value="ALARMA">ALARMA</option>
                  <option value="PUERTA">PUERTA</option>
                  <option value="CAMARA">CAMARA</option>
                </select>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { setShowEditModal(false); setEditingDevice(null) }}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={!editForm.comunidad_id}
              onClick={handleSaveEdit}
            >
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Register Modal */}
      <Modal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        title="Registrar Nuevo Dispositivo MQTT"
        size="lg"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Kind (Driver)</label>
              <select
                value={registerForm.kind}
                onChange={(e) => setRegisterForm({ ...registerForm, kind: e.target.value })}
                className="w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">Seleccionar driver...</option>
                {drivers.map((d) => (
                  <option key={d.kind} value={d.kind}>
                    {d.label} ({d.kind})
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Device ID"
              value={registerForm.device_id}
              onChange={(e) => setRegisterForm({ ...registerForm, device_id: e.target.value })}
              placeholder="Identificador del dispositivo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Comunidad</label>
            <select
              value={registerForm.comunidad_id}
              onChange={(e) => setRegisterForm({ ...registerForm, comunidad_id: e.target.value })}
              className="w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Sin comunidad (configurar después)</option>
              {comunidades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} — {c.codigo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Cantidad de Relays
            </label>
            <input
              type="number"
              min={1}
              max={8}
              value={registerForm.relay_count}
              onChange={(e) => handleRelayCountChange(parseInt(e.target.value) || 1)}
              className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Channel names and types */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-300">Canales</p>
            {Array.from({ length: registerForm.relay_count }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-8 shrink-0">#{index}</span>
                <input
                  type="text"
                  value={registerForm.nombres[index] || ''}
                  onChange={(e) => handleNombreChange(index, e.target.value)}
                  placeholder={`Nombre canal ${index}`}
                  className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <select
                  value={registerForm.tipos[index] || ''}
                  onChange={(e) => handleTipoChange(index, e.target.value)}
                  className="w-36 px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Tipo...</option>
                  <option value="ALARMA">ALARMA</option>
                  <option value="PUERTA">PUERTA</option>
                  <option value="CAMARA">CAMARA</option>
                </select>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowRegisterModal(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={registering}
              disabled={!registerForm.kind || !registerForm.device_id}
            >
              Registrar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
