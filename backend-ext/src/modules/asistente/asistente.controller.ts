import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../shared/config/prisma'
import * as repo    from './asistente.repository'
import * as service from './asistente.service'

// ─── Health IA ───────────────────────────────────────────────────────────────

export async function health(_req: Request, res: Response, next: NextFunction) {
  try {
    const status = await service.healthIA()
    res.json(status)
  } catch (e) { next(e) }
}

// ─── Listar reportes con datos IA ────────────────────────────────────────────

export async function listarReportes(req: Request, res: Response, next: NextFunction) {
  try {
    const { comunidad_id, limit, offset } = req.query as Record<string, string>
    const admin = req.admin!

    const guardia_id = (admin.rol === 'GUARDIA') ? admin.sub : undefined

    const result = await repo.listarReportesConIA({
      comunidad_id,
      guardia_id,
      limit:  limit  ? parseInt(limit)  : 30,
      offset: offset ? parseInt(offset) : 0,
    })
    res.json(result)
  } catch (e) { next(e) }
}

// ─── Procesar manualmente un reporte ─────────────────────────────────────────

export async function procesarReporte(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id)

    const rows: any[] = await prisma.$queryRaw`
      SELECT id, archivo_path FROM reportes_ptt WHERE id = ${id}
    `

    if (!rows[0]) return res.status(404).json({ error: 'Reporte no encontrado' })

    await repo.crearReporteIA(id)
    service.procesarReporte(id, rows[0].archivo_path).catch(() => {})

    res.json({ ok: true, mensaje: 'Procesamiento iniciado' })
  } catch (e) { next(e) }
}

// ─── Chatbot (stream SSE) ─────────────────────────────────────────────────────

export async function chat(req: Request, res: Response, next: NextFunction) {
  try {
    const { pregunta, comunidad_id } = req.body
    if (!pregunta) return res.status(400).json({ error: 'pregunta requerida' })

    const comunidadId = String(comunidad_id || (req.admin as any)?.comunidad_id || '')
    const contexto    = await repo.ultimosReportesParaContexto(comunidadId, 20)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    for await (const tok of service.chatStream(pregunta, contexto)) {
      res.write(`data: ${JSON.stringify({ token: tok })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (e) {
    if (!res.headersSent) next(e)
    else res.end()
  }
}

// ─── Obtener datos IA de un reporte ──────────────────────────────────────────

export async function obtenerIA(req: Request, res: Response, next: NextFunction) {
  try {
    const ia = await repo.obtenerReporteIA(String(req.params.id))
    if (!ia) return res.status(404).json({ error: 'No procesado aún' })
    res.json(ia)
  } catch (e) { next(e) }
}

// ─── Comunicados programados ──────────────────────────────────────────────────

export async function listarComunicados(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = req.admin!
    const comunidad_id = String(req.query.comunidad_id || (admin as any).comunidad_id || '')
    if (!comunidad_id) return res.status(400).json({ error: 'comunidad_id requerido' })
    const items = await repo.listarComunicados(comunidad_id)
    res.json({ items })
  } catch (e) { next(e) }
}

export async function crearComunicado(req: Request, res: Response, next: NextFunction) {
  try {
    const { comunidad_id, titulo, mensaje, tipo_contenido = 'MANUAL', frecuencia = 'UNICO', hora_envio, dias_semana } = req.body
    if (!comunidad_id || !titulo || !mensaje) return res.status(400).json({ error: 'comunidad_id, titulo y mensaje requeridos' })
    const proximo_envio = service.calcularProximoEnvioPublico({ frecuencia, hora_envio, dias_semana })
    await repo.crearComunicado({ comunidad_id, titulo, mensaje, tipo_contenido, frecuencia, hora_envio, dias_semana, proximo_envio })
    res.json({ ok: true, proximo_envio })
  } catch (e) { next(e) }
}

export async function editarComunicado(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id)
    const { titulo, mensaje, tipo_contenido, frecuencia, hora_envio, dias_semana, activo } = req.body
    let proximo_envio: Date | null | undefined
    if (frecuencia || hora_envio || dias_semana) {
      proximo_envio = service.calcularProximoEnvioPublico({ frecuencia: frecuencia || 'UNICO', hora_envio, dias_semana })
    }
    await repo.actualizarComunicado(id, { titulo, mensaje, tipo_contenido, frecuencia, hora_envio, dias_semana, activo, proximo_envio })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export async function borrarComunicado(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.eliminarComunicado(String(req.params.id))
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export async function enviarAhora(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id)
    service.procesarComunicadoById(id).catch((err) => {
      console.error('[COMUNICADOS] enviarAhora error:', err?.message ?? err)
    })
    res.json({ ok: true, mensaje: 'Enviando comunicado...' })
  } catch (e) { next(e) }
}
