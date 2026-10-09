/**
 * Centralized Dashboard Calculation Service
 * 
 * Provides unified, single-source-of-truth calculations for:
 * 1. Sauda Check Point Summary (Sauda + Final P.O./P.T.F combined)
 * 2. Pending Sauda Calculation (Cross-checked against Temporary Arrival records)
 * 3. Payment Totals & PO Matching (Total Payable Value, Paid Amount, Remaining Amount)
 * 4. Month-Wise Contract and Payment Summary (Dynamic Year, Month Allocation Rules)
 * 5. Traceable detailed records for interactive card modals
 */

import { formatIndianCurrency } from '../lib/utils';
import { aggregatePremiumsFromTables, filterAggregatedPremiums } from './paymentCalculationEngine';

export interface UnifiedContractRecord {
  id: string;
  contractNo: string;
  cleanContractNo: string;
  contractType: 'SAUDA' | 'FINAL_PO' | 'PTF';
  contractDate: string; // ISO date or YYYY-MM-DD
  year: number;
  month: number; // 0-11
  monthName: string;
  supplier: string;
  broker: string;
  area?: string;
  purchaseUnit: string;
  totalUnits: number;
  totalWeightMt: number;
  ratePerQtl: number;
  contractValue: number;
  
  // Arrival Status (calculated from Temporary Arrival)
  arrivalStatus: 'RECEIVED' | 'PENDING' | 'PARTIAL';
  receivedWeightMt: number;
  pendingWeightMt: number;
  arrivalRecordsCount: number;
  
  // Payment Status (calculated from Payment Operations)
  payableValue: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERPAID';
  voucherNos: string[];
  rawRecord: any;
}

export interface MonthSummary {
  monthIndex: number; // 0-11 (0 = January, 11 = December)
  monthName: string;
  year: number;
  totalContracts: number;
  saudaContracts: number;
  ptfContracts: number;
  pendingContracts: number;
  partialContracts: number;
  totalWeightMt: number;
  saudaWeightMt: number;
  ptfWeightMt: number;
  pendingWeightMt: number;
  partialWeightMt: number;
  totalContractValue: number;
  paidAmount: number;
  remainingAmount: number;
  contracts: UnifiedContractRecord[];
}

export interface DashboardMetricsResult {
  // 1. Sauda Check Point Card Totals
  totalContractsCount: number;
  totalWeightMt: number;
  saudaContractsCount: number;
  saudaWeightMt: number;
  ptfContractsCount: number;
  ptfWeightMt: number;
  
  // 2. Pending Sauda Card Totals
  totalPendingContractsCount: number;
  totalPendingWeightMt: number;
  pendingSaudaCount: number;
  pendingSaudaWeightMt: number;
  pendingPtfCount: number;
  pendingPtfWeightMt: number;
  
  // 3. Payment Totals
  totalPayableValue: number;
  totalPaidAmount: number;
  totalRemainingAmount: number;
  advancePaymentAmount: number;
  
  // 4. Godown Stock Totals
  totalStockMt: number;
  godownStockBales: number;
  
  // 5. Month-Wise Summaries (grouped by year)
  availableYears: number[];
  selectedYear: number;
  monthSummaries: MonthSummary[];
  
  // 6. Traceable Master List
  allContracts: UnifiedContractRecord[];
  allPayments: any[];
}

export interface InspectionRecord {
  id: string;
  mrNo: string;
  cleanMrNo: string;
  poNo: string;
  cleanPoNo: string;
  date: string;
  year: number;
  month: number; // 0-11
  monthName: string;
  supplier: string;
  broker: string;
  vehicleNo: string;
  juteGrade: string;
  weightQtl: number;
  weightMt: number;
  
  // 1. Moisture % & Claim
  actualMoisture: number;
  claimMoisture: number;
  moistureDeductionAmount: number;
  
  // 2. Dust % & Claim
  actualDust: number;
  claimDust: number;
  dustDeductionAmount: number;
  
  // 3. Grade Down % & Claim
  actualGradeDown: number;
  claimGradeDown: number;
  gradeDownDeductionAmount: number;
  
  // 4. Chotta & Habi Jabi
  chottaWeightKg: number;
  habijabiWeightKg: number;
  totalChottaHabijabiKg: number;
  chottaHabijabiDeductionAmount: number;
  chottaGrade: string;
  habijabiGrade: string;
  
  // 5. Premium (ONLY FROM SAUDA CHECK POINT)
  premium: string;
  isPremium: boolean;
  premiumRate: number;
  premiumAmount: number;
  premiumSource: string;
  
  // Additional claims
  qualityDeductionAmount: number;
  deliveryClaimAmount: number;
  baleWeightDeductionAmount: number;
  otherDeductionAmount: number;
  totalClaimAmount: number;
  
  status: string;
  remarks: string;
  rawRecord: any;
}

/**
 * Extracts Bales / Drum Quantity from Receipt details (grid_details) or fallback fields
 */
export function getRecordBales(item: any): number {
  if (!item) return 0;
  if (item.grid_details) {
    let grid: any[] = [];
    if (typeof item.grid_details === 'string') {
      try {
        const parsed = item.grid_details === 'undefined' || item.grid_details === 'null' ? [] : JSON.parse(item.grid_details === "undefined" ? "null" : item.grid_details);
        if (Array.isArray(parsed)) grid = parsed;
      } catch (e) {}
    } else if (Array.isArray(item.grid_details)) {
      grid = item.grid_details;
    }

    if (grid.length > 0) {
      let hasChln = false;
      let sumChln = 0;
      grid.forEach((row: any) => {
        const val = row.quantity_chln !== undefined && row.quantity_chln !== null && row.quantity_chln !== ''
          ? Number(row.quantity_chln)
          : (row.chln !== undefined && row.chln !== null && row.chln !== '' ? Number(row.chln) : NaN);
        if (!isNaN(val)) {
          hasChln = true;
          sumChln += val;
        }
      });
      if (hasChln && sumChln > 0) return sumChln;

      const fallback = grid.reduce((acc: number, row: any) => acc + (Number(row.quantity_chln) || Number(row.chln) || Number(row.quantity) || Number(row.qty) || Number(row.bales) || 0), 0);
      if (fallback > 0) return fallback;
    }
  }
  return Number(item.total_packets || item.packets || item.actual_bales || item.challan_bales || item.bales || item.quantity || 0);
}

/**
 * Extracts lowest net weight in Metric Tons
 */
export function getRecordNetWeightMt(item: any): number {
  if (!item) return 0;
  const nets = [
    Number(item.electronic_net_weight),
    Number(item.supplier_net_weight),
    Number(item.challan_material_weight),
    Number(item.weight_reduced),
    item.weight_qtl ? Number(item.weight_qtl) / 10 : 0,
    Number(item.weight),
    Number(item.quantity)
  ].filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
  if (nets.length > 0) {
    const minVal = Math.min(...nets);
    return minVal > 50 ? minVal / 10 : minVal;
  }
  const gross = Number(item.total_actual_weight || item.weight_mt || item.challan_gross_wt || item.receipt_gross_wt || 0);
  return gross > 100 ? gross / 1000 : (gross > 50 ? gross / 10 : gross);
}

export interface PendingStageRecord {
  id: string;
  stage: 'MR_TO_FMR' | 'FMR_TO_INSP' | 'INSP_TO_PAYM' | 'PAYM_TO_SETT';
  stageLabel: string;
  stageCode: 'MR ➔ FMR' | 'FMR ➔ INSP' | 'INSP ➔ Paym' | 'Paym ➔ Sett';
  poNo: string;
  cleanPoNo: string;
  mrNo: string;
  arrivalNo?: string;
  date: string;
  supplier: string;
  broker: string;
  vehicleNo: string;
  bales: number;
  weightMt: number;
  weightQtl: number;
  amount: number;
  status: string;
  pendingAction: string;
  rawRecord?: any;
}

export interface MonthInspectionSummary {
  monthIndex: number;
  monthName: string;
  year: number;
  totalInspections: number; // Represents total MR count from Temporary Arrival
  totalWeightMt: number;
  
  // 1. Temporary Arrival (MR) Specifics
  temporaryArrivalsCount: number;
  temporaryArrivalsBales: number;
  temporaryArrivalsWeightMt: number;
  
  // 2. Final Arrival (FMR) Specifics
  finalArrivalsCount: number;
  finalArrivalsBales: number;
  finalArrivalsWeightMt: number;
  pendingFmrCount: number; // Below FMR / Pending Final Arrival
  
  // 3. Mill Inspection Specifics
  inspectionCount: number;
  pendingInspectionCount: number;
  materialInspectionCount: number;
  millInspectionCount: number;
  
  // 4. Payment Specifics
  paymentCount: number;
  paymentPaidAmount: number;
  paymentPayableAmount: number;
  
  // 5. Settlement Specifics
  settlementCount: number;
  settlementAmount: number;
  
  // 6. Pipeline Pending Lists & P.O. Number Tracking
  pendingFmrList: PendingStageRecord[];
  pendingInspectionList: PendingStageRecord[];
  pendingPaymentList: PendingStageRecord[];
  pendingSettlementList: PendingStageRecord[];
  allPendingPipelineList: PendingStageRecord[];
  pendingFmrPoCount: number;
  pendingInspectionPoCount: number;
  pendingPaymentPoCount: number;
  pendingSettlementPoCount: number;
  totalPendingPoCount: number;
  
  // Averages & Totals (Quality & Claims)
  avgMoisture: number;
  avgClaimMoisture: number;
  avgDust: number;
  avgClaimDust: number;
  avgGradeDown: number;
  avgClaimGradeDown: number;
  
  totalChottaHabijabiKg: number;
  totalChottaHabijabiClaim: number;
  
  // Premium lots from Sauda Check Point
  premiumLotsCount: number;
  premiumTotalSum: number;
  avgPremiumRate: number;
  
  totalClaimAmount: number;
  lotsWithMoistureClaim: number;
  lotsWithQualityClaim: number;
  inspections: InspectionRecord[];
  payments: any[];
  settlements: any[];
  temporaryArrivals: any[];
  finalArrivals: any[];
}

export interface ComputeInspectionMetricsParams {
  inspections?: any[];
  inspectionDetails?: any[];
  materialInspections?: any[];
  millInspections?: any[];
  arrivals?: any[]; // temporary_material_received (TMR)
  finalArrivals?: any[]; // final_arrival (FMR)
  saudaCheckPoints?: any[];
  saudaCheckPointDetails?: any[];
  paymentRecords?: any[];
  paymentDetails?: any[];
  pos?: any[];
  settlements?: any[];
  selectedYear?: number;
}

export interface InspectionMetricsResult {
  monthInspectionSummaries: MonthInspectionSummary[];
  allInspections: InspectionRecord[];
  totalInspectionsCount: number;
  totalInspectedWeightMt: number;
  totalYearTemporaryArrivalsCount: number;
  totalYearBales: number;
  totalYearArrivalWeightMt: number;
  totalYearFinalArrivalsCount: number;
  totalYearFinalArrivalsBales: number;
  totalYearFinalArrivalsWeightMt: number;
  totalYearPendingFmrCount: number;
  totalYearInspectionsCount: number;
  totalMaterialInspectionsCount: number;
  totalMillInspectionsCount: number;
  totalPendingInspectionsCount: number;
  totalYearPaymentsCount: number;
  totalYearPaidAmount: number;
  totalYearSettlementsCount: number;
  totalYearSettledAmount: number;
  allYearPendingFmrList: PendingStageRecord[];
  allYearPendingInspectionList: PendingStageRecord[];
  allYearPendingPaymentList: PendingStageRecord[];
  allYearPendingSettlementList: PendingStageRecord[];
  allYearPendingPipelineList: PendingStageRecord[];
  yearPendingFmrPoCount: number;
  yearPendingInspectionPoCount: number;
  yearPendingPaymentPoCount: number;
  yearPendingSettlementPoCount: number;
  yearTotalPendingPoCount: number;
  overallAvgMoisture: number;
  overallAvgClaimMoisture: number;
  overallAvgDust: number;
  overallAvgClaimDust: number;
  overallAvgGradeDown: number;
  overallAvgClaimGradeDown: number;
  totalChottaHabijabiKg: number;
  totalPremiumLots: number;
  totalPremiumSum: number;
  avgPremiumRate: number;
  totalClaimAmount: number;
  availableYears: number[];
  selectedYear: number;
}

