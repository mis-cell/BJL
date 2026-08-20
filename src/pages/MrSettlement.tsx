import React, { useState, useEffect } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { 
  FileCheck, 
  Plus, 
  Search, 
  Trash2, 
  Save, 
  X, 
  Printer, 
  FileText, 
  TrendingUp,
  DollarSign,
  Layers,
  Scale,
  RefreshCcw,
  Download,
  AlertTriangle,
  ChevronRight,
  Calculator,
  CheckCircle2,
  FileSpreadsheet,
  Grid,
  Truck,
  Eye
} from 'lucide-react';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import PrintModal from '../components/PrintModal';
import { supabase } from '../lib/supabase';
import { dbModule } from '../services/dbModule';
import { cn, sanitizeCsvData } from '../lib/utils';
import { enforceEditOrDeletePermission, canEditOrDelete, canViewCompletedData, isL5OrAdmin } from '../lib/permissions';

export interface SettlementDeductionItem {
  id?: string;
  deduction_type: string;
  deduction_rate: number;
  deduction_qty: number;
  deduction_amount: number;
}

// Detailed master interface
interface SettlementMaster {
  settlement_id?: string;
  mr_no: string;
  sett_date: string;
  po_type: string;
  broker: string;
  supplier: string;
  chn_supplier: string;
  po_no: string;
  po_date: string;
  lorry_number: string;
  auto_ho_settlement: boolean;
  detention_days: number;
  arrival_no: string;
  arrival_date: string;
  arival_apmc_fees: number;
  actual_apmc_fees: number;
  remarks: string;

  // Grade-wise summary panel
  summary_rate_qtel: number;
  summary_rate_aff_cd_cl: number;
  summary_delivery_claim: number;
  summary_rate_wt_claim: number;
  summary_instl_rate: number;
  summary_premium_wt?: number;
  summary_material_value: number;
  summary_misc_add?: number;
  summary_misc_less?: number;
  summary_premium_amount: number;
  summary_less_amount: number;
  summary_instl_amount?: number;

  // Deductions from Deduction Master
  summary_deduction_type: string;
  summary_deduction_rate: number;
  summary_deduction_qty: number;
  summary_deduction_amount: number;
  deductions?: SettlementDeductionItem[];

  // valuation
  val_material_value: number;
  val_add_amt: number;
  val_less_amt: number;
  val_premium_amt: number;
  val_less_amount: number;
  val_qty_claim: number;
  val_ex_short: number;

  // final MR
  final_less_adv: number;
  final_on_ac_adv: number;
  final_apmc_fees: number;
  final_cst_pct_amt: number;

  // payable
  payable_amt: number;
  payable_bill_no: string;
  payable_bill_date: string;

  // bottom bar
  wt_ded_wt_1: number;
  wt_ded_wt_2: number;
  wt_ded_wt_3: number;
  rate_qntl: number;
  value_amt: number;
  adjustment_amt: number;
  net_amt: number;
  challan_weight: number;
  supplier_net_wt: number;
  electronic_scale_net: number;
  payment_status: string;
}

// 4-Column specifications entry
interface SettlementDetailColumn {
  col_index: number;
  grade: string;
  area: string;
  agency: string;
  marka_crop: string;
  quantity: number;
  arr_qty_wt: number;
  min_qty_wt: number;
  wt_phota: number;

  wt_quantity: number;
  rate_value: number;

  // Claims
  gd_claim: number;
  gd_sett: number;
  gd_rev: number;
  gd_final: number;

  moist_claim: number;
  moist_sett: number;
  moist_rev: number;
  moist_final: number;

  dust_claim: number;
  dust_sett: number;
  dust_rev: number;
  dust_final: number;

  ncv_claim: number;
  ncv_sett: number;
  ncv_rev: number;
  ncv_final: number;

  po_grade_claim: number;
  po_grade_sett: number;
  po_grade_rev: number;
  po_grade_final: number;

  adjust_type: string;
  remark: string;
  claim_settlement: number;
}

const emptyDetailColumn = (index: number): SettlementDetailColumn => ({
  col_index: index,
  grade: '',
  area: '',
  agency: '',
  marka_crop: '',
  quantity: 0,
  arr_qty_wt: 0,
  min_qty_wt: 0,
  wt_phota: 0,
  wt_quantity: 0,
  rate_value: 0,
  gd_claim: 0, gd_sett: 0, gd_rev: 0, gd_final: 0,
  moist_claim: 0, moist_sett: 0, moist_rev: 0, moist_final: 0,
  dust_claim: 0, dust_sett: 0, dust_rev: 0, dust_final: 0,
  ncv_claim: 0, ncv_sett: 0, ncv_rev: 0, ncv_final: 0,
  po_grade_claim: 0, po_grade_sett: 0, po_grade_rev: 0, po_grade_final: 0,
  adjust_type: 'No Adjustment',
  remark: '',
  claim_settlement: 0
});

export const getColWtMt = (col?: SettlementDetailColumn): number => {
  if (!col) return 0;
  const arrWt = Number(col.arr_qty_wt) || 0;
  if (arrWt > 0) return arrWt;
  const qty = Number(col.quantity) || 0;
  const wtPerQty = Number(col.wt_quantity) || Number(col.wt_phota) || 0;
  if (qty > 0 && wtPerQty > 0) {
    return Number(((qty * wtPerQty) / 1000).toFixed(3));
  }
  return 0;
};

export const getColAmount = (col?: SettlementDetailColumn): number => {
  if (!col) return 0;
  const wtMt = getColWtMt(col);
  const reconRate = Number(col.rate_value) || 0;
  if (wtMt <= 0 || reconRate <= 0) return 0;
  // WT(MT) to KG = wtMt * 1000
  // Recon Rate (₹/Qtl) to ₹/KG = reconRate / 100
  // Column Amount = WT(KG) * Rate(KG) = WT(MT) * ReconRate * 10
  const wtKg = wtMt * 1000;
  const rateKg = reconRate / 100;
  return wtKg * rateKg;
};

export const calculateWeightedRatePerMT = (cols: SettlementDetailColumn[]): number => {
  let totalWeightMt = 0;
  let totalAmount = 0;

  cols.forEach(col => {
    const wtMt = getColWtMt(col);
    const reconRateQtl = Number(col.rate_value) || 0;
    
    if (wtMt > 0 && reconRateQtl > 0) {
      const colAmount = wtMt * reconRateQtl * 10; // WT(MT) * ReconRate(₹/Qtl) * 10
      totalWeightMt += wtMt;
      totalAmount += colAmount;
    }
  });

  if (totalWeightMt <= 0) return 0;
  const weightedRateMt = totalAmount / totalWeightMt;
  return Number(weightedRateMt.toFixed(2));
};

const initialMaster = (): SettlementMaster => ({
  mr_no: '',
  sett_date: new Date().toISOString().split('T')[0],
  po_type: '',
  broker: '',
  supplier: '',
  chn_supplier: '',
  po_no: '',
  po_date: '',
  lorry_number: '',
  auto_ho_settlement: false,
  detention_days: 0,
  arrival_no: '',
  arrival_date: '',
  arival_apmc_fees: 0,
  actual_apmc_fees: 0,
  remarks: '',
  summary_rate_qtel: 0,
  summary_rate_aff_cd_cl: 0,
  summary_delivery_claim: 0,
  summary_rate_wt_claim: 0,
  summary_instl_rate: 0,
  summary_premium_wt: 0,
  summary_material_value: 0,
  summary_misc_add: 0,
  summary_misc_less: 0,
  summary_premium_amount: 0,
  summary_less_amount: 0,
  summary_instl_amount: 0,
  summary_deduction_type: '',
  summary_deduction_rate: 0,
  summary_deduction_qty: 0,
  summary_deduction_amount: 0,
  deductions: [],
  val_material_value: 0,
  val_add_amt: 0,
  val_less_amt: 0,
  val_premium_amt: 0,
  val_less_amount: 0,
  val_qty_claim: 0,
  val_ex_short: 0,
  final_less_adv: 0,
  final_on_ac_adv: 0,
  final_apmc_fees: 0,
  final_cst_pct_amt: 0,
  payable_amt: 0,
  payable_bill_no: '',
  payable_bill_date: '',
  wt_ded_wt_1: 0,
  wt_ded_wt_2: 0,
  wt_ded_wt_3: 0,
  rate_qntl: 0,
  value_amt: 0,
  adjustment_amt: 0,
  net_amt: 0,
  challan_weight: 0,
  supplier_net_wt: 0,
  electronic_scale_net: 0,
  payment_status: 'Pending'
});

// Helper function to parse date string without timezone offset shifts
function parseDateOnly(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (!s) return null;
  if (s.includes('T')) {
    const parts = s.split('T')[0].split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]), m = Number(parts[1]) - 1, d = Number(parts[2]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
    }
  }
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts[0].length === 4) { // YYYY-MM-DD
      const y = Number(parts[0]), m = Number(parts[1]) - 1, d = Number(parts[2]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
    } else if (parts[2].length === 4) { // DD-MM-YYYY
      const y = Number(parts[2]), m = Number(parts[1]) - 1, d = Number(parts[0]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
    }
  }
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts[2].length === 4) { // DD/MM/YYYY
      const y = Number(parts[2]), m = Number(parts[1]) - 1, d = Number(parts[0]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
    }
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return null;
}

function formatToInputDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = parseDateOnly(dateStr);
  if (!d) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

  const syncPaymentModuleData = async (mrNo: string, poNo: string) => {
    try {
      let payRecords: any[] = [];
      if (supabase) {
        try {
          const res = await supabase.from('payment_master').select('*');
          if (res.data) payRecords = res.data;
        } catch (e) {}
      }
      const payments = payRecords && payRecords.length > 0 ? payRecords : await dbModule.fetchAll('payment_master').catch(() => []);
      setPaymentList(payments);

      const cleanStr = (s: string) => (s || '').replace(/#/g, '').replace(/[\s\-\/]/g, '').trim().toLowerCase();
      const targetMrClean = cleanStr(mrNo);
      const targetPoClean = cleanStr(poNo);
      const targetPoRaw = (poNo || '').replace(/#/g, '').trim().toLowerCase();

      const matchingPayments = payments.filter((p: any) => {
        const pMrClean = cleanStr(p.mr_no);
        const pArrivalClean = cleanStr(p.arrival_no);
        const pPoClean = cleanStr(p.po_no);
        const pPoRaw = (p.po_no || '').replace(/#/g, '').trim().toLowerCase();

        return (
          (targetMrClean && (pMrClean === targetMrClean || pArrivalClean === targetMrClean)) ||
          (targetPoRaw && (pPoRaw === targetPoRaw || pPoRaw.includes(targetPoRaw) || targetPoRaw.includes(pPoRaw))) ||
          (targetPoClean && (pPoClean === targetPoClean || pPoClean.includes(targetPoClean) || targetPoClean.includes(pPoClean)))
        );
      });

      if (matchingPayments.length > 0) {
        const totalPaid = matchingPayments.reduce((sum, p) => sum + Number(p.paid_amount || p.total_amount || 0), 0);
        const firstMatch = matchingPayments[0];
        setPaymentValidationInfo({
          mrNo: firstMatch.mr_no || mrNo,
          poNo: firstMatch.po_no || poNo,
          paidAmount: totalPaid,
          voucherNo: matchingPayments.map(p => p.voucher_no || 'N/A').join(', ')
        });
        if (totalPaid > 0) {
          setMasterData(prev => ({
            ...prev,
            final_on_ac_adv: totalPaid
          }));
        }
      } else {
        setPaymentValidationInfo(null);
      }
    } catch (e) {
      console.warn("Payment module sync error:", e);
    }
  };

  // Function to calculate 'pending_received' quantity by comparing contract against received sums
  const calculatePendingReceived = (contractQty: number, totalCustomReceived: number): number => {
    return Math.max(0, contractQty - totalCustomReceived);
  };

  // Form State
  const [isEdit, setIsEdit] = useState(false);
  const [masterData, setMasterData] = useState<SettlementMaster>(initialMaster());
  const [detailCols, setDetailCols] = useState<SettlementDetailColumn[]>([
    emptyDetailColumn(1), emptyDetailColumn(2), emptyDetailColumn(3), emptyDetailColumn(4)
  ]);
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

      // Check inspection table if deduction list is still empty or single generic
      if (deductionsList.length === 0 || (deductionsList.length === 1 && !deductionsList[0].deduction_type)) {
        try {
          if (supabase) {
            const { data: inspData } = await supabase
              .from('jute_arrival_inspection')
              .select('deductions, deduction_types, summary_deduction_type, summary_deduction_rate, summary_deduction_qty, summary_deduction_amount')
              .or(`mr_no.eq.${targetMrNo},final_arrival_no.eq.${targetMrNo}`)
              .maybeSingle();
            
            if (inspData) {
              if (Array.isArray(inspData.deductions) && inspData.deductions.length > 0) {
                deductionsList = inspData.deductions;
              } else if (Array.isArray(inspData.deduction_types) && inspData.deduction_types.length > 0) {
                deductionsList = inspData.deduction_types;
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
            const qtyMatch = part.match(/([0-9.]+)\s*@/i) || part.match(/([0-9.]+)\s*(?:bales|units|nos|qntl)/i);
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

      const activeDetails: SettlementDetailColumn[] = [1, 2, 3, 4].map(idx => {
        const existing = foundDetails.find((d: any) => Number(d.col_index) === idx);
        return existing ? { ...emptyDetailColumn(idx), ...existing } : (detailCols[idx-1] || emptyDetailColumn(idx));
      });

      setViewModalData({
        master: {
          ...activeMaster,
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

  const [gradeMasterList, setGradeMasterList] = useState<any[]>([]);
  const [agencyMasterList, setAgencyMasterList] = useState<any[]>([]);
  const [markaMasterList, setMarkaMasterList] = useState<any[]>([]);
  const [areaMasterList, setAreaMasterList] = useState<any[]>([]);
  const [deductionMasterList, setDeductionMasterList] = useState<any[]>([]);

  const resolveGradeName = (raw: any, overrideList?: any[]): string => {
    if (!raw && raw !== 0) return '';
    const str = String(raw).trim();
    if (!str) return '';
    const list = overrideList || gradeMasterList;
    const matchByName = list.find(g => 
      String(g.grade_name || '').trim().toUpperCase() === str.toUpperCase() ||
      String(g.grade || '').trim().toUpperCase() === str.toUpperCase()
    );
    if (matchByName) return matchByName.grade_name || matchByName.grade || str;
    const matchByCode = list.find(g => 
      String(g.grade_code || '').trim().toUpperCase() === str.toUpperCase() ||
      String(g.id || '').trim() === str
    );
    if (matchByCode) return matchByCode.grade_name || matchByCode.grade || str;
    return str;
  };

  const resolveAgencyName = (raw: any, overrideList?: any[]): string => {
    if (!raw && raw !== 0) return '';
    const str = String(raw).trim();
    if (!str) return '';
    const list = overrideList || agencyMasterList;
    const matchByName = list.find(a => 
      String(a.agency_name || '').trim().toUpperCase() === str.toUpperCase() ||
      String(a.agency || '').trim().toUpperCase() === str.toUpperCase()
    );
    if (matchByName) return matchByName.agency_name || matchByName.agency || str;
    const matchByCode = list.find(a => 
      String(a.agency_code || '').trim().toUpperCase() === str.toUpperCase() ||
      String(a.id || '').trim() === str
    );
    if (matchByCode) return matchByCode.agency_name || matchByCode.agency || str;
    return str;
  };

  const resolveMarkaName = (raw: any, overrideList?: any[]): string => {
    if (!raw && raw !== 0) return '';
    const str = String(raw).trim();
    if (!str) return '';
    const list = overrideList || markaMasterList;
    const matchByName = list.find(m => 
      String(m.marka_name || '').trim().toUpperCase() === str.toUpperCase() ||
      String(m.marka || '').trim().toUpperCase() === str.toUpperCase()
    );
    if (matchByName) return matchByName.marka_name || matchByName.marka || str;
    const matchByCode = list.find(m => 
      String(m.marka_code || '').trim().toUpperCase() === str.toUpperCase() ||
      String(m.id || '').trim() === str
    );
    if (matchByCode) return matchByCode.marka_name || matchByCode.marka || str;
    return str;
  };

  const resolveAreaName = (raw: any, overrideList?: any[]): string => {
    if (!raw && raw !== 0) return '';
    const str = String(raw).trim();
    if (!str) return '';
    const list = overrideList || areaMasterList;
    const matchByName = list.find(a => 
      String(a.area_name || '').trim().toUpperCase() === str.toUpperCase() ||
      String(a.area || '').trim().toUpperCase() === str.toUpperCase()
    );
    if (matchByName) return matchByName.area_name || matchByName.area || str;
    const matchByCode = list.find(a => 
      String(a.area_code || '').trim().toUpperCase() === str.toUpperCase() ||
      String(a.id || '').trim() === str
    );
    if (matchByCode) return matchByCode.area_name || matchByCode.area || str;
    return str;
  };

  const buildSettlementCol = (
    idx: number,
    item: any,
    pDet: any,
    faMaster: any,
    inspMaster: any,
    poData: any,
    gList?: any[],
    agList?: any[],
    mList?: any[],
    arList?: any[],
    inspItem?: any
  ): SettlementDetailColumn => {
    const col = emptyDetailColumn(idx);
    if (!item && !pDet && !inspItem) return col;

    // 1. Grade
    const rawGrade = 
      item?.grade || item?.grade_name || item?.stock_grade_name || item?.receipt_grade_name || item?.arrival_grade || 
      item?.grade_code || item?.stock_grade_code || item?.receipt_grade_code || item?.challan_grade_name || 
      item?.quality || item?.stock_grade ||
      inspItem?.grade || inspItem?.grade_name || inspItem?.stock_grade_name || inspItem?.arrival_grade ||
      pDet?.grade_name || pDet?.grade_code || pDet?.grade || pDet?.quality || '';
    
    col.grade = resolveGradeName(rawGrade, gList) || rawGrade || '';

    // 2. Area
    const rawArea = 
      item?.area || item?.arrival_area_name || faMaster?.arrival_area_name || inspMaster?.arrival_area_name || 
      inspItem?.area || pDet?.area || poData?.area || '';
    
    col.area = resolveAreaName(rawArea, arList) || rawArea || '';

    // 3. Agency
    const rawAgency = 
      item?.agency_name || item?.agency || item?.agency_code || 
      inspItem?.agency_name || inspItem?.agency ||
      pDet?.agency_name || pDet?.agency_code || pDet?.agency || poData?.agency || '';
    
    col.agency = resolveAgencyName(rawAgency, agList) || rawAgency || '';

    // 4. Marka / Crop
    const rawMarka = 
      item?.marka_name || item?.challan_marka_name || item?.marka || item?.marka_code || item?.challan_marka_code || 
      inspItem?.marka_name || inspItem?.marka ||
      pDet?.marka_name || pDet?.marka_code || pDet?.marka || '';
    const resolvedMarka = resolveMarkaName(rawMarka, mList) || rawMarka || '';

    const rawCrop = 
      item?.crop_year || item?.crop || inspItem?.crop_year || faMaster?.crop_year || inspMaster?.crop_year || pDet?.crop_year || poData?.crop_year || '';

    col.marka_crop = (resolvedMarka ? resolvedMarka : '') + 
      (rawCrop ? (resolvedMarka ? ` / ${rawCrop}` : rawCrop) : '');

    // 5. Quantity
    const rawQty = 
      item?.quantity || item?.quantity_rcpt || item?.quantity_chln || item?.qty || item?.packets || item?.total_packets || item?.bales || 
      inspItem?.quantity ||
      pDet?.quantity || pDet?.qty || 0;
    
    col.quantity = Number(rawQty) || 0;

    // 6. Arrival Quantity / Weight (Arr Qty Wt)
    const rawWt = 
      item?.weight || item?.weight_qtl || item?.arr_qty_wt || item?.challan_gross_wt || item?.netto_pnto || 
      inspItem?.final_receipt_wt || inspItem?.weight || inspItem?.weight_qtl ||
      pDet?.weight_mt || pDet?.weight_qtl || 0;
    
    col.arr_qty_wt = col.quantity > 0 || item?.weight || item?.arr_qty_wt || inspItem?.final_receipt_wt ? (Number(rawWt) || 0) : 0;
    // Min.Qty/Wt is "Arr. Qty/Wt" with 3% acceptable (97% of Arr. Qty/Wt)
    col.min_qty_wt = col.arr_qty_wt > 0 ? Number((col.arr_qty_wt * 0.97).toFixed(3)) : 0;

    // 7. Rate
    const rawRate = 
      item?.rate_value || item?.rate || item?.rate_qntl || item?.recon_rate_mt || 
      inspItem?.rate || inspItem?.rate_qntl ||
      pDet?.rate_qntl || pDet?.rate || poData?.rate_qntl || 0;
    
    col.rate_value = Number(rawRate) || 0;

    // 8. Wt/Quantity calculation: Round "Arr. Qty/Wt" convert in kg / Quantity (B)
    const rawWtKg = col.arr_qty_wt > 0 ? (col.arr_qty_wt <= 50 ? col.arr_qty_wt * 1000 : col.arr_qty_wt) : 0;
    col.wt_quantity = col.quantity > 0 && rawWtKg > 0 ? Math.round(rawWtKg / col.quantity) : (Number(item?.marks_phota || inspItem?.marks_phota) || 0);
    col.wt_phota = col.wt_quantity;

    // 9. Active Deductions / Claims Audit Sheet mappings from Inspection Details:
    // Grade Down (%)
    // SETT (%) comes from Inspection "Gr. Down" in "Mill Settlement %" table
    const rawGdSett = inspItem?.settlement_grade_down ?? item?.settlement_grade_down ?? 
      inspItem?.grade_down_sett ?? item?.grade_down_sett ?? 
      inspItem?.gd_sett ?? item?.gd_sett ?? 
      inspItem?.sett_grade_down ?? item?.sett_grade_down;
    if (rawGdSett != null) col.gd_sett = Number(rawGdSett);

    // CLAIM (%) comes from Inspection "Grade Down Claim" or "Grade Down Act"
    const rawGdClaim = inspItem?.grade_down_claim ?? item?.grade_down_claim ?? 
      inspItem?.claim_grade_down ?? item?.claim_grade_down ?? 
      inspItem?.grade_down_act ?? item?.grade_down_act ?? 
      inspItem?.actual_grade_down ?? item?.actual_grade_down ?? 
      inspItem?.gd_claim ?? item?.gd_claim;
    if (rawGdClaim != null) col.gd_claim = Number(rawGdClaim);
    else if (inspMaster?.claim_grade_down != null) col.gd_claim = Number(inspMaster.claim_grade_down);

    // Moisture (%)
    // SETT (%) comes from Inspection "Moisture" in "Mill Settlement %" table
    const rawMoistSett = inspItem?.settlement_moisture ?? item?.settlement_moisture ?? 
      inspItem?.moisture_sett ?? item?.moisture_sett ?? 
      inspItem?.moist_sett ?? item?.moist_sett ?? 
      inspItem?.sett_moisture ?? item?.sett_moisture;
    if (rawMoistSett != null) col.moist_sett = Number(rawMoistSett);

    // CLAIM (%) comes from Inspection "Moisture Claim" or "Moisture Act" or "Insp Read Avg"
    const rawMoistClaim = inspItem?.moisture_claim ?? item?.moisture_claim ?? 
      inspItem?.claim_moisture ?? item?.claim_moisture ?? 
      inspItem?.moisture_act ?? item?.moisture_act ?? 
      inspItem?.actual_moisture ?? item?.actual_moisture ?? 
      inspItem?.insp_read_avg ?? item?.insp_read_avg ?? 
      inspItem?.moist_claim ?? item?.moist_claim;
    if (rawMoistClaim != null) col.moist_claim = Number(rawMoistClaim);
    else if (inspMaster?.claim_moisture != null) col.moist_claim = Number(inspMaster.claim_moisture);

    // Dust (%)
    // SETT (%) comes from Inspection "Dust" in "Mill Settlement %" table
    const rawDustSett = inspItem?.settlement_dust ?? item?.settlement_dust ?? 
      inspItem?.dust_sett ?? item?.dust_sett ?? 
      inspItem?.sett_dust ?? item?.sett_dust;
    if (rawDustSett != null) col.dust_sett = Number(rawDustSett);

    // CLAIM (%) comes from Inspection "Dust Claim" or "Dust Act"
    const rawDustClaim = inspItem?.dust_claim ?? item?.dust_claim ?? 
      inspItem?.claim_dust ?? item?.claim_dust ?? 
      inspItem?.dust_act ?? item?.dust_act ?? 
      inspItem?.actual_dust ?? item?.actual_dust ?? 
      inspItem?.dust_claim ?? item?.dust_claim;
    if (rawDustClaim != null) col.dust_claim = Number(rawDustClaim);
    else if (inspMaster?.claim_dust != null) col.dust_claim = Number(inspMaster.claim_dust);

    // NCV (%)
    // SETT (%) comes from Inspection "NCV" in "Mill Settlement %" table
    const rawNcvSett = inspItem?.settlement_ncv ?? item?.settlement_ncv ?? 
      inspItem?.ncv_sett ?? item?.ncv_sett ?? 
      inspItem?.sett_ncv ?? item?.sett_ncv;
    if (rawNcvSett != null) col.ncv_sett = Number(rawNcvSett);

    // CLAIM (%) comes from Inspection "NCV Claim" or "NCV Act"
    const rawNcvClaim = inspItem?.ncv_claim ?? item?.ncv_claim ?? 
      inspItem?.claim_ncv ?? item?.claim_ncv ?? 
      inspItem?.ncv_act ?? item?.ncv_act ?? 
      inspItem?.actual_ncv ?? item?.actual_ncv ?? 
      inspItem?.ncv_claim ?? item?.ncv_claim;
    if (rawNcvClaim != null) col.ncv_claim = Number(rawNcvClaim);
    else if (inspMaster?.claim_ncv != null) col.ncv_claim = Number(inspMaster.claim_ncv);

    // PO / Grade / Delivery Claim
    const rawPoGradeSett = inspItem?.po_grade_sett ?? item?.po_grade_sett;
    if (rawPoGradeSett != null) col.po_grade_sett = Number(rawPoGradeSett);

    const rawPoGradeClaim = inspItem?.po_grade_claim ?? item?.po_grade_claim ?? 
      inspItem?.delivery_claim ?? item?.delivery_claim;
    if (rawPoGradeClaim != null) col.po_grade_claim = Number(rawPoGradeClaim);
    else if (inspMaster?.delivery_claim != null) col.po_grade_claim = Number(inspMaster.delivery_claim);

    // Total Claim calculation: Grade Down (%) + Moisture (%) + Dust (%) + NCV (%)
    const gdVal = Number(col.gd_sett) > 0 ? Number(col.gd_sett) : Number(col.gd_claim || 0);
    const mVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
    const dVal = Number(col.dust_sett) > 0 ? Number(col.dust_sett) : Number(col.dust_claim || 0);
    const nVal = Number(col.ncv_sett) > 0 ? Number(col.ncv_sett) : Number(col.ncv_claim || 0);
    col.claim_settlement = Number((gdVal + mVal + dVal + nVal).toFixed(2));

    return col;
  };

  useLiveAutoRefresh(initPage, [], { 
    tables: [
      'mr_settlement_master', 
      'm_r_settlement', 
      'final_arrival', 
      'mill_inspection_master', 
      'purchase_master', 
      'payment_master', 
      'temporary_material_received', 
      'sauda_check_point', 
      'sauda_master'
    ] 
  });

  // Load dashboards & dropdowns
  async function initPage() {
    if (settledList.length === 0) setLoading(true);
    try {
      if (supabase) {
        // Fetch master registers for lookup
        const [gData, agData, mDataList, aData, dData] = await Promise.all([
          supabase.from('grade_master').select('*').then(r => r.data || [], () => []),
          supabase.from('agency_master').select('*').then(r => r.data || [], () => []),
          supabase.from('marka_master').select('*').then(r => r.data || [], () => []),
          supabase.from('area_master').select('*').then(r => r.data || [], () => []),
          supabase.from('deduction_master').select('*').then(r => r.data || [], () => [])
        ]);
        setGradeMasterList(gData);
        setAgencyMasterList(agData);
        setMarkaMasterList(mDataList);
        setAreaMasterList(aData);
        setDeductionMasterList(dData);

        // 1. Fetch saved settlements & payments
        const [mDataRes, payRes] = await Promise.all([
          supabase.from('mr_settlement_master').select('*').order('created_at', { ascending: false }),
          supabase.from('payment_master').select('*').then(res => res, () => ({ data: [] }))
        ]);
        if (!mDataRes.error && mDataRes.data) setSettledList(mDataRes.data);
        const payList = payRes.data && payRes.data.length > 0 ? payRes.data : await dbModule.fetchAll('payment_master').catch(() => []);
        setPaymentList(payList);

        // 2. Fetch completed inspections from Final M.R (final_arrival & mill_inspection_master)
        const { data: qData } = await supabase
          .from('final_arrival')
          .select('*')
          .order('date', { ascending: false });

        const { data: miData } = await supabase
          .from('mill_inspection_master')
          .select('*')
          .order('created_at', { ascending: false });

        const combinedInspections: any[] = [];
        const seenMrNos = new Set<string>();

        if (qData) {
          for (const item of qData) {
            const mrKey = item.mr_no || item.final_arrival_no;
            if (mrKey && !seenMrNos.has(mrKey)) {
              seenMrNos.add(mrKey);
              combinedInspections.push(item);
            }
          }
        }

        if (miData) {
          for (const item of miData) {
            const mrKey = item.mr_no || item.arrival_no;
            if (mrKey && !seenMrNos.has(mrKey)) {
              seenMrNos.add(mrKey);
              combinedInspections.push(item);
            }
          }
        }

        setInspections(combinedInspections);

        // 3. Fetch purchase orders list for selection from Final P.O
        const { data: poList } = await supabase
          .from('purchase_master')
          .select('po_no, po_date, broker, supplier, total_contract_mt, status, pending, pending_received')
          .order('po_no', { ascending: false });

        const { data: poArchList } = await supabase
          .from('po_archive')
          .select('po_no, po_date, broker, supplier, total_contract_mt, status, pending')
          .order('po_no', { ascending: false })
          .then(res => res, () => ({ data: [] }));

        const rawCombined = [...(poList || []), ...(poArchList || [])];

        if (rawCombined.length > 0) {
          const poReceivedMap = new Map<string, number>();
          if (qData) {
            qData.forEach((item: any) => {
              if (item.po_no) {
                let wtMt = 0;
                if (item.weight_qtl && Number(item.weight_qtl) > 0) wtMt = Number(item.weight_qtl) / 10;
                else if (item.electronic_net_weight && Number(item.electronic_net_weight) > 0) {
                  const val = Number(item.electronic_net_weight);
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

          if (qData) {
            qData.forEach((item: any) => {
              if (item.po_no && !existingPoNos.has(item.po_no) && !item.po_no.endsWith('T') && !item.po_no.includes('TEMP')) {
                existingPoNos.add(item.po_no);
                processedList.push({
                  po_no: item.po_no,
                  supplier: item.supplier || 'Final Arrival PO',
                  status: item.status || 'completed',
                  isCompleted: true
                });
              }
            });
          }

          if (miData) {
            miData.forEach((item: any) => {
              if (item.po_no && !existingPoNos.has(item.po_no) && !item.po_no.endsWith('T') && !item.po_no.includes('TEMP')) {
                existingPoNos.add(item.po_no);
                processedList.push({
                  po_no: item.po_no,
                  supplier: item.supplier_name || 'Inspection PO',
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
        await handlePoNoSelection(currentPo);
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

  const handlePoNoSelection = async (poNo: string) => {
    setSelectedPoNo(poNo);
    if (!poNo) {
      setSelectedPoData(null);
      setPoStats(null);
      setCustomSettlementRecords([]);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (!supabase) return;
      
      // 1. Fetch matching PO master
      const { data: poData } = await supabase
        .from('purchase_master')
        .select('*')
        .eq('po_no', poNo)
        .maybeSingle();

      if (!poData) {
        setSelectedPoData(null);
        setErrorMessage(`Could not resolve details for P.O No. ${poNo}`);
        setLoading(false);
        return;
      }

      setSelectedPoData(poData);
      await syncPaymentModuleData(masterData.mr_no, poNo);

      // 2. Fetch all mill inspections & final arrivals for this P.O to sum total received quantity in Metric Tons (MT)
      const { data: inspectionsForPo } = await supabase
        .from('mill_inspection_master')
        .select('mr_no, weight_qtl, electronic_net_weight, challan_material_weight')
        .eq('po_no', poNo);

      const { data: finalArrivalsForPo } = await supabase
        .from('final_arrival')
        .select('final_arrival_no, mr_no, weight_qtl, electronic_net_weight, challan_material_weight, grid_details')
        .eq('po_no', poNo);

      let totalInspectedMt = 0;
      const processedMrNos = new Set<string>();

      // A) Process final_arrival records for this PO
      if (finalArrivalsForPo && finalArrivalsForPo.length > 0) {
        for (const item of finalArrivalsForPo) {
          const key = item.mr_no || item.final_arrival_no;
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
        .eq('po_no', poNo);
      
      let totalSettledMt = 0;
      if (settlementsForPo && settlementsForPo.length > 0) {
        const mrNos = settlementsForPo.map(s => s.mr_no);
        const { data: sDetails } = await supabase
          .from('mr_settlement_detail')
          .select('quantity')
          .in('mr_no', mrNos);
        if (sDetails && sDetails.length > 0) {
          totalSettledMt = sDetails.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
        }
        if (totalSettledMt === 0) {
          totalSettledMt = settlementsForPo.reduce((sum, s) => sum + (Number(s.electronic_scale_net) || 0), 0);
        }
      }

      // 4. Fetch data from 'm_r_settlement' table based on selected P.O number
      const { data: customSettlements, error: customErr } = await supabase
        .from('m_r_settlement')
        .select('*')
        .eq('po_no', poNo)
        .order('created_at', { ascending: false });

      let totalCustomReceivedMt = 0;
      if (!customErr && customSettlements) {
        setCustomSettlementRecords(customSettlements);
        totalCustomReceivedMt = customSettlements.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
      } else {
        setCustomSettlementRecords([]);
      }

      const contractQty = Number(poData.total_contract_mt) || 0;
      const pendingQty = Math.max(0, contractQty - totalInspectedMt);
      const pendingReceivedQty = calculatePendingReceived(contractQty, totalCustomReceivedMt);

      setPoStats({
        contractQty,
        receivedQty: totalInspectedMt,
        settledQty: totalSettledMt,
        pendingQty: pendingQty,
        customReceivedQty: totalCustomReceivedMt,
        pendingReceivedQty: pendingReceivedQty,
        dbPendingReceived: Number(poData.pending_received) || 0
      });

      setLastSyncTime(new Date().toLocaleTimeString());

      // Filter and locate MR to load
      if (inspectionsForPo && inspectionsForPo.length > 0) {
        const poMrNos = inspectionsForPo.map(i => i.mr_no);
        // Look for unresolved inspection
        const settledMrNos = settledList.map(s => s.mr_no);
        const unresolvedMr = poMrNos.find(mr => !settledMrNos.includes(mr));
        if (unresolvedMr) {
          await handleProceedWithMrNo(unresolvedMr);
        } else {
          await handleProceedWithMrNo(poMrNos[0]);
        }
      } else {
        // Fetch purchase details for grade details when no MR inspection yet
        const { data: poDetails } = await supabase
          .from('purchase_detail_master')
          .select('*')
          .eq('po_no', poNo)
          .order('srl_no', { ascending: true });

        const newCols = [1, 2, 3, 4].map(idx => {
          const pDet = poDetails && poDetails[idx - 1] ? poDetails[idx - 1] : null;
          return buildSettlementCol(idx, null, pDet, null, null, poData);
        });

        setMasterData(prev => ({
          ...initialMaster(),
          po_no: poNo,
          po_date: poData.po_date || '',
          broker: poData.broker || '',
          supplier: poData.supplier || '',
          chn_supplier: poData.supplier || '',
          po_type: poData.po_type || 'MILL_PO',
          sett_date: new Date().toISOString().split('T')[0]
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
      const { data: faMaster } = await supabase
        .from('final_arrival')
        .select('*')
        .or(`mr_no.eq.${targetMrNo},final_arrival_no.eq.${targetMrNo}`)
        .maybeSingle();

      let faGridArr: any[] = [];
      if (faMaster?.grid_details) {
        if (Array.isArray(faMaster.grid_details)) faGridArr = faMaster.grid_details;
        else if (typeof faMaster.grid_details === 'string') {
          try { faGridArr = JSON.parse(faMaster.grid_details); } catch (e) {}
        }
      }

      let inspMaster: any = null;
      try {
        const [matInspRes, millInspRes, inspMRes] = await Promise.all([
          supabase.from('material_inspection').select('*').or(`mr_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}`).maybeSingle(),
          supabase.from('mill_inspection_master').select('*').or(`mr_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}`).maybeSingle(),
          supabase.from('inspection_master').select('*').or(`mr_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}`).maybeSingle()
        ]);
        inspMaster = matInspRes?.data || millInspRes?.data || inspMRes?.data || null;
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
          const [matDetRes, millDetRes, inspDetRes] = await Promise.all([
            supabase.from('material_inspection_details').select('*').eq('mr_no', targetMrNo).order('srl_no', { ascending: true }),
            supabase.from('mill_inspection_detail').select('*').eq('mr_no', targetMrNo).order('srl_no', { ascending: true }),
            supabase.from('inspection_details').select('*').eq('mr_no', targetMrNo).order('srl_no', { ascending: true })
          ]);
          const fetchedDet = matDetRes?.data || millDetRes?.data || inspDetRes?.data || [];
          if (fetchedDet.length > 0) inspDetails = fetchedDet;
        } catch (e) {
          console.warn("Error fetching inspection details:", e);
        }
      }

      const poNoForDet = faMaster?.po_no || inspMaster?.po_no || '';
      let poDetails: any[] = [];
      if (poNoForDet) {
        const { data: pDetData } = await supabase
          .from('purchase_detail_master')
          .select('*')
          .eq('po_no', poNoForDet)
          .order('srl_no', { ascending: true });
        if (pDetData) poDetails = pDetData;
      }

      // Fetch Temporary Arrival record to retrieve A.P.M.C Fees (Rs.)
      let tempArrivalData: any = null;
      try {
        const poNo = poNoForDet;
        const lorryNo = faMaster?.lorry_number || inspMaster?.lorry_number || '';
        const arrNo = faMaster?.final_arrival_no || faMaster?.arrival_no || inspMaster?.arrival_no || targetMrNo;

        const [tempRes, dbTemp] = await Promise.all([
          supabase.from('temporary_material_received').select('*'),
          dbModule.fetchAll('temporary_material_received').catch(() => [])
        ]);
        const allTemp = [...(tempRes.data || []), ...(dbTemp || [])];

        if (allTemp.length > 0) {
          const match = allTemp.find((t: any) => {
            const tAmad = String(t.amad_no || t.temporary_arrival_no || t.arrival_no || '').trim().toUpperCase();
            const tLorry = String(t.lorry_number || t.vehicle_no || '').trim().toUpperCase();
            const tPo = String(t.po_no || '').trim().toUpperCase();
            const targetUpper = String(arrNo || targetMrNo).trim().toUpperCase();
            const lorryUpper = String(lorryNo).trim().toUpperCase();
            const poUpper = String(poNo).trim().toUpperCase();

            return (
              (targetUpper && (tAmad === targetUpper || tAmad.includes(targetUpper) || targetUpper.includes(tAmad))) ||
              (tLorry && lorryUpper && (tLorry === lorryUpper || tLorry.includes(lorryUpper) || lorryUpper.includes(tLorry))) ||
              (tPo && poUpper && tPo === poUpper && tLorry && lorryUpper && tLorry === lorryUpper) ||
              (tPo && poUpper && tPo === poUpper)
            );
          });
          if (match) tempArrivalData = match;
        }
      } catch (e) {
        console.warn("Could not fetch temporary arrival APMC fees:", e);
      }

      const resolvedArrivalApmcFees = Number(
        tempArrivalData?.apmc_fees ?? tempArrivalData?.arival_apmc_fees ?? faMaster?.apmc_fees ?? faMaster?.arival_apmc_fees ?? inspMaster?.apmc_fees ?? 0
      );

      await syncPaymentModuleData(targetMrNo, poNoForDet);

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

      // Extract comprehensive deduction details and summarized deduction types from Inspection Master / Details
      let inspDeductionType = inspMaster?.deduction_type || '';
      let inspDeductionRate = Number(inspMaster?.deduction_rate) || 0;
      let inspDeductionQty = Number(inspMaster?.deduction_qty) || 0;
      let inspDeductionAmount = Number(inspMaster?.deduction_amount) || 0;

      // Check if deductions or deduction_types array is stored in JSONB
      const rawDeductionsArray = inspMaster?.deduction_types || inspMaster?.deductions;
      let parsedDeductions: SettlementDeductionItem[] = [];
      let deductionSummaryText = inspDeductionType;
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

        const typeSummaries = parsedDeductions.map(d => {
          if (d.deduction_amount > 0) return `${d.deduction_type} (₹${d.deduction_amount})`;
          if (d.deduction_rate > 0 && d.deduction_qty > 0) return `${d.deduction_type} (${d.deduction_qty} @ ₹${d.deduction_rate})`;
          return d.deduction_type;
        });

        if (typeSummaries.length > 0) {
          deductionSummaryText = typeSummaries.join(', ');
        }
        if (!inspDeductionAmount) {
          inspDeductionAmount = parsedDeductions.reduce((s: number, d: any) => s + (Number(d.deduction_amount) || 0), 0);
        }
        if (parsedDeductions.length > 0) {
          inspDeductionRate = parsedDeductions[0].deduction_rate;
          inspDeductionQty = parsedDeductions[0].deduction_qty;
        }
      }

      if (parsedDeductions.length === 0 && inspDeductionType && !inspDeductionType.includes('-- SELECT') && (inspDeductionRate > 0 || inspDeductionAmount > 0)) {
        parsedDeductions = [{
          deduction_type: inspDeductionType,
          deduction_rate: inspDeductionRate || inspDeductionAmount,
          deduction_qty: inspDeductionQty || 1,
          deduction_amount: inspDeductionAmount || Number(((inspDeductionRate || 0) * (inspDeductionQty || 1)).toFixed(2))
        }];
      } else if (parsedDeductions.length === 0) {
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
          const mergedMaster = {
            ...existingMaster,
            summary_deduction_type: existingMaster.summary_deduction_type || deductionSummaryText || '',
            summary_deduction_rate: (Number(existingMaster.summary_deduction_rate) > 0) ? existingMaster.summary_deduction_rate : inspDeductionRate,
            summary_deduction_qty: (Number(existingMaster.summary_deduction_qty) > 0) ? existingMaster.summary_deduction_qty : (inspDeductionQty || (deductionSummaryText ? 1 : 0)),
            summary_deduction_amount: (Number(existingMaster.summary_deduction_amount) > 0) ? existingMaster.summary_deduction_amount : inspDeductionAmount,
            deductions: (existingMaster.deductions && Array.isArray(existingMaster.deductions) && existingMaster.deductions.length > 0)
              ? existingMaster.deductions
              : (parsedDeductions.length > 0 ? parsedDeductions : []),
            summary_premium_wt: (existingMaster.summary_premium_wt !== undefined && existingMaster.summary_premium_wt !== null && Number(existingMaster.summary_premium_wt) > 0) 
              ? existingMaster.summary_premium_wt 
              : (existingMaster.summary_instl_rate || calculatedPremWtQtl),
            summary_premium_amount: (existingMaster.summary_premium_amount !== undefined && existingMaster.summary_premium_amount !== null && Number(existingMaster.summary_premium_amount) > 0)
              ? existingMaster.summary_premium_amount
              : calculatedPremRatePerQtl,
            val_premium_amt: (existingMaster.val_premium_amt !== undefined && existingMaster.val_premium_amt !== null && Number(existingMaster.val_premium_amt) > 0)
              ? existingMaster.val_premium_amt
              : calculatedPremTotalAmt,
            arival_apmc_fees: (Number(existingMaster.arival_apmc_fees) > 0) ? existingMaster.arival_apmc_fees : resolvedArrivalApmcFees
          };
          setMasterData(mergedMaster);

          const { data: existingDetails } = await supabase
            .from('mr_settlement_detail')
            .select('*')
            .eq('mr_no', targetMrNo)
            .order('col_index', { ascending: true });

          if (existingDetails && existingDetails.length > 0) {
            // Fill columns up to 4, backfilling missing fields if necessary
            const newCols = [1, 2, 3, 4].map(idx => {
              const dbMatch = existingDetails.find(d => d.col_index === idx);
              const srcItem = faGridArr[idx - 1] || inspDetails[idx - 1] || null;
              const inspItem = inspDetails[idx - 1] || null;
              const pDet = poDetails[idx - 1] || null;
              const fallbackCol = buildSettlementCol(idx, srcItem, pDet, faMaster, inspMaster, null, gradeMasterList, agencyMasterList, markaMasterList, areaMasterList, inspItem);

              if (dbMatch) {
                const merged = { ...emptyDetailColumn(idx), ...dbMatch };
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
                if (!merged.rate_value && fallbackCol.rate_value) merged.rate_value = fallbackCol.rate_value;
                if (merged.gd_sett == null || merged.gd_sett === 0) merged.gd_sett = fallbackCol.gd_sett;
                if (merged.gd_claim == null || merged.gd_claim === 0) merged.gd_claim = fallbackCol.gd_claim;
                if (merged.moist_sett == null || merged.moist_sett === 0) merged.moist_sett = fallbackCol.moist_sett;
                if (merged.moist_claim == null || merged.moist_claim === 0) merged.moist_claim = fallbackCol.moist_claim;
                if (merged.dust_sett == null || merged.dust_sett === 0) merged.dust_sett = fallbackCol.dust_sett;
                if (merged.dust_claim == null || merged.dust_claim === 0) merged.dust_claim = fallbackCol.dust_claim;
                if (merged.ncv_sett == null || merged.ncv_sett === 0) merged.ncv_sett = fallbackCol.ncv_sett;
                if (merged.ncv_claim == null || merged.ncv_claim === 0) merged.ncv_claim = fallbackCol.ncv_claim;
                return merged;
              }
              return fallbackCol;
            });
            setDetailCols(newCols);
          } else {
            const newCols = [1, 2, 3, 4].map(idx => {
              const srcItem = faGridArr[idx - 1] || inspDetails[idx - 1] || null;
              const inspItem = inspDetails[idx - 1] || null;
              const pDet = poDetails[idx - 1] || null;
              return buildSettlementCol(idx, srcItem, pDet, faMaster, inspMaster, null, gradeMasterList, agencyMasterList, markaMasterList, areaMasterList, inspItem);
            });
            setDetailCols(newCols);
          }
          if (existingMaster.po_no) setSelectedPoNo(existingMaster.po_no);
          setSuccessMessage(`Loaded existing Settlement Report for M.R. No. ${targetMrNo}`);
          return;
        }
      }

      // 2. Build new settlement from final_arrival
      if (faMaster) {
        setIsEdit(false);
        const resolvedMrNo = faMaster.mr_no || faMaster.final_arrival_no || targetMrNo;

        const prefilledMaster: SettlementMaster = {
          ...initialMaster(),
          mr_no: resolvedMrNo,
          po_type: 'MILL_PO',
          broker: faMaster.broker || inspMaster?.broker_name || '',
          supplier: faMaster.supplier || inspMaster?.supplier_name || '',
          chn_supplier: faMaster.challan_supplier || faMaster.supplier || inspMaster?.supplier_name || '',
          po_no: faMaster.po_no || inspMaster?.po_no || '',
          po_date: faMaster.po_date || inspMaster?.po_date || '',
          lorry_number: faMaster.lorry_number || faMaster.final_arrival_no || inspMaster?.lorry_number || '',
          arrival_no: faMaster.final_arrival_no || inspMaster?.arrival_no || '',
          arrival_date: formatToInputDate(faMaster.date || faMaster.arrival_date || inspMaster?.arrival_date) || '',
          remarks: faMaster.remarks || inspMaster?.remarks || '',
          challan_weight: Number(faMaster.challan_material_weight || faMaster.weight_qtl) || 0,
          supplier_net_wt: Number(faMaster.supplier_net_weight || faMaster.weight_qtl) || 0,
          electronic_scale_net: Number(faMaster.electronic_net_weight || faMaster.weight_qtl) || 0,
          summary_deduction_type: deductionSummaryText || '',
          summary_deduction_rate: inspDeductionRate,
          summary_deduction_qty: inspDeductionQty > 0 ? inspDeductionQty : (deductionSummaryText ? 1 : 0),
          summary_deduction_amount: inspDeductionAmount,
          deductions: parsedDeductions,
          summary_premium_wt: calculatedPremWtQtl,
          summary_instl_rate: calculatedPremWtQtl,
          summary_premium_amount: calculatedPremRatePerQtl,
          val_premium_amt: calculatedPremTotalAmt,
          arival_apmc_fees: resolvedArrivalApmcFees,
          final_apmc_fees: 0
        };

        const populatedCols = [1, 2, 3, 4].map(idx => {
          const item = faGridArr[idx - 1] || inspDetails[idx - 1] || null;
          const inspItem = inspDetails[idx - 1] || null;
          const pDet = poDetails[idx - 1] || null;
          return buildSettlementCol(idx, item, pDet, faMaster, inspMaster, null, gradeMasterList, agencyMasterList, markaMasterList, areaMasterList, inspItem);
        });

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
        if (prefilledMaster.po_no) setSelectedPoNo(prefilledMaster.po_no);
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
      const prefilledMaster: SettlementMaster = {
        ...initialMaster(),
        mr_no: inspMaster.mr_no || '',
        po_type: 'MILL_PO',
        broker: inspMaster.broker_name || '',
        supplier: inspMaster.supplier_name || '',
        chn_supplier: inspMaster.supplier_name || '',
        po_no: inspMaster.po_no || '',
        po_date: inspMaster.po_date || '',
        lorry_number: inspMaster.lorry_number || inspMaster.arrival_no || '',
        detention_days: inspMaster.detention_days || 0,
        arrival_no: inspMaster.arrival_no || '',
        arrival_date: formatToInputDate(inspMaster.arrival_date) || '',
        remarks: inspMaster.remarks || '',
        summary_deduction_type: deductionSummaryText || '',
        summary_deduction_rate: inspDeductionRate,
        summary_deduction_qty: inspDeductionQty > 0 ? inspDeductionQty : (deductionSummaryText ? 1 : 0),
        summary_deduction_amount: inspDeductionAmount,
        deductions: parsedDeductions,
        summary_premium_wt: calculatedPremWtQtl,
        summary_instl_rate: calculatedPremWtQtl,
        summary_premium_amount: calculatedPremRatePerQtl,
        val_premium_amt: calculatedPremTotalAmt,
        arival_apmc_fees: resolvedArrivalApmcFees,
        final_apmc_fees: 0
      };

      const populatedCols = [1, 2, 3, 4].map(idx => {
        const item = inspDetails[idx - 1] || null;
        const inspItem = inspDetails[idx - 1] || null;
        const pDet = poDetails[idx - 1] || null;
        return buildSettlementCol(idx, item, pDet, null, inspMaster, null, gradeMasterList, agencyMasterList, markaMasterList, areaMasterList, inspItem);
      });

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
    let calculatedMaterialValue = 0;
    let totalQtyWeightClaims = 0;

    detailCols.forEach(col => {
      // Amount for column = WT(KG) * Rate(KG) = WT(MT)*1000 * (Recon Rate / 100)
      const calculatedValueCol = getColAmount(col);
      calculatedMaterialValue += calculatedValueCol;

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

    // Calculate Delivery Claim based on Delivery To (from Final P.O) vs Receipt Date (Arrival Date from TEMPORARY M.R)
    const receiptDateObj = parseDateOnly(masterData.arrival_date || masterData.sett_date);
    const deliveryToObj = parseDateOnly(selectedPoData?.delivery_to);
    const electronicScaleNetMT = Number(masterData.electronic_scale_net) || 0;

    let calculatedDeliveryClaim = 0;
    if (deliveryToObj && receiptDateObj) {
      if (receiptDateObj.getTime() > deliveryToObj.getTime()) {
        const diffMs = receiptDateObj.getTime() - deliveryToObj.getTime();
        const lateDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const penaltyPerDay = Number(selectedPoData?.delivery_penalty) || Number(selectedPoData?.shipment_penalty) || Number(selectedPoData?.qty_penalty) || 0;
        const totalWtMt = getColWtMt(detailCols[0]) + getColWtMt(detailCols[1]) + getColWtMt(detailCols[2]) + getColWtMt(detailCols[3]);
        const scaleQuintals = electronicScaleNetMT > 0 ? (electronicScaleNetMT * 10) : (totalWtMt * 10);
        calculatedDeliveryClaim = Number((lateDays * penaltyPerDay * scaleQuintals).toFixed(2));
      }
    }

    const deliveryClaimAmt = Number(masterData.summary_delivery_claim) > 0 ? Number(masterData.summary_delivery_claim) : calculatedDeliveryClaim;

    // Material valuation summaries
    const finalExShort = Number(masterData.val_ex_short) || 0;
    const finalLessAmount = 0;

    // Calculate Premium Amount: Premium Rate (₹/Qtl) * Premium WT (in Qtl)
    const premiumRatePerQtl = Number(masterData.summary_premium_amount) || 0;
    const premiumWeightQtl = (masterData.summary_premium_wt !== undefined && masterData.summary_premium_wt !== null && Number(masterData.summary_premium_wt) > 0)
      ? Number(masterData.summary_premium_wt)
      : Number(masterData.summary_less_amount || 0);
    const calculatedPremiumAmount = Number((premiumRatePerQtl * premiumWeightQtl).toFixed(2));
    const calculatedDeductionAmount = Number(masterData.summary_deduction_amount) || 0;

    // Valuation calculation = Material Value + Add Amt + Premium Amt - Deduction Amount - Ded Claim Total - Qty Claim - Val Less Amt - Ex/Short - Delivery Claim(-)
    const calculatedValuationVal = Number((
      calculatedMaterialValue 
      + Number(masterData.val_add_amt || 0) 
      + calculatedPremiumAmount 
      - calculatedDeductionAmount 
      - finalLessAmount 
      - Number(masterData.val_qty_claim || 0) 
      - Number(masterData.val_less_amt || 0) 
      - finalExShort
      - deliveryClaimAmt
    ).toFixed(2));

    // APMC Fees = Arrival APMC Fees - Actual APMC Fees
    // Negative APMC Fees (e.g. 0 - 1132.50 = -1132.50) is deducted from RESOLVED PAYABLE ACCOUNT
    const calculatedApmcFees = Number((calculatedMaterialValue * 0.01).toFixed(2));
    const arrivalApmcFees = Number(masterData.arival_apmc_fees) || 0;
    const actualApmcFees = Number(masterData.actual_apmc_fees) || (calculatedApmcFees > 0 ? calculatedApmcFees : 0);
    const finalApmcFees = Number((arrivalApmcFees - actualApmcFees).toFixed(2));
    const cstAmt = (calculatedValuationVal * (Number(masterData.final_cst_pct_amt) || 0)) / 100;

    // RESOLVED PAYABLE ACCOUNT = Valuation - Less Adv - On/Ac Adv + finalApmcFees (which deducts when negative e.g. -1132.50) + CST
    const calculatedPayable = Number((
      calculatedValuationVal 
      - Number(masterData.final_less_adv || 0) 
      - Number(masterData.final_on_ac_adv || 0) 
      + finalApmcFees 
      + cstAmt
    ).toFixed(2));

    // Only update if changes to prevent cycling
    setMasterData(prev => {
      const nextActualApmcFees = prev.actual_apmc_fees || calculatedApmcFees;
      const targetRateAffCdCl = prev.summary_rate_aff_cd_cl > 0 ? prev.summary_rate_aff_cd_cl : nextRatePerMt;

      const targetDeliveryClaim = (prev.summary_delivery_claim !== undefined && Number(prev.summary_delivery_claim) > 0) ? prev.summary_delivery_claim : calculatedDeliveryClaim;

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
        (!prev.actual_apmc_fees && calculatedApmcFees > 0 && prev.actual_apmc_fees !== nextActualApmcFees) ||
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

  }, [detailCols, masterData.electronic_scale_net, masterData.summary_rate_aff_cd_cl, masterData.summary_rate_qtel, masterData.summary_premium_amount, masterData.summary_premium_wt, masterData.summary_deduction_amount, masterData.summary_delivery_claim, masterData.val_add_amt, masterData.val_less_amt, masterData.val_qty_claim, masterData.val_ex_short, masterData.summary_less_amount, masterData.final_less_adv, masterData.final_on_ac_adv, masterData.final_cst_pct_amt, masterData.actual_apmc_fees, masterData.arival_apmc_fees, masterData.arrival_date, masterData.sett_date, selectedPoData]);

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
        return (qty > 0 || arrWt > 0 || wtQty > 0);
      };

      const claimFields = ['gd_claim', 'moist_claim', 'dust_claim', 'ncv_claim', 'po_grade_claim'];
      if (claimFields.includes(field as string)) {
        return prev.map(c => {
          if (!isColActive(c)) {
            return { ...c, [field]: 0 };
          }
          if (c.col_index === idx) {
            return { ...c, [field]: value };
          }
          return c;
        });
      }

      return prev.map(c => {
        if (c.col_index !== idx) return c;
        const updated = { ...c, [field]: value };

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
        return updated;
      });
    });
  };

  // Perform Db save/register
  const handleSaveSettlement = async () => {
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
    const totalSettleQty = detailCols.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
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

    if (poStats && activeWeight > allowedWeight && allowedWeight > 0) {
      setErrorMessage(`Validation Failure (Audit Block): The settlement weight of ${activeWeight.toFixed(3)} MT exceeds the currently calculated 'pending_received' limit of ${allowedWeight.toFixed(3)} MT for selected PO ${selectedPoNo}. Entry rejected.`);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (!supabase) throw new Error("Supabase client is not available.");

      // 1. Insert or Update Master
      const { error: masterErr } = await supabase
        .from('mr_settlement_master')
        .upsert({
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
          actual_apmc_fees: Number(masterData.actual_apmc_fees) || 0,
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
        }, { onConflict: 'mr_no' });

      if (masterErr) throw masterErr;

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

      if (rowsToWrite.length > 0) {
        const { error: matchErr } = await supabase
          .from('mr_settlement_detail')
          .insert(rowsToWrite);
        if (matchErr) throw matchErr;
      }

      // Live sync to custom table 'm_r_settlement' with manual weight entries and status checks
      const qualitySummary = `Moisture Claim: ${detailCols.map(c => c.moist_claim).filter(Boolean).join('/') || '0'} | Dust Claim: ${detailCols.map(c => c.dust_claim).filter(Boolean).join('/') || '0'}`;
      const materialDetails = detailCols.map(c => `${c.grade || 'N/A'} (${c.area || 'N/A'} - ${c.agency || 'N/A'})`).filter(g => !g.startsWith('N/A')).join(', ');

      const { error: customTableErr } = await supabase
        .from('m_r_settlement')
        .insert({
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
        });
      
      if (customTableErr) {
        console.warn("m_r_settlement Sync Notice:", customTableErr);
      }

      // Mark P.O and M.R status as 'settled' so they move to Settlement table
      if (masterData.po_no) {
        await supabase
          .from('purchase_master')
          .update({ status: 'settled', pending: false })
          .eq('po_no', masterData.po_no);

        await supabase
          .from('sauda_master')
          .update({ status: 'settled', pending: false })
          .or(`sauda_no.eq.${masterData.po_no},po_no.eq.${masterData.po_no}`);
      }

      if (targetMrNo || masterData.po_no) {
        const filterStr = targetMrNo && masterData.po_no 
          ? `mr_no.eq.${targetMrNo},po_no.eq.${masterData.po_no}`
          : targetMrNo ? `mr_no.eq.${targetMrNo}` : `po_no.eq.${masterData.po_no}`;

        await supabase
          .from('mill_inspection_master')
          .update({ status: 'settled' })
          .or(filterStr);

        await supabase
          .from('final_arrival')
          .update({ status: 'settled' })
          .or(filterStr);

        await supabase
          .from('amad_master')
          .update({ status: 'settled' })
          .or(filterStr);
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
        .from('amad_master')
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
      {viewMode === 'dashboard' ? (
        <LegacyLayout title="Settlement" subtitle="" onClose={onClose}>
          <div className="space-y-4">

            {/* Aesthetic Top Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-2.5 bg-slate-100 border border-slate-300">
              
              <div className="bg-white border border-gray-400 p-2.5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Archived Settlements</p>
                  <p className="text-lg font-black text-slate-800 font-mono">{settledList.length} Accounts</p>
                </div>
                <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700">
                  <FileCheck className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white border border-gray-400 p-2.5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Total Settled Outflow</p>
                  <p className="text-lg font-black text-rose-700 font-mono">
                    ₹ {settledList.reduce((sum, item) => sum + (Number(item.payable_amt) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white border border-gray-400 p-2.5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Avg Bill Value</p>
                  <p className="text-lg font-black text-indigo-900 font-mono">
                    ₹ {settledList.length ? (settledList.reduce((sum, item) => sum + (Number(item.payable_amt) || 0), 0) / settledList.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0.00'}
                  </p>
                </div>
                <div className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-700">
                  <Calculator className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white border border-gray-400 p-2.5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Pending Audits</p>
                  <p className="text-lg font-black text-amber-700 font-mono">
                    {Math.max(0, inspections.length - settledList.length)} Materials
                  </p>
                </div>
                <div className="p-2 bg-amber-50 border border-amber-200 text-amber-700">
                  <Scale className="h-5 w-5" />
                </div>
              </div>

            </div>

            {/* Dashboard Controls */}
            <div className="flex bg-[#c0c0c0] p-1.5 border border-black/20 gap-2 items-center flex-wrap shadow-sm">
              <div className="flex bg-white border border-gray-400 p-px flex-1 min-w-[280px]">
                <input  id="query_by_m_r_no_supplier__2032" name="query_by_m_r_no_supplier_" aria-label="Query by M.R. No., Supplier Name, Broker, P.O. No..."
                  className="flex-1 text-xs px-2.5 outline-none py-1.5 font-sans font-bold" 
                  placeholder="Query by M.R. No., Supplier Name, Broker, P.O. No..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                <button className="bg-[#d4d0c8] px-3 border-l border-gray-400 hover:bg-gray-300 transition-colors">
                  <Search className="h-3.5 w-3.5 text-slate-800" />
                </button>
              </div>

              <div className="flex gap-1">
                <button 
                  onClick={() => {
                    setMasterData(initialMaster());
                    setDetailCols([1, 2, 3, 4].map(emptyDetailColumn));
                    setErrorMessage('');
                    setSuccessMessage('');
                    setIsEdit(false);
                    setViewMode('entry');
                  }}
                  className="bg-[#d4d0c8] border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3.5 py-1.5 text-[10px] uppercase font-black flex items-center gap-1 hover:bg-white active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-green-800" /> Create Settlement
                </button>
                <button 
                  onClick={handleExportCsv}
                  className="bg-[#d4d0c8] border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3.5 py-1.5 text-[10px] uppercase font-black flex items-center gap-1 hover:bg-white active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-800" /> Export CSV
                </button>
                <button 
                  onClick={() => setSearchFilter('')}
                  className="bg-[#d4d0c8] border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3 py-1.5 text-[10px] uppercase font-black flex items-center gap-1 active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] cursor-pointer"
                  title="Clear Search"
                >
                  <X className="h-3.5 w-3.5 text-red-800" /> Clear
                </button>
                <button 
                  onClick={handleManualRefresh}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3 py-1.5 text-[10px] uppercase font-black flex items-center gap-1 active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] transition-colors disabled:opacity-50 disabled:cursor-wait"
                  disabled={loading}
                >
                  <RefreshCcw className={`h-3.5 w-3.5 text-emerald-100 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* List Table Grid of settlements */}
            <div className="bg-white border border-gray-400 overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="bg-[#f0f0f0] border-b border-gray-400 text-[10px] font-black uppercase text-gray-700">
                    <th className="px-3 py-2 border-r border-gray-300">M.R. No.</th>
                    <th className="px-3 py-2 border-r border-gray-300">Audit Date</th>
                    <th className="px-3 py-2 border-r border-gray-300">P.O. No.</th>
                    <th className="px-3 py-2 border-r border-gray-300">Supplier Name</th>
                    <th className="px-3 py-2 border-r border-gray-300">Broker Name</th>
                    <th className="px-3 py-2 border-r border-gray-300">Lorry Number</th>
                    <th className="px-3 py-2 border-r border-gray-300 text-right">Settled Amt</th>
                    <th className="px-3 py-2 border-r border-gray-300">Bill No / Date</th>
                    <th className="px-3 py-2 border-r border-gray-300 text-center">Status</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-xs font-bold text-slate-500 uppercase tracking-widest italic animate-pulse">
                        Retrieving Accounts settlement ledger logs from Supabase ...
                      </td>
                    </tr>
                  ) : filteredSettles.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-xs font-bold text-slate-400 italic">
                        No Settled M.R. Records discovered. Click "Create Settlement" to resolve quality entries.
                      </td>
                    </tr>
                  ) : (
                    filteredSettles.map((row) => (
                      <tr key={row.settlement_id} className="hover:bg-slate-50 text-[11px] font-sans">
                        <td className="px-3 py-2 border-r border-gray-200 font-bold text-rose-700">{row.mr_no}</td>
                        <td className="px-3 py-2 border-r border-gray-200">{row.sett_date}</td>
                        <td className="px-3 py-2 border-r border-gray-200 font-semibold">{row.po_no}</td>
                        <td className="px-3 py-2 border-r border-gray-200 text-slate-800 uppercase font-bold">{row.supplier}</td>
                        <td className="px-3 py-2 border-r border-gray-200 text-slate-600 font-sans">{row.broker}</td>
                        <td className="px-3 py-2 border-r border-gray-200 font-mono">{row.lorry_number}</td>
                        <td className="px-3 py-2 border-r border-gray-200 text-right font-mono font-black text-emerald-800">
                          ₹ {Number(row.payable_amt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 font-mono text-gray-500">
                          {row.payable_bill_no ? `${row.payable_bill_no} / ${row.payable_bill_date || ''}` : '-'}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                            row.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            row.payment_status === 'Settled' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                            row.payment_status === 'Partially Paid' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            'bg-rose-100 text-[#ca1515] border border-rose-300'
                          }`}>
                            {row.payment_status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => handleOpenViewSettlement(row.mr_no)}
                            className="bg-emerald-100 hover:bg-emerald-700 hover:text-white border border-emerald-400 text-emerald-800 px-2 py-1 font-bold text-[9px] uppercase transition-all tracking-tight cursor-pointer flex items-center gap-1"
                            title="View full settlement details & deduction breakdown table"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                          {canEditOrDelete() && (
                            <>
                              <button 
                                onClick={async () => {
                                  if (!enforceEditOrDeletePermission("Edit")) return;
                                  setViewMode('entry');
                                  await handleProceedWithMrNo(row.mr_no);
                                }}
                                className="bg-slate-200 hover:bg-[#3f51b5] hover:text-white border border-gray-400 px-2.5 py-1 font-bold text-[9px] uppercase transition-all tracking-tight cursor-pointer"
                                title="Edit Settlement entry"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteSettlement(row.mr_no)}
                                className="bg-white hover:bg-rose-600 hover:text-white border border-gray-400 text-rose-600 px-2.5 py-1 font-bold text-[9px] uppercase transition-all tracking-tight cursor-pointer"
                                title="Delete Settlement record"
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {/* Revert Settlement Option - Only Visible & Accessible by Admin (L5) */}
                          {isL5OrAdmin() && (
                            <button 
                              onClick={() => handleRevertSettlement(row.mr_no, row.po_no)}
                              className="bg-amber-100 hover:bg-amber-600 hover:text-white border border-amber-500 text-amber-900 px-2.5 py-1 font-bold text-[9px] uppercase transition-all tracking-tight cursor-pointer flex items-center gap-1"
                              title="Revert Settlement: Cancels settlement and moves P.O & Final M.R data back to Final P.O & Final M.R registers (Admin/L5 Only)"
                            >
                              <span>↺</span> Revert
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </LegacyLayout>
      ) : (
        // *ENTRY FORM SCREEN* - Highly customized retro Windows layout replicating screenshot details!
        <LegacyLayout title="SETTLEMENT" onClose={() => setViewMode('dashboard')}>
          
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
                  className="bg-[#faf8f5] border-3 border-emerald-600 shadow-[8px_8px_0_0_rgba(16,185,129,0.3)] p-6 max-w-md w-full text-center space-y-4"
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
                      The pending received quantities against <strong>PO #{selectedPoNo}</strong> have been recalculated & updated on the main database.
                    </p>
                  </div>
                  <div className="flex justify-center flex-col items-center gap-1.5">
                    <span className="text-[9px] font-mono font-bold text-emerald-700 animate-pulse uppercase">
                      Inventory Stocks verified & updated
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

          <div className="space-y-3 font-sans relative">
            
            {/* Proceed Control Center */}
            <div className="bg-[#d4d0c8] p-3 border-2 border-white shadow-[2px_2px_0_0_rgba(0,0,0,0.15)] space-y-3">
              <div className="flex items-center gap-4 flex-wrap text-xs">
                
                {/* PO Number Select */}
                <div className="flex items-center gap-2 bg-white border border-gray-400 p-1 rounded-sm">
                  <span className="font-extrabold text-slate-800 uppercase text-[10px] tracking-tight">Final P.O:</span>
                  <select  id="selectedpono_2238" name="selectedpono" aria-label="selectedpono"
                    className="bg-white text-xs font-bold px-1.5 py-0.5 outline-none font-mono text-blue-800 border-l border-gray-300 w-[240px]"
                    value={selectedPoNo}
                    onChange={(e) => handlePoNoSelection(e.target.value)}
                  >
                    <option value="">-- SELECT FINAL P.O --</option>
                    {purchaseOrders.map(po => {
                      const isDone = po.isCompleted || po.status === 'completed' || po.status === 'settled';
                      return (
                        <option key={po.po_no} value={po.po_no}>
                          #{po.po_no} ({po.supplier || 'PO'}){isDone ? ' - [COMPLETED]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* MR No dropdown */}
                <div className="flex items-center gap-2 bg-white border border-gray-400 p-1 rounded-sm">
                  <span className="font-extrabold text-slate-800 uppercase text-[10px] tracking-tight">Final M.R:</span>
                  <select  id="masterdata_mr_no_2258" name="masterdata_mr_no" aria-label="masterdata mr no"
                    className="bg-white text-xs font-bold px-1.5 py-0.5 outline-none font-mono text-rose-800 border-l border-gray-300 w-[190px]"
                    value={masterData.mr_no}
                    onChange={(e) => {
                      handleMasterChange('mr_no', e.target.value);
                      handleProceedWithMrNo(e.target.value);
                    }}
                  >
                    <option value="">-- CHOOSE FINAL M.R --</option>
                    {inspections
                      .filter(insp => {
                        const mrVal = insp.mr_no || insp.final_arrival_no;
                        if (!mrVal) return false;
                        const isAlreadySettled = settledList.some(s => s.mr_no === mrVal) || insp.status === 'settled';
                        return (!selectedPoNo || insp.po_no === selectedPoNo) && 
                               (!isAlreadySettled || (isEdit && masterData.mr_no === mrVal));
                      })
                      .map(insp => {
                        const mrVal = insp.mr_no || insp.final_arrival_no;
                        const lorryVal = insp.lorry_number || (insp as any).lorry_no || (insp as any).vehicle_no || insp.final_arrival_no || insp.arrival_no || mrVal;
                        return (
                          <option key={insp.final_arrival_id || mrVal} value={mrVal}>
                            {mrVal} (Lorry: {lorryVal})
                          </option>
                        );
                      })}
                  </select>
                </div>

                <button 
                  onClick={() => handleProceedWithMrNo(masterData.mr_no, true)}
                  className="bg-[#d4d0c8] hover:bg-white text-[10px] uppercase font-black px-4 py-1.5 border border-gray-400 cursor-pointer shadow-xs active:translate-y-px"
                >
                  Force Sync MR
                </button>

                <button 
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={loading}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-extrabold uppercase px-3.5 py-1.5 border border-emerald-500 shadow-sm active:translate-y-px flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Refresh all database records, Final P.O. dropdown, Final M.R. list & payment vouchers without hard browser reloading"
                >
                  <RefreshCcw className={`h-3.5 w-3.5 text-emerald-200 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
                </button>

                {masterData.mr_no && (
                  <button 
                    type="button"
                    onClick={() => handleOpenViewSettlement(masterData.mr_no)}
                    className="bg-indigo-700 hover:bg-indigo-800 text-white text-[10px] font-extrabold uppercase px-3.5 py-1.5 border border-indigo-500 shadow-sm active:translate-y-px flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="View printable settlement statement with deduction breakdown table"
                  >
                    <Eye className="h-3.5 w-3.5 text-indigo-200" />
                    <span>View Settlement Statement</span>
                  </button>
                )}

                {selectedPoNo && (
                  <button 
                    onClick={handleExportExcelForSelectedPo}
                    className="bg-emerald-850 hover:bg-emerald-750 text-white text-[10px] font-extrabold uppercase px-3.5 py-1.5 border border-emerald-600 shadow-sm active:translate-y-px flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Export P.O. to Excel</span>
                  </button>
                )}

                {loading && <span className="text-[10px] font-bold text-blue-800 italic animate-pulse">Syncing...</span>}
              </div>

              {/* Dynamic P.O Quantities Reduction Panel & 1-to-N Consignment Meter */}
              {poStats && (
                <div className="space-y-2">
                  {/* 1-to-N Fulfillment Progress Bar */}
                  <div className="bg-slate-900 border-2 border-indigo-900 p-2.5 rounded-sm text-white space-y-1.5 shadow-md">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                      <span className="text-indigo-300 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-cyan-400 inline" />
                        <span>1-to-N P.O Consignment Fulfillment Progress (PO #{selectedPoNo})</span>
                      </span>
                      <span className="text-emerald-400 font-mono text-xs font-bold">
                        {((poStats.customReceivedQty + poStats.receivedQty) / (poStats.contractQty || 1) * 100).toFixed(1)}% Fulfilled
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 h-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, ((poStats.customReceivedQty + poStats.receivedQty) / (poStats.contractQty || 1) * 100)))}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[9px] text-slate-300 font-mono pt-0.5">
                      <span>Contract: <strong className="text-white">{poStats.contractQty.toFixed(3)} MT</strong></span>
                      <span>Delivered (Final M.R): <strong className="text-emerald-300">{(poStats.customReceivedQty + poStats.receivedQty).toFixed(3)} MT</strong></span>
                      <span>Pending Balance: <strong className="text-amber-300">{poStats.pendingReceivedQty.toFixed(3)} MT</strong></span>
                      <span className="text-cyan-300 font-bold">
                        Linked Consignments: {inspections.filter(i => i.po_no === selectedPoNo).length} Truckloads
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white p-3 border-2 border-slate-700 shadow-inner rounded-sm">
                    <div className="border-r border-slate-700/50 pr-2">
                      <p className="text-[8px] font-extrabold uppercase text-indigo-200 tracking-wider">Total PO Contract</p>
                      <p className="text-xs font-mono font-black text-white">{poStats.contractQty.toFixed(3)} MT</p>
                    </div>
                    <div className="border-r border-slate-700/50 px-2">
                      <p className="text-[8px] font-extrabold uppercase text-emerald-300 tracking-wider">Inspected Received</p>
                      <p className="text-xs font-mono font-black text-emerald-400">{poStats.receivedQty.toFixed(3)} MT</p>
                    </div>
                    <div className="border-r border-slate-700/50 px-2">
                      <p className="text-[8px] font-extrabold uppercase text-amber-300 tracking-wider">Settles Sum (Classic)</p>
                      <p className="text-xs font-mono font-black text-amber-400">{poStats.settledQty.toFixed(3)} MT</p>
                    </div>
                    <div className="border-r border-slate-700/50 px-2 bg-slate-900/40 rounded-xs p-1">
                      <p className="text-[8px] font-extrabold uppercase text-cyan-300 tracking-wider">M.R. Settlements Sum</p>
                      <p className="text-xs font-mono font-black text-cyan-400">{poStats.customReceivedQty.toFixed(3)} MT</p>
                    </div>
                    <div className="pl-2 bg-indigo-900/40 rounded-xs p-1">
                      <p className="text-[8px] font-extrabold uppercase text-pink-300 tracking-wider">Pending Received (Custom)</p>
                      <p className="text-xs font-mono font-black text-pink-400 animate-pulse">{poStats.pendingReceivedQty.toFixed(3)} MT</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[9px] bg-slate-950 border-x-2 border-b-2 border-slate-700/70 px-3 py-1.5 -mt-2 text-slate-350 font-mono italic rounded-b-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "font-extrabold tracking-tight flex items-center gap-1",
                        Math.abs((poStats.dbPendingReceived || 0) - poStats.pendingReceivedQty) < 0.001
                          ? "text-emerald-400 font-bold" 
                          : "text-amber-400"
                      )}>
                        ● DB-SYNC: {
                          Math.abs((poStats.dbPendingReceived || 0) - poStats.pendingReceivedQty) < 0.001
                            ? `VERIFIED (purchase_master.pending_received = ${poStats.dbPendingReceived.toFixed(3)} MT)`
                            : `ACTIVE (Pending validation)`
                        }
                      </span>
                      <span className="text-slate-600">|</span>
                      <span>Last DB Sync: <strong className="text-white font-bold font-sans not-italic">{lastSyncTime || 'Pending Selection'}</strong></span>
                    </div>
                    <div>
                      <span>Cumulative Received Weight Summary: <strong className="text-cyan-400 font-bold not-italic font-sans text-xs">{(poStats.customReceivedQty + poStats.receivedQty).toFixed(3)} MT</strong></span>
                    </div>
                  </div>

                  {customSettlementRecords.length > 0 && (
                    <div className="bg-[#f0ede6] p-2 border border-yellow-800/20 text-[10px] space-y-1">
                      <p className="font-extrabold text-slate-800 uppercase text-[9px] tracking-wider text-rose-900 underline">Active P.O Settlements Log (m_r_settlement Table):</p>
                      <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[9px]">
                        {customSettlementRecords.map((r, i) => (
                          <div key={r.id || i} className="flex justify-between border-b border-black/5 pb-1">
                            <span>Settle-Dt: {r.settlement_date ? r.settlement_date.split('T')[0] : 'N/A'} - Quant: <b className="text-indigo-900">{Number(r.quantity).toFixed(3)} MT</b></span>
                            <span className="text-gray-600 font-sans text-[8px]">Scale Net: {Number(r.electronic_scale_net || 0).toFixed(3)} MT | Status: <b className="uppercase font-sans font-black text-[8px]">{r.payment_status}</b></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error & Success indicators */}
            {errorMessage && (
              <div className="bg-amber-50 border-2 border-amber-400 p-2 text-amber-800 font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
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
              
              {/* LEFT SIDE PANEL: Calculations & Valuation Cards */}
              <div className="col-span-12 lg:col-span-4 space-y-2.5">
                
                {/* 1. Grade-Wise Summary Panel */}
                <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs relative">
                  <div className="inline-block bg-[#f4ece1] border border-[#e5dcce] text-[#2d3748] text-[9.5px] font-extrabold uppercase px-2.5 py-0.5 rounded shadow-2xs mb-2">
                    GRADE-WISE SUMMARY PANEL
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    {/* Row 1 */}
                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1 mb-0.5">
                        <label className="text-[9px] uppercase font-bold text-slate-600">Rate / M.T</label>
                        <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          DB Reference: <code className="text-yellow-400 font-mono">mr_settlement_master.summary_rate_qtel</code>
                          <p className="mt-1">Format: Numeric dec. Jute price per 1000 kg (Metric Ton) used to compute the value of the material received.</p>
                        </div>
                      </div>
                      <input id="masterdata_summary_rate_q_2435" name="masterdata_summary_rate_q" aria-label="masterdata summary rate q"
                        type="number" 
                        step="0.01"
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_rate_qtel || calculateWeightedRatePerMT(detailCols) || ''} 
                        onChange={(e) => handleMasterChange('summary_rate_qtel', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="rate_aff_cd_cl_2446" className="text-[9px] uppercase font-bold text-slate-600 mb-0.5">Rate aff. Cd. Cl</label>
                      <input id="rate_aff_cd_cl_2446" name="rate_aff_cd_cl" aria-label="Rate aff. Cd. Cl"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#991b1b] shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_rate_aff_cd_cl || ''} 
                        onChange={(e) => handleMasterChange('summary_rate_aff_cd_cl', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Row 2 */}
                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1 mb-0.5">
                        <label className="text-[9px] uppercase font-bold text-slate-600">Delivery Claim(-)</label>
                        <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                        {selectedPoData?.delivery_to && (
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-56 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                            <p className="text-yellow-300 font-bold">Delivery Claim Calculation</p>
                            <p>Delivery To (Deadline): <code className="text-cyan-300">{selectedPoData.delivery_to}</code></p>
                            <p>Receipt / Arrival Date: <code className="text-cyan-300">{masterData.arrival_date || masterData.sett_date || 'N/A'}</code></p>
                            {(() => {
                              const rD = parseDateOnly(masterData.arrival_date || masterData.sett_date);
                              const dT = parseDateOnly(selectedPoData.delivery_to);
                              if (rD && dT && rD.getTime() > dT.getTime()) {
                                const lDays = Math.round((rD.getTime() - dT.getTime()) / (1000 * 60 * 60 * 24));
                                const penalty = Number(selectedPoData.delivery_penalty) || Number(selectedPoData.shipment_penalty) || Number(selectedPoData.qty_penalty) || 0;
                                const netScaleMt = Number(masterData.electronic_scale_net) || 0;
                                const totalWtMt = getColWtMt(detailCols[0]) + getColWtMt(detailCols[1]) + getColWtMt(detailCols[2]) + getColWtMt(detailCols[3]);
                                const scaleQtl = netScaleMt > 0 ? (netScaleMt * 10) : (totalWtMt * 10);
                                const totalClaim = lDays * penalty * scaleQtl;
                                return (
                                  <>
                                    <p>Late Days: <code className="text-amber-300 font-bold">{lDays} days</code></p>
                                    <p>Penalty Rate: <code className="text-emerald-300 font-bold">₹{penalty} / Qtl / Day</code></p>
                                    <p>Weight (Quintal): <code className="text-cyan-300 font-bold">{scaleQtl.toFixed(2)} Qtl</code> <span className="text-[7px] text-gray-400">({netScaleMt > 0 ? `${netScaleMt} MT × 10` : 'from details'})</span></p>
                                    <p className="mt-1 pt-1 border-t border-slate-700 text-white font-bold">Claim: ₹{totalClaim.toFixed(2)}</p>
                                  </>
                                );
                              }
                              return <p className="text-emerald-400 font-bold mt-1">Status: On Time (No Penalty)</p>;
                            })()}
                          </div>
                        )}
                      </div>
                      <input id="masterdata_summary_delive_2489" name="masterdata_summary_delive" aria-label="masterdata summary delive"
                        type="number" 
                        step="0.01"
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-rose-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_delivery_claim || ''} 
                        onChange={(e) => handleMasterChange('summary_delivery_claim', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="moisture_claim_pct_2500" className="text-[9px] uppercase font-bold text-slate-600 mb-0.5">Moisture Claim %</label>
                      <input id="moisture_claim_pct_2500" name="moisture_claim_pct" aria-label="Moisture Claim %"
                        type="number" 
                        step="0.01"
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_rate_wt_claim || ''} 
                        onChange={(e) => handleMasterChange('summary_rate_wt_claim', parseFloat(e.target.value) || 0)}
                        placeholder="0.00%"
                      />
                    </div>

                    {/* Row 3 */}
                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1 mb-0.5">
                        <label htmlFor="premium_wt_qtl_field" className="text-[9px] uppercase font-bold text-slate-600">Premium WT (₹/QTL)</label>
                        <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-64 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          <p className="text-yellow-300 font-bold">Premium Weight (Qtl)</p>
                          <p>Sum of Premium Quantity (in MT) from Inspection Details table converted to Quintals (MT × 10).</p>
                        </div>
                      </div>
                      <input id="premium_wt_qtl_field" name="premium_wt_qtl_field" aria-label="Premium WT (₹/QTL)"
                        type="number" 
                        step="0.01"
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#b45309] shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_premium_wt !== undefined && masterData.summary_premium_wt !== null ? masterData.summary_premium_wt : ''} 
                        onChange={(e) => handleMasterChange('summary_premium_wt', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="material_value_2522" className="text-[9px] uppercase font-extrabold text-[#1e1b4b] mb-0.5">Material Value</label>
                      <input id="material_value_2522" name="material_value" aria-label="Material Value"
                        type="number" 
                        disabled
                        className="bg-[#f1f5f9] border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-900 shadow-2xs w-full"
                        value={masterData.summary_material_value.toFixed(2)} 
                      />
                    </div>

                    {/* Row 4 */}
                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1 mb-0.5">
                        <label className="text-[9px] uppercase font-bold text-slate-600">Premium Rate (₹/QTL)</label>
                        <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-60 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          <p className="text-yellow-300 font-bold">Premium Rate &amp; Calculation</p>
                          <p>Premium Rate: <code className="text-cyan-300">₹{masterData.summary_premium_amount || 0} / Qtl</code></p>
                          <p>Premium Weight: <code className="text-cyan-300">{(masterData.summary_premium_wt !== undefined && masterData.summary_premium_wt !== null && Number(masterData.summary_premium_wt) > 0 ? masterData.summary_premium_wt : masterData.summary_less_amount) || 0} Qtl</code></p>
                          <p className="mt-1 pt-1 border-t border-slate-700 text-white font-bold">Total Premium Amt: ₹{((masterData.summary_premium_amount || 0) * Number(masterData.summary_premium_wt !== undefined && masterData.summary_premium_wt !== null && Number(masterData.summary_premium_wt) > 0 ? masterData.summary_premium_wt : (masterData.summary_less_amount || 0))).toFixed(2)}</p>
                        </div>
                      </div>
                      <input id="masterdata_summary_premiu_2541" name="masterdata_summary_premiu" aria-label="masterdata summary premiu"
                        type="number" 
                        step="0.01"
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_premium_amount || ''} 
                        onChange={(e) => handleMasterChange('summary_premium_amount', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="addtl_quality_claims_in_q_2552" className="text-[9px] uppercase font-bold text-[#991b1b] mb-0.5">Addtl Quality Claims in Quntl</label>
                      <input id="addtl_quality_claims_in_q_2552" name="addtl_quality_claims_in_q" aria-label="Addtl Quality claims in Quntl"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#991b1b] shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_less_amount || ''} 
                        onChange={(e) => handleMasterChange('summary_less_amount', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* 2nd Screenshot Position: Exact 1st Screenshot Table in Settlement */}
                    <div className="flex flex-col col-span-2 space-y-1">
                      <div className="border border-[#cbd5e1] rounded-lg overflow-hidden bg-white shadow-xs">
                        <table className="w-full text-xs text-left border-collapse font-sans">
                          <thead>
                            <tr className="bg-[#eef3f9] border-b-2 border-[#2563eb] text-[11px] font-black uppercase text-slate-800 tracking-wider">
                              <th className="py-2.5 px-4 border-r border-[#cbd5e1] text-left w-7/12">
                                DEDUCTION TYPE
                              </th>
                              <th className="py-2.5 px-4 border-r border-[#cbd5e1] text-center w-3/12">
                                DEDUCTION RATE (₹)
                              </th>
                              <th className="py-2.5 px-4 text-center w-2/12">
                                QTY
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#cbd5e1]">
                            {(() => {
                              let deds: SettlementDeductionItem[] = [];
                              if (Array.isArray(masterData.deductions) && masterData.deductions.length > 0) {
                                deds = masterData.deductions;
                              } else if (typeof (masterData.deductions as any) === 'string' && (masterData.deductions as any).trim() !== '') {
                                try {
                                  const parsed = JSON.parse(masterData.deductions as any);
                                  if (Array.isArray(parsed) && parsed.length > 0) deds = parsed;
                                } catch (e) {}
                              }

                              if (deds.length === 0) {
                                const dType = masterData.summary_deduction_type || '';
                                const dRate = Number(masterData.summary_deduction_rate) || 0;
                                const dQty = Number(masterData.summary_deduction_qty) || (dRate > 0 ? 1 : 0);
                                const dAmt = Number(masterData.summary_deduction_amount) || (dRate * dQty);

                                if (dType.includes('\n') || dType.includes(',') || dType.includes(';')) {
                                  const parts = dType.split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean);
                                  deds = parts.map((part: string, idx: number) => {
                                    let rowRate = 0;
                                    let rowQty = 1;
                                    let rowAmt = 0;
                                    const amtMatch = part.match(/₹\s*([0-9.]+)/i);
                                    const rateMatch = part.match(/@\s*₹?\s*([0-9.]+)/i) || part.match(/₹\s*([0-9.]+)/i);
                                    const qtyMatch = part.match(/([0-9.]+)\s*@/i) || part.match(/([0-9.]+)\s*(?:bales|units|nos|qntl)/i);
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
                                  deds = [{
                                    deduction_type: dType,
                                    deduction_rate: dRate,
                                    deduction_qty: dQty || 1,
                                    deduction_amount: dAmt || (dRate * (dQty || 1))
                                  }];
                                }
                              }

                              if (deds.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={3} className="py-3.5 px-4 text-center text-xs font-semibold text-slate-400 italic bg-slate-50/40">
                                      No Deductions or Penalties Applied (₹0.00)
                                    </td>
                                  </tr>
                                );
                              }

                              return deds.map((dItem, dIdx) => {
                                const rate = Number(dItem.deduction_rate) || 0;
                                const qty = Number(dItem.deduction_qty) || (rate > 0 ? 1 : 0);

                                return (
                                  <tr key={dIdx} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-4 border-r border-[#cbd5e1] font-bold text-xs text-slate-900 uppercase">
                                      {dItem.deduction_type || '-'}
                                    </td>
                                    <td className="py-3 px-4 border-r border-[#cbd5e1] text-center font-mono font-bold text-xs text-slate-900">
                                      ₹{rate}
                                    </td>
                                    <td className="py-3 px-4 text-center font-mono font-bold text-xs text-slate-900">
                                      {qty}
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Row 7: Deduction Amount */}
                    <div className="flex flex-col col-span-2">
                      <label htmlFor="deduction_amount_2631" className="text-[9px] uppercase font-extrabold text-[#991b1b] mb-0.5">Deduction Amount (-)</label>
                      <input id="deduction_amount_2631" name="deduction_amount" aria-label="Deduction Amount (-)"
                        type="number" 
                        step="0.01"
                        className="bg-[#fff1f2] border border-[#fecdd3] rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#991b1b] shadow-2xs focus:outline-none w-full"
                        value={masterData.summary_deduction_amount || ''} 
                        onChange={(e) => handleMasterChange('summary_deduction_amount', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                  </div>
                </div>

                {/* 2. M.R. Valuation Matrix */}
                <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs relative">
                  <div className="inline-block bg-[#f4ece1] border border-[#e5dcce] text-[#2d3748] text-[9.5px] font-extrabold uppercase px-2.5 py-0.5 rounded shadow-2xs mb-2">
                    M.R. VALUATION MATRIX
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    {/* Row 1 */}
                    <div className="flex flex-col">
                      <label htmlFor="material_value_2649" className="text-[9px] font-bold text-slate-600 mb-0.5">Material Value</label>
                      <input id="material_value_2649" name="material_value" aria-label="Material Value"
                        type="number" 
                        disabled
                        className="bg-[#f1f5f9] border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-900 shadow-2xs w-full"
                        value={masterData.val_material_value.toFixed(2)} 
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="add_amt_2659" className="text-[9px] font-bold text-[#047857] mb-0.5">Add Amt(+)</label>
                      <input id="add_amt_2659" name="add_amt" aria-label="Add Amt(+)"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#047857] shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.val_add_amt || ''} 
                        onChange={(e) => handleMasterChange('val_add_amt', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Row 2 */}
                    <div className="flex flex-col">
                      <label htmlFor="val_less_amt_2669" className="text-[9px] font-bold text-slate-600 mb-0.5">Val Less Amt(-)</label>
                      <input id="val_less_amt_2669" name="val_less_amt" aria-label="Val Less Amt(-)"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.val_less_amt || ''} 
                        onChange={(e) => handleMasterChange('val_less_amt', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1 mb-0.5">
                        <label className="text-[9px] font-bold text-slate-600">Premium Amt (+)</label>
                        <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-56 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          <p className="text-yellow-300 font-bold">Total Premium Amount</p>
                          <p>Formula: Premium Rate × Premium WT (Qtl)</p>
                          <p><code className="text-cyan-300">₹{masterData.summary_premium_amount || 0}/Qtl × {(masterData.summary_premium_wt !== undefined && masterData.summary_premium_wt !== null && Number(masterData.summary_premium_wt) > 0 ? masterData.summary_premium_wt : (masterData.summary_less_amount || 0))} Qtl</code></p>
                          <p className="mt-1 pt-1 border-t border-slate-700 text-white font-bold">= ₹{(masterData.val_premium_amt || 0).toFixed(2)}</p>
                        </div>
                      </div>
                      <input id="masterdata_val_premium_am_2688" name="masterdata_val_premium_am" aria-label="masterdata val premium am"
                        type="number" 
                        step="0.01"
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.val_premium_amt || ''} 
                        onChange={(e) => handleMasterChange('val_premium_amt', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Row 3 */}
                    <div className="flex flex-col">
                      <label htmlFor="ded_claim_total_2699" className="text-[9px] font-bold text-[#991b1b] mb-0.5">Ded Claim Total (-)</label>
                      <input id="ded_claim_total_2699" name="ded_claim_total" aria-label="Ded Claim Total (-)"
                        type="number" 
                        disabled 
                        className="bg-[#fff1f2] border border-[#fecdd3] rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#991b1b] shadow-2xs w-full"
                        value={(0).toFixed(2)} 
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="qty_claim_2709" className="text-[9px] font-bold text-slate-600 mb-0.5">Qty Claim</label>
                      <input id="qty_claim_2709" name="qty_claim" aria-label="Qty Claim"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.val_qty_claim || ''} 
                        onChange={(e) => handleMasterChange('val_qty_claim', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Row 4: Ex/Short */}
                    <div className="flex flex-col">
                      <label htmlFor="ex_short_2719" className="text-[9px] font-bold text-slate-600 mb-0.5">Ex/Short (-)</label>
                      <input id="ex_short_2719" name="ex_short" aria-label="Ex/Short (-)"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.val_ex_short || ''} 
                        onChange={(e) => handleMasterChange('val_ex_short', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                  </div>
                </div>

                {/* 3. Final MR Net Value */}
                <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs relative">
                  <div className="inline-block bg-[#f4ece1] border border-[#e5dcce] text-[#2d3748] text-[9.5px] font-extrabold uppercase px-2.5 py-0.5 rounded shadow-2xs mb-2">
                    FINAL MR NET VALUE
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    {/* Row 1 */}
                    <div className="flex flex-col">
                      <label htmlFor="less_adv_2736" className="text-[9px] font-bold text-slate-600 mb-0.5">Less Adv (-)</label>
                      <input id="less_adv_2736" name="less_adv" aria-label="Less Adv (-)"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.final_less_adv || ''} 
                        onChange={(e) => handleMasterChange('final_less_adv', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="on_ac_adv_2746" className="text-[9px] font-bold text-slate-600 mb-0.5">On/Ac Adv</label>
                      <input id="on_ac_adv_2746" name="on_ac_adv" aria-label="On/Ac Adv"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.final_on_ac_adv || ''} 
                        onChange={(e) => handleMasterChange('final_on_ac_adv', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Row 2 */}
                    <div className="flex flex-col">
                      <label htmlFor="apmc_fees_2756" className="text-[9px] font-bold text-slate-600 mb-0.5">APMC Fees</label>
                      <input id="apmc_fees_2756" name="apmc_fees" aria-label="APMC Fees"
                        type="number" 
                        disabled
                        className="bg-[#f1f5f9] border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-900 shadow-2xs w-full"
                        value={((Number(masterData.arival_apmc_fees) || 0) - (Number(masterData.actual_apmc_fees) || 0)).toFixed(2)} 
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="c_s_t_tax_2766" className="text-[9px] font-bold text-slate-600 mb-0.5">C.S.T. (Tax) %</label>
                      <input id="c_s_t_tax_2766" name="c_s_t_tax" aria-label="C.S.T. (Tax) %"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        placeholder="e.g. 5 for 5%"
                        value={masterData.final_cst_pct_amt || ''} 
                        onChange={(e) => handleMasterChange('final_cst_pct_amt', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                  </div>
                </div>

                {/* 4. Net Settle Outflow Payable */}
                <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs relative">
                  <div className="inline-block bg-[#f4ece1] border border-[#e5dcce] text-[#2d3748] text-[9.5px] font-extrabold uppercase px-2.5 py-0.5 rounded shadow-2xs mb-2">
                    NET SETTLE OUTFLOW PAYABLE
                  </div>

                  <div className="space-y-2 font-bold text-xs">
                    {/* Big Dark Banner */}
                    <div className="bg-[#0b1329] rounded-md p-2.5 text-center border border-slate-800 shadow-inner">
                      <div className="group relative flex items-center justify-center gap-1 mb-0.5">
                        <label className="text-[8.5px] uppercase tracking-wider font-extrabold text-[#00e676]">RESOLVED PAYABLE ACCOUNT</label>
                        <span className="text-[7px] font-black bg-emerald-950 border border-emerald-400 text-emerald-300 rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block z-50 w-80 bg-slate-900 text-white p-2.5 text-[8px] rounded-lg border border-slate-700 shadow-xl leading-relaxed font-normal text-left normal-case">
                          <p className="text-yellow-300 font-bold border-b border-slate-700 pb-1 mb-1">Payable Account Formula</p>
                          <p className="font-mono text-cyan-200 leading-tight">
                            RESOLVED PAYABLE ACCOUNT = Material Value + Add Amt(+) + Premium Amt(+) - Deduction Amount(-) - Delivery Claim(-) - Val Less Amt(-) - Ded Claim Total(-) - APMC Fees - Less Adv(-) - On/Ac Adv + CST Tax
                          </p>
                        </div>
                      </div>
                      <div className="text-xl font-black font-mono text-[#00e676] tracking-wide">
                        ₹ {masterData.payable_amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* Bill No & Bill Date - Mandatory Fields */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <label htmlFor="bill_no_2798" className="text-[9px] font-bold text-slate-700 mb-0.5 flex items-center justify-between">
                          <span>Bill No. <span className="text-rose-600">*</span></span>
                          <span className="text-rose-500 font-bold text-[8px]">Mandatory</span>
                        </label>
                        <input id="bill_no_2798" name="bill_no" aria-label="Bill No."
                          type="text" 
                          required
                          placeholder="e.g. BILL-101"
                          className={cn(
                            "bg-white border rounded-md px-2 py-1 h-7 font-mono uppercase font-bold text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-none w-full",
                            !masterData.payable_bill_no && errorMessage.includes("Bill No.") ? "border-rose-500 bg-rose-50/50 ring-1 ring-rose-500" : "border-slate-300"
                          )}
                          value={masterData.payable_bill_no || ''} 
                          onChange={(e) => handleMasterChange('payable_bill_no', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label htmlFor="bill_date_2807" className="text-[9px] font-bold text-slate-700 mb-0.5 flex items-center justify-between">
                          <span>Bill Date <span className="text-rose-600">*</span></span>
                          <span className="text-rose-500 font-bold text-[8px]">Mandatory</span>
                        </label>
                        <input id="bill_date_2807" name="bill_date" aria-label="Bill Date"
                          type="date" 
                          required
                          className={cn(
                            "bg-white border rounded-md px-2 py-1 h-7 font-mono font-bold text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-none w-full",
                            !masterData.payable_bill_date && errorMessage.includes("Bill Date") ? "border-rose-500 bg-rose-50/50 ring-1 ring-rose-500" : "border-slate-300"
                          )}
                          value={masterData.payable_bill_date || ''} 
                          onChange={(e) => handleMasterChange('payable_bill_date', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Left Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button 
                    onClick={() => setViewMode('dashboard')}
                    className="bg-white hover:bg-slate-50 border-2 border-slate-700 rounded-md py-2 text-xs font-bold uppercase text-slate-800 tracking-wider shadow-xs transition-all active:scale-[0.98] text-center cursor-pointer"
                  >
                    EXIT GATE
                  </button>
                  <button 
                    onClick={handleSaveSettlement}
                    className="bg-[#000080] hover:bg-blue-950 border-2 border-[#000080] rounded-md py-2 text-xs font-bold uppercase text-white tracking-wider shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Save className="h-4 w-4 text-green-300" />
                    SETTLE ACCOUNT
                  </button>
                </div>

              </div>
              
              {/* RIGHT SIDE PANEL: Detailed 4-Column Core Specification Grids */}
              <div className="col-span-12 lg:col-span-8 space-y-3">
                
                {/* Upper Core Header Fields */}
                <LegacyFieldset legend="Basic MR Arrival Identity Records (PO Aligned Checkpoint)">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-bold p-1">
                    {paymentValidationInfo && (
                      <div className="col-span-4 bg-emerald-50 border border-emerald-300 text-emerald-900 px-2 py-1.5 text-[10px] font-bold rounded flex items-center justify-between mb-1">
                        <span>
                          ✓ <strong>Payment Module Validated (`payment_master`)</strong>: MR: {paymentValidationInfo.mrNo} | P.O: {paymentValidationInfo.poNo} | Voucher: {paymentValidationInfo.voucherNo}
                        </span>
                        <span className="font-mono bg-emerald-200 px-1.5 py-0.5 rounded text-emerald-950 font-black">
                          Paid Amount (On/Ac Adv): ₹{paymentValidationInfo.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex flex-col">
                      <label htmlFor="m_r_no_from_final_m_r_2855" className="text-gray-500 text-[8px] uppercase font-black text-rose-900">M.R. No (From Final M.R)</label>
                      <select  id="m_r_no_from_final_m_r_2855" name="m_r_no_from_final_m_r" aria-label="M.R. No (From Final M.R)"
                        className="bg-white border border-gray-400 p-1 font-mono font-bold text-rose-800 outline-none text-[11px] cursor-pointer"
                        value={masterData.mr_no} 
                        onChange={(e) => handleProceedWithMrNo(e.target.value)}
                      >
                        <option value="">{masterData.mr_no ? masterData.mr_no : '-- Select Final M.R --'}</option>
                        {inspections
                          .filter((insp: any) => {
                            const mrVal = insp.mr_no || insp.final_arrival_no;
                            if (!mrVal) return false;
                            const isAlreadySettled = settledList.some(s => s.mr_no === mrVal) || insp.status === 'settled';
                            return (!selectedPoNo || insp.po_no === selectedPoNo) && 
                                   (!isAlreadySettled || (isEdit && masterData.mr_no === mrVal));
                          })
                          .map((insp: any, i: number) => {
                            const mrVal = insp.mr_no || insp.final_arrival_no;
                            return (
                              <option key={i} value={mrVal}>
                                MR #{mrVal} ({insp.supplier || insp.supplier_name || 'Final Arrival'})
                              </option>
                            );
                          })}
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="date_2882" className="text-gray-500 text-[8px] uppercase">Date</label>
                      <input  id="date_2882" name="date" aria-label="Date"
                        type="date" 
                        className="bg-white border border-gray-400 p-1 font-mono text-center"
                        value={masterData.sett_date} 
                        onChange={(e) => handleMasterChange('sett_date', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col col-span-2">
                      <label htmlFor="p_o_type_2892" className="text-gray-500 text-[8px] uppercase">P.O. Type</label>
                      <input  id="p_o_type_2892" name="p_o_type" aria-label="P.O. Type"
                        type="text" 
                        className="bg-white border border-gray-400 p-1 font-sans "
                        placeholder="e.g. MILL_PO"
                        value={masterData.po_type} 
                        onChange={(e) => handleMasterChange('po_type', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col col-span-2">
                      <label htmlFor="broker_name_2903" className="text-gray-500 text-[8px] uppercase">Broker Name</label>
                      <input  id="broker_name_2903" name="broker_name" aria-label="Broker Name"
                        type="text" 
                        className="bg-white border border-gray-400 p-1 font-sans text-slate-800"
                        value={masterData.broker} 
                        onChange={(e) => handleMasterChange('broker', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col col-span-2">
                      <label htmlFor="suppler_name_2913" className="text-gray-500 text-[8px] uppercase">Suppler Name</label>
                      <input  id="suppler_name_2913" name="suppler_name" aria-label="Suppler Name"
                        type="text" 
                        className="bg-white border border-gray-400 p-1 font-sans text-slate-800"
                        value={masterData.supplier} 
                        onChange={(e) => handleMasterChange('supplier', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col col-span-2">
                      <label htmlFor="chn_supplier_2923" className="text-gray-500 text-[8px] uppercase">Chn..Supplier</label>
                      <input  id="chn_supplier_2923" name="chn_supplier" aria-label="Chn..Supplier"
                        type="text" 
                        className="bg-white border border-gray-400 p-1 font-sans"
                        value={masterData.chn_supplier} 
                        onChange={(e) => handleMasterChange('chn_supplier', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="p_o_no_from_final_p_o_2933" className="text-gray-500 text-[8px] uppercase font-black text-indigo-900">P.O. No. (From Final P.O)</label>
                      <select  id="p_o_no_from_final_p_o_2933" name="p_o_no_from_final_p_o" aria-label="P.O. No. (From Final P.O)"
                        className="bg-white border border-gray-400 p-1 font-mono font-bold text-indigo-900 outline-none text-[11px] cursor-pointer"
                        value={masterData.po_no} 
                        onChange={(e) => handlePoNoSelection(e.target.value)}
                      >
                        <option value="">{masterData.po_no ? masterData.po_no : '-- Select Final P.O --'}</option>
                        {purchaseOrders.map((po: any) => {
                          const isDone = po.isCompleted || po.status === 'completed' || po.status === 'settled';
                          return (
                            <option key={po.po_no} value={po.po_no}>
                              #{po.po_no} ({po.supplier || 'PO'}){isDone ? ' - [COMPLETED]' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="p_o_date_2952" className="text-gray-500 text-[8px] uppercase">P.O. Date</label>
                      <input  id="p_o_date_2952" name="p_o_date" aria-label="P.O. Date"
                        type="date" 
                        disabled
                        className="bg-slate-150 border border-gray-400 p-1 font-mono text-center"
                        value={masterData.po_date} 
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="lorry_number_2962" className="text-gray-500 text-[8px] uppercase">Lorry Number</label>
                      <input  id="lorry_number_2962" name="lorry_number" aria-label="Lorry Number"
                        type="text" 
                        className="bg-white border border-gray-400 p-1 font-mono uppercase"
                        value={masterData.lorry_number} 
                        onChange={(e) => handleMasterChange('lorry_number', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="detention_days_2972" className="text-gray-500 text-[8px] uppercase">Detention Days</label>
                      <input  id="detention_days_2972" name="detention_days" aria-label="Detention Days"
                        type="number" 
                        className="bg-white border border-gray-400 p-1 font-mono text-center"
                        value={masterData.detention_days} 
                        onChange={(e) => handleMasterChange('detention_days', parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="arrival_no_2982" className="text-gray-500 text-[8px] uppercase">Arrival No.</label>
                      <input  id="arrival_no_2982" name="arrival_no" aria-label="Arrival No."
                        type="text" 
                        className="bg-white border border-gray-400 p-1 font-mono"
                        value={masterData.arrival_no} 
                        onChange={(e) => handleMasterChange('arrival_no', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="arrival_date_2992" className="text-gray-500 text-[8px] uppercase">Arrival Date</label>
                      <input  id="arrival_date_2992" name="arrival_date" aria-label="Arrival Date"
                        type="date" 
                        className="bg-white border border-gray-400 p-1 font-mono text-center"
                        value={masterData.arrival_date} 
                        onChange={(e) => handleMasterChange('arrival_date', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="actual_apmc_fees_3001" className="text-slate-500 text-[8px] uppercase">Actual APMC Fees</label>
                      <input  id="actual_apmc_fees_3001" name="actual_apmc_fees" aria-label="Actual APMC Fees"
                        type="number" 
                        className="bg-white border border-gray-400 p-1 text-right font-mono"
                        value={masterData.actual_apmc_fees || ''} 
                        onChange={(e) => handleMasterChange('actual_apmc_fees', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="arival_apmc_fees_3010" className="text-slate-500 text-[8px] uppercase">Arival APMC Fees</label>
                      <input  id="arival_apmc_fees_3010" name="arival_apmc_fees" aria-label="Arival APMC Fees"
                        type="number" 
                        className="bg-white border border-gray-400 p-1 text-right font-mono"
                        value={masterData.arival_apmc_fees || ''} 
                        onChange={(e) => handleMasterChange('arival_apmc_fees', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col col-span-2">
                      <label htmlFor="remarks_narration_3020" className="text-slate-500 text-[8px] uppercase">Remarks / Narration</label>
                      <textarea  id="remarks_narration_3020" name="remarks_narration" aria-label="Remarks / Narration"
                        className="bg-white border border-gray-400 p-1 text-xs font-sans h-[35px]"
                        value={masterData.remarks}
                        onChange={(e) => handleMasterChange('remarks', e.target.value)}
                      />
                    </div>

                    {/* Auto-H.O Settlement layout check checkbox */}
                    <div className="flex items-center gap-2 border border-dashed border-gray-400 bg-[#e1dfda] px-2 py-1  col-span-2">
                      <input  name="checkbox" aria-label="checkbox"
                        type="checkbox"
                        id="auto_ho_id"
                        checked={masterData.auto_ho_settlement}
                        onChange={(e) => handleMasterChange('auto_ho_settlement', e.target.checked)}
                        className="h-3.5 w-3.5 text-blue-900 border-gray-400"
                      />
                      <label htmlFor="auto_ho_id" className="text-[10px] font-black uppercase text-gray-700 cursor-pointer">
                        Auto H.O. Settlement Archival
                      </label>
                    </div>

                    {/* 4 Custom Checklist Weight Fields */}
                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1.5 h-4">
                        <label className="text-blue-900 font-extrabold text-[8px] uppercase">Challan Weight (MT)</label>
                        <span className="text-[7.5px] font-black bg-indigo-950 border border-white text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help hover:bg-slate-700">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          DB Reference: <code className="text-yellow-400 font-mono">m_r_settlement.challan_weight</code>
                          <p className="mt-1">Format: Metric Tons (MT). Weights from supplier invoice / challan form. Must be numeric.</p>
                        </div>
                      </div>
                      <input  id="0_000_3051" name="0_000" aria-label="0.000"
                        type="number" 
                        step="0.001"
                        placeholder="0.000"
                        className="bg-blue-50 border border-blue-300 p-1 font-mono font-bold text-right text-blue-900"
                        value={masterData.challan_weight || ''} 
                        onChange={(e) => handleMasterChange('challan_weight', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1.5 h-4">
                        <label className="text-teal-900 font-extrabold text-[8px] uppercase">Supplier Net Wt (MT)</label>
                        <span className="text-[7.5px] font-black bg-indigo-950 border border-white text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help hover:bg-slate-700">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          DB Reference: <code className="text-yellow-400 font-mono">m_r_settlement.supplier_net_wt</code>
                          <p className="mt-1">Format: Metric Tons (MT). Net transit weights declared by the dispatching supplier.</p>
                        </div>
                      </div>
                      <input  id="0_000_3070" name="0_000" aria-label="0.000"
                        type="number" 
                        step="0.001"
                        placeholder="0.000"
                        className="bg-teal-50 border border-teal-300 p-1 font-mono font-bold text-right text-teal-950"
                        value={masterData.supplier_net_wt || ''} 
                        onChange={(e) => handleMasterChange('supplier_net_wt', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1.5 h-4">
                        <label className="text-purple-900 font-extrabold text-[8px] uppercase">Electronic Scale Net (MT)</label>
                        <span className="text-[7.5px] font-black bg-indigo-950 border border-white text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help hover:bg-slate-700">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          DB Reference: <code className="text-yellow-400 font-mono">m_r_settlement.electronic_scale_net</code>
                          <p className="mt-1">Format: Metric Tons (MT). Official weighbridge weight recorded at the jute mill gate.</p>
                        </div>
                      </div>
                      <input  id="0_000_3089" name="0_000" aria-label="0.000"
                        type="number" 
                        step="0.001"
                        placeholder="0.000"
                        className="bg-purple-50 border border-purple-300 p-1 font-mono font-bold text-right text-purple-950"
                        value={masterData.electronic_scale_net || ''} 
                        onChange={(e) => handleMasterChange('electronic_scale_net', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1.5 h-4">
                        <label className="text-rose-900 font-extrabold text-[8px] uppercase">Payment Status</label>
                        <span className="text-[7.5px] font-black bg-indigo-950 border border-white text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help hover:bg-slate-700">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          DB Reference: <code className="text-yellow-400 font-mono">m_r_settlement.payment_status</code>
                          <p className="mt-1">Format: ENUM values ("Pending", "Partially Paid", "Approved", "Cleared") matching treasury statuses.</p>
                        </div>
                      </div>
                      <select  id="masterdata_payment_status_3108" name="masterdata_payment_status" aria-label="masterdata payment status"
                        className="bg-rose-50 border border-rose-300 p-1 text-xs font-bold text-rose-900"
                        value={masterData.payment_status || 'Pending'} 
                        onChange={(e) => handleMasterChange('payment_status', e.target.value)}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Partially Paid">Partially Paid</option>
                        <option value="Paid">Paid</option>
                        <option value="Settled">Settled</option>
                      </select>
                    </div>

                  </div>
                </LegacyFieldset>

                {/* Sub-bar: Wt. / Ded.Wt */}
                <div className="bg-[#bce0bc] border-t border-b border-gray-500 p-1.5 flex items-center justify-between gap-4 text-[10px] font-black">
                  <div className="flex items-center gap-2  text-emerald-950">
                    <Scale className="h-4 w-4 shrink-0 text-emerald-900" />
                    <span>Wt. / Ded.Wt. (M.Ton.):</span>
                  </div>
                  <div className="flex gap-2">
                    <input  id="0_000_3130" name="0_000" aria-label="0.000"
                      type="number" 
                      placeholder="0.000"
                      className="w-16 bg-white border border-gray-400 text-right p-0.5 font-mono text-[10px]"
                      value={masterData.wt_ded_wt_1 || ''}
                      onChange={(e) => handleMasterChange('wt_ded_wt_1', parseFloat(e.target.value) || 0)}
                    />
                    <input  id="0_000_3137" name="0_000" aria-label="0.000"
                      type="number" 
                      placeholder="0.000"
                      className="w-16 bg-white border border-gray-400 text-right p-0.5 font-mono text-[10px]"
                      value={masterData.wt_ded_wt_2 || ''}
                      onChange={(e) => handleMasterChange('wt_ded_wt_2', parseFloat(e.target.value) || 0)}
                    />
                    <input  id="0_000_3144" name="0_000" aria-label="0.000"
                      type="number" 
                      placeholder="0.000"
                      className="w-16 bg-white border border-gray-400 text-right p-0.5 font-mono text-[10px]"
                      value={masterData.wt_ded_wt_3 || ''}
                      onChange={(e) => handleMasterChange('wt_ded_wt_3', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="h-4 w-px bg-emerald-800" />

                  <div className="flex items-center gap-2">
                    <span className="text-gray-700">Rate/m.T</span>
                    <input  id="masterdata_rate_qntl_calc_3157" name="masterdata_rate_qntl_calc" aria-label="masterdata rate qntl calc"
                      type="number" 
                      step="0.01"
                      className="w-20 bg-white border border-gray-400 text-right p-0.5 font-mono text-[10px] font-bold text-slate-900"
                      value={masterData.rate_qntl || calculateWeightedRatePerMT(detailCols) || ''}
                      onChange={(e) => handleMasterChange('rate_qntl', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Grid 1: Vertical Spec Table */}
                <div className="bg-white border border-gray-400 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse font-sans text-[10px]">
                    <thead>
                      <tr className="bg-[#e4dfd8] border-b border-gray-400 text-center font-black uppercase text-gray-700">
                        <th className="px-2 py-1.5 border-r border-gray-300 w-24">Grade Spec</th>
                        <th className="px-2 py-1.5 border-r border-gray-300">Column 1</th>
                        <th className="px-2 py-1.5 border-r border-gray-300">Column 2</th>
                        <th className="px-2 py-1.5 border-r border-gray-300">Column 3</th>
                        <th className="px-2 py-1.5">Column 4</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300 font-bold">
                      
                      {/* Rows corresponding to column specifications */}
                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Grade</td>
                        {[1, 2, 3, 4].map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id="grade_name_3186" name="grade_name" aria-label="Grade Name"
                              type="text" 
                              className="w-full bg-transparent p-1 outline-none text-center font-black text-slate-800"
                              placeholder="Grade Name"
                              value={detailCols[idx-1]?.grade || ''}
                              onChange={(e) => handleColChange(idx, 'grade', e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Area</td>
                        {[1, 2, 3, 4].map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id="area_3201" name="area" aria-label="Area"
                              type="text" 
                              className="w-full bg-transparent p-1 outline-none text-center"
                              placeholder="Area"
                              value={detailCols[idx-1]?.area || ''}
                              onChange={(e) => handleColChange(idx, 'area', e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Agency</td>
                        {[1, 2, 3, 4].map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id="agency_3216" name="agency" aria-label="Agency"
                              type="text" 
                              className="w-full bg-transparent p-1 outline-none text-center"
                              placeholder="Agency"
                              value={detailCols[idx-1]?.agency || ''}
                              onChange={(e) => handleColChange(idx, 'agency', e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Marka/Crop</td>
                        {[1, 2, 3, 4].map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id="marka_crop_3231" name="marka_crop" aria-label="Marka/Crop"
                              type="text" 
                              className="w-full bg-transparent p-1 outline-none text-center text-[9px] font-mono"
                              placeholder="Marka/Crop"
                              value={detailCols[idx-1]?.marka_crop || ''}
                              onChange={(e) => handleColChange(idx, 'marka_crop', e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 text-rose-800 uppercase">Quantity (B)</td>
                        {[1, 2, 3, 4].map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id="0_3246" name="0" aria-label="0"
                              type="number" 
                              className="w-full bg-transparent p-1 outline-none text-center font-mono font-bold text-rose-800 bg-rose-50/40"
                              placeholder="0"
                              value={detailCols[idx-1]?.quantity || ''}
                              onChange={(e) => handleColChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Arr. Qty/Wt</td>
                        {[1, 2, 3, 4].map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id="0_000_3261" name="0_000" aria-label="0.000"
                              type="number" 
                              className="w-full bg-transparent p-1 outline-none text-center font-mono"
                              placeholder="0.000"
                              value={detailCols[idx-1]?.arr_qty_wt || ''}
                              onChange={(e) => handleColChange(idx, 'arr_qty_wt', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-bold">
                          <div className="flex flex-col">
                            <span>Min.Qty/Wt</span>
                            <span className="text-[7.5px] text-gray-400 font-normal lowercase">(3% acceptable)</span>
                          </div>
                        </td>
                        {[1, 2, 3, 4].map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id={`min_qty_wt_${idx}`} name={`min_qty_wt_${idx}`} aria-label={`Min.Qty/Wt Col ${idx}`}
                              type="number" 
                              step="0.001"
                              className="w-full bg-transparent p-1 outline-none text-center font-mono font-bold text-slate-700"
                              placeholder="0.000"
                              value={detailCols[idx-1]?.min_qty_wt || ''}
                              onChange={(e) => handleColChange(idx, 'min_qty_wt', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>

                      {/* Intermediate sub-bars */}
                      <tr className="bg-indigo-50/40 hover:bg-indigo-50 font-black">
                        <td className="px-2 py-1 border-r border-gray-200 uppercase text-indigo-900">
                          <div className="flex flex-col">
                            <span>Wt/Quantity</span>
                            <span className="text-[7.5px] text-indigo-700 font-normal lowercase">(Round Kg / Qty)</span>
                          </div>
                        </td>
                        {[1, 2, 3, 4].map(idx => {
                          const col = detailCols[idx-1];
                          const qty = Number(col?.quantity) || 0;
                          const arrWt = Number(col?.arr_qty_wt) || 0;
                          const wtPerQty = qty > 0 && arrWt > 0 
                            ? Math.round((arrWt <= 50 ? arrWt * 1000 : arrWt) / qty) 
                            : (Number(col?.wt_quantity) || Number(col?.wt_phota) || 0);
                          return (
                            <td key={idx} className="p-1 border-r border-gray-200 text-center font-mono font-black text-indigo-950 text-xs">
                              {wtPerQty > 0 ? `${wtPerQty} kg` : '-'}
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="bg-indigo-50/40 hover:bg-slate-50 font-black">
                        <td className="px-2 py-1 border-r border-gray-200 uppercase text-indigo-900 flex items-center gap-1">
                          Recon Rate
                        </td>
                        {[1, 2, 3, 4].map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id="rate_3303" name="rate" aria-label="₹ Rate"
                              type="number" 
                              className="w-full bg-white text-center p-0.5 font-mono text-indigo-950 font-bold border border-indigo-200 text-[10px]"
                              placeholder="₹ Rate"
                              value={detailCols[idx-1]?.rate_value || ''}
                              onChange={(e) => handleColChange(idx, 'rate_value', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>

                      {/* Calculated Column Amount Row */}
                      <tr className="bg-[#eef7f2] hover:bg-[#e2f0e8] font-black border-t border-emerald-300">
                        <td className="px-2 py-1 border-r border-gray-300 uppercase text-emerald-950 font-extrabold flex items-center justify-between text-[10px] bg-[#e2f0e8]">
                          <span>Recon Amount</span>
                          <span className="text-[8.5px] text-emerald-800 font-mono">(₹)</span>
                        </td>
                        {[1, 2, 3, 4].map(idx => {
                          const colAmt = getColAmount(detailCols[idx-1]);
                          return (
                            <td key={idx} className="p-1 border-r border-gray-300 text-center font-mono font-bold text-emerald-950 text-[11px] bg-[#eef7f2]">
                              ₹{colAmt.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                            </td>
                          );
                        })}
                      </tr>

                    </tbody>
                  </table>
                </div>

                {/* Recon Rate, Rate / m.T & Actual APMC Fees Clean Summary Card */}
                {(() => {
                  const col1Amt = getColAmount(detailCols[0]);
                  const col2Amt = getColAmount(detailCols[1]);
                  const col3Amt = getColAmount(detailCols[2]);
                  const col4Amt = getColAmount(detailCols[3]);
                  const grandTotal = col1Amt + col2Amt + col3Amt + col4Amt;
                  const apmc1Pct = grandTotal * 0.01;
                  const weightedRateMt = calculateWeightedRatePerMT(detailCols);
                  const totalWtMt = getColWtMt(detailCols[0]) + getColWtMt(detailCols[1]) + getColWtMt(detailCols[2]) + getColWtMt(detailCols[3]);

                  return (
                    <div className="mt-2 bg-[#f8fafc] border border-indigo-200 rounded p-2.5 shadow-sm text-slate-800">
                      <div className="flex items-center justify-between border-b border-indigo-100 pb-1.5 mb-2">
                        <div className="flex items-center gap-1.5">
                          <Calculator className="h-3.5 w-3.5 text-indigo-700" />
                          <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-950">
                            Calculation Breakdown Summary
                          </h4>
                        </div>
                        <span className="text-[8.5px] text-indigo-900 font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          Rate / m.T = Total Amount ÷ Total Weight ({totalWtMt.toFixed(3)} MT)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 text-center text-xs">
                        <div className="bg-white border border-slate-200 rounded p-1.5 flex flex-col justify-between">
                          <span className="text-[8.5px] font-bold text-slate-500 uppercase">Col 1 Amt</span>
                          <span className="my-0.5 font-mono font-bold text-slate-900 text-xs">
                            ₹{col1Amt.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                          </span>
                          <span className="text-[7.5px] text-slate-500 font-mono">
                            {getColWtMt(detailCols[0]).toFixed(3)} MT
                          </span>
                        </div>

                        <div className="bg-white border border-slate-200 rounded p-1.5 flex flex-col justify-between">
                          <span className="text-[8.5px] font-bold text-slate-500 uppercase">Col 2 Amt</span>
                          <span className="my-0.5 font-mono font-bold text-slate-900 text-xs">
                            ₹{col2Amt.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                          </span>
                          <span className="text-[7.5px] text-slate-500 font-mono">
                            {getColWtMt(detailCols[1]).toFixed(3)} MT
                          </span>
                        </div>

                        <div className="bg-white border border-slate-200 rounded p-1.5 flex flex-col justify-between">
                          <span className="text-[8.5px] font-bold text-slate-500 uppercase">Col 3 Amt</span>
                          <span className="my-0.5 font-mono font-bold text-slate-900 text-xs">
                            ₹{col3Amt.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                          </span>
                          <span className="text-[7.5px] text-slate-500 font-mono">
                            {getColWtMt(detailCols[2]).toFixed(3)} MT
                          </span>
                        </div>

                        <div className="bg-white border border-slate-200 rounded p-1.5 flex flex-col justify-between">
                          <span className="text-[8.5px] font-bold text-slate-500 uppercase">Col 4 Amt</span>
                          <span className="my-0.5 font-mono font-bold text-slate-900 text-xs">
                            ₹{col4Amt.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                          </span>
                          <span className="text-[7.5px] text-slate-500 font-mono">
                            {getColWtMt(detailCols[3]).toFixed(3)} MT
                          </span>
                        </div>

                        <div className="bg-[#eef7f2] border border-emerald-300 rounded p-1.5 flex flex-col justify-between">
                          <span className="text-[8.5px] font-black text-emerald-900 uppercase">Grand Total</span>
                          <span className="my-0.5 font-mono font-black text-emerald-950 text-xs">
                            ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                          </span>
                          <span className="text-[7.5px] text-emerald-800 font-mono">
                            Sum of 4 Cols
                          </span>
                        </div>

                        <div className="bg-sky-50 border border-sky-300 rounded p-1.5 flex flex-col justify-between">
                          <span className="text-[8.5px] font-black text-sky-900 uppercase">Rate / m.T</span>
                          <span className="my-0.5 font-mono font-black text-sky-950 text-xs">
                            ₹{weightedRateMt.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[7.5px] text-sky-800 font-mono">
                            Weighted Avg
                          </span>
                        </div>

                        <div className="bg-amber-50 border border-amber-300 rounded p-1.5 flex flex-col justify-between">
                          <span className="text-[8.5px] font-black text-amber-900 uppercase">Actual APMC (1%)</span>
                          <span className="my-0.5 font-mono font-black text-amber-950 text-xs">
                            ₹{apmc1Pct.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[7.5px] text-amber-800 font-mono">
                            1% of Total
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Grid 2: Claims Subdivided Grid Layout */}
                <LegacyFieldset legend="Active Deductions / Claims Audit Sheet (Moisture, Dust, Grade Down, NCV & L.Dely claims)">
                  <div className="bg-white border border-gray-400 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        
                        {/* Major divided column headers */}
                        <tr className="bg-[#ffd2ce] border-b border-gray-400 font-extrabold uppercase text-[#dc2626] text-center">
                          <th className="px-2 py-1.5 border-r border-gray-300 w-28 text-[10px]">Deductions</th>
                          {[1, 2, 3, 4].map(idx => (
                            <th key={idx} colSpan={3} className="px-2 py-1.5 border-r border-gray-300 text-[10.5px]">
                              Col {idx} - {detailCols[idx-1]?.grade || 'Empty Spec'}
                            </th>
                          ))}
                        </tr>

                        {/* Minor divided column subheaders */}
                        <tr className="bg-[#fff1f0] border-b border-gray-400 font-black uppercase text-gray-700 text-[9px] text-center">
                          <th className="px-1.5 py-1 border-r border-gray-300">Metric</th>
                          {[1, 2, 3, 4].map(idx => (
                            <React.Fragment key={idx}>
                              <th className="px-1 py-1 border-r border-gray-200 text-rose-850 font-bold">Claim (%)</th>
                              <th className="px-1 py-1 border-r border-gray-200 text-blue-900 font-bold">SETT (%)</th>
                              <th className="px-1 py-1 border-r border-gray-300 text-emerald-800 font-extrabold bg-emerald-50/60">Final (%)</th>
                            </React.Fragment>
                          ))}
                        </tr>

                      </thead>
                      <tbody className="divide-y divide-gray-300 font-black text-center font-mono">
                        
                        {/* Row 1: Grade Down */}
                        <tr className="hover:bg-slate-50">
                          <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">Grade Down (%)</td>
                          {[1, 2, 3, 4].map(idx => {
                            const gdVal = Number(detailCols[idx-1]?.gd_sett) > 0 ? Number(detailCols[idx-1]?.gd_sett) : Number(detailCols[idx-1]?.gd_claim || 0);
                            return (
                              <React.Fragment key={idx}>
                                <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_gd_claim`} name={`detailcols_${idx}_gd_claim`} aria-label={`detailcols ${idx} gd claim`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.gd_claim || ''} onChange={(e) => handleColChange(idx, 'gd_claim', parseFloat(e.target.value) || 0)} /></td>
                                <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_gd_sett`} name={`detailcols_${idx}_gd_sett`} aria-label={`detailcols ${idx} gd sett`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.gd_sett ?? 0} onChange={(e) => handleColChange(idx, 'gd_sett', parseFloat(e.target.value) || 0)} /></td>
                                <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">{gdVal.toFixed(1)}%</td>
                              </React.Fragment>
                            );
                          })}
                        </tr>

                        {/* Row 2: Moisture */}
                        <tr className="hover:bg-slate-50">
                          <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">Moisture (%)</td>
                          {[1, 2, 3, 4].map(idx => {
                            const mVal = Number(detailCols[idx-1]?.moist_sett) > 0 ? Number(detailCols[idx-1]?.moist_sett) : Number(detailCols[idx-1]?.moist_claim || 0);
                            return (
                              <React.Fragment key={idx}>
                                <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_moist_claim`} name={`detailcols_${idx}_moist_claim`} aria-label={`detailcols ${idx} moist claim`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.moist_claim || ''} onChange={(e) => handleColChange(idx, 'moist_claim', parseFloat(e.target.value) || 0)} /></td>
                                <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_moist_sett`} name={`detailcols_${idx}_moist_sett`} aria-label={`detailcols ${idx} moist sett`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.moist_sett ?? 0} onChange={(e) => handleColChange(idx, 'moist_sett', parseFloat(e.target.value) || 0)} /></td>
                                <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">{mVal.toFixed(2)}%</td>
                              </React.Fragment>
                            );
                          })}
                        </tr>

                        {/* Row 3: Dust */}
                        <tr className="hover:bg-slate-50">
                          <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">Dust (%)</td>
                          {[1, 2, 3, 4].map(idx => {
                            const dVal = Number(detailCols[idx-1]?.dust_sett) > 0 ? Number(detailCols[idx-1]?.dust_sett) : Number(detailCols[idx-1]?.dust_claim || 0);
                            return (
                              <React.Fragment key={idx}>
                                <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_dust_claim`} name={`detailcols_${idx}_dust_claim`} aria-label={`detailcols ${idx} dust claim`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.dust_claim || ''} onChange={(e) => handleColChange(idx, 'dust_claim', parseFloat(e.target.value) || 0)} /></td>
                                <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_dust_sett`} name={`detailcols_${idx}_dust_sett`} aria-label={`detailcols ${idx} dust sett`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.dust_sett ?? 0} onChange={(e) => handleColChange(idx, 'dust_sett', parseFloat(e.target.value) || 0)} /></td>
                                <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">{dVal.toFixed(2)}%</td>
                              </React.Fragment>
                            );
                          })}
                        </tr>

                        {/* Row 4: NCV */}
                        <tr className="hover:bg-slate-50">
                          <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">NCV (%)</td>
                          {[1, 2, 3, 4].map(idx => {
                            const nVal = Number(detailCols[idx-1]?.ncv_sett) > 0 ? Number(detailCols[idx-1]?.ncv_sett) : Number(detailCols[idx-1]?.ncv_claim || 0);
                            return (
                              <React.Fragment key={idx}>
                                <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_ncv_claim`} name={`detailcols_${idx}_ncv_claim`} aria-label={`detailcols ${idx} ncv claim`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.ncv_claim || ''} onChange={(e) => handleColChange(idx, 'ncv_claim', parseFloat(e.target.value) || 0)} /></td>
                                <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_ncv_sett`} name={`detailcols_${idx}_ncv_sett`} aria-label={`detailcols ${idx} ncv sett`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.ncv_sett ?? 0} onChange={(e) => handleColChange(idx, 'ncv_sett', parseFloat(e.target.value) || 0)} /></td>
                                <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">{nVal.toFixed(2)}%</td>
                              </React.Fragment>
                            );
                          })}
                        </tr>

                        {/* Row 5: Late dely */}
                        <tr className="hover:bg-slate-50">
                          <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold leading-none">PO/Grade/A/L.Dely (Amt)</td>
                          {[1, 2, 3, 4].map(idx => {
                            const poVal = Number(detailCols[idx-1]?.po_grade_sett) > 0 ? Number(detailCols[idx-1]?.po_grade_sett) : Number(detailCols[idx-1]?.po_grade_claim || 0);
                            return (
                              <React.Fragment key={idx}>
                                <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_po_grade_claim`} name={`detailcols_${idx}_po_grade_claim`} aria-label={`detailcols ${idx} po grade claim`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.po_grade_claim || ''} onChange={(e) => handleColChange(idx, 'po_grade_claim', parseFloat(e.target.value) || 0)} /></td>
                                <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_po_grade_sett`} name={`detailcols_${idx}_po_grade_sett`} aria-label={`detailcols ${idx} po grade sett`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.po_grade_sett ?? 0} onChange={(e) => handleColChange(idx, 'po_grade_sett', parseFloat(e.target.value) || 0)} /></td>
                                <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">{poVal.toFixed(1)}</td>
                              </React.Fragment>
                            );
                          })}
                        </tr>

                        {/* Text remarks input row */}
                        <tr className="hover:bg-slate-50">
                          <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">Remarks</td>
                          {[1, 2, 3, 4].map(idx => (
                            <td key={idx} colSpan={3} className="p-1 border-r border-gray-300">
                              <input  id={`audit_remarks_${idx}`} name={`audit_remarks_${idx}`} aria-label="Audit remarks..."
                                type="text" 
                                className="w-full bg-transparent p-0.5 outline-none font-sans font-medium text-left px-2 text-[9.5px]"
                                placeholder="Audit remarks..."
                                value={detailCols[idx-1]?.remark || ''}
                                onChange={(e) => handleColChange(idx, 'remark', e.target.value)}
                              />
                            </td>
                          ))}
                        </tr>

                        {/* Settled Claims sum row: Total Claim = Grade Down (%) + Moisture (%) + Dust (%) + NCV (%) */}
                        <tr className="bg-rose-50/70 hover:bg-rose-100">
                          <td className="px-2 py-1.5 border-r border-gray-200 text-red-900 uppercase font-sans text-[9px] text-left font-bold">Total Claim</td>
                          {[1, 2, 3, 4].map(idx => {
                            const col = detailCols[idx-1];
                            const isColActive = (Number(col?.quantity) || 0) > 0 || (Number(col?.arr_qty_wt) || 0) > 0 || (Number(col?.wt_quantity) || 0) > 0;
                            const gdVal = Number(col?.gd_sett) > 0 ? Number(col?.gd_sett) : Number(col?.gd_claim || 0);
                            const mVal = Number(col?.moist_sett) > 0 ? Number(col?.moist_sett) : Number(col?.moist_claim || 0);
                            const dVal = Number(col?.dust_sett) > 0 ? Number(col?.dust_sett) : Number(col?.dust_claim || 0);
                            const nVal = Number(col?.ncv_sett) > 0 ? Number(col?.ncv_sett) : Number(col?.ncv_claim || 0);
                            const totalClaimVal = gdVal + mVal + dVal + nVal;
                            return (
                              <td key={idx} colSpan={3} className="px-2 py-1.5 border-r border-gray-300 text-center font-black text-red-700 bg-red-100/50 text-[11px]">
                                {isColActive ? `${totalClaimVal.toFixed(2)}%` : '0.0%'}
                              </td>
                            );
                          })}
                        </tr>

                      </tbody>
                    </table>
                  </div>
                </LegacyFieldset>


              </div>

            </div>

          </div>
        </LegacyLayout>
      )}

      {/* View Settlement Modal (Table Type Statement) */}
      {showViewModal && viewModalData && (
        <PrintModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setViewModalData(null);
          }}
          title={`SETTLEMENT STATEMENT - M.R. #${viewModalData.master.mr_no || 'N/A'}`}
        >
          <div id="print-modal-children-canvas" className="p-6 bg-white text-slate-900 font-sans space-y-4">
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-3 text-center">
              <h2 className="text-xl font-black tracking-wide text-[#2a3088] uppercase">BALLY JUTE COMPANY LIMITED</h2>
              <p className="text-[11px] text-slate-600 font-medium">P.O. BALLY, DIST: HOWRAH, WEST BENGAL - 711201</p>
              <div className="inline-block mt-2 bg-slate-900 text-white text-xs font-black uppercase px-4 py-1 tracking-wider rounded-xs">
                M.R. SETTLEMENT & QUALITY AUDIT STATEMENT
              </div>
            </div>

            {/* Top Summary Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 bg-slate-50 border border-slate-300 p-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">M.R. Number</span>
                <span className="font-mono font-black text-rose-700 text-sm">{viewModalData.master.mr_no || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Settlement Date</span>
                <span className="font-bold">{viewModalData.master.sett_date || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Purchase Order No</span>
                <span className="font-mono font-bold text-blue-800">{viewModalData.master.po_no || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Lorry / Vehicle No</span>
                <span className="font-mono font-bold">{viewModalData.master.lorry_number || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Moisture (%)</span>
                <span className="font-mono font-black text-blue-900">{Number(viewModalData.master.summary_rate_wt_claim || 0) > 0 ? `${Number(viewModalData.master.summary_rate_wt_claim).toFixed(2)}%` : '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Supplier Name</span>
                <span className="font-bold text-slate-800 uppercase">{viewModalData.master.supplier || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Broker Name</span>
                <span className="font-bold text-slate-700">{viewModalData.master.broker || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Bill No & Date</span>
                <span className="font-mono">{viewModalData.master.payable_bill_no ? `${viewModalData.master.payable_bill_no} (${viewModalData.master.payable_bill_date || '-'})` : '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Payment Status</span>
                <span className="font-bold uppercase text-emerald-700">{viewModalData.master.payment_status || 'Settled'}</span>
              </div>
            </div>

            {/* Quality & Grade Specification Table */}
            <div className="space-y-1">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
                1. Material Quality & Specification Breakdown
              </h4>
              <div className="border border-slate-300 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-black uppercase text-slate-700">
                      <th className="p-1.5 border-r border-slate-300">Col #</th>
                      <th className="p-1.5 border-r border-slate-300">Grade</th>
                      <th className="p-1.5 border-r border-slate-300">Area</th>
                      <th className="p-1.5 border-r border-slate-300">Agency</th>
                      <th className="p-1.5 border-r border-slate-300">Marka</th>
                      <th className="p-1.5 border-r border-slate-300 text-center">Moisture (%)</th>
                      <th className="p-1.5 border-r border-slate-300 text-right">Quantity</th>
                      <th className="p-1.5 border-r border-slate-300 text-right">Weight (MT)</th>
                      <th className="p-1.5 border-r border-slate-300 text-right">Rate (₹/Qtl)</th>
                      <th className="p-1.5 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewModalData.details.filter(c => (Number(c.quantity) > 0 || Number(c.arr_qty_wt) > 0 || Number(c.rate_value) > 0)).map((col, idx) => {
                      const wtMt = getColWtMt(col);
                      const amt = getColAmount(col);
                      const moistVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-1.5 border-r border-slate-200 font-bold">{col.col_index || idx + 1}</td>
                          <td className="p-1.5 border-r border-slate-200 font-bold text-blue-900">{resolveGradeName(col.grade)}</td>
                          <td className="p-1.5 border-r border-slate-200">{col.area || '-'}</td>
                          <td className="p-1.5 border-r border-slate-200">{col.agency || '-'}</td>
                          <td className="p-1.5 border-r border-slate-200">{col.marka_crop || '-'}</td>
                          <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold text-blue-950">
                            {moistVal > 0 ? `${moistVal.toFixed(2)}%` : (Number(viewModalData.master.summary_rate_wt_claim) > 0 ? `${Number(viewModalData.master.summary_rate_wt_claim).toFixed(2)}%` : '-')}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 text-right font-mono">{col.quantity || 0}</td>
                          <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold">{wtMt.toFixed(3)}</td>
                          <td className="p-1.5 border-r border-slate-200 text-right font-mono">₹{Number(col.rate_value || 0).toFixed(2)}</td>
                          <td className="p-1.5 text-right font-mono font-black text-slate-900">₹{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DEDUCTION BREAKDOWN (TABLE TYPE - MATCHING USER SCREENSHOT) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                  2. Deduction Breakdown
                </h4>
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  Inspection Deductions & Penalties
                </span>
              </div>
              
              {/* Exact Table Card Style as User Screenshot */}
              <div className="border border-[#cbd5e1] rounded-lg overflow-hidden bg-white shadow-xs">
                <table className="w-full text-xs text-left border-collapse font-sans">
                  <thead>
                    <tr className="bg-[#eef3f9] border-b-2 border-[#2563eb] text-[11px] font-black uppercase text-slate-800 tracking-wider">
                      <th className="py-2.5 px-4 border-r border-[#cbd5e1] text-left w-7/12">
                        DEDUCTION TYPE
                      </th>
                      <th className="py-2.5 px-4 border-r border-[#cbd5e1] text-center w-3/12">
                        DEDUCTION RATE (₹)
                      </th>
                      <th className="py-2.5 px-4 text-center w-2/12">
                        QTY
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#cbd5e1]">
                    {(() => {
                      const deds = (viewModalData.master.deductions && Array.isArray(viewModalData.master.deductions))
                        ? viewModalData.master.deductions.filter((d: any) => d && ((d.deduction_type && !String(d.deduction_type).includes('-- SELECT')) || Number(d.deduction_rate) > 0 || Number(d.deduction_amount) > 0))
                        : [];

                      if (deds.length === 0) {
                        return (
                          <tr>
                            <td colSpan={3} className="py-3.5 px-4 text-center text-xs font-semibold text-slate-400 italic bg-slate-50/40">
                              No Deductions or Penalties Applied (₹0.00)
                            </td>
                          </tr>
                        );
                      }

                      return deds.map((dItem, dIdx) => {
                        const rate = Number(dItem.deduction_rate) || 0;
                        const qty = Number(dItem.deduction_qty) || (rate > 0 ? 1 : 0);

                        return (
                          <tr key={dIdx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 border-r border-[#cbd5e1] font-bold text-xs text-slate-900 uppercase">
                              {dItem.deduction_type || '-'}
                            </td>
                            <td className="py-3 px-4 border-r border-[#cbd5e1] text-center font-mono font-bold text-xs text-slate-900">
                              ₹{rate}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-xs text-slate-900">
                              {qty}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-[#cbd5e1] font-bold text-xs text-slate-700">
                      <td className="py-2 px-4 border-r border-[#cbd5e1] text-right font-black uppercase text-[10px] text-slate-600">
                        Total Deduction Subtracted (-):
                      </td>
                      <td colSpan={2} className="py-2 px-4 text-center font-mono font-black text-xs text-[#991b1b]">
                        ₹ {Number(viewModalData.master.summary_deduction_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Financial Summary & Payable Calculation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-300 p-3 rounded-xs text-xs">
              <div className="space-y-1.5">
                <p className="font-black text-slate-700 uppercase text-[10px] border-b border-slate-200 pb-1">Valuation Calculations</p>
                <div className="flex justify-between">
                  <span className="text-slate-600">Material Value (+):</span>
                  <span className="font-mono font-bold">₹ {Number(viewModalData.master.val_material_value || viewModalData.master.summary_material_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Additional Charges (+):</span>
                  <span className="font-mono font-bold">₹ {Number(viewModalData.master.val_add_amt || viewModalData.master.summary_misc_add || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Premium Amount (+):</span>
                  <span className="font-mono font-bold text-emerald-700">₹ {Number(viewModalData.master.val_premium_amt || viewModalData.master.summary_premium_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Quality Claims & Deductions (-):</span>
                  <span className="font-mono font-bold text-rose-700">₹ {Number(viewModalData.master.summary_deduction_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-1.5 md:border-l md:border-slate-300 md:pl-4">
                <p className="font-black text-slate-700 uppercase text-[10px] border-b border-slate-200 pb-1">Final Settlement Outflow</p>
                <div className="flex justify-between">
                  <span className="text-slate-600">Less Advance (-):</span>
                  <span className="font-mono font-bold">₹ {Number(viewModalData.master.final_less_adv || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">On Account Advance (-):</span>
                  <span className="font-mono font-bold">₹ {Number(viewModalData.master.final_on_ac_adv || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">APMC Fees (-):</span>
                  <span className="font-mono font-bold">₹ {Number(viewModalData.master.final_apmc_fees || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-300 text-sm">
                  <span className="font-black uppercase text-slate-900">Net Payable Amount:</span>
                  <span className="font-mono font-black text-emerald-800">₹ {Number(viewModalData.master.payable_amt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Signature Area */}
            <div className="pt-6 grid grid-cols-2 gap-12 text-center text-xs font-bold text-slate-700">
              <div className="border-t border-slate-400 pt-1">Prepared By</div>
              <div className="border-t border-slate-400 pt-1">Quality Inspector</div>
            </div>
          </div>
        </PrintModal>
      )}
    </div>
  );
}
