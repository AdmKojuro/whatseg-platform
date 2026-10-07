import { Request, Response, NextFunction } from 'express'
import * as service from './panel.service'

export async function alertasActivasHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.alertasActivas()) } catch (e) { next(e) }
}

export async function despachosActivosHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.despachosActivos()) } catch (e) { next(e) }
}

export async function metricasHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.metricasTurno()) } catch (e) { next(e) }
}

export async function exportarSiesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const desde = new Date(req.query.desde as string || new Date().setDate(1))
    const hasta = new Date(req.query.hasta as string || Date.now())
    const csv = await service.exportarReporteSies(desde, hasta)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="reporte_sies_${Date.now()}.csv"`)
    res.send('\uFEFF' + csv) // BOM para Excel
  } catch (e) { next(e) }
}
