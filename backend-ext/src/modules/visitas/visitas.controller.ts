import { Request, Response, NextFunction } from 'express'
import * as service from './visitas.service'

export async function listarHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listar(req.query.comunidad_id as string)) } catch (e) { next(e) }
}

export async function listarPorComunidadHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listarPorComunidad(String(req.params.id))) } catch (e) { next(e) }
}

export async function crearHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const visita = await service.crear({ ...req.body, created_by: req.admin!.sub })
    const qr = await service.generarQrBase64(visita.qr_token)
    res.status(201).json({ ...visita, qr_base64: qr })
  } catch (e) { next(e) }
}

export async function obtenerPorIdHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.obtenerPorId(String(req.params.id))) } catch (e) { next(e) }
}

export async function usarQrHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const fotoPath = (req as any).file?.path
    const result = await service.usarQr(String(req.params.token), fotoPath)
    res.json({ ok: true, visita: result })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
}

export async function cancelarHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.cancelar(String(req.params.id))) } catch (e) { next(e) }
}

export async function descargarQrHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const visita = await service.obtenerPorId(String(req.params.id))
    const qr = await service.generarQrBase64(visita.qr_token)
    res.json({ qr_base64: qr, token: visita.qr_token })
  } catch (e) { next(e) }
}
