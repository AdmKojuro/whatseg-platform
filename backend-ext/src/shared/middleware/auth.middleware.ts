import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export interface TokenPayload {
  sub: string
  rol: string
  comunidad_id?: string
  puesto_id?: string | null
  iat?: number
  exp?: number
}

declare global {
  namespace Express {
    interface Request {
      admin?: TokenPayload
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload
    req.admin = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin || !roles.includes(req.admin.rol)) {
      res.status(403).json({ error: 'Acceso denegado' })
      return
    }
    next()
  }
}
