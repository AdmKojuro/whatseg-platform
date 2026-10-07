export type Rol = 'SUPERADMIN' | 'ADMIN' | 'MONITOR' | 'CUADRANTE' | 'COMANDANTE'
export type ModoActivacion = 'GRUPAL' | 'INDIVIDUAL' | 'NONE'
export type ResultadoActivacion = 'EXITOSO' | 'FALLIDO' | 'DISPOSITIVO_OFFLINE'
export type VeredictoTipo = 'FALSA_ALARMA' | 'NOVEDAD'
export type TipoEmergencia = 'POLICIA' | 'ASISTENCIA_MEDICA' | 'BOMBEROS'

// Nuevos tipos para WhatsEg 2.0
export type EstadoDespacho = 'ASIGNADO' | 'EN_CAMINO' | 'EN_SITIO' | 'CERRADO' | 'CANCELADO'
export type TipoAlertaIA = 'FACE_MATCH' | 'FACE_RECURRENTE' | 'ARMA' | 'PLACA_ALERTA' | 'MERODEO'
export type SeveridadAlerta = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA'
export type TipoExpediente = 'SOSPECHOSO' | 'PERSONA_INTERES' | 'VEHICULO'
export type EstadoExpediente = 'ACTIVO' | 'INACTIVO' | 'CAPTURADO' | 'ELIMINADO'
export type TipoEvidencia = 'VIDEO' | 'IMAGEN' | 'AUDIO' | 'REPORTE'
