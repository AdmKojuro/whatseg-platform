import { useState, useEffect, useCallback } from 'react'
import {
  Building2,
  AlertCircle,
  MapPin,
  Hash,
  Users,
  Cpu,
} from 'lucide-react'
import { cuadranteService } from '../../services/cuadrante.service'
import type { Comunidad } from '../../types/comunidad'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'

export default function MisComunidadesPage() {
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchComunidades = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await cuadranteService.getMisComunidades()
      setComunidades(data as unknown as Comunidad[])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar comunidades'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchComunidades()
  }, [fetchComunidades])

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
      <div className="flex items-center gap-3">
        <Building2 className="w-8 h-8 text-purple-600" />
        <h1 className="text-2xl font-bold text-white">Mis Comunidades</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Communities grid */}
      {comunidades.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-500">Sin comunidades asignadas</h3>
            <p className="text-gray-400 mt-1">
              Contacta a un administrador para que te asigne comunidades
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {comunidades.map((comunidad) => (
            <div
              key={comunidad.id}
              className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-purple-600" />
                </div>
                <Badge variant={comunidad.activa ? 'success' : 'danger'}>
                  {comunidad.activa ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>

              <h3 className="text-lg font-semibold text-white mb-2">{comunidad.nombre}</h3>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span>
                    Codigo: <span className="font-mono font-medium">{comunidad.codigo}</span>
                  </span>
                </div>
                {comunidad.direccion && (
                  <div className="flex items-start gap-2 text-gray-400">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <span>{comunidad.direccion}</span>
                  </div>
                )}
                {comunidad._count && (
                  <>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{comunidad._count.clientes} clientes</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Cpu className="w-4 h-4 text-gray-400" />
                      <span>{comunidad._count.dispositivos} dispositivos</span>
                    </div>
                  </>
                )}
              </div>

              {comunidad.latitud && comunidad.longitud && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Coordenadas: {comunidad.latitud.toFixed(6)}, {comunidad.longitud.toFixed(6)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
