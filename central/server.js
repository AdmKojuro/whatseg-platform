const express = require("express");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const WebSocket = require("ws");
const mqtt = require("mqtt");
const { Pool } = require("pg");

const app = express();
const PORT = 3070;
const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = 3067;
const MQTT_URL = "mqtt://127.0.0.1:1883";
const MQTT_USER = "trdbackend";
const MQTT_PASS = "5132a6ec43ab3877f6a6d396424b068c";

// ── Dolynk API ──────────────────────────────────────────
const DOLYNK_ACCESS_KEY = "2038684337432633344";
const DOLYNK_SECRET_KEY = "KYsYhy0A634wUuDUqCvbt7QajyFUafr7";
const DOLYNK_PRODUCT_ID = "1050600652";
const DOLYNK_BASE_URL   = "https://open-api-or.dolynkcloud.com";
let dolynkTokenCache = null; // { token, expiresAt }

// ── PostgreSQL ───────────────────────────────────────────
const pool = new Pool({
  host: "127.0.0.1",
  port: 5432,
  database: "trdomatica",
  user: "trdomatica",
  password: "trdomatica123",
  max: 3,
});

// ── MQTT client ──────────────────────────────────────────
const mqttClient = mqtt.connect(MQTT_URL, {
  username: MQTT_USER,
  password: MQTT_PASS,
  clientId: "central-dashboard-" + Date.now(),
  reconnectPeriod: 5000,
});

mqttClient.on("connect", () => console.log("[Central] MQTT connected"));
mqttClient.on("error", (e) => console.log("[Central] MQTT error:", e.message));

// ── Middleware ────────────────────────────────────────────
app.use(express.json());

// Auth middleware: validate JWT and extract admin info
async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  try {
    const resp = await fetch(`http://${BACKEND_HOST}:${BACKEND_PORT}/api/dashboard/stats`, {
      headers: { Authorization: auth },
    });
    if (resp.status !== 200) {
      return res.status(401).json({ error: "Token invalido" });
    }
    const token = auth.split(" ")[1];
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    req.adminId = payload.sub || null;
    next();
  } catch {
    res.status(500).json({ error: "Error validando token" });
  }
}

// ── Log activation to DB ─────────────────────────────────
async function logActivation(mqttId, action, adminId) {
  try {
    const devResult = await pool.query(
      `SELECT id, comunidad_id, nombre FROM dispositivos WHERE mqtt_device_id = $1 LIMIT 1`,
      [mqttId]
    );
    if (devResult.rows.length === 0) {
      console.log(`[Central] Log skip: device ${mqttId} not found in DB`);
      return;
    }
    const dev = devResult.rows[0];
    const detalle = action === "relay_off"
      ? `Desactivado desde Central de Monitoreo`
      : `Activado desde Central de Monitoreo (${action})`;

    await pool.query(
      `INSERT INTO activaciones (id, dispositivo_id, comunidad_id, resultado, detalle, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'EXITOSO', $3, now())`,
      [dev.id, dev.comunidad_id, detalle]
    );
    console.log(`[Central] Logged: ${dev.nombre} - ${action}`);
  } catch (e) {
    console.error(`[Central] Log error:`, e.message);
  }
}

// ── MQTT command endpoints ───────────────────────────────
app.post("/cmd/activate/:mqttId", requireAuth, (req, res) => {
  const { mqttId } = req.params;
  const seconds = parseInt(req.body.seconds) || 3;
  const clamped = Math.max(1, Math.min(120, seconds));
  const topic = `whatseg/${mqttId}/cmd`;
  const message = `relay_on:${clamped}`;
  mqttClient.publish(topic, message, { qos: 1 }, (err) => {
    if (err) return res.status(500).json({ error: "MQTT publish failed" });
    console.log(`[Central] ${topic} <- ${message}`);
    logActivation(mqttId, message, req.adminId);
    res.json({ success: true, command: message });
  });
});

app.post("/cmd/deactivate/:mqttId", requireAuth, (req, res) => {
  const { mqttId } = req.params;
  const topic = `whatseg/${mqttId}/cmd`;
  mqttClient.publish(topic, "relay_off", { qos: 1 }, (err) => {
    if (err) return res.status(500).json({ error: "MQTT publish failed" });
    console.log(`[Central] ${topic} <- relay_off`);
    logActivation(mqttId, "relay_off", req.adminId);
    res.json({ success: true, command: "relay_off" });
  });
});

// ── Dolynk API client ───────────────────────────────────
function dolynkUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function dolynkSignAuth(timestamp, nonce) {
  const msg = DOLYNK_ACCESS_KEY + timestamp + nonce;
  return crypto.createHmac("sha512", DOLYNK_SECRET_KEY).update(msg).digest("hex").toUpperCase();
}

function dolynkSignBusiness(token, timestamp, nonce) {
  const msg = DOLYNK_ACCESS_KEY + token + timestamp + nonce;
  return crypto.createHmac("sha512", DOLYNK_SECRET_KEY).update(msg).digest("hex").toUpperCase();
}

function dolynkBaseHeaders(timestamp, nonce, sign) {
  return {
    "Content-Type": "application/json",
    "Accept-Language": "es-ES",
    "Version": "v1",
    "AccessKey": DOLYNK_ACCESS_KEY,
    "Timestamp": timestamp,
    "Nonce": nonce,
    "Sign": sign,
    "Sign-Type": "simple",
    "X-TraceId-Header": dolynkUuid(),
    "ProductId": DOLYNK_PRODUCT_ID,
  };
}

