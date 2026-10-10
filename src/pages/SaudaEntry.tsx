import React, { useState, useEffect, useRef } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { ArrowLeft, FileText } from 'lucide-react';
import { Sauda } from '../types';
import { dbModule } from '../services/dbModule';
import { supabase } from '../lib/supabase';
import { enforceEditOrDeletePermission, getCurrentUserContext, isUserId10 } from '../lib/permissions';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { resolveSattaRate } from '../services/sattaRateService';

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
  onCancel,
  onNavigate
}: { 
  initialData?: any; 
  onSave?: (d: any) => void; 
  onCancel?: () => void;
  onNavigate?: (page: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [showPrintSlip, setShowPrintSlip] = useState(false);
  const [isSattaChartUploaded, setIsSattaChartUploaded] = useState<boolean>(true);

  const [brokers, setBrokers] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [markas, setMarkas] = useState<any[]>([]);
  const [baseRatesList, setBaseRatesList] = useState<any[]>([]);
  const [dbDiffsList, setDbDiffsList] = useState<any[]>([]);

  // User 010 Detection logic
  const userCtx = getCurrentUserContext();
  const uid = String(userCtx?.userId || (userCtx as any)?.user_id || '').trim().toLowerCase();
  const uname = String(userCtx?.username || userCtx?.userName || '').trim().toLowerCase();
  
  let sessionUid = '';
  let sessionUname = '';
  try {
    const rawSess = typeof window !== 'undefined' ? localStorage.getItem('bally_auth_session') : null;
    if (rawSess) {
      const parsed = JSON.parse(rawSess);
      sessionUid = String(parsed?.userId || parsed?.user_id || '').trim().toLowerCase();
      sessionUname = String(parsed?.username || '').trim().toLowerCase();
    }
  } catch {}

  const detectedIs010 = isUserId10(userCtx);

  const [forceUser010, setForceUser010] = useState<boolean | null>(null);
  const isUser010 = forceUser010 !== null ? forceUser010 : detectedIs010;

  const today = new Date().toISOString().split('T')[0];

  const getInitialFormData = (): Sauda => {
    if (initialData) {
      const copy = { ...initialData };
      copy.broker = (copy.broker || '').toUpperCase();
      copy.supplier = (copy.supplier || '').toUpperCase();
      copy.challan_supplier = (copy.challan_supplier || '').toUpperCase();
      copy.area = (copy.area || '').toUpperCase();
      
      const realQD = (copy.quality_details || [])
        .filter((item: any) => item.quality || item.qty || item.agency || item.marka || item.rs);

      if (copy.units_per_lorry === undefined && copy.units_per_lorry_type && !isNaN(Number(copy.units_per_lorry_type))) {
        copy.units_per_lorry = Number(copy.units_per_lorry_type);
      }

      const existingCount = realQD.length;
      if (existingCount < 1) {
        copy.quality_details = [{ quality: '', qty: 0, agency: '', marka: '', rs: 0, agencies: [], markas: [], applicableCombinations: [] }];
      } else {
        // Normalize rows and group shared (quality, rs) rows for multi-select editing
        const groupedMap = new Map<string, any>();
        realQD.forEach((row: any) => {
          const q = String(row.quality || '').trim();
          const r = Number(row.rs) || 0;
          const key = `${q}_${r}`;

          const ags: string[] = (
            Array.isArray(row.agencies) && row.agencies.length > 0
              ? row.agencies
              : (row.agency ? String(row.agency).split(',').map((x: string) => x.trim()).filter(Boolean) : [])
          );

          const mks: string[] = (
            Array.isArray(row.markas) && row.markas.length > 0
              ? row.markas
              : (row.marka ? String(row.marka).split(',').map((x: string) => x.trim()).filter(Boolean) : [])
          );

          if (!groupedMap.has(key)) {
            groupedMap.set(key, {
              quality: q,
              rs: r,
              qty: Number(row.qty) || 0,
              agencies: [...ags],
              markas: [...mks],
              agency: ags[0] || '',
              marka: mks[0] || '',
              applicableCombinations: (row.agency && row.marka) ? [{
                agency: row.agency,
                marka: row.marka,
                quality: q,
                rs: r,
                qty: Number(row.qty) || 0,
                enabled: true
              }] : []
            });
          } else {
            const existing = groupedMap.get(key);
            ags.forEach(ag => {
              if (ag && !existing.agencies.includes(ag)) existing.agencies.push(ag);
            });
            mks.forEach(mk => {
              if (mk && !existing.markas.includes(mk)) existing.markas.push(mk);
            });
            if (row.agency && row.marka) {
              const alreadyHas = existing.applicableCombinations.some(
                (c: any) => c.agency.toUpperCase() === row.agency.toUpperCase() && c.marka.toUpperCase() === row.marka.toUpperCase()
              );
              if (!alreadyHas) {
                existing.applicableCombinations.push({
                  agency: row.agency,
                  marka: row.marka,
                  quality: q,
                  rs: r,
                  qty: Number(row.qty) || 0,
                  enabled: true
                });
              }
            }
          }
        });

        copy.quality_details = Array.from(groupedMap.values());
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
      units_per_lorry: 0,
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
      quality_details: [{ quality: '', qty: 0, agency: '', marka: '', rs: 0, agencies: [], markas: [], applicableCombinations: [] }]
    };
  };

  const [formData, setFormData] = useState<Sauda>(getInitialFormData());

  const formContainerRef = useRef<HTMLDivElement>(null);
  useKeyboardNavigation(formContainerRef);

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
        const hasSattaRates = (sattaBaseRates && sattaBaseRates.length > 0) || (sattaDiffs && sattaDiffs.length > 0);
        const hasLocalStorageUpload = typeof window !== 'undefined' && localStorage.getItem('satta_chart_uploaded') === 'true';
        setIsSattaChartUploaded(Boolean(hasSattaRates || hasLocalStorageUpload));

        if (sattaBaseRates && sattaBaseRates.length > 0) {
          setBaseRatesList(sattaBaseRates);
          const sorted = [...sattaBaseRates].sort((a: any, b: any) => (b.start_date || '').localeCompare(a.start_date || ''));
          const targetDt = formData.b_date || formData.date || today;
          const eff = sorted.find((r: any) => r.start_date <= targetDt) || sorted[sorted.length - 1];
          if (eff && eff.base_rate) {
            const activeBase = Number(eff.base_rate);
            setFormData(prev => ({
              ...prev,
              b_rate: prev.b_rate && prev.b_rate > 0 ? prev.b_rate : activeBase
            }));
          }
        }
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

  useEffect(() => {
    loadMasterData();
  }, [initialData]);

  useLiveAutoRefresh(loadMasterData, [initialData], { tables: ['sauda_master', 'broker_master', 'supply_master', 'area_master', 'agency_master', 'grade_master', 'marka_master', 'satta_base_rates', 'satta_differentials'] });

  // Recalculate Satta rate for a quality row based on Date, Area, Grade
  const recalculateRowRate = (date: string, area: string, grade: string) => {
    if (!date || !area || !grade) return null;
    const res = resolveSattaRate({
      area,
      grade,
      date,
      baseRates: baseRatesList,
      differentials: dbDiffsList
    });
    return res.found ? res.finalRate : null;
  };

  const getUnitWeightKg = (unitType?: string): number | null => {
    const clean = String(unitType || '').trim().toUpperCase().replace(/[\s_.-]/g, '');
    if (clean.includes('DRUM') || clean === 'DR') {
      return 50; // 50 KG per unit for Drums
    }
    if (clean === 'BALES' || clean === 'BALE' || clean === 'BAL' || clean === 'BELL' || clean === 'BELLS' || clean === 'BEL') {
      return 147.5; // 147.5 KG per unit for standard Bales / Bell
    }
    // LOOSE, P.BALES, H.BALES, etc. are blank manual inputs
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

      const activeUnitType = name === 'unit_type' ? finalValue : (prev.unit_type || 'BALES');
      const unitWeightKg = getUnitWeightKg(activeUnitType);
      const lorries = Math.max(1, parseFloat(name === 'no_of_lorries' ? value : (prev.no_of_lorries as any)) || 1);

      // 1. When user enters Total Wt. in Ton:
      if (name === 'total_wt_in_ton') {
        const totalWt = parseFloat(value) || 0;
        updated.total_wt_in_ton = totalWt;
        const wtPerLorry = parseFloat((totalWt / lorries).toFixed(3));
        updated.wt_per_lorry = wtPerLorry;

        if (unitWeightKg && unitWeightKg > 0) {
          // BALE (147.5 kg) or DRUM (50 kg) auto conversion
          if (totalWt > 0) {
            const totalWeightKg = totalWt * 1000;
            const totalUnits = totalWeightKg / unitWeightKg;
            const unitsPerLorry = parseFloat((totalUnits / lorries).toFixed(2));
            
            updated.units_per_lorry = unitsPerLorry;
            updated.units_per_lorry_type = String(unitsPerLorry);
            updated.total_unit = Math.round(totalUnits);
          } else {
            updated.units_per_lorry = '';
            updated.units_per_lorry_type = '';
            updated.total_unit = '';
          }
        } else {
          // LOOSE, P.BALES, H.BALES: Leave Units/Lorry blank/manual
          const existingManualUnits = parseFloat(prev.units_per_lorry as any);
          if (existingManualUnits > 0) {
            updated.total_unit = Math.round(existingManualUnits * lorries);
          } else {
            updated.units_per_lorry = '';
            updated.units_per_lorry_type = '';
            updated.total_unit = '';
          }
        }
      }

      // 2. When user enters Units/Lorry:
      if (name === 'units_per_lorry') {
        const units = parseFloat(value) || 0;
        updated.units_per_lorry = value === '' ? '' : value;
        updated.units_per_lorry_type = String(value);

        if (units > 0) {
          const totalUnits = Math.round(units * lorries);
          updated.total_unit = totalUnits;

          if (unitWeightKg && unitWeightKg > 0) {
            const wtPerLorry = parseFloat(((units * unitWeightKg) / 1000).toFixed(3));
            const totalWt = parseFloat((wtPerLorry * lorries).toFixed(3));
            updated.wt_per_lorry = wtPerLorry;
            updated.total_wt_in_ton = totalWt;
          }
        } else {
          updated.total_unit = '';
          if (unitWeightKg && unitWeightKg > 0) {
            updated.wt_per_lorry = 0;
            updated.total_wt_in_ton = 0;
          }
        }
      }

      // 3. When user enters Total Unit:
      if (name === 'total_unit') {
        const tUnits = parseFloat(value) || 0;
        updated.total_unit = value === '' ? '' : value;

        if (tUnits > 0) {
          const uPerLorry = parseFloat((tUnits / lorries).toFixed(2));
          updated.units_per_lorry = uPerLorry;
          updated.units_per_lorry_type = String(uPerLorry);

          if (unitWeightKg && unitWeightKg > 0) {
            const totalWt = parseFloat(((tUnits * unitWeightKg) / 1000).toFixed(3));
            updated.total_wt_in_ton = totalWt;
            updated.wt_per_lorry = parseFloat((totalWt / lorries).toFixed(3));
          }
        } else {
          updated.units_per_lorry = '';
          updated.units_per_lorry_type = '';
        }
      }

      // 4. When No. of Lorries changes:
      if (name === 'no_of_lorries') {
        const lCount = Math.max(1, parseFloat(value) || 1);
        const currentUnitsPerLorry = parseFloat(prev.units_per_lorry as any) || 0;
        const currentTotalWt = parseFloat(prev.total_wt_in_ton as any) || 0;

        if (currentTotalWt > 0) {
          updated.wt_per_lorry = parseFloat((currentTotalWt / lCount).toFixed(3));
        }

        if (unitWeightKg && unitWeightKg > 0) {
          if (currentUnitsPerLorry > 0) {
            const wtPerLorry = parseFloat(((currentUnitsPerLorry * unitWeightKg) / 1000).toFixed(3));
            updated.wt_per_lorry = wtPerLorry;
            updated.total_unit = Math.round(currentUnitsPerLorry * lCount);
            updated.total_wt_in_ton = parseFloat((wtPerLorry * lCount).toFixed(3));
          } else if (currentTotalWt > 0) {
            const totalWeightKg = currentTotalWt * 1000;
            const totalUnits = totalWeightKg / unitWeightKg;
            updated.units_per_lorry = parseFloat((totalUnits / lCount).toFixed(2));
            updated.units_per_lorry_type = String(updated.units_per_lorry);
            updated.total_unit = Math.round(totalUnits);
          }
        } else {
          // Manual unit types
          if (currentUnitsPerLorry > 0) {
            updated.total_unit = Math.round(currentUnitsPerLorry * lCount);
          }
        }
      }

      // 5. When Unit Type changes (e.g., BALES, DRUMS, LOOSE, P.BALES, H.BALES):
      if (name === 'unit_type') {
        const newUnitWeightKg = getUnitWeightKg(finalValue);
        const currentTotalWt = parseFloat(prev.total_wt_in_ton as any) || 0;

        if (newUnitWeightKg && newUnitWeightKg > 0) {
          if (currentTotalWt > 0) {
            const totalWeightKg = currentTotalWt * 1000;
            const totalUnits = totalWeightKg / newUnitWeightKg;
            const unitsPerLorry = parseFloat((totalUnits / lorries).toFixed(2));
            updated.units_per_lorry = unitsPerLorry;
            updated.units_per_lorry_type = String(unitsPerLorry);
            updated.total_unit = Math.round(totalUnits);
            updated.wt_per_lorry = parseFloat((currentTotalWt / lorries).toFixed(3));
          }
        } else {
          // Switching to LOOSE, P.BALES, H.BALES -> clear auto-calculated units to blank
          updated.units_per_lorry = '';
          updated.units_per_lorry_type = '';
          updated.total_unit = '';
          if (currentTotalWt > 0) {
            updated.wt_per_lorry = parseFloat((currentTotalWt / lorries).toFixed(3));
          }
        }
      }

      // 6. When Wt/Lorry changes:
      if (name === 'wt_per_lorry') {
        const wt = parseFloat(value) || 0;
        updated.wt_per_lorry = wt;
        updated.total_wt_in_ton = parseFloat((lorries * wt).toFixed(3));
        if (unitWeightKg && unitWeightKg > 0) {
          const units = parseFloat(((wt * 1000) / unitWeightKg).toFixed(2));
          updated.units_per_lorry = units;
          updated.units_per_lorry_type = String(units);
          updated.total_unit = Math.round(units * lorries);
        }
      }

      // Automatically update b_rate from active Satta Base Rates when date or b_date changes
      if ((name === 'date' || name === 'b_date') && finalValue && baseRatesList.length > 0) {
        const sorted = [...baseRatesList].sort((a: any, b: any) => (b.start_date || '').localeCompare(a.start_date || ''));
        const eff = sorted.find((r: any) => r.start_date <= finalValue) || sorted[sorted.length - 1];
        if (eff && eff.base_rate) {
          updated.b_rate = Number(eff.base_rate);
        }
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

      // Prevent selecting duplicate Quality across rows
      if (field === 'quality' && value) {
        const normVal = String(value).trim().toUpperCase();
        const alreadyExists = qd.some((r, rIdx) => rIdx !== index && String(r.quality || '').trim().toUpperCase() === normVal);
        if (alreadyExists) {
          alert(`Quality "${value}" is already selected in another row. Each quality can only be added once.`);
          return prev;
        }
      }

      qd[index] = { ...qd[index], [field]: value };

      // When modifying agencies or markas on the first row (index 0), automatically propagate to all subsequent spawned rows
      if (index === 0 && (field === 'agencies' || field === 'markas')) {
        for (let j = 1; j < qd.length; j++) {
          qd[j] = {
            ...qd[j],
            [field]: Array.isArray(value) ? [...value] : value,
            [field === 'agencies' ? 'agency' : 'marka']: Array.isArray(value) ? (value[0] || '') : value,
            applicableCombinations: undefined
          };
        }
      }

      if (field === 'quality' && value && prev.area) {
        const calculatedPrice = recalculateRowRate(prev.date || today, prev.area, value);
        if (calculatedPrice !== null) {
          qd[index].rs = calculatedPrice;
          if (Array.isArray(qd[index].applicableCombinations)) {
            qd[index].applicableCombinations = qd[index].applicableCombinations.map((c: any) => ({
              ...c,
              quality: value,
              rs: calculatedPrice
            }));
          }
          if (index === 0) {
            return { ...prev, quality_details: qd, b_rate: calculatedPrice };
          }
        }
      }

      return { ...prev, quality_details: qd };
    });
  };

  const handleAddQualityRow = () => {
    setFormData(prev => {
      const qdList = prev.quality_details || [];
      const firstRow: any = qdList[0] || {};
      const defaultAgencies = Array.isArray(firstRow.agencies) && firstRow.agencies.length > 0
        ? [...firstRow.agencies]
        : (firstRow.agency ? [firstRow.agency] : []);
      const defaultMarkas = Array.isArray(firstRow.markas) && firstRow.markas.length > 0
        ? [...firstRow.markas]
        : (firstRow.marka ? [firstRow.marka] : []);
      const defaultAgency = firstRow.agency || defaultAgencies[0] || '';
      const defaultMarka = firstRow.marka || defaultMarkas[0] || '';

      return {
        ...prev,
        quality_details: [
          ...qdList,
          { 
            quality: '', 
            qty: 0, 
            agency: defaultAgency, 
            marka: defaultMarka, 
            rs: 0, 
            agencies: defaultAgencies, 
            markas: defaultMarkas, 
            applicableCombinations: undefined 
          }
        ]
      };
    });
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
        current[0] = { quality: '', qty: 0, agency: '', marka: '', rs: 0, agencies: [], markas: [], applicableCombinations: [] };
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

    if (!isUser010) {
      if (!formData.sauda_no) {
        alert("Please fill in the Order No.");
        return;
      }

      if (!formData.broker) {
        alert("Please fill in or select a Broker.");
        return;
      }

      if (!formData.supplier) {
        alert("Please fill in or select a Supplier.");
        return;
      }

      if (!formData.area) {
        alert("Please fill in or select an Area.");
        return;
      }

      // Validate Quality Details rows
      const qdRows = formData.quality_details || [];
      for (let i = 0; i < qdRows.length; i++) {
        const row = qdRows[i];
        if (row.quality || row.qty || row.rs || row.agency || row.marka || (row.agencies && row.agencies.length > 0) || (row.markas && row.markas.length > 0)) {
          if (!row.quality) {
            alert(`Please select or fill in Quality in Row ${i + 1}.`);
            return;
          }
        }
      }

      if (!formData.b_rate || Number(formData.b_rate) <= 0) {
        alert("B. Rate (Rs.) is required.");
        return;
      }

      if (!formData.b_date) {
        alert("B. Date is required.");
        return;
      }
    }

    setLoading(true);
    try {
      const saudaData = { ...formData };

      // For User 010: apply safe fallbacks for hidden/non-mandatory fields
      if (isUser010) {
        if (!saudaData.sauda_no) {
          saudaData.sauda_no = '0153';
        }
        if (!saudaData.date) {
          saudaData.date = today;
        }
        if (!saudaData.broker) {
          saudaData.broker = 'DIRECT';
        }
        if (!saudaData.supplier) {
          saudaData.supplier = saudaData.broker || 'DIRECT';
        }
        if (!saudaData.area) {
          saudaData.area = 'LOCAL';
        }
        if (!saudaData.b_rate || Number(saudaData.b_rate) <= 0) {
          const firstRs = Number(saudaData.quality_details?.[0]?.rs) || 0;
          saudaData.b_rate = firstRs;
        }
        if (!saudaData.b_date) {
          saudaData.b_date = saudaData.date || today;
        }
      }

      const toNumericOrNull = (v: any) => {
        if (v === null || v === undefined || String(v).trim() === '') return null;
        const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
        return isNaN(n) ? null : n;
      };

      const qd = saudaData.quality_details;

      const primaryQuality = (
        (qd || []).find((r: any) => r.quality && String(r.quality).trim() !== '')?.quality || 
        (saudaData as any).quality || 
        'TD5'
      );
      const primaryRs = (
        toNumericOrNull((qd || []).find((r: any) => r.rs && Number(r.rs) > 0)?.rs) ?? 
        toNumericOrNull(saudaData.b_rate) ?? 
        13500
      );

      // Extract and normalize all applicable combinations
      const flatCombinations: Array<{
        quality: string;
        agency: string;
        marka: string;
        rs: number;
        qty: number;
      }> = [];

      (qd || []).forEach((row: any) => {
        const rowQuality = String(row.quality || primaryQuality).trim();
        const rowRs = toNumericOrNull(row.rs) ?? primaryRs;
        const rowQty = toNumericOrNull(row.qty) ?? 0;

        // 1. If row has customized applicableCombinations array
        if (Array.isArray(row.applicableCombinations) && row.applicableCombinations.length > 0) {
          row.applicableCombinations.forEach((comb: any) => {
            if (comb.enabled !== false && (comb.agency || comb.marka || comb.quality)) {
              flatCombinations.push({
                quality: String(comb.quality || rowQuality).trim(),
                agency: String(comb.agency || '').trim(),
                marka: String(comb.marka || '').trim(),
                rs: toNumericOrNull(comb.rs) ?? rowRs,
                qty: toNumericOrNull(comb.qty) ?? rowQty
              });
            }
          });
        } else {
          // 2. Generate combinations from agencies and markas arrays
          const rowAgencies: string[] = (
            Array.isArray(row.agencies) && row.agencies.length > 0
              ? row.agencies
              : (row.agency ? String(row.agency).split(',').map((x: string) => x.trim()).filter(Boolean) : [])
          );

          const rowMarkas: string[] = (
            Array.isArray(row.markas) && row.markas.length > 0
              ? row.markas
              : (row.marka ? String(row.marka).split(',').map((x: string) => x.trim()).filter(Boolean) : [])
          );

          if (rowAgencies.length > 0 && rowMarkas.length > 0) {
            if (rowAgencies.length === rowMarkas.length && rowAgencies.length > 1) {
              rowAgencies.forEach((ag, idx) => {
                flatCombinations.push({
                  quality: rowQuality,
                  agency: String(ag).trim(),
                  marka: String(rowMarkas[idx] || rowMarkas[0]).trim(),
                  rs: rowRs,
                  qty: rowQty
                });
              });
            } else {
              rowAgencies.forEach(ag => {
                rowMarkas.forEach(mk => {
                  flatCombinations.push({
                    quality: rowQuality,
                    agency: String(ag).trim(),
                    marka: String(mk).trim(),
                    rs: rowRs,
                    qty: rowQty
                  });
                });
              });
            }
          } else if (rowAgencies.length > 0) {
            rowAgencies.forEach(ag => {
              flatCombinations.push({
                quality: rowQuality,
                agency: String(ag).trim(),
                marka: String(row.marka || '').trim(),
                rs: rowRs,
                qty: rowQty
              });
            });
          } else if (rowMarkas.length > 0) {
            rowMarkas.forEach(mk => {
              flatCombinations.push({
                quality: rowQuality,
                agency: String(row.agency || '').trim(),
                marka: String(mk).trim(),
                rs: rowRs,
                qty: rowQty
              });
            });
          } else if (rowQuality || rowRs > 0 || row.agency || row.marka) {
            flatCombinations.push({
              quality: rowQuality,
              agency: String(row.agency || '').trim(),
              marka: String(row.marka || '').trim(),
              rs: rowRs,
              qty: rowQty
            });
          }
        }
      });

      const allUniqueAgencies = Array.from(new Set(flatCombinations.map(c => c.agency).filter(Boolean)));
      const allUniqueMarkas = Array.from(new Set(flatCombinations.map(c => c.marka).filter(Boolean)));

      if (allUniqueAgencies.length > 0) {
        saudaData.agency = allUniqueAgencies.join(', ');
      }
      if (allUniqueMarkas.length > 0) {
        saudaData.marks = allUniqueMarkas.join(', ');
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
        'units_per_lorry',
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
        'approval_status',
        'created_by',
        'is_checked',
        'checked_by',
        'checked_at',
        'approved_by',
        'approved_at',
        'rejected_by',
        'rejected_at',
        'created_at'
      ];

      const toIntegerOrNull = (v: any) => {
        if (v === null || v === undefined || String(v).trim() === '') return null;
        const n = parseInt(String(v).replace(/[^0-9\-]/g, ''), 10);
        return isNaN(n) ? null : n;
      };

      const toDateOrNull = (v: any) => {
        if (!v || String(v).trim() === '') return null;
        const s = String(v).trim();
        if (s.length >= 10 && s[4] === '-' && s[7] === '-') return s.slice(0, 10);
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
        return null;
      };

      const saudaPayload: Record<string, any> = {};
      SAUDA_MASTER_FIELDS.forEach(field => {
        if ((saudaData as any)[field] !== undefined) {
          saudaPayload[field] = (saudaData as any)[field];
        }
      });

      // Strongly sanitize types so Postgres never receives "" for integer, numeric, or date fields
      saudaPayload.no_of_lorries = toIntegerOrNull(saudaData.no_of_lorries) ?? 1;
      saudaPayload.total_unit = toIntegerOrNull(saudaData.total_unit) ?? 0;
      saudaPayload.shipment_days = toIntegerOrNull(saudaData.shipment_days) ?? 0;

      const numericUnitsPerLorry = toNumericOrNull(formData.units_per_lorry) ?? toNumericOrNull(formData.units_per_lorry_type);
      saudaPayload.units_per_lorry = numericUnitsPerLorry;
      saudaPayload.units_per_lorry_type = numericUnitsPerLorry !== null ? String(numericUnitsPerLorry) : (formData.units_per_lorry_type || formData.unit_type || 'BALES');

      saudaPayload.wt_per_lorry = toNumericOrNull(saudaData.wt_per_lorry) ?? 0;
      saudaPayload.total_wt_in_ton = toNumericOrNull(saudaData.total_wt_in_ton) ?? 0;
      saudaPayload.shipment_penalty = toNumericOrNull(saudaData.shipment_penalty) ?? 0;
      saudaPayload.marks_claim = toNumericOrNull(saudaData.marks_claim) ?? 0;
      saudaPayload.quantity_claim = toNumericOrNull(saudaData.quantity_claim) ?? 0;
      saudaPayload.b_rate = toNumericOrNull(saudaData.b_rate) ?? (flatCombinations[0]?.rs || 0);

      saudaPayload.date = toDateOrNull(saudaData.date) || today;
      saudaPayload.shipment_date = toDateOrNull(saudaData.shipment_date);
      saudaPayload.b_date = toDateOrNull(saudaData.b_date) || saudaPayload.date;

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

      // Maker-Checker Workflow Enforcements:
      // When a user creates a new entry or resubmits a previously rejected entry, reset status to PENDING
      // for the Checker (User ID 010) to verify again.
      const isWasRejected = initialData && (
        String(initialData.status || '').toUpperCase() === 'REJECTED' ||
        String(initialData.approval_status || '').toUpperCase() === 'REJECTED' ||
        Boolean(initialData.rejected_by)
      );

      if (!isEditMode || isWasRejected) {
        saudaPayload.status = 'PENDING';
        saudaPayload.approval_status = 'PENDING';
        saudaPayload.is_checked = false;
        saudaPayload.checked_by = null;
        saudaPayload.checked_at = null;
        saudaPayload.rejected_by = null;
        saudaPayload.rejected_at = null;
      }

      if (!isEditMode && !saudaPayload.created_by) {
        saudaPayload.created_by = userCtx.userName || userCtx.username || userCtx.userId || 'Rahul (002)';
      }

      if (saudaPayload.sauda_id) {
        inserted = await dbModule.update('sauda_master', 'sauda_id', saudaPayload.sauda_id, saudaPayload);
      } else {
        inserted = await dbModule.insert('sauda_master', saudaPayload);
      }

      if (inserted && flatCombinations.length > 0) {
        if (isEditMode) {
          await dbModule.delete('sauda_quality_details', 'sauda_id', inserted.sauda_id);
        }

        for (const comb of flatCombinations) {
          if (comb.quality || comb.agency || comb.marka || comb.rs > 0) {
            try {
              await dbModule.insert('sauda_quality_details', {
                sauda_id: inserted.sauda_id,
                sauda_no: inserted.sauda_no || saudaData.sauda_no,
                financial_year: inserted.financial_year || saudaData.financial_year || '2026-2027',
                quality: String(comb.quality || '').trim(),
                qty: toNumericOrNull(comb.qty) ?? 0,
                agency: String(comb.agency || '').trim(),
                marka: String(comb.marka || '').trim(),
                rs: toNumericOrNull(comb.rs) ?? 0
              });
            } catch (e) {
              console.error("Failed to insert combination:", e);
            }
          }
        }
      }

      alert("Sauda Contract saved successfully!");
      window.dispatchEvent(new CustomEvent('app-data-updated'));
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
      <div className="flex-1 flex flex-col font-sans text-slate-800 space-y-4 w-full max-w-7xl 2xl:max-w-[1550px] mx-auto pb-10 px-2 sm:px-4 min-w-0">
        {/* HEADER BAR - MATCHING MILL INSPECTION AESTHETIC */}
        <div className="bg-[#174C2C] text-white px-5 sm:px-6 py-4 rounded-xl shadow-lg flex flex-wrap items-center justify-between border border-[#0F351E] gap-4">
          {/* Left Badge & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800/40 border border-emerald-400/40 flex items-center justify-center text-amber-300 shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="bg-[#0b2415] text-amber-300 text-[11px] font-extrabold px-2.5 py-0.5 rounded border border-emerald-700/60 tracking-wider w-fit">
                {formData.session || 'BJCL 2026 - 2027'}
              </span>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-widest text-amber-300 drop-shadow mt-0.5">
                {initialData ? `MODIFY SAUDA #${formData.sauda_no}` : "NEW SAUDA CONTRACT ENTRY"}
              </h1>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setForceUser010(prev => prev === null ? !detectedIs010 : !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 ${
                isUser010
                  ? "bg-amber-400 hover:bg-amber-300 text-[#0b2415] border-amber-300 font-black shadow-xs"
                  : "bg-[#0b2415]/70 hover:bg-[#0b2415] text-emerald-200 border-emerald-700/60"
              }`}
              title="Toggle between standard form and User 010 non-mandatory streamlined layout"
            >
              <span className={`w-2 h-2 rounded-full ${isUser010 ? "bg-emerald-900 animate-pulse" : "bg-emerald-400"}`} />
              <span>User 010 Mode: {isUser010 ? "ON" : "OFF"}</span>
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-[#0b2415]/80 hover:bg-[#123920] border border-emerald-400/50 rounded-lg text-xs font-bold text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Back to Sauda Desk (Esc)"
            >
              <ArrowLeft className="h-4 w-4 text-amber-300" />
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* Satta Chart Verification Badge */}
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
            <span className="font-extrabold text-emerald-950 uppercase tracking-wide">
              Step 1: Satta Chart Active (Source Rate: ₹{formData.b_rate ? Number(formData.b_rate).toLocaleString() : '17,500'})
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('satta_chart') : (window.location.hash = '#satta_chart')}
            className="px-3 py-1 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
          >
            Review / Update Satta Chart →
          </button>
        </div>

        {/* 2. Main Form Content */}
        <main ref={formContainerRef} className="flex-1 space-y-5 w-full min-w-0">
          {/* Section 1: Basic Details */}
          <div id="basic-details" className="scroll-mt-14">
            <BasicDetailsCard
              formData={formData}
              onChange={handleChange}
              onSelectChange={handleSelectChange}
              brokers={brokers}
              suppliers={suppliers}
              areas={areas}
              isUser010={isUser010}
            />
          </div>

          {/* Section 2: Transportation Details */}
          <div id="transportation-details" className="scroll-mt-14">
            <TransportationCard
              formData={formData}
              onChange={handleChange}
              onSelectChange={handleSelectChange}
              unitOptions={UNIT_OPTIONS}
              isUser010={isUser010}
            />
          </div>

          {/* Section 3: Quality Details */}
          <div id="quality-details" className="scroll-mt-14">
            <QualityDetailsTable
              qualityDetails={formData.quality_details || []}
              onQualityChange={handleQualityChange}
              onAddRow={handleAddQualityRow}
              onDeleteRow={handleDeleteQualityRow}
              onRemoveRowAt={handleRemoveQualityRowAt}
              grades={grades}
              agencies={agencies}
              markas={markas}
              isUser010={isUser010}
            />
          </div>

          {/* Section 4: Shipment & Claims */}
          <div id="claims-details" className="scroll-mt-14">
            <ShipmentClaimsCard
              formData={formData}
              onChange={handleChange}
            />
          </div>

          {/* Section 5: Remarks & Finalisation (with Attached Action Footer) */}
          <div id="remarks-details" className="scroll-mt-14">
            <RemarksCard
              formData={formData}
              onChange={handleChange}
              onSignatureChange={(url) => setFormData(prev => ({ ...prev, signature_url: url }))}
              onPrint={() => setShowPrintSlip(true)}
              onBack={onCancel}
              onSave={handleSave}
              isLoading={loading}
            />
          </div>
        </main>

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
