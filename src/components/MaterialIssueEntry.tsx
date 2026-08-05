import React, { useState, useEffect } from 'react';
import { 
  Check, 
  AlertTriangle, 
  Layers, 
  FileText, 
  Settings, 
  Terminal, 
  Archive, 
  Printer, 
  X, 
  RefreshCw, 
  Plus, 
  Trash2 
} from 'lucide-react';
import { cn } from '../lib/utils';
import LegacyLayout from './LegacyLayout';

const BATCH_CODES: Record<string, string> = {
  "1": "EXPORT YARN 6.5 LBS",
  "2": "SACKING WARP 12-14 LBS",
  "3": "HESSIAN WARP 8.5 LBS",
  "4": "SACKING WARP 10.5 LBS",
  "5": "SALE YARN 14.0 LBS",
  "6": "SACKING WEFT",
  "7": "BRIGHT SALE YARN 36 LBS",
  "8": "EXPORT YARN 8.0-12.0 LBS",
  "9": "EXPORT YARN 8.00 LBS",
  "10": "HESSIAN WARP 7.5 LBS",
  "11": "TEA BAG 8.00-8.50 LBS",
  "12": "BRIGHT 48.0 LBS",
  "13": "CANVAS",
  "14": "DOBBY COLOUR YARN",
  "15": "EXPORT YARN 9.00 LBS",
  "16": "F.G.Q HESSIAN 9.00 LBS",
  "17": "JACQUARD",
  "18": "RUSSIAN",
  "19": "SALE YARN 36 LBS",
  "20": "SINGLE WARP CANVAS 10.0 LBS",
  "21": "S.T.B",
  "22": "EXPORT YARN 10.0 LBS",
  "23": "EXPORT YARN 4.8 LBS",
  "24": "H.C.F SACKING",
  "25": "H.C.F HESSIAN",
  "26": "GTF_BATCH NOT AVAILABLE",
  "27": "EXPORT YARN 17 LBS",
  "28": "BROAD LOOM",
  "29": "I.L",
  "30": "DYE YARN",
  "31": "9.50 LBS BLEACHED YARN",
  "32": "N.C.B 6.00-6.50 LBS",
  "33": "J/NG/JB",
  "34": "HEAVY SACKING WARP",
  "35": "HEAVY SACKING WARP",
  "36": "SACKING WARP 9.5-13.0 LBS",
  "37": "BIS SAMPLE"
};

const GRADES = ["", "TD5", "TD5/6", "TD6", "TD6/7", "TD7", "TD8", "TD9", "TD10", "TD12"];
const UNITS = ["BALES", "DRUMS", "LOOSE"];
const CROPS = ["2025-26", "2024-25", "2023-24"];

export function EditableComboBox({
  value,
  onChange,
  options,
  placeholder
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    (opt || "").toLowerCase().includes((filter || "").toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="flex border border-slate-300 rounded overflow-hidden bg-white shadow-xs">
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setFilter(e.target.value);
            setIsOpen(true);
          }}
          onClick={() => {
            setFilter("");
            setIsOpen(true);
          }}
          className="w-full px-2 py-1 font-medium text-slate-800 outline-none text-[13px]"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(prev => !prev);
          }}
          className="bg-slate-50 border-l border-slate-300 px-2 flex items-center justify-center hover:bg-slate-100 cursor-pointer shrink-0 animate-none "
        >
          <span className="text-[9px] text-slate-500">▼</span>
        </button>
      </div>

      {isOpen && (
        <ul className="absolute z-[9999] left-0 right-0 mt-1 max-h-[160px] overflow-y-auto bg-white border border-slate-300 shadow-lg rounded-md text-[12px] font-bold text-slate-700">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <li
                key={idx}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevents input blur before selection registers
                }}
                onClick={() => {
                  onChange(opt);
                  setFilter("");
                  setIsOpen(false);
                }}
                className="px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-900 cursor-pointer border-b border-slate-100 last:border-b-0 text-left"
              >
                {opt}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-slate-400 italic text-left">No matches. Use typed value.</li>
          )}
        </ul>
      )}
    </div>
  );
}

interface EntryContainerProps {
  children: React.ReactNode;
  embedded?: boolean;
  issueRoute: 'godown' | 'mill' | 'factory' | null;
  handleFormCancel: () => void;
  setCurrentPage?: (p: any) => void;
}

function EntryContainer({
  children,
  embedded,
  issueRoute,
  handleFormCancel,
  setCurrentPage
}: EntryContainerProps) {
  const getRouteTitle = () => {
    if (issueRoute === 'godown') return "ISSUE TO GODOWN";
    if (issueRoute === 'mill') return "SELL (GODOWN TO FACTORY)";
    if (issueRoute === 'factory') return "GODOWN TO FACTORY";
    return "RAW JUTE MATERIAL ISSUE";
  };

  if (embedded) {
    return (
      <div className="border border-slate-300 rounded overflow-hidden flex flex-col bg-[#eae7e1] flex-1">
        <div className="bg-[#000080] text-white font-mono px-3 py-1.5 flex justify-between items-center text-[10px] font-bold  uppercase tracking-wider">
          <span>📋 {getRouteTitle()}</span>
          <button 
            type="button" 
            onClick={handleFormCancel} 
            className="text-white hover:text-red-300 uppercase font-black text-[9px] cursor-pointer"
          >
            [ Back to List ]
          </button>
        </div>
        {children}
      </div>
    );
  }
  return (
    <LegacyLayout 
      title={getRouteTitle()} 
      subtitle={issueRoute ? undefined : 'Choose a Route'} 
      onBack={handleFormCancel}
      onClose={handleFormCancel}
      onMinimize={() => {
        if (setCurrentPage) {
          setCurrentPage("dashboard");
        } else {
          window.dispatchEvent(new CustomEvent('app-minimize'));
        }
      }}
      onMaximize={() => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      }}
    >
      {children}
    </LegacyLayout>
  );
}

interface MaterialIssueEntryProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  items: any[];
  setItems: React.Dispatch<React.SetStateAction<any[]>>;
  issueRoute: 'godown' | 'mill' | 'factory' | null;
  setIssueRoute: (route: 'godown' | 'mill' | 'factory' | null) => void;
  finalArrivals: any[];
  godownRecords?: any[];
  isEditMode: boolean;
  validationErrors: Record<string, string>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSave: () => Promise<void>;
  handleFormCancel: () => void;
  showToast: (msg: string) => void;
  successToast: string | null;
  setSuccessToast: (msg: string | null) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  setCurrentPage?: (p: any) => void;
  closePage?: (p: any, d?: any) => void;
  embedded?: boolean;
}

