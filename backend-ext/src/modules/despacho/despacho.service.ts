import { prisma } from '../../shared/config/prisma'

export async function crear(data: {
  activacion_id?: string
  alerta_ia_id?: string
  zona_id?: string
  cuadrante_id: string
  prioridad?: number
  notas_despacho?: string
  created_by: string
}) {
  return prisma.despacho.create({ data })
}

export async function actualizarEstado(
  id: string,
  estado: 'EN_CAMINO' | 'EN_SITIO' | 'CERRADO' | 'CANCELADO',
  notas?: string
) {
  const data: Record<string, unknown> = { estado }
  const ahora = new Date()

  if (estado === 'EN_CAMINO') data.en_camino_at = ahora
  if (estado === 'EN_SITIO') data.en_sitio_at = ahora
  if (estado === 'CERRADO' || estado === 'CANCELADO') {
    data.cierre_at = ahora
    const despacho = await prisma.despacho.findUnique({ where: { id } })
    if (despacho) {
      const secs = Math.round((ahora.getTime() - despacho.asignado_at.getTime()) / 1000)
      data.tiempo_respuesta_seg = secs
    }
    if (notas) data.notas_cierre = notas
  }

  return prisma.despacho.update({ where: { id }, data, include: { zona: true } })
}

export async function listar(filtros?: { zona_id?: string; cuadrante_id?: string; estado?: string }) {
  return prisma.despacho.findMany({
    where: filtros,
    orderBy: { created_at: 'desc' },
    take: 100,
    include: { zona: true },
  })
}

export async function porCuadrante(cuadranteId: string) {
  return prisma.despacho.findMany({
    where: {
      cuadrante_id: cuadranteId,
      estado: { in: ['ASIGNADO', 'EN_CAMINO', 'EN_SITIO'] },
    },
    orderBy: { created_at: 'desc' },
    include: { zona: true },
  })
}

export async function obtenerPorId(id: string) {
  return prisma.despacho.findUniqueOrThrow({ where: { id }, include: { zona: true } })
}