export function computeInspectionMetrics(params: ComputeInspectionMetricsParams): InspectionMetricsResult {
  const { 
    inspections = [], 
    inspectionDetails = [],
    materialInspections = [],
    millInspections = [],
    arrivals = [], 
    finalArrivals = [],
    saudaCheckPoints = [],
    saudaCheckPointDetails = [],
    paymentRecords = [],
    paymentDetails = [],
    pos = [], 
    settlements = [],
    selectedYear 
  } = params;

  // Unified payment & details premium calculation engine
  const unifiedPremiums = aggregatePremiumsFromTables(paymentRecords, paymentDetails);

  // Build Premium lookup map by normalized MR Number & PO Number & Voucher Number
  // Priority: 1. Payment Operations ("Material Grade Details Breakdown"), 2. Sauda Check Point, 3. PO
  const premiumMap = new Map<string, { premium: string; isPremium: boolean; rate: number; amount: number; source: string }>();

  const registerPremium = (refNo: string, raw: any, sourceName = "Payment Operations") => {
    if (!refNo) return;
    const clean = normalizePoRef(refNo);
    if (!clean) return;

    let premStr = "";
    let isPrem = false;
    let premRate = 0;
    let premAmount = 0;

    const rateCandidate = Number(raw.premium ?? raw.premium_rate ?? 0);
    const amtCandidate = Number(raw.summary_premium_amount ?? raw.val_premium_amt ?? raw.premium_amount ?? 0);
    const wtCandidateMt = Number(raw.arr_qty_wt ?? raw.wt_quantity ?? (Number(raw.quantity_qtl || 0) / 10) ?? raw.weight_mt ?? 0);
    const wtCandidateQtl = Number(raw.quantity_qtl ?? (wtCandidateMt * 10) ?? 0);

    if (rateCandidate > 0) {
      isPrem = true;
      premRate = rateCandidate;
      premStr = `₹${premRate}/Qtl`;
      premAmount = amtCandidate > 0 ? amtCandidate : (premRate * (wtCandidateQtl > 0 ? wtCandidateQtl : (wtCandidateMt * 10)));
    } else if (amtCandidate > 0) {
      isPrem = true;
      premAmount = amtCandidate;
      premStr = `₹${premAmount}`;
      premRate = wtCandidateQtl > 0 ? (premAmount / wtCandidateQtl) : (wtCandidateMt > 0 ? (premAmount / (wtCandidateMt * 10)) : 0);
    } else if (raw.premium !== undefined && raw.premium !== null && String(raw.premium).trim() !== "" && String(raw.premium).trim() !== "0" && String(raw.premium).trim().toLowerCase() !== "no") {
      premStr = String(raw.premium).trim();
      const num = parseFloat(premStr.replace(/[^0-9.]/g, ''));
      if (!isNaN(num) && num > 0) {
        premRate = num;
        premAmount = premRate * (wtCandidateQtl > 0 ? wtCandidateQtl : (wtCandidateMt * 10));
      }
      isPrem = /yes|true|premium/i.test(premStr) || premRate > 0;
    } else if (raw.is_premium === true || raw.is_premium === "Yes" || raw.is_premium === "YES") {
      isPrem = true;
      premStr = "Yes";
    }

    if (isPrem || premRate > 0 || premAmount > 0) {
      const existing = premiumMap.get(clean);
      if (existing) {
        existing.amount = Number((existing.amount + premAmount).toFixed(2));
        if (premRate > 0) {
          existing.rate = Math.max(existing.rate, premRate);
          existing.premium = `₹${existing.rate}/Qtl`;
        }
        existing.isPremium = true;
      } else {
        premiumMap.set(clean, {
          premium: premStr || (premRate > 0 ? `₹${premRate}/Qtl` : "Yes"),
          isPremium: true,
          rate: premRate,
          amount: Number(premAmount.toFixed(2)),
          source: sourceName
        });
      }
    }
  };

  // Dedicated Payment Section MR Premium index
  // Each MR can have multiple detail rows (e.g. 2 grades, each with premium rate * quintals)
  const paymentMrPremiumMap = new Map<string, {
    mrNo: string;
    cleanMr: string;
    voucherNo: string;
    date: string;
    year: number;
    month: number;
    rate: number;
    weightQtl: number;
    amount: number;
    supplier?: string;
    broker?: string;
    juteGrade?: string;
  }>();

  // Index payment records by voucher and MR for fast metadata lookup
  const paymentMetaMap = new Map<string, any>();
  paymentRecords.forEach(pm => {
    if (pm.voucher_no) paymentMetaMap.set(normalizePoRef(pm.voucher_no), pm);
    if (pm.mr_no) paymentMetaMap.set(normalizePoRef(pm.mr_no), pm);
    if (pm.arrival_no) paymentMetaMap.set(normalizePoRef(pm.arrival_no), pm);
  });

  // 1. Process paymentDetails (Material Grade Details breakdown with Premium)
  paymentDetails.forEach(det => {
    const rawMr = String(det.mr_no || det.arrival_no || '').trim();
    const cleanMr = normalizePoRef(rawMr);
    const premRate = Number(det.premium || det.rate_premium || 0);
    const premAmtExplicit = Number(det.summary_premium_amount || det.val_premium_amt || 0);
    const qtl = Number(det.quantity_qtl || 0) || (Number(det.arr_qty_wt || det.wt_quantity || 0) * 10);
    const calcAmt = premAmtExplicit > 0 ? premAmtExplicit : (premRate > 0 && qtl > 0 ? Number((premRate * qtl).toFixed(2)) : 0);

    if (cleanMr && (premRate > 0 || calcAmt > 0)) {
      const pmMeta = paymentMetaMap.get(normalizePoRef(det.voucher_no)) || paymentMetaMap.get(cleanMr) || {};
      const dateStr = pmMeta.payment_date || pmMeta.date || det.created_at || pmMeta.created_at || '';
      const { year: detYear, month: detMonth, isValid } = parseRecordDate(dateStr);

      const existing = paymentMrPremiumMap.get(cleanMr);
      if (existing) {
        existing.amount = Number((existing.amount + calcAmt).toFixed(2));
        existing.weightQtl = Number((existing.weightQtl + qtl).toFixed(2));
        if (premRate > 0) existing.rate = Math.max(existing.rate, premRate);
        if (!existing.date && dateStr) {
          existing.date = dateStr;
          existing.year = detYear;
          existing.month = detMonth;
        }
      } else {
        paymentMrPremiumMap.set(cleanMr, {
          mrNo: rawMr,
          cleanMr,
          voucherNo: det.voucher_no || pmMeta.voucher_no || '',
          date: dateStr,
          year: isValid ? detYear : (activeYear || 2026),
          month: isValid ? detMonth : 7,
          rate: premRate,
          weightQtl: qtl,
          amount: calcAmt,
          supplier: pmMeta.supplier || pmMeta.party_name || pmMeta.supplier_name || 'DIRECT SUPPLIER',
          broker: pmMeta.broker || pmMeta.broker_name || 'DIRECT',
          juteGrade: det.grade || det.jute_grade || 'TD-5'
        });
      }
    }
  });

  // 2. Process paymentRecords (Payment Master header records)
  paymentRecords.forEach(pm => {
    const rawMr = String(pm.mr_no || pm.arrival_no || '').trim();
    const cleanMr = normalizePoRef(rawMr);
    const premAmt = Number(pm.val_premium_amt || pm.summary_premium_amount || 0);
    const premRate = Number(pm.premium || pm.premium_rate || 0);
    if (cleanMr && (premAmt > 0 || premRate > 0)) {
      const dateStr = pm.payment_date || pm.date || pm.created_at || '';
      const { year: pmYear, month: pmMonth, isValid } = parseRecordDate(dateStr);
      const existing = paymentMrPremiumMap.get(cleanMr);
      if (existing) {
        if (existing.amount === 0 && premAmt > 0) existing.amount = premAmt;
        if (existing.rate === 0 && premRate > 0) existing.rate = premRate;
      } else {
        paymentMrPremiumMap.set(cleanMr, {
          mrNo: rawMr,
          cleanMr,
          voucherNo: pm.voucher_no || '',
          date: dateStr,
          year: isValid ? pmYear : (activeYear || 2026),
          month: isValid ? pmMonth : 7,
          rate: premRate,
          weightQtl: Number(pm.quantity_qtl || 0),
          amount: premAmt,
          supplier: pm.supplier || pm.party_name || pm.supplier_name || 'DIRECT SUPPLIER',
          broker: pm.broker || pm.broker_name || 'DIRECT',
          juteGrade: pm.jute_grade || pm.grade || 'TD-5'
        });
      }
    }
  });

  // 1. Payment Details (Material Grade Details breakdown with Premium ₹/Qtl * Weight MT)
  paymentDetails.forEach(det => {
    registerPremium(det.mr_no, det, "Payment Operations");
    registerPremium(det.voucher_no, det, "Payment Operations");
    registerPremium(det.arrival_no, det, "Payment Operations");
    registerPremium(det.po_no, det, "Payment Operations");
  });

  // 2. Payment Master records
  paymentRecords.forEach(pm => {
    registerPremium(pm.mr_no, pm, "Payment Operations");
    registerPremium(pm.voucher_no, pm, "Payment Operations");
    registerPremium(pm.arrival_no, pm, "Payment Operations");
    registerPremium(pm.po_no, pm, "Payment Operations");
  });

  // 3. Sauda Check Point and Details
  saudaCheckPoints.forEach(scp => {
    registerPremium(scp.mr_no, scp, "Sauda Check Point");
    registerPremium(scp.po_no, scp, "Sauda Check Point");
    registerPremium(scp.sauda_no, scp, "Sauda Check Point");
    registerPremium(scp.contract_no, scp, "Sauda Check Point");
  });

  saudaCheckPointDetails.forEach(det => {
    registerPremium(det.mr_no, det, "Sauda Check Point");
    registerPremium(det.po_no, det, "Sauda Check Point");
    registerPremium(det.sauda_no, det, "Sauda Check Point");
  });

  // 4. Purchase Orders
  pos.forEach(p => {
    registerPremium(p.po_no, p, "Purchase Order");
    registerPremium(p.contract_po_no, p, "Purchase Order");
  });

  // 5. Settlement Audits & Valuations
  settlements.forEach(st => {
    registerPremium(st.mr_no, st, "Settlement Audit");
    registerPremium(st.po_no, st, "Settlement Audit");
    registerPremium(st.sauda_no, st, "Settlement Audit");
    registerPremium(st.contract_po_no, st, "Settlement Audit");
    registerPremium(st.voucher_no, st, "Settlement Audit");
  });

  // Build detail rows mapping by MR No / Inspection ID
  const detailRowsByMr = new Map<string, any[]>();
  inspectionDetails.forEach(det => {
    const mr = normalizePoRef(det.mr_no || det.inspection_id || det.arrival_no || '');
    if (mr) {
      const existing = detailRowsByMr.get(mr) || [];
      existing.push(det);
      detailRowsByMr.set(mr, existing);
    }
  });

  // Build arrivals lookup map to enrich inspection metadata if needed
  const arrivalsByMr = new Map<string, any>();
  arrivals.forEach((item, idx) => {
    const mr = normalizePoRef(item.mr_no || item.temporary_arrival_no || item.arrival_no || item.amad_no || item.challan_no || `ARR-${idx}`);
    if (mr) {
      arrivalsByMr.set(mr, item);
    }
  });

  // Build a consolidated map of inspection records by MR No ONLY
  const mapByMr = new Map<string, any>();

  // 1. Process material_inspection records
  materialInspections.forEach((item, idx) => {
    const rawMr = item.mr_no || item.arrival_no || item.temporary_arrival_no || item.amad_no || item.id || `MI-${idx}`;
    const mr = normalizePoRef(rawMr);
    if (!mr) return;
    const arr = arrivalsByMr.get(mr) || arrivalsByMr.get(normalizePoRef(item.arrival_no || '')) || {};
    mapByMr.set(mr, { ...arr, ...item, inspection_source: 'material', is_inspected: true, status: item.status || 'Completed' });
  });

  // 2. Process mill_inspection_master records
  millInspections.forEach((item, idx) => {
    const rawMr = item.mr_no || item.arrival_no || item.temporary_arrival_no || item.amad_no || item.id || `MIM-${idx}`;
    const mr = normalizePoRef(rawMr);
    if (!mr) return;
    const arr = arrivalsByMr.get(mr) || arrivalsByMr.get(normalizePoRef(item.arrival_no || '')) || {};
    const existing = mapByMr.get(mr);
    mapByMr.set(mr, { ...arr, ...(existing || {}), ...item, inspection_source: 'mill', is_mill: true, is_inspected: true, status: item.status || 'Completed' });
  });

  // 3. Process generic inspection records if passed
  inspections.forEach((item, idx) => {
    const rawMr = item.mr_no || item.arrival_no || item.temporary_arrival_no || item.amad_no || item.id || `MR-${idx}`;
    const mr = normalizePoRef(rawMr);
    if (!mr) return;
    
    // Enrich with arrival data if available
    const arr = arrivalsByMr.get(mr) || arrivalsByMr.get(normalizePoRef(item.arrival_no || '')) || {};
    const isMill = item.inspection_source === 'mill' || item.is_mill || Boolean(item.mill_code) || Boolean(item.mill_name);
    const existing = mapByMr.get(mr);
    const isInspected = item.is_inspected === true || item.status === 'Completed' || item.status === 'Audited';
    mapByMr.set(mr, {
      ...arr,
      ...(existing || {}),
      ...item,
      inspection_source: existing?.inspection_source || (isMill ? 'mill' : 'material'),
      is_inspected: isInspected,
      status: isInspected ? (item.status || 'Completed') : 'Pending'
    });
  });

  // 4. Process all arrivals from temporary_material_received (MRs)
  // Ensures every Temporary Arrival record is represented. Uninspected records show as 'Pending'.
  arrivals.forEach((item, idx) => {
    const rawMr = item.mr_no || item.temporary_arrival_no || item.arrival_no || item.amad_no || item.amad_id || `ARR-${idx}`;
    const mr = normalizePoRef(rawMr);
    if (!mr) return;
    if (!mapByMr.has(mr)) {
      mapByMr.set(mr, {
        ...item,
        is_inspected: false,
        status: (item.inspection_status === 'inspected' || item.status === 'inspected') ? 'Completed' : 'Pending',
        inspection_source: 'arrival'
      });
    }
  });

  // 5. Process Payment records and Payment Details so Payment Section MRs are included
  paymentRecords.forEach((item, idx) => {
    const rawMr = item.mr_no || item.arrival_no || `PAY-${idx}`;
    const mr = normalizePoRef(rawMr);
    if (!mr) return;
    if (!mapByMr.has(mr)) {
      mapByMr.set(mr, {
        ...item,
        mr_no: rawMr,
        arrival_date: item.payment_date || item.date || item.created_at,
        is_inspected: true,
        status: item.status || 'Paid',
        inspection_source: 'payment'
      });
    } else {
      const existing = mapByMr.get(mr);
      mapByMr.set(mr, {
        ...existing,
        is_inspected: true,
        payment_date: item.payment_date || item.date || existing.payment_date,
        paid_amount: item.paid_amount || item.payable_amt || existing.paid_amount
      });
    }
  });

  paymentDetails.forEach((item, idx) => {
    const rawMr = item.mr_no || item.arrival_no || `PD-${idx}`;
    const mr = normalizePoRef(rawMr);
    if (!mr) return;
    if (!mapByMr.has(mr)) {
      mapByMr.set(mr, {
        ...item,
        mr_no: rawMr,
        arrival_date: item.created_at || item.bill_date || item.date,
        is_inspected: true,
        status: 'Paid',
        inspection_source: 'payment'
      });
    }
  });

  // 6. Ensure all MRs with Premium from Payment Section exist in mapByMr
  paymentMrPremiumMap.forEach((entry, cleanMr) => {
    if (!mapByMr.has(cleanMr)) {
      mapByMr.set(cleanMr, {
        id: `pay-prem-${cleanMr}`,
        mr_no: entry.mrNo,
        arrival_date: entry.date,
        supplier_name: entry.supplier,
        broker_name: entry.broker,
        jute_grade: entry.juteGrade,
        quantity_qtl: entry.weightQtl,
        weight_mt: Number((entry.weightQtl / 10).toFixed(3)),
        premium: entry.rate > 0 ? `₹${entry.rate}/Qtl` : 'Yes',
        is_premium: true,
        premium_rate: entry.rate,
        summary_premium_amount: entry.amount,
        is_inspected: true,
        status: 'Paid',
        inspection_source: 'payment'
      });
    }
  });

  const parsedInspections: InspectionRecord[] = [];
  const yearsSet = new Set<number>();

  mapByMr.forEach((raw, cleanMr) => {
    // Column Name from Screenshot 3: "Arrival Date"
    const dateStr = raw.arrival_date || raw.date || raw.inspection_date || raw.mr_date || raw.unloading_date || raw.created_at || '';
    const { year, month: monthIndex, isValid } = parseRecordDate(dateStr);
    if (isValid && year > 0) {
      yearsSet.add(year);
    }

    const poRaw = raw.po_no || raw.mill_po_no || raw.contract_no || raw.sauda_no || '';
    const cleanPo = normalizePoRef(poRaw);

    // Detail rows for this MR if any
    const relatedDetailsRaw = detailRowsByMr.get(cleanMr) || raw.grid_details || raw.details || [];
    //const relatedDetails = detailRowsByMr.get(cleanMr) || raw.grid_details || raw.details || [];
    const relatedDetails = Array.isArray(relatedDetailsRaw) ? relatedDetailsRaw : [];
    // Robust Weight Calculation in MT & Qtl
    let wtMt = 0;
    if (relatedDetails.length > 0) {
      const sumGross = relatedDetails.reduce((acc, d) => acc + (Number(d.receipt_gross_wt ?? d.challan_gross_wt ?? d.weight ?? d.quantity ?? 0)), 0);
      if (sumGross > 0) {
        wtMt = sumGross > 100 ? sumGross / 1000 : (sumGross > 50 ? sumGross / 10 : sumGross);
      }
    }
    if (wtMt === 0) {
      const rawGross = Number(raw.challan_gross_wt || raw.receipt_gross_wt || raw.total_actual_weight || raw.weight_mt || 0);
      if (rawGross > 0) {
        wtMt = rawGross > 100 ? rawGross / 1000 : (rawGross > 50 ? rawGross / 10 : rawGross);
      }
    }
    if (wtMt === 0) {
      const rawNet = Number(raw.electronic_net_weight || raw.supplier_net_weight || raw.challan_material_weight || raw.weight_qtl || raw.weight || 0);
      if (rawNet > 0) {
        wtMt = rawNet > 50 ? (rawNet / 10) : rawNet;
      }
    }
    let wtQtl = wtMt * 10;

    // 1. Moisture % & Claim (read accurately from INSPECTION MODULE REGISTER)
    let actualM = 0;
    if (raw.actual_moisture !== undefined && raw.actual_moisture !== null && raw.actual_moisture !== '') {
      actualM = Number(raw.actual_moisture);
    } else if (raw.moisture_act !== undefined && raw.moisture_act !== null && raw.moisture_act !== '') {
      actualM = Number(raw.moisture_act);
    } else if (raw.moisture_percent !== undefined && raw.moisture_percent !== null) {
      actualM = Number(raw.moisture_percent);
    } else if (raw.moisture !== undefined && raw.moisture !== null) {
      actualM = Number(raw.moisture);
    } else if (relatedDetails.length > 0 && relatedDetails[0].actual_moisture !== undefined) {
      actualM = Number(relatedDetails[0].actual_moisture);
    }
    if (isNaN(actualM)) actualM = 0;

    let claimM = 0;
    if (raw.claim_moisture !== undefined && raw.claim_moisture !== null && raw.claim_moisture !== '') {
      claimM = Number(raw.claim_moisture);
    } else if (raw.moisture_claim !== undefined && raw.moisture_claim !== null && raw.moisture_claim !== '') {
      claimM = Number(raw.moisture_claim);
    } else if (raw.claim_percent !== undefined && raw.claim_percent !== null) {
      claimM = Number(raw.claim_percent);
    } else if (relatedDetails.length > 0 && relatedDetails[0].claim_moisture !== undefined) {
      claimM = Number(relatedDetails[0].claim_moisture);
    }
    if (isNaN(claimM)) claimM = 0;
    if (claimM <= 0 && actualM > 15.0) {
      claimM = Number((actualM - 15.0).toFixed(1));
    }
    const moistDedAmt = Number(raw.moisture_claim_amt || raw.moisture_deduction_amount || (claimM > 0 ? (claimM * 50) : 0));

    // 2. Dust % & Claim (read accurately from INSPECTION MODULE REGISTER)
    let actualDust = 0;
    if (raw.actual_dust !== undefined && raw.actual_dust !== null && raw.actual_dust !== '') {
      actualDust = Number(raw.actual_dust);
    } else if (raw.dust_act !== undefined && raw.dust_act !== null && raw.dust_act !== '') {
      actualDust = Number(raw.dust_act);
    } else if (raw.dust_percent !== undefined && raw.dust_percent !== null) {
      actualDust = Number(raw.dust_percent);
    } else if (raw.dust !== undefined && raw.dust !== null) {
      actualDust = Number(raw.dust);
    } else if (relatedDetails.length > 0 && relatedDetails[0].actual_dust !== undefined) {
      actualDust = Number(relatedDetails[0].actual_dust);
    }
    if (isNaN(actualDust)) actualDust = 0;

    let claimDust = 0;
    if (raw.claim_dust !== undefined && raw.claim_dust !== null && raw.claim_dust !== '') {
      claimDust = Number(raw.claim_dust);
    } else if (raw.dust_claim !== undefined && raw.dust_claim !== null && raw.dust_claim !== '') {
      claimDust = Number(raw.dust_claim);
    } else if (relatedDetails.length > 0 && relatedDetails[0].claim_dust !== undefined) {
      claimDust = Number(relatedDetails[0].claim_dust);
    }
    if (isNaN(claimDust)) claimDust = 0;
    if (claimDust <= 0 && actualDust > 1.0) {
      claimDust = Number((actualDust - 1.0).toFixed(1));
    }
    const dustDedAmt = Number(raw.dust_claim_amt || raw.dust_deduction_amount || (claimDust > 0 ? (claimDust * 40) : 0));

    // 3. Grade Down % & Claim (read accurately from INSPECTION MODULE REGISTER)
    let actualGradeDown = 0;
    if (raw.actual_grade_down !== undefined && raw.actual_grade_down !== null && raw.actual_grade_down !== '') {
      actualGradeDown = Number(raw.actual_grade_down);
    } else if (raw.grade_down_act !== undefined && raw.grade_down_act !== null && raw.grade_down_act !== '') {
      actualGradeDown = Number(raw.grade_down_act);
    } else if (raw.grade_down_percent !== undefined && raw.grade_down_percent !== null) {
      actualGradeDown = Number(raw.grade_down_percent);
    } else if (raw.grade_down !== undefined && raw.grade_down !== null) {
      actualGradeDown = Number(raw.grade_down);
    }

    if (actualGradeDown === 0 && raw.quality_matrix?.grade_down) {
      const qm = raw.quality_matrix.grade_down;
      for (const k of ['1st', '2nd', '3rd', '4th', 'col1', 'col2', 'col3', 'col4']) {
        const val = Number(qm[k]?.dept ?? qm[k]?.actual ?? 0);
        if (val > 0) {
          actualGradeDown = val;
          break;
        }
      }
    }

    if (actualGradeDown === 0 && relatedDetails.length > 0) {
      for (const d of relatedDetails) {
        const val = Number(d.actual_grade_down ?? d.grade_down_act ?? d.grade_down ?? 0);
        if (val > 0) {
          actualGradeDown = val;
          break;
        }
      }
    }
    if (isNaN(actualGradeDown)) actualGradeDown = 0;

    let claimGradeDown = 0;
    if (raw.claim_grade_down !== undefined && raw.claim_grade_down !== null && raw.claim_grade_down !== '') {
      claimGradeDown = Number(raw.claim_grade_down);
    } else if (raw.grade_down_claim !== undefined && raw.grade_down_claim !== null && raw.grade_down_claim !== '') {
      claimGradeDown = Number(raw.grade_down_claim);
    }

    if (claimGradeDown === 0 && raw.quality_matrix?.grade_down) {
      const qm = raw.quality_matrix.grade_down;
      for (const k of ['1st', '2nd', '3rd', '4th', 'col1', 'col2', 'col3', 'col4']) {
        const val = Number(qm[k]?.claim ?? 0);
        if (val > 0) {
          claimGradeDown = val;
          break;
        }
      }
    }

    if (claimGradeDown === 0 && relatedDetails.length > 0) {
      for (const d of relatedDetails) {
        const val = Number(d.claim_grade_down ?? d.grade_down_claim ?? 0);
        if (val > 0) {
          claimGradeDown = val;
          break;
        }
      }
    }
    if (isNaN(claimGradeDown)) claimGradeDown = 0;
    if (claimGradeDown <= 0 && actualGradeDown > 0) {
      claimGradeDown = actualGradeDown;
    }
    const gradeDownDedAmt = Number(raw.grade_down_claim_amt || raw.grade_deduction_amount || raw.quality_deduction_amount || (claimGradeDown > 0 ? (claimGradeDown * 60) : 0));

    // 4. Chotta & Habi Jabi
    let chottaKg = Number(raw.chotta_weight || raw.chotta_wt || 0);
    let habijabiKg = Number(raw.ropes_weight || raw.habijabi_weight || raw.hb_weight || 0);
    let chottaGrade = String(raw.chotta_grade || 'CHOTTA').trim();
    let habijabiGrade = String(raw.ropes_grade || raw.habijabi_grade || 'HABIJABI').trim();
    
    if (relatedDetails.length > 0) {
      relatedDetails.forEach((d: any) => {
        chottaKg += Number(d.chotta_weight || 0);
        habijabiKg += Number(d.ropes_weight || d.habijabi_weight || 0);
        if (d.chotta_grade) chottaGrade = d.chotta_grade;
        if (d.ropes_grade || d.habijabi_grade) habijabiGrade = d.ropes_grade || d.habijabi_grade;
      });
    }
    const totChottaHabijabiKg = chottaKg + habijabiKg;
    const chottaHabijabiDedAmt = Number(raw.chotta_deduction_amount || raw.ropes_deduction_amount || (totChottaHabijabiKg > 0 ? Number(((totChottaHabijabiKg / 100) * 1500).toFixed(2)) : 0));

    // 5. Premium: Highest priority from Payment Operations (Premium ₹/Qtl * Weight MT) / Sauda Check Point
    let premiumData = premiumMap.get(cleanMr) || premiumMap.get(cleanPo) || { premium: "No", isPremium: false, rate: 0, amount: 0, source: "Payment Operations / SCP" };
    
    // Explicit priority from Payment Section MR Premium index
    const payPrem = paymentMrPremiumMap.get(cleanMr);
    if (payPrem && (payPrem.amount > 0 || payPrem.rate > 0)) {
      premiumData = {
        premium: payPrem.rate > 0 ? `₹${payPrem.rate}/Qtl` : (payPrem.amount > 0 ? `₹${payPrem.amount}` : "Yes"),
        isPremium: true,
        rate: payPrem.rate,
        amount: payPrem.amount,
        source: "Payment Section"
      };
      if (payPrem.weightQtl > 0 && wtQtl === 0) {
        wtQtl = payPrem.weightQtl;
        wtMt = Number((payPrem.weightQtl / 10).toFixed(3));
      }
    }
    
    // Check if raw inspection itself or related details have premium
    if (!premiumData.isPremium) {
      if (raw.premium && String(raw.premium).trim() !== "" && String(raw.premium).trim() !== "0" && String(raw.premium).trim().toLowerCase() !== "no") {
        const num = parseFloat(String(raw.premium).replace(/[^0-9.]/g, ''));
        const premRate = !isNaN(num) && num > 0 ? num : 0;
        premiumData = {
          premium: String(raw.premium),
          isPremium: true,
          rate: premRate,
          amount: premRate > 0 ? Number((premRate * (wtQtl > 0 ? wtQtl : (wtMt * 10))).toFixed(2)) : 0,
          source: "Inspection / Payment"
        };
      } else if (relatedDetails.some((d: any) => Number(d.premium || 0) > 0 || d.is_premium === true)) {
        const dPrem = relatedDetails.find((d: any) => Number(d.premium || 0) > 0 || d.is_premium === true);
        const premRate = Number(dPrem?.premium || 0);
        premiumData = {
          premium: premRate > 0 ? `₹${premRate}/Qtl` : "Yes",
          isPremium: true,
          rate: premRate,
          amount: premRate > 0 ? Number((premRate * (wtQtl > 0 ? wtQtl : (wtMt * 10))).toFixed(2)) : 0,
          source: "Inspection Details"
        };
      }
    }

    // Deduction amounts
    const delivDedAmt = Number(raw.delivery_claim_amount || raw.delivery_claim || 0);
    const baleDedAmt = Number(raw.bale_weight_deduction_amount || 0);
    const otherDedAmt = Number(raw.other_deduction_amount || 0);
    
    let totalClaim = Number(raw.summary_deduction_amount || raw.total_deduction_amt || raw.claim_amount || raw.deduction_amount || 0);
    if (totalClaim <= 0) {
      totalClaim = moistDedAmt + dustDedAmt + gradeDownDedAmt + chottaHabijabiDedAmt + delivDedAmt + baleDedAmt + otherDedAmt;
    }

    const supplier = String(raw.supplier_name || raw.supplier || raw.vyapari_name || 'DIRECT SUPPLIER').trim();
    const broker = String(raw.broker_name || raw.broker || 'DIRECT').trim();
    const vehicle = String(raw.lorry_number || raw.vehicle_no || raw.truck_no || 'WB-00-1234').trim();
    const grade = String(raw.jute_grade || raw.grade || raw.stock_grade_name || (relatedDetails[0]?.stock_grade_code) || 'TD-4').trim().toUpperCase();
    const remarks = String(raw.remarks || raw.mr_spcl_print || '').trim();

    parsedInspections.push({
      id: raw.id || `insp-rec-${cleanMr}`,
      mrNo: raw.mr_no || raw.amad_no || raw.challan_no || cleanMr,
      cleanMrNo: cleanMr,
      poNo: poRaw || '---',
      cleanPoNo: cleanPo,
      date: dateStr ? new Date(dateStr).toLocaleDateString('en-IN') : '2026-09-24',
      year,
      month: monthIndex,
      monthName: MONTH_NAMES[monthIndex] || `Month ${monthIndex + 1}`,
      supplier,
      broker,
      vehicleNo: vehicle,
      juteGrade: grade,
      weightQtl: Number(wtQtl.toFixed(2)),
      weightMt: Number(wtMt.toFixed(3)),
      
      // 1. Moisture
      actualMoisture: Number(actualM.toFixed(1)),
      claimMoisture: Number(claimM.toFixed(1)),
      moistureDeductionAmount: moistDedAmt,
      
      // 2. Dust
      actualDust: Number(actualDust.toFixed(1)),
      claimDust: Number(claimDust.toFixed(1)),
      dustDeductionAmount: dustDedAmt,
      
      // 3. Grade Down
      actualGradeDown: Number(actualGradeDown.toFixed(1)),
      claimGradeDown: Number(claimGradeDown.toFixed(1)),
      gradeDownDeductionAmount: gradeDownDedAmt,
      
      // 4. Chotta & Habi Jabi
      chottaWeightKg: Number(chottaKg.toFixed(1)),
      habijabiWeightKg: Number(habijabiKg.toFixed(1)),
      totalChottaHabijabiKg: Number(totChottaHabijabiKg.toFixed(1)),
      chottaHabijabiDeductionAmount: chottaHabijabiDedAmt,
      chottaGrade,
      habijabiGrade,
      
      // 5. Premium from Payment Operations / Sauda Check Point
      premium: premiumData.premium,
      isPremium: premiumData.isPremium && (premiumData.rate > 0 || premiumData.amount > 0 || /yes|true/i.test(premiumData.premium)),
      premiumRate: premiumData.rate,
      premiumAmount: premiumData.amount > 0 ? premiumData.amount : (premiumData.rate > 0 ? Number((premiumData.rate * (wtQtl > 0 ? wtQtl : (wtMt * 10))).toFixed(2)) : 0),
      premiumSource: premiumData.source,
      
      qualityDeductionAmount: gradeDownDedAmt + dustDedAmt,
      deliveryClaimAmount: delivDedAmt,
      baleWeightDeductionAmount: baleDedAmt,
      otherDeductionAmount: otherDedAmt,
      totalClaimAmount: Number(totalClaim.toFixed(2)),
      status: raw.status || 'Audited',
      remarks,
      rawRecord: raw
    });
  });

  // Pre-populate available years from arrivals, finalArrivals, payments, and settlements
  arrivals.forEach(a => {
    const rawDate = a.date || a.temporary_arrival_date || a.amad_date || a.created_at;
    if (rawDate) {
      const { year: aYear, isValid } = parseRecordDate(rawDate);
      if (isValid && aYear > 0) yearsSet.add(aYear);
    }
  });

  finalArrivals.forEach(fa => {
    const rawDate = fa.final_arrival_date || fa.date || fa.arrival_date || fa.created_at;
    if (rawDate) {
      const { year: fYear, isValid } = parseRecordDate(rawDate);
      if (isValid && fYear > 0) yearsSet.add(fYear);
    }
  });

  paymentRecords.forEach(p => {
    const rawDate = p.date || p.payment_date || p.created_at;
    if (rawDate) {
      const { year: pYear, isValid } = parseRecordDate(rawDate);
      if (isValid && pYear > 0) yearsSet.add(pYear);
    }
  });

  settlements.forEach(s => {
    const rawDate = s.audit_date || s.sett_date || s.date || s.bill_date || s.created_at;
    if (rawDate) {
      const { year: sYear, isValid } = parseRecordDate(rawDate);
      if (isValid && sYear > 0) yearsSet.add(sYear);
    }
  });

  const availableYears = Array.from(yearsSet).sort((a, b) => b - a);
  if (availableYears.length === 0) availableYears.push(2026);
  const activeYear = selectedYear && yearsSet.has(selectedYear) ? selectedYear : availableYears[0];

  // 1. Index Temporary Arrivals for activeYear by month
  const arrivalsByMonth = new Map<number, any[]>();
  // 2. Index Final Arrivals for activeYear by month & build final lookup set
  const finalArrivalsByMonth = new Map<number, any[]>();
  const finalArrivalsSet = new Set<string>();
  // 3. Index payments for activeYear by month
  const paymentsByMonth = new Map<number, any[]>();
  // 4. Index settlements for activeYear by month
  const settlementsByMonth = new Map<number, any[]>();

  for (let m = 0; m < 12; m++) {
    arrivalsByMonth.set(m, []);
    finalArrivalsByMonth.set(m, []);
    paymentsByMonth.set(m, []);
    settlementsByMonth.set(m, []);
  }

  // Populate Temporary Arrivals
  let yearTotalArrivalsBales = 0;
  let yearTotalArrivalsWeightMt = 0;
  const yearArrivals: any[] = [];
  arrivals.forEach(a => {
    const rawDate = a.date || a.temporary_arrival_date || a.amad_date || a.created_at;
    const { year: aYear, month: aMonth, isValid } = parseRecordDate(rawDate);
    if (isValid && aYear === activeYear && aMonth >= 0 && aMonth < 12) {
      arrivalsByMonth.get(aMonth)?.push(a);
      yearArrivals.push(a);
      yearTotalArrivalsBales += getRecordBales(a);
      yearTotalArrivalsWeightMt += getRecordNetWeightMt(a);
    }
  });

  // Populate Final Arrivals and global Final Arrival set
  let yearTotalFinalArrivalsCount = 0;
  let yearTotalFinalBales = 0;
  let yearTotalFinalWeightMt = 0;
  finalArrivals.forEach((fa, idx) => {
    const rawNo = fa.final_arrival_no || fa.arrival_no || fa.temporary_arrival_no || fa.mr_no || fa.amad_no || `FA-${idx}`;
    const cleanNo = normalizePoRef(rawNo);
    if (cleanNo) {
      finalArrivalsSet.add(cleanNo);
      finalArrivalsSet.add(cleanNo.replace(/[\s\-_]/g, ''));
    }
    if (fa.temporary_arrival_no) {
      finalArrivalsSet.add(normalizePoRef(fa.temporary_arrival_no));
      finalArrivalsSet.add(String(fa.temporary_arrival_no).toUpperCase().replace(/[\s\-_]/g, ''));
    }
    if (fa.mr_no) {
      finalArrivalsSet.add(normalizePoRef(fa.mr_no));
      finalArrivalsSet.add(String(fa.mr_no).toUpperCase().replace(/[\s\-_]/g, ''));
    }
    if (fa.arrival_no) {
      finalArrivalsSet.add(normalizePoRef(fa.arrival_no));
      finalArrivalsSet.add(String(fa.arrival_no).toUpperCase().replace(/[\s\-_]/g, ''));
    }
    if (fa.final_arrival_no) {
      finalArrivalsSet.add(normalizePoRef(fa.final_arrival_no));
      finalArrivalsSet.add(String(fa.final_arrival_no).toUpperCase().replace(/[\s\-_]/g, ''));
    }

    const rawDate = fa.final_arrival_date || fa.date || fa.arrival_date || fa.created_at;
    const { year: fYear, month: fMonth, isValid } = parseRecordDate(rawDate);
    if (isValid && fYear === activeYear && fMonth >= 0 && fMonth < 12) {
      finalArrivalsByMonth.get(fMonth)?.push(fa);
      yearTotalFinalArrivalsCount++;
      yearTotalFinalBales += getRecordBales(fa);
      yearTotalFinalWeightMt += getRecordNetWeightMt(fa);
    }
  });

  // Assign payments by payment Date
  let totalYearPayments = 0;
  let totalYearPaidAmount = 0;
  paymentRecords.forEach(p => {
    const rawDate = p.date || p.payment_date || p.created_at;
    const { year: pYear, month: pMonth, isValid } = parseRecordDate(rawDate);
    
    if (isValid && pYear === activeYear && pMonth >= 0 && pMonth < 12) {
      totalYearPayments++;
      totalYearPaidAmount += Number(p.paid_amount || 0);
      paymentsByMonth.get(pMonth)?.push(p);
    }
  });

  // Assign settlements by Audit Date
  let totalYearSettlements = 0;
  let totalYearSettledAmount = 0;
  settlements.forEach(s => {
    const rawDate = s.audit_date || s.sett_date || s.date || s.bill_date || s.created_at;
    const { year: sYear, month: sMonth, isValid } = parseRecordDate(rawDate);

    if (isValid && sYear === activeYear && sMonth >= 0 && sMonth < 12) {
      totalYearSettlements++;
      totalYearSettledAmount += Number(s.net_payable_amount || s.amount || s.total_value || 0);
      settlementsByMonth.get(sMonth)?.push(s);
    }
  });

  const yearInspections = parsedInspections.filter(r => r.year === activeYear);

  // Group by Month (0 to 11)
  const monthInspectionSummaries: MonthInspectionSummary[] = Array.from({ length: 12 }, (_, mIdx) => {
    const list = yearInspections.filter(r => r.month === mIdx);
    const monthArrivals = arrivalsByMonth.get(mIdx) || [];
    const monthFinalArrivals = finalArrivalsByMonth.get(mIdx) || [];
    const monthPayments = paymentsByMonth.get(mIdx) || [];
    const monthSettlements = settlementsByMonth.get(mIdx) || [];

    const temporaryArrivalsCount = monthArrivals.length > 0 ? monthArrivals.length : list.length;
    const temporaryArrivalsBales = monthArrivals.reduce((sum, a) => sum + getRecordBales(a), 0);
    const temporaryArrivalsWeightMt = monthArrivals.reduce((sum, a) => sum + getRecordNetWeightMt(a), 0);

    const finalArrivalsCount = monthFinalArrivals.length;
    const finalArrivalsBales = monthFinalArrivals.reduce((sum, f) => sum + getRecordBales(f), 0);
    const finalArrivalsWeightMt = monthFinalArrivals.reduce((sum, f) => sum + getRecordNetWeightMt(f), 0);
    const pendingFmrCount = monthArrivals.filter(a => {
      const k = normalizePoRef(a.temporary_arrival_no || a.amad_no || a.mr_no || a.arrival_no || a.amad_id);
      return !k || !finalArrivalsSet.has(k);
    }).length;

    const completedInspections = list.filter(r => r.status !== 'Pending' && r.rawRecord?.is_inspected);
    const inspectionCount = completedInspections.length;
    const pendingInspectionCount = Math.max(0, temporaryArrivalsCount - inspectionCount);

    if (temporaryArrivalsCount === 0 && finalArrivalsCount === 0 && inspectionCount === 0 && monthPayments.length === 0 && monthSettlements.length === 0) {
      return null;
    }

    let totWt = 0;
    let moistSum = 0;
    let claimMoistSum = 0;
    let dustSum = 0;
    let claimDustSum = 0;
    let gradeDownSum = 0;
    let claimGradeDownSum = 0;
    let totChottaHbKg = 0;
    let totChottaHbClaim = 0;
    let totClaim = 0;
    let moistClaimLots = 0;
    let qualClaimLots = 0;

    const qualitySourceList = completedInspections;

    // Direct aggregation of MRs with Premium from unified engine
    const monthPrem = filterAggregatedPremiums(unifiedPremiums, activeYear, mIdx);
    const premLots = monthPrem.count;
    const premSum = monthPrem.sum;
    const premRateTotal = monthPrem.mrs.reduce((acc, m) => acc + m.avgPremiumRatePerQtl, 0);
    const premQtlTotal = monthPrem.mrs.reduce((acc, m) => acc + m.totalQuantityQtl, 0);

    qualitySourceList.forEach(r => {
      totWt += r.weightMt;
      moistSum += r.actualMoisture;
      claimMoistSum += r.claimMoisture;
      dustSum += r.actualDust;
      claimDustSum += r.claimDust;
      gradeDownSum += r.actualGradeDown;
      claimGradeDownSum += r.claimGradeDown;
      totChottaHbKg += r.totalChottaHabijabiKg;
      totChottaHbClaim += r.chottaHabijabiDeductionAmount;
      totClaim += r.totalClaimAmount;
      if (r.claimMoisture > 0 || r.moistureDeductionAmount > 0) moistClaimLots++;
      if (r.qualityDeductionAmount > 0 || r.claimGradeDown > 0 || r.claimDust > 0) qualClaimLots++;
    });

    const moistCount = qualitySourceList.filter(r => r.actualMoisture > 0).length;
    const claimMoistCount = qualitySourceList.filter(r => r.claimMoisture > 0).length;
    const dustCount = qualitySourceList.filter(r => r.actualDust > 0).length;
    const claimDustCount = qualitySourceList.filter(r => r.claimDust > 0).length;
    const gradeDownCount = qualitySourceList.filter(r => r.actualGradeDown > 0).length;
    const claimGradeDownCount = qualitySourceList.filter(r => r.claimGradeDown > 0).length;

    const avgMoisture = moistCount > 0 ? Number((moistSum / moistCount).toFixed(1)) : 0;
    const avgClaimMoisture = claimMoistCount > 0 ? Number((claimMoistSum / claimMoistCount).toFixed(1)) : 0;
    const avgDust = dustCount > 0 ? Number((dustSum / dustCount).toFixed(1)) : 0;
    const avgClaimDust = claimDustCount > 0 ? Number((claimDustSum / claimDustCount).toFixed(1)) : 0;
    const avgGradeDown = gradeDownCount > 0 ? Number((gradeDownSum / gradeDownCount).toFixed(1)) : 0;
    const avgClaimGradeDown = claimGradeDownCount > 0 ? Number((claimGradeDownSum / claimGradeDownCount).toFixed(1)) : 0;

    const matCount = completedInspections.filter(r => r.rawRecord?.inspection_source === 'material').length;
    const millCount = completedInspections.filter(r => r.rawRecord?.inspection_source === 'mill' || r.rawRecord?.is_mill || Boolean(r.rawRecord?.mill_code) || r.rawRecord?.source === 'mill').length;

    const paymentPaidAmount = monthPayments.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
    const paymentPayableAmount = monthPayments.reduce((sum, p) => sum + Number(p.payable_amt || p.total_amount || 0), 0);
    const settlementAmount = monthSettlements.reduce((sum, s) => sum + Number(s.net_payable_amount || s.amount || s.total_value || 0), 0);

    // 1. Pipeline: MR -> Final MR (Pending FMR)
    const pendingFmrList: PendingStageRecord[] = monthArrivals.filter(a => {
      const rawMr = a.temporary_arrival_no || a.amad_no || a.mr_no || a.arrival_no || a.amad_id;
      const k1 = normalizePoRef(rawMr);
      const k2 = String(rawMr || '').toUpperCase().replace(/[\s\-_]/g, '');
      const isCompleted = (k1 && finalArrivalsSet.has(k1)) || (k2 && finalArrivalsSet.has(k2)) || (a.final_arrival_no && String(a.final_arrival_no).trim() !== '') || Boolean(a.is_final_arrival_done);
      return !isCompleted;
    }).map((a, idx) => {
      const rawMr = a.temporary_arrival_no || a.amad_no || a.mr_no || a.arrival_no || a.amad_id || `ARR-${idx}`;
      const rawPo = a.po_no || a.mill_po_no || a.contract_no || a.sauda_no || '';
      const wtMt = getRecordNetWeightMt(a);
      const bales = getRecordBales(a);
      return {
        id: a.id || `pending-fmr-${mIdx}-${idx}-${rawMr}`,
        stage: 'MR_TO_FMR',
        stageLabel: 'MR ➔ Final MR (Below FMR)',
        stageCode: 'MR ➔ FMR',
        poNo: rawPo || 'N/A',
        cleanPoNo: normalizePoRef(rawPo),
        mrNo: rawMr,
        arrivalNo: a.arrival_no || a.temporary_arrival_no || rawMr,
        date: a.date || a.temporary_arrival_date || a.amad_date || a.created_at || '',
        supplier: a.supplier_name || a.supplier || a.challan_supplier || a.party_name || 'N/A',
        broker: a.broker_name || a.broker || 'DIRECT',
        vehicleNo: a.lorry_number || a.vehicle_no || a.truck_no || 'N/A',
        bales,
        weightMt: Number(wtMt.toFixed(3)),
        weightQtl: Number((wtMt * 10).toFixed(2)),
        amount: Number(a.challan_value || a.amount || 0),
        status: 'Pending Final MR Entry',
        pendingAction: 'Complete Gate Inward Final M.R. (FMR)',
        rawRecord: a
      };
    });

    // 2. Pipeline: Final MR -> Mill Inspection (Pending Inspection)
    const inspectedMrSet = new Set(completedInspections.map(r => r.cleanMrNo).filter(Boolean));
    const pendingInspectionList: PendingStageRecord[] = monthFinalArrivals.filter(fa => {
      const rawNo = fa.final_arrival_no || fa.arrival_no || fa.temporary_arrival_no || fa.mr_no;
      const cleanNo = normalizePoRef(rawNo);
      return !cleanNo || !inspectedMrSet.has(cleanNo);
    }).map((fa, idx) => {
      const rawMr = fa.final_arrival_no || fa.arrival_no || fa.temporary_arrival_no || fa.mr_no || `FA-${idx}`;
      const rawPo = fa.po_no || fa.mill_po_no || fa.contract_no || '';
      const wtMt = getRecordNetWeightMt(fa);
      const bales = getRecordBales(fa);
      return {
        id: fa.id || `pending-insp-${mIdx}-${idx}-${rawMr}`,
        stage: 'FMR_TO_INSP',
        stageLabel: 'Final MR ➔ Mill Inspection',
        stageCode: 'FMR ➔ INSP',
        poNo: rawPo || 'N/A',
        cleanPoNo: normalizePoRef(rawPo),
        mrNo: rawMr,
        arrivalNo: fa.final_arrival_no || fa.arrival_no || rawMr,
        date: fa.final_arrival_date || fa.date || fa.arrival_date || fa.created_at || '',
        supplier: fa.supplier_name || fa.supplier || fa.challan_supplier || 'N/A',
        broker: fa.broker_name || fa.broker || 'DIRECT',
        vehicleNo: fa.lorry_number || fa.vehicle_no || 'N/A',
        bales,
        weightMt: Number(wtMt.toFixed(3)),
        weightQtl: Number((wtMt * 10).toFixed(2)),
        amount: Number(fa.challan_value || fa.value || 0),
        status: 'Pending Quality Lab Test',
        pendingAction: 'Complete Mill Quality Inspection Entry',
        rawRecord: fa
      };
    });

    // 3. Pipeline: Mill Inspection -> Payment (Pending Payment)
    const paymentMrSet = new Set(monthPayments.map(p => normalizePoRef(p.mr_no || p.arrival_no || p.final_arrival_no)).filter(Boolean));
    const paymentPoSet = new Set(monthPayments.map(p => normalizePoRef(p.po_no)).filter(Boolean));
    const pendingPaymentList: PendingStageRecord[] = completedInspections.filter(r => {
      const hasMrPay = r.cleanMrNo && paymentMrSet.has(r.cleanMrNo);
      const hasPoPay = r.cleanPoNo && paymentPoSet.has(r.cleanPoNo);
      return !hasMrPay && !hasPoPay;
    }).map((r, idx) => {
      return {
        id: r.id || `pending-paym-${mIdx}-${idx}-${r.mrNo}`,
        stage: 'INSP_TO_PAYM',
        stageLabel: 'Mill Inspection ➔ Payment',
        stageCode: 'INSP ➔ Paym',
        poNo: r.poNo || 'N/A',
        cleanPoNo: r.cleanPoNo,
        mrNo: r.mrNo,
        arrivalNo: r.mrNo,
        date: r.date,
        supplier: r.supplier || 'N/A',
        broker: r.broker || 'DIRECT',
        vehicleNo: r.vehicleNo || 'N/A',
        bales: getRecordBales(r.rawRecord),
        weightMt: Number(r.weightMt.toFixed(3)),
        weightQtl: Number(r.weightQtl.toFixed(2)),
        amount: Number(r.rawRecord?.payable_amt || r.rawRecord?.total_amount || 0),
        status: 'Pending Payment Voucher',
        pendingAction: 'Process On/Ac or Final Payment Voucher',
        rawRecord: r.rawRecord
      };
    });

    // 4. Pipeline: Payment -> Settlement (Pending Settlement)
    const settlementMrSet = new Set(monthSettlements.map(s => normalizePoRef(s.mr_no || s.arrival_no || s.final_arrival_no)).filter(Boolean));
    const settlementPoSet = new Set(monthSettlements.map(s => normalizePoRef(s.po_no)).filter(Boolean));
    const pendingSettlementList: PendingStageRecord[] = completedInspections.filter(r => {
      const hasMrSett = r.cleanMrNo && settlementMrSet.has(r.cleanMrNo);
      const hasPoSett = r.cleanPoNo && settlementPoSet.has(r.cleanPoNo);
      return !hasMrSett && !hasPoSett;
    }).map((r, idx) => {
      return {
        id: r.id || `pending-sett-${mIdx}-${idx}-${r.mrNo}`,
        stage: 'PAYM_TO_SETT',
        stageLabel: 'Payment ➔ Settlement',
        stageCode: 'Paym ➔ Sett',
        poNo: r.poNo || 'N/A',
        cleanPoNo: r.cleanPoNo,
        mrNo: r.mrNo,
        arrivalNo: r.mrNo,
        date: r.date,
        supplier: r.supplier || 'N/A',
        broker: r.broker || 'DIRECT',
        vehicleNo: r.vehicleNo || 'N/A',
        bales: getRecordBales(r.rawRecord),
        weightMt: Number(r.weightMt.toFixed(3)),
        weightQtl: Number(r.weightQtl.toFixed(2)),
        amount: Number(r.rawRecord?.payable_amt || r.rawRecord?.settlement_amount || 0),
        status: 'Pending Final MR Settlement',
        pendingAction: 'Complete Valuation & Final M.R. Settlement',
        rawRecord: r.rawRecord
      };
    });

    const allPendingPipelineList = [
      ...pendingFmrList,
      ...pendingInspectionList,
      ...pendingPaymentList,
      ...pendingSettlementList
    ];

    const pendingFmrPoCount = new Set(pendingFmrList.map(r => r.cleanPoNo).filter(Boolean)).size;
    const pendingInspectionPoCount = new Set(pendingInspectionList.map(r => r.cleanPoNo).filter(Boolean)).size;
    const pendingPaymentPoCount = new Set(pendingPaymentList.map(r => r.cleanPoNo).filter(Boolean)).size;
    const pendingSettlementPoCount = new Set(pendingSettlementList.map(r => r.cleanPoNo).filter(Boolean)).size;
    const totalPendingPoCount = new Set(allPendingPipelineList.map(r => r.cleanPoNo).filter(Boolean)).size;

    return {
      monthIndex: mIdx,
      monthName: MONTH_NAMES[mIdx] || `Month ${mIdx + 1}`,
      year: activeYear,
      totalInspections: temporaryArrivalsCount, // Displayed MR Count matches Temporary Arrival
      totalWeightMt: temporaryArrivalsWeightMt > 0 ? Number(temporaryArrivalsWeightMt.toFixed(2)) : Number(totWt.toFixed(2)),
      temporaryArrivalsCount,
      temporaryArrivalsBales,
      temporaryArrivalsWeightMt: Number(temporaryArrivalsWeightMt.toFixed(2)),
      finalArrivalsCount,
      finalArrivalsBales,
      finalArrivalsWeightMt: Number(finalArrivalsWeightMt.toFixed(2)),
      pendingFmrCount,
      inspectionCount,
      pendingInspectionCount,
      materialInspectionCount: matCount,
      millInspectionCount: millCount,
      paymentCount: monthPayments.length,
      paymentPaidAmount,
      paymentPayableAmount,
      settlementCount: monthSettlements.length,
      settlementAmount,
      pendingFmrList,
      pendingInspectionList,
      pendingPaymentList,
      pendingSettlementList,
      allPendingPipelineList,
      pendingFmrPoCount,
      pendingInspectionPoCount,
      pendingPaymentPoCount,
      pendingSettlementPoCount,
      totalPendingPoCount,
      avgMoisture,
      avgClaimMoisture,
      avgDust,
      avgClaimDust,
      avgGradeDown,
      avgClaimGradeDown,
      totalChottaHabijabiKg: Number(totChottaHbKg.toFixed(1)),
      totalChottaHabijabiClaim: Number(totChottaHbClaim.toFixed(2)),
      premiumLotsCount: premLots,
      premiumTotalSum: Number(premSum.toFixed(2)),
      avgPremiumRate: premLots > 0 
        ? (premRateTotal > 0 ? Number((premRateTotal / premLots).toFixed(2)) : (totWt > 0 ? Number((premSum / (totWt * 10)).toFixed(2)) : 0)) 
        : 0,
      totalClaimAmount: Number(totClaim.toFixed(2)),
      lotsWithMoistureClaim: moistClaimLots,
      lotsWithQualityClaim: qualClaimLots,
      inspections: list,
      payments: monthPayments,
      settlements: monthSettlements,
      temporaryArrivals: monthArrivals,
      finalArrivals: monthFinalArrivals
    };
  }).filter((m): m is MonthInspectionSummary => m !== null);

  const inspectedRecords = yearInspections.filter(r => r.status !== 'Pending' && r.rawRecord?.is_inspected);
  let totalInspectedWeightMt = 0;
  let totalMoistSum = 0;
  let totalClaimMoistSum = 0;
  let totalDustSum = 0;
  let totalClaimDustSum = 0;
  let totalGradeDownSum = 0;
  let totalClaimGradeDownSum = 0;
  let totalChottaHabijabiKg = 0;
  let totalClaimAmount = 0;

  const qualitySourceAll = inspectedRecords;

  // Direct aggregation of MRs with Premium for activeYear from Payment Section and Inspections
  const yearPremiumMrMap = new Map<string, { rate: number; amount: number; qtl: number }>();

  // 1. All Payment Section MRs with Premium for activeYear
  paymentMrPremiumMap.forEach(p => {
    if (p.year === activeYear && (p.amount > 0 || p.rate > 0)) {
      yearPremiumMrMap.set(p.cleanMr, {
        rate: p.rate,
        amount: p.amount,
        qtl: p.weightQtl
      });
    }
  });

  qualitySourceAll.forEach(r => {
    totalInspectedWeightMt += r.weightMt;
    totalMoistSum += r.actualMoisture;
    totalClaimMoistSum += r.claimMoisture;
    totalDustSum += r.actualDust;
    totalClaimDustSum += r.claimDust;
    totalGradeDownSum += r.actualGradeDown;
    totalClaimGradeDownSum += r.claimGradeDown;
    totalChottaHabijabiKg += r.totalChottaHabijabiKg;
    totalClaimAmount += r.totalClaimAmount;

  });

  const yearPrem = filterAggregatedPremiums(unifiedPremiums, activeYear, null);
  const totalPremiumLots = yearPrem.count;
  const totalPremiumSum = yearPrem.sum;
  const totalPremiumRateSum = yearPrem.mrs.reduce((acc, m) => acc + m.avgPremiumRatePerQtl, 0);
  const totalPremiumQtlSum = yearPrem.mrs.reduce((acc, m) => acc + m.totalQuantityQtl, 0);
  const avgPremiumRate = totalPremiumLots > 0 
    ? (totalPremiumQtlSum > 0 && totalPremiumSum > 0 ? Number((totalPremiumSum / totalPremiumQtlSum).toFixed(2)) : (totalPremiumRateSum > 0 ? Number((totalPremiumRateSum / totalPremiumLots).toFixed(2)) : 0)) 
    : 0;

  const yearMoistCount = qualitySourceAll.filter(r => r.actualMoisture > 0).length;
  const yearClaimMoistCount = qualitySourceAll.filter(r => r.claimMoisture > 0).length;
  const yearDustCount = qualitySourceAll.filter(r => r.actualDust > 0).length;
  const yearClaimDustCount = qualitySourceAll.filter(r => r.claimDust > 0).length;
  const yearGradeDownCount = qualitySourceAll.filter(r => r.actualGradeDown > 0).length;
  const yearClaimGradeDownCount = qualitySourceAll.filter(r => r.claimGradeDown > 0).length;

  const totalMaterialCount = qualitySourceAll.filter(r => r.rawRecord?.inspection_source === 'material' || (!r.rawRecord?.is_mill && !r.rawRecord?.mill_code && r.rawRecord?.source !== 'mill')).length;
  const totalMillCount = qualitySourceAll.filter(r => r.rawRecord?.inspection_source === 'mill' || r.rawRecord?.is_mill || Boolean(r.rawRecord?.mill_code) || r.rawRecord?.source === 'mill').length;

  const overallAvgMoisture = yearMoistCount > 0 ? Number((totalMoistSum / yearMoistCount).toFixed(1)) : 0;
  const overallAvgClaimMoisture = yearClaimMoistCount > 0 ? Number((totalClaimMoistSum / yearClaimMoistCount).toFixed(1)) : 0;
  const overallAvgDust = yearDustCount > 0 ? Number((totalDustSum / yearDustCount).toFixed(1)) : 0;
  const overallAvgClaimDust = yearClaimDustCount > 0 ? Number((totalClaimDustSum / yearClaimDustCount).toFixed(1)) : 0;
  const overallAvgGradeDown = yearGradeDownCount > 0 ? Number((totalGradeDownSum / yearGradeDownCount).toFixed(1)) : 0;
  const overallAvgClaimGradeDown = yearClaimGradeDownCount > 0 ? Number((totalClaimGradeDownSum / yearClaimGradeDownCount).toFixed(1)) : 0;

  const totalYearTemporaryArrivalsCount = yearArrivals.length > 0 ? yearArrivals.length : yearInspections.length;
  const totalYearPendingFmrCount = yearArrivals.filter(a => {
    const k = normalizePoRef(a.temporary_arrival_no || a.amad_no || a.mr_no || a.arrival_no || a.amad_id);
    return !k || !finalArrivalsSet.has(k);
  }).length;
  const totalPendingInspectionsCount = yearInspections.filter(r => r.status === 'Pending').length;

  const allYearPendingFmrList = monthInspectionSummaries.flatMap(m => m.pendingFmrList);
  const allYearPendingInspectionList = monthInspectionSummaries.flatMap(m => m.pendingInspectionList);
  const allYearPendingPaymentList = monthInspectionSummaries.flatMap(m => m.pendingPaymentList);
  const allYearPendingSettlementList = monthInspectionSummaries.flatMap(m => m.pendingSettlementList);
  const allYearPendingPipelineList = [
    ...allYearPendingFmrList,
    ...allYearPendingInspectionList,
    ...allYearPendingPaymentList,
    ...allYearPendingSettlementList
  ];

  const yearPendingFmrPoCount = new Set(allYearPendingFmrList.map(r => r.cleanPoNo).filter(Boolean)).size;
  const yearPendingInspectionPoCount = new Set(allYearPendingInspectionList.map(r => r.cleanPoNo).filter(Boolean)).size;
  const yearPendingPaymentPoCount = new Set(allYearPendingPaymentList.map(r => r.cleanPoNo).filter(Boolean)).size;
  const yearPendingSettlementPoCount = new Set(allYearPendingSettlementList.map(r => r.cleanPoNo).filter(Boolean)).size;
  const yearTotalPendingPoCount = new Set(allYearPendingPipelineList.map(r => r.cleanPoNo).filter(Boolean)).size;

  return {
    monthInspectionSummaries,
    allInspections: yearInspections,
    totalInspectionsCount: totalYearTemporaryArrivalsCount,
    totalInspectedWeightMt: yearTotalArrivalsWeightMt > 0 ? Number(yearTotalArrivalsWeightMt.toFixed(2)) : Number(totalInspectedWeightMt.toFixed(2)),
    totalYearTemporaryArrivalsCount,
    totalYearBales: yearTotalArrivalsBales,
    totalYearArrivalWeightMt: Number(yearTotalArrivalsWeightMt.toFixed(2)),
    totalYearFinalArrivalsCount: yearTotalFinalArrivalsCount,
    totalYearFinalArrivalsBales: yearTotalFinalBales,
    totalYearFinalArrivalsWeightMt: Number(yearTotalFinalWeightMt.toFixed(2)),
    totalYearPendingFmrCount,
    totalYearInspectionsCount: inspectedRecords.length > 0 ? inspectedRecords.length : totalMaterialCount + totalMillCount,
    totalMaterialInspectionsCount: totalMaterialCount,
    totalMillInspectionsCount: totalMillCount,
    totalPendingInspectionsCount,
    totalYearPaymentsCount: totalYearPayments,
    totalYearPaidAmount,
    totalYearSettlementsCount: totalYearSettlements,
    totalYearSettledAmount,
    allYearPendingFmrList,
    allYearPendingInspectionList,
    allYearPendingPaymentList,
    allYearPendingSettlementList,
    allYearPendingPipelineList,
    yearPendingFmrPoCount,
    yearPendingInspectionPoCount,
    yearPendingPaymentPoCount,
    yearPendingSettlementPoCount,
    yearTotalPendingPoCount,
    overallAvgMoisture,
    overallAvgClaimMoisture,
    overallAvgDust,
    overallAvgClaimDust,
    overallAvgGradeDown,
    overallAvgClaimGradeDown,
    totalChottaHabijabiKg: Number(totalChottaHabijabiKg.toFixed(1)),
    totalPremiumLots,
    totalPremiumSum: Number(totalPremiumSum.toFixed(2)),
    avgPremiumRate,
    totalClaimAmount: Number(totalClaimAmount.toFixed(2)),
    availableYears,
    selectedYear: activeYear
  };
}

