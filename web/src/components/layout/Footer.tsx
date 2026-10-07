import { Mail, Phone, MapPin } from 'lucide-react';

type LegalPage = 'terminos' | 'privacidad' | 'uso-ia' | null;

const footerLinks = [
  { label: 'Características', href: '#caracteristicas' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Planes', href: '#planes' },
  { label: 'Preguntas', href: '#preguntas' },
  { label: 'Contacto', href: '#contacto' },
];

const legalLinks: { label: string; page: LegalPage }[] = [
  { label: 'Términos y Condiciones', page: 'terminos' },
  { label: 'Política de Privacidad', page: 'privacidad' },
  { label: 'Uso de IA', page: 'uso-ia' },
];

interface Props {
  onNavigate: (page: LegalPage) => void;
}

export default function Footer({ onNavigate }: Props) {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <a href="#" className="flex items-center">
              <div className="inline-flex rounded-xl bg-white px-3 py-1.5">
                <img src="/logo.webp" alt="Whatseg" className="h-7 w-auto" />
              </div>
            </a>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">
              Plataforma de seguridad inteligente para comunidades residenciales.
              Videoportero, rondas GPS, botón de pánico, PTT con IA y más —
              todo notificado por WhatsApp.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Navegación
            </h3>
            <ul className="space-y-3">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-gray-400 transition-colors hover:text-whatsapp"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Legal
            </h3>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.page}>
                  <button
                    onClick={() => onNavigate(link.page)}
                    className="text-sm text-gray-400 transition-colors hover:text-whatsapp text-left"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Contacto
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:info@whatseg.com"
                  className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-whatsapp"
                >
                  <Mail className="h-4 w-4" />
                  info@whatseg.com
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/573202413815"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-whatsapp"
                >
                  <Phone className="h-4 w-4" />
                  +57 320 241 3815
                </a>
              </li>
              <li>
                <span className="flex items-center gap-2 text-sm text-gray-400">
                  <MapPin className="h-4 w-4" />
                  Colombia
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider & Copyright */}
        <div className="mt-12 border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            &copy; 2026 Whatseg. Todos los derechos reservados.
          </p>
          <div className="flex gap-6">
            {legalLinks.map((link) => (
              <button
                key={link.page}
                onClick={() => onNavigate(link.page)}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
