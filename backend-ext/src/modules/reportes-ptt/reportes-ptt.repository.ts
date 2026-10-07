import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../../shared/config/env'

const prisma = new PrismaClient()

// ─── Auth: login de guardia/supervisor con cédula ───────────────────────
export async function loginGuardia(cedula: string, password: string) {
  const usuario: any = await (prisma as any).$queryRaw`
    SELECT id, cedula, nombre, rol, comunidad_id, puesto_id, password_hash, activo
    FROM rondas_usuarios
    WHERE cedula = ${cedula}
    LIMIT 1
  `
  const u = Array.isArray(usuario) ? usuario[0] : null
  if (!u || !u.activo) throw new Error('Credenciales inválidas')

  const ok = await bcrypt.compare(password, u.password_hash)
  if (!ok) throw new Error('Credenciales inválidas')

  const token = jwt.sign(
    { sub: u.id, rol: u.rol, comunidad_id: u.comunidad_id, nombre: u.nombre, puesto_id: u.puesto_id ?? null },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  )
  return { token, guardia: { id: u.id, cedula: u.cedula, nombre: u.nombre, rol: u.rol, comunidad_id: u.comunidad_id, puesto_id: u.puesto_id ?? null } }
}

// ─── Comunidades del admin (admins y supervisores) ───────────────────────
export async function comunidadesDelAdmin(admin_id: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT c.id, c.nombre, c.codigo
    FROM admins_comunidades ac
    JOIN comunidades c ON c.id = ac.comunidad_id
    WHERE ac.admin_id = ${admin_id} AND c.activa = true
    ORDER BY c.nombre
  `
  return rows
}

// ─── Crear reporte PTT ────────────────────────────────────────────────────
export async function crearReporte(data: {
  comunidad_id: string
  puesto_id?: string
  guardia_id?: string
  guardia_nombre: string
  tipo: string
  descripcion?: string
  archivo_path: string
  formato: string
  duracion_seg?: number
  tamanio_bytes?: number
  latitud?: number
  longitud?: number
}) {
  return prisma.reportePTT.create({ data })
}

// ─── Listar reportes ──────────────────────────────────────────────────────
export async function listarReportes(filtros: {
  comunidad_id?: string
  estado?: string
  tipo?: string
  desde?: string
  hasta?: string
  guardia_id?: string
  puesto_id?: string
  limit?: number
  offset?: number
}) {
  const where: any = {}
  if (filtros.comunidad_id) where.comunidad_id = filtros.comunidad_id
  if (filtros.estado)       where.estado = filtros.estado
  if (filtros.tipo)         where.tipo = filtros.tipo
  if (filtros.guardia_id) {
    // Incluir reportes propios + comunicados de Central (tipo COMUNICADO)
    where.OR = [
      ...(where.OR || []),
      { guardia_id: filtros.guardia_id },
      { tipo: 'COMUNICADO' },
    ]
  }
  if (filtros.puesto_id)    where.OR = [{ puesto_id: filtros.puesto_id }, { puesto_id: null }]
  if (filtros.desde || filtros.hasta) {
    where.created_at = {}
    if (filtros.desde) where.created_at.gte = new Date(filtros.desde)
    if (filtros.hasta) where.created_at.lte = new Date(filtros.hasta)
  }

  const [total, items] = await Promise.all([
    prisma.reportePTT.count({ where }),
    prisma.reportePTT.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: filtros.limit ?? 50,
      skip: filtros.offset ?? 0,
    }),
  ])

  // Enriquecer con puesto_nombre via JOIN
  const puestoIds = [...new Set((items as any[]).map((r: any) => r.puesto_id).filter(Boolean))]
  let puestoMap: Record<string, string> = {}
  if (puestoIds.length > 0) {
    try {
      const puestos: any[] = await (prisma as any).$queryRaw`
        SELECT id::text, nombre FROM puestos WHERE id::text = ANY(${puestoIds}::text[])
      `
      puestoMap = Object.fromEntries(puestos.map((p: any) => [String(p.id), p.nombre]))
    } catch {}
  }

  const enriched = (items as any[]).map((r: any) => ({
    ...r,
    puesto_nombre: r.puesto_id ? (puestoMap[String(r.puesto_id)] ?? null) : null,
  }))

  return { total, items: enriched }
}

// ─── Obtener reporte por ID ───────────────────────────────────────────────
export async function obtenerReporte(id: string) {
  const r = await prisma.reportePTT.findUnique({ where: { id } })
  if (!r) return null
  let puesto_nombre: string | null = null
  if ((r as any).puesto_id) {
    try {
      const rows: any[] = await (prisma as any).$queryRaw`
        SELECT nombre FROM puestos WHERE id::text = ${String((r as any).puesto_id)} LIMIT 1
      `
      puesto_nombre = rows[0]?.nombre ?? null
    } catch {}
  }
  return { ...r, puesto_nombre }
}

// ─── Actualizar estado ────────────────────────────────────────────────────
export async function actualizarEstado(
  id: string,
  estado: string,
  revisado_por: string,
  notas_revision?: string
) {
  return prisma.reportePTT.update({
    where: { id },
    data: { estado, revisado_por, notas_revision: notas_revision ?? undefined },
  })
}

// ─── Eliminar reporte ─────────────────────────────────────────────────────
export async function eliminarReporte(id: string) {
  const r = await prisma.reportePTT.findUnique({ where: { id } })
  if (r) {
    await prisma.reportePTT.delete({ where: { id } })
  }
  return r
}

// ─── Estadísticas ─────────────────────────────────────────────────────────
export async function estadisticas(comunidades: string[]) {
  if (!comunidades.length) return { total: 0, pendientes: 0, hoy: 0, por_tipo: {} }

  const now = new Date()
  const hoyInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [total, pendientes, hoy, porTipo] = await Promise.all([
    prisma.reportePTT.count({ where: { comunidad_id: { in: comunidades } } }),
    prisma.reportePTT.count({ where: { comunidad_id: { in: comunidades }, estado: 'PENDIENTE' } }),
    prisma.reportePTT.count({ where: { comunidad_id: { in: comunidades }, created_at: { gte: hoyInicio } } }),
    prisma.reportePTT.groupBy({
      by: ['tipo'],
      where: { comunidad_id: { in: comunidades } },
      _count: { id: true },
    }),
  ])

  const por_tipo = Object.fromEntries(porTipo.map(p => [p.tipo, p._count.id]))
  return { total, pendientes, hoy, por_tipo }
}
