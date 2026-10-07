import { Request, Response, NextFunction } from 'express'
import * as service from './rondas.service'
import * as repo from './rondas.repository'
import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'

// ─── COMUNIDADES ──────────────────────────────────────────────────────────

export async function misComunidades(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.misComunidades(req.admin!.sub))
  } catch (e) { next(e) }
}

// ─── PUESTOS ──────────────────────────────────────────────────────────────

export async function listarPuestos(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidad_id = req.query.comunidad_id as string
    if (!comunidad_id) return res.status(400).json({ error: 'comunidad_id requerido' })
    res.json(await service.listarPuestos(comunidad_id))
  } catch (e) { next(e) }
}

export async function crearPuesto(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await service.crearPuesto(req.body))
  } catch (e) { next(e) }
}

export async function actualizarPuesto(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.actualizarPuesto(String(req.params.id), req.body))
  } catch (e) { next(e) }
}

export async function eliminarPuesto(req: Request, res: Response, next: NextFunction) {
  try {
    await service.eliminarPuesto(String(req.params.id))
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// ─── RUTAS ─────────────────────────────────────────────────────────────────

export async function listarRutas(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidad_id = req.query.comunidad_id as string | undefined
    res.json(await service.listarRutas(req.admin!.rol, (req.admin as any).puesto_id, comunidad_id))
  } catch (e) { next(e) }
}

export async function obtenerRuta(req: Request, res: Response, next: NextFunction) {
  try {
    const ruta = await service.obtenerRuta(String(req.params.id))
    if (!ruta) return res.status(404).json({ error: 'Ruta no encontrada' })
    res.json(ruta)
  } catch (e) { next(e) }
}

export async function crearRuta(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await service.crearRuta(req.body))
  } catch (e) { next(e) }
}

export async function actualizarRuta(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.actualizarRuta(String(req.params.id), req.body))
  } catch (e) { next(e) }
}

export async function eliminarRuta(req: Request, res: Response, next: NextFunction) {
  try {
    await service.eliminarRuta(String(req.params.id))
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// ─── CHECKPOINTS ───────────────────────────────────────────────────────────

export async function listarCheckpoints(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listarCheckpoints(String(req.params.rutaId)))
  } catch (e) { next(e) }
}

export async function crearCheckpoint(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await service.crearCheckpoint(String(req.params.rutaId), req.body))
  } catch (e) { next(e) }
}

export async function actualizarCheckpoint(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.actualizarCheckpoint(String(req.params.id), req.body))
  } catch (e) { next(e) }
}

export async function eliminarCheckpoint(req: Request, res: Response, next: NextFunction) {
  try {
    await service.eliminarCheckpoint(String(req.params.id))
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export async function obtenerCheckpointQR(req: Request, res: Response, next: NextFunction) {
  try {
    const cp = await service.obtenerCheckpoint(String(req.params.id))
    if (!cp) return res.status(404).json({ error: 'Checkpoint no encontrado' })
    res.json({ qr_code: cp.qr_code, nombre: cp.nombre })
  } catch (e) { next(e) }
}

// ─── EJECUCIÓN ─────────────────────────────────────────────────────────────

export async function iniciarRonda(req: Request, res: Response, next: NextFunction) {
  try {
    const { foto_base64, ruta_id } = req.body
    let foto_verificacion_url: string | undefined

    if (foto_base64) {
      try {
        const b64 = String(foto_base64).replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(b64, 'base64')
        const uploadDir = path.join(process.cwd(), 'uploads', 'verificaciones')
        await fs.mkdir(uploadDir, { recursive: true })
        const fileName = `${randomUUID()}.jpg`
        await fs.writeFile(path.join(uploadDir, fileName), buffer)
        foto_verificacion_url = `/uploads/verificaciones/${fileName}`
      } catch (err) {
        console.error('[RONDAS] Error guardando foto verificación:', err)
      }
    }

    const result = await service.iniciarRonda(req.admin!.sub, ruta_id, req.admin!.rol, (req.admin as any).puesto_id, foto_verificacion_url)
    res.status(201).json(result)
  } catch (e) { next(e) }
}

export async function marcarCheckpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const { foto_base64, ...dto } = req.body

    // Decodificar y guardar foto si viene en base64
    if (foto_base64) {
      try {
        const b64 = String(foto_base64).replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(b64, 'base64')
        const uploadDir = path.join(process.cwd(), 'uploads', 'rondas')
        await fs.mkdir(uploadDir, { recursive: true })
        const fileName = `${randomUUID()}.jpg`
        await fs.writeFile(path.join(uploadDir, fileName), buffer)
        dto.foto_url = `/uploads/rondas/${fileName}`
      } catch (err) {
        console.error('[RONDAS] Error guardando foto:', err)
        // Continúa sin foto si falla el guardado
      }
    }

    const result = await service.marcarCheckpoint(req.admin!.sub, dto, req.admin!.rol, (req.admin as any).puesto_id)
    res.json(result)
  } catch (e) { next(e) }
}