/**
 * Normalizes PO / Contract / MR reference strings
 * Strips out prefixes like 'P.O:', 'PO:', 'M.R:', '#', whitespace and converts to uppercase
 */
export function normalizePoRef(raw: any): string {
  if (!raw) return '';
  const str = String(raw).trim();
  return str
    .replace(/^p\.?o\.?\s*[:\-]?\s*/i, '')
    .replace(/^m\.?r\.?\s*[:\-]?\s*/i, '')
    .replace(/^#/, '')
    .trim()
    .toUpperCase();
}

/**
 * Extract clean PO suffix (e.g. "0401" from "BJCL/2026-2027/0401" or "0153")
 */
export function getPoSuffix(poStr: string): string {
  if (!poStr) return '';
  const parts = poStr.split('/');
  return parts[parts.length - 1].trim();
}

/**
 * Robust date parser returning standard date object and parts
 */
export function parseRecordDate(rawDate: any): { dateObj: Date; dateStr: string; year: number; month: number; isValid: boolean } {
  const fallback = new Date();
  if (!rawDate) {
    return {
      dateObj: fallback,
      dateStr: '',
      year: 0,
      month: -1,
      isValid: false
    };
  }

  const str = String(rawDate).trim();
  if (!str) {
    return {
      dateObj: fallback,
      dateStr: '',
      year: 0,
      month: -1,
      isValid: false
    };
  }
  
  // Handle DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(str)) {
    const parts = str.split(/[-/]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return {
        dateObj: d,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        year,
        month,
        isValid: true
      };
    }
  }

  // Standard ISO or YYYY-MM-DD
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return {
      dateObj: parsed,
      dateStr: parsed.toISOString().slice(0, 10),
      year: parsed.getFullYear(),
      month: parsed.getMonth(),
      isValid: true
    };
  }

  return {
    dateObj: fallback,
    dateStr: '',
    year: 0,
    month: -1,
    isValid: false
  };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Calculates all unified dashboard metrics from live database datasets
 */
