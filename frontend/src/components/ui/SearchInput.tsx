import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

function SearchInput({
  value: controlledValue,
  onChange,
  placeholder = 'Buscar...',
  debounceMs = 300,
  className = '',
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const isControlled = controlledValue !== undefined;

  const displayValue = isControlled ? controlledValue : internalValue;

  useEffect(() => {
    if (isControlled) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue, isControlled]);

  const debouncedOnChange = useCallback(
    (val: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onChange(val);
      }, debounceMs);
    },
    [onChange, debounceMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalValue(val);
    debouncedOnChange(val);
  };

  const handleClear = () => {
    setInternalValue('');
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange('');
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-gray-700 pl-9 pr-9 py-2 text-sm text-white placeholder-gray-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-brand-400 focus:ring-brand-400/30"
      />
      {displayValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded transition-colors cursor-pointer"
          aria-label="Limpiar busqueda"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export { SearchInput };
export type { SearchInputProps };
