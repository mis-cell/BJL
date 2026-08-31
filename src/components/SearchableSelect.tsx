import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

export interface OptionItem {
  label: string;
  value: string;
}

interface SearchableSelectProps {
  label?: string;
  name?: string;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | OptionItem | any)[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  isAutoPopulated?: boolean;
  isRequired?: boolean;
  compact?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  name,
  id,
  value,
  onChange,
  options = [],
  placeholder = "SELECT OR TYPE...",
  className = "",
  inputClassName = "",
  disabled = false,
  isAutoPopulated = false,
  isRequired = false,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const generatedId = useRef(`searchable_${label ? label.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'select'}_${Math.random().toString(36).substring(2, 7)}`).current;
  const inputId = id || generatedId;
  const inputName = name || (label ? label.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'searchable_select');

  // Normalize options to { label: string, value: string }
  const normalizedOptions: OptionItem[] = React.useMemo(() => {
    const list: OptionItem[] = [];
    const seen = new Set<string>();

    options.forEach(opt => {
      if (!opt) return;
      let labelStr = '';
      let valStr = '';

      if (typeof opt === 'string') {
        labelStr = opt;
        valStr = opt;
      } else if (typeof opt === 'object') {
        labelStr = opt.label || opt.name || opt.grade_name || opt.agency_name || opt.marka_name || opt.brok_name || opt.supp_name || opt.area_name || opt.value || opt.code || '';
        valStr = opt.value || opt.grade_name || opt.agency_name || opt.marka_name || opt.brok_name || opt.supp_name || opt.area_name || opt.name || opt.code || '';
      }

      const key = valStr.toUpperCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push({ label: labelStr, value: valStr });
      }
    });

    return list;
  }, [options]);

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = normalizedOptions.filter(opt =>
    (opt.label || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (opt.value || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value.toUpperCase();
    setSearchTerm(newVal);
    onChange(newVal);
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleSelectOption = (opt: OptionItem) => {
    setSearchTerm(opt.value);
    onChange(opt.value);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(filteredOptions.length - 1);
      } else {
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        e.preventDefault();
        handleSelectOption(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div className={`flex flex-col ${compact ? 'gap-0' : 'gap-1.5'} relative ${className}`} ref={containerRef}>
      {label && !compact && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 tracking-wide flex items-center gap-1">
          <span>{label}</span>
          {isRequired && <span className="text-rose-600 font-black text-sm">*</span>}
          {isAutoPopulated && (
            <span className="ml-auto text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded border border-sky-300 font-bold uppercase tracking-wider">
              Auto
            </span>
          )}
        </label>
      )}
      <div className="relative w-full">
        <input
          id={inputId}
          name={inputName}
          aria-label={label || placeholder || "Select option"}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => {
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={`w-full uppercase placeholder:normal-case outline-none transition-all pr-7 shadow-2xs ${
            compact
              ? "rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white border border-[#D5D0C5] text-slate-800 focus:border-[#174C2C] focus:ring-1 focus:ring-[#174C2C]/20"
              : isAutoPopulated
              ? "rounded-xl px-3.5 py-2 text-xs font-bold bg-sky-50 border border-sky-300 text-sky-950 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 placeholder:text-sky-400"
              : isRequired
              ? "rounded-xl px-3.5 py-2 text-xs font-semibold bg-white border-2 border-amber-400 text-slate-900 focus:border-amber-600 focus:ring-2 focus:ring-amber-200 placeholder:text-slate-400"
              : "rounded-xl px-3.5 py-2 text-xs font-semibold bg-white border border-[#D5D0C5] text-slate-800 focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 placeholder:text-slate-400"
          } ${inputClassName}`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen);
              setHighlightedIndex(-1);
            }
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#174C2C] p-1 rounded cursor-pointer transition-colors"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#174C2C]' : ''}`} />
        </button>

        {isOpen && (
          <div
            ref={listRef}
            className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-[#D8D3C5] rounded-xl shadow-2xl py-1 text-xs min-w-[180px]"
            style={{ filter: 'drop-shadow(0 10px 15px rgba(0, 0, 0, 0.15))' }}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value.toUpperCase() === (value || '').toUpperCase();
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={idx}
                    onMouseDown={(e) => {
                      // prevent input blur before select
                      e.preventDefault();
                      handleSelectOption(opt);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-1.5 cursor-pointer flex items-center justify-between font-medium transition-colors ${
                      isSelected
                        ? 'bg-[#174C2C]/10 text-[#174C2C] font-bold'
                        : isHighlighted
                        ? 'bg-[#F2F7F4] text-[#174C2C] font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="uppercase">{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-[#174C2C] shrink-0 ml-2" />}
                  </div>
                );
              })
            ) : (
              <div className="px-3.5 py-2 text-slate-400 italic text-center">
                No matching options
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchableSelect;