export default function MaterialIssueEntry({
  formData,
  setFormData,
  items,
  setItems,
  issueRoute,
  setIssueRoute,
  finalArrivals,
  godownRecords = [],
  isEditMode,
  validationErrors,
  setValidationErrors,
  handleSave,
  handleFormCancel,
  showToast,
  successToast,
  setSuccessToast,
  containerRef,
  setCurrentPage,
  closePage,
  embedded = false
}: MaterialIssueEntryProps) {

  const [selectedArrivalId, setSelectedArrivalId] = useState<string>('');
  const [arrivalMeta, setArrivalMeta] = useState<any>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [batchOptions, setBatchOptions] = useState<string[]>([]);

  // Fetch batches from batch_master on mount with robust fallback
  useEffect(() => {
    async function loadBatches() {
      try {
        const { supabase } = await import('../lib/supabase.ts');
        if (supabase) {
          const { data, error } = await supabase
            .from('batch_master')
            .select('batch_name')
            .order('batch_name');
          if (data && data.length > 0) {
            const names = Array.from(new Set(data.map((r: any) => r.batch_name).filter(Boolean))) as string[];
            setBatchOptions(names);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch from batch_master, using fallback:', err);
      }
      setBatchOptions(Object.values(BATCH_CODES));
    }
    loadBatches();
  }, []);

  // Pre-load linked arrival when editing or when requisition_no changes
  useEffect(() => {
    if (formData.requisition_no) {
      const matched = finalArrivals.find(a => a.final_arrival_no === formData.requisition_no);
      if (matched) {
        const idVal = matched.id || matched.final_arrival_id;
        if (selectedArrivalId !== idVal) {
          setSelectedArrivalId(idVal);
        }
        
        let parsedGrid: any[] = [];
        if (matched.grid_details) {
          if (typeof matched.grid_details === 'string') {
            try { parsedGrid = JSON.parse(matched.grid_details === "undefined" ? "null" : matched.grid_details); } catch(e){}
          } else if (Array.isArray(matched.grid_details)) {
            parsedGrid = matched.grid_details;
          }
        }

        const computedChlnQty = (parsedGrid || []).reduce((acc: number, row: any) => acc + Number(row.quantity_chln || row.quantity_rcpt || row.quantity || row.qty || 0), 0);
        const enhancedMatched = {
          ...matched,
          extracted_total_chln_qty: computedChlnQty > 0 ? computedChlnQty : matched.total_packets
        };
        
        if (!arrivalMeta || (arrivalMeta.final_arrival_id !== matched.final_arrival_id && arrivalMeta.id !== matched.id)) {
          setArrivalMeta(enhancedMatched);
        }
      } else {
        if (selectedArrivalId) setSelectedArrivalId('');
        if (arrivalMeta) setArrivalMeta(null);
      }
    } else {
      if (arrivalMeta || isEditMode) {
        setSelectedArrivalId('');
        setArrivalMeta(null);
      }
    }
  }, [isEditMode, formData.requisition_no, finalArrivals]);

  // Auto generate voucher number based on route if not editing
  const generateRouteIssueNo = (route: 'godown' | 'mill' | 'factory') => {
    const prefix = route === 'godown' ? 'GRN' : route === 'mill' ? 'SEL' : 'RJI';
    const year = new Date().getFullYear();
    const randomNo = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}/${year}/${randomNo}`;
  };

  const chooseRoute = (route: 'godown' | 'mill' | 'factory') => {
    setIssueRoute(route);
    setFormData(prev => ({
      ...prev,
      issue_no: isEditMode && prev.issue_no ? prev.issue_no : generateRouteIssueNo(route),
      godown: route === 'mill' ? (godownRecords[0]?.gdn_name || '') : prev.godown,
      party_name: route === 'mill' ? "BALLY JUTE COMPANY LIMITED" : prev.party_name
    }));

    // Seed empty details rows
    if (items.length === 0) {
      setItems([
        { srl: 1, crop: '2025-26', grade_name: 'TD5', marka: 'NO MARK', qty: 0, weight_kgs: 0, area: '', agency: '', code: '', batch_name: '', unit: 'BALES', place: '', itg_no: '', rate: 0, location_dest: '' },
        { srl: 2, crop: '2025-26', grade_name: 'TD5', marka: 'NO MARK', qty: 0, weight_kgs: 0, area: '', agency: '', code: '', batch_name: '', unit: 'BALES', place: '', itg_no: '', rate: 0, location_dest: '' },
        { srl: 3, crop: '2025-26', grade_name: 'TD5', marka: 'NO MARK', qty: 0, weight_kgs: 0, area: '', agency: '', code: '', batch_name: '', unit: 'BALES', place: '', itg_no: '', rate: 0, location_dest: '' }
      ]);
    }
  };

  const changeRoute = () => {
    if (confirm("Are you sure you want to change route? Unsaved changes will be reset.")) {
      setIssueRoute(null);
      setItems([]);
      setSelectedArrivalId('');
      setArrivalMeta(null);
    }
  };

  const loadFA = () => {
    if (!selectedArrivalId) {
      alert("Select a Final Arrival first.");
      return;
    }
    const matched = finalArrivals.find(a => a.id === selectedArrivalId || a.final_arrival_id === selectedArrivalId);
    if (matched) {
      // Parse details
      let parsedGrid: any[] = [];
      if (matched.grid_details) {
        if (typeof matched.grid_details === 'string') {
          try { parsedGrid = JSON.parse(matched.grid_details === "undefined" ? "null" : matched.grid_details); } catch(e){}
        } else if (Array.isArray(matched.grid_details)) {
          parsedGrid = matched.grid_details;
        }
      }

      const mappedDetails = (parsedGrid || []).map((row: any, idx: number) => ({
        srl: idx + 1,
        crop: row.crop_year || row.crop || '2025-26',
        grade_name: row.receipt_grade_name || row.challan_grade_name || row.grade_name || 'TD5',
        marka: row.challan_marka_name || row.marka || 'NO MARK',
        qty: Number(row.quantity_chln || row.quantity_rcpt || row.quantity || row.qty || 0),
        weight_kgs: Number(row.netto_pnto !== undefined ? (row.netto_pnto * 1000) : (row.weight_kgs || 0)),
        area: row.area || matched.arrival_area_name || '',
        agency: row.agency_name || row.agency || '',
        code: row.receipt_grade_code || row.challan_marka_code || row.code || '',
        batch_name: row.batch_name || '',
        unit: row.unit || 'BALES',
        place: '',
        itg_no: '',
        rate: 0,
        location_dest: ''
      }));

      const computedChlnQty = (parsedGrid || []).reduce((acc: number, row: any) => acc + Number(row.quantity_chln || row.quantity_rcpt || row.quantity || row.qty || 0), 0);
      const enhancedMatched = {
        ...matched,
        extracted_total_chln_qty: computedChlnQty > 0 ? computedChlnQty : matched.total_packets
      };

      // Fallback row if empty
      if (mappedDetails.length === 0) {
        mappedDetails.push({
          srl: 1, crop: '2025-26', grade_name: 'TD5', marka: 'NO MARK', qty: 0, weight_kgs: 0, area: enhancedMatched.arrival_area_name || '', agency: '', code: '', batch_name: '', unit: 'BALES', place: '', itg_no: '', rate: 0, location_dest: ''
        });
      }

      setItems(mappedDetails);
      setArrivalMeta(enhancedMatched);
      setFormData(prev => ({
        ...prev,
        requisition_no: matched.final_arrival_no || '',
        party_name: matched.supplier || '',
        lorry_number: matched.lorry_number || matched.lorry_no || matched.vehicle_no || '',
        remarks: `STOCKED POST-RECEIVE #FA-${matched.final_arrival_no || ''}`
      }));
      showToast(`Loaded details from Final Arrival #${matched.final_arrival_no || ''}`);
    }
  };

  const addRow = () => {
    const nextSrl = items.length + 1;
    setItems(prev => [
      ...prev,
      {
        srl: nextSrl,
        crop: '2025-26',
        grade_name: 'TD5',
        marka: 'NO MARK',
        qty: 0,
        weight_kgs: 0,
        area: arrivalMeta?.arrival_area_name || '',
        agency: '',
        code: '',
        batch_name: '',
        unit: 'BALES',
        place: '',
        itg_no: '',
        rate: 0,
        location_dest: ''
      }
    ]);
  };

  const deleteRow = (index: number) => {
    setItems(prev => {
      const copy = prev.filter((_, i) => i !== index);
      return copy.map((item, idx) => ({ ...item, srl: idx + 1 }));
    });
  };

  const deleteLastRow = () => {
    if (items.length <= 1) return;
    setItems(prev => {
      const copy = prev.slice(0, -1);
      return copy.map((item, idx) => ({ ...item, srl: idx + 1 }));
    });
  };

  const updateRow = (index: number, field: string, val: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      if (field === 'code') {
        copy[index].batch_name = BATCH_CODES[val] || '';
      }
      return copy;
    });
  };

  // Split totals calculation
  const getSplitTotals = () => {
    const acc: Record<string, { q: number; w: number }> = {
      BALES: { q: 0, w: 0 },
      LOOSE: { q: 0, w: 0 },
      DRUMS: { q: 0, w: 0 }
    };
    items.forEach(it => {
      const u = (it.unit || 'BALES').toUpperCase();
      const q = parseFloat(it.qty) || 0;
      const w = parseFloat(it.weight_kgs) || 0;
      if (acc[u]) {
        acc[u].q += q;
        acc[u].w += w;
      }
    });

    const grandQ = acc.BALES.q + acc.LOOSE.q + acc.DRUMS.q;
    const grandW = acc.BALES.w + acc.LOOSE.w + acc.DRUMS.w;
    const grandAmount = items.reduce((sum, it) => sum + ((parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0)), 0);

    return {
      balesQ: acc.BALES.q,
      balesW: acc.BALES.w / 1000, // converted to MT
      looseQ: acc.LOOSE.q,
      looseW: acc.LOOSE.w / 1000,
      drumsQ: acc.DRUMS.q,
      drumsW: acc.DRUMS.w / 1000,
      grandQ,
      grandW: grandW / 1000,
      grandAmount
    };
  };

  const splitTotals = getSplitTotals();

  // Reconciliation parameters
  const getReconciliation = () => {
    if (!arrivalMeta) return { matchBales: true, matchWt: true, balBales: 0, balWt: 0, arrBales: 0, arrWt: 0 };
    const arrBales = Number(arrivalMeta.extracted_total_chln_qty || arrivalMeta.total_packets || arrivalMeta.packets || arrivalMeta.bales || 0);
    const arrWt = arrivalMeta.challan_material_weight !== undefined && arrivalMeta.challan_material_weight !== null
      ? Number(arrivalMeta.challan_material_weight)
      : (arrivalMeta.weight_qtl 
          ? (Number(arrivalMeta.weight_qtl) / 10) 
          : Number(arrivalMeta.total_actual_weight || arrivalMeta.total_weight_kgs || 0) / 1000); // in MT

    const balBales = arrBales - splitTotals.balesQ;
    const balWt = arrWt - splitTotals.grandW;

    const matchBales = balBales === 0;
    const matchWt = Math.abs(balWt) < 0.005;

    return {
      arrBales,
      arrWt,
      balBales,
      balWt,
      matchBales,
      matchWt
    };
  };

  const recon = getReconciliation();

  const resetAll = () => {
    if (confirm("Are you sure you want to clear this form?")) {
      setFormData((prev: any) => ({
        ...prev,
        remarks: '',
        issued_by: '',
        received_by: '',
        stack_no: '',
        jci: 'No',
        batch_order: '',
        requisition_no: '',
        lorry_number: '',
        party_name: ''
      }));
      setItems([
        { srl: 1, crop: '2025-26', grade_name: 'TD5', marka: 'NO MARK', qty: 0, weight_kgs: 0, area: '', agency: '', code: '', batch_name: '', unit: 'BALES', place: '', itg_no: '', rate: 0, location_dest: '' }
      ]);
    }
  };

  return (
    <EntryContainer
      embedded={embedded}
      issueRoute={issueRoute}
      handleFormCancel={handleFormCancel}
      setCurrentPage={setCurrentPage}
    >
      <div 
        ref={containerRef} 
        className="bg-[#eae7e1] font-sans text-[12px] text-slate-900 selection:bg-slate-300 flex flex-col flex-1 p-4 gap-4 overflow-y-auto"
      >
        {/* Success Toast banner */}
        {successToast && (
          <div className="bg-emerald-50 text-emerald-950 p-3 border border-emerald-400 rounded flex items-center justify-between shadow-sm ">
            <span className="flex items-center gap-1.5 font-bold uppercase text-[11px]">
              <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
              {successToast}
            </span>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-950 font-bold uppercase text-[9px] cursor-pointer">
              [ Dismiss ]
            </button>
          </div>
        )}

        {/* Validation Errors banner */}
        {Object.keys(validationErrors).length > 0 && (
          <div className="bg-rose-50 border-2 border-rose-400 p-3.5 rounded shadow-sm text-rose-950 ">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-[12px] uppercase mb-1">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>Voucher Validation Failed (Incomplete Record)</span>
            </div>
            <ul className="list-disc pl-8 text-[11px] font-semibold text-rose-900 space-y-0.5">
              {Object.entries(validationErrors).map(([field, msg]) => (
                <li key={field} className="uppercase tracking-tight">{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 1. ROUTE SELECTOR PANEL */}
        {!issueRoute && (
          <div className="bg-white border border-[#dbe1ea] rounded-md p-6 shadow-xs">
            <div className="font-bold text-[#1c4587] text-[14px] mb-4 uppercase tracking-wider">Choose issue route</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button 
                type="button" 
                onClick={() => chooseRoute('godown')}
                className="flex gap-4 items-center text-left p-5 border-2 border-[#bcd0ea] rounded-lg bg-white cursor-pointer hover:translate-y-[-2px] hover:shadow-md hover:border-[#1c4587] transition-all"
              >
                <div className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-[21px] text-white bg-gradient-to-br from-[#1c4587] to-[#2c6bb3]">🏭</div>
                <div>
                  <div className="font-extrabold text-[#1c4587] text-[14px]">ISSUE TO GODOWN</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-tight">Store a verified Final Arrival into a godown stack (GRN).</div>
                </div>
              </button>

              <button 
                type="button" 
                onClick={() => chooseRoute('mill')}
                className="flex gap-4 items-center text-left p-5 border-2 border-[#bfe3d3] rounded-lg bg-white cursor-pointer hover:translate-y-[-2px] hover:shadow-md hover:border-[#0b6e54] transition-all"
              >
                <div className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-[21px] text-white bg-gradient-to-br from-[#0b6e54] to-[#159c74]">💰</div>
                <div>
                  <div className="font-extrabold text-[#0b6e54] text-[14px]">SELL (Godown to Factory)</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-tight">Direct sale or transfer of raw jute from Godown to Factory.</div>
                </div>
              </button>

              <button 
                type="button" 
                onClick={() => chooseRoute('factory')}
                className="flex gap-4 items-center text-left p-5 border-2 border-[#f0d79a] rounded-lg bg-white cursor-pointer hover:translate-y-[-2px] hover:shadow-md hover:border-[#e0972f] transition-all"
              >
                <div className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-[21px] text-white bg-gradient-to-br from-[#b9851a] to-[#e0972f]">📦</div>
                <div>
                  <div className="font-extrabold text-[#b9851a] text-[14px]">GODOWN &rarr; FACTORY</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-tight">Issue raw jute already stored in a godown out to the factory.</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* 2. ROUTE BAR (If selected) */}
        {issueRoute && (
          <div className="flex items-center gap-3 bg-[#eef4fb] border border-[#cfe0f2] rounded p-3 ">
            <span className="font-bold text-slate-700">Issue route:</span>
            <span className={cn(
              "font-extrabold text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded text-white",
              issueRoute === 'godown' ? "bg-[#1c4587]" : issueRoute === 'mill' ? "bg-[#0b6e54]" : "bg-[#e0972f]"
            )}>
              {issueRoute === 'godown' ? 'ISSUE TO GODOWN' : issueRoute === 'mill' ? 'SELL (GODOWN TO FACTORY)' : 'GODOWN TO FACTORY'}
            </span>
            <span className="text-slate-500 font-medium">
              {issueRoute === 'godown' 
                ? 'Store verified arrivals to a stack record.' 
                : issueRoute === 'mill' 
                  ? 'Sell direct from godown to buyer factory.' 
                  : 'Despatching raw jute from godown rows to spinning units.'
              }
            </span>
            <button 
              type="button" 
              onClick={changeRoute}
              className="ml-auto bg-white border border-[#1c4587] text-[#1c4587] hover:bg-[#f1f5fc] rounded px-3 py-1 font-bold cursor-pointer transition-colors"
            >
              Change route
            </button>
          </div>
        )}

        {/* 3. LINKED FINAL ARRIVAL (godown only) */}
        {issueRoute && issueRoute === 'godown' && (
          <div className="bg-white border border-[#dbe1ea] rounded-md overflow-hidden shadow-xs">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#e7ecf3] font-bold text-[#1c4587] bg-slate-50">
              <Archive className="h-4 w-4" />
              <span>Linked Final Arrival</span>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex flex-col gap-1 min-w-[240px] flex-1">
                  <label className="font-bold text-slate-500 text-[10px] uppercase">Select Final Arrival (FA #)</label>
                  <select 
                    value={selectedArrivalId}
                    onChange={(e) => setSelectedArrivalId(e.target.value)}
                    className="w-full bg-white border border-[#dbe1ea] rounded px-3 py-1.5 font-bold outline-none text-slate-800 focus:border-[#1c4587]"
                  >
                    <option value="">— Select Final Arrival —</option>
                    {finalArrivals.filter(arr => !arr.is_issued || arr.final_arrival_no === formData.requisition_no).map((arr) => (
                      <option key={arr.id || arr.final_arrival_id} value={arr.id || arr.final_arrival_id}>
                        {arr.final_arrival_no} — {arr.supplier} ({arr.total_packets || arr.packets || arr.bales || 0} bales) {arr.is_issued ? '(Already Issued)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button 
                  type="button" 
                  onClick={loadFA}
                  className="bg-[#1c4587] hover:bg-[#143160] text-white px-4 py-2 rounded font-bold cursor-pointer transition-colors"
                >
                  Load Arrival
                </button>
              </div>

              {/* Readonly FA fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-3 rounded border border-dashed border-[#dbe1ea]">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[10px] text-slate-400 uppercase">Voucher Date</label>
                  <input readOnly value={arrivalMeta ? new Date(arrivalMeta.date).toLocaleDateString('en-GB') : '--'} className="bg-slate-100 border border-[#e7ecf3] px-2 py-1 rounded font-bold text-slate-700 outline-none" />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-bold text-[10px] text-slate-400 uppercase">P.O. / Mill P.O. No.</label>
                  <input readOnly value={arrivalMeta?.po_no || arrivalMeta?.purchase_order_no || '--'} className="bg-slate-100 border border-[#e7ecf3] px-2 py-1 rounded font-bold text-slate-700 outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[10px] text-slate-400 uppercase">J.C.I Govt</label>
                  <input readOnly value={arrivalMeta?.jci || 'No'} className="bg-slate-100 border border-[#e7ecf3] px-2 py-1 rounded font-bold text-slate-700 outline-none" />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-bold text-[10px] text-slate-400 uppercase">Supplier Name</label>
                  <input readOnly value={arrivalMeta?.supplier || '--'} className="bg-slate-100 border border-[#e7ecf3] px-2 py-1 rounded font-bold text-slate-700 outline-none" />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-bold text-[10px] text-slate-400 uppercase">Broker Reference</label>
                  <input readOnly value={arrivalMeta?.broker || '--'} className="bg-slate-100 border border-[#e7ecf3] px-2 py-1 rounded font-bold text-slate-700 outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[10px] text-slate-400 uppercase">Lorry Number</label>
                  <input readOnly value={arrivalMeta?.lorry_number || arrivalMeta?.lorry_no || arrivalMeta?.vehicle_no || '--'} className="bg-slate-100 border border-[#e7ecf3] px-2 py-1 rounded font-bold text-slate-700 outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[10px] text-slate-400 uppercase">Arrival Net Wt (M.T)</label>
                  <input readOnly value={arrivalMeta ? (arrivalMeta.challan_material_weight !== undefined && arrivalMeta.challan_material_weight !== null ? Number(arrivalMeta.challan_material_weight).toFixed(3) : (Number(arrivalMeta.total_actual_weight || arrivalMeta.total_weight_kgs || 0) / 1000).toFixed(3)) : '0.000'} className="bg-slate-100 border border-[#e7ecf3] px-2 py-1 rounded font-bold text-slate-700 text-right outline-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. MODE SPECIFIC FORM HEADERS */}

        {/* 4A. ISSUE TO GODOWN HEADER */}
        {issueRoute === 'godown' && (
          <div className="bg-white border border-[#dbe1ea] rounded-md overflow-hidden shadow-xs">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#e7ecf3] font-bold text-[#1c4587] bg-slate-50">
              <Layers className="h-4 w-4" />
              <span>Godown Storage Details</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Godown Receipt No.</label>
                  <input 
                    value={formData.issue_no}
                    onChange={(e) => setFormData((p: any) => ({ ...p, issue_no: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-bold text-[#1c4587] outline-none focus:border-[#1c4587]" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Storing Date</label>
                  <input 
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData((p: any) => ({ ...p, date: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-bold text-slate-800 outline-none focus:border-[#1c4587]" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Godown No.</label>
                  <select 
                    value={formData.godown === 'N/A' ? '' : formData.godown}
                    onChange={(e) => setFormData((p: any) => ({ ...p, godown: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-bold text-slate-800 outline-none focus:border-[#1c4587] bg-white cursor-pointer"
                  >
                    <option value="">— Select Godown —</option>
                    {godownRecords?.map((gdn: any) => (
                      <option key={gdn.gdn_code || gdn.id} value={gdn.gdn_name}>
                        {gdn.gdn_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Stack / Lot No.</label>
                  <input 
                    placeholder="Stack identifier"
                    value={formData.stack_no}
                    onChange={(e) => setFormData((p: any) => ({ ...p, stack_no: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-medium text-slate-800 outline-none focus:border-[#1c4587]" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Stored By (Keeper)</label>
                  <input 
                    placeholder="Godown keeper name"
                    value={formData.issued_by}
                    onChange={(e) => setFormData((p: any) => ({ ...p, issued_by: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-medium text-slate-800 outline-none focus:border-[#1c4587]" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Checked By</label>
                  <input 
                    placeholder="Supervisor name"
                    value={formData.received_by}
                    onChange={(e) => setFormData((p: any) => ({ ...p, received_by: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-medium text-slate-800 outline-none focus:border-[#1c4587]" 
                  />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Company details / Sender Company</label>
                  <EditableComboBox
                    value={formData.party_name || ''}
                    onChange={(val) => setFormData((p: any) => ({ ...p, party_name: val }))}
                    options={["BALLY JUTE COMPANY LIMITED", "HOWRAH JUTE MILLS LTD.", "HOOGHLY JUTE MILLS CO.", "BIRLA JUTE INDUSTRIES"]}
                    placeholder="Select or enter Company details"
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Remarks</label>
                  <input 
                    placeholder="Condition / short / excess notes"
                    value={formData.remarks}
                    onChange={(e) => setFormData((p: any) => ({ ...p, remarks: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-medium text-slate-800 outline-none focus:border-[#1c4587]" 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4B. SELL (FACTORY TO FACTORY) HEADER */}
        {issueRoute === 'mill' && (
          <div className="bg-white border border-[#dbe1ea] rounded-md overflow-hidden shadow-xs">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#e7ecf3] font-bold text-[#0b6e54] bg-slate-50">
              <Settings className="h-4 w-4" />
              <span>Sell Details &mdash; Godown to Factory Direct</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Sell / Invoice No.</label>
                  <input 
                    value={formData.issue_no}
                    onChange={(e) => setFormData((p: any) => ({ ...p, issue_no: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-bold text-[#0b6e54] outline-none focus:border-[#0b6e54]" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Sale Date</label>
                  <input 
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData((p: any) => ({ ...p, date: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-bold text-slate-800 outline-none focus:border-[#0b6e54]" 
                  />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">P.O. / Agreement No.</label>
                  <input 
                    placeholder="Enter Purchase Order or Agreement number"
                    value={formData.requisition_no}
                    onChange={(e) => setFormData((p: any) => ({ ...p, requisition_no: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-medium text-slate-800 outline-none focus:border-[#0b6e54]" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">J.C.I Govt</label>
                  <select 
                    value={formData.jci}
                    onChange={(e) => setFormData((p: any) => ({ ...p, jci: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-bold text-slate-800 outline-none focus:border-[#0b6e54]"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Challan / Delivery Order No.</label>
                  <input 
                    placeholder="Delivery order reference"
                    value={formData.batch_order}
                    onChange={(e) => setFormData((p: any) => ({ ...p, batch_order: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-medium text-slate-800 outline-none focus:border-[#0b6e54]" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-emerald-800 text-[10px] uppercase font-black">Buyer Factory Name</label>
                  <input 
                    placeholder="Buyer mill or factory name"
                    value={formData.department}
                    onChange={(e) => setFormData((p: any) => ({ ...p, department: e.target.value }))}
                    className="border border-emerald-300 px-3 py-1.5 rounded font-bold text-slate-800 outline-none focus:border-[#0b6e54] bg-emerald-50/20" 
                  />
                </div>
                <div className="flex flex-col gap-1 col-span-2 md:col-span-3">
                  <label className="font-semibold text-emerald-800 text-[10px] uppercase font-black">Buyer Delivery Address / Destination</label>
                  <input 
                    placeholder="Enter full destination address of Buyer"
                    value={formData.destination_godown || ''}
                    onChange={(e) => setFormData((p: any) => ({ ...p, destination_godown: e.target.value }))}
                    className="border border-emerald-300 px-3 py-1.5 rounded font-semibold text-slate-800 outline-none focus:border-[#0b6e54] bg-emerald-50/20 w-full" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Issued By</label>
                  <input 
                    placeholder="Store in-charge"
                    value={formData.issued_by}
                    onChange={(e) => setFormData((p: any) => ({ ...p, issued_by: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-medium text-slate-800 outline-none focus:border-[#0b6e54]" 
                  />
                </div>

                {/* Multi-Select Godown No. (Source) */}
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-semibold text-emerald-800 text-[10px] uppercase font-black">Godown No. (Source) [Select Multiple]</label>
                  <div className="flex flex-wrap gap-1.5 p-1.5 border border-emerald-300 bg-emerald-50/10 rounded min-h-[38px] items-center">
                    {godownRecords?.map((gdn: any) => {
                      const selectedGodowns = formData.godown && formData.godown !== 'N/A' 
                        ? formData.godown.split(',').map((g: string) => g.trim()).filter(Boolean)
                        : [];
                      const isSelected = selectedGodowns.includes(gdn.gdn_name);
                      return (
                        <button
                          key={gdn.gdn_code || gdn.id}
                          type="button"
                          onClick={() => {
                            let newList: string[];
                            if (isSelected) {
                              newList = selectedGodowns.filter((g: string) => g !== gdn.gdn_name);
                            } else {
                              newList = [...selectedGodowns, gdn.gdn_name];
                            }
                            const godownStr = newList.join(', ') || '';
                            setFormData((p: any) => ({ ...p, godown: godownStr || 'N/A' }));
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded text-[10px] font-black uppercase transition-all flex items-center gap-1 border cursor-pointer ",
                            isSelected 
                              ? "bg-[#0b6e54] text-white border-[#0b6e54] shadow-xs" 
                              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                          )}
                        >
                          {isSelected && <span className="text-[9px] font-bold">&#10003;</span>}
                          {gdn.gdn_name}
                        </button>
                      );
                    })}
                    {godownRecords?.length === 0 && <span className="text-slate-400 italic text-[11px]">No godowns loaded.</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Sender Company</label>
                  <input 
                    readOnly
                    value="BALLY JUTE COMPANY LIMITED"
                    className="border border-[#dbe1ea] bg-slate-100 px-3 py-1.5 rounded font-black text-slate-700 outline-none  cursor-not-allowed uppercase" 
                  />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase">Remarks / GSTIN / Comments</label>
                  <input 
                    placeholder="Feed / blend instructions or Buyer GSTIN"
                    value={formData.remarks}
                    onChange={(e) => setFormData((p: any) => ({ ...p, remarks: e.target.value }))}
                    className="border border-[#dbe1ea] px-3 py-1.5 rounded font-medium text-slate-800 outline-none focus:border-[#0b6e54] w-full" 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4C. GODOWN -> FACTORY HEADER (IMAGE 2 DESIGN) */}
        {issueRoute === 'factory' && (
          <div className="bg-white border-2 border-slate-350 rounded-md overflow-hidden shadow-md">
            
            {/* Immersive retro brand header matching the provided styles */}
            <div className="bg-[#1c4587] text-white h-[62px] flex items-center justify-center relative border-b-[4px] border-[#f4c20d]">
              <div className="absolute left-0 top-0 bottom-0 w-[120px] bg-[repeating-linear-gradient(-45deg,#143160_0_14px,#f4c20d_14px_28px)] opacity-95"></div>
              <span className="absolute left-[138px] bottom-[6px] text-[10px] tracking-wider text-[#cdd9ef] font-semibold">BALLY JUTE COMPANY LIMITED</span>
              <h2 className="text-[20px] font-black tracking-widest uppercase">GODOWN TO FACTORY</h2>
              <div className="absolute right-0 top-0 bottom-0 w-[120px] bg-[repeating-linear-gradient(-45deg,#143160_0_14px,#f4c20d_14px_28px)] opacity-95"></div>
            </div>

            {/* Retro form grid layout */}
            <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
              <div className="flex items-center gap-3 py-1">
                <label className="w-[130px] font-bold text-[#1c4587] text-[12px] uppercase shrink-0">Issue No.</label>
                <input 
                  value={formData.issue_no}
                  onChange={(e) => setFormData((p: any) => ({ ...p, issue_no: e.target.value }))}
                  className="flex-1 border border-slate-300 px-2 py-1 rounded font-bold text-[#1c4587] outline-none" 
                />
              </div>
              <div className="flex items-center gap-3 py-1">
                <label className="w-[130px] font-bold text-[#1c4587] text-[12px] uppercase shrink-0">Issue Date</label>
                <input 
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((p: any) => ({ ...p, date: e.target.value }))}
                  className="flex-1 border border-slate-300 px-2 py-1 rounded font-medium text-slate-800 outline-none" 
                />
              </div>

              <div className="flex items-center gap-3 py-1">
                <label className="w-[130px] font-bold text-[#1c4587] text-[12px] uppercase shrink-0">Requisition No.</label>
                <input 
                  placeholder="Batching requisition"
                  value={formData.requisition_no}
                  onChange={(e) => setFormData((p: any) => ({ ...p, requisition_no: e.target.value }))}
                  className="flex-1 border border-slate-300 px-2 py-1 rounded font-medium text-slate-800 outline-none" 
                />
              </div>
              <div className="flex items-center gap-3 py-1">
                <label className="w-[130px] font-bold text-[#1c4587] text-[12px] uppercase shrink-0">Requisition Date</label>
                <input 
                  type="date"
                  value={formData.requisition_date}
                  onChange={(e) => setFormData((p: any) => ({ ...p, requisition_date: e.target.value }))}
                  className="flex-1 border border-slate-300 px-2 py-1 rounded font-medium text-slate-800 outline-none" 
                />
              </div>

              <div className="flex items-center gap-3 py-1">
                <label className="w-[130px] font-bold text-[#1c4587] text-[12px] uppercase shrink-0">Godown No. (Source)</label>
                <select 
                  value={formData.godown === 'N/A' ? '' : formData.godown}
                  onChange={(e) => setFormData((p: any) => ({ ...p, godown: e.target.value }))}
                  className="flex-1 border border-slate-300 px-2 py-1 rounded font-bold text-slate-800 outline-none cursor-pointer bg-white"
                >
                  <option value="">— Select Godown —</option>
                  {godownRecords?.map((gdn: any) => (
                    <option key={gdn.gdn_code || gdn.id} value={gdn.gdn_name}>
                      {gdn.gdn_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 py-1">
                <label className="w-[130px] font-bold text-[#1c4587] text-[12px] uppercase shrink-0">Issued For</label>
                <EditableComboBox
                  value={formData.issued_for || ''}
                  onChange={(val) => setFormData((p: any) => ({ ...p, issued_for: val }))}
                  options={["MAIN MILL"]}
                  placeholder="Select or type Issued For"
                />
              </div>

              <div className="flex items-center gap-3 py-1">
                <label className="w-[130px] font-bold text-[#1c4587] text-[12px] uppercase shrink-0">Batching Order</label>
                <EditableComboBox
                  value={formData.batch_order || ''}
                  onChange={(val) => setFormData((p: any) => ({ ...p, batch_order: val }))}
                  options={batchOptions}
                  placeholder="Select or type batching order"
                />
              </div>
              <div className="flex items-center gap-3 py-1">
                <label className="w-[130px] font-bold text-[#1c4587] text-[12px] uppercase shrink-0">Lorry Number</label>
                <input 
                  placeholder="Lorry Number"
                  value={formData.lorry_number}
                  onChange={(e) => setFormData((p: any) => ({ ...p, lorry_number: e.target.value }))}
                  className="flex-1 border border-slate-300 px-2 py-1 rounded font-medium text-slate-800 outline-none" 
                />
              </div>

              <div className="flex items-center gap-3 py-1">
                <label className="w-[130px] font-bold text-[#1c4587] text-[12px] uppercase shrink-0">Issued By</label>
                <input 
                  placeholder="Godown keeper name"
                  value={formData.issued_by}
                  onChange={(e) => setFormData((p: any) => ({ ...p, issued_by: e.target.value }))}
                  className="flex-1 border border-slate-300 px-2 py-1 rounded font-medium text-slate-800 outline-none" 
                />
              </div>
              <div className="flex items-center gap-3 py-1">
                <label className="w-[130px] font-bold text-[#1c4587] text-[12px] uppercase shrink-0">Received By</label>
                <input 
                  placeholder="Mill / batching in-charge"
                  value={formData.received_by}
                  onChange={(e) => setFormData((p: any) => ({ ...p, received_by: e.target.value }))}
                  className="flex-1 border border-slate-300 px-2 py-1 rounded font-medium text-slate-800 outline-none" 
                />
              </div>

              <div className="flex items-center gap-3 py-1 md:col-span-2">
                <label className="w-[130px] font-bold text-[#1c4587] text-[12px] uppercase shrink-0">Company details / Sender</label>
                <div className="flex-1">
                  <EditableComboBox
                    value={formData.party_name || ''}
                    onChange={(val) => setFormData((p: any) => ({ ...p, party_name: val }))}
                    options={["BALLY JUTE COMPANY LIMITED", "HOWRAH JUTE MILLS LTD.", "HOOGHLY JUTE MILLS CO.", "BIRLA JUTE INDUSTRIES"]}
                    placeholder="Select or enter Company details"
                  />
                </div>
              </div>

              <div className="flex gap-3 py-1 md:col-span-2 items-start">
                <label className="w-[130px] font-bold text-[#1c4587] text-[12px] uppercase shrink-0 mt-1">Remarks</label>
                <textarea 
                  placeholder="Issue notes, dampness, short / excess details, observations"
                  value={formData.remarks}
                  onChange={(e) => setFormData((p: any) => ({ ...p, remarks: e.target.value }))}
                  className="flex-1 border border-slate-300 px-2 py-1 rounded font-medium text-slate-800 outline-none min-h-[42px] resize-y"
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. DYNAMIC ALLOCATION DETAILS TABLE */}
        {issueRoute && (
          <div className="bg-white border border-[#dbe1ea] rounded-md overflow-hidden shadow-xs">
            <div className={cn(
              "flex items-center justify-between px-4 py-2 font-bold tracking-[1.5px] text-[14px] text-white",
              issueRoute === 'godown' ? "bg-gradient-to-r from-[#1c4587] to-[#2c6bb3]" :
              issueRoute === 'mill' ? "bg-gradient-to-r from-[#0b6e54] to-[#159c74]" : "bg-[#1c4587]"
            )}>
              <span>MATERIAL ISSUE DETAILS {issueRoute === 'factory' ? '(GODOWN TO FACTORY)' : ''}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addRow}
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-3 py-1 rounded text-xs font-black uppercase flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[3]" /> + Spawn Row
                </button>
                <button
                  type="button"
                  onClick={deleteLastRow}
                  className="bg-rose-900/80 hover:bg-rose-900 text-white border border-rose-300/40 px-3 py-1 rounded text-xs font-black uppercase flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" /> - Delete Row
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse min-w-[1250px]">
                {/* 5A. GODOWN GRID HEADERS */}
                {issueRoute === 'godown' && (
                  <thead>
                    <tr className="bg-[#23456f] text-white text-[11px] uppercase border-b border-[#1b3656]">
                      <th className="py-2.5 px-1 border border-slate-300 w-12">Srl</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Grade</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Marka</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Area</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Agency</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Crop Year</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-16">Code</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-24">Quantity</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Unit</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Weight (M.T)</th>
                      <th className="py-2.5 px-2 border border-slate-300 text-left">Stack Position</th>
                      <th className="py-2.5 px-1 border border-slate-300 w-12 colhide">&nbsp;</th>
                    </tr>
                  </thead>
                )}

                {/* 5B. MILL (SELL) GRID HEADERS */}
                {issueRoute === 'mill' && (
                  <thead>
                    <tr className="bg-[#0b6e54] text-white text-[11px] uppercase border-b border-[#08523f]">
                      <th className="py-2.5 px-1 border border-slate-300 w-12">Srl</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Grade</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Marka</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Area</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Agency</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Crop Year</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-16">Code</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-24">Quantity</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-24">Unit</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-24">Weight (M.T)</th>
                      <th className="py-2.5 px-2 border border-emerald-800 w-28 bg-emerald-950/20">Price / Rate</th>
                      <th className="py-2.5 px-2 border border-emerald-800 w-28 bg-emerald-950/20">Total Amount</th>
                      <th className="py-2.5 px-2 border border-slate-300 text-left">Buyer Destination Details</th>
                      <th className="py-2.5 px-1 border border-slate-300 w-12 colhide">&nbsp;</th>
                    </tr>
                  </thead>
                )}

                {/* 5B. FACTORY GRID HEADERS */}
                {issueRoute === 'factory' && (
                  <thead>
                    <tr className="bg-[#1c4587] text-white text-[11px] uppercase border-b border-[#143160]">
                      <th className="py-2.5 px-1 border border-slate-300 w-12">Srl<br/>No.</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">I.TG No.</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Grade /<br/>Quality</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Area</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-24">Quantity</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Unit</th>
                      <th className="py-2.5 px-2 border border-slate-300 w-28">Weight<br/>(M.Ton)</th>
                      <th className="py-2.5 px-1 border border-slate-300 w-12 colhide">&nbsp;</th>
                    </tr>
                  </thead>
                )}

                {/* TABLE BODY */}
                <tbody className="divide-y divide-slate-100">
                  {items.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      
                      {/* Serial */}
                      <td className="py-1 font-bold text-[#1c4587]">{idx + 1}</td>

                      {/* ROUTE BASED DYNAMIC CELLS */}
                      {issueRoute === 'factory' ? (
                        <>
                          {/* Factory Cell: I.TG No */}
                          <td>
                            <input 
                              type="text" 
                              value={row.itg_no || ''} 
                              onChange={(e) => updateRow(idx, 'itg_no', e.target.value)} 
                              className="w-full text-center py-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none" 
                            />
                          </td>
                          {/* Factory Cell: Grade */}
                          <td>
                            <select 
                              value={row.grade_name} 
                              onChange={(e) => updateRow(idx, 'grade_name', e.target.value)}
                              className="w-full text-center py-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none font-bold"
                            >
                              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </td>
                          {/* Factory Cell: Area */}
                          <td>
                            <input 
                              type="text" 
                              value={row.area || ''} 
                              onChange={(e) => updateRow(idx, 'area', e.target.value)} 
                              className="w-full text-center py-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none" 
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Godown/Mill Cell: Grade */}
                          <td>
                            <select 
                              value={row.grade_name} 
                              onChange={(e) => updateRow(idx, 'grade_name', e.target.value)}
                              className="w-full text-center py-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none font-bold"
                            >
                              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </td>
                          {/* Godown/Mill Cell: Marka */}
                          <td>
                            <input 
                              type="text" 
                              value={row.marka || ''} 
                              onChange={(e) => updateRow(idx, 'marka', e.target.value)} 
                              className="w-full text-center py-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none font-mono" 
                            />
                          </td>
                          {/* Godown/Mill Cell: Area */}
                          <td>
                            <input 
                              type="text" 
                              value={row.area || ''} 
                              onChange={(e) => updateRow(idx, 'area', e.target.value)} 
                              className="w-full text-center py-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none" 
                            />
                          </td>
                          {/* Godown/Mill Cell: Agency */}
                          <td>
                            <input 
                              type="text" 
                              value={row.agency || ''} 
                              onChange={(e) => updateRow(idx, 'agency', e.target.value)} 
                              className="w-full text-center py-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none" 
                            />
                          </td>
                          {/* Godown/Mill Cell: Crop Year */}
                          <td>
                            <select 
                              value={row.crop} 
                              onChange={(e) => updateRow(idx, 'crop', e.target.value)}
                              className="w-full text-center py-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none"
                            >
                              {CROPS.map(cr => <option key={cr} value={cr}>{cr}</option>)}
                            </select>
                          </td>
                          {/* Godown/Mill Cell: Code */}
                          <td>
                            <select 
                              value={row.code} 
                              onChange={(e) => updateRow(idx, 'code', e.target.value)}
                              className="w-full text-center py-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none font-bold text-blue-900"
                            >
                              <option value=""></option>
                              {row.code && !BATCH_CODES[row.code] && <option value={row.code}>{row.code}</option>}
                              {Object.keys(BATCH_CODES).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                        </>
                      )}

                      {/* COMMON QUANTITY, UNIT, WEIGHT, PLACE CELLS */}
                      
                      {/* Quantity */}
                      <td>
                        <input 
                          type="number" 
                          min="0"
                          placeholder="0"
                          value={row.qty || ''} 
                          onChange={(e) => updateRow(idx, 'qty', parseFloat(e.target.value) || 0)} 
                          className="w-full text-right pr-2 py-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none font-bold text-[#1c4587]" 
                        />
                      </td>

                      {/* Unit */}
                      <td>
                        <select 
                          value={row.unit} 
                          onChange={(e) => updateRow(idx, 'unit', e.target.value)}
                          className="w-full text-center py-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none font-bold"
                        >
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>

                      {/* Weight (Kgs is stored, but input is mapped to M.T.) */}
                      <td>
                        <input 
                          type="number" 
                          step="0.001"
                          min="0"
                          placeholder="0.000"
                          value={row.weight_kgs ? (row.weight_kgs / 1000) : ''} 
                          onChange={(e) => updateRow(idx, 'weight_kgs', (parseFloat(e.target.value) || 0) * 1000)} 
                          className="w-full text-right pr-2 py-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none font-bold text-slate-800" 
                        />
                      </td>

                      {/* Price / Rate and Total Amount columns for Sell (mill) route */}
                      {issueRoute === 'mill' && (
                        <>
                          <td>
                            <input 
                              type="number" 
                              min="0"
                              placeholder="0.00"
                              value={row.rate || ''} 
                              onChange={(e) => updateRow(idx, 'rate', parseFloat(e.target.value) || 0)} 
                              className="w-full text-right pr-2 py-1 border border-transparent rounded bg-transparent focus:bg-white border-emerald-300 focus:border-[#0b6e54] outline-none font-bold text-emerald-800 font-mono bg-emerald-50/20" 
                            />
                          </td>
                          <td className="text-right pr-2 font-mono font-bold text-emerald-950">
                            {row.qty && row.rate ? (row.qty * row.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </td>
                        </>
                      )}

                      {/* Place/Dest (Godown and Mill routes only) */}
                      {issueRoute !== 'factory' && (
                        <td>
                          <input 
                            type="text" 
                            placeholder="Stack / section ref"
                            value={row.place || row.location_dest || ''} 
                            onChange={(e) => {
                              updateRow(idx, 'place', e.target.value);
                              updateRow(idx, 'location_dest', e.target.value);
                            }} 
                            className="w-full py-1 px-2 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none text-left font-medium" 
                          />
                        </td>
                      )}

                      {/* Actions delete row */}
                      <td className="colhide py-1">
                        <button 
                          type="button" 
                          title="Delete Row"
                          onClick={() => deleteRow(idx)}
                          className="text-red-600 hover:text-red-900 font-extrabold text-[15px] border-none bg-none cursor-pointer px-2"
                        >
                          &times;
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>

                {/* FOOTER SPLIT TOTALS - AUTO CALCULATED */}
                <tfoot>
                  <tr className="bg-[#eaf0f8] text-[#1c4587] font-bold border-b border-slate-200">
                    <td className="py-2 text-right pr-4 font-extrabold uppercase" colSpan={issueRoute === 'factory' ? 4 : 7}>TOTAL BALES ISSUED</td>
                    <td className="text-right pr-2 font-mono text-[13px] font-black">{splitTotals.balesQ}</td>
                    <td>BALES</td>
                    <td className="text-right pr-2 font-mono text-[13px] font-black">{splitTotals.balesW.toFixed(3)}</td>
                    {issueRoute === 'mill' ? (
                      <>
                        <td className="text-right pr-2 font-mono font-bold text-slate-500">&mdash;</td>
                        <td className="text-right pr-2 font-mono font-bold text-emerald-900">
                          {items
                            .filter(it => (it.unit || 'BALES').toUpperCase() === 'BALES')
                            .reduce((sum, it) => sum + ((parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0)), 0)
                            .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td colSpan={2} className="colhide"></td>
                      </>
                    ) : (
                      <td className="colhide"></td>
                    )}
                  </tr>

                  <tr className="bg-[#23456f] text-white font-bold  text-[13px]">
                    <td className="py-2.5 text-right pr-4 font-black uppercase" colSpan={issueRoute === 'factory' ? 4 : 7}>GRAND TOTAL</td>
                    <td className="text-right pr-2 font-mono font-black">{splitTotals.grandQ}</td>
                    <td>&mdash;</td>
                    <td className="text-right pr-2 font-mono font-black">{splitTotals.grandW.toFixed(3)}</td>
                    {issueRoute === 'mill' ? (
                      <>
                        <td className="text-right pr-2 font-mono font-bold text-emerald-100">&mdash;</td>
                        <td className="text-right pr-2 font-mono font-black text-[#5df3c3]">
                          ₹{splitTotals.grandAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td colSpan={2} className="colhide"></td>
                      </>
                    ) : (
                      <td className="colhide"></td>
                    )}
                  </tr>
                </tfoot>

              </table>
            </div>

            {/* Bottom Spawn Row Bar */}
            <div className="bg-slate-50 border-t border-slate-200 p-2.5 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1">
                Need extra allocation rows for Godown / Factory? Click Spawn Row to append a new entry line or Delete Row to remove.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addRow}
                  className="bg-[#1c4587] hover:bg-[#143160] text-white font-extrabold px-3.5 py-1 rounded text-xs uppercase flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <Plus className="h-4 w-4 stroke-[3]" /> + Spawn Row
                </button>
                <button
                  type="button"
                  onClick={deleteLastRow}
                  className="bg-rose-800 hover:bg-rose-900 text-white font-extrabold px-3.5 py-1 rounded text-xs uppercase flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <Trash2 className="h-4 w-4" /> - Delete Row
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. ACTION ZONE */}
        {issueRoute && (
          <div className="flex items-center gap-3 bg-white p-4 border border-[#dbe1ea] rounded-md flex-wrap  shadow-xs">
            <span className="text-[11px] text-slate-400 font-bold mr-auto">
              Selecting a Code auto-fills the Batch Name. Totals split and reconcile automatically.
            </span>
            
            <button 
              type="button" 
              onClick={resetAll}
              className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-4 py-2 rounded cursor-pointer transition-colors"
            >
              Clear
            </button>

            <button 
              type="button" 
              onClick={() => window.print()}
              className="bg-[#e0972f] hover:brightness-95 text-white font-bold px-4 py-2 rounded cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              <span>Print Slip</span>
            </button>

            <button 
              type="button" 
              onClick={handleSave}
              className="bg-[#159c74] hover:bg-[#117c5d] text-white font-extrabold px-5 py-2 rounded cursor-pointer transition-all flex items-center gap-1.5 shadow-sm hover:shadow"
            >
              <Check className="h-4 w-4 stroke-[3]" />
              <span>
                {issueRoute === 'godown' ? 'Save & Stack' :
                 issueRoute === 'mill' ? 'Save & Sell (Factory to Factory)' : 'Save & Issue'}
              </span>
            </button>
          </div>
        )}

      </div>
    </EntryContainer>
  );
}
