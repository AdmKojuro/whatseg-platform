export interface Feature {
  id: number;
  icon: string;
  title: string;
  description: string;
}

export const features: Feature[] = [
  {
    id: 1,
    icon: 'LayoutDashboard',
    title: 'Dashboard Central',
    description: 'Activaciones, cámaras, control de accesos y gestión de clientes en un solo panel. Visibilidad total de la comunidad en tiempo real.',
  },
  {
    id: 2,
    icon: 'MapPin',
    title: 'Monitoreo de Rondas',
    description: 'Seguimiento GPS de rondas de vigilancia con checkpoints y verificación automática. Sabe exactamente dónde está cada guardia.',
  },
  {
    id: 3,
    icon: 'Siren',
    title: 'Botón de Pánico',
    description: 'Alerta SOS con GPS que envía la ubicación exacta al instante. Respuesta inmediata ante cualquier emergencia del personal de seguridad.',
  },
  {
    id: 4,
    icon: 'Mic',
    title: 'Reportes PTT',
    description: 'Reportes de voz Push-to-Talk con transcripción y registro automático. Historial completo de cada comunicación del equipo.',
  },
  {
    id: 5,
    icon: 'Brain',
    title: 'PTT con Asistente IA',
    description: 'Inteligencia artificial analiza las comunicaciones PTT y sugiere acciones en tiempo real. Decisiones más rápidas, respaldadas por IA.',
  },
  {
    id: 6,
    icon: 'Globe',
    title: 'Soporte Bilingüe',
    description: 'Atención a residentes y visitantes extranjeros en su idioma con traducción en tiempo real. Sin barreras de comunicación.',
  },
  {
    id: 7,
    icon: 'Cctv',
    title: 'Videoportero',
    description: 'Control de accesos por video desde tablet: torres, apartamentos, residentes y llamadas WhatsApp. Control total de quién entra y sale.',
  },
  {
    id: 8,
    icon: 'Settings2',
    title: 'Configuración de Módulos',
    description: 'Activa o desactiva rondas, PTT, videoportero y más para cada comunidad. Personalización total por cliente.',
  },
];
