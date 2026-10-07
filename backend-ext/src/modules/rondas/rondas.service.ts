import * as repo from './rondas.repository'
import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import { env } from '../../shared/config/env'
import type { CrearRutaDto, ActualizarRutaDto, CrearCheckpointDto, ActualizarCheckpointDto, CrearPuestoDto, ActualizarPuestoDto, MarcarCheckpointDto, FiltroEjecuciones, CrearUsuarioRondaDto, ActualizarUsuarioRondaDto } from './rondas.types'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parsePuestoIds(puesto_id: string | null | undefined): string[] {
  if (!puesto_id) return []
  try {
    const parsed = JSON.parse(puesto_id)
    return Array.isArray(parsed) ? parsed : [puesto_id]
  } catch {
    return [puesto_id]
  }
}

// ─── COMUNIDADES ──────────────────────────────────────────────────────────

export function misComunidades(admin_id: string) {
  return repo.misComunidades(admin_id)
}

// ─── PUESTOS ──────────────────────────────────────────────────────────────

export function listarPuestos(comunidad_id: string) {
  return repo.listarPuestos(comunidad_id)
}

export function crearPuesto(data: CrearPuestoDto) {
  return repo.crearPuesto(data)
}

export function actualizarPuesto(id: string, data: ActualizarPuestoDto) {
  return repo.actualizarPuesto(id, data)
}

export function eliminarPuesto(id: string) {
  return repo.eliminarPuesto(id)
}

// ─── RUTAS ─────────────────────────────────────────────────────────────────

export async function listarRutas(userRol: string, puestoId?: string | null, comunidadId?: string) {
  const todasRutas = await repo.listarRutas(comunidadId)
  if (userRol !== 'SUPERVISOR' || !puestoId) return todasRutas

  const puestoIds = parsePuestoIds(puestoId)
  const misIds = await repo.getMisCheckpointIds(puestoIds)
  if (misIds.length === 0) return todasRutas   // sin asignación configurada → ve todo

  return todasRutas
    .map((ruta: any) => ({
      ...ruta,
      mis_checkpoints: ruta.checkpoints.filter((cp: any) => misIds.includes(String(cp.id))),
      checkpoints_para_mi: ruta.checkpoints.filter((cp: any) => misIds.includes(String(cp.id))).length,
    }))
    .filter((ruta: any) => ruta.checkpoints_para_mi > 0)
}

export function obtenerRuta(id: string) {
  return repo.obtenerRuta(id)
}

export function crearRuta(data: CrearRutaDto) {
  return repo.crearRuta(data)
}

export function actualizarRuta(id: string, data: ActualizarRutaDto) {
  return repo.actualizarRuta(id, data)
}

export async function eliminarRuta(id: string) {
  const ruta = await repo.obtenerRuta(id)
  if (!ruta) throw new Error('Ruta no encontrada')
  return repo.eliminarRuta(id)
}

// ─── CHECKPOINTS ───────────────────────────────────────────────────────────

export function listarCheckpoints(ruta_id: string) {
  return repo.listarCheckpoints(ruta_id)
}

export function crearCheckpoint(ruta_id: string, data: CrearCheckpointDto) {
  return repo.crearCheckpoint(ruta_id, data)
}

export function actualizarCheckpoint(id: string, data: ActualizarCheckpointDto) {
  return repo.actualizarCheckpoint(id, data)
}

export function eliminarCheckpoint(id: string) {
  return repo.eliminarCheckpoint(id)
}

export function obtenerCheckpoint(id: string) {
  return repo.obtenerCheckpoint(id)
}

// ─── EJECUCIÓN DE RONDAS ───────────────────────────────────────────────────

