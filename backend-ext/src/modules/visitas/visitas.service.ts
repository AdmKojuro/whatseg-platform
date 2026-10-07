import { prisma } from '../../shared/config/prisma'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

const FOTOS_DIR = path.join(process.cwd(), 'uploads', 'visitas')
if (!fs.existsSync(FOTOS_DIR)) fs.mkdirSync(FOTOS_DIR, { recursive: true })

export async function crear(data: {
  nombre: string
  documento?: string
  motivo?: string
  comunidad_id: string
  valido_desde: string
  valido_hasta: string
  created_by: string
}) {
  return prisma.visita.create({ data: { ...data, valido_desde: new Date(data.valido_desde), valido_hasta: new Date(data.valido_hasta) } })
}

export async function obtenerPorId(id: string) {
  return prisma.visita.findUniqueOrThrow({ where: { id } })
}

export async function obtenerPorToken(token: string) {
  return prisma.visita.findUnique({ where: { qr_token: token } })
}

export async function listar(comunidadId?: string) {
  return prisma.visita.findMany({
    where: comunidadId ? { comunidad_id: comunidadId } : undefined,
    orderBy: { created_at: 'desc' },
    take: 100,
  })
}

export async function listarPorComunidad(comunidadId: string) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return prisma.visita.findMany({
    where: { comunidad_id: comunidadId, created_at: { gte: hoy } },
    orderBy: { created_at: 'desc' },
  })
}

export async function usarQr(token: string, fotoPath?: string, porterroId?: string) {
  const visita = await prisma.visita.findUnique({ where: { qr_token: token } })
  if (!visita) throw new Error('QR no válido')
  if (visita.qr_usado) throw new Error('Este QR ya fue utilizado')
  const ahora = new Date()
  if (ahora < visita.valido_desde) throw new Error('QR aún no es válido')
  if (ahora > visita.valido_hasta) throw new Error('QR expirado')

  return prisma.visita.update({
    where: { qr_token: token },
    data: {
      qr_usado: true,
      usado_at: ahora,
      foto_path: fotoPath,
      portero_id: porterroId,
    },
  })
}

export async function cancelar(id: string) {
  return prisma.visita.update({
    where: { id },
    data: { qr_usado: true },
  })
}

export async function generarQrBase64(token: string): Promise<string> {
  const url = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/visitas/verificar/${token}`
  return QRCode.toDataURL(url, { width: 300, margin: 2 })
}
