import { Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'
import * as repo from './videoportero.repository'
import { publishMqtt } from '../../shared/services/mqtt.service'

const FACE_RECOGNITION_API_KEY = 'WMoR8fOtaKW9WsoLn697loY8OtPv6yxI'

// ─── Unidades disponibles para la tablet (sin auth, solo API key) ────────────

export async function listarUnidadesTablet(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string)
    if (apiKey !== FACE_RECOGNITION_API_KEY) {
      return res.status(401).json({ error: 'No autorizado' })
    }
    res.json(await repo.listarUnidadesTablet())
  } catch (err) { next(err) }
}

// ─── Me (perfil del admin autenticado) ───────────────────────────────────────

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.admin!
    const isSuperAdmin = payload.rol === 'SUPERADMIN'
    const comunidadId = payload.comunidad_id

    let permissions = { towers: true, apartments: true, residents: true, calls: true }
    if (!isSuperAdmin && comunidadId) {
      permissions = await repo.getPermisos(payload.sub, comunidadId)
    }

    res.json({
      uid: payload.sub,
      email: '',
      isSuperAdmin,
      residentialUnitId: comunidadId ?? null,
      permissions,
    })
  } catch (err) { next(err) }
}

// ─── Unidades ─────────────────────────────────────────────────────────────────

export async function listarUnidades(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.admin!
    if (payload.rol === 'SUPERADMIN') {
      res.json(await repo.listarUnidades())
    } else {
      const unit = await repo.getUnidadPorAdminId(payload.sub)
      res.json(unit ? [unit] : [])
    }
  } catch (err) { next(err) }
}

export async function getUnidad(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id)
    const payload = req.admin!
    if (payload.rol !== 'SUPERADMIN' && payload.comunidad_id !== id) {
      return res.status(403).json({ error: 'Acceso denegado' })
    }
    const unit = await repo.getUnidadPorId(id)
    if (!unit) return res.status(404).json({ error: 'Unidad no encontrada' })
    res.json(unit)
  } catch (err) { next(err) }
}

export async function actualizarConfig(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.actualizarConfig(String(req.params.id), req.body)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function crearUnidad(req: Request, res: Response, next: NextFunction) {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' })
    const unit = await repo.crearUnidad(String(name).trim())
    res.status(201).json(unit)
  } catch (err) { next(err) }
}

// ─── Admin de una unidad ──────────────────────────────────────────────────────

export async function getAdminDeUnidad(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = await repo.getAdminDeUnidad(String(req.params.id))
    res.json(admin ?? { admin_id: null })
  } catch (err) { next(err) }
}

// ─── Permisos del admin en una unidad ────────────────────────────────────────

export async function getPermisos(req: Request, res: Response, next: NextFunction) {
  try {
    const { admin_id } = req.query as any
    if (!admin_id) return res.status(400).json({ error: 'admin_id requerido' })
    res.json(await repo.getPermisos(String(admin_id), String(req.params.id)))
  } catch (err) { next(err) }
}

export async function actualizarPermisos(req: Request, res: Response, next: NextFunction) {
  try {
    const { admin_id } = req.query as any
    if (!admin_id) return res.status(400).json({ error: 'admin_id requerido' })
    const { towers = true, apartments = true, residents = true, calls = true } = req.body
    await repo.upsertPermisos(String(admin_id), String(req.params.id), {
      towers: Boolean(towers), apartments: Boolean(apartments),
      residents: Boolean(residents), calls: Boolean(calls),
    })
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ─── Torres ───────────────────────────────────────────────────────────────────

export async function listarTorres(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidadId = req.query.comunidad_id as string
    if (!comunidadId) return res.status(400).json({ error: 'comunidad_id requerido' })
    res.json(await repo.listarTorres(comunidadId))
  } catch (err) { next(err) }
}

export async function crearTorre(req: Request, res: Response, next: NextFunction) {
  try {
    const { comunidad_id, name } = req.body
    if (!comunidad_id || !name?.trim()) return res.status(400).json({ error: 'comunidad_id y name requeridos' })
    res.status(201).json(await repo.crearTorre(String(comunidad_id), String(name).trim()))
  } catch (err) { next(err) }
}

export async function actualizarTorre(req: Request, res: Response, next: NextFunction) {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'name requerido' })
    await repo.actualizarTorre(String(req.params.id), String(name).trim())
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function eliminarTorre(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.eliminarTorre(String(req.params.id))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ─── Apartamentos ─────────────────────────────────────────────────────────────

export async function listarApartamentos(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidadId = req.query.comunidad_id as string
    if (!comunidadId) return res.status(400).json({ error: 'comunidad_id requerido' })
    res.json(await repo.listarApartamentos(comunidadId))
  } catch (err) { next(err) }
}

