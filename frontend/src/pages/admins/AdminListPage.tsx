import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck,
  Plus,
  Search,
  Trash2,
  Eye,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { adminService } from '../../services/admin.service'
import type { Admin } from '../../types/admin'

export default function AdminListPage() {
  const navigate = useNavigate()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminService.list()
      setAdmins(response.data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar administradores'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAdmins()
  }, [fetchAdmins])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      setDeleting(true)
      setError(null)
      await adminService.delete(deleteId)
      setSuccessMsg('Administrador eliminado exitosamente')
      setTimeout(() => setSuccessMsg(null), 3000)
      setDeleteId(null)
      await fetchAdmins()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar administrador'
      setError(message)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = admins.filter((admin) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      admin.nombre.toLowerCase().includes(term) ||
      admin.email.toLowerCase().includes(term)
    )
  })

  const ROL_BADGE: Record<string, { bg: string; text: string }> = {
    SUPERADMIN: { bg: 'bg-red-100', text: 'text-red-400' },
    ADMIN: { bg: 'bg-blue-100', text: 'text-blue-400' },
    MONITOR: { bg: 'bg-green-100', text: 'text-emerald-400' },
    CUADRANTE: { bg: 'bg-purple-100', text: 'text-purple-400' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-white">Administradores</h1>
        </div>
        <button
          onClick={() => navigate('/admins/nuevo')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Admin
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
          placeholder="Buscar por nombre o email..."
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
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Email</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Rol</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-300">Creado</th>
                  <th className="text-right px-6 py-3 font-semibold text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500">
                      No se encontraron administradores
                    </td>
                  </tr>
                ) : (
                  filtered.map((admin) => {
                    const rolBadge = ROL_BADGE[admin.rol] || { bg: 'bg-gray-100', text: 'text-gray-300' }

                    return (
                      <tr
                        key={admin.id}
                        className="hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="font-medium text-white">{admin.nombre}</span>
                        </td>
                        <td className="px-6 py-4 text-gray-400">{admin.email}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rolBadge.bg} ${rolBadge.text}`}
                          >
                            {admin.rol}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                          {new Date(admin.created_at).toLocaleDateString('es-ES')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => navigate(`/admins/${admin.id}`)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-500/20 rounded-lg transition-colors"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteId(admin.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Confirmar eliminacion</h2>
            <p className="text-sm text-gray-400 mb-6">
              ¿Estas seguro de que deseas eliminar este administrador? Esta accion no se puede deshacer.
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
