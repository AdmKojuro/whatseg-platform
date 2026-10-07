import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as service from './prediccion.service'

const router = Router()
router.use(authMiddleware)
router.use(requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE'))

router.get('/scoring', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await service.scoringTurno(req.query.zona_id as string)) } catch (e) { next(e) }
})

router.get('/patrones', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await service.patronesTemporales(req.query.comunidad_id as string)) } catch (e) { next(e) }
})

router.get('/ruta-patrulla', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const zona_id = String(req.query.zona_id ?? '')
    if (!zona_id) return void res.status(400).json({ error: 'zona_id requerido' })
    res.json(await service.rutaPatrullaOptima(zona_id))
  } catch (e) { next(e) }
})

export default router
