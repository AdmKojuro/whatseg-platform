import { prisma } from '../../shared/config/prisma'
import QRCode from 'qrcode'
import { randomUUID } from 'crypto'

// ─── Permisos ─────────────────────────────────────────────────────────────────

export async function getPermisos(adminId: string, comunidadId: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT towers, apartments, residents, calls
    FROM vp_permisos
    WHERE admin_id = ${adminId} AND comunidad_id = ${comunidadId}::uuid
    LIMIT 1
  `
  return rows[0] ?? { towers: true, apartments: true, residents: true, calls: true }
}

export async function upsertPermisos(
  adminId: string,
  comunidadId: string,
  p: { towers: boolean; apartments: boolean; residents: boolean; calls: boolean }
) {
  await prisma.$executeRaw`
    INSERT INTO vp_permisos (admin_id, comunidad_id, towers, apartments, residents, calls)
    VALUES (${adminId}, ${comunidadId}::uuid, ${p.towers}, ${p.apartments}, ${p.residents}, ${p.calls})
    ON CONFLICT (admin_id, comunidad_id) DO UPDATE SET
      towers = EXCLUDED.towers, apartments = EXCLUDED.apartments,
      residents = EXCLUDED.residents, calls = EXCLUDED.calls
  `
}

// ─── Unidades (comunidades) ───────────────────────────────────────────────────

export async function listarUnidades(): Promise<any[]> {
  return prisma.$queryRaw`
    SELECT c.id::text AS id, c.nombre AS name
    FROM comunidades c
    WHERE c.activa = true
    ORDER BY c.nombre
  `
}

/** Lista de unidades configuradas para videoportero con su firebase_unit_id.
 *  Solo devuelve comunidades que tienen firebase_unit_id asignado (listas para la tablet). */
export async function listarUnidadesTablet(): Promise<any[]> {
  return prisma.$queryRaw`
    SELECT vc.firebase_unit_id AS id, c.nombre AS name
    FROM vp_unidad_config vc
    JOIN comunidades c ON c.id = vc.comunidad_id::text
    WHERE vc.firebase_unit_id IS NOT NULL
      AND c.activa = true
    ORDER BY c.nombre
  `
}

export async function getUnidadPorAdminId(adminId: string): Promise<any | null> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT c.id AS id, c.nombre AS name,
      vc.package_message_template,
      COALESCE(vc.call_enabled, true)              AS "callEnabled",
      COALESCE(vc.video_call_enabled, true)         AS "videoCallEnabled",
      COALESCE(vc.normal_call_enabled, true)        AS "normalCallEnabled",
      COALESCE(vc.package_enabled, true)            AS "packageEnabled",
      COALESCE(vc.portero_call_enabled, false)      AS "porteroCallEnabled",
      COALESCE(vc.video_portero_enabled, false)     AS "videoPorteroEnabled",
      vc.portero_phone_number                       AS "porteroPhoneNumber",
      COALESCE(vc.config_pin, '1234')               AS "configPin",
      vc.firebase_unit_id                           AS "firebaseUnitId",
      COALESCE(vc.face_recognition_enabled, false)  AS "faceRecognitionEnabled",
      vc.relay_device_id                            AS "relayDeviceId"
    FROM admins_comunidades ac
    JOIN comunidades c ON c.id = ac.comunidad_id
    LEFT JOIN vp_unidad_config vc ON vc.comunidad_id::text = c.id
    WHERE ac.admin_id = ${adminId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function getUnidadPorId(comunidadId: string): Promise<any | null> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT c.id AS id, c.nombre AS name,
      vc.package_message_template,
      COALESCE(vc.call_enabled, true)              AS "callEnabled",
      COALESCE(vc.video_call_enabled, true)         AS "videoCallEnabled",
      COALESCE(vc.normal_call_enabled, true)        AS "normalCallEnabled",
      COALESCE(vc.package_enabled, true)            AS "packageEnabled",
      COALESCE(vc.portero_call_enabled, false)      AS "porteroCallEnabled",
      COALESCE(vc.video_portero_enabled, false)     AS "videoPorteroEnabled",
      vc.portero_phone_number                       AS "porteroPhoneNumber",
      COALESCE(vc.config_pin, '1234')               AS "configPin",
      vc.firebase_unit_id                           AS "firebaseUnitId",
      COALESCE(vc.face_recognition_enabled, false)  AS "faceRecognitionEnabled",
      vc.relay_device_id                            AS "relayDeviceId"
    FROM comunidades c
    LEFT JOIN vp_unidad_config vc ON vc.comunidad_id::text = c.id
    WHERE c.id = ${comunidadId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function getAdminDeUnidad(comunidadId: string): Promise<{ admin_id: string } | null> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT admin_id FROM admins_comunidades
    WHERE comunidad_id = ${comunidadId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function actualizarConfig(comunidadId: string, config: Record<string, any>) {
  // Ensure config row exists (comunidad_id is UUID column, comunidades.id is TEXT)
  await prisma.$executeRaw`
    INSERT INTO vp_unidad_config (comunidad_id) VALUES (${comunidadId}::uuid)
    ON CONFLICT (comunidad_id) DO NOTHING
  `
  // Note: vp_unidad_config.comunidad_id is UUID, so WHERE uses ::uuid cast
  const fieldMap: Record<string, string> = {
    packageMessageTemplate: 'package_message_template',
    callEnabled:            'call_enabled',
    videoCallEnabled:       'video_call_enabled',
    normalCallEnabled:      'normal_call_enabled',
    packageEnabled:         'package_enabled',
    porteroCallEnabled:     'portero_call_enabled',
    porteroPhoneNumber:     'portero_phone_number',
    configPin:              'config_pin',
    firebaseUnitId:         'firebase_unit_id',
    faceRecognitionEnabled: 'face_recognition_enabled',
    videoPorteroEnabled:    'video_portero_enabled',
    relayDeviceId:          'relay_device_id',
  }
  const pairs: [string, any][] = Object.entries(config)
    .filter(([k]) => k in fieldMap)
    .map(([k, v]) => [fieldMap[k], v])
  if (pairs.length === 0) return
  const setParts = pairs.map((p, i) => `${p[0]} = $${i + 1}`).join(', ')
  const values: any[] = [...pairs.map(([, v]) => v), comunidadId]
  await prisma.$executeRawUnsafe(
    `UPDATE vp_unidad_config SET ${setParts}, updated_at = NOW() WHERE comunidad_id = $${values.length}::uuid`,
    ...values
  )
}

export async function crearUnidad(nombre: string): Promise<any> {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO comunidades (nombre, activa) VALUES (${nombre}, true)
    RETURNING id::text AS id, nombre AS name
  `
  return rows[0]
}

