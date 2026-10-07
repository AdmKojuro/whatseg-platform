/**
 * WhatsEg Clip Service
 * Microservicio independiente para grabar clips de 5 segundos desde cámaras Dolynk.
 * Corre junto al backend principal (puerto 3069) sin tocarlo.
 */

const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────────
const PORT = process.env.CLIP_PORT || 3069;
const CLIP_DIR = process.env.CLIP_DIR || '/var/www/whatseg/clips';
const CLIP_DURATION = parseInt(process.env.CLIP_DURATION || '5', 10);
const CLIP_MAX_AGE_HOURS = parseInt(process.env.CLIP_MAX_AGE_HOURS || '24', 10);
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/trdomatica';

// ── PostgreSQL pool ─────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: DATABASE_URL });

// ── Dolynk API helpers ──────────────────────────────────────────────────────────

function signAuth(accessKey, timestamp, nonce, secretKey) {
  const msg = accessKey + timestamp + nonce;
  return crypto.createHmac('sha512', secretKey).update(msg).digest('hex').toUpperCase();
}

function signBusiness(accessKey, token, timestamp, nonce, secretKey) {
  const msg = accessKey + token + timestamp + nonce;
  return crypto.createHmac('sha512', secretKey).update(msg).digest('hex').toUpperCase();
}

function baseHeaders(accessKey, timestamp, nonce, sign, productId) {
  return {
    'Content-Type': 'application/json',
    'Accept-Language': 'es-ES',
    'Version': 'v1',
    'AccessKey': accessKey,
    'Timestamp': timestamp,
    'Nonce': nonce,
    'Sign': sign,
    'Sign-Type': 'simple',
    'X-TraceId-Header': uuidv4(),
    'ProductId': productId,
  };
}

async function getDolynkToken(creds) {
  const ts = Date.now().toString();
  const nonce = uuidv4();
  const sign = signAuth(creds.access_key, ts, nonce, creds.secret_access_key);
  const headers = baseHeaders(creds.access_key, ts, nonce, sign, creds.product_id);

  const { data } = await axios.post(
    `${creds.base_url}/open-api/api-base/auth/getAppAccessToken`,
    {},
    { headers, timeout: 10000 }
  );

  if (!data.success) {
    throw new Error(`Dolynk token error: ${data.msg || data.code}`);
  }
  return data.data.appAccessToken;
}

function dolynkBusinessHeaders(creds, token) {
  const ts = Date.now().toString();
  const nonce = uuidv4();
  const sign = signBusiness(creds.access_key, token, ts, nonce, creds.secret_access_key);
  return {
    ...baseHeaders(creds.access_key, ts, nonce, sign, creds.product_id),
    'AppAccessToken': token,
  };
}

async function getDolynkRtmpUrl(creds, token, deviceId, channelId) {
  const body = { deviceId, channelId: channelId || '0' };

  // Intentar crear stream RTMP
  try {
    const { data } = await axios.post(
      `${creds.base_url}/open-api/api-iot/device/createDeviceRtmpLive`,
      body,
      { headers: dolynkBusinessHeaders(creds, token), timeout: 15000 }
    );

    if (data.success) {
      return { sd: data.data.rtmp, hd: data.data.rtmpHD };
    }

    // Si ya existe, consultar el stream existente
    if (data.msg && data.msg.toLowerCase().includes('already exists')) {
      console.log('[Clip] Stream RTMP ya existe, consultando URL existente...');
      const query = await axios.post(
        `${creds.base_url}/open-api/api-iot/device/queryDeviceRtmpLive`,
        body,
        { headers: dolynkBusinessHeaders(creds, token), timeout: 15000 }
      );

      if (query.data.success) {
        return { sd: query.data.data.rtmp, hd: query.data.data.rtmpHD };
      }

      // Si queryDeviceRtmpLive falla, intentar cerrar y recrear
      console.log('[Clip] Query fallido, cerrando stream y recreando...');
      await axios.post(
        `${creds.base_url}/open-api/api-iot/device/closeDeviceRtmpLive`,
        body,
        { headers: dolynkBusinessHeaders(creds, token), timeout: 10000 }
      ).catch(() => {}); // Ignorar error de close

      // Esperar un momento y reintentar
      await new Promise(r => setTimeout(r, 1000));
      const retry = await axios.post(
        `${creds.base_url}/open-api/api-iot/device/createDeviceRtmpLive`,
        body,
        { headers: dolynkBusinessHeaders(creds, token), timeout: 15000 }
      );

      if (retry.data.success) {
        return { sd: retry.data.data.rtmp, hd: retry.data.data.rtmpHD };
      }
      throw new Error(`Dolynk RTMP retry error: ${retry.data.msg || retry.data.code}`);
    }

    throw new Error(`Dolynk RTMP error: ${data.msg || data.code}`);
  } catch (err) {
    if (err.response) {
      throw new Error(`Dolynk RTMP HTTP error: ${err.response.status}`);
    }
    throw err;
  }
}

