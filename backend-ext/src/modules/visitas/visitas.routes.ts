import { Router } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import multer from 'multer'
import * as ctrl from './visitas.controller'

const upload = multer({ dest: '/tmp/visitas/' })
const router = Router()

// Ruta pública: usar QR (portería sin login)
router.post('/:token/usar', upload.single('foto'), ctrl.usarQrHandler)

router.use(authMiddleware)
router.get('/', ctrl.listarHandler)
router.get('/comunidad/:id', ctrl.listarPorComunidadHandler)
router.post('/', requireRole('SUPERADMIN', 'ADMIN', 'MONITOR'), ctrl.crearHandler)
router.get('/:id', ctrl.obtenerPorIdHandler)
router.delete('/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.cancelarHandler)
router.get('/:id/qr', ctrl.descargarQrHandler)

export default router
