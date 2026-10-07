import fs from 'fs'
import * as repo from './asistente.repository'

const WHISPER_URL  = process.env.WHISPER_URL  || 'http://localhost:5001'
const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b'

// ─── Whisper: audio → texto ──────────────────────────────────────────────────

export async function transcribir(audioPath: string): Promise<string> {
  if (!fs.existsSync(audioPath)) throw new Error(`Audio no encontrado: ${audioPath}`)

  const res = await fetch(`${WHISPER_URL}/transcribir`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ path: audioPath }),
    signal:  AbortSignal.timeout(60_000),
  })

  if (!res.ok) throw new Error(`Whisper error ${res.status}`)
  const data = await res.json() as any
  return (data.texto ?? '').trim()
}

// ─── Ollama: texto → clasificación ───────────────────────────────────────────

export async function clasificar(texto: string): Promise<{
  tipo: string; resumen: string; confianza: number
}> {
  if (!texto.trim()) return { tipo: 'NOVEDAD', resumen: 'Sin transcripción', confianza: 0 }

  const prompt = `Eres un asistente de seguridad. Clasifica este reporte de guardia.

Reporte: "${texto}"

Responde EXACTAMENTE en JSON sin texto adicional:
{"tipo":"NOVEDAD","resumen":"resumen en una oración","confianza":0.0}

Tipos válidos:
- EMERGENCIA: peligro inmediato, violencia, heridos, robo en curso
- INCIDENTE: problema que requiere atención, pelea, sospechosos
- NOVEDAD: reporte de rutina, observación normal, sin problemas
- PRUEBA: test o prueba de comunicación
- COMUNICADO: mensaje informativo general`

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    signal:  AbortSignal.timeout(30_000),
  })

  if (!res.ok) throw new Error(`Ollama error ${res.status}`)
  const data = await res.json() as any
  const raw  = (data.response ?? '').trim()

  // Extraer JSON de la respuesta
  const match = raw.match(/\{[\s\S]*?\}/)
  if (!match) return { tipo: 'NOVEDAD', resumen: raw.slice(0, 120), confianza: 0.5 }

  try {
    const parsed = JSON.parse(match[0])
    const tiposValidos = ['EMERGENCIA', 'INCIDENTE', 'NOVEDAD', 'PRUEBA', 'COMUNICADO']
    const resumen = String(parsed.resumen ?? '').slice(0, 300)
    // Si el resumen parece JSON, usar el texto crudo truncado
    const resumenLimpio = resumen.startsWith('{') ? raw.replace(/\{[\s\S]*\}/, '').trim().slice(0, 120) || 'Sin descripción' : resumen
    return {
      tipo:      tiposValidos.includes(parsed.tipo) ? parsed.tipo : 'NOVEDAD',
      resumen:   resumenLimpio || 'Sin descripción',
      confianza: Math.min(1, Math.max(0, parseFloat(parsed.confianza ?? '0.7') || 0.7)),
    }
  } catch {
    return { tipo: 'NOVEDAD', resumen: raw.slice(0, 120), confianza: 0.5 }
  }
}

// ─── Ollama: respuesta automática para EMERGENCIA ────────────────────────────

export async function generarRespuestaEmergencia(transcripcion: string, resumen: string): Promise<string> {
  const prompt = `Eres Central, asistente de seguridad de WhatsEg. Se ha detectado una EMERGENCIA en un reporte de guardia.

Transcripción: "${transcripcion}"
Clasificación: ${resumen}

Redacta una respuesta de alerta urgente en 2 oraciones que:
1. Confirme que la emergencia fue recibida y está siendo atendida
2. Indique las acciones inmediatas recomendadas para los supervisores

Responde SOLO con el mensaje de alerta, sin encabezados ni formato adicional. En español.`

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal:  AbortSignal.timeout(20_000),
    })

    if (!res.ok) throw new Error('Ollama error')
    const data = await res.json() as any
    const respuesta = (data.response ?? '').trim()
    return respuesta || 'ALERTA: Emergencia detectada. Se requiere atención inmediata del supervisor.'
  } catch {
    return 'ALERTA: Emergencia detectada. Se requiere atención inmediata del supervisor.'
  }
}

// ─── Ollama: chatbot sobre reportes ──────────────────────────────────────────

