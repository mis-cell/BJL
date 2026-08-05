import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SearchableSelectProps {
  label?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = "SELECT OR TYPE...",
  className = "",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    (opt || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value.toUpperCase();
    setSearchTerm(newVal);
    onChange(newVal);
    setIsOpen(true);
  };

  const handleSelectOption = (opt: string) => {
    setSearchTerm(opt);
    onChange(opt);
    setIsOpen(false);
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label className="text-xs font-semibold text-slate-700 tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-white border border-[#D5D0C5] focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 rounded-xl px-3.5 py-2 text-xs font-semibold uppercase text-slate-800 placeholder:text-slate-400 placeholder:normal-case outline-none transition-all pr-8 shadow-2xs"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#174C2C] p-0.5 rounded cursor-pointer"
        >
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && filteredOptions.length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-[#E0DBCF] rounded-xl shadow-xl py-1 text-xs">
            {filteredOptions.map((opt, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectOption(opt)}
                className={`px-3.5 py-2 cursor-pointer flex items-center justify-between font-medium hover:bg-[#F2F7F4] hover:text-[#174C2C] transition-colors ${
                  opt === value ? 'bg-[#174C2C]/10 text-[#174C2C] font-bold' : 'text-slate-700'
                }`}
              >
                <span className="uppercase">{opt}</span>
                {opt === value && <Check className="h-3.5 w-3.5 text-[#174C2C]" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchableSelect;
