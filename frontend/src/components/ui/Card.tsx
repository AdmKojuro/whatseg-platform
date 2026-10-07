import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  actions?: ReactNode;
}

function Card({ children, className = '', title, actions }: CardProps) {
  return (
    <div
      className={`bg-gray-800 rounded-xl border border-gray-700 shadow-sm ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          {title && (
            <h3 className="text-base font-semibold text-white">{title}</h3>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}

export { Card };
export type { CardProps };
