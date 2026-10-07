import { prisma } from '../../shared/config/prisma'
import type { CrearRutaDto, ActualizarRutaDto, CrearCheckpointDto, ActualizarCheckpointDto, CrearPuestoDto, ActualizarPuestoDto, FiltroEjecuciones, CrearUsuarioRondaDto, ActualizarUsuarioRondaDto } from './rondas.types'

// ─── COMUNIDADES (lectura directa de tablas del backend principal) ────────

export async function misComunidades(admin_id: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT c.id, c.nombre, c.codigo, c.direccion, c.latitud, c.longitud
    FROM admins_comunidades ac
    JOIN comunidades c ON c.id = ac.comunidad_id
    WHERE ac.admin_id = ${admin_id} AND c.activa = true
    ORDER BY c.nombre
  `
  return rows
}

// ─── PUESTOS ──────────────────────────────────────────────────────────────

export function listarPuestos(comunidad_id: string) {
  return prisma.puesto.findMany({
    where: { comunidad_id, activo: true },
    orderBy: { created_at: 'asc' },
  })
}

export function obtenerPuesto(id: string) {
  return prisma.puesto.findUnique({ where: { id } })
}

export function crearPuesto(data: CrearPuestoDto) {
  return prisma.puesto.create({ data })
}

export function actualizarPuesto(id: string, data: ActualizarPuestoDto) {
  return prisma.puesto.update({ where: { id }, data })
}

export function eliminarPuesto(id: string) {
  return prisma.puesto.update({ where: { id }, data: { activo: false } })
}

// ─── RUTAS ─────────────────────────────────────────────────────────────────

export function listarRutas(comunidad_id?: string) {
  return prisma.rutaRonda.findMany({
    where: comunidad_id ? { comunidad_id } : {},
    include: { checkpoints: { orderBy: { orden: 'asc' } }, _count: { select: { ejecuciones: true } } },
    orderBy: { created_at: 'desc' },
  })
}

export function obtenerRuta(id: string) {
  return prisma.rutaRonda.findUnique({
    where: { id },
    include: { checkpoints: { orderBy: { orden: 'asc' } } },
  })
}

export function crearRuta(data: CrearRutaDto) {
  return prisma.rutaRonda.create({ data })
}

export function actualizarRuta(id: string, data: ActualizarRutaDto) {
  return prisma.rutaRonda.update({ where: { id }, data })
}

export function eliminarRuta(id: string) {
  return prisma.rutaRonda.delete({ where: { id } })
}

// ─── CHECKPOINTS ───────────────────────────────────────────────────────────

export function listarCheckpoints(ruta_id: string) {
  return prisma.checkpoint.findMany({
    where: { ruta_id },
    orderBy: { orden: 'asc' },
  })
}

export function crearCheckpoint(ruta_id: string, data: CrearCheckpointDto) {
  return prisma.checkpoint.create({ data: { ...data, ruta_id } })
}

export function actualizarCheckpoint(id: string, data: ActualizarCheckpointDto) {
  return prisma.checkpoint.update({ where: { id }, data })
}

export function eliminarCheckpoint(id: string) {
  return prisma.checkpoint.delete({ where: { id } })
}

export function obtenerCheckpoint(id: string) {
  return prisma.checkpoint.findUnique({ where: { id } })
}

export async function buscarCheckpointPorQR(qr_code: string) {
  // 1. Intento con el valor exacto (QR permanente)
  let cp = await prisma.checkpoint.findUnique({ where: { qr_code } })
  if (cp) return cp

  // 2. Si tiene sufijo temporal (UUID/YYYYMMDD...), extraer el prefijo
  const slashIdx = qr_code.lastIndexOf('/')
  if (slashIdx > 0) {
    const prefix = qr_code.substring(0, slashIdx)
    cp = await prisma.checkpoint.findUnique({ where: { qr_code: prefix } })
  }
  return cp
}

export async function buscarCheckpointPorNFC(nfc_tag: string) {
  // 1. Verificar que el UID está registrado y activo en nfc_tarjetas
  const tarjetas: any[] = await prisma.$queryRaw`
    SELECT id FROM nfc_tarjetas WHERE uid = ${nfc_tag} AND activa = true LIMIT 1
  `
  if (tarjetas.length === 0) {
    throw Object.assign(new Error('Tarjeta NFC no registrada o desactivada'), { statusCode: 403 })
  }
  // 2. Buscar checkpoint por nfc_tag
  return prisma.checkpoint.findUnique({ where: { nfc_tag } })
}

// ─── GESTIÓN DE TARJETAS NFC ────────────────────────────────────────────────

export async function listarTarjetasNFC(comunidad_id?: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT t.*, c.nombre AS comunidad_nombre,
           cp.nombre AS checkpoint_nombre
    FROM nfc_tarjetas t
    LEFT JOIN comunidades c ON c.id = t.comunidad_id
    LEFT JOIN checkpoints cp ON cp.nfc_tag = t.uid
    WHERE (${comunidad_id ?? null}::text IS NULL OR t.comunidad_id = ${comunidad_id ?? null})
    ORDER BY t.created_at DESC
  `
  return rows
}

