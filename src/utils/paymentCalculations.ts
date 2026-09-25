import { PaymentDetailColumn, emptyDetailColumn } from '../types/payment.types';
import { calculateSattaDeduction } from '../services/sattaCalculation';

export const getColWtMt = (col?: PaymentDetailColumn): number => {
  if (!col) return 0;
  const arrWt = Number(col.arr_qty_wt) || 0;
  if (arrWt > 0) return arrWt;
  const wtQty = Number(col.wt_quantity) || 0;
  if (wtQty > 0) return wtQty;
  const qty = Number(col.quantity) || 0;
  const phota = Number(col.wt_phota) || 0;
  if (qty > 0 && phota > 0) return qty * phota;
  return 0;
};

// Quantity (Qtl) = Weight (MT) * 10
export const getColQtyQtl = (col?: PaymentDetailColumn): number => {
  const wtMt = getColWtMt(col);
  return Number((wtMt * 10).toFixed(3));
};

// Sett (%) - Populated from Inspection Details Grade Down % Claim (gd_claim), Mill Sett -> Gr. Down percentage (gd_sett), or user edited sett_pct
export const getColSettPct = (col?: PaymentDetailColumn): number => {
  if (!col) return 0;
  if (col.sett_pct !== undefined && col.sett_pct !== null && !isNaN(Number(col.sett_pct)) && Number(col.sett_pct) > 0) {
    return Number(col.sett_pct);
  }
  if (col.gd_claim !== undefined && col.gd_claim !== null && !isNaN(Number(col.gd_claim)) && Number(col.gd_claim) > 0) {
    return Number(col.gd_claim);
  }
  if (col.gd_sett !== undefined && col.gd_sett !== null && !isNaN(Number(col.gd_sett)) && Number(col.gd_sett) > 0) {
    return Number(col.gd_sett);
  }
  if (col.sett_pct !== undefined && col.sett_pct !== null && !isNaN(Number(col.sett_pct))) {
    return Number(col.sett_pct);
  }
  return 0;
};

// Deduction (₹/Qtl) - Calculated from Satta Chart grade differentials:
// Formula: Deduction (₹/Qtl) = |SattaDiff(Contracted Grade) - SattaDiff(Next Lower Grade)| * (Sett % / 100)
export const getColDeduction = (col?: PaymentDetailColumn, dbDiffs?: any[]): number => {
  if (!col) return 0;
  const settPct = getColSettPct(col);
  if (settPct <= 0) return 0;
  const res = calculateSattaDeduction(col, dbDiffs);
  return res.deduction;
};

// Formatted explanation for Satta-based deduction tooltips
export const getColDeductionExplanation = (col?: PaymentDetailColumn, dbDiffs?: any[]): string => {
  if (!col) return '';
  const res = calculateSattaDeduction(col, dbDiffs);
  return res.explanation;
};

// Sett Rate (₹/Qtl) = Original Rate (₹/Qtl) + Premium (₹/Qtl) − Deduction (₹/Qtl)
export const getColSettRate = (col?: PaymentDetailColumn, dbDiffs?: any[]): number => {
  if (!col) return 0;
  const origRate = Number(col.rate_value) || 0;
  const premium = Number(col.premium) || 0;
  const deduction = getColDeduction(col, dbDiffs);
  return Math.max(0, Number((origRate + premium - deduction).toFixed(2)));
};

// Amount (₹) = Quantity (Qtl) * Sett Rate (₹/Qtl)
export const getColAmount = (col?: PaymentDetailColumn, dbDiffs?: any[]): number => {
  if (!col) return 0;
  const qtyQtl = getColQtyQtl(col);
  const settRate = getColSettRate(col, dbDiffs);
  if (qtyQtl <= 0 || settRate <= 0) return 0;
  return Number((qtyQtl * settRate).toFixed(2));
};

