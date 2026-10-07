export interface Plan {
  id: number;
  name: string;
  price: string;
  features: string[];
  popular: boolean;
  whatsappLink: string;
}

export const plans: Plan[] = [
  {
    id: 1,
    name: 'Plan Básico',
    price: 'Desde $15.000/mes',
    features: [
      'Videoportero con reconocimiento facial',
      'Notificaciones WhatsApp',
      'Registro de accesos',
      'Soporte básico',
    ],
    popular: false,
    whatsappLink:
      'https://wa.me/573202413815?text=Hola%2C%20me%20interesa%20el%20Plan%20B%C3%A1sico%20de%20WhatsEg',
  },
  {
    id: 2,
    name: 'Plan Comunidad',
    price: 'Desde $25.000/mes',
    features: [
      'Videoportero + Rondas GPS',
      'Botón de Pánico personal',
      'Reportes PTT con registro',
      'Monitoreo 24/7',
      'Soporte prioritario',
    ],
    popular: true,
    whatsappLink:
      'https://wa.me/573202413815?text=Hola%2C%20me%20interesa%20el%20Plan%20Comunidad%20de%20WhatsEg',
  },
  {
    id: 3,
    name: 'Plan Premium',
    price: 'Desde $45.000/mes',
    features: [
      'Todos los módulos incluidos',
      'PTT con Asistente IA',
      'Soporte Bilingüe',
      'Soporte VIP',
      'Dashboard centralizado',
      'Análisis de comportamiento IA',
    ],
    popular: false,
    whatsappLink:
      'https://wa.me/573202413815?text=Hola%2C%20me%20interesa%20el%20Plan%20Premium%20de%20WhatsEg',
  },
  {
    id: 4,
    name: 'Plan Empresarial',
    price: 'Personalizado',
    features: [
      'Comunidades ilimitadas',
      'Panel de administración completo',
      'Configuración de módulos por cliente',
      'Soporte dedicado',
      'SLA garantizado',
    ],
    popular: false,
    whatsappLink:
      'https://wa.me/573202413815?text=Hola%2C%20me%20interesa%20el%20Plan%20Empresarial%20de%20WhatsEg',
  },
];
