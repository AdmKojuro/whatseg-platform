import { prisma } from '../../shared/config/prisma'

export async function mapaCalorGlobal(diasAtras = 30) {
  const desde = new Date()
  desde.setDate(desde.getDate() - diasAtras)

  const rows = await prisma.$queryRaw<
    { comunidad_id: string; nombre: string; lat: number | null; lng: number | null; total: bigint }[]
  >`
    SELECT a.comunidad_id, c.nombre, c.latitud as lat, c.longitud as lng, COUNT(*) as total
    FROM "Activacion" a
    JOIN "Comunidad" c ON c.id = a.comunidad_id
    WHERE a.created_at >= ${desde}
    GROUP BY a.comunidad_id, c.nombre, c.latitud, c.longitud
  `

  return rows.map((r) => ({
    comunidad_id: r.comunidad_id,
    nombre: r.nombre,
    lat: r.lat,
    lng: r.lng,
    weight: Number(r.total),
  }))
}

export async function patronesTemporales(comunidadId?: string) {
  const where = comunidadId ? `AND a.comunidad_id = '${comunidadId}'` : ''

  const porHora = await prisma.$queryRawUnsafe<{ hora: number; total: bigint }[]>(`
    SELECT EXTRACT(HOUR FROM created_at)::int as hora, COUNT(*) as total
    FROM "Activacion" a WHERE 1=1 ${where}
    GROUP BY hora ORDER BY hora
  `)

  const porDia = await prisma.$queryRawUnsafe<{ dia: number; total: bigint }[]>(`
    SELECT EXTRACT(DOW FROM created_at)::int as dia, COUNT(*) as total
    FROM "Activacion" a WHERE 1=1 ${where}
    GROUP BY dia ORDER BY dia
  `)

  const porTipo = await prisma.$queryRawUnsafe<{ tipo: string; total: bigint }[]>(`
    SELECT tipo_emergencia as tipo, COUNT(*) as total
    FROM "Activacion" a WHERE tipo_emergencia IS NOT NULL ${where}
    GROUP BY tipo_emergencia ORDER BY total DESC
  `)

  return {
    por_hora: porHora.map((r) => ({ hora: r.hora, total: Number(r.total) })),
    por_dia: porDia.map((r) => ({ dia: r.dia, total: Number(r.total) })),
    por_tipo: porTipo.map((r) => ({ tipo: r.tipo, total: Number(r.total) })),
  }
}

export async function tendencias() {
  const mesActual = new Date()
  mesActual.setDate(1); mesActual.setHours(0, 0, 0, 0)
  const mesAnterior = new Date(mesActual)
  mesAnterior.setMonth(mesAnterior.getMonth() - 1)

  const [actual, anterior] = await Promise.all([
    prisma.$queryRaw<{ total: bigint; exitosas: bigint; falsas: bigint }[]>`
      SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE resultado='EXITOSO') as exitosas,
        COUNT(*) FILTER (WHERE veredicto='FALSA_ALARMA') as falsas
      FROM "Activacion" WHERE created_at >= ${mesActual}
    `,
    prisma.$queryRaw<{ total: bigint; exitosas: bigint; falsas: bigint }[]>`
      SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE resultado='EXITOSO') as exitosas,
        COUNT(*) FILTER (WHERE veredicto='FALSA_ALARMA') as falsas
      FROM "Activacion" WHERE created_at >= ${mesAnterior} AND created_at < ${mesActual}
    `,
  ])

  const a = actual[0]
  const b = anterior[0]
  const variacion = Number(b.total) === 0 ? 100 : ((Number(a.total) - Number(b.total)) / Number(b.total)) * 100

  return {
    mes_actual: { total: Number(a.total), exitosas: Number(a.exitosas), falsas: Number(a.falsas) },
    mes_anterior: { total: Number(b.total), exitosas: Number(b.exitosas), falsas: Number(b.falsas) },
    variacion_pct: Math.round(variacion * 10) / 10,
  }
}

export async function rankingComunidades(limite = 10) {
  const rows = await prisma.$queryRaw<
    { comunidad_id: string; nombre: string; total: bigint; falsas: bigint }[]
  >`
    SELECT a.comunidad_id, c.nombre, COUNT(*) as total,
      COUNT(*) FILTER (WHERE veredicto='FALSA_ALARMA') as falsas
    FROM "Activacion" a
    JOIN "Comunidad" c ON c.id = a.comunidad_id
    WHERE a.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY a.comunidad_id, c.nombre
    ORDER BY total DESC
    LIMIT ${limite}
  `
  return rows.map((r) => ({
    comunidad_id: r.comunidad_id,
    nombre: r.nombre,
    total: Number(r.total),
    falsas: Number(r.falsas),
    efectividad: Number(r.total) === 0 ? 0 :
      Math.round(((Number(r.total) - Number(r.falsas)) / Number(r.total)) * 100),
  }))
}
