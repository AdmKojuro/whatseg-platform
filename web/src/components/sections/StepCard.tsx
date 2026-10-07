import type { Step } from '../../data/steps';

interface StepCardProps {
  step: Step;
  isLast: boolean;
}

export default function StepCard({ step, isLast }: StepCardProps) {
  return (
    <div className="relative flex flex-1 flex-col items-center text-center">
      {/* Connecting line (horizontal on desktop, vertical on mobile) */}
      {!isLast && (
        <>
          {/* Desktop: horizontal line */}
          <div className="absolute left-[calc(50%+28px)] top-7 hidden h-0.5 w-[calc(100%-56px)] bg-gradient-to-r from-whatsapp/40 to-whatsapp/10 md:block" />
          {/* Mobile: vertical line */}
          <div className="absolute left-1/2 top-[56px] block h-[calc(100%+16px)] w-0.5 -translate-x-1/2 bg-gradient-to-b from-whatsapp/40 to-whatsapp/10 md:hidden" />
        </>
      )}

      {/* Circle with number */}
      <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-xl font-bold text-white shadow-lg shadow-whatsapp/25">
        {step.number}
      </div>

      {/* Text */}
      <h3 className="mt-4 text-lg font-bold text-gray-900">{step.title}</h3>
      <p className="mt-2 max-w-[200px] text-sm leading-relaxed text-gray-600">
        {step.description}
      </p>
    </div>
  );
}