// ─── Torres ───────────────────────────────────────────────────────────────────

export async function listarTorres(comunidadId: string): Promise<any[]> {
  return prisma.$queryRaw`
    SELECT id::text AS id, comunidad_id::text AS "residentialUnitId", name
    FROM vp_torres
    WHERE comunidad_id = ${comunidadId}::uuid
    ORDER BY name
  `
}

export async function crearTorre(comunidadId: string, name: string): Promise<any> {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO vp_torres (comunidad_id, name) VALUES (${comunidadId}::uuid, ${name})
    RETURNING id::text AS id, comunidad_id::text AS "residentialUnitId", name
  `
  return rows[0]
}

export async function actualizarTorre(id: string, name: string): Promise<void> {
  await prisma.$executeRaw`UPDATE vp_torres SET name = ${name} WHERE id = ${id}::uuid`
}

export async function eliminarTorre(id: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM vp_torres WHERE id = ${id}::uuid`
}

// ─── Apartamentos ─────────────────────────────────────────────────────────────

export async function listarApartamentos(comunidadId: string): Promise<any[]> {
  return prisma.$queryRaw`
    SELECT a.id::text AS id, a.comunidad_id::text AS "residentialUnitId",
           a.torre_id::text AS "towerId", a.number
    FROM vp_apartamentos a
    WHERE a.comunidad_id = ${comunidadId}::uuid
    ORDER BY a.number
  `
}

