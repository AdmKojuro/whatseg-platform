import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  User,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Building2,
  Shield,
  Ban,
  UserMinus,
  ArrowRightLeft,
  History,
  Siren,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  LockOpen,
  Pencil,
} from 'lucide-react'
import { clienteService } from '../../services/cliente.service'
import { activacionService } from '../../services/activacion.service'
import { comunidadService } from '../../services/comunidad.service'
import type { Cliente, CambioComunidad } from '../../types/cliente'
import type { Activacion } from '../../types/activacion'
import type { Comunidad } from '../../types/comunidad'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Input } from '../../components/ui/Input'

type EstadoCliente = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO'

function getEstado(cliente: Cliente): EstadoCliente {
  if (cliente.bloqueos && cliente.bloqueos.length > 0) return 'BLOQUEADO'
  return cliente.activo ? 'ACTIVO' : 'INACTIVO'
}

function getEstadoBadgeVariant(estado: EstadoCliente) {
  switch (estado) {
    case 'ACTIVO':    return 'success' as const
    case 'INACTIVO':  return 'neutral' as const
    case 'BLOQUEADO': return 'danger'  as const
  }
}

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [historial, setHistorial] = useState<CambioComunidad[]>([])
  const [activaciones, setActivaciones] = useState<Activacion[]>([])
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Edit modal
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ nombre: '', celular: '', identificador: '' })
  const [editing, setEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Transfer modal
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferDestinoId, setTransferDestinoId] = useState('')
  const [transferMotivo, setTransferMotivo] = useState('')
  const [transferring, setTransferring] = useState(false)

  // Bloquear modal
  const [showBloquear, setShowBloquear] = useState(false)
  const [bloqueoMotivo, setBloqueoMotivo] = useState('')
  const [bloqueoHoras, setBloqueoHoras] = useState('24')
  const [bloqueando, setBloqueando] = useState(false)
  const [bloqueoError, setBloqueoError] = useState<string | null>(null)

  const fetchCliente = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      setError(null)
      const response = await clienteService.getById(id)
      setCliente(response.data as unknown as Cliente)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar cliente'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchHistorial = useCallback(async () => {
    if (!id) return
    try {
      const response = await clienteService.getHistorialCambios(id)
      setHistorial((response.data as unknown as CambioComunidad[]) || [])
    } catch { /* silent */ }
  }, [id])

  const fetchActivaciones = useCallback(async () => {
    if (!id) return
    try {
      const response = await activacionService.getByCliente(id)
      const raw = response.data as unknown
      if (Array.isArray(raw)) {
        setActivaciones(raw as Activacion[])
      } else {
        setActivaciones(((raw as { data?: Activacion[] }).data) || [])
      }
    } catch { /* silent */ }
  }, [id])

  const fetchComunidades = useCallback(async () => {
    try {
      const response = await comunidadService.list()
      setComunidades((response.data as unknown as Comunidad[]) || [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchCliente()
    fetchHistorial()
    fetchActivaciones()
    fetchComunidades()
  }, [fetchCliente, fetchHistorial, fetchActivaciones, fetchComunidades])

  const showSuccessMsg = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleActivar = async () => {
    if (!id) return
    try {
      setActionLoading('activar')
      setError(null)
      await clienteService.activar(id)
      showSuccessMsg('Cliente activado exitosamente')
      await fetchCliente()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al activar cliente')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDesactivar = async () => {
    if (!id) return
    try {
      setActionLoading('desactivar')
      setError(null)
      await clienteService.desactivar(id)
      showSuccessMsg('Cliente desactivado exitosamente')
      await fetchCliente()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al desactivar cliente')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDesasignar = async () => {
    if (!id) return
    if (!window.confirm('¿Desasignar al cliente de su comunidad actual?')) return
    try {
      setActionLoading('desasignar')
      setError(null)
      await clienteService.desasignar(id)
      showSuccessMsg('Cliente desasignado exitosamente')
      await fetchCliente()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al desasignar cliente')
    } finally {
      setActionLoading(null)
    }
  }

  const handleTransferir = async () => {
    if (!id || !transferDestinoId) return
    try {
      setTransferring(true)
      setError(null)
      await clienteService.transferir(id, {
        destino_id: transferDestinoId,
        motivo: transferMotivo || undefined,
      })
      showSuccessMsg('Cliente transferido exitosamente')
      setShowTransferModal(false)
      setTransferDestinoId('')
      setTransferMotivo('')
      await fetchCliente()
      await fetchHistorial()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al transferir cliente')
    } finally {
      setTransferring(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setEditError(null)
    if (!editForm.nombre.trim() || !editForm.celular.trim() || !editForm.identificador.trim()) {
      setEditError('Todos los campos son obligatorios')
      return
    }
    try {
      setEditing(true)
      await clienteService.update(id, {
        nombre: editForm.nombre.trim(),
        celular: editForm.celular.trim(),
        identificador: editForm.identificador.trim(),
      })
      showSuccessMsg('Cliente actualizado exitosamente')
      setShowEdit(false)
      await fetchCliente()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setEditError(axiosErr.response?.data?.message ?? (err instanceof Error ? err.message : 'Error al actualizar'))
    } finally {
      setEditing(false)
    }
  }

  const handleBloquear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setBloqueoError(null)
    const duracionHoras = parseInt(bloqueoHoras, 10)
    if (!duracionHoras || duracionHoras <= 0) {
      setBloqueoError('Ingresa una duración válida')
      return
    }
    try {
      setBloqueando(true)
      await clienteService.bloquear(id, {
        motivo: bloqueoMotivo.trim() || undefined,
        duracion: duracionHoras * 60,
      })
      showSuccessMsg('Cliente bloqueado exitosamente')
      setShowBloquear(false)
      setBloqueoMotivo('')
      setBloqueoHoras('24')
      await fetchCliente()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setBloqueoError(axiosErr.response?.data?.message ?? (err instanceof Error ? err.message : 'Error al bloquear'))
    } finally {
      setBloqueando(false)
    }
  }

  const handleDesbloquear = async () => {
    if (!id) return
    if (!window.confirm('¿Desbloquear este cliente?')) return
    try {
      setActionLoading('desbloquear')
      setError(null)
      await clienteService.desbloquear(id)
      showSuccessMsg('Cliente desbloqueado exitosamente')
      await fetchCliente()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al desbloquear cliente')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/clientes')}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>Cliente no encontrado</p>
        </div>
      </div>
    )
  }

  const estado = getEstado(cliente)
  const comunidadActual =
    cliente.comunidades && cliente.comunidades.length > 0
      ? cliente.comunidades[0].comunidad
      : null

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/clientes')}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a clientes
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{cliente.nombre}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={getEstadoBadgeVariant(estado)}>{estado}</Badge>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          icon={<Pencil className="w-4 h-4" />}
          onClick={() => {
            setEditForm({ nombre: cliente.nombre, celular: cliente.celular, identificador: cliente.identificador })
            setEditError(null)
            setShowEdit(true)
          }}
        >
          Editar datos
        </Button>
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
        {/* Info card */}
        <Card title="Informacion del Cliente">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <dt className="text-gray-500 w-24">Nombre</dt>
              <dd className="font-medium text-white">{cliente.nombre}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <dt className="text-gray-500 w-24">Celular</dt>
              <dd className="font-medium text-white">{cliente.celular}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <dt className="text-gray-500 w-24">Identificador</dt>
              <dd className="font-mono text-xs text-white">{cliente.identificador}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <dt className="text-gray-500 w-24">Comunidad</dt>
              <dd className="font-medium text-white">{comunidadActual?.nombre || 'Sin asignar'}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-gray-400 shrink-0" />
              <dt className="text-gray-500 w-24">Estado</dt>
              <dd><Badge variant={getEstadoBadgeVariant(estado)}>{estado}</Badge></dd>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              <dt className="text-gray-500 w-24">Registrado</dt>
              <dd className="text-gray-400">{formatDate(cliente.created_at)}</dd>
            </div>
          </dl>
        </Card>

        {/* Actions card */}
        <Card title="Acciones">
          <div className="space-y-3">
            {/* Activar / Desactivar */}
            {cliente.activo ? (
              <Button
                variant="outline"
                onClick={handleDesactivar}
                loading={actionLoading === 'desactivar'}
                icon={<Ban className="w-4 h-4" />}
                className="w-full justify-start"
              >
                Desactivar Cliente
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleActivar}
                loading={actionLoading === 'activar'}
                icon={<CheckCircle2 className="w-4 h-4" />}
                className="w-full justify-start"
              >
                Activar Cliente
              </Button>
            )}

            {/* Bloquear / Desbloquear */}
            {estado === 'BLOQUEADO' ? (
              <Button
                variant="secondary"
                onClick={handleDesbloquear}
                loading={actionLoading === 'desbloquear'}
                icon={<LockOpen className="w-4 h-4" />}
                className="w-full justify-start"
              >
                Desbloquear Cliente
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={() => { setBloqueoMotivo(''); setBloqueoHoras('24'); setBloqueoError(null); setShowBloquear(true) }}
                icon={<Lock className="w-4 h-4" />}
                className="w-full justify-start"
              >
                Bloquear Cliente
              </Button>
            )}

            {/* Desasignar */}
            <Button
              variant="outline"
              onClick={handleDesasignar}
              loading={actionLoading === 'desasignar'}
              icon={<UserMinus className="w-4 h-4" />}
              className="w-full justify-start"
              disabled={!comunidadActual}
            >
              Desasignar de Comunidad
            </Button>

            {/* Transferir */}
            <Button
              variant="outline"
              onClick={() => {
                setTransferDestinoId('')
                setTransferMotivo('')
                setShowTransferModal(true)
              }}
              icon={<ArrowRightLeft className="w-4 h-4" />}
              className="w-full justify-start"
              disabled={!comunidadActual}
            >
              Transferir a otra Comunidad
            </Button>
          </div>

          {/* Bloqueos activos */}
          {cliente.bloqueos && cliente.bloqueos.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Bloqueos Activos</h4>
              <div className="space-y-2">
                {cliente.bloqueos.map((bloqueo) => (
                  <div
                    key={bloqueo.id}
                    className="p-3 bg-red-500/10 rounded-lg text-sm border border-red-500/30"
                  >
                    <p className="font-medium text-red-400">
                      Duracion: {Math.round(bloqueo.duracion / 60)} hs
                    </p>
                    {bloqueo.motivo && (
                      <p className="text-red-300 mt-1">Motivo: {bloqueo.motivo}</p>
                    )}
                    <p className="text-red-500 text-xs mt-1">{formatDate(bloqueo.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Historial de cambios */}
      <Card title="Historial de Cambios">
        {historial.length === 0 ? (
          <div className="text-center py-8">
            <History className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">Sin historial de cambios</p>
          </div>
        ) : (
          <div className="space-y-3">
            {historial.map((cambio) => (
              <div
                key={cambio.id}
                className="flex items-start gap-3 p-3 bg-gray-900 rounded-lg text-sm"
              >
                <ArrowRightLeft className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-white">
                    <span className="font-medium">{cambio.origen?.nombre || 'N/A'}</span>
                    {' → '}
                    <span className="font-medium">{cambio.destino?.nombre || 'N/A'}</span>
                  </p>
                  {cambio.motivo && (
                    <p className="text-gray-500 mt-0.5">Motivo: {cambio.motivo}</p>
                  )}
                  <p className="text-gray-400 text-xs mt-1">{formatDate(cambio.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Activaciones */}
      <Card title="Activaciones del Cliente">
        {activaciones.length === 0 ? (
          <div className="text-center py-8">
            <Siren className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">Sin activaciones registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 -my-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/40 border-b border-gray-700">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Fecha</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Dispositivo</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Resultado</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Emergencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {activaciones.map((act) => (
                  <tr key={act.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-3 text-gray-400 whitespace-nowrap">
                      {formatDate(act.created_at)}
                    </td>
                    <td className="px-6 py-3 text-white">{act.dispositivo?.nombre || '-'}</td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={
                          act.resultado === 'EXITOSO' ? 'success'
                          : act.resultado === 'FALLIDO' ? 'danger'
                          : 'warning'
                        }
                      >
                        {act.resultado}
                      </Badge>
                    </td>
                    <td className="px-6 py-3">
                      {act.tipo_emergencia ? (
                        <Badge
                          variant={
                            act.tipo_emergencia === 'POLICIA' ? 'info'
                            : act.tipo_emergencia === 'BOMBEROS' ? 'warning'
                            : 'danger'
                          }
                        >
                          {act.tipo_emergencia}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Editar Cliente">
        <form onSubmit={handleEdit} className="space-y-4">
          {editError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{editError}</p>
            </div>
          )}
          <Input
            label="Nombre"
            value={editForm.nombre}
            onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
            placeholder="Nombre completo"
          />
          <Input
            label="Celular"
            value={editForm.celular}
            onChange={(e) => setEditForm({ ...editForm, celular: e.target.value })}
            placeholder="Ej: 3001234567"
          />
          <Input
            label="Identificador (cédula / documento)"
            value={editForm.identificador}
            onChange={(e) => setEditForm({ ...editForm, identificador: e.target.value })}
            placeholder="Número de documento"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={editing}>Guardar cambios</Button>
          </div>
        </form>
      </Modal>

      {/* Bloquear Modal */}
      <Modal isOpen={showBloquear} onClose={() => setShowBloquear(false)} title="Bloquear Cliente">
        <form onSubmit={handleBloquear} className="space-y-4">
          {bloqueoError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{bloqueoError}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Duración (horas)</label>
            <input
              type="number"
              min="1"
              value={bloqueoHoras}
              onChange={(e) => setBloqueoHoras(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="24"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Motivo (opcional)</label>
            <textarea
              value={bloqueoMotivo}
              onChange={(e) => setBloqueoMotivo(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Razón del bloqueo..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowBloquear(false)}>Cancelar</Button>
            <Button type="submit" variant="danger" loading={bloqueando} icon={<Lock className="w-4 h-4" />}>
              Bloquear
            </Button>
          </div>
        </form>
      </Modal>

      {/* Transfer Modal */}
      <Modal isOpen={showTransferModal} onClose={() => setShowTransferModal(false)} title="Transferir Cliente" size="md">
        <div className="space-y-4">
          <div className="p-3 bg-gray-900 rounded-lg text-sm">
            <p>
              <span className="text-gray-500">Cliente:</span>{' '}
              <span className="font-medium text-white">{cliente.nombre}</span>
            </p>
            <p>
              <span className="text-gray-500">Comunidad actual:</span>{' '}
              <span className="font-medium text-white">{comunidadActual?.nombre || 'N/A'}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Comunidad destino</label>
            <select
              value={transferDestinoId}
              onChange={(e) => setTransferDestinoId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar comunidad...</option>
              {comunidades
                .filter((c) => c.id !== comunidadActual?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Motivo (opcional)</label>
            <textarea
              value={transferMotivo}
              onChange={(e) => setTransferMotivo(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Motivo de la transferencia..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowTransferModal(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={handleTransferir}
              loading={transferring}
              disabled={!transferDestinoId}
              icon={<ArrowRightLeft className="w-4 h-4" />}
            >
              Transferir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
