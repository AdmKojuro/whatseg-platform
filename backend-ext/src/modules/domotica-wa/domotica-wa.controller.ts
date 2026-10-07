import type { Request, Response, NextFunction } from 'express'
import * as repo from './domotica-wa.repository'

// El bot (central/wa-bot) corre como proceso aparte y expone su estado
// (QR / conectado / número) en un puerto interno, solo accesible desde
// localhost. Aquí lo leemos y lo retransmitimos tal cual al panel.
const WA_BASE_URL = process.env.DOMOTICA_WA_BASE_URL || 'http://127.0.0.1:3072'
const WA_STATUS_URL = `${WA_BASE_URL}/status`
const WA_LOGOUT_URL = `${WA_BASE_URL}/logout`

export async function waStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await fetch(WA_STATUS_URL, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) throw new Error(`status ${r.status}`)
    const data = await r.json()
    res.json(data)
  } catch (err: any) {
    // El bot puede estar reiniciando o caído; no es un error 500 del panel,
    // simplemente informamos que está desconectado.
    res.json({ status: 'disconnected', qrDataUrl: null, phone: null, error: err?.message })
  }
}

export async function waLogout(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await fetch(WA_LOGOUT_URL, { method: 'POST', signal: AbortSignal.timeout(10000) })
    const data = await r.json().catch(() => ({}))
    res.json(data)
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err?.message || 'No se pudo contactar al bot' })
  }
}

export async function listarConversaciones(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await repo.listarConversaciones()
    res.json(data)
  } catch (err) { next(err) }
}

export async function listarMensajes(req: Request, res: Response, next: NextFunction) {
  try {
    const celular = String(req.params.celular)
    const data = await repo.listarMensajes(celular)
    res.json(data)
  } catch (err) { next(err) }
}
