import { Spinner } from './Spinner';

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

function LoadingOverlay({ message, className = '' }: LoadingOverlayProps) {
  return (
    <div
      className={`absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px] rounded-xl ${className}`}
    >
      <Spinner size="lg" />
      {message && (
        <p className="mt-3 text-sm font-medium text-gray-600">{message}</p>
      )}
    </div>
  );
}

export { LoadingOverlay };
export type { LoadingOverlayProps };
