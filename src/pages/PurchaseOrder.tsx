import { PurchaseOrderFormHeader } from "../components/purchase-order/PurchaseOrderFormHeader";
import { SingleComboBox, SearchablePoContractDropdown, DualComboBox } from "../components/purchase-order/PoDropdownSelectors";
import { generatePoHtmlEmail } from "../components/purchase-order/PoPrintSlipHelper";
import { PurchaseOrderRegisterView } from "../components/purchase-order/PurchaseOrderRegisterView";
import React, { useState, useEffect, useRef } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import { 
  X, 
  ChevronDown, 
  Search, 
  Calculator,
  Save,
  Trash2,
  Edit,
  Plus,
  FileText,
  Printer,
  History,
  Image as ImageIcon,
  ShieldCheck,
  ClipboardList,
  ArrowLeft,
  RefreshCcw,
  Filter,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  HandCoins,
  Download,
  CheckCircle2,
  Clock,
  Mail,
  Truck,
  Users,
  Check,
  AlertCircle,
  Scale,
  CreditCard,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  UserCheck,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import { dbModule } from '../services/dbModule';
import { supabase } from '../lib/supabase';
import { cn, sanitizeCsvData, getApiUrl, canDeleteData } from '../lib/utils';
import { comparePoInspection, compareSaudaTempArrival, PoMatchResult } from '../lib/poMatch';
import { PaginationControls } from '../components/PaginationControls';
import { calculateWeightTolerance, WeightToleranceResult } from '../lib/weightTolerance';
import PoPrintSlip from '../components/PoPrintSlip';
import ExcessShortSettlementModal from '../components/ExcessShortSettlementModal';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { enforceEditOrDeletePermission, canEditOrDelete, canViewCompletedData, getCurrentUserContext, isUserAdmin, isL5OrAdmin } from '../lib/permissions';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from 'recharts';

import { PoCalculationModal } from '../components/purchase-order/PoCalculationModal';
import { PoReopenModal } from '../components/purchase-order/PoReopenModal';
import { PoConsignmentModal } from '../components/purchase-order/PoConsignmentModal';
import { PoItemsGrid } from '../components/purchase-order/PoItemsGrid';
import { poService } from '../services/poService';
import { 
  AreaDifferential, 
  EXCEL_SEED_DATA, 
  formatPoNumber, 
  compareQualities, 
  numberToWords 
} from '../utils/purchaseOrderCalculations';
import { generatePoPdf, downloadPoPdfFile } from '../utils/purchaseOrderPdfGenerator';
import {
  PoActionMenuPortal,
  PoEmailToastNotification,
  GlobalConfirmModal,
  ReopenSuccessModal,
  ReopenAuditLogModal,
  MismatchApprovalModal
} from '../components/purchase-order/PurchaseOrderModals';
import {
  verifyAdminOrSuperPassword,
  checkIsAdvancePaymentDone,
  checkIsSettlementDone
} from '../services/purchaseOrderAuthService';

export default function PurchaseOrder({ onClose, selectedYear, isTempPo = false, finalStage = false, isArchiveView = false }: { onClose?: () => void; selectedYear?: string; isTempPo?: boolean; finalStage?: boolean; isArchiveView?: boolean }) {
  // Separate table architecture based on user specification:
  // Sauda Check Point (isTempPo) uses 'sauda_check_point' & 'sauda_check_point_details'
  // Final P.O uses 'purchase_master' & 'purchase_detail_master'
  const MASTER_TABLE = isArchiveView ? 'p.o_archive' : (isTempPo ? 'sauda_check_point' : 'purchase_master');
  const DETAIL_TABLE = isArchiveView ? 'po_archive' : (isTempPo ? 'sauda_check_point_details' : 'purchase_detail_master');

  const poFormRef = useRef<HTMLDivElement>(null);
  useKeyboardNavigation(poFormRef, () => {
    handleSave();
  });

  const getCropYear = () => {
    if (selectedYear) {
      if (selectedYear.includes('-')) {
        const parts = selectedYear.split('-');
        if (parts.length === 2 && parts[1].length === 4) {
          return `${parts[0]}-${parts[1].substring(2)}`;
        }
      }
      return selectedYear;
    }
    return '2026-27';
  };
  const todayStr = new Date().toISOString().split('T')[0];

  const handleCsvDownload = async () => {
    try {
      if (!supabase) {
        alert("Database connection client is not loaded.");
        return;
      }
      setLoading(true);

      // Fetch item details for complete CSV export
      let detailData: any[] = [];
      try {
        const { data } = await supabase.from(DETAIL_TABLE).select('*');
        detailData = data || [];
      } catch (e) {
        console.warn("Failed to fetch detail table for CSV:", e);
      }

      const detailsByPo: Record<string, any[]> = {};
      detailData.forEach((d: any) => {
        const key = String(d.po_no || '').trim().toUpperCase();
        if (!key) return;
        if (!detailsByPo[key]) detailsByPo[key] = [];
        detailsByPo[key].push(d);
      });

      const listToExport = scopedPos.length > 0 ? scopedPos : (sectionPos.length > 0 ? sectionPos : poList);

      if (!listToExport || listToExport.length === 0) {
        alert("No Purchase Orders found matching current view to export.");
        return;
      }

      // Map raw columns to customer-friendly headers with correct DB field names
      const dataToExport = listToExport.map((row: any) => {
        const poKey = String(row.po_no || '').trim().toUpperCase();
        const poDetails = detailsByPo[poKey] || [];

        const gradeItemDetails = poDetails.map((d: any) => {
          const gName = gradeList.find((g: any) => g.grade_code === d.grade_code)?.grade_name || d.grade_name || d.grade_code || '';
          const qty = d.quantity ? `${d.quantity} Units` : '';
          const wt = d.weight_mt ? `${Number(d.weight_mt).toFixed(3)} MT` : '';
          const rate = d.rate_qntl ? `@ Rs.${d.rate_qntl}` : '';
          return [gName, qty, wt, rate].filter(Boolean).join(' ');
        }).join(' | ');

        const rawPoDate = row.po_date || row.date;
        const formattedPoDate = rawPoDate ? new Date(rawPoDate).toLocaleDateString('en-GB') : '';
        const rawSaudaDate = row.s_date || row.contract_date;
        const formattedSaudaDate = rawSaudaDate ? new Date(rawSaudaDate).toLocaleDateString('en-GB') : '';

        const contractMt = parseFloat(row.total_contract_mt) || parseFloat(row.quantity) || 0;
        const rcvdMt = parseFloat(row.received_weight_mt) || 0;
        const unit = row.purchase_unit_name || row.po_type || 'BALES';
        const tol = calculateWeightTolerance(contractMt, rcvdMt, unit);
        const pStatus = row.status ? String(row.status).toUpperCase() : (tol.isCompleted || row.pending === false ? 'COMPLETED' : 'PENDING');

        return {
          "PO / PTF No": row.po_no || row.ptf_no || '',
          "PO Date": formattedPoDate,
          "Sauda Contract No": row.sauda_no || row.contract_po_no || '',
          "Sauda Date": formattedSaudaDate,
          "Broker": row.broker || '',
          "Merchant / Supplier": row.supplier || row.merchant || '',
          "Challan Supplier": row.challan_supplier || '',
          "Area / Station": row.area || row.dispatch_station || '',
          "B. Rate (Rs/MT)": row.b_rate || 0,
          "Unit / Lorry": row.purchase_unit_name || row.po_type || 'BALES',
          "Total Lorries": row.total_lorries || 0,
          "Total Units / Bales": row.total_units || 0,
          "Total Contract Wt (MT)": contractMt,
          "Received Weight (MT)": rcvdMt,
          "Weight Tolerance": tol.formattedTolerance,
          "Acceptable Range (MT)": tol.formattedRange,
          "Status": pStatus,
          "Session / Year": row.session || row.financial_year || '',
          "Crop Year": row.crop_year || '',
          "Transport Paid By": row.trans_paid_by || row.transport_type || '',
          "Delivery From": row.delivery_from || '',
          "Delivery To": row.delivery_to || '',
          "Grace Days": row.grace_days || 0,
          "Moisture Limit %": row.moisture || 0,
          "Moisture Penalty %": row.moisture_penalty || 0,
          "Dust Limit %": row.dust || 0,
          "Dust Penalty %": row.dust_penalty || 0,
          "NCV Limit %": row.ncv || 0,
          "NCV Penalty %": row.ncv_penalty || 0,
          "Grade & Item Breakdown": gradeItemDetails || 'N/A',
          "Remarks": row.remarks || '',
          "Financial Year": row.financial_year || '',
          "Created At": row.created_at || ''
        };
      });

      const sanitizedData = sanitizeCsvData(dataToExport);
      const csv = Papa.unparse(sanitizedData);
      const csvContent = "\uFEFF" + csv;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const exportType = isTempPo ? 'Temporary_PO' : 'Final_PO';
      link.setAttribute('download', `${exportType}_Full_Export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("PO CSV Export failed:", err);
      alert("Failed to export: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'register' | 'form'>('register');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'short' | 'excess' | 'cancelled'>('all');
  const [selectedPoNo, setSelectedPoNo] = useState<string | null>(null);

  // 100-rows per page pagination (searches full dataset, displays paginated)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, statusFilter]);
  const [sortConfig, setSortConfig] = useState<{
    key: 'po_no' | 'date' | 'type' | 'supplier' | 'broker' | 'unit' | 'total_units' | 'weight' | 'status' | 'closed_open' | 'excess_short' | 'pass_mismatch';
    direction: 'asc' | 'desc';
  }>({ key: 'date', direction: 'desc' });

  const handleSort = (key: 'po_no' | 'date' | 'type' | 'supplier' | 'broker' | 'unit' | 'total_units' | 'weight' | 'status' | 'closed_open' | 'excess_short' | 'pass_mismatch') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1);
  };
  
  // Modal toggle state for calculation helper overlay
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [selectedItemSrl, setSelectedItemSrl] = useState<number | null>(null);
  
  // DB Records
  const [poList, setPoList] = useState<any[]>([]);
  // 1-to-N Consignment Ledger Modal State
  const [consignmentLedgerPo, setConsignmentLedgerPo] = useState<any>(null);
  const [excessShortModalPo, setExcessShortModalPo] = useState<any>(null);
  const [mismatchModalPo, setMismatchModalPo] = useState<any>(null);

  const getMismatchReasonText = (item: any) => {
    if (item.mismatch_fields && item.mismatch_fields.length > 0) {
      return item.mismatch_fields.join(", ");
    }
    if (item.mismatch_reason) return item.mismatch_reason;
    const mr = matchResults[item.po_no] || matchResults[item.contract_po_no];
    if (mr && mr.mismatches && mr.mismatches.length > 0) {
      return mr.mismatches.map((m: any) => m.mismatchLabel || m.field || 'Quality/Rate Variation').join(", ");
    }
    return "Rate difference or Quality variation detected between Sauda & Material Arrival.";
  };

  const handleApproveMismatch = async (targetPo: any) => {
    if (!targetPo) return;
    const cleanPoNo = String(targetPo.po_no || targetPo.contract_po_no || '').trim().toUpperCase();
    try {
      localStorage.setItem(`pass_status_${cleanPoNo}`, 'pass');
      localStorage.setItem(`material_resolved_${cleanPoNo}`, 'true');
      localStorage.setItem(`mismatch_cleared_${cleanPoNo}`, 'true');

      if (supabase) {
        try { await supabase.from('material_inspection').update({ pass_status: 'pass', status: 'resolved' }).eq('po_no', targetPo.po_no); } catch (e) {}
        try { await supabase.from('sauda_check_point').update({ pass_status: 'pass', mismatch_cleared: true, workflow_stage: 'final_po' }).eq('po_no', targetPo.po_no); } catch (e) {}
      }

      setPoList(prev => prev.map(p => {
        if (p.po_no === targetPo.po_no) {
          return { ...p, pass_status: 'pass', mismatch_cleared: true, workflow_stage: 'final_po' };
        }
        return p;
      }));

      setMismatchModalPo(null);
      alert(`✅ Mismatch Approved for Sauda #${targetPo.po_no}!\nStatus updated to PASS. Click the green PASS button in the dashboard to move to Final P.O.`);
      await fetchPosAndMasters();
    } catch (err: any) {
      alert(`Failed to approve mismatch: ${err.message || err}`);
    }
  };

  // Closed / Reopen Sauda Workflow States
  const [closedNoticePo, setClosedNoticePo] = useState<any>(null);
  const [reopenAuthModalPo, setReopenAuthModalPo] = useState<any>(null);
  const [reopenUsername, setReopenUsername] = useState<string>('');
  const [reopenPassword, setReopenPassword] = useState<string>('');
  const [reopenRemarks, setReopenRemarks] = useState<string>('');
  const [reopenError, setReopenError] = useState<string>('');
  const [isReopening, setIsReopening] = useState<boolean>(false);
  const [showReopenPassword, setShowReopenPassword] = useState<boolean>(false);
  const [reopenSuccessInfo, setReopenSuccessInfo] = useState<{ po: any; openRemarks: any } | null>(null);
  const [auditViewPo, setAuditViewPo] = useState<any>(null);
  const [allScpDetails, setAllScpDetails] = useState<any[]>([]);
  const [sattaCalcs, setSattaCalcs] = useState<any[]>([]);
  const [sattaBases, setSattaBases] = useState<any[]>([]);
  const [allTempArrivals, setAllTempArrivals] = useState<any[]>([]);
  const [allFinalArrivals, setAllFinalArrivals] = useState<any[]>([]);
  const [allInspections, setAllInspections] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [allSettlements, setAllSettlements] = useState<any[]>([]);

  // Temporary P.O ↔ Material Inspection match status, keyed by po_no.
  const [matchResults, setMatchResults] = useState<Record<string, PoMatchResult>>({});
  // DB Mismatch tables cache for cross-checking approval statuses
  const [dbMaterialMismatches, setDbMaterialMismatches] = useState<any[]>([]);
  const [dbSattaMismatches, setDbSattaMismatches] = useState<any[]>([]);
  // Settled Excess/Short Deductions Map
  const [settledDeductions, setSettledDeductions] = useState<Record<string, any>>({});

  // PTF creation mode: 'fresh' or 'reference' (against a cancelled P.O).
  const [ptfMode, setPtfMode] = useState<'fresh' | 'reference'>('fresh');
  // On the Final P.O view: po_nos that still exist in sauda_check_point (= not yet
  // finalized) so we can hide them from Final and keep the two dashboards clean.
  const [tempPoNoSet, setTempPoNoSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isTempPo || !supabase) { setTempPoNoSet(new Set()); return; }
      try {
        const { data } = await supabase.from('sauda_check_point').select('po_no');
        if (!cancelled) setTempPoNoSet(new Set((data || []).map((r: any) => String(r.po_no || '').trim().toUpperCase())));
      } catch (_e) { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [isTempPo, poList]);
  // Row Actions dropdown (portal-positioned so it isn't clipped by the table).
  const [actionMenu, setActionMenu] = useState<{ item: any; x: number; y: number } | null>(null);
  // Professional confirm dialog (replaces window.confirm).
  const [confirmState, setConfirmState] = useState<
    { title: string; message: string; tone: 'default' | 'danger'; confirmLabel: string; resolve: (v: boolean) => void } | null
  >(null);
  const askConfirm = (
    message: string,
    opts?: { title?: string; tone?: 'default' | 'danger'; confirmLabel?: string },
  ) => new Promise<boolean>((resolve) => setConfirmState({
    title: opts?.title || 'Please Confirm',
    message,
    tone: opts?.tone || 'default',
    confirmLabel: opts?.confirmLabel || 'Confirm',
    resolve,
  }));

  function isPoMismatchResolved(poOrItem: any): boolean {
    if (!poOrItem) return false;
    const item = typeof poOrItem === 'object' 
      ? poOrItem 
      : poList.find((p: any) => String(p.po_no || p.contract_po_no || '').trim().toUpperCase() === String(poOrItem).trim().toUpperCase()) || { po_no: String(poOrItem) };
    
    const poNo = String(item.po_no || '').trim().toUpperCase();
    const contractPoNo = String(item.contract_po_no || '').trim().toUpperCase();
    const saudaNo = String(item.sauda_no || item.po_contract || item.contract_no || '').trim().toUpperCase();
    const ptfNo = String(item.ptf_no || '').trim().toUpperCase();
    
    // Suffix extraction (e.g. 0153 from BJCL/2026-2027/0153 or BJC0153/26-27 or 0237 from BJCL/2026-2027/0237)
    const poSuffix = poNo.split('/').pop() || '';
    const saudaSuffix = saudaNo.split('/').pop() || '';
    const tokens = [poNo, contractPoNo, saudaNo, ptfNo, poSuffix, saudaSuffix].filter(t => t && t !== 'N/A' && t !== 'UNDEFINED');

    // 1. Direct record flags on item
    if (
      item.pass_status === 'pass' ||
      item.is_pass === true ||
      item.mismatch_cleared === true || 
      item.mismatch_cleared === 'true' || 
      item.satta_dispute_approved === true || 
      item.satta_dispute_approved === 'true' ||
      item.status === 'resolved' ||
      item.status === 'cleared' ||
      item.status === 'final' ||
      item.status === 'approved' ||
      item.status === 'moved_to_final' ||
      item.is_resolved === true ||
      item.is_mismatch_resolved === true
    ) {
      return true;
    }

    // 2. Check localStorage tokens
    for (const token of tokens) {
      const tu = token.toUpperCase();
      const matCache = localStorage.getItem(`material_resolved_${tu}`);
      const satCache = localStorage.getItem(`satta_resolved_${tu}`);
      const misCache = localStorage.getItem(`material_resolved_MIS-${tu}`);
      const genCache = localStorage.getItem(`mismatch_resolved_${tu}`);
      const clrCache = localStorage.getItem(`mismatch_cleared_${tu}`);
      const passCache = localStorage.getItem(`pass_status_${tu}`);
      const saudaClrCache = localStorage.getItem(`sauda_resolved_${tu}`);
      if (matCache || satCache || misCache || genCache || clrCache || passCache || saudaClrCache) {
        return true;
      }
    }

    // 3. Check dbMaterialMismatches
    const hasMaterialResolved = dbMaterialMismatches.some((m: any) => {
      const mPo = String(m.po_no || '').trim().toUpperCase();
      const mId = String(m.mismatch_id || m.id || '').toUpperCase();
      const st = String(m.status || m.resolution_status || '').toLowerCase();
      const isResolvedStatus = st === 'resolved' || st === 'approved' || st === 'cleared' || Boolean(m.approved_by) || String(m.remarks || '').toUpperCase().includes('APPROVED');
      if (!isResolvedStatus) return false;
      
      return tokens.some(t => {
        const tu = t.toUpperCase();
        return (mPo && (mPo === tu || mPo.includes(tu) || tu.includes(mPo))) ||
               (mId && (mId === `MIS-${tu}` || mId.includes(tu)));
      });
    });
    if (hasMaterialResolved) return true;

    // 4. Check dbSattaMismatches
    const hasSattaResolved = dbSattaMismatches.some((s: any) => {
      const sPo = String(s.po_no || '').trim().toUpperCase();
      const sSauda = String(s.sauda_no || '').trim().toUpperCase();
      const sId = String(s.mismatch_id || s.id || '').toUpperCase();
      const st = String(s.status || s.resolution_status || '').toLowerCase();
      const isResolvedStatus = st === 'resolved' || st === 'approved' || st === 'cleared' || Boolean(s.approved_by) || String(s.remarks || '').toUpperCase().includes('APPROVED');
      if (!isResolvedStatus) return false;

      return tokens.some(t => {
        const tu = t.toUpperCase();
        return (sPo && (sPo === tu || sPo.includes(tu) || tu.includes(sPo))) ||
               (sSauda && (sSauda === tu || sSauda.includes(tu) || tu.includes(sSauda))) ||
               (sId && (sId === `SAT-${tu}` || sId.includes(tu)));
      });
    });
    if (hasSattaResolved) return true;

    return false;
  }

  // Compute header-level match against Material Inspection for the Temp P.O list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || poList.length === 0) {
        setMatchResults({});
        return;
      }
      try {
        const [matInspRes, detailsRes] = await Promise.all([
          supabase.from('material_inspection').select('*').then(r => r, () => ({ data: [] as any[] })),
          supabase.from('sauda_check_point_details').select('*').then(r => r, () => ({ data: [] as any[] })),
        ]);

        const inspList = (matInspRes as any)?.data || [];
        const detailsList = (detailsRes as any)?.data || [];

        const clean = (v: any) => String(v ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
        const results: Record<string, PoMatchResult> = {};

        for (const po of poList) {
          const poNoClean = clean(po.po_no || po.contract_po_no || po.ptf_no);
          // Find matching inspection record strictly from the Mill Inspection / Material Inspection section
          const matchInsp = inspList.find((i: any) => {
            const inspPoClean = clean(i.po_no);
            const inspMillPoClean = clean(i.mill_po_no);
            const inspPtfClean = clean(i.ptf_no);
            return (
              (inspPoClean && inspPoClean === poNoClean) || 
              (inspMillPoClean && inspMillPoClean === poNoClean) ||
              (inspPtfClean && inspPtfClean === poNoClean) ||
              (po.ptf_no && clean(po.ptf_no) && clean(po.ptf_no) === inspPoClean) ||
              (po.po_no && clean(po.po_no) && clean(po.po_no) === inspPoClean)
            );
          });
          const poDetails = detailsList.filter((d: any) => d.po_no && clean(d.po_no) === poNoClean);
          const allReceipts = inspList.filter((i: any) => {
            const inspPoClean = clean(i.po_no);
            const inspMillPoClean = clean(i.mill_po_no);
            const inspPtfClean = clean(i.ptf_no);
            return (
              (inspPoClean && inspPoClean === poNoClean) || 
              (inspMillPoClean && inspMillPoClean === poNoClean) ||
              (inspPtfClean && inspPtfClean === poNoClean)
            );
          });

          const res = comparePoInspection(po, poDetails, matchInsp || null, allReceipts);
          if (isPoMismatchResolved(po)) {
            res.status = 'match';
            res.mismatches = [];
          }
          if (po.po_no) results[po.po_no] = res;
          if (po.contract_po_no) results[po.contract_po_no] = res;
          if (po.ptf_no) results[po.ptf_no] = res;
        }
        if (!cancelled) setMatchResults(results);
      } catch (_e) {
        /* inspection match is non-fatal */
      }
    })();
    return () => { cancelled = true; };
  }, [poList, isTempPo]);
  const [printingPo, setPrintingPo] = useState<any | null>(null);
  const [emailSendingStatus, setEmailSendingStatus] = useState<Record<string, 'idle' | 'sending' | 'success' | 'error'>>({});
  const [emailNotification, setEmailNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (emailNotification) {
      const timer = setTimeout(() => {
        setEmailNotification(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [emailNotification]);

  const handleSendMailPo = async (poHeader: any) => {
    const poNo = poHeader.po_no;
    if (!poNo) return;

    const brokerName = String(poHeader.broker || '').trim();

    // 1. Lookup Broker Email from customer_master and brokerList
    let brokerEmail = '';
    if (supabase && brokerName) {
      try {
        const { data: custData } = await supabase
          .from('customer_master')
          .select('email, firm_name, proprietor_name');

        if (custData && custData.length > 0) {
          const exactMatch = custData.find((c: any) => 
            (c.firm_name && c.firm_name.trim().toUpperCase() === brokerName.toUpperCase()) ||
            (c.proprietor_name && c.proprietor_name.trim().toUpperCase() === brokerName.toUpperCase())
          );
          if (exactMatch?.email && exactMatch.email.trim()) {
            brokerEmail = exactMatch.email.trim();
          } else {
            const partialMatch = custData.find((c: any) => 
              (c.firm_name && (c.firm_name.toUpperCase().includes(brokerName.toUpperCase()) || brokerName.toUpperCase().includes(c.firm_name.toUpperCase()))) ||
              (c.proprietor_name && (c.proprietor_name.toUpperCase().includes(brokerName.toUpperCase()) || brokerName.toUpperCase().includes(c.proprietor_name.toUpperCase())))
            );
            if (partialMatch?.email && partialMatch.email.trim()) {
              brokerEmail = partialMatch.email.trim();
            }
          }
        }
      } catch (err) {
        console.warn("Failed to query customer_master for broker email:", err);
      }
    }

    if (!brokerEmail && brokerList && brokerList.length > 0 && brokerName) {
      const bMatch = brokerList.find((b: any) => 
        (b.brok_name && b.brok_name.toUpperCase() === brokerName.toUpperCase()) ||
        (b.brok_code && b.brok_code.toUpperCase() === String(poHeader.broker_code || '').toUpperCase())
      );
      if (bMatch?.email && bMatch.email.trim()) {
        brokerEmail = bMatch.email.trim();
      }
    }

    // If broker email is not found or not added
    if (!brokerEmail) {
      setEmailSendingStatus(prev => ({ ...prev, [poNo]: 'error' }));
      const msg = `Email address Not Found for Broker "${brokerName || 'N/A'}". Please add an email address in Customer Master.`;
      setEmailNotification({
        type: 'error',
        title: 'Email address Not Found',
        message: msg
      });
      alert(`Email address Not Found!\n\nNo email address found for Broker "${brokerName || 'N/A'}".\nPlease add an email address in Customer Master.`);
      setTimeout(() => {
        setEmailSendingStatus(prev => ({ ...prev, [poNo]: 'idle' }));
      }, 3000);
      return;
    }

    setEmailSendingStatus(prev => ({ ...prev, [poNo]: 'sending' }));

    const getGradeNameForCompare = (gCode: string) => {
      const match = gradeList.find((g: any) => g.grade_code === gCode);
      return match ? match.grade_name : gCode;
    };

    try {
      // Find full items
      const details = await dbModule.fetchAll(DETAIL_TABLE);
      const filtered = details
        .filter((d: any) => d.po_no === poHeader.po_no)
        .sort((a: any, b: any) => (Number(a.srl_no || a.srl || 0) - Number(b.srl_no || b.srl || 0)));
      
      const isBales = (poHeader.purchase_unit_name || 'BALES') === 'BALES';
      const mappedItems = filtered.map((d: any, idx: number) => {
        const qtyVal = d.quantity || 0;
        const weightVal = isBales 
          ? parseFloat(((qtyVal * 147.5) / 1000).toFixed(3)) 
          : (d.weight_mt || 0);
        return {
          srl: idx + 1,
          crop: d.crop_year || '2025-26',
          grade_code: d.grade_code || '',
          grade_name: gradeList.find(g => g.grade_code === d.grade_code)?.grade_name || d.grade_code || 'STANDARD GRADE',
          agency_code: d.agency_code || '',
          agency_name: agencyList.find(a => a.agency_code === d.agency_code)?.agency_name || d.agency_code || 'MAIN AGENCY',
          marka_code: d.marka_code || '',
          marka_name: markaList.find(m => m.marka_code === d.marka_code)?.marka_name || d.marka_code || 'NORMAL GRADE',
          qty: qtyVal,
          weight: weightVal,
          rate: d.rate_qntl || 0
        };
      });

      const sumQty = mappedItems.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
      const sumWt = mappedItems.reduce((s, it) => s + (parseFloat(it.weight) || 0), 0);

      const fullPo = {
        no: poHeader.po_no || '',
        ptf_no: poHeader.ptf_no || '',
        is_ptf: !!poHeader.ptf_no,
        date: poHeader.po_date || poHeader.created_at || todayStr,
        broker: poHeader.broker || 'N/A',
        supplier: poHeader.supplier || 'N/A',
        challan_supplier: poHeader.challan_supplier || 'N/A',
        area: poHeader.area || 'N/A',
        trans_paid_by: poHeader.trans_paid_by || 'PARTY',
        weight_unit_kgs: String(poHeader.weight_unit_kgs || (isBales ? '147.5' : '50')),
        against_cancellation: poHeader.against_cancellation || 'No',
        purchase_unit_name: poHeader.purchase_unit_name || 'BALES',
        total_no_of_lorries: String(poHeader.total_lorries || '0'),
        units_per_lorry: String(poHeader.units_per_lorry || '0'),
        total_units: isBales ? sumQty.toString() : String(poHeader.total_units || '0'),
        weight_per_lorry: poHeader.weight_per_lorry !== undefined && poHeader.weight_per_lorry !== null && !isNaN(Number(poHeader.weight_per_lorry)) && Number(poHeader.weight_per_lorry) > 0
          ? Number(poHeader.weight_per_lorry).toFixed(3)
          : String(poHeader.weight_per_lorry || '0.000'),
        total_contract_mt: isBales ? sumWt.toFixed(3) : String(poHeader.total_contract_mt || '0'),
        marka_type: poHeader.marka_type || 'Normal',
        marka_penalty: String(poHeader.marka_penalty || '0'),
        qty_penalty: String(poHeader.qty_penalty || '5'),
        delivery_from: poHeader.delivery_from || todayStr,
        delivery_to: poHeader.delivery_to || todayStr,
        grace_days: String(poHeader.grace_days || '0'),
        delivery_penalty: String(poHeader.delivery_penalty || '0'),
        contract_po_no: poHeader.contract_po_no || '',
        contract_date: poHeader.contract_date || todayStr,
        rate_detail: poHeader.rate_detail || '',
        delivery_schedule: poHeader.delivery_schedule || '',
        terms_condition: poHeader.terms_condition || 'Penalty Rs.5/day. Standard terms apply.',
        remarks: poHeader.remarks || 'Grade rates based on BJCL indices.',
        po_identification: poHeader.po_identification || 'Direct Advance Payment',
        b_rate: String(poHeader.b_rate || '0'),
        s_date: poHeader.s_date || todayStr,
        items: mappedItems
      };

      const emailHtml = generatePoHtmlEmail(fullPo);

      // Generate the PO PDF so it can be attached to the email.
      let poPdfBase64 = "";
      try {
        const poDoc = generatePoPdf(fullPo);
        poPdfBase64 = poDoc.output("datauristring").split(",")[1] || "";
      } catch (pdfErr) {
        console.error("Failed to generate PO PDF for email:", pdfErr);
      }

      let recipientEmails = brokerEmail;
      if (supabase && poHeader.supplier) {
        const { data: custSupplier } = await supabase
          .from('customer_master')
          .select('email')
          .eq('firm_name', poHeader.supplier)
          .maybeSingle();
        if (custSupplier?.email && custSupplier.email.trim() && !recipientEmails.includes(custSupplier.email.trim())) {
          recipientEmails += `, ${custSupplier.email.trim()}`;
        }
      }

      const res = await fetch(getApiUrl("/api/send-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `📋 PURCHASE ORDER SLIP: #${poHeader.po_no} - [${poHeader.broker || 'N/A'}]`,
          to: recipientEmails.split(',').map(e => e.trim()).filter(Boolean).join(', ') || brokerEmail,
          html: emailHtml,
          filename: `Purchase_Order_${poHeader.po_no || 'Draft'}.pdf`,
          pdfData: poPdfBase64 || undefined
        })
      });

      const resText = await res.text();
      let resData;
      try {
        resData = JSON.parse(resText);
      } catch (e) {
        throw new Error("Mail Dispatch Failed: " + (resText.substring(0, 100) || `Status ${res.status}`));
      }
      
      if (res.ok && resData.success) {
        setEmailSendingStatus(prev => ({ ...prev, [poNo]: 'success' }));
        setEmailNotification({
          type: 'success',
          title: 'Email Send Successfully',
          message: `Email Send Successfully to ${recipientEmails} for PO #${poHeader.po_no}`
        });
        alert(`Email Send Successfully to ${recipientEmails}!`);
        setTimeout(() => {
          setEmailSendingStatus(prev => ({ ...prev, [poNo]: 'idle' }));
        }, 3000);
      } else {
        throw new Error(resData.error || "Failed to send email");
      }
    } catch (err: any) {
      console.error(err);
      setEmailSendingStatus(prev => ({ ...prev, [poNo]: 'error' }));
      setEmailNotification({
        type: 'error',
        title: 'Email Dispatch Failed',
        message: `Failed to send email: ${err.message || String(err)}`
      });
      alert(`Failed to send email: ${err.message || String(err)}`);
      setTimeout(() => {
        setEmailSendingStatus(prev => ({ ...prev, [poNo]: 'idle' }));
      }, 3000);
    }
  };
  
  // Data lists fetched from master tables
  const [brokerList, setBrokerList] = useState<any[]>([]);
  const [supplierList, setSupplierList] = useState<any[]>([]);
  const [areaList, setAreaList] = useState<any[]>([]);
  const [saudaList, setSaudaList] = useState<any[]>([]);
  const [gradeList, setGradeList] = useState<any[]>([]);
  const [markaList, setMarkaList] = useState<any[]>([]);
  const [agencyList, setAgencyList] = useState<any[]>([]);

  // Satta Chart Cache States
  const [sattaBaseRates, setSattaBaseRates] = useState<any[]>([]);
  const [sattaCalculatedRates, setSattaCalculatedRates] = useState<any[]>([]);
  const [sattaDifferentials, setSattaDifferentials] = useState<any[]>([]);

  const lookupSattaBaseRate = (sDateStr: string, bases: any[] = sattaBaseRates) => {
    const sDate = sDateStr || todayStr;
    const sortedBases = [...bases]
      .filter(b => b.start_date && b.start_date <= sDate)
      .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));

    if (sortedBases.length > 0 && sortedBases[0].base_rate) {
      return String(sortedBases[0].base_rate);
    }
    if (bases.length > 0 && bases[0].base_rate) {
      return String(bases[0].base_rate);
    }
    return '';
  };

  const getSattaRateForRow = (
    rowAgencyName: string,
    rowGradeName: string,
    sDateStr: string,
    bRateStr: string,
    bases: any[] = sattaBaseRates,
    calcs: any[] = sattaCalculatedRates,
    diffs: any[] = sattaDifferentials,
    overrideArea?: string
  ) => {
    const sDate = sDateStr || todayStr;
    const bRate = parseFloat(bRateStr) || 0;

    const normAgency = (rowAgencyName || '').trim().toUpperCase();
    const normGrade = (rowGradeName || '').trim().toUpperCase();
    const normArea = (overrideArea || formData?.area || '').trim().toUpperCase();

    if (!normGrade) return null;
    if (!normAgency && !normArea) return null;

    let differential = 0;
    let found = false;

    // 1. Find the active satta base rate for sDate
    const sortedBases = [...bases]
      .filter(b => b.start_date && b.start_date <= sDate)
      .sort((a, b) => b.start_date.localeCompare(a.start_date));

    const activeBase = sortedBases[0];

    const lookupInSatta = (areaToLookup: string) => {
      if (!areaToLookup) return null;

      // 2. Try to find differential in satta_calculated_rates for this active base rate
      if (activeBase && calcs.length > 0) {
        const match = calcs.find(c => 
          c.start_date === activeBase.start_date &&
          (c.area || '').trim().toUpperCase() === areaToLookup &&
          (c.grade || '').trim().toUpperCase() === normGrade
        );
        if (match) {
          return parseFloat(match.differential) || 0;
        }
      }

      // 3. Fallback to general satta_differentials
      if (diffs.length > 0) {
        const match = diffs.find(d => 
          (d.area || '').trim().toUpperCase() === areaToLookup &&
          (d.grade || '').trim().toUpperCase() === normGrade
        );
        if (match) {
          return parseFloat(match.differential) || 0;
        }
      }

      // 4. Fallback to EXCEL_SEED_DATA
      const matchArea = EXCEL_SEED_DATA.find(a => a.area.toUpperCase() === areaToLookup);
      if (matchArea && matchArea.diffs) {
        const diffVal = matchArea.diffs[normGrade];
        if (diffVal !== undefined) {
          return diffVal;
        }
      }

      return null;
    };

    // Try specific row agency first
    let diffVal = lookupInSatta(normAgency);
    if (diffVal !== null) {
      differential = diffVal;
      found = true;
    } else if (normArea && normArea !== normAgency) {
      // Fallback to procurement Area (from PO Header)
      diffVal = lookupInSatta(normArea);
      if (diffVal !== null) {
        differential = diffVal;
        found = true;
      }
    }

    if (found) {
      const baseToUse = bRate > 0 ? bRate : (activeBase ? parseFloat(activeBase.base_rate) || 0 : 0);
      return baseToUse + differential;
    }

    return null;
  };

  const recalculateAllRates = (
    items: any[], 
    sDate: string, 
    bRate: string, 
    bases: any[] = sattaBaseRates, 
    calcs: any[] = sattaCalculatedRates, 
    diffs: any[] = sattaDifferentials,
    overrideArea?: string
  ) => {
    return items.map(row => {
      const computed = getSattaRateForRow(
        row.agency_name,
        row.grade_name,
        sDate,
        bRate,
        bases,
        calcs,
        diffs,
        overrideArea
      );
      if (computed !== null) {
        return { ...row, rate: computed };
      }
      return row;
    });
  };

  const recalculateItemWeights = (items: any[], unitWeightKgs: number) => {
    return items.map(item => ({
      ...item,
      weight: parseFloat(((item.qty * unitWeightKgs) / 1000).toFixed(3))
    }));
  };

  const handlePurchaseUnitChange = (name: string, code: string) => {
    const isDrums = name.toUpperCase() === 'DRUMS';
    const weightUnitKgs = isDrums ? '50' : '147.5';
    const unitWtVal = parseFloat(weightUnitKgs);

    if (formData.is_ptf) {
      // In PTF Mode: Pure manual entry preservation
      setFormData(prev => ({
        ...prev,
        purchase_unit_name: name,
        purchase_unit_code: code,
        weight_unit_kgs: weightUnitKgs
      }));
      return;
    }

    const lorries = parseFloat(formData.total_no_of_lorries) || 0;
    const unitsPerLorry = parseFloat(formData.units_per_lorry) || 0;
    const totalUnits = lorries * unitsPerLorry;
    const wtPerLorry = (unitsPerLorry * unitWtVal) / 1000;
    const totalContractMt = (totalUnits * unitWtVal) / 1000;

    const updatedItems = recalculateItemWeights(formData.items, unitWtVal);

    setFormData(prev => ({
      ...prev,
      purchase_unit_name: name,
      purchase_unit_code: code,
      weight_unit_kgs: weightUnitKgs,
      weight_per_lorry: wtPerLorry > 0 ? wtPerLorry.toFixed(3) : prev.weight_per_lorry,
      total_contract_mt: totalContractMt > 0 ? totalContractMt.toFixed(3) : prev.total_contract_mt,
      total_units: totalUnits > 0 ? totalUnits.toString() : prev.total_units,
      items: updatedItems
    }));
  };

  const [unitList, setUnitList] = useState<string[]>(['DRUMS', 'BALES', 'LOOSE', 'P.BALES', 'H.BALES']);

  useEffect(() => {
    async function loadUnits() {
      try {
        if (supabase) {
          const { data } = await supabase.from('unit_master').select('unit_name').order('unit_name');
          if (data && data.length > 0) {
            const fetched = data.map((u: any) => u.unit_name).filter(Boolean);
            setUnitList(prev => Array.from(new Set([...fetched, ...prev])));
          }
        }
      } catch (err) {
        console.warn("Failed to load unit_master in PurchaseOrder", err);
      }
    }
    loadUnits();
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    is_ptf: false,
    purchase_order: 'FINAL PO',
    po_type: 'Normal',
    ptf_no: '',
    pending: 'Yes',
    no: '',
    date: todayStr,
    broker_code: '',
    broker: '',
    supplier_code: '',
    supplier: '',
    challan_supplier_code: '',
    challan_supplier: '',
    area_code: '',
    area: '', 
    trans_paid_by: 'PARTY',
    weight_unit_kgs: '147.5',
    against_cancellation: 'No',
    purchase_unit_code: '1',
    purchase_unit_name: 'BALES',
    total_no_of_lorries: '',
    units_per_lorry: '',
    total_units: '',
    weight_per_lorry: '',
    total_contract_mt: '',
    marka_type: 'Normal',
    marka_penalty: '0',
    qty_penalty: '5',
    delivery_from: todayStr,
    delivery_to: todayStr,
    grace_days: '0',
    delivery_penalty: '0',
    contract_po_no: '',
    contract_date: todayStr,
    rate_detail: '',
    delivery_schedule: '',
    terms_condition: '',
    remarks: '',
    po_identification: 'Direct Advance Payment',
    b_rate: '',
    s_date: todayStr, 
    items: [] as any[]
  });

  const [calcData, setCalcData] = useState({
     total_lorries: '1',
     units_per_lorry: '200',
     total_units: '200',
     weight_per_lorry: '29.500'
  });

  // Fetch all registered records and masters
  const fetchPosAndMasters = async () => {
    setLoading(true);
    const safeFetch = (table: string, orderBy?: string, ascending = false) => {
      return dbModule.fetchAll(table, orderBy, ascending).catch(err => {
        console.warn(`Failed to fetch ${table}:`, err);
        return [];
      });
    };

    const safeSupabaseSelect = async (table: string, orderCol?: string, ascending = false) => {
      if (!supabase) return { data: [] };
      try {
        let q = supabase.from(table).select('*');
        if (orderCol) {
          q = q.order(orderCol, { ascending });
        }
        const res = await q;
        if (res.error) {
          console.warn(`Supabase error on ${table}:`, res.error);
          return { data: [] };
        }
        return res || { data: [] };
      } catch (err) {
        console.warn(`Supabase failed on ${table}:`, err);
        return { data: [] };
      }
    };

    try {
      let initialPos = await safeFetch(MASTER_TABLE, 'created_at', false);
      if (isArchiveView && (!initialPos || initialPos.length === 0)) {
        const altPos = await safeFetch('po_archive', 'created_at', false);
        if (altPos && altPos.length > 0) {
          initialPos = altPos;
        } else {
          const rawActive = await safeFetch('purchase_master', 'created_at', false);
          initialPos = (rawActive || []).filter((r: any) => r.status === 'settled' || !!r.archived_at);
        }
      }

      const [
        brokers, 
        suppliers, 
        areas, 
        saudas, 
        grades, 
        markas, 
        agencies, 
        arrivals, 
        finalArrivals, 
        inspections, 
        matInspections,
        sattaBasesRes, 
        sattaCalculatedRes, 
        sattaDiffsRes,
        matMismatchesRes,
        satMismatchesRes,
        dbMatMismatches,
        dbSatMismatches,
        scpDeductions,
        payments,
        mrSettlementsRes,
        mrSettlementAltRes
      ] = await Promise.all([
        safeFetch('broker_master'),
        safeFetch('supply_master'),
        safeFetch('area_master'),
        safeFetch('sauda_master', 'created_at', false),
        safeFetch('grade_master'),
        safeFetch('marka_master'),
        safeFetch('agency_master'),
        safeFetch('temporary_material_received', 'created_at', false),
        safeFetch('final_arrival', 'created_at', false),
        safeFetch('mill_inspection_master', 'created_at', false),
        safeFetch('material_inspection', 'created_at', false),
        safeSupabaseSelect('satta_base_rates', 'start_date', false),
        safeSupabaseSelect('satta_calculated_rates'),
        safeSupabaseSelect('satta_differentials'),
        safeSupabaseSelect('material_mismatch'),
        safeSupabaseSelect('satta_mismatch'),
        safeFetch('material_mismatch'),
        safeFetch('satta_mismatch'),
        safeFetch('sauda_check_point_deductions'),
        safeFetch('payment_master', 'created_at', false),
        safeFetch('mr_settlement_master', 'created_at', false),
        safeFetch('m_r_settlement', 'created_at', false)
      ]);

      const combinedMatMismatches = [...((matMismatchesRes as any)?.data || []), ...(dbMatMismatches || [])];
      const combinedSatMismatches = [...((satMismatchesRes as any)?.data || []), ...(dbSatMismatches || [])];
      const combinedSettlements = [...(mrSettlementsRes || []), ...(mrSettlementAltRes || [])];
      setDbMaterialMismatches(combinedMatMismatches);
      setDbSattaMismatches(combinedSatMismatches);
      setSattaBases((sattaBasesRes as any)?.data || sattaBasesRes || []);
      setSattaCalcs((sattaCalculatedRes as any)?.data || sattaCalculatedRes || []);
      setAllPayments(payments || []);
      setAllSettlements(combinedSettlements);
      if (supabase) { supabase.from('sauda_check_point_details').select('*').then(({ data }) => setAllScpDetails(data || [])); }

      const dedMap: Record<string, any> = {};
      const cleanKeyFormat = (v: any) => String(v || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      (scpDeductions || []).forEach((d: any) => {
        if (d?.po_no) {
          dedMap[String(d.po_no).trim().toUpperCase()] = d;
          dedMap[cleanKeyFormat(d.po_no)] = d;
        }
        if (d?.sauda_no) {
          dedMap[String(d.sauda_no).trim().toUpperCase()] = d;
          dedMap[cleanKeyFormat(d.sauda_no)] = d;
        }
      });
      setSettledDeductions(dedMap);

      const allMergedInspections = [...(matInspections || []), ...(inspections || [])];
      const pos = initialPos;
      setAllTempArrivals(arrivals || []);
      setAllFinalArrivals(finalArrivals || []);
      setAllInspections(allMergedInspections);

      const matchPoNo = (po1: string, po2: string) => {
        if (!po1 || !po2) return false;
        const p1 = po1.trim().toLowerCase();
        const p2 = po2.trim().toLowerCase();
        if (p1 === p2) return true;
        
        const clean1 = p1.replace(/[^a-z0-9]/g, '');
        const clean2 = p2.replace(/[^a-z0-9]/g, '');
        if (clean1 && clean1 === clean2) return true;

        if (clean1.length > 5 && clean2.length > 5 && (clean1.includes(clean2) || clean2.includes(clean1))) {
          return true;
        }

        const num1 = p1.replace(/[^0-9]/g, '');
        const num2 = p2.replace(/[^0-9]/g, '');
        if (num1.length >= 4 && num2.length >= 4 && (num1.includes(num2) || num2.includes(num1))) {
          return true;
        }
        return false;
      };

      // Match arrivals to a P.O by EXACT po_no only. Fuzzy matching over-counted and
      // produced impossible received weights (e.g. 89.8 MT received on a 10.8 MT P.O).
      // With no matching arrival, received is correctly 0.
      const exactPo = (a: any, b: any) => {
        const x = String(a || '').trim().toUpperCase();
        const y = String(b || '').trim().toUpperCase();
        return x !== '' && x === y;
      };
      const cleanVal = (v: any) => String(v || '').trim().replace(/[^a-z0-9]/gi, '').toLowerCase();

      // Flexible identifier matching for PO, Sauda, PTF against any database table record
      const matchPoRecord = (po: any, rec: any) => {
        if (!po || !rec) return false;
        const pKeys = [
          cleanVal(po.po_no),
          cleanVal(po.contract_po_no),
          cleanVal(po.ptf_no),
          cleanVal(po.sauda_no),
          cleanVal(po.contract_no)
        ].filter(Boolean);

        const rKeys = [
          cleanVal(rec.po_no),
          cleanVal(rec.mill_po_no),
          cleanVal(rec.contract_po_no),
          cleanVal(rec.sauda_no || rec.contract_no),
          cleanVal(rec.ptf_no),
          cleanVal(rec.temporary_arrival_no || rec.arrival_no || rec.amad_no),
          cleanVal(rec.final_arrival_no || rec.mr_no)
        ].filter(Boolean);

        for (const pk of pKeys) {
          for (const rk of rKeys) {
            if (pk === rk) return true;
            if (pk.length >= 6 && rk.length >= 6 && (pk.includes(rk) || rk.includes(pk))) return true;
          }
        }
        return false;
      };

      setPoList((pos || []).map((p: any) => {
        const contractWeight = parseFloat(p.total_contract_mt) || 0;
        const matchingFinal = (finalArrivals || []).filter((ar: any) =>
          matchPoRecord(p, ar) || exactPo(p.po_no, ar.po_no) || exactPo(p.contract_po_no, ar.po_no)
        );
        const matchingTemp = (arrivals || []).filter((ar: any) =>
          (matchPoRecord(p, ar) || exactPo(p.po_no, ar.po_no) || exactPo(p.contract_po_no, ar.po_no)) &&
          !matchingFinal.some(f => 
            (f.temporary_arrival_no && ar.temporary_arrival_no && f.temporary_arrival_no === ar.temporary_arrival_no) ||
            (f.mr_no && ar.amad_no && f.mr_no === ar.amad_no) ||
            (f.lorry_number && ar.lorry_number && String(f.lorry_number).trim().toUpperCase() === String(ar.lorry_number).trim().toUpperCase())
          )
        );

        const tempWeightOf = (ar: any) => {
          if (ar.challan_material_weight && Number(ar.challan_material_weight) > 0) return Number(ar.challan_material_weight);
          if (ar.weight_reduced && Number(ar.weight_reduced) > 0) return Number(ar.weight_reduced);
          if (ar.weight_qtl && Number(ar.weight_qtl) > 0) return Number(ar.weight_qtl) / 10;
          if (ar.weight && Number(ar.weight) > 0) return Number(ar.weight) / 10;
          if (ar.electronic_net_weight && Number(ar.electronic_net_weight) > 0) {
            return Number(ar.electronic_net_weight) > 50 ? Number(ar.electronic_net_weight) / 10 : Number(ar.electronic_net_weight);
          }
          return 0;
        };
        const finalWeightOf = (ar: any) => {
          if (ar.weight_qtl && Number(ar.weight_qtl) > 0) return Number(ar.weight_qtl) / 10;
          if (ar.weight && Number(ar.weight) > 0) return Number(ar.weight) / 10;
          if (ar.electronic_net_weight && Number(ar.electronic_net_weight) > 0) {
            return Number(ar.electronic_net_weight) > 50 ? Number(ar.electronic_net_weight) / 10 : Number(ar.electronic_net_weight);
          }
          if (ar.challan_material_weight && Number(ar.challan_material_weight) > 0) return Number(ar.challan_material_weight);
          return 0;
        };

        const totalFinalMt = matchingFinal.reduce((sum: number, ar: any) => sum + finalWeightOf(ar), 0);
        const totalTempMt = matchingTemp.reduce((sum: number, ar: any) => sum + tempWeightOf(ar), 0);
        const totalReceivedMt = totalFinalMt + totalTempMt;

        const unit = p.purchase_unit_name || p.unit_type || p.unit || 'BALES';
        const tol = calculateWeightTolerance(contractWeight, totalReceivedMt, unit);
        const isExplicitCompleted = p.status === 'completed' || p.status === 'settled';
        const isWeightCompleted = tol.isCompleted;

        const pPoClean = cleanVal(p.po_no);
        const pContractClean = cleanVal(p.contract_po_no);
        const pPtfClean = cleanVal(p.ptf_no);
        const pSaudaClean = cleanVal(p.sauda_no || p.po_contract || p.contract_no);

        // 1. Check Temporary Arrival Dashboard (temporary_material_received)
        const hasTempArrival = (arrivals || []).some((ar: any) => matchPoRecord(p, ar)) ||
                               matchingFinal.length > 0 ||
                               totalReceivedMt > 0;

        // 2. Check Final Arrival Dashboard (final_arrival)
        const hasFinalArrival = matchingFinal.length > 0 || totalReceivedMt > 0;

        // 3. Check Mill Inspection (material_inspection & mill_inspection_master)
        const matchingInsp = allMergedInspections.find((i: any) => matchPoRecord(p, i));
        const hasInspection = Boolean(matchingInsp);

        // 4. Check Mismatch (material_mismatch, satta_mismatch, and field-level validation)
        const isCleared = p.mismatch_cleared === true || 
          p.mismatch_cleared === 'true' || 
          p.satta_dispute_approved === true || 
          p.satta_dispute_approved === 'true' || 
          p.pass_status === 'pass' ||
          p.is_pass === true ||
          p.status === 'final' ||
          p.status === 'moved_to_final' ||
          isPoMismatchResolved(p);

        const hasDbMismatch = (combinedMatMismatches || []).some((m: any) => {
          if (!matchPoRecord(p, m)) return false;
          const st = String(m.status || m.resolution_status || '').toLowerCase();
          return st !== 'resolved' && st !== 'cleared' && st !== 'approved';
        }) || (combinedSatMismatches || []).some((m: any) => {
          if (!matchPoRecord(p, m)) return false;
          const st = String(m.status || m.resolution_status || '').toLowerCase();
          return st !== 'resolved' && st !== 'cleared' && st !== 'approved';
        });

        const mismatchFields: string[] = [];
        if (!isCleared) {
          const poDetails = (allScpDetails || []).filter((d: any) => matchPoRecord(p, d));
          const activeArrival = matchingTemp[0] || (arrivals || []).find((ar: any) => matchPoRecord(p, ar));
          if (activeArrival || matchingInsp) {
            const tempMatchRes = compareSaudaTempArrival(p, poDetails, activeArrival || matchingInsp, matchingInsp ? [matchingInsp] : []);
            if (tempMatchRes.hasInspection && tempMatchRes.status === 'mismatch') {
              tempMatchRes.mismatches.forEach(m => mismatchFields.push(m.mismatchLabel || m.field));
            }
          }
        }

        const isMismatch = !isCleared && (hasDbMismatch || mismatchFields.length > 0 || (p.pass_status === 'mismatch' && !isCleared));

        // Matching Temporary Arrivals count (each entry in temporary_material_received is 1 lorry arrival)
        const matchingTempArrivals = (arrivals || []).filter((ar: any) =>
          matchPoRecord(p, ar) || exactPo(p.po_no, ar.po_no) || exactPo(p.contract_po_no, ar.po_no)
        );
        const distinctArrivalKeys = new Set<string>();
        matchingTempArrivals.forEach((ar: any) => {
          const k = ar.temporary_arrival_no || ar.amad_id || ar.lorry_number || ar.amad_no;
          if (k) distinctArrivalKeys.add(String(k).trim().toUpperCase());
        });
        matchingFinal.forEach((fa: any) => {
          const k = fa.temporary_arrival_no || fa.arrival_no || fa.lorry_number || fa.mr_no;
          if (k) distinctArrivalKeys.add(String(k).trim().toUpperCase());
        });
        // Lorry and MR distinct counting (prevent double counting duplicate MRs)
        const distinctMrKeys = new Set<string>();
        matchingFinal.forEach((fa: any) => {
          const k = fa.mr_no || fa.amad_no || fa.arrival_no;
          if (k) distinctMrKeys.add(String(k).trim().toUpperCase());
        });
        matchingTempArrivals.forEach((ar: any) => {
          const k = ar.amad_no || ar.temporary_arrival_no;
          if (k) distinctMrKeys.add(String(k).trim().toUpperCase());
        });
        const receivedLorries = Math.max(matchingTempArrivals.length, distinctArrivalKeys.size);

        const contractLorries = Math.max(1, parseInt(p.total_lorries || p.total_no_of_lorries || p.no_of_lorries || p.lorries || 1, 10) || 1);

        const cleanPoKey = String(p.po_no || '').trim().toUpperCase();
        let parsedOpenRemarks = p.open_remarks;
        if (typeof parsedOpenRemarks === 'string') {
          try { parsedOpenRemarks = JSON.parse(parsedOpenRemarks); } catch(e) {}
        }
        if (!parsedOpenRemarks) {
          try {
            const localRemarks = localStorage.getItem(`sauda_open_remarks_${cleanPoKey}`);
            if (localRemarks) parsedOpenRemarks = JSON.parse(localRemarks);
          } catch(e) {}
        }

        const isExplicitReopened = p.is_reopened === true || 
                                   p.reopened === true || 
                                   Boolean(parsedOpenRemarks) ||
                                   localStorage.getItem(`sauda_reopened_${cleanPoKey}`) === 'true';

        const isExplicitClosed = p.is_closed === true || 
                                 p.sauda_closed === true || 
                                 p.status === 'closed' || 
                                 localStorage.getItem(`sauda_closed_${cleanPoKey}`) === 'true';

        const remainingWeight = contractWeight - totalReceivedMt;
        // User Requirement:
        // 1. Temporary Arrival Lorry / Arrival Count and Sauda Check Point Lorry Count is same -> Closed
        const isLorryClosed = contractLorries > 0 && receivedLorries >= contractLorries;
        // Open/Closed status is strictly Lorry-wise (or explicit manual close)
        const isClosed = !isExplicitReopened && (isExplicitClosed || isLorryClosed);

        // Check Payment Status in payment_master
        const matchingPayments = (payments || []).filter((pay: any) => {
          const payPoClean = cleanVal(pay.po_no);
          const paySaudaClean = cleanVal(pay.sauda_no);
          return exactPo(p.po_no, pay.po_no) || 
                 exactPo(p.contract_po_no, pay.po_no) ||
                 matchPoRecord(p, pay) ||
                 (pPoClean && pPoClean === payPoClean) ||
                 (pContractClean && pContractClean === payPoClean) ||
                 (pPtfClean && pPtfClean === payPoClean) ||
                 (pSaudaClean && paySaudaClean && pSaudaClean === paySaudaClean);
        });
        const hasPaymentDone = matchingPayments.some((pay: any) => {
          const advDone = String(pay.advance_payment_done || pay.advance_done || '').trim().toLowerCase();
          const paid = Number(pay.paid_amount || 0);
          const pStatus = String(pay.payment_status || pay.status || '').toLowerCase().trim();

          if (advDone === 'yes' || advDone === 'y' || advDone === 'true') {
            return true;
          }
          if (paid > 0) {
            return true;
          }
          if (pStatus === 'paid' || pStatus === 'completed' || pStatus === 'settled' || pStatus === 'partially settled') {
            return true;
          }
          return false;
        }) || Boolean(p.has_payment_done || (p.advance_payment_done && String(p.advance_payment_done).toLowerCase() === 'yes'));

        // Check Settlement Status in mr_settlement_master / m_r_settlement
        const matchingSettlements = (combinedSettlements || []).filter((s: any) => {
          const sPoClean = cleanVal(s.po_no || s.po_contract || s.contract_po_no);
          return exactPo(p.po_no, s.po_no) || 
                 exactPo(p.contract_po_no, s.po_no) || 
                 matchPoRecord(p, s) || 
                 (pPoClean && pPoClean === sPoClean) || 
                 (pContractClean && pContractClean === sPoClean);
        });
        const hasSettlementDone = matchingSettlements.length > 0 || p.status === 'settled';

        // Dynamic Workflow Stage Calculation (Sequential Priority Order):
        // 1. Temporary Arrival Missing -> temp_arrival_pending
        // 2. Temporary Arrival Done + Final Arrival Missing -> final_arrival_pending
        // 3. Mismatch Found -> mismatch (NOT eligible for Advance Payment or Settlement)
        // 4. Final Arrival Done + No Mismatch + Mill Inspection Missing -> inspection_pending
        // 5. Inspection Done + Advance Payment Not Done -> adv_payment_not_done ("Adv. Pay Not Done")
        // 6. Advance Payment Done + Settlement Not Done -> settlement_pending ("Settlement Pending")
        // 7. Settlement Done -> final_po (Data Full move To Final P.O)
        let workflowStage: 'temp_arrival_pending' | 'final_arrival_pending' | 'mismatch' | 'inspection_pending' | 'adv_payment_not_done' | 'settlement_pending' | 'final_po' = 'temp_arrival_pending';

        if (!hasTempArrival && !hasFinalArrival) {
          workflowStage = 'temp_arrival_pending';
        } else if (hasTempArrival && !hasFinalArrival) {
          workflowStage = 'final_arrival_pending';
        } else if (isMismatch) {
          workflowStage = 'mismatch';
        } else if (!hasInspection) {
          workflowStage = 'inspection_pending';
        } else if (!hasPaymentDone) {
          workflowStage = 'adv_payment_not_done';
        } else if (!hasSettlementDone) {
          workflowStage = 'settlement_pending';
        } else {
          workflowStage = 'final_po';
        }

        const isPass = isCleared || (workflowStage === 'final_po');

        // Complete means weight is fulfilled and stage is passed to final/eligible
        const isWeightFulfilled = isExplicitCompleted || isWeightCompleted || isClosed;
        const isFullyComplete = isTempPo 
          ? (isWeightFulfilled && isPass)
          : isWeightFulfilled;
        const computedPending = !isFullyComplete;

        return {
          ...p,
          date: p.date || p.po_date || (p.created_at ? p.created_at.slice(0, 10) : ''),
          broker: (p.broker || '').toUpperCase(),
          supplier: (p.supplier || '').toUpperCase(),
          challan_supplier: (p.challan_supplier || p.supplier || '').toUpperCase(),
          pending: computedPending,
          received_weight_mt: totalReceivedMt,
          weight_tolerance: tol,
          contract_lorries: contractLorries,
          received_lorries: receivedLorries,
          is_closed: isClosed,
          is_reopened: isExplicitReopened,
          open_remarks: parsedOpenRemarks,
          has_settlement_done: hasSettlementDone,
          workflow_stage: workflowStage,
          stage: workflowStage,
          has_temp_arrival: hasTempArrival,
          has_final_arrival: hasFinalArrival,
          has_inspection: hasInspection,
          pass_status: isCleared ? 'pass' : (workflowStage === 'final_po' ? 'pass' : (isMismatch ? 'mismatch' : workflowStage)),
          mismatch_fields: isCleared ? [] : mismatchFields,
          has_payment_done: hasPaymentDone,
          is_fully_completed: isFullyComplete
        };
      }));

      setBrokerList((brokers || []).map((b: any) => ({
        ...b,
        brok_name: (b.brok_name || '').toUpperCase()
      })));
      setSupplierList((suppliers || []).map((s: any) => ({
        ...s,
        supp_name: (s.supp_name || '').toUpperCase()
      })));
      setAreaList(areas || []);
      setSaudaList((saudas || []).map((s: any) => ({
        ...s,
        broker: (s.broker || '').toUpperCase(),
        supplier: (s.supplier || '').toUpperCase(),
        challan_supplier: (s.challan_supplier || '').toUpperCase()
      })));
      setGradeList(grades || []);
      setMarkaList(markas || []);
      setAgencyList(agencies || []);

      const sBases = sattaBasesRes && 'data' in sattaBasesRes ? (sattaBasesRes as any).data || [] : [];
      const sCalculated = sattaCalculatedRes && 'data' in sattaCalculatedRes ? (sattaCalculatedRes as any).data || [] : [];
      const sDiffs = sattaDiffsRes && 'data' in sattaDiffsRes ? (sattaDiffsRes as any).data || [] : [];
      setSattaBaseRates(sBases);
      setSattaCalculatedRates(sCalculated);
      setSattaDifferentials(sDiffs);
    } catch (err) {
      console.error('Failed to load masters data:', err);
    } finally {
      setLoading(false);
    }
  };

  useLiveAutoRefresh(fetchPosAndMasters, [isArchiveView, isTempPo], { 
    tables: [
      'purchase_master', 
      'purchase_detail_master', 
      'sauda_check_point', 
      'sauda_check_point_details', 
      'sauda_check_point_deductions', 
      'p.o_archive', 
      'po_archive', 
      'temporary_material_received',
      'final_arrival',
      'material_inspection', 
      'mill_inspection_master', 
      'material_mismatch',
      'satta_mismatch',
      'payment_master'
    ] 
  });

  useEffect(() => {
    fetchPosAndMasters();

    const handleDataUpdate = () => {
      fetchPosAndMasters();
    };

    window.addEventListener('app-data-updated', handleDataUpdate);
    window.addEventListener('mismatch_resolved', handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate);

    // One-time automatic cleanup to permanently remove duplicate rows in sauda_check_point_details
    const cleanupDuplicateDetails = async () => {
      try {
        if (!supabase) return;
        const targetPo = 'BJCL/2026-2027/0332(PTF)';
        const { data: rows } = await supabase
          .from('sauda_check_point_details')
          .select('*')
          .ilike('po_no', targetPo);

        if (rows && rows.length > 0) {
          const seen = new Set<string>();
          const duplicateIds: string[] = [];
          for (const r of rows) {
            const gradeKey = `${r.grade_code || r.grade_name || ''}_${r.srl_no || ''}`;
            if (seen.has(gradeKey)) {
              if (r.item_id) duplicateIds.push(r.item_id);
            } else {
              seen.add(gradeKey);
            }
          }
          if (duplicateIds.length > 0) {
            await supabase.from('sauda_check_point_details').delete().in('item_id', duplicateIds);
            console.log(`Cleaned up ${duplicateIds.length} duplicate items for ${targetPo}`);
          }
        }
      } catch (err) {
        console.warn("Cleanup error:", err);
      }
    };
    cleanupDuplicateDetails();

    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel('po-realtime-sub')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_check_point' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_check_point_deductions' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'final_po' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_check_point_details' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'material_inspection' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mill_inspection_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'temporary_material_received' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_sauda' }, handleDataUpdate)
        .subscribe();
    }

    return () => {
      window.removeEventListener('app-data-updated', handleDataUpdate);
      window.removeEventListener('mismatch_resolved', handleDataUpdate);
      window.removeEventListener('storage', handleDataUpdate);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Auto-sync B. Rate from Satta Base Rate for given S Date (only for empty new records, never overwrite existing rates)
  useEffect(() => {
    if (sattaBaseRates.length > 0 && formData.s_date) {
      const activeBase = lookupSattaBaseRate(formData.s_date, sattaBaseRates);
      if (activeBase && (!formData.b_rate || formData.b_rate === '0' || formData.b_rate === '')) {
        const hasExistingRates = formData.items && formData.items.some(item => Number(item.rate) > 0);
        if (!hasExistingRates && !formData.no) {
          const updatedItems = recalculateAllRates(formData.items, formData.s_date, activeBase);
          setFormData(prev => ({
            ...prev,
            b_rate: activeBase,
            items: updatedItems
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            b_rate: activeBase
          }));
        }
      }
    }
  }, [sattaBaseRates, formData.s_date]);

  const handleSaudaSelect = async (saudaNo: string) => {
    if (!saudaNo) {
      setFormData(prev => ({ ...prev, no: '' }));
      return;
    }
    const sauda = saudaList.find(s => 
      s.sauda_no === saudaNo || 
      s.session === saudaNo || 
      formatPoNumber(s) === saudaNo
    );
    if (!sauda) {
      setFormData(prev => ({ ...prev, no: saudaNo }));
      return;
    }

    const brokerObj = brokerList.find(b => b.brok_name === sauda.broker || b.brok_code === sauda.broker);
    const supplierObj = supplierList.find(s => s.supp_name === sauda.supplier || s.supp_code === sauda.supplier);
    const challanSuppObj = supplierList.find(s => s.supp_name === sauda.challan_supplier || s.supp_code === sauda.challan_supplier);
    const areaObj = areaList.find(a => a.area_name === sauda.area || a.area_code === sauda.area);

    let mappedItems: any[] = [];
    const isBales = (sauda.unit_type || '').toUpperCase() === 'BALES';
    const sDate = sauda.date || todayStr;
    const autoBRate = lookupSattaBaseRate(sDate, sattaBaseRates);
    const selectedBRate = (sauda.b_rate && Number(sauda.b_rate) > 0) ? sauda.b_rate.toString() : autoBRate;

    if (supabase) {
      try {
        const { data: qDetails } = await supabase
          .from('sauda_quality_details')
          .select('*')
          .eq('sauda_id', sauda.sauda_id);

        if (qDetails && qDetails.length > 0) {
          const sortedDetails = [...qDetails].sort((a: any, b: any) => compareQualities(a.quality || '', b.quality || ''));
          mappedItems = sortedDetails.map((item: any, index: number) => {
            const matchingGrade = gradeList.find(g => {
              const clean = (s: string) => (s || '').trim().replace(/\.$/, '').toUpperCase();
              return clean(g.grade_name) === clean(item.quality) || clean(g.grade_code) === clean(item.quality);
            });
            const itemWt = isBales 
              ? (item.qty * 147.5) / 1000 
              : (sauda.total_unit > 0 ? (item.qty / sauda.total_unit) * sauda.total_wt_in_ton : 0);
            const rowAgency = item.agency || sauda.agency || '';
            const agencyObj = agencyList.find(ag => ag.agency_name === rowAgency || ag.agency_code === rowAgency);
            const rowMarka = item.marka || sauda.marks || '';
            const markaObj = markaList.find(m => m.marka_name === rowMarka || m.marka_code === rowMarka);

            const rowGradeName = matchingGrade?.grade_name || item.quality || '';
            const rowAgencyName = agencyObj?.agency_name || rowAgency;

            const computedSattaRate = getSattaRateForRow(rowAgencyName, rowGradeName, sDate, selectedBRate, sattaBaseRates, sattaCalculatedRates, sattaDifferentials, sauda.area);
            const saudaItemRate = (item.rs !== undefined && item.rs !== null && Number(item.rs) > 0) ? Number(item.rs) : 0;
            const finalRate = saudaItemRate > 0 ? saudaItemRate : (computedSattaRate !== null ? computedSattaRate : 0);

            return {
              srl: index + 1,
              crop: getCropYear(),
              grade_code: matchingGrade?.grade_code || item.quality || '',
              grade_name: rowGradeName,
              agency_code: agencyObj?.agency_code || rowAgency,
              agency_name: rowAgencyName,
              marka_code: markaObj?.marka_code || rowMarka,
              marka_name: markaObj?.marka_name || rowMarka,
              qty: item.qty || 0,
              weight: itemWt || 0,
              rate: finalRate,
              premium: Number(item.premium || item.premium_amount || item.prem || 0)
            };
          });
        }
      } catch (err) {
        console.error("Failed to load sauda quality details:", err);
      }
    }

    const totalLorries = sauda.no_of_lorries ? sauda.no_of_lorries.toString() : '';
    const totalUnits = sauda.total_unit ? sauda.total_unit.toString() : '';
    const totalContractMt = sauda.total_wt_in_ton ? Number(sauda.total_wt_in_ton).toFixed(3) : '';
    const unitsPerLorry = sauda.no_of_lorries && sauda.total_unit ? Math.round(sauda.total_unit / sauda.no_of_lorries).toString() : '';
    const weightPerLorry = sauda.no_of_lorries && sauda.total_wt_in_ton ? (Number(sauda.total_wt_in_ton) / Number(sauda.no_of_lorries)).toFixed(3) : '';
    const weightUnitKgs = isBales ? '147.5' : (sauda.total_unit && sauda.total_wt_in_ton ? ((Number(sauda.total_wt_in_ton) * 1000) / Number(sauda.total_unit)).toFixed(2) : '50');

    const purchaseUnitCode = sauda.purchase_unit_code || '1';

    const penaltyVal = sauda.shipment_penalty ? `${sauda.shipment_penalty}` : '5';
    const descRemarks = sauda.remarks || 'Area, Agency Grade, Grade differential can change as per market.';
    const termsConditionVal = `Penalty Rs ${penaltyVal}/- perday ${descRemarks}`;

    setFormData(prev => ({
      ...prev,
      no: saudaNo,
      contract_po_no: saudaNo,
      broker_code: brokerObj?.brok_code || '',
      broker: brokerObj?.brok_name || sauda.broker || '',
      supplier_code: supplierObj?.supp_code || '',
      supplier: supplierObj?.supp_name || sauda.supplier || '',
      challan_supplier_code: challanSuppObj?.supp_code || '',
      challan_supplier: challanSuppObj?.supp_name || sauda.challan_supplier || '',
      area_code: areaObj?.area_code || '',
      area: areaObj?.area_name || sauda.area || '',
      total_no_of_lorries: totalLorries,
      units_per_lorry: unitsPerLorry,
      total_units: totalUnits,
      weight_per_lorry: weightPerLorry,
      total_contract_mt: totalContractMt,
      purchase_unit_name: sauda.unit_type || 'DRUMS',
      purchase_unit_code: purchaseUnitCode,
      weight_unit_kgs: weightUnitKgs,
      b_rate: selectedBRate,
      date: sauda.date || todayStr,
      s_date: sauda.date || todayStr,
      delivery_from: sauda.date || todayStr,
      delivery_to: sauda.date || todayStr,
      grace_days: sauda.shipment_days ? sauda.shipment_days.toString() : '0',
      delivery_penalty: sauda.shipment_penalty ? sauda.shipment_penalty.toString() : '0',
      remarks: sauda.remarks || '',
      terms_condition: termsConditionVal,
      contract_date: sauda.date || todayStr,
      items: mappedItems.length > 0 ? mappedItems : prev.items
    }));
  };

  const handleAddItem = () => {
    const nextSrl = formData.items.length > 0 ? Math.max(...formData.items.map(item => item.srl || 0)) + 1 : 1;
    const newItem = {
      srl: nextSrl,
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
    };
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setSelectedItemSrl(nextSrl);
  };

  const handleDeleteItem = () => {
    if (!canDeleteData()) {
      alert("Only Admin can delete data.");
      return;
    }
 
    if (selectedItemSrl === null) {
      alert("Please select a row first by clicking on it.");
      return;
    }
    setFormData(prev => {
      const remainingItems = prev.items.filter(item => item.srl !== selectedItemSrl);
      const reindexed = remainingItems.map((item, index) => ({
         ...item,
         srl: index + 1
      }));
      
      const totalQty = reindexed.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
      const totalWt = reindexed.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
      
      return {
         ...prev,
         items: reindexed,
         total_units: totalQty.toString(),
         total_contract_mt: totalWt.toFixed(3)
      };
    });
    setSelectedItemSrl(null);
  };

  const handleSyncFromSource = async () => {
    const poVal = String(formData.ptf_no || formData.no || formData.contract_po_no || '').trim();
    if (!poVal) {
      alert("Please specify a PO / PTF / Contract No first.");
      return;
    }
    const poClean = poVal.replace(/\(PTF\)/gi, '').trim();
    const poToken = (poVal.split('/').pop() || '').replace(/[^0-9]/g, '');
    const poUpper = poVal.toUpperCase();

    let foundItems: any[] = [];
    
    // 1. Check temporary_material_received (Arrival Receipt Grades)
    try {
      let tempArr: any = null;
      if (supabase) {
        const { data } = await supabase
          .from('temporary_material_received')
          .select('*')
          .or(`po_no.ilike.%${poClean}%,ptf_no.ilike.%${poClean}%,temporary_arrival_no.ilike.%${poToken || poClean}%`)
          .limit(1)
          .maybeSingle();
        tempArr = data;
      }
      if (!tempArr) {
        const allAmads = await dbModule.fetchAll('temporary_material_received').catch(() => []);
        tempArr = (allAmads || []).find((am: any) => {
          const aPo = String(am.po_no || '').toUpperCase();
          const aPtf = String(am.ptf_no || '').toUpperCase();
          const aArr = String(am.temporary_arrival_no || am.amad_no || '').toUpperCase();
          return aPo.includes(poUpper) || aPtf.includes(poUpper) || aArr.includes(poToken) || poUpper.includes(aArr);
        });
      }

      if (tempArr && Array.isArray(tempArr.grid_details) && tempArr.grid_details.length > 0) {
        foundItems = tempArr.grid_details.map((gd: any, i: number) => {
          const rawGrade = gd.receipt_grade_code || gd.grade_code || gd.challan_grade || '';
          const gradeObj = gradeList.find(g => g.grade_code === rawGrade || g.grade_name?.trim().toUpperCase() === rawGrade?.trim().toUpperCase());
          const rawAgency = gd.agency_code || gd.agency || '';
          const agencyObj = agencyList.find(a => a.agency_code === rawAgency || a.agency_name?.trim().toUpperCase() === rawAgency?.trim().toUpperCase());
          const rawMarka = gd.challan_marka_code || gd.marka_code || '';
          const markaObj = markaList.find(m => m.marka_code === rawMarka || m.marka_name?.trim().toUpperCase() === rawMarka?.trim().toUpperCase());

          const qtyVal = Number(gd.quantity_rcpt || gd.quantity_chln || gd.quantity || gd.qty || 0);
          const wtVal = (gd.netto_pnto !== undefined && Number(gd.netto_pnto) > 0)
            ? Number(gd.netto_pnto)
            : Number(gd.netto_mt || gd.weight || 0);

          return {
            srl: i + 1,
            crop: gd.crop_year || '2026-27',
            grade_code: gradeObj?.grade_code || rawGrade,
            grade_name: gradeObj?.grade_name || gd.receipt_grade_name || gd.grade_name || gd.challan_grade_name || rawGrade,
            agency_code: agencyObj?.agency_code || rawAgency,
            agency_name: agencyObj?.agency_name || gd.agency_name || rawAgency,
            marka_code: markaObj?.marka_code || rawMarka,
            marka_name: markaObj?.marka_name || gd.challan_marka_name || rawMarka,
            qty: qtyVal,
            weight: wtVal,
            rate: Number(gd.rate || 0),
            premium: Number(gd.premium || 0)
          };
        });
      }
    } catch (e) {
      console.warn("Error looking up arrival details:", e);
    }

    // 2. If not found, check sauda_quality_details
    if (!foundItems || foundItems.length === 0) {
      try {
        const saudaToken = (formData.contract_po_no || poVal).split('/').pop() || '';
        let qDet: any[] = [];
        if (supabase) {
          const { data: saudaRec } = await supabase.from('sauda_master').select('*').or(`session.eq.${poVal},sauda_no.eq.${saudaToken}`).maybeSingle();
          if (saudaRec) {
            const { data } = await supabase.from('sauda_quality_details').select('*').eq('sauda_id', saudaRec.sauda_id);
            if (data && data.length > 0) qDet = data;
          }
        }
        if (qDet && qDet.length > 0) {
          foundItems = qDet.map((qd: any, i: number) => {
            const rawGrade = qd.quality || '';
            const gradeObj = gradeList.find(g => g.grade_code === rawGrade || g.grade_name?.trim().toUpperCase() === rawGrade?.trim().toUpperCase());
            const rawAgency = qd.agency || '';
            const agencyObj = agencyList.find(a => a.agency_code === rawAgency || a.agency_name?.trim().toUpperCase() === rawAgency?.trim().toUpperCase());
            const rawMarka = qd.marka || '';
            const markaObj = markaList.find(m => m.marka_code === rawMarka || m.marka_name?.trim().toUpperCase() === rawMarka?.trim().toUpperCase());

            return {
              srl: i + 1,
              crop: '2026-27',
              grade_code: gradeObj?.grade_code || rawGrade,
              grade_name: gradeObj?.grade_name || rawGrade,
              agency_code: agencyObj?.agency_code || rawAgency,
              agency_name: agencyObj?.agency_name || rawAgency,
              marka_code: markaObj?.marka_code || rawMarka,
              marka_name: markaObj?.marka_name || rawMarka,
              qty: Number(qd.qty || 0),
              weight: Number(qd.weight || 0),
              rate: Number(qd.rs || 0),
              premium: Number(qd.premium || 0)
            };
          });
        }
      } catch (e) {
        console.warn("Error looking up sauda quality details:", e);
      }
    }

    if (foundItems && foundItems.length > 0) {
      const reindexed = foundItems.map((item, idx) => ({ ...item, srl: idx + 1 }));
      const totalQty = reindexed.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      const totalWt = reindexed.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

      setFormData(prev => ({
        ...prev,
        items: reindexed,
        total_units: totalQty > 0 ? String(totalQty) : prev.total_units,
        total_contract_mt: totalWt > 0 ? totalWt.toFixed(3) : prev.total_contract_mt
      }));
      alert(`✅ Successfully restored ${reindexed.length} grade rows from Arrival/Sauda records!`);
    } else {
      alert("No original Arrival or Sauda grade records found for this PO number. You can use '+ Spawn Row' to add TD6, TD7 manually.");
    }
  };

  const generateNextPtfNo = (list: any[] = poList) => {
    const finYear = '2026-2027';
    let maxNum = 0;
    list.forEach(item => {
      const ptfStr = String(item.ptf_no || item.po_no || '').trim();
      if (!ptfStr) return;
      const m1 = ptfStr.match(/BJCL\/\d{4}-\d{4}\/(\d+)\(PTF\)/i);
      if (m1) {
        const num = parseInt(m1[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
        return;
      }
      const m2 = ptfStr.match(/PTF\/(\d+)\/\d+/i);
      if (m2) {
        const num = parseInt(m2[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
        return;
      }
      const m3 = ptfStr.match(/(\d+)\(PTF\)/i);
      if (m3) {
        const num = parseInt(m3[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
        return;
      }
    });

    const nextNum = maxNum > 0 ? maxNum + 1 : 67;
    return `BJCL/${finYear}/${String(nextNum).padStart(4, '0')}(PTF)`;
  };

  const handleGlobalAdd = () => {
    const defaultSDate = todayStr;
    const defaultBRate = lookupSattaBaseRate(defaultSDate, sattaBaseRates);

    setFormData({
      is_ptf: true,
      purchase_order: 'FINAL PO',
      po_type: 'Normal',
      ptf_no: generateNextPtfNo(poList),
      pending: 'Yes',
      no: '',
      date: todayStr,
      broker_code: '',
      broker: '',
      supplier_code: '',
      supplier: '',
      challan_supplier_code: '',
      challan_supplier: '',
      area_code: '',
      area: '', 
      trans_paid_by: 'PARTY',
      weight_unit_kgs: '147.5',
      against_cancellation: 'No',
      purchase_unit_code: '1',
      purchase_unit_name: 'BALES',
      total_no_of_lorries: '1',
      units_per_lorry: '200',
      total_units: '200',
      weight_per_lorry: '29.500',
      total_contract_mt: '29.500',
      marka_type: 'Normal',
      marka_penalty: '0',
      qty_penalty: '5',
      delivery_from: todayStr,
      delivery_to: todayStr,
      grace_days: '0',
      delivery_penalty: '0',
      contract_po_no: '',
      contract_date: todayStr,
      rate_detail: '',
      delivery_schedule: '',
      terms_condition: 'Penalty Rs 5/- perday',
      remarks: 'Area, Agency Grade, Grade differential can change as per market.',
      po_identification: 'Direct Advance Payment',
      b_rate: defaultBRate,
      s_date: defaultSDate, 
      items: [
        {
          srl: 1,
          crop: getCropYear(),
          grade_code: '',
          grade_name: '',
          agency_code: '',
          agency_name: '',
          marka_code: '',
          marka_name: '',
          qty: 200,
          weight: 29.5,
          rate: 0,
          premium: 0
        }
      ]
    });
    setSelectedItemSrl(1);
    setViewMode('form');
  };

  const handleLoadSelectedPo = async (poHeader: any) => {
    // Check user context
    const userCtx = getCurrentUserContext();
    const currentUserRole = (userCtx.userRole || (userCtx as any).role || "USER").toUpperCase();
    const currentUserLevel = (userCtx.userLevel || (userCtx as any).level || "L1").toUpperCase();
    const isAdminUser = isUserAdmin(userCtx) || currentUserRole === "ADMIN" || currentUserRole === "ADMINISTRATOR" || Boolean((userCtx as any).isAdmin) || currentUserLevel === "ADMIN";
    const isL4L5User = isL5OrAdmin() || currentUserLevel === "L4" || currentUserLevel === "L5" || currentUserLevel === "MAX";
    const canBypassLock = isAdminUser || isL4L5User;

    const mrLock = matchResults[poHeader.po_no];

    if (!canBypassLock && isTempPo && mrLock && mrLock.hasInspection && mrLock.status === 'mismatch' && !isPoMismatchResolved(poHeader.po_no)) {
      setEmailNotification({
        type: 'warning',
        title: 'Material Mismatch Review',
        message: `P.O ${poHeader.po_no} has a Material Mismatch. Details loaded for review.`
      });
    }
    const getGradeNameForCompare = (gCode: string) => {
      const match = gradeList.find((g: any) => g.grade_code === gCode);
      return match ? match.grade_name : gCode;
    };

    setLoading(true);
    try {
      const poNoClean = String(poHeader.po_no || '').trim();
      const poNoUpper = poNoClean.toUpperCase();
      
      let filteredDetails: any[] = [];
      if (supabase) {
        try {
          const { data: directDetails } = await supabase
            .from(DETAIL_TABLE)
            .select('*')
            .eq('po_no', poNoClean)
            .order('srl_no', { ascending: true });
          if (directDetails && directDetails.length > 0) {
            filteredDetails = directDetails;
          } else {
            const { data: ilikeDetails } = await supabase
              .from(DETAIL_TABLE)
              .select('*')
              .ilike('po_no', poNoClean)
              .order('srl_no', { ascending: true });
            if (ilikeDetails && ilikeDetails.length > 0) {
              filteredDetails = ilikeDetails;
            }
          }
        } catch (e) {
          console.warn(`Direct query on ${DETAIL_TABLE} failed:`, e);
        }
      }

      if (!filteredDetails || filteredDetails.length === 0) {
        const allDetails = await dbModule.fetchAll(DETAIL_TABLE).catch(() => []);
        filteredDetails = (allDetails || [])
          .filter((d: any) => String(d.po_no || '').trim().toUpperCase() === poNoUpper)
          .sort((a: any, b: any) => (Number(a.srl_no || a.srl || 0) - Number(b.srl_no || b.srl || 0)));
      }
      
      // Fallback: If no details in current table, query sauda_check_point_details, purchase_detail_master, temporary_material_received, or sauda_quality_details
      if (!filteredDetails || filteredDetails.length === 0) {
        if (supabase) {
          const { data: scpDet } = await supabase.from('sauda_check_point_details').select('*').ilike('po_no', poNoClean).order('srl_no', { ascending: true });
          if (scpDet && scpDet.length > 0) {
            filteredDetails = scpDet;
          } else {
            const { data: pdmDet } = await supabase.from('purchase_detail_master').select('*').ilike('po_no', poNoClean).order('srl_no', { ascending: true });
            if (pdmDet && pdmDet.length > 0) {
              filteredDetails = pdmDet;
            }
          }
        }
      }

      if (!filteredDetails || filteredDetails.length === 0) {
        // Check temporary_material_received for PTF receipt grade details
        let tempArr: any = null;
        if (supabase) {
          const { data } = await supabase
            .from('temporary_material_received')
            .select('*')
            .or(`po_no.eq.${poNoClean},ptf_no.eq.${poNoClean},temporary_arrival_no.eq.${poNoClean}`)
            .limit(1)
            .maybeSingle();
          tempArr = data;
        }
        if (!tempArr) {
          const allAmads = await dbModule.fetchAll('temporary_material_received').catch(() => []);
          tempArr = (allAmads || []).find((am: any) => 
            String(am.po_no || '').trim().toUpperCase() === poNoUpper ||
            String(am.ptf_no || '').trim().toUpperCase() === poNoUpper ||
            String(am.temporary_arrival_no || '').trim().toUpperCase() === poNoUpper ||
            String(am.amad_no || '').trim().toUpperCase() === poNoUpper
          );
        }

        if (tempArr && Array.isArray(tempArr.grid_details) && tempArr.grid_details.length > 0) {
          filteredDetails = tempArr.grid_details.map((gd: any, i: number) => ({
            po_no: poHeader.po_no,
            srl_no: i + 1,
            crop_year: gd.crop_year || '2026-27',
            grade_code: gd.receipt_grade_code || gd.grade_code || gd.challan_grade || '',
            grade_name: gd.receipt_grade_name || gd.grade_name || gd.challan_grade_name || gd.challan_grade || '',
            agency_code: gd.agency_code || '',
            agency_name: gd.agency_name || '',
            marka_code: gd.challan_marka_code || gd.marka_code || '',
            marka_name: gd.challan_marka_name || gd.marka_name || '',
            quantity: Number(gd.quantity_rcpt || gd.quantity_chln || gd.quantity || gd.qty || 0),
            weight_mt: (gd.netto_pnto !== undefined && gd.netto_pnto !== null && Number(gd.netto_pnto) > 0)
              ? Number(gd.netto_pnto)
              : Number(gd.netto_mt || gd.weight || 0),
            rate_qntl: Number(gd.rate || 0),
            premium: gd.premium !== undefined && gd.premium !== null ? Number(gd.premium) : 0
          }));
        } else {
          // Extract sauda number if present
          const saudaToken = (poHeader.contract_po_no || poHeader.po_no || '').split('/').pop() || '';
          if (supabase) {
            const { data: saudaRec } = await supabase.from('sauda_master').select('*').or(`session.eq.${poHeader.po_no},sauda_no.eq.${saudaToken}`).maybeSingle();
            if (saudaRec) {
              const { data: qDet } = await supabase.from('sauda_quality_details').select('*').eq('sauda_id', saudaRec.sauda_id);
              if (qDet && qDet.length > 0) {
                filteredDetails = qDet.map((qd: any, i: number) => ({
                  po_no: poHeader.po_no,
                  srl_no: i + 1,
                  crop_year: '2026-27',
                  grade_code: qd.quality,
                  agency_code: qd.agency,
                  marka_code: qd.marka,
                  quantity: Number(qd.qty || 0),
                  rate_qntl: Number(qd.rs || 0),
                  weight_mt: Number(qd.weight || 0),
                  premium: Number(qd.premium || 0)
                }));
              }
            }
          }
        }
      }

      const isBales = (poHeader.purchase_unit_name || 'BALES') === 'BALES';

      // Deduplicate items only if duplicate DB entries exist with exact identical srl_no and grade
      const seenItemKeys = new Set<string>();
      const dedupedDetails = (filteredDetails || []).filter((d: any, idx: number) => {
        const rawG = d.grade_code || d.quality || d.grade || '';
        const rawA = d.agency_code || d.agency || '';
        const rawM = d.marka_code || d.marka || '';
        const srl = d.srl_no || d.srl || (idx + 1);
        const key = `${rawG}_${rawA}_${rawM}_${srl}`;
        if (!rawG && !rawA && !rawM) return true;
        if (seenItemKeys.has(key)) return false;
        seenItemKeys.add(key);
        return true;
      });

      const mappedItems = dedupedDetails.map((d: any, index: number) => {
        const qtyVal = Number(d.quantity || d.qty || d.quantity_rcpt || d.quantity_chln || 0);
        const existingWeight = (d.weight_mt !== undefined && d.weight_mt !== null && Number(d.weight_mt) > 0)
          ? Number(d.weight_mt)
          : ((d.weight !== undefined && d.weight !== null && Number(d.weight) > 0)
            ? Number(d.weight)
            : ((d.netto_pnto !== undefined && d.netto_pnto !== null && Number(d.netto_pnto) > 0)
              ? Number(d.netto_pnto)
              : 0));

        const weightVal = existingWeight > 0 
          ? existingWeight 
          : (isBales && qtyVal > 0 ? parseFloat(((qtyVal * 147.5) / 1000).toFixed(3)) : 0);
        
        const rawGrade = d.grade_code || d.quality || d.grade || '';
        const rawAgency = d.agency_code || d.agency || '';
        const rawMarka = d.marka_code || d.marka || '';

        const gradeObj = gradeList.find(g => g.grade_code === rawGrade || g.grade_name?.trim().toUpperCase() === rawGrade?.trim().toUpperCase());
        const agencyObj = agencyList.find(a => a.agency_code === rawAgency || a.agency_name?.trim().toUpperCase() === rawAgency?.trim().toUpperCase());
        const markaObj = markaList.find(m => m.marka_code === rawMarka || m.marka_name?.trim().toUpperCase() === rawMarka?.trim().toUpperCase());

        const rateVal = d.rate_qntl !== undefined && d.rate_qntl !== null && Number(d.rate_qntl) > 0
          ? Number(d.rate_qntl)
          : (d.rate !== undefined && d.rate !== null && Number(d.rate) > 0 ? Number(d.rate) : Number(d.rs || 0));

        return {
          srl: index + 1,
          crop: d.crop_year || d.crop || '2026-27',
          grade_code: gradeObj?.grade_code || d.grade_code || rawGrade,
          grade_name: gradeObj?.grade_name || d.grade_name || rawGrade || '',
          agency_code: agencyObj?.agency_code || d.agency_code || rawAgency,
          agency_name: agencyObj?.agency_name || d.agency_name || rawAgency || '',
          marka_code: markaObj?.marka_code || d.marka_code || rawMarka,
          marka_name: markaObj?.marka_name || d.marka_name || rawMarka || '',
          qty: qtyVal,
          weight: weightVal,
          rate: rateVal,
          premium: d.premium !== undefined && d.premium !== null ? Number(d.premium) : 0
        };
      });

      const sumQty = mappedItems.reduce((s, it) => s + (parseFloat(String(it.qty)) || 0), 0);
      const sumWt = mappedItems.reduce((s, it) => s + (parseFloat(String(it.weight)) || 0), 0);
      
      const totalUnits = (poHeader.total_units !== undefined && poHeader.total_units !== null && Number(poHeader.total_units) > 0)
        ? String(poHeader.total_units)
        : (isBales && sumQty > 0 ? sumQty.toString() : String(poHeader.total_units || ''));

      const totalContractMt = (poHeader.total_contract_mt !== undefined && poHeader.total_contract_mt !== null && Number(poHeader.total_contract_mt) > 0)
        ? Number(poHeader.total_contract_mt).toFixed(3)
        : (isBales && sumWt > 0 ? sumWt.toFixed(3) : String(poHeader.total_contract_mt || ''));

      const isPtfRecord = Boolean(poHeader.is_ptf || poHeader.ptf_no || String(poHeader.po_no || '').includes('(PTF)') || String(poHeader.po_identification || '').toLowerCase().includes('advance') || String(poHeader.po_identification || '').toLowerCase().includes('ptf'));
      const ptfNoVal = poHeader.ptf_no || (String(poHeader.po_no || '').includes('(PTF)') ? poHeader.po_no : '');

      setFormData({
        is_ptf: isPtfRecord,
        purchase_order: poHeader.purchase_order || 'FINAL PO',
        po_type: poHeader.po_type || 'Normal',
        ptf_no: ptfNoVal,
        pending: (poHeader.pending === true || poHeader.pending === 'Yes' || poHeader.pending === 1 || String(poHeader.pending).toLowerCase() === 'true') ? 'Yes' : 'No',
        no: poHeader.po_no || '',
        date: poHeader.po_date || todayStr,
        broker_code: brokerList.find(b => b.brok_name === poHeader.broker || b.brok_code === poHeader.broker)?.brok_code || '',
        broker: poHeader.broker || '',
        supplier_code: supplierList.find(s => s.supp_name === poHeader.supplier || s.supp_code === poHeader.supplier)?.supp_code || '',
        supplier: poHeader.supplier || '',
        challan_supplier_code: supplierList.find(s => s.supp_name === poHeader.challan_supplier || s.supp_code === poHeader.challan_supplier)?.supp_code || '',
        challan_supplier: poHeader.challan_supplier || '',
        area_code: areaList.find(a => a.area_name === poHeader.area || a.area_code === poHeader.area)?.area_code || '',
        area: poHeader.area || '',
        trans_paid_by: poHeader.trans_paid_by || 'PARTY',
        weight_unit_kgs: String(poHeader.weight_unit_kgs || (isBales ? '147.5' : '50')),
        against_cancellation: poHeader.against_cancellation || 'No',
        purchase_unit_code: poHeader.purchase_unit_code || '',
        purchase_unit_name: poHeader.purchase_unit_name || 'BALES',
        total_no_of_lorries: String(poHeader.total_lorries || ''),
        units_per_lorry: String(poHeader.units_per_lorry || ''),
        total_units: totalUnits,
        weight_per_lorry: poHeader.weight_per_lorry !== undefined && poHeader.weight_per_lorry !== null && !isNaN(Number(poHeader.weight_per_lorry)) && Number(poHeader.weight_per_lorry) > 0
          ? Number(poHeader.weight_per_lorry).toFixed(3)
          : String(poHeader.weight_per_lorry || ''),
        total_contract_mt: totalContractMt,
        marka_type: poHeader.marka_type || 'Normal',
        marka_penalty: String(poHeader.marka_penalty || '0'),
        qty_penalty: String(poHeader.qty_penalty || '5'),
        delivery_from: poHeader.delivery_from || todayStr,
        delivery_to: poHeader.delivery_to || todayStr,
        grace_days: String(poHeader.grace_days || '0'),
        delivery_penalty: String(poHeader.delivery_penalty || '0'),
        contract_po_no: poHeader.contract_po_no || '',
        contract_date: poHeader.contract_date || todayStr,
        rate_detail: poHeader.rate_detail || '',
        delivery_schedule: poHeader.delivery_schedule || '',
        terms_condition: poHeader.terms_condition || '',
        remarks: poHeader.remarks || '',
        po_identification: poHeader.po_identification || 'Direct Advance Payment',
        b_rate: (poHeader.b_rate && Number(poHeader.b_rate) > 0) ? String(poHeader.b_rate) : lookupSattaBaseRate(poHeader.s_date || todayStr, sattaBaseRates),
        s_date: poHeader.s_date || todayStr,
        items: mappedItems
      });
      
      setViewMode('form');
    } catch (err: any) {
      console.error("Failed to load PO details: ", err);
      alert("Load failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePo = async (poNo: string) => {
    const targetItem = (poList || []).find(p => String(p.po_no).trim().toUpperCase() === String(poNo).trim().toUpperCase());
    const userCtx = getCurrentUserContext();
    const isAdminUser = isUserAdmin(userCtx) || (userCtx?.userRole || '').toUpperCase() === 'ADMIN' || (userCtx?.userRole || '').toUpperCase() === 'ADMINISTRATOR' || Boolean((userCtx as any)?.isAdmin) || (userCtx?.userLevel || '').toUpperCase() === 'ADMIN';
    const isL4L5User = isL5OrAdmin() || (userCtx?.userLevel || '').toUpperCase() === 'L4' || (userCtx?.userLevel || '').toUpperCase() === 'L5' || (userCtx?.userLevel || '').toUpperCase() === 'MAX';
    const canDeleteThis = isAdminUser || isL4L5User;

    if (!canDeleteThis && !canEditOrDelete()) {
      alert(`Access Denied: Only authorized Admin users can delete records.`);
      return;
    }

    if (targetItem?.is_closed && !canDeleteThis) {
      alert(`🔒 Action Prohibited: Sauda #${poNo} is Closed (${targetItem.received_lorries}/${targetItem.contract_lorries} Lorries Received).\n\nClosed Saudas cannot be deleted by non-admin users. Only an Admin user can delete this closed record.`);
      return;
    }

    const conf = window.confirm(`Are you sure you want to permanently delete Purchase Order / Sauda: ${poNo}?\n\nThis will remove the record from all database tables and list pages.`);
    if (!conf) return;

    setLoading(true);
    try {
      if (supabase) {
        await supabase.from('purchase_detail_master').delete().eq('po_no', poNo);
        await supabase.from('sauda_check_point_details').delete().eq('po_no', poNo);
        await supabase.from('sauda_check_point').delete().eq('po_no', poNo);
        await supabase.from('purchase_master').delete().eq('po_no', poNo);
        await supabase.from('material_mismatch').delete().ilike('po_no', `%${poNo}%`);
        await supabase.from('satta_mismatch').delete().ilike('po_no', `%${poNo}%`);
      }
      await dbModule.delete(MASTER_TABLE, 'po_no', poNo);
      await dbModule.delete('purchase_master', 'po_no', poNo).catch(() => {});
      await dbModule.delete('sauda_check_point', 'po_no', poNo).catch(() => {});
      await dbModule.delete('p.o_archive', 'po_no', poNo).catch(() => {});

      // Clear local resolution caches
      const tokens = [poNo, poNo.split('/').pop() || ''].filter(Boolean);
      tokens.forEach(t => {
        const tu = t.toUpperCase();
        localStorage.removeItem(`material_resolved_${tu}`);
        localStorage.removeItem(`mismatch_resolved_${tu}`);
        localStorage.removeItem(`mismatch_cleared_${tu}`);
        localStorage.removeItem(`satta_resolved_${tu}`);
      });

      // Update state immediately so record disappears from list
      setPoList(prev => prev.filter(p => String(p.po_no).trim().toUpperCase() !== String(poNo).trim().toUpperCase()));

      // If active form is showing this record, reset it so it disappears from detail page
      const curNo = String(formData.no || formData.ptf_no || '').trim().toUpperCase();
      if (curNo === String(poNo).trim().toUpperCase()) {
        handleGlobalAdd();
        setSelectedPoNo(null);
      }

      window.dispatchEvent(new CustomEvent('app-data-updated'));
      alert(`Purchase Order ${poNo} deleted permanently.`);
      await fetchPosAndMasters();
    } catch (err: any) {
      console.error("Failed to delete PO: ", err);
      alert("Delete failed: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };
  const handleGlobalAmend = () => {
    const activePoNo = formData.is_ptf ? formData.ptf_no : formData.no;
    if (!activePoNo) {
      alert("No active PO loaded to amend.");
      return;
    }
    const amendedNo = activePoNo.endsWith('-A') ? activePoNo : `${activePoNo}-A`;
    setFormData(prev => ({
      ...prev,
      no: prev.is_ptf ? prev.no : amendedNo,
      ptf_no: prev.is_ptf ? amendedNo : prev.ptf_no,
      po_type: 'Special',
      remarks: prev.remarks ? `${prev.remarks} (Amended)` : 'Amended Contract Details.'
    }));
    alert(`Amending Contract! The PO number is updated to ${amendedNo} in Special/Amend mode.`);
  };

  const handleCalculateOk = () => {
    if (formData.is_ptf) {
      // In PTF Mode: Manual Entry transferred directly without forced formula overrides
      const manualLorries = calcData.total_lorries;
      const manualUnitsPerLorry = calcData.units_per_lorry;
      const manualTotalUnits = calcData.total_units;
      const manualWeightPerLorry = calcData.weight_per_lorry;
      
      const lorriesNum = parseFloat(manualLorries) || 1;
      const wtLorryNum = parseFloat(manualWeightPerLorry) || 0;
      const manualTotalContractMt = lorriesNum > 1
        ? (lorriesNum * wtLorryNum).toFixed(3)
        : (manualWeightPerLorry || (formData.total_contract_mt || '0.000'));

      let updatedItems = [...formData.items];
      if (updatedItems.length === 1) {
        updatedItems[0] = {
          ...updatedItems[0],
          qty: parseFloat(manualTotalUnits) || updatedItems[0].qty || 0,
          weight: parseFloat(manualTotalContractMt) || parseFloat(manualWeightPerLorry) || updatedItems[0].weight || 0
        };
      }

      setFormData(prev => ({
        ...prev,
        total_no_of_lorries: manualLorries,
        units_per_lorry: manualUnitsPerLorry,
        total_units: manualTotalUnits,
        weight_per_lorry: manualWeightPerLorry,
        total_contract_mt: manualTotalContractMt,
        items: updatedItems
      }));
      setIsCalcOpen(false);
      return;
    }

    // In Non-PTF Mode: Standard automatic formula calculation
    const lorries = parseFloat(calcData.total_lorries) || 0;
    const unitsPerLorry = parseFloat(calcData.units_per_lorry) || 0;
    const totalUnits = parseFloat(calcData.total_units) || (lorries * unitsPerLorry);
    const isDrums = (formData.purchase_unit_name || '').toUpperCase() === 'DRUMS';
    const unitWtVal = isDrums ? 50 : 147.5;
    const weightUnitKgs = unitWtVal.toString();

    const totalContractMt = totalUnits > 0
      ? ((totalUnits * unitWtVal) / 1000).toFixed(3)
      : (parseFloat(calcData.weight_per_lorry) || 0).toFixed(3);

    const wtPerLorryFormatted = lorries > 0
      ? (parseFloat(totalContractMt) / lorries).toFixed(3)
      : (calcData.weight_per_lorry && !isNaN(Number(calcData.weight_per_lorry)) 
          ? Number(calcData.weight_per_lorry).toFixed(3) 
          : calcData.weight_per_lorry);
    
    let updatedItems = recalculateItemWeights(formData.items, unitWtVal);
    
    if (updatedItems.length === 1) {
      updatedItems[0].qty = totalUnits;
      updatedItems[0].weight = parseFloat(totalContractMt);
    }

    setFormData(prev => ({
      ...prev,
      total_no_of_lorries: calcData.total_lorries,
      units_per_lorry: calcData.units_per_lorry,
      total_units: calcData.total_units.toString(),
      weight_per_lorry: wtPerLorryFormatted,
      total_contract_mt: totalContractMt,
      weight_unit_kgs: weightUnitKgs,
      items: updatedItems
    }));
    setIsCalcOpen(false);
  };

  const handleSave = async () => {
    const userCtx = getCurrentUserContext();
    const currentUserRole = (userCtx.userRole || (userCtx as any).role || "USER").toUpperCase();
    const currentUserLevel = (userCtx.userLevel || (userCtx as any).level || "L1").toUpperCase();
    const isAdminUser = isUserAdmin(userCtx) || currentUserRole === "ADMIN" || currentUserRole === "ADMINISTRATOR" || Boolean((userCtx as any).isAdmin) || currentUserLevel === "ADMIN" || currentUserLevel === "L5" || isL5OrAdmin();

    if (!isAdminUser) {
      alert(`🔒 Access Denied: Only Admin users are authorized to edit or save Sauda records.`);
      return;
    }

    // Validate select-only fields: Broker, Supplier, Challan Supplier, Area
    const upperBroker = (formData.broker || '').trim().toUpperCase();
    const isValidBroker = brokerList.length > 0
      ? brokerList.some(b => (b.brok_name && b.brok_name.toUpperCase() === upperBroker) || (b.brok_code && b.brok_code.toUpperCase() === (formData.broker_code || '').trim().toUpperCase()))
      : Boolean(upperBroker);

    if (!upperBroker || !isValidBroker) {
      alert("Please select a valid option for Broker.");
      return;
    }

    const upperSupplier = (formData.supplier || '').trim().toUpperCase();
    const isValidSupplier = supplierList.length > 0
      ? supplierList.some(s => (s.supp_name && s.supp_name.toUpperCase() === upperSupplier) || (s.supp_code && s.supp_code.toUpperCase() === (formData.supplier_code || '').trim().toUpperCase()))
      : Boolean(upperSupplier);

    if (!upperSupplier || !isValidSupplier) {
      alert("Please select a valid option for Supplier.");
      return;
    }

    const upperChallanSupplier = (formData.challan_supplier || '').trim().toUpperCase();
    if (upperChallanSupplier && supplierList.length > 0) {
      const isValidChallan = supplierList.some(s => 
        (s.supp_name && s.supp_name.toUpperCase() === upperChallanSupplier) || 
        (s.supp_code && s.supp_code.toUpperCase() === (formData.challan_supplier_code || '').trim().toUpperCase())
      );
      if (!isValidChallan) {
        alert("Please select a valid option for Challan Supplier.");
        return;
      }
    }

    const upperArea = (formData.area || '').trim().toUpperCase();
    const isValidArea = areaList.length > 0
      ? areaList.some(a => (a.area_name && a.area_name.toUpperCase() === upperArea) || (a.area_code && a.area_code.toUpperCase() === (formData.area_code || '').trim().toUpperCase()))
      : Boolean(upperArea);

    if (!upperArea || !isValidArea) {
      alert("Please select a valid option for Area.");
      return;
    }

    setLoading(true);
    try {
      let finalPoNo = String(formData.no || (formData.is_ptf ? formData.ptf_no : '') || '').trim();
      if (!finalPoNo) {
        finalPoNo = formData.is_ptf && formData.ptf_no
          ? formData.ptf_no
          : `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      // Safe matching helper
      const matchPoNo = (po1: string, po2: string) => {
        if (!po1 || !po2) return false;
        const p1 = po1.trim().toLowerCase();
        const p2 = po2.trim().toLowerCase();
        if (p1 === p2) return true;
        
        const clean1 = p1.replace(/[^a-z0-9]/g, '');
        const clean2 = p2.replace(/[^a-z0-9]/g, '');
        if (clean1 && clean1 === clean2) return true;

        if (clean1.length > 5 && clean2.length > 5 && (clean1.includes(clean2) || clean2.includes(clean1))) {
          return true;
        }

        const num1 = p1.replace(/[^0-9]/g, '');
        const num2 = p2.replace(/[^0-9]/g, '');
        if (num1.length >= 4 && num2.length >= 4 && (num1.includes(num2) || num2.includes(num1))) {
          return true;
        }
        return false;
      };

      // Received = only Final M.R (final_arrival). No temp/dummy data.
      const exactPoNo = (a: any, b: any) => {
        const x = String(a || '').trim().toUpperCase();
        const y = String(b || '').trim().toUpperCase();
        return x !== '' && x === y;
      };
      const matchingFinal = (allFinalArrivals || []).filter((ar: any) => exactPoNo(finalPoNo, ar.po_no));
      const weightOf = (ar: any) => Number(ar.weight_qtl || ar.weight || ar.electronic_net_weight || 0) / 10;
      const totalReceivedMt = matchingFinal.reduce((sum: number, ar: any) => sum + weightOf(ar), 0);

      const contractWeight = parseFloat(formData.total_contract_mt) || 0;
      const unit = formData.purchase_unit_name || (formData as any).unit_type || formData.po_type || 'BALES';
      const tol = calculateWeightTolerance(contractWeight, totalReceivedMt, unit);
      const isWeightCompleted = tol.isCompleted;
      const isPendingVal = isWeightCompleted ? false : (formData.pending === 'Yes');
      
      const payload = {
        financial_year: '2026-2027',
        purchase_order: formData.purchase_order,
        po_type: formData.po_type,
        status: isTempPo ? 'temp' : 'final',
        ptf_no: formData.is_ptf ? formData.ptf_no : null,
        pending: isPendingVal,
        po_no: finalPoNo,
        po_date: formData.date || todayStr,
        broker: (formData.broker || '').toUpperCase(),
        supplier: (formData.supplier || '').toUpperCase(),
        challan_supplier: (formData.challan_supplier || '').toUpperCase(),
        area: (formData.area || '').toUpperCase(),
        trans_paid_by: formData.trans_paid_by,
        weight_unit_kgs: parseFloat(formData.weight_unit_kgs) || 50,
        against_cancellation: formData.against_cancellation,
        purchase_unit_code: formData.purchase_unit_code,
        purchase_unit_name: formData.purchase_unit_name,
        total_lorries: parseFloat(formData.total_no_of_lorries) || 0,
        units_per_lorry: parseFloat(formData.units_per_lorry) || 0,
        total_units: parseFloat(formData.total_units) || 0,
        weight_per_lorry: parseFloat(formData.weight_per_lorry) || 0,
        total_contract_mt: parseFloat(formData.total_contract_mt) || 0,
        marka_type: formData.marka_type,
        marka_penalty: parseFloat(formData.marka_penalty) || 0,
        qty_penalty: parseFloat(formData.qty_penalty) || 0,
        delivery_from: formData.delivery_from || null,
        delivery_to: formData.delivery_to || null,
        grace_days: parseInt(formData.grace_days) || 0,
        delivery_penalty: parseFloat(formData.delivery_penalty) || 0,
        contract_po_no: formData.contract_po_no,
        contract_date: formData.contract_date || null,
        rate_detail: formData.rate_detail,
        delivery_schedule: formData.delivery_schedule,
        terms_condition: formData.terms_condition,
        remarks: formData.remarks,
        po_identification: formData.po_identification,
        b_rate: parseFloat(formData.b_rate) || 0,
        s_date: formData.s_date || null
      };

      // Save Master Record quickly using upsert/update (avoid loading full table)
      const alreadyExists = (poList || []).some((p: any) => String(p.po_no).trim().toUpperCase() === finalPoNo.toUpperCase());

      if (supabase) {
        try {
          await supabase.from(MASTER_TABLE).upsert(payload, { onConflict: 'po_no' });
        } catch (e) {
          console.warn(`Supabase upsert into ${MASTER_TABLE} warning:`, e);
        }
      }

      if (alreadyExists) {
        try {
          await dbModule.update(MASTER_TABLE, 'po_no', finalPoNo, payload);
        } catch {
          await dbModule.insert(MASTER_TABLE, payload).catch(() => {});
        }
      } else {
        await dbModule.insert(MASTER_TABLE, payload).catch(() => {});
      }

      // Persist detail rows atomically and reliably via poService
      await poService.savePoDetails(DETAIL_TABLE, finalPoNo, formData.items, {
        gradeList,
        agencyList,
        markaList
      });
      
      window.dispatchEvent(new CustomEvent('app-data-updated'));
      alert(`Purchase Order ${finalPoNo} saved successfully!`);
      setViewMode('register');
      fetchPosAndMasters();
    } catch (err: any) {
      console.error(err);
      alert("PO Save failed: " + (err.message || "Database error."));
    } finally {
      setLoading(false);
    }
  };

  const openReopenAuthModal = (item: any) => {
    const userCtx = getCurrentUserContext();
    setReopenAuthModalPo(item);
    setReopenUsername(userCtx?.username || 'ADMIN');
    setReopenPassword('');
    setReopenRemarks('');
    setReopenError('');
    setShowReopenPassword(false);
    setClosedNoticePo(null);
  };

  const handleReopenSauda = (item: any) => {
    openReopenAuthModal(item);
  };

  const executeReopenSauda = async () => {
    if (!reopenAuthModalPo) return;
    if (!reopenPassword.trim()) {
      setReopenError("Please enter Admin or Super User Password.");
      return;
    }
    if (!reopenRemarks.trim()) {
      setReopenError("Remarks are mandatory. Please provide a reason for reopening this Sauda.");
      return;
    }

    setIsReopening(true);
    setReopenError('');

    try {
      // 1. Verify Password against Admin or Super User credentials
      const auth = await verifyAdminOrSuperPassword(reopenUsername, reopenPassword);
      if (!auth.success) {
        setReopenError(auth.error || "Invalid Admin or Super User Password.");
        setIsReopening(false);
        return;
      }

      const verifiedUser = auth.user;
      const nowIso = new Date().toISOString();
      const formattedTime = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const cleanPo = String(reopenAuthModalPo.po_no || '').trim().toUpperCase();
      const cleanSauda = String(reopenAuthModalPo.sauda_no || '').trim().toUpperCase();

      // Build JSON format remarks and time who open
      let existingOpenRemarks: any = reopenAuthModalPo.open_remarks;
      if (typeof existingOpenRemarks === 'string') {
        try { existingOpenRemarks = JSON.parse(existingOpenRemarks); } catch (e) {}
      }
      const history = Array.isArray(existingOpenRemarks?.history) ? [...existingOpenRemarks.history] : [];
      if (existingOpenRemarks?.opened_by) {
        history.push({
          remarks: existingOpenRemarks.remarks,
          opened_by: existingOpenRemarks.opened_by,
          opened_at: existingOpenRemarks.opened_at || existingOpenRemarks.timestamp,
          formatted_time: existingOpenRemarks.formatted_time
        });
      }

      const openRemarksPayload = {
        remarks: reopenRemarks.trim(),
        opened_by: verifiedUser.username || reopenUsername.trim().toUpperCase() || 'ADMIN',
        user_id: verifiedUser.user_id || 'admin',
        user_role: verifiedUser.role || 'ADMIN',
        timestamp: nowIso,
        opened_at: nowIso,
        formatted_time: formattedTime,
        history: history.length > 0 ? history : undefined
      };

      // Local storage persistence
      localStorage.setItem(`sauda_reopened_${cleanPo}`, 'true');
      localStorage.removeItem(`sauda_closed_${cleanPo}`);
      localStorage.setItem(`sauda_open_remarks_${cleanPo}`, JSON.stringify(openRemarksPayload));
      if (cleanSauda) {
        localStorage.setItem(`sauda_reopened_${cleanSauda}`, 'true');
        localStorage.removeItem(`sauda_closed_${cleanSauda}`);
        localStorage.setItem(`sauda_open_remarks_${cleanSauda}`, JSON.stringify(openRemarksPayload));
      }

      // Supabase table updates to sauda_check_point, sauda_master, and purchase_master
      if (supabase) {
        try {
          await supabase
            .from('sauda_check_point')
            .update({
              is_closed: false,
              is_reopened: true,
              status: 'open',
              open_remarks: openRemarksPayload
            })
            .eq('po_no', reopenAuthModalPo.po_no);
        } catch (err) {
          console.warn("Update sauda_check_point open_remarks error:", err);
        }

        try {
          await supabase
            .from('sauda_master')
            .update({
              is_closed: false,
              is_reopened: true,
              status: 'open',
              open_remarks: openRemarksPayload
            })
            .or(`sauda_no.eq.${reopenAuthModalPo.po_no},po_no.eq.${reopenAuthModalPo.po_no}`);
        } catch (err) {
          console.warn("Update sauda_master open_remarks error:", err);
        }

        try {
          await supabase
            .from('purchase_master')
            .update({
              is_closed: false,
              is_reopened: true,
              status: 'open',
              open_remarks: openRemarksPayload
            })
            .eq('po_no', reopenAuthModalPo.po_no);
        } catch (err) {
          console.warn("Update purchase_master open_remarks error:", err);
        }
      }

      // Local dbModule / IndexedDB update
      try {
        await dbModule.update('sauda_check_point', 'po_no', reopenAuthModalPo.po_no, {
          is_closed: false,
          is_reopened: true,
          status: 'open',
          open_remarks: openRemarksPayload
        });
      } catch (e) {}

      // Dispatch real-time events for other screens
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('sauda_status_changed', {
        detail: {
          po_no: reopenAuthModalPo.po_no,
          sauda_no: reopenAuthModalPo.sauda_no,
          status: 'reopened',
          open_remarks: openRemarksPayload
        }
      }));

      setEmailNotification({
        type: 'success',
        title: 'Sauda Reopened',
        message: `Sauda #${reopenAuthModalPo.po_no} reopened by ${openRemarksPayload.opened_by}. Status is now OPEN.`
      });

      // Refresh master list
      await fetchPosAndMasters();

      const targetItem = {
        ...reopenAuthModalPo,
        is_closed: false,
        is_reopened: true,
        status: 'open',
        open_remarks: openRemarksPayload
      };

      setReopenSuccessInfo({
        po: targetItem,
        openRemarks: openRemarksPayload
      });

      setReopenAuthModalPo(null);
      setIsReopening(false);
    } catch (err: any) {
      console.error("Reopen Sauda error:", err);
      setReopenError(err.message || String(err));
      setIsReopening(false);
    }
  };

  const handleCloseSauda = async (item: any) => {
    const userCtx = getCurrentUserContext();
    const userRole = String(userCtx?.userRole || '').toUpperCase();
    const userLevel = String(userCtx?.userLevel || '').toUpperCase();
    const isAuthorized = userRole === 'ADMIN' || userRole === 'ADMINISTRATOR' || 
                         userLevel === 'L4' || userLevel === 'L5' || userLevel === 'MAX';

    if (!isAuthorized) {
      alert("🔒 Access Denied: Only an Admin or Level 4 User can manually Close a Sauda.");
      return;
    }

    const cleanPo = String(item.po_no || '').trim().toUpperCase();
    const cleanSauda = String(item.sauda_no || '').trim().toUpperCase();
    const confirmed = window.confirm(`Are you sure you want to CLOSE Sauda #${item.po_no}? Closed Saudas cannot be edited or deleted, and will not be shown in Temporary Arrival.`);
    if (!confirmed) return;

    try {
      localStorage.setItem(`sauda_closed_${cleanPo}`, 'true');
      localStorage.removeItem(`sauda_reopened_${cleanPo}`);
      if (cleanSauda) {
        localStorage.setItem(`sauda_closed_${cleanSauda}`, 'true');
        localStorage.removeItem(`sauda_reopened_${cleanSauda}`);
      }

      if (supabase) {
        await supabase
          .from('sauda_check_point')
          .update({ is_closed: true, is_reopened: false, status: 'closed' })
          .eq('po_no', item.po_no);

        await supabase
          .from('sauda_master')
          .update({ is_closed: true, is_reopened: false, status: 'closed' })
          .or(`sauda_no.eq.${item.po_no},po_no.eq.${item.po_no}`);
      }
      try {
        await dbModule.update('sauda_check_point', 'po_no', item.po_no, { is_closed: true, is_reopened: false, status: 'closed' });
      } catch (e) {}

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('sauda_status_changed', { detail: { po_no: item.po_no, sauda_no: item.sauda_no, status: 'closed' } }));

      setEmailNotification({
        type: 'info',
        title: 'Sauda Closed',
        message: `Sauda #${item.po_no} has been closed. It is now hidden from Temporary Arrival.`
      });

      fetchPosAndMasters();
    } catch (err: any) {
      console.error("Failed to close sauda:", err);
      alert("Failed to close sauda: " + (err.message || String(err)));
    }
  };

  // "Pass" = every field of the linked Material Inspection matches this P.O, so it
  // is promoted to the Final P.O stage (status 'final'). Mismatches stay in Temp and
  // surface in the Mismatch section until cleared.
  const handlePassToFinal = async (item: any) => {
    // 1. If mismatch exists, block advance payment or settlement/pass until resolved
    const isResolved = isPoMismatchResolved(item);
    if (!isResolved && (item.workflow_stage === 'mismatch' || item.stage === 'mismatch' || item.pass_status === 'mismatch' || (item.mismatch_fields && item.mismatch_fields.length > 0))) {
      setEmailNotification({
        type: 'warning',
        title: 'Dispute Resolution Required',
        message: `PO #${item.po_no || item.ptf_no} has an unresolved material/satta mismatch. It is not eligible for Final P.O until cleared in the Mismatch Section.`
      });
      return;
    }

    const isPaymentDone = checkIsAdvancePaymentDone(item, allPayments) || item.has_payment_done;
    const isSettlementDone = checkIsSettlementDone(item, allSettlements) || item.has_settlement_done || item.status === 'settled';

    let confirmMsg = `Move ${item.po_no} from Sauda Check Point to Final P.O?`;
    if (!isPaymentDone && !isSettlementDone) {
      confirmMsg = `Advance Payment & Settlement are pending for PO #${item.po_no}.\n\nDo you want to Pass and transfer this P.O directly to Final P.O?`;
    } else if (!isPaymentDone) {
      confirmMsg = `Advance Payment is pending for PO #${item.po_no}.\n\nDo you want to Pass and transfer this P.O to Final P.O?`;
    } else if (!isSettlementDone) {
      confirmMsg = `Account Settlement is pending for PO #${item.po_no}.\n\nDo you want to Pass and transfer this P.O to Final P.O?`;
    }

    const ok = await askConfirm(
      confirmMsg,
      { title: 'Pass → Final P.O', confirmLabel: 'Pass to Final P.O' }
    );
    if (!ok) return;
    try {
      setLoading(true);
      const cleanPoNo = String(item.po_no || item.contract_po_no || '').trim().toUpperCase();
      const poSuffix = cleanPoNo.split('/').pop() || '';
      const saudaNo = String(item.sauda_no || item.po_contract || item.contract_no || '').trim().toUpperCase();
      const saudaSuffix = saudaNo.split('/').pop() || '';
      const allTokens = [cleanPoNo, poSuffix, saudaNo, saudaSuffix].filter(Boolean);

      const VALID_PURCHASE_MASTER_COLS = [
        'financial_year', 'purchase_order', 'po_type', 'ptf_no', 'pending', 'po_no', 'po_date',
        'broker', 'supplier', 'challan_supplier', 'area', 'trans_paid_by', 'weight_unit_kgs',
        'against_cancellation', 'purchase_unit_code', 'purchase_unit_name', 'total_lorries',
        'units_per_lorry', 'total_units', 'weight_per_lorry', 'total_contract_mt', 'marka_type',
        'marka_penalty', 'qty_penalty', 'delivery_from', 'delivery_to', 'grace_days', 'delivery_penalty',
        'contract_po_no', 'contract_date', 'rate_detail', 'delivery_schedule', 'terms_condition',
        'remarks', 'po_identification', 'b_rate', 's_date', 'status'
      ];

      if (supabase) {
        // Fetch full header from sauda_check_point or sauda_master
        const { data: scpHeader } = await supabase.from('sauda_check_point').select('*').eq('po_no', item.po_no).maybeSingle();
        let saudaHeader: any = null;
        if (!scpHeader && saudaNo) {
          const { data: sData } = await supabase.from('sauda_master').select('*').or(`sauda_no.eq.${saudaNo},session.eq.${item.po_no}`).maybeSingle();
          saudaHeader = sData;
        }

        const source = scpHeader || saudaHeader || item;
        
        // Fetch details from sauda_check_point_details or sauda_quality_details
        let { data: scpDetails } = await supabase.from('sauda_check_point_details').select('*').eq('po_no', item.po_no);
        if ((!scpDetails || scpDetails.length === 0) && (saudaNo || item.po_no)) {
          const { data: sqDetails } = await supabase.from('sauda_quality_details').select('*').or(`sauda_no.eq.${saudaNo || ''},sauda_id.eq.${source?.sauda_id || ''}`);
          if (sqDetails && sqDetails.length > 0) {
            scpDetails = sqDetails;
          }
        }
        
        const rawPayload: Record<string, any> = {
          financial_year: source?.financial_year || item?.financial_year || '2026-2027',
          purchase_order: 'FINAL PO',
          po_type: source?.po_type || item?.po_type || 'Normal',
          ptf_no: source?.ptf_no || item?.ptf_no || null,
          pending: true,
          po_no: item.po_no || source?.po_no || source?.session,
          po_date: source?.date || source?.po_date || item.po_date || item.date || new Date().toISOString().split('T')[0],
          broker: source?.broker || item.broker || '',
          supplier: source?.supplier || item.supplier || '',
          challan_supplier: source?.challan_supplier || item.challan_supplier || source?.supplier || item.supplier || '',
          area: source?.area || item.area || '',
          trans_paid_by: source?.trans_paid_by || item.trans_paid_by || null,
          weight_unit_kgs: source?.weight_unit_kgs || item.weight_unit_kgs || null,
          against_cancellation: source?.against_cancellation || item.against_cancellation || 'No',
          purchase_unit_code: source?.purchase_unit_code || item.purchase_unit_code || null,
          purchase_unit_name: source?.purchase_unit_name || source?.unit_type || item.purchase_unit_name || item.unit_type || 'BALES',
          total_lorries: source?.total_lorries || source?.no_of_lorries || item.total_lorries || item.no_of_lorries || 1,
          units_per_lorry: source?.units_per_lorry || item.units_per_lorry || null,
          total_units: source?.total_units || source?.total_unit || item.total_units || item.total_unit || 0,
          weight_per_lorry: source?.weight_per_lorry || source?.wt_per_lorry || item.weight_per_lorry || null,
          total_contract_mt: source?.total_contract_mt || source?.total_wt_in_ton || item.total_contract_mt || item.total_wt_in_ton || 0,
          marka_type: source?.marka_type || item.marka_type || null,
          marka_penalty: source?.marka_penalty || item.marka_penalty || 0,
          qty_penalty: source?.qty_penalty || item.qty_penalty || 5,
          delivery_from: source?.delivery_from || source?.shipment_date || item.delivery_from || item.shipment_date || null,
          delivery_to: source?.delivery_to || source?.shipment_date || item.delivery_to || item.shipment_date || null,
          grace_days: source?.grace_days || source?.shipment_days || item.grace_days || 0,
          delivery_penalty: source?.delivery_penalty || source?.shipment_penalty || item.delivery_penalty || 0,
          contract_po_no: source?.contract_po_no || item.contract_po_no || '',
          contract_date: source?.contract_date || source?.date || item.contract_date || null,
          rate_detail: source?.rate_detail || item.rate_detail || '',
          delivery_schedule: source?.delivery_schedule || item.delivery_schedule || '',
          terms_condition: source?.terms_condition || item.terms_condition || 'Standard penalty Rs.5/day. Standard terms apply.',
          remarks: source?.remarks || item.remarks || '',
          po_identification: source?.po_identification || item.po_identification || 'Direct Advance Payment',
          b_rate: source?.b_rate || item.b_rate || 0,
          s_date: source?.s_date || source?.b_date || item.s_date || null,
          status: 'final'
        };

        // Whitelist only valid columns of purchase_master to avoid Supabase 400 Bad Request
        const poPayload: Record<string, any> = {};
        for (const col of VALID_PURCHASE_MASTER_COLS) {
          if (rawPayload[col] !== undefined) {
            poPayload[col] = rawPayload[col];
          }
        }
        
        // Insert into purchase_master
        const upsertRes = await supabase.from('purchase_master').upsert(poPayload, { onConflict: 'po_no' });
        if (upsertRes.error) {
          throw new Error(upsertRes.error.message);
        }
        
        // Insert details into purchase_detail_master
        if (scpDetails && scpDetails.length > 0) {
          const isBales = (rawPayload.purchase_unit_name || 'BALES') === 'BALES';
          const detailRows = scpDetails.map((d: any, idx: number) => {
            const rawGrade = d.grade_code || d.quality || d.grade || '';
            const rawAgency = d.agency_code || d.agency || '';
            const rawMarka = d.marka_code || d.marka || '';

            const gMatch = gradeList.find(g => g.grade_code === rawGrade || g.grade_name?.trim().toUpperCase() === rawGrade?.trim().toUpperCase());
            const aMatch = agencyList.find(a => a.agency_code === rawAgency || a.agency_name?.trim().toUpperCase() === rawAgency?.trim().toUpperCase());
            const mMatch = markaList.find(m => m.marka_code === rawMarka || m.marka_name?.trim().toUpperCase() === rawMarka?.trim().toUpperCase());

            const qty = Number(d.quantity || d.qty || 0);
            const wt = d.weight_mt || d.weight || (isBales ? parseFloat(((qty * 147.5) / 1000).toFixed(3)) : 0);
            const rate = Number(d.rate_qntl || d.rate || d.rs || 0);

            return {
              po_no: item.po_no,
              srl_no: d.srl_no || (idx + 1),
              crop_year: d.crop_year || d.crop || '2026-27',
              grade_code: gMatch ? gMatch.grade_code : (rawGrade || ''),
              agency_code: aMatch ? aMatch.agency_code : (rawAgency || ''),
              marka_code: mMatch ? mMatch.marka_code : (rawMarka || ''),
              quantity: qty,
              weight_mt: Number(wt),
              rate_qntl: rate,
              premium: Number(d.premium || 0),
              grade_name: gMatch ? gMatch.grade_name : (d.grade_name || rawGrade || ''),
              agency_name: aMatch ? aMatch.agency_name : (d.agency_name || rawAgency || ''),
              marka_name: mMatch ? mMatch.marka_name : (d.marka_name || rawMarka || '')
            };
          });
          await supabase.from('purchase_detail_master').delete().eq('po_no', item.po_no);
          await supabase.from('purchase_detail_master').insert(detailRows);
        }
        
        // Remove from sauda_check_point and details
        await supabase.from('sauda_check_point_details').delete().eq('po_no', item.po_no);
        await supabase.from('sauda_check_point').delete().eq('po_no', item.po_no);

        // Also update matching records in material_mismatch & satta_mismatch
        try {
          await supabase.from('material_mismatch').update({ status: 'resolved', approved_by: 'Admin L5', remarks: 'Passed to Final P.O' }).eq('po_no', item.po_no);
          await supabase.from('satta_mismatch').update({ status: 'resolved', approved_by: 'Admin L5', remarks: 'Passed to Final P.O' }).eq('po_no', item.po_no);
          if (saudaNo) {
            await supabase.from('satta_mismatch').update({ status: 'resolved', approved_by: 'Admin L5', remarks: 'Passed to Final P.O' }).eq('sauda_no', saudaNo);
            await supabase.from('sauda_master').update({ mismatch_cleared: true, satta_dispute_approved: true }).eq('sauda_no', saudaNo);
            await supabase.from('sms_sauda').update({ mismatch_cleared: true, satta_dispute_approved: true }).eq('sauda_no', saudaNo);
          }
        } catch (_ignore) {}
      } else {
        await dbModule.insert('purchase_master', {
          ...item,
          status: 'final',
          pending: true,
          mismatch_cleared: true,
          satta_dispute_approved: true
        }).catch(() => {});
        await dbModule.delete('sauda_check_point', 'po_no', item.po_no).catch(() => {
          return dbModule.update('sauda_check_point', 'po_no', item.po_no, { status: 'final', mismatch_cleared: true });
        });
      }

      // Mark resolution tokens in localStorage
      allTokens.forEach(t => {
        try {
          localStorage.setItem(`material_resolved_${t.toUpperCase()}`, 'true');
          localStorage.setItem(`satta_resolved_${t.toUpperCase()}`, 'true');
          localStorage.setItem(`material_resolved_MIS-${t.toUpperCase()}`, 'true');
        } catch (_e) {}
      });

      window.dispatchEvent(new CustomEvent('app-data-updated'));
      window.dispatchEvent(new CustomEvent('mismatch_resolved', { detail: { poNo: item.po_no } }));

      alert(`PO #${item.po_no} successfully passed to Final P.O!`);
      await fetchPosAndMasters();
    } catch (e: any) {
      alert('Failed to move to Final P.O: ' + (e.message || 'Database error.'));
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPo = async (poHeader: any) => {
    const getGradeNameForCompare = (gCode: string) => {
      const match = gradeList.find((g: any) => g.grade_code === gCode);
      return match ? match.grade_name : gCode;
    };

    setLoading(true);
    try {
      // Find full items
      const details = await dbModule.fetchAll(DETAIL_TABLE);
      const filtered = details
        .filter((d: any) => d.po_no === poHeader.po_no)
        .sort((a: any, b: any) => (Number(a.srl_no || a.srl || 0) - Number(b.srl_no || b.srl || 0)));
      
      const isBales = (poHeader.purchase_unit_name || 'BALES') === 'BALES';
      const mappedItems = filtered.map((d: any, idx: number) => {
        const qtyVal = d.quantity || 0;
        const weightVal = isBales 
          ? parseFloat(((qtyVal * 147.5) / 1000).toFixed(3)) 
          : (d.weight_mt || 0);
        return {
          srl: idx + 1,
          crop: d.crop_year || '2025-26',
          grade_code: d.grade_code || '',
          grade_name: gradeList.find(g => g.grade_code === d.grade_code)?.grade_name || d.grade_code || 'STANDARD GRADE',
          agency_code: d.agency_code || '',
          agency_name: agencyList.find(a => a.agency_code === d.agency_code)?.agency_name || d.agency_code || 'MAIN AGENCY',
          marka_code: d.marka_code || '',
          marka_name: markaList.find(m => m.marka_code === d.marka_code)?.marka_name || d.marka_code || 'NORMAL GRADE',
          qty: qtyVal,
          weight: weightVal,
          rate: d.rate_qntl || 0
        };
      });

      const sumQty = mappedItems.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
      const sumWt = mappedItems.reduce((s, it) => s + (parseFloat(it.weight) || 0), 0);

      const fullPo = {
        no: poHeader.po_no || '',
        ptf_no: poHeader.ptf_no || '',
        is_ptf: !!poHeader.ptf_no,
        date: poHeader.po_date || poHeader.created_at || todayStr,
        broker: poHeader.broker || 'N/A',
        supplier: poHeader.supplier || 'N/A',
        challan_supplier: poHeader.challan_supplier || 'N/A',
        area: poHeader.area || 'N/A',
        trans_paid_by: poHeader.trans_paid_by || 'PARTY',
        weight_unit_kgs: String(poHeader.weight_unit_kgs || (isBales ? '147.5' : '50')),
        against_cancellation: poHeader.against_cancellation || 'No',
        purchase_unit_name: poHeader.purchase_unit_name || 'BALES',
        total_no_of_lorries: String(poHeader.total_lorries || '0'),
        units_per_lorry: String(poHeader.units_per_lorry || '0'),
        total_units: (poHeader.total_units !== undefined && poHeader.total_units !== null && Number(poHeader.total_units) > 0)
          ? String(poHeader.total_units)
          : (isBales && sumQty > 0 ? sumQty.toString() : String(poHeader.total_units || '0')),
        weight_per_lorry: poHeader.weight_per_lorry !== undefined && poHeader.weight_per_lorry !== null && !isNaN(Number(poHeader.weight_per_lorry)) && Number(poHeader.weight_per_lorry) > 0
          ? Number(poHeader.weight_per_lorry).toFixed(3)
          : String(poHeader.weight_per_lorry || '0.000'),
        total_contract_mt: (poHeader.total_contract_mt !== undefined && poHeader.total_contract_mt !== null && Number(poHeader.total_contract_mt) > 0)
          ? Number(poHeader.total_contract_mt).toFixed(3)
          : (isBales && sumWt > 0 ? sumWt.toFixed(3) : String(poHeader.total_contract_mt || '0')),
        marka_type: poHeader.marka_type || 'Normal',
        marka_penalty: String(poHeader.marka_penalty || '0'),
        qty_penalty: String(poHeader.qty_penalty || '5'),
        delivery_from: poHeader.delivery_from || todayStr,
        delivery_to: poHeader.delivery_to || todayStr,
        grace_days: String(poHeader.grace_days || '0'),
        delivery_penalty: String(poHeader.delivery_penalty || '0'),
        contract_po_no: poHeader.contract_po_no || '',
        contract_date: poHeader.contract_date || todayStr,
        rate_detail: poHeader.rate_detail || '',
        delivery_schedule: poHeader.delivery_schedule || '',
        terms_condition: poHeader.terms_condition || 'Penalty Rs.5/day. Standard terms apply.',
        remarks: poHeader.remarks || 'Grade rates based on BJCL indices.',
        po_identification: poHeader.po_identification || 'Direct Advance Payment',
        b_rate: String(poHeader.b_rate || '0'),
        s_date: poHeader.s_date || todayStr,
        items: mappedItems
      };

      setPrintingPo(fullPo);
    } catch(err: any) {
      alert("Failed to compile print receipt: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPoPdf = async (poHeader: any) => {
    const getGradeNameForCompare = (gCode: string) => {
      const match = gradeList.find((g: any) => g.grade_code === gCode);
      return match ? match.grade_name : gCode;
    };

    setLoading(true);
    try {
      // Find full items
      const details = await dbModule.fetchAll(DETAIL_TABLE);
      const filtered = details
        .filter((d: any) => d.po_no === poHeader.po_no)
        .sort((a: any, b: any) => (Number(a.srl_no || a.srl || 0) - Number(b.srl_no || b.srl || 0)));
      
      const isBales = (poHeader.purchase_unit_name || 'BALES') === 'BALES';
      const mappedItems = filtered.map((d: any, idx: number) => {
        const qtyVal = d.quantity || 0;
        const weightVal = isBales 
          ? parseFloat(((qtyVal * 147.5) / 1000).toFixed(3)) 
          : (d.weight_mt || 0);
        return {
          srl: idx + 1,
          crop: d.crop_year || '2025-26',
          grade_code: d.grade_code || '',
          grade_name: gradeList.find(g => g.grade_code === d.grade_code)?.grade_name || d.grade_code || 'STANDARD GRADE',
          agency_code: d.agency_code || '',
          agency_name: agencyList.find(a => a.agency_code === d.agency_code)?.agency_name || d.agency_code || 'MAIN AGENCY',
          marka_code: d.marka_code || '',
          marka_name: markaList.find(m => m.marka_code === d.marka_code)?.marka_name || d.marka_code || 'NORMAL GRADE',
          qty: qtyVal,
          weight: weightVal,
          rate: d.rate_qntl || 0
        };
      });

      const sumQty = mappedItems.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
      const sumWt = mappedItems.reduce((s, it) => s + (parseFloat(it.weight) || 0), 0);

      const fullPo = {
        no: poHeader.po_no || '',
        ptf_no: poHeader.ptf_no || '',
        is_ptf: !!poHeader.ptf_no,
        date: poHeader.po_date || poHeader.created_at || todayStr,
        broker: poHeader.broker || 'N/A',
        supplier: poHeader.supplier || 'N/A',
        challan_supplier: poHeader.challan_supplier || 'N/A',
        area: poHeader.area || 'N/A',
        trans_paid_by: poHeader.trans_paid_by || 'PARTY',
        weight_unit_kgs: String(poHeader.weight_unit_kgs || (isBales ? '147.5' : '50')),
        against_cancellation: poHeader.against_cancellation || 'No',
        purchase_unit_name: poHeader.purchase_unit_name || 'BALES',
        total_no_of_lorries: String(poHeader.total_lorries || '0'),
        units_per_lorry: String(poHeader.units_per_lorry || '0'),
        total_units: (poHeader.total_units !== undefined && poHeader.total_units !== null && Number(poHeader.total_units) > 0)
          ? String(poHeader.total_units)
          : (isBales && sumQty > 0 ? sumQty.toString() : String(poHeader.total_units || '0')),
        weight_per_lorry: poHeader.weight_per_lorry !== undefined && poHeader.weight_per_lorry !== null && !isNaN(Number(poHeader.weight_per_lorry)) && Number(poHeader.weight_per_lorry) > 0
          ? Number(poHeader.weight_per_lorry).toFixed(3)
          : String(poHeader.weight_per_lorry || '0.000'),
        total_contract_mt: (poHeader.total_contract_mt !== undefined && poHeader.total_contract_mt !== null && Number(poHeader.total_contract_mt) > 0)
          ? Number(poHeader.total_contract_mt).toFixed(3)
          : (isBales && sumWt > 0 ? sumWt.toFixed(3) : String(poHeader.total_contract_mt || '0')),
        marka_type: poHeader.marka_type || 'Normal',
        marka_penalty: String(poHeader.marka_penalty || '0'),
        qty_penalty: String(poHeader.qty_penalty || '5'),
        delivery_from: poHeader.delivery_from || todayStr,
        delivery_to: poHeader.delivery_to || todayStr,
        grace_days: String(poHeader.grace_days || '0'),
        delivery_penalty: String(poHeader.delivery_penalty || '0'),
        contract_po_no: poHeader.contract_po_no || '',
        contract_date: poHeader.contract_date || todayStr,
        rate_detail: poHeader.rate_detail || '',
        delivery_schedule: poHeader.delivery_schedule || '',
        terms_condition: poHeader.terms_condition || 'Penalty Rs.5/day. Standard terms apply.',
        remarks: poHeader.remarks || 'Grade rates based on BJCL indices.',
        po_identification: poHeader.po_identification || 'Direct Advance Payment',
        b_rate: String(poHeader.b_rate || '0'),
        s_date: poHeader.s_date || todayStr,
        items: mappedItems
      };

      downloadPoPdfFile(fullPo);
    } catch(err: any) {
      alert("Failed to compile print receipt: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isSaudaActive = !formData.is_ptf && !!formData.no;

  const getCleanSaudaDigits = (str: string) => {
    if (!str) return '';
    const clean = String(str).trim().toUpperCase();
    const withoutPrefix = clean
      .replace(/^BJCL\//i, '')
      .replace(/^BJC\//i, '')
      .replace(/^BJC/i, '')
      .replace(/^PO[-/]/i, '')
      .replace(/^PTF[-/]/i, '');
    const withoutYear = withoutPrefix
      .replace(/20\d{2}-20\d{2}/g, '')
      .replace(/20\d{2}\/20\d{2}/g, '')
      .replace(/20\d{2}20\d{2}/g, '')
      .replace(/\/\d{2}-\d{2}$/g, '')
      .replace(/^\d{2}-\d{2}\//g, '')
      .replace(/[^0-9]/g, '');
    return withoutYear.replace(/^0+/, '');
  };

  // Filter out those Saudas that are already used in saved purchase orders
  const displaySaudas = saudaList.filter(s => {
    const isPending = !s.status || String(s.status).trim().toLowerCase() !== 'completed';
    const saudaPoDisplayNo = (formatPoNumber(s) || '').trim().toUpperCase();
    const saudaNo = String(s.sauda_no || '').trim().toUpperCase();
    const saudaSession = String(s.session || '').trim().toUpperCase();
    const sDigits = getCleanSaudaDigits(saudaNo) || getCleanSaudaDigits(saudaPoDisplayNo) || getCleanSaudaDigits(saudaSession);

    // If currently selected in the active form, keep it in displaySaudas so it remains visible while editing
    const currentFormNo = (formData.no || formData.contract_po_no || '').trim().toUpperCase();
    const currentFormDigits = getCleanSaudaDigits(currentFormNo);
    const isCurrentlySelectedInForm = currentFormNo && (
      currentFormNo === saudaPoDisplayNo ||
      currentFormNo === saudaSession ||
      currentFormNo === saudaNo ||
      (sDigits && currentFormDigits === sDigits)
    );

    if (isCurrentlySelectedInForm) {
      return true;
    }

    // Check if this sauda's PO display number already exists as contract_po_no, po_no, or ptf_no in poList
    const isAlreadyUsed = poList.some(p => {
      const sId = String(s.sauda_id || s.id || '').trim().toUpperCase();
      const pSaudaId = String(p.sauda_id || p.sauda_id_ref || '').trim().toUpperCase();
      if (sId && pSaudaId && sId === pSaudaId) {
        return true;
      }

      const pPo = String(p.po_no || '').trim().toUpperCase();
      const pContract = String(p.contract_po_no || '').trim().toUpperCase();
      const pSaudaNo = String(p.sauda_no || p.po_contract || p.contract_no || '').trim().toUpperCase();
      const pPtf = String(p.ptf_no || '').trim().toUpperCase();

      // Exact text match on any matching reference field
      const pContractRefs = [pContract, pSaudaNo, pPo, pPtf].filter(Boolean);
      if (pContractRefs.some(ref => 
        ref === saudaPoDisplayNo || 
        ref === saudaSession || 
        ref === saudaNo ||
        (s.sauda_no && ref === String(s.sauda_no).trim().toUpperCase())
      )) {
        return true;
      }

      // Check linked contract digits specifically (on contract_po_no, sauda_no, or exact PO token)
      if (sDigits) {
        const pContractDigits = getCleanSaudaDigits(pContract);
        const pSaudaDigits = getCleanSaudaDigits(pSaudaNo);
        if (pContractDigits && pContractDigits === sDigits) return true;
        if (pSaudaDigits && pSaudaDigits === sDigits) return true;
      }

      return false;
    });

    const meetsPending = formData.pending === 'Yes' ? isPending : !isPending;
    return meetsPending && !isAlreadyUsed;
  }).map(s => ({
    ...s,
    po_display_no: formatPoNumber(s)
  }));

  // Filter POs in register
  const filteredPos = poList.filter(p => {
    const term = searchTerm.toLowerCase();
    const poNo = String(p.po_no || '').toLowerCase();
    const ptfNo = String(p.ptf_no || '').toLowerCase();
    const bName = String(p.broker || '').toLowerCase();
    const sName = String(p.supplier || '').toLowerCase();
    const aName = String(p.area || '').toLowerCase();
    const matchesSearch = poNo.includes(term) || ptfNo.includes(term) || bName.includes(term) || sName.includes(term) || aName.includes(term);
    
    if (!matchesSearch) return false;

    const rowDate = p.date || p.po_date;
    if (startDate && (!rowDate || new Date(rowDate) < new Date(startDate))) return false;
    if (endDate && (!rowDate || new Date(rowDate) > new Date(endDate))) return false;

    const isCancelled = p.status === 'cancelled';
    if (statusFilter === 'cancelled') {
      return isCancelled;
    }
    // Active views never show cancelled POs unless cancelled filter is active
    if (isCancelled) return false;

    const canSeeCompleted = canViewCompletedData();
    const pendingStr = String(p.pending ?? '').trim().toLowerCase();
    const statusStr = String(p.status ?? '').trim().toLowerCase();
    const receivedWt = parseFloat(p.received_weight_mt) || 0;
    const contractWt = parseFloat(p.total_contract_mt) || 0;
    const unit = p.purchase_unit_name || p.unit_type || p.unit || 'BALES';
    const tol = p.weight_tolerance || calculateWeightTolerance(contractWt, receivedWt, unit);
    const contractLorries = p.contract_lorries || p.total_no_of_lorries || 1;
    const receivedLorries = p.received_lorries || 0;
    const isClosed = Boolean(p.is_closed || p.status === 'closed' || (contractLorries > 0 && receivedLorries >= contractLorries));
    const isCompleted = p.pending === false || pendingStr === 'no' || pendingStr === 'false' || p.pending === 0 || statusStr === 'completed' || statusStr === 'settled' || tol.isCompleted || isClosed;
    const computedStatus = isCompleted ? 'completed' : (tol.status === 'mismatch' ? 'mismatch' : (receivedWt > 0 ? 'partial' : 'pending'));

    // Users like L1, L2, L3, L4 can ONLY see Pending and Partial data (Completed is hidden)
    if (!canSeeCompleted && computedStatus === 'completed') {
      return false;
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        if (computedStatus !== 'pending') return false;
      } else if (statusFilter === 'completed') {
        if (computedStatus !== 'completed') return false;
      } else if (statusFilter === 'short') {
        if (!tol.isUnderDelivery || tol.isAcceptable) return false;
      } else if (statusFilter === 'excess') {
        if (!tol.isOverDelivery || tol.isAcceptable) return false;
      } else if (statusFilter === 'cancelled') {
        if (!isCancelled) return false;
      } else if (computedStatus !== statusFilter) {
        return false;
      }
    }

    return true;
  });

  // Sorted POs for Table View
  const sortedPos = React.useMemo(() => {
    return [...filteredPos].sort((a, b) => {
      let comparison = 0;
      switch (sortConfig.key) {
        case 'date': {
          const dateA = a.po_date || a.date || (a.created_at ? a.created_at.slice(0, 10) : '') || '';
          const dateB = b.po_date || b.date || (b.created_at ? b.created_at.slice(0, 10) : '') || '';
          comparison = dateA.localeCompare(dateB);
          break;
        }
        case 'type': {
          const typeA = a.ptf_no ? 'PTF ENTRY' : 'SAUDA LINKED';
          const typeB = b.ptf_no ? 'PTF ENTRY' : 'SAUDA LINKED';
          comparison = typeA.localeCompare(typeB);
          break;
        }
        case 'unit': {
          const unitA = String(a.purchase_unit_name || a.unit_type || a.unit || 'BALES').toUpperCase();
          const unitB = String(b.purchase_unit_name || b.unit_type || b.unit || 'BALES').toUpperCase();
          comparison = unitA.localeCompare(unitB);
          break;
        }
        case 'status': {
          const getStatusRank = (item: any) => {
            const contract = parseFloat(item.total_contract_mt || 0) || 0;
            const rcvd = Number(item.received_weight_mt || 0);
            const unit = item.purchase_unit_name || item.unit_type || item.unit || 'BALES';
            const tol = item.weight_tolerance || calculateWeightTolerance(contract, rcvd, unit);
            const pendingStr = String(item.pending ?? '').trim().toLowerCase();
            const statusStr = String(item.status ?? '').trim().toLowerCase();
            const contractLorries = item.contract_lorries || item.total_no_of_lorries || 1;
            const receivedLorries = item.received_lorries || 0;
            const isClosed = Boolean(item.is_closed || item.status === 'closed' || (contractLorries > 0 && receivedLorries >= contractLorries));
            const isCompletedPo = item.pending === false || pendingStr === 'no' || pendingStr === 'false' || item.pending === 0 || statusStr === 'completed' || statusStr === 'settled' || tol.isCompleted || isClosed;

            if (contract > 0 && rcvd > 0 && rcvd < 5.0) return 5; // CANCELLED
            if (isCompletedPo) return 2; // COMPLETED
            if (tol.isUnderDelivery) return 3; // SHORT WT
            if (tol.isOverDelivery) return 4; // EXCESS WT
            return 1; // PENDING
          };

          const rankA = getStatusRank(a);
          const rankB = getStatusRank(b);

          if (rankA !== rankB) {
            comparison = rankA - rankB;
          } else {
            const dateA = a.po_date || a.date || (a.created_at ? a.created_at.slice(0, 10) : '') || '';
            const dateB = b.po_date || b.date || (b.created_at ? b.created_at.slice(0, 10) : '') || '';
            comparison = dateB.localeCompare(dateA);
          }
          break;
        }
        case 'closed_open': {
          const isClosedA = a.is_closed || a.status === 'closed' ? 1 : 0;
          const isClosedB = b.is_closed || b.status === 'closed' ? 1 : 0;
          comparison = isClosedA - isClosedB;
          break;
        }
        case 'excess_short': {
          const contractA = parseFloat(a.total_contract_mt || 0) || 0;
          const rcvdA = Number(a.received_weight_mt || 0);
          const diffA = rcvdA - contractA;

          const contractB = parseFloat(b.total_contract_mt || 0) || 0;
          const rcvdB = Number(b.received_weight_mt || 0);
          const diffB = rcvdB - contractB;

          comparison = diffA - diffB;
          break;
        }
        case 'pass_mismatch': {
          const getPassMismatchText = (item: any) => {
            const isFinalized = item.status === 'final' || item.status === 'moved_to_final';
            if (isFinalized) return '5_PASS';
            const isResolved = isPoMismatchResolved(item);
            if (isResolved) return '4_ELIGIBLE';
            const stage = item.workflow_stage || (item.pass_status === 'pass' ? 'eligible_adv_payment' : item.pass_status);
            if (stage === 'eligible_adv_payment') return '4_ELIGIBLE';
            if (stage === 'inspection_pending') return '3_INSPECTION_PENDING';
            if (stage === 'mismatch' || (item.mismatch_fields && item.mismatch_fields.length > 0)) return '2_MISMATCH';
            if (stage === 'final_arrival_pending') return '1_FINAL_ARRIVAL_PENDING';
            return '0_TEMP_ARRIVAL_PENDING';
          };
          comparison = getPassMismatchText(a).localeCompare(getPassMismatchText(b));
          break;
        }
        case 'po_no': {
          const poA = String(a.po_no || a.ptf_no || '');
          const poB = String(b.po_no || b.ptf_no || '');
          comparison = poA.localeCompare(poB, undefined, { numeric: true, sensitivity: 'base' });
          break;
        }
        case 'supplier': {
          const sA = String(a.supplier || '');
          const sB = String(b.supplier || '');
          comparison = sA.localeCompare(sB);
          break;
        }
        case 'broker': {
          const bA = String(a.broker || '');
          const bB = String(b.broker || '');
          comparison = bA.localeCompare(bB);
          break;
        }
        case 'total_units': {
          comparison = (Number(a.total_units || 0)) - (Number(b.total_units || 0));
          break;
        }
        case 'weight': {
          const wA = parseFloat(a.received_weight_mt || a.total_contract_mt || 0) || 0;
          const wB = parseFloat(b.received_weight_mt || b.total_contract_mt || 0) || 0;
          comparison = wA - wB;
          break;
        }
        default:
          comparison = 0;
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredPos, sortConfig, matchResults, dbMaterialMismatches]);

  // Helper to render sort indicators
  const renderSortIndicator = (colKey: typeof sortConfig.key) => {
    const isActive = sortConfig.key === colKey;
    if (isActive) {
      return sortConfig.direction === 'asc' ? (
        <ArrowUp className="w-3 h-3 text-emerald-800 shrink-0 inline ml-1 font-bold" />
      ) : (
        <ArrowDown className="w-3 h-3 text-emerald-800 shrink-0 inline ml-1 font-bold" />
      );
    }
    return (
      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0 inline ml-1 transition-opacity" />
    );
  };

  // POs belonging to the current section (Sauda Check Point / Temporary P.O vs Final P.O)
  const sectionPos = poList.filter(p => {
    if (isArchiveView) {
      return true;
    }

    const isArchived = !!p.archived_at;
    if (isArchived) return false;

    const isCancelled = p.status === 'cancelled';
    if (statusFilter === 'cancelled') {
      return isCancelled;
    }
    if (isCancelled) return false;

    const canSeeCompleted = canViewCompletedData();
    const pendingStr = String(p.pending ?? '').trim().toLowerCase();
    const statusStr = String(p.status ?? '').trim().toLowerCase();
    const receivedWt = parseFloat(p.received_weight_mt) || 0;
    const contractWt = parseFloat(p.total_contract_mt) || 0;
    const unit = p.purchase_unit_name || p.unit_type || p.unit || 'BALES';
    const tol = p.weight_tolerance || calculateWeightTolerance(contractWt, receivedWt, unit);
    const contractLorries = p.contract_lorries || p.total_no_of_lorries || 1;
    const receivedLorries = p.received_lorries || 0;
    const isClosed = Boolean(p.is_closed || p.status === 'closed' || (contractLorries > 0 && receivedLorries >= contractLorries));
    const isCompleted = p.pending === false || pendingStr === 'no' || pendingStr === 'false' || p.pending === 0 || statusStr === 'completed' || statusStr === 'settled' || tol.isCompleted || isClosed;
    const computedStatus = isCompleted ? 'completed' : (tol.status === 'mismatch' ? 'mismatch' : (receivedWt > 0 ? 'partial' : 'pending'));
    if (!canSeeCompleted && computedStatus === 'completed') {
      return false;
    }

    return true;
  });

  // Scope metrics by search term and date filters within current section
  const scopedPos = sectionPos.filter(p => {
    const term = searchTerm.toLowerCase();
    if (term) {
      const poNo = String(p.po_no || '').toLowerCase();
      const ptfNo = String(p.ptf_no || '').toLowerCase();
      const bName = String(p.broker || '').toLowerCase();
      const sName = String(p.supplier || '').toLowerCase();
      const aName = String(p.area || '').toLowerCase();
      const matchesSearch = poNo.includes(term) || ptfNo.includes(term) || bName.includes(term) || sName.includes(term) || aName.includes(term);
      if (!matchesSearch) return false;
    }

    const rowDate = p.date || p.po_date;
    if (startDate && (!rowDate || new Date(rowDate) < new Date(startDate))) return false;
    if (endDate && (!rowDate || new Date(rowDate) > new Date(endDate))) return false;

    return true;
  });

  const totalCompletedPos = scopedPos.filter(p => {
    const pendingStr = String(p.pending ?? '').trim().toLowerCase();
    const statusStr = String(p.status ?? '').trim().toLowerCase();
    const receivedWt = parseFloat(p.received_weight_mt) || 0;
    const contractWt = parseFloat(p.total_contract_mt) || 0;
    const unit = p.purchase_unit_name || p.unit_type || p.unit || 'BALES';
    const tol = p.weight_tolerance || calculateWeightTolerance(contractWt, receivedWt, unit);
    const contractLorries = p.contract_lorries || p.total_no_of_lorries || 1;
    const receivedLorries = p.received_lorries || 0;
    const isClosed = Boolean(p.is_closed || p.status === 'closed' || (contractLorries > 0 && receivedLorries >= contractLorries));
    return p.pending === false || pendingStr === 'no' || pendingStr === 'false' || p.pending === 0 || statusStr === 'completed' || statusStr === 'settled' || tol.isCompleted || isClosed;
  }).length;

  const totalShortPos = scopedPos.filter(p => {
    const receivedWt = parseFloat(p.received_weight_mt) || 0;
    const contractWt = parseFloat(p.total_contract_mt) || 0;
    const unit = p.purchase_unit_name || p.unit_type || p.unit || 'BALES';
    const tol = p.weight_tolerance || calculateWeightTolerance(contractWt, receivedWt, unit);
    return tol.isUnderDelivery && !tol.isAcceptable;
  }).length;

  const totalExcessPos = scopedPos.filter(p => {
    const receivedWt = parseFloat(p.received_weight_mt) || 0;
    const contractWt = parseFloat(p.total_contract_mt) || 0;
    const unit = p.purchase_unit_name || p.unit_type || p.unit || 'BALES';
    const tol = p.weight_tolerance || calculateWeightTolerance(contractWt, receivedWt, unit);
    return tol.isOverDelivery && !tol.isAcceptable;
  }).length;

  const totalPendingPos = scopedPos.length - totalCompletedPos;
  const totalGeneratedPos = scopedPos.length;
  const cumulativeWeight = scopedPos.reduce((acc, p) => acc + (parseFloat(p.total_contract_mt) || 0), 0);

  const statusPieData = [
    { name: 'Pending', value: totalPendingPos },
    { name: 'Completed', value: totalCompletedPos },
    { name: 'Short Wt', value: totalShortPos },
    { name: 'Excess Wt', value: totalExcessPos }
  ].filter(i => i.value > 0);
  const STATUS_COLORS = ['#be123c', '#15803d', '#d97706', '#2563eb'];

  if (printingPo) {
    const portalModal = (
      <div className="fixed inset-0 z-[200] bg-[#525659] flex flex-col print:bg-white print:static print:z-auto print-modal">
        <style>{`
          @media print {
            #root {
               display: none !important;
            }
            .no-print {
               display: none !important;
            }
            html, body {
               height: auto !important;
               min-height: 0 !important;
               overflow: visible !important;
               max-height: none !important;
               background: white !important;
               border: none !important;
               box-shadow: none !important;
               padding: 0 !important;
               margin: 0 !important;
            }
            .print-modal {
               position: static !important;
               background: white !important;
               box-shadow: none !important;
               border: none !important;
               margin: 0 !important;
               padding: 0 !important;
               width: 100% !important;
               height: auto !important;
            }
            @page {
               size: A5 portrait;
               margin: 0;
            }
          }
        `}</style>
        
        {/* Viewer Toolbar */}
        <div className="flex-none bg-[#323639] shadow-md px-6 py-3 flex justify-between items-center no-print text-white text-xs ">
          <div className="flex items-center gap-4">
             <button onClick={() => setPrintingPo(null)} className="p-2 text-gray-300 hover:bg-white/10 rounded-full transition">
               <ArrowLeft className="w-5 h-5" />
             </button>
             <span className="font-bold tracking-wider uppercase">Purchase_Order_#{printingPo.ptf_no || printingPo.no}.pdf</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => downloadPoPdfFile(printingPo)} 
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded shadow flex items-center gap-2 font-bold transition cursor-pointer"
              title="Download official PDF Document"
            >
              <Download className="w-4 h-4" /> Download PDF Slip
            </button>
            <button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded shadow flex items-center gap-2 font-bold transition cursor-pointer">
               <Printer className="w-4 h-4" /> Print Document (A4 Half Vertical)
            </button>
          </div>
        </div>

        {/* Scrollable Canvas */}
        <div className="flex-1 overflow-y-auto p-4 flex justify-center print:p-0 print:overflow-visible">
           <PoPrintSlip po={printingPo} />
        </div>
      </div>
    );

    return createPortal(portalModal, document.body);
  }

  return (
    <div className="w-full h-full flex flex-col text-[11px]  text-slate-900 font-sans">
      {viewMode === 'register' && (
        <LegacyLayout 
          title={isArchiveView ? "FINAL P.O ARCHIVE" : (isTempPo ? "SAUDA CHECK POINT" : "FINAL P.O")} 
          subtitle={isArchiveView ? "Archived & Settled Purchase Orders Register" : ""} 
          onClose={onClose}
        >
          <PurchaseOrderRegisterView
            isArchiveView={isArchiveView}
            isTempPo={isTempPo}
            onClose={onClose}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            totalPendingPos={totalPendingPos}
            totalGeneratedPos={totalGeneratedPos}
            totalCompletedPos={totalCompletedPos}
            totalShortPos={totalShortPos}
            totalExcessPos={totalExcessPos}
            cumulativeWeight={cumulativeWeight}
            statusPieData={statusPieData}
            STATUS_COLORS={STATUS_COLORS}
            scopedPos={scopedPos}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            handleCsvDownload={handleCsvDownload}
            fetchPosAndMasters={fetchPosAndMasters}
            loading={loading}
            handleGlobalAdd={handleGlobalAdd}
            selectedPoNo={selectedPoNo}
            setSelectedPoNo={setSelectedPoNo}
            poList={poList}
            handlePrintPo={handlePrintPo}
            handleDeletePo={handleDeletePo}
            handleSort={handleSort}
            renderSortIndicator={renderSortIndicator}
            sortedPos={sortedPos}
            filteredPos={filteredPos}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            handleLoadSelectedPo={handleLoadSelectedPo}
            isPoMismatchResolved={isPoMismatchResolved}
            setClosedNoticePo={setClosedNoticePo}
            openReopenAuthModal={openReopenAuthModal}
            setAuditViewPo={setAuditViewPo}
            handleCloseSauda={handleCloseSauda}
            allPayments={allPayments}
            allSettlements={allSettlements}
            checkIsAdvancePaymentDone={checkIsAdvancePaymentDone}
            checkIsSettlementDone={checkIsSettlementDone}
            setExcessShortModalPo={setExcessShortModalPo}
            handlePassToFinal={handlePassToFinal}
            actionMenu={actionMenu}
            setActionMenu={setActionMenu}
            canEditOrDelete={canEditOrDelete}
          />
        </LegacyLayout>
      )}
      {/* In-Body Form Mode (Renders in Page Body, Same as Sauda Section) */}
      {viewMode === 'form' && (
        <LegacyLayout 
          title={isArchiveView ? "FINAL P.O ARCHIVE ENTRY" : (isTempPo ? "SAUDA CHECK POINT ENTRY" : "PURCHASE ORDER ENTRY")} 
          subtitle={formData.no ? `Editing Order #${formData.no}` : ""} 
          onClose={() => setViewMode('register')}
        >
          <div className="flex-1 flex flex-col font-sans text-slate-800 space-y-4 w-full pb-10">
            
            {/* Header Bar - Matching Mill Inspection Aesthetics (Compact Height) */}
            <div className="bg-[#174C2C] text-white px-5 py-2.5 rounded-lg shadow-md flex flex-wrap items-center justify-between border border-[#0F351E] gap-3">
              {/* Left Badge & Title */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-800/40 border border-emerald-400/40 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="bg-[#0b2415] text-amber-300 text-[10px] font-extrabold px-2 py-0 rounded border border-emerald-700/60 tracking-wider w-fit">
                    {formData.is_ptf ? "PTF Direct Entry" : "Sauda Linked"}
                  </span>
                  <h1 className="text-base md:text-lg font-black uppercase tracking-wider text-amber-300 drop-shadow mt-0.5 leading-tight">
                    {formData.no ? `EDIT P.O #${formData.no}` : (isTempPo ? "NEW SAUDA CHECK POINT ENTRY" : "CREATE NEW PURCHASE ORDER (P.O)")}
                  </h1>
                  <p className="text-[11px] font-bold text-amber-300 tracking-wide mt-0.5 flex items-center gap-1.5 leading-tight">
                    <span>Session: BJCL/2026-2027/</span>
                    {formData.no ? (
                      <>
                        <span>•</span>
                        <span>Order No: #{formData.no}</span>
                      </>
                    ) : formData.is_ptf ? (
                      <>
                        <span>•</span>
                        <span>PTF Direct Entry Mode</span>
                      </>
                    ) : isTempPo ? null : (
                      <>
                        <span>•</span>
                        <span>Sauda Linked Contract Entry</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Right Action Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('register')}
                  className="px-3 py-1.5 bg-[#0b2415]/80 hover:bg-[#123920] border border-emerald-400/50 rounded-md text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                  title="Close P.O Form & Return to Register (Esc)"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-amber-300" />
                  <span>Back</span>
                </button>
              </div>
            </div>

            {/* Form Body */}
            <div ref={poFormRef} className="space-y-5 w-full">
            
            {/* Modular Calculator Helper Modal */}
            <PoCalculationModal
              isOpen={isCalcOpen}
              onClose={() => setIsCalcOpen(false)}
              onApply={handleCalculateOk}
              calcData={calcData}
              setCalcData={setCalcData}
              isPtf={formData.is_ptf}
              purchaseUnitName={formData.purchase_unit_name}
            />

            <PurchaseOrderFormHeader
              formData={formData}
              setFormData={setFormData}
              isSaudaActive={isSaudaActive}
              isTempPo={isTempPo}
              poList={poList}
              brokerList={brokerList}
              supplierList={supplierList}
              areaList={areaList}
              unitList={unitList}
              displaySaudas={displaySaudas}
              handleSaudaSelect={handleSaudaSelect}
              getCropYear={getCropYear}
              generateNextPtfNo={generateNextPtfNo}
              recalculateAllRates={recalculateAllRates}
              sattaBaseRates={sattaBaseRates}
              sattaCalculatedRates={sattaCalculatedRates}
              sattaDifferentials={sattaDifferentials}
              handlePurchaseUnitChange={handlePurchaseUnitChange}
              setCalcData={setCalcData}
              setIsCalcOpen={setIsCalcOpen}
              lookupSattaBaseRate={lookupSattaBaseRate}
            />
            <LegacyFieldset legend="Purchase Order Details (Items Table Matrix)">
              <PoItemsGrid
                formData={formData}
                setFormData={setFormData}
                selectedItemSrl={selectedItemSrl}
                setSelectedItemSrl={setSelectedItemSrl}
                gradeList={gradeList}
                agencyList={agencyList}
                markaList={markaList}
                handleAddItem={handleAddItem}
                handleDeleteItem={handleDeleteItem}
                handleSyncFromSource={handleSyncFromSource}
                getSattaRateForRow={getSattaRateForRow}
                getCropYear={getCropYear}
                isSaudaActive={isSaudaActive}
              />
            </LegacyFieldset>

            {/* Global Actions Block inside Form */}
            <div className="bg-white border border-slate-200 rounded-[18px] p-4 shadow-xs flex flex-wrap justify-center items-center gap-3">
               
               <button 
                 onClick={handleSave} 
                 disabled={loading}
                 className="bg-[#174C2C] hover:bg-[#103A20] text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                 title="Validate and save changes to DB" 
               >
                 <Save className="w-4 h-4 text-emerald-200" /> {loading ? "Saving..." : "Save P.O"}
               </button>

               <button 
                 onClick={() => setViewMode('register')} 
                 className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-[#174C2C] px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                 title="Switch back to records ledger overview" 
               >
                 <FileText className="w-4 h-4 text-slate-600" /> View All P.O
               </button>

               {canEditOrDelete() && (
                 <button 
                   onClick={handleGlobalAmend} 
                   className="bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 hover:border-amber-400 px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                   title="Revise PO number and increment amend counter" 
                 >
                   <Edit className="w-4 h-4 text-amber-700" /> Amend / Revise
                 </button>
               )}

               <button 
                 onClick={() => {
                   if(confirm("Discard active edits? Changes will be lost.")) {
                     setViewMode('register');
                   }
                 }} 
                 className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
               >
                 <X className="w-4 h-4 text-slate-500" /> Discard
               </button>

               <button 
                 onClick={() => setViewMode('register')} 
                 className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
               >
                 <X className="w-4 h-4 text-slate-500" /> Close Form
               </button>
            </div>
          </div>
        </div>
      </LegacyLayout>
    )}

      {/* Actions dropdown — used in BOTH Temporary P.O and Final P.O rows */}
      <PoActionMenuPortal
        actionMenu={actionMenu}
        onClose={() => setActionMenu(null)}
        onSendMail={handleSendMailPo}
        onDelete={handleDeletePo}
      />

      {/* Floating Email & Action Notification Toast */}
      <PoEmailToastNotification
        notification={emailNotification}
        onClose={() => setEmailNotification(null)}
      />

      {/* Confirm popup */}
      <GlobalConfirmModal
        confirmState={confirmState}
        onDismiss={() => setConfirmState(null)}
      />

      {/* 1-to-N Consignment Ledger Modal */}
      {excessShortModalPo && (
        <ExcessShortSettlementModal
          po={excessShortModalPo}
          onClose={() => setExcessShortModalPo(null)}
          onSaveSuccess={() => { fetchPosAndMasters(); }}
          allFinalArrivals={allFinalArrivals}
          allTempArrivals={allTempArrivals}
          allScpDetails={allScpDetails}
          sattaCalculatedRates={sattaCalcs}
          sattaBaseRates={sattaBases}
        />
      )}

      {consignmentLedgerPo && (
        <PoConsignmentModal
          po={consignmentLedgerPo}
          onClose={() => setConsignmentLedgerPo(null)}
          allTempArrivals={allTempArrivals}
          allFinalArrivals={allFinalArrivals}
          allInspections={allInspections}
        />
      )}

      <PoReopenModal
        closedNoticePo={closedNoticePo}
        setClosedNoticePo={setClosedNoticePo}
        reopenAuthModalPo={reopenAuthModalPo}
        setReopenAuthModalPo={setReopenAuthModalPo}
        openReopenAuthModal={openReopenAuthModal}
        reopenUsername={reopenUsername}
        setReopenUsername={setReopenUsername}
        reopenPassword={reopenPassword}
        setReopenPassword={setReopenPassword}
        reopenRemarks={reopenRemarks}
        setReopenRemarks={setReopenRemarks}
        showReopenPassword={showReopenPassword}
        setShowReopenPassword={setShowReopenPassword}
        reopenError={reopenError}
        isReopening={isReopening}
        executeReopenSauda={executeReopenSauda}
      />

      {/* Reopen Success Modal */}
      <ReopenSuccessModal
        info={reopenSuccessInfo}
        onClose={() => setReopenSuccessInfo(null)}
        onEditNow={(po) => handleLoadSelectedPo(po)}
      />

      {/* Reopen Audit Log View Modal */}
      <ReopenAuditLogModal
        auditViewPo={auditViewPo}
        onClose={() => setAuditViewPo(null)}
      />

      {/* Mismatch Approval / Resolution Modal */}
      <MismatchApprovalModal
        mismatchModalPo={mismatchModalPo}
        onClose={() => setMismatchModalPo(null)}
        getMismatchReasonText={getMismatchReasonText}
        onApprove={handleApproveMismatch}
      />

    </div>
  );

}
