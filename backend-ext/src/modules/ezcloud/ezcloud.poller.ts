/**
 * EZCloud Motion Alert Poller
 * Polls /openapi/alarm/list every 60 s, captures a snapshot on each alarm,
 * downloads it to /tmp and sends it via wa-bridge to clients with PROTECCION.
 */

import path          from 'path'
import fs            from 'fs/promises'
import os            from 'os'
import crypto        from 'crypto'
import { exec as _exec } from 'child_process'
import { promisify }     from 'util'

const execAsync = promisify(_exec)

import { listarCuentas } from './ezcloud.repository'
import * as repo         from './ezcloud.repository'
import { EzcloudClient } from './ezcloud.client'
import type { EzAlarm }  from './ezcloud.client'
import { publishMqtt }   from '../../shared/services/mqtt.service'

// Per-account: timestamp of last successful poll
const lastChecked = new Map<string, Date>()

// Per-account: reuse client instances to preserve token cache between polls
const clientCache = new Map<string, EzcloudClient>()

// Dedup: alarmIds already processed in this session (exported for webhook handler)
export const processedAlarms = new Set<string>()

export function startEzcloudPoller(): void {
  setInterval(pollAlarms, 300_000)
  console.log('[ezcloud-poller] Iniciado (intervalo 300 s)')
}

// ─── poll loop ────────────────────────────────────────────────────────────────

async function pollAlarms(): Promise<void> {
  let cuentas: Awaited<ReturnType<typeof listarCuentas>>
  try {
    cuentas = await listarCuentas()
  } catch (e: any) {
    console.error('[ezcloud-poller] Error cargando cuentas:', e.message)
    return
  }

  const activas = cuentas.filter(c => c.activa)
  console.log(`[ezcloud-poller] Poll — ${activas.length} cuenta(s) activa(s)`)

  for (const cuenta of activas) {
    try {
      // Reuse existing client to preserve token cache between polls
      let client = clientCache.get(cuenta.id)
      if (!client) {
        client = new EzcloudClient(cuenta.app_key, cuenta.app_secret, cuenta.base_url)
        clientCache.set(cuenta.id, client)
      }
      const since  = lastChecked.get(cuenta.id) ?? new Date(Date.now() - 305_000)

      const alarms = await client.listAlarms(since)
      lastChecked.set(cuenta.id, new Date())
      console.log(`[ezcloud-poller] Cuenta "${cuenta.nombre}": ${alarms.length} alarma(s) desde ${since.toISOString()}`)

      for (const alarm of alarms) {
        if (processedAlarms.has(alarm.alarmId)) continue
        processedAlarms.add(alarm.alarmId)
        // Keep set bounded
        if (processedAlarms.size > 1000) {
          const first = processedAlarms.values().next().value
          if (first) processedAlarms.delete(first)
        }

        handleAlarm(alarm, client).catch(e =>
          console.error('[ezcloud-poller] Error en alarma', alarm.alarmId, e.message))
      }
    } catch (e: any) {
      console.error('[ezcloud-poller] Error cuenta', cuenta.nombre, e.message)
    }
  }
}

// ─── alarm handler ────────────────────────────────────────────────────────────

