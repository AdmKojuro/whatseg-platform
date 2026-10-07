import { useState, useEffect } from 'react'
import { federacionService, comportamientoService } from '../../services/federacion.service'
import type { FederacionPar, PatronAnonimo, AlertaComportamiento } from '../../types/federacion'
import { Globe, Link2, AlertCircle, Eye, CheckCircle, Trash2, Plus, Shield, Activity } from 'lucide-react'

type Tab = 'alertas' | 'patrones' | 'pares'

export default function FederacionPage() {
  const [tab, setTab] = useState<Tab>('alertas')
  const [pares, setPares] = useState<FederacionPar[]>([])
  const [patrones, setPatrones] = useState<PatronAnonimo[]>([])
  const [alertas, setAlertas] = useState<AlertaComportamiento[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuevoPar, setShowNuevoPar] = useState(false)
  const [form, setForm] = useState({ nombre: '', comunidad_local_id: '', endpoint_remoto: '' })
  const [filterTipo, setFilterTipo] = useState<string>('')

  const cargar = async () => {
    setLoading(true)
    try {
      const [pRes, aRes] = await Promise.all([
        federacionService.listarPares(),
        comportamientoService.listar({ page: 1, limit: 50 }),
      ])
      setPares(pRes.data)
      setAlertas(aRes.data.data)
    } finally {
      setLoading(false)
    }
  }

  const cargarPatrones = async () => {
    const res = await federacionService.listarPatrones()
    setPatrones(res.data)
  }

  useEffect(() => {
    cargar()
  }, [])

  useEffect(() => {
    if (tab === 'patrones') cargarPatrones()
  }, [tab])

  const crearPar = async () => {
    if (!form.nombre || !form.comunidad_local_id || !form.endpoint_remoto) return
    await federacionService.crearPar(form)
    setForm({ nombre: '', comunidad_local_id: '', endpoint_remoto: '' })
    setShowNuevoPar(false)
    cargar()
  }

  const togglePar = async (id: string, activa: boolean) => {
    await federacionService.activarPar(id, !activa)
    cargar()
  }

  const eliminarPar = async (id: string) => {
    if (!confirm('¿Eliminar este par de federación?')) return
    await federacionService.eliminarPar(id)
    cargar()
  }

  const reconocer = async (id: string) => {
    await comportamientoService.reconocer(id)
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, reconocido: true, reconocido_at: new Date().toISOString() } : a))
  }

  const tiposComportamiento = ['MERODEO', 'VIGILANCIA_ESTACIONARIA', 'INTERCAMBIO_RAPIDO']
  const alertasFiltradas = filterTipo ? alertas.filter(a => a.tipo === filterTipo) : alertas

  const tipoLabel: Record<string, string> = {
    MERODEO: 'Merodeo',
    VIGILANCIA_ESTACIONARIA: 'Vigilancia estacionaria',
    INTERCAMBIO_RAPIDO: 'Intercambio rápido',
  }

  const tipoColor: Record<string, string> = {
    MERODEO: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    VIGILANCIA_ESTACIONARIA: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    INTERCAMBIO_RAPIDO: 'text-red-400 bg-red-50 border-red-200',
  }

  const pendientes = alertas.filter(a => !a.reconocido).length
  const paresActivos = pares.filter(p => p.activa).length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20"><Globe className="text-blue-400" size={24} /></div>
          <div>
            <h1 className="text-xl font-semibold text-white">Inteligencia Federada</h1>
            <p className="text-sm text-gray-400">Análisis conductual · Patrones anónimos inter-comunidad</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendientes > 0 && (
            <span className="px-2 py-1 bg-red-50 text-red-400 text-xs font-bold rounded-full border border-red-500/30">
              {pendientes} pendiente{pendientes > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pares activos" value={paresActivos} total={pares.length} icon={<Link2 size={18} />} color="blue" />
        <StatCard label="Patrones compartidos" value={patrones.length} icon={<Shield size={18} />} color="purple" />
        <StatCard label="Alertas conductuales" value={alertas.length} icon={<Activity size={18} />} color="orange" />
        <StatCard label="Sin reconocer" value={pendientes} icon={<AlertCircle size={18} />} color="red" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 w-fit">
        {([['alertas', 'Alertas Conductuales'], ['patrones', 'Patrones Anónimos'], ['pares', 'Pares Federados']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Alertas Conductuales */}
      {tab === 'alertas' && (
        <div className="space-y-4">
          {/* Filtro tipo */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Filtrar:</span>
            <button onClick={() => setFilterTipo('')} className={`px-3 py-1 rounded-full text-xs border transition-all ${!filterTipo ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              Todos
            </button>
            {tiposComportamiento.map(t => (
              <button key={t} onClick={() => setFilterTipo(t === filterTipo ? '' : t)}
                className={`px-3 py-1 rounded-full text-xs border transition-all ${filterTipo === t ? tipoColor[t] + ' border-current' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                {tipoLabel[t]}
              </button>
            ))}
          </div>

          {alertasFiltradas.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-10 text-center">
              <Activity className="mx-auto text-gray-400 mb-3" size={32} />
              <p className="text-gray-500 text-sm">No hay alertas conductuales</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alertasFiltradas.map(a => (
                <div key={a.id} className={`bg-gray-800 rounded-xl p-4 flex items-start gap-4 border transition-all ${a.reconocido ? 'opacity-50 border-gray-700' : 'border-gray-600'}`}>
                  <div className={`p-2 rounded-lg border ${tipoColor[a.tipo] || 'text-gray-400 bg-gray-700 border-gray-600'}`}>
                    <Eye size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${tipoColor[a.tipo] || ''}`}>
                        {tipoLabel[a.tipo] || a.tipo}
                      </span>
                      {a.reconocido && <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle size={10} /> Reconocido</span>}
                    </div>
                    <p className="text-sm text-gray-300">{a.descripcion}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>Cam: {a.camera_id.slice(0, 8)}...</span>
                      {a.duracion_seg && <span>Duración: {Math.round(a.duracion_seg / 60)}min</span>}
                      <span>{new Date(a.created_at).toLocaleString('es-CO')}</span>
                    </div>
                  </div>
                  {!a.reconocido && (
                    <button onClick={() => reconocer(a.id)}
                      className="flex-shrink-0 px-3 py-1.5 bg-gray-700 hover:bg-green-700/40 text-gray-300 hover:text-green-400 rounded-lg text-xs font-medium transition-all flex items-center gap-1">
                      <CheckCircle size={12} /> Reconocer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Patrones Anónimos */}
      {tab === 'patrones' && (
        <div className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
            <Shield className="text-blue-400 flex-shrink-0" size={16} />
            <p className="text-xs text-blue-300">
              Los patrones se comparten aplicando <strong>privacidad diferencial (ε=1.0, ruido de Laplace)</strong> sobre los embeddings.
              Es matemáticamente imposible reconstruir la identidad original. Solo la similitud entre vectores es observable.
            </p>
          </div>

          {patrones.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-10 text-center">
              <Globe className="mx-auto text-gray-400 mb-3" size={32} />
              <p className="text-gray-500 text-sm">No hay patrones compartidos aún</p>
              <p className="text-gray-400 text-xs mt-1">Los patrones se reciben cuando las comunidades federadas detectan perfiles de interés</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {patrones.map(p => (
                <div key={p.id} className="bg-gray-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-400">PAT-{p.id.slice(0, 8).toUpperCase()}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${p.nivel_alerta === 'ALTA' ? 'text-red-400 bg-red-50 border-red-200' : p.nivel_alerta === 'MEDIA' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' : 'text-green-400 bg-green-500/10 border-green-500/20'}`}>
                        {p.nivel_alerta}
                      </span>
                      {p.reportes > 1 && <span className="text-xs text-orange-400 font-bold">{p.reportes} reportes</span>}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Origen:</span>
                      <span className="text-gray-400 font-mono">{p.federacion_id.slice(0, 12)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tipo:</span>
                      <span className="text-gray-400">{p.tipo_patron}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Visto:</span>
                      <span className="text-gray-400">{new Date(p.created_at).toLocaleDateString('es-CO')}</span>
                    </div>
                    {p.ultima_similitud && (
                      <div className="flex justify-between">
                        <span>Similitud local:</span>
                        <span className={`font-bold ${p.ultima_similitud > 0.8 ? 'text-red-400' : p.ultima_similitud > 0.6 ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {Math.round(p.ultima_similitud * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Visualización del vector ruidoso (primeras 16 dims) */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400">Vector diferencial (16/{Array.isArray(p.vector_ruidoso) ? p.vector_ruidoso.length : '?'} dims):</p>
                    <div className="flex gap-0.5 h-6 items-end">
                      {(Array.isArray(p.vector_ruidoso) ? p.vector_ruidoso.slice(0, 16) : []).map((v: number, i: number) => (
                        <div key={i} className="flex-1 bg-blue-600/40 rounded-sm" style={{ height: `${Math.abs(v) * 24}px`, maxHeight: '24px' }} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Pares Federados */}
      {tab === 'pares' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowNuevoPar(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all">
              <Plus size={16} /> Nuevo Par
            </button>
          </div>

          {showNuevoPar && (
            <div className="bg-gray-800 rounded-xl p-5 space-y-4 border border-blue-500/20">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Link2 size={14} className="text-blue-400" /> Conectar con comunidad remota
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Nombre (ej: Conjunto Norte)" className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                <input value={form.comunidad_local_id} onChange={e => setForm(f => ({ ...f, comunidad_local_id: e.target.value }))}
                  placeholder="ID comunidad local" className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                <input value={form.endpoint_remoto} onChange={e => setForm(f => ({ ...f, endpoint_remoto: e.target.value }))}
                  placeholder="https://ws2.example.com:3068" className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowNuevoPar(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm">
                  Cancelar
                </button>
                <button onClick={crearPar} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                  Crear par
                </button>
              </div>
            </div>
          )}

          {pares.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-10 text-center">
              <Globe className="mx-auto text-gray-400 mb-3" size={32} />
              <p className="text-gray-500 text-sm">No hay pares federados configurados</p>
              <p className="text-gray-400 text-xs mt-1">Conecta con otras comunidades para compartir patrones de amenazas de forma anónima</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pares.map(par => (
                <div key={par.id} className="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${par.activa ? 'bg-green-500/20' : 'bg-gray-700'}`}>
                    <Link2 className={par.activa ? 'text-green-400' : 'text-gray-500'} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{par.nombre}</p>
                    <p className="text-xs text-gray-500 truncate">{par.endpoint_remoto}</p>
                    <p className="text-xs text-gray-400">{par.patrones_recibidos} patrones recibidos · {par.alertas_compartidas} alertas compartidas</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${par.activa ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-gray-500 bg-gray-700 border-gray-600'}`}>
                      {par.activa ? 'Activo' : 'Inactivo'}
                    </span>
                    <button onClick={() => togglePar(par.id, par.activa)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-all">
                      {par.activa ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => eliminarPar(par.id)}
                      className="p-1.5 bg-gray-700 hover:bg-red-700/40 text-gray-400 hover:text-red-400 rounded-lg transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, total, icon, color }: {
  label: string; value: number; total?: number; icon: React.ReactNode; color: string
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    orange: 'bg-orange-500/20 text-orange-400',
    red: 'bg-red-50 text-red-400',
  }
  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-2">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>{icon}</div>
      <p className="text-2xl font-bold text-white">{value}{total !== undefined ? <span className="text-sm text-gray-500">/{total}</span> : ''}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}
