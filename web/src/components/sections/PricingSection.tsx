import { plans } from '../../data/plans';
import PlanCard from './PlanCard';
import ScrollReveal from '../ui/ScrollReveal';

export default function PricingSection() {
  return (
    <section id="planes" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Nuestros <span className="text-whatsapp">Planes</span>
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Elige el plan que mejor se adapte a tus necesidades. Contáctanos para conocer el precio según tu comunidad.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, i) => (
            <ScrollReveal key={plan.id} delay={i * 100}>
              <PlanCard plan={plan} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
