import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { prisma } from '../../shared/config/prisma'

const router = Router()

// Interna: vision service POST alertas
router.post('/alerta', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { camera_id, comunidad_id, tipo, duracion_seg, track_ids, snapshot_path } = req.body
    const alerta = await prisma.alertaComportamiento.create({
      data: {
        camera_id,
        comunidad_id,
        tipo,
        duracion_seg,
        track_ids: track_ids ?? [],
        snapshot_path,
      },
    })
    res.status(201).json(alerta)
  } catch (e) { next(e) }
})

router.use(authMiddleware)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tipo, reconocido, page = '1', limit = '20' } = req.query as Record<string, string>
    const where: Record<string, unknown> = {}
    if (tipo) where.tipo = tipo
    if (reconocido !== undefined) where.reconocido = reconocido === 'true'
    const p = parseInt(page), l = parseInt(limit)
    const [data, total] = await Promise.all([
      prisma.alertaComportamiento.findMany({
        where, orderBy: { created_at: 'desc' },
        skip: (p - 1) * l, take: l,
      }),
      prisma.alertaComportamiento.count({ where }),
    ])
    res.json({ data, total, page: p, limit: l, total_pages: Math.ceil(total / l) })
  } catch (e) { next(e) }
})

router.patch('/:id/reconocer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await prisma.alertaComportamiento.update({
      where: { id: String(req.params.id) },
      data: { reconocido: true },
    }))
  } catch (e) { next(e) }
})

export default router
