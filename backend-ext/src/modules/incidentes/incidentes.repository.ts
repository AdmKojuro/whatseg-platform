import { prisma } from '../../shared/config/prisma'
import type {
  CrearIncidenteDto,
  ActualizarIncidenteDto,
  FiltroIncidentes,
  EventoTimeline,
  SeveridadEvento,
} from './incidentes.types'

// ─── Haversine (sin PostGIS) ─────────────────────────────────────────────────

function haversineMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function crearIncidente(data: CrearIncidenteDto, created_by: string) {
  const rows: any[] = await prisma.$queryRaw`
    INSERT INTO incidentes
      (comunidad_id, titulo, descripcion, tipo, severidad,
       fecha_inicio, ventana_horas, latitud, longitud, radio_metros, created_by)
    VALUES
      (${data.comunidad_id}, ${data.titulo}, ${data.descripcion ?? null},
       ${data.tipo ?? 'INCIDENTE'}, ${data.severidad ?? 'MEDIA'},
       ${new Date(data.fecha_inicio)},
       ${data.ventana_horas ?? 6},
       ${data.latitud ?? null}, ${data.longitud ?? null},
       ${data.radio_metros ?? 500},
       ${created_by})
    RETURNING *
  `
  return rows[0]
}

export async function listarIncidentes(filtros: FiltroIncidentes) {
  const { comunidad_id, estado, tipo, severidad, limit = 50, offset = 0 } = filtros

  const rows: any[] = await prisma.$queryRaw`
    SELECT i.*,
           c.nombre AS comunidad_nombre,
           (SELECT COUNT(*)::int FROM incidentes WHERE comunidad_id = i.comunidad_id) AS total_comunidad
    FROM incidentes i
    LEFT JOIN comunidades c ON c.id = i.comunidad_id
    WHERE
      (${comunidad_id ?? null}::text IS NULL OR i.comunidad_id = ${comunidad_id ?? null})
      AND (${estado ?? null}::text IS NULL OR i.estado = ${estado ?? null})
      AND (${tipo ?? null}::text IS NULL OR i.tipo = ${tipo ?? null})
      AND (${severidad ?? null}::text IS NULL OR i.severidad = ${severidad ?? null})
    ORDER BY i.fecha_inicio DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const total: any[] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM incidentes
    WHERE
      (${comunidad_id ?? null}::text IS NULL OR comunidad_id = ${comunidad_id ?? null})
      AND (${estado ?? null}::text IS NULL OR estado = ${estado ?? null})
      AND (${tipo ?? null}::text IS NULL OR tipo = ${tipo ?? null})
      AND (${severidad ?? null}::text IS NULL OR severidad = ${severidad ?? null})
  `

  return { items: rows, total: total[0]?.cnt ?? 0 }
}