// Robust helper to parse grid_details / items from string or array or object
export const parseGridOrItems = (raw: any): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    if (raw === 'undefined' || raw === 'null' || !raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return [parsed];
    } catch (e) {
      return [];
    }
  }
  if (typeof raw === 'object') return [raw];
  return [];
};

// Finds the PO item that strictly corresponds to the given column by Grade code, Grade name, and Agency
export const findMatchedPoItem = (
  col: { grade?: string; agency?: string; area?: string; stock_grade_code?: string },
  poItems: any[],
  masters?: { gradeMasters?: any[]; agencyMasters?: any[] }
): any | null => {
  if (!poItems || poItems.length === 0) return null;

  const colGradeRaw = String(col.grade || '').trim();
  if (!colGradeRaw && !col.stock_grade_code) return null;

  const colAgencyRaw = String(col.agency || '').trim().toUpperCase();
  const colGradeUpper = colGradeRaw.toUpperCase();
  const colGradeNorm = colGradeUpper.replace(/[\s\-_]/g, '');

  const gradeMasters = masters?.gradeMasters || [];

  // Find all candidate names and codes for the column's grade from grade masters
  const colMatchedMasters = gradeMasters.filter(g => {
    const gCode = String(g.grade_code || g.code || g.id || '').trim().toUpperCase();
    const gName = String(g.grade_name || g.name || '').trim().toUpperCase();
    const gNameNorm = gName.replace(/[\s\-_]/g, '');
    return (
      (gCode && (gCode === colGradeUpper || gCode === colGradeNorm)) ||
      (gName && (gName === colGradeUpper || gNameNorm === colGradeNorm)) ||
      (colGradeRaw && String(g.id || '') === colGradeRaw)
    );
  });

  const colNames = new Set<string>();
  const colCodes = new Set<string>();

  if (colGradeUpper) colNames.add(colGradeUpper);
  if (colGradeNorm) colNames.add(colGradeNorm);
  if (col.stock_grade_code) colCodes.add(String(col.stock_grade_code).trim().toUpperCase());

  colMatchedMasters.forEach(g => {
    const gCode = String(g.grade_code || g.code || g.id || '').trim().toUpperCase();
    const gName = String(g.grade_name || g.name || '').trim().toUpperCase();
    const gNameNorm = gName.replace(/[\s\-_]/g, '');
    if (gCode) colCodes.add(gCode);
    if (gName) colNames.add(gName);
    if (gNameNorm) colNames.add(gNameNorm);
  });

  let bestMatch: any = null;
  let bestScore = 0;

  for (const p of poItems) {
    const pCode = String(p.grade_code || p.stock_grade_code || p.receipt_grade_code || p.code || '').trim().toUpperCase();
    const pName = String(p.grade_name || p.grade || p.arrival_grade || p.stock_grade_name || '').trim().toUpperCase();
    const pNameNorm = pName.replace(/[\s\-_]/g, '');

    // Check against masters for PO item
    const pMatchedMasters = gradeMasters.filter(g => {
      const gCode = String(g.grade_code || g.code || g.id || '').trim().toUpperCase();
      const gName = String(g.grade_name || g.name || '').trim().toUpperCase();
      const gNameNorm = gName.replace(/[\s\-_]/g, '');
      return (
        (pCode && (gCode === pCode || String(g.id || '') === pCode)) ||
        (pName && (gName === pName || gNameNorm === pNameNorm))
      );
    });

    const pNames = new Set<string>();
    const pCodes = new Set<string>();

    if (pName) pNames.add(pName);
    if (pNameNorm) pNames.add(pNameNorm);
    if (pCode) pCodes.add(pCode);

    pMatchedMasters.forEach(g => {
      const gCode = String(g.grade_code || g.code || g.id || '').trim().toUpperCase();
      const gName = String(g.grade_name || g.name || '').trim().toUpperCase();
      const gNameNorm = gName.replace(/[\s\-_]/g, '');
      if (gCode) pCodes.add(gCode);
      if (gName) pNames.add(gName);
      if (gNameNorm) pNames.add(gNameNorm);
    });

    // Check for direct Grade match
    let isGradeMatch = false;

    // 1. Code match
    for (const c of colCodes) {
      if (c && pCodes.has(c)) {
        isGradeMatch = true;
        break;
      }
    }

    // 2. Name match
    if (!isGradeMatch) {
      for (const n of colNames) {
        if (n && pNames.has(n)) {
          isGradeMatch = true;
          break;
        }
      }
    }

    // 3. Fallback direct text comparison
    if (!isGradeMatch && colGradeNorm && pNameNorm && colGradeNorm === pNameNorm) {
      isGradeMatch = true;
    }
    if (!isGradeMatch && colGradeUpper && pCode && colGradeUpper === pCode) {
      isGradeMatch = true;
    }

    if (isGradeMatch) {
      let score = 10; // Base score for correct grade match

      // Agency matching bonus
      const pAgency = String(p.agency_name || p.agency || p.agency_code || '').trim().toUpperCase();
      if (colAgencyRaw && pAgency) {
        if (colAgencyRaw === pAgency || pAgency.includes(colAgencyRaw) || colAgencyRaw.includes(pAgency)) {
          score += 5;
        }
      }

      // Quantity/weight presence bonus if multiple identical grades exist
      if (Number(p.quantity || p.weight_mt || p.arr_qty_wt || 0) > 0) {
        score += 1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = p;
      }
    }
  }

  return bestMatch;
};

