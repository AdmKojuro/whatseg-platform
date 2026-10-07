import { useState, useEffect } from 'react'
import { visitaService } from '../../services/visita.service'
import { QrCode, Plus, Clock, CheckCircle2, XCircle, Download } from 'lucide-react'
import type { Visita, CreateVisitaInput } from '../../types/visita'

function EstadoBadge({ visita }: { visita: Visita }) {
  const ahora = new Date()
  const hasta = new Date(visita.valido_hasta)
  if (visita.qr_usado) return <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={10} />Usado</span>
  if (ahora > hasta) return <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full flex items-center gap-1"><XCircle size={10} />Expirado</span>
  return <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={10} />Activo</span>
}

export default function VisitasPage() {
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [qrModal, setQrModal] = useState<{ qr: string; nombre: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<CreateVisitaInput>({
    nombre: '',
    valido_desde: new Date().toISOString().slice(0, 16),
    valido_hasta: new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 16),
    comunidad_id: '',
  })

  useEffect(() => {
    visitaService.list().then(r => setVisitas(r.data)).finally(() => setLoading(false))
  }, [])

  async function crear() {
    if (!form.nombre || !form.comunidad_id) return
    setCreating(true)
    try {
      const res = await visitaService.create(form)
      const visita = res.data
      setVisitas(prev => [visita, ...prev])
      setShowForm(false)
      if (visita.qr_base64) {
        setQrModal({ qr: visita.qr_base64, nombre: visita.nombre })
      }
    } catch (e) { console.error(e) }
    finally { setCreating(false) }
  }

  async function mostrarQr(id: string, nombre: string) {
    try {
      const res = await visitaService.getQr(id)
      setQrModal({ qr: res.data.qr_base64, nombre })
    } catch (e) { console.error(e) }
  }

  function descargarQr(qr: string, nombre: string) {
    const a = document.createElement('a')
    a.href = qr
    a.download = `qr_visita_${nombre.replace(/\s+/g, '_')}.png`
    a.click()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/20"><QrCode className="text-green-400" size={24} /></div>
          <div>
            <h1 className="text-xl font-semibold text-white">Control de Visitas</h1>
            <p className="text-sm text-gray-400">Gestión de acceso por código QR</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg">
          <Plus size={14} />Nueva Visita
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-gray-800 rounded-xl p-5 border border-green-500/30">
          <h3 className="text-sm font-semibold text-white mb-4">Registrar Visita</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Nombre del visitante *', key: 'nombre', placeholder: 'Nombre completo' },
              { label: 'Número de documento', key: 'documento', placeholder: 'Cédula / Pasaporte' },
              { label: 'ID Comunidad *', key: 'comunidad_id', placeholder: 'UUID de la comunidad' },
              { label: 'Motivo de la visita', key: 'motivo', placeholder: 'Ej: Reunión, Entrega' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                <input value={(form as any)[f.key] ?? ''}
                  onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))}
                  placeholder={f.placeholder}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-green-500" />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Válido desde</label>
              <input type="datetime-local" value={form.valido_desde}
                onChange={e => setForm(p => ({...p, valido_desde: e.target.value}))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Válido hasta</label>
              <input type="datetime-local" value={form.valido_hasta}
                onChange={e => setForm(p => ({...p, valido_hasta: e.target.value}))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={crear} disabled={creating || !form.nombre || !form.comunidad_id}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded-lg">
              {creating ? 'Generando QR...' : 'Crear y Generar QR'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">Cancelar</button>
          </div>
        </div>
      )}

      {/* Modal QR */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setQrModal(null)}>
          <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <QrCode className="mx-auto text-green-400 mb-3" size={32} />
            <h3 className="text-white font-semibold mb-1">QR de Acceso</h3>
            <p className="text-sm text-gray-400 mb-4">{qrModal.nombre}</p>
            <img src={qrModal.qr} alt="QR" className="mx-auto w-48 h-48 rounded-lg" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => descargarQr(qrModal.qr, qrModal.nombre)}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg">
                <Download size={14} />Descargar
              </button>
              <button onClick={() => setQrModal(null)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de visitas */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/50">
              <tr className="text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">Visitante</th>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Motivo</th>
                <th className="px-4 py-3 font-medium">Válido hasta</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {visitas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Sin visitas registradas</td></tr>
              )}
              {visitas.map(v => (
                <tr key={v.id} className="text-gray-300 hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{v.nombre}</td>
                  <td className="px-4 py-3 text-gray-400">{v.documento ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{v.motivo ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(v.valido_hasta).toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3"><EstadoBadge visita={v} /></td>
                  <td className="px-4 py-3">
                    {!v.qr_usado && (
                      <button onClick={() => mostrarQr(v.id, v.nombre)}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                        <QrCode size={12} />Ver QR
                      </button>
                    )}
                    {v.usado_at && <p className="text-xs text-gray-500">Usado: {new Date(v.usado_at).toLocaleString('es-CO')}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
