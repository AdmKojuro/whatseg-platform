import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MODULOS_DISPONIBLES = ['RONDAS', 'BOTON_PANICO', 'REPORTES_PTT', 'ASISTENTE_IA', 'SOPORTE_BILINGUE', 'VIDEOPORTERO']

export async function listarModulosComunidad(comunidad_id: string) {
  const existentes = await prisma.comunidadModulo.findMany({
    where: { comunidad_id },
  })

  // Devolver todos los módulos, con activo=false para los que no existan
  return MODULOS_DISPONIBLES.map(modulo => {
    const existente = existentes.find(e => e.modulo === modulo)
    return {
      modulo,
      activo: existente?.activo ?? false,
    }
  })
}

export async function actualizarModulosComunidad(
  comunidad_id: string,
  modulos: { modulo: string; activo: boolean }[]
) {
  const resultados = []
  for (const { modulo, activo } of modulos) {
    if (!MODULOS_DISPONIBLES.includes(modulo)) continue
    const result = await prisma.comunidadModulo.upsert({
      where: { comunidad_id_modulo: { comunidad_id, modulo } },
      update: { activo },
      create: { comunidad_id, modulo, activo },
    })
    resultados.push({ modulo: result.modulo, activo: result.activo })
  }
  return resultados
}

export async function modulosActivosPorComunidades(comunidad_ids: string[]) {
  if (comunidad_ids.length === 0) return {}

  const rows = await prisma.comunidadModulo.findMany({
    where: { comunidad_id: { in: comunidad_ids }, activo: true },
  })

  // Unificar: si alguna comunidad del admin tiene el módulo activo, lo ve
  const activos = new Set<string>()
  rows.forEach(r => activos.add(r.modulo))

  return MODULOS_DISPONIBLES.reduce((acc, modulo) => {
    acc[modulo] = activos.has(modulo)
    return acc
  }, {} as Record<string, boolean>)
}

export async function todasComunidadesConModulos() {
  const comunidades: any[] = await prisma.$queryRaw`
    SELECT c.id, c.nombre, c.codigo
    FROM comunidades c
    WHERE c.activa = true
    ORDER BY c.nombre
  `

  const modulos = await prisma.comunidadModulo.findMany()

  return comunidades.map(c => ({
    ...c,
    modulos: MODULOS_DISPONIBLES.map(modulo => {
      const existente = modulos.find(m => m.comunidad_id === c.id && m.modulo === modulo)
      return { modulo, activo: existente?.activo ?? false }
    }),
  }))
}

export async function comunidadesDelAdmin(admin_id: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT c.id, c.nombre, c.codigo
    FROM admins_comunidades ac
    JOIN comunidades c ON c.id = ac.comunidad_id
    WHERE ac.admin_id = ${admin_id} AND c.activa = true
    ORDER BY c.nombre
  `
  return rows
}
