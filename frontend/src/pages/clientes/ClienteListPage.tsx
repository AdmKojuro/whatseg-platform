import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Users, Search, ChevronLeft, ChevronRight, Plus, AlertCircle } from 'lucide-react'
import { clienteService } from '../../services/cliente.service'
import { comunidadService } from '../../services/comunidad.service'
import type { Cliente } from '../../types/cliente'
import type { Comunidad } from '../../types/comunidad'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

type EstadoCliente = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO'

function getEstado(cliente: Cliente): EstadoCliente {
  if (cliente.bloqueos && cliente.bloqueos.length > 0) return 'BLOQUEADO'
  return cliente.activo ? 'ACTIVO' : 'INACTIVO'
}

function getEstadoBadgeVariant(estado: EstadoCliente) {
  switch (estado) {
    case 'ACTIVO':   return 'success' as const
    case 'INACTIVO': return 'neutral' as const
    case 'BLOQUEADO':return 'danger'  as const
  }
}

export default function ClienteListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const comunidadFiltro = searchParams.get('comunidad_id') ?? undefined
  const [allClientes, setAllClientes] = useState<Cliente[]>([])
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', celular: '', identificador: '', comunidad_id: comunidadFiltro ?? '' })

  const fetchClientes = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params: Record<string, string> = {}
      if (comunidadFiltro) params.comunidad_id = comunidadFiltro
      const response = await clienteService.list(Object.keys(params).length ? params : undefined)
      setAllClientes(response.data as unknown as Cliente[])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar clientes'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [comunidadFiltro])

  const fetchComunidades = useCallback(async () => {
    try {
      const res = await comunidadService.list()
      setComunidades(res.data as unknown as Comunidad[])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchClientes()
    fetchComunidades()
  }, [fetchClientes, fetchComunidades])

  useEffect(() => { setPage(1) }, [search])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    if (!form.nombre.trim() || !form.celular.trim() || !form.identificador.trim() || !form.comunidad_id) {
      setCreateError('Todos los campos son obligatorios')
      return
    }
    try {
      setCreating(true)
      await clienteService.create({
        nombre: form.nombre.trim(),
        celular: form.celular.trim(),
        identificador: form.identificador.trim(),
        comunidad_id: form.comunidad_id,
      })
      setShowCreate(false)
      setForm({ nombre: '', celular: '', identificador: '', comunidad_id: '' })
      await fetchClientes()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setCreateError(axiosErr.response?.data?.message ?? (err instanceof Error ? err.message : 'Error al crear cliente'))
    } finally {
      setCreating(false)
    }
  }

  const filtered = allClientes.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.nombre?.toLowerCase().includes(q) ||
      c.celular?.toLowerCase().includes(q) ||
      c.identificador?.toLowerCase().includes(q)
  })
  const clientes = filtered.slice((page - 1) * limit, page * limit)
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-white">Clientes</h1>
            {!loading && <p className="text-sm text-gray-500">{total} clientes en total</p>}
          </div>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => { setForm({ nombre: '', celular: '', identificador: '', comunidad_id: '' }); setCreateError(null); setShowCreate(true) }}
        >
          Nuevo Cliente
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <p>{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, celular o identificador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
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
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Nombre</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Celular</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Comunidad</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Estado</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Registrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {clientes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500">
                      <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-lg font-medium">No se encontraron clientes</p>
                      {search && <p className="text-sm mt-1">Intenta con otro termino de busqueda</p>}
                    </td>
                  </tr>
                ) : (
                  clientes.map((cliente) => {
                    const estado = getEstado(cliente)
                    const comunidadNombre =
                      cliente.comunidades && cliente.comunidades.length > 0
                        ? cliente.comunidades[0].comunidad?.nombre || '-'
                        : '-'
                    return (
                      <tr
                        key={cliente.id}
                        onClick={() => navigate(`/clientes/${cliente.id}`)}
                        className="hover:bg-gray-700/30 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <span className="font-medium text-white">{cliente.nombre}</span>
                          <span className="block text-xs text-gray-500 mt-0.5">{cliente.identificador}</span>
                        </td>
                        <td className="px-6 py-4 text-gray-400">{cliente.celular}</td>
                        <td className="px-6 py-4 text-gray-400">{comunidadNombre}</td>
                        <td className="px-6 py-4">
                          <Badge variant={getEstadoBadgeVariant(estado)}>{estado}</Badge>
                        </td>
                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                          {formatDate(cliente.created_at)}
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
              <p className="text-sm text-gray-400">Pagina {page} de {totalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-300 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-300 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Cliente">
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{createError}</p>
            </div>
          )}
          <Input
            label="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Nombre completo del cliente"
          />
          <Input
            label="Celular"
            value={form.celular}
            onChange={(e) => setForm({ ...form, celular: e.target.value })}
            placeholder="Ej: 3001234567"
          />
          <Input
            label="Identificador (cédula / documento)"
            value={form.identificador}
            onChange={(e) => setForm({ ...form, identificador: e.target.value })}
            placeholder="Número de documento"
          />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Comunidad</label>
            <select
              value={form.comunidad_id}
              onChange={(e) => setForm({ ...form, comunidad_id: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar comunidad...</option>
              {comunidades.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={creating}>Crear Cliente</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
