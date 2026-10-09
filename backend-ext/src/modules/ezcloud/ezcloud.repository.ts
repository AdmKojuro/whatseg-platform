import { prisma } from '../../shared/config/prisma'
import { EzcloudClient } from './ezcloud.client'
import crypto from 'crypto'

// ─── types ────────────────────────────────────────────────────────────────────

export interface CuentaEzcloud {
  id: string
  nombre: string
  app_key: string
  app_secret: string
  base_url: string
  activa: boolean
  created_at: string
  updated_at: string
}

export interface CreateCuentaInput {
  nombre: string
  app_key: string
  app_secret: string
  base_url?: string
}

export interface SyncResult {
  total: number
  created: number
  updated: number
}

// ─── cuentas CRUD ─────────────────────────────────────────────────────────────

export async function listarCuentas(): Promise<CuentaEzcloud[]> {
  const rows: CuentaEzcloud[] = await prisma.$queryRaw`
    SELECT
      id::text,
      nombre,
      app_key,
      app_secret,
      base_url,
      activa,
      created_at,
      updated_at
    FROM cuentas_ezcloud
    ORDER BY nombre
  `
  return rows
}

export async function crearCuenta(data: CreateCuentaInput): Promise<CuentaEzcloud> {
  const rows: CuentaEzcloud[] = await prisma.$queryRaw`
    INSERT INTO cuentas_ezcloud (nombre, app_key, app_secret, base_url)
    VALUES (
      ${data.nombre},
      ${data.app_key},
      ${data.app_secret},
      ${data.base_url ?? 'https://os.ezcloud.uniview.com'}
    )
    RETURNING
      id::text,
      nombre,
      app_key,
      app_secret,
      base_url,
      activa,
      created_at,
      updated_at
  `
  return rows[0]
}

export async function actualizarCuenta(
  id: string,
  data: Partial<CreateCuentaInput & { activa: boolean }>
): Promise<CuentaEzcloud> {
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (data.nombre     !== undefined) { fields.push(`nombre = $${idx++}`);     values.push(data.nombre) }
  if (data.app_key    !== undefined) { fields.push(`app_key = $${idx++}`);    values.push(data.app_key) }
  if (data.app_secret !== undefined) { fields.push(`app_secret = $${idx++}`); values.push(data.app_secret) }
  if (data.base_url   !== undefined) { fields.push(`base_url = $${idx++}`);   values.push(data.base_url) }
  if (data.activa     !== undefined) { fields.push(`activa = $${idx++}`);     values.push(data.activa) }

  if (fields.length === 0) throw new Error('Nada que actualizar')

  fields.push(`updated_at = now()`)
  values.push(id)

  const sql = `
    UPDATE cuentas_ezcloud
    SET ${fields.join(', ')}
    WHERE id = $${idx}::uuid
    RETURNING
      id::text, nombre, app_key, app_secret, base_url, activa, created_at, updated_at
  `
  const rows: CuentaEzcloud[] = await prisma.$queryRawUnsafe(sql, ...values)
  if (!rows[0]) throw new Error('Cuenta no encontrada')
  return rows[0]
}

export async function eliminarCuenta(id: string): Promise<void> {
  // Desvincular dispositivos primero para no violar FK
  await prisma.$executeRaw`
    UPDATE dispositivos SET cuenta_ezcloud_id = NULL WHERE cuenta_ezcloud_id = ${id}::uuid
  `
  await prisma.$executeRaw`
    DELETE FROM cuentas_ezcloud WHERE id = ${id}::uuid
  `
}

// ─── sync ─────────────────────────────────────────────────────────────────────

export async function sincronizarTodas(): Promise<SyncResult> {
  const cuentas = await listarCuentas()
  const activas = cuentas.filter(c => c.activa)

  let created = 0
  let updated = 0
  let total = 0

  for (const cuenta of activas) {
    const client = new EzcloudClient(cuenta.app_key, cuenta.app_secret, cuenta.base_url)
    const devices = await client.listDevices()
    total += devices.length

    for (const dev of devices) {
      const result = await upsertDispositivoEzcloud(cuenta.id, dev)
      if (result === 'created') created++
      else updated++
    }
  }

  return { total, created, updated }
}

