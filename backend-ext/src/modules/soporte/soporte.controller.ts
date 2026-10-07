import { Request, Response, NextFunction } from 'express'
import * as service from './soporte.service'

// ─── Casos ─────────────────────────────────────────────────────────────────────

export async function crearCaso(req: Request, res: Response, next: NextFunction) {
  try {
    const { cliente_nombre, cliente_telefono, idioma = 'es', asunto, comunidad_id } = req.body
    if (!cliente_nombre || !asunto) {
      res.status(400).json({ error: 'cliente_nombre y asunto son requeridos' })
      return
    }
    const payload = req.admin as any
    // Resolver comunidad: usar la del body o la del JWT
    let cid: string | null = comunidad_id || payload?.comunidad_id || null
    if (!cid && payload?.rol === 'ADMIN') {
      cid = await service.comunidadDelAdmin(String(payload.sub))
    }
    const caso = await service.crearCaso({
      comunidad_id:     cid,
      cliente_nombre:   String(cliente_nombre).trim(),
      cliente_telefono: cliente_telefono ? String(cliente_telefono).trim() : null,
      idioma:           String(idioma).toLowerCase().slice(0, 5),
      asunto:           String(asunto).slice(0, 300),
    })
    res.status(201).json(caso)
  } catch (err) { next(err) }
}

export async function listarCasos(req: Request, res: Response, next: NextFunction) {
  try {
    const { estado, idioma, q, comunidad_id, limit = '50', offset = '0' } = req.query as any
    const payload = req.admin as any

    let cid: string | undefined = comunidad_id || undefined
    // Si es ADMIN sin comunidad_id en query, filtrar por su comunidad
    if (!cid && payload?.rol === 'ADMIN') {
      const found = await service.comunidadDelAdmin(String(payload.sub))
      if (found) cid = found
    }

    const result = await service.listarCasos({
      estado:       estado   || undefined,
      comunidad_id: cid,
      idioma:       idioma   || undefined,
      q:            q        || undefined,
      limit:  parseInt(limit),
      offset: parseInt(offset),
    })
    res.json(result)
  } catch (err) { next(err) }
}

export async function obtenerCaso(req: Request, res: Response, next: NextFunction) {
  try {
    const caso = await service.obtenerCaso(String(req.params.id))
    if (!caso) { res.status(404).json({ error: 'Caso no encontrado' }); return }
    res.json(caso)
  } catch (err) { next(err) }
}

export async function atenderCaso(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.admin as any
    const atendido_por = payload?.nombre ?? payload?.sub ?? 'Agente'
    await service.atenderCaso(String(req.params.id), String(atendido_por))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function cerrarCaso(req: Request, res: Response, next: NextFunction) {
  try {
    const { notas } = req.body
    await service.cerrarCaso(String(req.params.id), notas ? String(notas).slice(0, 1000) : undefined)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function reabrirCaso(req: Request, res: Response, next: NextFunction) {
  try {
    await service.reabrirCaso(String(req.params.id))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function eliminarCaso(req: Request, res: Response, next: NextFunction) {
  try {
    await service.eliminarCaso(String(req.params.id))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ─── Mensajes ──────────────────────────────────────────────────────────────────

export async function listarMensajes(req: Request, res: Response, next: NextFunction) {
  try {
    const mensajes = await service.listarMensajes(String(req.params.id))
    res.json(mensajes)
  } catch (err) { next(err) }
}

export async function crearMensaje(req: Request, res: Response, next: NextFunction) {
  try {
    const { texto_original, idioma_origen = 'es', autor = 'AGENTE', texto_traducido, idioma_destino } = req.body
    if (!texto_original) {
      res.status(400).json({ error: 'texto_original requerido' })
      return
    }
    const msg = await service.crearMensaje({
      caso_id:        String(req.params.id),
      autor:          String(autor),
      texto_original: String(texto_original).slice(0, 4000),
      idioma_origen:  String(idioma_origen).toLowerCase().slice(0, 5),
      texto_traducido: texto_traducido ? String(texto_traducido).slice(0, 4000) : null,
      idioma_destino:  idioma_destino  ? String(idioma_destino).toLowerCase().slice(0, 5) : null,
    })
    res.status(201).json(msg)
  } catch (err) { next(err) }
}

export async function eliminarMensaje(req: Request, res: Response, next: NextFunction) {
  try {
    await service.eliminarMensaje(String(req.params.msgId))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ─── WhatsApp (Baileys) ────────────────────────────────────────────────────────

export async function waStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { getWAStatus } = await import('./soporte.wa')
    res.json(getWAStatus())
  } catch (err) { next(err) }
}

export async function waSend(req: Request, res: Response, next: NextFunction) {
  try {
    const { sendWAMessage } = await import('./soporte.wa')
    const { texto, texto_original, idioma_origen, texto_traducido, idioma_destino } = req.body
    const caso = await service.obtenerCaso(String(req.params.id))
    if (!caso) { res.status(404).json({ error: 'Caso no encontrado' }); return }
    if (!caso.cliente_telefono) { res.status(400).json({ error: 'El caso no tiene teléfono de cliente' }); return }
    await sendWAMessage(caso.id, String(caso.cliente_telefono), {
      textoWA:        String(texto).slice(0, 4000),
      textoOriginal:  String(texto_original || texto).slice(0, 4000),
      idiomaOrigen:   idioma_origen  ? String(idioma_origen)  : 'es',
      textoTraducido: texto_traducido ? String(texto_traducido).slice(0, 4000) : null,
      idiomaDest:     idioma_destino  ? String(idioma_destino) : null,
    })
    res.json({ ok: true })
  } catch (err: any) { res.status(500).json({ error: err?.message ?? 'Error WA' }) }
}

export async function waLogout(req: Request, res: Response, next: NextFunction) {
  try {
    const { logoutWA } = await import('./soporte.wa')
    await logoutWA()
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function waInit(req: Request, res: Response, next: NextFunction) {
  try {
    const { initBotonWA } = await import('./soporte.wa')
    initBotonWA()   // no await — es un proceso asíncrono largo
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ─── Stats & utilidades ────────────────────────────────────────────────────────

export async function statsCasos(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.admin as any
    let cid: string | null = (req.query.comunidad_id as string) || null
    if (!cid && payload?.rol === 'ADMIN') {
      cid = await service.comunidadDelAdmin(String(payload.sub))
    }
    res.json(await service.statsCasos(cid))
  } catch (err) { next(err) }
}

export async function listarComunidades(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.admin as any
    const admin_id = payload?.rol === 'ADMIN' ? String(payload.sub) : null
    res.json(await service.listarComunidades(admin_id))
  } catch (err) { next(err) }
}