export async function crearTarjetaNFC(data: {
  uid: string
  etiqueta: string
  comunidad_id?: string | null
  notas?: string | null
}) {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO nfc_tarjetas (uid, etiqueta, comunidad_id, notas)
    VALUES (${data.uid}, ${data.etiqueta}, ${data.comunidad_id ?? null}, ${data.notas ?? null})
    RETURNING *
  `
  return rows[0]
}

export async function actualizarTarjetaNFC(id: string, data: {
  etiqueta?: string
  activa?: boolean
  comunidad_id?: string | null
  notas?: string | null
}) {
  const rows: any[] = await prisma.$queryRaw`
    UPDATE nfc_tarjetas SET
      etiqueta     = COALESCE(${data.etiqueta ?? null},     etiqueta),
      activa       = CASE WHEN ${data.activa !== undefined} THEN ${data.activa ?? true} ELSE activa END,
      comunidad_id = CASE WHEN ${data.comunidad_id !== undefined} THEN ${data.comunidad_id ?? null} ELSE comunidad_id END,
      notas        = CASE WHEN ${data.notas !== undefined} THEN ${data.notas ?? null} ELSE notas END,
      updated_at   = NOW()
    WHERE id = ${id}::uuid
    RETURNING *
  `
  return rows[0]
}

export async function eliminarTarjetaNFC(id: string) {
  return prisma.$executeRaw`DELETE FROM nfc_tarjetas WHERE id = ${id}::uuid`
}

// ─── EJECUCIONES ───────────────────────────────────────────────────────────

export async function crearEjecucion(ruta_id: string, guardia_id: string, checkpoints_total: number, foto_verificacion_url?: string | null) {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO rondas_ejecucion (ruta_id, guardia_id, checkpoints_total, foto_verificacion_url)
    VALUES (${ruta_id}::uuid, ${guardia_id}::uuid, ${checkpoints_total}, ${foto_verificacion_url ?? null})
    RETURNING id
  `
  return rows[0]
}

export function obtenerEjecucion(id: string) {
  return prisma.rondaEjecucion.findUnique({
    where: { id },
    include: {
      ruta: { include: { checkpoints: { orderBy: { orden: 'asc' } } } },
      visitas: { include: { checkpoint: true }, orderBy: { marcado_at: 'asc' } },
    },
  })
}

export function rondaActivaGuardia(guardia_id: string) {
  return prisma.rondaEjecucion.findFirst({
    where: { guardia_id, estado: 'EN_CURSO' },
    include: {
      ruta: { include: { checkpoints: { orderBy: { orden: 'asc' } } } },
      visitas: { include: { checkpoint: true }, orderBy: { marcado_at: 'asc' } },
    },
  })
}

export function finalizarEjecucion(id: string, estado: string, notas?: string) {
  return prisma.rondaEjecucion.update({
    where: { id },
    data: { estado, fin_at: new Date(), notas },
  })
}

export function incrementarMarcados(id: string) {
  return prisma.rondaEjecucion.update({
    where: { id },
    data: { checkpoints_marcados: { increment: 1 } },
  })
}