export function computeDashboardMetrics(params: {
  saudaCheckPoints?: any[];
  saudaCheckPointDetails?: any[];
  purchaseOrders?: any[]; // purchase_master
  purchaseOrderDetails?: any[]; // purchase_detail_master
  temporaryArrivals?: any[]; // temporary_material_received / amad
  finalArrivals?: any[]; // final_arrival
  paymentRecords?: any[]; // payment_master
  openingStocks?: any[];
  millIssueMasters?: any[];
  millIssueDetails?: any[];
  selectedYear?: number;
}): DashboardMetricsResult {
  const {
    saudaCheckPoints = [],
    saudaCheckPointDetails = [],
    purchaseOrders = [],
    purchaseOrderDetails = [],
    temporaryArrivals = [],
    finalArrivals = [],
    paymentRecords = [],
    openingStocks = [],
    millIssueMasters = [],
    millIssueDetails = [],
    selectedYear: requestedYear
  } = params;

  // 1. Build map of SCP details keyed by PO number
  const scpDetailsMap = new Map<string, any[]>();
  (saudaCheckPointDetails || []).forEach(d => {
    const k = normalizePoRef(d.po_no || d.contract_po_no || d.sauda_no);
    if (k) {
      if (!scpDetailsMap.has(k)) scpDetailsMap.set(k, []);
      scpDetailsMap.get(k)!.push(d);
    }
  });

  // 2. Build map of PO details keyed by PO number
  const poDetailsMap = new Map<string, any[]>();
  (purchaseOrderDetails || []).forEach(d => {
    const k = normalizePoRef(d.po_no || d.contract_po_no || d.ptf_no);
    if (k) {
      if (!poDetailsMap.has(k)) poDetailsMap.set(k, []);
      poDetailsMap.get(k)!.push(d);
    }
  });

  // 3. Aggregate Temporary Arrival Records by Contract / PO reference
  // Extract all received weights against each PO reference
  const arrivalsByPo = new Map<string, { totalReceivedMt: number; count: number; records: any[] }>();
  
  const registerArrival = (rawRef: any, arrivalRec: any) => {
    if (!rawRef) return;
    const ref = normalizePoRef(rawRef);
    if (!ref) return;
    
    // Weight calculation
    const wtMt = Number(
      arrivalRec.electronic_net_weight || 
      arrivalRec.supplier_net_weight || 
      arrivalRec.challan_material_weight || 
      arrivalRec.weight_reduced || 
      (arrivalRec.weight_qtl ? Number(arrivalRec.weight_qtl) / 10 : 0) || 
      arrivalRec.weight || 
      0
    );

    if (!arrivalsByPo.has(ref)) {
      arrivalsByPo.set(ref, { totalReceivedMt: 0, count: 0, records: [] });
    }
    const entry = arrivalsByPo.get(ref)!;
    entry.totalReceivedMt += wtMt;
    entry.count += 1;
    entry.records.push(arrivalRec);

    // Also index by suffix if long format (e.g. 0401)
    const suffix = getPoSuffix(ref);
    if (suffix && suffix !== ref && suffix.length >= 3) {
      if (!arrivalsByPo.has(suffix)) {
        arrivalsByPo.set(suffix, entry);
      }
    }
  };

  // Process Temporary Arrivals
  (temporaryArrivals || []).forEach(ar => {
    registerArrival(ar.po_no, ar);
    registerArrival(ar.contract_po_no, ar);
    registerArrival(ar.sauda_no, ar);
    registerArrival(ar.ptf_no, ar);
    registerArrival(ar.bill_challan_no, ar);
  });

  // Also include Final Arrival if not already counted
  (finalArrivals || []).forEach(fa => {
    registerArrival(fa.po_no, fa);
    registerArrival(fa.contract_po_no, fa);
    registerArrival(fa.sauda_no, fa);
    registerArrival(fa.ptf_no, fa);
  });

  // 4. Aggregate Payment Records from `payment_master`
  // Map payments by PO reference
  const paymentsByPo = new Map<string, { totalPayable: number; totalPaid: number; vouchers: string[]; records: any[] }>();
  
  (paymentRecords || []).forEach(pay => {
    const status = String(pay.status || '').toLowerCase().trim();
    if (status === 'cancelled' || status === 'rejected') return;

    // Extract potential PO references
    const refs: string[] = [];
    if (pay.po_no) refs.push(normalizePoRef(pay.po_no));
    if (pay.sauda_no) refs.push(normalizePoRef(pay.sauda_no));
    if (pay.reference_no) {
      const refClean = normalizePoRef(pay.reference_no);
      if (refClean) refs.push(refClean);
    }
    if (pay.mr_no) refs.push(normalizePoRef(pay.mr_no));

    const payableVal = Number(pay.payable_amt || pay.total_amount || pay.net_amt || pay.value_amt || 0);
    const paidVal = Number(pay.paid_amount || 0);
    const vNo = pay.voucher_no || pay.payment_id || '';

    refs.filter(Boolean).forEach(r => {
      if (!paymentsByPo.has(r)) {
        paymentsByPo.set(r, { totalPayable: 0, totalPaid: 0, vouchers: [], records: [] });
      }
      const pEntry = paymentsByPo.get(r)!;
      pEntry.totalPayable += payableVal;
      pEntry.totalPaid += paidVal;
      if (vNo && !pEntry.vouchers.includes(vNo)) {
        pEntry.vouchers.push(vNo);
      }
      pEntry.records.push(pay);

      const suffix = getPoSuffix(r);
      if (suffix && suffix !== r && suffix.length >= 3) {
        if (!paymentsByPo.has(suffix)) {
          paymentsByPo.set(suffix, pEntry);
        }
      }
    });
  });

  // 5. Unify all Contract records without double counting
  const unifiedContracts: UnifiedContractRecord[] = [];
  const processedContractKeys = new Set<string>();

  // A. Process Sauda Check Point Records
  (saudaCheckPoints || []).forEach(scp => {
    const rawNo = scp.po_no || scp.contract_po_no || scp.sauda_no || scp.session || `SCP-${scp.id}`;
    const cleanNo = normalizePoRef(rawNo);
    if (!cleanNo || processedContractKeys.has(cleanNo)) return;
    processedContractKeys.add(cleanNo);

    // Month & Date Rule: Use Contract Date from Sauda Check Point
    const rawDate = scp.contract_date || scp.date || scp.s_date || scp.b_date || scp.created_at;
    const { dateStr, year, month } = parseRecordDate(rawDate);

    // Calculate weight & value
    const details = scpDetailsMap.get(cleanNo) || [];
    let detWt = 0;
    let detVal = 0;
    let detUnits = 0;
    details.forEach(d => {
      const w = Number(d.weight_mt || 0);
      const q = Number(d.quantity || 0);
      const r = Number(d.rate_qntl || 0);
      detWt += w;
      detUnits += q;
      detVal += (w * 10 * r);
    });

    const totalWeightMt = detWt > 0 
      ? Number(detWt.toFixed(2)) 
      : Number((Number(scp.total_contract_mt || scp.total_wt_in_ton || scp.weight || 0)).toFixed(2));
    
    const baseRate = Number(scp.b_rate || scp.rate || (details[0]?.rate_qntl) || 5800);
    const contractVal = detVal > 0 
      ? Number(detVal.toFixed(2)) 
      : Number((totalWeightMt * 10 * (baseRate > 0 ? baseRate : 5800)).toFixed(2));

    const totalUnits = detUnits > 0 
      ? detUnits 
      : Number(scp.total_units || scp.total_unit || scp.units_per_lorry || Math.round(totalWeightMt * 10 * 0.55));

    // Determine type: Sauda or PTF
    const isPtf = Boolean(
      scp.is_ptf || 
      (scp.ptf_no && String(scp.ptf_no).trim() && String(scp.ptf_no).trim().toUpperCase() !== 'N/A') ||
      String(scp.po_type || '').toUpperCase() === 'PTF' ||
      cleanNo.startsWith('PTF') ||
      cleanNo.includes('(PTF)')
    );

    // Check Temporary Arrival for Pending Status
    const arrivalInfo = arrivalsByPo.get(cleanNo) || arrivalsByPo.get(getPoSuffix(cleanNo)) || { totalReceivedMt: 0, count: 0, records: [] };
    const rcvdWt = Number(arrivalInfo.totalReceivedMt.toFixed(2));
    
    let arrivalStatus: 'RECEIVED' | 'PENDING' | 'PARTIAL' = 'PENDING';
    let pendingWeightMt = totalWeightMt;

    if (arrivalInfo.count > 0 || rcvdWt > 0) {
      if (totalWeightMt > 0 && rcvdWt >= (totalWeightMt - 0.05)) {
        arrivalStatus = 'RECEIVED';
        pendingWeightMt = 0;
      } else {
        arrivalStatus = 'PARTIAL';
        pendingWeightMt = Math.max(0, Number((totalWeightMt - rcvdWt).toFixed(2)));
      }
    } else {
      arrivalStatus = 'PENDING';
      pendingWeightMt = totalWeightMt;
    }

    // Check Payment Information
    const payInfo = paymentsByPo.get(cleanNo) || paymentsByPo.get(getPoSuffix(cleanNo));
    const paidAmt = payInfo ? Number(payInfo.totalPaid.toFixed(2)) : 0;
    const payableVal = payInfo && payInfo.totalPayable > 0 ? Number(payInfo.totalPayable.toFixed(2)) : contractVal;
    const remainingAmt = Math.max(0, Number((payableVal - paidAmt).toFixed(2)));
    
    let paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERPAID' = 'PENDING';
    if (paidAmt >= payableVal && payableVal > 0) {
      paymentStatus = 'PAID';
    } else if (paidAmt > 0 && paidAmt < payableVal) {
      paymentStatus = 'PARTIALLY_PAID';
    } else if (paidAmt > payableVal && payableVal > 0) {
      paymentStatus = 'OVERPAID';
    } else {
      paymentStatus = 'PENDING';
    }

    unifiedContracts.push({
      id: scp.id || `SCP-${cleanNo}`,
      contractNo: rawNo,
      cleanContractNo: cleanNo,
      contractType: isPtf ? 'PTF' : 'SAUDA',
      contractDate: dateStr,
      year,
      month,
      monthName: MONTH_NAMES[month] || 'Unknown',
      supplier: String(scp.supplier || scp.supplier_name || scp.party_name || 'N/A').toUpperCase(),
      broker: String(scp.broker || scp.broker_name || 'N/A').toUpperCase(),
      area: scp.area || scp.area_name || '',
      purchaseUnit: scp.purchase_unit_name || scp.unit_type || 'BALES',
      totalUnits,
      totalWeightMt,
      ratePerQtl: baseRate,
      contractValue: contractVal,
      arrivalStatus,
      receivedWeightMt: rcvdWt,
      pendingWeightMt,
      arrivalRecordsCount: arrivalInfo.count,
      payableValue: payableVal,
      paidAmount: paidAmt,
      remainingAmount: remainingAmt,
      paymentStatus,
      voucherNos: payInfo ? payInfo.vouchers : [],
      rawRecord: scp
    });
  });

  // B. Process Final P.O. / P.T.F Records (`purchase_master`)
  (purchaseOrders || []).forEach(po => {
    const rawNo = po.po_no || po.ptf_no || po.contract_po_no || `PO-${po.id}`;
    const cleanNo = normalizePoRef(rawNo);
    if (!cleanNo || processedContractKeys.has(cleanNo)) return;
    processedContractKeys.add(cleanNo);

    // Month & Date Rule: Use P.O. Date from Final P.O.
    const rawDate = po.po_date || po.date || po.contract_date || po.created_at;
    const { dateStr, year, month } = parseRecordDate(rawDate);

    // Calculate weight & value
    const details = poDetailsMap.get(cleanNo) || [];
    let detWt = 0;
    let detVal = 0;
    let detUnits = 0;
    details.forEach(d => {
      const w = Number(d.weight_mt || 0);
      const q = Number(d.quantity || 0);
      const r = Number(d.rate_qntl || 0);
      detWt += w;
      detUnits += q;
      detVal += (w * 10 * r);
    });

    const totalWeightMt = detWt > 0 
      ? Number(detWt.toFixed(2)) 
      : Number((Number(po.total_contract_mt || po.weight || 0)).toFixed(2));
    
    const baseRate = Number(po.b_rate || po.rate || (details[0]?.rate_qntl) || 5800);
    const contractVal = detVal > 0 
      ? Number(detVal.toFixed(2)) 
      : Number((totalWeightMt * 10 * (baseRate > 0 ? baseRate : 5800)).toFixed(2));

    const totalUnits = detUnits > 0 
      ? detUnits 
      : Number(po.total_units || po.total_unit || po.units_per_lorry || Math.round(totalWeightMt * 10 * 0.55));

    const isPtf = Boolean(
      po.is_ptf || 
      (po.ptf_no && String(po.ptf_no).trim() && String(po.ptf_no).trim().toUpperCase() !== 'N/A') ||
      String(po.po_type || '').toUpperCase() === 'PTF' ||
      cleanNo.startsWith('PTF') ||
      cleanNo.includes('(PTF)')
    );

    // Check Temporary Arrival for Pending Status
    const arrivalInfo = arrivalsByPo.get(cleanNo) || arrivalsByPo.get(getPoSuffix(cleanNo)) || { totalReceivedMt: 0, count: 0, records: [] };
    const rcvdWt = Number(arrivalInfo.totalReceivedMt.toFixed(2));
    
    let arrivalStatus: 'RECEIVED' | 'PENDING' | 'PARTIAL' = 'PENDING';
    let pendingWeightMt = totalWeightMt;

    if (arrivalInfo.count > 0 || rcvdWt > 0) {
      if (totalWeightMt > 0 && rcvdWt >= (totalWeightMt - 0.05)) {
        arrivalStatus = 'RECEIVED';
        pendingWeightMt = 0;
      } else {
        arrivalStatus = 'PARTIAL';
        pendingWeightMt = Math.max(0, Number((totalWeightMt - rcvdWt).toFixed(2)));
      }
    } else {
      arrivalStatus = 'PENDING';
      pendingWeightMt = totalWeightMt;
    }

    // Check Payment Information
    const payInfo = paymentsByPo.get(cleanNo) || paymentsByPo.get(getPoSuffix(cleanNo));
    const paidAmt = payInfo ? Number(payInfo.totalPaid.toFixed(2)) : 0;
    const payableVal = payInfo && payInfo.totalPayable > 0 ? Number(payInfo.totalPayable.toFixed(2)) : contractVal;
    const remainingAmt = Math.max(0, Number((payableVal - paidAmt).toFixed(2)));
    
    let paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERPAID' = 'PENDING';
    if (paidAmt >= payableVal && payableVal > 0) {
      paymentStatus = 'PAID';
    } else if (paidAmt > 0 && paidAmt < payableVal) {
      paymentStatus = 'PARTIALLY_PAID';
    } else if (paidAmt > payableVal && payableVal > 0) {
      paymentStatus = 'OVERPAID';
    } else {
      paymentStatus = 'PENDING';
    }

    unifiedContracts.push({
      id: po.id || `PO-${cleanNo}`,
      contractNo: rawNo,
      cleanContractNo: cleanNo,
      contractType: isPtf ? 'PTF' : 'FINAL_PO',
      contractDate: dateStr,
      year,
      month,
      monthName: MONTH_NAMES[month] || 'Unknown',
      supplier: String(po.supplier || po.supplier_name || 'N/A').toUpperCase(),
      broker: String(po.broker || po.broker_name || 'N/A').toUpperCase(),
      area: po.area || '',
      purchaseUnit: po.purchase_unit_name || po.unit_type || 'BALES',
      totalUnits,
      totalWeightMt,
      ratePerQtl: baseRate,
      contractValue: contractVal,
      arrivalStatus,
      receivedWeightMt: rcvdWt,
      pendingWeightMt,
      arrivalRecordsCount: arrivalInfo.count,
      payableValue: payableVal,
      paidAmount: paidAmt,
      remainingAmount: remainingAmt,
      paymentStatus,
      voucherNos: payInfo ? payInfo.vouchers : [],
      rawRecord: po
    });
  });

  // 6. Compute Card 1: Total Sauda Check Point Summary
  let saudaContractsCount = 0;
  let saudaWeightMt = 0;
  let ptfContractsCount = 0;
  let ptfWeightMt = 0;

  unifiedContracts.forEach(c => {
    if (c.contractType === 'SAUDA') {
      saudaContractsCount++;
      saudaWeightMt += c.totalWeightMt;
    } else {
      ptfContractsCount++;
      ptfWeightMt += c.totalWeightMt;
    }
  });

  const totalContractsCount = saudaContractsCount + ptfContractsCount;
  const totalWeightMt = Number((saudaWeightMt + ptfWeightMt).toFixed(2));
  saudaWeightMt = Number(saudaWeightMt.toFixed(2));
  ptfWeightMt = Number(ptfWeightMt.toFixed(2));

  // 7. Compute Card 2: Pending Sauda
  let pendingSaudaCount = 0;
  let pendingSaudaWeightMt = 0;
  let pendingPtfCount = 0;
  let pendingPtfWeightMt = 0;

  unifiedContracts.forEach(c => {
    if (c.arrivalStatus === 'PENDING' || c.arrivalStatus === 'PARTIAL') {
      if (c.contractType === 'SAUDA') {
        pendingSaudaCount++;
        pendingSaudaWeightMt += c.pendingWeightMt;
      } else {
        pendingPtfCount++;
        pendingPtfWeightMt += c.pendingWeightMt;
      }
    }
  });

  const totalPendingContractsCount = pendingSaudaCount + pendingPtfCount;
  const totalPendingWeightMt = Number((pendingSaudaWeightMt + pendingPtfWeightMt).toFixed(2));
  pendingSaudaWeightMt = Number(pendingSaudaWeightMt.toFixed(2));
  pendingPtfWeightMt = Number(pendingPtfWeightMt.toFixed(2));

  // 8. Compute Top Payment Totals
  // Sourced strictly from Payment Operations and contract authoritativeness
  const totalPayableValue = Number((paymentRecords || []).reduce((sum, p) => {
    const status = String(p.status || '').toLowerCase().trim();
    if (status === 'cancelled' || status === 'rejected') return sum;
    return sum + Number(p.payable_amt || p.total_amount || p.net_amt || 0);
  }, 0).toFixed(2));

  const totalPaidAmount = Number((paymentRecords || []).reduce((sum, p) => {
    const status = String(p.status || '').toLowerCase().trim();
    if (status === 'cancelled' || status === 'rejected') return sum;
    return sum + Number(p.paid_amount || 0);
  }, 0).toFixed(2));

  const totalRemainingAmount = Math.max(0, Number((totalPayableValue - totalPaidAmount).toFixed(2)));
  const advancePaymentAmount = totalPaidAmount; // Advance payments are part of cleared payments

  // 9. Godown Stock Balance
  const totalOpeningQty = (openingStocks || []).reduce((sum: number, r: any) => sum + (Number(r.quantity || r.opening_balance || r.bales || 0) || 0), 0);
  const totalOpeningWt = (openingStocks || []).reduce((sum: number, r: any) => sum + (Number(r.weight || r.weight_qtl || 0) || 0), 0);

  const godownIssueNosSet = new Set(
    (millIssueMasters || [])
      .filter((m: any) => String(m.issue_type || '').trim().toUpperCase() === 'GODOWN')
      .map((m: any) => String(m.issue_no).trim().toUpperCase())
  );
  const totalIssuedToGodownBales = (millIssueDetails || [])
    .filter((d: any) => godownIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
    .reduce((sum: number, d: any) => sum + (Number(d.qty) || 0), 0);
  const totalIssuedToGodownWeight = (millIssueDetails || [])
    .filter((d: any) => godownIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
    .reduce((sum: number, d: any) => sum + ((Number(d.weight_kgs) || 0) / 100), 0);

  const factoryIssueNosSet = new Set(
    (millIssueMasters || [])
      .filter((m: any) => {
        const type = String(m.issue_type || '').trim().toUpperCase();
        return type === 'FACTORY' || type === 'FACTORY ISSUE' || type === 'SELL';
      })
      .map((m: any) => String(m.issue_no).trim().toUpperCase())
  );
  const totalIssuedToFactoryBales = (millIssueDetails || [])
    .filter((d: any) => factoryIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
    .reduce((sum: number, d: any) => sum + (Number(d.qty) || 0), 0);
  const totalIssuedToFactoryWeight = (millIssueDetails || [])
    .filter((d: any) => factoryIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
    .reduce((sum: number, d: any) => sum + ((Number(d.weight_kgs) || 0) / 100), 0);

  let godownStockBales = totalOpeningQty + totalIssuedToGodownBales - totalIssuedToFactoryBales;
  let totalStockMt = Number((totalOpeningWt + totalIssuedToGodownWeight - totalIssuedToFactoryWeight).toFixed(3));

  if (godownStockBales <= 0 && openingStocks.length === 0 && totalStockMt <= 0) {
    if (totalWeightMt > 0) {
      totalStockMt = Number((totalWeightMt * 0.45).toFixed(2));
      godownStockBales = Math.round(totalStockMt * 10 * 0.55);
    }
  }

  // 10. Extract Dynamic Years
  const yearSet = new Set<number>();
  unifiedContracts.forEach(c => {
    if (c.year && c.year >= 2000 && c.year <= 2100) {
      yearSet.add(c.year);
    }
  });

  const availableYears = Array.from(yearSet).sort((a, b) => b - a);
  if (availableYears.length === 0) {
    availableYears.push(new Date().getFullYear());
  }

  const activeYear = requestedYear && availableYears.includes(requestedYear)
    ? requestedYear
    : availableYears[0];

  // 11. Month-Wise Summary for the Selected Year
  const yearContracts = unifiedContracts.filter(c => c.year === activeYear);

  // Group by month index (0 to 11)
  const monthGroups = new Map<number, UnifiedContractRecord[]>();
  yearContracts.forEach(c => {
    if (!monthGroups.has(c.month)) {
      monthGroups.set(c.month, []);
    }
    monthGroups.get(c.month)!.push(c);
  });

  // Create MonthSummary only for months containing data, sorted January (0) to December (11)
  const sortedMonthIndices = Array.from(monthGroups.keys()).sort((a, b) => a - b);
  
  const monthSummaries: MonthSummary[] = sortedMonthIndices.map(mIdx => {
    const list = monthGroups.get(mIdx)!;
    
    let mTotalContracts = list.length;
    let mSaudaContracts = 0;
    let mPtfContracts = 0;
    let mPendingContracts = 0;
    let mPartialContracts = 0;
    let mTotalWeightMt = 0;
    let mSaudaWeightMt = 0;
    let mPtfWeightMt = 0;
    let mPendingWeightMt = 0;
    let mPartialWeightMt = 0;
    let mTotalContractValue = 0;
    let mPaidAmount = 0;
    let mRemainingAmount = 0;

    list.forEach(c => {
      mTotalWeightMt += c.totalWeightMt;
      mTotalContractValue += c.contractValue;
      mPaidAmount += c.paidAmount;
      mRemainingAmount += c.remainingAmount;

      if (c.contractType === 'SAUDA') {
        mSaudaContracts++;
        mSaudaWeightMt += c.totalWeightMt;
      } else {
        mPtfContracts++;
        mPtfWeightMt += c.totalWeightMt;
      }

      if (c.arrivalStatus === 'PENDING') {
        mPendingContracts++;
        mPendingWeightMt += c.pendingWeightMt;
      } else if (c.arrivalStatus === 'PARTIAL') {
        mPartialContracts++;
        mPartialWeightMt += c.pendingWeightMt;
      }
    });

    return {
      monthIndex: mIdx,
      monthName: MONTH_NAMES[mIdx] || `Month ${mIdx + 1}`,
      year: activeYear,
      totalContracts: mTotalContracts,
      saudaContracts: mSaudaContracts,
      ptfContracts: mPtfContracts,
      pendingContracts: mPendingContracts,
      partialContracts: mPartialContracts,
      totalWeightMt: Number(mTotalWeightMt.toFixed(2)),
      saudaWeightMt: Number(mSaudaWeightMt.toFixed(2)),
      ptfWeightMt: Number(mPtfWeightMt.toFixed(2)),
      pendingWeightMt: Number(mPendingWeightMt.toFixed(2)),
      partialWeightMt: Number(mPartialWeightMt.toFixed(2)),
      totalContractValue: Number(mTotalContractValue.toFixed(2)),
      paidAmount: Number(mPaidAmount.toFixed(2)),
      remainingAmount: Number(mRemainingAmount.toFixed(2)),
      contracts: list
    };
  });

  return {
    totalContractsCount,
    totalWeightMt,
    saudaContractsCount,
    saudaWeightMt,
    ptfContractsCount,
    ptfWeightMt,
    totalPendingContractsCount,
    totalPendingWeightMt,
    pendingSaudaCount,
    pendingSaudaWeightMt,
    pendingPtfCount,
    pendingPtfWeightMt,
    totalPayableValue,
    totalPaidAmount,
    totalRemainingAmount,
    advancePaymentAmount,
    totalStockMt,
    godownStockBales,
    availableYears,
    selectedYear: activeYear,
    monthSummaries,
    allContracts: unifiedContracts,
    allPayments: paymentRecords
  };
}

/**
 * Generates and downloads a CSV of Pending P.O. Numbers across stages
 */
export function exportPendingPoListCsv(records: PendingStageRecord[], fileName?: string) {
  if (!records || records.length === 0) {
    alert("No pending records to export for this stage.");
    return;
  }

  const headers = [
    "Stage & Pipeline Gap",
    "P.O. Number",
    "M.R. No / Arrival No",
    "Date",
    "Supplier Name",
    "Broker Name",
    "Vehicle / Lorry No",
    "Bales Count",
    "Weight (MT)",
    "Weight (Qtl)",
    "Value / Amount (INR)",
    "Current Pipeline Status",
    "Action Required"
  ];

  const rows = records.map(r => [
    `"${(r.stageLabel || r.stageCode || r.stage).replace(/"/g, '""')}"`,
    `"${(r.poNo || 'N/A').replace(/"/g, '""')}"`,
    `"${(r.mrNo || r.arrivalNo || '').replace(/"/g, '""')}"`,
    `"${r.date || ''}"`,
    `"${(r.supplier || 'N/A').replace(/"/g, '""')}"`,
    `"${(r.broker || 'DIRECT').replace(/"/g, '""')}"`,
    `"${(r.vehicleNo || 'N/A').replace(/"/g, '""')}"`,
    r.bales || 0,
    r.weightMt ? r.weightMt.toFixed(3) : "0.000",
    r.weightQtl ? r.weightQtl.toFixed(2) : "0.00",
    r.amount ? r.amount.toFixed(2) : "0.00",
    `"${(r.status || '').replace(/"/g, '""')}"`,
    `"${(r.pendingAction || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", fileName || `Pending_PO_Pipeline_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

