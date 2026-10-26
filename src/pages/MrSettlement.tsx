import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLiveAutoRefresh } from "../hooks/useLiveAutoRefresh";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";
import { 
  AlertTriangle,
  CheckCircle2,
  ArrowLeft
} from "lucide-react";
import LegacyLayout from "../components/LegacyLayout";
import { supabase } from "../lib/supabase";
import { dbModule } from "../services/dbModule";
import { cn, sanitizeCsvData } from "../lib/utils";
import { enforceEditOrDeletePermission, canEditOrDelete, canViewCompletedData, isL5OrAdmin } from "../lib/permissions";
import { findMatchedPoItem, parseGridOrItems, getColSettRate, calculateSattaDeduction } from "../utils/paymentCalculations";
import { setCachedSattaDiffs, getCachedSattaDiffs } from "../services/sattaCalculation";
import {
  resolveGradeName,
  resolveAgencyName,
  resolveMarkaName,
  resolveAreaName,
  buildSettlementCol,
  buildAlignedSettlementColumns,
  fetchPoAndItemDetails,
  fetchSaudaCheckpointDeduction,
  isLastMrForPo
} from "../services/settlementService";

import {
  SettlementDeductionItem,
  SettlementMaster,
  SettlementDetailColumn,
  emptyDetailColumn,
  getColWtMt,
  getColAmount,
  getEffectiveColSettRate,
  calculateWeightedRatePerMT,
  initialMaster,
  parseDateOnly,
  formatToInputDate,
  isApmcExemptArea,
  isSettlementApmcExempt
} from "../types/settlement.types";

export {
  getColWtMt,
  getColAmount,
  getEffectiveColSettRate,
  calculateWeightedRatePerMT,
  emptyDetailColumn,
  initialMaster,
  parseDateOnly,
  formatToInputDate,
  isApmcExemptArea,
  isSettlementApmcExempt
};
export type {
  SettlementDeductionItem,
  SettlementMaster,
  SettlementDetailColumn
};

import SettlementRegisterView from "../components/settlement/SettlementRegisterView";
import SettlementMasterHeaderCard from "../components/settlement/SettlementMasterHeaderCard";
import SettlementMetricsRibbon from "../components/settlement/SettlementMetricsRibbon";
import SettlementValuationCard from "../components/settlement/SettlementValuationCard";
import SettlementSpecificationsGrid from "../components/settlement/SettlementSpecificationsGrid";
import SettlementPrintModal from "../components/settlement/SettlementPrintModal";
import SettlementAuditOverwriteModal from "../components/settlement/SettlementAuditOverwriteModal";

