import { features } from '../../data/features';
import FeatureCard from './FeatureCard';
import ScrollReveal from '../ui/ScrollReveal';

export default function FeaturesSection() {
  return (
    <section id="caracteristicas" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              8 módulos,{' '}
              <span className="text-whatsapp">una sola plataforma</span>
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Todo lo que necesita una comunidad residencial para operar con seguridad,
              integrado y notificado directamente por WhatsApp.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <ScrollReveal key={feature.id} delay={i * 100}>
              <FeatureCard feature={feature} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