export async function crearApartamento(req: Request, res: Response, next: NextFunction) {
  try {
    const { comunidad_id, torre_id, number } = req.body
    if (!comunidad_id || !torre_id || !number?.trim()) return res.status(400).json({ error: 'Faltan campos' })
    res.status(201).json(await repo.crearApartamento(String(comunidad_id), String(torre_id), String(number).trim()))
  } catch (err) { next(err) }
}

export async function actualizarApartamento(req: Request, res: Response, next: NextFunction) {
  try {
    const { torre_id, number } = req.body
    if (!torre_id || !number?.trim()) return res.status(400).json({ error: 'Faltan campos' })
    await repo.actualizarApartamento(String(req.params.id), String(torre_id), String(number).trim())
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function eliminarApartamento(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.eliminarApartamento(String(req.params.id))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ─── Residentes ───────────────────────────────────────────────────────────────

export async function listarResidentes(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidadId = req.query.comunidad_id as string
    if (!comunidadId) return res.status(400).json({ error: 'comunidad_id requerido' })
    res.json(await repo.listarResidentes(comunidadId))
  } catch (err) { next(err) }
}

export async function crearResidente(req: Request, res: Response, next: NextFunction) {
  try {
    const { comunidad_id, apartment_id, name, whatsapp_number } = req.body
    if (!comunidad_id || !apartment_id || !name?.trim() || !whatsapp_number) {
      return res.status(400).json({ error: 'Faltan campos' })
    }
    res.status(201).json(
      await repo.crearResidente(String(comunidad_id), String(apartment_id), String(name).trim(), String(whatsapp_number))
    )
  } catch (err) { next(err) }
}

export async function actualizarResidente(req: Request, res: Response, next: NextFunction) {
  try {
    const { apartment_id, name, whatsapp_number } = req.body
    if (!apartment_id || !name?.trim() || !whatsapp_number) {
      return res.status(400).json({ error: 'Faltan campos' })
    }
    await repo.actualizarResidente(String(req.params.id), String(apartment_id), String(name).trim(), String(whatsapp_number))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function eliminarResidente(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.eliminarResidente(String(req.params.id))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ─── Llamadas ─────────────────────────────────────────────────────────────────

export async function listarLlamadas(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidadId = req.query.comunidad_id as string
    if (!comunidadId) return res.status(400).json({ error: 'comunidad_id requerido' })
    res.json(await repo.listarLlamadas(comunidadId))
  } catch (err) { next(err) }
}

export async function crearLlamada(req: Request, res: Response, next: NextFunction) {
  try {
    const { comunidad_id, apartment_number, resident_name, whatsapp_number, timestamp, visitor_photo_url } = req.body
    if (!comunidad_id || !apartment_number || !resident_name || !whatsapp_number || !timestamp) {
      return res.status(400).json({ error: 'Faltan campos' })
    }
    res.status(201).json(await repo.crearLlamada({
      comunidadId:      String(comunidad_id),
      apartmentNumber:  String(apartment_number),
      residentName:     String(resident_name),
      whatsappNumber:   String(whatsapp_number),
      timestamp:        Number(timestamp),
      visitorPhotoUrl:  visitor_photo_url ?? null,
    }))
  } catch (err) { next(err) }
}

// ─── Foto del residente ───────────────────────────────────────────────────────

export async function subirFotoResidente(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id)
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) return res.status(400).json({ error: 'No se recibió archivo' })

    // Ensure upload directory
    const uploadDir = path.join(process.cwd(), 'uploads', 'residents')
    await fs.mkdir(uploadDir, { recursive: true })

    // Move to final path named by resident ID (overwrites previous photo)
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    const filename = `${id}${ext}`
    const destPath = path.join(uploadDir, filename)
    await fs.rename(file.path, destPath)

    const photoUrl = `/uploads/residents/${filename}`
    await repo.actualizarFotoResidente(id, photoUrl)
    res.json({ ok: true, photoUrl })
  } catch (err) { next(err) }
}

// ─── Face data (API-key protected, usado por la tablet Android) ───────────────

export async function getFaceData(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string)
    if (apiKey !== FACE_RECOGNITION_API_KEY) {
      return res.status(401).json({ error: 'No autorizado' })
    }
    const firebaseUnitId = req.query.firebase_unit_id as string
    if (!firebaseUnitId) return res.status(400).json({ error: 'firebase_unit_id requerido' })

    const residents = await repo.getResidentesFaceData(firebaseUnitId)
    res.json(residents)
  } catch (err) { next(err) }
}

