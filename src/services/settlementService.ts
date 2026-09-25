import { supabase } from '../lib/supabase';
import { dbModule } from './dbModule';
import { 
  SettlementDetailColumn, 
  emptyDetailColumn 
} from '../types/settlement.types';
import { findMatchedPoItem, parseGridOrItems } from '../utils/paymentCalculations';

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
  const rawQty = (inspItem || item) ? (
    inspItem?.quantity || inspItem?.bales ||
    item?.quantity || item?.quantity_rcpt || item?.quantity_chln || item?.qty || item?.packets || item?.total_packets || item?.bales || 0
  ) : 0;
  
  col.quantity = Number(rawQty) || 0;

  // 6. Arrival Quantity / Weight
  let rawWt = 0;
  if (inspItem || item) {
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

  // 7. Rate
  let paymentSettRate = 0;
  if (payDetailItem) {
    if (payDetailItem.sett_rate !== undefined && payDetailItem.sett_rate !== null && Number(payDetailItem.sett_rate) > 0) {
      paymentSettRate = Number(payDetailItem.sett_rate);
    } else if (Number(payDetailItem.rate_value) > 0) {
      const ded = Number(payDetailItem.deduction_rate) || 0;
      paymentSettRate = Math.max(0, Number(payDetailItem.rate_value) - ded);
    }
  }

  if (paymentSettRate > 0) {
    col.rate_value = paymentSettRate;
  } else {
    const rawRate = 
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
  }

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

  const rawMoistSett = inspItem?.settlement_moisture ?? item?.settlement_moisture ?? 
    inspItem?.moisture_sett ?? item?.moisture_sett ?? 
    inspItem?.moist_sett ?? item?.moist_sett ?? 
    inspItem?.sett_moisture ?? item?.sett_moisture;
  if (rawMoistSett != null) col.moist_sett = Number(rawMoistSett);

  const rawMoistClaim = inspItem?.moisture_claim ?? item?.moisture_claim ?? 
    inspItem?.claim_moisture ?? item?.claim_moisture ?? 
    inspItem?.moisture_act ?? item?.moisture_act ?? 
    inspItem?.actual_moisture ?? item?.actual_moisture ?? 
    inspItem?.insp_read_avg ?? item?.insp_read_avg ?? 
    inspItem?.moist_claim ?? item?.moist_claim;
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
  const maxArrivalLen = Math.max(inspDetails?.length || 0, faGridArr?.length || 0);
  for (let i = 0; i < maxArrivalLen; i++) {
    const inspItem = inspDetails?.[i] || null;
    const faItem = faGridArr?.[i] || null;
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

    const wt = Number(inspItem?.weight_qtl || inspItem?.arr_qty_wt || faItem?.weight_qtl || faItem?.arr_qty_wt || 0);
    const qty = Number(inspItem?.bales || inspItem?.quantity || faItem?.bales || faItem?.quantity || 0);
    const hasData = wt > 0 || qty > 0 || Boolean(nameG || codeG);

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

  if (arrivalRows.length > 0) {
    return [1, 2, 3, 4].map(idx => {
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
        return emptyDetailColumn(idx);
      }
    });
  }

  if (poDetails && poDetails.length > 0) {
    return [1, 2, 3, 4].map(idx => {
      const pDet = poDetails[idx - 1] || null;
      if (pDet) {
        const matchedPayDetail = (payDetails || []).find(pd => Number(pd.col_index) === idx) ||
          (payDetails || []).find(pd => {
            const pdGrade = (resolveGradeName(pd.grade, gList) || String(pd.grade || '')).trim().toUpperCase();
            const poGrade = (resolveGradeName(pDet.grade_name || pDet.quality || pDet.grade, gList) || '').trim().toUpperCase();
            return Boolean(pdGrade && poGrade && pdGrade === poGrade);
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
      return emptyDetailColumn(idx);
    });
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

  try {
    if (supabase) {
      const [pmRes, scpRes] = await Promise.all([
        supabase.from('purchase_master').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).maybeSingle(),
        supabase.from('sauda_check_point').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).maybeSingle()
      ]);

      if (pmRes?.data) {
        poData = pmRes.data;
      } else if (scpRes?.data) {
        const scp = scpRes.data;
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
        if (pmIlike?.data && pmIlike.data.length > 0) poData = pmIlike.data[0];
        else if (scpIlike?.data && scpIlike.data.length > 0) {
          const scp = scpIlike.data[0];
          poData = {
            ...scp,
            po_date: scp.po_date || scp.s_date,
            supplier: scp.supplier_name || scp.supplier,
            broker: scp.broker_name || scp.broker,
            total_contract_mt: scp.total_contract_mt || scp.quantity || 0,
            pending: scp.pending ?? true,
            status: scp.status || 'temp'
          };
        }
      }

      if (poData?.items || poData?.grid_details) {
        const parsed = parseGridOrItems(poData.items || poData.grid_details);
        if (parsed.length > 0 && parsed.some((it: any) => it.grade || it.grade_name || it.grade_code || it.rate_qntl || it.rate)) {
          poDetails = parsed;
        }
      }

      if (poDetails.length === 0) {
        const [pdmRes, scpdRes] = await Promise.all([
          supabase.from('purchase_detail_master').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).order('srl_no', { ascending: true }),
          supabase.from('sauda_check_point_details').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).order('srl_no', { ascending: true })
        ]);

        if (pdmRes?.data && pdmRes.data.length > 0) {
          poDetails = pdmRes.data;
        } else if (scpdRes?.data && scpdRes.data.length > 0) {
          poDetails = scpdRes.data;
        } else {
          const [pdmIlike, scpdIlike] = await Promise.all([
            supabase.from('purchase_detail_master').select('*').ilike('po_no', cleanPo),
            supabase.from('sauda_check_point_details').select('*').ilike('po_no', cleanPo)
          ]);
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
      if (matchPm) poData = matchPm;
      else {
        const matchScp = (localScp || []).find((p: any) => String(p.po_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
        if (matchScp) poData = matchScp;
      }
    }

    if (poDetails.length === 0) {
      const [localPdm, localScpd] = await Promise.all([
        dbModule.fetchAll('purchase_detail_master').catch(() => []),
        dbModule.fetchAll('sauda_check_point_details').catch(() => [])
      ]);
      const matchPdm = (localPdm || []).filter((d: any) => String(d.po_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
      if (matchPdm.length > 0) poDetails = matchPdm;
      else {
        const matchScpd = (localScpd || []).filter((d: any) => String(d.po_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
        if (matchScpd.length > 0) poDetails = matchScpd;
      }
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

  const enrichedItems = poDetails.map((item: any) => {
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

    const rateVal = Number(item.rate_qntl || item.rate_per_mt || item.rate_mt || item.rate || poData?.b_rate || poData?.rate_qntl || 0);

    return {
      ...item,
      grade_name: gradeName || item.grade_code || '',
      agency_name: agencyName || item.agency_code || '',
      rate_qntl: rateVal,
      rate_per_mt: rateVal,
      rate: rateVal
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

    if (supabase) {
      const { data } = await supabase
        .from('sauda_check_point_deductions')
        .select('*')
        .or(`po_no.eq.${rawPoNo},po_no.eq.${poWithHash}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) return data;
    }

    const localRecords = await dbModule.fetchAll('sauda_check_point_deductions').catch(() => []);
    if (Array.isArray(localRecords) && localRecords.length > 0) {
      const found = localRecords.find((r: any) => {
        const rPo = String(r.po_no || '').trim().replace(/^#/, '').toUpperCase();
        return rPo === rawPoNo.toUpperCase();
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
