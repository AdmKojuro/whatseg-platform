import { prisma } from '../../shared/config/prisma'
import crypto from 'crypto'
import axios from 'axios'

/**
 * Inteligencia Federada — Zero-Knowledge Threat Sharing
 *
 * Principio: las comunidades comparten PATRONES de amenaza sin compartir
 * datos personales ni imágenes. Se aplica ruido diferencial (Laplace, ε=1.0)
 * al embedding antes de compartirlo, haciendo imposible reconstruir la imagen original.
 *
 * Flujo:
 *   1. Admin activa federación con otra comunidad (intercambian clave secreta)
 *   2. Cuando se crea un expediente ACTIVO → se genera versión con ruido → se envía
 *   3. El receptor almacena el PatronAnonimo y lo compara con sus propias detecciones
 */

const EPSILON = 1.0   // privacidad diferencial: menor = más privado, mayor = más útil

// ─── Gestión de pares ─────────────────────────────────────────────────────

export async function listarPares() {
  return prisma.federacionPar.findMany({ orderBy: { created_at: 'desc' } })
}

export async function crearPar(data: {
  nombre: string; comunidad_local_id: string; endpoint_remoto: string
}) {
  const clave_compartida = crypto.randomBytes(32).toString('hex')
  return prisma.federacionPar.create({
    data: { ...data, clave_compartida },
  })
}

export async function activarPar(id: string, activa: boolean) {
  return prisma.federacionPar.update({ where: { id }, data: { activa } })
}

export async function eliminarPar(id: string) {
  return prisma.federacionPar.delete({ where: { id } })
}

// ─── Compartir patrón (emisor) ─────────────────────────────────────────────

export async function compartirEmbedding(embedding: number[], tipo: 'ROSTRO' | 'PLACA', nivel: string) {
  const pares = await prisma.federacionPar.findMany({ where: { activa: true } })
  const vectorRuidoso = addLaplaceNoise(embedding, EPSILON)
  let enviados = 0

  for (const par of pares) {
    const hmac = firmarPayload({ vector: vectorRuidoso, tipo, nivel }, par.clave_compartida)
    try {
      await axios.post(
        `${par.endpoint_remoto}/ext/federacion/recibir`,
        {
          federacion_id: par.id,
          tipo,
          vector_ruidoso: vectorRuidoso,
          nivel_amenaza: nivel,
          hmac,
        },
        { timeout: 8000 },
      )
      enviados++
    } catch { /* peer puede estar offline */ }
  }
  return { enviados, pares_totales: pares.length }
}

// ─── Recibir patrón (receptor) ─────────────────────────────────────────────

export async function recibirPatron(data: {
  federacion_id: string; tipo: string; vector_ruidoso: number[]
  nivel_amenaza: string; hmac: string
}) {
  const par = await prisma.federacionPar.findUnique({ where: { id: data.federacion_id } })
  if (!par || !par.activa) throw new Error('Federación no activa o no encontrada')

  const payload = { vector: data.vector_ruidoso, tipo: data.tipo, nivel: data.nivel_amenaza }
  if (!verificarHmac(payload, par.clave_compartida, data.hmac)) {
    throw new Error('HMAC inválido — posible mensaje adulterado')
  }

  // Verificar si ya existe un patrón similar en nuestra DB
  const existentes = await prisma.patronAnonimo.findMany({
    where: { federacion_id: data.federacion_id, activo: true, tipo: data.tipo },
  })
  const emb = data.vector_ruidoso
  for (const ex of existentes) {
    const stored = ex.vector_ruidoso as number[]
    const dist = cosineDistance(emb, stored)
    if (dist < 0.25) {
      // Patrón similar ya existe → incrementar contador de reportes
      return prisma.patronAnonimo.update({
        where: { id: ex.id },
        data: { reportes: { increment: 1 } },
      })
    }
  }

  return prisma.patronAnonimo.create({
    data: {
      federacion_id: data.federacion_id,
      tipo: data.tipo,
      vector_ruidoso: emb,
      nivel_amenaza: data.nivel_amenaza,
      reportes: 1,
    },
  })
}

export async function listarPatrones(federacion_id?: string) {
  return prisma.patronAnonimo.findMany({
    where: federacion_id ? { federacion_id, activo: true } : { activo: true },
    orderBy: [{ nivel_amenaza: 'asc' }, { reportes: 'desc' }],
    include: { federacion: { select: { nombre: true } } },
  })
}

export async function cotejarEmbedding(embedding: number[]) {
  const patrones = await prisma.patronAnonimo.findMany({ where: { activo: true } })
  const resultados = patrones
    .map(p => ({
      patron_id: p.id,
      tipo: p.tipo,
      nivel_amenaza: p.nivel_amenaza,
      reportes: p.reportes,
      similitud: 1 - cosineDistance(embedding, p.vector_ruidoso as number[]),
    }))
    .filter(r => r.similitud > 0.70)
    .sort((a, b) => b.similitud - a.similitud)
  return resultados
}

// ─── Utilidades criptográficas ─────────────────────────────────────────────

function addLaplaceNoise(embedding: number[], epsilon: number): number[] {
  // Sensibilidad L1 = 2 (embeddings normalizados [-1, 1])
  const sensitivity = 2.0
  const scale = sensitivity / epsilon
  return embedding.map(v => {
    const u = Math.random() - 0.5
    const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u))
    return Math.max(-1, Math.min(1, v + noise))
  })
}

function firmarPayload(payload: object, secret: string): string {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')
}

function verificarHmac(payload: object, secret: string, hmac: string): boolean {
  const expected = firmarPayload(payload, secret)
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hmac))
}

function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 1
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i]**2; nb += b[i]**2 }
  if (na === 0 || nb === 0) return 1
  return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb))
}