async function dolynkGetToken() {
  if (dolynkTokenCache && Date.now() < dolynkTokenCache.expiresAt) return dolynkTokenCache.token;
  const ts = Date.now().toString();
  const nonce = dolynkUuid();
  const sign = dolynkSignAuth(ts, nonce);
  const headers = dolynkBaseHeaders(ts, nonce, sign);

  const resp = await fetch(`${DOLYNK_BASE_URL}/open-api/api-base/auth/getAppAccessToken`, {
    method: "POST", headers, body: "{}",
  });
  const data = await resp.json();
  if (!data.success) throw new Error("Dolynk token error: " + (data.msg || data.code));

  const token = data.data.appAccessToken;
  const expireSec = parseInt(data.data.appAccessExpired || "7200", 10);
  dolynkTokenCache = { token, expiresAt: Date.now() + (expireSec - 120) * 1000 };
  console.log("[Central] Dolynk token obtained");
  return token;
}

async function dolynkPost(apiPath, body) {
  const token = await dolynkGetToken();
  const ts = Date.now().toString();
  const nonce = dolynkUuid();
  const sign = dolynkSignBusiness(token, ts, nonce);
  const headers = { ...dolynkBaseHeaders(ts, nonce, sign), AppAccessToken: token };

  const resp = await fetch(`${DOLYNK_BASE_URL}${apiPath}`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!data.success) {
    // Token expired — retry once
    if (data.code === "401" || (data.msg && data.msg.includes("token"))) {
      dolynkTokenCache = null;
      const newToken = await dolynkGetToken();
      const ts2 = Date.now().toString();
      const nonce2 = dolynkUuid();
      const sign2 = dolynkSignBusiness(newToken, ts2, nonce2);
      const headers2 = { ...dolynkBaseHeaders(ts2, nonce2, sign2), AppAccessToken: newToken };
      const resp2 = await fetch(`${DOLYNK_BASE_URL}${apiPath}`, {
        method: "POST", headers: headers2, body: JSON.stringify(body),
      });
      return resp2.json();
    }
    return data;
  }
  return data;
}

// ── Camera endpoints (Dolynk) ───────────────────────────
app.get("/cam/cameras", requireAuth, async (req, res) => {
  try {
    // Get cameras from DB (dispositivos with dolynk_device_id)
    const result = await pool.query(`
      SELECT d.dolynk_device_id, d.dolynk_channel_id, d.nombre, c.nombre as comunidad
      FROM dispositivos d
      LEFT JOIN comunidades c ON d.comunidad_id = c.id
      WHERE d.cuenta_dolynk_id IS NOT NULL AND d.dolynk_device_id IS NOT NULL AND d.dolynk_device_id != ''
      ORDER BY c.nombre, d.nombre
    `);
    const cameras = result.rows.map((r) => ({
      deviceId: r.dolynk_device_id,
      channelId: r.dolynk_channel_id || "0",
      name: r.nombre,
      comunidad: r.comunidad || "Sin comunidad",
    }));
    res.json(cameras);
  } catch (e) {
    console.error("[Central] Cameras list error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/cam/snapshot/:deviceId", requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const channelId = req.query.channel || "0";
    const data = await dolynkPost("/open-api/api-iot/device/captureDeviceSnapshot", {
      deviceId, channelId: String(channelId),
    });
    if (!data.success || !data.data?.url) {
      return res.status(200).json({ offline: true, error: data.msg || "Sin señal" });
    }
    res.json({ url: data.data.url });
  } catch (e) {
    console.error("[Central] Dolynk snapshot error:", e.message);
    res.status(200).json({ offline: true, error: e.message });
  }
});

// ── Soporte Bilingüe (YCloud WhatsApp Business API) ───────────────────────
const YCLOUD_API_KEY  = process.env.YCLOUD_API_KEY || "0a3785a41b62bf1f48f2a07e0dcc863a";
const YCLOUD_API_BASE = "https://api.ycloud.com/v2";
const YCLOUD_WA_FROM  = process.env.YCLOUD_WA_FROM || "+573238974747";

// Init DB tables
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS soporte_bilingue_sesiones (
        id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        phone        TEXT NOT NULL UNIQUE,
        comunidad_id TEXT,
        puesto_id    TEXT,
        idioma       TEXT DEFAULT 'en',
        estado       TEXT DEFAULT 'activo',
        created_at   TIMESTAMPTZ DEFAULT now(),
        updated_at   TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS soporte_bilingue_mensajes (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        sesion_id       TEXT NOT NULL,
        remitente       TEXT NOT NULL,
        texto_original  TEXT NOT NULL,
        texto_traducido TEXT,
        created_at      TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log("[Soporte] DB tables ready — proveedor: YCloud");
  } catch (e) {
    console.error("[Soporte] DB init error:", e.message);
  }
})();

// Translate via MyMemory (free, no key needed)
async function traducir(texto, de, a) {
  if (!texto || !texto.trim()) return texto;
  try {
    const url =
      "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(texto.slice(0, 500)) +
      "&langpair=" + de + "|" + a;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.responseStatus === 200) return data.responseData.translatedText || texto;
  } catch {}
  return texto;
}

