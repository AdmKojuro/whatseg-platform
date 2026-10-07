import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import { prisma } from '../../shared/config/prisma'
import * as service from './guardia.service'

const router = Router()
router.use(authMiddleware)

// Check-in del guarda (cualquier rol autenticado)
router.post('/checkin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tipo, notas } = req.body
    const result = await service.registrarCheckIn(req.admin!.sub, tipo ?? 'OK', notas)
    res.json(result)
  } catch (e) { next(e) }
})

router.get('/checkin/:guardiaId', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await service.historialCheckIn(String(req.params.guardiaId))) } catch (e) { next(e) }
  }
)

router.get('/estado', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await service.estadoGuardias()) } catch (e) { next(e) }
  }
)

router.get('/alertas', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resuelto = req.query.resuelto !== undefined
        ? req.query.resuelto === 'true' : undefined
      res.json(await service.listarAlertas(resuelto))
    } catch (e) { next(e) }
  }
)

router.patch('/alertas/:id/resolver', requireRole('SUPERADMIN', 'ADMIN', 'COMANDANTE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.resolverAlerta(String(req.params.id), req.admin!.sub))
    } catch (e) { next(e) }
  }
)

// Actualizar tipos de alarma de un cuadrante (solo SUPERADMIN / ADMIN)
router.put('/cuadrante/:id/tipos-emergencia', requireRole('SUPERADMIN', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const { tipos_emergencia } = req.body as { tipos_emergencia: string[] }
      if (!Array.isArray(tipos_emergencia)) {
        return res.status(400).json({ error: 'tipos_emergencia debe ser un array' })
      }
      await prisma.$executeRaw`
        UPDATE admins
        SET tipos_emergencia = ${tipos_emergencia}::text[],
            updated_at = NOW()
        WHERE id = ${id}::uuid
          AND rol = 'CUADRANTE'
      `
      return res.json({ ok: true })
    } catch (e) { next(e) }
  }
)

export default router
