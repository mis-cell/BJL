import React, { useState, useEffect, useRef } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import { 
  X, 
  ChevronDown, 
  Search, 
  Calculator,
  Save,
  Trash2,
  Edit,
  Plus,
  FileText,
  Printer,
  History,
  Image as ImageIcon,
  ShieldCheck,
  ClipboardList,
  ArrowLeft,
  RefreshCcw,
  Filter,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  HandCoins,
  Download,
  CheckCircle2,
  Clock,
  Mail,
  Truck,
  Users
} from 'lucide-react';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import { dbModule } from '../services/dbModule';
import { supabase } from '../lib/supabase';
import { cn, sanitizeCsvData, getApiUrl, canDeleteData } from '../lib/utils';
import { comparePoInspection, PoMatchResult } from '../lib/poMatch';
import { calculateWeightTolerance, WeightToleranceResult } from '../lib/weightTolerance';
import PoPrintSlip from '../components/PoPrintSlip';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { enforceEditOrDeletePermission, canEditOrDelete, canViewCompletedData, getCurrentUserContext } from '../lib/permissions';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from 'recharts';

interface AreaDifferential {
  area: string;
  diffs: Record<string, number>;
}

const EXCEL_SEED_DATA: AreaDifferential[] = [
  {
    area: "DAISEE",
    diffs: { TD4: 600, TD5: -300, TD6: -200, TD7: -500, TD8: -1000, "H.BALES": -50, DRUMS: -100 }
  },
  {
    area: "TULSIHATTA",
    diffs: { TD5: 750, TD6: 350, TD7: -50, TD8: -550 }
  },
  {
    area: "BANGLADESH",
    diffs: { "BTR HD KS": 2800, "BTR HD CS": 2300, "BTR HD BS": 1800, "BTR NB KS": 800, "BTR NB FFS": 1300, "BTR NB (SMR)": 200 }
  },
  {
    area: "GRP LOOSE",
    diffs: { TD5: 400, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "L/A TARABARI",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100 }
  },
  {
    area: "U/ASSAM",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100, LOOSE: -200 }
  },
  {
    area: "KANKI",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "RAIGANJ",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "DHULIYAAN",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "SAMSI JUNGLE",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "RAIGANJ Loose",
    diffs: { TD5: 400, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "NORTHERN",
    diffs: { TD6: 3200, TD7: 2800, TD8: 2300, TD9: 1800, TD10: 1300, W5: 1800, W6: 1300 }
  },
  {
    area: "GAJAL LOOSE",
    diffs: {}
  },
  {
    area: "BADURIA",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "BASIRHAT",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "GOLABRI D/D",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "HARIPAL",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "MAYNA D/S",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "S/N ISLAMPUR",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "SHEORAPHULLY",
    diffs: { HBJB: -1000, ROPES: -1000, CUTTING: -700, "TH.WASTE": -10000, "RRY CUTT": -12000 }
  },
  {
    area: "GRP MESTA LOOSE",
    diffs: { "M.S.MID": -500, "M.MID": -600, "M.BOT": -700, "M.B.BOT": -800, "M.X.BOT": -900 }
  },
  {
    area: "PURNEA(BIHAR)",
    diffs: { TD5: 500, TD6: 100, TD7: -300, TD8: -800 }
  },
  {
    area: "ASSAM",
    diffs: { "M.MID": -2000, BOT: -2100, "B.BOT": -2200, "X.X.BOT": -2350, "X.BOT": -2300 }
  },
  {
    area: "S/N MESTA",
    diffs: { "M.MID": -2000, BOT: -2100, "B.BOT": -2200, "X.BOT": -2300 }
  }
];

const SingleComboBox = ({
  value,
  onChange,
  options,
  textField,
  valueField
}: {
  value: string,
  onChange: (val: string) => void,
  options: any[];
  textField: string;
  valueField: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setFilter(value), [value]);

  const filtered = options.filter(o => {
    if (!filter || filter === value) return true;
    return String(o[textField]||'').toLowerCase().includes(filter.toLowerCase());
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex-1 flex border border-slate-400 bg-white relative text-black">
      <input  id="filter_192" name="filter" aria-label="filter"
        className="flex-1 p-0.5 outline-none font-bold text-black bg-white" 
        value={filter} 
        onChange={e => {
          setFilter(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => setIsOpen(true)}
      />
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)} 
        className="bg-slate-100 border-l border-slate-400 px-1 hover:bg-slate-200"
        tabIndex={-1}
      >
        <ChevronDown className="h-4 w-4 text-black" />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border border-slate-400 shadow-xl z-[100] max-h-48 overflow-y-auto mt-0.5 text-black">
          {filtered.length > 0 ? filtered.map((opt, i) => (
             <div 
               key={i} 
               className="p-1 px-2 hover:bg-blue-600 hover:text-white cursor-pointer text-[10px] font-normal"
               onMouseDown={(e) => {
                 e.preventDefault(); // prevent input blur
                 onChange(opt[valueField]);
                 setIsOpen(false);
               }}
             >
               {opt[textField]}
             </div>
          )) : <div className="p-1 px-2 text-slate-500 italic text-[10px]">No results found</div>}
        </div>
      )}
    </div>
  );
}

