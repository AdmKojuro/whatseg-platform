import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Plus,
  Search,
  Trash2,
  Eye,
  Loader2,
  AlertCircle,
  MapPin,
  Users,
  Cpu,
} from 'lucide-react'
import { comunidadService } from '../../services/comunidad.service'
import { useAuth } from '../../hooks/useAuth'
import { extApi } from '../../services/api'
import type { Comunidad } from '../../types/comunidad'

export default function ComunidadListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const fetchComunidades = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      // ADMIN → obtener su comunidad directamente y redirigir al detalle
      if (user?.rol === 'ADMIN') {
        const res = await extApi.get<{ id: string }>('/ext/admin-app/mi-comunidad')
        navigate(`/comunidades/${res.data.id}`, { replace: true })
        return
      }
      const response = await comunidadService.list()
      setComunidades(response.data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar comunidades'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [user?.rol, navigate])

  useEffect(() => {
    fetchComunidades()
  }, [fetchComunidades])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      setDeleting(true)
      setError(null)
      await comunidadService.delete(deleteId)
      setSuccessMsg('Comunidad eliminada exitosamente')
      setTimeout(() => setSuccessMsg(null), 3000)
      setDeleteId(null)
      await fetchComunidades()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar comunidad'
      setError(message)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = comunidades.filter((c) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      c.nombre.toLowerCase().includes(term) ||
      (c.direccion || '').toLowerCase().includes(term) ||
      c.codigo.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-white">Comunidades</h1>
        </div>
        <button
          onClick={() => navigate('/comunidades/nueva')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Comunidad
        </button>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
          <p>{successMsg}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, codigo o direccion..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/40 border-b border-gray-700">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Nombre</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Direccion</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Coordenadas</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Clientes</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Dispositivos</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Creado</th>
                  <th className="text-right px-6 py-3 font-semibold text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      No se encontraron comunidades
                    </td>
                  </tr>
                ) : (
                  filtered.map((comunidad) => (
                    <tr
                      key={comunidad.id}
                      onClick={() => navigate(`/comunidades/${comunidad.id}`)}
                      className="hover:bg-gray-700/30 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <span className="font-medium text-white">{comunidad.nombre}</span>
                          <span className="block text-xs text-gray-500 mt-0.5">{comunidad.codigo}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {comunidad.direccion ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="truncate max-w-[200px]">{comunidad.direccion}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs font-mono whitespace-nowrap">
                        {comunidad.latitud && comunidad.longitud
                          ? `${comunidad.latitud.toFixed(4)}, ${comunidad.longitud.toFixed(4)}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <Users className="w-3.5 h-3.5" />
                          {comunidad._count?.clientes ?? 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <Cpu className="w-3.5 h-3.5" />
                          {comunidad._count?.dispositivos ?? 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                        {new Date(comunidad.created_at).toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/comunidades/${comunidad.id}`) }}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteId(comunidad.id) }}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Confirmar eliminacion</h2>
            <p className="text-sm text-gray-400 mb-6">
              ¿Estas seguro de que deseas eliminar esta comunidad? Se eliminaran tambien los datos
              asociados. Esta accion no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
