import { prisma } from '../../shared/config/prisma'

export async function listar() {
  return prisma.zona.findMany({
    where: { activa: true },
    include: {
      comunidades: true,
      _count: { select: { comunidades: true, despachos: true } },
    },
    orderBy: { nombre: 'asc' },
  })
}

export async function obtenerPorId(id: string) {
  return prisma.zona.findUniqueOrThrow({
    where: { id },
    include: {
      comunidades: true,
      _count: { select: { comunidades: true, despachos: true } },
    },
  })
}

export async function crear(data: { nombre: string; codigo: string; descripcion?: string }) {
  return prisma.zona.create({ data })
}

export async function actualizar(id: string, data: { nombre?: string; descripcion?: string; activa?: boolean }) {
  return prisma.zona.update({ where: { id }, data })
}

export async function eliminar(id: string) {
  return prisma.zona.update({ where: { id }, data: { activa: false } })
}

export async function asignarComunidad(zonaId: string, comunidadId: string) {
  return prisma.zonaComunidad.upsert({
    where: { zona_id_comunidad_id: { zona_id: zonaId, comunidad_id: comunidadId } },
    create: { zona_id: zonaId, comunidad_id: comunidadId },
    update: {},
  })
}

export async function desasignarComunidad(zonaId: string, comunidadId: string) {
  return prisma.zonaComunidad.delete({
    where: { zona_id_comunidad_id: { zona_id: zonaId, comunidad_id: comunidadId } },
  })
}

export async function mapaCalorZona(zonaId: string) {
  // Consulta la DB del backend principal (misma DB) para obtener activaciones
  const comunidades = await prisma.zonaComunidad.findMany({ where: { zona_id: zonaId } })
  const ids = comunidades.map((c) => c.comunidad_id)

  // Consulta activaciones directamente (tabla del backend principal)
  const activaciones = await prisma.$queryRaw<
    { comunidad_id: string; lat: number | null; lng: number | null; total: bigint }[]
  >`
    SELECT a.comunidad_id, c.latitud as lat, c.longitud as lng, COUNT(*) as total
    FROM "Activacion" a
    JOIN "Comunidad" c ON c.id = a.comunidad_id
    WHERE a.comunidad_id = ANY(${ids}::text[])
      AND a.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY a.comunidad_id, c.latitud, c.longitud
  `

  return activaciones.map((r) => ({
    comunidad_id: r.comunidad_id,
    lat: r.lat,
    lng: r.lng,
    weight: Number(r.total),
  }))
}