export async function rondasEnCurso(comunidad_id?: string) {
  const where: any = { estado: 'EN_CURSO' }
  if (comunidad_id) where.ruta = { comunidad_id }

  const ejecuciones = await prisma.rondaEjecucion.findMany({
    where,
    include: {
      ruta: { select: { id: true, nombre: true, comunidad_id: true, intervalo_min: true, checkpoints: { orderBy: { orden: 'asc' } } } },
      visitas: { include: { checkpoint: true }, orderBy: { marcado_at: 'asc' } },
    },
    orderBy: { inicio_at: 'desc' },
  })

  // Enriquecer con nombre del guardia (rondas_usuarios o admins)
  const guardiaIds = [...new Set(ejecuciones.map((e: any) => e.guardia_id))]
  let guardiaMap: Record<string, string> = {}
  if (guardiaIds.length > 0) {
    const usuarios: any[] = await prisma.$queryRaw`
      SELECT id::text, nombre::text FROM rondas_usuarios WHERE id::text = ANY(${guardiaIds})
      UNION
      SELECT id::text, nombre::text FROM admins WHERE id::text = ANY(${guardiaIds})
    `
    guardiaMap = Object.fromEntries(usuarios.map((u: any) => [String(u.id), u.nombre]))
  }

  return ejecuciones.map((e: any) => ({
    ...e,
    guardia_nombre: guardiaMap[e.guardia_id] ?? 'Guardia',
  }))
}

export async function listarEjecuciones(filtros: FiltroEjecuciones) {
  const where: any = {}
  if (filtros.guardia_id) where.guardia_id = filtros.guardia_id
  if (filtros.estado) where.estado = filtros.estado
  if (filtros.comunidad_id) where.ruta = { comunidad_id: filtros.comunidad_id }
  if (filtros.desde || filtros.hasta) {
    where.inicio_at = {}
    if (filtros.desde) where.inicio_at.gte = new Date(filtros.desde)
    if (filtros.hasta) where.inicio_at.lte = new Date(filtros.hasta)
  }

  const ejecuciones = await prisma.rondaEjecucion.findMany({
    where,
    include: {
      ruta: true,
      _count: { select: { visitas: true } },
    },
    orderBy: { inicio_at: 'desc' },
    take: 200,
  })

  // Enriquecer con nombre y rol del guardia
  const guardiaIds = [...new Set(ejecuciones.map((e: any) => e.guardia_id))]
  let guardiaMap: Record<string, { nombre: string; rol: string }> = {}
  if (guardiaIds.length > 0) {
    const usuarios: any[] = await prisma.$queryRaw`
      SELECT id::text, nombre, rol::text FROM rondas_usuarios WHERE id::text = ANY(${guardiaIds})
      UNION
      SELECT id::text, nombre, rol::text FROM admins WHERE id::text = ANY(${guardiaIds})
    `
    guardiaMap = Object.fromEntries(usuarios.map((u: any) => [String(u.id), { nombre: u.nombre, rol: u.rol }]))
  }

  return ejecuciones.map((e: any) => ({
    ...e,
    guardia_nombre: guardiaMap[e.guardia_id]?.nombre ?? 'Guardia',
    guardia_rol:    guardiaMap[e.guardia_id]?.rol    ?? '-',
  }))
}

export function eliminarEjecucion(id: string) {
  return prisma.rondaEjecucion.delete({ where: { id } })
}

// ─── VISITAS ───────────────────────────────────────────────────────────────

