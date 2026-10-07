import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import { prisma } from '../../shared/config/prisma'

const router = Router()
router.use(authMiddleware)
router.use(requireRole('CUADRANTE'))

// ─── Mis Comunidades ─────────────────────────────────────────────────────────
router.get('/mis-comunidades', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cuadranteId = req.admin!.sub
    const rows: any[] = await prisma.$queryRaw`
      SELECT c.id, c.nombre, c.codigo, c.direccion, c.latitud, c.longitud, c.activa
      FROM admins_comunidades ac
      JOIN comunidades c ON c.id::text = ac.comunidad_id
      WHERE ac.admin_id = ${cuadranteId}
        AND c.activa = true
      ORDER BY c.nombre
    `
    res.json(rows)
  } catch (e: any) {
    console.error('[cuadrante-app] mis-comunidades error:', e?.message, e?.meta)
    next(e)
  }
})

// ─── Mis Alarmas ─────────────────────────────────────────────────────────────
// Activaciones de los últimos 7 días de las comunidades del cuadrante
router.get('/mis-alarmas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cuadranteId = req.admin!.sub

    const activaciones: any[] = await prisma.$queryRaw`
      SELECT
        a.id,
        a.cliente_id,
        a.jefe_id,
        a.dispositivo_id,
        a.comunidad_id,
        a.resultado,
        a.detalle,
        a.created_at,
        a.snapshot_url,
        a.snapshot_urls,
        a.tipo_emergencia,
        a.veredicto,
        a.veredicto_observacion,
        a.veredicto_admin_id,
        a.veredicto_at,
        com.nombre          AS com_nombre,
        com.codigo          AS com_codigo,
        cli.nombre          AS cli_nombre,
        cli.celular         AS cli_celular,
        cli.identificador   AS cli_identificador,
        jef.nombre          AS jef_nombre,
        d.nombre            AS dev_nombre,
        d.tipo              AS dev_tipo,
        va.nombre           AS va_nombre
      FROM activaciones a
      JOIN comunidades com ON com.id::text = a.comunidad_id
      LEFT JOIN clientes    cli ON cli.id = a.cliente_id
      LEFT JOIN admins      jef ON jef.id = a.jefe_id
      LEFT JOIN dispositivos  d ON d.id  = a.dispositivo_id
      LEFT JOIN admins       va ON va.id  = a.veredicto_admin_id
      WHERE a.comunidad_id::text IN (
        SELECT ac.comunidad_id::text
        FROM admins_comunidades ac
        JOIN comunidades c ON c.id::text = ac.comunidad_id
        WHERE ac.admin_id = ${cuadranteId} AND c.activa = true
      )
      AND a.created_at >= NOW() - INTERVAL '30 days'
      ORDER BY a.created_at DESC
      LIMIT 100
    `

    const result = activaciones.map((row: any) => {
      // snapshot_urls puede llegar como string de postgres array "{url1,url2}" o ya como array
      let snapshotUrls: string[] = []
      if (Array.isArray(row.snapshot_urls)) {
        snapshotUrls = row.snapshot_urls
      } else if (typeof row.snapshot_urls === 'string' && row.snapshot_urls.startsWith('{')) {
        snapshotUrls = row.snapshot_urls.slice(1, -1).split(',').filter(Boolean)
      }

      return {
        id: row.id,
        cliente_id:          row.cliente_id          ?? undefined,
        jefe_id:             row.jefe_id             ?? undefined,
        dispositivo_id:      row.dispositivo_id,
        comunidad_id:        row.comunidad_id,
        resultado:           row.resultado,
        detalle:             row.detalle             ?? undefined,
        created_at:          row.created_at,
        snapshot_url:        row.snapshot_url        ?? undefined,
        snapshot_urls:       snapshotUrls,
        tipo_emergencia:     row.tipo_emergencia     ?? undefined,
        veredicto:           row.veredicto           ?? undefined,
        veredicto_observacion: row.veredicto_observacion ?? undefined,
        veredicto_admin_id:  row.veredicto_admin_id  ?? undefined,
        veredicto_at:        row.veredicto_at        ?? undefined,
        comunidad:      { id: row.comunidad_id,      nombre: row.com_nombre, codigo: row.com_codigo },
        cliente:        row.cliente_id ? { id: row.cliente_id, nombre: row.cli_nombre, celular: row.cli_celular, identificador: row.cli_identificador ?? undefined } : undefined,
        jefe:           row.jefe_id   ? { id: row.jefe_id,    nombre: row.jef_nombre } : undefined,
        dispositivo:    row.dispositivo_id ? { id: row.dispositivo_id, nombre: row.dev_nombre ?? undefined, tipo: row.dev_tipo ?? undefined } : undefined,
        veredicto_admin: row.veredicto_admin_id ? { id: row.veredicto_admin_id, nombre: row.va_nombre } : undefined,
      }
    })

    res.json(result)
  } catch (e: any) {
    console.error('[cuadrante-app] mis-alarmas error:', e?.message, e?.meta)
    next(e)
  }
})

export default router
