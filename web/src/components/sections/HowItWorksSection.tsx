import { steps } from '../../data/steps';
import StepCard from './StepCard';
import ScrollReveal from '../ui/ScrollReveal';

export default function HowItWorksSection() {
  return (
    <section
      id="como-funciona"
      className="bg-gradient-to-b from-white to-gray-50 py-20 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              ¿Cómo <span className="text-whatsapp">funciona</span>?
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              En solo 4 pasos tendrás tu hogar protegido y controlado desde
              WhatsApp.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <div className="mt-16 flex flex-col gap-12 md:flex-row md:gap-4">
            {steps.map((step) => (
              <StepCard
                key={step.number}
                step={step}
                isLast={step.number === steps.length}
              />
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