export async function crearApartamento(
  comunidadId: string, torreId: string, number: string
): Promise<any> {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO vp_apartamentos (comunidad_id, torre_id, number)
    VALUES (${comunidadId}::uuid, ${torreId}::uuid, ${number})
    RETURNING id::text AS id, comunidad_id::text AS "residentialUnitId",
              torre_id::text AS "towerId", number
  `
  return rows[0]
}

export async function actualizarApartamento(
  id: string, torreId: string, number: string
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE vp_apartamentos SET torre_id = ${torreId}::uuid, number = ${number}
    WHERE id = ${id}::uuid
  `
}

export async function eliminarApartamento(id: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM vp_apartamentos WHERE id = ${id}::uuid`
}

// ─── Residentes ───────────────────────────────────────────────────────────────

export async function listarResidentes(comunidadId: string): Promise<any[]> {
  return prisma.$queryRaw`
    SELECT r.id::text AS id, r.comunidad_id::text AS "residentialUnitId",
           r.apartamento_id::text AS "apartmentId", r.name,
           r.whatsapp_number AS "whatsappNumber",
           r.photo_url AS "photoUrl"
    FROM vp_residentes r
    WHERE r.comunidad_id = ${comunidadId}::uuid
    ORDER BY r.name
  `
}

export async function crearResidente(
  comunidadId: string, apartamentoId: string, name: string, whatsappNumber: string
): Promise<any> {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO vp_residentes (comunidad_id, apartamento_id, name, whatsapp_number)
    VALUES (${comunidadId}::uuid, ${apartamentoId}::uuid, ${name}, ${whatsappNumber})
    RETURNING id::text AS id, comunidad_id::text AS "residentialUnitId",
              apartamento_id::text AS "apartmentId", name,
              whatsapp_number AS "whatsappNumber"
  `
  return rows[0]
}

export async function actualizarResidente(
  id: string, apartamentoId: string, name: string, whatsappNumber: string
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE vp_residentes
    SET apartamento_id = ${apartamentoId}::uuid, name = ${name}, whatsapp_number = ${whatsappNumber}
    WHERE id = ${id}::uuid
  `
}

export async function actualizarFotoResidente(id: string, photoUrl: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE vp_residentes SET photo_url = ${photoUrl}, face_embedding = NULL WHERE id = ${id}::uuid
  `
}

export async function actualizarEmbeddingResidente(id: string, faceEmbedding: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE vp_residentes SET face_embedding = ${faceEmbedding} WHERE id = ${id}::uuid
  `
}

export async function getResidentesFaceData(firebaseUnitId: string): Promise<any[]> {
  // Look up the PostgreSQL community by firebase_unit_id, then return residents with face data
  const rows: any[] = await prisma.$queryRaw`
    SELECT r.id::text AS id, r.name,
           a.number AS "apartmentNumber",
           r.apartamento_id::text AS "apartmentId",
           r.whatsapp_number AS "whatsappNumber",
           r.photo_url AS "photoUrl",
           r.face_embedding AS "faceEmbedding"
    FROM vp_residentes r
    JOIN vp_apartamentos a ON a.id = r.apartamento_id
    JOIN vp_unidad_config vc ON vc.comunidad_id = r.comunidad_id
    WHERE vc.firebase_unit_id = ${firebaseUnitId}
      AND r.photo_url IS NOT NULL
    ORDER BY r.name
  `
  return rows
}

export async function getUnitFaceConfig(firebaseUnitId: string): Promise<{ faceRecognitionEnabled: boolean }> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT COALESCE(face_recognition_enabled, false) AS "faceRecognitionEnabled"
    FROM vp_unidad_config
    WHERE firebase_unit_id = ${firebaseUnitId}
    LIMIT 1
  `
  return rows[0] ?? { faceRecognitionEnabled: false }
}

