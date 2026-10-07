import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './reportes-ptt.controller'

const UPLOAD_DIR = process.env.PTT_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'reportes-ptt')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ts = Date.now()
    const ext = path.extname(file.originalname) || '.aac'
    cb(null, `ptt_${ts}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.aac', '.m4a', '.mp3', '.ogg', '.wav', '.opus', '.webm']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext) || file.mimetype.startsWith('audio/')) {
      cb(null, true)
    } else {
      cb(new Error('Formato de audio no soportado'))
    }
  },
})

const router = Router()

// ─── Auth para guardias (usa credenciales de rondas_usuarios) ────────────
router.post('/auth/login', ctrl.loginGuardia)

// ─── Requiere JWT en todo lo demás ────────────────────────────────────────
router.use(authMiddleware)

// ─── Comunidades disponibles ──────────────────────────────────────────────
router.get('/mis-comunidades', ctrl.misComunidades)

// ─── Reportes PTT ─────────────────────────────────────────────────────────
router.post('/reportes', upload.single('audio'), ctrl.crearReporte)
router.get('/reportes', ctrl.listarReportes)
router.get('/reportes/:id', ctrl.obtenerReporte)
router.get('/reportes/:id/audio', ctrl.streamAudio)
router.patch('/reportes/:id/estado', requireRole('SUPERADMIN', 'ADMIN', 'MONITOR', 'COMANDANTE', 'SUPERVISOR'), ctrl.actualizarEstado)
router.delete('/reportes/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.eliminarReporte)

// ─── Estadísticas para dashboard ──────────────────────────────────────────
router.get('/stats', requireRole('SUPERADMIN', 'ADMIN', 'MONITOR', 'COMANDANTE', 'SUPERVISOR'), ctrl.estadisticas)

export default router
