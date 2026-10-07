export interface Cliente {
  id: string
  nombre: string
  celular: string
  identificador: string
  activo: boolean
  created_at: string
  updated_at: string
  comunidades?: ClienteComunidad[]
  bloqueos?: BloqueoCliente[]
}

export interface ClienteComunidad {
  id: string
  cliente_id: string
  comunidad_id: string
  created_at: string
  comunidad?: { id: string; nombre: string; codigo: string }
}

export interface BloqueoCliente {
  id: string
  cliente_id: string
  motivo?: string
  duracion: number
  created_at: string
}

export interface CambioComunidad {
  id: string
  cliente_id: string
  origen_id: string
  destino_id: string
  motivo?: string
  created_at: string
  origen?: { id: string; nombre: string }
  destino?: { id: string; nombre: string }
}