// ─── Config de reconocimiento facial (API-key protected) ─────────────────────

export async function getFaceConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string)
    if (apiKey !== FACE_RECOGNITION_API_KEY) {
      return res.status(401).json({ error: 'No autorizado' })
    }
    const firebaseUnitId = req.query.firebase_unit_id as string
    if (!firebaseUnitId) return res.status(400).json({ error: 'firebase_unit_id requerido' })
    res.json(await repo.getUnitFaceConfig(firebaseUnitId))
  } catch (err) { next(err) }
}

// ─── Endpoints de tablet: unit-config, residents-by-apartment, llamadas, encomiendas ──

export async function getUnitConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string)
    if (apiKey !== FACE_RECOGNITION_API_KEY) return res.status(401).json({ error: 'No autorizado' })
    const firebaseUnitId = req.query.firebase_unit_id as string
    if (!firebaseUnitId) return res.status(400).json({ error: 'firebase_unit_id requerido' })
    const config = await repo.getUnitConfigByFirebaseId(firebaseUnitId)
    if (!config) return res.status(404).json({ error: 'Unidad no encontrada' })
    res.json(config)
  } catch (err) { next(err) }
}

export async function getResidentsByApartment(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string)
    if (apiKey !== FACE_RECOGNITION_API_KEY) return res.status(401).json({ error: 'No autorizado' })
    const { firebase_unit_id, apartment_number } = req.query as Record<string, string>
    if (!firebase_unit_id || !apartment_number) {
      return res.status(400).json({ error: 'firebase_unit_id y apartment_number requeridos' })
    }
    res.json(await repo.getResidentsByApartmentAndFirebaseId(firebase_unit_id, apartment_number))
  } catch (err) { next(err) }
}

export async function crearLlamadaTablet(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string)
    if (apiKey !== FACE_RECOGNITION_API_KEY) return res.status(401).json({ error: 'No autorizado' })
    const { firebase_unit_id, apartment_number, resident_name, whatsapp_number, timestamp } = req.body
    if (!firebase_unit_id || !apartment_number || !resident_name || !whatsapp_number || !timestamp) {
      return res.status(400).json({ error: 'Faltan campos' })
    }
    const result = await repo.crearLlamadaTablet(String(firebase_unit_id), {
      apartmentNumber: String(apartment_number),
      residentName: String(resident_name),
      whatsappNumber: String(whatsapp_number),
      timestamp: Number(timestamp),
    })
    res.status(201).json(result)
  } catch (err) { next(err) }
}

export async function actualizarFotoLlamada(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string)
    if (apiKey !== FACE_RECOGNITION_API_KEY) return res.status(401).json({ error: 'No autorizado' })
    const { photo_url } = req.body
    if (!photo_url) return res.status(400).json({ error: 'photo_url requerido' })
    await repo.actualizarFotoLlamada(String(req.params.id), String(photo_url))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function crearEncomiendaTablet(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string)
    if (apiKey !== FACE_RECOGNITION_API_KEY) return res.status(401).json({ error: 'No autorizado' })
    const { firebase_unit_id, apartment_number, resident_name, whatsapp_number, timestamp } = req.body
    if (!firebase_unit_id || !apartment_number || !resident_name || !whatsapp_number || !timestamp) {
      return res.status(400).json({ error: 'Faltan campos' })
    }
    await repo.crearEncomienda(String(firebase_unit_id), {
      apartmentNumber: String(apartment_number),
      residentName: String(resident_name),
      whatsappNumber: String(whatsapp_number),
      timestamp: Number(timestamp),
    })
    res.status(201).json({ ok: true })
  } catch (err) { next(err) }
}

// ─── Embedding del residente (API-key protected, subido por la tablet) ────────