// Maps raw items or grid details into 4-column breakdown matrix with master lookup resolution
export const mapItemsToDetailCols = (
  rawItems: any,
  defaultRate: number = 0,
  poHeader?: any,
  masters?: {
    gradeMasters?: any[];
    agencyMasters?: any[];
    areaMasters?: any[];
    markaMasters?: any[];
  }
): PaymentDetailColumn[] => {
  const newCols = [emptyDetailColumn(1), emptyDetailColumn(2), emptyDetailColumn(3), emptyDetailColumn(4)];
  const parsedItems = parseGridOrItems(rawItems);

  const gradeList = masters?.gradeMasters || [];
  const agencyList = masters?.agencyMasters || [];
  const areaList = masters?.areaMasters || [];
  const markaList = masters?.markaMasters || [];

  const resolveGrade = (item: any) => {
    const rawCode = item.stock_grade_name || item.grade_name || item.grade || item.arrival_grade || item.quality || item.grade_code || item.stock_grade_code || item.receipt_grade_code || poHeader?.grade_code || poHeader?.grade;
    if (rawCode !== undefined && rawCode !== null && String(rawCode).trim() !== '') {
      const codeStr = String(rawCode).trim();
      const codeUpper = codeStr.toUpperCase();

      const match = gradeList.find(g => {
        const gCode = String(g.grade_code || g.code || g.id || '').trim().toUpperCase();
        const gName = String(g.grade_name || g.name || '').trim().toUpperCase();
        return gCode === codeUpper || gName === codeUpper || String(g.id || '') === codeStr;
      });

      if (match) return match.grade_name || match.name || codeStr;
      return codeStr;
    }
    return '';
  };

  const resolveAgency = (item: any) => {
    const rawCode = item.agency_name || item.agency || item.agency_code || poHeader?.agency_name || poHeader?.agency || poHeader?.agency_code || poHeader?.purchase_unit_name;
    if (rawCode !== undefined && rawCode !== null && String(rawCode).trim() !== '') {
      const codeStr = String(rawCode).trim();
      const codeUpper = codeStr.toUpperCase();

      const match = agencyList.find(a => {
        const aCode = String(a.agency_code || a.code || a.id || '').trim().toUpperCase();
        const aName = String(a.agency_name || a.name || '').trim().toUpperCase();
        return aCode === codeUpper || aName === codeUpper || String(a.id || '') === codeStr;
      });

      if (match) return match.agency_name || match.name || codeStr;
      return codeStr;
    }
    return poHeader?.agency_name || poHeader?.purchase_unit_name || '';
  };

  const resolveArea = (item: any) => {
    const rawCode = item.area_name || item.area || item.area_code || poHeader?.area_code || poHeader?.area || poHeader?.area_name;
    if (rawCode !== undefined && rawCode !== null && String(rawCode).trim() !== '') {
      const codeStr = String(rawCode).trim();
      const codeUpper = codeStr.toUpperCase();

      const match = areaList.find(a => {
        const aCode = String(a.area_code || a.code || a.id || '').trim().toUpperCase();
        const aName = String(a.area_name || a.name || '').trim().toUpperCase();
        return aCode === codeUpper || aName === codeUpper || String(a.id || '') === codeStr;
      });

      if (match) return match.area_name || match.name || codeStr;
      return codeStr;
    }
    return poHeader?.area_name || poHeader?.area || '';
  };

  const resolveMarka = (item: any) => {
    const rawCode = item.marka_code || item.marka_name || item.marka_crop || item.challan_marka_code || item.marka || poHeader?.marka_code || poHeader?.marka;
    if (rawCode !== undefined && rawCode !== null && String(rawCode).trim() !== '') {
      const codeStr = String(rawCode).trim();
      const codeUpper = codeStr.toUpperCase();

      const match = markaList.find(m => {
        const mCode = String(m.marka_code || m.code || m.id || '').trim().toUpperCase();
        const mName = String(m.marka_name || m.name || '').trim().toUpperCase();
        return mCode === codeUpper || mName === codeUpper || String(m.id || '') === codeStr;
      });

      if (match) return match.marka_name || match.name || codeStr;
      return codeStr;
    }
    return item.crop_year || poHeader?.crop_year || '';
  };

  if (parsedItems.length === 0 && poHeader) {
    const grade = resolveGrade(poHeader);
    const agency = resolveAgency(poHeader);
    const area = resolveArea(poHeader);
    const marka = resolveMarka(poHeader);
    const qty = Number(poHeader.total_units || poHeader.units_per_lorry || poHeader.quantity || 0);
    const wt = Number(poHeader.total_contract_mt || poHeader.weight_mt || poHeader.weight_per_lorry || 0);
    const rate = Number(poHeader.b_rate || poHeader.rate_qntl || defaultRate || 0);

    if (grade || area || agency || qty > 0 || wt > 0) {
      const settPct = Number(poHeader.sett_pct ?? 0);
      const origRate = rate;
      const premium = Number(poHeader.premium || 0);
      const deductionRate = Number(((origRate * settPct) / 100).toFixed(2));
      const settRate = Math.max(0, Number((origRate + premium - deductionRate).toFixed(2)));
      const qtyQtl = Number((wt * 10).toFixed(3));
      const amount = Number((qtyQtl * settRate).toFixed(2));

      newCols[0] = {
        ...emptyDetailColumn(1),
        grade,
        area,
        agency,
        marka_crop: marka,
        quantity: qty,
        arr_qty_wt: wt,
        rate_value: rate,
        premium: premium,
        sett_pct: settPct,
        deduction_rate: deductionRate,
        sett_rate: settRate,
        quantity_qtl: qtyQtl,
        amount: amount
      };
      return newCols;
    }
  }

  parsedItems.forEach((item: any, idx: number) => {
    if (idx < 4) {
      const grade = resolveGrade(item);
      const agency = resolveAgency(item);
      const area = resolveArea(item);
      const marka = resolveMarka(item);
      const qty = Number(
        item.quantity !== undefined && item.quantity !== null && item.quantity !== ""
          ? item.quantity
          : (item.quantity_rcpt !== undefined && item.quantity_rcpt !== null && item.quantity_rcpt !== ''
              ? item.quantity_rcpt
              : (item.rcpt !== undefined && item.rcpt !== null && item.rcpt !== ''
                  ? item.rcpt
                  : (item.quantity_chln || item.qty || item.packets || item.units || item.total_units || 0)))
      );
      const wt = Number(
        item.final_receipt_wt !== undefined && item.final_receipt_wt !== null && item.final_receipt_wt !== ''
          ? item.final_receipt_wt
          : (item.netto_pnto !== undefined && item.netto_pnto !== null && item.netto_pnto !== ''
              ? item.netto_pnto
              : (item.netto !== undefined && item.netto !== null && item.netto !== ''
                  ? item.netto
                  : (item.netto_mt !== undefined && item.netto_mt !== null && item.netto_mt !== ''
                      ? item.netto_mt
                      : (item.arr_qty_wt || item.weight_mt || item.weight || item.receipt_gross_wt || item.challan_gross_wt || item.total_wt_in_ton || (item.weight_qtl ? Number(item.weight_qtl) / 10 : 0)))))
      );
      const rate = Number(item.rate_per_mt || item.rate_mt || item.rate_qntl || item.rate || item.rate_value || poHeader?.b_rate || defaultRate || 0);
      const premium = Number(item.premium ?? item.prem ?? item.premium_amount ?? poHeader?.premium ?? 0);

      const gdClaim = Number(item.gd_claim ?? item.grade_down_claim ?? item.claim_grade_down ?? item.claim_gr_down ?? item.grade_down_act ?? item.actual_grade_down ?? 0);
      const gdSett = Number(item.gd_sett ?? item.settlement_grade_down ?? item.grade_down_sett ?? item.mill_sett_gr_down ?? 0);
      
      let settPct = 0;
      if (item.sett_pct !== undefined && item.sett_pct !== null && item.sett_pct !== "" && !isNaN(Number(item.sett_pct)) && Number(item.sett_pct) > 0) {
        settPct = Number(item.sett_pct);
      } else if (gdClaim > 0) {
        settPct = gdClaim;
      } else if (gdSett > 0) {
        settPct = gdSett;
      } else if (item.sett_pct !== undefined && item.sett_pct !== null && item.sett_pct !== "" && !isNaN(Number(item.sett_pct))) {
        settPct = Number(item.sett_pct);
      }

      const origRate = rate;
      const colCandidate: PaymentDetailColumn = {
        ...emptyDetailColumn(idx + 1),
        grade,
        area,
        agency,
        marka_crop: marka,
        rate_value: origRate,
        premium: premium,
        sett_pct: settPct,
        gd_claim: gdClaim,
        gd_sett: gdSett,
        arr_qty_wt: wt,
        quantity: qty
      };
      const calculatedDed = getColDeduction(colCandidate);
      const deductionRate = (settPct > 0 || calculatedDed > 0)
        ? calculatedDed
        : Number(item.deduction_rate !== undefined && item.deduction_rate !== null && item.deduction_rate !== "" ? item.deduction_rate : 0);
      const settRate = Math.max(0, Number((origRate + premium - deductionRate).toFixed(2)));
      const qtyQtl = Number((wt * 10).toFixed(3));
      const amount = Number((qtyQtl * settRate).toFixed(2));

      newCols[idx] = {
        ...emptyDetailColumn(idx + 1),
        grade,
        area,
        agency,
        marka_crop: marka,
        quantity: qty,
        arr_qty_wt: wt,
        rate_value: rate,
        premium: premium,
        sett_pct: settPct,
        deduction_rate: deductionRate,
        sett_rate: settRate,
        quantity_qtl: qtyQtl,
        amount: amount,
        gd_claim: gdClaim,
        gd_sett: gdSett,
        moist_claim: Number(item.moist_claim ?? item.moisture_claim ?? item.claim_moisture ?? item.moisture_act ?? 0),
        moist_sett: Number(item.moist_sett ?? item.settlement_moisture ?? item.moisture_sett ?? 0),
        dust_claim: Number(item.dust_claim ?? item.dust_claim ?? item.claim_dust ?? item.dust_act ?? 0),
        dust_sett: Number(item.dust_sett ?? item.settlement_dust ?? item.dust_sett ?? 0),
        ncv_claim: Number(item.ncv_claim ?? item.ncv_claim ?? item.claim_ncv ?? item.ncv_act ?? 0),
        ncv_sett: Number(item.ncv_sett ?? item.settlement_ncv ?? item.ncv_sett ?? 0),
        po_grade_claim: Number(item.po_grade_claim ?? item.delivery_claim ?? 0),
        po_grade_sett: Number(item.po_grade_sett ?? 0),
      };
    }
  });

  return newCols;
};

