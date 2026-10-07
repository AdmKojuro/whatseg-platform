export interface Step {
  number: number;
  title: string;
  description: string;
}

export const steps: Step[] = [
  {
    number: 1,
    title: 'Contáctanos',
    description: 'Escríbenos por WhatsApp y te asesoramos sobre el mejor plan para ti.',
  },
  {
    number: 2,
    title: 'Instalación',
    description: 'Un técnico certificado instala los dispositivos en tu hogar u oficina.',
  },
  {
    number: 3,
    title: 'Configuración',
    description: 'Conectamos todo a tu WhatsApp y configuramos las alertas a tu medida.',
  },
  {
    number: 4,
    title: '¡Listo!',
    description: 'Tu hogar protegido con un mensaje. Activa, desactiva y monitorea desde WhatsApp.',
  },
];
