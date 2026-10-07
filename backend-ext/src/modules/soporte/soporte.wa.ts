import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import path from 'path'
import fs from 'fs/promises'
import QRCode from 'qrcode'
import * as repo from './soporte.repository'

// ─── Estado global de la conexión ─────────────────────────────────────────────

type WAStatus = 'disconnected' | 'connecting' | 'connected'

let _status: WAStatus = 'disconnected'
let _qrDataUrl: string | null = null   // base64 PNG para mostrar en el panel
let _sock: ReturnType<typeof makeWASocket> | null = null
let _reconnecting = false

const SESSION_DIR = path.join(process.cwd(), 'data', 'soporte-wa-session')

async function clearSession() {
  try {
    const files = await fs.readdir(SESSION_DIR)
    await Promise.all(files.map(f => fs.unlink(path.join(SESSION_DIR, f)).catch(() => {})))
    console.log('[SOPORTE-WA] Sesión limpiada — listo para nuevo QR')
  } catch { /* directorio vacío o inexistente */ }
}

// ─── API pública ───────────────────────────────────────────────────────────────

export function getWAStatus() {
  return { status: _status, qr: _qrDataUrl, phone: _sock?.user?.id?.split(':')[0] ?? null }
}

export async function sendWAMessage(caso_id: string, phone: string, opts: {
  textoWA: string          // texto que se envía por WhatsApp (traducido si aplica)
  textoOriginal: string    // lo que escribió el agente (en español)
  idiomaOrigen?: string    // idioma del agente (default 'es')
  textoTraducido?: string | null
  idiomaDest?: string | null
}) {
  if (!_sock || _status !== 'connected') throw new Error('WhatsApp no conectado')
  const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net'
  await _sock.sendMessage(jid, { text: opts.textoWA })
  await repo.crearMensaje({
    caso_id,
    autor:           'AGENTE',
    texto_original:  opts.textoOriginal,
    idioma_origen:   opts.idiomaOrigen ?? 'es',
    texto_traducido: opts.textoTraducido ?? null,
    idioma_destino:  opts.idiomaDest    ?? null,
  })
}

export async function logoutWA() {
  if (_sock) {
    await _sock.logout()
    _sock = null
    _status = 'disconnected'
    _qrDataUrl = null
  }
}

// ─── Inicialización de Baileys ─────────────────────────────────────────────────