/* Helper to retrieve all verified arrivals / M.Rs linked to a specific P.O */
export function getLinkedMrsForPo(poOrPoNo: any, arrivalsList: any[] = []): any[] {
  if (!poOrPoNo || !arrivalsList || arrivalsList.length === 0) return [];

  const targetPoNo = typeof poOrPoNo === 'string'
    ? poOrPoNo
    : (poOrPoNo.po_no || poOrPoNo.ptf_no || poOrPoNo.sauda_no || poOrPoNo.contract_po_no || '');

  const cleanTarget = String(targetPoNo).trim().toUpperCase();
  if (!cleanTarget || cleanTarget === 'N/A') return [];

  const targetSuffix = cleanTarget.split('/').pop() || '';

  return arrivalsList.filter(arr => {
    const arrPo1 = String(arr.po_no || '').trim().toUpperCase();
    const arrPo2 = String(arr.mill_po_no || '').trim().toUpperCase();
    const arrPo3 = String(arr.contract_po_no || arr.sauda_no || arr.po_contract || '').trim().toUpperCase();
    
    const candidates = [arrPo1, arrPo2, arrPo3].filter(Boolean);
    for (const cand of candidates) {
      if (cand === cleanTarget) return true;
      if (cand.includes(cleanTarget) || cleanTarget.includes(cand)) return true;
      const candSuffix = cand.split('/').pop() || '';
      if (targetSuffix.length >= 3 && (candSuffix === targetSuffix || cand.includes(targetSuffix))) {
        return true;
      }
    }
    return false;
  });
}

