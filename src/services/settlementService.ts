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
  const arrivalRows: Array<{ inspItem: any; faItem: any; rawGrade: string; gradeName: string; gradeCode: string; hasData: boolean }> = [];
  const maxArrivalLen = Math.max(inspDetails?.length || 0, faGridArr?.length || 0, payDetails?.length || 0);
  for (let i = 0; i < maxArrivalLen; i++) {
    const inspItem = inspDetails?.[i] || null;
    const faItem = faGridArr?.[i] || null;
    const payItem = payDetails?.[i] || null;
    const rawG = 
      payItem?.grade ||
      inspItem?.stock_grade_name || inspItem?.arrival_grade || inspItem?.grade || inspItem?.grade_name || 
      inspItem?.stock_grade_code || inspItem?.grade_code ||
      faItem?.receipt_grade_name || faItem?.challan_grade_name || faItem?.stock_grade_name || faItem?.arrival_grade || 
      faItem?.grade || faItem?.grade_name || faItem?.quality || '';
    const codeG = String(
      inspItem?.stock_grade_code || inspItem?.grade_code || 
      faItem?.receipt_grade_code || faItem?.grade_code || ''
    ).trim();
    const nameG = (resolveGradeName(rawG || codeG, gList) || rawG || '').trim().toUpperCase();

    const wt = Number(payItem?.arr_qty_wt || inspItem?.final_receipt_wt || inspItem?.weight_qtl || inspItem?.arr_qty_wt || faItem?.weight_qtl || faItem?.arr_qty_wt || 0);
    const qty = Number(payItem?.quantity || inspItem?.bales || inspItem?.quantity || faItem?.bales || faItem?.quantity || faItem?.quantity_rcpt || 0);
    const hasData = wt > 0 || qty > 0;

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

  const matchedPoIndices = new Set<number>();

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

      // If pd has specs or values, backfill them into col
      if (pd) {
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

        const matchedPayDetail = (payDetails || []).find(pd => Number(pd.col_index) === idx) ||
          (payDetails || []).find(pd => {
            const pdGrade = (resolveGradeName(pd.grade, gList) || String(pd.grade || '')).trim().toUpperCase();
            const arrGrade = (resolveGradeName(arr.gradeName || arr.rawGrade, gList) || String(arr.gradeName || arr.rawGrade || '')).trim().toUpperCase();
            return Boolean(pdGrade && arrGrade && pdGrade === arrGrade);
          });

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
        const matchedPayDetail = (payDetails || []).find(pd => Number(pd.col_index) === idx) ||
          (payDetails || []).find(pd => {
            const pdGrade = (resolveGradeName(pd.grade, gList) || String(pd.grade || '')).trim().toUpperCase();
            const poGrade = (resolveGradeName(pDet.grade_name || pDet.quality || pDet.grade, gList) || '').trim().toUpperCase();
            return Boolean(pdGrade && poGrade && pdGrade === poGrade);
          });

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
    if (supabase) {
      const [pmRes, scpRes] = await Promise.all([
        supabase.from('purchase_master').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).maybeSingle(),
        supabase.from('sauda_check_point').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}",ptf_no.eq."${cleanPo}",sauda_no.eq."${cleanPo}"`).maybeSingle()
      ]);

      const pm = pmRes?.data || null;
      const scp = scpRes?.data || null;

      if (pm && scp) {
        poData = {
          ...pm,
          ...scp,
          po_no: pm.po_no || scp.po_no,
          po_date: pm.po_date || scp.po_date || scp.s_date,
          supplier: pm.supplier || scp.supplier_name || scp.supplier,
          broker: pm.broker || scp.broker_name || scp.broker,
          total_contract_mt: pm.total_contract_mt || scp.total_contract_mt || scp.quantity || 0,
          premium: Number(scp.premium || pm.premium || 0),
          items: scp.items || pm.items,
          grid_details: scp.grid_details || pm.grid_details
        };
      } else if (pm) {
        poData = pm;
      } else if (scp) {
        poData = {
          ...scp,
          po_date: scp.po_date || scp.s_date,
          supplier: scp.supplier_name || scp.supplier,
          broker: scp.broker_name || scp.broker,
          total_contract_mt: scp.total_contract_mt || scp.quantity || 0,
          pending: scp.pending ?? true,
          status: scp.status || 'temp'
        };
      } else {
        const { data: archPo } = await supabase.from('po_archive').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).maybeSingle();
        if (archPo) poData = archPo;
      }

      if (!poData) {
        const [pmIlike, scpIlike] = await Promise.all([
          supabase.from('purchase_master').select('*').ilike('po_no', cleanPo).limit(1),
          supabase.from('sauda_check_point').select('*').ilike('po_no', cleanPo).limit(1)
        ]);
        const pmRow = pmIlike?.data?.[0] || null;
        const scpRow = scpIlike?.data?.[0] || null;
        if (pmRow && scpRow) {
          poData = {
            ...pmRow,
            ...scpRow,
            po_date: pmRow.po_date || scpRow.po_date || scpRow.s_date,
            supplier: pmRow.supplier || scpRow.supplier_name || scpRow.supplier,
            broker: pmRow.broker || scpRow.broker_name || scpRow.broker,
            total_contract_mt: pmRow.total_contract_mt || scpRow.total_contract_mt || scpRow.quantity || 0,
            premium: Number(scpRow.premium || pmRow.premium || 0),
            items: scpRow.items || pmRow.items,
            grid_details: scpRow.grid_details || pmRow.grid_details
          };
        } else if (pmRow) {
          poData = pmRow;
        } else if (scpRow) {
          poData = {
            ...scpRow,
            po_date: scpRow.po_date || scpRow.s_date,
            supplier: scpRow.supplier_name || scpRow.supplier,
            broker: scpRow.broker_name || scpRow.broker,
            total_contract_mt: scpRow.total_contract_mt || scpRow.quantity || 0,
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
      const [localPm, localScp] = await Promise.all([
        dbModule.fetchAll('purchase_master').catch(() => []),
        dbModule.fetchAll('sauda_check_point').catch(() => [])
      ]);
      const matchPm = (localPm || []).find((p: any) => String(p.po_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
      const matchScp = (localScp || []).find((p: any) => String(p.po_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
      if (matchPm && matchScp) poData = { ...matchPm, ...matchScp };
      else if (matchPm) poData = matchPm;
      else if (matchScp) poData = matchScp;
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

export const isLastMrForPo = (targetMrNo: string, poNo: string, inspections: any[], selectedPoData?: any): boolean => {
  if (!targetMrNo || !poNo) return true;
  const cleanTargetPo = poNo.trim().replace(/^#/, '').toUpperCase();

  const matched = (inspections || []).filter((insp: any) => {
    const mrVal = insp.mr_no || insp.final_arrival_no || insp.arrival_no;
    if (!mrVal) return false;
    const inspPo = (insp.po_no || '').trim().replace(/^#/, '').toUpperCase();
    return inspPo === cleanTargetPo ||
      (selectedPoData?.id && insp.po_id === selectedPoData.id) ||
      (selectedPoData?.purchase_order_id && (insp.po_id === selectedPoData.purchase_order_id || insp.purchase_order_id === selectedPoData.purchase_order_id));
  });

  const mrKeys = Array.from(new Set(matched.map((insp: any) => String(insp.mr_no || insp.final_arrival_no || insp.arrival_no || '').trim()).filter(Boolean)));

  if (targetMrNo && !mrKeys.some(k => k.toUpperCase() === targetMrNo.trim().toUpperCase())) {
    mrKeys.push(targetMrNo.trim());
  }

  if (mrKeys.length <= 1) return true;

  mrKeys.sort((a, b) => {
    const getSuffix = (val: string) => {
      const m = val.match(/\d+/g);
      return m ? Number(m[m.length - 1]) : 0;
    };
    const suffA = getSuffix(a);
    const suffB = getSuffix(b);
    if (suffA !== suffB) return suffB - suffA;
    return b.localeCompare(a);
  });

  const lastMr = mrKeys[0];
  return targetMrNo.trim().toUpperCase() === lastMr.trim().toUpperCase();
};
