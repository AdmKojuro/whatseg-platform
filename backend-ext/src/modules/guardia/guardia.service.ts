import { prisma } from '../../shared/config/prisma'

const CHECKIN_INTERVAL_MS = 10 * 60 * 1000   // 10 minutos
const ALERTA_DELAY_MS     =  5 * 60 * 1000   // 5 min sin check-in → alerta
const PANIC_DELAY_MS      =  2 * 60 * 1000   // 2 min extra → despacho automático

// Mapa en memoria: guardia_id → último check-in timestamp
const lastCheckIn = new Map<string, number>()
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ─── Check-in ─────────────────────────────────────────────────────────────

export async function registrarCheckIn(guardia_id: string, tipo: string, notas?: string) {
  const registro = await prisma.guardiaCheckIn.create({
    data: { guardia_id, tipo, notas },
  })

  if (tipo === 'COACCION') {
    // Alerta silenciosa inmediata
    await crearAlerta(guardia_id, 'COACCION')
    return registro
  }

  if (tipo === 'PANICO') {
    await crearAlerta(guardia_id, 'PANICO')
    return registro
  }

  // tipo === 'OK' — resetear timer dead-man switch
  lastCheckIn.set(guardia_id, Date.now())
  resetTimer(guardia_id)

  // Resolver alertas SIN_CHECKIN activas
  await prisma.alertaGuardia.updateMany({
    where: { guardia_id, tipo: 'SIN_CHECKIN', resuelto: false },
    data: { resuelto: true, resuelto_at: new Date() },
  })

  return registro
}

export async function historialCheckIn(guardia_id: string) {
  return prisma.guardiaCheckIn.findMany({
    where: { guardia_id },
    orderBy: { created_at: 'desc' },
    take: 50,
  })
}

export async function listarAlertas(resuelto?: boolean) {
  return prisma.alertaGuardia.findMany({
    where: resuelto !== undefined ? { resuelto } : {},
    orderBy: { created_at: 'desc' },
    take: 100,
  })
}

export async function resolverAlerta(id: string, resuelto_por: string) {
  return prisma.alertaGuardia.update({
    where: { id },
    data: { resuelto: true, resuelto_at: new Date(), resuelto_por },
  })
}

export async function estadoGuardias() {
  // Guardias activos (con check-in en últimas 12h)
  const recientes = await prisma.guardiaCheckIn.findMany({
    where: { created_at: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } },
    orderBy: { created_at: 'desc' },
    distinct: ['guardia_id'],
  })
  return recientes.map(r => ({
    guardia_id: r.guardia_id,
    ultimo_checkin: r.created_at,
    tipo: r.tipo,
    activo: (Date.now() - r.created_at.getTime()) < CHECKIN_INTERVAL_MS * 2,
  }))
}

// ─── Dead-man switch (timer interno) ──────────────────────────────────────

function resetTimer(guardia_id: string) {
  const existing = pendingTimers.get(guardia_id)
  if (existing) clearTimeout(existing)

  const t = setTimeout(async () => {
    // Sin check-in por más de ALERTA_DELAY_MS
    const ultimo = lastCheckIn.get(guardia_id) ?? 0
    if (Date.now() - ultimo >= ALERTA_DELAY_MS) {
      await crearAlerta(guardia_id, 'SIN_CHECKIN')
    }
  }, ALERTA_DELAY_MS)

  pendingTimers.set(guardia_id, t)
}

async function crearAlerta(guardia_id: string, tipo: string) {
  const nivel = tipo === 'PANICO' || tipo === 'COACCION' ? 'CRITICA' : 'ALTA'
  // No duplicar alertas activas
  const existe = await prisma.alertaGuardia.findFirst({
    where: { guardia_id, tipo, resuelto: false },
  })
  if (existe) return
  await prisma.alertaGuardia.create({ data: { guardia_id, tipo, nivel } })
}

// Iniciar monitoreo de guardias ya registrados al arrancar el servidor
export async function iniciarMonitoreo() {
  const recientes = await estadoGuardias()
  for (const g of recientes) {
    if (g.activo) {
      lastCheckIn.set(g.guardia_id, g.ultimo_checkin.getTime())
      resetTimer(g.guardia_id)
    }
  }
}