export async function* chatStream(pregunta: string, contexto: any[]): AsyncGenerator<string> {
  const formatoReporte = (r: any) => {
    const fecha = new Date(r.created_at).toLocaleString('es', { timeZone: 'America/Bogota' })
    const texto = r.transcripcion || r.resumen || r.tipo
    return `[${fecha}] ${r.guardia_nombre} (${r.tipo_ia || r.tipo}): ${texto}`
  }

  const reportesTexto = contexto.length > 0
    ? contexto.map(formatoReporte).join('\n')
    : 'No hay reportes recientes disponibles.'

  const prompt = `Eres Central, asistente de seguridad inteligente de WhatsEg. Tienes acceso a los reportes recientes de los guardias.

REPORTES RECIENTES:
${reportesTexto}

PREGUNTA: ${pregunta}

Responde de forma concisa, directa y en español. Si la información no está en los reportes, dilo claramente.`

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: true }),
    signal:  AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    yield 'Error al conectar con el asistente de IA. Intente nuevamente.'
    return
  }

  // Stream la respuesta token por token
  const reader = res.body!
  for await (const chunk of reader as any) {
    try {
      const lines = chunk.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        const data = JSON.parse(line)
        if (data.response) yield data.response
        if (data.done) return
      }
    } catch { /* ignorar líneas malformadas */ }
  }
}

// ─── Auto-procesamiento de reportes ──────────────────────────────────────────

export async function procesarReporte(reporteId: string, audioPath: string): Promise<void> {
  // Marcar como procesando
  await repo.crearReporteIA(reporteId)
  await repo.actualizarReporteIA(reporteId, { estado: 'PROCESANDO' })

  try {
    // 1. Transcripción
    const transcripcion = await transcribir(audioPath)

    // 2. Clasificación
    const { tipo, resumen, confianza } = await clasificar(transcripcion)

    // 3. Si es EMERGENCIA, generar respuesta automática de Central IA
    let respuesta_ia: string | undefined
    if (tipo === 'EMERGENCIA') {
      console.log(`[ASISTENTE] EMERGENCIA detectada en reporte ${reporteId}. Generando respuesta Central IA...`)
      respuesta_ia = await generarRespuestaEmergencia(transcripcion, resumen)
      console.log(`[ASISTENTE] Respuesta generada: ${respuesta_ia.slice(0, 80)}...`)
    }

    // 4. Guardar resultado
    await repo.actualizarReporteIA(reporteId, {
      transcripcion,
      tipo_ia: tipo,
      resumen,
      confianza,
      estado: 'OK',
      respuesta_ia,
    })
  } catch (err: any) {
    await repo.actualizarReporteIA(reporteId, {
      estado: 'ERROR',
      error: String(err?.message ?? err).slice(0, 500),
    })
  }
}

// ─── Job de auto-procesamiento ────────────────────────────────────────────────

let _procesando = false

export async function tickAutoProcess() {
  if (_procesando) return
  _procesando = true
  try {
    const pendientes = await repo.reportesPendientes(3)
    for (const r of pendientes) {
      await procesarReporte(r.id, r.archivo_path).catch(() => {})
    }
  } finally {
    _procesando = false
  }
}

export function iniciarAutoProcess(intervalMs = 30_000) {
  console.log('[ASISTENTE] Auto-procesamiento activo cada', intervalMs / 1000, 's')
  setInterval(tickAutoProcess, intervalMs)
  // Primer tick inmediato
  setTimeout(tickAutoProcess, 5_000)
}

// ─── Health check IA ─────────────────────────────────────────────────────────

export async function healthIA(): Promise<{ whisper: boolean; ollama: boolean; modelo: string }> {
  const [w, o] = await Promise.all([
    fetch(`${WHISPER_URL}/health`, { signal: AbortSignal.timeout(3_000) })
      .then((r: Response) => r.ok).catch(() => false),
    fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3_000) })
      .then((r: Response) => r.ok).catch(() => false),
  ])
  return { whisper: Boolean(w), ollama: Boolean(o), modelo: OLLAMA_MODEL }
}

// ─── Comunicados programados ──────────────────────────────────────────────────

const CENTRAL_URL     = process.env.CENTRAL_URL     || 'http://localhost:3070'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'whatseg-internal'

async function generarAudioTTS(texto: string): Promise<string> {
  const res = await fetch(`${WHISPER_URL}/tts`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ texto, voz: 'es-CO-SalomeNeural' }),
    signal:  AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`TTS error ${res.status}`)
  const data = await res.json() as any
  if (!data.path) throw new Error('TTS: sin ruta de audio')
  return data.path
}