export async function eliminarResidente(id: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM vp_residentes WHERE id = ${id}::uuid`
}

// ─── Llamadas ─────────────────────────────────────────────────────────────────

export async function listarLlamadas(comunidadId: string): Promise<any[]> {
  return prisma.$queryRaw`
    SELECT id::text AS id, comunidad_id::text AS "residentialUnitId",
           apartment_number AS "apartmentNumber", resident_name AS "residentName",
           whatsapp_number AS "whatsappNumber", timestamp,
           visitor_photo_url AS "visitorPhotoUrl"
    FROM vp_llamadas
    WHERE comunidad_id = ${comunidadId}::uuid
    ORDER BY timestamp DESC
    LIMIT 200
  `
}

export async function crearLlamada(data: {
  comunidadId: string
  apartmentNumber: string
  residentName: string
  whatsappNumber: string
  timestamp: number
  visitorPhotoUrl?: string | null
}): Promise<any> {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO vp_llamadas
      (comunidad_id, apartment_number, resident_name, whatsapp_number, timestamp, visitor_photo_url)
    VALUES
      (${data.comunidadId}::uuid, ${data.apartmentNumber}, ${data.residentName},
       ${data.whatsappNumber}, ${data.timestamp}, ${data.visitorPhotoUrl ?? null})
    RETURNING id::text AS id
  `
  return rows[0]
}

// ─── Endpoints exclusivos para la tablet (resuelven firebase_unit_id → comunidad_id) ──

async function resolverComunidadId(firebaseUnitId: string): Promise<string> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT comunidad_id::text AS id FROM vp_unidad_config
    WHERE firebase_unit_id = ${firebaseUnitId} LIMIT 1
  `
  if (!rows[0]) throw new Error(`firebase_unit_id no encontrado: ${firebaseUnitId}`)
  return rows[0].id
}

export async function getUnitConfigByFirebaseId(firebaseUnitId: string): Promise<any | null> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT c.nombre AS name,
      vc.package_message_template,
      COALESCE(vc.call_enabled, true)              AS "callEnabled",
      COALESCE(vc.video_call_enabled, true)         AS "videoCallEnabled",
      COALESCE(vc.normal_call_enabled, true)        AS "normalCallEnabled",
      COALESCE(vc.package_enabled, true)            AS "packageEnabled",
      COALESCE(vc.portero_call_enabled, false)      AS "porteroCallEnabled",
      COALESCE(vc.video_portero_enabled, false)     AS "videoPorteroEnabled",
      vc.portero_phone_number                       AS "porteroPhoneNumber",
      COALESCE(vc.config_pin, '1234')               AS "configPin",
      COALESCE(vc.face_recognition_enabled, false)  AS "faceRecognitionEnabled"
    FROM vp_unidad_config vc
    JOIN comunidades c ON c.id = vc.comunidad_id::text
    WHERE vc.firebase_unit_id = ${firebaseUnitId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function getResidentsByApartmentAndFirebaseId(
  firebaseUnitId: string, apartmentNumber: string
): Promise<any[]> {
  return prisma.$queryRaw`
    SELECT r.id::text AS id, r.name,
           r.whatsapp_number AS "whatsappNumber",
           r.apartamento_id::text AS "apartmentId"
    FROM vp_residentes r
    JOIN vp_apartamentos a ON a.id = r.apartamento_id
    JOIN vp_unidad_config vc ON vc.comunidad_id::uuid = r.comunidad_id
    WHERE vc.firebase_unit_id = ${firebaseUnitId}
      AND a.number = ${apartmentNumber}
    ORDER BY r.name
  `
}

export async function crearLlamadaTablet(
  firebaseUnitId: string,
  data: { apartmentNumber: string; residentName: string; whatsappNumber: string; timestamp: number }
): Promise<{ id: string }> {
  const comunidadId = await resolverComunidadId(firebaseUnitId)
  return crearLlamada({
    comunidadId,
    apartmentNumber: data.apartmentNumber,
    residentName: data.residentName,
    whatsappNumber: data.whatsappNumber,
    timestamp: data.timestamp,
    visitorPhotoUrl: null,
  })
}

export async function actualizarFotoLlamada(callLogId: string, photoUrl: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE vp_llamadas SET visitor_photo_url = ${photoUrl} WHERE id = ${callLogId}::uuid
  `
}

