import { dbModule } from './dbModule';
import { aggregatePremiumsFromTables } from './paymentCalculationEngine';

export interface ReportTransactionLine {
  txnId: string;
  saudaNo: string;
  poNo: string;
  date: string;
  month: string;
  financialYear: string;
  supplier: string;
  broker: string;
  agency: string;
  area: string;
  grade: string;
  quantityMT: number;
  purchaseRate: number;
  baseRate: number;
  rateVariance: number;
  rateVariancePct: number;
  grossPurchaseValue: number;
  baseRateValue: number;
  premiumRate: number;
  premiumAmount: number;
  premiumPct: number;
  deductionAmount: number;
  deductionPct: number;
  moisturePct: number;
  gradeDownQty: number;
  effectiveCost: number;
  realizationRate: number;
  realizationValue: number;
  grossProfit: number;
  profitPct: number;
  profitStatus: 'PROFITABLE' | 'BREAK-EVEN' | 'NON-PROFITABLE' | 'LOSS';
  
  // Pipeline & Operational status
  saudaStatus: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'DELAYED';
  arrivalStatus: 'COMPLETED' | 'PENDING' | 'IN_TRANSIT';
  inspectionStatus: 'COMPLETED' | 'PENDING' | 'REJECTED';
  paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
  settlementStatus: 'SETTLED' | 'PENDING';
  
  arrivedWeightMT: number;
  pendingWeightMT: number;
  paidAmount: number;
  pendingPayable: number;
  claimAmount: number;
  claimSettled: number;
  isDelayed: boolean;
  isAbnormal: boolean;
  abnormalReasons: string[];
  mrNo?: string;
  voucherNo?: string;
}

export interface ReportFilterCriteria {
  dateFrom?: string;
  dateTo?: string;
  month?: string;
  financialYear?: string;
  broker?: string;
  agency?: string;
  area?: string;
  supplier?: string;
  grade?: string;
  sauda?: string;
  po?: string;
  saudaStatus?: string;
  arrivalStatus?: string;
  inspectionStatus?: string;
  paymentStatus?: string;
  settlementStatus?: string;
  searchQuery?: string;
}

export interface SystemReportDataset {
  transactions: ReportTransactionLine[];
  filtered: ReportTransactionLine[];
  masterLists: {
    brokers: string[];
    suppliers: string[];
    agencies: string[];
    areas: string[];
    grades: string[];
    months: string[];
    financialYears: string[];
    saudas: string[];
    pos: string[];
  };
  metrics: {
    // Business Summary (A)
    totalBusinessValue: number;
    totalQuantityMT: number;
    totalPOCount: number;
    totalSaudaCount: number;
    totalSupplierCount: number;
    totalBrokerCount: number;
    totalAgencyCount: number;
    totalAreaCount: number;
    totalGradeCount: number;

    // Financial Summary (B)
    totalPurchaseValue: number;
    totalPremium: number;
    premiumMRCount: number;
    totalDeduction: number;
    totalClaim: number;
    totalSettlement: number;
    totalPayment: number;
    grossProfit: number;
    netProfit: number;
    totalLoss: number;
    nonProfitableBusiness: number;
    profitMarginPct: number;
    weightedPurchaseRate: number;
    weightedBaseRate: number;

    // Operational Summary (C)
    saudaPendingCount: number;
    temporaryArrivalPendingCount: number;
    finalArrivalPendingCount: number;
    millInspectionPendingCount: number;
    paymentPendingCount: number;
    settlementPendingCount: number;
    pendingDeliveryMT: number;
    arrivedMT: number;

    // Exception Summary (D)
    abnormalCount: number;
    highDeductionCount: number;
    highPremiumCount: number;
    highMoistureCount: number;
    gradeDownCount: number;
    highClaimCount: number;
    lossMakingCount: number;
    delayedCount: number;
    profitableCount: number;
    breakEvenCount: number;
  };
}

