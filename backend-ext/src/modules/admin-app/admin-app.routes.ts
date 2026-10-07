import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'
import { prisma } from '../../shared/config/prisma'

const router = Router()
router.use(authMiddleware)
router.use(requireRole('ADMIN', 'SUPERADMIN'))

// ─── Mi Comunidad ─────────────────────────────────────────────────────────────
router.get('/mi-comunidad', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.admin!.sub
    const rows: any[] = await prisma.$queryRaw`
      SELECT c.id::text AS id, c.nombre, c.codigo, c.direccion, c.latitud, c.longitud, c.activa
      FROM admins_comunidades ac
      JOIN comunidades c ON c.id::text = ac.comunidad_id
      WHERE ac.admin_id = ${adminId}
      LIMIT 1
    `
    if (!rows[0]) return res.status(404).json({ message: 'Sin comunidad asignada' })
    res.json(rows[0])
  } catch (e: any) {
    console.error('[admin-app] mi-comunidad error:', e?.message)
    next(e)
  }
})

// ─── Mis Jefes ────────────────────────────────────────────────────────────────
router.get('/mis-jefes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.admin!.sub
    const rows: any[] = await prisma.$queryRaw`
      WITH ac AS (SELECT comunidad_id AS cid FROM admins_comunidades WHERE admin_id = ${adminId} LIMIT 1)
      SELECT j.id, j.nombre, j.celular, j.activo, j.created_at
      FROM jefes j
      JOIN jefes_comunidades jc ON jc.jefe_id = j.id
      WHERE jc.comunidad_id IN (SELECT cid FROM ac)
      ORDER BY j.nombre
    `
    res.json(rows)
  } catch (e: any) {
    console.error('[admin-app] mis-jefes error:', e?.message)
    next(e)
  }
})

// ─── Mis Clientes ─────────────────────────────────────────────────────────────
router.get('/mis-clientes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.admin!.sub
    const rows: any[] = await prisma.$queryRaw`
      WITH ac AS (SELECT comunidad_id AS cid FROM admins_comunidades WHERE admin_id = ${adminId} LIMIT 1)
      SELECT cl.id, cl.nombre, cl.celular, cl.identificador, cl.activo, cl.created_at
      FROM clientes cl
      JOIN clientes_comunidades cc ON cc.cliente_id = cl.id
      WHERE cc.comunidad_id IN (SELECT cid FROM ac)
      ORDER BY cl.nombre
    `
    res.json(rows)
  } catch (e: any) {
    console.error('[admin-app] mis-clientes error:', e?.message)
    next(e)
  }
})

// ─── Mis Dispositivos ─────────────────────────────────────────────────────────
router.get('/mis-dispositivos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.admin!.sub
    const rows: any[] = await prisma.$queryRaw`
      WITH ac AS (SELECT comunidad_id AS cid FROM admins_comunidades WHERE admin_id = ${adminId} LIMIT 1)
      SELECT d.id::text AS id, d.nombre, d.tipo, d.online, d.configurado, d.comunidad_id, d.created_at
      FROM dispositivos d
      WHERE d.comunidad_id IN (SELECT cid FROM ac)
      ORDER BY d.nombre
    `
    res.json(rows)
  } catch (e: any) {
    console.error('[admin-app] mis-dispositivos error:', e?.message)
    next(e)
  }
})

// ─── Dashboard Stats (filtrado por comunidad del ADMIN) ────────────────────────
router.get('/dashboard/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.admin!.sub

    const rows: any[] = await prisma.$queryRaw`
      WITH ac AS (
        SELECT comunidad_id AS cid
        FROM admins_comunidades
        WHERE admin_id = ${adminId}
        LIMIT 1
      )
      SELECT
        (SELECT COUNT(*) FROM comunidades
          WHERE activa = true AND id::text IN (SELECT cid FROM ac))::int              AS total_comunidades,
        (SELECT COUNT(DISTINCT cc.cliente_id) FROM clientes_comunidades cc
          WHERE cc.comunidad_id IN (SELECT cid FROM ac))::int                         AS total_clientes,
        (SELECT COUNT(*) FROM dispositivos
          WHERE comunidad_id IN (SELECT cid FROM ac))::int                            AS total_dispositivos,
        (SELECT COUNT(*) FROM dispositivos
          WHERE comunidad_id IN (SELECT cid FROM ac) AND online = true)::int          AS dispositivos_online,
        (SELECT COUNT(*) FROM dispositivos
          WHERE comunidad_id IN (SELECT cid FROM ac) AND online = false)::int         AS dispositivos_offline,
        (SELECT COUNT(*) FROM activaciones
          WHERE comunidad_id IN (SELECT cid FROM ac)
            AND created_at >= NOW() - INTERVAL '1 day')::int                          AS activaciones_hoy,
        (SELECT COUNT(*) FROM activaciones
          WHERE comunidad_id IN (SELECT cid FROM ac)
            AND created_at >= NOW() - INTERVAL '7 days')::int                         AS activaciones_semana,
        (SELECT COUNT(*) FROM activaciones
          WHERE comunidad_id IN (SELECT cid FROM ac)
            AND created_at >= NOW() - INTERVAL '30 days')::int                        AS activaciones_mes
    `

    const row = rows[0] ?? {}
    res.json({
      totalComunidades:    Number(row.total_comunidades)    || 0,
      totalClientes:       Number(row.total_clientes)       || 0,
      totalDispositivos:   Number(row.total_dispositivos)   || 0,
      dispositivosOnline:  Number(row.dispositivos_online)  || 0,
      dispositivosOffline: Number(row.dispositivos_offline) || 0,
      activacionesHoy:     Number(row.activaciones_hoy)     || 0,
      activacionesSemana:  Number(row.activaciones_semana)  || 0,
      activacionesMes:     Number(row.activaciones_mes)     || 0,
    })
  } catch (e: any) {
    console.error('[admin-app] dashboard/stats error:', e?.message)
    next(e)
  }
})

