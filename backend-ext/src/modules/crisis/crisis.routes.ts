import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import { getRooms } from './crisis.service'

const router = Router()
router.use(authMiddleware)
router.use(requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE', 'CUADRANTE'))

router.get('/rooms', (req: Request, res: Response) => {
  res.json(getRooms())
})

export default router