export async function obtenerIncidente(id: string) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT i.*, c.nombre AS comunidad_nombre
    FROM incidentes i
    LEFT JOIN comunidades c ON c.id = i.comunidad_id
    WHERE i.id = ${id}::uuid
  `
  return rows[0] ?? null
}

export async function actualizarIncidente(id: string, data: ActualizarIncidenteDto) {
  const campos: string[] = []
  const valores: any[] = []
  let idx = 1

  if (data.titulo !== undefined)       { campos.push(`titulo = $${idx++}`);       valores.push(data.titulo) }
  if (data.descripcion !== undefined)  { campos.push(`descripcion = $${idx++}`);  valores.push(data.descripcion) }
  if (data.tipo !== undefined)         { campos.push(`tipo = $${idx++}`);         valores.push(data.tipo) }
  if (data.estado !== undefined)       { campos.push(`estado = $${idx++}`);       valores.push(data.estado) }
  if (data.severidad !== undefined)    { campos.push(`severidad = $${idx++}`);    valores.push(data.severidad) }
  if (data.fecha_inicio !== undefined) { campos.push(`fecha_inicio = $${idx++}`); valores.push(new Date(data.fecha_inicio)) }
  if (data.fecha_cierre !== undefined) { campos.push(`fecha_cierre = $${idx++}`); valores.push(data.fecha_cierre ? new Date(data.fecha_cierre) : null) }
  if (data.ventana_horas !== undefined){ campos.push(`ventana_horas = $${idx++}`);valores.push(data.ventana_horas) }
  if (data.latitud !== undefined)      { campos.push(`latitud = $${idx++}`);      valores.push(data.latitud) }
  if (data.longitud !== undefined)     { campos.push(`longitud = $${idx++}`);     valores.push(data.longitud) }
  if (data.radio_metros !== undefined) { campos.push(`radio_metros = $${idx++}`); valores.push(data.radio_metros) }
  if (data.notas_cierre !== undefined) { campos.push(`notas_cierre = $${idx++}`); valores.push(data.notas_cierre) }

  if (campos.length === 0) return obtenerIncidente(id)

  campos.push(`updated_at = NOW()`)
  valores.push(id)

  const sql = `UPDATE incidentes SET ${campos.join(', ')} WHERE id = $${idx}::uuid RETURNING *`
  const rows: any[] = await prisma.$queryRawUnsafe(sql, ...valores)
  return rows[0]
}

export async function eliminarIncidente(id: string) {
  return prisma.$executeRaw`DELETE FROM incidentes WHERE id = ${id}::uuid`
}

// ─── TIMELINE ────────────────────────────────────────────────────────────────

export async function obtenerTimeline(incidenteId: string): Promise<EventoTimeline[]> {
  const incidente = await obtenerIncidente(incidenteId)
  if (!incidente) throw new Error('Incidente no encontrado')

  const { comunidad_id, fecha_inicio, ventana_horas, latitud, longitud, radio_metros } = incidente
  const desde = new Date(fecha_inicio)
  desde.setHours(desde.getHours() - ventana_horas)
  const hasta = new Date(fecha_inicio)
  hasta.setHours(hasta.getHours() + ventana_horas)

  const eventos: EventoTimeline[] = []

  // ── 1. PTT Reports ──────────────────────────────────────────────────────
  try {
    const ptts: any[] = await prisma.$queryRaw`
      SELECT rp.id, rp.created_at, rp.duracion_seg, rp.media_url,
             rp.usuario_id, rp.usuario_nombre, rp.canal,
             ri.transcripcion, ri.resumen
      FROM reportes_ptt rp
      LEFT JOIN reportes_ia ri ON ri.reporte_id = rp.id
      WHERE rp.comunidad_id = ${comunidad_id}
        AND rp.created_at BETWEEN ${desde} AND ${hasta}
      ORDER BY rp.created_at ASC
    `
    for (const r of ptts) {
      // Filtro geográfico si hay coords
      if (latitud && longitud && r.lat && r.lng) {
        if (haversineMetros(latitud, longitud, r.lat, r.lng) > radio_metros) continue
      }
      eventos.push({
        id: `ptt-${r.id}`,
        tipo: 'PTT_REPORT',
        timestamp: r.created_at.toISOString(),
        titulo: `Radio PTT — ${r.usuario_nombre ?? 'Guardia'}`,
        descripcion: r.transcripcion ?? r.resumen ?? `Transmisión de ${r.duracion_seg ?? '?'}s`,
        actor: r.usuario_nombre,
        severidad: 'INFO',
        media_url: r.media_url ?? null,
        metadata: { canal: r.canal, duracion_seg: r.duracion_seg, resumen: r.resumen },
      })
    }
  } catch (_) { /* tabla puede no existir */ }

  // ── 2. Checkpoints de ronda ──────────────────────────────────────────────
  try {
    const checkpoints: any[] = await prisma.$queryRaw`
      SELECT cv.id, cv.marcado_at, cv.metodo, cv.foto_url, cv.observaciones,
             cp.nombre AS cp_nombre, rr.nombre AS ruta_nombre,
             ru.nombre AS guardia_nombre
      FROM checkpoint_visitas cv
      JOIN checkpoints cp ON cp.id = cv.checkpoint_id::uuid
      JOIN rondas_ejecucion re ON re.id = cv.ejecucion_id::uuid
      JOIN rutas_ronda rr ON rr.id = re.ruta_id
      JOIN rondas_usuarios ru ON ru.id::text = re.guardia_id
      WHERE rr.comunidad_id = ${comunidad_id}
        AND cv.marcado_at BETWEEN ${desde} AND ${hasta}
      ORDER BY cv.marcado_at ASC
    `
    for (const r of checkpoints) {
      eventos.push({
        id: `cp-${r.id}`,
        tipo: 'PATROL_CHECKPOINT',
        timestamp: r.marcado_at.toISOString(),
        titulo: `Checkpoint — ${r.cp_nombre}`,
        descripcion: `Guardia ${r.guardia_nombre} marcó "${r.cp_nombre}" en ruta "${r.ruta_nombre}" (${r.metodo ?? 'QR'})`,
        actor: r.guardia_nombre,
        severidad: 'INFO',
        media_url: r.foto_url ?? null,
        metadata: { metodo: r.metodo, ruta: r.ruta_nombre, observaciones: r.observaciones },
      })
    }
  } catch (_) { /* */ }

  // ── 3. Alertas IA (cámaras) ──────────────────────────────────────────────
  try {
    const alertasIA: any[] = await prisma.$queryRaw`
      SELECT id, created_at, tipo, confianza, imagen_url, descripcion, dispositivo_id
      FROM alertas_ia
      WHERE comunidad_id = ${comunidad_id}
        AND created_at BETWEEN ${desde} AND ${hasta}
      ORDER BY created_at ASC
    `
    for (const r of alertasIA) {
      const severidad: SeveridadEvento = r.confianza >= 0.8 ? 'CRITICAL' : r.confianza >= 0.5 ? 'WARNING' : 'INFO'
      eventos.push({
        id: `ia-${r.id}`,
        tipo: 'AI_ALERT',
        timestamp: r.created_at.toISOString(),
        titulo: `Alerta IA — ${r.tipo ?? 'Detección'}`,
        descripcion: r.descripcion ?? `Confianza: ${((r.confianza ?? 0) * 100).toFixed(0)}%`,
        actor: 'Sistema IA',
        severidad,
        media_url: r.imagen_url ?? null,
        metadata: { tipo: r.tipo, confianza: r.confianza, dispositivo_id: r.dispositivo_id },
      })
    }
  } catch (_) { /* */ }

  // ── 4. Alertas de comportamiento ─────────────────────────────────────────
  try {
    const comportamiento: any[] = await prisma.$queryRaw`
      SELECT id, created_at, tipo, nivel, detalle, imagen_url
      FROM alertas_comportamiento
      WHERE comunidad_id = ${comunidad_id}
        AND created_at BETWEEN ${desde} AND ${hasta}
      ORDER BY created_at ASC
    `
    for (const r of comportamiento) {
      const severidad: SeveridadEvento =
        r.nivel === 'ALTO' ? 'CRITICAL' : r.nivel === 'MEDIO' ? 'WARNING' : 'INFO'
      eventos.push({
        id: `comp-${r.id}`,
        tipo: 'BEHAVIOR_ALERT',
        timestamp: r.created_at.toISOString(),
        titulo: `Comportamiento sospechoso — ${r.tipo ?? ''}`,
        descripcion: r.detalle ?? r.tipo ?? 'Alerta de comportamiento',
        actor: 'IA Comportamiento',
        severidad,
        media_url: r.imagen_url ?? null,
        metadata: { tipo: r.tipo, nivel: r.nivel },
      })
    }
  } catch (_) { /* */ }

  // ── 5. Alertas de guardia (PANICO / COACCION) ────────────────────────────
  try {
    const panics: any[] = await prisma.$queryRaw`
      SELECT gc.id, gc.created_at, gc.tipo, gc.lat, gc.lng,
             ru.nombre AS guardia_nombre, ru.comunidad_id AS guard_comunidad
      FROM guardia_checkins gc
      JOIN rondas_usuarios ru ON ru.id::text = gc.usuario_id
      WHERE gc.tipo IN ('PANICO','COACCION')
        AND ru.comunidad_id = ${comunidad_id}
        AND gc.created_at BETWEEN ${desde} AND ${hasta}
      ORDER BY gc.created_at ASC
    `
    for (const r of panics) {
      eventos.push({
        id: `gc-${r.id}`,
        tipo: 'GUARD_PANIC',
        timestamp: r.created_at.toISOString(),
        titulo: `⚠️ ${r.tipo === 'COACCION' ? 'Coacción' : 'Pánico'} de guardia — ${r.guardia_nombre}`,
        descripcion: `El guardia ${r.guardia_nombre} activó ${r.tipo === 'COACCION' ? 'alerta de coacción' : 'botón de pánico'}`,
        actor: r.guardia_nombre,
        severidad: 'CRITICAL',
        metadata: { tipo: r.tipo, lat: r.lat, lng: r.lng },
      })
    }
  } catch (_) { /* */ }

  // ── 6. Alertas de guardia (tabla general) ────────────────────────────────
  try {
    const alertasGuardia: any[] = await prisma.$queryRaw`
      SELECT id, created_at, tipo, descripcion, guardia_id, guardia_nombre
      FROM alertas_guardia
      WHERE created_at BETWEEN ${desde} AND ${hasta}
      ORDER BY created_at ASC
    `
    for (const r of alertasGuardia) {
      eventos.push({
        id: `ag-${r.id}`,
        tipo: 'GUARD_ALERT',
        timestamp: r.created_at.toISOString(),
        titulo: `Alerta guardia — ${r.tipo ?? 'General'}`,
        descripcion: r.descripcion ?? r.tipo ?? 'Alerta de guardia',
        actor: r.guardia_nombre ?? r.guardia_id,
        severidad: 'WARNING',
        metadata: { tipo: r.tipo, guardia_id: r.guardia_id },
      })
    }
  } catch (_) { /* */ }

  // ── 7. Placas alertadas ──────────────────────────────────────────────────
  try {
    const placas: any[] = await prisma.$queryRaw`
      SELECT pa.id, pa.created_at, pa.placa, pa.tipo, pa.foto_url, pa.confianza,
             pd.razon AS denegada_razon
      FROM placas_alertas pa
      LEFT JOIN placas_denegadas pd ON pd.placa = pa.placa
      WHERE pa.comunidad_id = ${comunidad_id}
        AND pa.created_at BETWEEN ${desde} AND ${hasta}
      ORDER BY pa.created_at ASC
    `
    for (const r of placas) {
      const severidad: SeveridadEvento = r.denegada_razon ? 'CRITICAL' : r.tipo === 'ALERTA' ? 'WARNING' : 'INFO'
      eventos.push({
        id: `placa-${r.id}`,
        tipo: 'PLATE_ALERT',
        timestamp: r.created_at.toISOString(),
        titulo: `Placa ${r.denegada_razon ? '🚨 DENEGADA' : 'detectada'} — ${r.placa}`,
        descripcion: r.denegada_razon
          ? `Placa ${r.placa} en lista negra: ${r.denegada_razon}`
          : `Placa ${r.placa} detectada (${r.tipo ?? 'LECTURA'})`,
        actor: 'ALPR',
        severidad,
        media_url: r.foto_url ?? null,
        metadata: { placa: r.placa, tipo: r.tipo, razon: r.denegada_razon, confianza: r.confianza },
      })
    }
  } catch (_) { /* */ }

  // ── 8. Visitas (QR usado) ────────────────────────────────────────────────
  try {
    const visitas: any[] = await prisma.$queryRaw`
      SELECT id, usado_at, nombre_visitante, documento_visitante,
             residente_nombre, motivo, tipo_visita
      FROM visitas
      WHERE comunidad_id = ${comunidad_id}
        AND qr_usado = true
        AND usado_at BETWEEN ${desde} AND ${hasta}
      ORDER BY usado_at ASC
    `
    for (const r of visitas) {
      eventos.push({
        id: `visita-${r.id}`,
        tipo: 'VISITOR',
        timestamp: r.usado_at.toISOString(),
        titulo: `Visita — ${r.nombre_visitante ?? 'Sin nombre'}`,
        descripcion: `${r.nombre_visitante ?? 'Visitante'} ingresó a visitar a ${r.residente_nombre ?? ''}. Motivo: ${r.motivo ?? r.tipo_visita ?? '-'}`,
        actor: r.nombre_visitante,
        severidad: 'INFO',
        metadata: {
          documento: r.documento_visitante,
          residente: r.residente_nombre,
          motivo: r.motivo,
          tipo: r.tipo_visita,
        },
      })
    }
  } catch (_) { /* */ }

  // ── 9. Botón de pánico ───────────────────────────────────────────────────
  try {
    const panicos: any[] = await prisma.$queryRaw`
      SELECT id, created_at, tipo, lat, lng, descripcion, estado,
             usuario_nombre, usuario_tipo
      FROM eventos_panico
      WHERE comunidad_id = ${comunidad_id}
        AND created_at BETWEEN ${desde} AND ${hasta}
      ORDER BY created_at ASC
    `
    for (const r of panicos) {
      // Filtro Haversine si hay coords en el incidente y en el evento
      if (latitud && longitud && r.lat && r.lng) {
        if (haversineMetros(latitud, longitud, r.lat, r.lng) > radio_metros) continue
      }
      eventos.push({
        id: `panico-${r.id}`,
        tipo: 'PANIC_BUTTON',
        timestamp: r.created_at.toISOString(),
        titulo: `🚨 Botón de pánico — ${r.usuario_nombre ?? r.usuario_tipo ?? 'Usuario'}`,
        descripcion: r.descripcion ?? `Tipo: ${r.tipo ?? 'SOS'} · Estado: ${r.estado}`,
        actor: r.usuario_nombre,
        severidad: 'CRITICAL',
        metadata: { tipo: r.tipo, estado: r.estado, lat: r.lat, lng: r.lng, usuario_tipo: r.usuario_tipo },
      })
    }
  } catch (_) { /* */ }

  // ── 10. Despachos (cada etapa = evento separado) ─────────────────────────
  try {
    const despachos: any[] = await prisma.$queryRaw`
      SELECT id, tipo, estado, descripcion,
             created_at, asignado_at, en_camino_at, en_sitio_at, cierre_at,
             operador_nombre, unidad_nombre
      FROM despachos
      WHERE created_at BETWEEN ${desde} AND ${hasta}
      ORDER BY created_at ASC
    `
    for (const d of despachos) {
      const base = {
        titulo_prefijo: `Despacho ${d.tipo ?? ''} — ${d.unidad_nombre ?? d.operador_nombre ?? 'Unidad'}`,
        actor: d.operador_nombre ?? d.unidad_nombre,
        metadata: { tipo: d.tipo, estado: d.estado, id: d.id },
      }
      const etapas: Array<[Date | null, string, SeveridadEvento]> = [
        [d.created_at,    'Despacho creado',     'WARNING'],
        [d.asignado_at,   'Unidad asignada',     'WARNING'],
        [d.en_camino_at,  'Unidad en camino',    'INFO'],
        [d.en_sitio_at,   'Unidad en sitio',     'INFO'],
        [d.cierre_at,     'Despacho cerrado',    'INFO'],
      ]
      etapas.forEach(([ts, label, sev], i) => {
        if (!ts) return
        const tsDate = ts instanceof Date ? ts : new Date(ts)
        if (tsDate < desde || tsDate > hasta) return
        eventos.push({
          id: `despacho-${d.id}-${i}`,
          tipo: 'DISPATCH',
          timestamp: tsDate.toISOString(),
          titulo: `${base.titulo_prefijo} · ${label}`,
          descripcion: d.descripcion ?? label,
          actor: base.actor,
          severidad: sev,
          metadata: base.metadata,
        })
      })
    }
  } catch (_) { /* */ }

  // Ordenar todo por timestamp ASC
  eventos.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  return eventos
}
