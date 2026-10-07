import { prisma } from '../../shared/config/prisma'
import axios from 'axios'
import { ENV } from '../../shared/config/env'

// ─── Lista negra de placas ─────────────────────────────────────────────────

export async function listarDenegadas() {
  return prisma.placaDenegada.findMany({ orderBy: { created_at: 'desc' } })
}

export async function crearDenegada(data: {
  placa: string; descripcion?: string; nivel?: string; created_by: string
}) {
  const placa = normalizar(data.placa)
  if (!placa) throw new Error('Formato de placa inválido. Use ABC123 o ABC12D')
  const registro = await prisma.placaDenegada.create({
    data: { placa, descripcion: data.descripcion, nivel: data.nivel ?? 'MEDIA', created_by: data.created_by },
  })
  await syncConVision()
  return registro
}

export async function eliminarDenegada(id: string) {
  await prisma.placaDenegada.delete({ where: { id } })
  await syncConVision()
  return { ok: true }
}

export async function actualizarDenegada(id: string, data: { nivel?: string; descripcion?: string; activa?: boolean }) {
  const updated = await prisma.placaDenegada.update({ where: { id }, data })
  await syncConVision()
  return updated
}

// Sincroniza lista negra con el servicio Python vision
export async function syncConVision() {
  try {
    const placas = await prisma.placaDenegada.findMany({ where: { activa: true } })
    await axios.post(`${ENV.VISION_URL}/api/plates/denied/sync`, placas, { timeout: 5000 })
  } catch { /* vision service puede estar apagado */ }
}

// ─── Alertas de placas ─────────────────────────────────────────────────────

export async function listarAlertas(params?: { reconocido?: boolean; page?: number; limit?: number }) {
  const page = params?.page ?? 1
  const limit = params?.limit ?? 20
  const where = params?.reconocido !== undefined ? { reconocido: params.reconocido } : {}
  const [data, total] = await Promise.all([
    prisma.placaAlerta.findMany({
      where, orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit, take: limit,
      include: { placa_denegada: { select: { descripcion: true, nivel: true } } },
    }),
    prisma.placaAlerta.count({ where }),
  ])
  return { data, total, page, limit, total_pages: Math.ceil(total / limit) }
}

export async function recibirAlertaDeVision(data: {
  camera_id: string; comunidad_id?: string; placa_detectada: string
  confianza: number; snapshot_path?: string; nivel?: string
}) {
  const placa = normalizar(data.placa_detectada)
  const denegada = placa
    ? await prisma.placaDenegada.findUnique({ where: { placa } })
    : null
  return prisma.placaAlerta.create({
    data: {
      camera_id: data.camera_id,
      comunidad_id: data.comunidad_id,
      placa_detectada: data.placa_detectada,
      confianza: data.confianza,
      placa_denegada_id: denegada?.id,
      snapshot_path: data.snapshot_path,
    },
  })
}

export async function reconocerAlerta(id: string) {
  return prisma.placaAlerta.update({ where: { id }, data: { reconocido: true } })
}

// ─── Normalización ─────────────────────────────────────────────────────────
function normalizar(placa: string): string | null {
  const clean = placa.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (/^[A-Z]{3}[0-9]{3}$/.test(clean) || /^[A-Z]{3}[0-9]{2}[A-Z]$/.test(clean)) return clean
  if (clean.length === 6 && /^[A-Z]{2}/.test(clean)) return clean
  return null
}
