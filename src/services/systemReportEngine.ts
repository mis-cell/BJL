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

// Helper to determine financial year
function getFinancialYear(dateStr: string): string {
  if (!dateStr) return '2026-2027';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '2026-2027';
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  if (month >= 4) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

function getYearMonth(dateStr: string): string {
  if (!dateStr) return '2026-09';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '2026-09';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function loadAndProcessSystemReportData(): Promise<{
  allTransactions: ReportTransactionLine[];
  masterLists: SystemReportDataset['masterLists'];
}> {
  try {
    const [
      saudas,
      pos,
      scps,
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
      dbModule.fetchAll('sauda_check_point').catch(() => []),
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
      ? Number(sattaRates[0].base_rate || 5100) 
      : 5100;

    const arrivalByPo = new Map<string, number>();
    (finals || []).forEach((f: any) => {
      const poKey = f.po_no || f.contract_po_no || f.sauda_no;
      if (poKey) {
        const wt = Number(f.electronic_net_weight || f.net_weight || 0);
        arrivalByPo.set(poKey, (arrivalByPo.get(poKey) || 0) + wt);
      }
    });

    const inspectionDeductionByPo = new Map<string, { deduction: number; moisture: number; gradeDown: number }>();
    (inspections || []).forEach((i: any) => {
      const poKey = i.po_no || i.mr_no || i.arrival_no;
      if (poKey) {
        const prev = inspectionDeductionByPo.get(poKey) || { deduction: 0, moisture: 0, gradeDown: 0 };
        const ded = Number(i.deduction_amount || 0);
        const moist = Number(i.actual_moisture || i.claim_moisture || 0);
        const gd = Number(i.grade_down_qty || 0);
        inspectionDeductionByPo.set(poKey, {
          deduction: prev.deduction + ded,
          moisture: Math.max(prev.moisture, moist),
          gradeDown: prev.gradeDown + gd
        });
      }
    });

    const paymentByPo = new Map<string, number>();
    (payments || []).forEach((p: any) => {
      const poKey = p.po_no || p.mr_no || p.voucher_no;
      if (poKey) {
        paymentByPo.set(poKey, (paymentByPo.get(poKey) || 0) + Number(p.paid_amount || 0));
      }
    });

    // Merge Saudas and POs into unified Transaction Line Grain
    const transactionLines: ReportTransactionLine[] = [];
    const sourceRecords = (pos && pos.length > 0) ? pos : (saudas && saudas.length > 0 ? saudas : []);

    sourceRecords.forEach((item: any, idx: number) => {
      const date = item.po_date || item.date || item.created_at?.split('T')[0] || '2026-09-30';
      const saudaNo = item.sauda_no || item.session || `SAUDA-${String(idx + 1).padStart(4, '0')}`;
      const poNo = item.po_no || item.contract_po_no || `PO-${String(idx + 1).padStart(4, '0')}`;
      const supplier = item.supplier || item.party_name || item.supplier_name || 'DIRECT SUPPLIER';
      const broker = item.broker || item.broker_name || 'DIRECT BROKER';
      const agency = item.agency || item.agency_name || 'CENTRAL AGENCY';
      const area = item.area || item.arrival_area || item.location || 'BENGAL CENTRAL';
      const grade = item.grade || item.item_name || 'TD-5';
      const quantityMT = Math.max(0.1, Number(item.total_contract_mt || item.total_wt_in_ton || item.quantity_mt || item.quantity || 10));
      
      const purchaseRate = Number(item.rate || item.rate_qntl || item.purchase_rate || 5120);
      const baseRate = baseRateMap.get(date) || defaultLatestBaseRate;
      const rateVariance = purchaseRate - baseRate;
      const rateVariancePct = baseRate > 0 ? (rateVariance / baseRate) * 100 : 0;
      
      const grossPurchaseValue = quantityMT * purchaseRate * 10; // Qtl conversion (1 MT = 10 Qtl)
      const baseRateValue = quantityMT * baseRate * 10;
      
      // Commercial adjustments
      const premiumRate = Math.max(0, rateVariance);
      const premiumAmount = premiumRate > 0 ? quantityMT * premiumRate * 10 : 0;
      const premiumPct = baseRateValue > 0 ? (premiumAmount / baseRateValue) * 100 : 0;

      const inspInfo = inspectionDeductionByPo.get(poNo) || inspectionDeductionByPo.get(saudaNo) || { deduction: 0, moisture: 16.5, gradeDown: 0 };
      const deductionAmount = inspInfo.deduction || Number(item.deduction_amount || 0);
      const deductionPct = grossPurchaseValue > 0 ? (deductionAmount / grossPurchaseValue) * 100 : 0;
      const moisturePct = inspInfo.moisture || 16.8;
      const gradeDownQty = inspInfo.gradeDown || 0;

      // Landed effective cost
      const effectiveCost = grossPurchaseValue + premiumAmount - deductionAmount;
      
      // Expected realization / selling rate (benchmark based on market realization + margin)
      const realizationRate = Number(item.realization_rate || (baseRate + 150));
      const realizationValue = quantityMT * realizationRate * 10;
      const grossProfit = realizationValue - effectiveCost;
      const profitPct = effectiveCost > 0 ? (grossProfit / effectiveCost) * 100 : 0;

      let profitStatus: ReportTransactionLine['profitStatus'] = 'PROFITABLE';
      if (grossProfit < -500) {
        profitStatus = 'LOSS';
      } else if (Math.abs(grossProfit) <= 500) {
        profitStatus = 'BREAK-EVEN';
      } else if (profitPct < 1.0) {
        profitStatus = 'NON-PROFITABLE';
      }

      // Operational Status
      const arrivedWeightMT = arrivalByPo.get(poNo) || arrivalByPo.get(saudaNo) || 0;
      const pendingWeightMT = Math.max(0, quantityMT - arrivedWeightMT);
      const paidAmount = paymentByPo.get(poNo) || paymentByPo.get(saudaNo) || 0;
      const pendingPayable = Math.max(0, effectiveCost - paidAmount);

      const deliveryToDate = item.delivery_to || item.valid_upto;
      const isDelayed = deliveryToDate ? new Date() > new Date(deliveryToDate) && pendingWeightMT > 0 : false;

      // Abnormal checks
      const abnormalReasons: string[] = [];
      if (moisturePct > 18.5) abnormalReasons.push(`High Moisture (${moisturePct.toFixed(1)}%)`);
      if (rateVariance > 200) abnormalReasons.push(`High Premium (+₹${rateVariance.toFixed(0)})`);
      if (deductionPct > 3) abnormalReasons.push(`High Deduction (${deductionPct.toFixed(1)}%)`);
      if (grossProfit < 0) abnormalReasons.push(`Loss-Making (-₹${Math.abs(grossProfit).toLocaleString()})`);
      if (isDelayed) abnormalReasons.push(`Overdue Delivery (${pendingWeightMT.toFixed(2)} MT pending)`);
      if (gradeDownQty > 0) abnormalReasons.push(`Grade Down (${gradeDownQty} MT)`);

      const isAbnormal = abnormalReasons.length > 0;

      transactionLines.push({
        txnId: `TXN-${String(idx + 1).padStart(5, '0')}`,
        saudaNo,
        poNo,
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
        inspectionStatus: inspInfo.deduction > 0 ? 'COMPLETED' : 'PENDING',
        paymentStatus: paidAmount >= effectiveCost ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING'),
        settlementStatus: pendingPayable === 0 ? 'SETTLED' : 'PENDING',
        arrivedWeightMT,
        pendingWeightMT,
        paidAmount,
        pendingPayable,
        claimAmount: deductionAmount > 5000 ? deductionAmount : 0,
        claimSettled: deductionAmount > 5000 && pendingPayable === 0 ? deductionAmount : 0,
        isDelayed,
        isAbnormal,
        abnormalReasons
      });
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
      if (t.broker) brokerSet.add(t.broker);
      if (t.supplier) supplierSet.add(t.supplier);
      if (t.agency) agencySet.add(t.agency);
      if (t.area) areaSet.add(t.area);
      if (t.grade) gradeSet.add(t.grade);
      if (t.month) monthSet.add(t.month);
      if (t.financialYear) fySet.add(t.financialYear);
      if (t.saudaNo) saudaSet.add(t.saudaNo);
      if (t.poNo) poSet.add(t.poNo);
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

    poSet.add(t.poNo);
    saudaSet.add(t.saudaNo);
    supplierSet.add(t.supplier);
    brokerSet.add(t.broker);
    agencySet.add(t.agency);
    areaSet.add(t.area);
    gradeSet.add(t.grade);

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
