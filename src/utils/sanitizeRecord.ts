/**
 * Robust Normalization & Sanitization Utility
 * Guarantees that database records, cached localStorage data, and form states
 * contain strictly primitive values (string, number, boolean) for all scalar fields,
 * preventing Minified React Error #31 (Objects are not valid as a React child).
 */

export function safeString(val: any, fallback: string = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    // If it's an object with common label/name/value fields, extract the string
    return val.name || val.label || val.value || val.mr_no || val.title || val.code || fallback;
  }
  return fallback;
}

export function safeNumber(val: any, fallback: number = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
  }
  if (typeof val === 'object') {
    const extracted = val.value ?? val.rate ?? val.amount ?? val.qty ?? val.quantity;
    if (extracted !== undefined) return safeNumber(extracted, fallback);
  }
  return fallback;
}

export function safeRender(val: any, fallback: string = '-'): string {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map(item => safeRender(item, '')).filter(Boolean).join(', ') || fallback;
    }
    return val.name || val.label || val.value || val.mr_no || val.title || val.code || fallback;
  }
  return fallback;
}

export function sanitizeInspectionMaster(rec: any): any {
  if (!rec || typeof rec !== 'object') return null;

  const sanitized: any = {
    ...rec,
    id: safeString(rec.id, undefined),
    mr_no: safeString(rec.mr_no || rec.arrival_no || rec.final_arrival_no || rec.temporary_arrival_no),
    arrival_no: safeString(rec.arrival_no || rec.mr_no || rec.final_arrival_no || rec.temporary_arrival_no),
    mr_date: safeString(rec.mr_date || rec.arrival_date || rec.date),
    arrival_date: safeString(rec.arrival_date || rec.mr_date || rec.date),
    date: safeString(rec.date || rec.mr_date || rec.arrival_date),
    po_no: safeString(rec.po_no || rec.mill_po_no),
    po_date: safeString(rec.po_date || rec.mill_po_date),
    mill_po_no: safeString(rec.mill_po_no || rec.po_no),
    mill_po_date: safeString(rec.mill_po_date || rec.po_date),
    supplier_name: safeString(rec.supplier_name || rec.supplier || rec.challan_supplier),
    broker_name: safeString(rec.broker_name || rec.broker),
    lorry_number: safeString(rec.lorry_number || rec.lorry_no || rec.vehicle_no),
    unit_name: safeString(rec.unit_name || rec.unit, 'BALES'),
    actual_moisture: safeNumber(rec.actual_moisture ?? rec.moisture_act),
    claim_moisture: safeNumber(rec.claim_moisture ?? rec.moisture_claim),
    actual_dust: safeNumber(rec.actual_dust ?? rec.dust_act),
    claim_dust: safeNumber(rec.claim_dust ?? rec.dust_claim),
    actual_ncv: safeNumber(rec.actual_ncv ?? rec.ncv_act),
    claim_ncv: safeNumber(rec.claim_ncv ?? rec.ncv_claim),
    actual_grade_down: safeNumber(rec.actual_grade_down ?? rec.grade_down_act),
    claim_grade_down: safeNumber(rec.claim_grade_down ?? rec.grade_down_claim),
    detention_days: safeNumber(rec.detention_days),
    unloading_date: safeString(rec.unloading_date),
    mr_spcl_print: safeString(rec.mr_spcl_print),
    remarks: safeString(rec.remarks),
    status: safeString(rec.status, 'Completed'),
    deduction_rate: safeNumber(rec.deduction_rate),
    deduction_qty: safeNumber(rec.deduction_qty, 1),
    deduction_amount: safeNumber(rec.deduction_amount),
    settlement_amount: safeNumber(rec.settlement_amount),
    created_at: safeString(rec.created_at, new Date().toISOString())
  };

  // Sanitize deduction_type
  if (typeof rec.deduction_type === 'string') {
    sanitized.deduction_type = rec.deduction_type;
  } else if (Array.isArray(rec.deduction_type)) {
    sanitized.deduction_type = rec.deduction_type.map((d: any) => safeString(d?.deduction_type || d)).filter(Boolean).join(', ');
  } else if (typeof rec.deduction_type === 'object' && rec.deduction_type !== null) {
    sanitized.deduction_type = safeString(rec.deduction_type.name || rec.deduction_type.deduction_type || '');
  } else {
    sanitized.deduction_type = '';
  }

  // Sanitize deductions array
  let rawDeds = rec.deductions || rec.deduction_types;
  if (typeof rawDeds === 'string') {
    try { rawDeds = JSON.parse(rawDeds); } catch (e) { rawDeds = []; }
  }
  if (Array.isArray(rawDeds)) {
    sanitized.deductions = rawDeds.map((d: any, idx: number) => {
      if (typeof d === 'string') {
        return { id: String(idx + 1), deduction_type: d, deduction_rate: 0, deduction_qty: 1, deduction_amount: 0 };
      }
      return {
        id: safeString(d?.id, String(idx + 1)),
        deduction_type: safeString(d?.deduction_type || d?.name || d?.deduction || ''),
        deduction_rate: safeNumber(d?.deduction_rate || d?.rate || 0),
        deduction_qty: safeNumber(d?.deduction_qty || d?.qty || 1),
        deduction_amount: safeNumber(d?.deduction_amount || d?.amount || 0)
      };
    });
    sanitized.deduction_types = sanitized.deductions;
  } else {
    sanitized.deductions = [];
    sanitized.deduction_types = [];
  }

  // Sanitize grid_details / details array
  let rawGrid = rec.grid_details || rec.details || rec.items;
  if (typeof rawGrid === 'string') {
    try { rawGrid = JSON.parse(rawGrid); } catch (e) { rawGrid = []; }
  }
  if (Array.isArray(rawGrid)) {
    sanitized.grid_details = rawGrid.map((row: any) => sanitizeInspectionDetailRow(row, sanitized.mr_no));
    sanitized.details = sanitized.grid_details;
  }

  return sanitized;
}