export async function subirEmbeddingResidente(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string)
    if (apiKey !== FACE_RECOGNITION_API_KEY) {
      return res.status(401).json({ error: 'No autorizado' })
    }
    const id = String(req.params.id)
    const { face_embedding } = req.body
    if (!face_embedding) return res.status(400).json({ error: 'face_embedding requerido' })
    await repo.actualizarEmbeddingResidente(id, String(face_embedding))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ─── Dispositivos / Relays ────────────────────────────────────────────────────

export async function listarDispositivos(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidadId = req.query.comunidad_id as string
    if (!comunidadId) return res.status(400).json({ error: 'comunidad_id requerido' })
    res.json(await repo.listarDispositivos(comunidadId))
  } catch (err) { next(err) }
}

export async function crearDispositivo(req: Request, res: Response, next: NextFunction) {
  try {
    const { comunidad_id, nombre, tipo, mqtt_topic, mqtt_payload, descripcion } = req.body
    if (!comunidad_id || !nombre?.trim() || !mqtt_topic?.trim()) {
      return res.status(400).json({ error: 'comunidad_id, nombre y mqtt_topic son requeridos' })
    }
    res.status(201).json(await repo.crearDispositivo(String(comunidad_id), {
      nombre: String(nombre).trim(),
      tipo: tipo ? String(tipo) : 'RELAY',
      mqttTopic: String(mqtt_topic).trim(),
      mqttPayload: mqtt_payload ? String(mqtt_payload) : '1',
      descripcion: descripcion ? String(descripcion) : undefined,
    }))
  } catch (err) { next(err) }
}

export async function actualizarDispositivo(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id)
    const { nombre, tipo, mqtt_topic, mqtt_payload, descripcion, activo } = req.body
    await repo.actualizarDispositivo(id, {
      ...(nombre !== undefined ? { nombre: String(nombre).trim() } : {}),
      ...(tipo !== undefined ? { tipo: String(tipo) } : {}),
      ...(mqtt_topic !== undefined ? { mqttTopic: String(mqtt_topic).trim() } : {}),
      ...(mqtt_payload !== undefined ? { mqttPayload: String(mqtt_payload) } : {}),
      ...(descripcion !== undefined ? { descripcion: String(descripcion) } : {}),
      ...(activo !== undefined ? { activo: Boolean(activo) } : {}),
    })
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function eliminarDispositivo(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.eliminarDispositivo(String(req.params.id))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

/** POST /trigger-relay — tablet triggers the first active relay for its community */
export async function triggerRelayTablet(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string)
    if (apiKey !== FACE_RECOGNITION_API_KEY) return res.status(401).json({ error: 'No autorizado' })
    const firebase_unit_id = (req.body?.firebase_unit_id || req.query.firebase_unit_id) as string
    if (!firebase_unit_id) return res.status(400).json({ error: 'firebase_unit_id requerido' })

    const device = await repo.getDispositivoActivoPorFirebaseUnitId(firebase_unit_id)
    if (!device) return res.status(404).json({ error: 'No hay dispositivos configurados para esta unidad' })

    await publishMqtt(device.mqttTopic, device.mqttPayload)
    res.json({ ok: true, topic: device.mqttTopic })
  } catch (err: any) {
    // Return 503 if MQTT not configured instead of 500
    if (err?.message?.includes('MQTT_BROKER_URL')) {
      return res.status(503).json({ error: err.message })
    }
    next(err)
  }
}

// ─── Historial VideoPortero ───────────────────────────────────────────────────

/** POST /historial-vp — tablet posts a face recognition event with optional JPEG */
export async function crearHistorialVpHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string)
    if (apiKey !== FACE_RECOGNITION_API_KEY) return res.status(401).json({ error: 'No autorizado' })

    const { firebase_unit_id, residente_nombre, apartamento, foto_base64 } = req.body
    if (!firebase_unit_id || !residente_nombre || !apartamento) {
      return res.status(400).json({ error: 'Faltan campos: firebase_unit_id, residente_nombre, apartamento' })
    }

    let fotoUrl: string | undefined
    if (foto_base64) {
      const b64 = String(foto_base64).replace(/^data:image\/\w+;base64,/, '')
      const buf = Buffer.from(b64, 'base64')
      const dir = path.join(process.cwd(), 'uploads', 'historial-vp')
      await fs.mkdir(dir, { recursive: true })
      const file = `${randomUUID()}.jpg`
      await fs.writeFile(path.join(dir, file), buf)
      fotoUrl = `/uploads/historial-vp/${file}`
    }

    await repo.crearHistorialVp({
      firebaseUnitId: String(firebase_unit_id),
      residenteNombre: String(residente_nombre),
      apartamento: String(apartamento),
      fotoUrl,
    })
    res.status(201).json({ ok: true })
  } catch (err) { next(err) }
}

