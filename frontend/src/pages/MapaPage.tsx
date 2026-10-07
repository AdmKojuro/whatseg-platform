import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Building2 } from 'lucide-react'
import { comunidadService } from '../services/comunidad.service'
import type { Comunidad } from '../types/comunidad'

// Custom marker with WhatsEg favicon inside
function makeMarker(activa: boolean) {
  const color = activa ? '#16a34a' : '#6b7280'
  const html = `
    <div style="position:relative;width:40px;height:50px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50" style="display:block;">
        <path d="M20 0C8.95 0 0 8.95 0 20c0 16 20 30 20 30S40 36 40 20C40 8.95 31.05 0 20 0z"
          fill="${color}" stroke="white" stroke-width="1.5"/>
      </svg>
      <img src="/whatseg_favicon.webp"
        style="position:absolute;top:5px;left:50%;transform:translateX(-50%);width:24px;height:24px;object-fit:contain;border-radius:3px;" />
    </div>`
  return L.divIcon({
    html,
    className: '',
    iconSize: [40, 50],
    iconAnchor: [20, 50],
    popupAnchor: [0, -52],
  })
}

const DEFAULT_CENTER: [number, number] = [4.7110, -74.0721]
const DEFAULT_ZOOM = 6

export function MapaPage() {
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    comunidadService.list()
      .then(r => setComunidades(r.data))
      .finally(() => setLoading(false))
  }, [])

  const conCoordenadas = comunidades.filter(c => c.latitud && c.longitud)

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const center: [number, number] =
    conCoordenadas.length > 0
      ? [
          conCoordenadas.reduce((s, c) => s + c.latitud!, 0) / conCoordenadas.length,
          conCoordenadas.reduce((s, c) => s + c.longitud!, 0) / conCoordenadas.length,
        ]
      : DEFAULT_CENTER

  const zoom = conCoordenadas.length > 0 ? 13 : DEFAULT_ZOOM

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Mapa de Comunidades</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Building2 size={16} />
          <span>{conCoordenadas.length} / {comunidades.length} con coordenadas</span>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden" style={{ height: '600px' }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {conCoordenadas.map(c => (
            <Marker
              key={c.id}
              position={[c.latitud!, c.longitud!]}
              icon={makeMarker(!!c.activa)}
            >
              <Tooltip
                permanent
                direction="top"
                offset={[0, -46]}
                className="leaflet-community-label"
              >
                {c.nombre}
              </Tooltip>
              <Popup>
                <div className="min-w-[160px]">
                  <p className="font-semibold text-white text-sm">{c.nombre}</p>
                  {c.codigo && <p className="text-xs text-gray-500 mt-0.5">Código: {c.codigo}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {c.latitud!.toFixed(6)}, {c.longitud!.toFixed(6)}
                  </p>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.activa ? 'bg-emerald-100 text-emerald-400' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {c.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {conCoordenadas.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm text-amber-400 flex items-center gap-2">
          <MapPin size={16} className="shrink-0" />
          Ninguna comunidad tiene coordenadas registradas. Edita una comunidad para añadir latitud y longitud.
        </div>
      )}

      {comunidades.filter(c => !c.latitud || !c.longitud).length > 0 && conCoordenadas.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <p className="text-sm font-medium text-gray-300 mb-2">
            Sin coordenadas ({comunidades.filter(c => !c.latitud || !c.longitud).length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {comunidades.filter(c => !c.latitud || !c.longitud).map(c => (
              <span key={c.id} className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded">
                {c.nombre}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
