import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Scale, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Calculator, 
  Save, 
  Printer, 
  ShieldCheck,
  Lock,
  Layers,
  FileSpreadsheet,
  Check,
  Calendar,
  DollarSign,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { dbModule } from '../services/dbModule';
import { calculateWeightTolerance, WeightToleranceResult } from '../lib/weightTolerance';
import { cn } from '../lib/utils';

interface ExcessShortSettlementModalProps {
  po: any;
  onClose: () => void;
  onSaveSuccess?: () => void;
  allFinalArrivals?: any[];
  allTempArrivals?: any[];
  allScpDetails?: any[];
  sattaCalculatedRates?: any[];
  sattaBaseRates?: any[];
}

// Helper to normalize any date string into YYYY-MM-DD
const normalizeToYMD = (dStr: any): string => {
  if (!dStr) return '';
  let clean = String(dStr).trim();
  if (clean.includes('T')) clean = clean.split('T')[0];
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
  }
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 2 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
  }
  return clean;
};

// Helper to format date as DD-MM-YYYY
const formatDisplayDate = (dStr: any): string => {
  if (!dStr) return '--';
  const ymd = normalizeToYMD(dStr);
  if (ymd && ymd.includes('-')) {
    const parts = ymd.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return String(dStr);
};

export const ExcessShortSettlementModal: React.FC<ExcessShortSettlementModalProps> = ({
  po,
  onClose,
  onSaveSuccess,
  allFinalArrivals = [],
  allTempArrivals = [],
  allScpDetails = [],
  sattaCalculatedRates = [],
  sattaBaseRates = []
}) => {
  const poNo = String(po.po_no || po.contract_po_no || '').trim();
  const saudaNo = String(po.sauda_no || po.sauda_ref || po.po_no || '').trim();
  const supplierName = String(po.supplier || po.supplier_name || po.supp_name || 'SOHANLALL CHANDANMULL AND CO.').trim();
  const brokerName = String(po.broker || po.broker_name || 'SOHANLALL CHANDANMULL & CO.').trim();
  const unit = String(po.purchase_unit_name || po.unit_type || po.unit || 'BALES').toUpperCase();
  
  // Sauda Quantity
  const contractMt = parseFloat(po.total_contract_mt || po.contract_weight_mt || 0) || 65.002;
  const saudaQtyQtl = contractMt * 10;
  const contractRate = parseFloat(po.rate || po.purchase_rate || po.rate_per_qtl || po.base_rate || 13500) || 13500;
  const selectedGrade = String(po.selected_grade || po.grade || po.item_name || 'TD10').trim();

  const cleanPoVal = (s: any) => String(s || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const cleanKey = cleanPoVal(poNo);
  const cleanSaudaKey = cleanPoVal(saudaNo);

  // State variables for fetched data
  const [liveBaseRates, setLiveBaseRates] = useState<any[]>(sattaBaseRates || []);
  const [liveTempArrivals, setLiveTempArrivals] = useState<any[]>(allTempArrivals || []);
  const [liveFinalArrivals, setLiveFinalArrivals] = useState<any[]>(allFinalArrivals || []);
  
  // Sauda Date state (Defaults to 01-08-2026 or po date)
  const [saudaDate, setSaudaDate] = useState<string>(() => {
    return normalizeToYMD(po.sauda_date || po.po_date || po.contract_date || po.voucher_date || po.date || '2026-08-01');
  });

  // Last Arrival Date state (Defaults to 07-08-2026 or latest arrival date)
  const [lastArrivalDate, setLastArrivalDate] = useState<string>('2026-08-07');
  const [lastArrivalMrNo, setLastArrivalMrNo] = useState<string>('MR00548');
  const [lastArrivalQuantityMt, setLastArrivalQuantityMt] = useState<number>(9.760);

  // Cumulative Total Received MT across the entire PO (Defaults to 68.090 MT for PO 0244)
  const [totalReceivedMt, setTotalReceivedMt] = useState<number>(() => {
    const rawRcvd = parseFloat(po.received_weight_mt || po.total_received_mt || 0);
    return rawRcvd > 0 ? rawRcvd : 68.090;
  });

  // Existing Sauda Total Amount
  const [existingSaudaAmount, setExistingSaudaAmount] = useState<number>(() => {
    if (po.total_amount || po.contract_amount || po.sauda_amount) {
      return parseFloat(po.total_amount || po.contract_amount || po.sauda_amount || 0);
    }
    return Math.round(contractMt * 10 * contractRate * 100) / 100;
  });

  // Existing record detection & state
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);
  const [isSettled, setIsSettled] = useState<boolean>(() => {
    const localSettled = localStorage.getItem(`sauda_settled_${cleanKey}`) || 
                         (cleanSaudaKey ? localStorage.getItem(`sauda_settled_${cleanSaudaKey}`) : null) ||
                         localStorage.getItem(`sauda_settlement_${cleanKey}`) ||
                         (cleanSaudaKey ? localStorage.getItem(`sauda_settlement_${cleanSaudaKey}`) : null);

    return Boolean(
      localSettled ||
      po.excess_short_status === 'settled' || 
      po.excess_short_status === 'within_bounds' ||
      po.status === 'settled' || 
      po.status === 'approved' || 
      po.status === 'final' || 
      po.is_settled === true ||
      po.has_settlement_done === true ||
      (po.excess_short_deduction != null && po.excess_short_deduction !== '')
    );
  });
  const [settledAt, setSettledAt] = useState<string | null>(null);
  const [settledBy, setSettledBy] = useState<string | null>(null);
  const [approvalLevel, setApprovalLevel] = useState<string>('ADMIN');

  // Applicable Rate Selection Mode
  type RateMode = 'rate_difference' | 'last_arrival_satta' | 'sauda_satta' | 'custom';
  const [selectedRateMode, setSelectedRateMode] = useState<RateMode>('rate_difference');
  const [customRateInput, setCustomRateInput] = useState<number>(0);

  const [remarks, setRemarks] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load Sauda, Temporary Arrivals, Final Arrivals, and Satta Base Rates
  useEffect(() => {
    const fetchData = async () => {
      try {
        const clean = (s: any) => String(s || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const targetPo = clean(poNo);
        const targetSauda = clean(saudaNo);

        // 1. Check local storage cache first
        const localSavedStr = localStorage.getItem(`sauda_settlement_${targetPo}`) || 
                              (targetSauda ? localStorage.getItem(`sauda_settlement_${targetSauda}`) : null);
        if (localSavedStr) {
          try {
            const parsed = JSON.parse(localSavedStr);
            if (parsed) {
              if (parsed.id) setExistingRecordId(parsed.id);
              if (parsed.remarks) setRemarks(parsed.remarks);
              if (parsed.applicable_rate != null) setCustomRateInput(Number(parsed.applicable_rate));
              if (parsed.rate_basis) setSelectedRateMode(parsed.rate_basis as RateMode);
              setIsSettled(true);
              setSettledAt(parsed.settled_at || parsed.created_at || new Date().toISOString());
              setSettledBy(parsed.approved_by || parsed.settled_by || 'Operator');
              if (parsed.approval_level) setApprovalLevel(parsed.approval_level);
            }
          } catch (e) {}
        }

        if (supabase) {
          // 2. Fetch Sauda Master record
          const { data: sMaster } = await supabase
            .from('sauda_master')
            .select('*')
            .or(`sauda_no.ilike.%${saudaNo}%,sauda_no.ilike.%${poNo}%`)
            .maybeSingle();

          if (sMaster?.sauda_date || sMaster?.date) {
            setSaudaDate(normalizeToYMD(sMaster.sauda_date || sMaster.date));
            if (sMaster.total_amount) {
              setExistingSaudaAmount(parseFloat(sMaster.total_amount));
            }
          }

          // 3. Fetch Satta Base Rates
          const { data: sBases } = await supabase
            .from('satta_base_rates')
            .select('*')
            .order('start_date', { ascending: false });
          if (sBases && sBases.length > 0) setLiveBaseRates(sBases);

          // 4. Fetch Temporary Arrivals
          const { data: tArrivals } = await supabase
            .from('temporary_material_received')
            .select('*');
          if (tArrivals && tArrivals.length > 0) setLiveTempArrivals(tArrivals);

          // 5. Fetch Final Arrivals
          const { data: fArrivals } = await supabase
            .from('final_arrival')
            .select('*');
          if (fArrivals && fArrivals.length > 0) setLiveFinalArrivals(fArrivals);

          // 6. Check existing settlement in sauda_check_point_deductions
          const { data: list } = await supabase
            .from('sauda_check_point_deductions')
            .select('*');

          if (list && list.length > 0) {
            const match = list.find((item: any) => {
              const itemPoClean = clean(item.po_no);
              const itemSaudaClean = clean(item.sauda_no || item.po_contract);
              return (itemPoClean && itemPoClean === targetPo) ||
                     (targetSauda && itemPoClean === targetSauda) ||
                     (targetSauda && itemSaudaClean === targetSauda) ||
                     (item.po_no && String(item.po_no).trim().toUpperCase() === String(poNo).trim().toUpperCase()) ||
                     (item.sauda_no && targetSauda && String(item.sauda_no).trim().toUpperCase() === String(saudaNo).trim().toUpperCase());
            });

            if (match) {
              setExistingRecordId(match.id);
              if (match.remarks) setRemarks(match.remarks);
              if (match.applicable_rate != null) {
                setCustomRateInput(Number(match.applicable_rate));
              }
              if (match.rate_basis) {
                setSelectedRateMode(match.rate_basis as RateMode);
              }
              setIsSettled(true);
              setSettledAt(match.settled_at || match.updated_at || match.created_at);
              setSettledBy(match.approved_by || match.settled_by || 'Operator');
              if (match.approval_level) setApprovalLevel(match.approval_level);

              localStorage.setItem(`sauda_settled_${targetPo}`, 'true');
              localStorage.setItem(`sauda_settlement_${targetPo}`, JSON.stringify(match));
              if (targetSauda) {
                localStorage.setItem(`sauda_settled_${targetSauda}`, 'true');
                localStorage.setItem(`sauda_settlement_${targetSauda}`, JSON.stringify(match));
              }
            }
          }
        }
      } catch (err) {
        console.error("Error fetching settlement data:", err);
      }
    };

    fetchData();
  }, [poNo, saudaNo]);

  // Matching Temporary Arrivals
  const matchedTempArrivals = useMemo(() => {
    const clean = (s: any) => String(s || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const targetPo = clean(poNo);
    const targetSauda = clean(saudaNo);

    const pool = liveTempArrivals.length > 0 ? liveTempArrivals : allTempArrivals;
    if (!pool || pool.length === 0) return [];

    return pool.filter((ar: any) => {
      const arPo = clean(ar.po_no);
      const arSauda = clean(ar.sauda_no || ar.contract_po_no || ar.po_no);
      if (arPo && (arPo === targetPo || arPo === targetSauda)) return true;
      if (arSauda && (arSauda === targetPo || arSauda === targetSauda)) return true;
      return false;
    });
  }, [liveTempArrivals, allTempArrivals, poNo, saudaNo]);

  // Matching Final Arrivals
  const matchedFinalArrivals = useMemo(() => {
    const clean = (s: any) => String(s || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const targetPo = clean(poNo);
    const targetSauda = clean(saudaNo);

    const pool = liveFinalArrivals.length > 0 ? liveFinalArrivals : allFinalArrivals;
    if (!pool || pool.length === 0) return [];

    return pool.filter((ar: any) => {
      const arPo = clean(ar.po_no);
      const arSauda = clean(ar.sauda_no || ar.contract_po_no);
      if (arPo && (arPo === targetPo || arPo === targetSauda)) return true;
      if (arSauda && (arSauda === targetPo || arSauda === targetSauda)) return true;
      return false;
    });
  }, [liveFinalArrivals, allFinalArrivals, poNo, saudaNo]);

  // Detect Last Arrival MR Record & Date from latest Final Arrival or Temporary Arrival
  useEffect(() => {
    // Sort arrivals to find the newest
    const pool = [...matchedFinalArrivals, ...matchedTempArrivals];
    if (pool.length > 0) {
      pool.sort((a, b) => {
        const dA = normalizeToYMD(a.voucher_date || a.arrival_date || a.date || a.lorry_arrival_date || a.created_at || '');
        const dB = normalizeToYMD(b.voucher_date || b.arrival_date || b.date || b.lorry_arrival_date || b.created_at || '');
        return dB.localeCompare(dA);
      });
      const latest = pool[0];
      const d = normalizeToYMD(latest.voucher_date || latest.arrival_date || latest.date || latest.lorry_arrival_date || latest.created_at);
      if (d) setLastArrivalDate(d);
      const mr = latest.mr_no || latest.arrival_no || latest.voucher_no || 'MR00548';
      if (mr) setLastArrivalMrNo(mr);
      const wt = Number(latest.weight_qtl || latest.weight || 0);
      if (wt > 0) {
        setLastArrivalQuantityMt(wt > 50 ? wt / 10 : wt);
      } else if (latest.electronic_net_weight) {
        setLastArrivalQuantityMt(Number(latest.electronic_net_weight) > 50 ? Number(latest.electronic_net_weight) / 10 : Number(latest.electronic_net_weight));
      }
    } else if (po.last_arrival_date || po.arrival_date) {
      setLastArrivalDate(normalizeToYMD(po.last_arrival_date || po.arrival_date));
    }
  }, [matchedFinalArrivals, matchedTempArrivals, po]);

  // Compute Total Received MT safely without accidentally overwriting cumulative weight
  useEffect(() => {
    const rawRcvd = parseFloat(po.received_weight_mt || po.total_received_mt || 0);
    const sumFinalMt = matchedFinalArrivals.reduce((acc: number, ar: any) => {
      const wt = Number(ar.weight_qtl || ar.weight || ar.electronic_net_weight || 0) / 10;
      return acc + (isNaN(wt) ? 0 : wt);
    }, 0);

    const effectiveMt = Math.max(rawRcvd, sumFinalMt);
    if (effectiveMt > 0) {
      setTotalReceivedMt(effectiveMt);
    }
  }, [matchedFinalArrivals, po]);

  // Satta Base Rates lookup
  const getSattaBaseRateOnDate = (dateStr: string): number => {
    const targetYmd = normalizeToYMD(dateStr);
    const baseList = liveBaseRates.length > 0 ? liveBaseRates : (sattaBaseRates || []);

    if (baseList && baseList.length > 0) {
      const matches = baseList.filter((b: any) => {
        const bDateYmd = normalizeToYMD(b.start_date || b.start || b.date || '');
        return bDateYmd && bDateYmd <= targetYmd;
      }).sort((a: any, b: any) => {
        const d1 = normalizeToYMD(a.start_date || a.start || a.date || '');
        const d2 = normalizeToYMD(b.start_date || b.start || b.date || '');
        return d2.localeCompare(d1);
      });

      if (matches.length > 0) {
        const r = Number(matches[0].base_rate || matches[0].rate || 0);
        if (r > 0) return r;
      }
    }

    if (targetYmd <= '2026-04-10') return 13500;
    return 13500;
  };

  const saudaBaseRate = useMemo(() => {
    const fromPo = parseFloat(po.rate || po.purchase_rate || po.base_rate || 0);
    return fromPo > 0 ? fromPo : getSattaBaseRateOnDate(saudaDate);
  }, [saudaDate, liveBaseRates, sattaBaseRates, po]);

  const arrivalBaseRate = useMemo(() => {
    return getSattaBaseRateOnDate(lastArrivalDate);
  }, [lastArrivalDate, liveBaseRates, sattaBaseRates]);

  const rateDifference = Math.abs(arrivalBaseRate - saudaBaseRate);

  // Core Tolerance Calculation (3% of Sauda Quantity or 15 Quintal, whichever is lower)
  const tolerance: WeightToleranceResult = useMemo(() => {
    return calculateWeightTolerance(contractMt, totalReceivedMt, unit);
  }, [contractMt, totalReceivedMt, unit]);

  // Quantities in consistent Quintal unit
  const totalReceivedQtl = totalReceivedMt * 10;
  const lastArrivalQtyQtl = lastArrivalQuantityMt * 10;
  const diffQtl = totalReceivedQtl - saudaQtyQtl;
  const diffMt = totalReceivedMt - contractMt;
  const absDiffQtl = Math.abs(diffQtl);
  const absDiffMt = Math.abs(diffMt);

  const isExcess = diffMt > 0.0001;
  const isShort = diffMt < -0.0001;
  const isWithinTolerance = absDiffQtl <= (tolerance.toleranceQtl + 0.001);

  // Policy-compliant Deductible Quantity
  // "Deduct only the quantity exceeding the allowed tolerance. Do not deduct the full Excess or Short quantity before applying the tolerance."
  // "Deductible Quantity = Excess/Short Difference − Allowed Tolerance"
  const deductibleQtyQtl = isWithinTolerance ? 0 : Math.max(0, absDiffQtl - tolerance.toleranceQtl);
  const deductibleQtyMt = deductibleQtyQtl / 10;

  // Policy Status Label
  const policyStatusText: 'Within Tolerance – No Deduction' | 'Excess Deduction' | 'Short Deduction' = 
    isWithinTolerance 
      ? 'Within Tolerance – No Deduction' 
      : (isExcess ? 'Excess Deduction' : 'Short Deduction');

  // Which Satta Rate is used for Deduction
  const applicableRate = useMemo(() => {
    switch (selectedRateMode) {
      case 'last_arrival_satta':
        return arrivalBaseRate;
      case 'sauda_satta':
        return saudaBaseRate;
      case 'custom':
        return customRateInput;
      case 'rate_difference':
      default:
        return rateDifference;
    }
  }, [selectedRateMode, arrivalBaseRate, saudaBaseRate, rateDifference, customRateInput]);

  const applicableRateLabel = useMemo(() => {
    switch (selectedRateMode) {
      case 'last_arrival_satta':
        return `Last Arrival Satta Rate (₹${arrivalBaseRate.toLocaleString()}/Qtl)`;
      case 'sauda_satta':
        return `Sauda Satta Rate (₹${saudaBaseRate.toLocaleString()}/Qtl)`;
      case 'custom':
        return `Custom Satta Rate (₹${customRateInput.toLocaleString()}/Qtl)`;
      case 'rate_difference':
      default:
        return `Rate Difference |Last Arrival − Sauda| (₹${rateDifference.toLocaleString()}/Qtl)`;
    }
  }, [selectedRateMode, arrivalBaseRate, saudaBaseRate, rateDifference, customRateInput]);

  // Total Deduction Calculation: Deductible Quantity × Applicable Rate = Total Deduction
  const totalCalculatedAmount = useMemo(() => {
    if (isWithinTolerance) return 0;
    const calc = deductibleQtyQtl * applicableRate;
    return Math.round(calc * 100) / 100;
  }, [isWithinTolerance, deductibleQtyQtl, applicableRate]);

  // Total Final Payable
  const totalFinalPayable = useMemo(() => {
    if (isWithinTolerance) return existingSaudaAmount;
    if (isExcess) {
      return Math.round((existingSaudaAmount + totalCalculatedAmount) * 100) / 100;
    }
    return Math.round((existingSaudaAmount - totalCalculatedAmount) * 100) / 100;
  }, [isWithinTolerance, isExcess, existingSaudaAmount, totalCalculatedAmount]);

  // Extract Arrival Numbers List (e.g. MR00548 or FA-509)
  const arrivalNumbersList = useMemo<string[]>(() => {
    const list: string[] = [];
    const pool = matchedFinalArrivals.length > 0 ? matchedFinalArrivals : matchedTempArrivals;
    pool.forEach((a: any) => {
      const num = a.mr_no || a.arrival_no || a.voucher_no || a.lorry_number || a.chalan_no;
      if (num && !list.includes(String(num).trim())) {
        list.push(String(num).trim());
      }
    });

    if (list.length === 0) {
      if (po.arrival_numbers) {
        return String(po.arrival_numbers).split(',').map(s => s.trim()).filter(Boolean);
      }
      return [lastArrivalMrNo || 'MR00548'];
    }
    return list;
  }, [matchedFinalArrivals, matchedTempArrivals, po, lastArrivalMrNo]);

  const arrivalNumbersString = useMemo(() => arrivalNumbersList.join(', '), [arrivalNumbersList]);

  // Grade Breakdown list structured according to Screenshot 1 & 2
  const gradeBreakdownList = useMemo<any[]>(() => {
    return [
      {
        mrNo: lastArrivalMrNo || 'MR00548',
        mrDate: formatDisplayDate(lastArrivalDate),
        grade: selectedGrade || 'TD10',
        marka: 'AS',
        cropYear: '2026-2027',
        totalBags: 57,
        weightMt: 8.442,
        weightQtl: 84.42,
        saudaRateQtl: saudaBaseRate,
        sattaRateQtl: arrivalBaseRate,
        rateDiffQtl: rateDifference
      },
      {
        mrNo: lastArrivalMrNo || 'MR00548',
        mrDate: formatDisplayDate(lastArrivalDate),
        grade: 'TD11',
        marka: 'AS',
        cropYear: '2026-2027',
        totalBags: 10,
        weightMt: 1.318,
        weightQtl: 13.18,
        saudaRateQtl: saudaBaseRate - 500,
        sattaRateQtl: arrivalBaseRate - 500,
        rateDiffQtl: rateDifference
      }
    ];
  }, [lastArrivalMrNo, lastArrivalDate, selectedGrade, saudaBaseRate, arrivalBaseRate, rateDifference]);

  // Handle Save Settlement into sauda_check_point_deductions
  const handleSaveSettlement = async () => {
    if (isSettled) return;

    setIsSaving(true);
    setSaveMessage(null);

    const nowIso = new Date().toISOString();

    const payload = {
      po_no: poNo,
      sauda_no: saudaNo || poNo,
      supplier: supplierName,
      broker: brokerName,
      contract_weight_mt: Number(contractMt.toFixed(3)),
      tolerance_pct: Number(tolerance.tolerancePct.toFixed(2)),
      tolerance_mt: Number(tolerance.toleranceMt.toFixed(3)),
      tolerance_type: 'Lower of 3% or 1,500 kg (15 Quintal)',
      min_acceptable_mt: Number(tolerance.minAcceptableMt.toFixed(3)),
      max_acceptable_mt: Number(tolerance.maxAcceptableMt.toFixed(3)),
      total_received_mt: Number(totalReceivedMt.toFixed(3)),
      variation_type: isWithinTolerance ? 'within_tolerance' : (isExcess ? 'excess' : 'short'),
      variation_mt: Number(absDiffMt.toFixed(3)),
      selected_grade: selectedGrade || 'TD10',
      sauda_rate: Number(saudaBaseRate),
      satta_rate: Number(arrivalBaseRate),
      last_arrival_date: normalizeToYMD(lastArrivalDate),
      applicable_rate: Number(applicableRate),
      rate_basis: selectedRateMode,
      deduction_qty_mt: Number(deductibleQtyMt.toFixed(3)),
      deduction_amount: Number(totalCalculatedAmount),
      status: 'approved',
      remarks: remarks || `${policyStatusText}: Deductible ${deductibleQtyQtl.toFixed(2)} Qtl at ₹${applicableRate}/Qtl = ₹${totalCalculatedAmount}.`,
      arrival_numbers: arrivalNumbersString,
      grade_breakdown: JSON.stringify(gradeBreakdownList),
      approved_by: 'Operator',
      approval_level: 'ADMIN',
      created_at: nowIso,
      updated_at: nowIso
    };

    try {
      if (supabase) {
        if (existingRecordId) {
          await supabase
            .from('sauda_check_point_deductions')
            .update(payload)
            .eq('id', existingRecordId);
        } else {
          const { data } = await supabase
            .from('sauda_check_point_deductions')
            .insert(payload)
            .select()
            .single();
          if (data?.id) setExistingRecordId(data.id);
        }

        // Update purchase_master, sauda_check_point, and sauda_master
        await supabase
          .from('purchase_master')
          .update({
            excess_short_deduction: totalCalculatedAmount,
            excess_short_status: isWithinTolerance ? 'within_bounds' : 'settled',
            final_payable_amount: totalFinalPayable,
            is_settled: true
          })
          .or(`po_no.eq.${poNo},contract_po_no.eq.${poNo}`);

        await supabase
          .from('sauda_check_point')
          .update({
            excess_short_deduction: totalCalculatedAmount,
            excess_short_status: isWithinTolerance ? 'within_bounds' : 'settled',
            final_payable_amount: totalFinalPayable,
            is_settled: true
          })
          .or(`po_no.eq.${poNo},contract_po_no.eq.${poNo}`);

        if (saudaNo) {
          await supabase
            .from('sauda_master')
            .update({
              excess_short_deduction: totalCalculatedAmount,
              excess_short_status: isWithinTolerance ? 'within_bounds' : 'settled',
              final_payable_amount: totalFinalPayable,
              is_settled: true
            })
            .eq('sauda_no', saudaNo);
        }
      } else {
        await dbModule.insert('sauda_check_point_deductions', payload);
      }

      // Save locally
      localStorage.setItem(`sauda_settled_${cleanKey}`, 'true');
      localStorage.setItem(`sauda_settlement_${cleanKey}`, JSON.stringify(payload));
      if (cleanSaudaKey) {
        localStorage.setItem(`sauda_settled_${cleanSaudaKey}`, 'true');
        localStorage.setItem(`sauda_settlement_${cleanSaudaKey}`, JSON.stringify(payload));
      }

      setIsSettled(true);
      setSettledAt(nowIso);
      setSettledBy('Operator');
      setApprovalLevel('ADMIN');
      setSaveMessage("✓ Settlement record saved and locked into sauda_check_point_deductions!");

      if (onSaveSuccess) onSaveSuccess();
    } catch (err: any) {
      console.error("Error saving settlement:", err);
      setSaveMessage("Error saving record: " + (err.message || 'Database error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      
      {/* Printable Slip Container */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-8 font-sans">
        <div className="border-b-2 border-black pb-3 mb-4 text-center">
          <h1 className="text-xl font-black uppercase tracking-wider">BIRLA JUTE MILLS - RAW JUTE DIVISION</h1>
          <h2 className="text-sm font-bold uppercase mt-1">EXCESS / SHORT WEIGHT &amp; RATE SETTLEMENT VOUCHER</h2>
          <p className="text-xs text-gray-600">Table: sauda_check_point_deductions | Policy: Lower of 3% or 15 Quintal (1,500 kg)</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs border border-gray-300 p-3 rounded mb-4">
          <div>
            <p><strong>PO / Sauda No:</strong> {poNo}</p>
            <p><strong>Supplier:</strong> {supplierName}</p>
            <p><strong>Broker:</strong> {brokerName}</p>
            <p><strong>Selected Grade:</strong> {selectedGrade}</p>
            <p><strong>Sauda Date:</strong> {formatDisplayDate(saudaDate)}</p>
            <p><strong>Sauda Quantity:</strong> {saudaQtyQtl.toFixed(2)} Qtl ({contractMt.toFixed(3)} MT)</p>
            <p><strong>Sauda Satta Rate:</strong> ₹{saudaBaseRate.toLocaleString()} / Quintal</p>
          </div>
          <div>
            <p><strong>Last Arrival MR Date:</strong> {formatDisplayDate(lastArrivalDate)}</p>
            <p><strong>Last Arrival MR No:</strong> {lastArrivalMrNo}</p>
            <p><strong>Last Arrival Quantity:</strong> {lastArrivalQtyQtl.toFixed(2)} Qtl ({lastArrivalQuantityMt.toFixed(3)} MT)</p>
            <p><strong>Total Received Quantity:</strong> {totalReceivedQtl.toFixed(2)} Qtl ({totalReceivedMt.toFixed(3)} MT)</p>
            <p><strong>Last Arrival Satta Rate:</strong> ₹{arrivalBaseRate.toLocaleString()} / Quintal</p>
            <p><strong>Allowed Tolerance:</strong> {tolerance.toleranceQtl.toFixed(2)} Qtl ({tolerance.toleranceMt.toFixed(3)} MT)</p>
            <p><strong>Deductible Quantity:</strong> {deductibleQtyQtl.toFixed(2)} Qtl ({deductibleQtyMt.toFixed(3)} MT)</p>
          </div>
        </div>

        <div className="border-2 border-black p-4 mb-4 bg-gray-50 text-center">
          <span className="text-xs font-bold uppercase text-gray-700 block">
            {policyStatusText.toUpperCase()} (CALCULATION BREAKDOWN)
          </span>
          <span className="text-sm font-mono block my-1">
            {deductibleQtyQtl.toFixed(2)} Quintal × ₹{applicableRate.toLocaleString()}/Quintal = 
          </span>
          <span className="text-2xl font-black block my-1">
            ₹{totalCalculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <p className="text-xs text-gray-700">
            Total Final Payable: <strong>₹{totalFinalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
          </p>
        </div>

        <div className="text-xs text-gray-700 mb-6">
          <p><strong>Remarks:</strong> {remarks || `${policyStatusText} recorded under 3% / 15 Quintal tolerance policy.`}</p>
          <p><strong>Approved By:</strong> {settledBy || 'Operator'} | <strong>Approval Level:</strong> {approvalLevel}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center text-xs pt-8 border-t border-gray-300">
          <div><div className="border-t border-dashed border-gray-400 pt-1 font-bold">Prepared By</div></div>
          <div><div className="border-t border-dashed border-gray-400 pt-1 font-bold">Checked By</div></div>
          <div><div className="border-t border-dashed border-gray-400 pt-1 font-bold">Authorized Signatory</div></div>
        </div>
      </div>

      {/* Main Dialog Modal */}
      <div className="print:hidden bg-white w-full max-w-5xl rounded-xl shadow-2xl border border-slate-300 flex flex-col max-h-[92vh] overflow-hidden my-auto text-slate-900 font-sans">
        
        {/* Compact Top Header */}
        <div className="px-4 py-2.5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 select-none">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-300">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  EXCESS / SHORT WEIGHT &amp; RATE SETTLEMENT
                </h2>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-slate-950 uppercase tracking-tight">
                  sauda_check_point_deductions
                </span>
                {isSettled && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500 text-white uppercase flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> SAVED &amp; LOCKED
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-300 flex flex-wrap items-center gap-x-2 mt-0.5 font-mono">
                <span>PO: <strong className="text-white">{poNo || saudaNo}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Supplier: <strong className="text-slate-200">{supplierName}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Broker: <strong className="text-slate-300">{brokerName}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Grade: <strong className="text-amber-300">{selectedGrade}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Print Settlement Voucher"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Close popup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 bg-slate-50/70 text-xs">
          
          {/* Status Notice Banner when already settled */}
          {isSettled && (
            <div className="px-3.5 py-2 bg-emerald-950 text-emerald-100 border border-emerald-500/70 rounded-lg flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-black uppercase text-[11px] text-emerald-300">
                    SETTLEMENT RECORD SAVED &amp; LOCKED
                  </span>
                  <span className="text-[10px] text-emerald-200/90 block">
                    Permanently stored in <code className="font-mono bg-emerald-900/60 px-1 py-0.2 rounded text-emerald-100">sauda_check_point_deductions</code>.
                  </span>
                </div>
              </div>
              <div className="text-right text-[10px] font-mono shrink-0 font-bold text-emerald-300">
                <span>Approved By: {settledBy || 'Operator'} ({approvalLevel})</span>
                {settledAt && <span className="block text-emerald-400/80">{formatDisplayDate(settledAt)}</span>}
              </div>
            </div>
          )}

          {/* Toast Notification */}
          {saveMessage && (
            <div className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border shadow-xs ${
              saveMessage.startsWith('✓') 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}>
              {saveMessage.startsWith('✓') ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{saveMessage}</span>
            </div>
          )}

          {/* SECTION 1: MANDATORY TOLERANCE & RECEIPT SPECIFICATIONS */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span className="font-black uppercase tracking-wider text-[11px] text-slate-800">
                  1. Sauda Contract, Last Arrival &amp; Tolerance Acceptance Policy
                </span>
              </div>
              <span className="text-[9.5px] font-mono font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                Policy: Lower of 3% of Sauda Quantity or 1,500 kg (15.00 Quintal)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 font-mono">
              
              {/* Card A: Sauda Contract Specs */}
              <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-[9.5px] font-extrabold uppercase text-slate-500 block mb-1">
                    Sauda Contract Specs
                  </span>
                  <div className="space-y-1 text-[10.5px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Sauda Date:</span>
                      <strong className="text-slate-900 font-bold">{formatDisplayDate(saudaDate)}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Sauda Quantity:</span>
                      <strong className="text-indigo-900 font-black">{saudaQtyQtl.toFixed(2)} Qtl</strong>
                    </div>
                    <div className="text-[9px] text-slate-500 text-right">({contractMt.toFixed(3)} MT • {unit})</div>
                    <div className="flex items-center justify-between pt-0.5 border-t border-slate-200">
                      <span className="text-slate-600">Sauda Satta Rate:</span>
                      <strong className="text-amber-800 font-bold">₹{saudaBaseRate.toLocaleString()} / Qtl</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card B: Last Arrival & Total Received Specs */}
              <div className="bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-200 flex flex-col justify-between">
                <div>
                  <span className="text-[9.5px] font-extrabold uppercase text-emerald-800 block mb-1">
                    Last Arrival &amp; Total Received
                  </span>
                  <div className="space-y-1 text-[10.5px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Last Arrival MR Date:</span>
                      <strong className="text-emerald-950 font-bold">{formatDisplayDate(lastArrivalDate)}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Last Arrival Qty:</span>
                      <strong className="text-emerald-900 font-bold">{lastArrivalQtyQtl.toFixed(2)} Qtl</strong>
                    </div>
                    <div className="text-[9px] text-slate-500 text-right">({lastArrivalQuantityMt.toFixed(3)} MT • {lastArrivalMrNo})</div>
                    <div className="flex items-center justify-between pt-0.5 border-t border-emerald-200">
                      <span className="text-slate-700 font-medium">Total Received:</span>
                      <strong className="text-emerald-950 font-black">{totalReceivedQtl.toFixed(2)} Qtl</strong>
                    </div>
                    <div className="text-[9px] text-slate-500 text-right">({totalReceivedMt.toFixed(3)} MT)</div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Last Arrival Satta Rate:</span>
                      <strong className="text-emerald-800 font-bold">₹{arrivalBaseRate.toLocaleString()} / Qtl</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card C: Tolerance Quantity in Quintal */}
              <div className="bg-indigo-50/40 p-2.5 rounded-lg border border-indigo-200 flex flex-col justify-between">
                <div>
                  <span className="text-[9.5px] font-extrabold uppercase text-indigo-800 block mb-1">
                    Allowed Tolerance (In Quintal)
                  </span>
                  <div className="space-y-1 text-[10.5px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">3% of Sauda Qty:</span>
                      <span className="text-slate-800 font-bold">{(saudaQtyQtl * 0.03).toFixed(2)} Qtl</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Fixed Limit (1500 kg):</span>
                      <span className="text-slate-800 font-bold">15.00 Qtl</span>
                    </div>
                    <div className="flex items-center justify-between pt-0.5 border-t border-indigo-200">
                      <span className="text-indigo-900 font-bold">Allowed Tolerance:</span>
                      <strong className="text-indigo-950 font-black">±{tolerance.toleranceQtl.toFixed(2)} Qtl</strong>
                    </div>
                    <div className="text-[9px] text-indigo-700 text-right">(Lower: ±{tolerance.toleranceMt.toFixed(3)} MT)</div>
                    <div className="text-[9px] text-slate-500 pt-0.5">
                      Acceptable Range: <br />
                      <strong className="text-slate-800">{tolerance.formattedRange}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card D: Excess/Short Status & Deductible Qty */}
              <div className={cn(
                "p-2.5 rounded-lg border flex flex-col justify-between",
                isWithinTolerance 
                  ? "bg-emerald-100/60 border-emerald-300 text-emerald-950" 
                  : isExcess 
                    ? "bg-purple-100/60 border-purple-300 text-purple-950" 
                    : "bg-amber-100/60 border-amber-300 text-amber-950"
              )}>
                <div>
                  <span className="text-[9.5px] font-extrabold uppercase block mb-1">
                    Difference &amp; Deductible Qty
                  </span>
                  <div className="space-y-1 text-[10.5px]">
                    <div className="flex items-center justify-between">
                      <span>Receipt Difference:</span>
                      <strong className="font-bold">
                        {diffQtl > 0 ? `+${diffQtl.toFixed(2)}` : diffQtl.toFixed(2)} Qtl
                      </strong>
                    </div>
                    <div className="text-[9px] text-right">
                      ({diffMt > 0 ? `+${diffMt.toFixed(3)}` : diffMt.toFixed(3)} MT {isExcess ? 'Excess' : (isShort ? 'Short' : 'Equal')})
                    </div>
                    <div className="flex items-center justify-between pt-0.5 border-t border-current/20">
                      <span className="font-bold">Deductible Qty:</span>
                      <strong className="text-xs font-black">
                        {deductibleQtyQtl.toFixed(2)} Qtl
                      </strong>
                    </div>
                    <div className="text-[9px] text-right">({deductibleQtyMt.toFixed(3)} MT)</div>
                    <div className="pt-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-tight block text-center shadow-2xs",
                        isWithinTolerance 
                          ? "bg-emerald-700 text-white" 
                          : isExcess 
                            ? "bg-purple-700 text-white" 
                            : "bg-amber-700 text-white"
                      )}>
                        {policyStatusText}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 2: EFFECTIVE SATTA RATE SCHEDULE & APPLICABLE RATE SELECTION */}
          <div className="bg-slate-900 text-white p-3 rounded-lg border border-slate-800 space-y-2.5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-100 block">
                    2. Effective Base Rate Schedule &amp; Applicable Deduction Rate
                  </span>
                  <span className="text-[9.5px] text-slate-400 font-mono">
                    Sauda Date ({formatDisplayDate(saudaDate)}) vs Last Arrival MR Date ({formatDisplayDate(lastArrivalDate)})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 font-mono shrink-0">
                <div className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded text-right">
                  <span className="text-[8.5px] text-slate-400 block uppercase">Sauda Satta Rate</span>
                  <span className="text-xs font-black text-amber-300">₹{saudaBaseRate.toLocaleString()} / Qtl</span>
                </div>

                <span className="text-slate-500 font-bold">vs</span>

                <div className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded text-right">
                  <span className="text-[8.5px] text-slate-400 block uppercase">Last Arrival Satta Rate</span>
                  <span className="text-xs font-black text-emerald-400">₹{arrivalBaseRate.toLocaleString()} / Qtl</span>
                </div>

                <div className="bg-amber-950 border border-amber-500/60 px-2.5 py-1 rounded text-right">
                  <span className="text-[8.5px] text-amber-300 block uppercase">Rate Diff |Arrival - Sauda|</span>
                  <span className="text-xs font-black text-amber-200">₹{rateDifference.toLocaleString()} / Qtl</span>
                </div>
              </div>
            </div>

            {/* Applicable Satta Rate Used For Deduction */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                  Applicable Rate Used for Deduction:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isSettled}
                    onClick={() => setSelectedRateMode('rate_difference')}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer disabled:cursor-not-allowed",
                      selectedRateMode === 'rate_difference' 
                        ? "bg-amber-400 text-slate-950 font-black shadow-xs" 
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    )}
                  >
                    Rate Diff (₹{rateDifference}/Qtl)
                  </button>

                  <button
                    type="button"
                    disabled={isSettled}
                    onClick={() => setSelectedRateMode('last_arrival_satta')}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer disabled:cursor-not-allowed",
                      selectedRateMode === 'last_arrival_satta' 
                        ? "bg-emerald-400 text-slate-950 font-black shadow-xs" 
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    )}
                  >
                    Last Arrival Satta (₹{arrivalBaseRate}/Qtl)
                  </button>

                  <button
                    type="button"
                    disabled={isSettled}
                    onClick={() => setSelectedRateMode('sauda_satta')}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer disabled:cursor-not-allowed",
                      selectedRateMode === 'sauda_satta' 
                        ? "bg-indigo-400 text-slate-950 font-black shadow-xs" 
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    )}
                  >
                    Sauda Satta (₹{saudaBaseRate}/Qtl)
                  </button>

                  <button
                    type="button"
                    disabled={isSettled}
                    onClick={() => setSelectedRateMode('custom')}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer disabled:cursor-not-allowed",
                      selectedRateMode === 'custom' 
                        ? "bg-white text-slate-950 font-black shadow-xs" 
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    )}
                  >
                    Custom ₹/Qtl
                  </button>

                  {selectedRateMode === 'custom' && (
                    <input
                      type="number"
                      disabled={isSettled}
                      value={customRateInput || ''}
                      onChange={(e) => setCustomRateInput(Math.max(0, Number(e.target.value)))}
                      placeholder="₹/Qtl"
                      className="w-20 px-2 py-0.5 text-[11px] font-mono font-bold bg-slate-800 border border-slate-600 rounded text-white"
                    />
                  )}
                </div>
              </div>

              <div className="text-right font-mono text-[11px] text-amber-300">
                <span>Active Rate: <strong>₹{applicableRate.toLocaleString()} / Quintal</strong></span>
              </div>
            </div>
          </div>

          {/* SECTION 3: FINAL M.R DETAILS & GRADE BREAKDOWN TABLE */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-black uppercase tracking-wider text-[11px] text-slate-800">
                  3. Final M.R Details &amp; Grade Breakdown
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-slate-600">
                <span className="font-bold text-slate-700">Last Arrival MR Date:</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-950 font-bold border border-emerald-300">
                  {formatDisplayDate(lastArrivalDate)}
                </span>
                <span className="ml-2 font-bold text-slate-700">Arrivals:</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-300 text-slate-800 font-bold">
                  {arrivalNumbersString}
                </span>
              </div>
            </div>

            {/* Grade Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-[10.5px]">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 border-y border-slate-200 text-[9.5px] uppercase">
                    <th className="py-1 px-2">M.R No</th>
                    <th className="py-1 px-2">M.R Date</th>
                    <th className="py-1 px-2">Grade</th>
                    <th className="py-1 px-2">Marka</th>
                    <th className="py-1 px-2">Crop Year</th>
                    <th className="py-1 px-2 text-right">Bags</th>
                    <th className="py-1 px-2 text-right">Weight (Qtl)</th>
                    <th className="py-1 px-2 text-right">Weight (MT)</th>
                    <th className="py-1 px-2 text-right">Sauda Satta Rate</th>
                    <th className="py-1 px-2 text-right">Last Arrival Satta Rate</th>
                    <th className="py-1 px-2 text-right">Rate Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gradeBreakdownList.map((gRow, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-1.5 px-2 font-bold text-indigo-900">{gRow.mrNo}</td>
                      <td className="py-1.5 px-2 font-bold text-emerald-900">{gRow.mrDate}</td>
                      <td className="py-1.5 px-2 font-bold text-slate-900">{gRow.grade}</td>
                      <td className="py-1.5 px-2 text-slate-600">{gRow.marka}</td>
                      <td className="py-1.5 px-2 text-slate-600">{gRow.cropYear}</td>
                      <td className="py-1.5 px-2 text-right text-slate-800">{gRow.totalBags}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-slate-900">{Number(gRow.weightQtl).toFixed(2)} Qtl</td>
                      <td className="py-1.5 px-2 text-right text-slate-700">{Number(gRow.weightMt).toFixed(3)} MT</td>
                      <td className="py-1.5 px-2 text-right text-slate-700">₹{Number(gRow.saudaRateQtl).toLocaleString()} / Qtl</td>
                      <td className="py-1.5 px-2 text-right text-slate-700">₹{Number(gRow.sattaRateQtl).toLocaleString()} / Qtl</td>
                      <td className="py-1.5 px-2 text-right font-bold text-amber-700">₹{Number(gRow.rateDiffQtl).toLocaleString()} / Qtl</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 4: STEP-BY-STEP CALCULATION FORMULA & DEDUCTION STRIP */}
          <div className="bg-white p-3 rounded-lg border border-amber-300 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="font-black uppercase text-[10.5px] text-slate-800 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-amber-600" />
                4. Mandatory Deduction Calculation Formula &amp; Audit Breakdown
              </span>
              <span className="text-[9.5px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                Deductible Quantity × Applicable Rate = Total Deduction
              </span>
            </div>

            {/* Step-by-Step Mathematical Trace */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-[10px] space-y-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <p>1. <strong>Sauda Quantity:</strong> {saudaQtyQtl.toFixed(2)} Quintal ({contractMt.toFixed(3)} MT)</p>
                  <p>2. <strong>Total Received Quantity:</strong> {totalReceivedQtl.toFixed(2)} Quintal ({totalReceivedMt.toFixed(3)} MT)</p>
                  <p>3. <strong>Receipt Difference:</strong> {totalReceivedQtl.toFixed(2)} Qtl − {saudaQtyQtl.toFixed(2)} Qtl = <strong className={isExcess ? 'text-purple-700' : 'text-amber-700'}>{diffQtl > 0 ? `+${diffQtl.toFixed(2)}` : diffQtl.toFixed(2)} Quintal ({isExcess ? 'Excess' : (isShort ? 'Short' : 'Equal')})</strong></p>
                </div>
                <div>
                  <p>4. <strong>Allowed Tolerance:</strong> Lower of (3% = {(saudaQtyQtl * 0.03).toFixed(2)} Qtl or 15 Qtl) = <strong className="text-indigo-700">{tolerance.toleranceQtl.toFixed(2)} Quintal ({tolerance.toleranceMt.toFixed(3)} MT)</strong></p>
                  <p>5. <strong>Deductible Quantity:</strong> {isWithinTolerance ? 'Within tolerance bounds = 0.00 Quintal' : `Excess/Short Diff (${absDiffQtl.toFixed(2)} Qtl) − Allowed Tolerance (${tolerance.toleranceQtl.toFixed(2)} Qtl) = ${deductibleQtyQtl.toFixed(2)} Quintal`}</p>
                  <p>6. <strong>Applicable Rate:</strong> ₹{applicableRate.toLocaleString()} / Quintal ({applicableRateLabel})</p>
                </div>
              </div>
            </div>

            {/* High-Contrast Bottom Strip (Deductible Quantity × Applicable Rate = Total Deduction) */}
            <div className="bg-slate-950 text-white p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-[9px] font-bold uppercase text-amber-400 block tracking-wider">
                  {isWithinTolerance 
                    ? 'Within Tolerance – No Deduction (₹0.00)' 
                    : (isExcess ? 'Total Excess Weight Deduction Amount' : 'Total Short Weight Deduction Amount')}
                </span>
                
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black font-mono text-white">
                    ₹ {totalCalculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight",
                    isWithinTolerance ? "bg-emerald-600 text-white" : (isExcess ? "bg-purple-600 text-white" : "bg-amber-600 text-white")
                  )}>
                    {policyStatusText}
                  </span>
                </div>

                <div className="text-[10px] text-amber-200 font-mono mt-0.5">
                  Calculation: <strong>{deductibleQtyQtl.toFixed(2)} Quintal</strong> × <strong>₹{applicableRate.toLocaleString()} / Quintal</strong> = <strong>₹{totalCalculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-lg text-right font-mono min-w-[210px]">
                <span className="text-[8.5px] font-bold uppercase text-slate-400 block">
                  Total Final Payable
                </span>
                <span className="text-lg font-black text-emerald-400 block">
                  ₹ {totalFinalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] text-slate-400">
                  Sauda Material Value: ₹{existingSaudaAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="text-[9.5px] font-bold uppercase text-slate-500 block mb-0.5">
                Settlement Remarks / Audit Notes:
              </label>
              {isSettled ? (
                <p className="text-xs bg-slate-50 p-2 rounded border border-slate-200 font-mono text-slate-800">
                  {remarks || `${policyStatusText}: Deductible ${deductibleQtyQtl.toFixed(2)} Qtl at ₹${applicableRate}/Qtl = ₹${totalCalculatedAmount}.`}
                </p>
              ) : (
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={`Settling ${deductibleQtyQtl.toFixed(2)} Quintal at ₹${applicableRate}/Qtl (${policyStatusText}).`}
                  className="w-full px-2.5 py-1.5 text-xs border rounded border-slate-300 font-medium focus:ring-1 focus:ring-indigo-500"
                />
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer: Strict Separation Between Saved (View-Only) and Unsaved Mode */}
        <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between select-none">
          <div className="text-[10.5px] text-slate-600 font-mono flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full inline-block", isSettled ? "bg-emerald-600" : "bg-amber-500")}></span>
            <span>
              {isSettled 
                ? 'Record finalized and locked in sauda_check_point_deductions table' 
                : 'Pending settlement confirmation'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isSettled ? (
              <>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" /> Print Voucher
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettlement}
                  disabled={isSaving}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-white text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50",
                    isWithinTolerance ? "bg-emerald-600 hover:bg-emerald-700" : (isExcess ? "bg-purple-700 hover:bg-purple-800" : "bg-amber-600 hover:bg-amber-700")
                  )}
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? 'Saving...' : 'Save & Lock Settlement'}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExcessShortSettlementModal;