export async function handleAlarm(alarm: EzAlarm, client: EzcloudClient): Promise<void> {
  console.log(`[ezcloud-poller] Alarma tipo=${alarm.alarmType} serial=${alarm.deviceSerial} id=${alarm.alarmId}`)

  // 1. Find the device and its community
  const disp = await repo.getDispositivoBySerial(alarm.deviceSerial)
  if (!disp?.comunidad_id) {
    console.log(`[ezcloud-poller] Dispositivo ${alarm.deviceSerial} sin comunidad asignada — ignorando`)
    return
  }

  // 2. Check per-device toggle (default: enabled)
  const activa = await repo.isAlertaActiva(disp.id)
  if (!activa) {
    console.log(`[ezcloud-poller] Alertas desactivadas para ${alarm.deviceSerial} — ignorando`)
    return
  }

  // 3. Get snapshot — priority: inline base64 → picUrl → fresh capture
  let picFilePath: string | null = null   // path to local temp file (already downloaded)
  let picUrl:      string | null = null   // remote URL to download

  if (alarm.picBase64) {
    // Camera pushed inline JPEG — save directly to /tmp
    try {
      const b64 = alarm.picBase64.replace(/^data:image\/\w+;base64,/, '')
      const buf = Buffer.from(b64, 'base64')
      picFilePath = path.join(os.tmpdir(), `ezalert_${crypto.randomUUID()}.jpg`)
      await fs.writeFile(picFilePath, buf)
    } catch (e: any) {
      console.error('[ezcloud-poller] Error guardando picBase64:', e.message)
      picFilePath = null
    }
  } else {
    picUrl = alarm.picUrl ?? null
    if (!picUrl) {
      try {
        picUrl = await client.captureSnapshot(alarm.deviceSerial, alarm.channelNo || 1)
      } catch {
        picUrl = null   // proceed without image
      }
    }
  }

  // 4. Build caption
  const typeName =
    alarm.alarmType === 2 ? 'Detección de persona' :
    alarm.alarmType === 3 ? 'Detección de vehículo' :
    'Detección de movimiento'

  const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })
  const caption = `🚨 *Alerta de seguridad*\n${typeName} detectada\nCámara: ${alarm.deviceSerial}\nHora: ${hora}`

  // 5. Send WhatsApp to PROTECCION clients
  const phones = await repo.getClientesWhatsapp(disp.comunidad_id)
  if (phones.length > 0) {
    if (picFilePath) {
      await sendFileToAll(phones, picFilePath, caption)
    } else if (picUrl) {
      await sendSnapshotToAll(phones, picUrl, caption)
    } else {
      await sendTextToAll(phones, caption)
    }
    console.log(`[ezcloud-poller] Alarma ${alarm.alarmId} → ${phones.length} destinatarios WhatsApp`)
  } else {
    // No WhatsApp recipients — clean up pic if we have one
    if (picFilePath) await fs.unlink(picFilePath).catch(() => {})
  }

  // 6. Trigger physical ALARMA devices in the community
  await triggerAlarmasEnComunidad(disp.comunidad_id)
}

// ─── wa-bridge helpers ────────────────────────────────────────────────────────

/** Send a pre-saved local file to all phones (used when camera pushes inline base64) */
async function sendFileToAll(
  phones: string[], filePath: string, caption: string
): Promise<void> {
  const bridgeUrl = `http://127.0.0.1:${process.env.WA_BRIDGE_PORT ?? '3072'}/send-media`
  try {
    for (const phone of phones) {
      const num = normalizePhone(phone)
      if (!num) continue
      await fetch(bridgeUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: num, filePath, mimeType: 'image/jpeg', caption }),
        signal:  AbortSignal.timeout(15_000),
      }).catch(e => console.error('[ezcloud-poller] wa-bridge error:', e.message))
    }
  } finally {
    await fs.unlink(filePath).catch(() => {})
  }
}

async function sendSnapshotToAll(
  phones: string[], imageUrl: string, caption: string
): Promise<void> {
  const filePath = path.join(os.tmpdir(), `ezalert_${crypto.randomUUID()}.jpg`)

  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await fs.writeFile(filePath, buf)
  } catch (e: any) {
    console.error('[ezcloud-poller] No se pudo descargar snapshot:', e.message)
    return sendTextToAll(phones, caption)
  }

  try {
    const bridgeUrl = `http://127.0.0.1:${process.env.WA_BRIDGE_PORT ?? '3072'}/send-media`
    for (const phone of phones) {
      const num = normalizePhone(phone)
      if (!num) continue
      await fetch(bridgeUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: num, filePath, mimeType: 'image/jpeg', caption }),
        signal:  AbortSignal.timeout(15_000),
      }).catch(e => console.error('[ezcloud-poller] wa-bridge error:', e.message))
    }
  } finally {
    await fs.unlink(filePath).catch(() => {})
  }
}

