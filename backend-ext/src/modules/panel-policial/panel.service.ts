import { prisma } from '../../shared/config/prisma'

export async function alertasActivas() {
  // Activaciones sin veredicto del backend principal
  const activaciones = await prisma.$queryRaw<
    {
      id: string; created_at: Date; tipo_emergencia: string | null
      resultado: string; comunidad_id: string; nombre_comunidad: string
      lat: number | null; lng: number | null
    }[]
  >`
    SELECT a.id, a.created_at, a.tipo_emergencia, a.resultado,
           a.comunidad_id, c.nombre as nombre_comunidad,
           c.latitud as lat, c.longitud as lng
    FROM "Activacion" a
    JOIN "Comunidad" c ON c.id = a.comunidad_id
    WHERE a.veredicto IS NULL
    ORDER BY a.created_at DESC
    LIMIT 50
  `

  // Alertas IA sin reconocer
  const alertasIA = await prisma.alertaIA.findMany({
    where: { reconocido: false },
    orderBy: { created_at: 'desc' },
    take: 30,
  })

  return { activaciones, alertas_ia: alertasIA }
}

export async function despachosActivos() {
  return prisma.despacho.findMany({
    where: { estado: { in: ['ASIGNADO', 'EN_CAMINO', 'EN_SITIO'] } },
    orderBy: { created_at: 'desc' },
    include: { zona: true },
  })
}

export async function metricasTurno() {
  const inicioDia = new Date()
  inicioDia.setHours(0, 0, 0, 0)

  const [totalHoy, despachadosHoy, tiempoPromedio, falsasHoy, alertasIAHoy] = await Promise.all([
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) as total FROM "Activacion" WHERE created_at >= ${inicioDia}
    `,
    prisma.despacho.count({ where: { created_at: { gte: inicioDia } } }),
    prisma.despacho.aggregate({
      where: { cierre_at: { not: null }, created_at: { gte: inicioDia } },
      _avg: { tiempo_respuesta_seg: true },
    }),
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) as total FROM "Activacion"
      WHERE veredicto='FALSA_ALARMA' AND created_at >= ${inicioDia}
    `,
    prisma.alertaIA.count({ where: { created_at: { gte: inicioDia } } }),
  ])

  return {
    activaciones_hoy: Number(totalHoy[0].total),
    despachos_hoy: despachadosHoy,
    tiempo_promedio_respuesta_seg: Math.round(tiempoPromedio._avg.tiempo_respuesta_seg ?? 0),
    falsas_alarmas_hoy: Number(falsasHoy[0].total),
    alertas_ia_hoy: alertasIAHoy,
  }
}

export async function exportarReporteSies(desde: Date, hasta: Date) {
  const activaciones = await prisma.$queryRaw<
    {
      id: string; created_at: Date; tipo_emergencia: string | null
      resultado: string; veredicto: string | null; comunidad: string
      lat: number | null; lng: number | null
    }[]
  >`
    SELECT a.id, a.created_at, a.tipo_emergencia, a.resultado, a.veredicto,
           c.nombre as comunidad, c.latitud as lat, c.longitud as lng
    FROM "Activacion" a
    JOIN "Comunidad" c ON c.id = a.comunidad_id
    WHERE a.created_at BETWEEN ${desde} AND ${hasta}
    ORDER BY a.created_at ASC
  `

  // Formato CSV compatible con SIES-C
  const header = 'ID,FECHA,HORA,TIPO_EMERGENCIA,RESULTADO,VEREDICTO,COMUNIDAD,LATITUD,LONGITUD\n'
  const rows = activaciones.map((a) => {
    const fecha = new Date(a.created_at)
    return [
      a.id,
      fecha.toLocaleDateString('es-CO'),
      fecha.toLocaleTimeString('es-CO'),
      a.tipo_emergencia ?? 'SIN_TIPO',
      a.resultado,
      a.veredicto ?? 'PENDIENTE',
      `"${a.comunidad}"`,
      a.lat ?? '',
      a.lng ?? '',
    ].join(',')
  }).join('\n')

  return header + rows
}
