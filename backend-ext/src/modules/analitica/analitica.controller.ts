import { Request, Response, NextFunction } from 'express'
import * as service from './analitica.service'

export async function mapaCalorHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dias = parseInt(req.query.dias as string) || 30
    res.json(await service.mapaCalorGlobal(dias))
  } catch (e) { next(e) }
}

export async function patronesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.patronesTemporales(req.query.comunidad_id as string))
  } catch (e) { next(e) }
}

export async function tendenciasHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.tendencias()) } catch (e) { next(e) }
}

export async function rankingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const limite = parseInt(req.query.limite as string) || 10
    res.json(await service.rankingComunidades(limite))
  } catch (e) { next(e) }
}
