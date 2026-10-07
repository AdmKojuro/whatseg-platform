import { useState, useEffect } from 'react';
import { ArrowRight, ShieldCheck, MapPin, Brain } from 'lucide-react';
import ModulesCarousel from '../ui/ModulesCarousel';
import PhoneMockup from './PhoneMockup';

const badges = [
  { icon: ShieldCheck, label: 'Videoportero con IA' },
  { icon: MapPin, label: 'Rondas GPS en vivo' },
  { icon: Brain, label: 'PTT con Asistente IA' },
];

const audiences = ['Comunidad', 'Hogar', 'Empresa'];

export default function HeroSection() {
  const [tab, setTab] = useState<'modulos' | 'chat'>('modulos');
  const [tabVisible, setTabVisible] = useState(true);
  const [audienceIdx, setAudienceIdx] = useState(0);
  const [audienceFade, setAudienceFade] = useState(true);

  const switchTab = (next: 'modulos' | 'chat') => {
    if (next === tab) return;
    setTabVisible(false);
    setTimeout(() => {
      setTab(next);
      setTabVisible(true);
    }, 180);
  };

  useEffect(() => {
    const id = setInterval(() => {
      setAudienceFade(false);
      setTimeout(() => {
        setAudienceIdx(prev => (prev + 1) % audiences.length);
        setAudienceFade(true);
      }, 300);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-gradient-to-br from-green-50 via-white to-emerald-50 pt-16">
      {/* Decorative elements */}
      <div className="absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-whatsapp/5 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-[400px] w-[400px] translate-x-1/3 translate-y-1/3 rounded-full bg-green-100/50 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col-reverse items-center gap-12 px-4 py-20 sm:px-6 md:flex-row md:py-28 lg:px-8">
        {/* Left: Text */}
        <div className="flex-1 text-center md:text-left">
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-whatsapp/10 px-4 py-2 text-sm font-medium text-whatsapp-dark"
            style={{ animation: 'fadeUp 0.6s ease-out both' }}
          >
            <ShieldCheck className="h-4 w-4" />
            Plataforma de Seguridad Inteligente
          </div>

          <h1
            className="text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl"
            style={{ animation: 'fadeUp 0.6s ease-out 0.1s both' }}
          >
            Seguridad Inteligente<br />para tu{' '}
            <span
              className="text-whatsapp inline-block transition-opacity duration-300"
              style={{ opacity: audienceFade ? 1 : 0 }}
            >
              {audiences[audienceIdx]}
            </span>
          </h1>

          <p
            className="mt-6 max-w-lg text-lg leading-relaxed text-gray-600 md:text-xl"
            style={{ animation: 'fadeUp 0.6s ease-out 0.2s both' }}
          >
            Comunidades residenciales, hogares y empresas de seguridad —
            videoportero, rondas GPS, botón de pánico, PTT con IA y más,
            todo notificado directamente por <strong>WhatsApp</strong>.
          </p>

          {/* Module badges */}
          <div
            className="mt-6 flex flex-wrap justify-center gap-2 md:justify-start"
            style={{ animation: 'fadeUp 0.6s ease-out 0.25s both' }}
          >
            {badges.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-whatsapp/20 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
                <Icon className="h-3.5 w-3.5 text-whatsapp" />
                {label}
              </span>
            ))}
          </div>

          <div
            className="mt-8 flex flex-col items-center gap-4 sm:flex-row md:justify-start"
            style={{ animation: 'fadeUp 0.6s ease-out 0.3s both' }}
          >
            <a
              href="#contacto"
              className="inline-flex items-center gap-2 rounded-full bg-whatsapp px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-whatsapp/25 transition-all hover:bg-whatsapp-dark hover:shadow-xl hover:shadow-whatsapp/30"
            >
              Comenzar Ahora
              <ArrowRight className="h-5 w-5" />
            </a>
            <a
              href="#planes"
              className="inline-flex items-center gap-2 rounded-full border-2 border-gray-300 px-8 py-3.5 text-base font-semibold text-gray-700 transition-all hover:border-whatsapp hover:text-whatsapp"
            >
              Ver Planes
            </a>
          </div>
        </div>

        {/* Right: Dark card with tab switcher */}
        <div
          className="flex flex-1 justify-center"
          style={{ animation: 'fadeUp 0.6s ease-out 0.4s both' }}
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-green-950 shadow-2xl shadow-gray-900/30">
            {/* decorative glows */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-whatsapp/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

            {/* Tabs */}
            <div className="relative flex border-b border-white/10">
              <button
                onClick={() => switchTab('modulos')}
                className={`flex-1 py-3.5 text-sm font-semibold transition-all ${
                  tab === 'modulos'
                    ? 'text-whatsapp'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Módulos
              </button>
              <button
                onClick={() => switchTab('chat')}
                className={`flex-1 py-3.5 text-sm font-semibold transition-all ${
                  tab === 'chat'
                    ? 'text-whatsapp'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Chat Demo
              </button>
              {/* sliding indicator */}
              <div
                className="absolute bottom-0 h-0.5 w-1/2 bg-whatsapp transition-all duration-300"
                style={{ left: tab === 'modulos' ? '0%' : '50%' }}
              />
            </div>

            {/* Content */}
            <div
              className="relative p-6"
              style={{ opacity: tabVisible ? 1 : 0, transition: 'opacity 0.18s ease' }}
            >
              {tab === 'modulos' ? (
                <ModulesCarousel />
              ) : (
                <div className="flex justify-center">
                  <PhoneMockup />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
        >
          <path
            d="M0 60L60 52C120 44 240 28 360 24C480 20 600 28 720 32C840 36 960 36 1080 32C1200 28 1320 20 1380 16L1440 12V60H0Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}