export async function initBotonWA() {
  if (_reconnecting) return
  _reconnecting = true

  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
    const { version } = await fetchLatestBaileysVersion()

    _sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      // Silenciar logs de pino para no contaminar consola del servidor
      logger: require('pino')({ level: 'silent' }),
    })

    _sock.ev.on('creds.update', saveCreds)

    // ── Conexión / QR ──────────────────────────────────────────────────────
    _sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        // Convertir string QR a imagen base64 PNG para el panel
        _qrDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 })
        _status = 'connecting'
        console.log('[SOPORTE-WA] QR generado — escanea desde el panel')
      }

      if (connection === 'open') {
        _status = 'connected'
        _qrDataUrl = null
        _reconnecting = false
        console.log('[SOPORTE-WA] WhatsApp conectado:', _sock?.user?.id)
      }

      if (connection === 'close') {
        _status = 'disconnected'
        _qrDataUrl = null
        _reconnecting = false
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode
        const doReconnect = code !== DisconnectReason.loggedOut
        console.log('[SOPORTE-WA] Desconectado — código:', code, doReconnect ? '(reconectando)' : '(logout — limpiando sesión)')
        if (doReconnect) {
          setTimeout(initBotonWA, 5000)
        } else {
          // 401 logout: la sesión es inválida — borrar archivos para que el
          // próximo intento genere un QR nuevo en vez de volver a fallar
          clearSession()
        }
      }
    })

    // ── Mensajes entrantes ─────────────────────────────────────────────────
    _sock.ev.on('messages.upsert', async ({ messages, type }) => {
      console.log(`[SOPORTE-WA] upsert type=${type} count=${messages.length}`)
      // 'notify' = mensaje nuevo en tiempo real
      // 'append' = mensajes sincronizados al reconectar — procesamos solo los muy recientes (< 3 min)
      const now = Date.now()
      if (type !== 'notify' && type !== 'append') return

      for (const msg of messages) {
        const jid = msg.key.remoteJid || ''
        const ts  = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : 0
        console.log(`[SOPORTE-WA] msg jid=${jid} fromMe=${msg.key.fromMe} type=${type} age=${Math.round((now-ts)/1000)}s hasMsg=${!!msg.message}`)

        if (type === 'append') {
          if (now - ts > 3 * 60 * 1000) continue   // ignorar mensajes viejos del sync
        }
        if (msg.key.fromMe) continue           // ignorar mensajes propios
        if (!msg.message)   continue

        // Aceptar @s.whatsapp.net (formato clásico) y @lid (Linked ID, protocolo nuevo)
        const isIndividual = jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid')
        if (!isIndividual) continue

        const phone = jid.endsWith('@lid')
          ? jid.replace('@lid', '')
          : jid.replace('@s.whatsapp.net', '')
        const nombre = msg.pushName || phone
        // Baileys a veces envuelve el mensaje real en capas adicionales
        const inner: any =
          (msg.message as any).ephemeralMessage?.message ||
          (msg.message as any).viewOnceMessage?.message ||
          (msg.message as any).viewOnceMessageV2?.message?.message ||
          msg.message

        const texto  =
          inner.conversation ||
          inner.extendedTextMessage?.text ||
          (inner.audioMessage    ? '[Audio recibido]'      : '') ||
          (inner.imageMessage    ? '[Imagen recibida]'     : '') ||
          (inner.videoMessage    ? '[Video recibido]'      : '') ||
          (inner.documentMessage ? '[Documento recibido]'  : '') ||
          (inner.stickerMessage  ? '[Sticker recibido]'    : '') ||
          ''

        if (!texto) continue

        await handleIncomingWA(phone, nombre, texto)
      }
    })

  } catch (err) {
    _reconnecting = false
    console.error('[SOPORTE-WA] Error al inicializar:', err)
    setTimeout(initBotonWA, 10000)
  }
}

// ─── Traducción automática (Google Translate sin API key) ─────────────────────

async function translateToES(text: string): Promise<{ translated: string; srcLang: string } | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data: any = await res.json()
    const translated = (data[0] as any[]).map((c: any[]) => c[0]).join('')
    const srcLang    = (data[2] as string) || 'en'
    return { translated, srcLang }
  } catch {
    return null
  }
}

// ─── Lógica de mensajes entrantes ─────────────────────────────────────────────

async function handleIncomingWA(phone: string, nombre: string, texto: string) {
  try {
    // Buscar caso ABIERTO o EN_PROCESO para este teléfono
    let caso = await repo.obtenerCasoActivoPorTelefono(phone)

    if (!caso) {
      // Crear nuevo caso
      caso = await repo.crearCaso({
        cliente_nombre:   nombre,
        cliente_telefono: phone,
        idioma:           'en',          // por defecto inglés; el agente puede cambiarlo
        asunto:           `WhatsApp: ${texto.slice(0, 80)}`,
        comunidad_id:     null,
      })
      console.log(`[SOPORTE-WA] Nuevo caso #${caso.id} para ${phone}`)
    }

    // Traducir automáticamente al español
    const trad = await translateToES(texto)
    const idiomaOrigen = trad?.srcLang ?? 'en'
    const textoTrad    = (trad && trad.srcLang !== 'es') ? trad.translated : null

    // Guardar el mensaje del cliente
    await repo.crearMensaje({
      caso_id:         caso.id,
      autor:           'CLIENTE',
      texto_original:  texto,
      idioma_origen:   idiomaOrigen,
      texto_traducido: textoTrad,
      idioma_destino:  textoTrad ? 'es' : null,
    })

    console.log(`[SOPORTE-WA] ${phone}: "${texto.slice(0, 80)}"`)
  } catch (e: any) {
    console.error('[SOPORTE-WA] handleIncomingWA error:', e?.message)
  }
}
