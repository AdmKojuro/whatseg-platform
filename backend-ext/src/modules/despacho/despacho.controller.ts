import { Request, Response, NextFunction } from 'express'
import * as service from './despacho.service'

export async function crearHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await service.crear({ ...req.body, created_by: req.admin!.sub }))
  } catch (e) { next(e) }
}

export async function actualizarEstadoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { estado, notas } = req.body
    res.json(await service.actualizarEstado(String(req.params.id), estado, notas))
  } catch (e) { next(e) }
}

export async function listarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { zona_id, cuadrante_id, estado } = req.query as Record<string, string>
    res.json(await service.listar({ zona_id, cuadrante_id, estado }))
  } catch (e) { next(e) }
}

export async function porCuadranteHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.porCuadrante(String(req.params.id))) } catch (e) { next(e) }
}

export async function obtenerHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.obtenerPorId(String(req.params.id))) } catch (e) { next(e) }
}
