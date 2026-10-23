import React, { useState, useRef, useEffect, useMemo } from 'react';
import { RefreshCcw, Plus, Trash2 } from 'lucide-react';
import { PoItemRow, PoFormData } from '../../types/purchaseOrder';
import { getAgenciesForArea, getUniqueAgenciesForArea } from '../../services/areaLogicService';
import { getCurrentUserContext, isUserId2, isLevel4OrAbove } from '../../lib/permissions';

const TableComboBox = ({
  value,
  onChange,
  options,
  textField,
  valueField,
  placeholder = "",
  disabled = false
}: {
  value: string;
  onChange: (val: string) => void;
  options: any[];
  textField: string;
  valueField: string;
  placeholder?: string;
  disabled?: boolean;
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
        disabled={disabled}
        value={isOpen ? filter : (value || '')}
        onChange={(e) => {
          if (disabled) return;
          setFilter(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => { if (!disabled) setIsOpen(true); }}
        placeholder={placeholder}
        className={`w-full text-left bg-transparent border-none p-1 outline-none font-semibold ${disabled ? 'text-slate-400 cursor-not-allowed' : 'text-slate-900'}`}
      />
      {isOpen && !disabled && (
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
  const userCtx = getCurrentUserContext();
  const isUser002Only = isUserId2(userCtx) && !isLevel4OrAbove(userCtx);
  const isReadOnlyForUser002 = isUser002Only && !formData.is_ptf;

  const filteredAgencies = useMemo(() => {
    const activeArea = (formData.area || formData.area_code || '').trim();
    if (!activeArea) return [];
    return getUniqueAgenciesForArea(activeArea);
  }, [formData.area, formData.area_code]);

  return (
    <div className="border border-slate-400 bg-white rounded-md overflow-hidden shadow-xs">
      <div className="flex items-center gap-2 p-1.5 bg-[#F7AFA8] border-b border-[#F06D6C] justify-between text-white">
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
          {!isReadOnlyForUser002 && (
            <>
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
                className="bg-[#D94B5A] border border-[#F06D6C] text-white hover:bg-[#1c5932] px-2.5 py-1 text-[10px] flex items-center gap-1 font-bold rounded cursor-pointer shadow-xs"
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
            </>
          )}
        </div>
      </div>

      <div className="border border-[#F7AFA8] bg-white shadow-sm w-full text-black">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-[#D94B5A] text-white border-b border-[#F06D6C] select-none">
            {/* Top Row: Spanning Group Headers */}
            <tr className="divide-x divide-[#F06D6C] uppercase font-black text-white text-[10.5px] tracking-wider">
              <th rowSpan={2} className="px-2 py-2 w-14 text-center align-middle bg-[#D94B5A]">
                Srl. No.
              </th>
              <th rowSpan={2} className="px-2 py-2 w-28 text-center align-middle bg-[#D94B5A]">
                Crop Year
              </th>
              <th colSpan={2} className="px-2 py-1.5 text-center bg-[#E85A5A]">
                Grade
              </th>
              <th colSpan={2} className="px-2 py-1.5 text-center bg-[#E85A5A]">
                Agency
              </th>
              <th colSpan={2} className="px-2 py-1.5 text-center bg-[#E85A5A]">
                Marka
              </th>
              <th rowSpan={2} className="px-3 py-2 w-28 text-right align-middle bg-[#D94B5A]">
                Rate / Qntl
              </th>
              <th rowSpan={2} className="px-3 py-2 w-24 text-right align-middle bg-[#D94B5A]">
                Premium
              </th>
              <th rowSpan={2} className="px-2 py-2 w-20 text-center align-middle bg-[#D94B5A]">
                Action
              </th>
            </tr>
            {/* Sub-Header Row: Code & Name for Grade, Agency, Marka */}
            <tr className="bg-[#E85A5A] text-white divide-x divide-[#F06D6C] border-t border-[#F06D6C] text-[9.5px] font-black uppercase tracking-wider">
              <th className="w-16 text-center py-1 px-1">Code</th>
              <th className="w-36 text-left py-1 px-2.5">Name</th>
              <th className="w-24 text-center py-1 px-1">Code</th>
              <th className="w-44 text-left py-1 px-2.5">Name</th>
              <th className="w-16 text-center py-1 px-1">Code</th>
              <th className="w-36 text-left py-1 px-2.5">Name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {formData.items.map((row, index) => (
              <tr 
                key={`item_row_${index}_${row.grade_code || ''}_${row.srl || index}`} 
                onClick={() => setSelectedItemSrl(row.srl || index + 1)}
                className={`divide-x divide-slate-300 transition-colors ${
                  (row.srl === selectedItemSrl || (!selectedItemSrl && index === 0)) ? 'bg-[#FDE7E6] font-bold' : 'hover:bg-[#FFF5F4]'
                }`}
              >
                <td className="px-2 py-1 text-center bg-slate-50 font-bold text-slate-700 w-14 font-mono">{row.srl || index + 1}</td>
                <td className="px-1 py-0.5 text-center font-bold w-28">
                  <select 
                    disabled={isReadOnlyForUser002}
                    className={`w-full text-center bg-transparent border-none p-1 outline-none font-bold text-slate-900 text-xs ${isReadOnlyForUser002 ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                    value={row.crop || getCropYear()} 
                    onChange={(e) => {
                      if (isReadOnlyForUser002) return;
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
                <td className={`px-1 py-0.5 text-center font-normal w-16 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <input 
                    type="text" 
                    readOnly={isReadOnlyForUser002}
                    className="w-full text-center bg-transparent border-none p-1 outline-none font-mono text-slate-700 font-bold text-xs" 
                    value={row.grade_code || ''} 
                    onChange={(e) => {
                      if (isReadOnlyForUser002) return;
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
                <td className={`px-2 py-0.5 font-normal w-36 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <TableComboBox 
                    value={row.grade_name || ''}
                    options={gradeList}
                    disabled={isReadOnlyForUser002}
                    textField="grade_name"
                    valueField="grade_code"
                    placeholder="Grade Name"
                    onChange={(nameVal) => {
                      if (isReadOnlyForUser002) return;
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
                <td className={`px-1 py-0.5 text-center font-normal w-24 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <input 
                    type="text" 
                    readOnly={isReadOnlyForUser002}
                    className="w-full text-center bg-transparent border-none p-1 outline-none font-mono text-slate-700 font-bold text-xs truncate" 
                    value={row.agency_code || ''} 
                    onChange={(e) => {
                      if (isReadOnlyForUser002) return;
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
                    title={row.agency_code || ''}
                  />
                </td>
                <td className={`px-2 py-0.5 font-normal w-44 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <TableComboBox 
                    value={(row.agency_name || '').replace(/\s*\(Code\s*\d+\)$/i, '').replace(/\s*Code\s*\d+$/i, '').trim()}
                    options={filteredAgencies}
                    disabled={isReadOnlyForUser002}
                    textField="AGENCY_NAME"
                    valueField="AGENCY_CODE"
                    placeholder={
                      !formData.area && !formData.area_code
                        ? "Select Area first..."
                        : filteredAgencies.length === 0
                        ? "No Agency Found for Selected Area"
                        : "Agency Name"
                    }
                    onChange={(nameVal) => {
                      if (isReadOnlyForUser002) return;
                      const cleanName = nameVal.replace(/\s*\(Code\s*\d+\)$/i, '').replace(/\s*Code\s*\d+$/i, '').trim();
                      const match = filteredAgencies.find(a => (a.AGENCY_NAME || a.agency_name || '').toUpperCase() === cleanName.toUpperCase());
                      const aCode = match ? (match.AGENCY_CODE || match.agency_code) : row.agency_code;
                      const computedRate = getSattaRateForRow(cleanName, row.grade_name, formData.s_date, formData.b_rate);
                      const updated = formData.items.map((item, idx) => idx === index ? {
                        ...item,
                        agency_name: cleanName,
                        agency_code: aCode,
                        rate: computedRate !== null ? computedRate : item.rate
                      } : item);
                      setFormData(prev => ({ ...prev, items: updated }));
                    }}
                  />
                </td>
                <td className={`px-1 py-0.5 text-center font-normal w-16 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <input 
                    type="text" 
                    readOnly={isReadOnlyForUser002}
                    className="w-full text-center bg-transparent border-none p-1 outline-none font-mono text-slate-700 font-bold text-xs" 
                    value={row.marka_code || ''} 
                    onChange={(e) => {
                      if (isReadOnlyForUser002) return;
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
                <td className={`px-2 py-0.5 font-normal w-36 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <TableComboBox 
                    value={row.marka_name || ''}
                    options={markaList}
                    disabled={isReadOnlyForUser002}
                    textField="marka_name"
                    valueField="marka_code"
                    placeholder="Marka Name"
                    onChange={(nameVal) => {
                      if (isReadOnlyForUser002) return;
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
                <td className={`px-2 py-0.5 text-right font-normal w-28 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <input 
                    type="number" 
                    readOnly={isReadOnlyForUser002}
                    className="w-full text-right bg-transparent border-none p-1 outline-none font-bold text-slate-900 font-mono text-xs" 
                    value={row.rate || 0} 
                    onChange={(e) => {
                      if (isReadOnlyForUser002) return;
                      const val = parseFloat(e.target.value) || 0;
                      const updated = formData.items.map((item, idx) => idx === index ? { ...item, rate: val } : item);
                      setFormData(prev => ({ ...prev, items: updated }));
                    }} 
                  />
                </td>
                <td className={`px-2 py-0.5 text-right font-normal w-24 ${isSaudaActive ? 'bg-[#fffdf2] text-[#7c2d12]' : ''}`}>
                  <input 
                    type="number" 
                    readOnly={isReadOnlyForUser002}
                    className="w-full text-right bg-transparent border-none p-1 outline-none font-bold text-slate-900 font-mono text-xs" 
                    value={row.premium || 0} 
                    onChange={(e) => {
                      if (isReadOnlyForUser002) return;
                      const val = parseFloat(e.target.value) || 0;
                      const updated = formData.items.map((item, idx) => idx === index ? { ...item, premium: val } : item);
                      setFormData(prev => ({ ...prev, items: updated }));
                    }} 
                  />
                </td>
                <td className="px-1.5 py-1 text-center w-20">
                  {!isReadOnlyForUser002 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData(prev => {
                          const filtered = prev.items.filter((_, idx) => idx !== index);
                          const reindexed = filtered.map((it, idx) => ({ ...it, srl: idx + 1 }));
                          return {
                            ...prev,
                            items: reindexed.length > 0 ? reindexed : [{
                              srl: 1,
                              crop: getCropYear(),
                              grade_code: '',
                              grade_name: '',
                              agency_code: '',
                              agency_name: '',
                              marka_code: '',
                              marka_name: '',
                              qty: 0,
                              weight: 0,
                              rate: 0,
                              premium: 0
                            }]
                          };
                        });
                        if (selectedItemSrl === (row.srl || index + 1)) {
                          setSelectedItemSrl(null);
                        }
                      }}
                      title={`Delete Row #${row.srl || index + 1}`}
                      className="px-2 py-1 bg-[#D94B5A] hover:bg-[#B42342] text-white rounded text-[10px] font-bold flex items-center justify-center gap-1 mx-auto cursor-pointer shadow-xs transition-colors border border-[#D94B5A]"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                      <span>Delete</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