export async function crearEncomienda(
  firebaseUnitId: string,
  data: { apartmentNumber: string; residentName: string; whatsappNumber: string; timestamp: number }
): Promise<void> {
  const comunidadId = await resolverComunidadId(firebaseUnitId)
  await prisma.$executeRaw`
    INSERT INTO vp_encomiendas (comunidad_id, apartment_number, resident_name, whatsapp_number, timestamp)
    VALUES (${comunidadId}::uuid, ${data.apartmentNumber}, ${data.residentName},
            ${data.whatsappNumber}, ${data.timestamp})
  `
}

// ─── Dispositivos / Relays por comunidad ──────────────────────────────────────

export async function listarDispositivos(comunidadId: string): Promise<any[]> {
  return prisma.$queryRaw`
    SELECT id::text AS id, nombre, tipo,
           mqtt_kind AS "mqttKind",
           mqtt_device_id AS "mqttDeviceId",
           mqtt_channel AS "mqttChannel",
           online, configurado
    FROM dispositivos
    WHERE comunidad_id = ${comunidadId}
    ORDER BY nombre
  `
}

export async function crearDispositivo(
  comunidadId: string,
  data: { nombre: string; tipo?: string; mqttTopic: string; mqttPayload?: string; descripcion?: string }
): Promise<any> {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO vp_dispositivos (comunidad_id, nombre, tipo, mqtt_topic, mqtt_payload, descripcion)
    VALUES (${comunidadId}::uuid, ${data.nombre},
            ${data.tipo ?? 'RELAY'}, ${data.mqttTopic},
            ${data.mqttPayload ?? '1'}, ${data.descripcion ?? null})
    RETURNING id::text AS id, comunidad_id::text AS "comunidadId",
              nombre, tipo, mqtt_topic AS "mqttTopic", mqtt_payload AS "mqttPayload",
              descripcion, activo
  `
  return rows[0]
}

export async function actualizarDispositivo(
  id: string,
  data: { nombre?: string; tipo?: string; mqttTopic?: string; mqttPayload?: string; descripcion?: string; activo?: boolean }
): Promise<void> {
  const fieldMap: Record<string, string> = {
    nombre: 'nombre', tipo: 'tipo',
    mqttTopic: 'mqtt_topic', mqttPayload: 'mqtt_payload',
    descripcion: 'descripcion', activo: 'activo',
  }
  const pairs: [string, any][] = Object.entries(data)
    .filter(([k]) => k in fieldMap)
    .map(([k, v]) => [fieldMap[k], v])
  if (pairs.length === 0) return
  const setParts = pairs.map((p, i) => `${p[0]} = $${i + 1}`).join(', ')
  const values: any[] = [...pairs.map(([, v]) => v), id]
  await prisma.$executeRawUnsafe(
    `UPDATE vp_dispositivos SET ${setParts} WHERE id = $${values.length}::uuid`,
    ...values
  )
}

export async function eliminarDispositivo(id: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM vp_dispositivos WHERE id = ${id}::uuid`
}

/** Used by tablet: returns {mqttTopic, mqttPayload} for the relay to activate.
 *  Priority: vp_dispositivos (admin panel) → dispositivos (IoT hardware). */
