import { faq } from '../../data/faq';
import FaqItem from './FaqItem';
import ScrollReveal from '../ui/ScrollReveal';

export default function FaqSection() {
  return (
    <section
      id="preguntas"
      className="bg-gradient-to-b from-white to-gray-50 py-20 lg:py-28"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Preguntas{' '}
              <span className="text-whatsapp">Frecuentes</span>
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Resolvemos tus dudas sobre nuestro sistema de seguridad.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <div className="mt-12">
            {faq.map((item, i) => (
              <FaqItem key={i} item={item} />
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
