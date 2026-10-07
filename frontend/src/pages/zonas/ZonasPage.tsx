import { useState, useEffect } from 'react'
import { zonaService } from '../../services/zona.service'
import { Layers, Plus, Trash2, ChevronRight } from 'lucide-react'
import type { Zona, CreateZonaInput } from '../../types/zona'

export default function ZonasPage() {
  const [zonas, setZonas] = useState<Zona[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateZonaInput>({ nombre: '', codigo: '' })
  const [creating, setCreating] = useState(false)
  const [asignandoId, setAsignandoId] = useState<string | null>(null)
  const [comunidadInput, setComunidadInput] = useState('')

  useEffect(() => {
    zonaService.list().then(r => setZonas(r.data)).finally(() => setLoading(false))
  }, [])

  async function crear() {
    if (!form.nombre || !form.codigo) return
    setCreating(true)
    try {
      const res = await zonaService.create(form)
      setZonas(prev => [...prev, res.data])
      setShowForm(false)
      setForm({ nombre: '', codigo: '' })
    } catch (e) { console.error(e) }
    finally { setCreating(false) }
  }

  async function asignarComunidad(zonaId: string) {
    if (!comunidadInput.trim()) return
    try {
      await zonaService.asignarComunidad(zonaId, comunidadInput.trim())
      const res = await zonaService.list()
      setZonas(res.data)
      setComunidadInput('')
      setAsignandoId(null)
    } catch (e) { console.error(e) }
  }

  async function desasignar(zonaId: string, comunidadId: string) {
    try {
      await zonaService.desasignarComunidad(zonaId, comunidadId)
      const res = await zonaService.list()
      setZonas(res.data)
    } catch (e) { console.error(e) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/20"><Layers className="text-indigo-400" size={24} /></div>
          <div>
            <h1 className="text-xl font-semibold text-white">Zonas de Seguridad</h1>
            <p className="text-sm text-gray-400">Federación de comunidades en zonas para coordinación policial</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg">
          <Plus size={14} />Nueva Zona
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-800 rounded-xl p-5 border border-indigo-500/30">
          <h3 className="text-sm font-semibold text-white mb-4">Crear Zona</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Nombre *', key: 'nombre', placeholder: 'Zona Norte' },
              { label: 'Código *', key: 'codigo', placeholder: 'ZONA-N01' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))}
                  placeholder={f.placeholder}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={crear} disabled={creating}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-lg">
              {creating ? 'Creando...' : 'Crear Zona'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {zonas.length === 0 && (
          <div className="col-span-full bg-gray-800 rounded-xl p-12 text-center text-gray-500">
            <Layers size={40} className="mx-auto mb-3 opacity-30" />
            <p>Sin zonas configuradas</p>
            <p className="text-xs mt-1">Crea zonas para agrupar comunidades colindantes</p>
          </div>
        )}
        {zonas.map(z => (
          <div key={z.id} className="bg-gray-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-white">{z.nombre}</p>
                <p className="text-xs text-gray-500 font-mono">{z.codigo}</p>
              </div>
              <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
                {z._count?.comunidades ?? z.comunidades.length} comunidades
              </span>
            </div>

            {/* Comunidades asignadas */}
            <div className="space-y-1 mb-3">
              {z.comunidades.map(c => (
                <div key={c.comunidad_id} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-gray-300 font-mono truncate">{c.comunidad_id}</span>
                  <button onClick={() => desasignar(z.id, c.comunidad_id)}
                    className="text-gray-500 hover:text-red-400 ml-2"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>

            {/* Asignar comunidad */}
            {asignandoId === z.id ? (
              <div className="flex gap-2">
                <input value={comunidadInput} onChange={e => setComunidadInput(e.target.value)}
                  placeholder="ID de comunidad..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500" />
                <button onClick={() => asignarComunidad(z.id)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg">+</button>
                <button onClick={() => setAsignandoId(null)}
                  className="px-2 py-1.5 bg-gray-700 text-gray-400 text-xs rounded-lg">✕</button>
              </div>
            ) : (
              <button onClick={() => setAsignandoId(z.id)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-dashed border-indigo-500/30">
                <Plus size={12} />Asignar comunidad
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