async function sendTextToAll(phones: string[], text: string): Promise<void> {
  const bridgeUrl = `http://127.0.0.1:${process.env.WA_BRIDGE_PORT ?? '3072'}/send`
  for (const phone of phones) {
    const num = normalizePhone(phone)
    if (!num) continue
    await fetch(bridgeUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone: num, text }),
      signal:  AbortSignal.timeout(10_000),
    }).catch(() => {})
  }
}

// ─── snapshot-based motion detection poller ──────────────────────────────────
//
// EZCloud SA server no soporta listAlarms ni webhook subscriptions.
// Solución: capturar snapshot cada SNAP_INTERVAL_MS, reducir a 64×64 gris
// con ffmpeg y comparar diferencia promedio de píxeles contra el anterior.
// Dos frames consecutivos con Δ > MOTION_THRESHOLD = alarma confirmada.
//

const SNAP_INTERVAL_MS = 6_000    // poll cada 6 s → delay máximo ~12 s
const MOTION_THRESHOLD = 12       // diff promedio 0–255 para considerar movimiento
const MOTION_CONFIRM   = 2        // frames consecutivos antes de alertar
const SNAP_COOLDOWN_MS = 60_000   // mínimo 60 s entre alarmas por cámara
const SNAP_W = 64
const SNAP_H = 64

const snapPixels   = new Map<string, Buffer>()  // serial → frame gris anterior
const snapCooldown = new Map<string, number>()  // serial → ms del último alert
const snapPending  = new Map<string, number>()  // serial → frames consecutivos con movimiento
const snapNoSupport = new Map<string, number>() // serial → ms de primera falla (skip camera for 30 min)
let   snapBusy     = false                       // evitar runs solapados

/** Descarga el JPEG de una URL y lo reduce a 64×64 gris mediante ffmpeg (4096 bytes raw) */
async function getGrayPixels(jpegUrl: string): Promise<Buffer | null> {
  const id  = crypto.randomUUID()
  const inp = path.join(os.tmpdir(), `snp_${id}.jpg`)
  const out = path.join(os.tmpdir(), `snp_${id}.raw`)
  try {
    const res = await fetch(jpegUrl, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    await fs.writeFile(inp, Buffer.from(await res.arrayBuffer()))
    await execAsync(
      `ffmpeg -y -loglevel quiet -i "${inp}" -vf "scale=${SNAP_W}:${SNAP_H},format=gray8" -f rawvideo -frames:v 1 "${out}"`
    )
    const buf = await fs.readFile(out)
    return buf.length === SNAP_W * SNAP_H ? buf : null
  } catch { return null }
  finally {
    fs.unlink(inp).catch(() => {})
    fs.unlink(out).catch(() => {})
  }
}

function avgPixelDiff(a: Buffer, b: Buffer): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
  return sum / a.length
}

