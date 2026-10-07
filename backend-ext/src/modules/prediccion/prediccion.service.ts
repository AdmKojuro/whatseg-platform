import { prisma } from '../../shared/config/prisma'
import { Prisma } from '@prisma/client'

/**
 * Scoring predictivo de turnos.
 * Calcula probabilidad de incidente por zona/comunidad basado en patrones históricos.
 * Sin ML externo — estadística directa sobre las activaciones existentes.
 */

export async function scoringTurno(zona_id?: string) {
  const ahora = new Date()
  const horaActual = ahora.getHours()
  const diaActual = ahora.getDay()  // 0=Dom, 6=Sab

  // Últimos 90 días de activaciones del backend principal
  // Accedemos via raw query a la tabla del backend principal
  const desde90d = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000)

  const raw = await prisma.$queryRaw<Array<{
    comunidad_id: string; hora: number; dia_semana: number; cnt: bigint
  }>>(Prisma.sql`
    SELECT
      comunidad_id,
      EXTRACT(HOUR FROM created_at)::int AS hora,
      EXTRACT(DOW  FROM created_at)::int AS dia_semana,
      COUNT(*) AS cnt
    FROM activaciones
    WHERE created_at >= ${desde90d}
    GROUP BY comunidad_id, hora, dia_semana
  `)

  // Calcular score por hora del turno actual (próximas 8h)
  const horas8h = Array.from({ length: 8 }, (_, i) => (horaActual + i) % 24)
  const scores: Map<string, { score: number; horas_riesgo: number[] }> = new Map()

  for (const row of raw) {
    const cid = row.comunidad_id
    if (!scores.has(cid)) scores.set(cid, { score: 0, horas_riesgo: [] })
    const entry = scores.get(cid)!
    if (horas8h.includes(row.hora)) {
      const w_dia = row.dia_semana === diaActual ? 2 : 1  // mismo día de la semana pesa más
      entry.score += Number(row.cnt) * w_dia
      if (!entry.horas_riesgo.includes(row.hora)) entry.horas_riesgo.push(row.hora)
    }
  }

  // Normalizar scores 0-100
  const maxScore = Math.max(...Array.from(scores.values()).map(v => v.score), 1)
  const result = Array.from(scores.entries())
    .map(([comunidad_id, v]) => ({
      comunidad_id,
      score: Math.round((v.score / maxScore) * 100),
      horas_riesgo: v.horas_riesgo.sort((a, b) => a - b),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)

  return {
    turno: `${horaActual.toString().padStart(2, '0')}:00 — ${((horaActual + 8) % 24).toString().padStart(2, '0')}:00`,
    dia: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][diaActual],
    comunidades: result,
    generado_at: ahora.toISOString(),
  }
}

export async function patronesTemporales(comunidad_id?: string) {
  const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  let porHora: Array<{ hora: number; cnt: bigint }>
  let porDia: Array<{ dia: number; cnt: bigint }>

  if (comunidad_id) {
    ;[porHora, porDia] = await Promise.all([
      prisma.$queryRaw<Array<{ hora: number; cnt: bigint }>>(Prisma.sql`
        SELECT EXTRACT(HOUR FROM created_at)::int AS hora, COUNT(*) AS cnt
        FROM activaciones WHERE created_at >= ${desde} AND comunidad_id = ${comunidad_id}
        GROUP BY hora ORDER BY hora
      `),
      prisma.$queryRaw<Array<{ dia: number; cnt: bigint }>>(Prisma.sql`
        SELECT EXTRACT(DOW FROM created_at)::int AS dia, COUNT(*) AS cnt
        FROM activaciones WHERE created_at >= ${desde} AND comunidad_id = ${comunidad_id}
        GROUP BY dia ORDER BY dia
      `),
    ])
  } else {
    ;[porHora, porDia] = await Promise.all([
      prisma.$queryRaw<Array<{ hora: number; cnt: bigint }>>(Prisma.sql`
        SELECT EXTRACT(HOUR FROM created_at)::int AS hora, COUNT(*) AS cnt
        FROM activaciones WHERE created_at >= ${desde}
        GROUP BY hora ORDER BY hora
      `),
      prisma.$queryRaw<Array<{ dia: number; cnt: bigint }>>(Prisma.sql`
        SELECT EXTRACT(DOW FROM created_at)::int AS dia, COUNT(*) AS cnt
        FROM activaciones WHERE created_at >= ${desde}
        GROUP BY dia ORDER BY dia
      `),
    ])
  }

  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return {
    por_hora: Array.from({ length: 24 }, (_, h) => {
      const found = porHora.find(r => r.hora === h)
      return { hora: h, label: `${h.toString().padStart(2, '0')}h`, cnt: found ? Number(found.cnt) : 0 }
    }),
    por_dia: Array.from({ length: 7 }, (_, d) => {
      const found = porDia.find(r => r.dia === d)
      return { dia: d, label: dias[d], cnt: found ? Number(found.cnt) : 0 }
    }),
  }
}

export async function rutaPatrullaOptima(zona_id: string) {
  const scoring = await scoringTurno(zona_id)
  // Top 5 comunidades de mayor riesgo → ruta de patrulla sugerida
  const top5 = scoring.comunidades.slice(0, 5)

  // Obtener zonas asignadas si hay zona_id
  const zonaComunidades = await prisma.zonaComunidad.findMany({
    where: { zona_id },
  })
  const idsEnZona = new Set(zonaComunidades.map(z => z.comunidad_id))
  const filtrado = zona_id
    ? top5.filter(c => idsEnZona.has(c.comunidad_id))
    : top5

  return {
    zona_id,
    ruta: filtrado.map((c, i) => ({ orden: i + 1, ...c })),
    criterio: 'Máximo riesgo histórico por hora del turno actual',
  }
}