export async function getDispositivoActivoPorFirebaseUnitId(
  firebaseUnitId: string
): Promise<{ mqttTopic: string; mqttPayload: string } | null> {
  // 1. vp_dispositivos — devices created via the admin panel
  const vpRows: any[] = await prisma.$queryRaw`
    SELECT d.mqtt_topic AS "mqttTopic", d.mqtt_payload AS "mqttPayload"
    FROM vp_dispositivos d
    JOIN vp_unidad_config vc ON vc.comunidad_id::text = d.comunidad_id::text
    WHERE vc.firebase_unit_id = ${firebaseUnitId}
      AND d.activo = true
    ORDER BY d.nombre
    LIMIT 1
  `
  if (vpRows[0]) return vpRows[0]

  // 2. dispositivos — IoT hardware (explicitly selected relay_device_id)
  const selected: any[] = await prisma.$queryRaw`
    SELECT 'whatseg/' || d.mqtt_device_id || '/cmd' AS "mqttTopic",
           'relay_on:3' AS "mqttPayload"
    FROM dispositivos d
    JOIN vp_unidad_config vc ON vc.comunidad_id::text = d.comunidad_id
    WHERE vc.firebase_unit_id = ${firebaseUnitId}
      AND vc.relay_device_id IS NOT NULL
      AND d.id::text = vc.relay_device_id
      AND d.mqtt_kind IS NOT NULL
    LIMIT 1
  `
  if (selected[0]) return selected[0]

  // 3. dispositivos — first available IoT device for the community
  const fallback: any[] = await prisma.$queryRaw`
    SELECT 'whatseg/' || d.mqtt_device_id || '/cmd' AS "mqttTopic",
           'relay_on:3' AS "mqttPayload"
    FROM dispositivos d
    JOIN vp_unidad_config vc ON vc.comunidad_id::text = d.comunidad_id
    WHERE vc.firebase_unit_id = ${firebaseUnitId}
      AND d.mqtt_kind IS NOT NULL
    ORDER BY d.nombre
    LIMIT 1
  `
  return fallback[0] ?? null
}

// ─── Historial VideoPortero ───────────────────────────────────────────────────

