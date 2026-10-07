import { ArrowLeft, Cpu, Eye, AlertTriangle, UserCheck, CheckCircle, XCircle, Brain, ShieldAlert, BarChart2, Car, Mail } from 'lucide-react';
import ScrollReveal from '../ui/ScrollReveal';

interface Props { onBack: () => void; }

const aiModules = [
  {
    icon: Eye, gradient: 'from-green-500 to-emerald-600', glow: 'shadow-green-500/25',
    title: 'Reconocimiento Facial',
    badge: 'Control de Acceso',
    badgeColor: 'bg-green-100 text-green-700',
    desc: 'Identifica residentes registrados analizando características faciales. Genera un vector numérico único (embedding) y lo compara en tiempo real. Usado exclusivamente para control de acceso, no para seguimiento masivo.',
    tags: ['ARM64 optimizado', 'Embeddings cifrados', 'Umbral configurable'],
  },
  {
    icon: BarChart2, gradient: 'from-blue-500 to-cyan-600', glow: 'shadow-blue-500/25',
    title: 'Análisis de Anomalías',
    badge: 'Asistencia Humana',
    badgeColor: 'bg-blue-100 text-blue-700',
    desc: 'Detecta patrones de acceso inusuales: accesos a horas atípicas, frecuencias fuera de lo normal, residentes sin actividad prolongada. Genera alertas para revisión del operador humano — no bloquea accesos de forma autónoma.',
    tags: ['Alertas informativas', 'Historial 12 meses', 'No toma decisiones'],
  },
  {
    icon: Brain, gradient: 'from-violet-500 to-purple-600', glow: 'shadow-violet-500/25',
    title: 'Soporte Conversacional',
    badge: 'Atención al Cliente',
    badgeColor: 'bg-violet-100 text-violet-700',
    desc: 'IA conversacional que responde consultas frecuentes sobre el uso de la plataforma. Transfiere a un agente humano cuando la consulta lo requiere.',
    tags: ['Transferencia humana', 'WhatsApp nativo', '24/7'],
  },
  {
    icon: Car, gradient: 'from-amber-500 to-orange-600', glow: 'shadow-amber-500/25',
    title: 'Reconocimiento de Placas',
    badge: 'Módulo Opcional',
    badgeColor: 'bg-amber-100 text-amber-700',
    desc: 'Identifica placas vehiculares y las compara contra la lista de vehículos registrados por la comunidad. Disponible como complemento del plan base.',
    tags: ['Opcional', 'Lista blanca', 'Control vehicular'],
  },
];

const doesDo = [
  'Identifica residentes registrados para abrir puertas',
  'Genera alertas informativas de patrones inusuales',
  'Registra eventos de acceso con trazabilidad completa',
  'Asiste al operador humano con información contextual',
];

const doesNotDo = [
  'Tomar decisiones autónomas sin supervisión humana',
  'Realizar vigilancia masiva o perfilamiento ideológico',
  'Compartir embeddings faciales con terceros',
  'Analizar emociones con fines comerciales',
  'Identificar personas en espacios públicos externos',
  'Generar decisiones que afecten derechos legales',
];

const limitations = [
  { icon: AlertTriangle, color: 'text-amber-500', title: 'Falsos negativos', desc: 'Posible falta de reconocimiento con poca luz, mascarillas o cambios físicos significativos.' },
  { icon: ShieldAlert, color: 'text-red-500', title: 'Falsos positivos', desc: 'En casos excepcionales, personas con rasgos muy similares podrían generar confusiones.' },
  { icon: BarChart2, color: 'text-blue-500', title: 'Variación étnica', desc: 'Los modelos pueden tener diferencias de precisión según características étnicas o de iluminación.' },
  { icon: Brain, color: 'text-violet-500', title: 'Alertas contextuales', desc: 'El sistema puede alertar por situaciones normales en contexto. La supervisión humana es esencial.' },
];

