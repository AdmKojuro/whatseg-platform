import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import type { FaqItem as FaqItemType } from '../../data/faq';

interface FaqItemProps {
  item: FaqItemType;
}

export default function FaqItem({ item }: FaqItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-whatsapp"
      >
        <span className="text-base font-semibold text-gray-900 sm:text-lg">
          {item.question}
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors group-hover:bg-whatsapp/10">
          {isOpen ? (
            <Minus className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </span>
      </button>
      <div
        className="grid transition-all duration-300 ease-in-out"
        style={{
          gridTemplateRows: isOpen ? '1fr' : '0fr',
        }}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-sm leading-relaxed text-gray-600 sm:text-base">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}
