import { useState, useEffect, useRef } from 'react'
import { expedienteService } from '../../services/expediente.service'
import { FileText, Plus, Upload, Trash2, Edit3, AlertTriangle } from 'lucide-react'
import type { Expediente, CreateExpedienteInput } from '../../types/expediente'

const NIVEL_COLOR: Record<string, string> = {
  CRITICA: 'border-red-500 bg-red-500/10',
  ALTA: 'border-orange-500 bg-orange-500/10',
  MEDIA: 'border-yellow-500 bg-yellow-500/10',
  BAJA: 'border-blue-500 bg-blue-500/10',
}

const ESTADO_BADGE: Record<string, string> = {
  ACTIVO: 'bg-green-500/20 text-green-300',
  INACTIVO: 'bg-gray-500/20 text-gray-300',
  CAPTURADO: 'bg-blue-500/20 text-blue-300',
}

export default function ExpedientesPage() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateExpedienteInput>({ tipo: 'SOSPECHOSO', alerta_nivel: 'ALTA' })
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    expedienteService.list().then(r => setExpedientes(r.data)).finally(() => setLoading(false))
  }, [])

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setFotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function crear() {
    setCreating(true)
    try {
      const res = await expedienteService.create(form)
      const expediente = res.data
      if (fotoFile) {
        await expedienteService.subirFoto(expediente.id, fotoFile)
        const updated = await expedienteService.getById(expediente.id)
        setExpedientes(prev => [...prev, updated.data])
      } else {
        setExpedientes(prev => [...prev, expediente])
      }
      setShowForm(false)
      setForm({ tipo: 'SOSPECHOSO', alerta_nivel: 'ALTA' })
      setFotoFile(null)
      setFotoPreview(null)
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  async function subirFotoExistente(id: string, file: File) {
    setUploadingId(id)
    try {
      await expedienteService.subirFoto(id, file)
      const updated = await expedienteService.list()
      setExpedientes(updated.data)
    } catch (e) { console.error(e) }
    finally { setUploadingId(null) }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este expediente?')) return
    await expedienteService.delete(id)
    setExpedientes(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/20"><FileText className="text-red-400" size={24} /></div>
          <div>
            <h1 className="text-xl font-semibold text-white">Expedientes</h1>
            <p className="text-sm text-gray-400">Watchlist de perfiles — reconocimiento por patrones de rostros</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg">
          <Plus size={14} />Nuevo Expediente
        </button>
      </div>

      {/* Formulario nuevo expediente */}
      {showForm && (
        <div className="bg-gray-800 rounded-xl p-5 border border-red-500/30">
          <h3 className="text-sm font-semibold text-white mb-4">Crear Expediente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre (opcional)</label>
              <input value={form.nombre ?? ''} onChange={e => setForm(p => ({...p, nombre: e.target.value}))}
                placeholder="Desconocido" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tipo</label>
              <select value={form.tipo} onChange={e => setForm(p => ({...p, tipo: e.target.value as any}))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500">
                <option value="SOSPECHOSO">Sospechoso</option>
                <option value="PERSONA_INTERES">Persona de Interés</option>
                <option value="VEHICULO">Vehículo</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nivel de Alerta</label>
              <select value={form.alerta_nivel} onChange={e => setForm(p => ({...p, alerta_nivel: e.target.value}))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500">
                <option value="CRITICA">Crítica</option>
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Media</option>
                <option value="BAJA">Baja</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Foto del Rostro</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-red-500 transition-colors"
              >
                {fotoPreview
                  ? <img src={fotoPreview} alt="preview" className="h-20 mx-auto rounded object-cover" />
                  : <><Upload size={24} className="mx-auto text-gray-500 mb-1" /><p className="text-xs text-gray-500">Clic para subir foto</p></>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Notas</label>
              <textarea value={form.notas ?? ''} onChange={e => setForm(p => ({...p, notas: e.target.value}))}
                rows={2} placeholder="Información adicional..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-red-500 resize-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={crear} disabled={creating}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-lg">
              {creating ? 'Creando...' : 'Crear Expediente'}
            </button>
            <button onClick={() => { setShowForm(false); setFotoPreview(null) }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista de expedientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {expedientes.length === 0 && !showForm && (
          <div className="col-span-full bg-gray-800 rounded-xl p-12 text-center text-gray-500">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p>No hay expedientes registrados</p>
            <p className="text-xs mt-1">Crea un expediente y sube la foto para activar el reconocimiento</p>
          </div>
        )}
        {expedientes.map(exp => (
          <div key={exp.id} className={`bg-gray-800 rounded-xl border ${NIVEL_COLOR[exp.alerta_nivel] ?? 'border-gray-700'} overflow-hidden`}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-medium text-white">{exp.nombre ?? 'Desconocido'}</p>
                  <p className="text-xs text-gray-400">{exp.tipo.replace('_', ' ')}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_BADGE[exp.estado] ?? 'bg-gray-600 text-gray-300'}`}>
                    {exp.estado}
                  </span>
                </div>
              </div>

              {exp.foto_path ? (
                <div className="mb-3 bg-gray-900 rounded-lg h-24 flex items-center justify-center overflow-hidden">
                  <AlertTriangle size={24} className="text-gray-400" />
                  <span className="text-xs text-gray-500 ml-2">Foto registrada</span>
                </div>
              ) : (
                <div
                  onClick={() => uploadRef.current?.click()}
                  className="mb-3 cursor-pointer border-2 border-dashed border-gray-600 rounded-lg h-20 flex flex-col items-center justify-center hover:border-red-500 transition-colors"
                >
                  {uploadingId === exp.id
                    ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-500 border-t-transparent" />
                    : <><Upload size={16} className="text-gray-500 mb-1" /><p className="text-xs text-gray-500">Subir foto para IA</p></>
                  }
                  <input type="file" accept="image/*" className="hidden" ref={uploadRef}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFotoExistente(exp.id, f) }} />
                </div>
              )}

              {exp.vision_id ? (
                <p className="text-xs text-green-400 mb-2">✓ Embedding generado (ID: {exp.vision_id})</p>
              ) : (
                <p className="text-xs text-orange-400 mb-2">⚠ Sin foto — no activo en reconocimiento</p>
              )}

              {exp.notas && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{exp.notas}</p>}

              <div className="flex gap-2">
                <button onClick={() => eliminar(exp.id)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg bg-red-50 hover:bg-red-500/20 text-red-400 transition-colors">
                  <Trash2 size={12} />Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
