import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  User, 
  ChevronDown, 
  Printer, 
  ArrowLeft, 
  Save, 
  X,
  FileText
} from 'lucide-react';
import { Sauda } from '../types';
import { dbModule } from '../services/dbModule';
import { supabase } from '../lib/supabase';
import { enforceEditOrDeletePermission } from '../lib/permissions';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';

import BasicDetailsCard from '../components/BasicDetailsCard';
import TransportationCard from '../components/TransportationCard';
import QualityDetailsTable from '../components/QualityDetailsTable';
import ShipmentClaimsCard from '../components/ShipmentClaimsCard';
import RemarksCard from '../components/RemarksCard';
import FooterActions from '../components/FooterActions';
import SaudaPrintSlip from '../components/SaudaPrintSlip';

const UNIT_OPTIONS = ["BALES", "DRUMS", "LOOSE", "P.BALES", "H.BALES"];

const compareQualities = (aStr: string, bStr: string): number => {
  const clean = (val: string) => {
    return String(val || '')
      .trim()
      .replace(/\.$/, '')
      .replace(/\s+/g, '')
      .toUpperCase();
  };

  const a = clean(aStr);
  const b = clean(bStr);

  if (!a && !b) return 0;
  if (!a) return 1;
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

  if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
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

    if (prefixA === prefixB) return numA - numB;
    return prefixA.localeCompare(prefixB);
  }

  return a.localeCompare(b);
};