async function upsertDispositivoEzcloud(
  cuentaId: string,
  dev: { deviceSerial: string; deviceName: string; status: number }
): Promise<'created' | 'updated'> {
  const idInterno = `ezcloud:${dev.deviceSerial}`
  const online = dev.status === 1

  // Check if exists
  const existing: { id: string }[] = await prisma.$queryRaw`
    SELECT id::text FROM dispositivos WHERE id_interno = ${idInterno} LIMIT 1
  `

  if (existing.length > 0) {
    await prisma.$executeRaw`
      UPDATE dispositivos
      SET
        nombre            = ${dev.deviceName},
        online            = ${online},
        ezcloud_serial    = ${dev.deviceSerial},
        ezcloud_channel   = '1',
        cuenta_ezcloud_id = ${cuentaId}::uuid,
        configurado       = true,
        updated_at        = now()
      WHERE id_interno = ${idInterno}
    `
    return 'updated'
  } else {
    const newId  = crypto.randomUUID()
    const now    = new Date()
    const tipo   = 'CAMARA'
    const canal  = '1'
    await prisma.$executeRaw`
      INSERT INTO dispositivos (
        id, nombre, tipo, id_interno, online,
        ezcloud_serial, ezcloud_channel, cuenta_ezcloud_id,
        configurado, updated_at
      )
      VALUES (
        ${newId},
        ${dev.deviceName},
        ${tipo},
        ${idInterno},
        ${online},
        ${dev.deviceSerial},
        ${canal},
        ${cuentaId}::uuid,
        ${true},
        ${now}
      )
    `
    return 'created'
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

export async function getCuentaById(id: string): Promise<CuentaEzcloud | null> {
  const rows: CuentaEzcloud[] = await prisma.$queryRaw`
    SELECT
      id::text, nombre, app_key, app_secret, base_url, activa, created_at, updated_at
    FROM cuentas_ezcloud
    WHERE id = ${id}::uuid
    LIMIT 1
  `
  return rows[0] ?? null
}

// ─── poller helpers ───────────────────────────────────────────────────────────

/** Get WhatsApp numbers of clients who have PROTECCION enabled for a community.
 *  Only clients with an explicit record (activa = true) in ezcloud_proteccion_clientes receive alerts. */
export async function getClientesWhatsapp(comunidadId: string): Promise<string[]> {
  const rows: { celular: string }[] = await prisma.$queryRaw`
    SELECT c.celular
    FROM clientes c
    JOIN clientes_comunidades cc ON cc.cliente_id = c.id::text
    JOIN ezcloud_proteccion_clientes epc
      ON epc.cliente_id = c.id::uuid
      AND epc.comunidad_id = ${comunidadId}::uuid
    WHERE cc.comunidad_id = ${comunidadId}
      AND c.activo = true
      AND epc.activa = true
  `
  return rows.map(r => r.celular)
}

/** Get PROTECCION status for all clients in a community */
export async function getProteccionClientes(
  comunidadId: string
): Promise<{ cliente_id: string; activa: boolean }[]> {
  return prisma.$queryRaw`
    SELECT cliente_id::text, activa
    FROM ezcloud_proteccion_clientes
    WHERE comunidad_id = ${comunidadId}::uuid
  `
}

/** Enable or disable motion alert PROTECCION for a specific client in a community */
export async function setProteccionCliente(
  clienteId: string,
  comunidadId: string,
  activa: boolean
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO ezcloud_proteccion_clientes (cliente_id, comunidad_id, activa, updated_at)
    VALUES (${clienteId}::uuid, ${comunidadId}::uuid, ${activa}, now())
    ON CONFLICT (cliente_id, comunidad_id)
    DO UPDATE SET activa = ${activa}, updated_at = now()
  `
}

/** Check if motion alerts are enabled for a device (default: true) */
export async function isAlertaActiva(dispositivoId: string): Promise<boolean> {
  const rows: { alertas_activas: boolean }[] = await prisma.$queryRaw`
    SELECT alertas_activas
    FROM ezcloud_alertas_config
    WHERE dispositivo_id = ${dispositivoId}
    LIMIT 1
  `
  return rows[0]?.alertas_activas ?? true
}

/** Enable or disable motion alerts for a device */
export async function setAlertaActiva(dispositivoId: string, activas: boolean): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO ezcloud_alertas_config (dispositivo_id, alertas_activas, updated_at)
    VALUES (${dispositivoId}, ${activas}, now())
    ON CONFLICT (dispositivo_id)
    DO UPDATE SET alertas_activas = ${activas}, updated_at = now()
  `
}

/** Get device + community info by EZCloud serial */
export async function getDispositivoBySerial(
  serial: string
): Promise<{ id: string; comunidad_id: string | null; cuenta_ezcloud_id: string | null } | null> {
  const rows: { id: string; comunidad_id: string | null; cuenta_ezcloud_id: string | null }[] =
    await prisma.$queryRaw`
      SELECT
        id::text,
        comunidad_id::text,
        cuenta_ezcloud_id::text
      FROM dispositivos
      WHERE ezcloud_serial = ${serial}
      LIMIT 1
    `
  return rows[0] ?? null
}

// ─── PROTECCION helpers (usado por wa-bot) ────────────────────────────────────

/** Check if a community has any EZCloud cameras (by codigo) */
export async function comunidadTieneEzcloud(comunidadCodigo: string): Promise<boolean> {
  const rows: { count: bigint }[] = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint AS count
    FROM dispositivos d
    JOIN comunidades c ON c.id::text = d.comunidad_id::text
    WHERE c.codigo = ${comunidadCodigo}
      AND d.ezcloud_serial IS NOT NULL
  `
  return Number(rows[0]?.count ?? 0) > 0
}

/** Get per-client PROTECCION status by phone number + community code (for wa-bot) */
export async function getProteccionClientePorCelular(
  celular: string,
  comunidadCodigo: string
): Promise<boolean> {
  const rows: { activa: boolean }[] = await prisma.$queryRaw`
    SELECT epc.activa
    FROM ezcloud_proteccion_clientes epc
    JOIN clientes c ON c.id::uuid = epc.cliente_id
    JOIN comunidades com ON com.id::uuid = epc.comunidad_id
    WHERE REGEXP_REPLACE(c.celular, '[^0-9]', '', 'g') = REGEXP_REPLACE(${celular}, '[^0-9]', '', 'g')
      AND com.codigo = ${comunidadCodigo}
    LIMIT 1
  `
  return rows[0]?.activa ?? false
}

/** Enable or disable PROTECCION for a client by phone number + community code (for wa-bot) */
export async function setProteccionClientePorCelular(
  celular: string,
  comunidadCodigo: string,
  activa: boolean
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO ezcloud_proteccion_clientes (cliente_id, comunidad_id, activa, updated_at)
    SELECT c.id::uuid, com.id::uuid, ${activa}, now()
    FROM clientes c, comunidades com
    WHERE REGEXP_REPLACE(c.celular, '[^0-9]', '', 'g') = REGEXP_REPLACE(${celular}, '[^0-9]', '', 'g')
      AND com.codigo = ${comunidadCodigo}
    ON CONFLICT (cliente_id, comunidad_id)
    DO UPDATE SET activa = ${activa}, updated_at = now()
  `
}

/** Get all EZCloud cameras assigned to a community (by codigo) */
export async function getCamarasEzcloudPorCodigo(
  comunidadCodigo: string
): Promise<{ id: string; nombre: string; ezcloud_serial: string }[]> {
  return prisma.$queryRaw`
    SELECT d.id::text, d.nombre, d.ezcloud_serial
    FROM dispositivos d
    JOIN comunidades c ON c.id::text = d.comunidad_id::text
    WHERE c.codigo = ${comunidadCodigo}
      AND d.ezcloud_serial IS NOT NULL
  `
}

/** Get PROTECCION status for a community: does it have EZCloud cameras + are alerts on? */
export async function getEstadoAlertasComunidad(comunidadCodigo: string): Promise<{
  tieneProteccion: boolean
  alertasActivas: boolean
  camaras: { id: string; nombre: string; serial: string; alertasActivas: boolean }[]
}> {
  const camaras = await getCamarasEzcloudPorCodigo(comunidadCodigo)
  if (camaras.length === 0) return { tieneProteccion: false, alertasActivas: false, camaras: [] }

  const conEstado = await Promise.all(
    camaras.map(async (cam) => ({
      id:              cam.id,
      nombre:          cam.nombre,
      serial:          cam.ezcloud_serial,
      alertasActivas:  await isAlertaActiva(cam.id),
    }))
  )

  return {
    tieneProteccion: true,
    alertasActivas:  conEstado.some(c => c.alertasActivas),
    camaras:         conEstado,
  }
}

/** Enable or disable motion alerts for ALL cameras in a community (by codigo) */
export async function setAlertasComunidad(
  comunidadCodigo: string,
  activas: boolean
): Promise<number> {
  const camaras = await getCamarasEzcloudPorCodigo(comunidadCodigo)
  await Promise.all(camaras.map(cam => setAlertaActiva(cam.id, activas)))
  return camaras.length
}

/** Get ALARMA devices assigned to a community — used to trigger physical alarms on motion detection */
export async function getAlarmasEnComunidad(
  comunidadId: string
): Promise<{ id: string; nombre: string; mqtt_device_id: string | null; mqtt_kind: string | null }[]> {
  return prisma.$queryRaw`
    SELECT id::text, nombre, mqtt_device_id, mqtt_kind
    FROM dispositivos
    WHERE comunidad_id::text = ${comunidadId}
      AND tipo = 'ALARMA'
      AND configurado = true
      AND online = true
  `
}
