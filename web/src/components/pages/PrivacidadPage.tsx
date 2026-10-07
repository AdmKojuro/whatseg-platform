import { ArrowLeft, Lock, Database, Eye, Share2, Clock, ShieldCheck, UserCheck, AlertCircle, Mail } from 'lucide-react';
import ScrollReveal from '../ui/ScrollReveal';

interface Props { onBack: () => void; }

const dataTypes = [
  { icon: UserCheck, color: 'bg-green-500', label: 'Residentes', desc: 'Nombre, WhatsApp, foto, embeddings faciales, registro de accesos' },
  { icon: Eye, color: 'bg-blue-500', label: 'Visitantes', desc: 'Nombre, fotografía en visita, apartamento, código QR/PIN usado' },
  { icon: ShieldCheck, color: 'bg-violet-500', label: 'Guardias', desc: 'Nombre, teléfono, ubicación GPS durante rondas, checkpoints' },
  { icon: Database, color: 'bg-amber-500', label: 'Administradores', desc: 'Correo, contraseña (hash), historial de acciones en panel' },
];

const rights = [
  { label: 'Conocer', desc: 'Saber qué datos tenemos y para qué los usamos' },
  { label: 'Actualizar', desc: 'Corregir información incompleta o incorrecta' },
  { label: 'Rectificar', desc: 'Modificar datos inexactos en cualquier momento' },
  { label: 'Suprimir', desc: 'Solicitar la eliminación de sus datos personales' },
  { label: 'Revocar', desc: 'Retirar el consentimiento para datos biométricos' },
  { label: 'Quejar', desc: 'Presentar queja ante la SIC de Colombia' },
];

const sections = [
  {
    icon: UserCheck, color: 'from-green-500 to-emerald-600', num: '01',
    title: 'Responsable del Tratamiento',
    content: 'Whatseg es el responsable del tratamiento de los datos personales recopilados a través de la plataforma. El cliente (administración de la propiedad) actúa como encargado del tratamiento respecto a los datos de sus residentes y visitantes, siendo responsable de obtener los consentimientos necesarios. Contacto: info@whatseg.com — +57 3202413815',
  },
  {
    icon: AlertCircle, color: 'from-emerald-500 to-teal-600', num: '02',
    title: 'Datos Biométricos — Tratamiento Especial',
    content: 'Las fotografías faciales e incrustaciones numéricas del rostro tienen un tratamiento especialmente cuidadoso: se almacenan cifradas en servidores con acceso restringido; solo son accesibles por el sistema de reconocimiento y administradores autorizados; no se comparten con terceros salvo requerimiento legal; y se eliminan cuando el residente deja de pertenecer a la comunidad o solicita la supresión. El consentimiento puede ser revocado en cualquier momento.',
  },
  {
    icon: Eye, color: 'from-blue-500 to-cyan-600', num: '03',
    title: 'Finalidad del Tratamiento',
    content: 'Sus datos se usan para: identificar y autorizar el acceso de residentes mediante reconocimiento facial; enviar notificaciones de seguridad (visitas, encomiendas, alertas) por WhatsApp; registrar y auditar eventos de acceso; gestionar rondas de vigilancia; detectar patrones de comportamiento inusuales mediante IA; y prestar soporte técnico.',
  },
  {
    icon: Share2, color: 'from-violet-500 to-purple-600', num: '04',
    title: 'Comunicación y Terceros',
    content: 'Whatseg puede compartir datos solo en estos casos: WhatsApp/Meta para envío de notificaciones (bajo sus propias políticas); proveedores de infraestructura (servidores VPS) bajo acuerdos de confidencialidad; y autoridades cuando sea requerido por orden judicial. No vendemos, alquilamos ni cedemos datos a terceros con fines comerciales.',
  },
  {
    icon: Clock, color: 'from-amber-500 to-orange-600', num: '05',
    title: 'Retención de Datos',
    content: 'Datos biométricos: mientras esté activo como residente (eliminados en 30 días tras solicitud). Historial de acceso: 12 meses. GPS de rondas: 6 meses. Datos de administradores: mientras dure la cuenta, hasta 5 años para auditoría. Datos de clientes: mientras dure la relación contractual y según normas fiscales colombianas.',
  },
  {
    icon: Lock, color: 'from-slate-500 to-gray-600', num: '06',
    title: 'Seguridad de los Datos',
    content: 'Implementamos transmisión cifrada mediante HTTPS/TLS, contraseñas con hashing bcrypt, datos biométricos almacenados cifrados, acceso restringido a la base de datos por roles, y monitoreo de accesos no autorizados.',
  },
];

