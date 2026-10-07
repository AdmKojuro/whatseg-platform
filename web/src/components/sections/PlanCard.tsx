import { Check, ExternalLink } from 'lucide-react';
import type { Plan } from '../../data/plans';

interface PlanCardProps {
  plan: Plan;
}

export default function PlanCard({ plan }: PlanCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
        plan.popular
          ? 'border-whatsapp shadow-md shadow-whatsapp/10'
          : 'border-gray-100'
      }`}
    >
      {/* Popular badge */}
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-whatsapp px-4 py-1 text-xs font-bold text-white shadow-md">
          Popular
        </div>
      )}

      {/* Plan info */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
      </div>

      {/* Features */}
      <ul className="mb-8 flex-1 space-y-3">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-whatsapp" />
            <span className="text-sm text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <a
        href={plan.whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all ${
          plan.popular
            ? 'bg-whatsapp text-white shadow-lg shadow-whatsapp/25 hover:bg-whatsapp-dark hover:shadow-xl'
            : 'bg-gray-100 text-gray-800 hover:bg-whatsapp hover:text-white'
        }`}
      >
        Elegir Plan
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
