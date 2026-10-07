import { Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import * as repo from './reportes-ptt.repository'

const UPLOAD_DIR = process.env.PTT_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'reportes-ptt')

// ─── Auth guardia ─────────────────────────────────────────────────────────
export async function loginGuardia(req: Request, res: Response, next: NextFunction) {
  try {
    const { cedula, password } = req.body
    if (!cedula || !password) return res.status(400).json({ error: 'cedula y password requeridos' })
    const result = await repo.loginGuardia(cedula, password)
    res.json(result)
  } catch (e: any) {
    res.status(401).json({ error: e.message })
  }
}

// ─── Comunidades ──────────────────────────────────────────────────────────
export async function misComunidades(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = req.admin!.sub
    const comunidades = await repo.comunidadesDelAdmin(adminId)
    res.json(comunidades)
  } catch (e) { next(e) }
}

// ─── Crear reporte (upload de audio) ─────────────────────────────────────
export async function crearReporte(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ error: 'Archivo de audio requerido' })

    const { comunidad_id, tipo, descripcion, puesto_id, latitud, longitud, duracion_seg } = req.body

    if (!comunidad_id) return res.status(400).json({ error: 'comunidad_id requerido' })

    const admin = req.admin!
    const guardia_nombre = (admin as any).nombre || admin.sub

    const reporte = await repo.crearReporte({
      comunidad_id,
      puesto_id: puesto_id || undefined,
      guardia_id: admin.sub,
      guardia_nombre,
      tipo: tipo || 'NOVEDAD',
      descripcion: descripcion || undefined,
      archivo_path: file.path,
      formato: path.extname(file.originalname).replace('.', '') || 'aac',
      duracion_seg: duracion_seg ? parseFloat(duracion_seg) : undefined,
      tamanio_bytes: file.size,
      latitud: latitud ? parseFloat(latitud) : undefined,
      longitud: longitud ? parseFloat(longitud) : undefined,
    })

    res.status(201).json(reporte)
  } catch (e) { next(e) }
}

// ─── Listar reportes ──────────────────────────────────────────────────────
export async function listarReportes(req: Request, res: Response, next: NextFunction) {
  try {
    const { comunidad_id, estado, tipo, desde, hasta, puesto_id, guardia_id, limit, offset } = req.query
    const result = await repo.listarReportes({
      comunidad_id: comunidad_id as string,
      estado: estado as string,
      tipo: tipo as string,
      desde: desde as string,
      hasta: hasta as string,
      puesto_id: puesto_id as string,
      guardia_id: guardia_id as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    })
    res.json(result)
  } catch (e) { next(e) }
}

// ─── Obtener reporte ──────────────────────────────────────────────────────
export async function obtenerReporte(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await repo.obtenerReporte(String(req.params.id))
    if (!r) return res.status(404).json({ error: 'Reporte no encontrado' })
    res.json(r)
  } catch (e) { next(e) }
}

// ─── Streaming de audio ───────────────────────────────────────────────────
export async function streamAudio(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await repo.obtenerReporte(String(req.params.id))
    if (!r) return res.status(404).json({ error: 'Reporte no encontrado' })
    if (!fs.existsSync(r.archivo_path)) return res.status(404).json({ error: 'Archivo de audio no encontrado' })

    const stat = fs.statSync(r.archivo_path)
    const ext = path.extname(r.archivo_path).toLowerCase()
    const mime: Record<string, string> = {
      // Flutter/Android graba en contenedor MP4 (M4A) aunque la extensión sea .aac
      '.aac': 'audio/mp4', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.opus': 'audio/opus',
      '.webm': 'audio/webm',
    }
    const contentType = mime[ext] || 'audio/mp4'

    const range = req.headers.range
    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-')
      const start = parseInt(startStr, 10)
      const end = endStr ? parseInt(endStr, 10) : stat.size - 1
      const chunkSize = end - start + 1
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      })
      fs.createReadStream(r.archivo_path, { start, end }).pipe(res)
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      })
      fs.createReadStream(r.archivo_path).pipe(res)
    }
  } catch (e) { next(e) }
}

// ─── Actualizar estado ────────────────────────────────────────────────────
export async function actualizarEstado(req: Request, res: Response, next: NextFunction) {
  try {
    const { estado, notas_revision } = req.body
    if (!estado) return res.status(400).json({ error: 'estado requerido' })
    const valid = ['PENDIENTE', 'EN_REVISION', 'APROBADO', 'DESCARTADO']
    if (!valid.includes(estado)) return res.status(400).json({ error: 'Estado inválido' })

    const r = await repo.actualizarEstado(String(req.params.id), estado, req.admin!.sub, notas_revision)
    res.json(r)
  } catch (e) { next(e) }
}

// ─── Eliminar reporte ─────────────────────────────────────────────────────
export async function eliminarReporte(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await repo.eliminarReporte(String(req.params.id))
    if (!r) return res.status(404).json({ error: 'Reporte no encontrado' })
    // Eliminar archivo físico
    if (r.archivo_path && fs.existsSync(r.archivo_path)) {
      fs.unlinkSync(r.archivo_path)
    }
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// ─── Estadísticas ─────────────────────────────────────────────────────────
export async function estadisticas(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidadId = req.query.comunidad_id as string | undefined
    let comunidades: string[] = []
    if (comunidadId) {
      comunidades = [comunidadId]
    } else {
      const mias = await repo.comunidadesDelAdmin(req.admin!.sub)
      comunidades = mias.map((c: any) => c.id)
    }
    const stats = await repo.estadisticas(comunidades)
    res.json(stats)
  } catch (e) { next(e) }
}
