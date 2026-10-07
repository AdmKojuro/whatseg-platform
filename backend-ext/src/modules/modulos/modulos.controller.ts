import { Request, Response, NextFunction } from 'express'
import * as repo from './modulos.repository'

// GET /mis-modulos — ADMIN/SUPERADMIN: módulos activos para sus comunidades
export async function getMisModulos(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidades = await repo.comunidadesDelAdmin(req.admin!.sub)
    const comunidad_ids = comunidades.map((c: any) => c.id)
    const modulos = await repo.modulosActivosPorComunidades(comunidad_ids)
    res.json(modulos)
  } catch (e) { next(e) }
}

// GET /comunidades-config — SUPERADMIN: todas las comunidades con módulos
export async function getComunidadesConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await repo.todasComunidadesConModulos()
    res.json(data)
  } catch (e) { next(e) }
}

// GET /comunidad/:id — SUPERADMIN: módulos de una comunidad
export async function getModulosComunidad(req: Request, res: Response, next: NextFunction) {
  try {
    const modulos = await repo.listarModulosComunidad(String(req.params.id))
    res.json(modulos)
  } catch (e) { next(e) }
}

// GET /comunidad/:id/activos — cualquier usuario autenticado: módulos activos (formato plano {modulo: bool})
export async function getModulosActivosComunidad(req: Request, res: Response, next: NextFunction) {
  try {
    const modulos = await repo.listarModulosComunidad(String(req.params.id))
    // Devolver objeto plano { RONDAS: true, REPORTES_PTT: false, ... }
    const resultado = modulos.reduce((acc: Record<string, boolean>, m: any) => {
      acc[m.modulo] = m.activo
      return acc
    }, {} as Record<string, boolean>)
    res.json(resultado)
  } catch (e) { next(e) }
}

// PUT /comunidad/:id — SUPERADMIN: actualizar módulos de una comunidad
export async function updateModulosComunidad(req: Request, res: Response, next: NextFunction) {
  try {
    const { modulos } = req.body
    if (!Array.isArray(modulos)) return res.status(400).json({ error: 'modulos debe ser un array' })
    const result = await repo.actualizarModulosComunidad(String(req.params.id), modulos)
    res.json(result)
  } catch (e) { next(e) }
}
