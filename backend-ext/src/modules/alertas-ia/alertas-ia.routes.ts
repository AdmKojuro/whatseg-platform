import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import * as service from './alertas-ia.service'
import { Request, Response, NextFunction } from 'express'

const router = Router()

// Ruta interna: recibe alertas del vision service (sin auth de usuario)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await service.recibirDeVision(req.body)) } catch (e) { next(e) }
})

router.use(authMiddleware)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tipo, comunidad_id, reconocido, page, limit } = req.query as Record<string, string>
    res.json(await service.listar({
      tipo,
      comunidad_id,
      reconocido: reconocido !== undefined ? reconocido === 'true' : undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    }))
  } catch (e) { next(e) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await service.obtenerPorId(String(req.params.id))) } catch (e) { next(e) }
})

router.patch('/:id/reconocer', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await service.reconocer(String(req.params.id))) } catch (e) { next(e) }
})

export default router
