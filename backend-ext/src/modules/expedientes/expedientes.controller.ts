import { Request, Response, NextFunction } from 'express'
import * as service from './expedientes.service'

export async function listarHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listar()) } catch (e) { next(e) }
}

export async function obtenerHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.obtenerPorId(String(req.params.id))) } catch (e) { next(e) }
}

export async function crearHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await service.crear({ ...req.body, created_by: req.admin!.sub }))
  } catch (e) { next(e) }
}

export async function actualizarHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.actualizar(String(req.params.id), req.body)) } catch (e) { next(e) }
}

export async function eliminarHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.eliminar(String(req.params.id))) } catch (e) { next(e) }
}

export async function subirFotoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!(req as any).file) { res.status(400).json({ error: 'foto requerida' }); return }
    const result = await service.subirFoto(String(req.params.id), (req as any).file.path)
    res.json(result)
  } catch (e: any) {
    res.status(422).json({ error: e.message })
  }
}

export async function deteccionesHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.detecciones(String(req.params.id))) } catch (e) { next(e) }
}
