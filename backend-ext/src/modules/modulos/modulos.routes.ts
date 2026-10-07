import { Router } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import * as ctrl from './modulos.controller'

const router = Router()

router.use(authMiddleware)

// ADMIN y SUPERADMIN: qué módulos tiene activos
router.get('/mis-modulos', requireRole('SUPERADMIN', 'ADMIN'), ctrl.getMisModulos)

// SUPERADMIN: ver/configurar módulos por comunidad
router.get('/comunidades-config', requireRole('SUPERADMIN'), ctrl.getComunidadesConfig)
router.get('/comunidad/:id', requireRole('SUPERADMIN'), ctrl.getModulosComunidad)
router.put('/comunidad/:id', requireRole('SUPERADMIN'), ctrl.updateModulosComunidad)

// Cualquier usuario autenticado: módulos activos de una comunidad (para APK/panel guardia)
router.get('/comunidad/:id/activos', ctrl.getModulosActivosComunidad)

export default router
