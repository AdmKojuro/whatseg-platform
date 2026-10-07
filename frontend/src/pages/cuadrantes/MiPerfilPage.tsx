import { useState, useEffect, useCallback } from 'react'
import {
  User,
  Save,
  Shield,
  Smartphone,
  Mail,
  BadgeCheck,
  Phone,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { cuadranteService } from '../../services/cuadrante.service'
import type { TipoEmergencia } from '../../types/enums'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'

interface CuadrantePerfil {
  id: string
  nombre: string
  email: string
  telefono?: string
  rol: string
  activo: boolean
  tipos_emergencia?: TipoEmergencia[]
}

const EMERGENCY_TYPES: { value: TipoEmergencia; label: string; color: string }[] = [
  { value: 'POLICIA', label: 'Policia', color: 'text-blue-600' },
  { value: 'ASISTENCIA_MEDICA', label: 'Asistencia Medica', color: 'text-red-600' },
  { value: 'BOMBEROS', label: 'Bomberos', color: 'text-amber-600' },
]

export default function MiPerfilPage() {
  const [perfil, setPerfil] = useState<CuadrantePerfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Edit form
  const [editForm, setEditForm] = useState({ nombre: '', email: '', telefono: '' })
  const [savingProfile, setSavingProfile] = useState(false)

  // Emergency types
  const [selectedTypes, setSelectedTypes] = useState<TipoEmergencia[]>([])
  const [savingTypes, setSavingTypes] = useState(false)

  // FCM
  const [fcmToken, setFcmToken] = useState('')
  const [savingFcm, setSavingFcm] = useState(false)

  const fetchPerfil = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await cuadranteService.getMiPerfil()
      const profile = data as unknown as CuadrantePerfil
      setPerfil(profile)
      setEditForm({
        nombre: profile.nombre || '',
        email: profile.email || '',
        telefono: profile.telefono || '',
      })
      setSelectedTypes(profile.tipos_emergencia || [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar perfil'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPerfil()
  }, [fetchPerfil])

  const showSuccessMsg = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!perfil) return
    try {
      setSavingProfile(true)
      setError(null)
      await cuadranteService.update(perfil.id, {
        nombre: editForm.nombre,
        email: editForm.email,
      })
      showSuccessMsg('Perfil actualizado exitosamente')
      await fetchPerfil()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al actualizar perfil'
      setError(message)
    } finally {
      setSavingProfile(false)
    }
  }

  const toggleEmergencyType = (tipo: TipoEmergencia) => {
    setSelectedTypes((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    )
  }

  const handleSaveTypes = async () => {
    try {
      setSavingTypes(true)
      setError(null)
      await cuadranteService.updateTiposEmergencia(selectedTypes)
      showSuccessMsg('Tipos de emergencia actualizados')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al actualizar tipos de emergencia'
      setError(message)
    } finally {
      setSavingTypes(false)
    }
  }

  const handleRegisterFcm = async () => {
    if (!fcmToken.trim()) return
    try {
      setSavingFcm(true)
      setError(null)
      await cuadranteService.saveFcmToken(fcmToken, 'web')
      showSuccessMsg('Token FCM registrado exitosamente')
      setFcmToken('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al registrar token FCM'
      setError(message)
    } finally {
      setSavingFcm(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <p>No se pudo cargar el perfil</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <User className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
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

      {/* Profile card */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{perfil.nombre}</h2>
              <p className="text-blue-100 text-sm">{perfil.rol}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500">Email:</span>
            <span className="font-medium text-white">{perfil.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500">Telefono:</span>
            <span className="font-medium text-white">{perfil.telefono || 'No registrado'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <BadgeCheck className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500">Estado:</span>
            <Badge variant={perfil.activo ? 'success' : 'danger'}>
              {perfil.activo ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Shield className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500">Rol:</span>
            <span className="font-medium text-white">{perfil.rol}</span>
          </div>
        </div>
      </div>

      {/* Edit profile form */}
      <Card title="Editar Informacion">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Nombre"
            value={editForm.nombre}
            onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
            placeholder="Tu nombre"
          />
          <Input
            label="Email"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            placeholder="email@ejemplo.com"
          />
          <Input
            label="Telefono"
            value={editForm.telefono}
            onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
            placeholder="Numero de telefono"
          />
          <Button
            type="submit"
            variant="primary"
            loading={savingProfile}
            icon={<Save className="w-4 h-4" />}
          >
            Guardar Cambios
          </Button>
        </form>
      </Card>

      {/* Emergency types */}
      <Card title="Tipos de Emergencia">
        <p className="text-sm text-gray-500 mb-4">
          Selecciona los tipos de emergencia para los que deseas recibir notificaciones
        </p>

        <div className="space-y-3">
          {EMERGENCY_TYPES.map((etype) => (
            <label
              key={etype.value}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:bg-gray-700/50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedTypes.includes(etype.value)}
                onChange={() => toggleEmergencyType(etype.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <Shield className={`w-5 h-5 ${etype.color}`} />
              <span className="font-medium text-white">{etype.label}</span>
            </label>
          ))}
        </div>

        <div className="mt-6">
          <Button
            variant="primary"
            onClick={handleSaveTypes}
            loading={savingTypes}
            icon={<Save className="w-4 h-4" />}
          >
            Guardar Tipos
          </Button>
        </div>
      </Card>

      {/* FCM Token */}
      <Card title="Notificaciones Push">
        <div className="flex items-center gap-3 mb-4">
          <Smartphone className="w-5 h-5 text-gray-400" />
          <p className="text-sm text-gray-500">
            Registra un token FCM para recibir notificaciones push en tu dispositivo.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={fcmToken}
            onChange={(e) => setFcmToken(e.target.value)}
            placeholder="Token FCM"
          />
          <Button
            variant="primary"
            onClick={handleRegisterFcm}
            loading={savingFcm}
            disabled={!fcmToken.trim()}
          >
            Registrar
          </Button>
        </div>
        <div className="mt-4 p-3 bg-gray-900 rounded-lg">
          <p className="text-xs text-gray-400">
            Las notificaciones push se configuran automaticamente al iniciar sesion desde un
            dispositivo compatible con Firebase Cloud Messaging.
          </p>
        </div>
      </Card>
    </div>
  )
}
