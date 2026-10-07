import { Router } from 'express'
import multer from 'multer'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './expedientes.controller'

const upload = multer({ dest: '/tmp/expedientes/' })
const router = Router()
router.use(authMiddleware)

router.get('/', ctrl.listarHandler)
router.post('/', requireRole('SUPERADMIN', 'ADMIN'), ctrl.crearHandler)
router.get('/:id', ctrl.obtenerHandler)
router.put('/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.actualizarHandler)
router.delete('/:id', requireRole('SUPERADMIN', 'ADMIN'), ctrl.eliminarHandler)
router.post('/:id/foto', requireRole('SUPERADMIN', 'ADMIN'), upload.single('foto'), ctrl.subirFotoHandler)
router.get('/:id/detecciones', ctrl.deteccionesHandler)

export default router
