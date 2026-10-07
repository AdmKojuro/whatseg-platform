import { Request, Response, NextFunction } from 'express'
import * as service from './boton.service'

// ─── Auth particulares ────────────────────────────────────────────────────────

export async function loginParticular(req: Request, res: Response, next: NextFunction) {
  try {
    const { telefono, password } = req.body
    if (!telefono || !password) {
      res.status(400).json({ error: 'telefono y password requeridos' })
      return
    }
    const result = await service.loginParticular(String(telefono).trim(), String(password))
    res.json(result)
  } catch (err: any) {
    res.status(401).json({ error: err?.message ?? 'Error de autenticación' })
  }
}

// ─── Eventos ─────────────────────────────────────────────────────────────────

export async function crearEvento(req: Request, res: Response, next: NextFunction) {
  try {
    const { tipo = 'PANICO', lat, lng, descripcion } = req.body
    const usuario = req.admin!
    const evento = await service.crearEvento({
      usuario_id:     usuario.sub,
      usuario_nombre: (usuario as any).nombre ?? 'Usuario',
      usuario_tipo:   usuario.rol === 'PARTICULAR' ? 'PARTICULAR' : 'GUARDIA',
      comunidad_id:   (usuario as any).comunidad_id ?? null,
      tipo:           String(tipo),
      lat:            lat != null ? parseFloat(String(lat)) : null,
      lng:            lng != null ? parseFloat(String(lng)) : null,
      descripcion:    descripcion ? String(descripcion).slice(0, 500) : null,
    })
    res.status(201).json(evento)
  } catch (err) { next(err) }
}

export async function listarEventos(req: Request, res: Response, next: NextFunction) {
  try {
    const { estado, tipo, comunidad_id: qComunidadId, limit = '50', offset = '0' } = req.query as any
    const payload = req.admin as any

    // Para rol ADMIN: forzar su comunidad_id (no puede ver otras)
    let comunidad_id = qComunidadId || undefined
    if (payload?.rol === 'ADMIN') {
      const adminCom = payload?.comunidad_id ?? await service.comunidadDelAdmin(String(payload.sub))
      comunidad_id = adminCom ?? undefined
    }

    const result = await service.listarEventos({
      estado:       estado   || undefined,
      tipo:         tipo     || undefined,
      comunidad_id,
      limit:  parseInt(limit),
      offset: parseInt(offset),
    })
    res.json(result)
  } catch (err) { next(err) }
}

export async function obtenerEvento(req: Request, res: Response, next: NextFunction) {
  try {
    const evento = await service.obtenerEvento(String(req.params.id))
    if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return }
    res.json(evento)
  } catch (err) { next(err) }
}

export async function atenderEvento(req: Request, res: Response, next: NextFunction) {
  try {
    const atendido_por = (req.admin as any)?.nombre ?? req.admin!.sub
    await service.atenderEvento(String(req.params.id), String(atendido_por))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function cerrarEvento(req: Request, res: Response, next: NextFunction) {
  try {
    const { notas = '' } = req.body
    await service.cerrarEvento(String(req.params.id), String(notas).slice(0, 1000))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function eliminarEvento(req: Request, res: Response, next: NextFunction) {
  try {
    await service.eliminarEvento(String(req.params.id))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ─── Particulares ─────────────────────────────────────────────────────────────

export async function listarParticulares(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await service.listarParticulares()
    res.json(items)
  } catch (err) { next(err) }
}

export async function crearParticular(req: Request, res: Response, next: NextFunction) {
  try {
    const { nombre, telefono, password, direccion } = req.body
    if (!nombre || !telefono || !password) {
      res.status(400).json({ error: 'nombre, telefono y password requeridos' })
      return
    }
    const p = await service.crearParticular({
      nombre: String(nombre).trim(),
      telefono: String(telefono).trim(),
      password: String(password),
      direccion: direccion ? String(direccion) : undefined,
    })
    res.status(201).json(p)
  } catch (err: any) {
    if (err?.message?.includes('unique') || err?.code === '23505') {
      res.status(409).json({ error: 'Teléfono ya registrado' })
    } else {
      next(err)
    }
  }
}

export async function actualizarParticular(req: Request, res: Response, next: NextFunction) {
  try {
    await service.actualizarParticular(String(req.params.id), req.body)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function eliminarParticular(req: Request, res: Response, next: NextFunction) {
  try {
    await service.eliminarParticular(String(req.params.id))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ─── Mapa ─────────────────────────────────────────────────────────────────────

export async function mapaData(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.admin as any
    // JWT de backend-ext (rondas/PTT) incluye comunidad_id directamente
    let comunidad_id: string | null = payload?.comunidad_id ?? null
    // JWT del backend principal solo tiene sub+rol → buscar en admins_comunidades
    if (!comunidad_id && payload?.rol === 'ADMIN') {
      comunidad_id = await service.comunidadDelAdmin(String(payload.sub))
    }
    res.json(await service.mapaData(comunidad_id))
  } catch (err) { next(err) }
}
