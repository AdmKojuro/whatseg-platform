import { Request, Response, NextFunction } from 'express'
import * as service from './placas.service'

export async function listarDenegadasHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listarDenegadas()) } catch (e) { next(e) }
}
export async function crearDenegadaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await service.crearDenegada({ ...req.body, created_by: req.admin!.sub }))
  } catch (e: any) {
    if (e.message?.includes('inválido')) res.status(400).json({ error: e.message })
    else next(e)
  }
}
export async function eliminarDenegadaHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.eliminarDenegada(String(req.params.id))) } catch (e) { next(e) }
}
export async function actualizarDenegadaHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.actualizarDenegada(String(req.params.id), req.body)) } catch (e) { next(e) }
}
export async function listarAlertasHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { reconocido, page, limit } = req.query as Record<string, string>
    res.json(await service.listarAlertas({
      reconocido: reconocido !== undefined ? reconocido === 'true' : undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    }))
  } catch (e) { next(e) }
}
export async function recibirAlertaHandler(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.recibirAlertaDeVision(req.body)) } catch (e) { next(e) }
}
export async function reconocerAlertaHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.reconocerAlerta(String(req.params.id))) } catch (e) { next(e) }
}
export async function syncVisionHandler(req: Request, res: Response, next: NextFunction) {
  try { await service.syncConVision(); res.json({ ok: true }) } catch (e) { next(e) }
}