export function parseDateToObj(dateVal: any): Date | null {
  if (!dateVal) return null;
  const str = String(dateVal).trim();
  if (!str) return null;

  // DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(str)) {
    const parts = str.split(/[-/]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    const parts = str.split(/[-/]/);
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function calculateDeliveryDelayDays(deliveryToDateVal: any, arrivalDateVal: any): number {
  const toDate = parseDateToObj(deliveryToDateVal);
  const arrDate = parseDateToObj(arrivalDateVal);
  if (!toDate || !arrDate) return 0;

  toDate.setHours(0, 0, 0, 0);
  arrDate.setHours(0, 0, 0, 0);

  if (arrDate.getTime() <= toDate.getTime()) return 0;

  const diffMs = arrDate.getTime() - toDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export default function MrSettlement({ onClose, onLogEvent }: { onClose?: () => void; onLogEvent?: (event: string, details: string) => void }) {
  // Page switching & Lists
  const [viewMode, setViewMode] = useState<'dashboard' | 'entry'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Auto-populated dropdown lists
  const [settledList, setSettledList] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  
  // Real-time PO fields & statistics tracking
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [selectedPoNo, setSelectedPoNo] = useState<string>('');
  const [selectedPoData, setSelectedPoData] = useState<any>(null);
  const [poStats, setPoStats] = useState<{
    contractQty: number;
    receivedQty: number;
    settledQty: number;
    pendingQty: number;
    customReceivedQty: number;
    pendingReceivedQty: number;
    dbPendingReceived: number;
  } | null>(null);

  const [customSettlementRecords, setCustomSettlementRecords] = useState<any[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [showSuccessAnim, setShowSuccessAnim] = useState<boolean>(false);
  const [paymentList, setPaymentList] = useState<any[]>([]);
  const [paymentValidationInfo, setPaymentValidationInfo] = useState<{ mrNo: string; poNo: string; paidAmount: number; voucherNo: string } | null>(null);
  
  // Overwrite Authorization / Audit modal state
  const [showAuditOverwriteModal, setShowAuditOverwriteModal] = useState<boolean>(false);
  const [auditOverwriteInfo, setAuditOverwriteInfo] = useState<{
    activeWeight: number;
    allowedWeight: number;
    selectedPoNo: string;
    targetMrNo: string;
  } | null>(null);

  const syncPaymentModuleData = async (mrNo: string, poNo: string): Promise<{ totalPaid: number; payDetails: any[] }> => {
    try {
      let payRecords: any[] = [];
      let payDetails: any[] = [];

      if (supabase) {
        try {
          const res = await supabase.from('payment_master').select('*');
          if (res.data) payRecords = res.data;
        } catch (e) {}
        try {
          const resDet = await supabase.from('payment_details').select('*');
          if (resDet.data) payDetails = resDet.data;
        } catch (e) {}
      }
      const payments = payRecords && payRecords.length > 0 ? payRecords : await dbModule.fetchAll('payment_master').catch(() => []);
      const details = payDetails && payDetails.length > 0 ? payDetails : await dbModule.fetchAll('payment_details').catch(() => []);
      setPaymentList(payments);

      const cleanStr = (s: string) => (s || '').replace(/#/g, '').replace(/[\s\-\/]/g, '').trim().toLowerCase();
      const extractCoreMrToken = (s: string) => {
        const raw = String(s || '').replace(/#/g, '').trim().toUpperCase();
        const withoutPrefix = raw.replace(/^(MR|AMAD|TEMP|FA|BJCL)[-\/\s]*/i, '').replace(/^20\d{2}-20\d{2}\//, '');
        const digits = withoutPrefix.replace(/[^0-9]/g, '').replace(/^0+/, '');
        return digits || cleanStr(s);
      };
      const exactMrMatch = (a: string, b: string) => {
        const ca = cleanStr(a);
        const cb = cleanStr(b);
        if (!ca || !cb) return false;
        if (ca === cb) return true;
        const da = extractCoreMrToken(a);
        const db = extractCoreMrToken(b);
        return Boolean(da && db && da === db);
      };
      const exactPoMatch = (a: string, b: string) => {
        const ca = cleanStr(a);
        const cb = cleanStr(b);
        if (!ca || !cb) return false;
        return ca === cb;
      };

      const targetMrClean = cleanStr(mrNo);
      const targetPoClean = cleanStr(poNo);
      const targetPoRaw = (poNo || '').replace(/#/g, '').trim().toLowerCase();

      // Collect voucher numbers linked via payment_details table matching target MR strictly
      const vouchersFromDetails = new Set<string>();
      const matchedDetailsList: any[] = [];
      if (targetMrClean) {
        details.forEach((d: any) => {
          if (exactMrMatch(d.mr_no, mrNo)) {
            if (d.voucher_no) vouchersFromDetails.add(d.voucher_no);
            matchedDetailsList.push(d);
          }
        });
      }

      // Priority 1: Match payments specifically linked to this MR (exact token match only)
      let matchingPayments: any[] = [];
      if (targetMrClean) {
        matchingPayments = payments.filter((p: any) => {
          const isVoucherMatch = Boolean(p.voucher_no && vouchersFromDetails.has(p.voucher_no));
          return (
            isVoucherMatch ||
            exactMrMatch(p.mr_no, mrNo) ||
            exactMrMatch(p.arrival_no, mrNo) ||
            exactMrMatch(p.payable_bill_no, mrNo) ||
            exactMrMatch(p.reference_no, mrNo)
          );
        });
      }

      // Priority 2: Fallback to exact PO-matched payments if no MR-specific payments found
      if (matchingPayments.length === 0 && (targetPoClean || targetPoRaw)) {
        matchingPayments = payments.filter((p: any) => {
          const pPoRaw = (p.po_no || '').replace(/#/g, '').trim().toLowerCase();
          return (
            (targetPoRaw && pPoRaw === targetPoRaw) ||
            exactPoMatch(p.po_no, poNo)
          );
        });
      }

      // Also gather payment_details from matched payments if not already collected
      if (matchingPayments.length > 0 && matchedDetailsList.length === 0) {
        const matchedVoucherSet = new Set(matchingPayments.map(p => p.voucher_no).filter(Boolean));
        details.forEach((d: any) => {
          if (d.voucher_no && matchedVoucherSet.has(d.voucher_no)) {
            matchedDetailsList.push(d);
          }
        });
      }

      // Ensure satta differentials are cached for Sett Rate calculation
      if (supabase && getCachedSattaDiffs().length === 0) {
        try {
          const { data: sattaRes } = await supabase.from('satta_differentials').select('*');
          if (sattaRes && sattaRes.length > 0) setCachedSattaDiffs(sattaRes);
        } catch (e) {}
      }

      // Also live-update detailCols with Payment Operations -> Details fields (preserving original PO rate in rate_value!)
      if (matchedDetailsList.length > 0) {
        setDetailCols(prevCols => prevCols.map(col => {
          const hasData = Boolean(col.grade || col.quantity || col.arr_qty_wt);
          if (!hasData) return col;
          const match = matchedDetailsList.find(pd => Number(pd.col_index) === col.col_index) ||
                        matchedDetailsList.find(pd => {
                          const pdGrade = (resolveGradeName(pd.grade, gradeMasterList) || String(pd.grade || '')).trim().toUpperCase();
                          const colGrade = (resolveGradeName(col.grade, gradeMasterList) || String(col.grade || '')).trim().toUpperCase();
                          return Boolean(pdGrade && colGrade && pdGrade === colGrade);
                        });
          if (match) {
            const origRate = Number(match.rate_value) > 0 ? Number(match.rate_value) : Number(col.rate_value || 0);
            const prem = Number(match.premium) > 0 ? Number(match.premium) : Number(col.premium || 0);
            const settPct = match.sett_pct !== undefined && match.sett_pct !== null && Number(match.sett_pct) > 0
              ? Number(match.sett_pct)
              : (Number(col.gd_sett) > 0 ? Number(col.gd_sett) : Number(col.gd_claim || 0));

            const sattaObj = calculateSattaDeduction(
              col.grade,
              origRate,
              settPct,
              getCachedSattaDiffs(),
              gradeMasterList.map((g: any) => ({ code: g.grade_code || g.code || g.id, name: g.grade_name || g.name || g.grade })),
              col.po_items,
              match.lower_grade || col.lower_grade,
              match.lower_grade_rate ?? col.lower_grade_rate,
              prevCols
            );

            const pdDedRate = Number(match.deduction_rate) > 0 ? Number(match.deduction_rate) : sattaObj.deduction;
            const pdSettRate = (match.sett_rate !== undefined && match.sett_rate !== null && Number(match.sett_rate) > 0)
              ? Number(match.sett_rate)
              : (origRate > 0 ? Number((origRate + prem - pdDedRate).toFixed(2)) : 0);

            const wtMt = getColWtMt(col);
            const qtyQtl = Number((wtMt * 10).toFixed(2));
            const colAmt = Number((qtyQtl * pdSettRate).toFixed(2));

            return {
              ...col,
              rate_value: origRate,
              premium: prem,
              sett_pct: settPct,
              gd_sett: settPct,
              deduction_rate: pdDedRate,
              sett_rate: pdSettRate,
              quantity_qtl: qtyQtl,
              amount: colAmt,
              lower_grade: match.lower_grade || col.lower_grade || sattaObj.targetGradeName,
              target_lower_grade: sattaObj.targetGradeName,
              lower_grade_rate: match.lower_grade_rate ?? col.lower_grade_rate ?? sattaObj.lowerRate,
              grade_diff: sattaObj.diff
            };
          }
          return col;
        }));
      }

      if (matchingPayments.length > 0) {
        const totalPaid = matchingPayments.reduce((sum, p) => sum + Number(p.paid_amount !== undefined && p.paid_amount !== null ? p.paid_amount : (p.total_amount || 0)), 0);
        const firstMatch = matchingPayments[0];
        setPaymentValidationInfo({
          mrNo: firstMatch.mr_no || mrNo,
          poNo: firstMatch.po_no || poNo,
          paidAmount: totalPaid,
          voucherNo: matchingPayments.map(p => p.voucher_no || 'N/A').join(', ')
        });
        setMasterData(prev => ({
          ...prev,
          final_on_ac_adv: totalPaid
        }));
        return { totalPaid, payDetails: matchedDetailsList };
      } else {
        setPaymentValidationInfo(null);
        return { totalPaid: 0, payDetails: matchedDetailsList };
      }
    } catch (e) {
      console.warn("Payment module sync error:", e);
      return { totalPaid: 0, payDetails: [] };
    }
  };

  // Function to calculate 'pending_received' quantity by comparing contract against received sums
  const calculatePendingReceived = (contractQty: number, totalDelivered: number): number => {
    return Math.max(0, Number((contractQty - totalDelivered).toFixed(3)));
  };

  // Form State
  const [isEdit, setIsEdit] = useState(false);
  const [masterData, setMasterData] = useState<SettlementMaster>(initialMaster());
  const [saudaDeductionRecord, setSaudaDeductionRecord] = useState<any>(null);
  const [detailCols, setDetailCols] = useState<SettlementDetailColumn[]>([
    emptyDetailColumn(1), emptyDetailColumn(2), emptyDetailColumn(3), emptyDetailColumn(4)
  ]);
  const [showAllSpecCols, setShowAllSpecCols] = useState(false);
  const [showAllDeductionCols, setShowAllDeductionCols] = useState(false);

  // Helper to calculate total claim percentage for a column
  const getColTotalClaim = (col: SettlementDetailColumn | undefined): number => {
    if (!col) return 0;
    const isColActive = (Number(col.quantity) || 0) > 0 || (Number(col.arr_qty_wt) || 0) > 0 || (Number(col.wt_quantity) || 0) > 0;
    if (!isColActive) return 0;
    const gdVal = Number(col.gd_sett) > 0 ? Number(col.gd_sett) : Number(col.gd_claim || 0);
    const mVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
    const dVal = Number(col.dust_sett) > 0 ? Number(col.dust_sett) : Number(col.dust_claim || 0);
    const nVal = Number(col.ncv_sett) > 0 ? Number(col.ncv_sett) : Number(col.ncv_claim || 0);
    return Number((gdVal + mVal + dVal + nVal).toFixed(2));
  };

  // Condition: Only show Settlement Columns if 'Arr. Qty/Wt' is not null / > 0
  const visibleSpecCols = useMemo(() => {
    if (showAllSpecCols) return [1, 2, 3, 4];
    const active = [1, 2, 3, 4].filter(idx => {
      const col = detailCols[idx - 1];
      return col && col.arr_qty_wt !== null && col.arr_qty_wt !== undefined && Number(col.arr_qty_wt) > 0;
    });
    return active.length > 0 ? active : [1, 2, 3, 4];
  }, [detailCols, showAllSpecCols]);

  // Condition: In Active Deductions / Claims Audit Sheet, if Total Claim is 0 then do NOT show in column
  const visibleDeductionCols = useMemo(() => {
    if (showAllDeductionCols) return [1, 2, 3, 4];
    return [1, 2, 3, 4].filter(idx => {
      const col = detailCols[idx - 1];
      const hasArrWt = col && col.arr_qty_wt !== null && col.arr_qty_wt !== undefined && Number(col.arr_qty_wt) > 0;
      const totalClaim = getColTotalClaim(col);
      const poVal = Number(col?.po_grade_sett) > 0 ? Number(col?.po_grade_sett) : Number(col?.po_grade_claim || 0);
      return hasArrWt && (totalClaim > 0 || poVal > 0);
    });
  }, [detailCols, showAllDeductionCols]);

  const [showViewModal, setShowViewModal] = useState(false);
  const [viewModalData, setViewModalData] = useState<{
    master: SettlementMaster;
    details: SettlementDetailColumn[];
  } | null>(null);

  const handleOpenViewSettlement = async (targetMrNo: string) => {
    try {
      setLoading(true);
      let foundMaster: any = null;
      let foundDetails: any[] = [];

      if (supabase) {
        try {
          const { data: mData } = await supabase
            .from('mr_settlement_master')
            .select('*')
            .eq('mr_no', targetMrNo)
            .maybeSingle();
          if (mData) foundMaster = mData;

          const { data: dData } = await supabase
            .from('mr_settlement_detail')
            .select('*')
            .eq('mr_no', targetMrNo)
            .order('col_index', { ascending: true });
          if (dData && dData.length > 0) foundDetails = dData;
        } catch (e) {}
      }

      if (!foundMaster) {
        const localMasters = await dbModule.fetchAll('mr_settlement_master').catch(() => []);
        foundMaster = localMasters.find((m: any) => m.mr_no === targetMrNo);
      }

      if (foundDetails.length === 0) {
        const localDetails = await dbModule.fetchAll('mr_settlement_detail').catch(() => []);
        foundDetails = localDetails.filter((d: any) => d.mr_no === targetMrNo);
      }

      const activeMaster = foundMaster || masterData;

      // Also fetch PO details, final_arrival, material_inspection, supplier_master, and payment_details for accurate print preview
      const targetPoForView = activeMaster.po_no || selectedPoNo || '';
      const [{ poData: viewPoData, poDetails: viewPoDetails }, { totalPaid: viewPaidAmt, payDetails: viewPayDetails }] = await Promise.all([
        targetPoForView ? fetchPoAndItemDetails(targetPoForView) : Promise.resolve({ poData: null, poDetails: [] }),
        syncPaymentModuleData(targetMrNo, targetPoForView)
      ]);

      let faRecord: any = null;
      let inspRecord: any = null;
      let inspDetailsList: any[] = [];
      let supplierAddress = activeMaster.supplier_address || '';
      let supplierPan = activeMaster.pan_no || '';

      if (supabase) {
        try {
          const [faRes, matInspRes, matInspDetRes] = await Promise.all([
            supabase.from('final_arrival').select('*').or(`mr_no.eq.${targetMrNo},final_arrival_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}`).maybeSingle(),
            supabase.from('material_inspection').select('*').or(`mr_no.eq.${targetMrNo},final_arrival_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}`).maybeSingle(),
            supabase.from('material_inspection_details').select('*').eq('mr_no', targetMrNo)
          ]);
          if (faRes.data) faRecord = faRes.data;
          if (matInspRes.data) inspRecord = matInspRes.data;
          if (matInspDetRes.data) inspDetailsList = matInspDetRes.data;
        } catch (e) {}

        const supName = (activeMaster.supplier || faRecord?.supplier || inspRecord?.supplier_name || '').trim();
        if (supName && !supplierAddress) {
          try {
            const { data: supData } = await supabase
              .from('supplier_master')
              .select('*')
              .ilike('supplier_name', supName)
              .maybeSingle();
            if (supData) {
              supplierAddress = supData.address || supData.supplier_address || supData.city || '';
              if (!supplierPan) supplierPan = supData.pan_no || supData.pan || '';
            }
          } catch (e) {}
        }
      }

      // Parse deductions if needed
      let deductionsList: SettlementDeductionItem[] = [];
      if (Array.isArray(activeMaster.deductions) && activeMaster.deductions.length > 0) {
        deductionsList = activeMaster.deductions;
      } else if (typeof activeMaster.deductions === 'string' && activeMaster.deductions.trim() !== '') {
        try {
          const parsed = JSON.parse(activeMaster.deductions);
          if (Array.isArray(parsed) && parsed.length > 0) deductionsList = parsed;
        } catch (e) {}
      }

      // Check inspection table or mill_inspection_deduction table if deduction list is still empty or single generic
      if (deductionsList.length === 0 || (deductionsList.length === 1 && !deductionsList[0].deduction_type)) {
        try {
          if (supabase) {
            const { data: millDedList } = await supabase
              .from('mill_inspection_deduction')
              .select('*')
              .or(`mr_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}`)
              .order('created_at', { ascending: true });

            if (millDedList && millDedList.length > 0) {
              deductionsList = millDedList.map((d: any) => ({
                deduction_type: d.deduction_type || '',
                deduction_rate: Number(d.deduction_rate) || 0,
                deduction_qty: Number(d.deduction_qty) || 0,
                deduction_amount: Number(d.deduction_amount) || 0
              }));
            } else if (inspRecord) {
              if (Array.isArray(inspRecord.deductions) && inspRecord.deductions.length > 0) {
                deductionsList = inspRecord.deductions;
              } else if (Array.isArray(inspRecord.deduction_types) && inspRecord.deduction_types.length > 0) {
                deductionsList = inspRecord.deduction_types;
              }
            }
          }
        } catch (e) {
          console.warn("Could not load deductions from inspection:", e);
        }
      }

      if (deductionsList.length === 0) {
        const dType = activeMaster.summary_deduction_type || '';
        const dRate = Number(activeMaster.summary_deduction_rate) || 0;
        const dQty = Number(activeMaster.summary_deduction_qty) || (dRate > 0 ? 1 : 0);
        const dAmt = Number(activeMaster.summary_deduction_amount) || (dRate * dQty);

        if (dType.includes('\n') || dType.includes(',') || dType.includes(';')) {
          const parts = dType.split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean);
          deductionsList = parts.map((part: string, idx: number) => {
            let rowRate = 0;
            let rowQty = 1;
            let rowAmt = 0;
            const amtMatch = part.match(/₹\s*([0-9.]+)/i);
            const rateMatch = part.match(/@\s*₹?\s*([0-9.]+)/i) || part.match(/₹\s*([0-9.]+)/i);
            const qtyMatch = part.match(/([0-9.]+)\s*@/i) || part.match(/([0-9.]+)\s*(?:bales|units|nos|qntl|kgs)/i);
            if (amtMatch) rowAmt = parseFloat(amtMatch[1]) || 0;
            if (rateMatch) rowRate = parseFloat(rateMatch[1]) || 0;
            if (qtyMatch) rowQty = parseFloat(qtyMatch[1]) || 1;
            if (rowAmt === 0 && rowRate > 0) rowAmt = rowRate * rowQty;
            const cleanType = part.replace(/\(.*\)/g, '').replace(/@.*/g, '').replace(/₹.*/g, '').trim() || part;
            return {
              deduction_type: cleanType,
              deduction_rate: rowRate || (idx === 0 ? dRate : 0),
              deduction_qty: rowQty || (idx === 0 ? dQty : 1),
              deduction_amount: rowAmt || (idx === 0 ? dAmt : 0)
            };
          });
        } else if (dType && !dType.includes('-- SELECT') && (dRate > 0 || dAmt > 0)) {
          deductionsList = [{
            deduction_type: dType,
            deduction_rate: dRate,
            deduction_qty: dQty || 1,
            deduction_amount: dAmt || (dRate * (dQty || 1))
          }];
        }
      }

      const faGridArr = parseGridOrItems(faRecord?.specification_grid || faRecord?.items || inspRecord?.specification_grid || inspRecord?.items);
      const alignedFallbackCols = buildAlignedSettlementColumns(
        viewPoDetails,
        inspDetailsList,
        faGridArr,
        faRecord,
        inspRecord,
        viewPoData || selectedPoData,
        gradeMasterList,
        agencyMasterList,
        markaMasterList,
        areaMasterList,
        viewPayDetails
      );

      const activeDetails: SettlementDetailColumn[] = [1, 2, 3, 4].map(idx => {
        const existing = foundDetails.find((d: any) => Number(d.col_index) === idx);
        const fb = alignedFallbackCols[idx - 1] || detailCols[idx - 1] || emptyDetailColumn(idx);
        if (existing) {
          const merged: SettlementDetailColumn = {
            ...emptyDetailColumn(idx),
            ...fb,
            ...existing,
            grade: existing.grade || fb.grade,
            area: existing.area || fb.area,
            agency: existing.agency || fb.agency,
            marka_crop: existing.marka_crop || fb.marka_crop,
            rate_value: Number(fb.rate_value) > 0 ? Number(fb.rate_value) : Number(existing.rate_value || 0),
            premium: Number(existing.premium) > 0 ? Number(existing.premium) : Number(fb.premium || 0),
            sett_pct: existing.sett_pct !== undefined && Number(existing.sett_pct) > 0 ? Number(existing.sett_pct) : (Number(existing.gd_sett) > 0 ? Number(existing.gd_sett) : Number(fb.sett_pct || fb.gd_claim || 0)),
            deduction_rate: existing.deduction_rate !== undefined && Number(existing.deduction_rate) > 0 ? Number(existing.deduction_rate) : Number(fb.deduction_rate || 0),
            sett_rate: existing.sett_rate !== undefined && Number(existing.sett_rate) > 0 ? Number(existing.sett_rate) : Number(fb.sett_rate || 0),
          };
          merged.sett_rate = getEffectiveColSettRate(merged);
          merged.amount = getColAmount(merged);
          return merged;
        }
        return fb;
      });

      let viewApmcFees = Number(activeMaster.arival_apmc_fees ?? activeMaster.apmc_fees ?? 0);
      if (viewApmcFees <= 0) {
        viewApmcFees = await resolveTemporaryArrivalApmcFees({
          candidateNos: [activeMaster.arrival_no, activeMaster.mr_no, targetMrNo],
          poNo: activeMaster.po_no || '',
          lorryNo: activeMaster.lorry_number || ''
        });
      }

      setViewModalData({
        master: {
          ...activeMaster,
          mr_date: activeMaster.mr_date || faRecord?.date || faRecord?.mr_date || inspRecord?.mr_date || inspRecord?.arrival_date || activeMaster.arrival_date || activeMaster.sett_date,
          po_date: activeMaster.po_date || viewPoData?.po_date || viewPoData?.s_date || faRecord?.po_date || inspRecord?.po_date || '',
          supplier_address: supplierAddress || faRecord?.supplier_address || '',
          consign_no: activeMaster.consign_no || faRecord?.consignment_note_no || faRecord?.challan_rr_no || faRecord?.challan_no || '',
          consign_date: activeMaster.consign_date || faRecord?.challan_date || faRecord?.po_date || viewPoData?.po_date || '',
          way_bill: activeMaster.way_bill || faRecord?.way_bill_no || faRecord?.way_bill || '',
          pan_no: supplierPan || faRecord?.pan_no || '',
          arival_apmc_fees: viewApmcFees,
          final_on_ac_adv: Number(activeMaster.final_on_ac_adv) > 0 ? Number(activeMaster.final_on_ac_adv) : viewPaidAmt,
          deductions: deductionsList
        },
        details: activeDetails
      });
      setShowViewModal(true);
    } catch (err: any) {
      console.error("Failed to load view settlement:", err);
      setErrorMessage("Unable to open settlement view: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const po = masterData.po_no || selectedPoNo;
    const mr = masterData.mr_no;
    if (po || mr) {
      syncPaymentModuleData(mr, po);
    }
  }, [masterData.po_no, masterData.mr_no, selectedPoNo]);

  // Derived options for P.O. and P.O.-filtered FA (Final Arrival / MR) searchable dropdowns
  const poOptions = React.useMemo(() => {
    const cleanPo = (s: string) => (s || '').replace(/^#/, '').replace(/[\s\-\/]/g, '').trim().toUpperCase();
    const boundPoSet = new Set<string>();
    inspections.forEach((insp: any) => {
      const p = String(insp.po_no || insp.mill_po_no || insp.contract_no || '').trim().replace(/^#/, '').toUpperCase();
      if (p && p !== 'NO' && p !== 'N/A' && p !== 'NONE') {
        boundPoSet.add(p);
        boundPoSet.add(cleanPo(p));
      }
    });
    purchaseOrders.forEach((po: any) => {
      const mr = String(po.mr_no || po.final_arrival_no || po.temporary_arrival_no || '').trim().toUpperCase();
      if (mr && mr !== 'NO' && mr !== 'N/A' && mr !== 'NONE') {
        const p = String(po.po_no || '').trim().replace(/^#/, '').toUpperCase();
        if (p) {
          boundPoSet.add(p);
          boundPoSet.add(cleanPo(p));
        }
      }
    });

    const boundPos = purchaseOrders.filter((po: any) => {
      const p = String(po.po_no || '').trim().replace(/^#/, '').toUpperCase();
      if (!p) return false;
      if (selectedPoNo && cleanPo(p) === cleanPo(selectedPoNo)) return true;
      return boundPoSet.has(p) || boundPoSet.has(cleanPo(p));
    });

    const listToUse = boundPos.length > 0 ? boundPos : purchaseOrders;
    return listToUse.map((po: any) => {
      const isDone = po.isCompleted || po.status === 'completed' || po.status === 'settled';
      return {
        value: po.po_no,
        label: `#${po.po_no} (${po.supplier || 'PO'})${isDone ? ' - [COMPLETED]' : ''}`
      };
    });
  }, [purchaseOrders, inspections, selectedPoNo]);

  const faOptionsForSelectedPo = React.useMemo(() => {
    if (!selectedPoNo) return [];

    const cleanTargetPo = selectedPoNo.trim().replace(/^#/, '').toUpperCase();
    const cleanPo = (s: string) => (s || '').replace(/^#/, '').replace(/[\s\-\/]/g, '').trim().toUpperCase();
    const targetPoNormalized = cleanPo(cleanTargetPo);
    if (!targetPoNormalized) return [];

    const matched = inspections.filter((insp: any) => {
      const mrVal = insp.mr_no || insp.final_arrival_no || insp.arrival_no;
      if (!mrVal) return false;

      const inspPo = String(insp.po_no || insp.mill_po_no || insp.contract_no || '').trim().replace(/^#/, '').toUpperCase();
      if (!inspPo || inspPo === 'NO' || inspPo === 'N/A' || inspPo === 'NONE') return false;

      const inspPoNormalized = cleanPo(inspPo);
      if (!inspPoNormalized) return false;

      const isPoMatch =
        inspPo === cleanTargetPo ||
        inspPoNormalized === targetPoNormalized ||
        (selectedPoData?.id && insp.po_id && insp.po_id === selectedPoData.id) ||
        (selectedPoData?.purchase_order_id && insp.po_id && (insp.po_id === selectedPoData.purchase_order_id || insp.purchase_order_id === selectedPoData.purchase_order_id));

      if (!isPoMatch) return false;

      const isAlreadySettled = settledList.some(s => String(s.mr_no).trim().toUpperCase() === String(mrVal).trim().toUpperCase()) || insp.status === 'settled';
      const isCurrentMr = masterData.mr_no && String(masterData.mr_no).trim().toUpperCase() === String(mrVal).trim().toUpperCase();

      return !isAlreadySettled || isCurrentMr || (isEdit && isCurrentMr);
    });

    const seen = new Set<string>();
    const optionsList: { label: string; value: string }[] = [];

    matched.forEach((insp: any) => {
      const mrVal = String(insp.mr_no || insp.final_arrival_no || insp.arrival_no || '').trim();
      if (!mrVal) return;
      const key = mrVal.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);

      const lorryVal = insp.lorry_number || insp.lorry_no || insp.vehicle_no || insp.final_arrival_no || insp.arrival_no || mrVal;
      optionsList.push({
        value: mrVal,
        label: `${mrVal} (Lorry: ${lorryVal})`
      });
    });

    optionsList.sort((a, b) => {
      const getSuffix = (val: string) => {
        const m = val.match(/\d+/g);
        return m ? Number(m[m.length - 1]) : 0;
      };
      const suffA = getSuffix(a.value);
      const suffB = getSuffix(b.value);
      if (suffA !== suffB) return suffB - suffA;
      return b.value.localeCompare(a.value);
    });

    if (masterData.mr_no && !seen.has(masterData.mr_no.toUpperCase())) {
      const lorryVal = masterData.lorry_number || masterData.mr_no;
      optionsList.unshift({
        value: masterData.mr_no,
        label: `${masterData.mr_no} (Lorry: ${lorryVal})`
      });
    }

    return optionsList;
  }, [selectedPoNo, selectedPoData, inspections, settledList, isEdit, masterData.mr_no, masterData.lorry_number]);

  const [gradeMasterList, setGradeMasterList] = useState<any[]>([]);
  const [agencyMasterList, setAgencyMasterList] = useState<any[]>([]);
  const [markaMasterList, setMarkaMasterList] = useState<any[]>([]);
  const [areaMasterList, setAreaMasterList] = useState<any[]>([]);
  const [deductionMasterList, setDeductionMasterList] = useState<any[]>([]);

  
  useLiveAutoRefresh(initPage, [], { 
    tables: [
      'mr_settlement_master', 
      'm_r_settlement', 
      'material_inspection',
      'material_inspection_details',
      'mill_inspection_master',
      'mill_inspection_detail',
      'mill_inspection_deduction',
      'final_arrival', 
      'purchase_master', 
      'payment_master', 
      'temporary_material_received', 
      'sauda_check_point', 
      'sauda_master',
      'clubbed_pomr'
    ] 
  });

  // In-memory master registers cache
  const mastersCacheRef = useRef<{ gData?: any[]; agData?: any[]; mDataList?: any[]; aData?: any[]; dData?: any[] }>({});

  // Load dashboards & dropdowns
  async function initPage() {
    if (settledList.length === 0) setLoading(true);
    try {
      if (supabase) {
        // Fetch master registers for lookup (cached in-memory)
        if (!mastersCacheRef.current.gData) {
          const [gData, agData, mDataList, aData, dData, sattaData] = await Promise.all([
            supabase.from('grade_master').select('*').then(r => r.data || [], () => []),
            supabase.from('agency_master').select('*').then(r => r.data || [], () => []),
            supabase.from('marka_master').select('*').then(r => r.data || [], () => []),
            supabase.from('area_master').select('*').then(r => r.data || [], () => []),
            supabase.from('deduction_master').select('*').then(r => r.data || [], () => []),
            supabase.from('satta_differentials').select('*').then(r => r.data || [], () => [])
          ]);
          mastersCacheRef.current = { gData, agData, mDataList, aData, dData };
          setGradeMasterList(gData);
          setAgencyMasterList(agData);
          setMarkaMasterList(mDataList);
          setAreaMasterList(aData);
          setDeductionMasterList(dData);
          if (sattaData && sattaData.length > 0) {
            setCachedSattaDiffs(sattaData);
          }
        }

        // 1. Fetch saved settlements & payments
        const [mDataRes, payRes] = await Promise.all([
          supabase.from('mr_settlement_master').select('*').order('created_at', { ascending: false }),
          supabase.from('payment_master').select('*').then(res => res, () => ({ data: [] }))
        ]);
        if (!mDataRes.error && mDataRes.data) setSettledList(mDataRes.data);
        const payList = payRes.data && payRes.data.length > 0 ? payRes.data : await dbModule.fetchAll('payment_master').catch(() => []);
        setPaymentList(payList);

        // 2. Fetch completed inspections from Mill Inspection Section (material_inspection, final_arrival, clubbed_pomr)
        const [matInspRes, faRes, clubbedRes] = await Promise.all([
          supabase.from('material_inspection').select('*').order('created_at', { ascending: false }).then(r => r.data || [], () => []),
          supabase.from('final_arrival').select('*').order('date', { ascending: false }).then(r => r.data || [], () => []),
          dbModule.fetchAll('clubbed_pomr').catch(() => [])
        ]);

        // Map any bound PO numbers from final_arrival and clubbed_pomr by MR/Arrival number
        const mrToBoundPoMap = new Map<string, string>();
        const registerBoundPo = (mrCandidate: any, poCandidate: any) => {
          const mrStr = String(mrCandidate || '').trim().toUpperCase();
          const poStr = String(poCandidate || '').trim();
          const poUpper = poStr.toUpperCase();
          if (mrStr && poStr && poUpper !== 'NO' && poUpper !== 'N/A' && poUpper !== 'NONE') {
            if (!mrToBoundPoMap.has(mrStr)) {
              mrToBoundPoMap.set(mrStr, poStr);
            }
          }
        };

        if (faRes) {
          for (const fa of faRes) {
            registerBoundPo(fa.mr_no, fa.po_no || fa.contract_no);
            registerBoundPo(fa.final_arrival_no, fa.po_no || fa.contract_no);
            registerBoundPo(fa.arrival_no, fa.po_no || fa.contract_no);
            registerBoundPo(fa.temporary_arrival_no, fa.po_no || fa.contract_no);
          }
        }
        if (clubbedRes && Array.isArray(clubbedRes)) {
          for (const c of clubbedRes) {
            registerBoundPo(c.mr_no, c.po_no);
          }
        }

        const resolveBoundPoForItem = (item: any): string => {
          const existingPo = String(item.po_no || item.mill_po_no || item.contract_no || '').trim();
          const existingUpper = existingPo.toUpperCase();
          if (existingPo && existingUpper !== 'NO' && existingUpper !== 'N/A' && existingUpper !== 'NONE') {
            return existingPo;
          }
          const candidates = [item.mr_no, item.final_arrival_no, item.arrival_no, item.temporary_arrival_no, item.ref_arrival_no];
          for (const cand of candidates) {
            const key = String(cand || '').trim().toUpperCase();
            if (key && mrToBoundPoMap.has(key)) {
              return mrToBoundPoMap.get(key)!;
            }
          }
          return '';
        };

        const combinedInspections: any[] = [];
        const seenMrNos = new Set<string>();

        // Priority 1: material_inspection (Mill Inspection primary)
        if (matInspRes) {
          for (const item of matInspRes) {
            const mrKey = item.mr_no || item.arrival_no || item.final_arrival_no;
            if (mrKey && !seenMrNos.has(mrKey)) {
              seenMrNos.add(mrKey);
              const boundPo = resolveBoundPoForItem(item);
              combinedInspections.push(boundPo ? { ...item, po_no: boundPo } : item);
            }
          }
        }

        // Priority 2: final_arrival
        if (faRes) {
          for (const item of faRes) {
            const mrKey = item.mr_no || item.final_arrival_no || item.arrival_no;
            if (mrKey && !seenMrNos.has(mrKey)) {
              seenMrNos.add(mrKey);
              if (!item.mr_no) item.mr_no = mrKey;
              if (!item.final_arrival_no) item.final_arrival_no = mrKey;
              const boundPo = resolveBoundPoForItem(item);
              combinedInspections.push(boundPo ? { ...item, po_no: boundPo } : item);
            }
          }
        }

        // Check local storage cache as well
        try {
          const cachedMat = localStorage.getItem("material_inspection_records");
          if (cachedMat) {
            const parsed = JSON.parse(cachedMat);
            if (Array.isArray(parsed)) {
              parsed.forEach((item: any) => {
                const mrKey = item.mr_no || item.arrival_no || item.final_arrival_no;
                if (mrKey && !seenMrNos.has(mrKey)) {
                  seenMrNos.add(mrKey);
                  const boundPo = resolveBoundPoForItem(item);
                  combinedInspections.push(boundPo ? { ...item, po_no: boundPo } : item);
                }
              });
            }
          }
        } catch (e) {}

        setInspections(combinedInspections);

        // 3. Fetch purchase orders list for selection from Final P.O and Sauda Check Point
        const { data: poList } = await supabase
          .from('purchase_master')
          .select('po_no, po_date, broker, supplier, total_contract_mt, status, pending, pending_received')
          .order('po_no', { ascending: false });

        const { data: poArchList } = await supabase
          .from('po_archive')
          .select('po_no, po_date, broker, supplier, total_contract_mt, status, pending')
          .order('po_no', { ascending: false })
          .then(res => res, () => ({ data: [] }));

        const { data: scpPoList } = await supabase
          .from('sauda_check_point')
          .select('po_no, po_date, s_date, broker, broker_name, supplier, supplier_name, quantity, total_contract_mt, status, pending')
          .then(res => res, () => ({ data: [] }));

        const rawCombined = [
          ...(poList || []),
          ...(poArchList || []),
          ...((scpPoList || []).map((s: any) => ({
            ...s,
            po_date: s.po_date || s.s_date,
            broker: s.broker_name || s.broker,
            supplier: s.supplier_name || s.supplier,
            total_contract_mt: s.total_contract_mt || s.quantity || 0,
          })))
        ];

        if (rawCombined.length > 0) {
          const poReceivedMap = new Map<string, number>();
          if (combinedInspections && combinedInspections.length > 0) {
            combinedInspections.forEach((item: any) => {
              if (item.po_no) {
                let wtMt = 0;
                if (item.final_receipt_wt && Number(item.final_receipt_wt) > 0) wtMt = Number(item.final_receipt_wt);
                else if (item.weight_qtl && Number(item.weight_qtl) > 0) wtMt = Number(item.weight_qtl) / 10;
                else if (item.electronic_net_weight && Number(item.electronic_net_weight) > 0) {
                  const val = Number(item.electronic_net_weight);
                  wtMt = val > 50 ? val / 10 : val;
                } else if (item.challan_material_weight && Number(item.challan_material_weight) > 0) {
                  const val = Number(item.challan_material_weight);
                  wtMt = val > 50 ? val / 10 : val;
                } else if (item.chalan_wt && Number(item.chalan_wt) > 0) {
                  const val = Number(item.chalan_wt);
                  wtMt = val > 50 ? val / 10 : val;
                }
                poReceivedMap.set(item.po_no, (poReceivedMap.get(item.po_no) || 0) + wtMt);
              }
            });
          }

          const existingPoNos = new Set<string>();
          const processedList: any[] = [];

          rawCombined.forEach(p => {
            if (!p.po_no || existingPoNos.has(p.po_no)) return;
            if (p.status === 'cancelled' || p.status === 'temp' || p.status === 'draft') return;
            if (p.po_no.endsWith('T') || p.po_no.includes('TEMP')) return;

            existingPoNos.add(p.po_no);

            const statusStr = String(p.status || '').trim().toLowerCase();
            const pendingStr = String(p.pending ?? '').trim().toLowerCase();
            const contractWt = Number(p.total_contract_mt) || 0;
            const receivedWt = poReceivedMap.get(p.po_no) || 0;

            const isExplicitCompleted = statusStr === 'completed' || statusStr === 'settled';
            const isPendingFalse = p.pending === false || pendingStr === 'false' || pendingStr === 'no' || p.pending === 0;
            const isWeightCompleted = contractWt > 0 && receivedWt >= (contractWt - 0.05);

            processedList.push({
              ...p,
              isCompleted: isExplicitCompleted || isPendingFalse || isWeightCompleted
            });
          });

          if (combinedInspections && combinedInspections.length > 0) {
            combinedInspections.forEach((item: any) => {
              if (item.po_no && !existingPoNos.has(item.po_no) && !item.po_no.endsWith('T') && !item.po_no.includes('TEMP')) {
                existingPoNos.add(item.po_no);
                processedList.push({
                  po_no: item.po_no,
                  supplier: item.supplier_name || item.supplier || 'Inspection PO',
                  status: item.status || 'completed',
                  isCompleted: true
                });
              }
            });
          }

          setPurchaseOrders(processedList);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      await initPage();
      const currentPo = masterData.po_no || selectedPoNo;
      if (currentPo) {
        await handlePoNoSelection(currentPo, Boolean(masterData.mr_no));
      }
      if (masterData.mr_no) {
        syncPaymentModuleData(masterData.mr_no, currentPo);
      }
      setSuccessMessage('Settlement database, P.O. dropdowns & arrival records refreshed successfully!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      console.error("Refresh failed:", err);
      setErrorMessage("Refresh failed: " + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const resolveTemporaryArrivalApmcFees = async (params: {
    candidateNos?: (string | undefined | null)[];
    poNo?: string | null;
    lorryNo?: string | null;
    faMaster?: any;
    inspMaster?: any;
  }): Promise<number> => {
    try {
      const cleanCode = (v: any) => String(v || '').trim().replace(/^#/, '').toUpperCase();
      const cleanLorry = (v: any) => String(v || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const getFee = (rec: any) => {
        if (!rec) return 0;
        const val = Number(rec.apmc_fees ?? rec.arival_apmc_fees ?? rec.arrival_apmc_fees ?? 0);
        return isNaN(val) ? 0 : val;
      };

      const validCandidates = Array.from(
        new Set(
          (params.candidateNos || [])
            .map(cleanCode)
            .filter(c => c.length > 0 && c !== 'MR' && c !== 'FA' && c !== 'N/A')
        )
      );
      const poUpper = cleanCode(params.poNo);
      const lorryNorm = cleanLorry(params.lorryNo);

      const [tempRes, dbTemp] = await Promise.all([
        supabase ? supabase.from('temporary_material_received').select('*').then(r => r.data || [], () => []) : Promise.resolve([]),
        dbModule.fetchAll('temporary_material_received').catch(() => [])
      ]);

      const allTemp = [...(tempRes || []), ...(dbTemp || [])];

      if (allTemp.length > 0) {
        const pickBest = (matches: any[]) => {
          if (matches.length === 0) return null;
          const withFee = matches.find(m => getFee(m) > 0);
          return withFee || matches[0];
        };

        // Tier 1: Exact match on temporary_arrival_no / amad_no / arrival_no / mr_no
        const tier1Matches = validCandidates.length > 0
          ? allTemp.filter((t: any) => {
              const tCodes = [
                cleanCode(t.temporary_arrival_no),
                cleanCode(t.amad_no),
                cleanCode(t.arrival_no),
                cleanCode(t.mr_no)
              ].filter(Boolean);
              return tCodes.some(tc => validCandidates.includes(tc));
            })
          : [];

        // Tier 2: Match on both PO No and normalized Lorry Number
        const tier2Matches = (poUpper && lorryNorm.length >= 4)
          ? allTemp.filter((t: any) => {
              const tPo = cleanCode(t.po_no);
              const tLorry = cleanLorry(t.lorry_number || t.lorry_no || t.vehicle_no);
              return tPo === poUpper && tLorry === lorryNorm;
            })
          : [];

        // Tier 3: Match on normalized Lorry Number
        const tier3Matches = (lorryNorm.length >= 4)
          ? allTemp.filter((t: any) => {
              const tLorry = cleanLorry(t.lorry_number || t.lorry_no || t.vehicle_no);
              return tLorry === lorryNorm;
            })
          : [];

        // Tier 4: Match on PO No
        const tier4Matches = poUpper
          ? allTemp.filter((t: any) => cleanCode(t.po_no) === poUpper)
          : [];

        const matchedTemp =
          pickBest(tier1Matches) ||
          pickBest(tier2Matches) ||
          pickBest(tier3Matches) ||
          pickBest(tier4Matches);

        const tempFee = getFee(matchedTemp);
        if (tempFee > 0) {
          return tempFee;
        }
      }

      // Check Final Arrival / Inspection Master records passed in
      const directFee = getFee(params.faMaster) || getFee(params.inspMaster);
      if (directFee > 0) {
        return directFee;
      }

      // Fallback: Check amad_change_history in case apmc_fees was recorded in new_values audit JSON
      const [histRes, dbHist] = await Promise.all([
        supabase ? supabase.from('amad_change_history').select('amad_no, new_values').order('changed_at', { ascending: false }).limit(200).then(r => r.data || [], () => []) : Promise.resolve([]),
        dbModule.fetchAll('amad_change_history').catch(() => [])
      ]);
      const allHist = [...(histRes || []), ...(dbHist || [])];
      for (const h of allHist) {
        if (!h?.new_values) continue;
        try {
          const parsed = typeof h.new_values === 'string' ? JSON.parse(h.new_values) : h.new_values;
          const fee = getFee(parsed);
          if (fee <= 0) continue;

          const hAmad = cleanCode(h.amad_no || parsed.temporary_arrival_no || parsed.amad_no || parsed.arrival_no);
          const hPo = cleanCode(parsed.po_no);
          const hLorry = cleanLorry(parsed.lorry_number || parsed.lorry_no);

          const isMatch =
            (hAmad && validCandidates.includes(hAmad)) ||
            (poUpper && lorryNorm.length >= 4 && hPo === poUpper && hLorry === lorryNorm) ||
            (lorryNorm.length >= 4 && hLorry === lorryNorm) ||
            (poUpper && hPo === poUpper);

          if (isMatch) {
            if (supabase && hAmad) {
              supabase.from('temporary_material_received').update({ apmc_fees: fee }).eq('temporary_arrival_no', hAmad).then(() => {}, () => {});
            }
            return fee;
          }
        } catch (_) {}
      }

      return 0;
    } catch (e) {
      console.warn("Could not resolve temporary arrival APMC fees:", e);
      return 0;
    }
  };

  const handlePoNoSelection = async (poNo: string, preserveMrNo: boolean = false) => {
    setSelectedPoNo(poNo);
    if (!poNo) {
      setSelectedPoData(null);
      setPoStats(null);
      setCustomSettlementRecords([]);
      if (!preserveMrNo) {
        setMasterData(prev => ({
          ...prev,
          po_no: '',
          po_date: '',
          broker: '',
          supplier: '',
          chn_supplier: '',
          mr_no: '',
          lorry_number: '',
          arrival_no: '',
          arrival_date: ''
        }));
      }
      return;
    }
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (!supabase) return;
      
      const cleanPoNo = poNo.trim().replace(/^#/, '');

      // Fetch Sauda Checkpoint deduction recorded for this PO from sauda_check_point_deductions table
      const saudaDed = await fetchSaudaCheckpointDeduction(cleanPoNo);
      const isLastMr = masterData.mr_no ? isLastMrForPo(masterData.mr_no, cleanPoNo, inspections, selectedPoData) : true;

      if (isLastMr && saudaDed) {
        setSaudaDeductionRecord(saudaDed);
        if (Number(saudaDed.deduction_amount) > 0) {
          setMasterData(prev => ({
            ...prev,
            val_ex_short: Number(saudaDed.deduction_amount)
          }));
        }
      } else {
        setSaudaDeductionRecord(null);
      }

      // 1. Fetch matching PO master and item details (checking purchase_master, sauda_check_point, po_archive, and indexedDB)
      const { poData, poDetails: fetchedDetails } = await fetchPoAndItemDetails(cleanPoNo, gradeMasterList, agencyMasterList);

      if (!poData) {
        setSelectedPoData(null);
        setErrorMessage(`Could not resolve details for P.O No. ${poNo}`);
        setLoading(false);
        return;
      }

      setSelectedPoData(poData);
      if (preserveMrNo && masterData.mr_no) {
        await syncPaymentModuleData(masterData.mr_no, poNo);
      }

      // 2. Fetch all mill inspections & final arrivals for this P.O to sum total received quantity in Metric Tons (MT)
      const [matInspForPoRes, finalArrivalsForPoRes] = await Promise.all([
        supabase.from('material_inspection').select('*').eq('po_no', poData.po_no || cleanPoNo).then(r => r.data || [], () => []),
        supabase.from('final_arrival').select('*').eq('po_no', poData.po_no || cleanPoNo).then(r => r.data || [], () => [])
      ]);

      const inspectionsForPo = matInspForPoRes || [];
      const finalArrivalsForPo = finalArrivalsForPoRes || [];

      // Merge newly fetched arrivals into state so FA dropdown is always complete
      const incomingList: any[] = [...(inspectionsForPo || []), ...(finalArrivalsForPo || [])];
      if (incomingList.length > 0) {
        setInspections(prev => {
          const existingMap = new Map(prev.map(i => [(i.mr_no || i.final_arrival_no || i.arrival_no), i]));
          incomingList.forEach(item => {
            const key = item.mr_no || item.final_arrival_no || item.arrival_no;
            if (key && !existingMap.has(key)) {
              existingMap.set(key, item);
            }
          });
          return Array.from(existingMap.values());
        });
      }

      let totalInspectedMt = 0;
      const processedMrNos = new Set<string>();

      // A) Process final_arrival records for this PO
      if (finalArrivalsForPo && finalArrivalsForPo.length > 0) {
        for (const item of finalArrivalsForPo) {
          const key = item.mr_no || item.final_arrival_no || item.arrival_no;
          if (key) processedMrNos.add(key);

          let wtMt = 0;
          if (item.weight_qtl && Number(item.weight_qtl) > 0) {
            wtMt = Number(item.weight_qtl) / 10;
          } else if (item.electronic_net_weight && Number(item.electronic_net_weight) > 0) {
            const val = Number(item.electronic_net_weight);
            wtMt = val > 50 ? val / 10 : val;
          } else if (item.challan_material_weight && Number(item.challan_material_weight) > 0) {
            const val = Number(item.challan_material_weight);
            wtMt = val > 50 ? val / 10 : val;
          }

          if (wtMt === 0 && item.grid_details) {
            try {
              const grids = typeof item.grid_details === 'string' ? JSON.parse(item.grid_details) : item.grid_details;
              if (Array.isArray(grids)) {
                const totalGrossQtl = grids.reduce((s: number, g: any) => s + (Number(g.weight || g.weight_qtl || g.arr_qty_wt) || 0), 0);
                if (totalGrossQtl > 0) {
                  wtMt = totalGrossQtl > 50 ? totalGrossQtl / 10 : totalGrossQtl;
                }
              }
            } catch (e) {}
          }

          totalInspectedMt += wtMt;
        }
      }

      // B) Process mill_inspection_master records for this PO
      if (inspectionsForPo && inspectionsForPo.length > 0) {
        for (const item of inspectionsForPo) {
          if (item.mr_no && processedMrNos.has(item.mr_no)) continue;
          if (item.mr_no) processedMrNos.add(item.mr_no);

          let wtMt = 0;
          if (item.weight_qtl && Number(item.weight_qtl) > 0) {
            wtMt = Number(item.weight_qtl) / 10;
          } else if (item.electronic_net_weight && Number(item.electronic_net_weight) > 0) {
            const val = Number(item.electronic_net_weight);
            wtMt = val > 50 ? val / 10 : val;
          } else if (item.challan_material_weight && Number(item.challan_material_weight) > 0) {
            const val = Number(item.challan_material_weight);
            wtMt = val > 50 ? val / 10 : val;
          }

          if (wtMt === 0 && item.mr_no) {
            const { data: details } = await supabase
              .from('mill_inspection_detail')
              .select('challan_gross_wt')
              .eq('mr_no', item.mr_no);
            if (details && details.length > 0) {
              const detailGrossQtl = details.reduce((sum, r) => sum + (Number(r.challan_gross_wt) || 0), 0);
              if (detailGrossQtl > 0) {
                wtMt = detailGrossQtl > 50 ? detailGrossQtl / 10 : detailGrossQtl;
              }
            }
          }

          totalInspectedMt += wtMt;
        }
      }

      // 3. Fetch already settled quantity against this P.O
      const { data: settlementsForPo } = await supabase
        .from('mr_settlement_master')
        .select('mr_no, electronic_scale_net')
        .eq('po_no', poData.po_no || cleanPoNo);
      
      let totalSettledMt = 0;
      if (settlementsForPo && settlementsForPo.length > 0) {
        // Prioritize electronic_scale_net from mr_settlement_master (which is always in MT)
        totalSettledMt = settlementsForPo.reduce((sum, s) => sum + (Number(s.electronic_scale_net) || 0), 0);

        if (totalSettledMt === 0) {
          const mrNos = settlementsForPo.map(s => s.mr_no);
          const { data: sDetails } = await supabase
            .from('mr_settlement_detail')
            .select('quantity, arr_qty_wt, wt_quantity')
            .in('mr_no', mrNos);
          if (sDetails && sDetails.length > 0) {
            totalSettledMt = sDetails.reduce((sum, r) => {
              const q = Number(r.arr_qty_wt || r.wt_quantity || r.quantity) || 0;
              // If q > 500, it's KG -> MT (/1000). If q > 50, it's Quintal or Bales count, not raw MT.
              const mt = q > 500 ? q / 1000 : (q > 50 ? q / 10 : q);
              return sum + mt;
            }, 0);
          }
        }
      }

      // 4. Fetch data from 'm_r_settlement' table based on selected P.O number
      const { data: customSettlements, error: customErr } = await supabase
        .from('m_r_settlement')
        .select('*')
        .eq('po_no', poData.po_no || cleanPoNo)
        .order('created_at', { ascending: false });

      let totalCustomReceivedMt = 0;
      if (!customErr && customSettlements) {
        setCustomSettlementRecords(customSettlements);
        totalCustomReceivedMt = customSettlements.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
      } else {
        setCustomSettlementRecords([]);
      }

      const contractQty = Number(poData.total_contract_mt) || 0;
      const totalDeliveredMt = Number((totalCustomReceivedMt + totalInspectedMt).toFixed(3));
      const pendingQty = calculatePendingReceived(contractQty, totalDeliveredMt);
      const pendingReceivedQty = pendingQty;

      setPoStats({
        contractQty,
        receivedQty: totalInspectedMt,
        settledQty: Number(totalSettledMt.toFixed(3)),
        pendingQty: pendingQty,
        customReceivedQty: totalCustomReceivedMt,
        pendingReceivedQty: pendingReceivedQty,
        dbPendingReceived: Number(poData.pending_received) || 0
      });

      setLastSyncTime(new Date().toLocaleTimeString());

      // If preserveMrNo is false, clear MR and prepare base PO columns so user can select from the filtered FA dropdown
      if (!preserveMrNo) {
        const poDetails = (fetchedDetails && fetchedDetails.length > 0) ? fetchedDetails : [];

        const newCols = [1, 2, 3, 4].map(idx => {
          const pDet = poDetails && poDetails[idx - 1] ? poDetails[idx - 1] : null;
          return buildSettlementCol(
            idx,
            null,
            pDet,
            null,
            null,
            poData,
            gradeMasterList,
            agencyMasterList,
            markaMasterList,
            areaMasterList
          );
        });

        const poArrivalApmcFees = await resolveTemporaryArrivalApmcFees({
          poNo: poData.po_no || cleanPoNo
        });

        setMasterData(prev => ({
          ...initialMaster(),
          po_no: poData.po_no || cleanPoNo,
          po_date: poData.po_date || '',
          broker: poData.broker || '',
          supplier: poData.supplier || '',
          chn_supplier: poData.supplier || '',
          po_type: poData.po_type || 'MILL_PO',
          rate_qntl: Number(poData.rate_qntl || poData.rate_mt || poData.b_rate || 0),
          sett_date: prev.sett_date || new Date().toISOString().split('T')[0],
          arival_apmc_fees: poArrivalApmcFees,
          mr_no: '',
          lorry_number: '',
          arrival_no: '',
          arrival_date: ''
        }));
        setDetailCols(newCols);
      }

      if (onLogEvent) {
        onLogEvent('PO_SYNC', `Resolved P.O #${poNo}: Contract=${contractQty} MT, Unloaded=${totalInspectedMt} MT, Settled=${totalSettledMt} MT, Pending=${pendingQty} MT`);
      }

    } catch (err: any) {
      setErrorMessage("Failed to resolve PO statistics: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initPage();
  }, []);

  // Fetch complete details from and populate form
  const handleProceedWithMrNo = async (targetMrNo: string, forceSync: boolean = false) => {
    if (!targetMrNo) return;
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (!supabase) return;

      // 1. Fetch source records first (final_arrival or mill_inspection_master & details) for enrichment
      const { data: faMasterList } = await supabase
        .from('final_arrival')
        .select('*')
        .or(`mr_no.eq.${targetMrNo},final_arrival_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo},temporary_arrival_no.eq.${targetMrNo}`)
        .limit(1);
      const faMaster = faMasterList?.[0] || null;

      let faGridArr: any[] = [];
      if (faMaster?.grid_details) {
        if (Array.isArray(faMaster.grid_details)) faGridArr = faMaster.grid_details;
        else if (typeof faMaster.grid_details === 'string') {
          try { faGridArr = JSON.parse(faMaster.grid_details); } catch (e) {}
        }
      }

      let inspMaster: any = null;
      try {
        const matInspRes = await supabase.from('material_inspection').select('*').or(`mr_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}`).limit(1);
        inspMaster = matInspRes?.data?.[0] || null;
        if (!inspMaster) {
          const millInspRes = await supabase.from('mill_inspection_master').select('*').or(`mr_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}`).limit(1);
          inspMaster = millInspRes?.data?.[0] || null;
        }
      } catch (e) {
        console.warn("Error fetching inspection master:", e);
      }

      let inspDetails: any[] = [];
      if (inspMaster) {
        if (inspMaster.grid_details) {
          if (Array.isArray(inspMaster.grid_details)) inspDetails = inspMaster.grid_details;
          else if (typeof inspMaster.grid_details === 'string') {
            try { inspDetails = JSON.parse(inspMaster.grid_details); } catch (e) {}
          }
        } else if (inspMaster.details && Array.isArray(inspMaster.details)) {
          inspDetails = inspMaster.details;
        }
      }

      if (inspDetails.length === 0) {
        try {
          const matDetRes = await supabase.from('material_inspection_details').select('*').eq('mr_no', targetMrNo).order('srl_no', { ascending: true });
          const fetchedDet = matDetRes?.data || [];
          if (fetchedDet.length > 0) inspDetails = fetchedDet;
        } catch (e) {
          console.warn("Error fetching inspection details:", e);
        }
      }

      const poNoForDet = faMaster?.po_no || inspMaster?.po_no || '';
      const cleanTargetPo = (poNoForDet || selectedPoNo || masterData.po_no || '').trim().replace(/^#/, '');
      const isLastMr = isLastMrForPo(targetMrNo, cleanTargetPo, inspections, selectedPoData);

      let saudaDedRecord: any = null;
      if (isLastMr && cleanTargetPo) {
        saudaDedRecord = await fetchSaudaCheckpointDeduction(cleanTargetPo);
        setSaudaDeductionRecord(saudaDedRecord);
      } else {
        setSaudaDeductionRecord(null);
      }

      let poDetails: any[] = [];
      let poData: any = null;
      const effectivePoNo = poNoForDet || cleanTargetPo;
      if (effectivePoNo) {
        const { poData: fetchedPo, poDetails: fetchedDetails } = await fetchPoAndItemDetails(effectivePoNo, gradeMasterList, agencyMasterList);
        poData = fetchedPo;
        poDetails = fetchedDetails;
        if (poData) setSelectedPoData(poData);
      }

      let gList = gradeMasterList;
      if (!gList || gList.length === 0) {
        const { data: gData } = await supabase.from('grade_master').select('*');
        if (gData && gData.length > 0) {
          gList = gData;
          setGradeMasterList(gData);
        }
      }
      let agList = agencyMasterList;
      if (!agList || agList.length === 0) {
        const { data: agData } = await supabase.from('agency_master').select('*');
        if (agData && agData.length > 0) {
          agList = agData;
          setAgencyMasterList(agData);
        }
      }
      let mList = markaMasterList;
      if (!mList || mList.length === 0) {
        const { data: mData } = await supabase.from('marka_master').select('*');
        if (mData && mData.length > 0) {
          mList = mData;
          setMarkaMasterList(mData);
        }
      }
      let arList = areaMasterList;
      if (!arList || arList.length === 0) {
        const { data: aData } = await supabase.from('area_master').select('*');
        if (aData && aData.length > 0) {
          arList = aData;
          setAreaMasterList(aData);
        }
      }

      // Fetch Temporary Arrival record to retrieve A.P.M.C Fees (Rs.)
      const resolvedArrivalApmcFees = await resolveTemporaryArrivalApmcFees({
        candidateNos: [
          faMaster?.temporary_arrival_no,
          faMaster?.arrival_no,
          faMaster?.final_arrival_no,
          faMaster?.mr_no,
          inspMaster?.arrival_no,
          inspMaster?.ref_arrival_no,
          inspMaster?.mr_no,
          targetMrNo
        ],
        poNo: poNoForDet || cleanTargetPo,
        lorryNo: faMaster?.lorry_number || faMaster?.lorry_no || inspMaster?.lorry_number || inspMaster?.lorry_no || '',
        faMaster,
        inspMaster
      });

      if (getCachedSattaDiffs().length === 0) {
        try {
          const { data: sattaData } = await supabase.from('satta_differentials').select('*');
          if (sattaData && sattaData.length > 0) setCachedSattaDiffs(sattaData);
        } catch (e) {}
      }

      const { totalPaid: syncedPaidAmount, payDetails: matchedPayDetails } = await syncPaymentModuleData(targetMrNo, effectivePoNo);

      // Calculate total Premium Quantity (MT), Premium WT (Qtl), and Premium Amount (₹) from Inspection Details
      let totalPremMt = 0;
      let calculatedPremTotalAmt = 0;
      if (inspDetails && inspDetails.length > 0) {
        inspDetails.forEach((row: any) => {
          const rawPrem = row.premium !== undefined && row.premium !== null ? String(row.premium).trim() : "";
          const parsedNum = parseFloat(rawPrem);
          const isNumericPrem = !isNaN(parsedNum) && parsedNum > 0;
          const isExplicitPrem = row.is_premium === true || 
            rawPrem.toLowerCase() === "yes" || 
            (rawPrem !== "" && rawPrem.toLowerCase() !== "no");

          if (isNumericPrem || isExplicitPrem) {
            let rowPremMt = 0;
            if (isNumericPrem) {
              rowPremMt = parsedNum;
            } else if (row.premium_mt && Number(row.premium_mt) > 0) {
              rowPremMt = Number(row.premium_mt);
            } else if (row.premium_quantity && Number(row.premium_quantity) > 0) {
              rowPremMt = Number(row.premium_quantity);
            } else {
              if (row.challan_gross_wt && Number(row.challan_gross_wt) > 0) {
                rowPremMt = Number(row.challan_gross_wt);
              } else if (row.receipt_gross_wt && Number(row.receipt_gross_wt) > 0) {
                rowPremMt = Number(row.receipt_gross_wt);
              } else {
                const q = Number(row.quantity) || 0;
                const u = String(row.unit || "BALES").toUpperCase();
                if (u.includes("BALE")) rowPremMt = q * 0.18;
                else if (u.includes("KG")) rowPremMt = q * 0.001;
                else if (u.includes("QTL") || u.includes("QUINTAL")) rowPremMt = q * 0.10;
                else if (u.includes("DRUM")) rowPremMt = q * 0.20;
                else if (u.includes("BAG")) rowPremMt = q * 0.05;
                else rowPremMt = q;
              }
            }

            if (rowPremMt > 0) {
              totalPremMt += rowPremMt;
              const rowRate = Number(row.amount) || Number(row.rate) || Number(row.rate_qntl) || 0;
              const rowPremQtl = rowPremMt * 10;
              calculatedPremTotalAmt += (rowPremQtl * rowRate);
            }
          }
        });
      }
      const calculatedPremWtQtl = Number((totalPremMt * 10).toFixed(2));
      const calculatedPremRatePerQtl = calculatedPremWtQtl > 0 ? Number((calculatedPremTotalAmt / calculatedPremWtQtl).toFixed(2)) : 0;
      calculatedPremTotalAmt = Number(calculatedPremTotalAmt.toFixed(2));

      // Extract comprehensive deduction details and summarized deduction types from mill_inspection_deduction table / Inspection Master
      let inspDeductionType = inspMaster?.deduction_type || '';
      let inspDeductionRate = Number(inspMaster?.deduction_rate) || 0;
      let inspDeductionQty = Number(inspMaster?.deduction_qty) || 0;
      let inspDeductionAmount = Number(inspMaster?.deduction_amount) || 0;

      let parsedDeductions: SettlementDeductionItem[] = [];

      // 1. Query mill_inspection_deduction table first for all detailed rows saved for this MR / arrival
      try {
        if (supabase) {
          const { data: millDedList } = await supabase
            .from('mill_inspection_deduction')
            .select('*')
            .or(`mr_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}`)
            .order('created_at', { ascending: true });

          if (millDedList && millDedList.length > 0) {
            parsedDeductions = millDedList
              .filter((d: any) => d && ((d.deduction_type && String(d.deduction_type).trim() !== '' && !String(d.deduction_type).includes('-- SELECT')) || Number(d.deduction_amount || d.amount) > 0 || Number(d.deduction_rate || d.rate) > 0))
              .map((d: any) => {
                const name = String(d.deduction_type || d.deduction || d.rule_name || '').trim();
                const rate = Number(d.deduction_rate || d.rate) || 0;
                const qty = Number(d.deduction_qty || d.qty) || 1;
                const amt = Number(d.deduction_amount || d.amount) || Number((rate * qty).toFixed(2));
                return { deduction_type: name, deduction_rate: rate, deduction_qty: qty, deduction_amount: amt };
              });
          }
        }
      } catch (e) {
        console.warn("Could not query mill_inspection_deduction:", e);
      }

      // 2. Fallback to raw JSONB deductions array on inspMaster
      if (parsedDeductions.length === 0) {
        const rawDeductionsArray = inspMaster?.deduction_types || inspMaster?.deductions;
        if (Array.isArray(rawDeductionsArray) && rawDeductionsArray.length > 0) {
          parsedDeductions = rawDeductionsArray
            .filter((d: any) => d && ((d.deduction_type && String(d.deduction_type).trim() !== '' && !String(d.deduction_type).includes('-- SELECT')) || (d.deduction && String(d.deduction).trim() !== '') || Number(d.deduction_amount || d.amount) > 0 || Number(d.deduction_rate || d.rate) > 0))
            .map((d: any) => {
              const name = String(d.deduction_type || d.deduction || d.name || '').trim();
              const rate = Number(d.deduction_rate || d.rate) || 0;
              const qty = Number(d.deduction_qty || d.qty) || 1;
              const amt = Number(d.deduction_amount || d.amount) || Number((rate * qty).toFixed(2));
              return { deduction_type: name, deduction_rate: rate, deduction_qty: qty, deduction_amount: amt };
            });
        }
      }

      let deductionSummaryText = inspDeductionType;
      if (parsedDeductions.length > 0) {
        const typeSummaries = parsedDeductions.map(d => {
          if (d.deduction_amount > 0) return `${d.deduction_type} (₹${d.deduction_amount})`;
          if (d.deduction_rate > 0 && d.deduction_qty > 0) return `${d.deduction_type} (${d.deduction_qty} @ ₹${d.deduction_rate})`;
          return d.deduction_type;
        });

        deductionSummaryText = typeSummaries.join(', ');
        inspDeductionAmount = parsedDeductions.reduce((s: number, d: any) => s + (Number(d.deduction_amount) || 0), 0);
        inspDeductionRate = parsedDeductions[0].deduction_rate;
        inspDeductionQty = parsedDeductions[0].deduction_qty;
      } else if (inspDeductionType && !inspDeductionType.includes('-- SELECT') && (inspDeductionRate > 0 || inspDeductionAmount > 0)) {
        parsedDeductions = [{
          deduction_type: inspDeductionType,
          deduction_rate: inspDeductionRate || inspDeductionAmount,
          deduction_qty: inspDeductionQty || 1,
          deduction_amount: inspDeductionAmount || Number(((inspDeductionRate || 0) * (inspDeductionQty || 1)).toFixed(2))
        }];
      } else {
        deductionSummaryText = '';
        inspDeductionRate = 0;
        inspDeductionQty = 0;
        inspDeductionAmount = 0;
      }

      // Check if settlement already exists for this MR. If yes, load for editing!
      if (!forceSync) {
        const { data: existingMaster } = await supabase
          .from('mr_settlement_master')
          .select('*')
          .eq('mr_no', targetMrNo)
          .maybeSingle();

        if (existingMaster) {
          setIsEdit(true);
          const hasMoreParsedDeductions = parsedDeductions.length > (existingMaster.deductions?.length || 0);
          const effectiveDeductions = hasMoreParsedDeductions
            ? parsedDeductions
            : ((existingMaster.deductions && Array.isArray(existingMaster.deductions) && existingMaster.deductions.length > 0)
                ? existingMaster.deductions
                : (parsedDeductions.length > 0 ? parsedDeductions : []));
          const effectiveDeductionAmount = hasMoreParsedDeductions
            ? inspDeductionAmount
            : ((Number(existingMaster.summary_deduction_amount) > 0) ? existingMaster.summary_deduction_amount : inspDeductionAmount);

          const toMtWeight = (primaryVal: any, fallbackQtlVal?: any): number => {
            const p = Number(primaryVal) || 0;
            if (p > 0) {
              if (p > 500) return Number((p / 1000).toFixed(3));
              if (p > 50) return Number((p / 10).toFixed(3));
              return Number(p.toFixed(3));
            }
            const q = Number(fallbackQtlVal) || 0;
            if (q > 0) {
              return Number((q / 10).toFixed(3));
            }
            return 0;
          };

          const mergedMaster = {
            ...existingMaster,
            challan_weight: toMtWeight(existingMaster.challan_weight || faMaster?.challan_material_weight || inspMaster?.challan_material_weight, faMaster?.weight_qtl || inspMaster?.weight_qtl),
            supplier_net_wt: toMtWeight(existingMaster.supplier_net_wt || faMaster?.supplier_net_weight || inspMaster?.supplier_net_weight, faMaster?.weight_qtl || inspMaster?.weight_qtl),
            electronic_scale_net: toMtWeight(existingMaster.electronic_scale_net || faMaster?.electronic_net_weight || inspMaster?.electronic_net_weight, faMaster?.weight_qtl || inspMaster?.weight_qtl),
            wt_ded_wt_1: toMtWeight(existingMaster.wt_ded_wt_1 || existingMaster.challan_weight || faMaster?.challan_material_weight || inspMaster?.challan_material_weight, faMaster?.weight_qtl || inspMaster?.weight_qtl),
            wt_ded_wt_2: toMtWeight(existingMaster.wt_ded_wt_2 || existingMaster.supplier_net_wt || faMaster?.supplier_net_weight || inspMaster?.supplier_net_weight, faMaster?.weight_qtl || inspMaster?.weight_qtl),
            wt_ded_wt_3: toMtWeight(existingMaster.wt_ded_wt_3 || existingMaster.electronic_scale_net || faMaster?.electronic_net_weight || inspMaster?.electronic_net_weight, faMaster?.weight_qtl || inspMaster?.weight_qtl),
            summary_deduction_type: existingMaster.summary_deduction_type || deductionSummaryText || '',
            summary_deduction_rate: (Number(existingMaster.summary_deduction_rate) > 0) ? existingMaster.summary_deduction_rate : inspDeductionRate,
            summary_deduction_qty: (Number(existingMaster.summary_deduction_qty) > 0) ? existingMaster.summary_deduction_qty : (inspDeductionQty || (deductionSummaryText ? 1 : 0)),
            summary_deduction_amount: effectiveDeductionAmount,
            deductions: effectiveDeductions,
            summary_premium_wt: (existingMaster.summary_premium_wt !== undefined && existingMaster.summary_premium_wt !== null && Number(existingMaster.summary_premium_wt) > 0) 
              ? existingMaster.summary_premium_wt 
              : (existingMaster.summary_instl_rate || calculatedPremWtQtl),
            summary_premium_amount: (existingMaster.summary_premium_amount !== undefined && existingMaster.summary_premium_amount !== null && Number(existingMaster.summary_premium_amount) > 0)
              ? existingMaster.summary_premium_amount
              : calculatedPremRatePerQtl,
            val_premium_amt: (existingMaster.val_premium_amt !== undefined && existingMaster.val_premium_amt !== null && Number(existingMaster.val_premium_amt) > 0)
              ? existingMaster.val_premium_amt
              : calculatedPremTotalAmt,
            val_ex_short: isLastMr
              ? (Number(existingMaster.val_ex_short) > 0 ? existingMaster.val_ex_short : Number(saudaDedRecord?.deduction_amount || 0))
              : Number(existingMaster.val_ex_short || 0),
            val_less_amt: Number(existingMaster.val_less_amt || 0),
            summary_delivery_claim: (existingMaster.summary_delivery_claim === 5550) ? 0 : (Number(existingMaster.summary_delivery_claim) || 0),
            arival_apmc_fees: (Number(existingMaster.arival_apmc_fees) > 0) ? existingMaster.arival_apmc_fees : resolvedArrivalApmcFees,
            actual_apmc_fees: Math.round(Number(existingMaster.actual_apmc_fees) || 0),
            final_on_ac_adv: (existingMaster.final_on_ac_adv && Number(existingMaster.final_on_ac_adv) > 0) ? Number(existingMaster.final_on_ac_adv) : syncedPaidAmount
          };
          setMasterData(mergedMaster);

          const { data: existingDetails } = await supabase
            .from('mr_settlement_detail')
            .select('*')
            .eq('mr_no', targetMrNo)
            .order('col_index', { ascending: true });

          const fallbackCols = buildAlignedSettlementColumns(
            poDetails,
            inspDetails,
            faGridArr,
            faMaster,
            inspMaster,
            poData,
            gList,
            agList,
            mList,
            arList,
            matchedPayDetails
          );

          if (existingDetails && existingDetails.length > 0) {
            // Fill columns up to 4, backfilling missing fields if necessary
            const newCols = [1, 2, 3, 4].map(idx => {
              const dbMatch = existingDetails.find(d => d.col_index === idx);
              const fallbackCol = fallbackCols[idx - 1] || emptyDetailColumn(idx);

              if (dbMatch) {
                const merged: SettlementDetailColumn = {
                  ...emptyDetailColumn(idx),
                  ...fallbackCol,
                  ...dbMatch
                };
                if (!merged.grade && fallbackCol.grade) merged.grade = fallbackCol.grade;
                if (!merged.area && fallbackCol.area) merged.area = fallbackCol.area;
                if (!merged.agency && fallbackCol.agency) merged.agency = fallbackCol.agency;
                if (!merged.marka_crop && fallbackCol.marka_crop) merged.marka_crop = fallbackCol.marka_crop;
                if (!merged.quantity && fallbackCol.quantity) merged.quantity = fallbackCol.quantity;
                if (!merged.arr_qty_wt && fallbackCol.arr_qty_wt) merged.arr_qty_wt = fallbackCol.arr_qty_wt;
                if (merged.arr_qty_wt > 0 && (!merged.min_qty_wt || Number(merged.min_qty_wt) === Number(merged.arr_qty_wt))) {
                  merged.min_qty_wt = Number((merged.arr_qty_wt * 0.97).toFixed(3));
                }
                if (merged.arr_qty_wt > 0 && merged.quantity > 0 && (!merged.wt_quantity || merged.wt_quantity === 0)) {
                  const arrWtKg = merged.arr_qty_wt <= 50 ? merged.arr_qty_wt * 1000 : merged.arr_qty_wt;
                  merged.wt_quantity = Math.round(arrWtKg / merged.quantity);
                  merged.wt_phota = merged.wt_quantity;
                }
                // Preserve original PO rate from fallbackCol when available
                if (fallbackCol.rate_value && Number(fallbackCol.rate_value) > 0) {
                  merged.rate_value = fallbackCol.rate_value;
                }
                if (!merged.premium && fallbackCol.premium) {
                  merged.premium = fallbackCol.premium;
                }
                if (merged.gd_sett == null || merged.gd_sett === 0) merged.gd_sett = fallbackCol.gd_sett;
                if (merged.gd_claim == null || merged.gd_claim === 0) merged.gd_claim = fallbackCol.gd_claim;
                if (merged.moist_sett == null || merged.moist_sett === 0) merged.moist_sett = fallbackCol.moist_sett;
                if (merged.moist_claim == null || merged.moist_claim === 0) merged.moist_claim = fallbackCol.moist_claim;
                if (merged.dust_sett == null || merged.dust_sett === 0) merged.dust_sett = fallbackCol.dust_sett;
                if (merged.dust_claim == null || merged.dust_claim === 0) merged.dust_claim = fallbackCol.dust_claim;
                if (merged.ncv_sett == null || merged.ncv_sett === 0) merged.ncv_sett = fallbackCol.ncv_sett;
                if (merged.ncv_claim == null || merged.ncv_claim === 0) merged.ncv_claim = fallbackCol.ncv_claim;

                merged.sett_pct = (dbMatch.sett_pct !== undefined && Number(dbMatch.sett_pct) > 0)
                  ? Number(dbMatch.sett_pct)
                  : (Number(merged.gd_sett) > 0 ? Number(merged.gd_sett) : Number(fallbackCol.sett_pct || merged.gd_claim || 0));
                merged.deduction_rate = (dbMatch.deduction_rate !== undefined && Number(dbMatch.deduction_rate) > 0)
                  ? Number(dbMatch.deduction_rate)
                  : Number(fallbackCol.deduction_rate || 0);
                merged.sett_rate = getEffectiveColSettRate(merged);
                merged.quantity_qtl = Number((getColWtMt(merged) * 10).toFixed(2));
                merged.amount = getColAmount(merged);
                return merged;
              }
              return fallbackCol;
            });
            setDetailCols(newCols);
          } else {
            setDetailCols(fallbackCols);
          }
          if (existingMaster.po_no) {
          setSelectedPoNo(existingMaster.po_no);
          handlePoNoSelection(existingMaster.po_no, true);
        }
          setSuccessMessage(`Loaded existing Settlement Report for M.R. No. ${targetMrNo}`);
          return;
        }
      }

      const toMtWeightNew = (primaryVal: any, fallbackQtlVal?: any): number => {
        const p = Number(primaryVal) || 0;
        if (p > 0) {
          if (p > 500) return Number((p / 1000).toFixed(3));
          if (p > 50) return Number((p / 10).toFixed(3));
          return Number(p.toFixed(3));
        }
        const q = Number(fallbackQtlVal) || 0;
        if (q > 0) {
          return Number((q / 10).toFixed(3));
        }
        return 0;
      };

      // 2. Build new settlement from final_arrival / mill_inspection_master
      if (faMaster || inspMaster) {
        setIsEdit(false);
        const resolvedMrNo = faMaster?.mr_no || faMaster?.final_arrival_no || inspMaster?.mr_no || inspMaster?.arrival_no || targetMrNo;

        const challanMt = toMtWeightNew(
          faMaster?.challan_material_weight || inspMaster?.challan_material_weight,
          faMaster?.weight_qtl || inspMaster?.weight_qtl
        );
        const supplierNetMt = toMtWeightNew(
          faMaster?.supplier_net_weight || inspMaster?.supplier_net_weight || ((Number(faMaster?.supplier_challan_gross) || 0) - (Number(faMaster?.supplier_tare_weight) || 0)),
          faMaster?.weight_qtl || inspMaster?.weight_qtl
        );
        const electronicNetMt = toMtWeightNew(
          faMaster?.electronic_net_weight || inspMaster?.electronic_net_weight || ((Number(faMaster?.electronic_gross_weight) || 0) - (Number(faMaster?.electronic_tare_weight) || 0)),
          faMaster?.weight_qtl || inspMaster?.weight_qtl
        );

        const prefilledMaster: SettlementMaster = {
          ...initialMaster(),
          mr_no: resolvedMrNo,
          mr_date: faMaster?.date || faMaster?.mr_date || inspMaster?.mr_date || inspMaster?.arrival_date || '',
          po_type: 'MILL_PO',
          broker: faMaster?.broker || inspMaster?.broker_name || inspMaster?.broker || '',
          supplier: faMaster?.supplier || inspMaster?.supplier_name || inspMaster?.supplier || '',
          chn_supplier: faMaster?.challan_supplier || faMaster?.supplier || inspMaster?.supplier_name || inspMaster?.supplier || '',
          po_no: faMaster?.po_no || inspMaster?.po_no || '',
          po_date: faMaster?.po_date || inspMaster?.po_date || '',
          rate_qntl: Number(poData?.rate_qntl || poData?.rate_mt || poData?.b_rate || 0),
          lorry_number: faMaster?.lorry_number || faMaster?.final_arrival_no || inspMaster?.lorry_number || inspMaster?.arrival_no || '',
          arrival_no: faMaster?.final_arrival_no || faMaster?.arrival_no || inspMaster?.arrival_no || '',
          arrival_date: formatToInputDate(faMaster?.date || faMaster?.arrival_date || inspMaster?.arrival_date) || '',
          remarks: faMaster?.remarks || inspMaster?.remarks || '',
          challan_weight: challanMt,
          supplier_net_wt: supplierNetMt,
          electronic_scale_net: electronicNetMt,
          wt_ded_wt_1: challanMt,
          wt_ded_wt_2: supplierNetMt,
          wt_ded_wt_3: electronicNetMt,
          summary_deduction_type: deductionSummaryText || '',
          summary_deduction_rate: inspDeductionRate,
          summary_deduction_qty: inspDeductionQty > 0 ? inspDeductionQty : (deductionSummaryText ? 1 : 0),
          summary_deduction_amount: inspDeductionAmount,
          deductions: parsedDeductions,
          summary_premium_wt: calculatedPremWtQtl,
          summary_instl_rate: calculatedPremWtQtl,
          summary_premium_amount: calculatedPremRatePerQtl,
          val_premium_amt: calculatedPremTotalAmt,
          val_ex_short: (isLastMr && saudaDedRecord && Number(saudaDedRecord.deduction_amount) > 0) ? Number(saudaDedRecord.deduction_amount) : 0,
          val_less_amt: 0,
          arival_apmc_fees: resolvedArrivalApmcFees,
          final_apmc_fees: 0,
          final_on_ac_adv: syncedPaidAmount
        };

        const populatedCols = buildAlignedSettlementColumns(
          poDetails,
          inspDetails,
          faGridArr,
          faMaster,
          inspMaster,
          poData,
          gList,
          agList,
          mList,
          arList,
          matchedPayDetails
        );

        const activeColsCount = populatedCols.filter(c => 
          (Number(c.quantity) || 0) > 0 || (Number(c.arr_qty_wt) || 0) > 0 || (Number(c.wt_quantity) || 0) > 0
        ).length || 1;

        populatedCols.forEach(c => {
          const isActive = (Number(c.quantity) || 0) > 0 || (Number(c.arr_qty_wt) || 0) > 0 || (Number(c.wt_quantity) || 0) > 0;
          if (!isActive) {
            c.gd_claim = 0;
            c.gd_sett = 0;
            c.moist_claim = 0;
            c.moist_sett = 0;
            c.dust_claim = 0;
            c.dust_sett = 0;
            c.ncv_claim = 0;
            c.ncv_sett = 0;
            c.po_grade_claim = 0;
            c.po_grade_sett = 0;
            c.claim_settlement = 0;
          } else if (inspMaster) {
            if (c.moist_claim === 0 && inspMaster.claim_moisture != null) c.moist_claim = Number((Number(inspMaster.claim_moisture) / activeColsCount).toFixed(2));
            if (c.dust_claim === 0 && inspMaster.claim_dust != null) c.dust_claim = Number((Number(inspMaster.claim_dust) / activeColsCount).toFixed(2));
            if (c.ncv_claim === 0 && inspMaster.claim_ncv != null) c.ncv_claim = Number((Number(inspMaster.claim_ncv) / activeColsCount).toFixed(2));
            if (c.gd_claim === 0 && inspMaster.claim_grade_down != null) c.gd_claim = Number((Number(inspMaster.claim_grade_down) / activeColsCount).toFixed(2));
          }
          const gdF = (Number(c.gd_claim || 0) - Number(c.gd_sett || 0));
          const mF = (Number(c.moist_claim || 0) - Number(c.moist_sett || 0));
          const dF = (Number(c.dust_claim || 0) - Number(c.dust_sett || 0));
          const nF = (Number(c.ncv_claim || 0) - Number(c.ncv_sett || 0));
          c.claim_settlement = Number((gdF + mF + dF + nF).toFixed(2));
        });

        setMasterData(prefilledMaster);
        setDetailCols(populatedCols);
        if (prefilledMaster.po_no) {
          setSelectedPoNo(prefilledMaster.po_no);
          handlePoNoSelection(prefilledMaster.po_no, true);
        }
        setSuccessMessage(`Prepopulated settlement data successfully from Final M.R. [${resolvedMrNo}]`);
        return;
      }

      // 3. Fallback: load fields from mill_inspection_master
      if (!inspMaster) {
        alert(`No Quality Inspection or Final Arrival details found for MR No "${targetMrNo}". Please verify quality entry.`);
        setLoading(false);
        return;
      }

      setIsEdit(false);
      const fbChallanMt = toMtWeightNew(inspMaster.challan_material_weight, inspMaster.weight_qtl);
      const fbSupplierMt = toMtWeightNew(inspMaster.supplier_net_weight, inspMaster.weight_qtl);
      const fbElectronicMt = toMtWeightNew(inspMaster.electronic_net_weight, inspMaster.weight_qtl);

      const prefilledMaster: SettlementMaster = {
        ...initialMaster(),
        mr_no: inspMaster.mr_no || '',
        po_type: 'MILL_PO',
        broker: inspMaster.broker_name || '',
        supplier: inspMaster.supplier_name || '',
        chn_supplier: inspMaster.supplier_name || '',
        po_no: inspMaster.po_no || '',
        po_date: inspMaster.po_date || '',
        rate_qntl: Number(poData?.rate_qntl || poData?.rate_mt || poData?.b_rate || 0),
        lorry_number: inspMaster.lorry_number || inspMaster.arrival_no || '',
        detention_days: inspMaster.detention_days || 0,
        arrival_no: inspMaster.arrival_no || '',
        arrival_date: formatToInputDate(inspMaster.arrival_date) || '',
        remarks: inspMaster.remarks || '',
        challan_weight: fbChallanMt,
        supplier_net_wt: fbSupplierMt,
        electronic_scale_net: fbElectronicMt,
        wt_ded_wt_1: fbChallanMt,
        wt_ded_wt_2: fbSupplierMt,
        wt_ded_wt_3: fbElectronicMt,
        summary_deduction_type: deductionSummaryText || '',
        summary_deduction_rate: inspDeductionRate,
        summary_deduction_qty: inspDeductionQty > 0 ? inspDeductionQty : (deductionSummaryText ? 1 : 0),
        summary_deduction_amount: inspDeductionAmount,
        deductions: parsedDeductions,
        summary_premium_wt: calculatedPremWtQtl,
        summary_instl_rate: calculatedPremWtQtl,
        summary_premium_amount: calculatedPremRatePerQtl,
        val_premium_amt: calculatedPremTotalAmt,
        val_ex_short: (isLastMr && saudaDedRecord && Number(saudaDedRecord.deduction_amount) > 0) ? Number(saudaDedRecord.deduction_amount) : 0,
        val_less_amt: 0,
        arival_apmc_fees: resolvedArrivalApmcFees,
        final_apmc_fees: 0,
        final_on_ac_adv: syncedPaidAmount
      };

      const populatedCols = buildAlignedSettlementColumns(
        poDetails,
        inspDetails,
        [],
        null,
        inspMaster,
        poData,
        gList,
        agList,
        mList,
        arList,
        matchedPayDetails
      );

      const activeColsCountFallback = populatedCols.filter(c => 
        (Number(c.quantity) || 0) > 0 || (Number(c.arr_qty_wt) || 0) > 0 || (Number(c.wt_quantity) || 0) > 0
      ).length || 1;

      populatedCols.forEach(c => {
        const isActive = (Number(c.quantity) || 0) > 0 || (Number(c.arr_qty_wt) || 0) > 0 || (Number(c.wt_quantity) || 0) > 0;
        if (!isActive) {
          c.gd_claim = 0;
          c.gd_sett = 0;
          c.moist_claim = 0;
          c.moist_sett = 0;
          c.dust_claim = 0;
          c.dust_sett = 0;
          c.ncv_claim = 0;
          c.ncv_sett = 0;
          c.po_grade_claim = 0;
          c.po_grade_sett = 0;
          c.claim_settlement = 0;
        } else if (inspMaster) {
          if (c.moist_claim === 0 && inspMaster.claim_moisture != null) c.moist_claim = Number((Number(inspMaster.claim_moisture) / activeColsCountFallback).toFixed(2));
          if (c.dust_claim === 0 && inspMaster.claim_dust != null) c.dust_claim = Number((Number(inspMaster.claim_dust) / activeColsCountFallback).toFixed(2));
          if (c.ncv_claim === 0 && inspMaster.claim_ncv != null) c.ncv_claim = Number((Number(inspMaster.claim_ncv) / activeColsCountFallback).toFixed(2));
          if (c.gd_claim === 0 && inspMaster.claim_grade_down != null) c.gd_claim = Number((Number(inspMaster.claim_grade_down) / activeColsCountFallback).toFixed(2));
        }
        const gdF = (Number(c.gd_claim || 0) - Number(c.gd_sett || 0));
        const mF = (Number(c.moist_claim || 0) - Number(c.moist_sett || 0));
        const dF = (Number(c.dust_claim || 0) - Number(c.dust_sett || 0));
        const nF = (Number(c.ncv_claim || 0) - Number(c.ncv_sett || 0));
        c.claim_settlement = Number((gdF + mF + dF + nF).toFixed(2));
      });

      setMasterData(prefilledMaster);
      setDetailCols(populatedCols);
      if (inspMaster.po_no) setSelectedPoNo(inspMaster.po_no);
      setSuccessMessage(`Prepopulated settlement data successfully using MR No. ${targetMrNo}`);

    } catch (err: any) {
      setErrorMessage("Proceed fail: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Ensure selectedPoData is in sync whenever PO number changes
  useEffect(() => {
    const targetPo = masterData.po_no || selectedPoNo;
    if (!targetPo || !supabase) {
      return;
    }
    if (selectedPoData && selectedPoData.po_no === targetPo) return;

    supabase
      .from('purchase_master')
      .select('*')
      .eq('po_no', targetPo)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSelectedPoData(data);
      });
  }, [masterData.po_no, selectedPoNo]);

  // Live Auto Calculations based on inputs
  useEffect(() => {
    if (viewMode !== 'entry') return;

    // Calculators
    let totalQtyWeightClaims = 0;

    // Calculate Rate / m.T (Weighted Average Rate per Metric Ton across all 4 columns)
    const calculatedRatePerMt = calculateWeightedRatePerMT(detailCols);
    const nextRatePerMt = calculatedRatePerMt > 0 ? calculatedRatePerMt : (masterData.summary_rate_qtel || 0);

    // Calculate Moisture Claim % as the Average of "Final (%)" from Grade Spec Table (Moisture % row)
    const activeMoistCols = detailCols.filter(col => {
      const isColActive = (Number(col.quantity) || 0) > 0 || (Number(col.arr_qty_wt) || 0) > 0 || (Number(col.wt_quantity) || 0) > 0 || (col.grade && col.grade.trim() !== '');
      return isColActive;
    });

    let avgFinalMoisturePct = 0;
    if (activeMoistCols.length > 0) {
      const sumMoist = activeMoistCols.reduce((sum, col) => {
        const mVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
        return sum + mVal;
      }, 0);
      avgFinalMoisturePct = Number((sumMoist / activeMoistCols.length).toFixed(2));
    } else {
      const colsWithMoist = detailCols.filter(col => {
        const mVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
        return mVal > 0;
      });
      if (colsWithMoist.length > 0) {
        const sumMoist = colsWithMoist.reduce((sum, col) => {
          const mVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
          return sum + mVal;
        }, 0);
        avgFinalMoisturePct = Number((sumMoist / colsWithMoist.length).toFixed(2));
      }
    }

    const calculatedRateWtClaim = avgFinalMoisturePct;

    // Calculate auto Delivery Claim (-) penalty if delivery is received after PO delivery_to date
    const poDeliveryToDate = selectedPoData?.delivery_to || selectedPoData?.delivery_gt_to || selectedPoData?.shipment_date || selectedPoData?.delivery_to_date;
    const poDeliveryPenaltyRate = Number(selectedPoData?.delivery_penalty || selectedPoData?.shipment_penalty || 0);
    const arrivalVoucherDate = masterData.arrival_date || masterData.sett_date || (masterData as any).challan_date;
    const deliveryDelayDays = calculateDeliveryDelayDays(poDeliveryToDate, arrivalVoucherDate);

    const totalArrWeightMt = Math.round((detailCols.reduce((sum, col) => {
      const colWt = Number(col.arr_qty_wt) > 0 
        ? Number(col.arr_qty_wt) 
        : (Number(col.wt_quantity) > 0 ? Number(col.wt_quantity) : 0);
      return sum + colWt;
    }, 0) || Number(masterData.electronic_scale_net) || 0) * 1000) / 1000;
    const totalArrWeightQtl = Math.round(totalArrWeightMt * 10 * 100) / 100;

    const autoDeliveryClaimAmt = (deliveryDelayDays > 0 && poDeliveryPenaltyRate > 0 && totalArrWeightQtl > 0)
      ? Math.round(totalArrWeightQtl * poDeliveryPenaltyRate * deliveryDelayDays)
      : 0;

    // Delivery Claim in Grade-wise summary panel: auto-calculated penalty unless manually set
    const deliveryClaimAmt = (masterData.summary_delivery_claim !== undefined && masterData.summary_delivery_claim !== null && masterData.summary_delivery_claim !== 0 && Number(masterData.summary_delivery_claim) !== 5550)
      ? Number(masterData.summary_delivery_claim)
      : autoDeliveryClaimAmt;

    // 1. Grand Total = Sum of Gross Column Values from active visible columns (matching Grand Total card)
    const grandTotal = visibleSpecCols.reduce((sum, idx) => sum + getColAmount(detailCols[idx - 1]), 0);

    detailCols.forEach(col => {
      // Total Claim calculation for column: Grade Down (%) + Moisture (%) + Dust (%) + NCV (%)
      const gdVal = Number(col.gd_sett) > 0 ? Number(col.gd_sett) : Number(col.gd_claim || 0);
      const mVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
      const dVal = Number(col.dust_sett) > 0 ? Number(col.dust_sett) : Number(col.dust_claim || 0);
      const nVal = Number(col.ncv_sett) > 0 ? Number(col.ncv_sett) : Number(col.ncv_claim || 0);
      col.claim_settlement = Number((gdVal + mVal + dVal + nVal).toFixed(2));

      // Grade Claim calculation logic: Claim - Sett
      const claimTotal = (Number(col.gd_claim) + Number(col.moist_claim) + Number(col.dust_claim) + Number(col.ncv_claim));
      const settTotal = (Number(col.gd_sett) + Number(col.moist_sett) + Number(col.dust_sett) + Number(col.ncv_sett));
      
      const colClaimValue = Math.max(0, claimTotal - settTotal) * Number(col.quantity);
      totalQtyWeightClaims += colClaimValue;
    });

    // Material valuation summaries
    const finalExShort = Number(masterData.val_ex_short) || 0;
    const finalLessAmount = 0;
    const calculatedDeductionAmount = Number(masterData.summary_deduction_amount) || 0;

    // 2. Material Value / Grand Total (Show only Grand Total value)
    const calculatedMaterialValue = Number(grandTotal.toFixed(2));

    // Calculate Premium Amount: Premium Rate (₹/Qtl) * Premium WT (in Qtl)
    // Note: If column premiums are already factored into each column's Sett Rate & Amount, do not double-add them to payable_amt
    const hasColumnPremiums = detailCols.some(c => Number(c.premium) > 0 && getColWtMt(c) > 0);
    const premiumRatePerQtl = Number(masterData.summary_premium_amount) || 0;
    const premiumWeightQtl = (masterData.summary_premium_wt !== undefined && masterData.summary_premium_wt !== null && Number(masterData.summary_premium_wt) > 0)
      ? Number(masterData.summary_premium_wt)
      : Number(masterData.summary_less_amount || 0);
    const calculatedPremiumAmount = hasColumnPremiums ? 0 : Number((premiumRatePerQtl * premiumWeightQtl).toFixed(2));
    const finalPremiumAmount = hasColumnPremiums
      ? 0
      : Number(masterData.val_premium_amt !== undefined && masterData.val_premium_amt !== null && masterData.val_premium_amt !== 0 ? masterData.val_premium_amt : calculatedPremiumAmount);

    // APMC Fees = Arrival APMC Fees - Actual APMC Fees
    // Actual APMC Fees (1%) = 1% × (Material Value − Delivery Claim − Deduction Amount − Deduction Claim Total − Excess/Short Amount)
    // Not applicable (0) when Area is BANGLADESH, BIHAR, LOWER ASSAM, ORISSA, or UPPER ASSAM
    const isExemptArea = isSettlementApmcExempt(
      detailCols.map(c => ({ ...c, area: resolveAreaName(c.area, areaMasterList) || c.area })),
      selectedPoData
    );
    const deductionClaimTotal = Number(masterData.val_qty_claim) || 0;
    const adjustedMaterialValue = Math.max(
      0,
      calculatedMaterialValue 
      - deliveryClaimAmt 
      - calculatedDeductionAmount 
      - deductionClaimTotal 
      - finalExShort
    );
    const calculatedApmcFees = isExemptArea ? 0 : Math.round(adjustedMaterialValue * 0.01);
    const arrivalApmcFees = Number(masterData.arival_apmc_fees) || 0;
    const actualApmcFees = calculatedApmcFees;
    const finalApmcFees = Math.min(0, Number((arrivalApmcFees - actualApmcFees).toFixed(2)));

    // Valuation calculation = Material Value + Add Amt + Premium Amt - Val Less Amt - Qty Claim
    const calculatedValuationVal = Number((
      calculatedMaterialValue 
      + Number(masterData.val_add_amt || 0) 
      + finalPremiumAmount 
      - finalLessAmount 
      - deductionClaimTotal 
      - Number(masterData.val_less_amt || 0)
    ).toFixed(2));

    const cstAmt = (calculatedMaterialValue * (Number(masterData.final_cst_pct_amt) || 0)) / 100;

    // TOTAL LESS / DEDUCTIONS =
    // On/Account Advance + Delivery Claim + Misc Less + Deduction Amount + Valuation Less Amount + Deduction Claim Total + Ex/Short
    const onAcAdvVal = Number(masterData.final_on_ac_adv || 0);
    const deliveryClaimVal = Number(deliveryClaimAmt || 0);
    const miscLessVal = Number(masterData.summary_misc_less || 0);
    const valLessAmtVal = Number(masterData.val_less_amt || 0) + Number(masterData.final_less_adv || 0);
    const totalLessDeductions = Number((
      onAcAdvVal +
      deliveryClaimVal +
      miscLessVal +
      calculatedDeductionAmount +
      valLessAmtVal +
      deductionClaimTotal +
      finalExShort
    ).toFixed(2));

    // TOTAL ADDITIONS =
    // APMC Fees + Premium Amount + Add Amount + Misc Add (+ CST)
    const addAmtVal = Number(masterData.val_add_amt || 0);
    const miscAddVal = Number(masterData.summary_misc_add || 0);
    const totalAdditions = Number((
      finalApmcFees +
      finalPremiumAmount +
      addAmtVal +
      miscAddVal +
      cstAmt
    ).toFixed(2));

    // RESOLVED PAYABLE ACCOUNT = GRAND TOTAL − TOTAL LESS/Deductions + TOTAL ADDITIONS
    const calculatedPayable = Number((
      calculatedMaterialValue - totalLessDeductions + totalAdditions
    ).toFixed(2));

    // Only update if changes to prevent cycling
    setMasterData(prev => {
      const nextActualApmcFees = calculatedApmcFees;
      const targetRateAffCdCl = prev.summary_rate_aff_cd_cl > 0 ? prev.summary_rate_aff_cd_cl : nextRatePerMt;

      const targetDeliveryClaim = (prev.summary_delivery_claim !== undefined && prev.summary_delivery_claim !== null && prev.summary_delivery_claim !== 0 && Number(prev.summary_delivery_claim) !== 5550)
        ? Number(prev.summary_delivery_claim)
        : autoDeliveryClaimAmt;

      if (
        prev.summary_material_value !== calculatedMaterialValue ||
        prev.val_material_value !== calculatedMaterialValue ||
        prev.payable_amt !== calculatedPayable ||
        prev.val_less_amount !== finalLessAmount ||
        prev.final_apmc_fees !== finalApmcFees ||
        prev.summary_rate_wt_claim !== calculatedRateWtClaim ||
        prev.summary_rate_aff_cd_cl !== targetRateAffCdCl ||
        prev.val_premium_amt !== calculatedPremiumAmount ||
        prev.summary_delivery_claim !== targetDeliveryClaim ||
        prev.actual_apmc_fees !== nextActualApmcFees ||
        (calculatedRatePerMt > 0 && (prev.summary_rate_qtel !== nextRatePerMt || prev.rate_qntl !== nextRatePerMt))
      ) {
        return {
          ...prev,
          summary_material_value: calculatedMaterialValue,
          val_material_value: calculatedMaterialValue,
          value_amt: calculatedMaterialValue,
          val_less_amount: finalLessAmount,
          payable_amt: calculatedPayable,
          net_amt: calculatedPayable,
          actual_apmc_fees: nextActualApmcFees,
          final_apmc_fees: finalApmcFees,
          summary_rate_qtel: nextRatePerMt,
          rate_qntl: nextRatePerMt,
          summary_rate_aff_cd_cl: targetRateAffCdCl,
          summary_rate_wt_claim: calculatedRateWtClaim,
          val_premium_amt: calculatedPremiumAmount,
          summary_delivery_claim: targetDeliveryClaim
        };
      }
      return prev;
    });

  }, [detailCols, visibleSpecCols, areaMasterList, masterData.electronic_scale_net, masterData.summary_rate_aff_cd_cl, masterData.summary_rate_qtel, masterData.summary_premium_amount, masterData.summary_premium_wt, masterData.summary_deduction_amount, masterData.summary_delivery_claim, masterData.val_add_amt, masterData.val_less_amt, masterData.val_qty_claim, masterData.val_ex_short, masterData.summary_less_amount, masterData.final_less_adv, masterData.final_on_ac_adv, masterData.final_cst_pct_amt, masterData.actual_apmc_fees, masterData.arival_apmc_fees, masterData.arrival_date, masterData.sett_date, selectedPoData]);

  // Handle master updates
  const handleMasterChange = (field: keyof SettlementMaster, value: any) => {
    setMasterData(prev => ({ ...prev, [field]: value }));
  };

  // Handle multi-row deductions updates
  const handleDeductionRowChange = (index: number, field: keyof SettlementDeductionItem, value: any) => {
    setMasterData(prev => {
      const currentDeductions: SettlementDeductionItem[] = (prev.deductions && prev.deductions.length > 0)
        ? [...prev.deductions]
        : [{
            deduction_type: prev.summary_deduction_type || '',
            deduction_rate: prev.summary_deduction_rate || 0,
            deduction_qty: prev.summary_deduction_qty || 1,
            deduction_amount: prev.summary_deduction_amount || 0
          }];
      
      const updatedRow = { ...currentDeductions[index], [field]: value };
      if (field === 'deduction_rate' || field === 'deduction_qty') {
        const rate = field === 'deduction_rate' ? (Number(value) || 0) : (Number(updatedRow.deduction_rate) || 0);
        const qty = field === 'deduction_qty' ? (Number(value) || 0) : (Number(updatedRow.deduction_qty) || 0);
        updatedRow.deduction_amount = Number((rate * qty).toFixed(2));
      }
      currentDeductions[index] = updatedRow;

      const totalDeductionAmt = Number(currentDeductions.reduce((s, r) => s + (Number(r.deduction_amount) || 0), 0).toFixed(2));
      const summaryTypes = currentDeductions
        .filter(r => r.deduction_type && r.deduction_type.trim() !== '')
        .map(r => {
          if (r.deduction_amount > 0) return `${r.deduction_type} (₹${r.deduction_amount})`;
          if (r.deduction_rate > 0 && r.deduction_qty > 0) return `${r.deduction_type} (${r.deduction_qty} @ ₹${r.deduction_rate})`;
          return r.deduction_type;
        })
        .join(', ');

      return {
        ...prev,
        deductions: currentDeductions,
        summary_deduction_amount: totalDeductionAmt,
        summary_deduction_type: summaryTypes || currentDeductions[0]?.deduction_type || '',
        summary_deduction_rate: currentDeductions[0]?.deduction_rate || 0,
        summary_deduction_qty: currentDeductions[0]?.deduction_qty || 1
      };
    });
  };

  const handleAddDeductionRow = () => {
    setMasterData(prev => {
      const currentDeductions: SettlementDeductionItem[] = (prev.deductions && prev.deductions.length > 0)
        ? [...prev.deductions]
        : [{
            deduction_type: prev.summary_deduction_type || '',
            deduction_rate: prev.summary_deduction_rate || 0,
            deduction_qty: prev.summary_deduction_qty || 1,
            deduction_amount: prev.summary_deduction_amount || 0
          }];
      currentDeductions.push({
        deduction_type: '',
        deduction_rate: 0,
        deduction_qty: 1,
        deduction_amount: 0
      });
      return {
        ...prev,
        deductions: currentDeductions
      };
    });
  };

  const handleRemoveDeductionRow = (index: number) => {
    setMasterData(prev => {
      const currentDeductions: SettlementDeductionItem[] = (prev.deductions && prev.deductions.length > 0)
        ? [...prev.deductions]
        : [];
      if (currentDeductions.length <= 1) {
        return {
          ...prev,
          deductions: [{ deduction_type: '', deduction_rate: 0, deduction_qty: 1, deduction_amount: 0 }],
          summary_deduction_type: '',
          summary_deduction_rate: 0,
          summary_deduction_qty: 0,
          summary_deduction_amount: 0
        };
      }
      currentDeductions.splice(index, 1);
      const totalDeductionAmt = Number(currentDeductions.reduce((s, r) => s + (Number(r.deduction_amount) || 0), 0).toFixed(2));
      const summaryTypes = currentDeductions
        .filter(r => r.deduction_type && r.deduction_type.trim() !== '')
        .map(r => r.deduction_type)
        .join(', ');

      return {
        ...prev,
        deductions: currentDeductions,
        summary_deduction_amount: totalDeductionAmt,
        summary_deduction_type: summaryTypes || currentDeductions[0]?.deduction_type || '',
        summary_deduction_rate: currentDeductions[0]?.deduction_rate || 0,
        summary_deduction_qty: currentDeductions[0]?.deduction_qty || 1
      };
    });
  };

  // Handle columns grid updates
  const handleColChange = (idx: number, field: keyof SettlementDetailColumn, value: any) => {
    setDetailCols(prev => {
      const isColActive = (col: SettlementDetailColumn) => {
        const qty = Number(col.quantity) || 0;
        const arrWt = Number(col.arr_qty_wt) || 0;
        const wtQty = Number(col.wt_quantity) || 0;
        return (qty > 0 || arrWt > 0 || wtQty > 0 || Boolean(col.grade));
      };

      const claimFields = ['gd_claim', 'moist_claim', 'dust_claim', 'ncv_claim', 'po_grade_claim'];
      if (claimFields.includes(field as string)) {
        return prev.map(c => {
          if (!isColActive(c)) {
            return { ...c, [field]: 0 };
          }
          if (c.col_index === idx) {
            const nextCol = { ...c, [field]: value };
            if (field === 'gd_claim' && (!nextCol.sett_pct || Number(nextCol.sett_pct) === 0)) {
              nextCol.sett_pct = Number(value) || 0;
              nextCol.gd_sett = Number(value) || 0;
            }
            return nextCol;
          }
          return c;
        });
      }

      return prev.map(c => {
        if (c.col_index !== idx) return c;
        const updated = { ...c, [field]: value };

        // Synchronize sett_pct <-> gd_sett
        if (field === 'sett_pct') {
          updated.gd_sett = Number(value) || 0;
        } else if (field === 'gd_sett') {
          updated.sett_pct = Number(value) || 0;
        }

        if (field === 'quantity' || field === 'arr_qty_wt' || field === 'wt_phota' || field === 'min_qty_wt') {
          const qty = Number(updated.quantity) || 0;
          const arrWt = Number(updated.arr_qty_wt) || 0;
          
          if (field === 'quantity' && qty === 0) {
            updated.wt_quantity = 0;
            updated.arr_qty_wt = 0;
            updated.min_qty_wt = 0;
            updated.wt_phota = 0;
            updated.gd_claim = 0;
            updated.gd_sett = 0;
            updated.sett_pct = 0;
            updated.deduction_rate = 0;
            updated.moist_claim = 0;
            updated.moist_sett = 0;
            updated.dust_claim = 0;
            updated.dust_sett = 0;
            updated.ncv_claim = 0;
            updated.ncv_sett = 0;
            updated.po_grade_claim = 0;
            updated.po_grade_sett = 0;
            updated.claim_settlement = 0;
          } else {
            // Auto update Min.Qty/Wt to 3% acceptable (97% of Arr. Qty/Wt) when Arr. Qty/Wt changes
            if (field === 'arr_qty_wt') {
              updated.min_qty_wt = arrWt > 0 ? Number((arrWt * 0.97).toFixed(3)) : 0;
            }
            // Auto update Wt/Quantity calculation: Round "Arr. Qty/Wt" convert in kg / Quantity (B)
            const arrWtKg = arrWt > 0 ? (arrWt <= 50 ? arrWt * 1000 : arrWt) : 0;
            if (qty > 0 && arrWtKg > 0) {
              updated.wt_quantity = Math.round(arrWtKg / qty);
              updated.wt_phota = updated.wt_quantity;
            } else if (qty > 0 && Number(updated.wt_phota) > 0) {
              updated.wt_quantity = Number(updated.wt_phota);
            }
          }
        }

        // Recalculate Satta Grade Down deduction, Sett Rate, Quantity (Qtl), and Amount
        const rateVal = Number(updated.rate_value) || 0;
        const premVal = Number(updated.premium) || 0;
        const settPctVal = updated.sett_pct !== undefined && updated.sett_pct !== null
          ? Number(updated.sett_pct)
          : (Number(updated.gd_sett) > 0 ? Number(updated.gd_sett) : Number(updated.gd_claim || 0));

        if (field !== 'deduction_rate') {
          const sattaObj = calculateSattaDeduction(
            updated.grade,
            rateVal,
            settPctVal,
            getCachedSattaDiffs(),
            gradeMasterList.map((g: any) => ({ code: g.grade_code || g.code || g.id, name: g.grade_name || g.name || g.grade })),
            updated.po_items,
            updated.lower_grade,
            updated.lower_grade_rate,
            prev
          );
          updated.deduction_rate = sattaObj.deduction;
          updated.target_lower_grade = sattaObj.targetGradeName;
          if (!updated.lower_grade) updated.lower_grade = sattaObj.targetGradeName;
          if (field !== 'lower_grade_rate') updated.lower_grade_rate = sattaObj.lowerRate;
          updated.grade_diff = sattaObj.diff;
        }

        const dedRateVal = Number(updated.deduction_rate) || 0;
        updated.sett_rate = rateVal > 0 ? Number((rateVal + premVal - dedRateVal).toFixed(2)) : 0;
        updated.quantity_qtl = Number((getColWtMt(updated) * 10).toFixed(2));
        updated.amount = Number((updated.quantity_qtl * updated.sett_rate).toFixed(2));

        return updated;
      });
    });
  };

  // Perform Db save/register
  const handleSaveSettlement = async (bypassAudit: boolean = false) => {
    if (isEdit && !enforceEditOrDeletePermission("Edit")) {
      return;
    }

    // Mandatory Validation for Bill No. and Bill Date
    const trimmedBillNo = (masterData.payable_bill_no || '').trim();
    const trimmedBillDate = (masterData.payable_bill_date || '').trim();

    if (!trimmedBillNo || !trimmedBillDate) {
      const missingFields = [];
      if (!trimmedBillNo) missingFields.push("Bill No.");
      if (!trimmedBillDate) missingFields.push("Bill Date");
      setErrorMessage(`Mandatory Field Error: Please enter ${missingFields.join(' and ')} before settling the account.`);
      return;
    }

    let targetMrNo = masterData.mr_no ? masterData.mr_no.trim() : '';
    if (!targetMrNo) {
      if (masterData.lorry_number) {
        const cleanLorry = masterData.lorry_number.trim().toUpperCase().replace(/\s+/g, '');
        targetMrNo = `MR-${cleanLorry}`;
      } else if (masterData.po_no) {
        targetMrNo = `MR-PO-${masterData.po_no.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
      } else {
        targetMrNo = `MR-${Date.now().toString().slice(-6)}`;
      }
      setMasterData(prev => ({ ...prev, mr_no: targetMrNo }));
    }

    // Validate that settlement_weight (we check both totalSettleQty and electronic_scale_net / challan_weight)
    // does not exceed pendingReceivedQty
    const totalSettleQty = detailCols.reduce((sum, c) => sum + getColWtMt(c), 0);
    const activeWeight = Math.max(
      totalSettleQty, 
      Number(masterData.electronic_scale_net) || 0, 
      Number(masterData.challan_weight) || 0
    );

    let allowedWeight = poStats ? poStats.pendingReceivedQty : 0;
    if (isEdit && selectedPoNo) {
      // Find if there was an existing record for this mr_no in customSettlementRecords
      const existingRecord = customSettlementRecords.find(r => r.mr_no === targetMrNo || r.id === masterData.settlement_id);
      if (existingRecord) {
        allowedWeight += (Number(existingRecord.quantity) || 0);
      }
    }

    if (!bypassAudit && poStats && activeWeight > allowedWeight && allowedWeight > 0) {
      setAuditOverwriteInfo({
        activeWeight,
        allowedWeight,
        selectedPoNo: selectedPoNo || masterData.po_no || 'N/A',
        targetMrNo
      });
      setShowAuditOverwriteModal(true);
      setErrorMessage(`Validation Failure (Audit Block): The settlement weight of ${activeWeight.toFixed(3)} MT exceeds the currently calculated 'pending_received' limit of ${allowedWeight.toFixed(3)} MT for selected PO ${selectedPoNo}. Click 'Authorize & Overwrite' to confirm and save.`);
      return;
    }

    // Close overwrite modal if open
    setShowAuditOverwriteModal(false);

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (!supabase) throw new Error("Supabase client is not available.");

      // 1. Insert or Update Master via resilient dbModule.upsert
      const masterPayload = {
        mr_no: targetMrNo,
        sett_date: masterData.sett_date,
        po_type: masterData.po_type,
        broker: masterData.broker,
        supplier: masterData.supplier,
        chn_supplier: masterData.chn_supplier,
        po_no: masterData.po_no,
        po_date: masterData.po_date || null,
        lorry_number: masterData.lorry_number,
        auto_ho_settlement: masterData.auto_ho_settlement,
        detention_days: Number(masterData.detention_days) || 0,
        arrival_no: masterData.arrival_no,
        arrival_date: masterData.arrival_date || null,
        arival_apmc_fees: Number(masterData.arival_apmc_fees) || 0,
        actual_apmc_fees: Math.round(Number(masterData.actual_apmc_fees) || 0),
        remarks: masterData.remarks,
        summary_rate_qtel: Number(masterData.summary_rate_qtel) || 0,
        summary_rate_aff_cd_cl: Number(masterData.summary_rate_aff_cd_cl) || 0,
        summary_delivery_claim: Number(masterData.summary_delivery_claim) || 0,
        summary_rate_wt_claim: Number(masterData.summary_rate_wt_claim) || 0,
        summary_instl_rate: Number(masterData.summary_premium_wt ?? masterData.summary_instl_rate ?? 0),
        summary_premium_wt: Number(masterData.summary_premium_wt ?? 0),
        summary_material_value: Number(masterData.summary_material_value) || 0,
        summary_misc_add: Number(masterData.summary_misc_add) || 0,
        summary_misc_less: Number(masterData.summary_misc_less) || 0,
        summary_premium_amount: Number(masterData.summary_premium_amount) || 0,
        summary_less_amount: Number(masterData.summary_less_amount) || 0,
        summary_instl_amount: Number(masterData.summary_instl_amount) || 0,
        summary_deduction_type: masterData.summary_deduction_type || '',
        summary_deduction_rate: Number(masterData.summary_deduction_rate) || 0,
        summary_deduction_qty: Number(masterData.summary_deduction_qty) || 0,
        summary_deduction_amount: Number(masterData.summary_deduction_amount) || 0,
        deductions: masterData.deductions || [],
        val_material_value: Number(masterData.val_material_value) || 0,
        val_add_amt: Number(masterData.val_add_amt) || 0,
        val_less_amt: Number(masterData.val_less_amt) || 0,
        val_premium_amt: Number(masterData.val_premium_amt) || 0,
        val_less_amount: Number(masterData.val_less_amount) || 0,
        val_qty_claim: Number(masterData.val_qty_claim) || 0,
        val_ex_short: Number(masterData.val_ex_short) || 0,
        final_less_adv: Number(masterData.final_less_adv) || 0,
        final_on_ac_adv: Number(masterData.final_on_ac_adv) || 0,
        final_apmc_fees: Number(masterData.final_apmc_fees) || 0,
        final_cst_pct_amt: Number(masterData.final_cst_pct_amt) || 0,
        payable_amt: Number(masterData.payable_amt) || 0,
        payable_bill_no: masterData.payable_bill_no,
        payable_bill_date: masterData.payable_bill_date || null,
        wt_ded_wt_1: Number(masterData.wt_ded_wt_1) || 0,
        wt_ded_wt_2: Number(masterData.wt_ded_wt_2) || 0,
        wt_ded_wt_3: Number(masterData.wt_ded_wt_3) || 0,
        rate_qntl: Number(masterData.rate_qntl) || 0,
        value_amt: Number(masterData.value_amt) || 0,
        adjustment_amt: Number(masterData.adjustment_amt) || 0,
        net_amt: Number(masterData.net_amt) || 0,
        challan_weight: Number(masterData.challan_weight) || 0,
        supplier_net_wt: Number(masterData.supplier_net_wt) || 0,
        electronic_scale_net: Number(masterData.electronic_scale_net) || 0,
        payment_status: masterData.payment_status || 'Pending'
      };

      await dbModule.upsert('mr_settlement_master', masterPayload, 'mr_no');

      // 2. Clear old detail rows 
      await supabase
        .from('mr_settlement_detail')
        .delete()
        .eq('mr_no', targetMrNo);

      // 3. Write active columns (where grade or area is present)
      const rowsToWrite = detailCols
        .filter(c => c.grade.trim() !== '')
        .map(c => ({
          mr_no: targetMrNo,
          col_index: c.col_index,
          grade: c.grade,
          area: c.area,
          agency: c.agency,
          marka_crop: c.marka_crop,
          quantity: Number(c.quantity) || 0,
          arr_qty_wt: Number(c.arr_qty_wt) || 0,
          min_qty_wt: Number(c.min_qty_wt) || 0,
          wt_phota: Number(c.wt_phota) || 0,
          wt_quantity: Number(c.wt_quantity) || 0,
          rate_value: Number(c.rate_value) || 0,
          gd_claim: Number(c.gd_claim) || 0,
          gd_sett: Number(c.gd_sett) || 0,
          gd_rev: Number(c.gd_rev) || 0,
          gd_final: Number(c.gd_final) || 0,
          moist_claim: Number(c.moist_claim) || 0,
          moist_sett: Number(c.moist_sett) || 0,
          moist_rev: Number(c.moist_rev) || 0,
          moist_final: Number(c.moist_final) || 0,
          dust_claim: Number(c.dust_claim) || 0,
          dust_sett: Number(c.dust_sett) || 0,
          dust_rev: Number(c.dust_rev) || 0,
          dust_final: Number(c.dust_final) || 0,
          ncv_claim: Number(c.ncv_claim) || 0,
          ncv_sett: Number(c.ncv_sett) || 0,
          ncv_rev: Number(c.ncv_rev) || 0,
          ncv_final: Number(c.ncv_final) || 0,
          po_grade_claim: Number(c.po_grade_claim) || 0,
          po_grade_sett: Number(c.po_grade_sett) || 0,
          po_grade_rev: Number(c.po_grade_rev) || 0,
          po_grade_final: Number(c.po_grade_final) || 0,
          adjust_type: c.adjust_type,
          remark: c.remark,
          claim_settlement: Number(c.claim_settlement) || 0
        }));

      for (const detailRow of rowsToWrite) {
        await dbModule.insert('mr_settlement_detail', detailRow).catch((err) => {
          console.warn("mr_settlement_detail insert warning:", err);
        });
      }

      // Live sync to custom table 'm_r_settlement' with manual weight entries and status checks
      const qualitySummary = `Moisture Claim: ${detailCols.map(c => c.moist_claim).filter(Boolean).join('/') || '0'} | Dust Claim: ${detailCols.map(c => c.dust_claim).filter(Boolean).join('/') || '0'}`;
      const materialDetails = detailCols.map(c => `${c.grade || 'N/A'} (${c.area || 'N/A'} - ${c.agency || 'N/A'})`).filter(g => !g.startsWith('N/A')).join(', ');

      await dbModule.upsert('m_r_settlement', {
        mr_no: targetMrNo,
        po_no: masterData.po_no,
        lorry_number: masterData.lorry_number,
        material_details: materialDetails || 'Material Goods Received',
        quality: qualitySummary,
        quantity: totalSettleQty,
        settlement_date: masterData.sett_date,
        payment_status: masterData.payment_status || 'Pending',
        challan_weight: Number(masterData.challan_weight) || 0,
        supplier_net_wt: Number(masterData.supplier_net_wt) || 0,
        electronic_scale_net: Number(masterData.electronic_scale_net) || 0,
        remarks: masterData.remarks
      }, 'mr_no').catch((customTableErr) => {
        console.warn("m_r_settlement Sync Notice:", customTableErr);
      });

      // Mark P.O and M.R status as 'settled' so they move to Settlement table
      if (masterData.po_no) {
        await dbModule.update('purchase_master', 'po_no', masterData.po_no, { status: 'settled', pending: false }).catch(() => {});
        await dbModule.update('sauda_master', 'sauda_no', masterData.po_no, { status: 'settled', pending: false }).catch(() => {});
        await dbModule.update('sauda_master', 'po_no', masterData.po_no, { status: 'settled', pending: false }).catch(() => {});
        await dbModule.update('sauda_check_point', 'po_no', masterData.po_no, { status: 'settled', pending: false }).catch(() => {});
      }

      if (targetMrNo || masterData.po_no) {
        if (targetMrNo) {
          await dbModule.update('mill_inspection_master', 'mr_no', targetMrNo, { status: 'settled' }).catch(() => {});
          await dbModule.update('mill_inspection_master', 'arrival_no', targetMrNo, { status: 'settled' }).catch(() => {});
          await dbModule.update('final_arrival', 'mr_no', targetMrNo, { status: 'settled' }).catch(() => {});
          await dbModule.update('final_arrival', 'arrival_no', targetMrNo, { status: 'settled' }).catch(() => {});
          await dbModule.update('temporary_material_received', 'mr_no', targetMrNo, { status: 'settled' }).catch(() => {});
          await dbModule.update('temporary_material_received', 'arrival_no', targetMrNo, { status: 'settled' }).catch(() => {});
        }
        if (masterData.po_no) {
          await dbModule.update('mill_inspection_master', 'po_no', masterData.po_no, { status: 'settled' }).catch(() => {});
          await dbModule.update('final_arrival', 'po_no', masterData.po_no, { status: 'settled' }).catch(() => {});
          await dbModule.update('temporary_material_received', 'po_no', masterData.po_no, { status: 'settled' }).catch(() => {});
        }
      }



      if (onLogEvent) {
        onLogEvent('MR_SETTLEMENT', `Archived settlement for MR [MR: ${masterData.mr_no}] against PO [PO: ${masterData.po_no}] with Payment Status: ${masterData.payment_status || 'Pending'}. Settle Quantity: ${totalSettleQty} MT`);
      }

      setSuccessMessage(`M.R. Settlement [MR No ${masterData.mr_no}] finalized and archived successfully !`);
      setLastSyncTime(new Date().toLocaleTimeString());
      setShowSuccessAnim(true);
      setTimeout(() => {
        setShowSuccessAnim(false);
        setViewMode('dashboard');
        initPage();
      }, 2500);

    } catch (err: any) {
      setErrorMessage("Save failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Revert Settlement Functionality (Restricted to Admin / L5 users)
  const handleRevertSettlement = async (targetMr: string, targetPoNo?: string) => {
    if (!isL5OrAdmin()) {
      alert("Permission Denied: Revert operation is restricted. Only Admin and L5 users can revert settlements.");
      return;
    }

    const poInfo = targetPoNo ? ` (P.O #${targetPoNo})` : '';
    if (!window.confirm(`REVERT SETTLEMENT CONFIRMATION:\nAre you sure you want to CANCEL & REVERT the settlement for M.R. #${targetMr}${poInfo}?\n\nThis action will cancel the settlement and MOVE the P.O data back to Final P.O and Final M.R data back to Final M.R registers.`)) {
      return;
    }

    setLoading(true);
    try {
      if (!supabase) throw new Error("Supabase client is not available.");

      // 1. Delete settlement records
      await supabase.from('mr_settlement_detail').delete().eq('mr_no', targetMr);
      await supabase.from('mr_settlement_master').delete().eq('mr_no', targetMr);
      await supabase.from('m_r_settlement').delete().eq('mr_no', targetMr);



      // 2. Restore P.O status in purchase_master and sauda_master back to Final P.O (pending/final)
      if (targetPoNo) {
        await supabase
          .from('purchase_master')
          .update({ status: 'final', pending: true })
          .eq('po_no', targetPoNo);

        await supabase
          .from('sauda_master')
          .update({ status: 'active', pending: true })
          .or(`sauda_no.eq.${targetPoNo},po_no.eq.${targetPoNo}`);
      }

      // 3. Restore Final M.R data status back to Final M.R (active)
      const filterStr = targetPoNo ? `mr_no.eq.${targetMr},po_no.eq.${targetPoNo}` : `mr_no.eq.${targetMr}`;
      await supabase
        .from('mill_inspection_master')
        .update({ status: 'active' })
        .or(filterStr);

      await supabase
        .from('final_arrival')
        .update({ status: 'active' })
        .or(filterStr);

      await supabase
        .from('temporary_material_received')
        .update({ status: 'active' })
        .or(filterStr);

      if (onLogEvent) {
        onLogEvent('MR_SETTLEMENT_REVERT', `Reverted settlement for M.R #${targetMr} / PO #${targetPoNo || 'N/A'}. P.O data restored to Final P.O and Final M.R.`);
      }

      alert(`SUCCESS: Settlement for M.R. #${targetMr} has been cancelled and reverted!\n\nP.O data moved back to Final P.O and Final M.R data moved back to Final M.R.`);
      initPage();
    } catch (err: any) {
      console.error("Revert error:", err);
      alert("Error reverting settlement: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Settle removal / purge
  const handleDeleteSettlement = async (targetMr: string) => {
    if (!enforceEditOrDeletePermission("Delete")) {
      return;
    }

    if (!window.confirm(`Settle Warning: Permanently purge Settlement record for MR: ${targetMr}?`)) return;
    setLoading(true);
    try {
      if (!supabase) return;
      const { error } = await supabase
        .from('mr_settlement_master')
        .delete()
        .eq('mr_no', targetMr);
      if (error) throw error;
      alert(`Settlement report for ${targetMr} deleted.`);
      initPage();
    } catch (err: any) {
      alert("Error dropping record: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Export full records
  const handleExportCsv = () => {
    if (settledList.length === 0) {
      alert("No settlement logs available to export.");
      return;
    }
    const dataToExport = settledList.map(row => ({
      "MR No": row.mr_no,
      "Date": row.sett_date,
      "PO No": row.po_no,
      "Lorry Number": row.lorry_number,
      "Supplier": row.supplier,
      "Broker": row.broker,
      "Payable Value (INR)": row.payable_amt,
      "Bill No": row.payable_bill_no,
      "Bill Date": row.payable_bill_date
    }));
    const sanitizedData = sanitizeCsvData(dataToExport);
    const csv = Papa.unparse(sanitizedData);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MR_Settlement_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Excel/CSV for Selected P.O.
  const handleExportExcelForSelectedPo = () => {
    if (!selectedPoNo || !poStats) {
      alert("Please select a P.O number first to export its settlement data.");
      return;
    }

    // Header & Meta Configuration Section
    const fileHeader = [
      { "P.O Settlement Export Report": `P.O NUMBER: #${selectedPoNo}`, "Value / Metric": "" },
      { "P.O Settlement Export Report": "Expressed in Metric Tons (MT)", "Value / Metric": "" },
      { "P.O Settlement Export Report": `Generated At`, "Value / Metric": new Date().toLocaleString() },
      { "P.O Settlement Export Report": "", "Value / Metric": "" },
      { "P.O Settlement Export Report": "--- CONTRACT & INVENTORY STATUS SUMMARY ---", "Value / Metric": "" },
      { "P.O Settlement Export Report": "Total PO Contract Weight", "Value / Metric": `${poStats.contractQty.toFixed(3)} MT` },
      { "P.O Settlement Export Report": "Inspected Received Weight", "Value / Metric": `${poStats.receivedQty.toFixed(3)} MT` },
      { "P.O Settlement Export Report": "Classic Settled Weight Sum", "Value / Metric": `${poStats.settledQty.toFixed(3)} MT` },
      { "P.O Settlement Export Report": "M.R Custom Settlements Sum", "Value / Metric": `${poStats.customReceivedQty.toFixed(3)} MT` },
      { "P.O Settlement Export Report": "Current Calculated Pending Received Balance", "Value / Metric": `${poStats.pendingReceivedQty.toFixed(3)} MT` },
      { "P.O Settlement Export Report": "", "Value / Metric": "" },
      { "P.O Settlement Export Report": "--- DETAILED SETTLEMENT TRANSACTION ENTRIES ---", "Value / Metric": "" }
    ];

    // Map m_r_settlement logs to rows
    const detailRows = customSettlementRecords.map((r, idx) => ({
      "P.O Settlement Export Report": `Entry #${idx + 1} | ID: ${r.id || 'N/A'}`,
      "Value / Metric": `Settle Date: ${r.settlement_date ? r.settlement_date.split('T')[0] : 'N/A'} | Settle Qty: ${Number(r.quantity).toFixed(3)} MT | Lorry Scale Net: ${Number(r.electronic_scale_net || 0).toFixed(3)} MT | Status: ${r.payment_status || 'Pending'} | Quality Claims: ${r.quality || 'N/A'} | Details: ${r.material_details || 'N/A'}`
    }));

    const finalExportArray = [...fileHeader, ...detailRows];
    
    const sanitizedData = sanitizeCsvData(finalExportArray);
    const csv = Papa.unparse(sanitizedData);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PO_${selectedPoNo}_Settlement_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 100-rows per page pagination (searches full dataset, displays paginated)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter]);

  // Filter dashboard 
  const filteredSettles = settledList.filter(item => {
    if (!canViewCompletedData()) {
      const pStatus = (item.payment_status || '').toLowerCase();
      const isCompleted = pStatus === 'settled' || pStatus === 'paid' || pStatus === 'cleared' || pStatus === 'approved';
      if (isCompleted) return false;
    }
    const term = searchFilter.toLowerCase();
    return (
      (item.mr_no || '').toLowerCase().includes(term) ||
      (item.po_no || '').toLowerCase().includes(term) ||
      (item.supplier || '').toLowerCase().includes(term) ||
      (item.broker || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="w-full text-[11px] font-sans selection:bg-rose-100 ">
      {viewMode === "dashboard" ? (
        <SettlementRegisterView
          settledList={settledList}
          filteredSettles={filteredSettles}
          inspections={inspections}
          loading={loading}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          onOpenCreate={() => {
            setMasterData(initialMaster());
            setDetailCols([1, 2, 3, 4].map(emptyDetailColumn));
            setErrorMessage("");
            setSuccessMessage("");
            setIsEdit(false);
            setViewMode("entry");
          }}
          onExportCsv={handleExportCsv}
          onRefresh={handleManualRefresh}
          onOpenView={(mrNo) => handleOpenViewSettlement(mrNo)}
          onEdit={async (mrNo) => {
            if (!enforceEditOrDeletePermission("Edit")) return;
            setViewMode("entry");
            await handleProceedWithMrNo(mrNo);
          }}
          onDelete={(mrNo) => handleDeleteSettlement(mrNo)}
          onRevert={(mrNo, poNo) => handleRevertSettlement(mrNo, poNo)}
          canEditOrDelete={canEditOrDelete}
          isL5OrAdmin={isL5OrAdmin}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          onClose={onClose}
        />
      ) : (
        <LegacyLayout title="SETTLEMENT" onClose={() => setViewMode("dashboard")}>
          <AnimatePresence>
            {showSuccessAnim && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: -10 }}
                  transition={{ type: "spring", damping: 20 }}
                  className="bg-[#FDE7E6] border-3 border-emerald-600 shadow-[8px_8px_0_0_rgba(16,185,129,0.3)] p-6 max-w-md w-full text-center space-y-4"
                >
                  <div className="mx-auto h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-emerald-500">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 font-sans">
                    📊 Synchronization Success 📊
                  </h3>
                  <div className="space-y-1.5 p-3.5 bg-emerald-50 border border-emerald-400 rounded-sm">
                    <p className="text-xs text-slate-800 font-black">
                      M.R. Settlement Sync Completed!
                    </p>
                    <p className="text-[10px] text-slate-600 leading-relaxed font-sans font-medium">
                      The pending received quantities against <strong>PO #{selectedPoNo}</strong> have been recalculated &amp; updated on the main database.
                    </p>
                  </div>
                  <div className="flex justify-center flex-col items-center gap-1.5">
                    <span className="text-[9px] font-mono font-bold text-emerald-700 animate-pulse uppercase">
                      Inventory Stocks verified &amp; updated
                    </span>
                    <div className="h-1.5 w-32 bg-emerald-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2.2, ease: "easeInOut" }}
                        className="h-full bg-emerald-600"
                      />
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HEADER BAR */}
          <div className="bg-[#D94B5A] text-white px-6 py-4 rounded-xl shadow-lg flex flex-wrap items-center justify-between border border-[#FBCFCB] gap-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <h1 className="text-base font-bold text-white tracking-wide">
                  SETTLEMENT
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-3.5 py-1.5 bg-[#D94B5A] hover:bg-[#F7AFA8] text-[#FDE7E6] border border-[#FBCFCB] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
                title="Back to Sauda Desk (Esc)"
                onClick={() => setViewMode("dashboard")}
              >
                <ArrowLeft className="h-4 w-4 text-amber-300" />
                <span>Back</span>
              </button>
            </div>
          </div>

          <div className="space-y-3 font-sans relative">
            {/* Header Controls & Basic MR Arrival Identity Records */}
            <SettlementMasterHeaderCard
              masterData={masterData}
              handleMasterChange={handleMasterChange}
              selectedPoNo={selectedPoNo}
              handlePoNoSelection={handlePoNoSelection}
              handleProceedWithMrNo={handleProceedWithMrNo}
              poOptions={poOptions}
              faOptionsForSelectedPo={faOptionsForSelectedPo}
              handleManualRefresh={handleManualRefresh}
              handleOpenViewSettlement={handleOpenViewSettlement}
              handleExportExcelForSelectedPo={handleExportExcelForSelectedPo}
              loading={loading}
              paymentValidationInfo={paymentValidationInfo}
              detailCols={detailCols}
              calculateWeightedRatePerMT={calculateWeightedRatePerMT}
            />

            {/* Error & Success indicators */}
            {errorMessage && (
              <div className="bg-amber-50 border-2 border-amber-400 p-2 text-amber-900 font-bold flex flex-wrap items-center justify-between gap-2 rounded-sm shadow-2xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="text-xs">{errorMessage}</span>
                </div>
                {errorMessage.includes("Validation Failure (Audit Block)") && (
                  <button
                    type="button"
                    onClick={() => {
                      if (auditOverwriteInfo) {
                        setShowAuditOverwriteModal(true);
                      } else {
                        handleSaveSettlement(false);
                      }
                    }}
                    className="ml-auto bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black px-2.5 py-1 rounded shadow-xs uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Authorize &amp; Overwrite</span>
                  </button>
                )}
              </div>
            )}

            {successMessage && (
              <div className="bg-emerald-50 border-2 border-emerald-400 p-2 text-emerald-800 font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Main Double Panel Form Grid */}
            <div className="grid grid-cols-12 gap-3 items-start">
              {/* LEFT SIDE PANEL: Valuation Card */}
              <div className="col-span-12 lg:col-span-4">
                <SettlementValuationCard
                  masterData={masterData}
                  handleMasterChange={handleMasterChange}
                  detailCols={detailCols}
                  calculateWeightedRatePerMT={calculateWeightedRatePerMT}
                  saudaDeductionRecord={saudaDeductionRecord}
                  selectedPoNo={selectedPoNo}
                  selectedPoData={selectedPoData}
                  errorMessage={errorMessage}
                  onExit={() => setViewMode("dashboard")}
                  onSave={() => handleSaveSettlement(false)}
                />
              </div>

              {/* RIGHT SIDE PANEL: Detailed 4-Column Core Specification Grids & Consignment Meter */}
              <div className="col-span-12 lg:col-span-8 space-y-3">
                <SettlementSpecificationsGrid
                  detailCols={detailCols}
                  handleColChange={handleColChange}
                  visibleSpecCols={visibleSpecCols}
                  visibleDeductionCols={visibleDeductionCols}
                  showAllSpecCols={showAllSpecCols}
                  setShowAllSpecCols={setShowAllSpecCols}
                  showAllDeductionCols={showAllDeductionCols}
                  setShowAllDeductionCols={setShowAllDeductionCols}
                  masterData={masterData}
                  selectedPoData={selectedPoData}
                  calculateWeightedRatePerMT={calculateWeightedRatePerMT}
                  gradeMasterList={gradeMasterList.map((g: any) => ({
                    code: String(g.grade_code || g.code || g.id || ""),
                    name: String(g.grade_name || g.name || g.grade || ""),
                  }))}
                  areaMasterList={areaMasterList
                    .map((a: any) => String(a.area_name || a.name || a.area || "").trim())
                    .filter(Boolean)}
                  agencyMasterList={agencyMasterList
                    .map((ag: any) => String(ag.agency_name || ag.name || ag.agency || "").trim())
                    .filter(Boolean)}
                  sattaDiffsList={getCachedSattaDiffs()}
                />

                {/* Dynamic P.O Quantities Reduction Panel & 1-to-N Consignment Meter placed cleanly in the gap */}
                <SettlementMetricsRibbon
                  poStats={poStats}
                  selectedPoNo={selectedPoNo}
                  lastSyncTime={lastSyncTime}
                  inspections={inspections}
                  customSettlementRecords={customSettlementRecords}
                />
              </div>
            </div>
          </div>
        </LegacyLayout>
      )}

      {/* Print View Modal */}
      <SettlementPrintModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewModalData(null);
        }}
        viewModalData={viewModalData}
        resolveGradeName={(g: string) => resolveGradeName(g, gradeMasterList)}
      />

      {/* PO Audit Limit Overwrite Confirmation Modal */}
      <SettlementAuditOverwriteModal
        isOpen={showAuditOverwriteModal}
        onClose={() => setShowAuditOverwriteModal(false)}
        onConfirm={() => handleSaveSettlement(true)}
        loading={loading}
        auditOverwriteInfo={auditOverwriteInfo}
        fallbackMrNo={masterData.mr_no}
      />
    </div>
  );
}
