import { useState, useEffect, useRef } from 'react'
import { MapPin, Loader2, X } from 'lucide-react'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

interface Props {
  value: string
  latitud: string
  longitud: string
  onChange: (direccion: string, latitud: string, longitud: string) => void
  placeholder?: string
}

export function DireccionAutocomplete({ value, latitud, longitud, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync when the parent resets or pre-fills the value
  useEffect(() => { setQuery(value) }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = async (q: string) => {
    if (q.trim().length < 4) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=0`
      const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
      const data: NominatimResult[] = await res.json()
      setResults(data)
      setOpen(data.length > 0)
    } catch {
      setResults([])
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    // propagate text change immediately; keep existing lat/lng until a place is selected
    onChange(q, latitud, longitud)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(q), 450)
  }

  const handleSelect = (result: NominatimResult) => {
    setQuery(result.display_name)
    setOpen(false)
    setResults([])
    onChange(result.display_name, result.lat, result.lon)
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setOpen(false)
    onChange('', '', '')
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? 'Buscar dirección...'}
          autoComplete="off"
          className="w-full pl-9 pr-9 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
          ) : query ? (
            <button type="button" onClick={handleClear} className="text-gray-500 hover:text-gray-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-2xl overflow-hidden">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              onMouseDown={() => handleSelect(r)}
              className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 border-b border-gray-700/60 last:border-0 flex items-start gap-2 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
              <span className="line-clamp-2 leading-snug">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
