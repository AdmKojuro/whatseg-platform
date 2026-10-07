import type { Request, Response, NextFunction } from 'express'
import * as repo from './ezcloud.repository'
import { EzcloudClient } from './ezcloud.client'

// ─── cuentas ─────────────────────────────────────────────────────────────────

export async function listarCuentasHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const cuentas = await repo.listarCuentas()
    // Ocultar app_secret en la respuesta
    const safe = cuentas.map(c => ({ ...c, app_secret: '••••••••' }))
    res.json(safe)
  } catch (err) { next(err) }
}

export async function crearCuentaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { nombre, app_key, app_secret, base_url } = req.body
    if (!nombre || !app_key || !app_secret)
      return res.status(400).json({ error: 'nombre, app_key y app_secret son requeridos' })
    const cuenta = await repo.crearCuenta({ nombre, app_key, app_secret, base_url })
    res.status(201).json({ ...cuenta, app_secret: '••••••••' })
  } catch (err: any) {
    if (String(err.message).includes('unique') || String(err.code) === '23505')
      return res.status(409).json({ error: 'Ya existe una cuenta con ese nombre' })
    next(err)
  }
}

export async function actualizarCuentaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const cuenta = await repo.actualizarCuenta(id, req.body)
    res.json({ ...cuenta, app_secret: '••••••••' })
  } catch (err: any) {
    if (String(err.message) === 'Cuenta no encontrada')
      return res.status(404).json({ error: err.message })
    next(err)
  }
}

export async function eliminarCuentaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.eliminarCuenta(req.params.id)
    res.status(204).end()
  } catch (err) { next(err) }
}

// ─── sync ─────────────────────────────────────────────────────────────────────

export async function syncHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await repo.sincronizarTodas()
    res.json(result)
  } catch (err) { next(err) }
}

// ─── stream ──────────────────────────────────────────────────────────────────

export async function streamHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { serial } = req.params
    const channel = (req.query.channel as string) ?? '1'

    const cuenta = await getCuentaForSerial(serial)
    if (!cuenta) return res.status(404).json({ error: 'Dispositivo EZCloud no encontrado' })

    const client = new EzcloudClient(cuenta.app_key, cuenta.app_secret, cuenta.base_url)
    const url = await client.getLiveUrl(serial, channel)
    res.json({ url })
  } catch (err) { next(err) }
}

// ─── snapshot ─────────────────────────────────────────────────────────────────

export async function snapshotHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { serial } = req.params
    const channel = req.params.channel ?? (req.query.channel as string) ?? '1'

    const cuenta = await getCuentaForSerial(serial)
    if (!cuenta) return res.status(404).json({ error: 'Dispositivo EZCloud no encontrado' })

    const client = new EzcloudClient(cuenta.app_key, cuenta.app_secret, cuenta.base_url)
    const picUrl = await client.captureSnapshot(serial, channel)
    res.json({ url: picUrl })
  } catch (err) { next(err) }
}

// ─── helper ───────────────────────────────────────────────────────────────────

async function getCuentaForSerial(serial: string): Promise<repo.CuentaEzcloud | null> {
  const { prisma } = await import('../../shared/config/prisma')
  const rows: { cuenta_ezcloud_id: string }[] = await prisma.$queryRaw`
    SELECT cuenta_ezcloud_id::text
    FROM dispositivos
    WHERE ezcloud_serial = ${serial}
    LIMIT 1
  `
  if (!rows[0]?.cuenta_ezcloud_id) return null
  return repo.getCuentaById(rows[0].cuenta_ezcloud_id)
}
