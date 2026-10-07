import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as service from './federacion.service'

const router = Router()

// Interna: recibe patrones de comunidades remotas (verificado por HMAC)
router.post('/recibir', async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await service.recibirPatron(req.body)) } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.use(authMiddleware)
router.use(requireRole('SUPERADMIN', 'ADMIN'))

router.get('/pares', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await service.listarPares()) } catch (e) { next(e) }
})

router.post('/pares', async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await service.crearPar(req.body)) } catch (e) { next(e) }
})

router.patch('/pares/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await service.activarPar(String(req.params.id), req.body.activa ?? true))
  } catch (e) { next(e) }
})

router.delete('/pares/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await service.eliminarPar(String(req.params.id))) } catch (e) { next(e) }
})

router.get('/patrones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await service.listarPatrones(req.query.federacion_id as string))
  } catch (e) { next(e) }
})

// Cotejar embedding propio contra patrones federados
router.post('/cotejar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { embedding } = req.body as { embedding: number[] }
    if (!Array.isArray(embedding)) return void res.status(400).json({ error: 'embedding requerido' })
    res.json(await service.cotejarEmbedding(embedding))
  } catch (e) { next(e) }
})

export default router