/** GET /historial-vp — authenticated admin lists face recognition history */
export async function listarHistorialVpHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidadId = req.query.comunidad_id as string
    if (!comunidadId) return res.status(400).json({ error: 'comunidad_id requerido' })
    res.json(await repo.listarHistorialVp(comunidadId))
  } catch (err) { next(err) }
}

// ─── Códigos de acceso para visitas (QR + PIN) ────────────────────────────────

/** POST /codigos-acceso — panel genera un código QR + PIN para una visita */
export async function crearCodigoAccesoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { comunidad_id, nombre_visita, apartamento, valido_hasta, whatsapp_notificar, max_usos } = req.body
    if (!comunidad_id || !nombre_visita?.trim() || !apartamento?.trim() || !valido_hasta) {
      return res.status(400).json({ error: 'Faltan campos: comunidad_id, nombre_visita, apartamento, valido_hasta' })
    }
    const result = await repo.crearCodigoAcceso(String(comunidad_id), {
      nombreVisita: String(nombre_visita).trim(),
      apartamento: String(apartamento).trim(),
      validoHasta: new Date(valido_hasta),
      whatsappNotificar: whatsapp_notificar ? String(whatsapp_notificar).trim() : undefined,
      maxUsos: max_usos ? Math.max(1, parseInt(String(max_usos), 10)) : 1,
    })
    res.status(201).json(result)
  } catch (err) { next(err) }
}

/** GET /codigos-acceso — panel lista los códigos de la comunidad */
export async function listarCodigosAccesoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const comunidadId = req.query.comunidad_id as string
    if (!comunidadId) return res.status(400).json({ error: 'comunidad_id requerido' })
    res.json(await repo.listarCodigosAcceso(comunidadId))
  } catch (err) { next(err) }
}

/** POST /codigos-acceso/validar — tablet valida un PIN o token QR (+ foto opcional) */
export async function validarCodigoAccesoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string)
    if (apiKey !== FACE_RECOGNITION_API_KEY) return res.status(401).json({ error: 'No autorizado' })
    const { firebase_unit_id, codigo, es_qr, foto_base64 } = req.body
    if (!firebase_unit_id || !codigo) {
      return res.status(400).json({ error: 'Faltan campos: firebase_unit_id, codigo' })
    }

    // Guardar foto si viene adjunta
    let fotoUrl: string | undefined
    if (foto_base64) {
      const b64 = String(foto_base64).replace(/^data:image\/\w+;base64,/, '')
      const buf = Buffer.from(b64, 'base64')
      const dir = path.join(process.cwd(), 'uploads', 'acceso-visitas')
      await fs.mkdir(dir, { recursive: true })
      const file = `${randomUUID()}.jpg`
      await fs.writeFile(path.join(dir, file), buf)
      fotoUrl = `/uploads/acceso-visitas/${file}`
    }

    const result = await repo.validarCodigoAcceso(
      String(firebase_unit_id), String(codigo), Boolean(es_qr), fotoUrl
    )
    if (!result) return res.json({ valid: false })
    res.json({
      valid: true,
      nombre_visita: result.nombreVisita,
      apartamento: result.apartamento,
      residentes_whatsapp: result.residentesWhatsapp,
      tipo: result.tipo,
    })
  } catch (err) { next(err) }
}

/** DELETE /codigos-acceso/:id — panel revoca un código */
export async function revocarCodigoAccesoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.revocarCodigoAcceso(String(req.params.id))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

/** GET /codigos-acceso/:id — panel obtiene detalle + QR base64 + historial */
export async function obtenerCodigoAccesoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const codigo = await repo.obtenerCodigoAcceso(String(req.params.id))
    if (!codigo) return res.status(404).json({ error: 'No encontrado' })
    res.json(codigo)
  } catch (err) { next(err) }
}

/** POST /codigos-acceso/:id/salida — panel registra salida del visitante */
export async function registrarSalidaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.registrarSalida(String(req.params.id))
    res.json({ ok: true })
  } catch (err) { next(err) }
}