export default function PrivacidadPage({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

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

        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div style={{ animation: 'fadeUp 0.6s ease-out both' }}>
              <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-4 py-1.5 text-sm font-medium text-blue-400">
                <Lock className="h-3.5 w-3.5" /> Ley 1581 de 2012 · Habeas Data
              </span>
              <h1 className="mt-4 text-5xl font-extrabold leading-tight text-white lg:text-6xl">
                Política de<br />
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Privacidad
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-400">
                Tratamos sus datos con responsabilidad. Sepa qué recopilamos, para qué lo usamos, y cómo puede ejercer sus derechos como titular.
              </p>
              <div className="mt-6 inline-flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
                <ShieldCheck className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <p className="text-sm text-gray-300"><strong className="text-white">No vendemos sus datos.</strong> Nunca. A nadie.</p>
              </div>
            </div>

            {/* illustration */}
            <div className="flex justify-center" style={{ animation: 'fadeUp 0.6s ease-out 0.2s both' }}>
              <div className="relative flex h-72 w-72 items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-blue-500/10" style={{ animation: 'pulse-ring 3s ease-out infinite' }} />
                <div className="absolute inset-8 rounded-full border border-blue-500/15" style={{ animation: 'pulse-ring 3s ease-out 1s infinite' }} />
                <div className="absolute inset-16 rounded-full border border-blue-500/20" style={{ animation: 'pulse-ring 3s ease-out 2s infinite' }} />
                <div className="relative flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-2xl shadow-blue-500/30" style={{ animation: 'float 4s ease-in-out infinite' }}>
                  <Lock className="h-16 w-16 text-white" />
                </div>
                <div className="absolute -right-4 top-8 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm" style={{ animation: 'float 3.5s ease-in-out 0.5s infinite' }}>
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-medium text-white">Datos cifrados</span>
                </div>
                <div className="absolute -left-6 bottom-12 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm" style={{ animation: 'float 4.5s ease-in-out 1s infinite' }}>
                  <UserCheck className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium text-white">Sus derechos</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <svg viewBox="0 0 1440 60" fill="none" className="w-full">
          <path d="M0 60L60 52C120 44 240 28 360 24C480 20 600 28 720 32C840 36 960 36 1080 32C1200 28 1320 20 1380 16L1440 12V60H0Z" fill="#f9fafb" />
        </svg>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 space-y-16">

        {/* Datos que recopilamos */}
        <ScrollReveal>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-8 text-center">
            ¿Qué datos <span className="text-blue-600">recopilamos</span>?
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {dataTypes.map((d, i) => {
              const Icon = d.icon;
              return (
                <ScrollReveal key={d.label} delay={i * 80}>
                  <div className="group flex gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${d.color} shadow-sm`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{d.label}</p>
                      <p className="text-sm text-gray-500 mt-1">{d.desc}</p>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </ScrollReveal>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <ScrollReveal key={s.num} delay={i * 60}>
                <div className="flex gap-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
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

        {/* Derechos del titular */}
        <ScrollReveal>
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-8">
            <h2 className="text-xl font-extrabold text-gray-900 mb-2 flex items-center gap-3">
              <UserCheck className="h-6 w-6 text-blue-600" /> Sus Derechos como Titular
            </h2>
            <p className="text-sm text-gray-500 mb-6">Conforme a la Ley 1581 de 2012 (Habeas Data), usted tiene derecho a:</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rights.map((r, i) => (
                <div key={r.label} className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-bold text-blue-700">{r.label}</div>
                  <div className="mt-1 text-xs text-gray-500">{r.desc}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-blue-600 px-5 py-3">
              <Mail className="h-5 w-5 text-white flex-shrink-0" />
              <p className="text-sm text-white">
                Para ejercer sus derechos: <strong>info@whatseg.com</strong> — Asunto: "Solicitud Habeas Data". Respondemos en máx. 10 días hábiles.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>

      <div className="border-t border-gray-200 py-8 text-center">
        <p className="text-sm text-gray-400">&copy; 2026 Whatseg · Todos los derechos reservados</p>
      </div>
    </div>
  );
}