export function sanitizeInspectionDetailRow(row: any, mrNo?: string): any {
  if (!row || typeof row !== 'object') return {};

  return {
    ...row,
    id: safeString(row.id, undefined),
    mr_no: safeString(row.mr_no || mrNo || ''),
    srl_no: safeNumber(row.srl_no, 1),
    crop_year: safeString(row.crop_year, '2026-27'),
    marka: safeString(row.marka || row.marks || ''),
    stock_grade_code: safeString(row.stock_grade_code || row.arrival_grade || row.grade || ''),
    stock_grade_name: safeString(row.stock_grade_name || row.stock_grade_code || row.arrival_grade || ''),
    unit: safeString(row.unit || row.unit_name, 'BALES'),
    quantity: safeNumber(row.quantity),
    challan_gross_wt: safeNumber(row.challan_gross_wt),
    receipt_gross_wt: safeNumber(row.receipt_gross_wt),
    add_weight: safeNumber(row.add_weight),
    less_weight: safeNumber(row.less_weight),
    reduced_weight: safeNumber(row.reduced_weight),
    final_receipt_wt: safeNumber(row.final_receipt_wt),
    lorry_read_avg: safeNumber(row.lorry_read_avg),
    insp_read_avg: safeNumber(row.insp_read_avg),
    moisture_act: safeNumber(row.moisture_act ?? row.actual_moisture),
    moisture_claim: safeNumber(row.moisture_claim ?? row.claim_moisture),
    dust_act: safeNumber(row.dust_act ?? row.actual_dust),
    dust_claim: safeNumber(row.dust_claim ?? row.claim_dust),
    ncv_act: safeNumber(row.ncv_act ?? row.actual_ncv),
    ncv_claim: safeNumber(row.ncv_claim ?? row.claim_ncv),
    grade_down_act: safeNumber(row.grade_down_act ?? row.actual_grade_down),
    grade_down_claim: safeNumber(row.grade_down_claim ?? row.claim_grade_down),
    settlement_moisture: safeNumber(row.settlement_moisture),
    settlement_grade_down: safeNumber(row.settlement_grade_down),
    settlement_dust: safeNumber(row.settlement_dust),
    settlement_ncv: safeNumber(row.settlement_ncv),
    ropes_weight: safeNumber(row.ropes_weight),
    ropes_tot_wt_grd: safeNumber(row.ropes_tot_wt_grd),
    ropes_grade: safeString(row.ropes_grade),
    chotta_weight: safeNumber(row.chotta_weight),
    chotta_tot_wt_grd: safeNumber(row.chotta_tot_wt_grd),
    chotta_grade: safeString(row.chotta_grade),
    tolerable: safeString(row.tolerable, 'Yes'),
    premium: safeString(row.premium, 'No'),
    is_premium: Boolean(row.is_premium || row.premium === 'Yes'),
    amount: safeNumber(row.amount),
    rate: safeNumber(row.rate || row.rate_qntl),
    area: safeString(row.area || row.area_name || row.arrival_area_name || row.purch_area_name),
    agency: safeString(row.agency || row.agency_name || row.arrival_agency_name || row.purch_agency_name),
    row_remarks: safeString(row.row_remarks),
    jqi_remarks: safeString(row.jqi_remarks || row.jci_remarks)
  };
}