async function getComunidadIdPorFirebase(firebaseUnitId: string): Promise<string | null> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT comunidad_id::text AS comunidad_id
    FROM vp_unidad_config
    WHERE firebase_unit_id = ${firebaseUnitId}
    LIMIT 1
  `
  return rows[0]?.comunidad_id ?? null
}

export async function crearHistorialVp(data: {
  firebaseUnitId: string
  residenteNombre: string
  apartamento: string
  fotoUrl?: string
}): Promise<void> {
  const comunidadId = await getComunidadIdPorFirebase(data.firebaseUnitId)
  if (!comunidadId) throw new Error('Unidad no encontrada para firebase_unit_id: ' + data.firebaseUnitId)
  await prisma.$executeRaw`
    INSERT INTO vp_historial_vp (comunidad_id, residente_nombre, apartamento, foto_url)
    VALUES (${comunidadId}::uuid, ${data.residenteNombre}, ${data.apartamento}, ${data.fotoUrl ?? null})
  `
}

export async function listarHistorialVp(comunidadId: string): Promise<any[]> {
  return prisma.$queryRaw`
    SELECT id::text AS id,
           residente_nombre AS "residenteNombre",
           apartamento,
           foto_url AS "fotoUrl",
           created_at AS "createdAt"
    FROM vp_historial_vp
    WHERE comunidad_id = ${comunidadId}::uuid
    ORDER BY created_at DESC
    LIMIT 200
  `
}

// ─── Códigos de acceso para visitas (QR + PIN de 6 dígitos) ──────────────────

/** Migración idempotente: agrega columnas max_usos/usos_actuales si no existen */
export async function runCodigosAccesoMigrations(): Promise<void> {
  await prisma.$executeRaw`
    ALTER TABLE vp_codigos_acceso
      ADD COLUMN IF NOT EXISTS max_usos      INT NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS usos_actuales INT NOT NULL DEFAULT 0
  `
}

export async function crearCodigoAcceso(
  comunidadId: string,
  data: { nombreVisita: string; apartamento: string; validoHasta: Date; whatsappNotificar?: string; maxUsos?: number }
): Promise<{ id: string; pin: string; qrToken: string; qrBase64: string }> {
  const whatsappNotificar = data.whatsappNotificar?.trim() || null
  const maxUsos = Math.max(1, data.maxUsos ?? 1)
  let rows: any[] = []
  let attempts = 0
  while (attempts < 5) {
    const pin = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
    const qrToken = randomUUID()
    try {
      rows = await prisma.$queryRaw`
        INSERT INTO vp_codigos_acceso (comunidad_id, nombre_visita, apartamento, pin, qr_token, valido_hasta, whatsapp_notificar, max_usos)
        VALUES (${comunidadId}::uuid, ${data.nombreVisita}, ${data.apartamento}, ${pin}, ${qrToken}, ${data.validoHasta}, ${whatsappNotificar}, ${maxUsos})
        RETURNING id::text AS id, pin, qr_token AS "qrToken"
      `
      break
    } catch (e: any) {
      if (e.code === '23505') { attempts++; continue }
      throw e
    }
  }
  if (!rows[0]) throw new Error('No se pudo generar un PIN único')
  const qrBase64 = await QRCode.toDataURL(rows[0].qrToken, { width: 300, margin: 2 })
  return { id: rows[0].id, pin: rows[0].pin, qrToken: rows[0].qrToken, qrBase64 }
}

export async function listarCodigosAcceso(comunidadId: string): Promise<any[]> {
  return prisma.$queryRaw`
    SELECT c.id::text AS id,
           c.nombre_visita AS "nombreVisita",
           c.apartamento,
           c.pin,
           c.qr_token AS "qrToken",
           c.valido_hasta AS "validoHasta",
           c.usado,
           c.usado_at AS "usadoAt",
           c.whatsapp_notificar AS "whatsappNotificar",
           c.max_usos AS "maxUsos",
           c.usos_actuales AS "usosActuales",
           c.created_at AS "createdAt",
           (SELECT h.created_at
            FROM vp_acceso_historial h
            WHERE h.codigo_id = c.id AND h.tipo = 'SALIDA'
            ORDER BY h.created_at DESC
            LIMIT 1) AS "salidaAt"
    FROM vp_codigos_acceso c
    WHERE c.comunidad_id = ${comunidadId}::uuid
    ORDER BY c.created_at DESC
    LIMIT 200
  `
}

export async function validarCodigoAcceso(
  firebaseUnitId: string,
  codigo: string,
  esQr: boolean,
  fotoUrl?: string
): Promise<{ nombreVisita: string; apartamento: string; residentesWhatsapp: string[]; tipo: 'ENTRADA' | 'SALIDA' } | null> {
  const comunidadId = await getComunidadIdPorFirebase(firebaseUnitId)
  if (!comunidadId) return null

  // Incremento atómico: solo si quedan usos disponibles y el código no ha expirado.
  // usos_actuales en RETURNING es el NUEVO valor (tras incrementar).
  let rows: any[]
  if (esQr) {
    rows = await prisma.$queryRaw`
      UPDATE vp_codigos_acceso
      SET usos_actuales = usos_actuales + 1,
          usado         = (usos_actuales + 1 >= max_usos),
          usado_at      = COALESCE(usado_at, NOW())
      WHERE qr_token = ${codigo}
        AND usos_actuales < max_usos
        AND valido_hasta > NOW()
      RETURNING id::text AS id,
                nombre_visita       AS "nombreVisita",
                apartamento,
                whatsapp_notificar  AS "whatsappNotificar",
                usos_actuales       AS "usosActuales"
    `
  } else {
    rows = await prisma.$queryRaw`
      UPDATE vp_codigos_acceso
      SET usos_actuales = usos_actuales + 1,
          usado         = (usos_actuales + 1 >= max_usos),
          usado_at      = COALESCE(usado_at, NOW())
      WHERE comunidad_id = ${comunidadId}::uuid
        AND pin = ${codigo}
        AND usos_actuales < max_usos
        AND valido_hasta > NOW()
      RETURNING id::text AS id,
                nombre_visita       AS "nombreVisita",
                apartamento,
                whatsapp_notificar  AS "whatsappNotificar",
                usos_actuales       AS "usosActuales"
    `
  }
  if (!rows[0]) return null

  const { id, nombreVisita, apartamento, whatsappNotificar, usosActuales } = rows[0]

  // Uso impar (1, 3, 5…) = ENTRADA; uso par (2, 4, 6…) = SALIDA
  const tipo: 'ENTRADA' | 'SALIDA' = (Number(usosActuales) % 2 !== 0) ? 'ENTRADA' : 'SALIDA'

  // Registrar evento en historial (con foto opcional)
  await prisma.$executeRaw`
    INSERT INTO vp_acceso_historial (comunidad_id, codigo_id, nombre_visita, apartamento, tipo, registrado_por, foto_url)
    VALUES (${comunidadId}::uuid, ${id}::uuid, ${nombreVisita}, ${apartamento}, ${tipo}, 'TABLET', ${fotoUrl ?? null})
  `

  const residents: any[] = await prisma.$queryRaw`
    SELECT r.whatsapp_number AS "whatsappNumber"
    FROM vp_residentes r
    JOIN vp_apartamentos a ON a.id = r.apartamento_id
    WHERE a.number = ${apartamento}
      AND r.comunidad_id = ${comunidadId}::uuid
  `

  // Merge: whatsapp_notificar (line specified in panel) + apartment residents
  const residentNumbers = residents.map((r) => r.whatsappNumber).filter(Boolean)
  const allNumbers = whatsappNotificar
    ? [whatsappNotificar, ...residentNumbers.filter((n: string) => n !== whatsappNotificar)]
    : residentNumbers

  return {
    nombreVisita,
    apartamento,
    residentesWhatsapp: allNumbers,
    tipo,
  }
}

export async function revocarCodigoAcceso(id: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM vp_codigos_acceso WHERE id = ${id}::uuid`
}

