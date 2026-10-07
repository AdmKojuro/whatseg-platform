import { prisma } from '../../shared/config/prisma'
import { EzcloudClient } from './ezcloud.client'

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
      ${data.base_url ?? 'https://global.ezcloud.uniview.com'}
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
        cuenta_ezcloud_id = ${cuentaId}::uuid
      WHERE id_interno = ${idInterno}
    `
    return 'updated'
  } else {
    await prisma.$executeRaw`
      INSERT INTO dispositivos (
        nombre, tipo, id_interno, online,
        ezcloud_serial, ezcloud_channel, cuenta_ezcloud_id
      )
      VALUES (
        ${dev.deviceName},
        'CAMARA',
        ${idInterno},
        ${online},
        ${dev.deviceSerial},
        '1',
        ${cuentaId}::uuid
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
