import { Request, Response, NextFunction } from 'express'
import * as service from './zonas.service'

export async function listarHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listar()) } catch (e) { next(e) }
}

export async function obtenerPorIdHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.obtenerPorId(String(req.params.id))) } catch (e) { next(e) }
}

export async function crearHandler(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.crear(req.body)) } catch (e) { next(e) }
}

export async function actualizarHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.actualizar(String(req.params.id), req.body)) } catch (e) { next(e) }
}

export async function eliminarHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.eliminar(String(req.params.id))) } catch (e) { next(e) }
}

export async function asignarComunidadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await service.asignarComunidad(String(req.params.id), req.body.comunidad_id))
  } catch (e) { next(e) }
}

export async function desasignarComunidadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.desasignarComunidad(String(req.params.id), String(req.params.comunidadId)))
  } catch (e) { next(e) }
}

export async function mapaCalorHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.mapaCalorZona(String(req.params.id))) } catch (e) { next(e) }
}