export async function registrarVisita(data: {
  ejecucion_id: string
  checkpoint_id: string
  metodo: string
  latitud?: number
  longitud?: number
  notas?: string
  foto_url?: string
}) {
  // Usar raw SQL para incluir foto_url sin depender del esquema Prisma compilado
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO checkpoint_visitas
      (ejecucion_id, checkpoint_id, metodo, latitud, longitud, notas, foto_url)
    VALUES
      (${data.ejecucion_id}::uuid, ${data.checkpoint_id}::uuid, ${data.metodo},
       ${data.latitud ?? null}, ${data.longitud ?? null},
       ${data.notas ?? null}, ${data.foto_url ?? null})
    RETURNING *
  `
  return rows[0]
}

export function visitaYaRegistrada(ejecucion_id: string, checkpoint_id: string) {
  return prisma.checkpointVisita.findFirst({
    where: { ejecucion_id, checkpoint_id },
  })
}

// ─── ESTADÍSTICAS ──────────────────────────────────────────────────────────

export async function estadisticas(comunidad_id?: string) {
  const where: any = {}
  if (comunidad_id) where.ruta = { comunidad_id }

  const total = await prisma.rondaEjecucion.count({ where })
  const completadas = await prisma.rondaEjecucion.count({ where: { ...where, estado: 'COMPLETADA' } })
  const incompletas = await prisma.rondaEjecucion.count({ where: { ...where, estado: 'INCOMPLETA' } })
  const enCurso = await prisma.rondaEjecucion.count({ where: { ...where, estado: 'EN_CURSO' } })

  // Tiempo promedio de rondas completadas (últimos 30 días)
  const hace30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const completadasRecientes = await prisma.rondaEjecucion.findMany({
    where: { ...where, estado: 'COMPLETADA', fin_at: { not: null }, inicio_at: { gte: hace30d } },
    select: { inicio_at: true, fin_at: true },
  })

  let tiempoPromedioMin = 0
  if (completadasRecientes.length > 0) {
    const totalMin = completadasRecientes.reduce((sum: number, r: { inicio_at: Date; fin_at: Date | null }) => {
      return sum + (r.fin_at!.getTime() - r.inicio_at.getTime()) / 60000
    }, 0)
    tiempoPromedioMin = Math.round(totalMin / completadasRecientes.length)
  }

  const cumplimiento = total > 0 ? Math.round((completadas / total) * 100) : 0

  return { total, completadas, incompletas, enCurso, cumplimiento, tiempoPromedioMin }
}

// ─── USUARIOS (Personal de seguridad) ────────────────────────────────────

export function listarUsuarios(comunidad_id: string) {
  return prisma.rondaUsuario.findMany({
    where: { comunidad_id },
    orderBy: { created_at: 'desc' },
  })
}

export function obtenerUsuario(id: string) {
  return prisma.rondaUsuario.findUnique({ where: { id } })
}

export function buscarPorCedula(cedula: string) {
  return prisma.rondaUsuario.findUnique({ where: { cedula } })
}

export function crearUsuario(data: {
  comunidad_id: string
  cedula: string
  nombre: string
  telefono?: string
  password_hash: string
  rol: string
  turno?: string
  puesto_id?: string
  created_by: string
}) {
  return prisma.rondaUsuario.create({ data })
}

export function actualizarUsuario(id: string, data: Partial<{
  nombre: string
  telefono: string | null
  password_hash: string
  rol: string
  turno: string | null
  puesto_id: string | null
  activo: boolean
}>) {
  return prisma.rondaUsuario.update({ where: { id }, data })
}

export function eliminarUsuario(id: string) {
  return prisma.rondaUsuario.update({ where: { id }, data: { activo: false } })
}

// ─── Puesto ↔ Checkpoints obligatorios ───────────────────────────────────────

export async function getPuestoCheckpoints(puesto_id: string): Promise<string[]> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT checkpoint_id::text FROM puesto_checkpoints WHERE puesto_id = ${puesto_id}::uuid
  `
  return rows.map(r => String(r.checkpoint_id))
}

export async function setPuestoCheckpoints(puesto_id: string, checkpoint_ids: string[]): Promise<void> {
  await prisma.$executeRaw`DELETE FROM puesto_checkpoints WHERE puesto_id = ${puesto_id}::uuid`
  for (const cp_id of checkpoint_ids) {
    await prisma.$executeRaw`
      INSERT INTO puesto_checkpoints (puesto_id, checkpoint_id)
      VALUES (${puesto_id}::uuid, ${cp_id}::uuid)
      ON CONFLICT DO NOTHING
    `
  }
}

export async function getMisCheckpointIds(puestoIds: string[]): Promise<string[]> {
  if (puestoIds.length === 0) return []
  const rows: any[] = await prisma.$queryRaw`
    SELECT DISTINCT checkpoint_id::text
    FROM puesto_checkpoints
    WHERE puesto_id = ANY(${puestoIds}::uuid[])
  `
  return rows.map(r => String(r.checkpoint_id))
}

// ─── Plano de planta del puesto ──────────────────────────────────────────────

