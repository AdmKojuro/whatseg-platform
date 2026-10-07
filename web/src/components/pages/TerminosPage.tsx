import { ArrowLeft, FileText, Users, Ban, CreditCard, Server, Shield, Scale, Edit3, XCircle, Globe, Mail } from 'lucide-react';
import ScrollReveal from '../ui/ScrollReveal';

interface Props { onBack: () => void; }

const sections = [
  {
    icon: FileText, color: 'from-green-500 to-emerald-600',
    num: '01', title: 'Aceptación de los Términos',
    content: 'Al contratar, acceder o utilizar los servicios de Whatseg, usted acepta quedar vinculado por los presentes Términos y Condiciones, la Política de Privacidad y la Política de Uso de Inteligencia Artificial. Estos términos aplican a administradores de propiedades, operadores de seguridad, residentes y cualquier persona que interactúe con el sistema, ya sea a través de la aplicación móvil, el panel de administración web o mediante mensajes de WhatsApp.',
  },
  {
    icon: Shield, color: 'from-blue-500 to-cyan-600',
    num: '02', title: 'Descripción del Servicio',
    content: 'Whatseg es una plataforma de seguridad inteligente para propiedades residenciales y comerciales que integra: control de acceso mediante reconocimiento facial, códigos QR y PIN; notificaciones de eventos de seguridad a través de WhatsApp; gestión de rondas de vigilancia con geolocalización; registro de visitantes, encomiendas y eventos de acceso; panel de administración web; y análisis de comportamiento asistido por inteligencia artificial.',
  },
  {
    icon: Users, color: 'from-violet-500 to-purple-600',
    num: '03', title: 'Responsabilidades del Cliente',
    content: 'El cliente es responsable de: proporcionar información veraz y actualizada durante el registro; mantener la confidencialidad de sus credenciales; obtener el consentimiento informado de residentes y visitantes antes de capturar datos biométricos; garantizar que el uso cumple con la Ley 1581 de 2012 sobre protección de datos personales; y notificar a Whatseg ante cualquier uso no autorizado de su cuenta.',
  },
  {
    icon: Ban, color: 'from-red-500 to-rose-600',
    num: '04', title: 'Uso Aceptable',
    content: 'Queda expresamente prohibido: usar la plataforma para actividades ilegales o fraudulentas; acceder de manera no autorizada a sistemas o cuentas de otros clientes; manipular o falsificar registros de acceso; realizar ingeniería inversa del software; compartir credenciales con personas no autorizadas; y utilizar el sistema para vigilancia masiva o discriminación.',
  },
  {
    icon: CreditCard, color: 'from-amber-500 to-orange-600',
    num: '05', title: 'Planes, Pagos y Renovaciones',
    content: 'Los servicios se prestan bajo modalidad de suscripción. Los pagos son anticipados y no son reembolsables salvo falla imputable exclusivamente a Whatseg. La falta de pago podrá resultar en la suspensión del servicio. Whatseg se reserva el derecho de modificar tarifas con un aviso previo de 30 días.',
  },
  {
    icon: Server, color: 'from-teal-500 to-green-600',
    num: '06', title: 'Disponibilidad y Soporte',
    content: 'Whatseg se esfuerza por mantener una disponibilidad del servicio superior al 99% mensual. Sin embargo, no garantizamos disponibilidad ininterrumpida debido a mantenimientos programados, fuerza mayor, o fallas de conectividad de terceros incluyendo los servidores de WhatsApp/Meta. El soporte técnico se presta a través de los canales oficiales según el plan contratado.',
  },
  {
    icon: XCircle, color: 'from-slate-500 to-gray-600',
    num: '07', title: 'Limitación de Responsabilidad',
    content: 'Whatseg no será responsable por pérdidas derivadas del uso incorrecto de la plataforma, incidentes de seguridad física en la propiedad del cliente, interrupciones del servicio de WhatsApp/Meta, o errores del reconocimiento facial por condiciones de iluminación deficientes. En ningún caso la responsabilidad total excederá el valor pagado en los últimos tres (3) meses.',
  },
  {
    icon: Edit3, color: 'from-pink-500 to-rose-500',
    num: '08', title: 'Propiedad Intelectual',
    content: 'Todos los derechos de propiedad intelectual sobre la plataforma Whatseg — software, diseño, marcas, algoritmos y documentación — son propiedad exclusiva de Whatseg. El cliente recibe únicamente una licencia de uso limitada, no exclusiva e intransferible para los fines contratados.',
  },
  {
    icon: Scale, color: 'from-indigo-500 to-blue-600',
    num: '09', title: 'Ley Aplicable y Jurisdicción',
    content: 'Estos Términos se rigen por las leyes de la República de Colombia. Para la resolución de cualquier controversia, las partes acuerdan someterse a la jurisdicción de los tribunales competentes de la ciudad de Medellín, Antioquia, Colombia.',
  },
  {
    icon: Globe, color: 'from-green-500 to-teal-600',
    num: '10', title: 'Modificaciones',
    content: 'Whatseg se reserva el derecho de modificar estos Términos en cualquier momento con un aviso previo de 15 días a través del correo electrónico registrado o mediante aviso en el panel de administración. El uso continuado del servicio implica la aceptación de los cambios.',
  },
];

