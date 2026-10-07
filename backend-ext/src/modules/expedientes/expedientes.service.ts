import { prisma } from '../../shared/config/prisma'
import { env } from '../../shared/config/env'
import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'

export async function listar() {
  return prisma.expediente.findMany({
    where: { estado: { not: 'ELIMINADO' } },
    orderBy: { created_at: 'desc' },
  })
}

export async function obtenerPorId(id: string) {
  return prisma.expediente.findUniqueOrThrow({ where: { id } })
}

export async function crear(data: {
  nombre?: string
  descripcion?: string
  tipo?: string
  notas?: string
  alerta_nivel?: string
  created_by: string
}) {
  return prisma.expediente.create({ data })
}

export async function actualizar(id: string, data: {
  nombre?: string
  descripcion?: string
  tipo?: string
  estado?: string
  notas?: string
  alerta_nivel?: string
}) {
  return prisma.expediente.update({ where: { id }, data })
}

export async function eliminar(id: string) {
  return prisma.expediente.update({ where: { id }, data: { estado: 'ELIMINADO' } })
}

export async function subirFoto(id: string, fotoPath: string): Promise<{ vision_id: number }> {
  // Enviar al vision service para generar embedding
  const form = new FormData()
  form.append('foto', fs.createReadStream(fotoPath))

  const expediente = await prisma.expediente.findUniqueOrThrow({ where: { id } })

  form.append('nombre', expediente.nombre ?? 'Desconocido')
  form.append('tipo', expediente.tipo)
  form.append('alerta_nivel', expediente.alerta_nivel)
  form.append('backend_id', id)

  const res = await axios.post(`${env.VISION_URL}/api/expedientes`, form, {
    headers: form.getHeaders(),
    timeout: 30000,
  })

  const visionId = res.data.id as number
  const photoPath = res.data.photo_path as string

  await prisma.expediente.update({
    where: { id },
    data: { vision_id: visionId, foto_path: photoPath },
  })

  return { vision_id: visionId }
}

export async function detecciones(id: string) {
  return prisma.alertaIA.findMany({
    where: { expediente_id: id },
    orderBy: { created_at: 'desc' },
    take: 50,
  })
}