export async function getPuestoPlano(puesto_id: string): Promise<any | null> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT id::text, puesto_id::text, imagen_url, plano_json,
           cal_lat1, cal_lng1, cal_px1, cal_py1,
           cal_lat2, cal_lng2, cal_px2, cal_py2,
           ancho, alto
    FROM puesto_planos
    WHERE puesto_id = ${puesto_id}::uuid
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function savePuestoPlanoJson(puesto_id: string, plano_json: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO puesto_planos (puesto_id, plano_json)
    VALUES (${puesto_id}::uuid, ${plano_json})
    ON CONFLICT (puesto_id) DO UPDATE SET plano_json = EXCLUDED.plano_json
  `
}

export async function upsertPuestoPlano(puesto_id: string, data: {
  imagen_url: string
  ancho: number
  alto: number
  cal_lat1?: number | null; cal_lng1?: number | null; cal_px1?: number | null; cal_py1?: number | null
  cal_lat2?: number | null; cal_lng2?: number | null; cal_px2?: number | null; cal_py2?: number | null
}): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO puesto_planos (puesto_id, imagen_url, ancho, alto, cal_lat1, cal_lng1, cal_px1, cal_py1, cal_lat2, cal_lng2, cal_px2, cal_py2)
    VALUES (
      ${puesto_id}::uuid, ${data.imagen_url}, ${data.ancho}, ${data.alto},
      ${data.cal_lat1 ?? null}, ${data.cal_lng1 ?? null}, ${data.cal_px1 ?? null}, ${data.cal_py1 ?? null},
      ${data.cal_lat2 ?? null}, ${data.cal_lng2 ?? null}, ${data.cal_px2 ?? null}, ${data.cal_py2 ?? null}
    )
    ON CONFLICT (puesto_id) DO UPDATE SET
      imagen_url = EXCLUDED.imagen_url,
      ancho = EXCLUDED.ancho, alto = EXCLUDED.alto,
      cal_lat1 = EXCLUDED.cal_lat1, cal_lng1 = EXCLUDED.cal_lng1,
      cal_px1  = EXCLUDED.cal_px1,  cal_py1  = EXCLUDED.cal_py1,
      cal_lat2 = EXCLUDED.cal_lat2, cal_lng2 = EXCLUDED.cal_lng2,
      cal_px2  = EXCLUDED.cal_px2,  cal_py2  = EXCLUDED.cal_py2
  `
}

export async function updatePuestoPlanoCalibration(puesto_id: string, cal: {
  cal_lat1: number; cal_lng1: number; cal_px1: number; cal_py1: number
  cal_lat2: number; cal_lng2: number; cal_px2: number; cal_py2: number
}): Promise<void> {
  await prisma.$executeRaw`
    UPDATE puesto_planos SET
      cal_lat1=${cal.cal_lat1}, cal_lng1=${cal.cal_lng1}, cal_px1=${cal.cal_px1}, cal_py1=${cal.cal_py1},
      cal_lat2=${cal.cal_lat2}, cal_lng2=${cal.cal_lng2}, cal_px2=${cal.cal_px2}, cal_py2=${cal.cal_py2}
    WHERE puesto_id = ${puesto_id}::uuid
  `
}

export async function getPuestoPlanoCheckpoints(puesto_id: string): Promise<any[]> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT ppc.checkpoint_id::text, ppc.plano_px, ppc.plano_py,
           c.nombre, c.orden, c.qr_code
    FROM puesto_plano_checkpoints ppc
    JOIN checkpoints c ON c.id = ppc.checkpoint_id
    WHERE ppc.puesto_id = ${puesto_id}::uuid
  `
  return rows
}

export async function setPuestoPlanoCheckpoint(puesto_id: string, checkpoint_id: string, px: number, py: number): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO puesto_plano_checkpoints (puesto_id, checkpoint_id, plano_px, plano_py)
    VALUES (${puesto_id}::uuid, ${checkpoint_id}::uuid, ${px}, ${py})
    ON CONFLICT (puesto_id, checkpoint_id) DO UPDATE SET plano_px=${px}, plano_py=${py}
  `
}

// ─── GPS Track (rastreo continuo durante ronda) ───────────────────────────────

export async function guardarGPS(data: {
  ejecucion_id: string
  guardia_id:   string
  latitud:      number
  longitud:     number
  accuracy?:    number | null
  heading?:     number | null
}) {
  await prisma.$executeRaw`
    INSERT INTO rondas_gps_track (ejecucion_id, guardia_id, latitud, longitud, accuracy, heading)
    VALUES (
      ${data.ejecucion_id}::uuid, ${data.guardia_id}::uuid,
      ${data.latitud}, ${data.longitud},
      ${data.accuracy ?? null}, ${data.heading ?? null}
    )
  `
}