export async function finalizarRonda(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.finalizarRonda(req.admin!.sub, String(req.params.ejecucionId), req.body.notas)
    res.json(result)
  } catch (e) { next(e) }
}

export async function rondaActiva(req: Request, res: Response, next: NextFunction) {
  try {
    const activa = await service.rondaActiva(req.admin!.sub, req.admin!.rol, (req.admin as any).puesto_id)
    res.json(activa ?? { activa: false })
  } catch (e) { next(e) }
}

export async function getPuestoCheckpoints(req: Request, res: Response, next: NextFunction) {
  try { res.json(await repo.getPuestoCheckpoints(String(req.params.id))) }
  catch (e) { next(e) }
}

export async function setPuestoCheckpoints(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.setPuestoCheckpoints(String(req.params.id), req.body.checkpoint_ids ?? [])
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// ─── HISTORIAL Y MONITOREO ────────────────────────────────────────────────

export async function rondasEnCurso(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidad_id = (req.admin as any)?.comunidad_id as string | undefined
    res.json(await service.rondasEnCurso(comunidad_id))
  } catch (e) { next(e) }
}

export async function listarEjecuciones(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listarEjecuciones({
      comunidad_id: req.query.comunidad_id as string,
      guardia_id: req.query.guardia_id as string,
      estado: req.query.estado as string,
      desde: req.query.desde as string,
      hasta: req.query.hasta as string,
    }))
  } catch (e) { next(e) }
}

export async function detalleEjecucion(req: Request, res: Response, next: NextFunction) {
  try {
    const detalle = await service.detalleEjecucion(String(req.params.id))
    if (!detalle) return res.status(404).json({ error: 'Ejecución no encontrada' })
    res.json(detalle)
  } catch (e) { next(e) }
}

export async function estadisticas(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidad_id = req.query.comunidad_id as string | undefined
    res.json(await service.estadisticas(comunidad_id))
  } catch (e) { next(e) }
}

// ─── GPS TRACK ─────────────────────────────────────────────────────────────

export async function getGpsTrack(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await repo.trackGps(String(req.params.id)))
  } catch (e) { next(e) }
}

// ─── PDF EXPORT ─────────────────────────────────────────────────────────────

