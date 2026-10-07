export interface FaqItem {
  question: string;
  answer: string;
}

export const faq: FaqItem[] = [
  {
    question: '¿Cómo funciona Whatseg?',
    answer:
      'Whatseg conecta tus dispositivos de seguridad a WhatsApp. A través de un bot inteligente, puedes activar alarmas, revisar cámaras y recibir notificaciones, todo desde la comodidad de tu chat de WhatsApp. No necesitas descargar ninguna app adicional.',
  },
  {
    question: '¿Necesito internet?',
    answer:
      'Sí, requieres una conexión a internet estable (WiFi o datos móviles) para que los dispositivos se comuniquen con el sistema. Recomendamos una conexión de al menos 10 Mbps para un funcionamiento óptimo con cámaras.',
  },
  {
    question: '¿Qué dispositivos son compatibles?',
    answer:
      'Somos compatibles con Tuya, Thinmoo, Dolynk, Imou y dispositivos MQTT. Esto incluye sirenas, cámaras, sensores de movimiento, sensores de puertas y más. Constantemente estamos ampliando nuestra lista de compatibilidad.',
  },
  {
    question: '¿Puedo instalar yo mismo?',
    answer:
      'La instalación la realiza un técnico certificado de Whatseg para garantizar el correcto funcionamiento de todos los dispositivos. El servicio de instalación está incluido en todos nuestros planes.',
  },
  {
    question: '¿Tiene contrato de permanencia?',
    answer:
      'No, nuestros planes son mes a mes. Puedes cancelar en cualquier momento sin penalidades. Creemos en la calidad de nuestro servicio y preferimos que te quedes porque estás satisfecho.',
  },
  {
    question: '¿Funciona si se va la luz?',
    answer:
      'Con un UPS o batería de respaldo, el sistema continúa funcionando normalmente. Recomendamos tener un respaldo de energía para garantizar la protección 24/7. También recibirás una notificación si se detecta un corte de energía.',
  },
];
