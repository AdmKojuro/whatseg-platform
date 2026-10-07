import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── ReporteIA CRUD ──────────────────────────────────────────────────────────

export async function crearReporteIA(reporte_id: string) {
  return prisma.$executeRaw`
    INSERT INTO reportes_ia (id, reporte_id, estado)
    VALUES (gen_random_uuid(), ${reporte_id}::uuid, 'PENDIENTE')
    ON CONFLICT (reporte_id) DO NOTHING
  `
}

export async function actualizarReporteIA(reporte_id: string, data: {
  transcripcion?: string
  tipo_ia?: string
  resumen?: string
  confianza?: number
  estado: string
  error?: string
  respuesta_ia?: string
}) {
  return prisma.$executeRaw`
    UPDATE reportes_ia
    SET
      transcripcion  = ${data.transcripcion ?? null},
      tipo_ia        = ${data.tipo_ia ?? null},
      resumen        = ${data.resumen ?? null},
      confianza      = ${data.confianza ?? null},
      estado         = ${data.estado},
      error          = ${data.error ?? null},
      respuesta_ia   = ${data.respuesta_ia ?? null},
      procesado_at   = NOW()
    WHERE reporte_id = ${reporte_id}::uuid
  `
}

export async function obtenerReporteIA(reporte_id: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT * FROM reportes_ia WHERE reporte_id = ${reporte_id}::uuid
  `
  return rows[0] ?? null
}

export async function reportesPendientes(limite = 5) {
  return prisma.$queryRaw<any[]>`
    SELECT r.id, r.archivo_path, r.formato, r.comunidad_id
    FROM reportes_ptt r
    LEFT JOIN reportes_ia ia ON ia.reporte_id = r.id::uuid
    WHERE ia.id IS NULL
      OR ia.estado = 'PENDIENTE'
    ORDER BY r.created_at DESC
    LIMIT ${limite}
  `
}

// ─── Reportes con datos IA para el panel ─────────────────────────────────────

export async function listarReportesConIA(filtros: {
  comunidad_id?: string
  guardia_id?: string
  limit?: number
  offset?: number
}) {
  const { comunidad_id, guardia_id, limit = 20, offset = 0 } = filtros

  const rows: any[] = await prisma.$queryRaw`
    SELECT
      r.id, r.comunidad_id, r.guardia_id, r.guardia_nombre,
      r.tipo, r.descripcion, r.duracion_seg, r.estado,
      r.destinatario, r.puesto_id, r.created_at,
      ia.transcripcion, ia.tipo_ia, ia.resumen, ia.confianza,
      ia.estado AS ia_estado, ia.respuesta_ia
    FROM reportes_ptt r
    LEFT JOIN reportes_ia ia ON ia.reporte_id = r.id::uuid
    WHERE
      (${comunidad_id}::text IS NULL OR r.comunidad_id = ${comunidad_id})
      AND (${guardia_id}::text IS NULL OR r.guardia_id = ${guardia_id} OR r.tipo = 'COMUNICADO')
    ORDER BY r.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const total: any[] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM reportes_ptt r
    WHERE
      (${comunidad_id}::text IS NULL OR r.comunidad_id = ${comunidad_id})
      AND (${guardia_id}::text IS NULL OR r.guardia_id = ${guardia_id} OR r.tipo = 'COMUNICADO')
  `

  return { items: rows, total: total[0]?.cnt ?? 0 }
}

// ─── Contexto para chatbot ────────────────────────────────────────────────────

export async function ultimosReportesParaContexto(comunidad_id: string, limite = 20) {
  if (!comunidad_id) return []
  return prisma.$queryRaw<any[]>`
    SELECT
      r.guardia_nombre, r.tipo, r.created_at,
      ia.transcripcion, ia.resumen, ia.tipo_ia
    FROM reportes_ptt r
    LEFT JOIN reportes_ia ia ON ia.reporte_id = r.id::uuid
    WHERE r.comunidad_id = ${comunidad_id}
    ORDER BY r.created_at DESC
    LIMIT ${limite}
  `
}

// ─── Comunicados programados ──────────────────────────────────────────────────

export async function crearComunicado(data: {
  comunidad_id: string
  titulo: string
  mensaje: string
  tipo_contenido: string
  frecuencia: string
  hora_envio?: string
  dias_semana?: string
  proximo_envio?: Date | null
}) {
  return prisma.$executeRaw`
    INSERT INTO comunicados_programados
      (id, comunidad_id, titulo, mensaje, tipo_contenido, frecuencia, hora_envio, dias_semana, activo, proximo_envio)
    VALUES
      (gen_random_uuid(), ${data.comunidad_id}, ${data.titulo}, ${data.mensaje},
       ${data.tipo_contenido}, ${data.frecuencia}, ${data.hora_envio ?? null},
       ${data.dias_semana ?? null}, true, ${data.proximo_envio ?? null})
  `
}

export async function listarComunicados(comunidad_id: string) {
  return prisma.$queryRaw<any[]>`
    SELECT * FROM comunicados_programados
    WHERE comunidad_id = ${comunidad_id}
    ORDER BY created_at DESC
  `
}

export async function actualizarComunicado(id: string, data: {
  titulo?: string
  mensaje?: string
  tipo_contenido?: string
  frecuencia?: string
  hora_envio?: string | null
  dias_semana?: string | null
  activo?: boolean
  proximo_envio?: Date | null
}) {
  return prisma.$executeRaw`
    UPDATE comunicados_programados SET
      titulo         = COALESCE(${data.titulo ?? null},         titulo),
      mensaje        = COALESCE(${data.mensaje ?? null},        mensaje),
      tipo_contenido = COALESCE(${data.tipo_contenido ?? null}, tipo_contenido),
      frecuencia     = COALESCE(${data.frecuencia ?? null},     frecuencia),
      hora_envio     = CASE WHEN ${data.hora_envio !== undefined}    THEN ${data.hora_envio    ?? null} ELSE hora_envio    END,
      dias_semana    = CASE WHEN ${data.dias_semana !== undefined}   THEN ${data.dias_semana   ?? null} ELSE dias_semana   END,
      activo         = CASE WHEN ${data.activo !== undefined}        THEN ${data.activo        ?? true} ELSE activo        END,
      proximo_envio  = CASE WHEN ${data.proximo_envio !== undefined} THEN ${data.proximo_envio ?? null} ELSE proximo_envio END
    WHERE id = ${id}::uuid
  `
}

export async function eliminarComunicado(id: string) {
  return prisma.$executeRaw`DELETE FROM comunicados_programados WHERE id = ${id}::uuid`
}

export async function comunicadosDue() {
  return prisma.$queryRaw<any[]>`
    SELECT * FROM comunicados_programados
    WHERE activo = true AND proximo_envio IS NOT NULL AND proximo_envio <= NOW()
    ORDER BY proximo_envio ASC
  `
}

export async function obtenerComunicadoPorId(id: string) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM comunicados_programados WHERE id = ${id}::uuid
  `
  return rows[0] ?? null
}

export async function marcarEnviado(id: string, proximoEnvio: Date | null) {
  if (proximoEnvio === null) {
    return prisma.$executeRaw`
      UPDATE comunicados_programados
      SET ultimo_envio = NOW(), proximo_envio = NULL, activo = false
      WHERE id = ${id}::uuid
    `
  }
  return prisma.$executeRaw`
    UPDATE comunicados_programados
    SET ultimo_envio = NOW(), proximo_envio = ${proximoEnvio}
    WHERE id = ${id}::uuid
  `
}
