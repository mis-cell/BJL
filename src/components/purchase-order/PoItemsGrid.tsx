import React, { useState, useRef, useEffect } from 'react';
import { RefreshCcw, Plus, Trash2 } from 'lucide-react';
import { PoItemRow, PoFormData } from '../../types/purchaseOrder';

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
    const valStr = String(opt[textField] || '').toLowerCase();
    const codeStr = String(opt[valueField] || '').toLowerCase();
    const q = filter.toLowerCase();
    return valStr.includes(q) || codeStr.includes(q);
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <input
        type="text"
        value={isOpen ? filter : (value || '')}
        onChange={(e) => {
          setFilter(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full text-left bg-transparent border-none p-1 outline-none text-slate-900 font-semibold"
      />
      {isOpen && (
        <div className="absolute left-0 top-full z-[100] w-56 max-h-48 overflow-y-auto bg-white border border-slate-400 shadow-xl rounded-sm">
          {filtered.length > 0 ? (
            filtered.map((opt, i) => (
              <div
                key={i}
                onMouseDown={() => {
                  onChange(opt[textField]);
                  setIsOpen(false);
                }}
                className="p-1.5 hover:bg-emerald-100 cursor-pointer text-[10px] flex justify-between items-center text-slate-800"
              >
                <span className="font-bold">{opt[textField]}</span>
                <span className="text-slate-500 font-mono text-[9px]">{opt[valueField]}</span>
              </div>
            ))
          ) : (
            <div className="p-2 text-slate-400 text-center text-[10px]">No options</div>
          )}
        </div>
      )}
    </div>
  );
};

interface PoItemsGridProps {
  formData: PoFormData;
  setFormData: React.Dispatch<React.SetStateAction<PoFormData>>;
  selectedItemSrl: number | null;
  setSelectedItemSrl: (srl: number | null) => void;
  gradeList: any[];
  agencyList: any[];
  markaList: any[];
  handleAddItem: () => void;
  handleDeleteItem: () => void;
  handleSyncFromSource: () => void;
  getSattaRateForRow: (agency: string, grade: string, date: string, bRate: string) => number | null;
  getCropYear: () => string;
  isSaudaActive: boolean;
}

export const PoItemsGrid: React.FC<PoItemsGridProps> = ({
  formData,
  setFormData,
  selectedItemSrl,
  setSelectedItemSrl,
  gradeList,
  agencyList,
  markaList,
  handleAddItem,
  handleDeleteItem,
  handleSyncFromSource,
  getSattaRateForRow,
  getCropYear,
  isSaudaActive
}) => {
  return (
    <div className="border border-slate-400 bg-white rounded-md overflow-hidden shadow-xs">
      <div className="flex items-center gap-2 p-1.5 bg-[#174C2C] border-b border-[#0f331d] justify-between text-white">
        <div className="text-[10px] font-bold text-amber-300 italic pl-1 flex items-center gap-1">
          <span>⚡ Grid Row Status:</span>
          {selectedItemSrl ? (
            <span className="text-slate-900 bg-amber-300 px-2 py-0.5 rounded-sm font-black">
              Active Item Row #{selectedItemSrl}
            </span>
          ) : (
            <span className="text-emerald-200/90 font-normal">
              Click on any cell below to edit quantities or select items
            </span>
          )}
        </div>
        <div className="flex gap-1.5 pr-1">
          <button 
            type="button"
            onClick={handleSyncFromSource}
            title="Restore original grades from Arrival receipt or Sauda book"
            className="bg-amber-600 border border-amber-500 text-white hover:bg-amber-500 px-2.5 py-1 text-[10px] flex items-center gap-1 font-bold rounded cursor-pointer shadow-xs"
          >
            <RefreshCcw className="w-3 h-3 text-white" /> Restore Grades
          </button>
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

      <div className="border border-[#174C2C] bg-white shadow-sm overflow-x-auto min-h-[160px] text-black">
        <table className="w-full border-collapse text-[10px]">
          <thead className="bg-[#174C2C] text-amber-300 border-b border-[#0f331d]">
            <tr className="divide-x divide-[#235E39] uppercase font-black text-amber-300">
              <th className="px-1 py-1.5 w-10">Srl. No.</th>
              <th className="px-1 py-1.5 w-16">Crop Year</th>
              <th className="px-1 py-1.5 w-32" colSpan={2}>Grade</th>
              <th className="px-1 py-1.5 w-32" colSpan={2}>Agency</th>
              <th className="px-1 py-1.5 w-32" colSpan={2}>Marka</th>
              <th className="px-1 py-1 w-16 text-right">Rate/ Qntl</th>
              <th className="px-1 py-1 w-20 text-right">Premium</th>
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
              <th colSpan={1} className="py-1 px-1"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {formData.items.map((row, index) => (
              <tr 
                key={`item_row_${index}_${row.grade_code || ''}_${row.srl || index}`} 
                onClick={() => setSelectedItemSrl(row.srl || index + 1)}
                className={`divide-x divide-slate-300 transition-colors ${
                  (row.srl === selectedItemSrl || (!selectedItemSrl && index === 0)) ? 'bg-blue-100/95 font-bold' : 'hover:bg-blue-50/50'
                }`}
              >
                <td className="px-1 py-1 text-center bg-slate-50 font-bold text-slate-700">{row.srl || index + 1}</td>
                <td className="px-0 py-0 text-center font-bold">
                  <select 
                    className="w-full text-center bg-transparent border-none p-1 outline-none font-bold text-slate-900 cursor-pointer" 
                    value={row.crop || getCropYear()} 
                    onChange={(e) => {
                      const val = e.target.value;
                      const updated = formData.items.map((item, idx) => idx === index ? { ...item, crop: val } : item);
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
                <td className={`px-0 py-0 text-center font-normal ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <input 
                    type="text" 
                    className="w-full text-center bg-transparent border-none p-1 outline-none font-mono text-slate-600 font-bold" 
                    value={row.grade_code || ''} 
                    onChange={(e) => {
                      const codeVal = e.target.value.toUpperCase();
                      const match = gradeList.find(g => g.grade_code.toUpperCase() === codeVal);
                      const gName = match ? match.grade_name : row.grade_name;
                      const computedRate = getSattaRateForRow(row.agency_name, gName, formData.s_date, formData.b_rate);
                      const updated = formData.items.map((item, idx) => idx === index ? {
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
                <td className={`px-0 py-0 font-normal ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
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
                      const updated = formData.items.map((item, idx) => idx === index ? {
                        ...item,
                        grade_name: nameVal,
                        grade_code: gCode,
                        rate: computedRate !== null ? computedRate : item.rate
                      } : item);
                      setFormData(prev => ({ ...prev, items: updated }));
                    }}
                  />
                </td>
                <td className={`px-0 py-0 text-center font-normal ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <input 
                    type="text" 
                    className="w-full text-center bg-transparent border-none p-1 outline-none font-mono text-slate-600 font-bold" 
                    value={row.agency_code || ''} 
                    onChange={(e) => {
                      const codeVal = e.target.value.toUpperCase();
                      const match = agencyList.find(a => a.agency_code.toUpperCase() === codeVal);
                      const aName = match ? match.agency_name : row.agency_name;
                      const computedRate = getSattaRateForRow(aName, row.grade_name, formData.s_date, formData.b_rate);
                      const updated = formData.items.map((item, idx) => idx === index ? {
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
                <td className={`px-0 py-0 font-normal ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
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
                      const updated = formData.items.map((item, idx) => idx === index ? {
                        ...item,
                        agency_name: nameVal,
                        agency_code: aCode,
                        rate: computedRate !== null ? computedRate : item.rate
                      } : item);
                      setFormData(prev => ({ ...prev, items: updated }));
                    }}
                  />
                </td>
                <td className={`px-0 py-0 text-center font-normal ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <input 
                    type="text" 
                    className="w-full text-center bg-transparent border-none p-1 outline-none font-mono text-slate-600 font-bold" 
                    value={row.marka_code || ''} 
                    onChange={(e) => {
                      const codeVal = e.target.value.toUpperCase();
                      const match = markaList.find(m => m.marka_code.toUpperCase() === codeVal);
                      const mName = match ? match.marka_name : row.marka_name;
                      const updated = formData.items.map((item, idx) => idx === index ? {
                        ...item,
                        marka_code: codeVal,
                        marka_name: mName
                      } : item);
                      setFormData(prev => ({ ...prev, items: updated }));
                    }} 
                    placeholder="-"
                  />
                </td>
                <td className={`px-0 py-0 font-normal ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <TableComboBox 
                    value={row.marka_name || ''}
                    options={markaList}
                    textField="marka_name"
                    valueField="marka_code"
                    placeholder="Marka Name"
                    onChange={(nameVal) => {
                      const match = markaList.find(m => m.marka_name.toUpperCase() === nameVal.toUpperCase());
                      const mCode = match ? match.marka_code : row.marka_code;
                      const updated = formData.items.map((item, idx) => idx === index ? {
                        ...item,
                        marka_name: nameVal,
                        marka_code: mCode
                      } : item);
                      setFormData(prev => ({ ...prev, items: updated }));
                    }}
                  />
                </td>
                <td className={`px-0 py-0 text-right font-normal ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <input 
                    type="number" 
                    className="w-full text-right bg-transparent border-none p-1 outline-none font-bold text-slate-900" 
                    value={row.rate || 0} 
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const updated = formData.items.map((item, idx) => idx === index ? { ...item, rate: val } : item);
                      setFormData(prev => ({ ...prev, items: updated }));
                    }} 
                  />
                </td>
                <td className={`px-0 py-0 text-right font-normal ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <input 
                    type="number" 
                    className="w-full text-right bg-transparent border-none p-1 outline-none font-bold text-slate-900" 
                    value={row.premium || 0} 
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const updated = formData.items.map((item, idx) => idx === index ? { ...item, premium: val } : item);
                      setFormData(prev => ({ ...prev, items: updated }));
                    }} 
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