// ── ffmpeg recording ────────────────────────────────────────────────────────────

function recordClip(rtmpUrl, outputPath, durationSec) {
  return new Promise((resolve, reject) => {
    const args = [
      '-analyzeduration', '5000000',
      '-probesize', '10000000',
      '-i', rtmpUrl,
      '-t', String(durationSec),
      '-c', 'copy',
      '-y',
      outputPath,
    ];

    const proc = execFile(FFMPEG_PATH, args, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        // ffmpeg writes info to stderr; check if output file exists
        if (fs.existsSync(outputPath)) {
          const stat = fs.statSync(outputPath);
          if (stat.size > 1000) {
            // File exists and has reasonable size — success despite exit code
            resolve(outputPath);
            return;
          }
        }
        reject(new Error(`ffmpeg error: ${err.message}\n${stderr}`));
        return;
      }
      resolve(outputPath);
    });
  });
}

// ── Cleanup old clips ───────────────────────────────────────────────────────────

function cleanupOldClips() {
  try {
    if (!fs.existsSync(CLIP_DIR)) return;
    const maxAge = CLIP_MAX_AGE_HOURS * 60 * 60 * 1000;
    const now = Date.now();
    const files = fs.readdirSync(CLIP_DIR);
    let removed = 0;

    for (const file of files) {
      if (!file.endsWith('.mp4')) continue;
      const filePath = path.join(CLIP_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[Cleanup] Eliminados ${removed} clips antiguos`);
    }
  } catch (err) {
    console.error('[Cleanup] Error:', err.message);
  }
}

// ── Express app ─────────────────────────────────────────────────────────────────

const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'clip-service', uptime: process.uptime() });
});

app.get('/clip/:dispositivoId', async (req, res) => {
  const { dispositivoId } = req.params;
  const startTime = Date.now();

  try {
    const clipUrl = await grabarClipParaDispositivo(dispositivoId);
    if (!clipUrl) {
      return res.status(400).json({ error: 'Dispositivo no encontrado o sin configuración Dolynk' });
    }

    const filename = path.basename(clipUrl);
    const outputPath = path.join(CLIP_DIR, filename);
    const stat = fs.statSync(outputPath);
    const elapsed = Date.now() - startTime;

    res.json({
      success: true,
      clip_url: clipUrl,
      filename,
      size_kb: Math.round(stat.size / 1024),
      duration_sec: CLIP_DURATION,
      resolution: '640x480',
      elapsed_ms: elapsed,
    });
  } catch (err) {
    console.error(`[Clip] Error para ${dispositivoId}:`, err.message);
    res.status(500).json({
      error: 'Error grabando clip',
      detail: err.message,
    });
  }
});

// ── Grabación interna de clip (reutilizable) ────────────────────────────────────

async function grabarClipParaDispositivo(dispositivoId) {
  // 1. Buscar dispositivo (incluye camara_dispositivo_id para puertas/alarmas)
  const devResult = await pool.query(
    `SELECT d.dolynk_device_id, d.dolynk_channel_id, d.cuenta_dolynk_id, d.nombre,
            d.camara_dispositivo_id
     FROM dispositivos d
     WHERE d.id = $1`,
    [dispositivoId]
  );

  if (devResult.rows.length === 0) return null;
  let device = devResult.rows[0];

  // Si el dispositivo no tiene Dolynk propio, buscar en la cámara vinculada
  if ((!device.dolynk_device_id || !device.cuenta_dolynk_id) && device.camara_dispositivo_id) {
    console.log(`[Clip] ${device.nombre} sin Dolynk propio, buscando cámara vinculada...`);
    const camResult = await pool.query(
      `SELECT d.dolynk_device_id, d.dolynk_channel_id, d.cuenta_dolynk_id, d.nombre
       FROM dispositivos d
       WHERE d.id = $1`,
      [device.camara_dispositivo_id]
    );
    if (camResult.rows.length > 0 && camResult.rows[0].dolynk_device_id) {
      console.log(`[Clip] Usando cámara vinculada: ${camResult.rows[0].nombre}`);
      device = camResult.rows[0];
    }
  }

  if (!device.dolynk_device_id || !device.cuenta_dolynk_id) return null;

  // 2. Credenciales Dolynk
  const credsResult = await pool.query(
    `SELECT access_key, secret_access_key, product_id, base_url
     FROM cuentas_dolynk WHERE id = $1`,
    [device.cuenta_dolynk_id]
  );
  if (credsResult.rows.length === 0) return null;
  const creds = credsResult.rows[0];

  // 3. Token + RTMP URL
  const token = await getDolynkToken(creds);
  const rtmpUrls = await getDolynkRtmpUrl(creds, token, device.dolynk_device_id, device.dolynk_channel_id);

  // 4. Grabar
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `clip_${timestamp}_${device.dolynk_device_id}.mp4`;
  const outputPath = path.join(CLIP_DIR, filename);
  await recordClip(rtmpUrls.sd, outputPath, CLIP_DURATION);

  const stat = fs.statSync(outputPath);
  console.log(`[Clip] Grabado: ${filename} (${(stat.size / 1024).toFixed(0)} KB)`);

  return `/clips/${filename}`;
}

// ── Monitor de activaciones ─────────────────────────────────────────────────────

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000', 10);
let lastCheckedAt = new Date();

async function checkNewActivaciones() {
  try {
    // Buscar activaciones recientes sin clip que tengan Dolynk (propio o via cámara vinculada)
    const result = await pool.query(
      `SELECT a.id, a.dispositivo_id, a.created_at, d.nombre as dispositivo_nombre
       FROM activaciones a
       JOIN dispositivos d ON d.id = a.dispositivo_id
       LEFT JOIN dispositivos cam ON cam.id = d.camara_dispositivo_id
       WHERE a.created_at > $1
         AND a.clip_url IS NULL
         AND a.resultado = 'EXITOSO'
         AND (
           (d.dolynk_device_id IS NOT NULL AND d.cuenta_dolynk_id IS NOT NULL)
           OR (cam.dolynk_device_id IS NOT NULL AND cam.cuenta_dolynk_id IS NOT NULL)
         )
       ORDER BY a.created_at ASC
       LIMIT 3`,
      [lastCheckedAt]
    );

    if (result.rows.length > 0) {
      for (const act of result.rows) {
        console.log(`[Monitor] Nueva activación detectada: ${act.dispositivo_nombre || act.dispositivo_id} (${act.id})`);

        try {
          const clipUrl = await grabarClipParaDispositivo(act.dispositivo_id);
          if (clipUrl) {
            // Guardar clip_url en la activación
            await pool.query(
              `UPDATE activaciones SET clip_url = $1 WHERE id = $2`,
              [clipUrl, act.id]
            );
            console.log(`[Monitor] Clip guardado en activación ${act.id}: ${clipUrl}`);
          }
        } catch (err) {
          console.error(`[Monitor] Error grabando clip para activación ${act.id}:`, err.message);
        }
      }
    }

    // Actualizar timestamp para próximo poll
    lastCheckedAt = new Date();
  } catch (err) {
    console.error('[Monitor] Error polling activaciones:', err.message);
  }
}

// ── Start ───────────────────────────────────────────────────────────────────────

// Crear directorio de clips si no existe
if (!fs.existsSync(CLIP_DIR)) {
  fs.mkdirSync(CLIP_DIR, { recursive: true });
  console.log(`[Init] Directorio de clips creado: ${CLIP_DIR}`);
}

// Limpieza periódica cada hora
cleanupOldClips();
setInterval(cleanupOldClips, 60 * 60 * 1000);

// Monitor de activaciones — poll cada 5 segundos
setInterval(checkNewActivaciones, POLL_INTERVAL);
console.log(`[Monitor] Vigilando activaciones cada ${POLL_INTERVAL / 1000}s`);

app.listen(PORT, () => {
  console.log(`[Clip Service] Escuchando en puerto ${PORT}`);
  console.log(`[Clip Service] Clips en: ${CLIP_DIR}`);
  console.log(`[Clip Service] Duración: ${CLIP_DURATION}s | Max edad: ${CLIP_MAX_AGE_HOURS}h`);
});