// Helper to normalize any date string format to standard YYYY-MM-DD
export function normalizeToISODate(dateStr?: string | null): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const clean = String(dateStr).trim();
  if (!clean) return new Date().toISOString().split('T')[0];

  if (clean.includes('T')) {
    const part = clean.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  const ymdSlash = clean.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
  if (ymdSlash) {
    const year = ymdSlash[1];
    const month = ymdSlash[2].padStart(2, '0');
    const day = ymdSlash[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return new Date().toISOString().split('T')[0];
}

export function getTodayISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseJsonItems(itemsField: any): any[] {
  if (!itemsField) return [];
  if (Array.isArray(itemsField)) return itemsField;
  if (typeof itemsField === 'string') {
    try {
      const parsed = JSON.parse(itemsField);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

// Helper to determine financial year
function getFinancialYear(dateStr: string): string {
  const iso = normalizeToISODate(dateStr);
  const parts = iso.split('-');
  const year = parseInt(parts[0], 10) || 2026;
  const month = parseInt(parts[1], 10) || 9;
  if (month >= 4) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

function getYearMonth(dateStr: string): string {
  const iso = normalizeToISODate(dateStr);
  return iso.substring(0, 7) || '2026-09';
}

export async function loadAndProcessSystemReportData(): Promise<{
  allTransactions: ReportTransactionLine[];
  masterLists: SystemReportDataset['masterLists'];
}> {
  try {
    const [
      pos,
      poDetails,
      scps,
      scpDetails,
      amad,
      finals,
      inspections,
      payments,
      paymentDetails,
      sattaRates,
      brokers,
      suppliers,
      agencies,
      areas,
      grades,
      markas,
      saudas,
      saudaQualityList,
      settlements
    ] = await Promise.all([
      dbModule.fetchAll('purchase_master').catch(() => []),
      dbModule.fetchAll('purchase_detail_master').catch(() => []),
      dbModule.fetchAll('sauda_check_point').catch(() => []),
      dbModule.fetchAll('sauda_check_point_details').catch(() => []),
      dbModule.fetchAll('temporary_material_received').catch(() => []),
      dbModule.fetchAll('final_arrival').catch(() => []),
      dbModule.fetchAll('material_inspection').catch(() => []),
      dbModule.fetchAll('payment_master').catch(() => []),
      dbModule.fetchAll('payment_details').catch(() => []),
      dbModule.fetchAll('satta_base_rates').catch(() => []),
      dbModule.fetchAll('broker_master').catch(() => []),
      dbModule.fetchAll('supply_master').catch(() => []),
      dbModule.fetchAll('agency_master').catch(() => []),
      dbModule.fetchAll('area_master').catch(() => []),
      dbModule.fetchAll('grade_master').catch(() => []),
      dbModule.fetchAll('marka_master').catch(() => []),
      dbModule.fetchAll('sauda_master').catch(() => []),
      dbModule.fetchAll('sauda_quality_details').catch(() => []),
      dbModule.fetchAll('settlement_master').catch(() => [])
    ]);

    // Build Master Lookup Maps
    const gradeMap = new Map<string, string>();
    (grades || []).forEach((g: any) => {
      const gCode = String(g.grade_code || '').trim().toUpperCase();
      const gName = String(g.grade_name || g.name || '').trim().toUpperCase();
      if (gCode && gName) {
        gradeMap.set(gCode, gName);
        gradeMap.set(gName, gName);
      } else if (gName) {
        gradeMap.set(gName, gName);
      }
    });

    const markaSet = new Set<string>();
    (markas || []).forEach((m: any) => {
      if (m.marka_code) markaSet.add(String(m.marka_code).trim().toUpperCase());
      if (m.marka_name) markaSet.add(String(m.marka_name).trim().toUpperCase());
      if (m.name) markaSet.add(String(m.name).trim().toUpperCase());
    });
    // Common trade markas that might not be in db
    ['AJAY', 'BALAJI', 'TULSI/H', 'TULSI', 'AA', 'NO MARK', 'BTR', 'SUPERIOR', 'NORMAL'].forEach(m => markaSet.add(m));

    const INVALID_GRADE_SET = new Set([
      'NORMAL', 'NORMAL GRADE', 'STANDARD', 'STANDARD GRADE', 'PO_TYPE', 'UNASSIGNED', 'DIRECT', 'N/A', '-', '', 'BALES',
      ...Array.from(markaSet)
    ]);

    // Build Sauda Master & Sauda Quality Maps for reliable grade resolution
    const saudaMasterMap = new Map<string, any>();
    (saudas || []).forEach((s: any) => {
      const sNo = String(s.sauda_no || '').trim().toUpperCase();
      if (sNo) saudaMasterMap.set(sNo, s);
      if (s.id) saudaMasterMap.set(String(s.id), s);
      if (s.sauda_id) saudaMasterMap.set(String(s.sauda_id), s);
    });

    const saudaQualityMap = new Map<string, any[]>();
    (saudaQualityList || []).forEach((sq: any) => {
      const sId = String(sq.sauda_id || sq.sauda_no || '').trim().toUpperCase();
      if (sId) {
        const list = saudaQualityMap.get(sId) || [];
        list.push(sq);
        saudaQualityMap.set(sId, list);
      }
    });

    const resolveGradeName = (rawName: string, rawCode: string, saudaNo: string, poNo: string): string => {
      const cleanName = (rawName || '').trim();
      const cleanCode = (rawCode || '').trim();

      // Check grade_master match by name or code
      if (cleanName && gradeMap.has(cleanName.toUpperCase())) {
        return gradeMap.get(cleanName.toUpperCase())!;
      }
      if (cleanCode && gradeMap.has(cleanCode.toUpperCase())) {
        return gradeMap.get(cleanCode.toUpperCase())!;
      }

      if (cleanName && !INVALID_GRADE_SET.has(cleanName.toUpperCase()) && !markaSet.has(cleanName.toUpperCase())) {
        return cleanName;
      }
      if (cleanCode && !INVALID_GRADE_SET.has(cleanCode.toUpperCase()) && !markaSet.has(cleanCode.toUpperCase())) {
        return cleanCode;
      }

      // Check sauda quality details (quality/grade)
      const qList = saudaQualityMap.get(saudaNo.toUpperCase()) || saudaQualityMap.get(poNo.toUpperCase());
      if (qList && qList.length > 0) {
        for (const q of qList) {
          const qVal = String(q.quality || q.grade_name || q.grade_code || q.grade || '').trim();
          if (qVal && gradeMap.has(qVal.toUpperCase())) {
            return gradeMap.get(qVal.toUpperCase())!;
          }
          if (qVal && !INVALID_GRADE_SET.has(qVal.toUpperCase()) && !markaSet.has(qVal.toUpperCase())) {
            return qVal;
          }
        }
      }

      // Check sauda master quality
      const saudaRow = saudaMasterMap.get(saudaNo.toUpperCase()) || saudaMasterMap.get(poNo.toUpperCase());
      if (saudaRow) {
        const sVal = String(saudaRow.quality || saudaRow.grade || '').trim();
        if (sVal && gradeMap.has(sVal.toUpperCase())) {
          return gradeMap.get(sVal.toUpperCase())!;
        }
        if (sVal && !INVALID_GRADE_SET.has(sVal.toUpperCase()) && !markaSet.has(sVal.toUpperCase())) {
          return sVal;
        }
        if (Array.isArray(saudaRow.quality_details)) {
          for (const q of saudaRow.quality_details) {
            const qVal = String(q.quality || q.grade || '').trim();
            if (qVal && gradeMap.has(qVal.toUpperCase())) {
              return gradeMap.get(qVal.toUpperCase())!;
            }
            if (qVal && !INVALID_GRADE_SET.has(qVal.toUpperCase()) && !markaSet.has(qVal.toUpperCase())) {
              return qVal;
            }
          }
        }
      }

      return 'TD5';
    };

    const agencyMap = new Map<string, string>();
    (agencies || []).forEach((a: any) => {
      const aCode = String(a.agency_code || '').trim().toUpperCase();
      const aName = String(a.agency_name || a.name || '').trim().toUpperCase();
      if (aCode && aName) {
        agencyMap.set(aCode, aName);
        agencyMap.set(aName, aName);
      } else if (aName) {
        agencyMap.set(aName, aName);
      }
    });

    const areaMap = new Map<string, string>();
    (areas || []).forEach((ar: any) => {
      const arCode = String(ar.area_code || '').trim().toUpperCase();
      const arName = String(ar.area_name || ar.name || '').trim().toUpperCase();
      if (arCode && arName) {
        areaMap.set(arCode, arName);
        areaMap.set(arName, arName);
      } else if (arName) {
        areaMap.set(arName, arName);
      }
    });

    const brokerMap = new Map<string, string>();
    (brokers || []).forEach((b: any) => {
      const bCode = String(b.broker_code || '').trim().toUpperCase();
      const bName = String(b.broker_name || b.name || '').trim().toUpperCase();
      if (bCode && bName) {
        brokerMap.set(bCode, bName);
        brokerMap.set(bName, bName);
      } else if (bName) {
        brokerMap.set(bName, bName);
      }
    });

    const supplyMap = new Map<string, string>();
    (suppliers || []).forEach((s: any) => {
      const sCode = String(s.supply_code || s.supplier_code || '').trim().toUpperCase();
      const sName = String(s.supply_name || s.supplier_name || s.name || '').trim().toUpperCase();
      if (sCode && sName) {
        supplyMap.set(sCode, sName);
        supplyMap.set(sName, sName);
      } else if (sName) {
        supplyMap.set(sName, sName);
      }
    });

    // Satta Base Rates
    const baseRateMap = new Map<string, number>();
    (sattaRates || []).forEach((r: any) => {
      const d = r.start_date || r.date;
      if (d && r.base_rate) {
        baseRateMap.set(d, Number(r.base_rate));
      }
    });

    const defaultLatestBaseRate = sattaRates && sattaRates.length > 0 
      ? Number(sattaRates[0].base_rate || 0) 
      : 0;

    // Arrival by PO and Sauda
    const arrivalByPo = new Map<string, number>();
    (finals || []).forEach((f: any) => {
      const wt = Number(f.electronic_net_weight || f.weight_reduced || 0);
      if (f.po_no) arrivalByPo.set(f.po_no, (arrivalByPo.get(f.po_no) || 0) + wt);
      if (f.contract_po_no) arrivalByPo.set(f.contract_po_no, (arrivalByPo.get(f.contract_po_no) || 0) + wt);
      if (f.sauda_no) arrivalByPo.set(f.sauda_no, (arrivalByPo.get(f.sauda_no) || 0) + wt);
      if (f.arrival_no) arrivalByPo.set(f.arrival_no, (arrivalByPo.get(f.arrival_no) || 0) + wt);
    });

    (amad || []).forEach((a: any) => {
      const key = a.po_no || a.temporary_arrival_no;
      if (key && !arrivalByPo.has(key)) {
        const wt = Number(a.weight_qtl ? a.weight_qtl / 10 : 0);
        if (wt > 0) arrivalByPo.set(key, wt);
      }
    });

    // Inspection deductions & quality
    const inspectionDeductionByPo = new Map<string, { deduction: number; moisture: number; gradeDown: number }>();
    (inspections || []).forEach((i: any) => {
      const poKey = i.po_no || i.mr_no || i.arrival_no;
      if (poKey) {
        const prev = inspectionDeductionByPo.get(poKey) || { deduction: 0, moisture: 0, gradeDown: 0 };
        const ded = Number(i.deduction_amount || 0);
        const moist = Number(i.actual_moisture || i.claim_moisture || 0);
        const gd = Number(i.grade_down_qty || i.deduction_qty || 0);
        inspectionDeductionByPo.set(poKey, {
          deduction: prev.deduction + ded,
          moisture: Math.max(prev.moisture, moist),
          gradeDown: prev.gradeDown + gd
        });
      }
    });

    // Payments by PO & MR (combining payment_master and payment_details)
    const paymentByPo = new Map<string, number>();
    (payments || []).forEach((p: any) => {
      const amt = Number(p.payable_amt ||  0);
      if (p.po_no) paymentByPo.set(p.po_no, (paymentByPo.get(p.po_no) || 0) + amt);
      if (p.mr_no) paymentByPo.set(p.mr_no, (paymentByPo.get(p.mr_no) || 0) + amt);
      if (p.voucher_no) paymentByPo.set(p.voucher_no, (paymentByPo.get(p.voucher_no) || 0) + amt);
    });

    (paymentDetails || []).forEach((pd: any) => {
      const amt = Number(pd.amount || pd.net_amt || (pd.sett_rate && pd.quantity_qtl ? pd.sett_rate * pd.quantity_qtl : 0) || 0);
      if (amt > 0) {
        if (pd.po_no) paymentByPo.set(pd.po_no, Math.max(paymentByPo.get(pd.po_no) || 0, amt));
        if (pd.mr_no) paymentByPo.set(pd.mr_no, Math.max(paymentByPo.get(pd.mr_no) || 0, amt));
        if (pd.sauda_no) paymentByPo.set(pd.sauda_no, Math.max(paymentByPo.get(pd.sauda_no) || 0, amt));
      }
    });


    const pendingpaymentByPo = new Map<string, number>();
    (settlements || []).forEach((p: any) => {
      const pndngamt = Number(p.payable_amt || 0);
      if (p.po_no) pendingpaymentByPo.set(p.po_no, (pendingpaymentByPo.get(p.po_no) || 0) + pndngamt);
      if (p.mr_no) pendingpaymentByPo.set(p.mr_no, (pendingpaymentByPo.get(p.mr_no) || 0) + pndngamt);
      if (p.voucher_no) pendingpaymentByPo.set(p.voucher_no, (pendingpaymentByPo.get(p.voucher_no) || 0) + pndngamt);
    });
    //alert()

    // Helper to generate normalized keys for robust PO detail linking
    const getPoKeys = (raw: string | number | undefined | null): string[] => {
      if (!raw) return [];
      const s = String(raw).trim().toUpperCase();
      if (!s || s === '-') return [];
      const keys = new Set<string>([s]);
      const numOnly = s.replace(/[^0-9]/g, '');
      if (numOnly) {
        keys.add(numOnly);
        keys.add(numOnly.padStart(4, '0'));
        keys.add(String(parseInt(numOnly, 10)));
        keys.add(`PO-${numOnly}`);
        keys.add(`PO-${numOnly.padStart(4, '0')}`);
        keys.add(`PO-${String(parseInt(numOnly, 10))}`);
        keys.add(`PTF-${numOnly}`);
        keys.add(`PTF-${numOnly.padStart(4, '0')}`);
        keys.add(`PTF-${String(parseInt(numOnly, 10))}`);
      }
      return Array.from(keys);
    };

    // Group PO details by all alias variations
    const poDetailsMap = new Map<string, any[]>();
    [...(scpDetails || []), ...(poDetails || [])].forEach((item: any) => {
      const keys = [
        ...getPoKeys(item.po_no),
        ...getPoKeys(item.ptf_no),
        ...getPoKeys(item.sauda_no),
        ...getPoKeys(item.contract_po_no)
      ];
      keys.forEach(k => {
        const list = poDetailsMap.get(k) || [];
        const isDuplicate = list.some(existing => 
          existing.srl_no === item.srl_no && 
          (existing.grade_name === item.grade_name || existing.grade_code === item.grade_code) &&
          (existing.rate_qntl === item.rate_qntl || existing.rate === item.rate)
        );
        if (!isDuplicate) {
          list.push(item);
        }
        poDetailsMap.set(k, list);
      });
    });

    const findPoDetails = (poNo: string, saudaNo: string): any[] => {
      const candidateKeys = [
        ...getPoKeys(poNo),
        ...getPoKeys(saudaNo)
      ];
      for (const k of candidateKeys) {
        const found = poDetailsMap.get(k);
        if (found && found.length > 0) return found;
      }
      return [];
    };

    // Helper to extract numbers or valid explicit premium values
    const parseExplicitNum = (val: any): number => {
      if (val === undefined || val === null) return 0;
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      const s = String(val).trim();
      if (!s || s === '-' || /^(no|false)$/i.test(s)) return 0;
      const num = parseFloat(s.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? 0 : num;
    };

    // Premium lookup map across all entity alias variations (Settlement, Payment, SCP, PO)
    const premiumLookupMap = new Map<string, { rate: number; amount: number; source: string }>();
    const recordPremiumEntry = (rawKey: any, rate: number, amount: number, src: string, refObj?: any) => {
      let validRate = rate > 0 && rate < 2000 ? rate : 0;
      let validAmt = amount > 0 ? amount : 0;

      // Guard against total invoice or payment amounts (e.g. 115,700) passed into val_premium_amt or summary_premium_amount
      if (refObj) {
        const totalInvoiceAmt = parseExplicitNum(refObj.total_amount || refObj.paid_amount || refObj.payable_amt || refObj.val_material_value);
        if (totalInvoiceAmt > 0 && Math.abs(validAmt - totalInvoiceAmt) < 1) {
          validAmt = 0;
        }
      }

      if (validRate === 0 && validAmt === 0) return;

      const keys = getPoKeys(rawKey);
      keys.forEach(k => {
        const existing = premiumLookupMap.get(k) || { rate: 0, amount: 0, source: '' };
        premiumLookupMap.set(k, {
          rate: Math.max(existing.rate, validRate),
          amount: Math.max(existing.amount, validAmt),
          source: existing.source || src
        });
      });
    };

    // 1. Process payment_master + payment_details using the authoritative unified calculation engine
    const unifiedPremiums = aggregatePremiumsFromTables(payments, paymentDetails);

    // Register all unified MR premiums under their PO, MR, and Voucher aliases
    unifiedPremiums.mrsWithPremium.forEach(pm => {
      const keys = [
        ...getPoKeys(pm.poNo),
        ...getPoKeys(pm.mrNo),
        ...getPoKeys(pm.voucherNo)
      ];
      keys.forEach(k => {
        const existing = premiumLookupMap.get(k) || { rate: 0, amount: 0, source: '' };
        premiumLookupMap.set(k, {
          rate: Math.max(existing.rate, pm.avgPremiumRatePerQtl),
          amount: existing.amount + pm.totalPremiumAmount,
          source: 'PaymentOperations'
        });
      });
    });

    (settlements || []).forEach((st: any) => {
      const premAmt = parseExplicitNum(st.val_premium_amt || st.summary_premium_amount);
      const premRate = parseExplicitNum(st.summary_premium_rate || st.premium_rate);
      if (premAmt > 0 || premRate > 0) {
        if (st.po_no) recordPremiumEntry(st.po_no, premRate, premAmt, 'Settlement', st);
        if (st.sauda_no) recordPremiumEntry(st.sauda_no, premRate, premAmt, 'Settlement', st);
        if (st.contract_po_no) recordPremiumEntry(st.contract_po_no, premRate, premAmt, 'Settlement', st);
      }
    });

    (scps || []).forEach((sc: any) => {
      const premAmt = parseExplicitNum(sc.val_premium_amt || sc.summary_premium_amount);
      const premRate = parseExplicitNum(sc.premium);
      if (premAmt > 0 || premRate > 0) {
        if (sc.po_no) recordPremiumEntry(sc.po_no, premRate, premAmt, 'SCP');
        if (sc.sauda_no) recordPremiumEntry(sc.sauda_no, premRate, premAmt, 'SCP');
      }
    });

    (pos || []).forEach((p: any) => {
      const premAmt = parseExplicitNum(p.summary_premium_amount || p.val_premium_amt);
      const premRate = parseExplicitNum(p.premium);
      if (premAmt > 0 || premRate > 0) {
        if (p.po_no) recordPremiumEntry(p.po_no, premRate, premAmt, 'PO');
        if (p.sauda_no) recordPremiumEntry(p.sauda_no, premRate, premAmt, 'PO');
      }
    });

    // Merge Sauda Check Point & Purchase Master records
    const allPosMap = new Map<string, any>();
    const seenCanonKeys = new Set<string>();

    const getAllRecordKeys = (item: any): string[] => {
      if (!item) return [];
      const keys: string[] = [];
      const add = (val: any) => {
        if (!val) return;
        const str = String(val).trim();
        if (!str || /^n\/?a$/i.test(str) || /^undefined$/i.test(str) || /^null$/i.test(str) || str === '-') return;
        
        const clean = str.replace(/^p\.?o\.?\s*[:\-]?\s*/i, '').trim().toUpperCase();
        if (clean) {
          keys.push(clean);
          const parts = clean.split('/');
          const suffix = parts[parts.length - 1].trim();
          const numOnly = suffix.replace(/[^0-9]/g, '');
          if (numOnly) {
            keys.push(numOnly);
            keys.push(numOnly.padStart(4, '0'));
          }
        }
      };

      add(item.po_no);
      add(item.contract_po_no);
      add(item.sauda_no);
      add(item.ptf_no);
      add(item.reference_no);
      add(item.bill_challan_no);
      if (item.id) {
        add(`SCP-${item.id}`);
        add(`PO-${item.id}`);
      }
      return Array.from(new Set(keys));
    };

    const addPoToMap = (p: any) => {
      const itemKeys = getAllRecordKeys(p);
      if (itemKeys.length > 0 && itemKeys.some(k => seenCanonKeys.has(k))) {
        return;
      }

      const rawPNo = String(p.po_no || p.contract_po_no || p.ptf_no || p.sauda_no || p.session || (p.id ? `PO-${p.id}` : '')).trim().toUpperCase();
      const cleanNo = rawPNo ? rawPNo.replace(/^p\.?o\.?\s*[:\-]?\s*/i, '').trim() : (itemKeys[0] || '');
      if (!cleanNo) return;

      allPosMap.set(cleanNo, p);
      itemKeys.forEach(k => seenCanonKeys.add(k));
      seenCanonKeys.add(cleanNo);
    };

    (scps || []).forEach(addPoToMap);
    (pos || []).forEach(addPoToMap);

    const uniquePosList = Array.from(allPosMap.values());
    const transactionLines: ReportTransactionLine[] = [];
    let txnCounter = 1;

    uniquePosList.forEach((po: any) => {
      const poNo = String(po.po_no || po.contract_po_no || po.ptf_no || po.sauda_no || (po.id ? `PO-${po.id}` : '')).trim();
      if (!poNo) return;
      const saudaNo = String(po.sauda_no || po.contract_po_no || po.po_contract || poNo).trim();
      const date = po.contract_date || po.po_date || po.date || po.s_date || po.b_date || po.created_at?.split('T')[0] || '';

      const rawSup = String(po.supplier || po.party_name || po.challan_supplier || '').trim();
      const supplier = supplyMap.get(rawSup.toUpperCase()) || rawSup || 'Direct Supplier';

      const rawBrk = String(po.broker || '').trim();
      const broker = brokerMap.get(rawBrk.toUpperCase()) || rawBrk || 'Direct';

      const rawAgency = String(po.agency || po.purchase_unit_name || '').trim();
      const agency = agencyMap.get(rawAgency.toUpperCase()) || (rawAgency.toUpperCase() !== 'BALES' ? rawAgency : '-');

      const rawArea = String(po.area || '').trim();
      const area = areaMap.get(rawArea.toUpperCase()) || rawArea || '-';

      const details = findPoDetails(poNo, saudaNo);

      if (details.length > 0) {
        details.forEach((line: any, dIdx: number) => {
          const rawGName = String(line.grade_name || line.grade || '').trim();
          const rawGCode = String(line.grade_code || line.quality || '').trim();
          const grade = resolveGradeName(rawGName, rawGCode, saudaNo, poNo);

          const rawItemAgency = String(line.agency_name || line.agency || '').trim();
          const rawItemAgencyCode = String(line.agency_code || '').trim();
          const itemAgency = agencyMap.get(rawItemAgency.toUpperCase()) || agencyMap.get(rawItemAgencyCode.toUpperCase()) || (rawItemAgency && rawItemAgency.toUpperCase() !== 'BALES' ? rawItemAgency : agency);

          const totalPoContract = Number(po.total_contract_mt || po.quantity || 0);
          let quantityMT = Number(line.weight_mt || line.qty || 0);
          if (quantityMT === 0 && details.length > 0 && totalPoContract > 0) {
            quantityMT = Number((totalPoContract / details.length).toFixed(3));
          }
          if (quantityMT === 0) quantityMT = totalPoContract;

          const purchaseRate = Number(line.rate_qntl || line.rate || po.b_rate || 0);
          const baseRate = baseRateMap.get(date) || Number(po.b_rate || defaultLatestBaseRate || purchaseRate);
          const rateVariance = purchaseRate - baseRate;
          const rateVariancePct = baseRate > 0 ? (rateVariance / baseRate) * 100 : 0;
          //const grossPurchaseValue = quantityMT * purchaseRate * 10;
          const grossPurchaseValue = paymentByPo.get(poNo) || paymentByPo.get(saudaNo) || 0;
          const baseRateValue = quantityMT * baseRate * 10;

          // Real explicit premium resolution strictly from payment_master & payment_details:
          const poKeys = getPoKeys(poNo);
          let headerPrem = { rate: 0, amount: 0, source: '' };
          for (const k of poKeys) {
            if (premiumLookupMap.has(k)) {
              headerPrem = premiumLookupMap.get(k)!;
              break;
            }
          }

          let premiumRate = 0;
          let premiumAmount = 0;

          const cleanPoKey = poNo.toUpperCase().replace(/[^A-Z0-9]/g, '');
          const matchedMrs = unifiedPremiums.byPoMap.get(cleanPoKey) || [];
          const poTotalPremium = matchedMrs.reduce((s, m) => s + m.totalPremiumAmount, 0);
          const poAvgRate = matchedMrs.length > 0 ? (matchedMrs[0].avgPremiumRatePerQtl || 0) : 0;

          if (poTotalPremium > 0) {
            if (details.length > 1) {
              const baseShare = Math.floor((poTotalPremium / details.length) * 100) / 100;
              premiumAmount = (dIdx === details.length - 1)
                ? Number((poTotalPremium - (baseShare * (details.length - 1))).toFixed(2))
                : baseShare;
            } else {
              premiumAmount = poTotalPremium;
            }
            premiumRate = poAvgRate;
          }

          const premiumPct = grossPurchaseValue > 0 ? (premiumAmount / grossPurchaseValue) * 100 : 0;

          const inspInfo = inspectionDeductionByPo.get(poNo) || inspectionDeductionByPo.get(saudaNo) || { deduction: 0, moisture: 0, gradeDown: 0 };
          const deductionAmount = inspInfo.deduction;
          const deductionPct = grossPurchaseValue > 0 ? (deductionAmount / grossPurchaseValue) * 100 : 0;
          const moisturePct = inspInfo.moisture;
          const gradeDownQty = inspInfo.gradeDown;

          //const effectiveCost = grossPurchaseValue - deductionAmount;
          const effectiveCost = grossPurchaseValue;
          const realizationRate = Number(po.realization_rate || baseRate || purchaseRate);
          const realizationValue = quantityMT * realizationRate * 10;
          const grossProfit = realizationValue - effectiveCost;
          const profitPct = effectiveCost > 0 ? (grossProfit / effectiveCost) * 100 : 0;

          let profitStatus: ReportTransactionLine['profitStatus'] = 'PROFITABLE';
          if (grossProfit < -100) profitStatus = 'LOSS';
          else if (Math.abs(grossProfit) <= 100) profitStatus = 'BREAK-EVEN';
          else if (profitPct < 1.0) profitStatus = 'NON-PROFITABLE';

          const arrivedWeightMT = arrivalByPo.get(poNo) || arrivalByPo.get(saudaNo) || 0;
          const pendingWeightMT = Math.max(0, quantityMT - arrivedWeightMT);
          const paidAmount = paymentByPo.get(poNo) || paymentByPo.get(saudaNo) || 0;
          const pendingPayable = Math.max(0, effectiveCost - paidAmount - deductionAmount);
          //const pendingPayable = pendingpaymentByPo.get(poNo) || pendingpaymentByPo.get(saudaNo) || 0;

          const deliveryToDate = po.delivery_to;
          const isDelayed = deliveryToDate ? new Date() > new Date(deliveryToDate) && pendingWeightMT > 0 : false;

          const abnormalReasons: string[] = [];
          if (moisturePct > 18.0) abnormalReasons.push(`High Moisture (${moisturePct.toFixed(1)}%)`);
          if (premiumRate > 100) abnormalReasons.push(`High Premium (+₹${premiumRate.toFixed(0)}/Qtl)`);
          if (deductionPct > 3) abnormalReasons.push(`High Deduction (${deductionPct.toFixed(1)}%)`);
          if (isDelayed) abnormalReasons.push(`Overdue Delivery (${pendingWeightMT.toFixed(2)} MT pending)`);
          if (gradeDownQty > 0) abnormalReasons.push(`Grade Down (${gradeDownQty} MT)`);

          const matchedMrNo = matchedMrs.map(m => m.mrNo).filter(Boolean).join(', ') || undefined;
          const matchedVoucherNo = matchedMrs.map(m => m.voucherNo).filter(Boolean).join(', ') || undefined;

          transactionLines.push({
            txnId: `TXN-${String(txnCounter++).padStart(5, '0')}`,
            saudaNo,
            poNo,
            mrNo: matchedMrNo,
            voucherNo: matchedVoucherNo,
            date,
            month: getYearMonth(date),
            financialYear: getFinancialYear(date),
            supplier,
            broker,
            agency: itemAgency,
            area,
            grade,
            quantityMT,
            purchaseRate,
            baseRate,
            rateVariance,
            rateVariancePct,
            grossPurchaseValue,
            baseRateValue,
            premiumRate,
            premiumAmount,
            premiumPct,
            deductionAmount,
            deductionPct,
            moisturePct,
            gradeDownQty,
            effectiveCost,
            realizationRate,
            realizationValue,
            grossProfit,
            profitPct,
            profitStatus,
            saudaStatus: pendingWeightMT === 0 ? 'COMPLETED' : (isDelayed ? 'DELAYED' : 'IN_PROGRESS'),
            arrivalStatus: arrivedWeightMT >= quantityMT ? 'COMPLETED' : (arrivedWeightMT > 0 ? 'IN_TRANSIT' : 'PENDING'),
            inspectionStatus: inspInfo.deduction > 0 || inspInfo.moisture > 0 ? 'COMPLETED' : 'PENDING',
            paymentStatus: paidAmount >= effectiveCost && effectiveCost > 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING'),
            settlementStatus: pendingPayable === 0 ? 'SETTLED' : 'PENDING',
            arrivedWeightMT,
            pendingWeightMT,
            paidAmount,
            pendingPayable,
            claimAmount: deductionAmount > 5000 ? deductionAmount : 0,
            claimSettled: deductionAmount > 5000 && pendingPayable === 0 ? deductionAmount : 0,
            isDelayed,
            isAbnormal: abnormalReasons.length > 0,
            abnormalReasons
          });
        });
      } else {
        const rawGName = String(po.grade_name || po.grade || po.quality || '').trim();
        const rawGCode = String(po.grade_code || (po.quality_details && po.quality_details[0]?.quality) || '').trim();
        const grade = resolveGradeName(rawGName, rawGCode, saudaNo, poNo);

        const quantityMT = Number(po.total_contract_mt || po.quantity || 0);
        const purchaseRate = Number(po.b_rate || 0);
        const baseRate = baseRateMap.get(date) || Number(po.b_rate || defaultLatestBaseRate || purchaseRate);
        const rateVariance = purchaseRate - baseRate;
        const rateVariancePct = baseRate > 0 ? (rateVariance / baseRate) * 100 : 0;
        const grossPurchaseValue = quantityMT * purchaseRate * 10;
        const baseRateValue = quantityMT * baseRate * 10;

        // Real explicit premium resolution (matched strictly by PO number):
        const poKeys = getPoKeys(poNo);
        let headerPrem = { rate: 0, amount: 0, source: '' };
        for (const k of poKeys) {
          if (premiumLookupMap.has(k)) {
            headerPrem = premiumLookupMap.get(k)!;
            break;
          }
        }

        const cleanPoKey = poNo.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const matchedMrs = unifiedPremiums.byPoMap.get(cleanPoKey) || [];
        const poTotalPremium = matchedMrs.reduce((s, m) => s + m.totalPremiumAmount, 0);
        const poAvgRate = matchedMrs.length > 0 ? (matchedMrs[0].avgPremiumRatePerQtl || 0) : 0;

        let premiumRate = 0;
        let premiumAmount = 0;

        if (poTotalPremium > 0) {
          premiumAmount = poTotalPremium;
          premiumRate = poAvgRate;
        }
        if (premiumRate === 0 && premiumAmount > 0 && quantityMT > 0) {
          premiumRate = premiumAmount / (quantityMT * 10);
        }
        const premiumPct = grossPurchaseValue > 0 ? (premiumAmount / grossPurchaseValue) * 100 : 0;

        const inspInfo = inspectionDeductionByPo.get(poNo) || inspectionDeductionByPo.get(saudaNo) || { deduction: 0, moisture: 0, gradeDown: 0 };
        const deductionAmount = inspInfo.deduction;
        const deductionPct = grossPurchaseValue > 0 ? (deductionAmount / grossPurchaseValue) * 100 : 0;
        const moisturePct = inspInfo.moisture;
        const gradeDownQty = inspInfo.gradeDown;

        const effectiveCost = grossPurchaseValue + premiumAmount - deductionAmount;
        const realizationRate = Number(po.realization_rate || baseRate || purchaseRate);
        const realizationValue = quantityMT * realizationRate * 10;
        const grossProfit = realizationValue - effectiveCost;
        const profitPct = effectiveCost > 0 ? (grossProfit / effectiveCost) * 100 : 0;

        let profitStatus: ReportTransactionLine['profitStatus'] = 'PROFITABLE';
        if (grossProfit < -100) profitStatus = 'LOSS';
        else if (Math.abs(grossProfit) <= 100) profitStatus = 'BREAK-EVEN';
        else if (profitPct < 1.0) profitStatus = 'NON-PROFITABLE';

        const arrivedWeightMT = arrivalByPo.get(poNo) || arrivalByPo.get(saudaNo) || 0;
        const pendingWeightMT = Math.max(0, quantityMT - arrivedWeightMT);
        const paidAmount = paymentByPo.get(poNo) || paymentByPo.get(saudaNo) || 0;
        const pendingPayable = Math.max(0, effectiveCost - paidAmount);

        const deliveryToDate = po.delivery_to;
        const isDelayed = deliveryToDate ? new Date() > new Date(deliveryToDate) && pendingWeightMT > 0 : false;

        const abnormalReasons: string[] = [];
        if (moisturePct > 18.0) abnormalReasons.push(`High Moisture (${moisturePct.toFixed(1)}%)`);
        if (premiumRate > 100) abnormalReasons.push(`High Premium (+₹${premiumRate.toFixed(0)}/Qtl)`);
        if (deductionPct > 3) abnormalReasons.push(`High Deduction (${deductionPct.toFixed(1)}%)`);
        if (isDelayed) abnormalReasons.push(`Overdue Delivery (${pendingWeightMT.toFixed(2)} MT pending)`);
        if (gradeDownQty > 0) abnormalReasons.push(`Grade Down (${gradeDownQty} MT)`);

        const matchedMrNo = matchedMrs.map(m => m.mrNo).filter(Boolean).join(', ') || undefined;
        const matchedVoucherNo = matchedMrs.map(m => m.voucherNo).filter(Boolean).join(', ') || undefined;

        transactionLines.push({
          txnId: `TXN-${String(txnCounter++).padStart(5, '0')}`,
          saudaNo,
          poNo,
          mrNo: matchedMrNo,
          voucherNo: matchedVoucherNo,
          date,
          month: getYearMonth(date),
          financialYear: getFinancialYear(date),
          supplier,
          broker,
          agency,
          area,
          grade,
          quantityMT,
          purchaseRate,
          baseRate,
          rateVariance,
          rateVariancePct,
          grossPurchaseValue,
          baseRateValue,
          premiumRate,
          premiumAmount,
          premiumPct,
          deductionAmount,
          deductionPct,
          moisturePct,
          gradeDownQty,
          effectiveCost,
          realizationRate,
          realizationValue,
          grossProfit,
          profitPct,
          profitStatus,
          saudaStatus: pendingWeightMT === 0 ? 'COMPLETED' : (isDelayed ? 'DELAYED' : 'IN_PROGRESS'),
          arrivalStatus: arrivedWeightMT >= quantityMT ? 'COMPLETED' : (arrivedWeightMT > 0 ? 'IN_TRANSIT' : 'PENDING'),
          inspectionStatus: inspInfo.deduction > 0 || inspInfo.moisture > 0 ? 'COMPLETED' : 'PENDING',
          paymentStatus: paidAmount >= effectiveCost && effectiveCost > 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING'),
          settlementStatus: pendingPayable === 0 ? 'SETTLED' : 'PENDING',
          arrivedWeightMT,
          pendingWeightMT,
          paidAmount,
          pendingPayable,
          claimAmount: deductionAmount > 5000 ? deductionAmount : 0,
          claimSettled: deductionAmount > 5000 && pendingPayable === 0 ? deductionAmount : 0,
          isDelayed,
          isAbnormal: abnormalReasons.length > 0,
          abnormalReasons
        });
      }
    });

    // Populate master lists for dropdowns
    const brokerSet = new Set<string>();
    const supplierSet = new Set<string>();
    const agencySet = new Set<string>();
    const areaSet = new Set<string>();
    const gradeSet = new Set<string>();
    const monthSet = new Set<string>();
    const fySet = new Set<string>();
    const saudaSet = new Set<string>();
    const poSet = new Set<string>();

    transactionLines.forEach(t => {
      if (t.broker && t.broker !== 'Direct') brokerSet.add(t.broker);
      if (t.supplier && t.supplier !== 'Unassigned Supplier' && t.supplier !== 'Direct Supplier') supplierSet.add(t.supplier);
      if (t.agency && t.agency !== '-') agencySet.add(t.agency);
      if (t.area && t.area !== '-') areaSet.add(t.area);
      if (t.grade && t.grade !== '-') gradeSet.add(t.grade);
      if (t.month) monthSet.add(t.month);
      if (t.financialYear) fySet.add(t.financialYear);
      if (t.saudaNo) saudaSet.add(t.saudaNo);
      if (t.poNo && t.poNo !== 'Pending P.O.') poSet.add(t.poNo);
    });

    return {
      allTransactions: transactionLines,
      masterLists: {
        brokers: Array.from(brokerSet).sort(),
        suppliers: Array.from(supplierSet).sort(),
        agencies: Array.from(agencySet).sort(),
        areas: Array.from(areaSet).sort(),
        grades: Array.from(gradeSet).sort(),
        months: Array.from(monthSet).sort().reverse(),
        financialYears: Array.from(fySet).sort().reverse(),
        saudas: Array.from(saudaSet).sort(),
        pos: Array.from(poSet).sort()
      }
    };
  } catch (error) {
    console.error('Failed to load system report data:', error);
    return {
      allTransactions: [],
      masterLists: {
        brokers: [],
        suppliers: [],
        agencies: [],
        areas: [],
        grades: [],
        months: [],
        financialYears: [],
        saudas: [],
        pos: []
      }
    };
  }
}

// Compute all aggregated metrics from filtered transaction records
export function calculateReportMetrics(txns: ReportTransactionLine[]): SystemReportDataset['metrics'] {
  let totalBusinessValue = 0;
  let totalQuantityMT = 0;
  let totalPurchaseValue = 0;
  let totalPremium = 0;
  let totalDeduction = 0;
  let totalClaim = 0;
  let totalSettlement = 0;
  let totalPayment = 0;
  let grossProfit = 0;
  let totalLoss = 0;
  let nonProfitableBusiness = 0;
  let effectiveCostSum = 0;
  let sumQtyRate = 0;
  let sumQtyBase = 0;

  let arrivedMT = 0;
  let pendingDeliveryMT = 0;

  let saudaPendingCount = 0;
  let temporaryArrivalPendingCount = 0;
  let finalArrivalPendingCount = 0;
  let millInspectionPendingCount = 0;
  let paymentPendingCount = 0;
  let settlementPendingCount = 0;

  let abnormalCount = 0;
  let highDeductionCount = 0;
  let highPremiumCount = 0;
  let highMoistureCount = 0;
  let gradeDownCount = 0;
  let highClaimCount = 0;
  let lossMakingCount = 0;
  let delayedCount = 0;
  let profitableCount = 0;
  let breakEvenCount = 0;

  const poSet = new Set<string>();
  const saudaSet = new Set<string>();
  const supplierSet = new Set<string>();
  const brokerSet = new Set<string>();
  const agencySet = new Set<string>();
  const areaSet = new Set<string>();
  const gradeSet = new Set<string>();
  const premiumMRSet = new Set<string>();

  txns.forEach((t, idx) => {
    totalQuantityMT += t.quantityMT;
    totalPurchaseValue += t.grossPurchaseValue;
    totalBusinessValue += t.grossPurchaseValue;
    effectiveCostSum += t.effectiveCost;
    totalPremium += t.premiumAmount;
    if (t.premiumAmount > 0) {
      if (t.mrNo) {
        t.mrNo.split(',').forEach(m => {
          const trimmed = m.trim();
          if (trimmed) premiumMRSet.add(trimmed);
        });
      } else {
        const mrKey = t.poNo || t.saudaNo || t.txnId || `TXN-${idx}`;
        premiumMRSet.add(mrKey);
      }
    }
    totalDeduction += t.deductionAmount;
    totalClaim += t.claimAmount;
    totalSettlement += t.claimSettled;
    totalPayment += t.paidAmount;
    grossProfit += t.grossProfit;
    
    arrivedMT += t.arrivedWeightMT;
    pendingDeliveryMT += t.pendingWeightMT;

    sumQtyRate += t.quantityMT * t.purchaseRate;
    sumQtyBase += t.quantityMT * t.baseRate;

    if (t.poNo && t.poNo !== 'Pending P.O.' && t.poNo !== '-') poSet.add(t.poNo);
    if (t.saudaNo && t.saudaNo !== '-') saudaSet.add(t.saudaNo);
    if (t.supplier && t.supplier !== 'Unassigned Supplier' && t.supplier !== '-') supplierSet.add(t.supplier);
    if (t.broker && t.broker !== 'Direct' && t.broker !== '-') brokerSet.add(t.broker);
    if (t.agency && t.agency !== '-') agencySet.add(t.agency);
    if (t.area && t.area !== '-') areaSet.add(t.area);
    if (t.grade && t.grade !== '-' && t.grade.toUpperCase() !== 'NORMAL' && t.grade.toUpperCase() !== 'STANDARD GRADE' && t.grade.toUpperCase() !== 'NORMAL GRADE') gradeSet.add(t.grade);

    if (t.grossProfit < 0) {
      totalLoss += Math.abs(t.grossProfit);
      lossMakingCount++;
    } else if (t.grossProfit === 0 || t.profitStatus === 'BREAK-EVEN') {
      breakEvenCount++;
    } else {
      profitableCount++;
    }

    if (t.profitStatus === 'NON-PROFITABLE' || t.profitStatus === 'LOSS') {
      nonProfitableBusiness += t.grossPurchaseValue;
    }

    if (t.pendingWeightMT > 0) saudaPendingCount++;
    if (t.arrivalStatus === 'PENDING') temporaryArrivalPendingCount++;
    if (t.arrivalStatus === 'IN_TRANSIT') finalArrivalPendingCount++;
    if (t.inspectionStatus === 'PENDING') millInspectionPendingCount++;
    if (t.paymentStatus !== 'PAID') paymentPendingCount++;
    if (t.settlementStatus !== 'SETTLED') settlementPendingCount++;

    if (t.isAbnormal) abnormalCount++;
    if (t.deductionPct > 2) highDeductionCount++;
    if (t.premiumRate > 50 || t.premiumAmount > 5000) highPremiumCount++;
    if (t.moisturePct > 18) highMoistureCount++;
    if (t.gradeDownQty > 0) gradeDownCount++;
    if (t.claimAmount > 5000) highClaimCount++;
    if (t.isDelayed) delayedCount++;
  });

  const profitMarginPct = effectiveCostSum > 0 ? (grossProfit / effectiveCostSum) * 100 : 0;
  const weightedPurchaseRate = totalQuantityMT > 0 ? sumQtyRate / totalQuantityMT : 0;
  const weightedBaseRate = totalQuantityMT > 0 ? sumQtyBase / totalQuantityMT : 0;

  return {
    totalBusinessValue,
    totalQuantityMT,
    totalPOCount: poSet.size,
    totalSaudaCount: saudaSet.size,
    totalSupplierCount: supplierSet.size,
    totalBrokerCount: brokerSet.size,
    totalAgencyCount: agencySet.size,
    totalAreaCount: areaSet.size,
    totalGradeCount: gradeSet.size,

    totalPurchaseValue,
    totalPremium,
    premiumMRCount: premiumMRSet.size,
    totalDeduction,
    totalClaim,
    totalSettlement,
    totalPayment,
    grossProfit,
    netProfit: grossProfit - (totalDeduction * 0.1), // Net after standard handling/overhead
    totalLoss,
    nonProfitableBusiness,
    profitMarginPct,
    weightedPurchaseRate,
    weightedBaseRate,

    saudaPendingCount,
    temporaryArrivalPendingCount,
    finalArrivalPendingCount,
    millInspectionPendingCount,
    paymentPendingCount,
    settlementPendingCount,
    pendingDeliveryMT,
    arrivedMT,

    abnormalCount,
    highDeductionCount,
    highPremiumCount,
    highMoistureCount,
    gradeDownCount,
    highClaimCount,
    lossMakingCount,
    delayedCount,
    profitableCount,
    breakEvenCount
  };
}

// Group transactions by any dimension for Priority 2 Analysis
export function groupTransactionsByDimension(
  txns: ReportTransactionLine[],
  dimension: 'broker' | 'agency' | 'area' | 'grade' | 'supplier' | 'month' | 'saudaNo' | 'poNo'
) {
  const map = new Map<string, {
    key: string;
    quantityMT: number;
    purchaseValue: number;
    baseRateValue: number;
    premiumAmount: number;
    deductionAmount: number;
    effectiveCost: number;
    realizationValue: number;
    grossProfit: number;
    txnCount: number;
    sumQtyRate: number;
    sumQtyBase: number;
    sumQtyMoist: number;
  }>();

  txns.forEach(t => {
    const rawVal = t[dimension] || 'UNASSIGNED';
    const key = String(rawVal);
    if (!map.has(key)) {
      map.set(key, {
        key,
        quantityMT: 0,
        purchaseValue: 0,
        baseRateValue: 0,
        premiumAmount: 0,
        deductionAmount: 0,
        effectiveCost: 0,
        realizationValue: 0,
        grossProfit: 0,
        txnCount: 0,
        sumQtyRate: 0,
        sumQtyBase: 0,
        sumQtyMoist: 0
      });
    }

    const cur = map.get(key)!;
    cur.quantityMT += t.quantityMT;
    cur.purchaseValue += t.grossPurchaseValue;
    cur.baseRateValue += t.baseRateValue;
    cur.premiumAmount += t.premiumAmount;
    cur.deductionAmount += t.deductionAmount;
    cur.effectiveCost += t.effectiveCost;
    cur.realizationValue += t.realizationValue;
    cur.grossProfit += t.grossProfit;
    cur.txnCount += 1;
    cur.sumQtyRate += t.quantityMT * t.purchaseRate;
    cur.sumQtyBase += t.quantityMT * t.baseRate;
    cur.sumQtyMoist += t.quantityMT * t.moisturePct;
  });

  const totalAllValue = txns.reduce((acc, t) => acc + t.grossPurchaseValue, 0);

  return Array.from(map.values()).map(g => {
    const avgPurchaseRate = g.quantityMT > 0 ? g.sumQtyRate / g.quantityMT : 0;
    const avgBaseRate = g.quantityMT > 0 ? g.sumQtyBase / g.quantityMT : 0;
    const avgMoisture = g.quantityMT > 0 ? g.sumQtyMoist / g.quantityMT : 0;
    const profitPct = g.effectiveCost > 0 ? (g.grossProfit / g.effectiveCost) * 100 : 0;
    const premiumPct = g.baseRateValue > 0 ? (g.premiumAmount / g.baseRateValue) * 100 : 0;
    const deductionPct = g.purchaseValue > 0 ? (g.deductionAmount / g.purchaseValue) * 100 : 0;
    const businessSharePct = totalAllValue > 0 ? (g.purchaseValue / totalAllValue) * 100 : 0;

    let status: 'PROFITABLE' | 'BREAK-EVEN' | 'NON-PROFITABLE' | 'LOSS' = 'PROFITABLE';
    if (g.grossProfit < -1000) status = 'LOSS';
    else if (Math.abs(g.grossProfit) <= 1000) status = 'BREAK-EVEN';
    else if (profitPct < 1.0) status = 'NON-PROFITABLE';

    return {
      ...g,
      avgPurchaseRate,
      avgBaseRate,
      avgMoisture,
      profitPct,
      premiumPct,
      deductionPct,
      businessSharePct,
      status
    };
  }).sort((a, b) => b.purchaseValue - a.purchaseValue);
}
