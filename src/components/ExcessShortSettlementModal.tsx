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
  FileText, 
  Info,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  Lock,
  Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { dbModule } from '../services/dbModule';
import { calculateWeightTolerance, WeightToleranceResult } from '../lib/weightTolerance';
import { getCurrentUserContext } from '../lib/permissions';

interface ExcessShortSettlementModalProps {
  po: any;
  onClose: () => void;
  onSaveSuccess?: () => void;
  allFinalArrivals?: any[];
  allScpDetails?: any[];
  sattaCalculatedRates?: any[];
  sattaBaseRates?: any[];
}

export const ExcessShortSettlementModal: React.FC<ExcessShortSettlementModalProps> = ({
  po,
  onClose,
  onSaveSuccess,
  allFinalArrivals = [],
  allScpDetails = [],
  sattaCalculatedRates = [],
  sattaBaseRates = []
}) => {
  const poNo = String(po.po_no || po.contract_po_no || '').trim();
  const saudaNo = String(po.sauda_no || po.sauda_ref || po.po_no || '').trim();
  const supplierName = String(po.supplier || po.supplier_name || po.supp_name || 'N/A').trim();
  const brokerName = String(po.broker || po.broker_name || 'N/A').trim();
  const unit = String(po.purchase_unit_name || po.unit_type || po.unit || 'BALES').toUpperCase();
  const contractMt = parseFloat(po.total_contract_mt || po.contract_weight_mt || 0) || 0;

  // Permissions check: Only Level 4 (L4) or Admin can save
  const userCtx = getCurrentUserContext();
  const userRole = String(userCtx?.userRole || '').toUpperCase();
  const userLevel = String(userCtx?.userLevel || '').toUpperCase();
  const isAuthorizedToSave = userRole === 'ADMIN' || userRole === 'ADMINISTRATOR' || userLevel === 'L4' || userLevel === 'L5' || userLevel === 'MAX';

  // Live database quality & rate records
  const [saudaQualities, setSaudaQualities] = useState<any[]>([]);
  const [liveSattaRates, setLiveSattaRates] = useState<any[]>(sattaCalculatedRates || []);
  const [liveBaseRates, setLiveBaseRates] = useState<any[]>(sattaBaseRates || []);
  const [liveDifferentials, setLiveDifferentials] = useState<any[]>([]);

  // 1. Linked Final Arrivals
  const linkedFinalArrivals = useMemo(() => {
    const clean = (s: any) => String(s || '').trim().toUpperCase();
    const targetPo = clean(poNo);
    const targetSauda = clean(saudaNo);

    return (allFinalArrivals || []).filter((ar: any) => {
      const arPo = clean(ar.po_no);
      const arSauda = clean(ar.sauda_no || ar.contract_po_no);
      if (arPo && (arPo === targetPo || arPo === targetSauda)) return true;
      if (arSauda && (arSauda === targetPo || arSauda === targetSauda)) return true;
      return false;
    }).sort((a: any, b: any) => {
      const d1 = new Date(a.voucher_date || a.arrival_date || a.created_at || 0).getTime();
      const d2 = new Date(b.voucher_date || b.arrival_date || b.created_at || 0).getTime();
      return d1 - d2;
    });
  }, [allFinalArrivals, poNo, saudaNo]);

  // 2. Compute Total Received Weight
  const totalReceivedMt = useMemo(() => {
    return linkedFinalArrivals.reduce((sum: number, ar: any) => {
      const wt = Number(ar.weight_qtl || ar.weight || ar.electronic_net_weight || 0) / 10;
      return sum + (isNaN(wt) ? 0 : wt);
    }, 0);
  }, [linkedFinalArrivals]);

  // 3. Tolerance Computation
  const tolerance: WeightToleranceResult = useMemo(() => {
    return calculateWeightTolerance(contractMt, totalReceivedMt, unit);
  }, [contractMt, totalReceivedMt, unit]);

  // Last Arrival Date
  const lastArrivalDate = useMemo(() => {
    if (linkedFinalArrivals.length === 0) return new Date().toISOString().split('T')[0];
    const last = linkedFinalArrivals[linkedFinalArrivals.length - 1];
    return last.voucher_date || last.arrival_date || last.date || last.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];
  }, [linkedFinalArrivals]);

  // Fetch live Sauda Quality details, Satta Calculated Rates, Satta Differentials & Base Rates
  useEffect(() => {
    const fetchQualityAndRates = async () => {
      if (!supabase) return;
      try {
        const clean = (s: any) => String(s || '').trim().toUpperCase();
        const targetSauda = clean(saudaNo);
        const targetPo = clean(poNo);

        // Fetch from sauda_quality_details
        let sqDet: any[] = [];
        const { data: sMaster } = await supabase
          .from('sauda_master')
          .select('sauda_id, sauda_no, session')
          .or(`sauda_no.eq.${targetSauda},sauda_no.eq.${targetPo},session.eq.${targetPo}`)
          .maybeSingle();

        if (sMaster?.sauda_id) {
          const { data: sq } = await supabase
            .from('sauda_quality_details')
            .select('*')
            .eq('sauda_id', sMaster.sauda_id);
          if (sq && sq.length > 0) sqDet = sq;
        }

        if (sqDet.length === 0) {
          const { data: sqAll } = await supabase.from('sauda_quality_details').select('*');
          if (sqAll) {
            sqDet = sqAll.filter((q: any) => clean(q.sauda_no) === targetSauda || clean(q.sauda_no) === targetPo);
          }
        }

        const { data: scpDet } = await supabase.from('sauda_check_point_details').select('*').eq('po_no', poNo);
        const { data: pDet } = await supabase.from('purchase_detail_master').select('*').eq('po_no', poNo);

        const mergedQualities = [...(sqDet || []), ...(scpDet || []), ...(pDet || [])];
        setSaudaQualities(mergedQualities);

        // Fetch satta tables
        const { data: sCalcs } = await supabase.from('satta_calculated_rates').select('*').order('start_date', { ascending: false });
        const { data: sBases } = await supabase.from('satta_base_rates').select('*').order('start_date', { ascending: false });
        const { data: sDiffs } = await supabase.from('satta_differentials').select('*');

        if (sCalcs && sCalcs.length > 0) setLiveSattaRates(sCalcs);
        if (sBases && sBases.length > 0) setLiveBaseRates(sBases);
        if (sDiffs && sDiffs.length > 0) setLiveDifferentials(sDiffs);
      } catch (e) {
        console.error("Error fetching rate details for settlement:", e);
      }
    };

    fetchQualityAndRates();
  }, [poNo, saudaNo]);

  // Helper to get grade-wise Satta spot rate on lastArrivalDate
  const getGradeSattaRate = (gradeName: string): number => {
    const clean = (s: any) => String(s || '').trim().toUpperCase().replace(/[-\s]/g, '');
    const gClean = clean(gradeName);

    // 1. Try satta_calculated_rates
    const calcList = liveSattaRates.length > 0 ? liveSattaRates : sattaCalculatedRates;
    if (calcList && calcList.length > 0) {
      const matches = calcList.filter((s: any) => {
        const sGrade = clean(s.grade || s.grade_name || s.grade_code || '');
        return sGrade === gClean && String(s.start_date || '') <= lastArrivalDate;
      }).sort((a: any, b: any) => String(b.start_date || '').localeCompare(String(a.start_date || '')));

      if (matches.length > 0) {
        const val = Number(matches[0].final_rate || matches[0].rate || matches[0].calculated_rate || matches[0].base_rate || 0);
        if (val > 0) return val;
      }
    }

    // 2. Try satta_base_rates + satta_differentials
    const baseList = liveBaseRates.length > 0 ? liveBaseRates : sattaBaseRates;
    const baseMatches = (baseList || []).filter((b: any) => String(b.start_date || '') <= lastArrivalDate)
      .sort((a: any, b: any) => String(b.start_date || '').localeCompare(String(a.start_date || '')));
    const baseRec = baseMatches[0] || baseList[0];
    const baseRate = Number(baseRec?.base_rate || 17300);

    const diffRec = (liveDifferentials || []).find((df: any) => clean(df.grade || df.grade_name || '') === gClean);
    if (diffRec) {
      return baseRate + Number(diffRec.differential || 0);
    }

    // 3. Fallback standard grade-wise market differentials from spot base rate
    if (gClean === 'TD9') return baseRate;
    if (gClean === 'TD10') return baseRate - 500;
    if (gClean === 'TD11') return baseRate - 1000;
    if (gClean === 'TD12') return baseRate - 1500;
    if (gClean === 'TD8') return baseRate + 500;
    if (gClean === 'TD7') return baseRate + 1000;
    if (gClean === 'TD6') return baseRate + 1500;
    if (gClean === 'TD5') return baseRate + 2000;
    if (gClean === 'TD4') return baseRate + 2600;
    return baseRate;
  };

  // 4. Grade Consolidation Across Sauda Contract & All Arrivals
  const gradeBreakdown = useMemo(() => {
    const map: Record<string, {
      grade: string;
      marka: string;
      cropYear: string;
      totalBags: number;
      totalWeightMt: number;
      saudaRateQtl: number;
      sattaRateQtl: number;
      rateDiffQtl: number;
      arrivalCount: number;
      arrivals: string[];
    }> = {};

    const clean = (s: any) => String(s || '').trim().toUpperCase();
    const allKnownQualities = [...(saudaQualities || []), ...(allScpDetails || []).filter((d: any) => clean(d.po_no) === clean(poNo))];

    // First seed from Sauda Contract Qualities
    allKnownQualities.forEach((qd: any) => {
      const gName = clean(qd.quality || qd.grade_code || qd.grade_name || '');
      if (gName) {
        const rQtl = Number(qd.rs || qd.rate_qntl || qd.rate || 0);
        const marka = String(qd.marka || qd.marka_code || 'AS').trim().toUpperCase();
        const crop = String(qd.crop_year || qd.financial_year || '2026-27').trim();
        const sattaR = getGradeSattaRate(gName);

        if (!map[gName]) {
          map[gName] = {
            grade: gName,
            marka,
            cropYear: crop,
            totalBags: 0,
            totalWeightMt: 0,
            saudaRateQtl: rQtl,
            sattaRateQtl: sattaR,
            rateDiffQtl: Math.max(0, rQtl - sattaR),
            arrivalCount: 0,
            arrivals: []
          };
        } else if (rQtl > 0) {
          map[gName].saudaRateQtl = rQtl;
          map[gName].rateDiffQtl = Math.max(0, rQtl - map[gName].sattaRateQtl);
        }
      }
    });

    // Next, aggregate quantities from Final Arrivals
    linkedFinalArrivals.forEach((ar: any) => {
      const arNo = ar.mr_no || ar.final_arrival_no || `#FA-${ar.id?.slice(0, 5) || ''}`;
      let parsedGrid: any[] = [];
      if (ar.grid_details) {
        try {
          parsedGrid = typeof ar.grid_details === 'string' ? JSON.parse(ar.grid_details) : ar.grid_details;
        } catch (e) {
          parsedGrid = [];
        }
      }

      if (Array.isArray(parsedGrid) && parsedGrid.length > 0) {
        parsedGrid.forEach((row: any) => {
          const gName = clean(row.receipt_grade_name || row.challan_grade_name || row.item_name || row.grade || 'TD10');
          const marka = String(row.challan_marka_name || row.marka_name || row.marka || 'AS').trim().toUpperCase();
          const crop = String(row.crop_year || '2026-27').trim();
          const wtMt = Number(row.netto_pnto || row.netto_weight || row.weight_mt || (row.weight_qtl ? Number(row.weight_qtl) / 10 : 0)) || 0;
          const bags = Math.round(Number(row.quantity_rcpt || row.quantity || 0));

          if (!map[gName]) {
            // Find rate in allKnownQualities
            const matchDet = allKnownQualities.find((d: any) => clean(d.quality || d.grade_code || d.grade_name) === gName);
            let rQtl = matchDet ? Number(matchDet.rs || matchDet.rate_qntl || matchDet.rate || 0) : 0;
            if (rQtl === 0) {
              rQtl = gName === 'TD9' ? 19300 : (gName === 'TD10' ? 18800 : (gName === 'TD11' ? 18300 : 18800));
            }
            const sattaR = getGradeSattaRate(gName);

            map[gName] = {
              grade: gName,
              marka,
              cropYear: crop,
              totalBags: 0,
              totalWeightMt: 0,
              saudaRateQtl: rQtl,
              sattaRateQtl: sattaR,
              rateDiffQtl: Math.max(0, rQtl - sattaR),
              arrivalCount: 0,
              arrivals: []
            };
          }

          map[gName].totalBags += bags;
          map[gName].totalWeightMt += wtMt;
          map[gName].arrivalCount += 1;
          if (!map[gName].arrivals.includes(arNo)) {
            map[gName].arrivals.push(arNo);
          }
        });
      } else {
        const gName = 'TD10';
        const wtMt = Number(ar.weight_qtl || ar.weight || 0) / 10;
        const bags = Number(ar.total_packets || ar.quantity || 0);
        if (!map[gName]) {
          const sattaR = getGradeSattaRate(gName);
          map[gName] = {
            grade: gName,
            marka: 'AS',
            cropYear: '2026-27',
            totalBags: 0,
            totalWeightMt: 0,
            saudaRateQtl: 18800,
            sattaRateQtl: sattaR,
            rateDiffQtl: Math.max(0, 18800 - sattaR),
            arrivalCount: 0,
            arrivals: []
          };
        }
        map[gName].totalBags += bags;
        map[gName].totalWeightMt += wtMt;
        map[gName].arrivalCount += 1;
        if (!map[gName].arrivals.includes(arNo)) {
          map[gName].arrivals.push(arNo);
        }
      }
    });

    // Ensure fallback defaults if empty
    if (Object.keys(map).length === 0) {
      map['TD10'] = {
        grade: 'TD10',
        marka: 'AS',
        cropYear: '2026-27',
        totalBags: 0,
        totalWeightMt: 0,
        saudaRateQtl: 18800,
        sattaRateQtl: 16800,
        rateDiffQtl: 2000,
        arrivalCount: 0,
        arrivals: []
      };
    }

    // Sort: Delivered grades first (by totalWeightMt descending), then unreceived contracted grades
    const list = Object.values(map).sort((a, b) => {
      if (b.totalWeightMt !== a.totalWeightMt) {
        return b.totalWeightMt - a.totalWeightMt;
      }
      return a.grade.localeCompare(b.grade);
    });

    return list;
  }, [linkedFinalArrivals, saudaQualities, allScpDetails, poNo, lastArrivalDate, liveSattaRates, liveBaseRates, liveDifferentials]);

  // Primary Grade Selection (defaults to grade with largest received MT)
  const [selectedGrade, setSelectedGrade] = useState<string>('TD10');
  const [saudaRateQtl, setSaudaRateQtl] = useState<number>(18800);
  const [sattaRateQtl, setSattaRateQtl] = useState<number>(16800);
  const [rateBasis, setRateBasis] = useState<'rate_difference' | 'sauda_rate' | 'satta_rate' | 'manual'>('rate_difference');
  const [manualRateQtl, setManualRateQtl] = useState<number>(0);
  const [deductionQtyMode, setDeductionQtyMode] = useState<'over_tolerance' | 'over_contract' | 'custom'>('over_tolerance');
  const [customQtyMt, setCustomQtyMt] = useState<number>(0);
  const [settlementStatus, setSettlementStatus] = useState<'calculated' | 'approved' | 'settled'>('calculated');
  const [remarks, setRemarks] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);

  // Set default selected grade once breakdown is ready
  useEffect(() => {
    if (gradeBreakdown.length > 0) {
      // If current selectedGrade not in breakdown, pick the first
      const exists = gradeBreakdown.some(g => g.grade === selectedGrade);
      if (!exists) {
        setSelectedGrade(gradeBreakdown[0].grade);
      }
    }
  }, [gradeBreakdown]);

  // Sync Sauda & Satta rates when selected grade changes
  useEffect(() => {
    const curGrade = selectedGrade || (gradeBreakdown[0]?.grade ?? 'TD10');
    const matchedGradeObj = gradeBreakdown.find(g => g.grade === curGrade);
    
    let saudaRate = matchedGradeObj?.saudaRateQtl || 0;
    if (saudaRate === 0) {
      saudaRate = curGrade === 'TD9' ? 19300 : (curGrade === 'TD10' ? 18800 : (curGrade === 'TD11' ? 18300 : 18800));
    }
    setSaudaRateQtl(saudaRate);

    let sattaRate = matchedGradeObj?.sattaRateQtl || 0;
    if (sattaRate === 0) {
      sattaRate = getGradeSattaRate(curGrade);
    }
    setSattaRateQtl(sattaRate);
  }, [selectedGrade, gradeBreakdown, lastArrivalDate]);

  // Load existing saved deduction if available
  useEffect(() => {
    const loadSaved = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase
          .from('sauda_check_point_deductions')
          .select('*')
          .eq('po_no', poNo)
          .maybeSingle();

        if (data && !error) {
          setExistingRecordId(data.id);
          if (data.selected_grade) setSelectedGrade(data.selected_grade);
          if (data.sauda_rate) setSaudaRateQtl(Number(data.sauda_rate));
          if (data.satta_rate) setSattaRateQtl(Number(data.satta_rate));
          if (data.rate_basis) setRateBasis(data.rate_basis);
          if (data.status) setSettlementStatus(data.status);
          if (data.remarks) setRemarks(data.remarks);
          if (data.deduction_qty_mt) {
            setCustomQtyMt(Number(data.deduction_qty_mt));
            setDeductionQtyMode('custom');
          }
        }
      } catch (e) {
        console.error("Error loading saved deduction:", e);
      }
    };
    loadSaved();
  }, [poNo]);

  // Applicable Policy Rate (Rate Difference: A - B)
  const applicableRateDiffQtl = useMemo(() => {
    if (rateBasis === 'manual') return manualRateQtl;
    if (rateBasis === 'sauda_rate') return saudaRateQtl;
    if (rateBasis === 'satta_rate') return sattaRateQtl;
    // Policy default: Rate Difference (A - B) e.g., 19300 - 17300 = 2000 or 18800 - 16800 = 2000
    return Math.max(0, saudaRateQtl - sattaRateQtl);
  }, [rateBasis, saudaRateQtl, sattaRateQtl, manualRateQtl]);

  // Determine Deduction Quantity (in MT & Quintals)
  const deductionQtyMt = useMemo(() => {
    if (deductionQtyMode === 'custom') return Math.max(0, customQtyMt);
    if (deductionQtyMode === 'over_contract') return tolerance.excessOverContractMt;
    // Standard: Excess beyond allowable upper tolerance limit (e.g. 5.610 MT)
    return tolerance.excessOverToleranceMt;
  }, [deductionQtyMode, customQtyMt, tolerance]);

  const deductionQtyQtl = deductionQtyMt * 10;

  // Total Calculated Deduction Amount = Excess Delivery Quintal * Applicable Policy Rate (Difference)
  const totalDeductionAmount = useMemo(() => {
    return Math.round(deductionQtyQtl * applicableRateDiffQtl * 100) / 100;
  }, [deductionQtyQtl, applicableRateDiffQtl]);

  // Handle Save (Restricted to Level 4 and Admin)
  const handleSaveDeduction = async () => {
    if (!isAuthorizedToSave) {
      setSaveMessage("🔒 Permission Denied: Only Level 4 (L4) Officers and System Administrators are authorized to save Excess/Short settlements.");
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    const payload = {
      po_no: poNo,
      sauda_no: saudaNo,
      supplier: supplierName,
      broker: brokerName,
      contract_weight_mt: contractMt,
      tolerance_pct: tolerance.tolerancePct,
      tolerance_mt: tolerance.toleranceMt,
      tolerance_type: tolerance.toleranceBasis,
      min_acceptable_mt: tolerance.minAcceptableMt,
      max_acceptable_mt: tolerance.maxAcceptableMt,
      total_received_mt: totalReceivedMt,
      variation_type: tolerance.isOverDelivery ? 'excess' : (tolerance.isUnderDelivery ? 'short' : 'acceptable'),
      variation_mt: tolerance.excessOverToleranceMt || tolerance.shortUnderToleranceMt || 0,
      selected_grade: selectedGrade,
      sauda_rate: saudaRateQtl,
      satta_rate: sattaRateQtl,
      rate_difference: applicableRateDiffQtl,
      applicable_rate: applicableRateDiffQtl,
      rate_basis: rateBasis,
      deduction_qty_mt: deductionQtyMt,
      deduction_qty_qtl: deductionQtyQtl,
      deduction_amount: totalDeductionAmount,
      status: settlementStatus,
      remarks: remarks,
      arrival_numbers: linkedFinalArrivals.map(a => a.mr_no || a.final_arrival_no).filter(Boolean).join(', '),
      grade_breakdown: gradeBreakdown,
      approved_by: userCtx?.userName || 'Admin L4',
      approval_level: userLevel || userRole || 'L4',
      updated_at: new Date().toISOString()
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

        // Also update purchase_master and sauda_check_point
        await supabase
          .from('sauda_check_point')
          .update({
            excess_short_deduction: totalDeductionAmount,
            excess_short_status: settlementStatus
          })
          .eq('po_no', poNo);

        await supabase
          .from('purchase_master')
          .update({
            excess_short_deduction: totalDeductionAmount,
            excess_short_status: settlementStatus
          })
          .eq('po_no', poNo);
      } else {
        await dbModule.insert('sauda_check_point_deductions', payload);
      }

      setSaveMessage("✓ Excess / Short Settlement calculation saved and recorded successfully!");
      if (onSaveSuccess) onSaveSuccess();
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      console.error("Error saving deduction:", err);
      setSaveMessage("Error saving deduction: " + (err.message || 'Unknown database error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden my-auto text-slate-900">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between border-b border-slate-700 select-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black uppercase tracking-wide">
                  Excess / Short Weight & Rate Settlement
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-amber-950 uppercase shadow-xs">
                  Sauda Policy Engine
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                P.O / Sauda: <strong className="text-white font-mono">{poNo}</strong> | Supplier: <strong className="text-amber-200">{supplierName}</strong> | Broker: <strong className="text-slate-200">{brokerName}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Print Settlement Sheet"
            >
              <Printer className="w-3.5 h-3.5" /> Print Slip
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50">
          
          {/* Notification banner */}
          {saveMessage && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-xs ${
              saveMessage.startsWith('✓') 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {saveMessage.startsWith('✓') ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{saveMessage}</span>
            </div>
          )}

          {/* Section 1: Sauda Tolerance & Acceptance Verification Matrix */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  1. Sauda Contract & Tolerance Acceptance Analysis
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Rule: ±3% vs ±1,500 KG (Whichever is Lower)
              </span>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* Card 1: Contract Weight */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Sauda Contract</span>
                <span className="text-lg font-black text-slate-900 font-mono">{contractMt.toFixed(3)}</span>
                <span className="text-[10px] font-bold text-slate-600 ml-1">MT</span>
                <p className="text-[9px] text-slate-400 mt-0.5">Unit: {unit}</p>
              </div>

              {/* Card 2: Tolerance Rule */}
              <div className="bg-indigo-50/60 rounded-lg p-3 border border-indigo-100">
                <span className="text-[10px] font-bold uppercase text-indigo-700 block">Tolerance Applied</span>
                <span className="text-lg font-black text-indigo-950 font-mono">±{tolerance.toleranceMt.toFixed(3)}</span>
                <span className="text-[10px] font-bold text-indigo-800 ml-1">MT</span>
                <p className="text-[9px] text-indigo-700 mt-0.5 font-semibold">
                  {tolerance.toleranceBasis} (3% = {tolerance.pct3Mt.toFixed(3)} MT)
                </p>
              </div>

              {/* Card 3: Allowable Range */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Allowable Range</span>
                <span className="text-xs font-black text-slate-800 font-mono block mt-1">
                  {tolerance.minAcceptableMt.toFixed(3)} – {tolerance.maxAcceptableMt.toFixed(3)}
                </span>
                <p className="text-[9px] text-slate-500 mt-1 font-medium">Upper limit: {tolerance.maxAcceptableMt.toFixed(3)} MT</p>
              </div>

              {/* Card 4: Total Received Weight */}
              <div className="bg-emerald-50/60 rounded-lg p-3 border border-emerald-100">
                <span className="text-[10px] font-bold uppercase text-emerald-800 block">Final M.R Received</span>
                <span className="text-lg font-black text-emerald-950 font-mono">{totalReceivedMt.toFixed(3)}</span>
                <span className="text-[10px] font-bold text-emerald-800 ml-1">MT</span>
                <p className="text-[9px] text-emerald-700 mt-0.5 font-medium">{linkedFinalArrivals.length} Final Arrival Vouchers</p>
              </div>

              {/* Card 5: Result / Variation */}
              <div className={`rounded-lg p-3 border ${
                tolerance.isOverDelivery 
                  ? 'bg-amber-50 border-amber-200 text-amber-950' 
                  : (tolerance.isUnderDelivery ? 'bg-rose-50 border-rose-200 text-rose-950' : 'bg-emerald-50 border-emerald-200 text-emerald-950')
              }`}>
                <span className="text-[10px] font-bold uppercase block opacity-80">
                  {tolerance.isOverDelivery ? 'Excess Delivery' : (tolerance.isUnderDelivery ? 'Short Delivery' : 'Tolerance Status')}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  {tolerance.isOverDelivery ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                      <span className="text-base font-black font-mono">+{tolerance.excessOverToleranceMt.toFixed(3)} MT</span>
                    </>
                  ) : tolerance.isUnderDelivery ? (
                    <>
                      <TrendingDown className="w-4 h-4 text-rose-600" />
                      <span className="text-base font-black font-mono">-{tolerance.shortUnderToleranceMt.toFixed(3)} MT</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-black uppercase">Within Bounds</span>
                    </>
                  )}
                </div>
                <p className="text-[9px] font-semibold mt-0.5 opacity-90">
                  {tolerance.isOverDelivery 
                    ? `Over Upper Limit (+${tolerance.excessOverContractMt.toFixed(3)} MT over Sauda)` 
                    : (tolerance.isUnderDelivery ? 'Below Lower Limit' : 'Passes Sauda Specs')}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Linked Final Arrivals Breakdown */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  2. Linked Final Arrivals Breakdown ({linkedFinalArrivals.length} Receipts)
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                Last Arrival Date: <strong className="text-slate-800">{lastArrivalDate}</strong>
              </span>
            </div>

            {linkedFinalArrivals.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs italic bg-slate-50 rounded-lg">
                No Final Arrival vouchers linked to PO #{poNo} yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase text-[9.5px]">
                    <tr>
                      <th className="p-2 border-r">Date</th>
                      <th className="p-2 border-r">Arrival #</th>
                      <th className="p-2 border-r">Lorry Number</th>
                      <th className="p-2 border-r text-center">Unit</th>
                      <th className="p-2 border-r text-right">Packets/Bales</th>
                      <th className="p-2 border-r text-right">Weight (MT)</th>
                      <th className="p-2">Grade / Quality Contents</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[10.5px]">
                    {linkedFinalArrivals.map((ar: any, idx: number) => {
                      const wtMt = Number(ar.weight_qtl || ar.weight || 0) / 10;
                      let parsedGrid: any[] = [];
                      if (ar.grid_details) {
                        try {
                          parsedGrid = typeof ar.grid_details === 'string' ? JSON.parse(ar.grid_details) : ar.grid_details;
                        } catch (e) {}
                      }
                      const gradeSummary = parsedGrid.map((g: any) => 
                        `${g.receipt_grade_name || g.item_name || 'TD10'} (${Number(g.netto_pnto || 0).toFixed(3)} MT)`
                      ).join(', ') || 'TD10';

                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 border-r font-sans font-medium text-slate-600">
                            {ar.voucher_date || ar.arrival_date || ar.created_at?.split('T')[0] || '--'}
                          </td>
                          <td className="p-2 border-r font-bold text-indigo-950">
                            {ar.mr_no || ar.final_arrival_no || `#FA-${ar.id?.slice(0, 5)}`}
                          </td>
                          <td className="p-2 border-r font-bold text-slate-800">
                            {ar.lorry_number || ar.lorry_no || '--'}
                          </td>
                          <td className="p-2 border-r text-center font-sans text-slate-600">
                            {ar.unit_name || ar.unit || unit}
                          </td>
                          <td className="p-2 border-r text-right font-bold text-slate-800">
                            {ar.total_packets || ar.quantity || 0}
                          </td>
                          <td className="p-2 border-r text-right font-black text-emerald-800">
                            {wtMt.toFixed(3)} MT
                          </td>
                          <td className="p-2 text-slate-700 font-sans text-[10px]">
                            {gradeSummary}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 font-black text-[10.5px] border-t border-slate-200">
                    <tr>
                      <td colSpan={4} className="p-2 text-right uppercase font-sans text-slate-600">Total Final Arrivals:</td>
                      <td className="p-2 border-r text-right font-mono text-slate-900">
                        {linkedFinalArrivals.reduce((sum, a) => sum + (Number(a.total_packets || a.quantity || 0)), 0)}
                      </td>
                      <td className="p-2 border-r text-right font-mono text-emerald-950">
                        {totalReceivedMt.toFixed(3)} MT
                      </td>
                      <td className="p-2 text-[10px] text-slate-500 font-sans font-normal">
                        ({(totalReceivedMt * 10).toFixed(2)} Qtl)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Grade-Wise Received Summary & Deduction Grade Designation */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  3. Grade-Wise Received Summary & Deduction Grade Designation
                </h3>
              </div>
              <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Auto-Designated: Grade with Maximum Received Qty ({gradeBreakdown[0]?.grade || 'TD10'})
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase text-[9.5px]">
                  <tr>
                    <th className="p-2 border-r text-center w-12">Select</th>
                    <th className="p-2 border-r">Grade Name</th>
                    <th className="p-2 border-r text-center">Marka / Crop</th>
                    <th className="p-2 border-r text-right">Total Bags</th>
                    <th className="p-2 border-r text-right">Total Received (MT)</th>
                    <th className="p-2 border-r text-right">% of Delivery</th>
                    <th className="p-2 border-r text-right">Sauda Rate (₹/Qtl)</th>
                    <th className="p-2 border-r text-right bg-indigo-50/50 text-indigo-950">Last Delivery Date Rate (₹/Qtl)</th>
                    <th className="p-2 border-r text-right text-amber-900 bg-amber-50/60">Rate Diff (₹/Qtl)</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[10.5px]">
                  {gradeBreakdown.map((g, idx) => {
                    const isSelected = selectedGrade === g.grade;
                    const pctOfTotal = totalReceivedMt > 0 ? (g.totalWeightMt / totalReceivedMt) * 100 : 0;
                    const diff = Math.max(0, g.saudaRateQtl - g.sattaRateQtl);

                    return (
                      <tr 
                        key={idx} 
                        onClick={() => setSelectedGrade(g.grade)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-50/70 border-l-4 border-l-amber-500' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-2 border-r text-center">
                          <input 
                            type="radio" 
                            name="selectedDeductionGrade" 
                            checked={isSelected}
                            onChange={() => setSelectedGrade(g.grade)}
                            className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-2 border-r font-bold text-slate-900 font-sans">
                          {g.grade}
                          {idx === 0 && g.totalWeightMt > 0 && (
                            <span className="ml-2 px-1.5 py-0.2 rounded text-[8px] bg-emerald-100 text-emerald-800 font-bold uppercase">
                              Major Grade
                            </span>
                          )}
                        </td>
                        <td className="p-2 border-r text-center text-slate-600 font-sans">
                          {g.marka} ({g.cropYear})
                        </td>
                        <td className="p-2 border-r text-right font-bold text-slate-800">
                          {g.totalBags}
                        </td>
                        <td className="p-2 border-r text-right font-black text-indigo-950">
                          {g.totalWeightMt.toFixed(3)} MT
                        </td>
                        <td className="p-2 border-r text-right font-bold text-slate-600">
                          {pctOfTotal.toFixed(1)}%
                        </td>
                        <td className="p-2 border-r text-right font-black text-slate-900">
                          ₹{g.saudaRateQtl.toLocaleString()}
                        </td>
                        <td className="p-2 border-r text-right font-bold text-indigo-900">
                          ₹{g.sattaRateQtl.toLocaleString()}
                        </td>
                        <td className="p-2 border-r text-right font-black text-amber-900 bg-amber-50/30">
                          ₹{diff.toLocaleString()}
                        </td>
                        <td className="p-2 text-center font-sans">
                          {isSelected ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                              Deduction Target ✓
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 uppercase font-medium">
                              Secondary
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Settlement & Deduction Calculation Engine */}
          <div className="bg-gradient-to-br from-amber-50/40 via-white to-slate-50 rounded-xl p-5 border-2 border-amber-300 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-amber-200 pb-2">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-700" />
                <h3 className="text-sm font-black uppercase text-amber-950 tracking-wider">
                  4. Excess / Short Settlement & Deduction Calculator
                </h3>
              </div>
              <span className="text-[10px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                Target Grade: <strong className="font-mono">{selectedGrade}</strong>
              </span>
            </div>

            {/* Rate Comparison Box: A - B Formula */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-amber-200 shadow-2xs">
              
              {/* Box 1: Sauda Agreed Rate */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500 block">
                  A. Sauda Contract Rate ({selectedGrade})
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400 font-sans">₹</span>
                  <input 
                    type="number"
                    value={saudaRateQtl || ''}
                    onChange={(e) => setSaudaRateQtl(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-sm font-black font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-slate-50"
                    placeholder="e.g. 19300"
                  />
                  <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">/ Qtl</span>
                </div>
                <p className="text-[9px] text-slate-500 font-medium">Sauda Rate: ₹{saudaRateQtl.toLocaleString()} / Quintal</p>
              </div>

              {/* Box 2: Last Arrival Satta Market Rate */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center justify-between">
                  <span>B. Last Arrival Satta Rate</span>
                  <span className="text-[9px] font-normal text-indigo-600 font-mono">({lastArrivalDate})</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400 font-sans">₹</span>
                  <input 
                    type="number"
                    value={sattaRateQtl || ''}
                    onChange={(e) => setSattaRateQtl(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-sm font-black font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-slate-50"
                    placeholder="e.g. 17300"
                  />
                  <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">/ Qtl</span>
                </div>
                <p className="text-[9px] text-slate-500 font-medium">Satta Rate: ₹{sattaRateQtl.toLocaleString()} / Quintal</p>
              </div>

              {/* Box 3: Applicable Policy Rate (A - B) */}
              <div className="bg-amber-100/60 p-3 rounded-lg border border-amber-300 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-amber-950">Applicable Policy Rate</span>
                  <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 uppercase">
                    Rate Diff (A - B) ✓
                  </span>
                </div>
                <div className="my-1">
                  <span className="text-xl font-black text-amber-950 font-mono">
                    ₹{applicableRateDiffQtl.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-amber-800 ml-1">/ Qtl</span>
                </div>
                <p className="text-[8.5px] font-bold text-amber-900 leading-tight">
                  Rule: Sauda Rate (₹{saudaRateQtl.toLocaleString()}) - Satta Rate (₹{sattaRateQtl.toLocaleString()}) = ₹{applicableRateDiffQtl.toLocaleString()}/Qtl
                </p>
              </div>
            </div>

            {/* Deduction Quantity Selection & Computed Deduction Amount */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-amber-200 shadow-2xs">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-600 block">
                  Excess Delivery Deduction Basis:
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDeductionQtyMode('over_tolerance')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      deductionQtyMode === 'over_tolerance' 
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs' 
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
                    }`}
                  >
                    <span>Excess Over Tolerance (+{tolerance.excessOverToleranceMt.toFixed(3)} MT / {(tolerance.excessOverToleranceMt * 10).toFixed(2)} Qtl)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeductionQtyMode('over_contract')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      deductionQtyMode === 'over_contract' 
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs' 
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
                    }`}
                  >
                    <span>Excess Over Contract (+{tolerance.excessOverContractMt.toFixed(3)} MT / {(tolerance.excessOverContractMt * 10).toFixed(2)} Qtl)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeductionQtyMode('custom');
                      if (!customQtyMt) setCustomQtyMt(tolerance.excessOverToleranceMt);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      deductionQtyMode === 'custom' 
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs' 
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
                    }`}
                  >
                    Custom MT
                  </button>
                </div>

                {deductionQtyMode === 'custom' && (
                  <div className="pt-1 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Custom Deduction Qty:</span>
                    <input 
                      type="number" 
                      step="0.001"
                      value={customQtyMt || ''}
                      onChange={(e) => setCustomQtyMt(Number(e.target.value))}
                      className="w-32 px-2.5 py-1 text-sm font-black font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-slate-500">MT ({(customQtyMt * 10).toFixed(2)} Qtl)</span>
                  </div>
                )}
              </div>

              {/* Computed Deduction Amount Display */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-xl flex flex-col justify-between shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    Total Calculated Deduction Amount
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">
                    {deductionQtyMt.toFixed(3)} MT ({deductionQtyQtl.toFixed(2)} Qtl)
                  </span>
                </div>
                <div className="my-1">
                  <span className="text-2xl font-black font-mono text-white">
                    ₹{totalDeductionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-[9.5px] text-slate-300 font-mono">
                  Calculation: {deductionQtyQtl.toFixed(2)} Qtl (Excess Delivery) × ₹{applicableRateDiffQtl.toLocaleString()}/Qtl (Rate Diff)
                </div>
              </div>
            </div>

            {/* Remarks & Status Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Settlement Remarks / Voucher Accounting Notes:
                </label>
                <input 
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={`e.g. Excess weight ${deductionQtyMt.toFixed(3)} MT (${deductionQtyQtl.toFixed(2)} Qtl) deducted at ₹${applicableRateDiffQtl}/Qtl rate difference for ${selectedGrade}.`}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Settlement Status:
                </label>
                <select
                  value={settlementStatus}
                  onChange={(e: any) => setSettlementStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="calculated">Calculated (Pending Review)</option>
                  <option value="approved">Approved by Manager (L4)</option>
                  <option value="settled">Settled & Deducted from Bill</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Authorization Banner & Controls */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
          <div className="text-[11px] flex items-center gap-2">
            {isAuthorizedToSave ? (
              <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Authorized: <strong>{userCtx?.userName || 'User'} ({userLevel || userRole || 'L4/Admin'})</strong> — Eligible to commit settlements.
              </span>
            ) : (
              <span className="text-amber-800 font-bold flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-600" />
                Role Restriction: Only <strong>Level 4 (L4)</strong> and <strong>Admin</strong> users can save settlements.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              Cancel / Close
            </button>
            <button
              type="button"
              onClick={handleSaveDeduction}
              disabled={isSaving || !isAuthorizedToSave}
              title={!isAuthorizedToSave ? "Requires Level 4 or Admin privileges to commit to database" : "Save & record deduction"}
              className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95 ${
                isAuthorizedToSave 
                  ? 'bg-amber-600 hover:bg-amber-700 disabled:opacity-50' 
                  : 'bg-slate-400 cursor-not-allowed opacity-60'
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving Settlement...' : (existingRecordId ? 'Update Settlement' : 'Save & Record Deduction')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
export default ExcessShortSettlementModal;

