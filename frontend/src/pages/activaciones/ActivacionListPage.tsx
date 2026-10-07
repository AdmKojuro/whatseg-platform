import { useState, useEffect, useCallback } from 'react'
import {
  Siren,
  AlertCircle,
  Filter,
  Send,
  CheckCircle2,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { activacionService } from '../../services/activacion.service'
import { dashboardService } from '../../services/dashboard.service'
import { comunidadService } from '../../services/comunidad.service'
import type { Activacion } from '../../types/activacion'
import type { Comunidad } from '../../types/comunidad'
import type { VeredictoTipo } from '../../types/enums'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'

export default function ActivacionListPage() {
  const [activaciones, setActivaciones] = useState<Activacion[]>([])
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterComunidad, setFilterComunidad] = useState('')
  const [filterResultado, setFilterResultado] = useState('')
  const [filterFechaDesde, setFilterFechaDesde] = useState('')
  const [filterFechaHasta, setFilterFechaHasta] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 20

  // Verdict modal
  const [showVeredictModal, setShowVeredictModal] = useState(false)
  const [selectedActivacion, setSelectedActivacion] = useState<Activacion | null>(null)
  const [veredictForm, setVeredictForm] = useState<{
    veredicto: VeredictoTipo
    observacion: string
  }>({
    veredicto: 'FALSA_ALARMA',
    observacion: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const fetchComunidades = useCallback(async () => {
    try {
      const { data } = await comunidadService.list()
      setComunidades(data as unknown as Comunidad[])
    } catch {
      // silent
    }
  }, [])

  const fetchActivaciones = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params: Record<string, string> = {
        page: String(page),
        limit: String(limit),
      }
      if (filterComunidad) params.comunidad_id = filterComunidad
      if (filterFechaDesde) params.desde = filterFechaDesde
      if (filterFechaHasta) params.hasta = filterFechaHasta + 'T23:59:59'

      const { data } = await dashboardService.getActivacionesFiltradas(params)
      const result = data as unknown as { data: Activacion[]; total: number; page: number; limit: number }
      const rows: Activacion[] = Array.isArray(result) ? result : (result.data ?? [])
      const total = Array.isArray(result) ? result.length : (result.total ?? 0)
      setActivaciones(rows)
      setTotalPages(Math.max(1, Math.ceil(total / limit)))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar activaciones'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [page, limit, filterComunidad, filterFechaDesde, filterFechaHasta])

  useEffect(() => {
    fetchComunidades()
  }, [fetchComunidades])

  useEffect(() => {
    fetchActivaciones()
  }, [fetchActivaciones])

  const openVeredictModal = (activacion: Activacion) => {
    setSelectedActivacion(activacion)
    setVeredictForm({ veredicto: 'FALSA_ALARMA', observacion: '' })
    setSubmitSuccess(false)
    setShowVeredictModal(true)
  }

  const handleSubmitVeredicto = async () => {
    if (!selectedActivacion) return

    try {
      setSubmitting(true)
      setError(null)
      await activacionService.submitVeredicto(selectedActivacion.id, {
        veredicto: veredictForm.veredicto,
        observacion: veredictForm.observacion || undefined,
      })
      setSubmitSuccess(true)
      setTimeout(() => {
        setShowVeredictModal(false)
        setSelectedActivacion(null)
      }, 1500)
      await fetchActivaciones()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar veredicto'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const resetFilters = () => {
    setFilterComunidad('')
    setFilterResultado('')
    setFilterFechaDesde('')
    setFilterFechaHasta('')
    setPage(1)
  }

  const getResultVariant = (resultado: string) => {
    switch (resultado) {
      case 'EXITOSO':
        return 'success' as const
      case 'FALLIDO':
        return 'danger' as const
      case 'DISPOSITIVO_OFFLINE':
        return 'warning' as const
      default:
        return 'neutral' as const
    }
  }

  const getEmergencyInfo = (tipo: string | undefined) => {
    switch (tipo) {
      case 'POLICIA':
        return { variant: 'info' as const, label: 'Policia' }
      case 'ASISTENCIA_MEDICA':
        return { variant: 'danger' as const, label: 'Asist. Medica' }
      case 'BOMBEROS':
        return { variant: 'warning' as const, label: 'Bomberos' }
      default:
        return null
    }
  }

  // Client-side filter for resultado and dates
  const filteredActivaciones = activaciones.filter((act) => {
    if (filterResultado && act.resultado !== filterResultado) return false
    if (filterFechaDesde && act.created_at < filterFechaDesde) return false
    if (filterFechaHasta && act.created_at > filterFechaHasta + 'T23:59:59') return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Siren className="w-8 h-8 text-red-600" />
        <h1 className="text-2xl font-bold text-white">Activaciones</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-300">Filtros</h3>
          <button
            onClick={resetFilters}
            className="ml-auto text-xs text-brand-400 hover:text-brand-300"
          >
            Limpiar filtros
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Comunidad</label>
            <select
              value={filterComunidad}
              onChange={(e) => {
                setFilterComunidad(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todas</option>
              {comunidades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Resultado</label>
            <select
              value={filterResultado}
              onChange={(e) => {
                setFilterResultado(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos</option>
              <option value="EXITOSO">Exitoso</option>
              <option value="FALLIDO">Fallido</option>
              <option value="DISPOSITIVO_OFFLINE">Dispositivo Offline</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={filterFechaDesde}
                onChange={(e) => {
                  setFilterFechaDesde(e.target.value)
                  setPage(1)
                }}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={filterFechaHasta}
                onChange={(e) => {
                  setFilterFechaHasta(e.target.value)
                  setPage(1)
                }}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto -mx-6 -my-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/40 border-b border-gray-700">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Fecha</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Comunidad</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Cliente</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Dispositivo</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Resultado</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Emergencia</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Veredicto</th>
                  <th className="text-right px-6 py-3 font-semibold text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredActivaciones.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500">
                      <Siren className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p>No se encontraron activaciones</p>
                    </td>
                  </tr>
                ) : (
                  filteredActivaciones.map((act) => {
                    const emergencyInfo = getEmergencyInfo(act.tipo_emergencia)

                    return (
                      <tr key={act.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                          {formatDate(act.created_at)}
                        </td>
                        <td className="px-6 py-4 font-medium text-white">
                          {act.comunidad?.nombre || '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-400">
                          {act.cliente?.nombre || act.jefe?.nombre || '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-400">
                          {act.dispositivo?.nombre || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={getResultVariant(act.resultado)}>
                            {act.resultado}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          {emergencyInfo ? (
                            <Badge variant={emergencyInfo.variant}>{emergencyInfo.label}</Badge>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {act.veredicto ? (
                            <Badge
                              variant={act.veredicto === 'NOVEDAD' ? 'danger' : 'neutral'}
                            >
                              {act.veredicto === 'FALSA_ALARMA' ? 'Falsa Alarma' : 'Novedad'}
                            </Badge>
                          ) : (
                            <Badge variant="warning">Pendiente</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!act.veredicto && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openVeredictModal(act)}
                              icon={<Send className="w-3 h-3" />}
                            >
                              Veredicto
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-700 -mx-6 px-6 -mb-4 pb-4">
              <p className="text-sm text-gray-400">
                Pagina {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Verdict Modal */}
      <Modal
        isOpen={showVeredictModal}
        onClose={() => setShowVeredictModal(false)}
        title="Dar Veredicto"
      >
        <div className="space-y-4">
          {selectedActivacion && (
            <div className="p-3 bg-gray-900 rounded-lg text-sm">
              <p>
                <span className="text-gray-500">Comunidad:</span>{' '}
                <span className="font-medium">{selectedActivacion.comunidad?.nombre}</span>
              </p>
              <p>
                <span className="text-gray-500">Dispositivo:</span>{' '}
                <span className="font-medium">{selectedActivacion.dispositivo?.nombre}</span>
              </p>
              <p>
                <span className="text-gray-500">Fecha:</span>{' '}
                <span className="font-medium">{formatDate(selectedActivacion.created_at)}</span>
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Veredicto</label>
            <select
              value={veredictForm.veredicto}
              onChange={(e) =>
                setVeredictForm({
                  ...veredictForm,
                  veredicto: e.target.value as VeredictoTipo,
                })
              }
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="FALSA_ALARMA">Falsa Alarma</option>
              <option value="NOVEDAD">Novedad</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Observacion (opcional)
            </label>
            <textarea
              value={veredictForm.observacion}
              onChange={(e) =>
                setVeredictForm({ ...veredictForm, observacion: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none placeholder-gray-500"
              placeholder="Descripcion de lo ocurrido..."
            />
          </div>

          {submitSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Veredicto enviado exitosamente
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowVeredictModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitVeredicto}
              loading={submitting}
              icon={<Send className="w-4 h-4" />}
            >
              Enviar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
