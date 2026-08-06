import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { Sauda } from '../types';
import { dbModule } from '../services/dbModule';
import { supabase } from '../lib/supabase';
import { enforceEditOrDeletePermission } from '../lib/permissions';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';

import LegacyLayout from '../components/LegacyLayout';
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
    <LegacyLayout title="Sauda Desk" subtitle={initialData ? "Modify Contract" : "Add Sauda Contract"} onClose={onCancel}>
      <div className="flex-1 flex flex-col font-sans text-slate-800 space-y-5">
        {/* 1. Integrated Sub-Header Banner */}
        <div className="relative px-6 py-4 bg-[#FAF8F5] border border-[#E2DFD5] rounded-xl flex items-center justify-between shrink-0 shadow-xs overflow-hidden">
          {/* Background Mill Illustration Artwork on the Right */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-1/3 opacity-25 pointer-events-none bg-no-repeat bg-right bg-contain"
            style={{ backgroundImage: `url('https://res.cloudinary.com/x6tw39wi/image/upload/v1785928946/icon_vffvx9.png')` }}
          />

          <div className="relative z-10 flex flex-col gap-1">
            <h2 className="font-serif font-black text-2xl text-[#174C2C] tracking-tight leading-none">
              Sauda Desk
            </h2>
            <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-1">
              <span className="hover:text-[#174C2C] cursor-pointer transition-colors" onClick={onCancel}>Home</span>
              <span>›</span>
              <span className="hover:text-[#174C2C] cursor-pointer transition-colors" onClick={onCancel}>Sauda Desk</span>
              <span>›</span>
              <span className="font-bold text-[#174C2C]">
                {initialData ? `Modify #${formData.sauda_no}` : "Add Sauda"}
              </span>
            </nav>
          </div>

          {/* Action Controls & Session Badge */}
          <div className="relative z-10 flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 hover:bg-[#E2DDD0] text-[#174C2C] bg-white border border-[#D8D3C5] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
              title="Back to Sauda Desk (Esc)"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back (Esc)</span>
            </button>
            <div className="bg-white/90 border border-[#D8D3C5] px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-2xs">
              <span className="text-slate-500 font-medium">Session:</span>
              <span className="font-bold text-[#174C2C] font-mono text-xs">{formData.session || 'BJCL/2026-2027/'}</span>
            </div>
          </div>
        </div>

        {/* 2. Main Form Content */}
        <main ref={formContainerRef} className="flex-1 space-y-5 max-w-7xl mx-auto w-full">
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

        {/* 3. Sticky Footer Actions */}
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
    </LegacyLayout>
  );
}