const stats = [
  { value: '10', label: 'Secciones' },
  { value: '99%', label: 'Disponibilidad' },
  { value: '30 días', label: 'Aviso de cambios' },
  { value: 'Colombia', label: 'Jurisdicción' },
];

export default function TerminosPage({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-green-950">
        {/* decorative orbs */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-green-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-whatsapp/5 blur-2xl" />

        {/* nav */}
        <div className="relative mx-auto flex max-w-7xl items-center gap-6 px-4 py-5 sm:px-6 lg:px-8">
          <button onClick={onBack} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Volver al inicio
          </button>
          <div className="flex items-center">
            <div className="inline-flex rounded-xl bg-white px-3 py-1.5">
              <img src="/logo.webp" alt="Whatseg" className="h-6 w-auto" />
            </div>
          </div>
        </div>

        {/* hero content */}
        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div style={{ animation: 'fadeUp 0.6s ease-out both' }}>
              <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-whatsapp/15 px-4 py-1.5 text-sm font-medium text-whatsapp">
                <FileText className="h-3.5 w-3.5" /> Última actualización: octubre 2026
              </span>
              <h1 className="mt-4 text-5xl font-extrabold leading-tight text-white lg:text-6xl">
                Términos y<br />
                <span className="bg-gradient-to-r from-whatsapp to-emerald-400 bg-clip-text text-transparent">
                  Condiciones
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-400">
                Estos términos rigen el uso de la plataforma Whatseg para control de acceso, gestión de rondas y notificaciones de seguridad. Léelos antes de usar el servicio.
              </p>
            </div>

            {/* SVG Illustration */}
            <div className="flex justify-center" style={{ animation: 'fadeUp 0.6s ease-out 0.2s both' }}>
              <div className="relative flex h-72 w-72 items-center justify-center">
                {/* rings */}
                <div className="absolute inset-0 rounded-full border border-whatsapp/10" style={{ animation: 'pulse-ring 3s ease-out infinite' }} />
                <div className="absolute inset-8 rounded-full border border-whatsapp/15" style={{ animation: 'pulse-ring 3s ease-out 1s infinite' }} />
                <div className="absolute inset-16 rounded-full border border-whatsapp/20" style={{ animation: 'pulse-ring 3s ease-out 2s infinite' }} />
                {/* center icon */}
                <div className="relative flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br from-whatsapp to-emerald-600 shadow-2xl shadow-whatsapp/30" style={{ animation: 'float 4s ease-in-out infinite' }}>
                  <Scale className="h-16 w-16 text-white" />
                </div>
                {/* floating badges */}
                <div className="absolute -right-4 top-8 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm" style={{ animation: 'float 3.5s ease-in-out 0.5s infinite' }}>
                  <Shield className="h-4 w-4 text-whatsapp" />
                  <span className="text-xs font-medium text-white">Ley colombiana</span>
                </div>
                <div className="absolute -left-6 bottom-12 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm" style={{ animation: 'float 4.5s ease-in-out 1s infinite' }}>
                  <Users className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-medium text-white">Usuarios y clientes</span>
                </div>
              </div>
            </div>
          </div>

          {/* stats */}
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4" style={{ animation: 'fadeUp 0.6s ease-out 0.4s both' }}>
            {stats.map(s => (
              <div key={s.label} className="rounded-2xl border border-white/5 bg-white/5 p-4 text-center backdrop-blur-sm">
                <div className="text-2xl font-extrabold text-white">{s.value}</div>
                <div className="mt-1 text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* wave */}
        <svg viewBox="0 0 1440 60" fill="none" className="w-full">
          <path d="M0 60L60 52C120 44 240 28 360 24C480 20 600 28 720 32C840 36 960 36 1080 32C1200 28 1320 20 1380 16L1440 12V60H0Z" fill="#f9fafb" />
        </svg>
      </div>

      {/* ── SECTIONS ── */}
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <ScrollReveal key={s.num} delay={i * 60}>
                <div className="group flex gap-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} shadow-sm`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold text-gray-400">{s.num}</span>
                      <h2 className="text-base font-bold text-gray-900">{s.title}</h2>
                    </div>
                    <p className="text-sm leading-relaxed text-gray-600">{s.content}</p>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        {/* contact card */}
        <ScrollReveal delay={sections.length * 60}>
          <div className="mt-10 rounded-2xl bg-gradient-to-br from-gray-900 to-green-950 p-8 text-center">
            <Mail className="mx-auto mb-3 h-8 w-8 text-whatsapp" />
            <h3 className="text-lg font-bold text-white">¿Preguntas sobre estos términos?</h3>
            <p className="mt-2 text-sm text-gray-400">Contáctanos y te respondemos en menos de 24 horas.</p>
            <a href="mailto:info@whatseg.com" className="mt-4 inline-flex items-center gap-2 rounded-full bg-whatsapp px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-whatsapp-dark hover:shadow-lg hover:shadow-whatsapp/30">
              <Mail className="h-4 w-4" /> info@whatseg.com
            </a>
          </div>
        </ScrollReveal>
      </div>

      <div className="border-t border-gray-200 py-8 text-center">
        <p className="text-sm text-gray-400">&copy; 2026 Whatseg · Todos los derechos reservados</p>
      </div>
    </div>
  );
}