// ─── Activaciones Recientes (filtradas por comunidad del ADMIN) ────────────────
router.get('/dashboard/activaciones-recientes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.admin!.sub
    const limit = Math.min(Number(req.query.limit) || 100, 500)

    const rows: any[] = await prisma.$queryRaw`
      WITH ac AS (
        SELECT comunidad_id AS cid
        FROM admins_comunidades
        WHERE admin_id = ${adminId}
        LIMIT 1
      )
      SELECT
        a.id, a.comunidad_id, a.cliente_id, a.jefe_id, a.dispositivo_id,
        a.resultado, a.detalle, a.created_at,
        a.tipo_emergencia, a.veredicto, a.veredicto_observacion,
        a.snapshot_url, a.snapshot_urls,
        com.nombre  AS com_nombre,  com.codigo AS com_codigo,
        cli.nombre  AS cli_nombre,  cli.celular AS cli_celular, cli.identificador AS cli_identificador,
        jef.nombre  AS jef_nombre,
        d.nombre    AS dev_nombre,  d.tipo AS dev_tipo
      FROM activaciones a
      JOIN comunidades   com ON com.id::text = a.comunidad_id
      LEFT JOIN clientes cli ON cli.id = a.cliente_id
      LEFT JOIN admins   jef ON jef.id = a.jefe_id
      LEFT JOIN dispositivos d ON d.id = a.dispositivo_id
      WHERE a.comunidad_id IN (SELECT cid FROM ac)
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `

    const result = rows.map((row: any) => {
      let snapshotUrls: string[] = []
      if (Array.isArray(row.snapshot_urls)) snapshotUrls = row.snapshot_urls
      else if (typeof row.snapshot_urls === 'string' && row.snapshot_urls.startsWith('{'))
        snapshotUrls = row.snapshot_urls.slice(1, -1).split(',').filter(Boolean)

      return {
        id:              row.id,
        comunidad_id:    row.comunidad_id,
        cliente_id:      row.cliente_id     ?? undefined,
        jefe_id:         row.jefe_id        ?? undefined,
        dispositivo_id:  row.dispositivo_id,
        resultado:       row.resultado,
        detalle:         row.detalle        ?? undefined,
        created_at:      row.created_at,
        snapshot_url:    row.snapshot_url   ?? undefined,
        snapshot_urls:   snapshotUrls,
        tipo_emergencia: row.tipo_emergencia ?? undefined,
        veredicto:       row.veredicto      ?? undefined,
        veredicto_observacion: row.veredicto_observacion ?? undefined,
        comunidad:   { id: row.comunidad_id, nombre: row.com_nombre, codigo: row.com_codigo },
        cliente:     row.cliente_id ? { id: row.cliente_id, nombre: row.cli_nombre, celular: row.cli_celular, identificador: row.cli_identificador ?? undefined } : undefined,
        jefe:        row.jefe_id   ? { id: row.jefe_id,    nombre: row.jef_nombre } : undefined,
        dispositivo: row.dispositivo_id ? { id: row.dispositivo_id, nombre: row.dev_nombre ?? undefined, tipo: row.dev_tipo ?? undefined } : undefined,
      }
    })

    res.json(result)
  } catch (e: any) {
    console.error('[admin-app] dashboard/activaciones-recientes error:', e?.message)
    next(e)
  }
})

// ─── Activaciones por Comunidad (filtradas por comunidad del ADMIN) ────────────
router.get('/dashboard/activaciones-por-comunidad', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.admin!.sub

    const rows: any[] = await prisma.$queryRaw`
      WITH ac AS (
        SELECT comunidad_id AS cid
        FROM admins_comunidades
        WHERE admin_id = ${adminId}
        LIMIT 1
      )
      SELECT
        a.comunidad_id,
        com.nombre AS comunidad_nombre,
        COUNT(*)::int AS total
      FROM activaciones a
      JOIN comunidades com ON com.id::text = a.comunidad_id
      WHERE a.created_at >= NOW() - INTERVAL '30 days'
        AND a.comunidad_id IN (SELECT cid FROM ac)
      GROUP BY a.comunidad_id, com.nombre
      ORDER BY total DESC
    `

    res.json(rows.map((r: any) => ({
      comunidad_id:     r.comunidad_id,
      comunidad_nombre: r.comunidad_nombre,
      total:            Number(r.total),
    })))
  } catch (e: any) {
    console.error('[admin-app] dashboard/activaciones-por-comunidad error:', e?.message)
    next(e)
  }
})

export default router
