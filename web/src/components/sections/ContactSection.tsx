import { Mail, Phone, MessageCircle, MapPin } from 'lucide-react';
import ContactForm from './ContactForm';
import ScrollReveal from '../ui/ScrollReveal';

const contactInfo = [
  {
    icon: Mail,
    label: 'Email',
    value: 'info@whatseg.com',
    href: 'mailto:info@whatseg.com',
  },
  {
    icon: Phone,
    label: 'Teléfono',
    value: '+57 320 241 3815',
    href: 'tel:+573202413815',
  },
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    value: '+57 320 241 3815',
    href: 'https://wa.me/573202413815',
  },
  {
    icon: MapPin,
    label: 'Ubicación',
    value: 'Medellín, Antioquia — Colombia',
    href: undefined,
  },
];

export default function ContactSection() {
  return (
    <section id="contacto" className="bg-gray-50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              <span className="text-whatsapp">Contáctanos</span>
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              ¿Tienes preguntas? Escríbenos y te responderemos lo antes posible.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-2">
          {/* Contact info */}
          <ScrollReveal>
            <div>
              <h3 className="mb-6 text-xl font-bold text-gray-900">
                Información de contacto
              </h3>
              <div className="space-y-5">
                {contactInfo.map((info) => (
                  <div key={info.label} className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-whatsapp/10 text-whatsapp">
                      <info.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        {info.label}
                      </p>
                      {info.href ? (
                        <a
                          href={info.href}
                          target={info.href.startsWith('http') ? '_blank' : undefined}
                          rel={info.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="text-base font-semibold text-gray-900 transition-colors hover:text-whatsapp"
                        >
                          {info.value}
                        </a>
                      ) : (
                        <p className="text-base font-semibold text-gray-900">
                          {info.value}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
                <h4 className="mb-2 font-bold text-gray-900">
                  Horario de atención
                </h4>
                <p className="text-sm text-gray-600">
                  Lunes a Viernes: 8:00 AM - 6:00 PM
                </p>
                <p className="text-sm text-gray-600">
                  Sábados: 9:00 AM - 1:00 PM
                </p>
                <p className="mt-2 text-sm font-medium text-whatsapp">
                  Soporte por WhatsApp 24/7
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* Contact form */}
          <ScrollReveal delay={200}>
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <h3 className="mb-6 text-xl font-bold text-gray-900">
                Envíanos un mensaje
              </h3>
              <ContactForm />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
