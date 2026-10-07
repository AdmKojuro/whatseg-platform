import { prisma } from '../../shared/config/prisma'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import archiver from 'archiver'

export async function registrar(data: {
  activacion_id?: string
  alerta_ia_id?: string
  tipo: string
  archivo_path: string
  firmado_por: string
  descripcion?: string
  metadata?: Record<string, unknown>
}) {
  // Calcular hash SHA-256
  const hash = calcularHash(data.archivo_path)
  const stats = fs.statSync(data.archivo_path)

  return prisma.evidencia.create({
    data: {
      ...data,
      hash_sha256: hash,
      tamano_bytes: stats.size,
      metadata: data.metadata as any,
    },
  })
}

export function calcularHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export async function verificar(id: string) {
  const evidencia = await prisma.evidencia.findUniqueOrThrow({ where: { id } })
  if (!fs.existsSync(evidencia.archivo_path)) {
    return { valida: false, motivo: 'Archivo no encontrado' }
  }
  const hashActual = calcularHash(evidencia.archivo_path)
  const valida = hashActual === evidencia.hash_sha256
  return {
    valida,
    hash_original: evidencia.hash_sha256,
    hash_actual: hashActual,
    motivo: valida ? 'Integridad verificada' : 'El archivo fue modificado',
  }
}

export async function listarPorActivacion(activacionId: string) {
  return prisma.evidencia.findMany({
    where: { activacion_id: activacionId },
    orderBy: { firmado_at: 'asc' },
  })
}

export async function listarPorAlertaIA(alertaId: string) {
  return prisma.evidencia.findMany({
    where: { alerta_ia_id: alertaId },
    orderBy: { firmado_at: 'asc' },
  })
}

export async function exportarPaquete(ids: string[], outputPath: string): Promise<string> {
  const evidencias = await prisma.evidencia.findMany({ where: { id: { in: ids } } })
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', () => resolve(outputPath))
    archive.on('error', reject)
    archive.pipe(output)

    // Manifest
    const manifest = {
      generado_at: new Date().toISOString(),
      evidencias: evidencias.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        hash_sha256: e.hash_sha256,
        firmado_at: e.firmado_at,
        firmado_por: e.firmado_por,
      })),
    }
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

    for (const ev of evidencias) {
      if (fs.existsSync(ev.archivo_path)) {
        archive.file(ev.archivo_path, { name: path.basename(ev.archivo_path) })
      }
    }
    archive.finalize()
  })
}