export async function trackGps(ejecucion_id: string) {
  return prisma.$queryRaw<any[]>`
    SELECT latitud, longitud, heading, ts
    FROM rondas_gps_track
    WHERE ejecucion_id = ${ejecucion_id}::uuid
    ORDER BY ts ASC
  `
}

// ─── PROGRAMACIONES DE RONDA ────────────────────────────────────────────────

export async function listarProgramaciones(comunidad_id: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT p.*, r.nombre AS ruta_nombre, u.nombre AS guardia_nombre
    FROM programaciones_ronda p
    LEFT JOIN rutas_ronda r ON r.id = p.ruta_id
    LEFT JOIN rondas_usuarios u ON u.id = p.guardia_id
    WHERE p.comunidad_id = ${comunidad_id}::uuid
    ORDER BY p.hora_inicio ASC
  `
  return rows
}

export async function crearProgramacion(data: {
  comunidad_id: string; ruta_id: string; guardia_id?: string | null;
  dias_semana: string; hora_inicio: string; tolerancia_min?: number;
}) {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO programaciones_ronda (comunidad_id, ruta_id, guardia_id, dias_semana, hora_inicio, tolerancia_min)
    VALUES (${data.comunidad_id}::uuid, ${data.ruta_id}::uuid,
            ${data.guardia_id ? data.guardia_id : null}::uuid,
            ${data.dias_semana}, ${data.hora_inicio}::time,
            ${data.tolerancia_min ?? 15})
    RETURNING *
  `
  return rows[0]
}

export async function actualizarProgramacion(id: string, data: Partial<{
  ruta_id: string; guardia_id: string | null; dias_semana: string;
  hora_inicio: string; tolerancia_min: number; activo: boolean;
}>) {
  // Build dynamic SET clause
  const sets: string[] = []
  const vals: any[] = []
  if (data.ruta_id !== undefined)        { sets.push('ruta_id = $' + (vals.length + 2) + '::uuid'); vals.push(data.ruta_id) }
  if (data.guardia_id !== undefined)     { sets.push('guardia_id = $' + (vals.length + 2) + '::uuid'); vals.push(data.guardia_id) }
  if (data.dias_semana !== undefined)    { sets.push('dias_semana = $' + (vals.length + 2)); vals.push(data.dias_semana) }
  if (data.hora_inicio !== undefined)    { sets.push('hora_inicio = $' + (vals.length + 2) + '::time'); vals.push(data.hora_inicio) }
  if (data.tolerancia_min !== undefined) { sets.push('tolerancia_min = $' + (vals.length + 2)); vals.push(data.tolerancia_min) }
  if (data.activo !== undefined)         { sets.push('activo = $' + (vals.length + 2)); vals.push(data.activo) }
  if (sets.length === 0) return null

  const query = `UPDATE programaciones_ronda SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING *`
  const rows: any[] = await prisma.$queryRawUnsafe(query, id, ...vals)
  return rows[0]
}

export async function eliminarProgramacion(id: string) {
  await prisma.$executeRaw`DELETE FROM programaciones_ronda WHERE id = ${id}::uuid`
}

