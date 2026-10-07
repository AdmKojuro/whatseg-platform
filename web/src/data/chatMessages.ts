export interface ChatMessage {
  from: 'bot' | 'user';
  text: string;
  time: string;
}

export const chatMessages: ChatMessage[] = [
  {
    from: 'bot',
    text: '\u{1F3E0} *Whatseg*\nSistema de seguridad activo',
    time: '10:30',
  },
  {
    from: 'user',
    text: 'Activar alarma',
    time: '10:31',
  },
  {
    from: 'bot',
    text: '\u2705 Alarma activada correctamente\n\u{1F512} Modo: Seguridad total',
    time: '10:31',
  },
  {
    from: 'user',
    text: 'Estado cámaras',
    time: '10:32',
  },
  {
    from: 'bot',
    text: '\u{1F4F9} Cámara sala: \u2705 En línea\n\u{1F4F9} Cámara entrada: \u2705 En línea\n\u{1F4F9} Cámara patio: \u2705 En línea',
    time: '10:32',
  },
];