/* Helper to verify if an M.R has already been processed in payment_master */
export function isMrAlreadyProcessed(
  mrNoOrArrival: string | any,
  paymentList: any[],
  currentVoucherNo?: string,
  poNo?: string
): { isPaid: boolean; paidPayment?: any } {
  if (!mrNoOrArrival || !paymentList || paymentList.length === 0) {
    return { isPaid: false };
  }

  const mrStr = typeof mrNoOrArrival === 'string'
    ? mrNoOrArrival
    : (mrNoOrArrival.mr_no || mrNoOrArrival.final_arrival_no || mrNoOrArrival.arrival_no || '');
  
  const cleanMr = String(mrStr).trim().toUpperCase();
  if (!cleanMr || cleanMr === 'N/A') {
    return { isPaid: false };
  }

  const cleanPo = poNo
    ? String(poNo).trim().toUpperCase()
    : (typeof mrNoOrArrival === 'object' ? String(mrNoOrArrival.po_no || mrNoOrArrival.mill_po_no || '').trim().toUpperCase() : '');

  const matchedPayment = paymentList.find(p => {
    // If editing, ignore current voucher
    if (currentVoucherNo && String(p.voucher_no || '').trim().toUpperCase() === String(currentVoucherNo).trim().toUpperCase()) {
      return false;
    }

    // Exclude cancelled or rejected payments
    const pStatus = String(p.status || '').toLowerCase().trim();
    if (pStatus === 'cancelled' || pStatus === 'rejected') {
      return false;
    }

    const pMr = String(p.mr_no || p.arrival_no || '').trim().toUpperCase();
    if (!pMr) return false;

    // Direct MR match
    const isMrMatch = pMr === cleanMr;

    if (isMrMatch) {
      if (cleanPo) {
        const pPo = String(p.po_no || '').trim().toUpperCase();
        if (pPo) {
          const pPoSuffix = pPo.split('/').pop() || '';
          const cleanPoSuffix = cleanPo.split('/').pop() || '';
          if (pPo === cleanPo || pPo.includes(cleanPo) || cleanPo.includes(pPo) || (cleanPoSuffix.length >= 3 && pPoSuffix === cleanPoSuffix)) {
            return true;
          }
        }
      }
      return true;
    }

    return false;
  });

  return {
    isPaid: Boolean(matchedPayment),
    paidPayment: matchedPayment
  };
}

