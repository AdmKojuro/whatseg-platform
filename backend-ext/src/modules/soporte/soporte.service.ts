import * as repo from './soporte.repository'

// ─── Casos ─────────────────────────────────────────────────────────────────────

export async function crearCaso(data: {
  comunidad_id?: string | null
  cliente_nombre: string
  cliente_telefono?: string | null
  idioma: string
  asunto: string
}) {
  return repo.crearCaso(data)
}

export async function listarCasos(filtros: {
  estado?: string
  comunidad_id?: string
  idioma?: string
  q?: string
  limit?: number
  offset?: number
}) {
  return repo.listarCasos(filtros)
}

export async function obtenerCaso(id: string) {
  return repo.obtenerCaso(id)
}

export async function atenderCaso(id: string, atendido_por: string) {
  return repo.actualizarCaso(id, { estado: 'EN_PROCESO', atendido_por })
}

export async function cerrarCaso(id: string, notas?: string) {
  return repo.actualizarCaso(id, { estado: 'CERRADO', notas: notas ?? null })
}

export async function reabrirCaso(id: string) {
  return repo.actualizarCaso(id, { estado: 'ABIERTO' })
}

export async function eliminarCaso(id: string) {
  return repo.eliminarCaso(id)
}

// ─── Mensajes ──────────────────────────────────────────────────────────────────

export async function crearMensaje(data: {
  caso_id: string
  autor: string
  texto_original: string
  idioma_origen: string
  texto_traducido?: string | null
  idioma_destino?: string | null
}) {
  return repo.crearMensaje(data)
}

export async function listarMensajes(caso_id: string) {
  return repo.listarMensajes(caso_id)
}

export async function eliminarMensaje(id: string) {
  return repo.eliminarMensaje(id)
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

export async function statsCasos(comunidad_id?: string | null) {
  return repo.statsCasos(comunidad_id)
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export async function comunidadDelAdmin(admin_id: string): Promise<string | null> {
  return repo.comunidadDelAdmin(admin_id)
}

export async function listarComunidades(admin_id: string | null) {
  return repo.listarComunidades(admin_id)
}
