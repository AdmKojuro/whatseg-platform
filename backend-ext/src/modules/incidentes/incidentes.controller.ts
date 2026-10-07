import type { Request, Response, NextFunction } from 'express'
import * as repo from './incidentes.repository'
import type { CrearIncidenteDto, ActualizarIncidenteDto, FiltroIncidentes } from './incidentes.types'

export async function crearHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CrearIncidenteDto = req.body
    const created_by: string = (req as any).admin?.sub ?? 'system'
    const item = await repo.crearIncidente(data, created_by)
    res.status(201).json(item)
  } catch (e) { next(e) }
}

export async function listarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filtros: FiltroIncidentes = {
      comunidad_id: req.query.comunidad_id as string | undefined,
      estado:       req.query.estado as string | undefined,
      tipo:         req.query.tipo as string | undefined,
      severidad:    req.query.severidad as string | undefined,
      limit:        req.query.limit  ? Number(req.query.limit)  : 50,
      offset:       req.query.offset ? Number(req.query.offset) : 0,
    }
    const result = await repo.listarIncidentes(filtros)
    res.json(result)
  } catch (e) { next(e) }
}

export async function obtenerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await repo.obtenerIncidente(String(req.params.id))
    if (!item) return res.status(404).json({ message: 'Incidente no encontrado' })
    res.json(item)
  } catch (e) { next(e) }
}

export async function actualizarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data: ActualizarIncidenteDto = req.body
    const item = await repo.actualizarIncidente(String(req.params.id), data)
    res.json(item)
  } catch (e) { next(e) }
}

export async function eliminarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.eliminarIncidente(String(req.params.id))
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export async function timelineHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const eventos = await repo.obtenerTimeline(String(req.params.id))
    res.json({ incidente_id: req.params.id, total: eventos.length, eventos })
  } catch (e) { next(e) }
}