/* Helper to evaluate if a P.O is eligible for payment based on both P.O status AND remaining unpaid M.R records */
export function isPoEligibleForPayment(
  po: any,
  arrivalsList: any[] = [],
  paymentsList: any[] = [],
  currentVoucherNo?: string
): boolean {
  if (!po) return false;

  const statusStr = String(po.status || '').toLowerCase().trim();
  const passMismatchStr = String(po.pass_mismatch || po.pass_status || po.mismatch_status || po.quality_status || '').toUpperCase().trim();
  
  const isCompleted = (statusStr === 'completed' || statusStr === 'closed' || statusStr === 'final' || statusStr === 'moved_to_final' || statusStr === 'settled' || (po.ptf_no && String(po.ptf_no).trim() && String(po.ptf_no).trim() !== 'N/A'));
  
  let isPass = false;
  if (passMismatchStr === 'PASS') isPass = true;
  else if (po.mismatch_cleared === true || String(po.mismatch_cleared) === 'true') isPass = true;
  else if (po.satta_dispute_approved === true || String(po.satta_dispute_approved) === 'true') isPass = true;
  else if (statusStr === 'final' || statusStr === 'moved_to_final' || statusStr === 'completed' || statusStr === 'settled') isPass = true;
  else if (po.ptf_no && String(po.ptf_no).trim() && String(po.ptf_no).trim() !== 'N/A') isPass = true;
  else if (statusStr !== 'mismatch' && statusStr !== 'dispute' && po.mismatch_cleared !== false) isPass = true;

  if (!isCompleted || !isPass) {
    return false;
  }

  const poNo = String(po.po_no || po.ptf_no || po.sauda_no || po.contract_po_no || '').trim().toUpperCase();

  // Step 1: Find all verified M.R records linked with this P.O
  const linkedMrs = getLinkedMrsForPo(po, arrivalsList);

  if (linkedMrs.length > 0) {
    // Step 2 & 3: Check each M.R against payment_master and exclude paid ones
    const unpaidMrs = linkedMrs.filter(mr => {
      const check = isMrAlreadyProcessed(mr, paymentsList, currentVoucherNo, poNo);
      return !check.isPaid;
    });

    // Step 4: If remaining eligible M.R. count > 0 -> Show P.O (Eligible: true)
    return unpaidMrs.length > 0;
  }

  // If no arrivals linked in the list yet, check if a completed payment exists for this P.O
  if (paymentsList && paymentsList.length > 0 && poNo) {
    const directPayment = paymentsList.find(p => {
      if (currentVoucherNo && String(p.voucher_no || '').trim().toUpperCase() === String(currentVoucherNo).trim().toUpperCase()) {
        return false;
      }
      const pStatus = String(p.status || '').toLowerCase().trim();
      if (pStatus === 'cancelled' || pStatus === 'rejected') return false;

      const pPo = String(p.po_no || '').trim().toUpperCase();
      if (pPo === poNo) return true;
      const pPoSuffix = pPo.split('/').pop() || '';
      const poSuffix = poNo.split('/').pop() || '';
      return (poSuffix.length >= 3 && pPoSuffix === poSuffix);
    });

    if (directPayment) {
      return false;
    }
  }

  return true;
}