export async function iniciarRonda(guardia_id: string, ruta_id: string, userRol?: string, puestoId?: string | null, foto_verificacion_url?: string) {
  // Verificar que no tenga ronda activa
  const activa = await repo.rondaActivaGuardia(guardia_id)
  if (activa) throw new Error('Ya tienes una ronda en curso. Finalizala primero.')

  // Verificar que la ruta existe y está activa
  const ruta = await repo.obtenerRuta(ruta_id)
  if (!ruta) throw new Error('Ruta no encontrada')
  if (!ruta.activa) throw new Error('Esta ruta está desactivada')

  let checkpointsTotal = ruta.checkpoints.length
  if (userRol === 'SUPERVISOR' && puestoId) {
    const puestoIds = parsePuestoIds(puestoId)
    const misIds = await repo.getMisCheckpointIds(puestoIds)
    const enEstaRuta = ruta.checkpoints.filter((cp: any) => misIds.includes(String(cp.id))).length
    if (enEstaRuta > 0) checkpointsTotal = enEstaRuta
  }

  const ejecucion = await repo.crearEjecucion(ruta_id, guardia_id, checkpointsTotal, foto_verificacion_url)
  // Retornar ejecución completa con ruta y checkpoints para que el cliente los muestre
  return repo.obtenerEjecucion(ejecucion.id)
}

export async function marcarCheckpoint(guardia_id: string, dto: MarcarCheckpointDto, userRol?: string, puestoId?: string | null) {
  // Buscar ronda activa del guardia
  const ejecucion = await repo.rondaActivaGuardia(guardia_id)
  if (!ejecucion) throw new Error('No tienes una ronda en curso')

  // Buscar checkpoint por QR o NFC
  let checkpoint = null
  if (dto.qr_code) {
    checkpoint = await repo.buscarCheckpointPorQR(dto.qr_code)
  } else if (dto.nfc_tag) {
    checkpoint = await repo.buscarCheckpointPorNFC(dto.nfc_tag)
  }

  if (!checkpoint) throw new Error('Checkpoint no encontrado')

  // Verificar que el checkpoint pertenece a la ruta activa
  if (checkpoint.ruta_id !== ejecucion.ruta_id) {
    throw new Error('Este checkpoint no pertenece a tu ruta actual')
  }

  // Para supervisores: validar que el checkpoint está en su lista obligatoria
  if (userRol === 'SUPERVISOR' && puestoId) {
    const puestoIds = parsePuestoIds(puestoId)
    const misIds = await repo.getMisCheckpointIds(puestoIds)
    if (misIds.length > 0 && !misIds.includes(String(checkpoint.id))) {
      throw new Error('Este checkpoint no está asignado a tu puesto')
    }
  }

  // Verificar que no esté ya marcado
  const yaVisitado = await repo.visitaYaRegistrada(ejecucion.id, checkpoint.id)
  if (yaVisitado) throw new Error('Este checkpoint ya fue marcado en esta ronda')

  // Registrar visita
  const visita = await repo.registrarVisita({
    ejecucion_id: ejecucion.id,
    checkpoint_id: checkpoint.id,
    metodo: dto.qr_code ? 'QR' : 'NFC',
    latitud: dto.latitud,
    longitud: dto.longitud,
    notas: dto.notas,
    foto_url: dto.foto_url,
  })

  // Incrementar contador
  await repo.incrementarMarcados(ejecucion.id)

  // Si completó todos los checkpoints, marcar como completada
  const nuevoConteo = ejecucion.checkpoints_marcados + 1
  if (nuevoConteo >= ejecucion.checkpoints_total) {
    await repo.finalizarEjecucion(ejecucion.id, 'COMPLETADA')
  }

  return {
    visita,
    checkpoint: checkpoint.nombre,
    progreso: `${nuevoConteo}/${ejecucion.checkpoints_total}`,
    completada: nuevoConteo >= ejecucion.checkpoints_total,
  }
}

export async function finalizarRonda(guardia_id: string, ejecucion_id: string, notas?: string) {
  const ejecucion = await repo.obtenerEjecucion(ejecucion_id)
  if (!ejecucion) throw new Error('Ejecución no encontrada')
  if (ejecucion.guardia_id !== guardia_id) throw new Error('Esta ronda no te pertenece')
  if (ejecucion.estado !== 'EN_CURSO') throw new Error('Esta ronda ya fue finalizada')

  const estado = ejecucion.checkpoints_marcados >= ejecucion.checkpoints_total
    ? 'COMPLETADA' : 'INCOMPLETA'

  return repo.finalizarEjecucion(ejecucion_id, estado, notas)
}

export async function rondaActiva(guardia_id: string, userRol?: string, puestoId?: string | null) {
  const activa = await repo.rondaActivaGuardia(guardia_id)
  if (!activa || userRol !== 'SUPERVISOR' || !puestoId) return activa
  const puestoIds = parsePuestoIds(puestoId)
  const misIds = await repo.getMisCheckpointIds(puestoIds)
  return { ...activa, supervisor_checkpoint_ids: misIds }
}

