import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { env } from '../../shared/config/env'
import axios from 'axios'

const router = Router()
router.use(authMiddleware)

// Proxy genérico al vision service
async function proxyGet(path: string, req: Request, res: Response) {
  const params = new URLSearchParams(req.query as Record<string, string>).toString()
  const url = `${env.VISION_URL}${path}${params ? '?' + params : ''}`
  const r = await axios.get(url, { timeout: 10000 })
  res.json(r.data)
}

router.get('/cameras', async (req: Request, res: Response, next: NextFunction) => {
  try { await proxyGet('/api/cameras', req, res) } catch (e) { next(e) }
})

router.post('/cameras/add', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await axios.post(`${env.VISION_URL}/api/cameras/add`, req.body, { timeout: 10000 })
    res.status(201).json(r.data)
  } catch (e) { next(e) }
})

router.post('/cameras/remove', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await axios.post(`${env.VISION_URL}/api/cameras/remove`, req.body, { timeout: 10000 })
    res.json(r.data)
  } catch (e) { next(e) }
})

router.get('/cameras/:id/snapshot', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await axios.get(`${env.VISION_URL}/api/cameras/${req.params.id}/snapshot`, {
      responseType: 'stream', timeout: 10000,
    })
    r.data.pipe(res)
  } catch (e) { next(e) }
})

router.get('/faces', async (req: Request, res: Response, next: NextFunction) => {
  try { await proxyGet('/api/faces', req, res) } catch (e) { next(e) }
})

router.post('/faces/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await axios.post(`${env.VISION_URL}/api/faces/search`, req.body, {
      headers: { 'Content-Type': req.headers['content-type']! },
      timeout: 30000,
    })
    res.json(r.data)
  } catch (e) { next(e) }
})

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try { await proxyGet('/api/stats', req, res) } catch (e) { next(e) }
})

router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await axios.get(`${env.VISION_URL}/health`, { timeout: 3000 })
    res.json({ online: true, url: env.VISION_URL })
  } catch {
    res.json({ online: false, url: env.VISION_URL })
  }
})

// Sincronizar cámaras de WhatsEg con el vision service
router.post('/sync-cameras', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../../shared/config/prisma')
    const camaras = await prisma.$queryRaw<
      { id: string; nombre: string; url_rtsp: string | null; comunidad_id: string | null }[]
    >`SELECT id, nombre, url_rtsp, comunidad_id FROM "Camara" WHERE activa=true AND url_rtsp IS NOT NULL`

    const payload = camaras.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      rtsp_url: c.url_rtsp,
      comunidad_id: c.comunidad_id,
    }))

    const r = await axios.post(`${env.VISION_URL}/api/sync/cameras`, payload, { timeout: 15000 })
    res.json(r.data)
  } catch (e) { next(e) }
})

export default router