// Send WhatsApp message via YCloud API
async function enviarMensajeYCloud(to, text) {
  if (!YCLOUD_WA_FROM) {
    console.warn("[Soporte] YCLOUD_WA_FROM no configurado — mensaje no enviado");
    return { ok: false, error: "Número de WhatsApp no configurado" };
  }
  try {
    const resp = await fetch(`${YCLOUD_API_BASE}/whatsapp/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": YCLOUD_API_KEY,
      },
      body: JSON.stringify({
        from: YCLOUD_WA_FROM,
        to,
        type: "text",
        text: { body: text },
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const msg = err.message || err.errorMessage || `HTTP ${resp.status}`;
      console.error("[Soporte] YCloud error:", resp.status, msg);
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (e) {
    console.error("[Soporte] YCloud fetch error:", e.message);
    return { ok: false, error: e.message };
  }
}

// Handle incoming WhatsApp message from foreigner
async function handleIncomingWA(phone, text) {
  const trimmed = text.trim();

  // ── New session via QR ────────────────────────────────────────────────
  if (trimmed.toUpperCase().startsWith("WSEG ")) {
    const parts = trimmed.split(/\s+/);
    const comunidad_id = parts[1] || "";
    const puesto_id    = parts[2] || "";
    try {
      const r = await pool.query(
        `INSERT INTO soporte_bilingue_sesiones (phone, comunidad_id, puesto_id, estado)
         VALUES ($1, $2, $3, 'activo')
         ON CONFLICT (phone) DO UPDATE
           SET comunidad_id=$2, puesto_id=$3, estado='activo', updated_at=now()
         RETURNING id`,
        [phone, comunidad_id, puesto_id]
      );
      const sesId = r.rows[0].id;
      await pool.query(
        `INSERT INTO soporte_bilingue_mensajes (sesion_id, remitente, texto_original, texto_traducido)
         VALUES ($1, 'sistema', $2, $2)`,
        [sesId, `[WSEG] comunidad=${comunidad_id} puesto=${puesto_id}`]
      );
      const welcome =
        "Hello! You are connected to WhatsEg Bilingual Support 🌐\n" +
        "An operator will assist you shortly.\n" +
        "Please describe your situation.";
      await enviarMensajeYCloud(phone, welcome);
      await pool.query(
        `INSERT INTO soporte_bilingue_mensajes (sesion_id, remitente, texto_original, texto_traducido)
         VALUES ($1, 'sistema', $2, $2)`,
        [sesId, welcome]
      );
      console.log(`[Soporte] Nueva sesion: ${phone} comunidad=${comunidad_id} puesto=${puesto_id}`);
    } catch (e) {
      console.error("[Soporte] WSEG init error:", e.message);
    }
    return;
  }

  // ── Ongoing session: translate to Spanish for operator ───────────────
  try {
    const sesRes = await pool.query(
      `SELECT * FROM soporte_bilingue_sesiones WHERE phone=$1 AND estado='activo'`,
      [phone]
    );
    if (sesRes.rows.length === 0) {
      // No hay sesión — crear automáticamente y enviar bienvenida
      try {
        const r = await pool.query(
          `INSERT INTO soporte_bilingue_sesiones (phone, comunidad_id, puesto_id, estado)
           VALUES ($1, 'GENERAL', 'ENTRANTE', 'activo')
           ON CONFLICT (phone) DO UPDATE
             SET comunidad_id='GENERAL', puesto_id='ENTRANTE', estado='activo', updated_at=now()
           RETURNING id`,
          [phone]
        );
        const sesId = r.rows[0].id;
        const welcome =
          "👋 Hello! Welcome to WhatsEg Support.\n" +
          "An operator will assist you shortly with information and guidance.\n" +
          "Please describe your situation.";
        await enviarMensajeYCloud(phone, welcome);
        await pool.query(
          `INSERT INTO soporte_bilingue_mensajes (sesion_id, remitente, texto_original, texto_traducido)
           VALUES ($1, 'sistema', $2, $2)`,
          [sesId, welcome]
        );
        const traducido = await traducir(trimmed, "autodetect", "es");
        await pool.query(
          `INSERT INTO soporte_bilingue_mensajes (sesion_id, remitente, texto_original, texto_traducido)
           VALUES ($1, 'extranjero', $2, $3)`,
          [sesId, trimmed, traducido]
        );
        await pool.query(`UPDATE soporte_bilingue_sesiones SET updated_at=now() WHERE id=$1`, [sesId]);
        console.log(`[Soporte] Nueva sesion auto: ${phone} → "${traducido}"`);
      } catch (e) {
        console.error("[Soporte] Auto-session error:", e.message);
      }
      return;
    }
    const ses = sesRes.rows[0];
    const traducido = await traducir(trimmed, "autodetect", "es");
    await pool.query(
      `INSERT INTO soporte_bilingue_mensajes (sesion_id, remitente, texto_original, texto_traducido)
       VALUES ($1, 'extranjero', $2, $3)`,
      [ses.id, trimmed, traducido]
    );
    await pool.query(
      `UPDATE soporte_bilingue_sesiones SET updated_at=now() WHERE id=$1`,
      [ses.id]
    );
    console.log(`[Soporte] ${phone}: "${trimmed}" → "${traducido}"`);
  } catch (e) {
    console.error("[Soporte] Incoming message error:", e.message);
  }
}

// ── YCloud Webhook ─────────────────────────────────────────────────────────
// Configura en el panel YCloud: https://central.whatseg.com/soporte/ycloud-webhook
app.post("/soporte/ycloud-webhook", async (req, res) => {
  res.sendStatus(200); // responder siempre 200 primero

  const event = req.body || {};
  const type  = event.type || "";
  console.log(`[Soporte] YCloud webhook: ${type}`);
  console.log(`[Soporte] YCloud body: ${JSON.stringify(event).substring(0, 600)}`);

  if (type === "whatsapp.inbound_message.received") {
    const msg  = event.whatsappInboundMessage || {};
    const from = msg.from || "";
    const text =
      msg.text?.body ||
      msg.image?.caption ||
      (msg.audio ? "[Audio recibido]" : "") ||
      (msg.document ? "[Documento recibido]" : "") || "";

    console.log(`[Soporte] from="${from}" text="${text}"`);

    if (from && text) {
      await handleIncomingWA(from, text);
    }
  }
});

// ── Soporte Bilingüe REST endpoints ──────────────────────────────────────

app.get("/soporte/wa-status", requireAuth, (_req, res) => {
  res.json({
    connected: !!YCLOUD_WA_FROM,
    provider: "ycloud",
    from: YCLOUD_WA_FROM || null,
  });
});

app.get("/soporte/chats", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
        c.nombre AS comunidad_nombre,
        (SELECT m.texto_original FROM soporte_bilingue_mensajes m
         WHERE m.sesion_id=s.id AND m.remitente='extranjero'
         ORDER BY m.created_at DESC LIMIT 1) AS ultimo_mensaje,
        (SELECT m.created_at FROM soporte_bilingue_mensajes m
         WHERE m.sesion_id=s.id ORDER BY m.created_at DESC LIMIT 1) AS ultimo_at
      FROM soporte_bilingue_sesiones s
      LEFT JOIN comunidades c ON c.id::text = s.comunidad_id
      WHERE s.estado = 'activo'
      ORDER BY s.updated_at DESC
    `);
    res.json(result.rows);
  } catch (e) {
    console.error("[Soporte] /soporte/chats error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/soporte/chat/:phone/mensajes", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.* FROM soporte_bilingue_mensajes m
      JOIN soporte_bilingue_sesiones s ON s.id = m.sesion_id
      WHERE s.phone = $1
      ORDER BY m.created_at ASC
    `, [req.params.phone]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/soporte/responder", requireAuth, async (req, res) => {
  const { phone, mensaje } = req.body;
  if (!phone || !mensaje) return res.status(400).json({ error: "phone y mensaje requeridos" });
  try {
    const sesRes = await pool.query(
      `SELECT * FROM soporte_bilingue_sesiones WHERE phone=$1 AND estado='activo'`,
      [phone]
    );
    if (sesRes.rows.length === 0) return res.status(404).json({ error: "Sesion no activa" });
    const ses = sesRes.rows[0];
    const idioma = ses.idioma || "en";
    const traducido = await traducir(mensaje, "es", idioma);
    const waResult = await enviarMensajeYCloud(phone, traducido);
    await pool.query(
      `INSERT INTO soporte_bilingue_mensajes (sesion_id, remitente, texto_original, texto_traducido)
       VALUES ($1, 'operador', $2, $3)`,
      [ses.id, mensaje, traducido]
    );
    await pool.query(
      `UPDATE soporte_bilingue_sesiones SET updated_at=now() WHERE id=$1`,
      [ses.id]
    );
    res.json({ success: true, enviado: traducido, whatsapp_ok: waResult.ok, whatsapp_error: waResult.error || null });
  } catch (e) {
    console.error("[Soporte] /soporte/responder error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post("/soporte/idioma/:phone", requireAuth, async (req, res) => {
  const { idioma } = req.body;
  if (!idioma) return res.status(400).json({ error: "idioma requerido" });
  try {
    await pool.query(
      `UPDATE soporte_bilingue_sesiones SET idioma=$1 WHERE phone=$2 AND estado='activo'`,
      [idioma, req.params.phone]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/soporte/cerrar/:phone", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE soporte_bilingue_sesiones SET estado='cerrado', updated_at=now() WHERE phone=$1`,
      [req.params.phone]
    );
    await enviarMensajeYCloud(
      req.params.phone,
      "Thank you for contacting WhatsEg support. The session has ended. Have a great day! 👋"
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PTT WebSocket (Push-to-Talk) ──────────────────────────────────────────
const PTT_WS_AUDIO_DIR = process.env.PTT_UPLOAD_DIR
  || path.join('/root/whatseg/backend-ext/uploads/reportes-ptt');

if (!fs.existsSync(PTT_WS_AUDIO_DIR)) {
  try { fs.mkdirSync(PTT_WS_AUDIO_DIR, { recursive: true }); } catch {}
}

const pttChannels = new Map(); // community_id → Set<ws>
const pttSessions = new Map(); // ws → session info
const pttMonitors = new Set(); // monitores (ADMIN/SUPERVISOR) → reciben todos los eventos JSON

function pttBroadcast(communityId, data, exclude, canal) {
  const payload = Buffer.isBuffer(data) ? data : JSON.stringify(data);
  // Broadcast to community channel, optionally filtered by canal
  const ch = pttChannels.get(communityId);
  if (ch) {
    for (const c of ch) {
      if (c !== exclude && c.readyState === WebSocket.OPEN) {
        // Filter by canal if specified (null/undefined = send to all)
        if (canal && canal !== 'ALL') {
          const s = pttSessions.get(c);
          if (s && s.canal && s.canal !== canal && canal !== 'EMERGENCIA') continue;
        }
        c.send(payload);
      }
    }
  }
  // Broadcast JSON events to monitors (not binary audio)
  if (!Buffer.isBuffer(data)) {
    for (const c of pttMonitors) {
      if (c !== exclude && c.readyState === WebSocket.OPEN) c.send(payload);
    }
  }
}

// Enviar datos a un usuario específico por nombre dentro de una comunidad
function pttSendToUser(communityId, targetName, data, exclude) {
  const payload = Buffer.isBuffer(data) ? data : JSON.stringify(data);
  const ch = pttChannels.get(communityId);
  if (!ch) return;
  for (const c of ch) {
    if (c === exclude) continue;
    const s = pttSessions.get(c);
    if (s && s.authenticated && s.guardia_nombre === targetName && c.readyState === WebSocket.OPEN) {
      c.send(payload);
    }
  }
  // También notificar a monitores (solo JSON, no binario)
  if (!Buffer.isBuffer(data)) {
    for (const c of pttMonitors) {
      if (c !== exclude && c.readyState === WebSocket.OPEN) c.send(payload);
    }
  }
}

function jwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  } catch { return null; }
}

async function pttSaveReport(session) {
  if (!session.chunks || !session.chunks.length) return null;
  const buf  = Buffer.concat(session.chunks);
  const fmt  = session.pttMeta?.formato || 'aac';
  const tipo = session.pttMeta?.tipo    || 'NOVEDAD';
  const desc = session.pttMeta?.descripcion || null;
  const dur  = session.pttMeta?.duracion_seg || null;
  const dest = session.pttMeta?.destinatario || null;
  const filename = `ptt_${Date.now()}_${(session.guardia_id || 'anon').slice(0, 8)}.${fmt}`;
  const filepath = path.join(PTT_WS_AUDIO_DIR, filename);

  // Obtener puesto_id del guardia para registrarlo en el reporte
  let puesto_id = null;
  if (session.guardia_id) {
    try {
      const pr = await pool.query('SELECT puesto_id FROM rondas_usuarios WHERE id = $1', [session.guardia_id]);
      puesto_id = pr.rows[0]?.puesto_id || null;
    } catch {}
  }

  try {
    fs.writeFileSync(filepath, buf);
    const r = await pool.query(
      `INSERT INTO reportes_ptt
         (id, comunidad_id, guardia_id, guardia_nombre, puesto_id, tipo, descripcion,
          archivo_path, formato, duracion_seg, tamanio_bytes, destinatario, estado, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
               'APROBADO', now(), now())
       RETURNING id, comunidad_id, guardia_nombre, puesto_id, tipo, descripcion, duracion_seg, tamanio_bytes, destinatario, created_at`,
      [session.community_id, session.guardia_id || null, session.guardia_nombre || 'Guardia',
       puesto_id, tipo, desc, filepath, fmt, dur, buf.length, dest]
    );
    const reporte = r.rows[0];
    console.log(`[PTT] Reporte ${reporte.id} guardado (${buf.length} bytes)${dest ? ' → ' + dest : ''}`);
    return reporte;
  } catch (e) {
    console.error('[PTT] Error guardando reporte:', e.message);
    return null;
  }
}

app.get('/ptt/status', requireAuth, (_req, res) => {
  const channels = {};
  for (const [cid, clients] of pttChannels) {
    channels[cid] = clients.size;
  }
  res.json({ channels, total: pttSessions.size });
});

// --- Central IA: broadcast interno de comunicados programados ---
async function pttSaveComunicado(opts) {
  const { community_id, texto, guardia_nombre, formato, bytes, archivo_path } = opts;
  try {
    await pool.query(
      'INSERT INTO reportes_ptt (id, comunidad_id, guardia_nombre, tipo, descripcion, archivo_path, formato, tamanio_bytes, estado, created_at, updated_at) VALUES (gen_random_uuid()::text, $1, $2, \'COMUNICADO\', $3, $4, $5, $6, \'APROBADO\', now(), now())',
      [community_id, guardia_nombre, texto, archivo_path || 'central-ia-tts', formato, bytes]
    );
  } catch (e) {
    console.error('[COMUNICADO] Error guardando en BD:', e.message);
  }
}

app.post('/internal/comunicado', async (req, res) => {
  const secret = req.headers['x-internal-secret'];
  if (secret !== (process.env.INTERNAL_SECRET || 'whatseg-internal'))
    return res.status(401).json({ error: 'unauthorized' });
  const { community_id, audio_path, texto = '', guardia_nombre = 'Central IA', formato = 'mp3' } = req.body;
  if (!community_id || !audio_path)
    return res.status(400).json({ error: 'community_id y audio_path requeridos' });
  try {
    const audioBytes = fs.readFileSync(audio_path);
    const comunicadoFilename = 'comunicado_' + Date.now() + '.' + formato;
    const comunicadoPath = path.join(PTT_WS_AUDIO_DIR, comunicadoFilename);
    fs.writeFileSync(comunicadoPath, audioBytes);
    pttBroadcast(community_id, { type: 'admin_ptt_start', guardia_nombre, formato, rol: 'ADMIN', from: 'Central IA' }, null);
    await new Promise(r => setTimeout(r, 150));
    pttBroadcast(community_id, audioBytes, null);
    await new Promise(r => setTimeout(r, 150));
    pttBroadcast(community_id, { type: 'admin_ptt_end', guardia_nombre, from: 'Central IA' }, null);
    await pttSaveComunicado({ community_id, texto, guardia_nombre, formato, bytes: audioBytes.length, archivo_path: comunicadoPath });
    const online = pttChannels.get(community_id) ? pttChannels.get(community_id).size : 0;
    console.log('[COMUNICADO] Enviado a', community_id, ':', audioBytes.length, 'bytes,', online, 'online');
    res.json({ ok: true, community_id, online, bytes: audioBytes.length });
  } catch (e) {
    console.error('[COMUNICADO] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});


// ── Manual proxy for /api/* to backend ───────────────────
app.all("/api/*", (req, res) => {
  const options = {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: req.originalUrl,
    method: req.method,
    headers: { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` },
    timeout: 15000,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (e) => {
    console.error("[Central] Proxy error:", e.message);
    if (!res.headersSent) {
      res.status(502).json({ error: "Backend no disponible" });
    }
  });

  proxyReq.on("timeout", () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.status(504).json({ error: "Backend timeout" });
    }
  });

  if (req.body && Object.keys(req.body).length > 0) {
    const bodyStr = JSON.stringify(req.body);
    proxyReq.setHeader("Content-Type", "application/json");
    proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyStr));
    proxyReq.write(bodyStr);
  }

  proxyReq.end();
});

// ── Serve static files ──────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── HTTP server + WebSocket PTT ───────────────────────────────────────────
const httpServer = http.createServer(app);

const wss = new WebSocket.Server({ server: httpServer, path: '/ws/ptt' });

// ── Heartbeat: detectar conexiones zombie cada 30s ────────────────────────
// El APK envía ping de aplicación cada 15s; el servidor envía
// ws-level ping para detectar dispositivos que se durmieron sin cerrar TCP.
const _heartbeatInterval = setInterval(() => {
  for (const client of wss.clients) {
    if (client._wsAlive === false) {
      // Sin respuesta al ping anterior → conexión muerta → terminar
      client.terminate(); // dispara ws.on('close') → limpia mapas + user_left
      continue;
    }
    client._wsAlive = false;
    client.ping();
  }
}, 30000);

wss.on('connection', (ws) => {
  ws._wsAlive = true;
  ws.on('pong', () => { ws._wsAlive = true; }); // reset al recibir pong

  const session = {
    guardia_id: null, guardia_nombre: null,
    community_id: null, rol: null, canal: 'GENERAL',
    chunks: [], pttMeta: null, authenticated: false,
  };
  pttSessions.set(ws, session);

  const authTimeout = setTimeout(() => {
    if (!session.authenticated) ws.close(4001, 'Auth timeout');
  }, 10000);

  ws.on('message', async (data, isBinary) => {
    // Binary frame = audio chunk during PTT
    if (isBinary) {
      if (!session.authenticated) return;
      if (session.isMonitor && session.adminPttCommunity) {
        // Admin/monitor broadcast: enviar a comunidad destino
        session.chunks.push(data);
        pttBroadcast(session.adminPttCommunity, data, ws);
      } else if (!session.isMonitor) {
        // Guardia/Supervisor PTT
        session.chunks.push(data);
        const pttCanal = (session.pttMeta?.tipo === 'EMERGENCIA') ? 'EMERGENCIA' : session.canal;
        if (session.pttTarget) {
          pttSendToUser(session.community_id, session.pttTarget, data, ws);
        } else {
          pttBroadcast(session.community_id, data, ws, pttCanal);
        }
      }
      return;
    }

    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    // ── join ──────────────────────────────────────────────
    if (msg.type === 'join') {
      const payload = jwtPayload(msg.token || '');
      if (!payload || !payload.sub) return ws.close(4001, 'Token invalido');
      clearTimeout(authTimeout);
      session.guardia_id     = payload.sub;
      session.guardia_nombre = payload.nombre || payload.sub;
      session.rol            = payload.rol || 'GUARDIA';
      session.community_id   = msg.community_id || payload.comunidad_id || '';
      session.canal          = msg.canal || 'GENERAL';
      session.authenticated  = true;

      // Si no hay nombre en el JWT (admin token viejo), buscar en DB
      if (!payload.nombre && payload.sub) {
        try {
          let nr = await pool.query(`SELECT nombre FROM rondas_usuarios WHERE id = $1`, [payload.sub]);
          if (!nr.rows[0]?.nombre) {
            nr = await pool.query(`SELECT nombre FROM admins WHERE id = $1`, [payload.sub]);
          }
          if (nr.rows[0]?.nombre) session.guardia_nombre = nr.rows[0].nombre;
        } catch {}
      }

      // Obtener puesto del guardia
      try {
        const pRes = await pool.query(
          `SELECT p.nombre FROM rondas_usuarios ru LEFT JOIN puestos p ON p.id = ru.puesto_id WHERE ru.id = $1`,
          [session.guardia_id]
        );
        session.puesto_nombre = pRes.rows[0]?.nombre || null;
      } catch { session.puesto_nombre = null; }

      // Desregistrar conexión anterior del mismo guardia sin cerrarla
      // (cerrarla causaría loop de reconexión en el APK)
      for (const [existingWs, existingSession] of pttSessions) {
        if (existingWs !== ws
            && existingSession.guardia_id === session.guardia_id
            && !existingSession.isMonitor) {
          const oldCh = pttChannels.get(existingSession.community_id);
          if (oldCh) {
            oldCh.delete(existingWs);
            if (oldCh.size === 0) pttChannels.delete(existingSession.community_id);
          }
          pttSessions.delete(existingWs);
          break;
        }
      }

      // Solo ADMIN/SUPERADMIN son siempre monitores.
      // SUPERVISOR/COMANDANTE desde el APK aparecen en la lista de en línea.
      const isMonitor = msg.role === 'MONITOR'
        || ['ADMIN', 'SUPERADMIN'].includes(session.rol);

      if (isMonitor) {
        // Monitores reciben todos los eventos JSON de todas las comunidades
        session.isMonitor = true;
        pttMonitors.add(ws);
        console.log(`[PTT] MONITOR ${session.guardia_nombre} (${session.rol}) conectado`);
        ws.send(JSON.stringify({ type: 'joined', community_id: '', rol: session.rol }));

        // Enviar lista de usuarios actualmente conectados
        const online = [];
        for (const [comId, clients] of pttChannels) {
          for (const c of clients) {
            const s = pttSessions.get(c);
            if (s && s.authenticated) {
              online.push({ guardia_nombre: s.guardia_nombre, rol: s.rol, puesto_nombre: s.puesto_nombre || null, community_id: comId, canal: s.canal || 'GENERAL' });
            }
          }
        }
        ws.send(JSON.stringify({ type: 'online_list', users: online }));
      } else {
        // Guardia normal: unirse a canal de su comunidad
        if (!pttChannels.has(session.community_id))
          pttChannels.set(session.community_id, new Set());
        pttChannels.get(session.community_id).add(ws);

        console.log(`[PTT] ${session.guardia_nombre} (${session.rol}) → comunidad ${session.community_id}`);
        ws.send(JSON.stringify({ type: 'joined', community_id: session.community_id, rol: session.rol }));
        pttBroadcast(session.community_id,
          { type: 'user_joined', guardia_nombre: session.guardia_nombre, rol: session.rol, puesto_nombre: session.puesto_nombre || null, community_id: session.community_id, canal: session.canal }, ws);

        // Enviar lista de usuarios ya conectados en esta comunidad al guardia que se unió
        const channelClients = pttChannels.get(session.community_id);
        if (channelClients) {
          const online = [];
          for (const c of channelClients) {
            if (c === ws) continue;
            const s = pttSessions.get(c);
            if (s && s.authenticated) {
              online.push({ guardia_nombre: s.guardia_nombre, rol: s.rol, puesto_nombre: s.puesto_nombre || null, community_id: session.community_id, canal: s.canal || 'GENERAL' });
            }
          }
          if (online.length > 0) {
            ws.send(JSON.stringify({ type: 'online_list', users: online }));
          }
        }
      }
    }

    // ── switch_canal ─────────────────────────────────────
    else if (msg.type === 'switch_canal' && session.authenticated && !session.isMonitor) {
      const oldCanal = session.canal;
      session.canal = msg.canal || 'GENERAL';
      console.log(`[PTT] ${session.guardia_nombre} cambió canal: ${oldCanal} → ${session.canal}`);
      ws.send(JSON.stringify({ type: 'canal_changed', canal: session.canal }));
    }

    // ── ptt_start ─────────────────────────────────────────
    else if (msg.type === 'ptt_start' && session.authenticated) {
      session.chunks  = [];
      session.pttTarget = msg.target || null; // PTT dirigido a un usuario específico
      session.pttMeta = {
        tipo: msg.tipo || 'NOVEDAD',
        descripcion: msg.descripcion || null,
        formato: msg.formato || 'aac',
      };
      const pttCanal = (msg.tipo === 'EMERGENCIA') ? 'EMERGENCIA' : session.canal;
      const startMsg = { type: 'ptt_start', guardia_nombre: session.guardia_nombre, guardia_id: session.guardia_id, rol: session.rol, canal: pttCanal };
      if (session.pttTarget) {
        startMsg.directed = true;
        pttSendToUser(session.community_id, session.pttTarget, startMsg, ws);
      } else {
        pttBroadcast(session.community_id, startMsg, ws, pttCanal);
      }
    }

    // ── ptt_end ───────────────────────────────────────────
    else if (msg.type === 'ptt_end' && session.authenticated) {
      if (session.pttMeta) {
        session.pttMeta.duracion_seg = msg.duracion_seg || null;
        session.pttMeta.destinatario = session.pttTarget || null;
      }
      const pttCanal = (session.pttMeta?.tipo === 'EMERGENCIA') ? 'EMERGENCIA' : session.canal;
      const reporte = await pttSaveReport(session);
      const target = session.pttTarget;
      session.chunks = [];
      session.pttTarget = null;
      if (reporte) {
        const ev = { type: 'ptt_saved', reporte };
        ws.send(JSON.stringify(ev));
        if (target) {
          pttSendToUser(session.community_id, target, ev, null);
        } else {
          pttBroadcast(session.community_id, ev, null, pttCanal);
        }
      }
      const endMsg = { type: 'ptt_end', guardia_nombre: session.guardia_nombre, canal: pttCanal };
      if (target) {
        endMsg.directed = true;
        pttSendToUser(session.community_id, target, endMsg, ws);
      } else {
        pttBroadcast(session.community_id, endMsg, ws, pttCanal);
      }
    }

    // ── admin_alert ───────────────────────────────────────
    else if (msg.type === 'admin_alert' && session.authenticated && session.isMonitor) {
      // Obtener nombre de comunidad para mostrarlo en la APK
      let communityName = '';
      if (msg.community_id) {
        try {
          const r = await pool.query('SELECT nombre FROM comunidades WHERE id = $1', [msg.community_id]);
          if (r.rows.length > 0) communityName = r.rows[0].nombre;
        } catch {}
      }
      const alertMsg = {
        type: 'admin_alert',
        mensaje: (msg.mensaje || '').slice(0, 500),
        from: 'Central de Monitoreo',
        community_id: msg.community_id || '',
        community_name: communityName,
        timestamp: new Date().toISOString(),
      };
      if (msg.community_id) {
        pttBroadcast(msg.community_id, alertMsg, null);
      } else {
        // Broadcast a todas las comunidades
        for (const [comId] of pttChannels) {
          pttBroadcast(comId, alertMsg, null);
        }
      }
      console.log(`[PTT] ALERTA${communityName ? ' ('+communityName+')' : ''}: "${alertMsg.mensaje}"`);
    }

    // ── admin_ptt_start (admin/monitor inicia transmisión de voz) ─────
    else if (msg.type === 'admin_ptt_start' && session.authenticated && session.isMonitor) {
      const targetCommunity = msg.community_id || '';
      if (!targetCommunity) return;
      session.adminPttCommunity = targetCommunity;
      session.chunks = [];
      // Obtener nombre de la comunidad para el label
      let comName = '';
      try {
        const cr = await pool.query('SELECT nombre FROM comunidades WHERE id = $1', [targetCommunity]);
        comName = cr.rows[0]?.nombre || '';
      } catch {}
      const adminFrom = `Central${comName ? ' - ' + comName : ''}`;
      session.adminPttFrom = adminFrom;
      pttBroadcast(targetCommunity, {
        type: 'admin_ptt_start',
        from: adminFrom,
        guardia_nombre: adminFrom,
        community_id: targetCommunity,
      }, null);
      console.log(`[PTT] ADMIN PTT START (${adminFrom}) → comunidad ${targetCommunity}`);
    }

    // ── admin_ptt_end (admin/monitor finaliza transmisión) ──────────
    else if (msg.type === 'admin_ptt_end' && session.authenticated && session.isMonitor) {
      const targetCommunity = session.adminPttCommunity;
      if (!targetCommunity) return;
      const adminFrom = session.adminPttFrom || 'Central';
      pttBroadcast(targetCommunity, {
        type: 'admin_ptt_end',
        from: adminFrom,
        guardia_nombre: adminFrom,
        community_id: targetCommunity,
      }, null);

      // Guardar broadcast del admin como reporte tipo COMUNICADO
      if (session.chunks && session.chunks.length > 0) {
        const savedSession = {
          community_id: targetCommunity,
          guardia_id: session.guardia_id,
          guardia_nombre: adminFrom,
          chunks: session.chunks,
          pttMeta: { tipo: 'COMUNICADO', descripcion: 'Comunicado desde ' + adminFrom, formato: 'webm', duracion_seg: msg.duracion_seg || null },
        };
        pttSaveReport(savedSession).then(rep => {
          if (rep) console.log(`[PTT] Comunicado admin guardado: ${rep.id}`);
        }).catch(() => {});
      }

      console.log(`[PTT] ADMIN PTT END (${adminFrom}) → comunidad ${targetCommunity} (${session.chunks.length} chunks)`);
      session.chunks = [];
      session.adminPttCommunity = null;
    }

    // ── ping ──────────────────────────────────────────────
    else if (msg.type === 'ping') {
      ws._wsAlive = true; // el APK está vivo
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  });

  ws.on('close', () => {
    const s = pttSessions.get(ws);
    if (s) {
      if (s.isMonitor) {
        pttMonitors.delete(ws);
        console.log(`[PTT] MONITOR ${s.guardia_nombre || 'unknown'} desconectado`);
      } else if (s.community_id) {
        const ch = pttChannels.get(s.community_id);
        if (ch) {
          ch.delete(ws);
          if (ch.size === 0) pttChannels.delete(s.community_id);
        }
        if (s.authenticated) {
          pttBroadcast(s.community_id,
            { type: 'user_left', guardia_nombre: s.guardia_nombre, rol: s.rol, community_id: s.community_id });
        }
        console.log(`[PTT] ${s.guardia_nombre || 'unknown'} desconectado`);
      }
    }
    pttSessions.delete(ws);
  });

  ws.on('error', (e) => console.error('[PTT] WS error:', e.message));
});

httpServer.listen(PORT, () => {
  console.log(`[Central] Dashboard running on http://localhost:${PORT}`);
  console.log(`[PTT] WebSocket en ws://localhost:${PORT}/ws/ptt`);
});