// ─── HISTORIAL Y MONITOREO ────────────────────────────────────────────────

export function rondasEnCurso(comunidad_id?: string) {
  return repo.rondasEnCurso(comunidad_id)
}

export function listarEjecuciones(filtros: FiltroEjecuciones) {
  return repo.listarEjecuciones(filtros)
}

export function detalleEjecucion(id: string) {
  return repo.obtenerEjecucion(id)
}

export function estadisticas(comunidad_id?: string) {
  return repo.estadisticas(comunidad_id)
}

// ─── USUARIOS (Personal de seguridad) ────────────────────────────────────

export async function loginRonda(cedula: string, password: string) {
  const usuario = await repo.buscarPorCedula(cedula)
  if (!usuario || !usuario.activo) throw new Error('Credenciales inválidas')

  const valid = await bcrypt.compare(password, usuario.password_hash)
  if (!valid) throw new Error('Credenciales inválidas')

  const token = jwt.sign(
    { sub: usuario.id, rol: usuario.rol, comunidad_id: usuario.comunidad_id, puesto_id: usuario.puesto_id ?? null },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  )

  return {
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      cedula: usuario.cedula,
      rol: usuario.rol,
      turno: usuario.turno,
      comunidad_id: usuario.comunidad_id,
      puesto_id: usuario.puesto_id,
    },
  }
}

export function listarPersonal(comunidad_id: string) {
  return repo.listarUsuarios(comunidad_id)
}

export async function crearPersonal(data: CrearUsuarioRondaDto, created_by: string) {
  const existe = await repo.buscarPorCedula(data.cedula)
  if (existe) throw new Error('Ya existe un usuario con esta cédula')

  const password_hash = await bcrypt.hash(data.password, 10)
  return repo.crearUsuario({
    comunidad_id: data.comunidad_id,
    cedula: data.cedula,
    nombre: data.nombre,
    telefono: data.telefono,
    password_hash,
    rol: data.rol,
    turno: data.turno,
    puesto_id: data.puesto_id,
    created_by,
  })
}

export async function actualizarPersonal(id: string, data: ActualizarUsuarioRondaDto) {
  const update: any = { ...data }
  if (data.password) {
    update.password_hash = await bcrypt.hash(data.password, 10)
    delete update.password
  }
  return repo.actualizarUsuario(id, update)
}

export function eliminarPersonal(id: string) {
  return repo.eliminarUsuario(id)
}

export function eliminarEjecucion(id: string) {
  return repo.eliminarEjecucion(id)
}

// ─── PROGRAMACIONES DE RONDA ────────────────────────────────────────────────

export function listarProgramaciones(comunidad_id: string) {
  return repo.listarProgramaciones(comunidad_id)
}

export function crearProgramacion(data: {
  comunidad_id: string; ruta_id: string; guardia_id?: string | null;
  dias_semana: string; hora_inicio: string; tolerancia_min?: number;
}) {
  return repo.crearProgramacion(data)
}

export function actualizarProgramacion(id: string, data: any) {
  return repo.actualizarProgramacion(id, data)
}

export function eliminarProgramacion(id: string) {
  return repo.eliminarProgramacion(id)
}

export function listarAlertasRonda(comunidad_id: string) {
  return repo.listarAlertasRonda(comunidad_id)
}

export function verificarProgramacionesVencidas(comunidad_id?: string) {
  return repo.verificarProgramacionesVencidas(comunidad_id)
}

// ─── CHECKPOINT CAMPOS (Formularios configurables) ──────────────────────────

export function getCamposCheckpoint(checkpoint_id: string) {
  return repo.getCamposCheckpoint(checkpoint_id)
}

export function setCamposCheckpoint(checkpoint_id: string, campos: any[]) {
  return repo.setCamposCheckpoint(checkpoint_id, campos)
}

export function getRespuestasVisita(visita_id: string) {
  return repo.getRespuestasVisita(visita_id)
}

export function guardarRespuestas(visita_id: string, respuestas: Array<{ campo_id: string; valor: string }>) {
  return repo.guardarRespuestas(visita_id, respuestas)
}
