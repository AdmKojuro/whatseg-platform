import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// La tabla la crea/asegura el propio bot (central/wa-bot) al arrancar. Aquí solo leemos.

export async function listarConversaciones(): Promise<unknown[]> {
  return prisma.$queryRaw`
    SELECT * FROM (
      SELECT DISTINCT ON (celular)
        celular,
        nombre,
        texto          AS ultimo_mensaje,
        direccion      AS ultima_direccion,
        created_at     AS ultima_fecha,
        (SELECT COUNT(*)::int FROM domotica_wa_mensajes m2 WHERE m2.celular = m1.celular) AS total_mensajes
      FROM domotica_wa_mensajes m1
      ORDER BY celular, created_at DESC
    ) sub
    ORDER BY ultima_fecha DESC
  `
}

export async function listarMensajes(celular: string, limit = 200): Promise<unknown[]> {
  return prisma.$queryRaw`
    SELECT id, celular, nombre, direccion, texto, media_url, created_at
    FROM domotica_wa_mensajes
    WHERE celular = ${celular}
    ORDER BY created_at ASC
    LIMIT ${limit}
  `
}
