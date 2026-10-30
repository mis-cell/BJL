import { supabase } from '../lib/supabase';
import { dbModule } from './dbModule';
import { 
  SettlementDetailColumn, 
  emptyDetailColumn 
} from '../types/settlement.types';
import { findMatchedPoItem, parseGridOrItems, getColSettRate } from '../utils/paymentCalculations';
import { getCachedSattaDiffs } from './sattaCalculation';

export const resolveGradeName = (raw: any, overrideList?: any[]): string => {
  if (!raw && raw !== 0) return '';
  const str = String(raw).trim();
  if (!str) return '';
  const list = overrideList || [];
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

export const resolveAgencyName = (raw: any, overrideList?: any[]): string => {
  if (!raw && raw !== 0) return '';
  const str = String(raw).trim();
  if (!str) return '';
  const list = overrideList || [];
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

export const resolveMarkaName = (raw: any, overrideList?: any[]): string => {
  if (!raw && raw !== 0) return '';
  const str = String(raw).trim();
  if (!str) return '';
  const list = overrideList || [];
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

export const resolveAreaName = (raw: any, overrideList?: any[]): string => {
  if (!raw && raw !== 0) return '';
  const str = String(raw).trim();
  if (!str) return '';
  const list = overrideList || [];
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

export const buildSettlementCol = (
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
  inspItem?: any,
  payDetailItem?: any
): SettlementDetailColumn => {
  const col = emptyDetailColumn(idx);
  if (!item && !pDet && !inspItem) return col;

  // 1. Grade
  const poGrade = pDet?.grade_name || pDet?.quality || (pDet?.grade_code ? resolveGradeName(pDet.grade_code, gList) : '') || pDet?.grade || '';
  const arrivalGrade = 
    inspItem?.stock_grade_name || inspItem?.arrival_grade || inspItem?.grade || inspItem?.grade_name || 
    inspItem?.stock_grade_code || inspItem?.grade_code ||
    item?.stock_grade_name || item?.arrival_grade || item?.grade || item?.grade_name || item?.receipt_grade_name || 
    item?.grade_code || item?.stock_grade_code || item?.receipt_grade_code || item?.challan_grade_name || 
    item?.quality || item?.stock_grade || '';
  
  const rawGrade = arrivalGrade || poGrade;
  col.grade = resolveGradeName(rawGrade, gList) || rawGrade || '';

  // 2. Area
  const rawArea = 
    inspItem?.area || inspMaster?.arrival_area_name || 
    item?.area || item?.arrival_area_name || faMaster?.arrival_area_name || 
    pDet?.area || poData?.area || '';
  
  col.area = resolveAreaName(rawArea, arList) || rawArea || '';

  // 3. Agency
  const rawAgency = 
    inspItem?.agency_name || inspItem?.agency || inspItem?.agency_code || 
    item?.agency_name || item?.agency || item?.agency_code || 
    pDet?.agency_name || pDet?.agency_code || pDet?.agency || 
    faMaster?.agency_name || faMaster?.agency || faMaster?.grid_details?.[0]?.agency_name || 
    inspMaster?.agency_name || poData?.agency || '';
  
  col.agency = resolveAgencyName(rawAgency, agList) || rawAgency || '';

  // 4. Marka / Crop
  const rawMarka = 
    inspItem?.marka_name || inspItem?.marka || inspItem?.marka_code || 
    item?.marka_name || item?.challan_marka_name || item?.marka || item?.marka_code || item?.challan_marka_code || 
    pDet?.marka_name || pDet?.marka_code || pDet?.marka || 
    faMaster?.marka || faMaster?.grid_details?.[0]?.challan_marka_name || inspMaster?.marka || poData?.marks || '';
  const resolvedMarka = resolveMarkaName(rawMarka, mList) || rawMarka || '';

  const rawCrop = 
    inspItem?.crop_year || inspItem?.crop || inspMaster?.crop_year || faMaster?.crop_year || 
    item?.crop_year || item?.crop || pDet?.crop_year || poData?.crop_year || faMaster?.grid_details?.[0]?.crop_year || '2026-27';

  col.marka_crop = (resolvedMarka ? resolvedMarka : '') + 
    (rawCrop ? (resolvedMarka ? ` / ${rawCrop}` : rawCrop) : '');

  // 5. Quantity (Bales)
  const rawQty = (inspItem || item || payDetailItem) ? (
    payDetailItem?.quantity ||
    inspItem?.quantity || inspItem?.bales ||
    item?.quantity || item?.quantity_rcpt || item?.quantity_chln || item?.qty || item?.packets || item?.total_packets || item?.bales || 0
  ) : 0;
  
  col.quantity = Number(rawQty) || 0;

  // 6. Arrival Quantity / Weight
  let rawWt = 0;
  if (payDetailItem?.arr_qty_wt !== undefined && payDetailItem?.arr_qty_wt !== null && Number(payDetailItem.arr_qty_wt) > 0) {
    rawWt = Number(payDetailItem.arr_qty_wt);
  } else if (inspItem || item) {
    if (inspItem?.final_receipt_wt !== undefined && inspItem?.final_receipt_wt !== null && Number(inspItem.final_receipt_wt) > 0) {
      rawWt = Number(inspItem.final_receipt_wt);
    } else if (item?.final_receipt_wt !== undefined && item?.final_receipt_wt !== null && Number(item.final_receipt_wt) > 0) {
      rawWt = Number(item.final_receipt_wt);
    } else if (inspItem?.receipt_gross_wt && Number(inspItem.receipt_gross_wt) > 0) {
      rawWt = Number(inspItem.receipt_gross_wt);
    } else if (inspItem?.challan_gross_wt && Number(inspItem.challan_gross_wt) > 0) {
      rawWt = Number(inspItem.challan_gross_wt);
    } else if (item?.receipt_gross_wt && Number(item.receipt_gross_wt) > 0) {
      rawWt = Number(item.receipt_gross_wt);
    } else if (item?.weight && Number(item.weight) > 0) {
      rawWt = Number(item.weight);
    } else if (item?.arr_qty_wt && Number(item.arr_qty_wt) > 0) {
      rawWt = Number(item.arr_qty_wt);
    } else if (inspItem?.weight && Number(inspItem.weight) > 0) {
      rawWt = Number(inspItem.weight);
    }
  }
  
  col.arr_qty_wt = col.quantity > 0 || rawWt > 0 ? (Number(rawWt) || 0) : 0;
  col.min_qty_wt = col.arr_qty_wt > 0 ? Number((col.arr_qty_wt * 0.97).toFixed(3)) : 0;

  // 7. Rate (Original PO Rate) & Premium
  const rawRate =
    (payDetailItem?.rate_value && Number(payDetailItem.rate_value) > 0 ? Number(payDetailItem.rate_value) : 0) ||
    pDet?.rate_qntl || pDet?.rate_per_mt || pDet?.rate || pDet?.rate_mt ||
    poData?.rate_qntl || poData?.rate_mt || poData?.b_rate ||
    inspItem?.rate || inspItem?.rate_qntl ||
    item?.rate_value || item?.rate || item?.rate_qntl || item?.recon_rate_mt || 0;

  col.rate_value = Number(rawRate) || 0;
  if (!col.rate_value || col.rate_value === 0) {
    const fallbackRate = Number(poData?.b_rate || poData?.rate_qntl || poData?.rate_mt || 0);
    if (fallbackRate > 0) {
      col.rate_value = fallbackRate;
    }
  }

  // Helper to extract clean numeric premium rate from various column or master aliases
  const parsePremValue = (raw: any): number => {
    if (raw === undefined || raw === null) return 0;
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
    const str = String(raw).trim();
    if (!str || str === '-' || /^(no|false)$/i.test(str)) return 0;
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const linePremium =
    parsePremValue(payDetailItem?.premium) ||
    parsePremValue(inspItem?.premium) ||
    parsePremValue(inspItem?.premium_rate) ||
    parsePremValue(item?.premium) ||
    parsePremValue(pDet?.premium) ||
    parsePremValue(pDet?.premium_amount) ||
    parsePremValue(pDet?.prem) ||
    parsePremValue(inspMaster?.summary_premium_amount) ||
    parsePremValue(inspMaster?.premium) ||
    parsePremValue(faMaster?.premium) ||
    parsePremValue(poData?.premium) ||
    parsePremValue(poData?.summary_premium_amount) ||
    0;

  col.premium = linePremium;

  col.unit = String(inspItem?.unit || item?.unit || faMaster?.unit_name || pDet?.unit || 'BALES').trim().toUpperCase();

  // 8. Wt/Quantity
  const rawWtKg = col.arr_qty_wt > 0 ? (col.arr_qty_wt <= 50 ? col.arr_qty_wt * 1000 : col.arr_qty_wt) : 0;
  col.wt_quantity = col.quantity > 0 && rawWtKg > 0 ? Math.round(rawWtKg / col.quantity) : (Number(inspItem?.marks_phota || item?.marks_phota) || 0);
  col.wt_phota = col.wt_quantity;

  // 9. Deductions / Claims Mappings
  const rawGdSett = inspItem?.settlement_grade_down ?? item?.settlement_grade_down ?? 
    inspItem?.grade_down_sett ?? item?.grade_down_sett ?? 
    inspItem?.gd_sett ?? item?.gd_sett ?? 
    inspItem?.sett_grade_down ?? item?.sett_grade_down;
  if (rawGdSett != null) col.gd_sett = Number(rawGdSett);

  const rawGdClaim = inspItem?.grade_down_claim ?? item?.grade_down_claim ?? 
    inspItem?.claim_grade_down ?? item?.claim_grade_down ?? 
    inspItem?.grade_down_act ?? item?.grade_down_act ?? 
    inspItem?.actual_grade_down ?? item?.actual_grade_down ?? 
    inspItem?.gd_claim ?? item?.gd_claim;
  if (rawGdClaim != null) col.gd_claim = Number(rawGdClaim);
  else if (inspMaster?.claim_grade_down != null) col.gd_claim = Number(inspMaster.claim_grade_down);

  const rawMoistSett =
    payDetailItem?.moist_sett ?? payDetailItem?.moisture_sett ?? payDetailItem?.settlement_moisture ??
    inspItem?.settlement_moisture ?? item?.settlement_moisture ?? 
    inspItem?.moisture_sett ?? item?.moisture_sett ?? 
    inspItem?.moist_sett ?? item?.moist_sett ?? 
    inspItem?.sett_moisture ?? item?.sett_moisture ??
    inspMaster?.settlement_moisture;
  if (rawMoistSett != null) col.moist_sett = Number(rawMoistSett);

  const rawMoistClaim =
    payDetailItem?.moist ?? payDetailItem?.moist_claim ?? payDetailItem?.moisture_claim ?? payDetailItem?.claim_moisture ??
    inspItem?.moisture_claim ?? item?.moisture_claim ?? 
    inspItem?.claim_moisture ?? item?.claim_moisture ?? 
    inspItem?.moist_claim ?? item?.moist_claim ??
    inspMaster?.claim_moisture;
  if (rawMoistClaim != null) col.moist_claim = Number(rawMoistClaim);
  else if (inspMaster?.claim_moisture != null) col.moist_claim = Number(inspMaster.claim_moisture);

  const rawDustSett = inspItem?.settlement_dust ?? item?.settlement_dust ?? 
    inspItem?.dust_sett ?? item?.dust_sett ?? 
    inspItem?.sett_dust ?? item?.sett_dust;
  if (rawDustSett != null) col.dust_sett = Number(rawDustSett);

  const rawDustClaim = inspItem?.dust_claim ?? item?.dust_claim ?? 
    inspItem?.claim_dust ?? item?.claim_dust ?? 
    inspItem?.dust_act ?? item?.dust_act ?? 
    inspItem?.actual_dust ?? item?.actual_dust ?? 
    inspItem?.dust_claim ?? item?.dust_claim;
  if (rawDustClaim != null) col.dust_claim = Number(rawDustClaim);
  else if (inspMaster?.claim_dust != null) col.dust_claim = Number(inspMaster.claim_dust);

  const rawNcvSett = inspItem?.settlement_ncv ?? item?.settlement_ncv ?? 
    inspItem?.ncv_sett ?? item?.ncv_sett ?? 
    inspItem?.sett_ncv ?? item?.sett_ncv;
  if (rawNcvSett != null) col.ncv_sett = Number(rawNcvSett);

  const rawNcvClaim = inspItem?.ncv_claim ?? item?.ncv_claim ?? 
    inspItem?.claim_ncv ?? item?.claim_ncv ?? 
    inspItem?.ncv_act ?? item?.ncv_act ?? 
    inspItem?.actual_ncv ?? item?.actual_ncv ?? 
    inspItem?.ncv_claim ?? item?.ncv_claim;
  if (rawNcvClaim != null) col.ncv_claim = Number(rawNcvClaim);
  else if (inspMaster?.claim_ncv != null) col.ncv_claim = Number(inspMaster.claim_ncv);

  const rawPoGradeSett = inspItem?.po_grade_sett ?? item?.po_grade_sett;
  if (rawPoGradeSett != null) col.po_grade_sett = Number(rawPoGradeSett);

  const rawPoGradeClaim = inspItem?.po_grade_claim ?? item?.po_grade_claim ?? 
    inspItem?.delivery_claim ?? item?.delivery_claim;
  if (rawPoGradeClaim != null) col.po_grade_claim = Number(rawPoGradeClaim);
  else if (inspMaster?.delivery_claim != null) col.po_grade_claim = Number(inspMaster.delivery_claim);

  const gdVal = Number(col.gd_sett) > 0 ? Number(col.gd_sett) : Number(col.gd_claim || 0);
  const mVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
  const dVal = Number(col.dust_sett) > 0 ? Number(col.dust_sett) : Number(col.dust_claim || 0);
  const nVal = Number(col.ncv_sett) > 0 ? Number(col.ncv_sett) : Number(col.ncv_claim || 0);
  col.claim_settlement = Number((gdVal + mVal + dVal + nVal).toFixed(2));

  return col;
};

export const deduplicateArrivalItems = (
  items: any[],
  gList: any[] = [],
  expectedLorryMt: number = 0,
  expectedTotalBales: number = 0
): any[] => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const getNormWtMt = (it: any): number => {
    const raw = Number(
      it?.final_receipt_wt ||
      it?.receipt_gross_wt ||
      it?.challan_gross_wt ||
      it?.arr_qty_wt ||
      it?.weight_mt ||
      it?.weight ||
      (Number(it?.weight_qtl) > 0 ? Number(it.weight_qtl) / 10 : 0) ||
      (Number(it?.quantity_qtl) > 0 ? Number(it.quantity_qtl) / 10 : 0) ||
      0
    );
    if (raw <= 0) return 0;
    if (raw > 500) return Number((raw / 1000).toFixed(3));
    if (raw > 50) return Number((raw / 10).toFixed(3));
    return Number(raw.toFixed(3));
  };

  const getNormQty = (it: any): number =>
    Number(it?.bales || it?.quantity || it?.quantity_rcpt || it?.quantity_chln || it?.packets || 0);

  const getNormGrade = (it: any): string => {
    const rawG =
      it?.stock_grade_name ||
      it?.arrival_grade ||
      it?.receipt_grade_name ||
      it?.challan_grade_name ||
      it?.grade_name ||
      it?.grade ||
      it?.quality ||
      it?.stock_grade_code ||
      it?.grade_code ||
      '';
    return (resolveGradeName(rawG, gList) || String(rawG || '')).trim().toUpperCase();
  };

  const valid = items.filter((it) => {
    if (!it) return false;
    const wt = getNormWtMt(it);
    const qty = getNormQty(it);
    const gr = getNormGrade(it);
    return wt > 0 || qty > 0 || Boolean(gr);
  });

  if (valid.length <= 1) return valid;

  const result: any[] = [];
  const seenPositionalKeys = new Set<string>();
  const seenSignatureMap = new Map<string, number>();
  let runningWtMt = 0;
  let runningBales = 0;

  for (const it of valid) {
    const gr = getNormGrade(it);
    const qty = getNormQty(it);
    const wt = getNormWtMt(it);
    const area = String(it?.area || it?.area_name || '').trim().toUpperCase();
    const agency = String(it?.agency || it?.agency_name || '').trim().toUpperCase();
    const lot = String(it?.lot || it?.lot_no || '').trim().toUpperCase();
    const posIndex = it?.col_index ?? it?.srl_no ?? '';

    const sig = `${gr}|${area}|${agency}|${qty}|${wt.toFixed(3)}|${lot}`;
    const posKey = posIndex !== '' ? `${posIndex}|${sig}` : '';

    // 1. Exact same srl_no / col_index and identical specification/weight -> duplicate DB record
    if (posKey && seenPositionalKeys.has(posKey)) {
      continue;
    }

    // 2. Identical grade, area, agency, bale count, and weight
    if (seenSignatureMap.has(sig) && wt > 0) {
      const wouldExceedLorryWt =
        expectedLorryMt > 0 &&
        runningWtMt >= expectedLorryMt * 0.9 &&
        runningWtMt + wt > expectedLorryMt * 1.08;
      const wouldExceedLorryBales =
        expectedTotalBales > 0 &&
        runningBales >= expectedTotalBales &&
        runningBales + qty > expectedTotalBales;
      // Also guard against duplicate col_index / srl_no or cloned inspection row
      const prevIdx = seenSignatureMap.get(sig);
      const prevItem = prevIdx !== undefined ? result[prevIdx] : null;
      const sameIdOrCol =
        prevItem &&
        ((it.col_index && prevItem.col_index && Number(it.col_index) === Number(prevItem.col_index)) ||
          (it.srl_no && prevItem.srl_no && Number(it.srl_no) === Number(prevItem.srl_no)));

      if (wouldExceedLorryWt || wouldExceedLorryBales || sameIdOrCol || !lot) {
        continue;
      }
    }

    if (posKey) seenPositionalKeys.add(posKey);
    seenSignatureMap.set(sig, result.length);
    result.push(it);
    runningWtMt += wt;
    runningBales += qty;
  }

  return result;
};

export const buildAlignedSettlementColumns = (
  poDetails: any[],
  inspDetails: any[],
  faGridArr: any[],
  faMaster: any,
  inspMaster: any,
  poData: any,
  gList: any[],
  agList: any[],
  mList: any[],
  arList: any[],
  payDetails: any[] = []
): SettlementDetailColumn[] => {
  const toHeaderMt = (val: any): number => {
    const n = Number(val) || 0;
    if (n <= 0) return 0;
    if (n > 500) return Number((n / 1000).toFixed(3));
    if (n > 50) return Number((n / 10).toFixed(3));
    return Number(n.toFixed(3));
  };

  const expectedLorryMt =
    toHeaderMt(inspMaster?.electronic_net_weight) ||
    toHeaderMt(inspMaster?.challan_material_weight) ||
    toHeaderMt(inspMaster?.supplier_net_weight) ||
    toHeaderMt(faMaster?.electronic_net_weight) ||
    toHeaderMt(faMaster?.challan_material_weight) ||
    toHeaderMt(faMaster?.supplier_net_weight) ||
    (Number(inspMaster?.weight_qtl || faMaster?.weight_qtl) > 0
      ? Number(((Number(inspMaster?.weight_qtl || faMaster?.weight_qtl)) / 10).toFixed(3))
      : 0);

  const expectedTotalBales = Number(
    inspMaster?.total_bales ||
    inspMaster?.bales ||
    inspMaster?.total_packets ||
    faMaster?.total_packets ||
    faMaster?.bales ||
    0
  );

  // Deduplicate each source independently
  const cleanInspDetails = deduplicateArrivalItems(inspDetails || [], gList, expectedLorryMt, expectedTotalBales);
  const cleanFaGrid = deduplicateArrivalItems(faGridArr || [], gList, expectedLorryMt, expectedTotalBales);

  // Deduplicate payDetails by col_index (and signature) so multiple saves/vouchers never create extra rows
  const payByColMap = new Map<number, any>();
  const unindexedPay: any[] = [];
  for (const pd of deduplicateArrivalItems(payDetails || [], gList, expectedLorryMt, expectedTotalBales)) {
    const cIdx = Number(pd?.col_index || 0);
    if (cIdx >= 1 && cIdx <= 4) {
      if (!payByColMap.has(cIdx)) {
        payByColMap.set(cIdx, pd);
      }
    } else {
      unindexedPay.push(pd);
    }
  }
  const cleanPayDetails = [
    ...Array.from(payByColMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map((e) => e[1]),
    ...unindexedPay
  ];

  // Strict Single-Source Priority for Arrival Rows:
  // 1. Mill Inspection (cleanInspDetails) is the authoritative source of truth when present.
  // 2. Only if Mill Inspection has no rows, fall back to Final Arrival (cleanFaGrid).
  // 3. Only if both have no rows, fall back to Payment Details (cleanPayDetails).
  const arrivalRows: Array<{ inspItem: any; faItem: any; rawGrade: string; gradeName: string; gradeCode: string; hasData: boolean }> = [];

  if (cleanInspDetails.length > 0) {
    for (let i = 0; i < cleanInspDetails.length; i++) {
      const inspItem = cleanInspDetails[i];
      const faItem = cleanFaGrid[i] || null;
      const rawG =
        inspItem?.stock_grade_name || inspItem?.arrival_grade || inspItem?.grade || inspItem?.grade_name ||
        inspItem?.stock_grade_code || inspItem?.grade_code ||
        faItem?.receipt_grade_name || faItem?.challan_grade_name || faItem?.stock_grade_name || faItem?.arrival_grade ||
        faItem?.grade || faItem?.grade_name || faItem?.quality || '';
      const codeG = String(
        inspItem?.stock_grade_code || inspItem?.grade_code ||
        faItem?.receipt_grade_code || faItem?.grade_code || ''
      ).trim();
      const nameG = (resolveGradeName(rawG || codeG, gList) || rawG || '').trim().toUpperCase();

      const wt = Number(
        inspItem?.final_receipt_wt || inspItem?.receipt_gross_wt || inspItem?.challan_gross_wt ||
        inspItem?.weight_qtl || inspItem?.arr_qty_wt || inspItem?.weight || 0
      );
      const qty = Number(inspItem?.bales || inspItem?.quantity || 0);
      const hasData = wt > 0 || qty > 0 || Boolean(nameG);

      if (hasData) {
        arrivalRows.push({
          inspItem,
          faItem,
          rawGrade: rawG,
          gradeName: nameG,
          gradeCode: codeG,
          hasData
        });
      }
    }
  } else if (cleanFaGrid.length > 0) {
    for (let i = 0; i < cleanFaGrid.length; i++) {
      const faItem = cleanFaGrid[i];
      const rawG =
        faItem?.receipt_grade_name || faItem?.challan_grade_name || faItem?.stock_grade_name || faItem?.arrival_grade ||
        faItem?.grade || faItem?.grade_name || faItem?.quality || '';
      const codeG = String(faItem?.receipt_grade_code || faItem?.grade_code || '').trim();
      const nameG = (resolveGradeName(rawG || codeG, gList) || rawG || '').trim().toUpperCase();

      const wt = Number(
        faItem?.netto_pnto || faItem?.weight_mt || faItem?.weight_qtl || faItem?.arr_qty_wt ||
        faItem?.receipt_gross_wt || faItem?.challan_gross_wt || faItem?.weight || 0
      );
      const qty = Number(faItem?.bales || faItem?.quantity || faItem?.quantity_rcpt || faItem?.quantity_chln || 0);
      const hasData = wt > 0 || qty > 0 || Boolean(nameG);

      if (hasData) {
        arrivalRows.push({
          inspItem: null,
          faItem,
          rawGrade: rawG,
          gradeName: nameG,
          gradeCode: codeG,
          hasData
        });
      }
    }
  } else if (cleanPayDetails.length > 0) {
    for (let i = 0; i < cleanPayDetails.length; i++) {
      const payItem = cleanPayDetails[i];
      const rawG = payItem?.grade || '';
      const codeG = String(payItem?.grade_code || '').trim();
      const nameG = (resolveGradeName(rawG || codeG, gList) || rawG || '').trim().toUpperCase();
      const wt = Number(payItem?.arr_qty_wt || payItem?.weight || 0);
      const qty = Number(payItem?.quantity || 0);
      const hasData = wt > 0 || qty > 0;

      if (hasData) {
        arrivalRows.push({
          inspItem: null,
          faItem: null,
          rawGrade: rawG,
          gradeName: nameG,
          gradeCode: codeG,
          hasData
        });
      }
    }
  }

  const matchedPoIndices = new Set<number>();
  const matchedPayIndices = new Set<number>();

  const findUnusedPayDetail = (colIdx: number, targetGradeStr: string): any => {
    // 1. Exact col_index match first
    for (let pIdx = 0; pIdx < cleanPayDetails.length; pIdx++) {
      if (matchedPayIndices.has(pIdx)) continue;
      const pd = cleanPayDetails[pIdx];
      if (Number(pd?.col_index) === colIdx) {
        matchedPayIndices.add(pIdx);
        return pd;
      }
    }
    // 2. Fallback grade match ONLY for unindexed payment_details or if col_index is not bound to another active row
    const normTarget = (resolveGradeName(targetGradeStr, gList) || String(targetGradeStr || '')).trim().toUpperCase();
    if (!normTarget) return null;
    for (let pIdx = 0; pIdx < cleanPayDetails.length; pIdx++) {
      if (matchedPayIndices.has(pIdx)) continue;
      const pd = cleanPayDetails[pIdx];
      const pdColIdx = Number(pd?.col_index || 0);
      if (pdColIdx > 0 && pdColIdx !== colIdx && pdColIdx <= arrivalRows.length) {
        continue;
      }
      const pdGrade = (resolveGradeName(pd?.grade, gList) || String(pd?.grade || '')).trim().toUpperCase();
      if (pdGrade && pdGrade === normTarget) {
        matchedPayIndices.add(pIdx);
        return pd;
      }
    }
    return null;
  };

  const applyPaymentSettRates = (
    cols: SettlementDetailColumn[],
    rawItemsByCol: Array<{ inspItem?: any; faItem?: any; pDet?: any; payDetail?: any }>
  ): SettlementDetailColumn[] => {
    const diffs = getCachedSattaDiffs();
    const colsWithOrigRates = cols.map((c, i) => {
      const meta = rawItemsByCol[i] || {};
      const pd = meta.payDetail;
      const pDet = meta.pDet;
      const inspItem = meta.inspItem;
      const item = meta.faItem || meta.inspItem;

      // Always prefer PO rate or payment_details rate_value as the base contract Rate (₹/Qtl)
      const poRate = Number(
        pDet?.rate_qntl ||
        pDet?.rate_per_mt ||
        pDet?.rate ||
        pDet?.rate_mt ||
        0
      );
      const pdOrigRate = Number(pd?.rate_value) || 0;
      const origRate =
        poRate > 0
          ? poRate
          : pdOrigRate > 0
          ? pdOrigRate
          : Number(
              poData?.rate_qntl ||
              poData?.rate_mt ||
              poData?.b_rate ||
              inspItem?.rate ||
              inspItem?.rate_qntl ||
              item?.rate_value ||
              item?.rate ||
              item?.rate_qntl ||
              item?.recon_rate_mt ||
              c.rate_value ||
              0
            );
      return {
        ...c,
        rate_value: origRate
      };
    });

    const computedCols = cols.map((col, i) => {
      const meta = rawItemsByCol[i] || {};
      const pd = meta.payDetail;
      const pDet = meta.pDet;
      const inspItem = meta.inspItem;
      const item = meta.faItem || meta.inspItem;
      const origRate = colsWithOrigRates[i].rate_value;

      // If pd has specs or values, backfill them into col ONLY if this column is an active arrival row (or if no inspection/FA exists)
      const isArrivalBackedCol = Boolean(inspItem || item || arrivalRows.length === 0);
      if (pd && isArrivalBackedCol) {
        if (!col.grade && pd.grade) col.grade = resolveGradeName(pd.grade, gList) || pd.grade;
        if (!col.area && pd.area) col.area = resolveAreaName(pd.area, arList) || pd.area;
        if (!col.agency && pd.agency) col.agency = resolveAgencyName(pd.agency, agList) || pd.agency;
        if (!col.marka_crop && pd.marka_crop) col.marka_crop = pd.marka_crop;
        if (Number(pd.quantity) > 0 && (!col.quantity || col.quantity === 0)) col.quantity = Number(pd.quantity);
        if (Number(pd.arr_qty_wt) > 0 && (!col.arr_qty_wt || col.arr_qty_wt === 0)) col.arr_qty_wt = Number(pd.arr_qty_wt);
        const pdMoistClaim = pd.moist ?? pd.moist_claim ?? pd.moisture_claim ?? pd.claim_moisture;
        if (pdMoistClaim !== undefined && pdMoistClaim !== null && !isNaN(Number(pdMoistClaim))) {
          col.moist_claim = Number(pdMoistClaim);
        }
        const pdMoistSett = pd.moist_sett ?? pd.moisture_sett ?? pd.settlement_moisture;
        if (pdMoistSett !== undefined && pdMoistSett !== null && !isNaN(Number(pdMoistSett))) {
          col.moist_sett = Number(pdMoistSett);
        }
      }

      const hasData = Boolean(col.grade || Number(col.quantity) > 0 || Number(col.arr_qty_wt) > 0);
      if (!hasData) return { ...col, po_items: poDetails || [], all_cols: colsWithOrigRates };

      const parsePrem = (raw: any): number => {
        if (raw === undefined || raw === null) return 0;
        if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
        const str = String(raw).trim();
        if (!str || str === '-' || /^(no|false)$/i.test(str)) return 0;
        const num = parseFloat(str.replace(/[^0-9.]/g, ''));
        return isNaN(num) ? 0 : num;
      };

      const premium =
        parsePrem(pd?.premium) ||
        parsePrem(inspItem?.premium) ||
        parsePrem(inspItem?.premium_rate) ||
        parsePrem(item?.premium) ||
        parsePrem(pDet?.premium) ||
        parsePrem(pDet?.premium_amount) ||
        parsePrem(pDet?.prem) ||
        parsePrem(inspMaster?.summary_premium_amount) ||
        parsePrem(inspMaster?.premium) ||
        parsePrem(faMaster?.premium) ||
        parsePrem(poData?.premium) ||
        parsePrem(poData?.summary_premium_amount) ||
        parsePrem(col.premium) ||
        0;

      // Extract Grade Down Claim / Sett % using the exact same fields as Payment Operations (mapItemsToDetailCols)
      const payGdClaim = Number(
        pd?.gd_claim ??
        inspItem?.gd_claim ?? item?.gd_claim ??
        inspItem?.grade_down_claim ?? item?.grade_down_claim ??
        inspItem?.claim_grade_down ?? item?.claim_grade_down ??
        inspItem?.claim_gr_down ?? item?.claim_gr_down ??
        inspItem?.grade_down_act ?? item?.grade_down_act ??
        inspItem?.actual_grade_down ?? item?.actual_grade_down ??
        col.gd_claim ?? 0
      );
      const payGdSett = Number(
        pd?.gd_sett ??
        inspItem?.gd_sett ?? item?.gd_sett ??
        inspItem?.settlement_grade_down ?? item?.settlement_grade_down ??
        inspItem?.grade_down_sett ?? item?.grade_down_sett ??
        inspItem?.mill_sett_gr_down ?? item?.mill_sett_gr_down ??
        col.gd_sett ?? 0
      );

      let settPct = 0;
      if (pd && pd.sett_pct !== undefined && pd.sett_pct !== null && String(pd.sett_pct).trim() !== '' && !isNaN(Number(pd.sett_pct)) && Number(pd.sett_pct) > 0) {
        settPct = Number(pd.sett_pct);
      } else if (payGdClaim > 0) {
        settPct = payGdClaim;
      } else if (payGdSett > 0) {
        settPct = payGdSett;
      }

      const colForPaymentCalc: any = {
        ...col,
        rate_value: origRate,
        premium,
        sett_pct: settPct,
        gd_claim: payGdClaim,
        gd_sett: payGdSett,
        po_items: poDetails || [],
        all_cols: colsWithOrigRates
      };

      const calculatedPaymentSettRate = getColSettRate(colForPaymentCalc, diffs, poDetails || []);
      const calcDedRate = Math.max(0, Number((origRate + premium - calculatedPaymentSettRate).toFixed(2)));
      const pdDedRate = pd && pd.deduction_rate !== undefined && pd.deduction_rate !== null ? Number(pd.deduction_rate) : 0;
      const finalDedRate = pdDedRate > 0 ? pdDedRate : calcDedRate;
      const pdSettRate = pd && pd.sett_rate !== undefined && pd.sett_rate !== null && Number(pd.sett_rate) > 0 ? Number(pd.sett_rate) : 0;
      const finalSettRate = pdSettRate > 0 ? pdSettRate : Math.max(0, Number((origRate + premium - finalDedRate).toFixed(2)));
      
      const wtMt = Number(col.arr_qty_wt) > 0 ? Number(col.arr_qty_wt) : (Number(pd?.arr_qty_wt) || 0);
      const qtyQtl = Number(pd?.quantity_qtl) > 0 ? Number(pd.quantity_qtl) : Number((wtMt * 10).toFixed(3));
      const pdAmt = pd && pd.amount !== undefined && pd.amount !== null && Number(pd.amount) > 0 ? Number(pd.amount) : 0;
      const rowAmount = pdAmt > 0 ? pdAmt : Number((qtyQtl * finalSettRate).toFixed(2));

      return {
        ...col,
        rate_value: origRate,
        premium,
        sett_pct: settPct,
        gd_claim: payGdClaim,
        gd_sett: payGdSett || payGdClaim,
        deduction_rate: finalDedRate,
        sett_rate: finalSettRate,
        quantity_qtl: qtyQtl,
        amount: rowAmount,
        po_items: poDetails || [],
        all_cols: colsWithOrigRates
      };
    });

    return computedCols.map(c => ({ ...c, all_cols: computedCols }));
  };

  if (arrivalRows.length > 0) {
    const rawItemsByCol: Array<{ inspItem?: any; faItem?: any; pDet?: any; payDetail?: any }> = [];
    const builtCols = [1, 2, 3, 4].map(idx => {
      const arr = arrivalRows[idx - 1] || null;
      if (arr) {
        let matchedPoItem: any = null;
        let matchedPoIdx = -1;
        if (poDetails && poDetails.length > 0) {
          const availablePoItems = poDetails.filter((_, pIdx) => !matchedPoIndices.has(pIdx));
          const colSpec = {
            grade: arr.gradeName || arr.rawGrade,
            stock_grade_code: arr.gradeCode,
            agency: arr.inspItem?.agency_name || arr.inspItem?.agency || arr.faItem?.agency_name || arr.faItem?.agency || '',
            area: arr.inspItem?.area || arr.faItem?.area || ''
          };
          const matched = findMatchedPoItem(colSpec, availablePoItems, { gradeMasters: gList, agencyMasters: agList });
          if (matched) {
            matchedPoItem = matched;
            matchedPoIdx = poDetails.indexOf(matched);
          } else {
            for (let pIdx = 0; pIdx < poDetails.length; pIdx++) {
              if (matchedPoIndices.has(pIdx)) continue;
              const pDet = poDetails[pIdx];
              const poRawG = pDet.grade_name || pDet.quality || pDet.grade || '';
              const poCodeG = String(pDet.grade_code || '').trim();
              const poNameG = (resolveGradeName(poRawG || poCodeG, gList) || poRawG || '').trim().toUpperCase();

              const isNameMatch = Boolean(poNameG && arr.gradeName && poNameG === arr.gradeName);
              const isCodeMatch = Boolean(poCodeG && arr.gradeCode && poCodeG === arr.gradeCode);
              const isCrossCodeNameMatch = Boolean(
                (poCodeG && arr.gradeName && resolveGradeName(poCodeG, gList)?.trim().toUpperCase() === arr.gradeName) ||
                (arr.gradeCode && poNameG && resolveGradeName(arr.gradeCode, gList)?.trim().toUpperCase() === poNameG)
              );

              if (isNameMatch || isCodeMatch || isCrossCodeNameMatch) {
                matchedPoItem = pDet;
                matchedPoIdx = pIdx;
                break;
              }
            }
          }
        }
        if (matchedPoIdx !== -1) {
          matchedPoIndices.add(matchedPoIdx);
        }

        const matchedPayDetail = findUnusedPayDetail(idx, arr.gradeName || arr.rawGrade);

        rawItemsByCol.push({
          inspItem: arr.inspItem,
          faItem: arr.faItem,
          pDet: matchedPoItem,
          payDetail: matchedPayDetail
        });

        return buildSettlementCol(
          idx,
          arr.inspItem || arr.faItem,
          matchedPoItem,
          faMaster,
          inspMaster,
          poData,
          gList,
          agList,
          mList,
          arList,
          arr.inspItem,
          matchedPayDetail
        );
      } else {
        rawItemsByCol.push({});
        return emptyDetailColumn(idx);
      }
    });

    return applyPaymentSettRates(builtCols, rawItemsByCol);
  }

  if (poDetails && poDetails.length > 0) {
    const rawItemsByCol: Array<{ inspItem?: any; faItem?: any; pDet?: any; payDetail?: any }> = [];
    const builtCols = [1, 2, 3, 4].map(idx => {
      const pDet = poDetails[idx - 1] || null;
      if (pDet) {
        const poGrade = pDet.grade_name || pDet.quality || pDet.grade || '';
        const matchedPayDetail = findUnusedPayDetail(idx, poGrade);

        rawItemsByCol.push({
          pDet,
          payDetail: matchedPayDetail
        });

        return buildSettlementCol(
          idx,
          null,
          pDet,
          faMaster,
          inspMaster,
          poData,
          gList,
          agList,
          mList,
          arList,
          null,
          matchedPayDetail
        );
      }
      rawItemsByCol.push({});
      return emptyDetailColumn(idx);
    });

    return applyPaymentSettRates(builtCols, rawItemsByCol);
  }

  return [1, 2, 3, 4].map(idx => emptyDetailColumn(idx));
};

export const fetchPoAndItemDetails = async (
  poNo: string, 
  gradeMasterList: any[] = [], 
  agencyMasterList: any[] = []
): Promise<{ poData: any; poDetails: any[]; gList: any[]; agList: any[] }> => {
  if (!poNo) return { poData: null, poDetails: [], gList: gradeMasterList, agList: agencyMasterList };
  const cleanPo = String(poNo).trim().replace(/^#/, '');
  const withHash = `#${cleanPo}`;

  let poData: any = null;
  let poDetails: any[] = [];
  let scpItemsForMerge: any[] = [];

  try {
    const resolveContractLorries = (...records: any[]): number => {
      let maxLorries = 0;
      let maxContractMt = 0;
      let maxWtPerLorry = 0;

      for (const r of records) {
        if (!r) continue;
        const cands = [
          r.total_lorries,
          r.total_no_of_lorries,
          r.no_of_lorries,
          r.no_of_lorry,
          r.lorries,
          r.contract_lorries
        ];
        for (const c of cands) {
          const n = parseInt(String(c ?? ''), 10);
          if (!isNaN(n) && n > maxLorries) {
            maxLorries = n;
          }
        }
        if (r.lorry_status) {
          const m = String(r.lorry_status).match(/(\d+)\s*\/\s*(\d+)/);
          if (m && m[2]) {
            const parsedTotal = parseInt(m[2], 10);
            if (!isNaN(parsedTotal) && parsedTotal > maxLorries) {
              maxLorries = parsedTotal;
            }
          }
        }
        const mtCands = [
          r.total_contract_mt,
          r.contract_weight_mt,
          r.sauda_contract_mt,
          r.total_wt_in_ton,
          r.weight_mt
        ];
        for (const mc of mtCands) {
          const val = parseFloat(String(mc ?? ''));
          if (!isNaN(val) && val > maxContractMt) {
            maxContractMt = val;
          }
        }
        if (maxContractMt === 0 && r.quantity) {
          const qVal = parseFloat(String(r.quantity));
          const uStr = String(r.unit || r.unit_type || r.purchase_unit_name || '').toUpperCase();
          if (!isNaN(qVal) && qVal > 0 && (uStr.includes('TON') || uStr === 'MT' || qVal <= 60)) {
            maxContractMt = qVal;
          }
        }
        const wpl = parseFloat(String(r.weight_per_lorry || r.wt_per_lorry || 0));
        if (!isNaN(wpl) && wpl > maxWtPerLorry) {
          maxWtPerLorry = wpl;
        }
      }

      let inferredByWt = 1;
      if (maxContractMt > 0 && maxWtPerLorry > 0 && maxContractMt > maxWtPerLorry * 1.3) {
        inferredByWt = Math.max(1, Math.round(maxContractMt / maxWtPerLorry));
      } else if (maxContractMt >= 15) {
        inferredByWt = Math.max(1, Math.round(maxContractMt / 10));
      }

      return Math.max(1, maxLorries, inferredByWt);
    };

    if (supabase) {
      const noPtfPo = cleanPo.replace(/\(PTF\)/gi, '').trim();
      const ptfPo = `${noPtfPo}(PTF)`;
      const [pmRes, scpRes, smRes, rlRes] = await Promise.all([
        supabase.from('purchase_master').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}",po_no.eq."${noPtfPo}",po_no.eq."${ptfPo}"`).limit(1).maybeSingle(),
        supabase.from('sauda_check_point').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}",po_no.eq."${noPtfPo}",po_no.eq."${ptfPo}",ptf_no.eq."${cleanPo}",ptf_no.eq."${noPtfPo}",sauda_no.eq."${cleanPo}",sauda_no.eq."${noPtfPo}"`).limit(1).maybeSingle(),
        supabase.from('sauda_master').select('*').or(`sauda_no.eq."${cleanPo}",sauda_no.eq."${noPtfPo}",session.eq."${cleanPo}",session.eq."${noPtfPo}"`).limit(1).maybeSingle().then(r => r, () => ({ data: null })),
        supabase.from('return_lorry').select('*').or(`po_no.eq."${cleanPo}",new_po_no.eq."${cleanPo}",po_no.eq."${withHash}",new_po_no.eq."${withHash}"`).limit(1).maybeSingle().then(r => r, () => ({ data: null }))
      ]);

      const pm = pmRes?.data || null;
      const scp = scpRes?.data || null;
      const sm = (smRes as any)?.data || null;
      const rl = (rlRes as any)?.data || null;

      if (rl) {
        const totalLorries = resolveContractLorries(rl);
        poData = {
          ...(rl.sauda_snapshot || {}),
          ...rl,
          po_no: rl.new_po_no || rl.po_no,
          reference_po_no: rl.reference_po_no,
          po_date: rl.po_date || rl.s_date,
          supplier: rl.supplier || rl.supplier_name,
          broker: rl.broker || rl.broker_name,
          total_contract_mt: rl.total_contract_mt || rl.received_weight_mt || 0,
          total_lorries: totalLorries,
          total_no_of_lorries: totalLorries,
          no_of_lorries: totalLorries,
          contract_lorries: totalLorries,
          premium: Number(rl.premium || 0),
          items: rl.items || rl.grid_details,
          grid_details: rl.grid_details || rl.items,
          is_return_lorry: true
        };
        const parsedFromRl = parseGridOrItems(rl.items || rl.grid_details);
        if (parsedFromRl.length > 0) {
          scpItemsForMerge = parsedFromRl;
          poDetails = parsedFromRl;
        } else {
          const { data: rldData } = await supabase
            .from('return_lorry_details')
            .select('*')
            .or(`po_no.eq."${cleanPo}",new_po_no.eq."${cleanPo}"`)
            .order('srl_no', { ascending: true })
            .then(r => r, () => ({ data: [] }));
          if (rldData && rldData.length > 0) {
            scpItemsForMerge = rldData;
            poDetails = rldData;
          }
        }
      } else if (pm && scp) {
        const totalLorries = resolveContractLorries(scp, pm, sm);
        const maxContractMt = Math.max(
          Number(pm.total_contract_mt || 0),
          Number(scp.total_contract_mt || 0),
          Number(scp.contract_weight_mt || 0),
          Number(scp.quantity || 0),
          Number(sm?.total_wt_in_ton || sm?.quantity || 0)
        );
        poData = {
          ...pm,
          ...scp,
          po_no: pm.po_no || scp.po_no,
          po_date: pm.po_date || scp.po_date || scp.s_date,
          supplier: pm.supplier || scp.supplier_name || scp.supplier,
          broker: pm.broker || scp.broker_name || scp.broker,
          total_contract_mt: maxContractMt || pm.total_contract_mt || scp.total_contract_mt || scp.quantity || 0,
          total_lorries: totalLorries,
          total_no_of_lorries: totalLorries,
          no_of_lorries: totalLorries,
          contract_lorries: totalLorries,
          premium: Number(scp.premium || pm.premium || 0),
          items: scp.items || pm.items,
          grid_details: scp.grid_details || pm.grid_details
        };
      } else if (pm) {
        const totalLorries = resolveContractLorries(pm, sm);
        const maxContractMt = Math.max(
          Number(pm.total_contract_mt || 0),
          Number(pm.contract_weight_mt || 0),
          Number(sm?.total_wt_in_ton || sm?.quantity || 0)
        );
        poData = {
          ...pm,
          total_contract_mt: maxContractMt || pm.total_contract_mt || 0,
          total_lorries: totalLorries,
          total_no_of_lorries: totalLorries,
          no_of_lorries: totalLorries,
          contract_lorries: totalLorries
        };
      } else if (scp) {
        const totalLorries = resolveContractLorries(scp, sm);
        const maxContractMt = Math.max(
          Number(scp.total_contract_mt || 0),
          Number(scp.contract_weight_mt || 0),
          Number(scp.quantity || 0),
          Number(sm?.total_wt_in_ton || sm?.quantity || 0)
        );
        poData = {
          ...scp,
          po_date: scp.po_date || scp.s_date,
          supplier: scp.supplier_name || scp.supplier,
          broker: scp.broker_name || scp.broker,
          total_contract_mt: maxContractMt || scp.total_contract_mt || scp.quantity || 0,
          total_lorries: totalLorries,
          total_no_of_lorries: totalLorries,
          no_of_lorries: totalLorries,
          contract_lorries: totalLorries,
          pending: scp.pending ?? true,
          status: scp.status || 'temp'
        };
      } else {
        const { data: archPo } = await supabase.from('po_archive').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).maybeSingle();
        if (archPo) {
          const totalLorries = resolveContractLorries(archPo, sm);
          poData = {
            ...archPo,
            total_lorries: totalLorries,
            contract_lorries: totalLorries
          };
        }
      }

      if (!poData) {
        const [pmIlike, scpIlike] = await Promise.all([
          supabase.from('purchase_master').select('*').ilike('po_no', cleanPo).limit(1),
          supabase.from('sauda_check_point').select('*').ilike('po_no', cleanPo).limit(1)
        ]);
        const pmRow = pmIlike?.data?.[0] || null;
        const scpRow = scpIlike?.data?.[0] || null;
        if (pmRow && scpRow) {
          const totalLorries = resolveContractLorries(scpRow, pmRow, sm);
          poData = {
            ...pmRow,
            ...scpRow,
            po_date: pmRow.po_date || scpRow.po_date || scpRow.s_date,
            supplier: pmRow.supplier || scpRow.supplier_name || scpRow.supplier,
            broker: pmRow.broker || scpRow.broker_name || scpRow.broker,
            total_contract_mt: pmRow.total_contract_mt || scpRow.total_contract_mt || scpRow.quantity || 0,
            total_lorries: totalLorries,
            total_no_of_lorries: totalLorries,
            no_of_lorries: totalLorries,
            contract_lorries: totalLorries,
            premium: Number(scpRow.premium || pmRow.premium || 0),
            items: scpRow.items || pmRow.items,
            grid_details: scpRow.grid_details || pmRow.grid_details
          };
        } else if (pmRow) {
          const totalLorries = resolveContractLorries(pmRow, sm);
          poData = {
            ...pmRow,
            total_lorries: totalLorries,
            contract_lorries: totalLorries
          };
        } else if (scpRow) {
          const totalLorries = resolveContractLorries(scpRow, sm);
          poData = {
            ...scpRow,
            po_date: scpRow.po_date || scpRow.s_date,
            supplier: scpRow.supplier_name || scpRow.supplier,
            broker: scpRow.broker_name || scpRow.broker,
            total_contract_mt: scpRow.total_contract_mt || scpRow.quantity || 0,
            total_lorries: totalLorries,
            contract_lorries: totalLorries,
            pending: scpRow.pending ?? true,
            status: scpRow.status || 'temp'
          };
        }
      }

      // Parse embedded JSON items from both scp and pm
      const parsedFromScp = parseGridOrItems(scp?.items || scp?.grid_details);
      const parsedFromPm = parseGridOrItems(pm?.items || pm?.grid_details || poData?.items || poData?.grid_details);
      if (parsedFromScp.length > 0) scpItemsForMerge = parsedFromScp;

      if (parsedFromPm.length > 0 && parsedFromPm.some((it: any) => it.grade || it.grade_name || it.grade_code || it.rate_qntl || it.rate)) {
        poDetails = parsedFromPm;
      } else if (parsedFromScp.length > 0 && parsedFromScp.some((it: any) => it.grade || it.grade_name || it.grade_code || it.rate_qntl || it.rate)) {
        poDetails = parsedFromScp;
      }

      // Also fetch purchase_detail_master and sauda_check_point_details so we never miss rate or premium
      const [pdmRes, scpdRes] = await Promise.all([
        supabase.from('purchase_detail_master').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).order('srl_no', { ascending: true }),
        supabase.from('sauda_check_point_details').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).order('srl_no', { ascending: true })
      ]);

      if (scpdRes?.data && scpdRes.data.length > 0) {
        scpItemsForMerge = [...scpItemsForMerge, ...scpdRes.data];
      }

      if (poDetails.length === 0) {
        if (pdmRes?.data && pdmRes.data.length > 0) {
          poDetails = pdmRes.data;
        } else if (scpdRes?.data && scpdRes.data.length > 0) {
          poDetails = scpdRes.data;
        } else {
          const [pdmIlike, scpdIlike] = await Promise.all([
            supabase.from('purchase_detail_master').select('*').ilike('po_no', cleanPo),
            supabase.from('sauda_check_point_details').select('*').ilike('po_no', cleanPo)
          ]);
          if (scpdIlike?.data && scpdIlike.data.length > 0) {
            scpItemsForMerge = [...scpItemsForMerge, ...scpdIlike.data];
          }
          if (pdmIlike?.data && pdmIlike.data.length > 0) poDetails = pdmIlike.data;
          else if (scpdIlike?.data && scpdIlike.data.length > 0) poDetails = scpdIlike.data;
        }
      }
    }

    if (!poData) {
      const [localPm, localScp, localSm] = await Promise.all([
        dbModule.fetchAll('purchase_master').catch(() => []),
        dbModule.fetchAll('sauda_check_point').catch(() => []),
        dbModule.fetchAll('sauda_master').catch(() => [])
      ]);
      const matchPm = (localPm || []).find((p: any) => String(p.po_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
      const matchScp = (localScp || []).find((p: any) => String(p.po_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
      const matchSm = (localSm || []).find((s: any) => String(s.sauda_no || s.po_no || s.contract_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
      const totalLorries = resolveContractLorries(matchScp, matchPm, matchSm);
      if (matchPm && matchScp) poData = { ...matchPm, ...matchScp, total_lorries: totalLorries, contract_lorries: totalLorries };
      else if (matchPm) poData = { ...matchPm, total_lorries: totalLorries, contract_lorries: totalLorries };
      else if (matchScp) poData = { ...matchScp, total_lorries: totalLorries, contract_lorries: totalLorries };
    }

    if (poDetails.length === 0) {
      const [localPdm, localScpD] = await Promise.all([
        dbModule.fetchAll('purchase_detail_master').catch(() => []),
        dbModule.fetchAll('sauda_check_point_details').catch(() => [])
      ]);
      const matchPdm = (localPdm || []).filter((d: any) => String(d.po_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
      const matchScpd = (localScpD || []).filter((d: any) => String(d.po_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
      if (matchScpd.length > 0) scpItemsForMerge = [...scpItemsForMerge, ...matchScpd];
      if (matchPdm.length > 0) poDetails = matchPdm;
      else if (matchScpd.length > 0) poDetails = matchScpd;
    }
  } catch (err) {
    console.warn("Error in fetchPoAndItemDetails:", err);
  }

  let gList = gradeMasterList;
  let agList = agencyMasterList;
  if ((!gList || gList.length === 0 || !agList || agList.length === 0) && supabase) {
    try {
      const [gData, agData] = await Promise.all([
        supabase.from('grade_master').select('*').then(r => r.data || [], () => []),
        supabase.from('agency_master').select('*').then(r => r.data || [], () => [])
      ]);
      if (gData?.length > 0) { gList = gData; }
      if (agData?.length > 0) { agList = agData; }
    } catch (e) {}
  }

  const enrichedItems = poDetails.map((item: any, idx: number) => {
    let gradeName = item.grade_name || item.grade || item.quality || '';
    if (!gradeName && item.grade_code && gList && gList.length > 0) {
      const match = gList.find((g: any) => String(g.grade_code || g.code || g.id || '').trim().toUpperCase() === String(item.grade_code).trim().toUpperCase());
      if (match) gradeName = match.grade_name || match.name || '';
    }

    let agencyName = item.agency_name || item.agency || '';
    if (!agencyName && item.agency_code && agList && agList.length > 0) {
      const match = agList.find((a: any) => String(a.agency_code || a.code || a.id || '').trim().toUpperCase() === String(item.agency_code).trim().toUpperCase());
      if (match) agencyName = match.agency_name || match.name || '';
    }

    const resolvedG = (gradeName || item.grade_code || '').trim().toUpperCase();
    const matchedScpItem = scpItemsForMerge.find((s: any) => {
      const sG = (resolveGradeName(s.grade_name || s.grade || s.quality || s.grade_code, gList) || String(s.grade_name || s.grade || s.grade_code || '')).trim().toUpperCase();
      return Boolean(sG && resolvedG && sG === resolvedG);
    }) || scpItemsForMerge[idx];

    const rateVal = Number(
      item.rate_qntl || item.rate_per_mt || item.rate_mt || item.rate ||
      matchedScpItem?.rate_qntl || matchedScpItem?.rate_per_mt || matchedScpItem?.rate ||
      poData?.b_rate || poData?.rate_qntl || 0
    );
    const premVal = Number(
      item.premium || item.premium_amount || item.prem ||
      matchedScpItem?.premium || matchedScpItem?.premium_amount || matchedScpItem?.prem ||
      poData?.premium || 0
    );

    return {
      ...item,
      grade_name: gradeName || item.grade_code || '',
      agency_name: agencyName || item.agency_code || '',
      rate_qntl: rateVal,
      rate_per_mt: rateVal,
      rate: rateVal,
      premium: premVal
    };
  });

  if (poData && !poData.rate_qntl) {
    poData.rate_qntl = Number(poData.rate_mt || poData.b_rate || 0);
  }

  return { poData, poDetails: enrichedItems, gList, agList };
};

export const fetchSaudaCheckpointDeduction = async (cleanPoNo: string) => {
  if (!cleanPoNo) return null;
  try {
    const rawPoNo = cleanPoNo.trim().replace(/^#/, '');
    const poWithHash = '#' + rawPoNo;
    const cleanAlphaPo = rawPoNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // 1. Check local storage cache first
    const localSavedStr = localStorage.getItem(`sauda_settlement_${cleanAlphaPo}`) || 
                          localStorage.getItem(`sauda_settlement_${rawPoNo}`);
    if (localSavedStr) {
      try {
        const parsed = JSON.parse(localSavedStr);
        if (parsed && Number(parsed.deduction_amount) >= 0) return parsed;
      } catch (e) {}
    }

    // 2. Query Supabase sauda_check_point_deductions table
    if (supabase) {
      const { data: directList } = await supabase
        .from('sauda_check_point_deductions')
        .select('*');

      if (directList && directList.length > 0) {
        const found = directList.find((item: any) => {
          const itemPo = String(item.po_no || '').trim().replace(/^#/, '').toUpperCase();
          const itemSauda = String(item.sauda_no || item.po_contract || '').trim().replace(/^#/, '').toUpperCase();
          const itemPoClean = itemPo.replace(/[^a-zA-Z0-9]/g, '');
          const itemSaudaClean = itemSauda.replace(/[^a-zA-Z0-9]/g, '');
          return itemPo === rawPoNo.toUpperCase() ||
                 itemSauda === rawPoNo.toUpperCase() ||
                 (cleanAlphaPo && itemPoClean === cleanAlphaPo) ||
                 (cleanAlphaPo && itemSaudaClean === cleanAlphaPo) ||
                 itemPo.includes(rawPoNo.toUpperCase()) ||
                 rawPoNo.toUpperCase().includes(itemPo);
        });

        if (found) return found;
      }

      // 3. Fallback check from purchase_master or sauda_check_point excess_short_deduction
      const { data: poRecord } = await supabase
        .from('purchase_master')
        .select('po_no, excess_short_deduction, excess_short_status, total_contract_mt, contract_weight_mt, received_weight_mt, total_received_mt')
        .or(`po_no.eq.${rawPoNo},po_no.eq.${poWithHash}`)
        .maybeSingle();

      if (poRecord && Number(poRecord.excess_short_deduction) > 0) {
        return {
          po_no: poRecord.po_no || rawPoNo,
          deduction_amount: Number(poRecord.excess_short_deduction),
          variation_type: 'short',
          remarks: 'Auto-retrieved from Sauda Check Point Total Short Weight Deduction'
        };
      }

      const { data: scpRecord } = await supabase
        .from('sauda_check_point')
        .select('po_no, excess_short_deduction, excess_short_status')
        .or(`po_no.eq.${rawPoNo},po_no.eq.${poWithHash}`)
        .maybeSingle();

      if (scpRecord && Number(scpRecord.excess_short_deduction) > 0) {
        return {
          po_no: scpRecord.po_no || rawPoNo,
          deduction_amount: Number(scpRecord.excess_short_deduction),
          variation_type: 'short',
          remarks: 'Auto-retrieved from Sauda Check Point Total Short Weight Deduction'
        };
      }
    }

    const localRecords = await dbModule.fetchAll('sauda_check_point_deductions').catch(() => []);
    if (Array.isArray(localRecords) && localRecords.length > 0) {
      const found = localRecords.find((r: any) => {
        const rPo = String(r.po_no || '').trim().replace(/^#/, '').toUpperCase();
        const rPoClean = rPo.replace(/[^a-zA-Z0-9]/g, '');
        return rPo === rawPoNo.toUpperCase() || (cleanAlphaPo && rPoClean === cleanAlphaPo);
      });
      if (found) return found;
    }
  } catch (err) {
    console.warn("Could not fetch sauda checkpoint deduction:", err);
  }
  return null;
};

export const getPoContractLorryCount = (poData?: any): number => {
  if (!poData) return 0;
  const cands = [
    poData.total_lorries,
    poData.total_no_of_lorries,
    poData.no_of_lorries,
    poData.no_of_lorry,
    poData.lorries,
    poData.contract_lorries
  ];
  let maxLorries = 0;
  for (const c of cands) {
    const n = parseInt(String(c ?? ''), 10);
    if (!isNaN(n) && n > maxLorries) {
      maxLorries = n;
    }
  }
  if (poData.lorry_status) {
    const m = String(poData.lorry_status).match(/(\d+)\s*\/\s*(\d+)/);
    if (m && m[2]) {
      const parsedTotal = parseInt(m[2], 10);
      if (!isNaN(parsedTotal) && parsedTotal > maxLorries) {
        maxLorries = parsedTotal;
      }
    }
  }

  const mtCands = [
    poData.total_contract_mt,
    poData.contract_weight_mt,
    poData.sauda_contract_mt,
    poData.total_wt_in_ton,
    poData.weight_mt
  ];
  let contractMt = 0;
  for (const mc of mtCands) {
    const val = parseFloat(String(mc ?? ''));
    if (!isNaN(val) && val > contractMt) {
      contractMt = val;
    }
  }
  if (contractMt === 0 && poData.quantity) {
    const qVal = parseFloat(String(poData.quantity));
    const uStr = String(poData.unit || poData.unit_type || poData.purchase_unit_name || '').toUpperCase();
    if (!isNaN(qVal) && qVal > 0 && (uStr.includes('TON') || uStr === 'MT' || qVal <= 60)) {
      contractMt = qVal;
    }
  }

  const wtPerLorry = parseFloat(poData.weight_per_lorry || poData.wt_per_lorry || 0);
  let inferredByWt = 1;
  if (contractMt > 0 && wtPerLorry > 0 && contractMt > wtPerLorry * 1.3) {
    inferredByWt = Math.max(1, Math.round(contractMt / wtPerLorry));
  } else if (contractMt >= 15) {
    inferredByWt = Math.max(1, Math.round(contractMt / 10));
  }

  return Math.max(1, maxLorries, inferredByWt);
};

export const getUniquePoLorryGroups = (
  poNo: string,
  inspections: any[],
  selectedPoData?: any
): Array<{ primaryMr: string; allIds: Set<string>; dateStr: string; lorryNo: string }> => {
  if (!poNo) return [];
  const normPo = (s: any) =>
    String(s || '')
      .trim()
      .replace(/^#+/, '')
      .replace(/\(PTF\)/gi, '')
      .trim()
      .toUpperCase();

  const cleanTargetPo = normPo(poNo);
  const cleanAlphaTargetPo = cleanTargetPo.replace(/[^A-Z0-9]/g, '');

  const matched = (inspections || []).filter((insp: any) => {
    const mrVal = insp.mr_no || insp.final_arrival_no || insp.arrival_no || insp.temporary_arrival_no;
    if (!mrVal) return false;

    const inspPoCands = [
      insp.po_no,
      insp.mill_po_no,
      insp.contract_po_no,
      insp.contract_no,
      insp.sauda_no,
      insp.po_contract,
      insp.return_po_no
    ]
      .map(normPo)
      .filter(Boolean);

    for (const c of inspPoCands) {
      const cAlpha = c.replace(/[^A-Z0-9]/g, '');
      if (c === cleanTargetPo || (cleanAlphaTargetPo && cAlpha === cleanAlphaTargetPo)) {
        return true;
      }
    }

    return Boolean(
      (selectedPoData?.id && insp.po_id === selectedPoData.id) ||
      (selectedPoData?.purchase_order_id &&
        (insp.po_id === selectedPoData.purchase_order_id ||
          insp.purchase_order_id === selectedPoData.purchase_order_id))
    );
  });

  const groups: Array<{ primaryMr: string; allIds: Set<string>; dateStr: string; lorryNo: string }> = [];

  const getNum = (s: string) => {
    const m = s.match(/\d+/g);
    return m ? Number(m[m.length - 1]) : 0;
  };

  for (const insp of matched) {
    const idCandidates = [
      insp.final_arrival_no,
      insp.mr_no,
      insp.arrival_no,
      insp.temporary_arrival_no
    ]
      .map((v: any) => String(v || '').trim().toUpperCase())
      .filter((v: string) => v && v !== 'NO' && v !== 'N/A' && v !== 'NONE');

    if (idCandidates.length === 0) continue;

    const normLorry = String(insp.lorry_number || insp.lorry_no || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const rawDate = String(insp.arrival_date || insp.date || insp.mr_date || insp.created_at || '')
      .trim()
      .slice(0, 10);

    const existingGroup = groups.find((g) => {
      for (const id of idCandidates) {
        if (g.allIds.has(id)) return true;
      }
      if (normLorry && g.lorryNo && normLorry === g.lorryNo && (!rawDate || !g.dateStr || rawDate === g.dateStr)) {
        return true;
      }
      return false;
    });

    if (existingGroup) {
      idCandidates.forEach((id) => existingGroup.allIds.add(id));
      const bestCandidate = idCandidates[0];
      if (getNum(bestCandidate) > getNum(existingGroup.primaryMr)) {
        existingGroup.primaryMr = bestCandidate;
      }
      if (!existingGroup.dateStr && rawDate) existingGroup.dateStr = rawDate;
      if (!existingGroup.lorryNo && normLorry) existingGroup.lorryNo = normLorry;
    } else {
      groups.push({
        primaryMr: idCandidates[0],
        allIds: new Set(idCandidates),
        dateStr: rawDate,
        lorryNo: normLorry
      });
    }
  }

  return groups;
};

export const isLastMrForPo = (targetMrNo: string, poNo: string, inspections: any[], selectedPoData?: any): boolean => {
  if (!targetMrNo || !poNo || !selectedPoData) return false;
  const cleanTargetPo = poNo.trim().replace(/^#/, '').toUpperCase();
  const cleanTargetMr = targetMrNo.trim().toUpperCase();

  const contractLorries = getPoContractLorryCount(selectedPoData);
  const groups = getUniquePoLorryGroups(poNo, inspections, selectedPoData);

  // Ensure targetMrNo is represented in groups if not already matched
  const isTargetInGroups = groups.some(
    (g) => g.allIds.has(cleanTargetMr) || g.primaryMr.toUpperCase() === cleanTargetMr
  );
  if (!isTargetInGroups) {
    groups.push({
      primaryMr: cleanTargetMr,
      allIds: new Set([cleanTargetMr]),
      dateStr: '',
      lorryNo: ''
    });
  }

  const statusLower = String(selectedPoData?.status || '').trim().toLowerCase();
  const isReopened = Boolean(
    selectedPoData?.is_reopened === true ||
    selectedPoData?.reopened === true ||
    statusLower === 'open' ||
    (typeof localStorage !== 'undefined' && localStorage.getItem(`sauda_reopened_${cleanTargetPo}`) === 'true')
  );
  const isExplicitForceClosed =
    !isReopened &&
    Boolean(
      selectedPoData?.is_closed === true ||
      selectedPoData?.sauda_closed === true ||
      statusLower === 'closed' ||
      (typeof localStorage !== 'undefined' && localStorage.getItem(`sauda_closed_${cleanTargetPo}`) === 'true')
    );

  const receivedLorries = groups.length;
  const allLorriesReceived = contractLorries > 0 && receivedLorries >= contractLorries;

  // Short / Excess deduction MUST ONLY be implemented on the Last Lorry of the contract.
  // If more lorries are still pending arrival (e.g., 3 received out of 6 Lorry Sauda), return false.
  if (!allLorriesReceived && !isExplicitForceClosed) {
    return false;
  }

  if (groups.length === 0) return false;

  const getSuffix = (val: string) => {
    const m = val.match(/\d+/g);
    return m ? Number(m[m.length - 1]) : 0;
  };

  groups.sort((a, b) => {
    const suffA = getSuffix(a.primaryMr);
    const suffB = getSuffix(b.primaryMr);
    if (suffA !== suffB) return suffB - suffA;
    if (a.dateStr && b.dateStr && a.dateStr !== b.dateStr) {
      return b.dateStr.localeCompare(a.dateStr);
    }
    return b.primaryMr.localeCompare(a.primaryMr);
  });

  const lastGroup = groups[0];
  return lastGroup.allIds.has(cleanTargetMr) || lastGroup.primaryMr.toUpperCase() === cleanTargetMr;
};
