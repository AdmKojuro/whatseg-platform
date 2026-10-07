import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Casos ────────────────────────────────────────────────────────────────────

export async function crearCaso(data: {
  comunidad_id?: string | null
  cliente_nombre: string
  cliente_telefono?: string | null
  idioma: string
  asunto: string
}) {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO soporte_casos (comunidad_id, cliente_nombre, cliente_telefono, idioma, asunto)
    VALUES (${data.comunidad_id ?? null}, ${data.cliente_nombre}, ${data.cliente_telefono ?? null},
            ${data.idioma}, ${data.asunto})
    RETURNING *
  `
  return rows[0]
}

export async function listarCasos(filtros: {
  estado?: string
  comunidad_id?: string
  idioma?: string
  q?: string
  limit?: number
  offset?: number
}) {
  const { estado, comunidad_id, idioma, q, limit = 50, offset = 0 } = filtros
  const search = q ? `%${q}%` : null

  const rows: any[] = await prisma.$queryRaw`
    SELECT c.*,
           (SELECT COUNT(*)::int FROM soporte_mensajes m WHERE m.caso_id = c.id) AS total_mensajes
    FROM soporte_casos c
    WHERE
      (${estado ?? null}::text IS NULL OR c.estado = ${estado ?? null})
      AND (${comunidad_id ?? null}::text IS NULL OR c.comunidad_id = ${comunidad_id ?? null} OR c.comunidad_id IS NULL)
      AND (${idioma ?? null}::text IS NULL OR c.idioma = ${idioma ?? null})
      AND (${search}::text IS NULL OR c.cliente_nombre ILIKE ${search} OR c.asunto ILIKE ${search})
    ORDER BY c.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const total: any[] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM soporte_casos c
    WHERE
      (${estado ?? null}::text IS NULL OR c.estado = ${estado ?? null})
      AND (${comunidad_id ?? null}::text IS NULL OR c.comunidad_id = ${comunidad_id ?? null} OR c.comunidad_id IS NULL)
      AND (${idioma ?? null}::text IS NULL OR c.idioma = ${idioma ?? null})
      AND (${search}::text IS NULL OR c.cliente_nombre ILIKE ${search} OR c.asunto ILIKE ${search})
  `

  return { items: rows, total: total[0]?.cnt ?? 0 }
}

export async function obtenerCaso(id: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT c.*,
           (SELECT COUNT(*)::int FROM soporte_mensajes m WHERE m.caso_id = c.id) AS total_mensajes
    FROM soporte_casos c
    WHERE c.id = ${id}::uuid
  `
  return rows[0] ?? null
}

export async function actualizarCaso(id: string, data: {
  estado?: string
  atendido_por?: string | null
  notas?: string | null
}) {
  return prisma.$executeRaw`
    UPDATE soporte_casos SET
      estado       = COALESCE(${data.estado ?? null},       estado),
      atendido_por = CASE WHEN ${data.atendido_por !== undefined}
                     THEN ${data.atendido_por ?? null} ELSE atendido_por END,
      notas        = CASE WHEN ${data.notas !== undefined}
                     THEN ${data.notas ?? null} ELSE notas END,
      updated_at   = NOW()
    WHERE id = ${id}::uuid
  `
}

export async function eliminarCaso(id: string) {
  return prisma.$executeRaw`DELETE FROM soporte_casos WHERE id = ${id}::uuid`
}

// ─── Mensajes ─────────────────────────────────────────────────────────────────

export async function crearMensaje(data: {
  caso_id: string
  autor: string
  texto_original: string
  idioma_origen: string
  texto_traducido?: string | null
  idioma_destino?: string | null
}) {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO soporte_mensajes
      (caso_id, autor, texto_original, idioma_origen, texto_traducido, idioma_destino)
    VALUES
      (${data.caso_id}::uuid, ${data.autor}, ${data.texto_original},
       ${data.idioma_origen}, ${data.texto_traducido ?? null}, ${data.idioma_destino ?? null})
    RETURNING *
  `
  // Actualizar updated_at del caso
  await prisma.$executeRaw`
    UPDATE soporte_casos SET updated_at = NOW() WHERE id = ${data.caso_id}::uuid
  `
  return rows[0]
}

export async function listarMensajes(caso_id: string) {
  return prisma.$queryRaw<any[]>`
    SELECT * FROM soporte_mensajes
    WHERE caso_id = ${caso_id}::uuid
    ORDER BY created_at ASC
  `
}

export async function eliminarMensaje(id: string) {
  return prisma.$executeRaw`DELETE FROM soporte_mensajes WHERE id = ${id}::uuid`
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

export async function statsCasos(comunidad_id?: string | null) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int                                          AS total,
      COUNT(*) FILTER (WHERE estado = 'ABIERTO')::int        AS abiertos,
      COUNT(*) FILTER (WHERE estado = 'EN_PROCESO')::int     AS en_proceso,
      COUNT(*) FILTER (WHERE estado = 'CERRADO')::int        AS cerrados,
      COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)::int AS hoy
    FROM soporte_casos
    WHERE (${comunidad_id ?? null}::text IS NULL OR comunidad_id = ${comunidad_id ?? null} OR comunidad_id IS NULL)
  `
  return rows[0] ?? {}
}

// ─── Buscar caso activo por teléfono (para WhatsApp) ──────────────────────────

export async function obtenerCasoActivoPorTelefono(telefono: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT * FROM soporte_casos
    WHERE cliente_telefono = ${telefono}
      AND estado IN ('ABIERTO', 'EN_PROCESO')
    ORDER BY updated_at DESC
    LIMIT 1
  `
  return rows[0] ?? null
}

// ─── Comunidad del admin ───────────────────────────────────────────────────────

export async function comunidadDelAdmin(admin_id: string): Promise<string | null> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT comunidad_id FROM admins_comunidades
    WHERE admin_id = ${admin_id}
    LIMIT 1
  `
  return rows[0]?.comunidad_id ?? null
}

// ─── Comunidades (para filtro) ─────────────────────────────────────────────────

export async function listarComunidades(admin_id: string | null) {
  if (admin_id) {
    // ADMIN: solo sus comunidades asignadas
    return prisma.$queryRaw<any[]>`
      SELECT c.id, c.nombre, c.codigo
      FROM comunidades c
      JOIN admins_comunidades ac ON ac.comunidad_id = c.id
      WHERE ac.admin_id::text = ${admin_id} AND c.activa = true
      ORDER BY c.nombre
    `
  }
  // SUPERADMIN / SUPERVISOR: todas
  return prisma.$queryRaw<any[]>`
    SELECT id, nombre, codigo FROM comunidades
    WHERE activa = true
    ORDER BY nombre
  `
}
