export interface ScoringTurno {
  turno: string
  dia: string
  generado_at: string
  comunidades: Array<{
    comunidad_id: string
    score: number
    horas_riesgo: number[]
  }>
}

export interface PatronesTemporales {
  por_hora: Array<{ hora: number; label: string; cnt: number }>
  por_dia: Array<{ dia: number; label: string; cnt: number }>
}

export interface RutaPatrulla {
  zona_id: string
  ruta: Array<{
    orden: number
    comunidad_id: string
    score: number
    horas_riesgo: number[]
  }>
  criterio: string
}
