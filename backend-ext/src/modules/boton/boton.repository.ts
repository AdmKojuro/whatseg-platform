import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Eventos de pánico ────────────────────────────────────────────────────────

export async function crearEvento(data: {
  usuario_id: string
  usuario_nombre: string
  usuario_tipo: string
  comunidad_id?: string | null
  puesto_id?: string | null
  tipo: string
  lat?: number | null
  lng?: number | null
  descripcion?: string | null
}) {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO eventos_panico
      (usuario_id, usuario_nombre, usuario_tipo, comunidad_id, puesto_id, tipo, lat, lng, descripcion)
    VALUES
      (${data.usuario_id}, ${data.usuario_nombre}, ${data.usuario_tipo},
       ${data.comunidad_id ?? null}, ${data.puesto_id ?? null}, ${data.tipo},
       ${data.lat ?? null}, ${data.lng ?? null}, ${data.descripcion ?? null})
    RETURNING *
  `
  return rows[0]
}

export async function getPuestoIdDeGuardia(usuario_id: string): Promise<string | null> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT puesto_id FROM rondas_usuarios
    WHERE id = ${usuario_id} AND activo = true
    LIMIT 1
  `
  return rows[0]?.puesto_id ?? null
}

export async function listarEventos(filtros: {
  estado?: string
  tipo?: string
  comunidad_id?: string
  limit?: number
  offset?: number
}) {
  const { estado, tipo, comunidad_id, limit = 50, offset = 0 } = filtros

  const rows: any[] = await prisma.$queryRaw`
    SELECT * FROM eventos_panico
    WHERE
      (${estado ?? null}::text IS NULL OR estado = ${estado ?? null})
      AND (${tipo ?? null}::text IS NULL OR tipo = ${tipo ?? null})
      AND (${comunidad_id ?? null}::text IS NULL OR comunidad_id = ${comunidad_id ?? null})
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const total: any[] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM eventos_panico
    WHERE
      (${estado ?? null}::text IS NULL OR estado = ${estado ?? null})
      AND (${tipo ?? null}::text IS NULL OR tipo = ${tipo ?? null})
      AND (${comunidad_id ?? null}::text IS NULL OR comunidad_id = ${comunidad_id ?? null})
  `

  return { items: rows, total: total[0]?.cnt ?? 0 }
}

export async function obtenerEvento(id: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT * FROM eventos_panico WHERE id = ${id}::uuid
  `
  return rows[0] ?? null
}

export async function atenderEvento(id: string, atendido_por: string) {
  return prisma.$executeRaw`
    UPDATE eventos_panico
    SET estado = 'ATENDIDO', atendido_por = ${atendido_por}, atendido_at = NOW()
    WHERE id = ${id}::uuid AND estado = 'ACTIVO'
  `
}

export async function cerrarEvento(id: string, notas: string) {
  return prisma.$executeRaw`
    UPDATE eventos_panico
    SET estado = 'CERRADO', notas = ${notas},
        atendido_at = COALESCE(atendido_at, NOW())
    WHERE id = ${id}::uuid
  `
}

export async function eliminarEvento(id: string) {
  return prisma.$executeRaw`DELETE FROM eventos_panico WHERE id = ${id}::uuid`
}

// ─── Particulares ─────────────────────────────────────────────────────────────

export async function crearParticular(data: {
  nombre: string
  telefono: string
  password_hash: string
  direccion?: string | null
}) {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO particulares (nombre, telefono, password_hash, direccion)
    VALUES (${data.nombre}, ${data.telefono}, ${data.password_hash}, ${data.direccion ?? null})
    RETURNING id, nombre, telefono, direccion, activo, created_at
  `
  return rows[0]
}

export async function listarParticulares() {
  return prisma.$queryRaw<any[]>`
    SELECT id, nombre, telefono, direccion, activo, created_at
    FROM particulares
    ORDER BY created_at DESC
  `
}

export async function obtenerParticularPorTelefono(telefono: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT * FROM particulares WHERE telefono = ${telefono} AND activo = true
  `
  return rows[0] ?? null
}

export async function obtenerParticularPorId(id: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT id, nombre, telefono, direccion, activo, created_at
    FROM particulares WHERE id = ${id}::uuid
  `
  return rows[0] ?? null
}

export async function actualizarParticular(id: string, data: {
  nombre?: string
  telefono?: string
  password_hash?: string
  direccion?: string | null
  activo?: boolean
}) {
  return prisma.$executeRaw`
    UPDATE particulares SET
      nombre        = COALESCE(${data.nombre ?? null},        nombre),
      telefono      = COALESCE(${data.telefono ?? null},      telefono),
      password_hash = COALESCE(${data.password_hash ?? null}, password_hash),
      direccion     = CASE WHEN ${data.direccion !== undefined}
                       THEN ${data.direccion ?? null} ELSE direccion END,
      activo        = CASE WHEN ${data.activo !== undefined}
                       THEN ${data.activo ?? true}   ELSE activo    END
    WHERE id = ${id}::uuid
  `
}

export async function eliminarParticular(id: string) {
  return prisma.$executeRaw`DELETE FROM particulares WHERE id = ${id}::uuid`
}

// ─── Comunidad del admin (via admins_comunidades) ────────────────────────────

export async function comunidadDelAdmin(admin_id: string): Promise<string | null> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT comunidad_id FROM admins_comunidades
    WHERE admin_id = ${admin_id}
    LIMIT 1
  `
  return rows[0]?.comunidad_id ?? null
}

// ─── Datos de mapa: comunidades + puestos activos ────────────────────────────

export async function mapaData(comunidad_id?: string | null) {
  const comunidades: any[] = comunidad_id
    ? await prisma.$queryRaw`
        SELECT id, nombre, codigo, direccion, latitud, longitud
        FROM comunidades
        WHERE activa = true AND latitud IS NOT NULL AND longitud IS NOT NULL
          AND id = ${comunidad_id}
        ORDER BY nombre
      `
    : await prisma.$queryRaw`
        SELECT id, nombre, codigo, direccion, latitud, longitud
        FROM comunidades
        WHERE activa = true AND latitud IS NOT NULL AND longitud IS NOT NULL
        ORDER BY nombre
      `

  const puestos: any[] = comunidad_id
    ? await prisma.$queryRaw`
        SELECT p.id, p.nombre, p.descripcion, p.direccion, p.latitud, p.longitud, p.comunidad_id,
               c.nombre AS comunidad_nombre
        FROM puestos p
        JOIN comunidades c ON c.id = p.comunidad_id
        WHERE p.activo = true AND p.latitud IS NOT NULL AND p.longitud IS NOT NULL
          AND p.comunidad_id = ${comunidad_id}
        ORDER BY c.nombre, p.nombre
      `
    : await prisma.$queryRaw`
        SELECT p.id, p.nombre, p.descripcion, p.direccion, p.latitud, p.longitud, p.comunidad_id,
               c.nombre AS comunidad_nombre
        FROM puestos p
        JOIN comunidades c ON c.id = p.comunidad_id
        WHERE p.activo = true AND p.latitud IS NOT NULL AND p.longitud IS NOT NULL
        ORDER BY c.nombre, p.nombre
      `

  return { comunidades, puestos }
}