export default function SaudaEntry({ 
  initialData, 
  onSave, 
  onCancel 
}: { 
  initialData?: any; 
  onSave?: (d: any) => void; 
  onCancel?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [showPrintSlip, setShowPrintSlip] = useState(false);

  const [brokers, setBrokers] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [markas, setMarkas] = useState<any[]>([]);
  const [baseRatesList, setBaseRatesList] = useState<any[]>([]);
  const [dbDiffsList, setDbDiffsList] = useState<any[]>([]);

  const today = new Date().toISOString().split('T')[0];

  const getInitialFormData = (): Sauda => {
    if (initialData) {
      const copy = { ...initialData };
      copy.broker = (copy.broker || '').toUpperCase();
      copy.supplier = (copy.supplier || '').toUpperCase();
      copy.challan_supplier = (copy.challan_supplier || '').toUpperCase();
      copy.area = (copy.area || '').toUpperCase();
      
      const realQD = (copy.quality_details || [])
        .filter((item: any) => item.quality || item.qty || item.agency || item.marka || item.rs)
        .sort((a: any, b: any) => compareQualities(a.quality || '', b.quality || ''));

      const existingCount = realQD.length;
      if (existingCount < 7) {
        const remaining = 7 - existingCount;
        const extra = Array.from({ length: remaining }, () => ({ quality: '', qty: 0, agency: '', marka: '', rs: 0 }));
        copy.quality_details = [...realQD, ...extra];
      } else {
        copy.quality_details = realQD;
      }
      return copy;
    }

    return {
      sauda_no: '0153',
      financial_year: '2026-2027',
      session: 'BJCL/2026-2027/',
      po_type: 'Normal',
      date: today,
      broker: '',
      supplier: '',
      challan_supplier: '',
      area: '',
      agency: '',
      marks: '',
      no_of_lorries: 1,
      units_per_lorry_type: 'BALES',
      total_unit: 0,
      wt_per_lorry: 0,
      unit_type: 'BALES',
      total_wt_in_ton: 0,
      shipment_date: today,
      shipment_days: 0,
      shipment_penalty: 5,
      marks_claim: 0,
      quantity_claim: 0,
      remarks: 'Area, Agency Grade, Grade differential can change as per market.',
      b_rate: 0,
      b_date: today,
      superior_normal_marks: 'New (F2)',
      signature_url: '',
      status: 'pending',
      quality_details: Array.from({ length: 7 }, () => ({ quality: '', qty: 0, agency: '', marka: '', rs: 0 }))
    };
  };

  const [formData, setFormData] = useState<Sauda>(getInitialFormData());

  const formContainerRef = useRef<HTMLDivElement>(null);
  useKeyboardNavigation(formContainerRef);

  useEffect(() => {
    async function loadMasterData() {
      try {
        const [brokData, suppData, areaData, agcData, gradeData, markaData, allSaudas, sattaBaseRates, sattaDiffs] = await Promise.all([
          dbModule.fetchAll('broker_master'),
          dbModule.fetchAll('supply_master'),
          dbModule.fetchAll('area_master'),
          dbModule.fetchAll('agency_master'),
          dbModule.fetchAll('grade_master'),
          dbModule.fetchAll('marka_master').catch(() => []),
          dbModule.fetchAll('sauda_master').catch(() => []),
          supabase ? supabase.from('satta_base_rates').select('*').order('start_date', { ascending: false }).then(r => r.data || []) : Promise.resolve([]),
          supabase ? supabase.from('satta_differentials').select('*').then(r => r.data || []) : Promise.resolve([])
        ]);

        if (brokData) setBrokers(brokData.map((b: any) => b.brok_name || b.name || '').filter(Boolean));
        if (suppData) setSuppliers(suppData.map((s: any) => s.supp_name || s.name || '').filter(Boolean));
        if (areaData) setAreas(areaData.map((a: any) => a.area_name || a.name || '').filter(Boolean));
        if (agcData) setAgencies(agcData);
        if (gradeData) setGrades(gradeData);
        if (markaData) setMarkas(markaData);
        if (sattaBaseRates) setBaseRatesList(sattaBaseRates);
        if (sattaDiffs) setDbDiffsList(sattaDiffs);

        // Auto-generate next Order No. if creating new Sauda
        if (!initialData && allSaudas && allSaudas.length > 0) {
          const numbers = allSaudas.map((s: any) => {
            const val = parseInt(s.sauda_no || '0', 10);
            return isNaN(val) ? 0 : val;
          });
          const maxNo = Math.max(...numbers, 152);
          const nextNoStr = String(maxNo + 1).padStart(4, '0');
          setFormData(prev => ({
            ...prev,
            sauda_no: nextNoStr,
            session: `BJCL/2026-2027/${nextNoStr}`
          }));
        }
      } catch (err) {
        console.error("Error loading master data:", err);
      }
    }

    loadMasterData();
  }, [initialData]);

  // Recalculate Satta rate for a quality row based on Date, Area, Grade
  const recalculateRowRate = (date: string, area: string, grade: string) => {
    if (!date || !area || !grade || baseRatesList.length === 0) return null;

    const dStr = date;
    const sortedBaseRates = [...baseRatesList].sort((a, b) => b.start_date.localeCompare(a.start_date));
    const effectiveBase = sortedBaseRates.find(r => r.start_date <= dStr) || sortedBaseRates[sortedBaseRates.length - 1];
    const baseVal = effectiveBase ? Number(effectiveBase.base_rate) : 17500;

    const cleanArea = area.trim().toUpperCase();
    const cleanGrade = grade.trim().toUpperCase();

    const lookupAreas = [cleanArea];
    if (cleanArea === 'SEMI NORTHERN' || cleanArea.includes('SEMI NORTHERN')) {
      lookupAreas.push('NORTHERN');
    } else if (cleanArea === 'NORTHERN' || cleanArea.includes('NORTHERN')) {
      lookupAreas.push('SEMI NORTHERN');
    }

    if (cleanArea.includes('PURNEA') || cleanArea.includes('BIHAR')) {
      if (!lookupAreas.includes('PURNEA(BIHAR)')) lookupAreas.push('PURNEA(BIHAR)');
      if (!lookupAreas.includes('PURNEA (BIHAR)')) lookupAreas.push('PURNEA (BIHAR)');
    }

    let diffVal: number | undefined;
    for (const lookupArea of lookupAreas) {
      const diffObj = dbDiffsList.find(
        d => (d.area || '').toUpperCase() === lookupArea && 
             (d.grade || '').toUpperCase() === cleanGrade
      );
      if (diffObj) {
        diffVal = Number(diffObj.differential);
        break;
      }
    }

    if (diffVal !== undefined) {
      return baseVal + diffVal;
    }

    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let finalValue: any = value;

    setFormData(prev => {
      const updated = { ...prev, [name]: finalValue };

      // Calculate Shipment Days automatically: Shipment Date - Contract Date
      if (name === 'shipment_date' || name === 'date') {
        const contractDt = name === 'date' ? new Date(value) : new Date(prev.date || today);
        const shipmentDt = name === 'shipment_date' ? new Date(value) : new Date(prev.shipment_date || today);
        if (!isNaN(contractDt.getTime()) && !isNaN(shipmentDt.getTime())) {
          const diffDays = Math.max(0, Math.ceil((shipmentDt.getTime() - contractDt.getTime()) / (1000 * 3600 * 24)));
          updated.shipment_days = diffDays;
        }
      }

      // Sync Unit Type when Units/Lorry changes
      if (name === 'units_per_lorry_type') {
        updated.unit_type = finalValue;
      }

      // Automatically calculate total_wt_in_ton = no_of_lorries * wt_per_lorry
      if (name === 'no_of_lorries' || name === 'wt_per_lorry') {
        const lorries = name === 'no_of_lorries' ? parseFloat(value) || 0 : parseFloat(prev.no_of_lorries as any) || 0;
        const wt = name === 'wt_per_lorry' ? parseFloat(value) || 0 : parseFloat(prev.wt_per_lorry as any) || 0;
        updated.total_wt_in_ton = parseFloat((lorries * wt).toFixed(3));
      }

      // Automatically update quality rates if area or date changes
      if ((name === 'area' || name === 'date') && finalValue) {
        const currentArea = name === 'area' ? finalValue : prev.area;
        const currentDate = name === 'date' ? finalValue : prev.date;

        if (currentArea) {
          let firstCalculated = null;
          const updatedQD = (updated.quality_details || []).map((row: any, i: number) => {
            if (row.quality) {
              const calculatedPrice = recalculateRowRate(currentDate || today, currentArea, row.quality);
              if (calculatedPrice !== null) {
                if (i === 0) firstCalculated = calculatedPrice;
                return { ...row, rs: calculatedPrice };
              }
            }
            return row;
          });
          updated.quality_details = updatedQD;
          if (firstCalculated !== null) updated.b_rate = firstCalculated;
        }
      }

      // Auto sync Order No. and Session
      if (name === 'sauda_no' && value) {
        const cleanVal = value.trim();
        const financialYear = prev.financial_year || '2026-2027';
        updated.session = `BJCL/${financialYear}/${cleanVal}`;
      }

      return updated;
    });
  };

  const handleSelectChange = (field: string, val: string) => {
    handleChange({
      target: { name: field, value: val }
    } as any);
  };

  const handleQualityChange = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const qd = [...(prev.quality_details || [])];
      qd[index] = { ...qd[index], [field]: value };

      if (field === 'quality' && value && prev.area) {
        const calculatedPrice = recalculateRowRate(prev.date || today, prev.area, value);
        if (calculatedPrice !== null) {
          qd[index].rs = calculatedPrice;
          if (index === 0) {
            return { ...prev, quality_details: qd, b_rate: calculatedPrice };
          }
        }
      }

      return { ...prev, quality_details: qd };
    });
  };

  const handleAddQualityRow = () => {
    setFormData(prev => ({
      ...prev,
      quality_details: [...(prev.quality_details || []), { quality: '', qty: 0, agency: '', marka: '', rs: 0 }]
    }));
  };

  const handleDeleteQualityRow = () => {
    setFormData(prev => {
      const current = prev.quality_details || [];
      if (current.length <= 1) return prev;
      return {
        ...prev,
        quality_details: current.slice(0, -1)
      };
    });
  };

  const handleRemoveQualityRowAt = (index: number) => {
    setFormData(prev => {
      const current = [...(prev.quality_details || [])];
      if (current.length <= 1) {
        current[0] = { quality: '', qty: 0, agency: '', marka: '', rs: 0 };
        return { ...prev, quality_details: current };
      }
      current.splice(index, 1);
      return { ...prev, quality_details: current };
    });
  };

  const handleSave = async () => {
    if ((formData.sauda_id || initialData) && !enforceEditOrDeletePermission("Edit")) {
      return;
    }

    if (!formData.sauda_no || !formData.broker || !formData.supplier || !formData.area) {
      alert("Please fill in required fields: Order No., Broker, Supplier, and Area.");
      return;
    }

    setLoading(true);
    try {
      const saudaData = { ...formData };
      const qd = saudaData.quality_details;

      // Extract first row agency/marka into main master record for backward compatibility
      if (qd && qd.length > 0) {
        const validFirst = qd.find((x: any) => x.quality || x.agency || x.marka);
        if (validFirst) {
          if (validFirst.agency) saudaData.agency = validFirst.agency;
          if (validFirst.marka) saudaData.marks = validFirst.marka;
        }
      }

      const SAUDA_MASTER_FIELDS = [
        'sauda_id',
        'financial_year',
        'sauda_no',
        'session',
        'po_type',
        'date',
        'broker',
        'supplier',
        'challan_supplier',
        'area',
        'agency',
        'marks',
        'no_of_lorries',
        'units_per_lorry_type',
        'total_unit',
        'wt_per_lorry',
        'unit_type',
        'total_wt_in_ton',
        'shipment_date',
        'shipment_days',
        'shipment_penalty',
        'marks_claim',
        'quantity_claim',
        'remarks',
        'b_rate',
        'b_date',
        'superior_normal_marks',
        'signature_url',
        'status',
        'created_at'
      ];

      const saudaPayload: Record<string, any> = {};
      SAUDA_MASTER_FIELDS.forEach(field => {
        if ((saudaData as any)[field] !== undefined) {
          saudaPayload[field] = (saudaData as any)[field];
        }
      });

      let inserted;
      let isEditMode = !!saudaPayload.sauda_id;

      if (!saudaPayload.sauda_id && saudaPayload.sauda_no) {
        const targetFYear = saudaPayload.financial_year || '2026-2027';
        const allSaudas = await dbModule.fetchAll('sauda_master').catch(() => []);
        const match = allSaudas.find((s: any) => s.sauda_no === saudaPayload.sauda_no && s.financial_year === targetFYear);
        if (match) {
          saudaPayload.sauda_id = match.sauda_id;
          isEditMode = true;
        }
      }

      if (saudaPayload.sauda_id) {
        inserted = await dbModule.update('sauda_master', 'sauda_id', saudaPayload.sauda_id, saudaPayload);
      } else {
        inserted = await dbModule.insert('sauda_master', saudaPayload);
      }

      if (inserted && qd) {
        if (isEditMode) {
          await dbModule.delete('sauda_quality_details', 'sauda_id', inserted.sauda_id);
        }

        const sortedQd = [...qd].sort((a: any, b: any) => compareQualities(a.quality || '', b.quality || ''));
        for (const row of sortedQd) {
          if (row.quality || row.qty || row.rs || row.marka || row.agency) {
            try {
              await dbModule.insert('sauda_quality_details', {
                sauda_id: inserted.sauda_id,
                financial_year: inserted.financial_year || saudaData.financial_year,
                quality: row.quality,
                qty: Number(row.qty) || 0,
                agency: row.agency || '',
                marka: row.marka || '',
                rs: Number(row.rs) || 0
              });
            } catch (e) {
              console.error(e);
            }
          }
        }
      }

      alert("Sauda Contract saved successfully!");
      onSave?.(saudaData);
    } catch (err: any) {
      console.error(err);
      alert("Save failed: " + (err.message || "Database error."));
    } finally {
      setLoading(false);
    }
  };

  return (
<<<<<<< Updated upstream
    <div className="min-h-screen bg-[#F7F5EF] flex flex-col font-sans text-slate-800">
      {/* 1. Enterprise Top Bar Header */}
      <header className="bg-[#174C2C] text-white px-6 py-3.5 shadow-md flex items-center justify-between border-b border-[#0F331D]">
        <div className="flex items-center gap-3">
          <div className="bg-[#D4AF37] text-[#174C2C] font-serif font-black text-sm px-2.5 py-1 rounded shadow-2xs tracking-wider uppercase">
            BJ
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg tracking-wide text-white leading-none">
              Bally Jute Limited
            </h1>
            <span className="text-[10px] text-[#D4AF37] font-mono tracking-widest uppercase block mt-0.5">
              ESTD. 1979. 1979
            </span>
          </div>
=======
    <LegacyLayout 
      title={initialData ? "P.O Automation » [EDIT SAUDA / ORDER]" : "P.O Automation » [NEW SAUDA / ORDER ENTRY]"} 
      subtitle={initialData ? "Update existing Sauda Contract / Order" : "Create a new Sauda Contract / Order"} 
      onClose={onCancel}
    >
      <div ref={formContainerRef} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
        {/* Main Header Form */}
        <div className="grid grid-cols-12 gap-4">
           {/* Feeding Column */}
           <div className="col-span-12 flex flex-col gap-4">
              {/* <LegacyFieldset legend="Basic Details">
                 <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-1 items-center">
                     <div className="col-span-3 flex items-center gap-2">
                        <label className="text-[11px] font-bold w-12 shrink-0">Session</label>
                        <input className="flex-1 bg-slate-100 border border-gray-400 p-0.5 text-xs font-black text-slate-600" name="session" value={displaySessionValue} readOnly title="Session base path" />
                     </div>

                     <div className="col-span-3 flex items-center gap-2">
                        <label className="text-[11px] font-bold w-20 shrink-0 text-red-900 uppercase">Order No.</label>
                        <input className="flex-1 bg-[#ffffd0] border border-gray-400 p-0.5 text-xs font-black text-red-900" name="sauda_no" value={formData.sauda_no || ''} onChange={handleChange} placeholder="e.g. 0152" required />
                     </div>
                     
                     <div className="col-span-3 flex items-center gap-2">
                        <label className="text-[11px] font-bold w-16 shrink-0 text-blue-900 italic uppercase">P.O. Type</label>
                        <select name="po_type" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs" value={formData.po_type} onChange={handleChange}>
                           <option>Normal</option>
                           <option>PTF</option>
                        </select>
                     </div>
                     
                     <div className="col-span-3 flex items-center gap-2">
                        <label className="text-[11px] font-bold w-12 shrink-0">Date</label>
                        <input type="date" name="date" value={formData.date} onChange={handleChange} className="flex-1 bg-white border border-gray-400 p-0.5 text-xs outline-none" />
                     </div>

                    <ComboField label="Broker" name="broker" value={formData.broker} onChange={handleChange} options={brokers.map(b => b.brok_name)} />
                    <ComboField label="Supplier" name="supplier" value={formData.supplier} onChange={handleChange} options={suppliers.map(s => s.supp_name)} />
                    <ComboField label="Challan Supplier" name="challan_supplier" value={formData.challan_supplier} onChange={handleChange} options={suppliers.map(s => s.supp_name)} />
                    <ComboField label="Area" name="area" value={formData.area} onChange={handleChange} options={areas.map(a => a.area_name)} />

                 </div>
              </LegacyFieldset> */}

              {/* Basic details new */}

              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">

                {/* Header */}
                <div className="bg-[#1A2619] px-6 py-4">
                    <h2 className="text-white font-bold text-lg">
                        Basic Details
                    </h2>
                    <p className="text-blue-100 text-sm">
                        Purchase Order Information
                    </p>
                </div>

                <div className="p-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

                        {/* Session */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Session
                            </label>

                            <input
                                name="session"
                                value={displaySessionValue}
                                readOnly
                                className="w-full rounded-xl border bg-slate-100 border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                            />
                        </div>

                        {/* Order Number */}

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Order Number
                            </label>

                            <input
                                name="sauda_no"
                                value={formData.sauda_no || ""}
                                onChange={handleChange}
                                placeholder="Enter Order No."
                                className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 font-bold focus:ring-2 focus:ring-red-400 outline-none"
                            />
                        </div>

                        {/* PO Type */}

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                P.O. Type
                            </label>

                            <select
                                name="po_type"
                                value={formData.po_type}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option>Normal</option>
                                <option>PTF</option>
                            </select>
                        </div>

                        {/* Date */}

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Date
                            </label>

                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">

                        <ComboField
                            label="Broker"
                            name="broker"
                            value={formData.broker}
                            onChange={handleChange}
                            options={brokers.map((b) => b.brok_name)}
                        />

                        <ComboField
                            label="Supplier"
                            name="supplier"
                            value={formData.supplier}
                            onChange={handleChange}
                            options={suppliers.map((s) => s.supp_name)}
                        />

                        <ComboField
                            label="Challan Supplier"
                            name="challan_supplier"
                            value={formData.challan_supplier}
                            onChange={handleChange}
                            options={suppliers.map((s) => s.supp_name)}
                        />

                        <ComboField
                            label="Area"
                            name="area"
                            value={formData.area}
                            onChange={handleChange}
                            options={areas.map((a) => a.area_name)}
                        />

                    </div>

                </div>

            </div>
              

              {/* <div className="grid grid-cols-12 gap-x-4">
                 <div className="col-span-8">
                    <LegacyFieldset legend="Unit & Transportation Details">
                       <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-1 items-center px-1 pb-1">
                          <div className="flex items-center gap-2">
                             <label className="text-[11px] font-bold w-24 shrink-0 text-gray-700">No. of Lorries</label>
                             <input type="number" name="no_of_lorries" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.no_of_lorries} onChange={handleChange} />
                          </div>
                          <div className="flex items-center gap-2">
                             <label className="text-[11px] font-bold w-24 shrink-0 text-gray-700">Units/Lorry</label>
                             <select name="units_per_lorry_type" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs" value={formData.units_per_lorry_type} onChange={handleChange}>
                                {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                             </select>
                          </div>
                          <div className="flex items-center gap-2">
                             <label className="text-[11px] font-bold w-24 shrink-0 text-gray-700">Total Unit</label>
                             <input type="number" name="total_unit" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.total_unit} onChange={handleChange} />
                          </div>
                          <div className="flex items-center gap-2">
                             <label className="text-[11px] font-bold w-24 shrink-0 text-gray-700">Wt/Lorry</label>
                             <input type="number" name="wt_per_lorry" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.wt_per_lorry} onChange={handleChange} />
                          </div>
                          <div className="flex items-center gap-2">
                             <label className="text-[11px] font-bold w-24 shrink-0 text-gray-700">Unit Type</label>
                             <select name="unit_type" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs" value={formData.unit_type} onChange={handleChange}>
                                {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                             </select>
                          </div>
                          <div className="flex items-center gap-2">
                             <label className="text-[11px] font-bold w-24 shrink-0 text-gray-700">Total Wt. in Ton</label>
                             <input type="number" name="total_wt_in_ton" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.total_wt_in_ton} onChange={handleChange} />
                          </div>
                       </div>
                    </LegacyFieldset>
                 </div>
                 
                 <div className="col-span-4">
                    <LegacyFieldset legend="Issue">
                       <div className="flex flex-col gap-y-3 mt-1 items-center justify-center p-4">
                          <span className="text-gray-400 text-xs italic">No issues recorded</span>
                       </div>
                    </LegacyFieldset>
                 </div>
              </div> */}

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Unit & Transportation */}
                <div className="xl:col-span-8">

                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">

                        <div className="bg-[#1A2619] px-6 py-4">
                            <h2 className="text-white font-bold text-lg">
                                Unit & Transportation Details
                            </h2>
                            <p className="text-slate-200 text-sm">
                                Transportation & Weight Information
                            </p>
                        </div>

                        <div className="p-6">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                {/* No. of Lorries */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        No. of Lorries
                                    </label>

                                    <input
                                        type="number"
                                        name="no_of_lorries"
                                        value={formData.no_of_lorries}
                                        onChange={handleChange}
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:ring-2 focus:ring-green-700 outline-none"
                                    />
                                </div>

                                {/* Units/Lorry */}

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Units / Lorry
                                    </label>

                                    <select
                                        name="units_per_lorry_type"
                                        value={formData.units_per_lorry_type}
                                        onChange={handleChange}
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:ring-2 focus:ring-green-700 outline-none"
                                    >
                                        {unitOptions.map((u) => (
                                            <option key={u} value={u}>
                                                {u}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Total Unit */}

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Total Unit
                                    </label>

                                    <input
                                        type="number"
                                        name="total_unit"
                                        value={formData.total_unit}
                                        onChange={handleChange}
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-right focus:ring-2 focus:ring-green-700 outline-none"
                                    />
                                </div>

                                {/* Weight/Lorry */}

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Weight / Lorry
                                    </label>

                                    <input
                                        type="number"
                                        name="wt_per_lorry"
                                        value={formData.wt_per_lorry}
                                        onChange={handleChange}
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-right focus:ring-2 focus:ring-green-700 outline-none"
                                    />
                                </div>

                                {/* Unit Type */}

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Unit Type
                                    </label>

                                    <select
                                        name="unit_type"
                                        value={formData.unit_type}
                                        onChange={handleChange}
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:ring-2 focus:ring-green-700 outline-none"
                                    >
                                        {unitOptions.map((u) => (
                                            <option key={u} value={u}>
                                                {u}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Total Weight */}

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Total Weight (Ton)
                                    </label>

                                    <input
                                        type="number"
                                        name="total_wt_in_ton"
                                        value={formData.total_wt_in_ton}
                                        onChange={handleChange}
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-right bg-green-50 font-semibold focus:ring-2 focus:ring-green-700 outline-none"
                                    />
                                </div>

                            </div>

                        </div>

                    </div>

                </div>

                {/* Issue Card */}

                <div className="xl:col-span-4">

                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden h-full">

                        <div className="bg-[#1A2619] px-6 py-4">
                            <h2 className="text-white font-bold text-lg">
                                Issue Status
                            </h2>
                            <p className="text-slate-200 text-sm">
                                Current Order Status
                            </p>
                        </div>

                        <div className="flex flex-col items-center justify-center h-[320px]">

                            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">

                                <svg
                                    className="w-10 h-10 text-green-700"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>

                            </div>

                            <h3 className="text-lg font-semibold text-slate-700">
                                No Issues
                            </h3>

                            <p className="text-slate-500 text-sm mt-2">
                                Everything looks good.
                            </p>

                        </div>

                    </div>

                </div>
              </div>
              
              {/* <LegacyFieldset legend="Quality Details">
                 <div className="flex justify-end gap-1.5 mb-1.5">
                    <button
                       type="button"
                       onClick={handleAddQualityRow}
                       className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                       + Spawn Row
                    </button>
                    <button
                       type="button"
                       onClick={handleDeleteQualityRow}
                       className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                       - Delete Row
                    </button>
                 </div>
                 <div className="grid grid-cols-12 gap-2 border-b border-gray-400 bg-gray-200 p-1">
                    <div className="col-span-3 text-[10px] font-bold uppercase text-center">Quality</div>
                    <div className="col-span-2 text-[10px] font-bold uppercase text-center">Qty</div>
                    <div className="col-span-3 text-[10px] font-bold uppercase text-center">Agency</div>
                    <div className="col-span-2 text-[10px] font-bold uppercase text-center">Marka</div>
                    <div className="col-span-2 text-[10px] font-bold uppercase text-center">Rs.</div>
                 </div>
                 {formData.quality_details?.map((qd, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 mt-1 items-center">
                       <div className="col-span-3">
                          <select 
                             name="quality" 
                             className="w-full bg-white border border-gray-400 p-0.5 text-xs font-bold" 
                             value={grades.find(g => {
                               const clean = (s) => (s || '').trim().replace(/\.$/, '').toUpperCase();
                               return clean(g.grade_name) === clean(qd.quality) || clean(g.grade_code) === clean(qd.quality);
                             })?.grade_name || qd.quality || ''} 
                             onChange={(e) => handleQualityChange(i, e)}
                           >
                             <option value="">--Select Quality--</option>
                             {qd.quality && !grades.some(g => {
                               const clean = (s) => (s || '').trim().replace(/\.$/, '').toUpperCase();
                               return clean(g.grade_name) === clean(qd.quality) || clean(g.grade_code) === clean(qd.quality);
                             }) && (
                               <option value={qd.quality}>{qd.quality}</option>
                             )}
                             {grades.map(g => <option key={g.grade_code} value={g.grade_name}>{g.grade_name}</option>)}
                          </select>
                       </div>
                       <div className="col-span-2">
                          <input type="number" name="qty" className="w-full bg-white border border-gray-400 p-0.5 text-xs text-right" value={qd.qty || ''} onChange={(e) => handleQualityChange(i, e)} placeholder="Qty" />
                       </div>
                       <div className="col-span-3">
                          <input 
                             type="text" 
                             name="agency" 
                             className="w-full bg-white border border-gray-400 p-0.5 text-xs font-bold uppercase" 
                             value={qd.agency || ''} 
                             onChange={(e) => handleQualityChange(i, e)} 
                             list="agency_card_list"
                             placeholder="Agency" 
                          />
                       </div>
                       <div className="col-span-2">
                          <input 
                             type="text" 
                             name="marka" 
                             className="w-full bg-white border border-gray-400 p-0.5 text-xs font-bold uppercase" 
                             value={qd.marka || ''} 
                             onChange={(e) => handleQualityChange(i, e)} 
                             list="marka_list_options"
                             placeholder="Marka" 
                          />
                       </div>
                       <div className="col-span-2">
                          <input type="number" name="rs" className="w-full bg-white border border-gray-400 p-0.5 text-xs text-right" value={qd.rs || ''} onChange={(e) => handleQualityChange(i, e)} placeholder="Rs." />
                       </div>
                    </div>
                 ))}
                 <datalist id="marka_list_options">
                    {markas.map((m: any, idx: number) => (
                       <option key={idx} value={m.marka_name} />
                    ))}
                  </datalist>
                  <datalist id="agency_card_list">
                     {agencies.map((a: any, idx: number) => (
                        <option key={idx} value={a.agency_name} />
                     ))}
                  </datalist>
              </LegacyFieldset> */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">

                {/* Header */}
                <div className="bg-[#1A2619] px-6 py-4 flex items-center justify-between">

                    <div>
                        <h2 className="text-white text-lg font-bold">
                            Quality Details
                        </h2>
                        <p className="text-slate-200 text-sm">
                            Grade, Quantity & Rate Information
                        </p>
                    </div>

                    <div className="flex gap-3">

                        <button
                            type="button"
                            onClick={handleAddQualityRow}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                        >
                            + Add Row
                        </button>

                        <button
                            type="button"
                            onClick={handleDeleteQualityRow}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                        >
                            Delete
                        </button>

                    </div>

                </div>

                <div className="p-6">

                    {/* Table Header */}

                    <div className="grid grid-cols-12 gap-4 bg-slate-100 rounded-xl px-4 py-3 mb-3 font-semibold text-sm text-slate-700">

                        <div className="col-span-3">Quality</div>

                        <div className="col-span-2 text-center">Qty</div>

                        <div className="col-span-3">Agency</div>

                        <div className="col-span-2">Marka</div>

                        <div className="col-span-2 text-right">Rate (₹)</div>

                    </div>

                    {/* Rows */}

                    <div className="space-y-3">

                        {formData.quality_details?.map((qd, i) => (

                            <div
                                key={i}
                                className="grid grid-cols-12 gap-4 bg-slate-50 rounded-xl p-3 hover:bg-green-50 transition"
                            >

                                {/* Quality */}

                                <div className="col-span-3">

                                    <select
                                        name="quality"
                                        value={
                                            grades.find(g => {
                                                const clean = (s:any) =>
                                                    (s || "")
                                                        .trim()
                                                        .replace(/\.$/, "")
                                                        .toUpperCase();

                                                return (
                                                    clean(g.grade_name) === clean(qd.quality) ||
                                                    clean(g.grade_code) === clean(qd.quality)
                                                );
                                            })?.grade_name || qd.quality || ""
                                        }
                                        onChange={(e) => handleQualityChange(i, e)}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-700 outline-none"
                                    >

                                        <option value="">
                                            Select Quality
                                        </option>

                                        {qd.quality &&
                                            !grades.some(g => {
                                                const clean = (s:any) =>
                                                    (s || "")
                                                        .trim()
                                                        .replace(/\.$/, "")
                                                        .toUpperCase();

                                                return (
                                                    clean(g.grade_name) === clean(qd.quality) ||
                                                    clean(g.grade_code) === clean(qd.quality)
                                                );
                                            }) && (
                                                <option value={qd.quality}>
                                                    {qd.quality}
                                                </option>
                                            )}

                                        {grades.map(g => (
                                            <option
                                                key={g.grade_code}
                                                value={g.grade_name}
                                            >
                                                {g.grade_name}
                                            </option>
                                        ))}

                                    </select>

                                </div>

                                {/* Qty */}

                                <div className="col-span-2">

                                    <input
                                        type="number"
                                        name="qty"
                                        value={qd.qty || ""}
                                        onChange={(e) => handleQualityChange(i, e)}
                                        placeholder="Qty"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:ring-2 focus:ring-green-700 outline-none"
                                    />

                                </div>

                                {/* Agency */}

                                <div className="col-span-3">

                                    <input
                                        type="text"
                                        name="agency"
                                        value={qd.agency || ""}
                                        onChange={(e) => handleQualityChange(i, e)}
                                        list="agency_card_list"
                                        placeholder="Agency"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase focus:ring-2 focus:ring-green-700 outline-none"
                                    />

                                </div>

                                {/* Marka */}

                                <div className="col-span-2">

                                    <input
                                        type="text"
                                        name="marka"
                                        value={qd.marka || ""}
                                        onChange={(e) => handleQualityChange(i, e)}
                                        list="marka_list_options"
                                        placeholder="Marka"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase focus:ring-2 focus:ring-green-700 outline-none"
                                    />

                                </div>

                                {/* Rate */}

                                <div className="col-span-2">

                                    <input
                                        type="number"
                                        name="rs"
                                        value={qd.rs || ""}
                                        onChange={(e) => handleQualityChange(i, e)}
                                        placeholder="Rate"
                                        className="w-full rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-right font-semibold text-green-700 focus:ring-2 focus:ring-green-700 outline-none"
                                    />

                                </div>

                            </div>

                        ))}

                    </div>

                </div>

                {/* Datalists */}

                <datalist id="marka_list_options">
                    {markas.map((m: any, idx: number) => (
                        <option key={idx} value={m.marka_name} />
                    ))}
                </datalist>

                <datalist id="agency_card_list">
                    {agencies.map((a: any, idx: number) => (
                        <option key={idx} value={a.agency_name} />
                    ))}
                </datalist>

              </div>

              <LegacyFieldset legend="Shipment & Claims">
                 <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-1 items-center">
                    <div className="col-span-4 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-24 shrink-0">Shipment</label>
                       <input type="date" name="shipment_date" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs" value={formData.shipment_date} onChange={handleChange} />
                    </div>
                    <div className="col-span-4 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-12 shrink-0">Days</label>
                       <input type="number" name="shipment_days" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.shipment_days} onChange={handleChange} />
                    </div>
                    <div className="col-span-4 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-16 shrink-0">Penalty/Day</label>
                       <input type="number" name="shipment_penalty" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.shipment_penalty} onChange={handleChange} />
                    </div>

                    <div className="col-span-6 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-24 shrink-0">Marks Claim</label>
                       <input type="number" name="marks_claim" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.marks_claim} onChange={handleChange} />
                    </div>
                    <div className="col-span-6 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-24 shrink-0">Quantity Claim</label>
                       <input type="number" name="quantity_claim" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.quantity_claim} onChange={handleChange} />
                    </div>
                 </div>
              </LegacyFieldset>

              <LegacyFieldset legend="Remarks & Finalisation">
                 <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-1 items-center">
                    <div className="col-span-12 flex flex-col gap-2">
                       <label className="text-[11px] font-bold text-gray-700">Remarks</label>
                       <textarea name="remarks" className="w-full bg-white border border-gray-400 p-1 text-xs outline-none" rows={2} value={formData.remarks} onChange={handleChange} />
                    </div>
                    
                    <div className="col-span-6 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-24 shrink-0">B. Rate (Rs.)</label>
                       <input type="number" name="b_rate" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right text-red-700 font-bold" value={formData.b_rate} onChange={handleChange} />
                    </div>
                    <div className="col-span-6 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-24 shrink-0">B. Date</label>
                       <input type="date" name="b_date" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs" value={formData.b_date} onChange={handleChange} />
                    </div>

                    <div className="col-span-6 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-24 shrink-0">Superior/Normal</label>
                       <input type="text" name="superior_normal_marks" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs" value={formData.superior_normal_marks} onChange={handleChange} />
                    </div>
                 </div>
              </LegacyFieldset>
           </div>
>>>>>>> Stashed changes
        </div>

        <div className="flex items-center gap-5">
          {/* Notifications */}
          <button
            type="button"
            className="relative p-1.5 text-emerald-100 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 bg-[#D4AF37] text-[#174C2C] text-[10px] font-black rounded-full h-4 w-4 flex items-center justify-center border border-white">
              3
            </span>
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-3 border-l border-white/20 cursor-pointer">
            <div className="p-1.5 rounded-full bg-white/10 text-white border border-white/20">
              <User className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold text-white">Admin User</span>
            <ChevronDown className="h-3.5 w-3.5 text-emerald-200" />
          </div>
        </div>
      </header>

      {/* 2. Page Sub-Header with Breadcrumb */}
      <div className="px-6 py-5 bg-gradient-to-r from-[#F7F5EF] via-[#F3EFE3] to-[#F7F5EF] border-b border-[#E2DFD5] flex items-center justify-between relative overflow-hidden">
        <div>
          <h2 className="font-serif font-black text-3xl text-[#174C2C] tracking-tight">
            Sauda Desk
          </h2>
          <nav className="flex items-center gap-2 text-xs font-medium text-amber-900/80 mt-1">
            <span className="hover:underline cursor-pointer">Home</span>
            <span>›</span>
            <span className="hover:underline cursor-pointer">Sauda Desk</span>
            <span>›</span>
            <span className="font-bold text-[#174C2C]">
              {initialData ? "Modify Sauda" : "Add Sauda"}
            </span>
          </nav>
        </div>

        {/* Decorative Jute Mill Artwork Banner Graphic */}
        <div className="hidden md:flex items-center opacity-25 pointer-events-none select-none">
          <svg className="h-16 text-[#174C2C]" viewBox="0 0 200 60" fill="currentColor">
            <path d="M10 50 L30 20 L50 50 Z M60 50 L80 15 L100 50 Z M110 50 L130 25 L150 50 Z" />
            <rect x="160" y="10" width="10" height="40" />
            <circle cx="165" cy="8" r="4" />
          </svg>
        </div>
      </div>

      {/* 3. Main Form Content */}
      <main ref={formContainerRef} className="flex-1 px-6 py-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Section 1: Basic Details */}
        <BasicDetailsCard
          formData={formData}
          onChange={handleChange}
          onSelectChange={handleSelectChange}
          brokers={brokers}
          suppliers={suppliers}
          areas={areas}
        />

        {/* Section 2: Transportation Details */}
        <TransportationCard
          formData={formData}
          onChange={handleChange}
          unitOptions={UNIT_OPTIONS}
        />

        {/* Section 3: Quality Details Table */}
        <QualityDetailsTable
          qualityDetails={formData.quality_details || []}
          onQualityChange={handleQualityChange}
          onAddRow={handleAddQualityRow}
          onDeleteRow={handleDeleteQualityRow}
          onRemoveRowAt={handleRemoveQualityRowAt}
          grades={grades}
          agencies={agencies}
          markas={markas}
        />

        {/* Section 4: Shipment & Claims */}
        <ShipmentClaimsCard
          formData={formData}
          onChange={handleChange}
        />

        {/* Section 5: Remarks & Finalisation */}
        <RemarksCard
          formData={formData}
          onChange={handleChange}
          onSignatureChange={(url) => setFormData(prev => ({ ...prev, signature_url: url }))}
        />
      </main>

      {/* 4. Sticky Footer Actions */}
      <FooterActions
        onPrint={() => setShowPrintSlip(true)}
        onBack={onCancel}
        onSave={handleSave}
        isLoading={loading}
      />

      {/* Print Slip Modal */}
      {showPrintSlip && (
        <SaudaPrintSlip
          sauda={formData}
          onClose={() => setShowPrintSlip(false)}
        />
      )}
    </div>
  );
}
