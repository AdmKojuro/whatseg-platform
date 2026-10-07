import { Request, Response, NextFunction } from 'express'
import * as service from './evidencia.service'
import path from 'path'
import os from 'os'

export async function registrarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const ev = await service.registrar({ ...req.body, firmado_por: req.admin!.sub })
    res.status(201).json(ev)
  } catch (e) { next(e) }
}

export async function verificarHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.verificar(String(req.params.id))) } catch (e) { next(e) }
}

export async function listarPorActivacionHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listarPorActivacion(String(req.params.id))) } catch (e) { next(e) }
}

export async function listarPorAlertaHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listarPorAlertaIA(String(req.params.id))) } catch (e) { next(e) }
}

export async function exportarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { ids } = req.body as { ids: string[] }
    const outPath = path.join(os.tmpdir(), `evidencias_${Date.now()}.zip`)
    await service.exportarPaquete(ids, outPath)
    res.download(outPath, 'paquete_evidencias.zip')
  } catch (e) { next(e) }
}