const SearchablePoContractDropdown = ({
  value,
  onChange,
  options,
  disabled = false,
  hasSaudaHighlight = false,
  placeholder = "SEARCH P.O CONTRACT...",
  id = "p_o_contract_searchable"
}: {
  value: string;
  onChange: (val: string) => void;
  options: any[];
  disabled?: boolean;
  hasSaudaHighlight?: boolean;
  placeholder?: string;
  id?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep display synchronized when dropdown is closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(value || '');
      setHighlightIndex(-1);
    }
  }, [value, isOpen]);

  const filteredOptions = React.useMemo(() => {
    if (!isOpen) return options;
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) return options;

    return options.filter((opt: any) => {
      const poDisplay = String(opt.po_display_no || '').toLowerCase();
      const saudaNo = String(opt.sauda_no || '').toLowerCase();
      const session = String(opt.session || '').toLowerCase();
      const supplier = String(opt.supplier || '').toLowerCase();
      const broker = String(opt.broker || '').toLowerCase();
      const area = String(opt.area || '').toLowerCase();
      const date = String(opt.date || '').toLowerCase();
      return (
        poDisplay.includes(term) ||
        saudaNo.includes(term) ||
        session.includes(term) ||
        supplier.includes(term) ||
        broker.includes(term) ||
        area.includes(term) ||
        date.includes(term)
      );
    });
  }, [options, searchTerm, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(value || '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [value]);

  const handleSelect = (item: any) => {
    const selectedVal = item.po_display_no || item.sauda_no || item.session || '';
    onChange(selectedVal);
    setSearchTerm(selectedVal);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightIndex(0);
      } else {
        setHighlightIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setHighlightIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightIndex >= 0 && filteredOptions[highlightIndex]) {
        handleSelect(filteredOptions[highlightIndex]);
      } else if (isOpen && filteredOptions.length > 0) {
        handleSelect(filteredOptions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm(value || '');
    }
  };

  return (
    <div ref={containerRef} className="flex-1 relative text-black min-w-[130px]">
      <div className={`flex items-center border transition-colors duration-150 ${
        disabled
          ? 'bg-slate-100 border-slate-300'
          : hasSaudaHighlight
            ? 'border-amber-400 bg-[#fffdf5]'
            : isOpen
              ? 'border-blue-600 bg-white ring-1 ring-blue-400/30'
              : 'border-slate-400 bg-white'
      }`}>
        <input
          id={id}
          ref={inputRef}
          name="p_o_contract_search"
          aria-label="P.O Contract Searchable Dropdown"
          type="text"
          disabled={disabled}
          className={`flex-1 p-0.5 px-1 outline-none font-bold text-[11px] bg-transparent ${
            disabled ? 'text-slate-400' : 'text-black'
          }`}
          value={isOpen ? searchTerm : value}
          onChange={(e) => {
            const val = e.target.value;
            setSearchTerm(val);
            setHighlightIndex(0);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
              setSearchTerm('');
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={value || placeholder}
        />

        {value && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setSearchTerm('');
              inputRef.current?.focus();
            }}
            className="p-0.5 text-slate-400 hover:text-red-600 cursor-pointer"
            title="Clear Selection"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              if (isOpen) {
                setIsOpen(false);
                setSearchTerm(value || '');
              } else {
                setIsOpen(true);
                setSearchTerm('');
                inputRef.current?.focus();
              }
            }
          }}
          className={`px-1 py-1 border-l text-slate-600 hover:text-black cursor-pointer transition-colors ${
            hasSaudaHighlight
              ? 'bg-amber-100/70 border-amber-400 hover:bg-amber-200'
              : 'bg-slate-100 border-slate-400 hover:bg-slate-200'
          }`}
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 sm:right-auto right-0 min-w-[280px] sm:min-w-[360px] max-w-[460px] bg-white border border-slate-400 shadow-2xl z-[9999] mt-0.5 overflow-hidden text-black text-left rounded-none">
          <div className="bg-slate-100 border-b border-slate-300 px-2 py-1 flex items-center justify-between text-[10px] text-slate-700">
            <span className="font-bold flex items-center gap-1">
              <Search className="w-3 h-3 text-slate-500" />
              {searchTerm ? `Filtering: "${searchTerm}"` : 'Select Contract / Sauda'}
            </span>
            <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-slate-800">
              {filteredOptions.length} Found
            </span>
          </div>

          <div className="overflow-y-auto max-h-56 divide-y divide-slate-200">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt: any, idx: number) => {
                const poNo = opt.po_display_no || opt.sauda_no || opt.session;
                const isSelected = value && (value === poNo || value === opt.sauda_no || value === opt.session);
                const isHighlighted = highlightIndex === idx;

                return (
                  <div
                    key={idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(opt);
                    }}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`p-1.5 px-2 cursor-pointer transition-colors text-[10px] ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-950 border-l-4 border-emerald-600 font-semibold'
                        : isHighlighted
                          ? 'bg-blue-600 text-white font-medium'
                          : 'hover:bg-blue-50 hover:text-blue-900 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-bold text-[11px]">
                        {poNo}
                      </span>
                      {opt.date && (
                        <span className={`text-[9px] font-mono ${isHighlighted && !isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                          {opt.date}
                        </span>
                      )}
                    </div>

                    {(opt.supplier || opt.broker || opt.area) && (
                      <div className={`flex flex-wrap items-center gap-1.5 mt-0.5 text-[9px] ${
                        isHighlighted && !isSelected ? 'text-blue-100' : 'text-slate-600'
                      }`}>
                        {opt.supplier && (
                          <span className={`font-semibold ${isHighlighted && !isSelected ? 'text-white' : 'text-slate-900'}`}>
                            Supp: {opt.supplier}
                          </span>
                        )}
                        {opt.broker && (
                          <span className={`${isHighlighted && !isSelected ? 'bg-blue-700/60 text-white' : 'bg-slate-100 text-slate-600'} px-1 py-0.2 rounded`}>
                            Brk: {opt.broker}
                          </span>
                        )}
                        {opt.area && (
                          <span className={`${isHighlighted && !isSelected ? 'bg-blue-800/80 text-amber-200' : 'bg-amber-50 text-amber-900'} px-1 py-0.2 rounded font-semibold`}>
                            {opt.area}
                          </span>
                        )}
                        {opt.total_wt_in_ton && (
                          <span className={`ml-auto font-mono font-bold ${isHighlighted && !isSelected ? 'text-white' : 'text-blue-900'}`}>
                            {opt.total_wt_in_ton} MT
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-3 text-center text-slate-500 text-[10px]">
                <p className="font-bold">No matching P.O contracts</p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  Check the sauda number or supplier name.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TableComboBox = ({
  value,
  onChange,
  options,
  textField,
  valueField,
  placeholder = ""
}: {
  value: string;
  onChange: (val: string) => void;
  options: any[];
  textField: string;
  valueField: string;
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFilter(value || '');
  }, [value]);

  const filtered = options.filter(opt => {
    if (!filter) return true;
    return String(opt[textField] || '').toLowerCase().includes(filter.toLowerCase()) ||
           String(opt[valueField] || '').toLowerCase().includes(filter.toLowerCase());
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center text-black">
      <input
 id="filter_273" name="filter" aria-label="filter"        type="text"
        className="w-full bg-transparent border-none p-1 outline-none font-bold text-slate-800 uppercase pr-5"
        value={filter}
        placeholder={placeholder}
        onChange={(e) => {
          const upperVal = e.target.value.toUpperCase();
          setFilter(upperVal);
          onChange(upperVal);
        }}
        onFocus={() => setIsOpen(true)}
      />
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="absolute right-1 text-slate-500 hover:text-slate-800"
        tabIndex={-1}
      >
        <ChevronDown className="h-3 w-3" />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border border-slate-400 shadow-xl z-[150] max-h-40 overflow-y-auto mt-0.5 text-left font-normal">
          {filtered.length > 0 ? filtered.map((opt, i) => (
            <div
              key={i}
              className="p-1 px-2 hover:bg-blue-600 hover:text-white cursor-pointer text-[10px] uppercase font-semibold"
              onMouseDown={(e) => {
                e.preventDefault();
                const clickedVal = String(opt[textField] || '').toUpperCase();
                onChange(clickedVal);
                setIsOpen(false);
              }}
            >
              {String(opt[textField]).toUpperCase()}
            </div>
          )) : (
            <div className="p-1 px-2 text-slate-500 italic text-[10px]">No results found</div>
          )}
        </div>
      )}
    </div>
  );
};

const DualComboBox = ({
  code,
  name,
  onCodeChange,
  onNameChange,
  options,
  codeField,
  nameField,
  showCode = true,
  hasSaudaHighlight = false
}: {
  code: string,
  name: string,
  onCodeChange: (val: string) => void,
  onNameChange: (val: string) => void,
  options: any[];
  codeField: string;
  nameField: string;
  showCode?: boolean;
  hasSaudaHighlight?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState(name ? name.toUpperCase() : '');
  const [hasModified, setHasModified] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const upperName = (name || '').toUpperCase();
    const upperFilter = (filter || '').toUpperCase();
    if (upperName !== upperFilter) {
      setFilter(upperName);
      setHasModified(false);
    }
  }, [name]);

  const filtered = options.filter(opt => {
     if (!hasModified || !filter) return true;
     return (
       String(opt[nameField] || '').toLowerCase().includes(filter.toLowerCase()) ||
       String(opt[codeField] || '').toLowerCase().includes(filter.toLowerCase())
     );
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex-1 flex gap-1 relative text-black">
      {showCode && (
        <input  id="code_375" name="code" aria-label="code"
          className={`w-16 p-0.5 outline-none border transition-colors duration-150 ${
            hasSaudaHighlight 
              ? "bg-[#fffbeb] border-amber-400 text-amber-950 font-medium font-mono" 
              : "bg-white border-slate-400 text-slate-800"
          }`} 
          value={code} 
          onChange={(e) => {
            const upperCode = e.target.value.toUpperCase();
            onCodeChange(upperCode);
          }}
        />
      )}
      <div className={`flex-1 flex border transition-colors duration-200 ${
        hasSaudaHighlight 
          ? "border-amber-400 bg-[#fffdf5]" 
          : "border-slate-400 bg-white"
      }`}>
        <input  id="filter_393" name="filter" aria-label="filter"
          className="flex-1 p-0.5 outline-none text-left bg-transparent uppercase font-semibold" 
          value={filter} 
          onChange={(e) => {
            const upperVal = e.target.value.toUpperCase();
            setFilter(upperVal);
            setHasModified(true);
            onNameChange(upperVal);
            const exact = options.find(o => String(o[nameField]).toLowerCase() === upperVal.toLowerCase());
            if (exact) onCodeChange(exact[codeField]);
            else onCodeChange('');
          }}
          onFocus={() => {
            setIsOpen(true);
            setHasModified(false);
          }}
        />
        <button 
          type="button" 
          onClick={() => {
            setIsOpen(!isOpen);
            setHasModified(false);
          }} 
          className={`border-l transition-colors duration-150 px-1 ${
            hasSaudaHighlight 
              ? "bg-amber-100/60 border-amber-400 text-amber-700 hover:bg-amber-200/60" 
              : "bg-slate-100 border-slate-400 hover:bg-slate-200"
          }`}
          tabIndex={-1}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {isOpen && (
        <div className={`absolute top-full ${showCode ? 'left-16' : 'left-0'} right-0 bg-white border border-slate-400 shadow-xl z-[100] max-h-48 overflow-y-auto mt-0.5`}>
          {filtered.length > 0 ? filtered.map((opt, i) => (
             <div 
               key={i} 
               className="p-1 px-2 hover:bg-blue-600 hover:text-white cursor-pointer text-[10px] uppercase font-semibold"
               onMouseDown={(e) => {
                 e.preventDefault(); // prevent input blur
                 const clickedValue = String(opt[nameField] || '').toUpperCase();
                 onNameChange(clickedValue);
                 onCodeChange(opt[codeField]);
                 setHasModified(false);
                 setIsOpen(false);
               }}
             >
               {String(opt[nameField]).toUpperCase()}
             </div>
          )) : <div className="p-1 px-2 text-slate-500 italic text-[10px]">No results found</div>}
        </div>
      )}
    </div>
  );
}

const formatPoNumber = (sauda: any) => {
  if (!sauda) return '';
  if (sauda.session && sauda.session.trim()) {
    const s = sauda.session.trim();
    const parts = s.split('/').filter(Boolean);
    if (parts.length >= 3) {
      return s;
    }
    const base = s.endsWith('/') ? s : s + '/';
    return `${base}${sauda.sauda_no || ''}`;
  }
  const numPart = parseInt(sauda.sauda_no, 10);
  const val = isNaN(numPart) ? sauda.sauda_no : numPart;
  
  // Format the year suffix
  let yearPart = '26'; // fallback
  if (sauda.financial_year) {
    const startYear = sauda.financial_year.split('-')[0].trim();
    if (startYear.length >= 4) {
      yearPart = startYear.slice(-2);
    } else if (startYear.length === 2) {
      yearPart = startYear;
    }
  } else if (sauda.session && sauda.session.includes('/')) {
    const parts = sauda.session.split('/');
    if (parts.length > 1) {
      const yr = parts[1].split('-')[0].trim();
      if (yr.length >= 4) yearPart = yr.slice(-2);
    }
  }
  return `BJCL${val}/${yearPart}`;
};

const compareQualities = (aStr: string, bStr: string): number => {
  const clean = (val: string) => {
    return String(val || '')
      .trim()
      .replace(/\.$/, '') // strip trailing dot
      .replace(/\s+/g, '') // strip all spaces
      .toUpperCase();
  };

  const a = clean(aStr);
  const b = clean(bStr);

  if (!a && !b) return 0;
  if (!a) return 1; // empty to the end
  if (!b) return -1;

  const PREDEFINED_RANKS: Record<string, number> = {
    'TD1': 10, 'TD2': 20, 'TD3': 30, 'TD4': 40, 'TD5': 50, 'TD6': 60, 'TD7': 70, 'TD8': 80,
    'W1': 110, 'W2': 120, 'W3': 130, 'W4': 140, 'W5': 150, 'W6': 160, 'W7': 170, 'W8': 180,
    'M1': 210, 'M2': 220, 'M3': 230, 'M4': 240, 'M5': 250, 'M6': 260, 'M7': 270, 'M8': 280,
    'BTC': 310, 'BTR': 320,
    'STANDARD GRADE': 1000, 'NORMAL GRADE': 1010
  };

  const rankA = PREDEFINED_RANKS[a];
  const rankB = PREDEFINED_RANKS[b];

  if (rankA !== undefined && rankB !== undefined) {
    return rankA - rankB;
  }
  if (rankA !== undefined) return -1;
  if (rankB !== undefined) return 1;

  const regex = /^([A-Z]+)(\d+)(.*)$/;
  const matchA = a.match(regex);
  const matchB = b.match(regex);

  if (matchA && matchB) {
    const prefixA = matchA[1];
    const numA = parseInt(matchA[2], 10);
    const prefixB = matchB[1];
    const numB = parseInt(matchB[2], 10);

    if (prefixA === prefixB) {
      return numA - numB;
    }
    return prefixA.localeCompare(prefixB);
  }

  return a.localeCompare(b);
};

// Helper to generate a high-fidelity retro HTML email representation of a Purchase Order
const generatePoHtmlEmail = (po: any) => {
  const detailRows = (po.items || []).map((q: any, idx: number) => `
    <tr style="height: 24px;">
      <td style="border: 1px solid #000; text-align: center; padding: 4px; font-size: 11px;">${idx + 1}</td>
      <td style="border: 1px solid #000; padding: 4px; font-size: 11px; font-weight: bold;">${q.crop || ''}</td>
      <td style="border: 1px solid #000; padding: 4px; font-size: 11px; font-weight: bold;">${q.grade_name || ''}</td>
      <td style="border: 1px solid #000; padding: 4px; font-size: 11px;">${q.agency_name || ''}</td>
      <td style="border: 1px solid #000; padding: 4px; font-size: 11px;">${q.marka_name || ''}</td>
      <td style="border: 1px solid #000; text-align: right; padding: 4px; font-size: 11px; font-weight: bold;">${(q.qty || 0).toLocaleString()}</td>
      <td style="border: 1px solid #000; text-align: right; padding: 4px; font-size: 11px; font-weight: bold;">${(q.weight || 0).toFixed(2)} MT</td>
      <td style="border: 1px solid #000; text-align: right; padding: 4px; font-size: 11px; font-weight: bold;">&#8377;${(q.rate || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: 'Courier New', Courier, monospace; max-width: 750px; border: 2px solid #000; padding: 20px; background-color: #ffffff; color: #111;">
      <div style="font-size: 18px; font-weight: bold; text-align: center; text-transform: uppercase; color: #024a68;">Bally Jute Company Limited</div>
      <div style="font-size: 11px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; font-weight: bold; color: #555;">
        REGISTERED OFFICE: 5, SREE CHARAN SARANI, BALLY, HOWRAH - 711201
      </div>
      
      <div style="text-align: center; font-size: 14px; font-weight: bold; text-decoration: underline; margin-bottom: 12px; color: #024a68; text-transform: uppercase;">
        ${po.is_ptf ? "PTF COMPILER SLIP" : "PURCHASE ORDER SLIP"}
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px;">
        <tr>
          <td style="width: 50%;"><strong>P.O. NO:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 150px;">&nbsp;${po.no || ''}</span></td>
          <td style="width: 50%; text-align: right;"><strong>PTF NO:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 150px; text-align: left;">&nbsp;${po.ptf_no || 'N/A'}</span></td>
        </tr>
        <tr>
          <td><strong>P.O. DATE:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 150px;">&nbsp;${po.date ? new Date(po.date).toLocaleDateString('en-GB') : ''}</span></td>
          <td style="text-align: right;"><strong>DI NO:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 150px; text-align: left;">&nbsp;${po.contract_po_no || 'N/A'}</span></td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 0; margin-bottom: 12px; font-size: 12px;">
        <tr>
          <td style="width: 130px; padding: 4px 0;"><strong>BROKER / VYAPARI:</strong></td>
          <td style="padding: 4px 0;"><span style="border-bottom: 1px dotted #000; display: block; width: 100%;">&nbsp;${po.broker || ''}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>SUPPLIER:</strong></td>
          <td style="padding: 4px 0;"><span style="border-bottom: 1px dotted #000; display: block; width: 100%;">&nbsp;${po.supplier || ''}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>CHALLAN SUPPLIER:</strong></td>
          <td style="padding: 4px 0;"><span style="border-bottom: 1px dotted #000; display: block; width: 100%;">&nbsp;${po.challan_supplier || ''}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>AREA / CENTER:</strong></td>
          <td style="padding: 4px 0;"><span style="border-bottom: 1px dotted #000; display: block; width: 100%;">&nbsp;${po.area || ''}</span></td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px;">
        <tr>
          <td style="width: 33%; padding: 4px 0;"><strong>TOTAL LORRIES:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${po.total_no_of_lorries || 0}</span></td>
          <td style="width: 33%; padding: 4px 0;"><strong>UNITS/LORRY:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${po.units_per_lorry || 'BALES'}</span></td>
          <td style="width: 34%; padding: 4px 0;"><strong>TOTAL UNITS:</strong> <span style="border-bottom: 1px dotted #000; font-weight: bold;">&nbsp;${po.total_units || 0}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>WT/LORRY (MT):</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${po.weight_per_lorry || 10.28}</span></td>
          <td style="padding: 4px 0;"><strong>TRANS PAID BY:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${po.trans_paid_by || 'PARTY'}</span></td>
          <td style="padding: 4px 0;"><strong>TOTAL WT (MT):</strong> <span style="border-bottom: 1px dotted #000; font-weight: bold;">&nbsp;${po.total_contract_mt || 0}</span></td>
        </tr>
      </table>

      <div style="font-size: 12px; font-weight: bold; margin-bottom: 6px; text-decoration: underline; color: #024a68;">PURCHASE SPECIFICATION & RATE DETAILS:</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #000; padding: 4px; text-align: center; width: 40px;">SL.</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: left;">CROP YEAR</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: left;">GRADE/QUALITY</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: left; width: 120px;">AGENCY</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: left; width: 120px;">MARKA</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: right; width: 80px;">QTY (BALES)</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: right; width: 90px;">WT (MT)</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: right; width: 100px;">RATE (&#8377;/Qtl)</th>
          </tr>
        </thead>
        <tbody>
          ${detailRows}
        </tbody>
      </table>

      <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #000; padding-top: 8px; margin-bottom: 12px; font-size: 11px;">
        <tr>
          <td style="width: 50%; padding: 4px 0;"><strong>DELIVERY FROM:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${po.delivery_from || ''}</span></td>
          <td style="width: 50%; padding: 4px 0;"><strong>DELIVERY TO:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${po.delivery_to || ''}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>GRACE DAYS:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${po.grace_days || 0} Days</span></td>
          <td style="padding: 4px 0;"><strong>DELIVERY PENALTY:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;&#8377;${po.delivery_penalty || 0}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>CONTRACT DATE:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${po.contract_date || ''}</span></td>
          <td style="padding: 4px 0;"><strong>IDENTIFICATION:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${po.po_identification || ''}</span></td>
        </tr>
      </table>

      <div style="font-size: 11px; margin-top: 10px;">
        <strong>TERMS & CONDITIONS:</strong><br/>
        <div style="border: 1px dashed #555; padding: 6px; min-height: 35px; margin-top: 4px; font-size: 10px; line-height: 1.3; background-color: #fafafa; margin-bottom: 8px;">
          ${po.terms_condition || 'Standard penalty Rs.5/day. Standard terms apply.'}
        </div>
        <strong>REMARKS:</strong><br/>
        <div style="border: 1px dashed #555; padding: 6px; min-height: 35px; margin-top: 4px; font-size: 10px; line-height: 1.3; background-color: #fafafa;">
          ${po.remarks || 'No specific remarks recorded.'}
        </div>
      </div>
    </div>
  `;
};

export default function PurchaseOrder({ onClose, selectedYear, isTempPo = false, finalStage = false, isArchiveView = false }: { onClose?: () => void; selectedYear?: string; isTempPo?: boolean; finalStage?: boolean; isArchiveView?: boolean }) {
  // Separate table architecture based on user specification:
  // Sauda Check Point (isTempPo) uses 'sauda_check_point' & 'sauda_check_point_details'
  // Final P.O uses 'purchase_master' & 'purchase_detail_master'
  const MASTER_TABLE = isArchiveView ? 'p.o_archive' : (isTempPo ? 'sauda_check_point' : 'purchase_master');
  const DETAIL_TABLE = isArchiveView ? 'po_archive' : (isTempPo ? 'sauda_check_point_details' : 'purchase_detail_master');

  const poFormRef = useRef<HTMLDivElement>(null);
  useKeyboardNavigation(poFormRef, () => {
    handleSave();
  });

  const getCropYear = () => {
    if (selectedYear) {
      if (selectedYear.includes('-')) {
        const parts = selectedYear.split('-');
        if (parts.length === 2 && parts[1].length === 4) {
          return `${parts[0]}-${parts[1].substring(2)}`;
        }
      }
      return selectedYear;
    }
    return '2026-27';
  };
  const todayStr = new Date().toISOString().split('T')[0];

  const handleCsvDownload = async () => {
    try {
      if (!supabase) {
        alert("Database connection client is not loaded.");
        return;
      }
      setLoading(true);

      // Fetch item details for complete CSV export
      let detailData: any[] = [];
      try {
        const { data } = await supabase.from(DETAIL_TABLE).select('*');
        detailData = data || [];
      } catch (e) {
        console.warn("Failed to fetch detail table for CSV:", e);
      }

      const detailsByPo: Record<string, any[]> = {};
      detailData.forEach((d: any) => {
        const key = String(d.po_no || '').trim().toUpperCase();
        if (!key) return;
        if (!detailsByPo[key]) detailsByPo[key] = [];
        detailsByPo[key].push(d);
      });

      const listToExport = scopedPos.length > 0 ? scopedPos : (sectionPos.length > 0 ? sectionPos : poList);

      if (!listToExport || listToExport.length === 0) {
        alert("No Purchase Orders found matching current view to export.");
        return;
      }

      // Map raw columns to customer-friendly headers with correct DB field names
      const dataToExport = listToExport.map((row: any) => {
        const poKey = String(row.po_no || '').trim().toUpperCase();
        const poDetails = detailsByPo[poKey] || [];

        const gradeItemDetails = poDetails.map((d: any) => {
          const gName = gradeList.find((g: any) => g.grade_code === d.grade_code)?.grade_name || d.grade_name || d.grade_code || '';
          const qty = d.quantity ? `${d.quantity} Units` : '';
          const wt = d.weight_mt ? `${Number(d.weight_mt).toFixed(3)} MT` : '';
          const rate = d.rate_qntl ? `@ Rs.${d.rate_qntl}` : '';
          return [gName, qty, wt, rate].filter(Boolean).join(' ');
        }).join(' | ');

        const rawPoDate = row.po_date || row.date;
        const formattedPoDate = rawPoDate ? new Date(rawPoDate).toLocaleDateString('en-GB') : '';
        const rawSaudaDate = row.s_date || row.contract_date;
        const formattedSaudaDate = rawSaudaDate ? new Date(rawSaudaDate).toLocaleDateString('en-GB') : '';

        const contractMt = parseFloat(row.total_contract_mt) || parseFloat(row.quantity) || 0;
        const rcvdMt = parseFloat(row.received_weight_mt) || 0;
        const unit = row.purchase_unit_name || row.po_type || 'BALES';
        const tol = calculateWeightTolerance(contractMt, rcvdMt, unit);
        const pStatus = row.status ? String(row.status).toUpperCase() : (tol.isCompleted || row.pending === false ? 'COMPLETED' : 'PENDING');

        return {
          "PO / PTF No": row.po_no || row.ptf_no || '',
          "PO Date": formattedPoDate,
          "Sauda Contract No": row.sauda_no || row.contract_po_no || '',
          "Sauda Date": formattedSaudaDate,
          "Broker": row.broker || '',
          "Merchant / Supplier": row.supplier || row.merchant || '',
          "Challan Supplier": row.challan_supplier || '',
          "Area / Station": row.area || row.dispatch_station || '',
          "B. Rate (Rs/MT)": row.b_rate || 0,
          "Unit / Lorry": row.purchase_unit_name || row.po_type || 'BALES',
          "Total Lorries": row.total_lorries || 0,
          "Total Units / Bales": row.total_units || 0,
          "Total Contract Wt (MT)": contractMt,
          "Received Weight (MT)": rcvdMt,
          "Weight Tolerance": tol.formattedTolerance,
          "Acceptable Range (MT)": tol.formattedRange,
          "Status": pStatus,
          "Session / Year": row.session || row.financial_year || '',
          "Crop Year": row.crop_year || '',
          "Transport Paid By": row.trans_paid_by || row.transport_type || '',
          "Delivery From": row.delivery_from || '',
          "Delivery To": row.delivery_to || '',
          "Grace Days": row.grace_days || 0,
          "Moisture Limit %": row.moisture || 0,
          "Moisture Penalty %": row.moisture_penalty || 0,
          "Dust Limit %": row.dust || 0,
          "Dust Penalty %": row.dust_penalty || 0,
          "NCV Limit %": row.ncv || 0,
          "NCV Penalty %": row.ncv_penalty || 0,
          "Grade & Item Breakdown": gradeItemDetails || 'N/A',
          "Remarks": row.remarks || '',
          "Financial Year": row.financial_year || '',
          "Created At": row.created_at || ''
        };
      });

      const sanitizedData = sanitizeCsvData(dataToExport);
      const csv = Papa.unparse(sanitizedData);
      const csvContent = "\uFEFF" + csv;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const exportType = isTempPo ? 'Temporary_PO' : 'Final_PO';
      link.setAttribute('download', `${exportType}_Full_Export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("PO CSV Export failed:", err);
      alert("Failed to export: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'register' | 'form'>('register');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'partial' | 'cancelled'>('all');
  const [selectedPoNo, setSelectedPoNo] = useState<string | null>(null);
  
  // Modal toggle state for calculation helper overlay
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [selectedItemSrl, setSelectedItemSrl] = useState<number | null>(null);
  
  // DB Records
  const [poList, setPoList] = useState<any[]>([]);
  // 1-to-N Consignment Ledger Modal State
  const [consignmentLedgerPo, setConsignmentLedgerPo] = useState<any>(null);
  const [allTempArrivals, setAllTempArrivals] = useState<any[]>([]);
  const [allFinalArrivals, setAllFinalArrivals] = useState<any[]>([]);
  const [allInspections, setAllInspections] = useState<any[]>([]);

  // Temporary P.O ↔ Material Inspection match status, keyed by po_no.
  const [matchResults, setMatchResults] = useState<Record<string, PoMatchResult>>({});
  // DB Mismatch tables cache for cross-checking approval statuses
  const [dbMaterialMismatches, setDbMaterialMismatches] = useState<any[]>([]);
  const [dbSattaMismatches, setDbSattaMismatches] = useState<any[]>([]);

  // PTF creation mode: 'fresh' or 'reference' (against a cancelled P.O).
  const [ptfMode, setPtfMode] = useState<'fresh' | 'reference'>('fresh');
  // On the Final P.O view: po_nos that still exist in sauda_check_point (= not yet
  // finalized) so we can hide them from Final and keep the two dashboards clean.
  const [tempPoNoSet, setTempPoNoSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isTempPo || !supabase) { setTempPoNoSet(new Set()); return; }
      try {
        const { data } = await supabase.from('sauda_check_point').select('po_no');
        if (!cancelled) setTempPoNoSet(new Set((data || []).map((r: any) => String(r.po_no || '').trim().toUpperCase())));
      } catch (_e) { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [isTempPo, poList]);
  // Row Actions dropdown (portal-positioned so it isn't clipped by the table).
  const [actionMenu, setActionMenu] = useState<{ item: any; x: number; y: number } | null>(null);
  // Professional confirm dialog (replaces window.confirm).
  const [confirmState, setConfirmState] = useState<
    { title: string; message: string; tone: 'default' | 'danger'; confirmLabel: string; resolve: (v: boolean) => void } | null
  >(null);
  const askConfirm = (
    message: string,
    opts?: { title?: string; tone?: 'default' | 'danger'; confirmLabel?: string },
  ) => new Promise<boolean>((resolve) => setConfirmState({
    title: opts?.title || 'Please Confirm',
    message,
    tone: opts?.tone || 'default',
    confirmLabel: opts?.confirmLabel || 'Confirm',
    resolve,
  }));

  function isPoMismatchResolved(poOrItem: any): boolean {
    if (!poOrItem) return false;
    const item = typeof poOrItem === 'object' 
      ? poOrItem 
      : poList.find((p: any) => String(p.po_no || p.contract_po_no || '').trim().toUpperCase() === String(poOrItem).trim().toUpperCase()) || { po_no: String(poOrItem) };
    
    const poNo = String(item.po_no || '').trim().toUpperCase();
    const contractPoNo = String(item.contract_po_no || '').trim().toUpperCase();
    const saudaNo = String(item.sauda_no || item.po_contract || item.contract_no || '').trim().toUpperCase();
    const ptfNo = String(item.ptf_no || '').trim().toUpperCase();
    
    // Suffix extraction (e.g. 0153 from BJCL/2026-2027/0153 or BJC0153/26-27)
    const poSuffix = poNo.split('/').pop() || '';
    const saudaSuffix = saudaNo.split('/').pop() || '';
    const tokens = [poNo, contractPoNo, saudaNo, ptfNo, poSuffix, saudaSuffix].filter(t => t && t !== 'N/A' && t !== 'UNDEFINED');

    // 1. Direct record flags on item
    if (
      item.mismatch_cleared === true || 
      item.mismatch_cleared === 'true' || 
      item.satta_dispute_approved === true || 
      item.satta_dispute_approved === 'true' ||
      item.status === 'resolved' ||
      item.status === 'cleared' ||
      item.status === 'final' ||
      item.status === 'approved'
    ) {
      return true;
    }

    // 2. Check localStorage tokens
    for (const token of tokens) {
      const matCache = localStorage.getItem(`material_resolved_${token.toUpperCase()}`);
      const satCache = localStorage.getItem(`satta_resolved_${token.toUpperCase()}`);
      const misCache = localStorage.getItem(`material_resolved_MIS-${token.toUpperCase()}`);
      if (matCache || satCache || misCache) {
        return true;
      }
    }

    // 3. Check dbMaterialMismatches
    const hasMaterialResolved = dbMaterialMismatches.some((m: any) => {
      const mPo = String(m.po_no || '').trim().toUpperCase();
      const mId = String(m.mismatch_id || m.id || '').toUpperCase();
      const isResolvedStatus = m.status === 'resolved' || m.status === 'approved' || m.status === 'cleared' || Boolean(m.approved_by) || String(m.remarks || '').toUpperCase().includes('APPROVED');
      if (!isResolvedStatus) return false;
      
      return tokens.some(t => {
        const tu = t.toUpperCase();
        return (mPo && (mPo === tu || mPo.includes(tu) || tu.includes(mPo))) ||
               (mId && (mId === `MIS-${tu}` || mId.includes(tu)));
      });
    });
    if (hasMaterialResolved) return true;

    // 4. Check dbSattaMismatches
    const hasSattaResolved = dbSattaMismatches.some((s: any) => {
      const sPo = String(s.po_no || '').trim().toUpperCase();
      const sSauda = String(s.sauda_no || '').trim().toUpperCase();
      const sId = String(s.mismatch_id || s.id || '').toUpperCase();
      const isResolvedStatus = s.status === 'resolved' || s.status === 'approved' || s.status === 'cleared' || Boolean(s.approved_by) || String(s.remarks || '').toUpperCase().includes('APPROVED');
      if (!isResolvedStatus) return false;

      return tokens.some(t => {
        const tu = t.toUpperCase();
        return (sPo && (sPo === tu || sPo.includes(tu) || tu.includes(sPo))) ||
               (sSauda && (sSauda === tu || sSauda.includes(tu) || tu.includes(sSauda))) ||
               (sId && (sId === `SAT-${tu}` || sId.includes(tu)));
      });
    });
    if (hasSattaResolved) return true;

    return false;
  }

  // Compute header-level match against Material Inspection for the Temp P.O list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || poList.length === 0) {
        setMatchResults({});
        return;
      }
      try {
        const [inspRes, amadRes, detailsRes] = await Promise.all([
          supabase.from('mill_inspection_master').select('*'),
          dbModule.fetchAll('temporary_material_received').catch(() => []),
          supabase.from('sauda_check_point_details').select('*'),
        ]);

        const inspList = inspRes.data || [];
        const amadList = amadRes || [];
        const detailsList = detailsRes.data || [];

        const clean = (v: any) => String(v ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
        const results: Record<string, PoMatchResult> = {};

        for (const po of poList) {
          const poNoClean = clean(po.po_no || po.contract_po_no);
          const matchInsp = inspList.find((i: any) => i.po_no && clean(i.po_no) === poNoClean);
          const matchAmad = amadList.find((a: any) => a.po_no && clean(a.po_no) === poNoClean);
          const poDetails = detailsList.filter((d: any) => d.po_no && clean(d.po_no) === poNoClean);
          const allReceipts = [...inspList.filter((i: any) => i.po_no && clean(i.po_no) === poNoClean), ...amadList.filter((a: any) => a.po_no && clean(a.po_no) === poNoClean)];

          const enrichedInsp = matchInsp || matchAmad || null;
          results[po.po_no] = comparePoInspection(po, poDetails, enrichedInsp, allReceipts);
        }
        if (!cancelled) setMatchResults(results);
      } catch (_e) {
        /* inspection match is non-fatal */
      }
    })();
    return () => { cancelled = true; };
  }, [poList, isTempPo]);
  const [printingPo, setPrintingPo] = useState<any | null>(null);
  const [emailSendingStatus, setEmailSendingStatus] = useState<Record<string, 'idle' | 'sending' | 'success' | 'error'>>({});

  const handleSendMailPo = async (poHeader: any) => {
    const poNo = poHeader.po_no;
    if (!poNo) return;

    setEmailSendingStatus(prev => ({ ...prev, [poNo]: 'sending' }));

    const getGradeNameForCompare = (gCode: string) => {
      const match = gradeList.find((g: any) => g.grade_code === gCode);
      return match ? match.grade_name : gCode;
    };

    try {
      // Find full items
      const details = await dbModule.fetchAll(DETAIL_TABLE);
      const filtered = details
        .filter((d: any) => d.po_no === poHeader.po_no)
        .sort((a: any, b: any) => compareQualities(getGradeNameForCompare(a.grade_code || ''), getGradeNameForCompare(b.grade_code || '')));
      
      const isBales = (poHeader.purchase_unit_name || 'BALES') === 'BALES';
      const mappedItems = filtered.map((d: any, idx: number) => {
        const qtyVal = d.quantity || 0;
        const weightVal = isBales 
          ? parseFloat(((qtyVal * 147.5) / 1000).toFixed(3)) 
          : (d.weight_mt || 0);
        return {
          srl: idx + 1,
          crop: d.crop_year || '2025-26',
          grade_code: d.grade_code || '',
          grade_name: gradeList.find(g => g.grade_code === d.grade_code)?.grade_name || d.grade_code || 'STANDARD GRADE',
          agency_code: d.agency_code || '',
          agency_name: agencyList.find(a => a.agency_code === d.agency_code)?.agency_name || d.agency_code || 'MAIN AGENCY',
          marka_code: d.marka_code || '',
          marka_name: markaList.find(m => m.marka_code === d.marka_code)?.marka_name || d.marka_code || 'NORMAL GRADE',
          qty: qtyVal,
          weight: weightVal,
          rate: d.rate_qntl || 0
        };
      });

      const sumQty = mappedItems.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
      const sumWt = mappedItems.reduce((s, it) => s + (parseFloat(it.weight) || 0), 0);

      const fullPo = {
        no: poHeader.po_no || '',
        ptf_no: poHeader.ptf_no || '',
        is_ptf: !!poHeader.ptf_no,
        date: poHeader.po_date || poHeader.created_at || todayStr,
        broker: poHeader.broker || 'N/A',
        supplier: poHeader.supplier || 'N/A',
        challan_supplier: poHeader.challan_supplier || 'N/A',
        area: poHeader.area || 'N/A',
        trans_paid_by: poHeader.trans_paid_by || 'PARTY',
        weight_unit_kgs: String(poHeader.weight_unit_kgs || (isBales ? '147.5' : '50')),
        against_cancellation: poHeader.against_cancellation || 'No',
        purchase_unit_name: poHeader.purchase_unit_name || 'BALES',
        total_no_of_lorries: String(poHeader.total_lorries || '0'),
        units_per_lorry: String(poHeader.units_per_lorry || '0'),
        total_units: isBales ? sumQty.toString() : String(poHeader.total_units || '0'),
        weight_per_lorry: poHeader.weight_per_lorry !== undefined && poHeader.weight_per_lorry !== null && !isNaN(Number(poHeader.weight_per_lorry)) && Number(poHeader.weight_per_lorry) > 0
          ? Number(poHeader.weight_per_lorry).toFixed(3)
          : String(poHeader.weight_per_lorry || '0.000'),
        total_contract_mt: isBales ? sumWt.toFixed(3) : String(poHeader.total_contract_mt || '0'),
        marka_type: poHeader.marka_type || 'Normal',
        marka_penalty: String(poHeader.marka_penalty || '0'),
        qty_penalty: String(poHeader.qty_penalty || '5'),
        delivery_from: poHeader.delivery_from || todayStr,
        delivery_to: poHeader.delivery_to || todayStr,
        grace_days: String(poHeader.grace_days || '0'),
        delivery_penalty: String(poHeader.delivery_penalty || '0'),
        contract_po_no: poHeader.contract_po_no || '',
        contract_date: poHeader.contract_date || todayStr,
        rate_detail: poHeader.rate_detail || '',
        delivery_schedule: poHeader.delivery_schedule || '',
        terms_condition: poHeader.terms_condition || 'Penalty Rs.5/day. Standard terms apply.',
        remarks: poHeader.remarks || 'Grade rates based on BJCL indices.',
        po_identification: poHeader.po_identification || 'Direct Advance Payment',
        b_rate: String(poHeader.b_rate || '0'),
        s_date: poHeader.s_date || todayStr,
        items: mappedItems
      };

      const emailHtml = generatePoHtmlEmail(fullPo);

      // Generate the PO PDF so it can be attached to the email.
      let poPdfBase64 = "";
      try {
        const poDoc = generatePoPdf(fullPo);
        poPdfBase64 = poDoc.output("datauristring").split(",")[1] || "";
      } catch (pdfErr) {
        console.error("Failed to generate PO PDF for email:", pdfErr);
      }

      let recipientEmails = "";
      if (supabase) {
        const addedEmails = new Set<string>();
        
        // Lookup Broker in customer_master
        if (poHeader.broker) {
          const { data: custBroker } = await supabase
            .from('customer_master')
            .select('email')
            .eq('firm_name', poHeader.broker)
            .maybeSingle();
          if (custBroker?.email) {
            const email = custBroker.email.trim();
            if (email && !addedEmails.has(email.toLowerCase())) {
              recipientEmails += `, ${email}`;
              addedEmails.add(email.toLowerCase());
            }
          }
        }
        
        // Lookup Supplier in customer_master
        if (poHeader.supplier) {
          const { data: custSupplier } = await supabase
            .from('customer_master')
            .select('email')
            .eq('firm_name', poHeader.supplier)
            .maybeSingle();
          if (custSupplier?.email) {
            const email = custSupplier.email.trim();
            if (email && !addedEmails.has(email.toLowerCase())) {
              recipientEmails += `, ${email}`;
              addedEmails.add(email.toLowerCase());
            }
          }
        }
      }

      const res = await fetch(getApiUrl("/api/send-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `📋 PURCHASE ORDER SLIP: #${poHeader.po_no} - [${poHeader.broker || 'N/A'}]`,
          to: recipientEmails.split(',').map(e => e.trim()).filter(Boolean).join(', ') || 'rawjute@ballyjute.com',
          html: emailHtml,
          filename: `Purchase_Order_${poHeader.po_no || 'Draft'}.pdf`,
          pdfData: poPdfBase64 || undefined
        })
      });

      const resText = await res.text();
      let resData;
      try {
        resData = JSON.parse(resText);
      } catch (e) {
        throw new Error("Mail Dispatch Failed: " + (resText.substring(0, 100) || `Status ${res.status}`));
      }
      
      if (res.ok && resData.success) {
        setEmailSendingStatus(prev => ({ ...prev, [poNo]: 'success' }));
        alert(`Email for Purchase Order #${poHeader.po_no} sent successfully to ${recipientEmails}!`);
        setTimeout(() => {
          setEmailSendingStatus(prev => ({ ...prev, [poNo]: 'idle' }));
        }, 3000);
      } else {
        throw new Error(resData.error || "Failed to send email");
      }
    } catch (err: any) {
      console.error(err);
      setEmailSendingStatus(prev => ({ ...prev, [poNo]: 'error' }));
      alert(`Failed to send email: ${err.message || String(err)}`);
      setTimeout(() => {
        setEmailSendingStatus(prev => ({ ...prev, [poNo]: 'idle' }));
      }, 3000);
    }
  };
  
  // Data lists fetched from master tables
  const [brokerList, setBrokerList] = useState<any[]>([]);
  const [supplierList, setSupplierList] = useState<any[]>([]);
  const [areaList, setAreaList] = useState<any[]>([]);
  const [saudaList, setSaudaList] = useState<any[]>([]);
  const [gradeList, setGradeList] = useState<any[]>([]);
  const [markaList, setMarkaList] = useState<any[]>([]);
  const [agencyList, setAgencyList] = useState<any[]>([]);

  // Satta Chart Cache States
  const [sattaBaseRates, setSattaBaseRates] = useState<any[]>([]);
  const [sattaCalculatedRates, setSattaCalculatedRates] = useState<any[]>([]);
  const [sattaDifferentials, setSattaDifferentials] = useState<any[]>([]);

  const lookupSattaBaseRate = (sDateStr: string, bases: any[] = sattaBaseRates) => {
    const sDate = sDateStr || todayStr;
    const sortedBases = [...bases]
      .filter(b => b.start_date && b.start_date <= sDate)
      .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));

    if (sortedBases.length > 0 && sortedBases[0].base_rate) {
      return String(sortedBases[0].base_rate);
    }
    if (bases.length > 0 && bases[0].base_rate) {
      return String(bases[0].base_rate);
    }
    return '';
  };

  const getSattaRateForRow = (
    rowAgencyName: string,
    rowGradeName: string,
    sDateStr: string,
    bRateStr: string,
    bases: any[] = sattaBaseRates,
    calcs: any[] = sattaCalculatedRates,
    diffs: any[] = sattaDifferentials,
    overrideArea?: string
  ) => {
    const sDate = sDateStr || todayStr;
    const bRate = parseFloat(bRateStr) || 0;

    const normAgency = (rowAgencyName || '').trim().toUpperCase();
    const normGrade = (rowGradeName || '').trim().toUpperCase();
    const normArea = (overrideArea || formData?.area || '').trim().toUpperCase();

    if (!normGrade) return null;
    if (!normAgency && !normArea) return null;

    let differential = 0;
    let found = false;

    // 1. Find the active satta base rate for sDate
    const sortedBases = [...bases]
      .filter(b => b.start_date && b.start_date <= sDate)
      .sort((a, b) => b.start_date.localeCompare(a.start_date));

    const activeBase = sortedBases[0];

    const lookupInSatta = (areaToLookup: string) => {
      if (!areaToLookup) return null;

      // 2. Try to find differential in satta_calculated_rates for this active base rate
      if (activeBase && calcs.length > 0) {
        const match = calcs.find(c => 
          c.start_date === activeBase.start_date &&
          (c.area || '').trim().toUpperCase() === areaToLookup &&
          (c.grade || '').trim().toUpperCase() === normGrade
        );
        if (match) {
          return parseFloat(match.differential) || 0;
        }
      }

      // 3. Fallback to general satta_differentials
      if (diffs.length > 0) {
        const match = diffs.find(d => 
          (d.area || '').trim().toUpperCase() === areaToLookup &&
          (d.grade || '').trim().toUpperCase() === normGrade
        );
        if (match) {
          return parseFloat(match.differential) || 0;
        }
      }

      // 4. Fallback to EXCEL_SEED_DATA
      const matchArea = EXCEL_SEED_DATA.find(a => a.area.toUpperCase() === areaToLookup);
      if (matchArea && matchArea.diffs) {
        const diffVal = matchArea.diffs[normGrade];
        if (diffVal !== undefined) {
          return diffVal;
        }
      }

      return null;
    };

    // Try specific row agency first
    let diffVal = lookupInSatta(normAgency);
    if (diffVal !== null) {
      differential = diffVal;
      found = true;
    } else if (normArea && normArea !== normAgency) {
      // Fallback to procurement Area (from PO Header)
      diffVal = lookupInSatta(normArea);
      if (diffVal !== null) {
        differential = diffVal;
        found = true;
      }
    }

    if (found) {
      const baseToUse = bRate > 0 ? bRate : (activeBase ? parseFloat(activeBase.base_rate) || 0 : 0);
      return baseToUse + differential;
    }

    return null;
  };

  const recalculateAllRates = (
    items: any[], 
    sDate: string, 
    bRate: string, 
    bases: any[] = sattaBaseRates, 
    calcs: any[] = sattaCalculatedRates, 
    diffs: any[] = sattaDifferentials,
    overrideArea?: string
  ) => {
    return items.map(row => {
      const computed = getSattaRateForRow(
        row.agency_name,
        row.grade_name,
        sDate,
        bRate,
        bases,
        calcs,
        diffs,
        overrideArea
      );
      if (computed !== null) {
        return { ...row, rate: computed };
      }
      return row;
    });
  };

  const recalculateItemWeights = (items: any[], unitWeightKgs: number) => {
    return items.map(item => ({
      ...item,
      weight: parseFloat(((item.qty * unitWeightKgs) / 1000).toFixed(3))
    }));
  };

  const handlePurchaseUnitChange = (name: string, code: string) => {
    const isBales = name === 'BALES';
    const weightUnitKgs = isBales ? '147.5' : '50';
    const unitWtVal = parseFloat(weightUnitKgs);

    const lorries = parseFloat(formData.total_no_of_lorries) || 0;
    const unitsPerLorry = parseFloat(formData.units_per_lorry) || 0;
    const totalUnits = lorries * unitsPerLorry;
    const wtPerLorry = (unitsPerLorry * unitWtVal) / 1000;
    const totalContractMt = (totalUnits * unitWtVal) / 1000;

    const updatedItems = recalculateItemWeights(formData.items, unitWtVal);

    setFormData(prev => ({
      ...prev,
      purchase_unit_name: name,
      purchase_unit_code: code,
      weight_unit_kgs: weightUnitKgs,
      weight_per_lorry: wtPerLorry > 0 ? wtPerLorry.toFixed(3) : prev.weight_per_lorry,
      total_contract_mt: totalContractMt > 0 ? totalContractMt.toFixed(3) : prev.total_contract_mt,
      total_units: totalUnits > 0 ? totalUnits.toString() : prev.total_units,
      items: updatedItems
    }));
  };

  const [unitList, setUnitList] = useState<string[]>(['DRUMS', 'BALES', 'LOOSE', 'P.BALES', 'H.BALES']);

  useEffect(() => {
    async function loadUnits() {
      try {
        if (supabase) {
          const { data } = await supabase.from('unit_master').select('unit_name').order('unit_name');
          if (data && data.length > 0) {
            const fetched = data.map((u: any) => u.unit_name).filter(Boolean);
            setUnitList(prev => Array.from(new Set([...fetched, ...prev])));
          }
        }
      } catch (err) {
        console.warn("Failed to load unit_master in PurchaseOrder", err);
      }
    }
    loadUnits();
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    is_ptf: false,
    purchase_order: 'FINAL PO',
    po_type: 'Normal',
    ptf_no: '',
    pending: 'Yes',
    no: '',
    date: todayStr,
    broker_code: '',
    broker: '',
    supplier_code: '',
    supplier: '',
    challan_supplier_code: '',
    challan_supplier: '',
    area_code: '',
    area: '', 
    trans_paid_by: 'PARTY',
    weight_unit_kgs: '147.5',
    against_cancellation: 'No',
    purchase_unit_code: '1',
    purchase_unit_name: 'BALES',
    total_no_of_lorries: '',
    units_per_lorry: '',
    total_units: '',
    weight_per_lorry: '',
    total_contract_mt: '',
    marka_type: 'Normal',
    marka_penalty: '0',
    qty_penalty: '5',
    delivery_from: todayStr,
    delivery_to: todayStr,
    grace_days: '0',
    delivery_penalty: '0',
    contract_po_no: '',
    contract_date: todayStr,
    rate_detail: '',
    delivery_schedule: '',
    terms_condition: '',
    remarks: '',
    po_identification: 'Direct Advance Payment',
    b_rate: '',
    s_date: todayStr, 
    items: [] as any[]
  });

  const [calcData, setCalcData] = useState({
     total_lorries: '2',
     units_per_lorry: '200',
     total_units: '400',
     weight_per_lorry: '10.000'
  });

  // Fetch all registered records and masters
  const fetchPosAndMasters = async () => {
    setLoading(true);
    const safeFetch = (table: string, orderBy?: string, ascending = false) => {
      return dbModule.fetchAll(table, orderBy, ascending).catch(err => {
        console.warn(`Failed to fetch ${table}:`, err);
        return [];
      });
    };

    const safeSupabaseSelect = async (table: string, orderCol?: string, ascending = false) => {
      if (!supabase) return { data: [] };
      try {
        let q = supabase.from(table).select('*');
        if (orderCol) {
          q = q.order(orderCol, { ascending });
        }
        const res = await q;
        if (res.error) {
          console.warn(`Supabase error on ${table}:`, res.error);
          return { data: [] };
        }
        return res || { data: [] };
      } catch (err) {
        console.warn(`Supabase failed on ${table}:`, err);
        return { data: [] };
      }
    };

    try {
      let initialPos = await safeFetch(MASTER_TABLE, 'created_at', false);
      if (isArchiveView && (!initialPos || initialPos.length === 0)) {
        const altPos = await safeFetch('po_archive', 'created_at', false);
        if (altPos && altPos.length > 0) {
          initialPos = altPos;
        } else {
          const rawActive = await safeFetch('purchase_master', 'created_at', false);
          initialPos = (rawActive || []).filter((r: any) => r.status === 'settled' || !!r.archived_at);
        }
      }

      const [
        brokers, 
        suppliers, 
        areas, 
        saudas, 
        grades, 
        markas, 
        agencies, 
        arrivals, 
        finalArrivals, 
        inspections, 
        sattaBasesRes, 
        sattaCalculatedRes, 
        sattaDiffsRes,
        matMismatchesRes,
        satMismatchesRes,
        dbMatMismatches,
        dbSatMismatches
      ] = await Promise.all([
        safeFetch('broker_master'),
        safeFetch('supply_master'),
        safeFetch('area_master'),
        safeFetch('sauda_master', 'created_at', false),
        safeFetch('grade_master'),
        safeFetch('marka_master'),
        safeFetch('agency_master'),
        safeFetch('temporary_material_received', 'created_at', false),
        safeFetch('final_arrival', 'created_at', false),
        safeFetch('mill_inspection_master', 'created_at', false),
        safeSupabaseSelect('satta_base_rates', 'start_date', false),
        safeSupabaseSelect('satta_calculated_rates'),
        safeSupabaseSelect('satta_differentials'),
        safeSupabaseSelect('material_mismatch'),
        safeSupabaseSelect('satta_mismatch'),
        safeFetch('material_mismatch'),
        safeFetch('satta_mismatch'),
      ]);

      const combinedMatMismatches = [...((matMismatchesRes as any)?.data || []), ...(dbMatMismatches || [])];
      const combinedSatMismatches = [...((satMismatchesRes as any)?.data || []), ...(dbSatMismatches || [])];
      setDbMaterialMismatches(combinedMatMismatches);
      setDbSattaMismatches(combinedSatMismatches);

      const pos = initialPos;
      setAllTempArrivals(arrivals || []);
      setAllFinalArrivals(finalArrivals || []);
      setAllInspections(inspections || []);

      const matchPoNo = (po1: string, po2: string) => {
        if (!po1 || !po2) return false;
        const p1 = po1.trim().toLowerCase();
        const p2 = po2.trim().toLowerCase();
        if (p1 === p2) return true;
        
        const clean1 = p1.replace(/[^a-z0-9]/g, '');
        const clean2 = p2.replace(/[^a-z0-9]/g, '');
        if (clean1 && clean1 === clean2) return true;

        if (clean1.length > 5 && clean2.length > 5 && (clean1.includes(clean2) || clean2.includes(clean1))) {
          return true;
        }

        const num1 = p1.replace(/[^0-9]/g, '');
        const num2 = p2.replace(/[^0-9]/g, '');
        if (num1.length >= 4 && num2.length >= 4 && (num1.includes(num2) || num2.includes(num1))) {
          return true;
        }
        return false;
      };

      // Match arrivals to a P.O by EXACT po_no only. Fuzzy matching over-counted and
      // produced impossible received weights (e.g. 89.8 MT received on a 10.8 MT P.O).
      // With no matching arrival, received is correctly 0.
      const exactPo = (a: any, b: any) => {
        const x = String(a || '').trim().toUpperCase();
        const y = String(b || '').trim().toUpperCase();
        return x !== '' && x === y;
      };
      setPoList((pos || []).map((p: any) => {
        const contractWeight = parseFloat(p.total_contract_mt) || 0;
        const matchingFinal = (finalArrivals || []).filter((ar: any) =>
          exactPo(p.po_no, ar.po_no) || exactPo(p.contract_po_no, ar.po_no)
        );
        const matchingTemp = (arrivals || []).filter((ar: any) =>
          (exactPo(p.po_no, ar.po_no) || exactPo(p.contract_po_no, ar.po_no)) &&
          !matchingFinal.some(f => f.temporary_arrival_no === ar.temporary_arrival_no || f.mr_no === ar.amad_no)
        );
        // Received quantity = ONLY material accepted at Final M.R (final_arrival).
        // No Temporary-Arrival or dummy data is counted — a P.O with no Final M.R
        // correctly shows 0.000.
        const weightOf = (ar: any) => Number(ar.weight_qtl || ar.weight || ar.electronic_net_weight || 0) / 10;
        const totalReceivedMt = matchingFinal.reduce((sum: number, ar: any) => sum + weightOf(ar), 0);

        const unit = p.purchase_unit_name || p.unit_type || p.unit || 'BALES';
        const tol = calculateWeightTolerance(contractWeight, totalReceivedMt, unit);
        const isExplicitCompleted = p.status === 'completed' || p.status === 'settled';
        const isWeightCompleted = tol.isCompleted;
        const computedPending = (isExplicitCompleted || isWeightCompleted) ? false : true;

        // Pass / Mismatch: compare this P.O against its matched Temporary M.R on
        // the shared fields. All match → Pass; any differ → Mismatch; no arrival yet
        // → Awaiting. (Blank-on-either-side fields are skipped, not counted as diffs.)
        const isPtfRow = !!(p.ptf_no && String(p.ptf_no).trim());
        const arr: any = [...matchingFinal, ...matchingTemp][0];
        let passStatus: 'awaiting' | 'pass' | 'mismatch' = 'awaiting';
        const mismatchFields: string[] = [];
        
        // If mismatch is cleared / approved by admin or PTF, mark as pass immediately
        const isCleared = p.mismatch_cleared === true || 
          p.mismatch_cleared === 'true' || 
          p.satta_dispute_approved === true || 
          p.satta_dispute_approved === 'true' || 
          isPoMismatchResolved(p);

        if (isPtfRow || isCleared) {
          passStatus = 'pass';
        } else if (totalReceivedMt > 0 && arr) {
          // Only evaluate once material has actually been received.
          const norm = (v: any) => String(v ?? '').toUpperCase().replace(/[^a-z0-9]/gi, '');
          const cmp = (label: string, a: any, b: any) => {
            const x = norm(a), y = norm(b);
            if (x === '' || y === '') return;
            if (x !== y) mismatchFields.push(label);
          };
          cmp('Supplier', p.supplier, arr.supplier);
          cmp('Broker', p.broker, arr.broker);
          cmp('Challan Supplier', p.challan_supplier, arr.challan_supplier);
          cmp('Area', p.area, arr.arrival_area_name || arr.area);
          passStatus = mismatchFields.length === 0 ? 'pass' : 'mismatch';
        }
        // else: nothing received yet → stays 'awaiting'.

        return {
          ...p,
          date: p.date || p.po_date || (p.created_at ? p.created_at.slice(0, 10) : ''),
          broker: (p.broker || '').toUpperCase(),
          supplier: (p.supplier || '').toUpperCase(),
          challan_supplier: (p.challan_supplier || p.supplier || '').toUpperCase(),
          pending: computedPending,
          received_weight_mt: totalReceivedMt,
          weight_tolerance: tol,
          pass_status: passStatus,
          mismatch_fields: mismatchFields
        };
      }));

      setBrokerList((brokers || []).map((b: any) => ({
        ...b,
        brok_name: (b.brok_name || '').toUpperCase()
      })));
      setSupplierList((suppliers || []).map((s: any) => ({
        ...s,
        supp_name: (s.supp_name || '').toUpperCase()
      })));
      setAreaList(areas || []);
      setSaudaList((saudas || []).map((s: any) => ({
        ...s,
        broker: (s.broker || '').toUpperCase(),
        supplier: (s.supplier || '').toUpperCase(),
        challan_supplier: (s.challan_supplier || '').toUpperCase()
      })));
      setGradeList(grades || []);
      setMarkaList(markas || []);
      setAgencyList(agencies || []);

      const sBases = sattaBasesRes && 'data' in sattaBasesRes ? (sattaBasesRes as any).data || [] : [];
      const sCalculated = sattaCalculatedRes && 'data' in sattaCalculatedRes ? (sattaCalculatedRes as any).data || [] : [];
      const sDiffs = sattaDiffsRes && 'data' in sattaDiffsRes ? (sattaDiffsRes as any).data || [] : [];
      setSattaBaseRates(sBases);
      setSattaCalculatedRates(sCalculated);
      setSattaDifferentials(sDiffs);
    } catch (err) {
      console.error('Failed to load masters data:', err);
    } finally {
      setLoading(false);
    }
  };

  useLiveAutoRefresh(fetchPosAndMasters, [isArchiveView, isTempPo], { tables: ['purchase_master', 'purchase_detail_master', 'sauda_check_point', 'sauda_check_point_details', 'p.o_archive', 'po_archive'] });

  useEffect(() => {
    fetchPosAndMasters();

    const handleDataUpdate = () => {
      fetchPosAndMasters();
    };

    window.addEventListener('app-data-updated', handleDataUpdate);
    window.addEventListener('mismatch_resolved', handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate);

    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel('po-realtime-sub')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_check_point' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'final_po' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_check_point_details' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mill_inspection_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'temporary_material_received' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_sauda' }, handleDataUpdate)
        .subscribe();
    }

    return () => {
      window.removeEventListener('app-data-updated', handleDataUpdate);
      window.removeEventListener('mismatch_resolved', handleDataUpdate);
      window.removeEventListener('storage', handleDataUpdate);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Auto-sync B. Rate from Satta Base Rate for given S Date
  useEffect(() => {
    if (sattaBaseRates.length > 0 && formData.s_date) {
      const activeBase = lookupSattaBaseRate(formData.s_date, sattaBaseRates);
      if (activeBase && (!formData.b_rate || formData.b_rate === '0' || formData.b_rate === '')) {
        const updatedItems = recalculateAllRates(formData.items, formData.s_date, activeBase);
        setFormData(prev => ({
          ...prev,
          b_rate: activeBase,
          items: updatedItems
        }));
      }
    }
  }, [sattaBaseRates, formData.s_date]);

  const handleSaudaSelect = async (saudaNo: string) => {
    if (!saudaNo) {
      setFormData(prev => ({ ...prev, no: '' }));
      return;
    }
    const sauda = saudaList.find(s => 
      s.sauda_no === saudaNo || 
      s.session === saudaNo || 
      formatPoNumber(s) === saudaNo
    );
    if (!sauda) {
      setFormData(prev => ({ ...prev, no: saudaNo }));
      return;
    }

    const brokerObj = brokerList.find(b => b.brok_name === sauda.broker || b.brok_code === sauda.broker);
    const supplierObj = supplierList.find(s => s.supp_name === sauda.supplier || s.supp_code === sauda.supplier);
    const challanSuppObj = supplierList.find(s => s.supp_name === sauda.challan_supplier || s.supp_code === sauda.challan_supplier);
    const areaObj = areaList.find(a => a.area_name === sauda.area || a.area_code === sauda.area);

    let mappedItems: any[] = [];
    const isBales = (sauda.unit_type || '').toUpperCase() === 'BALES';
    const sDate = sauda.date || todayStr;
    const autoBRate = lookupSattaBaseRate(sDate, sattaBaseRates);
    const selectedBRate = (sauda.b_rate && Number(sauda.b_rate) > 0) ? sauda.b_rate.toString() : autoBRate;

    if (supabase) {
      try {
        const { data: qDetails } = await supabase
          .from('sauda_quality_details')
          .select('*')
          .eq('sauda_id', sauda.sauda_id);

        if (qDetails && qDetails.length > 0) {
          const sortedDetails = [...qDetails].sort((a: any, b: any) => compareQualities(a.quality || '', b.quality || ''));
          mappedItems = sortedDetails.map((item: any, index: number) => {
            const matchingGrade = gradeList.find(g => {
              const clean = (s: string) => (s || '').trim().replace(/\.$/, '').toUpperCase();
              return clean(g.grade_name) === clean(item.quality) || clean(g.grade_code) === clean(item.quality);
            });
            const itemWt = isBales 
              ? (item.qty * 147.5) / 1000 
              : (sauda.total_unit > 0 ? (item.qty / sauda.total_unit) * sauda.total_wt_in_ton : 0);
            const rowAgency = item.agency || sauda.agency || '';
            const agencyObj = agencyList.find(ag => ag.agency_name === rowAgency || ag.agency_code === rowAgency);
            const rowMarka = item.marka || sauda.marks || '';
            const markaObj = markaList.find(m => m.marka_name === rowMarka || m.marka_code === rowMarka);

            const rowGradeName = matchingGrade?.grade_name || item.quality || '';
            const rowAgencyName = agencyObj?.agency_name || rowAgency;

            const computedSattaRate = getSattaRateForRow(rowAgencyName, rowGradeName, sDate, selectedBRate);
            const finalRate = computedSattaRate !== null ? computedSattaRate : (item.rs || 0);

            return {
              srl: index + 1,
              crop: getCropYear(),
              grade_code: matchingGrade?.grade_code || item.quality || '',
              grade_name: rowGradeName,
              agency_code: agencyObj?.agency_code || rowAgency,
              agency_name: rowAgencyName,
              marka_code: markaObj?.marka_code || rowMarka,
              marka_name: markaObj?.marka_name || rowMarka,
              qty: item.qty || 0,
              weight: itemWt || 0,
              rate: finalRate
            };
          });
        }
      } catch (err) {
        console.error("Failed to load sauda quality details:", err);
      }
    }

    const totalLorries = sauda.no_of_lorries ? sauda.no_of_lorries.toString() : '';
    const totalUnits = sauda.total_unit ? sauda.total_unit.toString() : '';
    const totalContractMt = sauda.total_wt_in_ton ? Number(sauda.total_wt_in_ton).toFixed(3) : '';
    const unitsPerLorry = sauda.no_of_lorries && sauda.total_unit ? Math.round(sauda.total_unit / sauda.no_of_lorries).toString() : '';
    const weightPerLorry = sauda.no_of_lorries && sauda.total_wt_in_ton ? (Number(sauda.total_wt_in_ton) / Number(sauda.no_of_lorries)).toFixed(3) : '';
    const weightUnitKgs = isBales ? '147.5' : (sauda.total_unit && sauda.total_wt_in_ton ? ((Number(sauda.total_wt_in_ton) * 1000) / Number(sauda.total_unit)).toFixed(2) : '50');

    const purchaseUnitCode = sauda.purchase_unit_code || '1';

    const penaltyVal = sauda.shipment_penalty ? `${sauda.shipment_penalty}` : '5';
    const descRemarks = sauda.remarks || 'Area, Agency Grade, Grade differential can change as per market.';
    const termsConditionVal = `Penalty Rs ${penaltyVal}/- perday ${descRemarks}`;

    setFormData(prev => ({
      ...prev,
      no: saudaNo,
      contract_po_no: saudaNo,
      broker_code: brokerObj?.brok_code || '',
      broker: brokerObj?.brok_name || sauda.broker || '',
      supplier_code: supplierObj?.supp_code || '',
      supplier: supplierObj?.supp_name || sauda.supplier || '',
      challan_supplier_code: challanSuppObj?.supp_code || '',
      challan_supplier: challanSuppObj?.supp_name || sauda.challan_supplier || '',
      area_code: areaObj?.area_code || '',
      area: areaObj?.area_name || sauda.area || '',
      total_no_of_lorries: totalLorries,
      units_per_lorry: unitsPerLorry,
      total_units: totalUnits,
      weight_per_lorry: weightPerLorry,
      total_contract_mt: totalContractMt,
      purchase_unit_name: sauda.unit_type || 'DRUMS',
      purchase_unit_code: purchaseUnitCode,
      weight_unit_kgs: weightUnitKgs,
      b_rate: selectedBRate,
      date: sauda.date || todayStr,
      s_date: sauda.date || todayStr,
      delivery_from: sauda.date || todayStr,
      delivery_to: sauda.date || todayStr,
      grace_days: sauda.shipment_days ? sauda.shipment_days.toString() : '0',
      delivery_penalty: sauda.shipment_penalty ? sauda.shipment_penalty.toString() : '0',
      remarks: sauda.remarks || '',
      terms_condition: termsConditionVal,
      contract_date: sauda.date || todayStr,
      items: mappedItems.length > 0 ? mappedItems : prev.items
    }));
  };

  const handleAddItem = () => {
    const nextSrl = formData.items.length > 0 ? Math.max(...formData.items.map(item => item.srl || 0)) + 1 : 1;
    const newItem = {
      srl: nextSrl,
      crop: getCropYear(),
      grade_code: '',
      grade_name: '',
      agency_code: '',
      agency_name: '',
      marka_code: '',
      marka_name: '',
      qty: 0,
      weight: 0,
      rate: 0
    };
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setSelectedItemSrl(nextSrl);
  };

  const handleDeleteItem = () => {
    if (!canDeleteData()) {
      alert("Only Admin can delete data.");
      return;
    }
 
    if (selectedItemSrl === null) {
      alert("Please select a row first by clicking on it.");
      return;
    }
    setFormData(prev => {
      const remainingItems = prev.items.filter(item => item.srl !== selectedItemSrl);
      const reindexed = remainingItems.map((item, index) => ({
         ...item,
         srl: index + 1
      }));
      
      const totalQty = reindexed.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
      const totalWt = reindexed.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
      
      return {
         ...prev,
         items: reindexed,
         total_units: totalQty.toString(),
         total_contract_mt: totalWt.toFixed(3)
      };
    });
    setSelectedItemSrl(null);
  };

  const generateNextPtfNo = (list: any[] = poList) => {
    const finYear = '2026-2027';
    let maxNum = 0;
    list.forEach(item => {
      const ptfStr = String(item.ptf_no || item.po_no || '').trim();
      if (!ptfStr) return;
      const m1 = ptfStr.match(/BJCL\/\d{4}-\d{4}\/(\d+)\(PTF\)/i);
      if (m1) {
        const num = parseInt(m1[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
        return;
      }
      const m2 = ptfStr.match(/PTF\/(\d+)\/\d+/i);
      if (m2) {
        const num = parseInt(m2[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
        return;
      }
      const m3 = ptfStr.match(/(\d+)\(PTF\)/i);
      if (m3) {
        const num = parseInt(m3[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
        return;
      }
    });

    const nextNum = maxNum > 0 ? maxNum + 1 : 67;
    return `BJCL/${finYear}/${String(nextNum).padStart(4, '0')}(PTF)`;
  };

  const handleGlobalAdd = () => {
    const defaultSDate = todayStr;
    const defaultBRate = lookupSattaBaseRate(defaultSDate, sattaBaseRates);

    setFormData({
      is_ptf: true,
      purchase_order: 'FINAL PO',
      po_type: 'Normal',
      ptf_no: generateNextPtfNo(poList),
      pending: 'Yes',
      no: '',
      date: todayStr,
      broker_code: '',
      broker: '',
      supplier_code: '',
      supplier: '',
      challan_supplier_code: '',
      challan_supplier: '',
      area_code: '',
      area: '', 
      trans_paid_by: 'PARTY',
      weight_unit_kgs: '147.5',
      against_cancellation: 'No',
      purchase_unit_code: '1',
      purchase_unit_name: 'BALES',
      total_no_of_lorries: '1',
      units_per_lorry: '200',
      total_units: '200',
      weight_per_lorry: '29.500',
      total_contract_mt: '29.500',
      marka_type: 'Normal',
      marka_penalty: '0',
      qty_penalty: '5',
      delivery_from: todayStr,
      delivery_to: todayStr,
      grace_days: '0',
      delivery_penalty: '0',
      contract_po_no: '',
      contract_date: todayStr,
      rate_detail: '',
      delivery_schedule: '',
      terms_condition: 'Penalty Rs 5/- perday',
      remarks: 'Area, Agency Grade, Grade differential can change as per market.',
      po_identification: 'Direct Advance Payment',
      b_rate: defaultBRate,
      s_date: defaultSDate, 
      items: [
        {
          srl: 1,
          crop: getCropYear(),
          grade_code: '',
          grade_name: '',
          agency_code: '',
          agency_name: '',
          marka_code: '',
          marka_name: '',
          qty: 200,
          weight: 29.5,
          rate: 0
        }
      ]
    });
    setSelectedItemSrl(1);
    setViewMode('form');
  };

  const handleLoadSelectedPo = async (poHeader: any) => {
    if (!enforceEditOrDeletePermission("Edit")) return;
    // Lock: L1, L2, L3 users cannot edit a Temporary P.O with a Material Mismatch until resolved.
    // Admin, L4, and L5 users are allowed to open/edit it.
    const userCtx = getCurrentUserContext();
    const currentUserRole = userCtx.userRole || "USER";
    const currentUserLevel = userCtx.userLevel || "L1";
    const isAdminUser = currentUserRole === "ADMIN";
    const isL4L5User = currentUserLevel === "L4" || currentUserLevel === "L5";
    const canBypassLock = isAdminUser || isL4L5User;

    const mrLock = matchResults[poHeader.po_no];
    if (!canBypassLock && isTempPo && mrLock && mrLock.hasInspection && mrLock.status === 'mismatch' && !isPoMismatchResolved(poHeader.po_no)) {
      alert(`P.O ${poHeader.po_no} is LOCKED — it has a Material Mismatch in: ${mrLock.mismatches.map((m: any) => m.field).join(', ')}.\n\nResolve it in the Material Mismatch section before editing.`);
      return;
    }
    const getGradeNameForCompare = (gCode: string) => {
      const match = gradeList.find((g: any) => g.grade_code === gCode);
      return match ? match.grade_name : gCode;
    };

    setLoading(true);
    try {
      const allDetails = await dbModule.fetchAll(DETAIL_TABLE);
      let filteredDetails = allDetails
        .filter((d: any) => d.po_no === poHeader.po_no)
        .sort((a: any, b: any) => compareQualities(getGradeNameForCompare(a.grade_code || ''), getGradeNameForCompare(b.grade_code || '')));
      
      // Fallback: If no details in current table, query sauda_check_point_details or sauda_quality_details
      if ((!filteredDetails || filteredDetails.length === 0) && supabase) {
        const { data: scpDet } = await supabase.from('sauda_check_point_details').select('*').eq('po_no', poHeader.po_no);
        if (scpDet && scpDet.length > 0) {
          filteredDetails = scpDet;
        } else {
          // Extract sauda number if present
          const saudaToken = (poHeader.contract_po_no || poHeader.po_no || '').split('/').pop() || '';
          const { data: saudaRec } = await supabase.from('sauda_master').select('*').or(`session.eq.${poHeader.po_no},sauda_no.eq.${saudaToken}`).maybeSingle();
          if (saudaRec) {
            const { data: qDet } = await supabase.from('sauda_quality_details').select('*').eq('sauda_id', saudaRec.sauda_id);
            if (qDet && qDet.length > 0) {
              filteredDetails = qDet.map((qd: any, i: number) => ({
                po_no: poHeader.po_no,
                srl_no: i + 1,
                crop_year: '2026-27',
                grade_code: qd.quality,
                agency_code: qd.agency,
                marka_code: qd.marka,
                quantity: qd.qty,
                rate_qntl: qd.rs
              }));
            }
          }
        }
      }

      const isBales = (poHeader.purchase_unit_name || 'BALES') === 'BALES';
      const mappedItems = filteredDetails.map((d: any, index: number) => {
        const qtyVal = d.quantity || d.qty || 0;
        const weightVal = isBales 
          ? parseFloat(((qtyVal * 147.5) / 1000).toFixed(3)) 
          : (d.weight_mt || d.weight || 0);
        
        const rawGrade = d.grade_code || d.quality || d.grade || '';
        const rawAgency = d.agency_code || d.agency || '';
        const rawMarka = d.marka_code || d.marka || '';

        const gradeObj = gradeList.find(g => g.grade_code === rawGrade || g.grade_name?.trim().toUpperCase() === rawGrade?.trim().toUpperCase());
        const agencyObj = agencyList.find(a => a.agency_code === rawAgency || a.agency_name?.trim().toUpperCase() === rawAgency?.trim().toUpperCase());
        const markaObj = markaList.find(m => m.marka_code === rawMarka || m.marka_name?.trim().toUpperCase() === rawMarka?.trim().toUpperCase());

        return {
          srl: index + 1,
          crop: d.crop_year || d.crop || '2025-26',
          grade_code: gradeObj?.grade_code || rawGrade,
          grade_name: gradeObj?.grade_name || rawGrade || '',
          agency_code: agencyObj?.agency_code || rawAgency,
          agency_name: agencyObj?.agency_name || rawAgency || '',
          marka_code: markaObj?.marka_code || rawMarka,
          marka_name: markaObj?.marka_name || rawMarka || '',
          qty: qtyVal,
          weight: weightVal,
          rate: d.rate_qntl || d.rate || d.rs || 0
        };
      });

      const sumQty = mappedItems.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
      const sumWt = mappedItems.reduce((s, it) => s + (parseFloat(it.weight) || 0), 0);
      
      const totalUnits = (poHeader.total_units !== undefined && poHeader.total_units !== null && Number(poHeader.total_units) > 0)
        ? String(poHeader.total_units)
        : (isBales && sumQty > 0 ? sumQty.toString() : String(poHeader.total_units || ''));

      const totalContractMt = (poHeader.total_contract_mt !== undefined && poHeader.total_contract_mt !== null && Number(poHeader.total_contract_mt) > 0)
        ? Number(poHeader.total_contract_mt).toFixed(3)
        : (isBales && sumWt > 0 ? sumWt.toFixed(3) : String(poHeader.total_contract_mt || ''));

      setFormData({
        is_ptf: !!poHeader.ptf_no,
        purchase_order: poHeader.purchase_order || 'FINAL PO',
        po_type: poHeader.po_type || 'Normal',
        ptf_no: poHeader.ptf_no || '',
        pending: poHeader.pending ? 'Yes' : 'No',
        no: poHeader.po_no || '',
        date: poHeader.po_date || todayStr,
        broker_code: brokerList.find(b => b.brok_name === poHeader.broker || b.brok_code === poHeader.broker)?.brok_code || '',
        broker: poHeader.broker || '',
        supplier_code: supplierList.find(s => s.supp_name === poHeader.supplier || s.supp_code === poHeader.supplier)?.supp_code || '',
        supplier: poHeader.supplier || '',
        challan_supplier_code: supplierList.find(s => s.supp_name === poHeader.challan_supplier || s.supp_code === poHeader.challan_supplier)?.supp_code || '',
        challan_supplier: poHeader.challan_supplier || '',
        area_code: areaList.find(a => a.area_name === poHeader.area || a.area_code === poHeader.area)?.area_code || '',
        area: poHeader.area || '',
        trans_paid_by: poHeader.trans_paid_by || 'PARTY',
        weight_unit_kgs: String(poHeader.weight_unit_kgs || (isBales ? '147.5' : '50')),
        against_cancellation: poHeader.against_cancellation || 'No',
        purchase_unit_code: poHeader.purchase_unit_code || '',
        purchase_unit_name: poHeader.purchase_unit_name || 'BALES',
        total_no_of_lorries: String(poHeader.total_lorries || ''),
        units_per_lorry: String(poHeader.units_per_lorry || ''),
        total_units: totalUnits,
        weight_per_lorry: poHeader.weight_per_lorry !== undefined && poHeader.weight_per_lorry !== null && !isNaN(Number(poHeader.weight_per_lorry)) && Number(poHeader.weight_per_lorry) > 0
          ? Number(poHeader.weight_per_lorry).toFixed(3)
          : String(poHeader.weight_per_lorry || ''),
        total_contract_mt: totalContractMt,
        marka_type: poHeader.marka_type || 'Normal',
        marka_penalty: String(poHeader.marka_penalty || '0'),
        qty_penalty: String(poHeader.qty_penalty || '5'),
        delivery_from: poHeader.delivery_from || todayStr,
        delivery_to: poHeader.delivery_to || todayStr,
        grace_days: String(poHeader.grace_days || '0'),
        delivery_penalty: String(poHeader.delivery_penalty || '0'),
        contract_po_no: poHeader.contract_po_no || '',
        contract_date: poHeader.contract_date || todayStr,
        rate_detail: poHeader.rate_detail || '',
        delivery_schedule: poHeader.delivery_schedule || '',
        terms_condition: poHeader.terms_condition || '',
        remarks: poHeader.remarks || '',
        po_identification: poHeader.po_identification || 'Direct Advance Payment',
        b_rate: (poHeader.b_rate && Number(poHeader.b_rate) > 0) ? String(poHeader.b_rate) : lookupSattaBaseRate(poHeader.s_date || todayStr, sattaBaseRates),
        s_date: poHeader.s_date || todayStr,
        items: mappedItems
      });
      
      setViewMode('form');
    } catch (err: any) {
      console.error("Failed to load PO details: ", err);
      alert("Load failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePo = async (poNo: string) => {
    if (!enforceEditOrDeletePermission("Delete")) {
      return;
    }

    const conf = window.confirm(`Are you sure you want to completely delete Purchase Order: ${poNo}?`);
    if (!conf) return;

    setLoading(true);
    try {
      if (supabase) {
        await supabase.from('purchase_detail_master').delete().eq('po_no', poNo);
        await supabase.from('sauda_check_point_details').delete().eq('po_no', poNo);
        await supabase.from('sauda_check_point').delete().eq('po_no', poNo);
      }
      await dbModule.delete(MASTER_TABLE, 'po_no', poNo);
      // Extra cleanup just in case it's in purchase_master when temp or vice versa
      await dbModule.delete('purchase_master', 'po_no', poNo).catch(() => {});
      await dbModule.delete('p.o_archive', 'po_no', poNo).catch(() => {});

      alert(`Purchase Order ${poNo} deleted permanently.`);
      await fetchPosAndMasters();
    } catch (err: any) {
      console.error("Failed to delete PO: ", err);
      alert("Delete failed: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };
  const handleGlobalAmend = () => {
    const activePoNo = formData.is_ptf ? formData.ptf_no : formData.no;
    if (!activePoNo) {
      alert("No active PO loaded to amend.");
      return;
    }
    const amendedNo = activePoNo.endsWith('-A') ? activePoNo : `${activePoNo}-A`;
    setFormData(prev => ({
      ...prev,
      no: prev.is_ptf ? prev.no : amendedNo,
      ptf_no: prev.is_ptf ? amendedNo : prev.ptf_no,
      po_type: 'Special',
      remarks: prev.remarks ? `${prev.remarks} (Amended)` : 'Amended Contract Details.'
    }));
    alert(`Amending Contract! The PO number is updated to ${amendedNo} in Special/Amend mode.`);
  };

  const handleCalculateOk = () => {
    const lorries = parseFloat(calcData.total_lorries) || 0;
    const unitsPerLorry = parseFloat(calcData.units_per_lorry) || 0;
    const totalUnits = parseFloat(calcData.total_units) || (lorries * unitsPerLorry);
    const trueWtPerLorry = parseFloat(calcData.weight_per_lorry) || 0;
    const totalContractMt = lorries * trueWtPerLorry;
    const isBales = formData.purchase_unit_name === 'BALES';
    const weightUnitKgs = isBales ? '147.5' : (unitsPerLorry > 0 ? ((trueWtPerLorry * 1000) / unitsPerLorry).toFixed(2) : '50');
    const unitWtVal = parseFloat(weightUnitKgs);
    
    let updatedItems = recalculateItemWeights(formData.items, unitWtVal);
    
    if (updatedItems.length === 1) {
      updatedItems[0].qty = totalUnits;
      updatedItems[0].weight = parseFloat(((totalUnits * unitWtVal) / 1000).toFixed(3));
    }

    const wtPerLorryFormatted = trueWtPerLorry > 0 
      ? trueWtPerLorry.toFixed(3) 
      : (calcData.weight_per_lorry && !isNaN(Number(calcData.weight_per_lorry)) 
          ? Number(calcData.weight_per_lorry).toFixed(3) 
          : calcData.weight_per_lorry);

    setFormData(prev => ({
      ...prev,
      total_no_of_lorries: calcData.total_lorries,
      units_per_lorry: calcData.units_per_lorry,
      total_units: calcData.total_units.toString(),
      weight_per_lorry: wtPerLorryFormatted,
      total_contract_mt: totalContractMt.toFixed(3),
      weight_unit_kgs: weightUnitKgs.toString(),
      items: updatedItems
    }));
    setIsCalcOpen(false);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let finalPoNo = formData.is_ptf ? formData.ptf_no : formData.no;
      if (!finalPoNo) {
        finalPoNo = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      // Safe matching helper
      const matchPoNo = (po1: string, po2: string) => {
        if (!po1 || !po2) return false;
        const p1 = po1.trim().toLowerCase();
        const p2 = po2.trim().toLowerCase();
        if (p1 === p2) return true;
        
        const clean1 = p1.replace(/[^a-z0-9]/g, '');
        const clean2 = p2.replace(/[^a-z0-9]/g, '');
        if (clean1 && clean1 === clean2) return true;

        if (clean1.length > 5 && clean2.length > 5 && (clean1.includes(clean2) || clean2.includes(clean1))) {
          return true;
        }

        const num1 = p1.replace(/[^0-9]/g, '');
        const num2 = p2.replace(/[^0-9]/g, '');
        if (num1.length >= 4 && num2.length >= 4 && (num1.includes(num2) || num2.includes(num1))) {
          return true;
        }
        return false;
      };

      // Received = only Final M.R (final_arrival). No temp/dummy data.
      const allFinalArrivals = await dbModule.fetchAll('final_arrival').catch(() => []);
      const exactPoNo = (a: any, b: any) => {
        const x = String(a || '').trim().toUpperCase();
        const y = String(b || '').trim().toUpperCase();
        return x !== '' && x === y;
      };
      const matchingFinal = allFinalArrivals.filter((ar: any) => exactPoNo(finalPoNo, ar.po_no));
      const weightOf = (ar: any) => Number(ar.weight_qtl || ar.weight || ar.electronic_net_weight || 0) / 10;
      const totalReceivedMt = matchingFinal.reduce((sum: number, ar: any) => sum + weightOf(ar), 0);

      const contractWeight = parseFloat(formData.total_contract_mt) || 0;
      const unit = formData.purchase_unit_name || (formData as any).unit_type || formData.po_type || 'BALES';
      const tol = calculateWeightTolerance(contractWeight, totalReceivedMt, unit);
      const isWeightCompleted = tol.isCompleted;
      const isPendingVal = isWeightCompleted ? false : (formData.pending === 'Yes');
      
      const payload = {
        financial_year: '2026-2027',
        purchase_order: formData.purchase_order,
        po_type: formData.po_type,
        status: isTempPo ? 'temp' : 'final',
        ptf_no: formData.is_ptf ? formData.ptf_no : null,
        pending: isPendingVal,
        po_no: finalPoNo,
        po_date: formData.date || todayStr,
        broker: (formData.broker || '').toUpperCase(),
        supplier: (formData.supplier || '').toUpperCase(),
        challan_supplier: (formData.challan_supplier || '').toUpperCase(),
        area: (formData.area || '').toUpperCase(),
        trans_paid_by: formData.trans_paid_by,
        weight_unit_kgs: parseFloat(formData.weight_unit_kgs) || 50,
        against_cancellation: formData.against_cancellation,
        purchase_unit_code: formData.purchase_unit_code,
        purchase_unit_name: formData.purchase_unit_name,
        total_lorries: parseFloat(formData.total_no_of_lorries) || 0,
        units_per_lorry: parseFloat(formData.units_per_lorry) || 0,
        total_units: parseFloat(formData.total_units) || 0,
        weight_per_lorry: parseFloat(formData.weight_per_lorry) || 0,
        total_contract_mt: parseFloat(formData.total_contract_mt) || 0,
        marka_type: formData.marka_type,
        marka_penalty: parseFloat(formData.marka_penalty) || 0,
        qty_penalty: parseFloat(formData.qty_penalty) || 0,
        delivery_from: formData.delivery_from || null,
        delivery_to: formData.delivery_to || null,
        grace_days: parseInt(formData.grace_days) || 0,
        delivery_penalty: parseFloat(formData.delivery_penalty) || 0,
        contract_po_no: formData.contract_po_no,
        contract_date: formData.contract_date || null,
        rate_detail: formData.rate_detail,
        delivery_schedule: formData.delivery_schedule,
        terms_condition: formData.terms_condition,
        remarks: formData.remarks,
        po_identification: formData.po_identification,
        b_rate: parseFloat(formData.b_rate) || 0,
        s_date: formData.s_date || null
      };

      // Check if this record already exists in purchase_master
      const allMasters = await dbModule.fetchAll(MASTER_TABLE);
      const alreadyExists = allMasters.some((p: any) => p.po_no === finalPoNo);
      
      // Clear old detail rows first to satisfy foreign key integrity checks
      await dbModule.delete(DETAIL_TABLE, 'po_no', finalPoNo);

      if (alreadyExists) {
        await dbModule.delete(MASTER_TABLE, 'po_no', finalPoNo);
      }
      
      await dbModule.insert(MASTER_TABLE, payload);
      
      if (formData.items && formData.items.length > 0) {
         const sortedItems = [...formData.items].sort((a: any, b: any) => compareQualities(a.grade_name || a.grade_code || '', b.grade_name || b.grade_code || ''));
         for (let i = 0; i < sortedItems.length; i++) {
             const item = sortedItems[i];
             if (item.grade_code || item.marka_code || item.grade_name || item.qty) {
                 await dbModule.insert(DETAIL_TABLE, {
                     po_no: finalPoNo,
                     srl_no: i + 1,
                     crop_year: item.crop || '2025-26',
                     grade_code: item.grade_code || '',
                     agency_code: item.agency_code || '',
                     marka_code: item.marka_code || '',
                     quantity: parseFloat(item.qty) || 0,
                     weight_mt: parseFloat(item.weight) || 0,
                     rate_qntl: parseFloat(item.rate) || 0
                 });
             }
         }
      }
      
      alert(`Purchase Order ${finalPoNo} saved successfully!`);
      setViewMode('register');
      fetchPosAndMasters();
    } catch (err: any) {
      console.error(err);
      alert("PO Save failed: " + (err.message || "Database error."));
    } finally {
      setLoading(false);
    }
  };

  // "Pass" = every field of the linked Material Inspection matches this P.O, so it
  // is promoted to the Final P.O stage (status 'final'). Mismatches stay in Temp and
  // surface in the Mismatch section until cleared.
  const handlePassToFinal = async (item: any) => {
    const ok = await askConfirm(
      `Move ${item.po_no} from Sauda Check Point to Final P.O?`,
      { title: 'Pass → Final P.O', confirmLabel: 'Pass' }
    );
    if (!ok) return;
    try {
      setLoading(true);
      const cleanPoNo = String(item.po_no || item.contract_po_no || '').trim().toUpperCase();
      const poSuffix = cleanPoNo.split('/').pop() || '';
      const saudaNo = String(item.sauda_no || item.po_contract || item.contract_no || '').trim().toUpperCase();
      const saudaSuffix = saudaNo.split('/').pop() || '';
      const allTokens = [cleanPoNo, poSuffix, saudaNo, saudaSuffix].filter(Boolean);

      const VALID_PURCHASE_MASTER_COLS = [
        'financial_year', 'purchase_order', 'po_type', 'ptf_no', 'pending', 'po_no', 'po_date',
        'broker', 'supplier', 'challan_supplier', 'area', 'trans_paid_by', 'weight_unit_kgs',
        'against_cancellation', 'purchase_unit_code', 'purchase_unit_name', 'total_lorries',
        'units_per_lorry', 'total_units', 'weight_per_lorry', 'total_contract_mt', 'marka_type',
        'marka_penalty', 'qty_penalty', 'delivery_from', 'delivery_to', 'grace_days', 'delivery_penalty',
        'contract_po_no', 'contract_date', 'rate_detail', 'delivery_schedule', 'terms_condition',
        'remarks', 'po_identification', 'b_rate', 's_date', 'status'
      ];

      if (supabase) {
        // Fetch full header from sauda_check_point or sauda_master
        const { data: scpHeader } = await supabase.from('sauda_check_point').select('*').eq('po_no', item.po_no).maybeSingle();
        let saudaHeader: any = null;
        if (!scpHeader && saudaNo) {
          const { data: sData } = await supabase.from('sauda_master').select('*').or(`sauda_no.eq.${saudaNo},session.eq.${item.po_no}`).maybeSingle();
          saudaHeader = sData;
        }

        const source = scpHeader || saudaHeader || item;
        
        // Fetch details from sauda_check_point_details or sauda_quality_details
        let { data: scpDetails } = await supabase.from('sauda_check_point_details').select('*').eq('po_no', item.po_no);
        if ((!scpDetails || scpDetails.length === 0) && (saudaNo || item.po_no)) {
          const { data: sqDetails } = await supabase.from('sauda_quality_details').select('*').or(`sauda_no.eq.${saudaNo || ''},sauda_id.eq.${source?.sauda_id || ''}`);
          if (sqDetails && sqDetails.length > 0) {
            scpDetails = sqDetails;
          }
        }
        
        const rawPayload: Record<string, any> = {
          financial_year: source?.financial_year || item?.financial_year || '2026-2027',
          purchase_order: 'FINAL PO',
          po_type: source?.po_type || item?.po_type || 'Normal',
          ptf_no: source?.ptf_no || item?.ptf_no || null,
          pending: true,
          po_no: item.po_no || source?.po_no || source?.session,
          po_date: source?.date || source?.po_date || item.po_date || item.date || new Date().toISOString().split('T')[0],
          broker: source?.broker || item.broker || '',
          supplier: source?.supplier || item.supplier || '',
          challan_supplier: source?.challan_supplier || item.challan_supplier || source?.supplier || item.supplier || '',
          area: source?.area || item.area || '',
          trans_paid_by: source?.trans_paid_by || item.trans_paid_by || null,
          weight_unit_kgs: source?.weight_unit_kgs || item.weight_unit_kgs || null,
          against_cancellation: source?.against_cancellation || item.against_cancellation || 'No',
          purchase_unit_code: source?.purchase_unit_code || item.purchase_unit_code || null,
          purchase_unit_name: source?.purchase_unit_name || source?.unit_type || item.purchase_unit_name || item.unit_type || 'BALES',
          total_lorries: source?.total_lorries || source?.no_of_lorries || item.total_lorries || item.no_of_lorries || 1,
          units_per_lorry: source?.units_per_lorry || item.units_per_lorry || null,
          total_units: source?.total_units || source?.total_unit || item.total_units || item.total_unit || 0,
          weight_per_lorry: source?.weight_per_lorry || source?.wt_per_lorry || item.weight_per_lorry || null,
          total_contract_mt: source?.total_contract_mt || source?.total_wt_in_ton || item.total_contract_mt || item.total_wt_in_ton || 0,
          marka_type: source?.marka_type || item.marka_type || null,
          marka_penalty: source?.marka_penalty || item.marka_penalty || 0,
          qty_penalty: source?.qty_penalty || item.qty_penalty || 5,
          delivery_from: source?.delivery_from || source?.shipment_date || item.delivery_from || item.shipment_date || null,
          delivery_to: source?.delivery_to || source?.shipment_date || item.delivery_to || item.shipment_date || null,
          grace_days: source?.grace_days || source?.shipment_days || item.grace_days || 0,
          delivery_penalty: source?.delivery_penalty || source?.shipment_penalty || item.delivery_penalty || 0,
          contract_po_no: source?.contract_po_no || item.contract_po_no || '',
          contract_date: source?.contract_date || source?.date || item.contract_date || null,
          rate_detail: source?.rate_detail || item.rate_detail || '',
          delivery_schedule: source?.delivery_schedule || item.delivery_schedule || '',
          terms_condition: source?.terms_condition || item.terms_condition || 'Standard penalty Rs.5/day. Standard terms apply.',
          remarks: source?.remarks || item.remarks || '',
          po_identification: source?.po_identification || item.po_identification || 'Direct Advance Payment',
          b_rate: source?.b_rate || item.b_rate || 0,
          s_date: source?.s_date || source?.b_date || item.s_date || null,
          status: 'final'
        };

        // Whitelist only valid columns of purchase_master to avoid Supabase 400 Bad Request
        const poPayload: Record<string, any> = {};
        for (const col of VALID_PURCHASE_MASTER_COLS) {
          if (rawPayload[col] !== undefined) {
            poPayload[col] = rawPayload[col];
          }
        }
        
        // Insert into purchase_master
        const upsertRes = await supabase.from('purchase_master').upsert(poPayload, { onConflict: 'po_no' });
        if (upsertRes.error) {
          throw new Error(upsertRes.error.message);
        }
        
        // Insert details into purchase_detail_master
        if (scpDetails && scpDetails.length > 0) {
          const isBales = (rawPayload.purchase_unit_name || 'BALES') === 'BALES';
          const detailRows = scpDetails.map((d: any, idx: number) => {
            const rawGrade = d.grade_code || d.quality || d.grade || '';
            const rawAgency = d.agency_code || d.agency || '';
            const rawMarka = d.marka_code || d.marka || '';

            const gMatch = gradeList.find(g => g.grade_code === rawGrade || g.grade_name?.trim().toUpperCase() === rawGrade?.trim().toUpperCase());
            const aMatch = agencyList.find(a => a.agency_code === rawAgency || a.agency_name?.trim().toUpperCase() === rawAgency?.trim().toUpperCase());
            const mMatch = markaList.find(m => m.marka_code === rawMarka || m.marka_name?.trim().toUpperCase() === rawMarka?.trim().toUpperCase());

            const qty = Number(d.quantity || d.qty || 0);
            const wt = d.weight_mt || d.weight || (isBales ? parseFloat(((qty * 147.5) / 1000).toFixed(3)) : 0);
            const rate = Number(d.rate_qntl || d.rate || d.rs || 0);

            return {
              po_no: item.po_no,
              srl_no: d.srl_no || (idx + 1),
              crop_year: d.crop_year || d.crop || '2026-27',
              grade_code: gMatch ? gMatch.grade_code : (rawGrade || ''),
              agency_code: aMatch ? aMatch.agency_code : (rawAgency || ''),
              marka_code: mMatch ? mMatch.marka_code : (rawMarka || ''),
              quantity: qty,
              weight_mt: Number(wt),
              rate_qntl: rate
            };
          });
          await supabase.from('purchase_detail_master').delete().eq('po_no', item.po_no);
          await supabase.from('purchase_detail_master').insert(detailRows);
        }
        
        // Remove from sauda_check_point and details
        await supabase.from('sauda_check_point_details').delete().eq('po_no', item.po_no);
        await supabase.from('sauda_check_point').delete().eq('po_no', item.po_no);

        // Also update matching records in material_mismatch & satta_mismatch
        try {
          await supabase.from('material_mismatch').update({ status: 'resolved', approved_by: 'Admin L5', remarks: 'Passed to Final P.O' }).eq('po_no', item.po_no);
          await supabase.from('satta_mismatch').update({ status: 'resolved', approved_by: 'Admin L5', remarks: 'Passed to Final P.O' }).eq('po_no', item.po_no);
          if (saudaNo) {
            await supabase.from('satta_mismatch').update({ status: 'resolved', approved_by: 'Admin L5', remarks: 'Passed to Final P.O' }).eq('sauda_no', saudaNo);
            await supabase.from('sauda_master').update({ mismatch_cleared: true, satta_dispute_approved: true }).eq('sauda_no', saudaNo);
            await supabase.from('sms_sauda').update({ mismatch_cleared: true, satta_dispute_approved: true }).eq('sauda_no', saudaNo);
          }
        } catch (_ignore) {}
      } else {
        await dbModule.insert('purchase_master', {
          ...item,
          status: 'final',
          pending: true,
          mismatch_cleared: true,
          satta_dispute_approved: true
        }).catch(() => {});
        await dbModule.delete('sauda_check_point', 'po_no', item.po_no).catch(() => {
          return dbModule.update('sauda_check_point', 'po_no', item.po_no, { status: 'final', mismatch_cleared: true });
        });
      }

      // Mark resolution tokens in localStorage
      allTokens.forEach(t => {
        try {
          localStorage.setItem(`material_resolved_${t.toUpperCase()}`, 'true');
          localStorage.setItem(`satta_resolved_${t.toUpperCase()}`, 'true');
          localStorage.setItem(`material_resolved_MIS-${t.toUpperCase()}`, 'true');
        } catch (_e) {}
      });

      window.dispatchEvent(new CustomEvent('app-data-updated'));
      window.dispatchEvent(new CustomEvent('mismatch_resolved', { detail: { poNo: item.po_no } }));

      alert(`PO #${item.po_no} successfully passed to Final P.O!`);
      await fetchPosAndMasters();
    } catch (e: any) {
      alert('Failed to move to Final P.O: ' + (e.message || 'Database error.'));
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPo = async (poHeader: any) => {
    const getGradeNameForCompare = (gCode: string) => {
      const match = gradeList.find((g: any) => g.grade_code === gCode);
      return match ? match.grade_name : gCode;
    };

    setLoading(true);
    try {
      // Find full items
      const details = await dbModule.fetchAll(DETAIL_TABLE);
      const filtered = details
        .filter((d: any) => d.po_no === poHeader.po_no)
        .sort((a: any, b: any) => compareQualities(getGradeNameForCompare(a.grade_code || ''), getGradeNameForCompare(b.grade_code || '')));
      
      const isBales = (poHeader.purchase_unit_name || 'BALES') === 'BALES';
      const mappedItems = filtered.map((d: any, idx: number) => {
        const qtyVal = d.quantity || 0;
        const weightVal = isBales 
          ? parseFloat(((qtyVal * 147.5) / 1000).toFixed(3)) 
          : (d.weight_mt || 0);
        return {
          srl: idx + 1,
          crop: d.crop_year || '2025-26',
          grade_code: d.grade_code || '',
          grade_name: gradeList.find(g => g.grade_code === d.grade_code)?.grade_name || d.grade_code || 'STANDARD GRADE',
          agency_code: d.agency_code || '',
          agency_name: agencyList.find(a => a.agency_code === d.agency_code)?.agency_name || d.agency_code || 'MAIN AGENCY',
          marka_code: d.marka_code || '',
          marka_name: markaList.find(m => m.marka_code === d.marka_code)?.marka_name || d.marka_code || 'NORMAL GRADE',
          qty: qtyVal,
          weight: weightVal,
          rate: d.rate_qntl || 0
        };
      });

      const sumQty = mappedItems.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
      const sumWt = mappedItems.reduce((s, it) => s + (parseFloat(it.weight) || 0), 0);

      const fullPo = {
        no: poHeader.po_no || '',
        ptf_no: poHeader.ptf_no || '',
        is_ptf: !!poHeader.ptf_no,
        date: poHeader.po_date || poHeader.created_at || todayStr,
        broker: poHeader.broker || 'N/A',
        supplier: poHeader.supplier || 'N/A',
        challan_supplier: poHeader.challan_supplier || 'N/A',
        area: poHeader.area || 'N/A',
        trans_paid_by: poHeader.trans_paid_by || 'PARTY',
        weight_unit_kgs: String(poHeader.weight_unit_kgs || (isBales ? '147.5' : '50')),
        against_cancellation: poHeader.against_cancellation || 'No',
        purchase_unit_name: poHeader.purchase_unit_name || 'BALES',
        total_no_of_lorries: String(poHeader.total_lorries || '0'),
        units_per_lorry: String(poHeader.units_per_lorry || '0'),
        total_units: (poHeader.total_units !== undefined && poHeader.total_units !== null && Number(poHeader.total_units) > 0)
          ? String(poHeader.total_units)
          : (isBales && sumQty > 0 ? sumQty.toString() : String(poHeader.total_units || '0')),
        weight_per_lorry: poHeader.weight_per_lorry !== undefined && poHeader.weight_per_lorry !== null && !isNaN(Number(poHeader.weight_per_lorry)) && Number(poHeader.weight_per_lorry) > 0
          ? Number(poHeader.weight_per_lorry).toFixed(3)
          : String(poHeader.weight_per_lorry || '0.000'),
        total_contract_mt: (poHeader.total_contract_mt !== undefined && poHeader.total_contract_mt !== null && Number(poHeader.total_contract_mt) > 0)
          ? Number(poHeader.total_contract_mt).toFixed(3)
          : (isBales && sumWt > 0 ? sumWt.toFixed(3) : String(poHeader.total_contract_mt || '0')),
        marka_type: poHeader.marka_type || 'Normal',
        marka_penalty: String(poHeader.marka_penalty || '0'),
        qty_penalty: String(poHeader.qty_penalty || '5'),
        delivery_from: poHeader.delivery_from || todayStr,
        delivery_to: poHeader.delivery_to || todayStr,
        grace_days: String(poHeader.grace_days || '0'),
        delivery_penalty: String(poHeader.delivery_penalty || '0'),
        contract_po_no: poHeader.contract_po_no || '',
        contract_date: poHeader.contract_date || todayStr,
        rate_detail: poHeader.rate_detail || '',
        delivery_schedule: poHeader.delivery_schedule || '',
        terms_condition: poHeader.terms_condition || 'Penalty Rs.5/day. Standard terms apply.',
        remarks: poHeader.remarks || 'Grade rates based on BJCL indices.',
        po_identification: poHeader.po_identification || 'Direct Advance Payment',
        b_rate: String(poHeader.b_rate || '0'),
        s_date: poHeader.s_date || todayStr,
        items: mappedItems
      };

      setPrintingPo(fullPo);
    } catch(err: any) {
      alert("Failed to compile print receipt: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const numberToWords = (num: number): string => {
    const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    if (num === 0) return 'ZERO';
    if (num < 20) return ones[num];
    const tenPart = tens[Math.floor(num / 10)];
    const onePart = ones[num % 10];
    return `${tenPart}${onePart ? ' ' + onePart : ''}`;
  };

  const generatePoPdf = (po: any): jsPDF => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Title & Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(42, 48, 136); // Deep blue
    doc.text("Bally Jute Company Limited", 105, 15, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(85, 85, 85);
    doc.text("REGISTERED OFFICE: 5, SREE CHARAN SARANI, BALLY, HOWRAH - 711201", 105, 20, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(220, 38, 38); // Red accent for PO Header
    doc.text("RAW JUTE PURCHASE ORDER", 105, 26, { align: 'center' });

    // Draw divider line
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);
    doc.line(15, 29, 195, 29);

    // Metadata Block
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    
    const poDisplayNo = po.is_ptf ? po.ptf_no : po.no || 'BJCL-MANUAL';
    
    // Format Date Helper
    const formatDateStr = (dateStr: string) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      } catch {
        return dateStr;
      }
    };

    doc.text("ORDER NO:", 15, 36);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${poDisplayNo}`, 40, 36);

    doc.setFont('helvetica', 'bold');
    doc.text("DATE:", 120, 36);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${formatDateStr(po.date)}`, 145, 36);

    doc.setFont('helvetica', 'bold');
    doc.text("PO IDENTIFICATION:", 15, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${po.po_identification || 'DR/4-2'}`, 55, 42);

    doc.setFont('helvetica', 'bold');
    doc.text("JC REG NO:", 120, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(`  WBK00S202201929`, 145, 42);

    // Parties Box
    doc.rect(15, 48, 180, 24);
    
    doc.setFont('helvetica', 'bold');
    doc.text("BROKER:", 18, 54);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${(po.broker || 'N/A').toUpperCase()}`, 55, 54);

    doc.setFont('helvetica', 'bold');
    doc.text("SUPPLIER:", 18, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${(po.supplier || 'N/A').toUpperCase()}`, 55, 60);

    doc.setFont('helvetica', 'bold');
    doc.text("CHALLAN SUPPLIER:", 18, 66);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${(po.challan_supplier || po.supplier || 'N/A').toUpperCase()}`, 55, 66);

    // Items Table Header
    doc.setFillColor(240, 240, 240);
    doc.rect(15, 78, 180, 8, 'F');
    doc.rect(15, 78, 180, 8);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text("Lorries", 17, 83);
    doc.text("Crop Year", 32, 83);
    doc.text("Agency", 52, 83);
    doc.text("Marka", 87, 83);
    doc.text("Quality / Grade", 122, 83);
    doc.text("Qty", 162, 83, { align: 'right' });
    doc.text("Rate / m.T", 192, 83, { align: 'right' });

    // Items Table Rows
    let currentY = 86;
    const items = po.items || [];
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // pad items to at least 5 rows
    const padded = [...items];
    while (padded.length < 5) {
      padded.push({
        crop: '',
        agency_name: '',
        marka_name: '',
        grade_name: '',
        qty: '',
        rate: ''
      });
    }

    padded.forEach((item: any, idx: number) => {
      const isFirst = idx === 0;
      doc.rect(15, currentY, 180, 7);
      
      doc.setFont('helvetica', isFirst ? 'bold' : 'normal');
      if (isFirst) {
        doc.text(`${po.total_no_of_lorries || '1'}`, 17, currentY + 5);
        doc.text(`${item.crop || '2025-26'}`, 32, currentY + 5);
        doc.text(`${(item.agency_name || po.area || '').toUpperCase()}`, 52, currentY + 5);
        doc.text(`${(item.marka_name || 'NO MARK').toUpperCase()}`, 87, currentY + 5);
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text(`${(item.grade_name || '').toUpperCase()}`, 122, currentY + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`${item.qty ? Number(item.qty).toLocaleString() : ''}`, 162, currentY + 5, { align: 'right' });
      
      doc.setFont('helvetica', 'bold');
      const displayRate = item.rate ? (Number(item.rate) * 10).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '';
      doc.text(displayRate ? `Rs ${displayRate}` : '', 192, currentY + 5, { align: 'right' });
      
      currentY += 7;
    });

    // Unit Summary Block
    currentY += 3;
    doc.rect(15, currentY, 180, 18);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text("UNIT PARAMETERS", 18, currentY + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Unit: ${po.purchase_unit_name || 'BALES'}`, 18, currentY + 10);
    doc.text(`${po.purchase_unit_name || 'BALES'} / Lorry: ${po.units_per_lorry || '0'}`, 60, currentY + 10);
    doc.text(`Total ${po.purchase_unit_name || 'BALES'}: ${po.total_units || '0'}`, 110, currentY + 10);
    doc.text(`Weight/Lorry: ${Number(po.weight_per_lorry || '10.000').toFixed(3)} m.T`, 155, currentY + 10);

    doc.text(`Area: ${po.area || 'N/A'}`, 18, currentY + 15);
    doc.text(`Total Lorries: ${po.total_no_of_lorries || '1'} (${numberToWords(Number(po.total_no_of_lorries) || 1)})`, 60, currentY + 15);
    doc.text(`Total Contract Wt: ${Number(po.total_contract_mt || '0').toFixed(3)} m.T`, 155, currentY + 15);

    // Delivery & Penalties Block
    currentY += 21;
    doc.rect(15, currentY, 180, 18);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text("DELIVERY & PENALTY RULES", 18, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Delivery: ${formatDateStr(po.delivery_from)} To ${formatDateStr(po.delivery_to)}`, 18, currentY + 10);
    doc.text(`Grace Days: ${po.grace_days || '0'}`, 100, currentY + 10);
    doc.text(`Delivery Penalty: Rs ${po.delivery_penalty || '5'}/day`, 145, currentY + 10);

    doc.text(`P.O Marka Type: ${po.marka_type || 'Normal'}`, 18, currentY + 15);
    doc.text(`Marka Penalty: Rs ${po.marka_penalty || '0'}/qntl`, 100, currentY + 15);
    doc.text(`Qty Penalty: Rs ${po.qty_penalty || '0'}/qntl`, 145, currentY + 15);

    // Terms and conditions
    currentY += 21;
    doc.rect(15, currentY, 180, 24);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text("TERMS & CONDITIONS:", 18, currentY + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const termsText = po.terms_condition || 'Penalty Rs.5/day. Standard terms apply.';
    const splitTerms = doc.splitTextToSize(termsText.toUpperCase(), 174);
    doc.text(splitTerms, 18, currentY + 10);

    if (po.remarks) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.text(`Remarks: ${po.remarks}`, 18, currentY + 21);
    }

    // Signature Block
    currentY += 27;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text("For BALLY JUTE COMPANY LIMITED", 15, currentY + 5);
    doc.text("RECEIVED & ACCEPTED", 145, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text("__________________________________", 15, currentY + 16);
    doc.text("__________________________________", 145, currentY + 16);
    doc.text("Authorized Signatory (Raw Jute Dept.)", 15, currentY + 21);
    doc.text("Signature of Supplier / Broker", 145, currentY + 21);

    return doc;
  };

  const downloadPoPdfFile = (po: any) => {
    try {
      const doc = generatePoPdf(po);
      const filename = `Purchase_Order_${po.ptf_no || po.no || 'Draft'}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("Could not generate PDF download file.");
    }
  };

  const handleDownloadPoPdf = async (poHeader: any) => {
    const getGradeNameForCompare = (gCode: string) => {
      const match = gradeList.find((g: any) => g.grade_code === gCode);
      return match ? match.grade_name : gCode;
    };

    setLoading(true);
    try {
      // Find full items
      const details = await dbModule.fetchAll(DETAIL_TABLE);
      const filtered = details
        .filter((d: any) => d.po_no === poHeader.po_no)
        .sort((a: any, b: any) => compareQualities(getGradeNameForCompare(a.grade_code || ''), getGradeNameForCompare(b.grade_code || '')));
      
      const isBales = (poHeader.purchase_unit_name || 'BALES') === 'BALES';
      const mappedItems = filtered.map((d: any, idx: number) => {
        const qtyVal = d.quantity || 0;
        const weightVal = isBales 
          ? parseFloat(((qtyVal * 147.5) / 1000).toFixed(3)) 
          : (d.weight_mt || 0);
        return {
          srl: idx + 1,
          crop: d.crop_year || '2025-26',
          grade_code: d.grade_code || '',
          grade_name: gradeList.find(g => g.grade_code === d.grade_code)?.grade_name || d.grade_code || 'STANDARD GRADE',
          agency_code: d.agency_code || '',
          agency_name: agencyList.find(a => a.agency_code === d.agency_code)?.agency_name || d.agency_code || 'MAIN AGENCY',
          marka_code: d.marka_code || '',
          marka_name: markaList.find(m => m.marka_code === d.marka_code)?.marka_name || d.marka_code || 'NORMAL GRADE',
          qty: qtyVal,
          weight: weightVal,
          rate: d.rate_qntl || 0
        };
      });

      const sumQty = mappedItems.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
      const sumWt = mappedItems.reduce((s, it) => s + (parseFloat(it.weight) || 0), 0);

      const fullPo = {
        no: poHeader.po_no || '',
        ptf_no: poHeader.ptf_no || '',
        is_ptf: !!poHeader.ptf_no,
        date: poHeader.po_date || poHeader.created_at || todayStr,
        broker: poHeader.broker || 'N/A',
        supplier: poHeader.supplier || 'N/A',
        challan_supplier: poHeader.challan_supplier || 'N/A',
        area: poHeader.area || 'N/A',
        trans_paid_by: poHeader.trans_paid_by || 'PARTY',
        weight_unit_kgs: String(poHeader.weight_unit_kgs || (isBales ? '147.5' : '50')),
        against_cancellation: poHeader.against_cancellation || 'No',
        purchase_unit_name: poHeader.purchase_unit_name || 'BALES',
        total_no_of_lorries: String(poHeader.total_lorries || '0'),
        units_per_lorry: String(poHeader.units_per_lorry || '0'),
        total_units: (poHeader.total_units !== undefined && poHeader.total_units !== null && Number(poHeader.total_units) > 0)
          ? String(poHeader.total_units)
          : (isBales && sumQty > 0 ? sumQty.toString() : String(poHeader.total_units || '0')),
        weight_per_lorry: poHeader.weight_per_lorry !== undefined && poHeader.weight_per_lorry !== null && !isNaN(Number(poHeader.weight_per_lorry)) && Number(poHeader.weight_per_lorry) > 0
          ? Number(poHeader.weight_per_lorry).toFixed(3)
          : String(poHeader.weight_per_lorry || '0.000'),
        total_contract_mt: (poHeader.total_contract_mt !== undefined && poHeader.total_contract_mt !== null && Number(poHeader.total_contract_mt) > 0)
          ? Number(poHeader.total_contract_mt).toFixed(3)
          : (isBales && sumWt > 0 ? sumWt.toFixed(3) : String(poHeader.total_contract_mt || '0')),
        marka_type: poHeader.marka_type || 'Normal',
        marka_penalty: String(poHeader.marka_penalty || '0'),
        qty_penalty: String(poHeader.qty_penalty || '5'),
        delivery_from: poHeader.delivery_from || todayStr,
        delivery_to: poHeader.delivery_to || todayStr,
        grace_days: String(poHeader.grace_days || '0'),
        delivery_penalty: String(poHeader.delivery_penalty || '0'),
        contract_po_no: poHeader.contract_po_no || '',
        contract_date: poHeader.contract_date || todayStr,
        rate_detail: poHeader.rate_detail || '',
        delivery_schedule: poHeader.delivery_schedule || '',
        terms_condition: poHeader.terms_condition || 'Penalty Rs.5/day. Standard terms apply.',
        remarks: poHeader.remarks || 'Grade rates based on BJCL indices.',
        po_identification: poHeader.po_identification || 'Direct Advance Payment',
        b_rate: String(poHeader.b_rate || '0'),
        s_date: poHeader.s_date || todayStr,
        items: mappedItems
      };

      downloadPoPdfFile(fullPo);
    } catch(err: any) {
      alert("Failed to compile print receipt: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isSaudaActive = !formData.is_ptf && !!formData.no;

  const getCleanSaudaDigits = (str: string) => {
    if (!str) return '';
    const clean = String(str).trim().toUpperCase();
    const withoutPrefix = clean
      .replace(/^BJCL\//i, '')
      .replace(/^BJC\//i, '')
      .replace(/^BJC/i, '')
      .replace(/^PO[-/]/i, '')
      .replace(/^PTF[-/]/i, '');
    const withoutYear = withoutPrefix
      .replace(/20\d{2}-20\d{2}/g, '')
      .replace(/20\d{2}\/20\d{2}/g, '')
      .replace(/20\d{2}20\d{2}/g, '')
      .replace(/\/\d{2}-\d{2}$/g, '')
      .replace(/^\d{2}-\d{2}\//g, '')
      .replace(/[^0-9]/g, '');
    return withoutYear.replace(/^0+/, '');
  };

  // Filter out those Saudas that are already used in saved purchase orders
  const displaySaudas = saudaList.filter(s => {
    const isPending = !s.status || String(s.status).trim().toLowerCase() !== 'completed';
    const saudaPoDisplayNo = (formatPoNumber(s) || '').trim().toUpperCase();
    const saudaNo = String(s.sauda_no || '').trim().toUpperCase();
    const saudaSession = String(s.session || '').trim().toUpperCase();
    const sDigits = getCleanSaudaDigits(saudaNo) || getCleanSaudaDigits(saudaPoDisplayNo) || getCleanSaudaDigits(saudaSession);

    // If currently selected in the active form, keep it in displaySaudas so it remains visible while editing
    const currentFormNo = (formData.no || formData.contract_po_no || '').trim().toUpperCase();
    const currentFormDigits = getCleanSaudaDigits(currentFormNo);
    const isCurrentlySelectedInForm = currentFormNo && (
      currentFormNo === saudaPoDisplayNo ||
      currentFormNo === saudaSession ||
      currentFormNo === saudaNo ||
      (sDigits && currentFormDigits === sDigits)
    );

    if (isCurrentlySelectedInForm) {
      return true;
    }

    // Check if this sauda's PO display number already exists as contract_po_no, po_no, or ptf_no in poList
    const isAlreadyUsed = poList.some(p => {
      const sId = String(s.sauda_id || s.id || '').trim().toUpperCase();
      const pSaudaId = String(p.sauda_id || p.sauda_id_ref || '').trim().toUpperCase();
      if (sId && pSaudaId && sId === pSaudaId) {
        return true;
      }

      const pPo = String(p.po_no || '').trim().toUpperCase();
      const pContract = String(p.contract_po_no || '').trim().toUpperCase();
      const pSaudaNo = String(p.sauda_no || p.po_contract || p.contract_no || '').trim().toUpperCase();
      const pPtf = String(p.ptf_no || '').trim().toUpperCase();

      // Exact text match on any matching reference field
      const pContractRefs = [pContract, pSaudaNo, pPo, pPtf].filter(Boolean);
      if (pContractRefs.some(ref => 
        ref === saudaPoDisplayNo || 
        ref === saudaSession || 
        ref === saudaNo ||
        (s.sauda_no && ref === String(s.sauda_no).trim().toUpperCase())
      )) {
        return true;
      }

      // Check linked contract digits specifically (on contract_po_no, sauda_no, or exact PO token)
      if (sDigits) {
        const pContractDigits = getCleanSaudaDigits(pContract);
        const pSaudaDigits = getCleanSaudaDigits(pSaudaNo);
        if (pContractDigits && pContractDigits === sDigits) return true;
        if (pSaudaDigits && pSaudaDigits === sDigits) return true;
      }

      return false;
    });

    const meetsPending = formData.pending === 'Yes' ? isPending : !isPending;
    return meetsPending && !isAlreadyUsed;
  }).map(s => ({
    ...s,
    po_display_no: formatPoNumber(s)
  }));

  // Filter POs in register
  const filteredPos = poList.filter(p => {
    const term = searchTerm.toLowerCase();
    const poNo = String(p.po_no || '').toLowerCase();
    const ptfNo = String(p.ptf_no || '').toLowerCase();
    const bName = String(p.broker || '').toLowerCase();
    const sName = String(p.supplier || '').toLowerCase();
    const aName = String(p.area || '').toLowerCase();
    const matchesSearch = poNo.includes(term) || ptfNo.includes(term) || bName.includes(term) || sName.includes(term) || aName.includes(term);
    
    if (!matchesSearch) return false;

    const rowDate = p.date || p.po_date;
    if (startDate && (!rowDate || new Date(rowDate) < new Date(startDate))) return false;
    if (endDate && (!rowDate || new Date(rowDate) > new Date(endDate))) return false;

    const isCancelled = p.status === 'cancelled';
    if (statusFilter === 'cancelled') {
      return isCancelled;
    }
    // Active views never show cancelled POs.
    if (isCancelled) return false;
    // Stage split on the same table. A P.O "belongs in Final P.O" when ANY of:
    //   • it was manually finalised (status 'final'/'moved_to_final'), OR
    //   • every field matches Material Inspection (auto-move on full match), OR
    //   • it is a PTF entry (a direct Final P.O — e.g. BJC0156/26-27).
    // Everything else (pending arrival, or a real mismatch awaiting Ruka →
    // Material Inspection clearing) stays in the Temporary P.O register.
    // Section split by status. Temporary P.O (Sauda Check Point) = NOT yet final; Final P.O = final.
    // A P.O appears in exactly ONE section — never both — so the two are fully
    // independent. Clicking "Pass" flips status to 'final', moving it from Sauda Check Point to Final P.O.
    const isFinalizedPo = p.status !== 'temp';
    if (isTempPo && isFinalizedPo) return false;   // Temporary P.O (Sauda Check Point): hide final rows
    if (!isTempPo && !isFinalizedPo) return false; // Final P.O: hide temp rows

    const canSeeCompleted = canViewCompletedData();
    const pendingStr = String(p.pending ?? '').trim().toLowerCase();
    const statusStr = String(p.status ?? '').trim().toLowerCase();
    const receivedWt = parseFloat(p.received_weight_mt) || 0;
    const contractWt = parseFloat(p.total_contract_mt) || 0;
    const unit = p.purchase_unit_name || p.unit_type || p.unit || 'BALES';
    const tol = p.weight_tolerance || calculateWeightTolerance(contractWt, receivedWt, unit);
    const isCompleted = p.pending === false || pendingStr === 'no' || pendingStr === 'false' || p.pending === 0 || statusStr === 'completed' || statusStr === 'settled' || tol.isCompleted;
    const computedStatus = isCompleted ? 'completed' : (tol.status === 'mismatch' ? 'mismatch' : (receivedWt > 0 ? 'partial' : 'pending'));

    // Users like L1, L2, L3, L4 can ONLY see Pending and Partial data (Completed is hidden)
    if (!canSeeCompleted && computedStatus === 'completed') {
      return false;
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        if (computedStatus !== 'pending') return false;
      } else if (computedStatus !== statusFilter) {
        return false;
      }
    }

    return true;
  });

  // POs belonging to the current section (Sauda Check Point / Temporary P.O vs Final P.O)
  const sectionPos = poList.filter(p => {
    if (isArchiveView) {
      return true;
    }

    const isSettledOrArchived = p.status === 'settled' || !!p.archived_at;
    if (isSettledOrArchived) return false;

    const isCancelled = p.status === 'cancelled';
    if (statusFilter === 'cancelled') {
      return isCancelled;
    }
    if (isCancelled) return false;

    const isFinalizedPo = p.status !== 'temp';
    if (isTempPo && isFinalizedPo) return false;   // Temporary P.O (Sauda Check Point): hide final rows
    if (!isTempPo && !isFinalizedPo) return false; // Final P.O: hide temp rows

    const canSeeCompleted = canViewCompletedData();
    const pendingStr = String(p.pending ?? '').trim().toLowerCase();
    const statusStr = String(p.status ?? '').trim().toLowerCase();
    const receivedWt = parseFloat(p.received_weight_mt) || 0;
    const contractWt = parseFloat(p.total_contract_mt) || 0;
    const unit = p.purchase_unit_name || p.unit_type || p.unit || 'BALES';
    const tol = p.weight_tolerance || calculateWeightTolerance(contractWt, receivedWt, unit);
    const isCompleted = p.pending === false || pendingStr === 'no' || pendingStr === 'false' || p.pending === 0 || statusStr === 'completed' || statusStr === 'settled' || tol.isCompleted;
    const computedStatus = isCompleted ? 'completed' : (tol.status === 'mismatch' ? 'mismatch' : (receivedWt > 0 ? 'partial' : 'pending'));
    if (!canSeeCompleted && computedStatus === 'completed') {
      return false;
    }

    return true;
  });

  // Scope metrics by search term and date filters within current section
  const scopedPos = sectionPos.filter(p => {
    const term = searchTerm.toLowerCase();
    if (term) {
      const poNo = String(p.po_no || '').toLowerCase();
      const ptfNo = String(p.ptf_no || '').toLowerCase();
      const bName = String(p.broker || '').toLowerCase();
      const sName = String(p.supplier || '').toLowerCase();
      const aName = String(p.area || '').toLowerCase();
      const matchesSearch = poNo.includes(term) || ptfNo.includes(term) || bName.includes(term) || sName.includes(term) || aName.includes(term);
      if (!matchesSearch) return false;
    }

    const rowDate = p.date || p.po_date;
    if (startDate && (!rowDate || new Date(rowDate) < new Date(startDate))) return false;
    if (endDate && (!rowDate || new Date(rowDate) > new Date(endDate))) return false;

    return true;
  });

  const totalCompletedPos = scopedPos.filter(p => {
    const pendingStr = String(p.pending ?? '').trim().toLowerCase();
    const statusStr = String(p.status ?? '').trim().toLowerCase();
    const receivedWt = parseFloat(p.received_weight_mt) || 0;
    const contractWt = parseFloat(p.total_contract_mt) || 0;
    const unit = p.purchase_unit_name || p.unit_type || p.unit || 'BALES';
    const tol = p.weight_tolerance || calculateWeightTolerance(contractWt, receivedWt, unit);
    return p.pending === false || pendingStr === 'no' || pendingStr === 'false' || p.pending === 0 || statusStr === 'completed' || statusStr === 'settled' || tol.isCompleted;
  }).length;
  const totalPendingPos = scopedPos.length - totalCompletedPos;
  const totalGeneratedPos = scopedPos.length;
  const cumulativeWeight = scopedPos.reduce((acc, p) => acc + (parseFloat(p.total_contract_mt) || 0), 0);

  const statusPieData = [
    { name: 'Pending', value: totalPendingPos },
    { name: 'Completed', value: totalCompletedPos }
  ];
  const STATUS_COLORS = ['#be123c', '#15803d'];

  if (printingPo) {
    const portalModal = (
      <div className="fixed inset-0 z-[200] bg-[#525659] flex flex-col print:bg-white print:static print:z-auto print-modal">
        <style>{`
          @media print {
            #root {
               display: none !important;
            }
            .no-print {
               display: none !important;
            }
            html, body {
               height: auto !important;
               min-height: 0 !important;
               overflow: visible !important;
               max-height: none !important;
               background: white !important;
               border: none !important;
               box-shadow: none !important;
               padding: 0 !important;
               margin: 0 !important;
            }
            .print-modal {
               position: static !important;
               background: white !important;
               box-shadow: none !important;
               border: none !important;
               margin: 0 !important;
               padding: 0 !important;
               width: 100% !important;
               height: auto !important;
            }
            @page {
               size: A5 portrait;
               margin: 0;
            }
          }
        `}</style>
        
        {/* Viewer Toolbar */}
        <div className="flex-none bg-[#323639] shadow-md px-6 py-3 flex justify-between items-center no-print text-white text-xs ">
          <div className="flex items-center gap-4">
             <button onClick={() => setPrintingPo(null)} className="p-2 text-gray-300 hover:bg-white/10 rounded-full transition">
               <ArrowLeft className="w-5 h-5" />
             </button>
             <span className="font-bold tracking-wider uppercase">Purchase_Order_#{printingPo.ptf_no || printingPo.no}.pdf</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => downloadPoPdfFile(printingPo)} 
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded shadow flex items-center gap-2 font-bold transition cursor-pointer"
              title="Download official PDF Document"
            >
              <Download className="w-4 h-4" /> Download PDF Slip
            </button>
            <button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded shadow flex items-center gap-2 font-bold transition cursor-pointer">
               <Printer className="w-4 h-4" /> Print Document (A4 Half Vertical)
            </button>
          </div>
        </div>

        {/* Scrollable Canvas */}
        <div className="flex-1 overflow-y-auto p-4 flex justify-center print:p-0 print:overflow-visible">
           <PoPrintSlip po={printingPo} />
        </div>
      </div>
    );

    return createPortal(portalModal, document.body);
  }

  return (
    <div className="w-full h-full flex flex-col text-[11px]  text-slate-900 font-sans">
      {viewMode === 'register' && (
        <LegacyLayout title={isArchiveView ? "FINAL P.O ARCHIVE" : (isTempPo ? "SAUDA CHECK POINT" : "FINAL P.O")} subtitle={isArchiveView ? "Archived & Settled Purchase Orders Register" : ""} onClose={onClose}>
          <div className="space-y-3">
            {/* Top Stat Cards & Chart layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Pending POs */}
              <div 
                onClick={() => setStatusFilter('pending')}
                className={`bg-white border rounded-[18px] p-4 shadow-xs hover:shadow-md transition-all flex items-center justify-between cursor-pointer ${
                  statusFilter === 'pending' ? 'ring-2 ring-rose-500 border-rose-400 bg-rose-50/20' : 'border-slate-200'
                }`}
                title="Filter table by Active Pending P.O."
              >
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Active Pending P.O.</p>
                  <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">{totalPendingPos}</p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 shadow-xs">
                  <Clock className="h-6 w-6" />
                </div>
              </div>

              {/* Card 2: Generated POs */}
              <div 
                onClick={() => setStatusFilter('all')}
                className={`bg-white border rounded-[18px] p-4 shadow-xs hover:shadow-md transition-all flex items-center justify-between cursor-pointer ${
                  statusFilter === 'all' ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-50/20' : 'border-slate-200'
                }`}
                title="Show all generated P.O records"
              >
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Generated POs</p>
                  <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">{totalGeneratedPos}</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600 shadow-xs">
                  <ClipboardList className="h-6 w-6" />
                </div>
              </div>

              {/* Card 3: Cumulative PO Weight */}
              <div className="bg-white border border-slate-200 rounded-[18px] p-4 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cumulative PO Weight</p>
                  <p className="text-2xl font-black text-emerald-800 font-mono tracking-tight">{cumulativeWeight.toFixed(2)} <span className="text-xs font-bold text-slate-500">Tons</span></p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 shadow-xs">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>

              {/* Card 4: Status Distribution Pie Chart Widget */}
              <div className="bg-white border border-slate-200 rounded-[18px] p-4 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between gap-3">
                <div className="flex-1 min-w-[90px]">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status Mix</p>
                  <div className="space-y-1">
                    <button 
                      onClick={() => setStatusFilter('pending')}
                      className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg transition-all cursor-pointer text-left w-full ${
                        statusFilter === 'pending' ? 'bg-rose-100/70 font-black' : 'hover:bg-slate-100'
                      }`}
                      title="Filter by Pending"
                    >
                      <span className="w-2 h-2 rounded-full inline-block bg-rose-600" />
                      <span className="text-xs font-bold text-rose-700">Pending ({totalPendingPos})</span>
                    </button>
                    <button 
                      onClick={() => setStatusFilter('completed')}
                      className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg transition-all cursor-pointer text-left w-full ${
                        statusFilter === 'completed' ? 'bg-emerald-100/70 font-black' : 'hover:bg-slate-100'
                      }`}
                      title="Filter by Completed"
                    >
                      <span className="w-2 h-2 rounded-full inline-block bg-emerald-600" />
                      <span className="text-xs font-bold text-emerald-700">Completed ({totalCompletedPos})</span>
                    </button>
                  </div>
                </div>
                <div className="w-16 h-12 relative flex justify-center items-center shrink-0">
                  {scopedPos.length === 0 ? (
                    <div className="text-slate-400 text-[9px] font-bold">No Data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                      <PieChart>
                        <Pie
                          data={statusPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={10}
                          outerRadius={20}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {statusPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={STATUS_COLORS[index]} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '9px', borderRadius: '8px', padding: '2px 6px' }}
                          itemStyle={{ padding: 0 }}
                          formatter={(value: any, name: any) => [`${value} POs`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Register Search and Mode Controls */}
            <div className="bg-white border border-slate-200 rounded-[18px] p-3 shadow-xs flex flex-wrap lg:flex-nowrap items-center gap-3 justify-between">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input  id="search_by_po_no_broker_na_2911" name="search_by_po_no_broker_na" aria-label="Search by PO No, Broker Name, Supplier Name, Station/Area..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#174C2C]/20 focus:border-[#174C2C] transition-all" 
                  placeholder="Search by PO No, Broker Name, Supplier Name, Station/Area..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase px-2">From</span>
                <input  id="startdate_2921" name="startdate" aria-label="startdate"type="date" className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <span className="text-[10px] font-bold text-slate-500 uppercase px-2">To</span>
                <input  id="enddate_2923" name="enddate" aria-label="enddate"type="date" className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={handleCsvDownload} 
                  className="bg-[#174C2C] hover:bg-[#103A20] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Download filtered records as CSV"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-200" /> Export CSV
                </button>
                <button
                  onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setStatusFilter('all'); }}
                  title="Clear search and status filter"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
                <button 
                  onClick={fetchPosAndMasters}
                  title="Refresh Purchase Orders from database"
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50" disabled={loading}
                >
                  <RefreshCcw className={`h-3.5 w-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* Top Toolbar Action Belt */}
            <div className="bg-white border border-slate-200 rounded-[18px] p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
               <div className="flex flex-wrap items-center gap-2">
                 {isTempPo && (
                   <button
                     onClick={handleGlobalAdd}
                     className="bg-[#174C2C] hover:bg-[#103A20] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                     title="Create empty PTF PO directly"
                   >
                     <Plus className="w-4 h-4 text-emerald-300" /> New Manual P.O (PTF)
                   </button>
                 )}

                 <button
                   onClick={() => {
                     if (selectedPoNo) {
                       const match = poList.find(p => p.po_no === selectedPoNo);
                       if (match) handlePrintPo(match);
                     } else {
                       alert("Please select a Purchase Order row in the table first.");
                     }
                   }}
                   className="bg-white hover:bg-slate-50 text-slate-700 hover:text-[#174C2C] border border-slate-300 hover:border-[#174C2C] px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                 >
                   <Printer className="w-4 h-4 text-slate-600" /> Print Selected
                 </button>

                 {canEditOrDelete() && (
                   <button
                     onClick={() => {
                       if (selectedPoNo) {
                         handleDeletePo(selectedPoNo);
                       } else {
                         alert("Please select a Purchase Order in the table first.");
                       }
                     }}
                     className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 hover:border-rose-400 px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                   >
                     <Trash2 className="w-4 h-4 text-rose-600" /> Delete Selected
                   </button>
                 )}

                 <div className="h-6 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

                 {/* Status Filter Toggle Options right beside Print/Delete */}
                 <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
                   <button
                     onClick={() => setStatusFilter('all')}
                     className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                       statusFilter === 'all'
                         ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-extrabold'
                         : 'text-slate-600 hover:text-slate-900'
                     }`}
                     title="Show all Purchase Orders"
                   >
                     All ({totalGeneratedPos})
                   </button>
                   <button
                     onClick={() => setStatusFilter('pending')}
                     className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                       statusFilter === 'pending'
                         ? 'bg-rose-50 text-rose-800 border border-rose-200 shadow-xs font-extrabold'
                         : 'text-slate-600 hover:text-rose-700'
                     }`}
                     title="Show only Active Pending Purchase Orders"
                   >
                     <span className="w-2 h-2 rounded-full bg-rose-500" />
                     Pending ({totalPendingPos})
                   </button>
                   <button
                     onClick={() => setStatusFilter('completed')}
                     className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                       statusFilter === 'completed'
                         ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                         : 'text-slate-600 hover:text-emerald-800'
                     }`}
                     title="Show Completed / Fully Received Purchase Orders"
                   >
                     <span className={`w-2 h-2 rounded-full ${statusFilter === 'completed' ? 'bg-white' : 'bg-emerald-500'}`} />
                     Completed ({totalCompletedPos})
                   </button>
                 </div>
               </div>

               <div className="text-xs text-slate-500 font-medium italic">
                 Click any row to select. Double-click to open and edit details.
               </div>
            </div>

            {/* PO Grid Table */}
            <div className="bg-white border border-slate-200 rounded-[18px] shadow-xs overflow-hidden min-h-[360px]">
               <table className="w-full border-collapse text-xs text-black">
                  <thead className="bg-slate-100/90 sticky top-0 z-10 font-bold border-b border-slate-200">
                     <tr className="h-10 text-slate-700">
                        <th className="px-3 text-left border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">PO / PTF No</th>
                        <th className="px-3 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">Date</th>
                        <th className="px-3 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">Type</th>
                        <th className="px-3 text-left border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">Supplier</th>
                        <th className="px-3 text-left border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">Broker</th>
                        <th className="px-3 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">Unit / Lorry</th>
                        <th className="px-3 text-right border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">Total Units</th>
                        <th className="px-3 text-right border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">Weight (MT)<br/><span className="text-[8px] font-medium opacity-70 normal-case">Rcvd / Contract</span></th>
                        <th className="px-3 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">Status</th>
                        {isTempPo && <th className="px-3 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">Pass / Mismatch</th>}
                        <th className="px-3 text-center whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                     {filteredPos.map((item, idx) => {
                        const isSelected = selectedPoNo === item.po_no;
                        const isPoPending = item.pending === true || item.pending === 'Yes' || item.pending === 1 || String(item.pending).toLowerCase() === 'true';
                        const isVoid = item.status === 'cancelled';
                        return (
                        <tr 
                           key={item.po_no} 
                           onClick={() => setSelectedPoNo(item.po_no)}
                           onDoubleClick={() => { if(!isVoid) handleLoadSelectedPo(item); }}
                           className={cn(
                              "h-10 cursor-pointer transition-colors text-xs font-medium",
                              isSelected ? "bg-[#174C2C] text-white" : 
                              isVoid ? "bg-rose-50/40 text-slate-400 line-through decoration-rose-400/50" :
                              (idx % 2 === 0 ? "bg-white hover:bg-amber-50/50" : "bg-slate-50/40 hover:bg-amber-50/50")
                           )}
                        >
                           <td className={cn("px-3 font-mono font-bold select-text whitespace-nowrap border-r border-slate-200/60", isVoid ? "text-rose-400" : (isSelected ? "text-white" : "text-slate-900"))}>{item.po_no}</td>
                           <td className={cn("px-3 text-center font-mono whitespace-nowrap border-r border-slate-200/60", isSelected ? "text-slate-100" : "text-slate-700")}>{item.po_date || item.created_at?.slice(0, 10) || ''}</td>
                           <td className="px-3 text-center whitespace-nowrap border-r border-slate-200/60">
                              <span className={cn("px-2 py-0.5 rounded-md text-[9.5px] font-black tracking-tight", item.ptf_no ? (isSelected ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-800 border border-orange-200") : (isSelected ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-800 border border-emerald-200"))}>
                                 {item.ptf_no ? 'PTF ENTRY' : 'SAUDA LINKED'}
                              </span>
                           </td>
                           <td className={cn("px-3 uppercase truncate font-bold self-center max-w-[200px] whitespace-nowrap border-r border-slate-200/60", isSelected ? "text-white" : "text-slate-900")}>{item.supplier}</td>
                           <td className={cn("px-3 uppercase truncate max-w-[150px] whitespace-nowrap border-r border-slate-200/60", isSelected ? "text-slate-100" : "text-slate-700")}>{item.broker}</td>
                           <td className={cn("px-3 text-center font-bold uppercase whitespace-nowrap border-r border-slate-200/60 text-[10px]", isSelected ? "text-slate-200" : "text-slate-700")}>{item.purchase_unit_name || 'BALES'}</td>
                           <td className={cn("px-3 text-right font-mono font-bold whitespace-nowrap border-r border-slate-200/60", isSelected ? "text-white" : "text-slate-900")}>{item.total_units || 0}</td>
                           <td className="px-3 py-1.5 text-left font-mono border-r border-slate-200/60 min-w-[220px]">
                              {(() => {
                                 const contract = parseFloat(item.total_contract_mt || 0) || 0;
                                 const rcvd = Number(item.received_weight_mt || 0);
                                 const unit = item.purchase_unit_name || item.unit_type || item.unit || 'BALES';
                                 const tol = item.weight_tolerance || calculateWeightTolerance(contract, rcvd, unit);
                                 const pct = contract > 0 ? Math.min(100, Math.max(0, (rcvd / contract) * 100)) : 0;
                                 const barGradient = tol.isCompleted 
                                    ? 'from-emerald-500 to-green-400' 
                                    : pct > 0 
                                    ? 'from-blue-600 to-cyan-400' 
                                    : 'from-slate-300 to-slate-400';
                                 return (
                                    <div>
                                       <div className="flex items-center justify-between gap-1 text-[10px]">
                                          <span className={cn("font-black whitespace-nowrap", isSelected ? "text-emerald-200" : (tol.isCompleted ? "text-emerald-700 font-bold" : "text-emerald-800"))}>
                                             {rcvd.toFixed(3)} MT Rcvd
                                          </span>
                                          <span className={cn("font-sans text-[8.5px]", isSelected ? "text-slate-200" : "text-slate-400")}>of</span>
                                          <span className={cn("font-bold whitespace-nowrap", isSelected ? "text-white" : "text-slate-800")}>
                                             {contract.toFixed(3)} MT
                                          </span>
                                       </div>
                                       <div className="mt-1 space-y-0.5">
                                          <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden p-0.2" title={`${pct.toFixed(1)}% received. ${tol.isBales ? `Tolerance: ${tol.formattedTolerance} (Acceptable: ${tol.formattedRange})` : `Target contract weight: ${tol.formattedRange}`}`}>
                                             <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-300", barGradient)} style={{ width: `${tol.isCompleted ? 100 : pct}%` }} />
                                          </div>
                                          <div className={cn("flex items-center justify-between text-[8px] font-mono leading-none pt-0.5", isSelected ? "text-slate-200/80" : "text-slate-500")}>
                                             <span title={tol.isBales ? `Bale Tolerance Rule: MAX(3% of ${contract.toFixed(3)} MT, 1.500 MT) = ${tol.formattedTolerance}` : 'Standard Unit: Exact completion validation'}>Tol: {tol.formattedTolerance}</span>
                                             <span className={cn("font-bold", tol.isCompleted ? (isSelected ? "text-emerald-300" : "text-emerald-700 font-extrabold") : "")} title={tol.isBales ? "Acceptable Weight Range (Bale Tolerance)" : "Contract Weight Target"}>
                                                {tol.formattedRange}
                                             </span>
                                          </div>
                                       </div>
                                    </div>
                                 );
                              })()}
                           </td>
                           <td className="px-3 text-center whitespace-nowrap border-r border-slate-200/60">
                              {(() => {
                                 const contract = parseFloat(item.total_contract_mt || 0) || 0;
                                 const rcvd = Number(item.received_weight_mt || 0);
                                 const unit = item.purchase_unit_name || item.unit_type || item.unit || 'BALES';
                                 const tol = item.weight_tolerance || calculateWeightTolerance(contract, rcvd, unit);
                                 const isCompletedPo = item.pending === false || item.status === 'completed' || item.status === 'settled' || tol.isCompleted;
                                 const isOverdue = !isCompletedPo && item.delivery_to &&
                                    new Date(item.delivery_to) < new Date(new Date().toDateString());
                                 return (
                                    <div className="flex flex-col items-center gap-0.5">
                                       {isCompletedPo ? (
                                         <span className={cn("text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border shadow-2xs", isSelected ? "bg-emerald-500 text-white border-emerald-400" : "text-emerald-700 bg-emerald-50 border-emerald-300")}>COMPLETED</span>
                                       ) : tol.isOverDelivery ? (
                                         <span className={cn("text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border shadow-2xs", isSelected ? "bg-amber-500 text-white border-amber-400" : "text-amber-800 bg-amber-50 border-amber-300")}>EXCESS WT</span>
                                       ) : (
                                         <span className={cn("text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border shadow-2xs", isSelected ? "bg-rose-500 text-white border-rose-400" : "text-rose-700 bg-rose-50 border-rose-200")}>PENDING</span>
                                       )}
                                       {isOverdue && (
                                         <span title={`Delivery was due ${item.delivery_to}`} className="text-[8px] font-black px-1.5 text-amber-800 bg-amber-100 rounded border border-amber-300 uppercase">Overdue</span>
                                       )}
                                    </div>
                                 );
                              })()}
                           </td>
                           {isTempPo && (
                           <td className="px-3 text-center border-r border-slate-200/60">
                              {(() => {
                                 const isFinalized = item.status === 'final' || item.status === 'moved_to_final';
                                 if (isFinalized) {
                                    return <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase" title="Passed to Final P.O">Pass ✓</span>;
                                 }
                                 const isPtf = !!(item.ptf_no && String(item.ptf_no).trim());
                                 const mr = matchResults[item.po_no];
                                 if (isPtf) {
                                    return (
                                       <button
                                          onClick={(e) => { e.stopPropagation(); handlePassToFinal(item); }}
                                          title="PTF entry — direct Final P.O. Click to move."
                                          className="text-[9px] font-black px-2.5 py-1 rounded-lg bg-[#174C2C] hover:bg-[#103A20] text-white uppercase shadow-xs cursor-pointer"
                                       >Pass</button>
                                    );
                                 }
                                 if (!mr || !mr.hasInspection) {
                                    return <span className="text-[8px] font-bold text-slate-400 uppercase" title="No Material Inspection recorded yet">Awaiting</span>;
                                 }
                                 if (mr.status === 'match') {
                                    return (
                                       <button
                                          onClick={(e) => { e.stopPropagation(); handlePassToFinal(item); }}
                                          title="All fields match Material Inspection — click to move to Final P.O"
                                          className="text-[9px] font-black px-2.5 py-1 rounded-lg bg-[#174C2C] hover:bg-[#103A20] text-white uppercase shadow-xs cursor-pointer"
                                       >Pass</button>
                                    );
                                 }
                                 return (
                                    isPoMismatchResolved(item) ? (
                                       <button
                                          onClick={(e) => { e.stopPropagation(); handlePassToFinal(item); }}
                                          title="Mismatch Cleared & Approved by Admin — Click to Move to Final P.O"
                                          className="text-[9px] font-black px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white uppercase shadow-xs whitespace-nowrap cursor-pointer transition-all border border-emerald-600"
                                       >PASS ✓</button>
                                    ) : (
                                       <span
                                          className="text-[9px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300 uppercase cursor-help"
                                          title={`Mismatch in: ${mr.mismatches.map((m: any) => m.field).join(', ')}`}
                                       >Mismatch</span>
                                    )
                                 );
                              })()}
                           </td>
                           )}
                           <td className="px-3 text-center">
                              {isVoid ? (
                                 <div className="flex items-center justify-center gap-2">
                                   <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] uppercase border border-rose-200">VOID</span>
                                   <button
                                     onClick={(e) => { e.stopPropagation(); handleDeletePo(item.po_no); }}
                                     className="p-1 text-rose-600 hover:text-rose-800 rounded transition-colors cursor-pointer"
                                     title="Delete Permanently"
                                   >
                                     <Trash2 className="w-3.5 h-3.5" />
                                   </button>
                                 </div>
                              ) : (
                              <div className="flex justify-center">
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                     setActionMenu(actionMenu && actionMenu.item.po_no === item.po_no ? null : { item, x: r.right, y: r.bottom });
                                   }}
                                   className={cn(
                                     "px-3 py-1 rounded-lg border font-bold text-[10px] uppercase flex items-center gap-1 shadow-xs transition-colors cursor-pointer",
                                     isSelected ? "bg-white/20 text-white border-white/30 hover:bg-white/30" : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
                                   )}
                                   title="Actions"
                                 >
                                   Actions <ChevronDown className="w-3 h-3" />
                                 </button>
                              </div>
                              )}
                           </td>
                        </tr>
                     )})}
                     {filteredPos.length === 0 && (
                        <tr>
                           <td colSpan={isTempPo ? 11 : 10} className="py-12 text-center text-slate-400 uppercase font-black italic">
                             No Saved Purchase Orders found matching criteria.
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>

            {/* Pagination / Total bar */}
            <div className="bg-white border border-slate-200 rounded-[18px] p-3 shadow-xs flex flex-wrap justify-between items-center gap-3">
               <div className="flex flex-wrap gap-3 items-center">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2">
                     <span className="text-[10px] font-bold text-slate-500 uppercase">Cumulative Weight:</span>
                     <span className="text-xs font-black text-slate-900 font-mono">
                       {filteredPos.reduce((acc, s) => acc + parseFloat(s.total_contract_mt || 0), 0).toFixed(3)} MT
                     </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2">
                     <span className="text-[10px] font-bold text-slate-500 uppercase">Closed P.O.s:</span>
                     <span className="text-xs font-black text-emerald-700 font-mono">
                       {filteredPos.filter(p => p.pending === false || p.pending === 'No').length} Closed
                     </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2">
                     <span className="text-[10px] font-bold text-slate-500 uppercase">Total Records:</span>
                     <span className="text-xs font-black text-slate-900 font-mono">
                       {filteredPos.length} POs
                     </span>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Page 1 of 1</span>
               </div>
            </div>

            {/* Floating Quick Add Button - Only for Sauda Check Point */}
            {isTempPo && (
              <button
                onClick={handleGlobalAdd}
                className="fixed bottom-12 right-8 z-30 bg-[#174C2C] hover:bg-[#103A20] text-white p-4 rounded-2xl shadow-xl flex items-center gap-2.5 font-bold text-xs transition-all hover:scale-105 active:scale-95 cursor-pointer border border-[#0d301b] group"
                title="Create New Manual P.O"
              >
                <Plus className="w-5 h-5 text-emerald-300 group-hover:rotate-90 transition-transform duration-300" />
                <span>New P.O</span>
              </button>
            )}
          </div>
        </LegacyLayout>
      )}

      {/* In-Body Form Mode (Renders in Page Body, Same as Sauda Section) */}
      {viewMode === 'form' && (
        <LegacyLayout 
          title={isArchiveView ? "FINAL P.O ARCHIVE ENTRY" : (isTempPo ? "SAUDA CHECK POINT ENTRY" : "PURCHASE ORDER ENTRY")} 
          subtitle={formData.no ? `Editing Order #${formData.no}` : ""} 
          onClose={() => setViewMode('register')}
        >
          <div className="flex-1 flex flex-col font-sans text-slate-800 space-y-4 w-full pb-10">
            
            {/* Header Bar - Matching Mill Inspection Aesthetics (Compact Height) */}
            <div className="bg-[#174C2C] text-white px-5 py-2.5 rounded-lg shadow-md flex flex-wrap items-center justify-between border border-[#0F351E] gap-3">
              {/* Left Badge & Title */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-800/40 border border-emerald-400/40 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="bg-[#0b2415] text-amber-300 text-[10px] font-extrabold px-2 py-0 rounded border border-emerald-700/60 tracking-wider w-fit">
                    {formData.is_ptf ? "PTF Direct Entry" : "Sauda Linked"}
                  </span>
                  <h1 className="text-base md:text-lg font-black uppercase tracking-wider text-amber-300 drop-shadow mt-0.5 leading-tight">
                    {formData.no ? `EDIT P.O #${formData.no}` : (isTempPo ? "NEW SAUDA CHECK POINT ENTRY" : "CREATE NEW PURCHASE ORDER (P.O)")}
                  </h1>
                  <p className="text-[11px] font-bold text-amber-300 tracking-wide mt-0.5 flex items-center gap-1.5 leading-tight">
                    <span>Session: BJCL/2026-2027/</span>
                    {formData.no ? (
                      <>
                        <span>•</span>
                        <span>Order No: #{formData.no}</span>
                      </>
                    ) : formData.is_ptf ? (
                      <>
                        <span>•</span>
                        <span>PTF Direct Entry Mode</span>
                      </>
                    ) : isTempPo ? null : (
                      <>
                        <span>•</span>
                        <span>Sauda Linked Contract Entry</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Right Action Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('register')}
                  className="px-3 py-1.5 bg-[#0b2415]/80 hover:bg-[#123920] border border-emerald-400/50 rounded-md text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                  title="Close P.O Form & Return to Register (Esc)"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-amber-300" />
                  <span>Back</span>
                </button>
              </div>
            </div>

            {/* Form Body */}
            <div ref={poFormRef} className="space-y-5 w-full">
            
            {/* Optional Calculator Modal */}
            {isCalcOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in animate-duration-100">
                <div className="bg-[#a8a8a8] border-2 border-white shadow-xl p-4 w-[500px] text-[11px] font-bold text-black flex gap-4 border-r-gray-500 border-b-gray-500">
                  <div className="flex flex-col gap-2 pt-2 pb-2 pl-2">
                     {['DRUMS', 'BALES', 'LOOSE', 'P.BALES', 'H.BALES'].map((unit) => (
                        <label key={unit} className="flex items-center gap-2 cursor-pointer">
                           <input  id="calc_cond_3276" aria-label="calc cond"
                             type="radio" 
                             name="calc_cond" 
                             className="w-3 h-3" 
                             checked={formData.purchase_unit_name === unit}
                             onChange={() => {
                               handlePurchaseUnitChange(unit, formData.purchase_unit_code || '1');
                             }}
                           />
                           <span>{unit}</span>
                        </label>
                     ))}
                  </div>

                  {/* Right side calculation block */}
                  <div className="flex-1 border-[1.5px] border-l-white border-t-white border-r-gray-500 border-b-gray-500 p-4 mr-2 bg-[#a8a8a8]">
                     <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-end">
                          <span className="text-right pr-2">Total No of Lorries</span>
                          <input  id="calcdata_total_lorries_3295" name="calcdata_total_lorries" aria-label="calcdata total lorries"
                            type="number"
                            step="any"
                            className="w-32 bg-white border border-gray-400 p-0.5 text-black"
                            value={calcData.total_lorries}
                            onChange={(e) => {
                              const lorries = parseFloat(e.target.value) || 0;
                              const unitsPerLorry = parseFloat(calcData.units_per_lorry) || 0;
                              const unitWt = parseFloat(formData.weight_unit_kgs) || 147.5;
                              const totUnits = lorries * unitsPerLorry;
                              const wtPerLorry = ((unitsPerLorry * unitWt) / 1000).toFixed(3);
                              setCalcData(prev => ({ 
                                ...prev, 
                                total_lorries: e.target.value,
                                total_units: totUnits > 0 ? totUnits.toString() : prev.total_units,
                                weight_per_lorry: unitsPerLorry > 0 ? wtPerLorry : prev.weight_per_lorry
                              }));
                            }}
                          />
                        </div>
                        
                        <div className="flex items-center justify-end">
                          <span className="text-right pr-2">Units / Lorry</span>
                          <input  id="calcdata_units_per_lorry_3317" name="calcdata_units_per_lorry" aria-label="calcdata units per lorry"
                            type="number"
                            step="any"
                            className="w-32 bg-white border border-gray-400 p-0.5 text-black"
                            value={calcData.units_per_lorry}
                            onChange={(e) => {
                              const unitsPerLorry = parseFloat(e.target.value) || 0;
                              const lorries = parseFloat(calcData.total_lorries) || 0;
                              const unitWt = parseFloat(formData.weight_unit_kgs) || 147.5;
                              const totUnits = lorries * unitsPerLorry;
                              const wtPerLorry = ((unitsPerLorry * unitWt) / 1000).toFixed(3);
                              setCalcData(prev => ({ 
                                ...prev, 
                                units_per_lorry: e.target.value,
                                total_units: totUnits > 0 ? totUnits.toString() : (unitsPerLorry > 0 ? unitsPerLorry.toString() : prev.total_units),
                                weight_per_lorry: unitsPerLorry > 0 ? wtPerLorry : prev.weight_per_lorry
                              }));
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-end">
                          <span className="text-right pr-2">Total Units</span>
                          <input  id="parsefloat_calcdata_total_3338" name="parsefloat_calcdata_total" aria-label="parsefloat calcdata total"
                            type="number"
                            step="any"
                            className="w-32 bg-white border border-gray-400 p-0.5 text-black font-mono"
                            value={calcData.total_units}
                            onChange={(e) => setCalcData(prev => ({ ...prev, total_units: e.target.value }))}
                          />
                        </div>

                        <div className="flex items-center justify-end">
                          <span className="text-right pr-2">Weight/Lorry (M.Ton)</span>
                          <input  id="calcdata_weight_per_lorry_3348" name="calcdata_weight_per_lorry" aria-label="calcdata weight per lorry"
                            type="number"
                            step="any"
                            className="w-32 bg-white border border-gray-400 p-0.5 text-black font-mono"
                            value={calcData.weight_per_lorry}
                            onChange={(e) => setCalcData(prev => ({ ...prev, weight_per_lorry: e.target.value }))}
                            onBlur={() => {
                              if (calcData.weight_per_lorry && !isNaN(Number(calcData.weight_per_lorry))) {
                                setCalcData(prev => ({ ...prev, weight_per_lorry: Number(prev.weight_per_lorry).toFixed(3) }));
                              }
                            }}
                          />
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex items-end justify-center pb-4 pl-2 pr-2">
                     <button 
                        className="bg-[#d4d0c8] border-[1.5px] border-t-white border-l-white border-b-gray-600 border-r-gray-600 px-6 py-1 active:border-t-gray-600 active:border-l-gray-600 active:border-b-white active:border-r-white font-bold"
                        onClick={handleCalculateOk}
                     >
                        Ok
                     </button>
                  </div>
                </div>
              </div>
            )}

            <LegacyFieldset legend="Purchase Order Information Header">
              <div className="grid grid-cols-12 gap-x-2 gap-y-1">
                {isSaudaActive && (
                  <div className="col-span-12 mb-1 p-1 bg-amber-50 border border-amber-300 text-[10px] text-amber-850 flex items-center gap-1.5 font-normal rounded-sm">
                    <span className="font-bold">⚡ Sauda Live Link Connected:</span> Sauda details automatically pull into form fields below.
                  </div>
                )}
                
                {/* ROW 1 */}
                {/* <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1">
                  <label className="whitespace-nowrap min-w-[70px]">Purchase Order</label>
                  <SingleComboBox value={formData.purchase_order} onChange={(val) => setFormData({...formData, purchase_order: val})} options={[{text: 'FINAL PO', value: 'FINAL PO'}]} textField="text" valueField="value" />
                </div> */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1">
                  <label className="whitespace-nowrap shrink-0 text-[10px] font-bold">
                    Purchase Order
                  </label>

                    <SingleComboBox
                      value={formData.purchase_order}
                      onChange={(val) =>
                        setFormData({...formData, purchase_order: val})
                      }
                      options={[{text: 'FINAL PO', value: 'FINAL PO'}]}
                      textField="text"
                      valueField="value"
                    />

                </div>
                {/* Type */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1 lg:pl-6">
                  <label className="ml-0 sm:ml-2 min-w-[30px]">Type</label>
                  <SingleComboBox
                    value={formData.po_type}
                    onChange={(val) => setFormData({...formData, po_type: val})}
                    options={[
                      {text: 'Normal', value: 'Normal'},
                      {text: 'Special', value: 'Special'}
                    ]}
                    textField="text"
                    valueField="value"
                  />
                </div>
               {/*  <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1">
                  <label className="ml-0 sm:ml-2 min-w-[30px]">Type</label>
                  <SingleComboBox value={formData.po_type} onChange={(val) => setFormData({...formData, po_type: val})} options={[{text: 'Normal', value: 'Normal'}, {text: 'Special', value: 'Special'}]} textField="text" valueField="value" />
                </div> */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1 lg:pl-7">
                  <label className="whitespace-nowrap flex items-center cursor-pointer gap-1 text-[11px] font-extrabold text-[#7c2d12]">
                    <input  id="checkbox_3401" name="checkbox" aria-label="checkbox"
                      type="checkbox" 
                      className="w-3.5 h-3.5 cursor-pointer accent-[#7c2d12]" 
                      checked={formData.is_ptf} 
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        const defaultItems = formData.items.length > 0 ? formData.items : [
                          {
                            srl: 1,
                            crop: getCropYear(),
                            grade_code: '',
                            grade_name: '',
                            agency_code: '',
                            agency_name: '',
                            marka_code: '',
                            marka_name: '',
                            qty: 200,
                            weight: 10,
                            rate: 0
                          }
                        ];
                        setFormData({
                          ...formData, 
                          is_ptf: isChecked, 
                          no: isChecked ? '' : formData.no,
                          ptf_no: isChecked ? (formData.ptf_no || generateNextPtfNo(poList)) : '',
                          items: defaultItems
                        });
                      }} 
                    />
                    P.T.F Mode
                  </label>
                  <input  id="formdata_ptf_no_3433" name="formdata_ptf_no" aria-label="formdata ptf no"
                    type="text" 
                    className={`flex-1 bg-white border border-slate-400 p-0.5 outline-none font-bold text-black ${!formData.is_ptf ? 'bg-slate-100 text-slate-400' : ''}`}
                    value={formData.ptf_no} 
                    onChange={(e) => setFormData({...formData, ptf_no: e.target.value})} 
                    readOnly={!formData.is_ptf}
                  />
                </div>
                <div className=" lg:pl-12 col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1 justify-center sm:justify-start whitespace-nowrap">
                  <label htmlFor="pending_radio_3443" className="mr-1 min-w-[50px] text-center sm:text-left">Pending</label>
                  <input  id="pending_radio_3443" aria-label="Pending"type="radio" value="Yes" checked={formData.pending === 'Yes'} onChange={(e) => setFormData({...formData, pending: e.target.value})} name="pending_radio" className="mr-0.5 w-3 h-3 cursor-pointer" /> Yes
                  <input  id="pending_radio_3444" aria-label="Pending"type="radio" value="No" checked={formData.pending === 'No'} onChange={(e) => setFormData({...formData, pending: e.target.value})} name="pending_radio" className="ml-2 mr-0.5 w-3 h-3 cursor-pointer" /> No
                </div>
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1">
                  <label htmlFor="p_o_contract_3449" className={`whitespace-nowrap min-w-[70px] ${formData.is_ptf ? 'text-slate-400' : ''}`}>P.O Contract</label>
                  {formData.is_ptf ? (
                    <input  id="p_o_contract_3449" name="p_o_contract" aria-label="P.O Contract"type="text" className="flex-1 bg-slate-100 border border-slate-400 p-0.5 outline-none text-slate-400" disabled value="" />
                  ) : (
                    <SearchablePoContractDropdown 
                      id="p_o_contract_3449" 
                      value={formData.no} 
                      onChange={handleSaudaSelect} 
                      options={displaySaudas} 
                      hasSaudaHighlight={isSaudaActive} 
                    />
                  )}
                </div>
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1">
                  <label htmlFor="date_3456" className="ml-0 sm:ml-2 min-w-[30px]">Date</label>
                  <input  id="date_3456" name="date" aria-label="Date"type="date" className="flex-1 bg-white border border-slate-400 p-0.5 outline-none text-black" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </div>

                {/* ROW 2 */}
                <div className="col-span-12 md:col-span-6 lg:col-span-4 flex items-center gap-2">
                  <label className="w-24 sm:w-32 md:w-40 text-right shrink-0">Broker</label>
                  <DualComboBox hasSaudaHighlight={isSaudaActive} showCode={false} code={formData.broker_code} name={formData.broker} onCodeChange={(val) => setFormData(prev => ({...prev, broker_code: val}))} onNameChange={(val) => setFormData(prev => ({...prev, broker: val}))} options={brokerList} codeField="brok_code" nameField="brok_name" />
                </div>
                <div className="col-span-12 md:col-span-6 lg:col-span-4 flex items-center gap-2">
                  <label className="w-24 sm:w-32 md:w-40 text-right shrink-0">Supplier</label>
                  <DualComboBox hasSaudaHighlight={isSaudaActive} showCode={false} code={formData.supplier_code} name={formData.supplier} onCodeChange={(val) => setFormData(prev => ({...prev, supplier_code: val}))} onNameChange={(val) => setFormData(prev => ({...prev, supplier: val}))} options={supplierList} codeField="supp_code" nameField="supp_name" />
                </div>

                {/* ROW 3 */}
                <div className="col-span-12 md:col-span-6 lg:col-span-4 flex items-center gap-2">
                   <label className="w-24 sm:w-32 md:w-40 whitespace-nowrap text-right shrink-0">Challan Supplier</label>
                   <DualComboBox hasSaudaHighlight={isSaudaActive} showCode={false} code={formData.challan_supplier_code} name={formData.challan_supplier} onCodeChange={(val) => setFormData(prev => ({...prev, challan_supplier_code: val}))} onNameChange={(val) => setFormData(prev => ({...prev, challan_supplier: val}))} options={supplierList} codeField="supp_code" nameField="supp_name" />
                </div>

                {/* ROW 4 */}
                <div className="col-span-12 lg:col-span-6 flex items-center gap-2">
                  <label className="w-24 sm:w-32 md:w-40 text-right shrink-0">Area</label>
                  <DualComboBox 
                    hasSaudaHighlight={isSaudaActive} 
                    code={formData.area_code} 
                    name={formData.area} 
                    onCodeChange={(val) => setFormData(prev => ({...prev, area_code: val}))} 
                    onNameChange={(val) => {
                      const updatedItems = recalculateAllRates(formData.items, formData.s_date, formData.b_rate, sattaBaseRates, sattaCalculatedRates, sattaDifferentials, val);
                      setFormData(prev => ({
                        ...prev, 
                        area: val,
                        items: updatedItems
                      }));
                    }} 
                    options={areaList} 
                    codeField="area_code" 
                    nameField="area_name" 
                  />
                </div>
                <div className="col-span-12 lg:col-span-6 flex items-center gap-2">
                  <label htmlFor="transportation_charges_pa_3498" className="whitespace-nowrap w-24 sm:w-32 md:w-48 text-right shrink-0">Transportation Charges paid by</label>
                  <select  id="transportation_charges_pa_3498" name="transportation_charges_pa" aria-label="Transportation Charges paid by"className="w-24 bg-white border border-slate-400 p-0.5 outline-none text-black" value={formData.trans_paid_by} onChange={(e) => setFormData({...formData, trans_paid_by: e.target.value})}>
                     <option>PARTY</option>
                     <option>COMPANY</option>
                  </select>
                </div>

                {/* ROW 5 */}
                <div className="col-span-12 flex flex-wrap items-center gap-y-2 gap-x-4 mb-1 mt-1 font-normal">
                   <div className="flex items-center gap-2">
                      <label htmlFor="against_cancellation_3508" className="w-24 sm:w-32 md:w-40 text-right whitespace-nowrap font-bold shrink-0">Against Cancellation</label>
                      <select  id="against_cancellation_3508" name="against_cancellation" aria-label="Against Cancellation"className="w-16 bg-white border border-slate-400 p-0.5 outline-none text-black font-semibold" value={formData.against_cancellation} onChange={(e) => setFormData({...formData, against_cancellation: e.target.value})}>
                         <option>No</option>
                         <option>Yes</option>
                      </select>
                   </div>
                   <div className="flex items-center gap-2">
                      <label htmlFor="purchase_unit_3515" className="whitespace-nowrap font-bold">Purchase Unit</label>
                      <input  id="purchase_unit_3515" name="purchase_unit" aria-label="Purchase Unit"className="w-12 bg-white border border-slate-400 p-0.5 outline-none text-center text-black font-bold font-mono" value={formData.purchase_unit_code || '1'} onChange={(e) => {
                         const val = e.target.value;
                         setFormData(prev => ({ ...prev, purchase_unit_code: val }));
                      }} />
                      <select  id="formdata_purchase_unit_na_3519" name="formdata_purchase_unit_na" aria-label="formdata purchase unit na"className="w-24 bg-white border border-slate-400 p-0.5 outline-none text-black font-semibold cursor-pointer" value={formData.purchase_unit_name} onChange={(e) => {
                         const name = e.target.value;
                         handlePurchaseUnitChange(name, formData.purchase_unit_code || '1');
                      }}>
                         {Array.from(new Set([...unitList, formData.purchase_unit_name].filter(Boolean))).map((u: string) => (
                            <option key={u} value={u}>{u}</option>
                         ))}
                      </select>
                   </div>
                   <div className="flex items-center gap-2">
                      <label htmlFor="weight_unit_kgs_3530" className="whitespace-nowrap font-bold">Weight/Unit (Kgs.)</label>
                      <input  id="weight_unit_kgs_3530" name="weight_unit_kgs" aria-label="Weight/Unit (Kgs.)"className="w-16 bg-slate-100 border border-slate-400 p-0.5 outline-none text-right font-bold text-black" value={formData.weight_unit_kgs} readOnly />
                      <button onClick={(e) => { 
                          e.preventDefault(); 
                          setCalcData({
                              total_lorries: formData.total_no_of_lorries || '0',
                              units_per_lorry: formData.units_per_lorry || '0',
                              total_units: formData.total_units || '0',
                              weight_per_lorry: formData.weight_per_lorry && !isNaN(Number(formData.weight_per_lorry)) 
                                ? Number(formData.weight_per_lorry).toFixed(3) 
                                : (formData.weight_per_lorry || '0.000')
                           } as any);
                          setIsCalcOpen(true); 
                      }} className="bg-slate-200 border border-slate-400 px-3.5 py-0.5 hover:bg-slate-300 ml-2 shadow-sm font-bold text-black">Calculate Helper</button>
                   </div>
                </div>

                {/* ROW 6 */}
                <div className="col-span-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-1 border border-slate-400 p-1 bg-gray-50/50">
                   <div className="flex items-center gap-1 justify-between">
                      <label htmlFor="total_no_of_lorries_3547" className="whitespace-nowrap pr-1 text-right w-full text-indigo-900 font-bold text-[10px]">Total No of Lorries</label>
                      <input  
                        id="total_no_of_lorries_3547" 
                        name="total_no_of_lorries" 
                        aria-label="Total No of Lorries"
                        className="w-12 bg-white border border-slate-400 p-0.5 outline-none text-right font-extrabold text-[#7c2d12]" 
                        value={formData.total_no_of_lorries} 
                        onChange={(e) => {
                          const lorriesVal = e.target.value;
                          const lorries = parseFloat(lorriesVal) || 0;
                          const unitsPerLorry = parseFloat(formData.units_per_lorry) || 0;
                          const unitWt = parseFloat(formData.weight_unit_kgs) || 147.5;
                          const totUnits = lorries > 0 && unitsPerLorry > 0 ? (lorries * unitsPerLorry).toString() : formData.total_units;
                          const wtPerLorryNum = unitsPerLorry > 0 ? (unitsPerLorry * unitWt) / 1000 : (parseFloat(formData.weight_per_lorry) || 0);
                          const totContract = lorries > 0 && wtPerLorryNum > 0 ? (lorries * wtPerLorryNum).toFixed(3) : formData.total_contract_mt;
                          setFormData(prev => ({
                            ...prev,
                            total_no_of_lorries: lorriesVal,
                            total_units: totUnits,
                            weight_per_lorry: wtPerLorryNum > 0 ? wtPerLorryNum.toFixed(3) : prev.weight_per_lorry,
                            total_contract_mt: totContract
                          }));
                        }} 
                      />
                   </div>
                   <div className="flex items-center gap-1 justify-between">
                      <label htmlFor="units_lorry_3551" className="whitespace-nowrap pr-1 text-right w-full text-indigo-900 font-bold text-[10px]">Units / Lorry</label>
                      <input  
                        id="units_lorry_3551" 
                        name="units_lorry" 
                        aria-label="Units / Lorry"
                        className="w-16 bg-white border border-slate-400 p-0.5 outline-none text-right font-extrabold text-[#7c2d12]" 
                        value={formData.units_per_lorry} 
                        onChange={(e) => {
                          const unitsVal = e.target.value;
                          const unitsPerLorry = parseFloat(unitsVal) || 0;
                          const lorries = parseFloat(formData.total_no_of_lorries) || 0;
                          const unitWt = parseFloat(formData.weight_unit_kgs) || 147.5;
                          const totUnits = lorries > 0 && unitsPerLorry > 0 ? (lorries * unitsPerLorry).toString() : (unitsPerLorry > 0 ? unitsPerLorry.toString() : formData.total_units);
                          const wtPerLorryNum = (unitsPerLorry * unitWt) / 1000;
                          const totContract = lorries > 0 && wtPerLorryNum > 0 ? (lorries * wtPerLorryNum).toFixed(3) : (wtPerLorryNum > 0 ? wtPerLorryNum.toFixed(3) : formData.total_contract_mt);
                          setFormData(prev => ({
                            ...prev,
                            units_per_lorry: unitsVal,
                            total_units: totUnits,
                            weight_per_lorry: unitsPerLorry > 0 ? wtPerLorryNum.toFixed(3) : prev.weight_per_lorry,
                            total_contract_mt: totContract
                          }));
                        }} 
                      />
                   </div>
                   <div className="flex items-center gap-1 justify-between">
                      <label htmlFor="total_units_3555" className="whitespace-nowrap pr-1 text-right w-full text-indigo-900 font-bold text-[10px]">Total Units</label>
                      <input  
                        id="total_units_3555" 
                        name="total_units" 
                        aria-label="Total Units"
                        className="w-16 bg-white border border-slate-400 p-0.5 outline-none text-right font-extrabold text-[#7c2d12]" 
                        value={formData.total_units} 
                        onChange={(e) => {
                          const totUnitsVal = e.target.value;
                          const totUnits = parseFloat(totUnitsVal) || 0;
                          const unitWt = parseFloat(formData.weight_unit_kgs) || 147.5;
                          const totContract = totUnits > 0 ? ((totUnits * unitWt) / 1000).toFixed(3) : formData.total_contract_mt;
                          setFormData(prev => ({
                            ...prev,
                            total_units: totUnitsVal,
                            total_contract_mt: totContract
                          }));
                        }} 
                      />
                   </div>
                   <div className="flex items-center gap-1 justify-between">
                      <label htmlFor="weight_lorry_m_ton_3559" className="whitespace-nowrap pr-1 text-right w-full text-indigo-900 font-bold text-[10px]">Weight/Lorry (M.Ton)</label>
                      <input  
                        id="weight_lorry_m_ton_3559" 
                        name="weight_lorry_m_ton" 
                        aria-label="Weight/Lorry (M.Ton)"
                        className="w-16 bg-white border border-slate-400 p-0.5 outline-none text-right font-extrabold text-[#7c2d12]" 
                        value={formData.weight_per_lorry} 
                        onChange={(e) => {
                          const val = e.target.value;
                          const lorries = parseFloat(formData.total_no_of_lorries) || 0;
                          const wtVal = parseFloat(val) || 0;
                          const totContract = lorries > 0 && wtVal > 0 ? (lorries * wtVal).toFixed(3) : formData.total_contract_mt;
                          setFormData(prev => ({
                            ...prev,
                            weight_per_lorry: val,
                            total_contract_mt: totContract
                          }));
                        }} 
                        onBlur={() => {
                          if (formData.weight_per_lorry && !isNaN(Number(formData.weight_per_lorry))) {
                            setFormData(prev => ({
                              ...prev,
                              weight_per_lorry: Number(prev.weight_per_lorry).toFixed(3)
                            }));
                          }
                        }}
                      />
                   </div>
                   <div className="flex items-center gap-1 justify-between col-span-2 sm:col-span-1">
                      <label htmlFor="total_contract_m_ton_3563" className="whitespace-nowrap pr-1 text-right w-full text-indigo-900 font-bold text-[10px]">Total Contract (M.Ton)</label>
                      <input  
                        id="total_contract_m_ton_3563" 
                        name="total_contract_m_ton" 
                        aria-label="Total Contract (M.Ton)"
                        className="w-16 bg-white border border-slate-400 p-0.5 outline-none text-right font-extrabold text-blue-900" 
                        value={formData.total_contract_mt} 
                        onChange={(e) => setFormData({...formData, total_contract_mt: e.target.value})} 
                        onBlur={() => {
                          if (formData.total_contract_mt && !isNaN(Number(formData.total_contract_mt))) {
                            setFormData(prev => ({
                              ...prev,
                              total_contract_mt: Number(prev.total_contract_mt).toFixed(3)
                            }));
                          }
                        }}
                      />
                   </div>
                </div>

                {/* ROW 7 */}
                <div className="col-span-12 grid grid-cols-12 gap-2 mb-2 mt-1">
                   <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
                      <label htmlFor="marka_type_3571" className="w-24 text-right shrink-0">Marka Type</label>
                      <select  id="marka_type_3571" name="marka_type" aria-label="Marka Type"className="flex-1 bg-white border border-slate-400 p-0.5 outline-none font-bold text-black">
                         <option>{formData.marka_type}</option>
                      </select>
                   </div>
                   <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
                      <label htmlFor="marka_penalty_3577" className="w-24 sm:w-32 text-right shrink-0">Marka Penalty</label>
                      <input  id="marka_penalty_3577" name="marka_penalty" aria-label="Marka Penalty"className="flex-1 bg-white border border-slate-400 p-0.5 outline-none text-right font-normal text-black" value={formData.marka_penalty} onChange={(e) => setFormData({...formData, marka_penalty: e.target.value})} />
                   </div>
                   <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
                      <label htmlFor="quantity_penalty_3581" className="w-24 sm:w-32 text-right shrink-0">Quantity Penalty</label>
                      <input  id="quantity_penalty_3581" name="quantity_penalty" aria-label="Quantity Penalty"className="flex-1 bg-white border border-slate-400 p-0.5 outline-none text-right font-normal text-black" value={formData.qty_penalty} onChange={(e) => setFormData({...formData, qty_penalty: e.target.value})} />
                   </div>
                </div>
                
                {/* Divider */}
                <div className="col-span-12 border-b border-slate-400 mb-2"></div>
                
                {/* Detailed sections below */}
                <div className="col-span-12 grid grid-cols-12 gap-x-2 gap-y-1.5">
                  <div className="col-span-12 flex flex-wrap items-center gap-2 mt-1">
                    <label htmlFor="delivery_gt_from_3592" className="w-24 font-bold italic shrink-0">Delivery --&gt;From</label>
                    <input  id="delivery_gt_from_3592" name="delivery_gt_from" aria-label="Delivery --&gt;From"type="date" className={`w-28 p-0.5 outline-none font-normal border transition-colors duration-150 text-black ${
                      isSaudaActive ? "bg-[#fffdf5] border-amber-400 text-[#7c2d12] font-semibold" : "bg-white border-slate-400"
                    }`} value={formData.delivery_from} onChange={(e) => setFormData({...formData, delivery_from: e.target.value})} />
                    <label htmlFor="to_3596" className="mx-2 shrink-0">To</label>
                    <input  id="to_3596" name="to" aria-label="To"type="date" className={`w-28 p-0.5 outline-none font-normal border transition-colors duration-150 text-black ${
                      isSaudaActive ? "bg-[#fffdf5] border-amber-400 text-[#7c2d12] font-semibold" : "bg-white border-slate-400"
                    }`} value={formData.delivery_to} onChange={(e) => setFormData({...formData, delivery_to: e.target.value})} />
                    <label htmlFor="grace_days_3600" className="ml-2 shrink-0">Grace Days</label>
                    <input  id="grace_days_3600" name="grace_days" aria-label="Grace Days"className={`w-12 p-0.5 outline-none text-right font-normal border text-black transition-colors duration-150 ${
                      isSaudaActive ? "bg-[#fffdf5] border-amber-400 text-[#7c2d12] font-semibold font-mono" : "bg-white border-slate-400"
                    }`} value={formData.grace_days} onChange={(e) => setFormData({...formData, grace_days: e.target.value})} />
                    <label htmlFor="delivery_penalty_3604" className="ml-2 shrink-0">Delivery Penalty</label>
                    <input  id="delivery_penalty_3604" name="delivery_penalty" aria-label="Delivery Penalty"className={`w-12 p-0.5 outline-none text-right font-normal border text-black transition-colors duration-150 ${
                      isSaudaActive ? "bg-[#fffdf5] border-amber-400 text-[#7c2d12] font-semibold font-mono" : "bg-white border-slate-400"
                    }`} value={formData.delivery_penalty} onChange={(e) => setFormData({...formData, delivery_penalty: e.target.value})} />
                  </div>

                  <div className="col-span-12 lg:col-span-6 flex items-center gap-2">
                    <label className="w-24 sm:w-32 text-right shrink-0">Contract / P.O No</label>
                    <div className="flex-1">
                      <SearchablePoContractDropdown 
                        value={formData.contract_po_no} 
                        onChange={handleSaudaSelect} 
                        options={displaySaudas} 
                        hasSaudaHighlight={isSaudaActive} 
                      />
                    </div>
                  </div>
                  <div className="col-span-12 lg:col-span-6 flex flex-wrap sm:flex-nowrap items-center gap-2">
                     <label htmlFor="date_3617" className="w-24 text-right shrink-0">Date</label>
                     <input  id="date_3617" name="date" aria-label="Date"type="date" className={`w-28 p-0.5 outline-none font-normal border text-black transition-colors duration-150 ${
                       isSaudaActive ? "bg-[#fffdf5] border-amber-400 text-[#7c2d12] font-semibold" : "bg-white border-slate-400"
                     }`} value={formData.contract_date} onChange={(e) => setFormData({...formData, contract_date: e.target.value})} />
                     <label htmlFor="rate_detail_3621" className="w-24 text-right shrink-0">Rate Detail</label>
                     <input  id="rate_detail_3621" name="rate_detail" aria-label="Rate Detail"className="flex-1 min-w-[120px] bg-white border border-slate-400 p-0.5 outline-none font-normal text-black" value={formData.rate_detail} onChange={(e) => setFormData({...formData, rate_detail: e.target.value})} />
                   </div>

                  <div className="col-span-12 flex items-center gap-2">
                     <label htmlFor="delivery_schedule_3626" className="w-24 sm:w-32 text-right shrink-0">Delivery Schedule</label>
                     <input  id="delivery_schedule_3626" name="delivery_schedule" aria-label="Delivery Schedule"className="flex-1 bg-white border border-slate-400 p-0.5 outline-none font-normal text-black" value={formData.delivery_schedule} onChange={(e) => setFormData({...formData, delivery_schedule: e.target.value})} />
                  </div>

                  <div className="col-span-12 flex items-start gap-2">
                     <label htmlFor="terms_condition_3631" className="w-24 sm:w-32 text-right leading-none mt-1 shrink-0">Terms & Condition</label>
                     <textarea  id="terms_condition_3631" name="terms_condition" aria-label="Terms & Condition"className={`flex-1 p-0.5 outline-none h-12 text-[10px] font-normal border text-black transition-colors duration-150 ${
                       isSaudaActive ? "bg-[#fffdf5] border-amber-400 text-[#7c2d12] font-semibold" : "bg-white border-slate-400"
                     }`} value={formData.terms_condition} onChange={(e) => setFormData({...formData, terms_condition: e.target.value})} />
                  </div>

                  <div className="col-span-12 flex items-center gap-2 mt-1">
                     <label htmlFor="remarks_3638" className="w-24 sm:w-32 text-right shrink-0">Remarks</label>
                     <input  id="remarks_3638" name="remarks" aria-label="Remarks"className={`flex-1 p-0.5 outline-none font-normal border text-black transition-colors duration-150 ${
                       isSaudaActive ? "bg-[#fffdf5] border-amber-400 text-[#7c2d12] font-semibold" : "bg-white border-slate-400"
                     }`} value={formData.remarks} onChange={(e) => setFormData({...formData, remarks: e.target.value})} />
                  </div>

                  <div className="col-span-12 flex flex-wrap items-center gap-2 pb-1">
                     <label htmlFor="po_identification_3645" className="w-24 sm:w-32 text-right shrink-0">PO Identification</label>
                     <select  id="po_identification_3645" name="po_identification" aria-label="PO Identification"className="w-48 bg-white border border-slate-400 p-0.5 outline-none font-normal text-black">
                        <option>{formData.po_identification}</option>
                     </select>
                     <label className="ml-0 sm:ml-4 shrink-0">S Date</label>
                     <input  id="po_identification_3649" name="po_identification" aria-label="PO Identification"type="date" className={`w-28 p-0.5 outline-none font-normal border text-black transition-colors duration-150 ${
                       isSaudaActive ? "bg-[#fffdf5] border-amber-400 text-[#7c2d12] font-semibold" : "bg-white border-slate-400"
                     }`} value={formData.s_date} onChange={(e) => {
                        const val = e.target.value;
                        const autoBRate = lookupSattaBaseRate(val, sattaBaseRates);
                        const newBRate = autoBRate || formData.b_rate;
                        const updatedItems = recalculateAllRates(formData.items, val, newBRate);
                        setFormData({
                           ...formData, 
                           s_date: val,
                           b_rate: newBRate,
                           items: updatedItems
                        });
                     }} />
                     <label className="ml-0 sm:ml-4 flex items-center gap-1 group relative cursor-help shrink-0">
                        <span>B Rate</span>
                        <span className="text-[7.5px] font-black bg-indigo-950 text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif">i</span>
                        <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md font-sans leading-normal font-normal normal-case text-left">
                           DB Reference: <code className="text-yellow-400 font-mono">purchase_master.b_rate</code>
                           <p className="mt-1">Format: Numeric decimal representing Brokerage rate per ton/unit.</p>
                        </div>
                     </label>
                     <input  id="formdata_b_rate_3668" name="formdata_b_rate" aria-label="formdata b rate"className={`flex-1 min-w-[60px] p-0.5 outline-none text-right font-normal border text-black transition-colors duration-150 ${
                       isSaudaActive ? "bg-[#fffdf5] border-amber-400 text-[#7c2d12] font-semibold font-mono" : "bg-white border-slate-400"
                     }`} value={formData.b_rate} onChange={(e) => {
                        const val = e.target.value;
                        const updatedItems = recalculateAllRates(formData.items, formData.s_date, val);
                        setFormData({
                           ...formData, 
                           b_rate: val,
                           items: updatedItems
                        });
                     }} />
                  </div>
                </div>
              </div>
            </LegacyFieldset>

            <LegacyFieldset legend="Purchase Order Details (Items Table Matrix)">
              <div className="flex items-center gap-2 p-1.5 bg-[#174C2C] border-b border-[#0f331d] justify-between text-white rounded-t-md">
                 <div className="text-[10px] font-bold text-amber-300 italic pl-1 flex items-center gap-1">
                    <span>⚡ Grid Row Status:</span>
                    {selectedItemSrl ? (
                       <span className="text-slate-900 bg-amber-300 px-2 py-0.5 rounded-sm font-black">Active Item Row #{selectedItemSrl}</span>
                    ) : (
                       <span className="text-emerald-200/90 font-normal">Click on any cell below to edit quantities or select items</span>
                    )}
                 </div>
                 <div className="flex gap-1.5 pr-1">
                    <button 
                      type="button"
                      onClick={handleAddItem}
                      className="bg-[#103A20] border border-[#235E39] text-white hover:bg-[#1c5932] px-2.5 py-1 text-[10px] flex items-center gap-1 font-bold rounded cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3 h-3 text-amber-300" /> Spawn Row
                    </button>
                    <button 
                      type="button"
                      onClick={handleDeleteItem}
                      className="bg-rose-900/80 border border-rose-700 text-white hover:bg-rose-800 px-2.5 py-1 text-[10px] flex items-center gap-1 font-bold rounded cursor-pointer shadow-xs"
                    >
                      <Trash2 className="w-3 h-3 text-rose-300" /> Delete Row
                    </button>
                 </div>
              </div>

              <div className="border border-[#174C2C] bg-white shadow-sm overflow-x-auto min-h-[160px] text-black rounded-b-md">
                 <table className="w-full border-collapse text-[10px]">
                    <thead className="bg-[#174C2C] text-amber-300 border-b border-[#0f331d]">
                       <tr className="divide-x divide-[#235E39] uppercase font-black text-amber-300">
                          <th className="px-1 py-1.5 w-10">Srl. No.</th>
                          <th className="px-1 py-1.5 w-16">Crop Year</th>
                          <th className="px-1 py-1.5 w-32" colSpan={2}>Grade</th>
                          <th className="px-1 py-1.5 w-32" colSpan={2}>Agency</th>
                          <th className="px-1 py-1.5 w-32" colSpan={2}>Marka</th>
                          <th className="px-1 py-1 w-16 text-right group relative cursor-help">
                              <div className="flex items-center justify-end gap-1">
                                 <span>Rate/ m.T</span>
                                 <span className="text-[7.5px] font-black bg-indigo-950 text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif">i</span>
                              </div>
                              <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md font-sans leading-normal font-normal normal-case text-left">
                                 DB Reference: <code className="text-yellow-400 font-mono">purchase_detail_master.rate_qntl</code>
                                 <p className="mt-1">Format: Numeric decimal representing Jute rate per Metric Ton (1000 kg). Must be a positive numeric value.</p>
                              </div>
                           </th>
                       </tr>
                       <tr className="bg-[#103A20] text-amber-300 divide-x divide-[#235E39] border-t border-[#235E39] text-[9.5px] font-black uppercase tracking-wider">
                          <th colSpan={2} className="py-1 px-1"></th>
                          <th className="w-10 text-amber-300 text-center font-black py-1 px-1">Code</th>
                          <th className="w-max text-amber-300 text-left font-black py-1 px-1 pl-2">Name</th>
                          <th className="w-10 text-amber-300 text-center font-black py-1 px-1">Code</th>
                          <th className="w-max text-amber-300 text-left font-black py-1 px-1 pl-2">Name</th>
                          <th className="w-10 text-amber-300 text-center font-black py-1 px-1">Code</th>
                          <th className="w-max text-amber-300 text-left font-black py-1 px-1 pl-2">Name</th>
                          <th colSpan={1} className="py-1 px-1"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                       {formData.items.map((row) => (
                          <tr 
                             key={row.srl} 
                             onClick={() => setSelectedItemSrl(row.srl)}
                             className={`divide-x divide-slate-300 transition-colors ${
                                row.srl === selectedItemSrl ? 'bg-blue-100/95 font-bold' : 'hover:bg-blue-50/50'
                             }`}
                          >
                             <td className="px-1 py-1 text-center bg-slate-50  font-bold text-slate-700">{row.srl}</td>
                             <td className="px-0 py-0 text-center font-bold">
                                <select  id="row_crop_getcropyear_3754" name="row_crop_getcropyear" aria-label="row crop getcropyear"
                                  className="w-full text-center bg-transparent border-none p-1 outline-none font-bold text-slate-905 text-slate-900 cursor-pointer" 
                                  value={row.crop || getCropYear()} 
                                  onChange={(e) => {
                                     const val = e.target.value;
                                     const updated = formData.items.map(item => item.srl === row.srl ? { ...item, crop: val } : item);
                                     setFormData(prev => ({ ...prev, items: updated }));
                                  }} 
                                >
                                   <option value="2025-26">2025-26</option>
                                   <option value="2026-27">2026-27</option>
                                   <option value="2027-28">2027-28</option>
                                   {row.crop && row.crop !== "2025-26" && row.crop !== "2026-27" && row.crop !== "2027-28" && (
                                     <option value={row.crop}>{row.crop}</option>
                                   )}
                                </select>
                             </td>
                             <td className={`px-0 py-0 text-center font-normal transition-colors duration-150 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                                <input  id="field_3772" name="field" aria-label="-"
                                  type="text" 
                                  className="w-full text-center bg-transparent border-none p-1 outline-none font-mono text-slate-600 font-bold" 
                                  value={row.grade_code || ''} 
                                  onChange={(e) => {
                                     const codeVal = e.target.value.toUpperCase();
                                     const match = gradeList.find(g => g.grade_code.toUpperCase() === codeVal);
                                     const gName = match ? match.grade_name : row.grade_name;
                                     const computedRate = getSattaRateForRow(row.agency_name, gName, formData.s_date, formData.b_rate);
                                     const updated = formData.items.map(item => item.srl === row.srl ? {
                                        ...item,
                                        grade_code: codeVal,
                                        grade_name: gName,
                                        rate: computedRate !== null ? computedRate : item.rate
                                     } : item);
                                     setFormData(prev => ({ ...prev, items: updated }));
                                  }}
                                  placeholder="-"
                                />
                             </td>
                             <td className={`px-0 py-0 font-normal transition-colors duration-150 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                                <TableComboBox 
                                  value={row.grade_name || ''}
                                  options={gradeList}
                                  textField="grade_name"
                                  valueField="grade_code"
                                  placeholder="Grade Name"
                                  onChange={(nameVal) => {
                                     const match = gradeList.find(g => g.grade_name.toUpperCase() === nameVal.toUpperCase());
                                     const gCode = match ? match.grade_code : row.grade_code;
                                     const computedRate = getSattaRateForRow(row.agency_name, nameVal, formData.s_date, formData.b_rate);
                                     const updated = formData.items.map(item => item.srl === row.srl ? {
                                        ...item,
                                        grade_name: nameVal,
                                        grade_code: gCode,
                                        rate: computedRate !== null ? computedRate : item.rate
                                     } : item);
                                     setFormData(prev => ({ ...prev, items: updated }));
                                  }}
                                />
                             </td>
                             <td className={`px-0 py-0 text-center font-normal transition-colors duration-150 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                                <input  id="field_3814" name="field" aria-label="-"
                                  type="text" 
                                  className="w-full text-center bg-transparent border-none p-1 outline-none font-mono text-slate-600 font-bold" 
                                  value={row.agency_code || ''} 
                                  onChange={(e) => {
                                     const codeVal = e.target.value.toUpperCase();
                                     const match = agencyList.find(a => a.agency_code.toUpperCase() === codeVal);
                                     const aName = match ? match.agency_name : row.agency_name;
                                     const computedRate = getSattaRateForRow(aName, row.grade_name, formData.s_date, formData.b_rate);
                                     const updated = formData.items.map(item => item.srl === row.srl ? {
                                        ...item,
                                        agency_code: codeVal,
                                        agency_name: aName,
                                        rate: computedRate !== null ? computedRate : item.rate
                                     } : item);
                                     setFormData(prev => ({ ...prev, items: updated }));
                                  }}
                                  placeholder="-"
                                />
                             </td>
                             <td className={`px-0 py-0 font-normal transition-colors duration-150 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                                <TableComboBox 
                                  value={row.agency_name || ''}
                                  options={agencyList}
                                  textField="agency_name"
                                  valueField="agency_code"
                                  placeholder="Agency Name"
                                  onChange={(nameVal) => {
                                     const match = agencyList.find(a => a.agency_name.toUpperCase() === nameVal.toUpperCase());
                                     const aCode = match ? match.agency_code : row.agency_code;
                                     const computedRate = getSattaRateForRow(nameVal, row.grade_name, formData.s_date, formData.b_rate);
                                     const updated = formData.items.map(item => item.srl === row.srl ? {
                                        ...item,
                                        agency_name: nameVal,
                                        agency_code: aCode,
                                        rate: computedRate !== null ? computedRate : item.rate
                                     } : item);
                                     setFormData(prev => ({ ...prev, items: updated }));
                                  }}
                                />
                             </td>
                             <td className={`px-0 py-0 text-center font-normal transition-colors duration-150 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                                <input  id="field_3856" name="field" aria-label="-"
                                  type="text" 
                                  className="w-full text-center bg-transparent border-none p-1 outline-none font-mono text-slate-600 font-bold" 
                                  value={row.marka_code || ''} 
                                  onChange={(e) => {
                                     const codeVal = e.target.value.toUpperCase();
                                     const updated = formData.items.map(item => item.srl === row.srl ? {
                                        ...item,
                                        marka_code: codeVal
                                     } : item);
                                     setFormData(prev => ({ ...prev, items: updated }));
                                  }}
                                  placeholder="-"
                                />
                             </td>
                             <td className={`px-0 py-0 font-normal transition-colors duration-150 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                                <TableComboBox 
                                  value={row.marka_name || ''}
                                  options={markaList}
                                  textField="marka_name"
                                  valueField="marka_code"
                                  placeholder="Marka Name"
                                  onChange={(nameVal) => {
                                     const match = markaList.find(m => m.marka_name.toUpperCase() === nameVal.toUpperCase());
                                     const updated = formData.items.map(item => item.srl === row.srl ? {
                                        ...item,
                                        marka_name: nameVal,
                                        marka_code: match ? match.marka_code : item.marka_code
                                     } : item);
                                     setFormData(prev => ({ ...prev, items: updated }));
                                  }}
                                />
                             </td>

                             <td className="px-0 py-0 text-right font-normal">
                                <input  id="row_rate_3891" name="row_rate" aria-label="row rate"
                                  type="number" 
                                  className="w-full text-right bg-transparent border-none p-1 outline-none font-extrabold tabular-nums focus:bg-amber-50 text-blue-900"
                                  value={row.rate || ''}
                                  onChange={(e) => {
                                     const valStr = e.target.value;
                                     const nextVal = valStr === '' ? 0 : parseFloat(valStr) || 0;
                                     const updated = formData.items.map(item => item.srl === row.srl ? {
                                        ...item,
                                        rate: nextVal
                                     } : item);
                                     setFormData(prev => ({ ...prev, items: updated }));
                                  }}
                                />
                             </td>
                          </tr>
                       ))}
                       {Array.from({ length: Math.max(1, 3 - formData.items.length) }).map((_, i) => (
                          <tr key={i} className="h-6.5 divide-x divide-slate-300">
                             <td className="px-1 py-1 text-center bg-slate-50"></td>
                             <td className="px-1 py-1"></td>
                             <td className="px-1 py-1"></td>
                             <td className="px-1 py-1"></td>
                             <td className="px-1 py-1"></td>
                             <td className="px-1 py-1"></td>
                             <td className="px-1 py-1"></td>
                             <td className="px-1 py-1"></td>
                             <td className="px-1 py-1"></td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            </LegacyFieldset>

            {/* Global Actions Block inside Form */}
            <div className="bg-white border border-slate-200 rounded-[18px] p-4 shadow-xs flex flex-wrap justify-center items-center gap-3">
               
               <button 
                 onClick={handleSave} 
                 disabled={loading}
                 className="bg-[#174C2C] hover:bg-[#103A20] text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                 title="Validate and save changes to DB" 
               >
                 <Save className="w-4 h-4 text-emerald-200" /> {loading ? "Saving..." : "Save P.O"}
               </button>

               <button 
                 onClick={() => setViewMode('register')} 
                 className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-[#174C2C] px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                 title="Switch back to records ledger overview" 
               >
                 <FileText className="w-4 h-4 text-slate-600" /> View All P.O
               </button>

               {canEditOrDelete() && (
                 <button 
                   onClick={handleGlobalAmend} 
                   className="bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 hover:border-amber-400 px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                   title="Revise PO number and increment amend counter" 
                 >
                   <Edit className="w-4 h-4 text-amber-700" /> Amend / Revise
                 </button>
               )}

               <button 
                 onClick={() => {
                   if(confirm("Discard active edits? Changes will be lost.")) {
                     setViewMode('register');
                   }
                 }} 
                 className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
               >
                 <X className="w-4 h-4 text-slate-500" /> Discard
               </button>

               <button 
                 onClick={() => setViewMode('register')} 
                 className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
               >
                 <X className="w-4 h-4 text-slate-500" /> Close Form
               </button>
            </div>
          </div>
        </div>
      </LegacyLayout>
    )}

      {/* Actions dropdown — used in BOTH Temporary P.O and Final P.O rows. */}
      {actionMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setActionMenu(null)} />
          <div
            className="fixed z-[1000] bg-white rounded-lg shadow-2xl border border-slate-200 py-1 text-xs w-48"
            style={{ top: actionMenu.y + 4, left: Math.max(8, actionMenu.x - 192) }}
          >
            <button onClick={() => { const it = actionMenu.item; setActionMenu(null); handleLoadSelectedPo(it); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-blue-700 font-bold"><Edit className="w-3.5 h-3.5" />Edit / View</button>
            <button onClick={() => { const it = actionMenu.item; setActionMenu(null); setConsignmentLedgerPo(it); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-cyan-700 font-bold"><Truck className="w-3.5 h-3.5" />Consignment Ledger (1-to-N)</button>
            <button onClick={() => { const it = actionMenu.item; setActionMenu(null); handlePrintPo(it); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-slate-700 font-bold"><Printer className="w-3.5 h-3.5" />Print Slip</button>
            <button onClick={() => { const it = actionMenu.item; setActionMenu(null); handleDownloadPoPdf(it); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-emerald-700 font-bold"><Download className="w-3.5 h-3.5" />Download PDF</button>
            <button onClick={() => { const it = actionMenu.item; setActionMenu(null); handleSendMailPo(it); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-indigo-700 font-bold"><Mail className="w-3.5 h-3.5" />Email Slip</button>
            {canEditOrDelete() && (
              <>
                <div className="border-t border-slate-200 my-1" />
                <button onClick={() => { const po = actionMenu.item.po_no; setActionMenu(null); handleDeletePo(po); }} className="w-full text-left px-3 py-1.5 hover:bg-rose-50 flex items-center gap-2 text-rose-700 font-bold"><Trash2 className="w-3.5 h-3.5" />Cancel / Delete</button>
              </>
            )}
          </div>
        </>,
        document.body
      )}

      {/* Confirm popup — top level so it works in BOTH register and form views.
          (Pass button, Save, Cancel, Delete all use askConfirm.) */}
      {confirmState && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => { confirmState.resolve(false); setConfirmState(null); }}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn("px-5 py-3 flex items-center gap-2 text-white", confirmState.tone === 'danger' ? 'bg-gradient-to-r from-rose-600 to-red-700' : 'bg-gradient-to-r from-indigo-600 to-blue-700')}>
              {confirmState.tone === 'danger'
                ? <Trash2 className="w-4 h-4" />
                : <CheckCircle2 className="w-4 h-4" />}
              <span className="font-black text-sm uppercase tracking-wide">{confirmState.title}</span>
            </div>
            <div className="px-5 py-4 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {confirmState.message}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => { confirmState.resolve(false); setConfirmState(null); }}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { confirmState.resolve(true); setConfirmState(null); }}
                className={cn("px-4 py-2 rounded-lg text-xs font-black text-white shadow transition", confirmState.tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700')}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 1-to-N Consignment Ledger Modal */}
      {consignmentLedgerPo && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto font-sans text-slate-900 p-5 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-6 h-6 text-indigo-600" />
                <div>
                  <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    1-to-N Consignment Ledger: PO #{consignmentLedgerPo.po_no}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Supplier: <strong>{consignmentLedgerPo.supplier || 'N/A'}</strong> | Broker: <strong>{consignmentLedgerPo.broker || 'N/A'}</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setConsignmentLedgerPo(null)} 
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contract vs Fulfillment Progress */}
            {(() => {
              const targetPo = consignmentLedgerPo.po_no;
              const exactMatch = (po1: any, po2: any) => String(po1 || '').trim().toUpperCase() === String(po2 || '').trim().toUpperCase();
              const linkedTemps = allTempArrivals.filter((a: any) => exactMatch(a.po_no, targetPo));
              const linkedFinals = allFinalArrivals.filter((f: any) => exactMatch(f.po_no, targetPo));
              const linkedInsps = allInspections.filter((i: any) => exactMatch(i.po_no, targetPo));

              const contractMt = Number(consignmentLedgerPo.total_contract_mt) || 0;
              const totalFinalMt = linkedFinals.reduce((sum: number, f: any) => sum + (Number(f.weight_qtl || f.weight || 0) / 10), 0);
              const totalTempMt = linkedTemps.reduce((sum: number, t: any) => sum + (Number(t.weight_qtl || t.weight || 0) / 10), 0);
              const percent = contractMt > 0 ? Math.min(100, (totalFinalMt / contractMt) * 100) : 0;

              return (
                <div className="space-y-4">
                  {/* Progress Card */}
                  <div className="bg-slate-900 text-white p-3.5 rounded-md space-y-2 border border-slate-700">
                    <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                      <span>Total Consignment Delivery Progress</span>
                      <span className="text-emerald-400 font-mono text-sm">{percent.toFixed(1)}% Fulfilled</span>
                    </div>
                    <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
                      <div className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full transition-all" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-[10px] font-mono pt-1">
                      <div className="bg-slate-800 p-2 rounded">
                        <span className="text-slate-400 block font-sans">Contract Qty</span>
                        <strong className="text-white text-xs">{contractMt.toFixed(3)} MT</strong>
                      </div>
                      <div className="bg-slate-800 p-2 rounded">
                        <span className="text-slate-400 block font-sans">Final M.R Accepted</span>
                        <strong className="text-emerald-300 text-xs">{totalFinalMt.toFixed(3)} MT</strong>
                      </div>
                      <div className="bg-slate-800 p-2 rounded">
                        <span className="text-slate-400 block font-sans">Temp Gate Weight</span>
                        <strong className="text-cyan-300 text-xs">{totalTempMt.toFixed(3)} MT</strong>
                      </div>
                      <div className="bg-slate-800 p-2 rounded">
                        <span className="text-slate-400 block font-sans">Pending Balance</span>
                        <strong className="text-amber-300 text-xs">{Math.max(0, contractMt - totalFinalMt).toFixed(3)} MT</strong>
                      </div>
                    </div>
                  </div>

                  {/* 1. Temporary Arrivals (1-to-N Truck Entries) */}
                  <div className="border border-slate-200 rounded-md overflow-hidden">
                    <div className="bg-indigo-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                      <span className="font-black text-xs uppercase text-indigo-950 flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-indigo-600" />
                        <span>1. Temporary Arrivals / Gate Entries ({linkedTemps.length} Consignments)</span>
                      </span>
                    </div>
                    {linkedTemps.length === 0 ? (
                      <p className="p-3 text-xs text-slate-500 italic">No Temporary Arrival records logged for this P.O yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700 border-b">
                            <tr>
                              <th className="p-2">Amad / Gate No</th>
                              <th className="p-2">Lorry Number</th>
                              <th className="p-2">Arrival Date</th>
                              <th className="p-2 text-right">Challan Wt (MT)</th>
                              <th className="p-2 text-right">Net Wt (MT)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {linkedTemps.map((t: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2 font-bold text-indigo-900">{t.temporary_arrival_no || t.amad_no}</td>
                                <td className="p-2 font-bold text-slate-800">{t.lorry_number || t.lorry_no}</td>
                                <td className="p-2 text-slate-600">{t.date || 'N/A'}</td>
                                <td className="p-2 text-right text-slate-700">{(Number(t.chalan_wt || t.challan_material_weight || 0) / 10).toFixed(3)}</td>
                                <td className="p-2 text-right font-bold text-emerald-800">{(Number(t.weight_qtl || t.electronic_net_weight || 0) / 10).toFixed(3)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* 2. Quality Inspections */}
                  <div className="border border-slate-200 rounded-md overflow-hidden">
                    <div className="bg-amber-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                      <span className="font-black text-xs uppercase text-amber-950 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-amber-600" />
                        <span>2. Quality Inspections ({linkedInsps.length} Inspection Lots)</span>
                      </span>
                    </div>
                    {linkedInsps.length === 0 ? (
                      <p className="p-3 text-xs text-slate-500 italic">No Quality Inspections logged for this P.O yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700 border-b">
                            <tr>
                              <th className="p-2">Inspection No</th>
                              <th className="p-2">Linked Amad No</th>
                              <th className="p-2 text-center">Moisture %</th>
                              <th className="p-2 text-center">Trash / Dust %</th>
                              <th className="p-2 text-right">Deduction (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {linkedInsps.map((i: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2 font-bold text-amber-900">{i.inspection_no || 'N/A'}</td>
                                <td className="p-2 text-slate-700">{i.temporary_arrival_no || i.arrival_no || 'N/A'}</td>
                                <td className="p-2 text-center text-slate-800 font-bold">{i.moisture_percent || i.moisture || '0'}%</td>
                                <td className="p-2 text-center text-slate-800">{i.dust_percent || i.trash || '0'}%</td>
                                <td className="p-2 text-right font-bold text-rose-700">₹{(Number(i.deduction_amount || 0)).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* 3. Final M.R Receipts */}
                  <div className="border border-slate-200 rounded-md overflow-hidden">
                    <div className="bg-emerald-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                      <span className="font-black text-xs uppercase text-emerald-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>3. Final M.R. Receipts ({linkedFinals.length} Settled Receipts)</span>
                      </span>
                    </div>
                    {linkedFinals.length === 0 ? (
                      <p className="p-3 text-xs text-slate-500 italic">No Final M.R receipts issued for this P.O yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700 border-b">
                            <tr>
                              <th className="p-2">Final M.R. No</th>
                              <th className="p-2">Lorry Number</th>
                              <th className="p-2 text-right">Accepted Weight (MT)</th>
                              <th className="p-2 text-center">Bill No</th>
                              <th className="p-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {linkedFinals.map((f: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2 font-bold text-emerald-900">{f.mr_no || f.final_arrival_no}</td>
                                <td className="p-2 font-bold text-slate-800">{f.lorry_number || f.lorry_no}</td>
                                <td className="p-2 text-right font-bold text-emerald-800">{(Number(f.weight_qtl || f.weight || 0) / 10).toFixed(3)} MT</td>
                                <td className="p-2 text-center text-slate-700">{f.supplier_bill_no || f.bill_no || 'N/A'}</td>
                                <td className="p-2 text-center">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[9px] font-extrabold uppercase",
                                    f.status === 'settled' ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                  )}>
                                    {f.status || 'Verified'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2 border-t">
              <button 
                onClick={() => setConsignmentLedgerPo(null)} 
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-md shadow-xs cursor-pointer"
              >
                Close Consignment Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}