export async function listarAlertasRonda(comunidad_id: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT a.*, p.hora_inicio, p.dias_semana, r.nombre AS ruta_nombre, u.nombre AS guardia_nombre
    FROM alertas_ronda a
    JOIN programaciones_ronda p ON p.id = a.programacion_id
    LEFT JOIN rutas_ronda r ON r.id = p.ruta_id
    LEFT JOIN rondas_usuarios u ON u.id = p.guardia_id
    WHERE p.comunidad_id = ${comunidad_id}::uuid
    ORDER BY a.created_at DESC
    LIMIT 50
  `
  return rows
}

export async function verificarProgramacionesVencidas(comunidad_id?: string) {
  // Find active schedules where the time window has passed and no execution started
  const ahora = new Date()
  const diaSemana = ahora.getDay() === 0 ? 7 : ahora.getDay() // 1=lunes..7=domingo
  const horaActual = `${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}`

  const where = comunidad_id ? `AND p.comunidad_id = '${comunidad_id}'` : ''

  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT p.id, p.ruta_id, p.guardia_id, p.hora_inicio, p.tolerancia_min,
           p.comunidad_id, r.nombre AS ruta_nombre, u.nombre AS guardia_nombre
    FROM programaciones_ronda p
    LEFT JOIN rutas_ronda r ON r.id = p.ruta_id::text
    LEFT JOIN rondas_usuarios u ON u.id = p.guardia_id::text
    WHERE p.activo = true
      AND p.dias_semana LIKE '%' || $1 || '%'
      AND (p.hora_inicio + (p.tolerancia_min || ' minutes')::interval) < $2::time
      AND p.hora_inicio <= $2::time
      ${where}
      AND NOT EXISTS (
        SELECT 1 FROM alertas_ronda a
        WHERE a.programacion_id = p.id
          AND a.fecha_programada::date = CURRENT_DATE
      )
      AND NOT EXISTS (
        SELECT 1 FROM rondas_ejecucion e
        WHERE e.ruta_id = p.ruta_id::text
          AND e.inicio_at::date = CURRENT_DATE
          AND e.inicio_at::time >= (p.hora_inicio - interval '15 minutes')
          AND e.inicio_at::time <= (p.hora_inicio + (p.tolerancia_min || ' minutes')::interval)
      )
  `, String(diaSemana), horaActual)

  // Create alerts for each missed schedule
  for (const prog of rows) {
    const fechaProgramada = new Date()
    const [h, m] = String(prog.hora_inicio).split(':')
    fechaProgramada.setHours(Number(h), Number(m), 0, 0)

    await prisma.$executeRaw`
      INSERT INTO alertas_ronda (programacion_id, fecha_programada, estado)
      VALUES (${prog.id}::uuid, ${fechaProgramada}::timestamptz, 'INCUMPLIDA')
    `
  }

  return rows
}

export async function marcarAlertaCumplida(programacion_id: string, ejecucion_id: string) {
  await prisma.$executeRaw`
    UPDATE alertas_ronda
    SET estado = 'CUMPLIDA', ejecucion_id = ${ejecucion_id}::uuid
    WHERE programacion_id = ${programacion_id}::uuid
      AND fecha_programada::date = CURRENT_DATE
      AND estado = 'PENDIENTE'
  `
}

// ─── CHECKPOINT CAMPOS (Formularios configurables) ──────────────────────────

export async function getCamposCheckpoint(checkpoint_id: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT id::text, checkpoint_id::text, etiqueta, tipo, opciones, requerido, orden
    FROM checkpoint_campos
    WHERE checkpoint_id = ${checkpoint_id}::uuid
    ORDER BY orden ASC
  `
  return rows
}

export async function setCamposCheckpoint(checkpoint_id: string, campos: Array<{
  id?: string; etiqueta: string; tipo: string; opciones?: string | null; requerido?: boolean; orden: number;
}>) {
  // Delete existing and reinsert
  await prisma.$executeRaw`DELETE FROM checkpoint_campos WHERE checkpoint_id = ${checkpoint_id}::uuid`
  for (const campo of campos) {
    await prisma.$executeRaw`
      INSERT INTO checkpoint_campos (checkpoint_id, etiqueta, tipo, opciones, requerido, orden)
      VALUES (${checkpoint_id}::uuid, ${campo.etiqueta}, ${campo.tipo},
              ${campo.opciones ?? null}, ${campo.requerido ?? false}, ${campo.orden})
    `
  }
}

export async function getRespuestasVisita(visita_id: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT r.id::text, r.campo_id::text, r.valor, c.etiqueta, c.tipo
    FROM checkpoint_respuestas r
    JOIN checkpoint_campos c ON c.id = r.campo_id
    WHERE r.visita_id = ${visita_id}::uuid
    ORDER BY c.orden ASC
  `
  return rows
}

export async function guardarRespuestas(visita_id: string, respuestas: Array<{ campo_id: string; valor: string }>) {
  for (const resp of respuestas) {
    await prisma.$executeRaw`
      INSERT INTO checkpoint_respuestas (visita_id, campo_id, valor)
      VALUES (${visita_id}::uuid, ${resp.campo_id}::uuid, ${resp.valor})
    `
  }
}