// ─── Detalle de código + historial ────────────────────────────────────────────

export async function obtenerCodigoAcceso(id: string): Promise<any | null> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT id::text AS id,
           comunidad_id::text AS "comunidadId",
           nombre_visita AS "nombreVisita",
           apartamento,
           pin,
           qr_token AS "qrToken",
           valido_hasta AS "validoHasta",
           usado,
           usado_at AS "usadoAt",
           max_usos AS "maxUsos",
           usos_actuales AS "usosActuales",
           created_at AS "createdAt"
    FROM vp_codigos_acceso WHERE id = ${id}::uuid LIMIT 1
  `
  if (!rows[0]) return null
  const qrBase64 = await QRCode.toDataURL(rows[0].qrToken, { width: 300, margin: 2 })
  const historial = await listarHistorialPorCodigo(id)
  return { ...rows[0], qrBase64, historial }
}

export async function listarHistorialPorCodigo(codigoId: string): Promise<any[]> {
  return prisma.$queryRaw`
    SELECT id::text AS id,
           tipo,
           registrado_por AS "registradoPor",
           foto_url AS "fotoUrl",
           created_at AS "createdAt"
    FROM vp_acceso_historial
    WHERE codigo_id = ${codigoId}::uuid
    ORDER BY created_at ASC
  `
}

export async function registrarSalida(codigoId: string): Promise<void> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT comunidad_id::text AS "comunidadId", nombre_visita AS "nombreVisita", apartamento
    FROM vp_codigos_acceso WHERE id = ${codigoId}::uuid LIMIT 1
  `
  if (!rows[0]) throw new Error('Código no encontrado')
  const { comunidadId, nombreVisita, apartamento } = rows[0]
  await prisma.$executeRaw`
    INSERT INTO vp_acceso_historial (comunidad_id, codigo_id, nombre_visita, apartamento, tipo, registrado_por)
    VALUES (${comunidadId}::uuid, ${codigoId}::uuid, ${nombreVisita}, ${apartamento}, 'SALIDA', 'PANEL')
  `
}

export async function listarHistorialAcceso(comunidadId: string): Promise<any[]> {
  return prisma.$queryRaw`
    SELECT id::text AS id,
           nombre_visita AS "nombreVisita",
           apartamento,
           tipo,
           registrado_por AS "registradoPor",
           created_at AS "createdAt"
    FROM vp_acceso_historial
    WHERE comunidad_id = ${comunidadId}::uuid
    ORDER BY created_at DESC
    LIMIT 500
  `
}
