import { dbModule } from './dbModule';

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
      saudas,
      pos,
      saudaDetails,
      poDetails,
      scps,
      scpDetails,
      amad,
      finals,
      inspections,
      payments,
      sattaRates,
      brokers,
      suppliers,
      agencies,
      areas,
      grades
    ] = await Promise.all([
      dbModule.fetchAll('sauda_master').catch(() => []),
      dbModule.fetchAll('purchase_master').catch(() => []),
      dbModule.fetchAll('sauda_quality_details').catch(() => []),
      dbModule.fetchAll('purchase_detail_master').catch(() => []),
      dbModule.fetchAll('sauda_check_point').catch(() => []),
      dbModule.fetchAll('sauda_check_point_details').catch(() => []),
      dbModule.fetchAll('temporary_material_received').catch(() => []),
      dbModule.fetchAll('final_arrival').catch(() => []),
      dbModule.fetchAll('material_inspection').catch(() => []),
      dbModule.fetchAll('payment_master').catch(() => []),
      dbModule.fetchAll('satta_base_rates').catch(() => []),
      dbModule.fetchAll('broker_master').catch(() => []),
      dbModule.fetchAll('supply_master').catch(() => []),
      dbModule.fetchAll('agency_master').catch(() => []),
      dbModule.fetchAll('area_master').catch(() => []),
      dbModule.fetchAll('grade_master').catch(() => [])
    ]);

    // Build lookup maps
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
      const wt = Number(f.electronic_net_weight || f.net_weight || 0);
      if (f.po_no) arrivalByPo.set(f.po_no, (arrivalByPo.get(f.po_no) || 0) + wt);
      if (f.contract_po_no) arrivalByPo.set(f.contract_po_no, (arrivalByPo.get(f.contract_po_no) || 0) + wt);
      if (f.sauda_no) arrivalByPo.set(f.sauda_no, (arrivalByPo.get(f.sauda_no) || 0) + wt);
      if (f.arrival_no) arrivalByPo.set(f.arrival_no, (arrivalByPo.get(f.arrival_no) || 0) + wt);
    });

    // If no final arrival, check temporary material received
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

    // Payments by PO and Sauda
    const paymentByPo = new Map<string, number>();
    (payments || []).forEach((p: any) => {
      const amt = Number(p.paid_amount || (p.payment_status === 'Paid' ? p.total_amount : 0) || 0);
      if (p.po_no) paymentByPo.set(p.po_no, (paymentByPo.get(p.po_no) || 0) + amt);
      if (p.mr_no) paymentByPo.set(p.mr_no, (paymentByPo.get(p.mr_no) || 0) + amt);
      if (p.voucher_no) paymentByPo.set(p.voucher_no, (paymentByPo.get(p.voucher_no) || 0) + amt);
    });

    // Group PO details by po_no
    const poDetailsMap = new Map<string, any[]>();
    (poDetails || []).forEach((item: any) => {
      if (item.po_no) {
        const list = poDetailsMap.get(item.po_no) || [];
        list.push(item);
        poDetailsMap.set(item.po_no, list);
      }
    });

    // Group Sauda details by sauda_id
    const saudaDetailsMap = new Map<string, any[]>();
    (saudaDetails || []).forEach((item: any) => {
      if (item.sauda_id) {
        const list = saudaDetailsMap.get(item.sauda_id) || [];
        list.push(item);
        saudaDetailsMap.set(item.sauda_id, list);
      }
    });

    // Track linked saudas so we don't duplicate
    const linkedSaudaNos = new Set<string>();
    const transactionLines: ReportTransactionLine[] = [];
    let txnCounter = 1;

    // 1. Process all Purchase Orders (Final P.O.)
    (pos || []).forEach((po: any) => {
      const poNo = po.po_no || '';
      const saudaNo = po.contract_po_no || po.sauda_no || '';
      if (saudaNo) linkedSaudaNos.add(saudaNo);

      const date = po.po_date || po.contract_date || po.created_at?.split('T')[0] || '';
      const supplier = po.supplier || po.party_name || po.challan_supplier || '';
      const broker = po.broker || '';
      const agency = po.purchase_unit_name || po.agency || '';
      const area = po.area || '';
      
      const details = poDetailsMap.get(poNo) || [];
      if (details.length > 0) {
        // Multi-item PO lines
        details.forEach((line: any) => {
          const grade = line.grade_code || line.grade || '';
          const quantityMT = Number(line.weight_mt || line.qty || 0);
          const purchaseRate = Number(line.rate_qntl || line.rate || po.b_rate || 0);
          const baseRate = baseRateMap.get(date) || Number(po.b_rate || defaultLatestBaseRate || purchaseRate);
          const rateVariance = purchaseRate - baseRate;
          const rateVariancePct = baseRate > 0 ? (rateVariance / baseRate) * 100 : 0;
          const grossPurchaseValue = quantityMT * purchaseRate * 10;
          const baseRateValue = quantityMT * baseRate * 10;
          const premiumRate = Math.max(0, rateVariance);
          const premiumAmount = premiumRate > 0 ? quantityMT * premiumRate * 10 : 0;
          const premiumPct = baseRateValue > 0 ? (premiumAmount / baseRateValue) * 100 : 0;

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
          if (grossProfit < -100) {
            profitStatus = 'LOSS';
          } else if (Math.abs(grossProfit) <= 100) {
            profitStatus = 'BREAK-EVEN';
          } else if (profitPct < 1.0) {
            profitStatus = 'NON-PROFITABLE';
          }

          const arrivedWeightMT = arrivalByPo.get(poNo) || arrivalByPo.get(saudaNo) || 0;
          const pendingWeightMT = Math.max(0, quantityMT - arrivedWeightMT);
          const paidAmount = paymentByPo.get(poNo) || paymentByPo.get(saudaNo) || 0;
          const pendingPayable = Math.max(0, effectiveCost - paidAmount);

          const deliveryToDate = po.delivery_to;
          const isDelayed = deliveryToDate ? new Date() > new Date(deliveryToDate) && pendingWeightMT > 0 : false;

          const abnormalReasons: string[] = [];
          if (moisturePct > 18.0) abnormalReasons.push(`High Moisture (${moisturePct.toFixed(1)}%)`);
          if (rateVariance > 200) abnormalReasons.push(`High Premium (+₹${rateVariance.toFixed(0)})`);
          if (deductionPct > 3) abnormalReasons.push(`High Deduction (${deductionPct.toFixed(1)}%)`);
          if (grossProfit < 0) abnormalReasons.push(`Loss-Making (-₹${Math.abs(grossProfit).toLocaleString()})`);
          if (isDelayed) abnormalReasons.push(`Overdue Delivery (${pendingWeightMT.toFixed(2)} MT pending)`);
          if (gradeDownQty > 0) abnormalReasons.push(`Grade Down (${gradeDownQty} MT)`);

          transactionLines.push({
            txnId: `TXN-${String(txnCounter++).padStart(5, '0')}`,
            saudaNo: saudaNo || poNo,
            poNo,
            date,
            month: getYearMonth(date),
            financialYear: getFinancialYear(date),
            supplier: supplier || 'Unassigned Supplier',
            broker: broker || 'Direct',
            agency: agency || '-',
            area: area || '-',
            grade: grade || 'TD-5',
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
        // Single PO entry
        const grade = po.po_type || po.marks || 'Standard';
        const quantityMT = Number(po.total_contract_mt || 0);
        const purchaseRate = Number(po.b_rate || 0);
        const baseRate = baseRateMap.get(date) || Number(po.b_rate || defaultLatestBaseRate || purchaseRate);
        const rateVariance = purchaseRate - baseRate;
        const rateVariancePct = baseRate > 0 ? (rateVariance / baseRate) * 100 : 0;
        const grossPurchaseValue = quantityMT * purchaseRate * 10;
        const baseRateValue = quantityMT * baseRate * 10;
        const premiumRate = Math.max(0, rateVariance);
        const premiumAmount = premiumRate > 0 ? quantityMT * premiumRate * 10 : 0;
        const premiumPct = baseRateValue > 0 ? (premiumAmount / baseRateValue) * 100 : 0;

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
        if (grossProfit < -100) {
          profitStatus = 'LOSS';
        } else if (Math.abs(grossProfit) <= 100) {
          profitStatus = 'BREAK-EVEN';
        } else if (profitPct < 1.0) {
          profitStatus = 'NON-PROFITABLE';
        }

        const arrivedWeightMT = arrivalByPo.get(poNo) || arrivalByPo.get(saudaNo) || 0;
        const pendingWeightMT = Math.max(0, quantityMT - arrivedWeightMT);
        const paidAmount = paymentByPo.get(poNo) || paymentByPo.get(saudaNo) || 0;
        const pendingPayable = Math.max(0, effectiveCost - paidAmount);

        const deliveryToDate = po.delivery_to;
        const isDelayed = deliveryToDate ? new Date() > new Date(deliveryToDate) && pendingWeightMT > 0 : false;

        const abnormalReasons: string[] = [];
        if (moisturePct > 18.0) abnormalReasons.push(`High Moisture (${moisturePct.toFixed(1)}%)`);
        if (rateVariance > 200) abnormalReasons.push(`High Premium (+₹${rateVariance.toFixed(0)})`);
        if (deductionPct > 3) abnormalReasons.push(`High Deduction (${deductionPct.toFixed(1)}%)`);
        if (grossProfit < 0) abnormalReasons.push(`Loss-Making (-₹${Math.abs(grossProfit).toLocaleString()})`);
        if (isDelayed) abnormalReasons.push(`Overdue Delivery (${pendingWeightMT.toFixed(2)} MT pending)`);
        if (gradeDownQty > 0) abnormalReasons.push(`Grade Down (${gradeDownQty} MT)`);

        transactionLines.push({
          txnId: `TXN-${String(txnCounter++).padStart(5, '0')}`,
          saudaNo: saudaNo || poNo,
          poNo,
          date,
          month: getYearMonth(date),
          financialYear: getFinancialYear(date),
          supplier: supplier || 'Unassigned Supplier',
          broker: broker || 'Direct',
          agency: agency || '-',
          area: area || '-',
          grade: grade || '-',
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

    // 2. Process Saudas that haven't been converted to a PO yet
    (saudas || []).forEach((sauda: any) => {
      const saudaNo = sauda.sauda_no || '';
      if (!saudaNo || linkedSaudaNos.has(saudaNo)) return; // Already linked to a PO

      const date = sauda.date || sauda.created_at?.split('T')[0] || '';
      const supplier = sauda.supplier || sauda.party_name || sauda.challan_supplier || '';
      const broker = sauda.broker || '';
      const agency = sauda.agency || '';
      const area = sauda.area || '';
      const details = saudaDetailsMap.get(sauda.sauda_id) || [];

      if (details.length > 0) {
        details.forEach((line: any) => {
          const grade = line.grade_code || line.grade || sauda.marks || '';
          const quantityMT = Number(line.qty || 0);
          const purchaseRate = Number(line.rs || sauda.b_rate || 0);
          const baseRate = baseRateMap.get(date) || Number(sauda.b_rate || defaultLatestBaseRate || purchaseRate);
          const rateVariance = purchaseRate - baseRate;
          const rateVariancePct = baseRate > 0 ? (rateVariance / baseRate) * 100 : 0;
          const grossPurchaseValue = quantityMT * purchaseRate * 10;
          const baseRateValue = quantityMT * baseRate * 10;
          const premiumRate = Math.max(0, rateVariance);
          const premiumAmount = premiumRate > 0 ? quantityMT * premiumRate * 10 : 0;
          const premiumPct = baseRateValue > 0 ? (premiumAmount / baseRateValue) * 100 : 0;

          const inspInfo = inspectionDeductionByPo.get(saudaNo) || { deduction: 0, moisture: 0, gradeDown: 0 };
          const deductionAmount = inspInfo.deduction;
          const deductionPct = grossPurchaseValue > 0 ? (deductionAmount / grossPurchaseValue) * 100 : 0;
          const moisturePct = inspInfo.moisture;
          const gradeDownQty = inspInfo.gradeDown;

          const effectiveCost = grossPurchaseValue + premiumAmount - deductionAmount;
          const realizationRate = Number(sauda.realization_rate || baseRate || purchaseRate);
          const realizationValue = quantityMT * realizationRate * 10;
          const grossProfit = realizationValue - effectiveCost;
          const profitPct = effectiveCost > 0 ? (grossProfit / effectiveCost) * 100 : 0;

          let profitStatus: ReportTransactionLine['profitStatus'] = 'PROFITABLE';
          if (grossProfit < -100) profitStatus = 'LOSS';
          else if (Math.abs(grossProfit) <= 100) profitStatus = 'BREAK-EVEN';
          else if (profitPct < 1.0) profitStatus = 'NON-PROFITABLE';

          const arrivedWeightMT = arrivalByPo.get(saudaNo) || 0;
          const pendingWeightMT = Math.max(0, quantityMT - arrivedWeightMT);
          const paidAmount = paymentByPo.get(saudaNo) || 0;
          const pendingPayable = Math.max(0, effectiveCost - paidAmount);

          const deliveryToDate = sauda.shipment_date;
          const isDelayed = deliveryToDate ? new Date() > new Date(deliveryToDate) && pendingWeightMT > 0 : false;

          const abnormalReasons: string[] = [];
          if (moisturePct > 18.0) abnormalReasons.push(`High Moisture (${moisturePct.toFixed(1)}%)`);
          if (rateVariance > 200) abnormalReasons.push(`High Premium (+₹${rateVariance.toFixed(0)})`);
          if (deductionPct > 3) abnormalReasons.push(`High Deduction (${deductionPct.toFixed(1)}%)`);
          if (grossProfit < 0) abnormalReasons.push(`Loss-Making (-₹${Math.abs(grossProfit).toLocaleString()})`);
          if (isDelayed) abnormalReasons.push(`Overdue Delivery (${pendingWeightMT.toFixed(2)} MT pending)`);
          if (gradeDownQty > 0) abnormalReasons.push(`Grade Down (${gradeDownQty} MT)`);

          transactionLines.push({
            txnId: `TXN-${String(txnCounter++).padStart(5, '0')}`,
            saudaNo,
            poNo: 'Pending P.O.',
            date,
            month: getYearMonth(date),
            financialYear: getFinancialYear(date),
            supplier: supplier || 'Unassigned Supplier',
            broker: broker || 'Direct',
            agency: agency || '-',
            area: area || '-',
            grade: grade || '-',
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
        const grade = sauda.marks || 'Standard';
        const quantityMT = Number(sauda.total_wt_in_ton || 0);
        const purchaseRate = Number(sauda.b_rate || 0);
        const baseRate = baseRateMap.get(date) || Number(sauda.b_rate || defaultLatestBaseRate || purchaseRate);
        const rateVariance = purchaseRate - baseRate;
        const rateVariancePct = baseRate > 0 ? (rateVariance / baseRate) * 100 : 0;
        const grossPurchaseValue = quantityMT * purchaseRate * 10;
        const baseRateValue = quantityMT * baseRate * 10;
        const premiumRate = Math.max(0, rateVariance);
        const premiumAmount = premiumRate > 0 ? quantityMT * premiumRate * 10 : 0;
        const premiumPct = baseRateValue > 0 ? (premiumAmount / baseRateValue) * 100 : 0;

        const inspInfo = inspectionDeductionByPo.get(saudaNo) || { deduction: 0, moisture: 0, gradeDown: 0 };
        const deductionAmount = inspInfo.deduction;
        const deductionPct = grossPurchaseValue > 0 ? (deductionAmount / grossPurchaseValue) * 100 : 0;
        const moisturePct = inspInfo.moisture;
        const gradeDownQty = inspInfo.gradeDown;

        const effectiveCost = grossPurchaseValue + premiumAmount - deductionAmount;
        const realizationRate = Number(sauda.realization_rate || baseRate || purchaseRate);
        const realizationValue = quantityMT * realizationRate * 10;
        const grossProfit = realizationValue - effectiveCost;
        const profitPct = effectiveCost > 0 ? (grossProfit / effectiveCost) * 100 : 0;

        let profitStatus: ReportTransactionLine['profitStatus'] = 'PROFITABLE';
        if (grossProfit < -100) profitStatus = 'LOSS';
        else if (Math.abs(grossProfit) <= 100) profitStatus = 'BREAK-EVEN';
        else if (profitPct < 1.0) profitStatus = 'NON-PROFITABLE';

        const arrivedWeightMT = arrivalByPo.get(saudaNo) || 0;
        const pendingWeightMT = Math.max(0, quantityMT - arrivedWeightMT);
        const paidAmount = paymentByPo.get(saudaNo) || 0;
        const pendingPayable = Math.max(0, effectiveCost - paidAmount);

        const deliveryToDate = sauda.shipment_date;
        const isDelayed = deliveryToDate ? new Date() > new Date(deliveryToDate) && pendingWeightMT > 0 : false;

        const abnormalReasons: string[] = [];
        if (moisturePct > 18.0) abnormalReasons.push(`High Moisture (${moisturePct.toFixed(1)}%)`);
        if (rateVariance > 200) abnormalReasons.push(`High Premium (+₹${rateVariance.toFixed(0)})`);
        if (deductionPct > 3) abnormalReasons.push(`High Deduction (${deductionPct.toFixed(1)}%)`);
        if (grossProfit < 0) abnormalReasons.push(`Loss-Making (-₹${Math.abs(grossProfit).toLocaleString()})`);
        if (isDelayed) abnormalReasons.push(`Overdue Delivery (${pendingWeightMT.toFixed(2)} MT pending)`);
        if (gradeDownQty > 0) abnormalReasons.push(`Grade Down (${gradeDownQty} MT)`);

        transactionLines.push({
          txnId: `TXN-${String(txnCounter++).padStart(5, '0')}`,
          saudaNo,
          poNo: 'Pending P.O.',
          date,
          month: getYearMonth(date),
          financialYear: getFinancialYear(date),
          supplier: supplier || 'Unassigned Supplier',
          broker: broker || 'Direct',
          agency: agency || '-',
          area: area || '-',
          grade: grade || '-',
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
      if (t.supplier && t.supplier !== 'Unassigned Supplier') supplierSet.add(t.supplier);
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

  txns.forEach(t => {
    totalQuantityMT += t.quantityMT;
    totalPurchaseValue += t.grossPurchaseValue;
    totalBusinessValue += t.grossPurchaseValue;
    effectiveCostSum += t.effectiveCost;
    totalPremium += t.premiumAmount;
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
    if (t.grade && t.grade !== '-') gradeSet.add(t.grade);

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
    if (t.rateVariance > 100) highPremiumCount++;
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
