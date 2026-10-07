import * as repo from './boton.repository'
import { broadcastEvento, broadcastUpdate } from './boton.ws'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { ENV } from '../../shared/config/env'

const TIPOS_VALIDOS = ['PANICO', 'ALARMA', 'SOS', 'PRUEBA']

// ─── Eventos ─────────────────────────────────────────────────────────────────

export async function crearEvento(data: {
  usuario_id: string
  usuario_nombre: string
  usuario_tipo: string
  comunidad_id?: string | null
  tipo: string
  lat?: number | null
  lng?: number | null
  descripcion?: string | null
}) {
  if (!TIPOS_VALIDOS.includes(data.tipo)) data.tipo = 'PANICO'

  // Si es guardia, buscar su puesto asignado
  let puesto_id: string | null = null
  if (data.usuario_tipo === 'GUARDIA') {
    puesto_id = await repo.getPuestoIdDeGuardia(data.usuario_id)
  }

  const evento = await repo.crearEvento({ ...data, puesto_id })
  broadcastEvento(evento)

  if (data.tipo !== 'PRUEBA') {
    console.log(`[BOTON] ${data.tipo} de ${data.usuario_nombre} (${data.usuario_tipo}) — puesto:${puesto_id ?? 'sin-puesto'} lat:${data.lat} lng:${data.lng}`)
  }

  return evento
}

export async function listarEventos(filtros: {
  estado?: string
  tipo?: string
  comunidad_id?: string
  limit?: number
  offset?: number
}) {
  return repo.listarEventos(filtros)
}

export async function obtenerEvento(id: string) {
  return repo.obtenerEvento(id)
}

export async function atenderEvento(id: string, atendido_por: string) {
  await repo.atenderEvento(id, atendido_por)
  broadcastUpdate(id, { estado: 'ATENDIDO', atendido_por })
}

export async function cerrarEvento(id: string, notas: string) {
  await repo.cerrarEvento(id, notas)
  broadcastUpdate(id, { estado: 'CERRADO', notas })
}

export async function eliminarEvento(id: string) {
  return repo.eliminarEvento(id)
}

// ─── Auth Particulares ────────────────────────────────────────────────────────

export async function loginParticular(telefono: string, password: string) {
  const p = await repo.obtenerParticularPorTelefono(telefono)
  if (!p) throw new Error('Credenciales inválidas')

  const ok = await bcrypt.compare(password, p.password_hash)
  if (!ok) throw new Error('Credenciales inválidas')

  const token = jwt.sign(
    { sub: String(p.id), nombre: p.nombre, rol: 'PARTICULAR', telefono: p.telefono },
    ENV.JWT_SECRET,
    { expiresIn: '30d' }
  )

  return {
    token,
    nombre: p.nombre,
    rol: 'PARTICULAR',
    id: String(p.id),
    telefono: p.telefono,
  }
}

// ─── Particulares CRUD ────────────────────────────────────────────────────────

export async function crearParticular(data: {
  nombre: string
  telefono: string
  password: string
  direccion?: string
}) {
  const password_hash = await bcrypt.hash(data.password, 10)
  return repo.crearParticular({
    nombre: data.nombre,
    telefono: data.telefono,
    password_hash,
    direccion: data.direccion,
  })
}

export async function listarParticulares() {
  return repo.listarParticulares()
}

export async function actualizarParticular(id: string, data: {
  nombre?: string
  telefono?: string
  password?: string
  direccion?: string | null
  activo?: boolean
}) {
  const updateData: any = { ...data }
  if (data.password) {
    updateData.password_hash = await bcrypt.hash(data.password, 10)
    delete updateData.password
  }
  return repo.actualizarParticular(id, updateData)
}

export async function eliminarParticular(id: string) {
  return repo.eliminarParticular(id)
}

// ─── Datos de mapa ────────────────────────────────────────────────────────────

export async function comunidadDelAdmin(admin_id: string): Promise<string | null> {
  return repo.comunidadDelAdmin(admin_id)
}

export async function mapaData(comunidad_id?: string | null) {
  return repo.mapaData(comunidad_id)
}