async function generarTextoComunicadoIA(mensaje: string, titulo: string): Promise<string> {
  const prompt = `Eres Central, asistente de seguridad de WhatsEg. Genera un comunicado formal y conciso para los guardias de seguridad.

Título: "${titulo}"
Instrucción: "${mensaje}"

Responde SOLO con el texto del comunicado, en 2-3 oraciones, en español. Sin encabezados.`
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal:  AbortSignal.timeout(25_000),
    })
    if (!res.ok) throw new Error('Ollama error')
    const data = await res.json() as any
    return (data.response ?? '').trim() || mensaje
  } catch { return mensaje }
}

async function enviarComunicadoPTT(comunidadId: string, texto: string, audioPath: string): Promise<void> {
  const res = await fetch(`${CENTRAL_URL}/internal/comunicado`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
    body:    JSON.stringify({ community_id: comunidadId, audio_path: audioPath, texto, guardia_nombre: 'Central IA', formato: 'mp3' }),
    signal:  AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Central error ${res.status}`)
}

function calcularProximoEnvio(c: any): Date | null {
  if (c.frecuencia === 'UNICO') return null
  const [hh, mm] = (c.hora_envio || '08:00').split(':').map(Number)
  const col = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))

  if (c.frecuencia === 'DIARIO') {
    const next = new Date(col)
    next.setHours(hh, mm, 0, 0)
    if (next <= col) next.setDate(next.getDate() + 1)
    return new Date(next.getTime() + 5 * 60 * 60 * 1000)
  }

  if (c.frecuencia === 'SEMANAL') {
    const diasMap: Record<string, number> = { DOM: 0, LUN: 1, MAR: 2, MIE: 3, JUE: 4, VIE: 5, SAB: 6 }
    const dias: number[] = (c.dias_semana || 'LUN').split(',').map((d: string) => diasMap[d.trim()] ?? 1)
    const today = col.getDay()
    let minDiff = 7
    for (const d of dias) {
      let diff = d - today
      if (diff < 0) diff += 7
      if (diff === 0) {
        const todayAt = new Date(col)
        todayAt.setHours(hh, mm, 0, 0)
        diff = todayAt <= col ? 7 : 0
      }
      if (diff < minDiff) minDiff = diff
    }
    const next = new Date(col)
    next.setDate(next.getDate() + minDiff)
    next.setHours(hh, mm, 0, 0)
    return new Date(next.getTime() + 5 * 60 * 60 * 1000)
  }
  return null
}

export function calcularProximoEnvioPublico(data: {
  frecuencia: string; hora_envio?: string; dias_semana?: string
}): Date | null {
  return calcularProximoEnvio(data)
}

// Procesa y envía un comunicado específico por ID (para "enviar ahora")
export async function procesarComunicadoById(id: string): Promise<void> {
  const c = await repo.obtenerComunicadoPorId(id)
  if (!c) throw new Error('Comunicado no encontrado')

  const texto = c.tipo_contenido === 'IA_GENERADO'
    ? await generarTextoComunicadoIA(c.mensaje, c.titulo)
    : c.mensaje
  const audioPath = await generarAudioTTS(texto)
  await enviarComunicadoPTT(c.comunidad_id, texto, audioPath)
  fs.unlink(audioPath, () => {})

  const proxEnvio = calcularProximoEnvio(c)
  await repo.marcarEnviado(c.id, proxEnvio)
}

let _comunicandoActivo = false

export async function tickComunicados() {
  if (_comunicandoActivo) return
  _comunicandoActivo = true
  try {
    const debidos = await repo.comunicadosDue()
    for (const c of debidos) {
      console.log(`[COMUNICADOS] Enviando "${c.titulo}" a ${c.comunidad_id}`)
      try {
        const texto = c.tipo_contenido === 'IA_GENERADO'
          ? await generarTextoComunicadoIA(c.mensaje, c.titulo)
          : c.mensaje
        const audioPath = await generarAudioTTS(texto)
        await enviarComunicadoPTT(c.comunidad_id, texto, audioPath)
        fs.unlink(audioPath, () => {})
        const proxEnvio = calcularProximoEnvio(c)
        await repo.marcarEnviado(c.id, proxEnvio)
        console.log(`[COMUNICADOS] OK "${c.titulo}" — próximo: ${proxEnvio?.toISOString() ?? 'fin'}`)
      } catch (err: any) {
        console.error(`[COMUNICADOS] Error "${c.titulo}":`, err?.message ?? err)
      }
    }
  } finally {
    _comunicandoActivo = false
  }
}

export function iniciarSchedulerComunicados(intervalMs = 60_000) {
  console.log('[COMUNICADOS] Scheduler activo cada', intervalMs / 1000, 's')
  setInterval(tickComunicados, intervalMs)
  setTimeout(tickComunicados, 15_000)
}