export async function exportarPDF(req: Request, res: Response, next: NextFunction) {
  try {
    const detalle = await service.detalleEjecucion(String(req.params.id))
    if (!detalle) return res.status(404).json({ error: 'Ejecución no encontrada' })

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit')
    const doc = new PDFDocument({ margin: 40, size: 'A4' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="ronda-${(detalle as any).id}.pdf"`)
    doc.pipe(res)

    const d = detalle as any
    const inicio = new Date(d.inicio_at)
    const fin    = d.fin_at ? new Date(d.fin_at) : null
    const durMin = fin ? Math.round((fin.getTime() - inicio.getTime()) / 60_000) : null

    // ── Encabezado ───────────────────────────────────────────────────────────
    doc.fontSize(18).font('Helvetica-Bold')
       .text('Reporte de Ronda de Seguridad', { align: 'center' })
    doc.moveDown(0.4)
    doc.fontSize(10).font('Helvetica').fillColor('#555555')
       .text(`Ruta:    ${d.ruta?.nombre ?? '-'}`, 40)
       .text(`Estado:  ${d.estado}`)
       .text(`Inicio:  ${inicio.toLocaleString('es-CO')}`)
    if (fin) doc.text(`Fin:     ${fin.toLocaleString('es-CO')}`)
    if (durMin != null) doc.text(`Duración: ${durMin} min`)
    doc.text(`Progreso: ${d.checkpoints_marcados}/${d.checkpoints_total} checkpoints`)

    // ── Checkpoints visitados ─────────────────────────────────────────────────
    doc.moveDown().fontSize(12).font('Helvetica-Bold').fillColor('#000000')
       .text('Checkpoints visitados:')
    doc.moveDown(0.3)
    doc.fontSize(9).font('Helvetica').fillColor('#333333')

    const visitas: any[] = d.visitas ?? []
    if (visitas.length === 0) {
      doc.text('  (ninguno)')
    } else {
      for (const v of visitas) {
        const hora = new Date(v.marcado_at).toLocaleString('es-CO')
        const latStr = v.latitud  != null ? Number(v.latitud).toFixed(5)  : '-'
        const lngStr = v.longitud != null ? Number(v.longitud).toFixed(5) : '-'
        doc.text(`  • ${v.checkpoint?.nombre ?? '-'}   ${hora}   ${v.metodo ?? '-'}   GPS: (${latStr}, ${lngStr})`)
        if (v.notas) doc.text(`      Notas: ${v.notas}`, { indent: 20 })
      }
    }

    // ── Checkpoints pendientes ───────────────────────────────────────────────
    const allCps: any[] = d.ruta?.checkpoints ?? []
    const visitedIds = new Set(visitas.map((v: any) => String(v.checkpoint_id)))
    const pendientes = allCps.filter(cp => !visitedIds.has(String(cp.id)))
    if (pendientes.length > 0) {
      doc.moveDown().fontSize(12).font('Helvetica-Bold').fillColor('#cc3333')
         .text('Checkpoints NO visitados:')
      doc.fontSize(9).font('Helvetica').fillColor('#cc3333')
      for (const cp of pendientes) doc.text(`  • ${cp.nombre}`)
    }

    // ── Resumen ──────────────────────────────────────────────────────────────
    const cumplimiento = d.checkpoints_total > 0
      ? Math.round(d.checkpoints_marcados / d.checkpoints_total * 100) : 0
    doc.moveDown().fontSize(10).font('Helvetica-Bold').fillColor('#000000')
       .text(`Cumplimiento: ${cumplimiento}%`)

    doc.end()
  } catch (e) { next(e) }
}

// ─── USUARIOS (Personal de seguridad) ────────────────────────────────────

export async function loginRonda(req: Request, res: Response, next: NextFunction) {
  try {
    const { cedula, password } = req.body
    if (!cedula || !password) return res.status(400).json({ error: 'Cédula y contraseña son requeridos' })
    const result = await service.loginRonda(cedula, password)
    res.json(result)
  } catch (e: any) {
    if (e.message === 'Credenciales inválidas') return res.status(401).json({ error: e.message })
    next(e)
  }
}

export async function listarPersonal(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidad_id = req.query.comunidad_id as string
    if (!comunidad_id) return res.status(400).json({ error: 'comunidad_id requerido' })
    const personal = await service.listarPersonal(comunidad_id)
    // No devolver password_hash
    res.json(personal.map((u: any) => { const { password_hash, ...rest } = u; return rest }))
  } catch (e) { next(e) }
}

export async function crearPersonal(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.crearPersonal(req.body, req.admin!.sub)
    const { password_hash, ...rest } = result as any
    res.status(201).json(rest)
  } catch (e: any) {
    if (e.message?.includes('cédula')) return res.status(409).json({ error: e.message })
    next(e)
  }
}

export async function actualizarPersonal(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.actualizarPersonal(String(req.params.id), req.body)
    const { password_hash, ...rest } = result as any
    res.json(rest)
  } catch (e) { next(e) }
}

export async function eliminarPersonal(req: Request, res: Response, next: NextFunction) {
  try {
    await service.eliminarPersonal(String(req.params.id))
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export async function eliminarEjecucion(req: Request, res: Response, next: NextFunction) {
  try {
    await service.eliminarEjecucion(String(req.params.id))
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// ─── PLANO DE PLANTA DEL PUESTO ───────────────────────────────────────────────

export async function getPuestoPlano(req: Request, res: Response, next: NextFunction) {
  try {
    const plano = await repo.getPuestoPlano(String(req.params.id))
    res.json(plano ?? { sin_plano: true })
  } catch (e) { next(e) }
}

export async function uploadPuestoPlano(req: Request, res: Response, next: NextFunction) {
  try {
    const { foto_base64, ancho, alto } = req.body
    if (!foto_base64) return res.status(400).json({ error: 'foto_base64 requerido' })

    const b64 = String(foto_base64).replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(b64, 'base64')
    const uploadDir = path.join(process.cwd(), 'uploads', 'planos')
    await fs.mkdir(uploadDir, { recursive: true })
    const ext = foto_base64.includes('png') ? 'png' : 'jpg'
    const fileName = `${randomUUID()}.${ext}`
    await fs.writeFile(path.join(uploadDir, fileName), buffer)
    const imagen_url = `/uploads/planos/${fileName}`

    await repo.upsertPuestoPlano(String(req.params.id), {
      imagen_url,
      ancho: Number(ancho) || 1000,
      alto:  Number(alto)  || 800,
    })
    res.json({ imagen_url })
  } catch (e) { next(e) }
}

export async function calibratePuestoPlano(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.updatePuestoPlanoCalibration(String(req.params.id), req.body)
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export async function getPuestoPlanoCheckpoints(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await repo.getPuestoPlanoCheckpoints(String(req.params.id)))
  } catch (e) { next(e) }
}

export async function setPuestoPlanoCheckpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const { checkpoint_id, px, py } = req.body
    if (!checkpoint_id || px == null || py == null) return res.status(400).json({ error: 'checkpoint_id, px, py requeridos' })
    await repo.setPuestoPlanoCheckpoint(String(req.params.id), checkpoint_id, Number(px), Number(py))
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export async function savePuestoPlanoJson(req: Request, res: Response, next: NextFunction) {
  try {
    const { plano_json } = req.body
    if (!plano_json) return res.status(400).json({ error: 'plano_json requerido' })
    await repo.savePuestoPlanoJson(String(req.params.id), JSON.stringify(plano_json))
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// ─── PROGRAMACIONES DE RONDA ────────────────────────────────────────────────

export async function listarProgramaciones(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidad_id = req.query.comunidad_id as string ?? (req.admin as any)?.comunidad_id
    if (!comunidad_id) return res.status(400).json({ error: 'comunidad_id requerido' })
    res.json(await service.listarProgramaciones(comunidad_id))
  } catch (e) { next(e) }
}

export async function crearProgramacion(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.crearProgramacion(req.body)
    res.status(201).json(result)
  } catch (e) { next(e) }
}

export async function actualizarProgramacion(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.actualizarProgramacion(String(req.params.id), req.body)
    res.json(result)
  } catch (e) { next(e) }
}

export async function eliminarProgramacion(req: Request, res: Response, next: NextFunction) {
  try {
    await service.eliminarProgramacion(String(req.params.id))
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export async function listarAlertasRonda(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidad_id = req.query.comunidad_id as string ?? (req.admin as any)?.comunidad_id
    if (!comunidad_id) return res.status(400).json({ error: 'comunidad_id requerido' })
    res.json(await service.listarAlertasRonda(comunidad_id))
  } catch (e) { next(e) }
}

export async function verificarProgramaciones(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidad_id = req.query.comunidad_id as string | undefined
    const vencidas = await service.verificarProgramacionesVencidas(comunidad_id)
    res.json(vencidas)
  } catch (e) { next(e) }
}

// ─── CHECKPOINT CAMPOS (Formularios configurables) ──────────────────────────

export async function getCamposCheckpoint(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.getCamposCheckpoint(String(req.params.id)))
  } catch (e) { next(e) }
}

export async function setCamposCheckpoint(req: Request, res: Response, next: NextFunction) {
  try {
    await service.setCamposCheckpoint(String(req.params.id), req.body.campos ?? [])
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export async function getRespuestasVisita(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.getRespuestasVisita(String(req.params.id)))
  } catch (e) { next(e) }
}

export async function guardarRespuestasVisita(req: Request, res: Response, next: NextFunction) {
  try {
    await service.guardarRespuestas(String(req.params.id), req.body.respuestas ?? [])
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// ─── NFC TARJETAS ────────────────────────────────────────────────────────────

export async function listarNFCHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidad_id = req.query.comunidad_id as string | undefined
    const rows = await repo.listarTarjetasNFC(comunidad_id)
    res.json(rows)
  } catch (e) { next(e) }
}

export async function crearNFCHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await repo.crearTarjetaNFC(req.body)
    res.status(201).json(item)
  } catch (e) { next(e) }
}

export async function actualizarNFCHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await repo.actualizarTarjetaNFC(String(req.params.id), req.body)
    res.json(item)
  } catch (e) { next(e) }
}

export async function eliminarNFCHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.eliminarTarjetaNFC(String(req.params.id))
    res.json({ ok: true })
  } catch (e) { next(e) }
}
