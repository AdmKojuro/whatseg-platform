import { prisma } from '../../shared/config/prisma'

export async function recibirDeVision(data: {
  alert_id?: number
  camera_id: string
  comunidad_id?: string
  tipo_alerta: string
  severidad: string
  descripcion: string
  face_track_id?: string
  expediente_id?: string
  vision_alert_id?: number
  similitud?: number
  snapshot_path?: string
}) {
  return prisma.alertaIA.create({
    data: {
      ...data,
      expediente_id: data.expediente_id ?? null,
    },
  })
}

export async function listar(params?: {
  tipo?: string
  comunidad_id?: string
  reconocido?: boolean
  page?: number
  limit?: number
}) {
  const { tipo, comunidad_id, reconocido, page = 1, limit = 20 } = params ?? {}
  const where: Record<string, unknown> = {}
  if (tipo) where.tipo_alerta = tipo
  if (comunidad_id) where.comunidad_id = comunidad_id
  if (reconocido !== undefined) where.reconocido = reconocido

  const [data, total] = await Promise.all([
    prisma.alertaIA.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.alertaIA.count({ where }),
  ])

  return { data, total, page, limit, total_pages: Math.ceil(total / limit) }
}

export async function reconocer(id: string) {
  return prisma.alertaIA.update({ where: { id }, data: { reconocido: true } })
}

export async function obtenerPorId(id: string) {
  return prisma.alertaIA.findUniqueOrThrow({ where: { id }, include: { evidencias: true } })
}