async function pollSnapshots(): Promise<void> {
  if (snapBusy) return
  snapBusy = true
  try {
    const { prisma } = await import('../../shared/config/prisma')
    const cameras = await prisma.$queryRaw<{ id: string; serial: string }[]>`
      SELECT id::text, ezcloud_serial AS serial
      FROM dispositivos
      WHERE ezcloud_serial IS NOT NULL
    `
    if (cameras.length === 0) return

    // Reusar clientCache del poller de alarmas; si está vacío, inicializarlo
    if (clientCache.size === 0) {
      const cuentas = (await listarCuentas()).filter(c => c.activa)
      for (const ct of cuentas) {
        clientCache.set(ct.id, new EzcloudClient(ct.app_key, ct.app_secret, ct.base_url))
      }
    }
    if (clientCache.size === 0) return

    const client = clientCache.values().next().value as EzcloudClient

    for (const cam of cameras) {
      // Skip cameras that don't support remote snapshot for 30 minutes
      const noSupport = snapNoSupport.get(cam.serial)
      if (noSupport && Date.now() - noSupport < 30 * 60_000) continue

      try {
        const snapUrl = await client.captureSnapshot(cam.serial, 1)
        // If we get here, snapshot works — clear any previous failure
        snapNoSupport.delete(cam.serial)
        const pixels  = await getGrayPixels(snapUrl)
        if (!pixels) continue

        const prev = snapPixels.get(cam.serial)
        snapPixels.set(cam.serial, pixels)
        if (!prev) continue   // primer frame — sin comparación

        const score = avgPixelDiff(prev, pixels)
        console.log(`[snapshot-poller] ${cam.serial.slice(-6)} Δ=${score.toFixed(1)}`)

        if (score > MOTION_THRESHOLD) {
          const n = (snapPending.get(cam.serial) ?? 0) + 1
          snapPending.set(cam.serial, n)
          const lastAlert = snapCooldown.get(cam.serial) ?? 0
          if (n >= MOTION_CONFIRM && Date.now() - lastAlert > SNAP_COOLDOWN_MS) {
            console.log(`[snapshot-poller] 🚨 MOVIMIENTO confirmado ${cam.serial} Δ=${score.toFixed(1)}`)
            snapCooldown.set(cam.serial, Date.now())
            snapPending.set(cam.serial, 0)
            const alarm: EzAlarm = {
              alarmId:      `snap-${Date.now()}`,
              deviceSerial: cam.serial,
              channelNo:    1,
              alarmType:    1,   // motion
              alarmTime:    Math.floor(Date.now() / 1000),
              picUrl:       snapUrl,
            }
            handleAlarm(alarm, client).catch(e =>
              console.error('[snapshot-poller] handleAlarm error:', e.message))
          }
        } else {
          snapPending.set(cam.serial, 0)   // resetear en frame sin movimiento
        }
      } catch (e: any) {
        if (!snapNoSupport.has(cam.serial)) {
          // Log once, then silence for 30 min (avoids spam when captureSnapshot not supported)
          console.log(`[snapshot-poller] cam ${cam.serial} snapshot no disponible — pausando 30 min (${e.message})`)
          snapNoSupport.set(cam.serial, Date.now())
        }
      }
    }
  } finally {
    snapBusy = false
  }
}

let snapPollerTimer: ReturnType<typeof setInterval> | null = null

export function startSnapshotPoller(): void {
  if (snapPollerTimer) return
  console.log(`[snapshot-poller] Iniciado — intervalo ${SNAP_INTERVAL_MS / 1000}s, umbral Δ=${MOTION_THRESHOLD}`)
  // warm-up: primer poll a los 5 s del arranque
  setTimeout(() => {
    pollSnapshots().catch(() => {})
    snapPollerTimer = setInterval(
      () => pollSnapshots().catch(e => console.error('[snapshot-poller]', e.message)),
      SNAP_INTERVAL_MS
    )
  }, 5_000)
}

export function stopSnapshotPoller(): void {
  if (snapPollerTimer) {
    clearInterval(snapPollerTimer)
    snapPollerTimer = null
  }
}

// ─── physical alarm trigger ───────────────────────────────────────────────────

/**
 * Activates all ALARMA devices in a community via MQTT (whatseg-relay driver).
 * Uses the same topic pattern as the /dispositivos/:id/probar endpoint:
 *   topic:   whatseg/{mqtt_device_id}/cmd
 *   payload: relay_on:30   (activates relay for 30 seconds)
 */
async function triggerAlarmasEnComunidad(comunidadId: string): Promise<void> {
  try {
    const alarmas = await repo.getAlarmasEnComunidad(comunidadId)
    if (alarmas.length === 0) return

    for (const alarma of alarmas) {
      if (!alarma.mqtt_device_id) continue

      const topic   = `whatseg/${alarma.mqtt_device_id}/cmd`
      const payload = 'relay_on:30'

      await publishMqtt(topic, payload)
        .then(() => console.log(`[ezcloud-poller] 🔔 Alarma física activada: "${alarma.nombre}" → ${topic}`))
        .catch(e  => console.error(`[ezcloud-poller] Error activando alarma "${alarma.nombre}":`, e.message))
    }
  } catch (e: any) {
    console.error('[ezcloud-poller] Error en triggerAlarmasEnComunidad:', e.message)
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Normalize to international format (default: Colombia +57) */
function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10)                        return `57${digits}`   // local CO
  if (digits.length === 12 && digits.startsWith('57')) return digits       // already CO int'l
  if (digits.length > 7)                           return digits           // other intl
  return null
}