export default function UsoIAPage({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-violet-950 to-gray-900">
        <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
        {/* grid pattern */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />

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
              <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-500/15 px-4 py-1.5 text-sm font-medium text-violet-300">
                <Cpu className="h-3.5 w-3.5" /> Transparencia algorítmica · Octubre 2026
              </span>
              <h1 className="mt-4 text-5xl font-extrabold leading-tight text-white lg:text-6xl">
                Uso de<br />
                <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  Inteligencia Artificial
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-400">
                La IA en Whatseg es una herramienta de asistencia. Ninguna decisión que afecte derechos de las personas se toma de forma automática sin supervisión humana.
              </p>
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3">
                <UserCheck className="h-5 w-5 text-violet-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-300"><strong className="text-white">Principio fundamental:</strong> La IA asiste, el humano decide.</p>
              </div>
            </div>

            {/* illustration */}
            <div className="flex justify-center" style={{ animation: 'fadeUp 0.6s ease-out 0.2s both' }}>
              <div className="relative flex h-72 w-72 items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-violet-500/10" style={{ animation: 'pulse-ring 3s ease-out infinite' }} />
                <div className="absolute inset-8 rounded-full border border-violet-500/15" style={{ animation: 'pulse-ring 3s ease-out 1s infinite' }} />
                <div className="absolute inset-16 rounded-full border border-violet-500/20" style={{ animation: 'pulse-ring 3s ease-out 2s infinite' }} />
                <div className="relative flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-2xl shadow-violet-500/30" style={{ animation: 'float 4s ease-in-out infinite' }}>
                  <Brain className="h-16 w-16 text-white" />
                </div>
                <div className="absolute -right-4 top-8 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm" style={{ animation: 'float 3.5s ease-in-out 0.5s infinite' }}>
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-xs font-medium text-white">Supervisión humana</span>
                </div>
                <div className="absolute -left-6 bottom-12 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm" style={{ animation: 'float 4.5s ease-in-out 1s infinite' }}>
                  <Eye className="h-4 w-4 text-violet-400" />
                  <span className="text-xs font-medium text-white">100% trazable</span>
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

        {/* Módulos de IA */}
        <div>
          <ScrollReveal>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-8 text-center">
              Módulos de <span className="text-violet-600">Inteligencia Artificial</span>
            </h2>
          </ScrollReveal>
          <div className="grid gap-6 sm:grid-cols-2">
            {aiModules.map((m, i) => {
              const Icon = m.icon;
              return (
                <ScrollReveal key={m.title} delay={i * 80}>
                  <div className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md h-full">
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${m.gradient} shadow-lg ${m.glow}`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{m.title}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.badgeColor}`}>{m.badge}</span>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-gray-600 mb-4">{m.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {m.tags.map(t => (
                        <span key={t} className="text-xs rounded-full bg-gray-100 px-2.5 py-1 text-gray-500">{t}</span>
                      ))}
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>

        {/* Sí hace / No hace */}
        <ScrollReveal>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Sí hace */}
            <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
              <div className="flex items-center gap-3 mb-5">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <h3 className="text-lg font-bold text-gray-900">Nuestra IA SÍ hace</h3>
              </div>
              <ul className="space-y-3">
                {doesDo.map(d => (
                  <li key={d} className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                    </div>
                    <span className="text-sm text-gray-700">{d}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* No hace */}
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <div className="flex items-center gap-3 mb-5">
                <XCircle className="h-6 w-6 text-red-600" />
                <h3 className="text-lg font-bold text-gray-900">Nuestra IA NO hace</h3>
              </div>
              <ul className="space-y-3">
                {doesNotDo.map(d => (
                  <li key={d} className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-red-100 flex items-center justify-center">
                      <XCircle className="h-3 w-3 text-red-500" />
                    </div>
                    <span className="text-sm text-gray-700">{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollReveal>

        {/* Limitaciones */}
        <div>
          <ScrollReveal>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-8 text-center">
              Limitaciones que <span className="text-violet-600">reconocemos</span>
            </h2>
          </ScrollReveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {limitations.map((l, i) => {
              const Icon = l.icon;
              return (
                <ScrollReveal key={l.title} delay={i * 80}>
                  <div className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <Icon className={`h-6 w-6 flex-shrink-0 mt-0.5 ${l.color}`} />
                    <div>
                      <p className="font-bold text-gray-900">{l.title}</p>
                      <p className="text-sm text-gray-500 mt-1">{l.desc}</p>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>

        {/* Impugnar decisiones */}
        <ScrollReveal>
          <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-violet-950 p-8">
            <div className="flex items-center gap-3 mb-4">
              <ShieldAlert className="h-7 w-7 text-violet-400" />
              <h3 className="text-xl font-bold text-white">Derecho a impugnar decisiones automatizadas</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Si el sistema de IA tomó una decisión incorrecta que le afectó (por ejemplo, no fue reconocido y se le negó el acceso), tiene derecho a solicitar revisión humana inmediata, actualizar su perfil biométrico con una nueva fotografía, o reportar el incidente formalmente.
            </p>
            <a href="mailto:info@whatseg.com" className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-500/30">
              <Mail className="h-4 w-4" /> Reportar: "Revisión decisión IA"
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
