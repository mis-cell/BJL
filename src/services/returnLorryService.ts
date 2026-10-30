import { supabase } from '../lib/supabase';
import { dbModule, notifyDataChanged } from './dbModule';

export interface ReturnLorryItemRow {
  id?: string;
  return_po_no: string;
  reference_po_no: string;
  mr_no?: string;
  srl_no: number;
  crop_year: string;
  grade_code: string;
  grade_name: string;
  arrival_grade?: string;
  stock_grade_code?: string;
  stock_grade_name?: string;
  area?: string;
  agency_code: string;
  agency_name: string;
  marka_code: string;
  marka_name: string;
  lot?: string;
  unit?: string;
  quantity: number;
  weight_mt: number;
  challan_gross_wt?: number;
  receipt_gross_wt?: number;
  final_receipt_wt?: number;
  rate_qntl: number;
  premium: number | string;
  actual_moisture?: number;
  claim_moisture?: number;
  settlement_moisture?: number;
  actual_dust?: number;
  claim_dust?: number;
  settlement_dust?: number;
  actual_ncv?: number;
  claim_ncv?: number;
  settlement_ncv?: number;
  actual_grade_down?: number;
  claim_grade_down?: number;
  settlement_grade_down?: number;
  ropes_weight?: number;
  ropes_grade?: string;
  chotta_weight?: number;
  chotta_grade?: string;
  tolerable?: string;
  row_remarks?: string;
  jqi_remarks?: string;
  jci_remarks?: string;
}

export interface ReturnLorryRecord {
  id?: string;
  // Core Return Lorry 4000-Series & Reference PO Identity
  new_po_no: string; // 4000 series PO e.g. BJCL/2026-2027/4001
  po_no: string; // Alias for new_po_no for seamless Payment & Settlement compatibility
  reference_po_no: string; // Original Sauda Check Point PO e.g. BJCL/2026-2027/0660

  // ============================================================================
  // ALL MILL INSPECTION ("material_inspection") FIELDS
  // ============================================================================
  mr_no: string;
  mr_date: string;
  final_arrival_no: string;
  temporary_arrival_no: string;
  arrival_no: string;
  arrival_date: string;
  unloading_date: string;
  mill_po_no: string;
  mill_po_date: string;
  mr_spcl_print: string; // Way Bill No.
  broker_name: string;
  supplier_name: string;
  lorry_number: string;
  lorry_sequence_no: number;
  received_weight_mt: number; // < 5 MT received weight
  challan_gross_wt: number;
  receipt_gross_wt: number;
  total_challan_gross_wt: number;
  total_receipt_gross_wt: number;
  actual_moisture: number;
  claim_moisture: number;
  actual_dust: number;
  claim_dust: number;
  actual_ncv: number;
  claim_ncv: number;
  actual_grade_down: number;
  claim_grade_down: number;
  detention_days: number;
  delivery_claim: number;
  deduction_type: string;
  deduction_rate: number;
  deduction_qty: number;
  deduction_amount: number;
  advance_amount: number;
  on_account_advance_amount: number;
  settlement_amount: number;
  sent_settlement_date: string;
  lorry_returned: string;
  lorry_returned_other_mill: string;
  mr_print_date: string;
  consignment_no: string;
  consignment_date: string;
  arival_apmc_fees: number;
  arrival_remarks: string;
  insp_remarks: string;
  unit_name: string;
  quality_matrix?: any;
  inspection_details?: any[];
  grid_details?: any[];

  // ============================================================================
  // ALL SAUDA CHECK POINT ("sauda_check_point") FIELDS
  // ============================================================================
  financial_year: string;
  purchase_order: string;
  po_type: string;
  status: string;
  ptf_no?: string | null;
  pending: boolean;
  po_date: string;
  s_date?: string | null;
  broker_code?: string;
  broker: string;
  supplier_code?: string;
  supplier: string;
  challan_supplier_code?: string;
  challan_supplier: string;
  area_code?: string;
  area: string;
  trans_paid_by: string;
  weight_unit_kgs: number;
  against_cancellation: string;
  purchase_unit_code: string;
  purchase_unit_name: string;
  total_lorries: number;
  units_per_lorry: number;
  total_units: number;
  weight_per_lorry: number;
  total_contract_mt: number;
  marka_type: string;
  marka_penalty: number;
  qty_penalty: number;
  delivery_from?: string | null;
  delivery_to?: string | null;
  shipment_date?: string | null;
  grace_days: number;
  shipment_days: number;
  delivery_penalty: number;
  shipment_penalty: number;
  contract_po_no: string;
  sauda_no: string;
  contract_date?: string | null;
  rate_detail: string;
  delivery_schedule: string;
  terms_condition: string;
  remarks: string;
  po_remarks: string;
  po_identification: string;
  b_rate: number;
  is_return_lorry: boolean;
  created_at?: string;
  items?: ReturnLorryItemRow[];
  sauda_details?: any[];
  raw_inspection?: Record<string, any>;
  raw_sauda_check_point?: Record<string, any>;
}

const LOCAL_STORAGE_KEY = 'bjcl_return_lorry_records_v2';

function getLocalCachedReturnLorries(): ReturnLorryRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw || raw === 'undefined' || raw === 'null') return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setLocalCachedReturnLorries(records: ReturnLorryRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore storage quota errors
  }
}

let schemaInitStarted = false;

/**
 * Ensures the `return_lorry` and `return_lorry_details` tables exist in Supabase
 * with ALL columns from both `material_inspection` and `sauda_check_point`.
 * Runs non-blockingly with a short timeout so it never hangs page rendering.
 */
export async function ensureReturnLorryTablesExist(): Promise<void> {
  if (schemaInitStarted || !supabase) return;
  schemaInitStarted = true;

  const sql = `
    CREATE TABLE IF NOT EXISTS return_lorry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      new_po_no TEXT UNIQUE NOT NULL,
      po_no TEXT NOT NULL,
      reference_po_no TEXT NOT NULL,
      mr_no TEXT NOT NULL,
      mr_date TEXT,
      final_arrival_no TEXT,
      temporary_arrival_no TEXT,
      arrival_no TEXT,
      arrival_date TEXT,
      unloading_date TEXT,
      mill_po_no TEXT,
      mill_po_date TEXT,
      mr_spcl_print TEXT,
      broker_name TEXT,
      supplier_name TEXT,
      lorry_number TEXT,
      lorry_sequence_no INTEGER DEFAULT 1,
      received_weight_mt NUMERIC(15,3) DEFAULT 0,
      challan_gross_wt NUMERIC(15,3) DEFAULT 0,
      receipt_gross_wt NUMERIC(15,3) DEFAULT 0,
      total_challan_gross_wt NUMERIC(15,3) DEFAULT 0,
      total_receipt_gross_wt NUMERIC(15,3) DEFAULT 0,
      actual_moisture NUMERIC(10,2) DEFAULT 0,
      claim_moisture NUMERIC(10,2) DEFAULT 0,
      actual_dust NUMERIC(10,2) DEFAULT 0,
      claim_dust NUMERIC(10,2) DEFAULT 0,
      actual_ncv NUMERIC(10,2) DEFAULT 0,
      claim_ncv NUMERIC(10,2) DEFAULT 0,
      actual_grade_down NUMERIC(10,2) DEFAULT 0,
      claim_grade_down NUMERIC(10,2) DEFAULT 0,
      detention_days INTEGER DEFAULT 0,
      delivery_claim NUMERIC(15,2) DEFAULT 0,
      deduction_type TEXT,
      deduction_rate NUMERIC(15,2) DEFAULT 0,
      deduction_qty NUMERIC(15,3) DEFAULT 0,
      deduction_amount NUMERIC(15,2) DEFAULT 0,
      advance_amount NUMERIC(15,2) DEFAULT 0,
      on_account_advance_amount NUMERIC(15,2) DEFAULT 0,
      settlement_amount NUMERIC(15,2) DEFAULT 0,
      sent_settlement_date TEXT,
      lorry_returned TEXT DEFAULT 'Yes',
      lorry_returned_other_mill TEXT DEFAULT 'No',
      mr_print_date TEXT,
      consignment_no TEXT,
      consignment_date TEXT,
      arival_apmc_fees NUMERIC(15,2) DEFAULT 0,
      arrival_remarks TEXT,
      insp_remarks TEXT,
      unit_name TEXT,
      quality_matrix JSONB DEFAULT '{}'::jsonb,
      inspection_details JSONB DEFAULT '[]'::jsonb,
      grid_details JSONB DEFAULT '[]'::jsonb,
      financial_year TEXT DEFAULT '2026-2027',
      purchase_order TEXT DEFAULT 'FINAL PO',
      po_type TEXT DEFAULT 'Return Lorry',
      status TEXT DEFAULT 'open',
      ptf_no TEXT,
      pending BOOLEAN DEFAULT TRUE,
      po_date TEXT,
      s_date TEXT,
      broker_code TEXT,
      broker TEXT,
      supplier_code TEXT,
      supplier TEXT,
      challan_supplier_code TEXT,
      challan_supplier TEXT,
      area_code TEXT,
      area TEXT,
      trans_paid_by TEXT DEFAULT 'PARTY',
      weight_unit_kgs NUMERIC(10,2) DEFAULT 147.5,
      against_cancellation TEXT DEFAULT 'No',
      purchase_unit_code TEXT DEFAULT '1',
      purchase_unit_name TEXT DEFAULT 'BALES',
      total_lorries NUMERIC(10,2) DEFAULT 1,
      units_per_lorry NUMERIC(10,2) DEFAULT 0,
      total_units NUMERIC(10,2) DEFAULT 0,
      weight_per_lorry NUMERIC(15,3) DEFAULT 0,
      total_contract_mt NUMERIC(15,3) DEFAULT 0,
      marka_type TEXT DEFAULT 'Normal',
      marka_penalty NUMERIC(10,2) DEFAULT 0,
      qty_penalty NUMERIC(10,2) DEFAULT 0,
      delivery_from TEXT,
      delivery_to TEXT,
      shipment_date TEXT,
      grace_days INTEGER DEFAULT 0,
      shipment_days INTEGER DEFAULT 0,
      delivery_penalty NUMERIC(10,2) DEFAULT 0,
      shipment_penalty NUMERIC(10,2) DEFAULT 0,
      contract_po_no TEXT,
      sauda_no TEXT,
      contract_date TEXT,
      rate_detail TEXT,
      delivery_schedule TEXT,
      terms_condition TEXT,
      remarks TEXT,
      po_remarks TEXT,
      po_identification TEXT DEFAULT 'Direct Advance Payment',
      b_rate NUMERIC(15,2) DEFAULT 0,
      sauda_details JSONB DEFAULT '[]'::jsonb,
      is_return_lorry BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS return_lorry_details (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      return_po_no TEXT NOT NULL,
      reference_po_no TEXT NOT NULL,
      mr_no TEXT,
      srl_no INTEGER DEFAULT 1,
      crop_year TEXT DEFAULT '2026-27',
      grade_code TEXT,
      grade_name TEXT,
      arrival_grade TEXT,
      stock_grade_code TEXT,
      stock_grade_name TEXT,
      area TEXT,
      agency_code TEXT,
      agency_name TEXT,
      marka_code TEXT,
      marka_name TEXT,
      lot TEXT,
      unit TEXT DEFAULT 'BALES',
      quantity NUMERIC(15,3) DEFAULT 0,
      weight_mt NUMERIC(15,3) DEFAULT 0,
      challan_gross_wt NUMERIC(15,3) DEFAULT 0,
      receipt_gross_wt NUMERIC(15,3) DEFAULT 0,
      final_receipt_wt NUMERIC(15,3) DEFAULT 0,
      rate_qntl NUMERIC(15,2) DEFAULT 0,
      premium NUMERIC(15,2) DEFAULT 0,
      actual_moisture NUMERIC(10,2) DEFAULT 0,
      claim_moisture NUMERIC(10,2) DEFAULT 0,
      actual_dust NUMERIC(10,2) DEFAULT 0,
      claim_dust NUMERIC(10,2) DEFAULT 0,
      actual_ncv NUMERIC(10,2) DEFAULT 0,
      claim_ncv NUMERIC(10,2) DEFAULT 0,
      actual_grade_down NUMERIC(10,2) DEFAULT 0,
      claim_grade_down NUMERIC(10,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE IF EXISTS return_lorry DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS return_lorry_details DISABLE ROW LEVEL SECURITY;
    NOTIFY pgrst, 'reload schema';
  `;

  // Execute in background with a 2.5s timeout so UI never waits on DDL
  Promise.race([
    (async () => {
      try {
        await supabase.rpc('exec_sql', { query: sql }).then(() => {}, () => {});
        await supabase.rpc('exec_sql', { sql_query: sql }).then(() => {}, () => {});
      } catch (_e) {
        // ignore if exec_sql RPC is not enabled
      }
    })(),
    new Promise<void>((resolve) => setTimeout(resolve, 2500)),
  ]).catch(() => {});
}

export function normalizeStr(v: any): string {
  return String(v || '').trim().toUpperCase();
}

export function extractCanonicalPoSerial(raw: any): string {
  const str = normalizeStr(raw);
  if (!str || str === 'NO' || str === 'N/A' || str === 'NONE') return '';
  const withoutPrefix = str
    .replace(/^#/, '')
    .replace(/^BJCL\//i, '')
    .replace(/^BJC\//i, '')
    .replace(/^BJC/i, '')
    .replace(/^PO[-/]/i, '')
    .replace(/^PTF[-/]/i, '')
    .replace(/\(PTF\)/gi, '');
  const withoutYear = withoutPrefix
    .replace(/20\d{2}-20\d{2}/g, '')
    .replace(/20\d{2}\/20\d{2}/g, '')
    .replace(/20\d{2}20\d{2}/g, '')
    .replace(/\/\d{2}-\d{2}$/g, '')
    .replace(/^\d{2}-\d{2}\//g, '')
    .replace(/[^0-9A-Z]/g, '');
  if (!withoutYear) return '';
  return withoutYear.replace(/^0+/, '') || '0';
}

export function is4000SeriesPo(poNo: any): boolean {
  const s = normalizeStr(poNo);
  if (!s) return false;
  const parts = s.split('/');
  const last = parts[parts.length - 1]?.replace(/[^0-9]/g, '') || '';
  const num = parseInt(last, 10);
  return !isNaN(num) && num >= 4000 && num < 5000;
}

/**
 * Calculates the received weight in Metric Tons (MT) from a Mill Inspection record,
 * its detail rows (`material_inspection_details` / `mill_inspection_detail`),
 * `final_arrival`, and `temporary_material_received`.
 */
export function calculateInspectionWeightMt(
  inspectionRecord: any,
  detailRows?: any[],
  finalArrivalRecord?: any,
  tempArrivalRecord?: any
): number {
  const toMt = (val: number, unitHint?: 'MT' | 'QTL' | 'KG'): number => {
    if (!isFinite(val) || val <= 0) return 0;
    if (unitHint === 'QTL') return Number((val / 10).toFixed(3));
    if (unitHint === 'KG') return Number((val / 1000).toFixed(3));
    if (val > 500) return Number((val / 1000).toFixed(3)); // Kgs -> MT
    if (val > 40) return Number((val / 10).toFixed(3)); // Quintals -> MT
    return Number(val.toFixed(3)); // Already MT
  };

  // 1. Check detail rows (from material_inspection_details / mill_inspection_detail / grid_details)
  const rows: any[] = Array.isArray(detailRows) && detailRows.length > 0
    ? detailRows
    : (() => {
        const gd = inspectionRecord?.grid_details ?? inspectionRecord?.details ?? inspectionRecord?.inspection_details;
        if (Array.isArray(gd)) return gd;
        if (typeof gd === 'string' && gd.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(gd);
            if (Array.isArray(parsed)) return parsed;
          } catch {}
        }
        return [];
      })();

  if (rows.length > 0) {
    let sum = 0;
    for (const r of rows) {
      const rw = Number(
        r.receipt_gross_wt ||
        r.final_receipt_wt ||
        r.challan_gross_wt ||
        r.netto_pnto ||
        r.netto_mt ||
        r.weight_mt ||
        r.reduced_weight ||
        r.gross_weight_batch ||
        r.weight ||
        r.weight_kgs ||
        0
      );
      if (rw > 0) {
        sum += toMt(rw);
      }
    }
    if (sum > 0) return Number(sum.toFixed(3));
  }

  // 2. Check master fields on inspectionRecord
  if (inspectionRecord) {
    if (Number(inspectionRecord.weight_qtl) > 0) {
      return toMt(Number(inspectionRecord.weight_qtl), 'QTL');
    }
    const masterCandidates = [
      inspectionRecord.received_weight_mt,
      inspectionRecord.total_receipt_gross_wt,
      inspectionRecord.receipt_gross_wt,
      inspectionRecord.total_challan_gross_wt,
      inspectionRecord.challan_gross_wt,
      inspectionRecord.actual_weight,
      inspectionRecord.net_weight,
      inspectionRecord.electronic_net_weight,
      inspectionRecord.total_actual_weight,
      inspectionRecord.final_receipt_wt,
      inspectionRecord.weight,
    ];
    for (const c of masterCandidates) {
      const n = Number(c);
      if (n > 0) return toMt(n);
    }
  }

  // 3. Check finalArrivalRecord
  if (finalArrivalRecord) {
    if (Number(finalArrivalRecord.weight_qtl) > 0) {
      return toMt(Number(finalArrivalRecord.weight_qtl), 'QTL');
    }
    const faCandidates = [
      finalArrivalRecord.electronic_net_weight,
      finalArrivalRecord.supplier_net_weight,
      finalArrivalRecord.challan_material_weight,
      finalArrivalRecord.total_actual_weight,
      finalArrivalRecord.weight_reduced,
      finalArrivalRecord.weight,
      finalArrivalRecord.challan_wt,
    ];
    for (const c of faCandidates) {
      const n = Number(c);
      if (n > 0) return toMt(n);
    }
    const faGd = finalArrivalRecord.grid_details;
    let faRows: any[] = [];
    if (Array.isArray(faGd)) faRows = faGd;
    else if (typeof faGd === 'string' && faGd.trim().startsWith('[')) {
      try {
        const p = JSON.parse(faGd);
        if (Array.isArray(p)) faRows = p;
      } catch {}
    }
    if (faRows.length > 0) {
      let faSum = 0;
      for (const r of faRows) {
        const w = Number(r.netto_pnto || r.netto_mt || r.weight_mt || r.weight_kgs || r.challan_gross_wt || r.weight || 0);
        if (w > 0) faSum += toMt(w);
      }
      if (faSum > 0) return Number(faSum.toFixed(3));
    }
  }

  // 4. Check tempArrivalRecord
  if (tempArrivalRecord) {
    if (Number(tempArrivalRecord.weight_qtl) > 0) {
      return toMt(Number(tempArrivalRecord.weight_qtl), 'QTL');
    }
    const tmrCandidates = [
      tempArrivalRecord.net_weight,
      tempArrivalRecord.total_weight,
      tempArrivalRecord.challan_wt,
      tempArrivalRecord.weight,
      tempArrivalRecord.gross_weight,
    ];
    for (const c of tmrCandidates) {
      const n = Number(c);
      if (n > 0) return toMt(n);
    }
  }

  return 0;
}

/**
 * Generates the next 4000-series PO number based on the reference PO prefix/financial year.
 * Example: Reference `BJCL/2026-2027/0660` -> `BJCL/2026-2027/4001`
 */
export function generate4000SeriesPoNoFromSet(
  referencePoNo: string,
  financialYear: string = '2026-2027',
  usedNumbers: Set<number>
): string {
  let prefix = `BJCL/${financialYear || '2026-2027'}`;
  const cleanRef = String(referencePoNo || '').trim().toUpperCase();
  if (cleanRef.includes('/')) {
    const parts = cleanRef.split('/');
    if (parts.length >= 3) {
      prefix = `${parts[0]}/${parts[1]}`;
    } else if (parts.length === 2 && parts[0].startsWith('BJC')) {
      prefix = `${parts[0]}/${financialYear || '2026-2027'}`;
    }
  }

  let candidate = 4000;
  while (usedNumbers.has(candidate)) {
    candidate++;
  }
  usedNumbers.add(candidate);
  return `${prefix}/${candidate}`;
}

export async function generateNext4000SeriesPoNo(
  referencePoNo?: string,
  financialYear: string = '2026-2027'
): Promise<string> {
  const usedNumbers = new Set<number>();
  const addFromPo = (poStr: any) => {
    const s = normalizeStr(poStr);
    if (!s) return;
    const parts = s.split('/');
    const last = parts[parts.length - 1]?.replace(/[^0-9]/g, '') || '';
    const num = parseInt(last, 10);
    if (!isNaN(num) && num >= 4000 && num < 5000) {
      usedNumbers.add(num);
    }
  };

  getLocalCachedReturnLorries().forEach((r) => {
    addFromPo(r.new_po_no);
    addFromPo(r.po_no);
  });

  if (supabase) {
    try {
      const [rlRes, scpRes, pmRes] = await Promise.all([
        supabase.from('return_lorry').select('new_po_no, po_no').then((r) => r, () => ({ data: [] as any[] })),
        supabase.from('sauda_check_point').select('po_no').ilike('po_no', '%/4%').then((r) => r, () => ({ data: [] as any[] })),
        supabase.from('purchase_master').select('po_no').ilike('po_no', '%/4%').then((r) => r, () => ({ data: [] as any[] })),
      ]);
      ((rlRes as any)?.data || []).forEach((r: any) => {
        addFromPo(r.new_po_no);
        addFromPo(r.po_no);
      });
      ((scpRes as any)?.data || []).forEach((r: any) => addFromPo(r.po_no));
      ((pmRes as any)?.data || []).forEach((r: any) => addFromPo(r.po_no));
    } catch {}
  }

  return generate4000SeriesPoNoFromSet(referencePoNo || '', financialYear, usedNumbers);
}

/**
 * Helper to build a complete `ReturnLorryRecord` combining ALL fields of
 * `material_inspection` + `material_inspection_details` AND
 * `sauda_check_point` + `sauda_check_point_details`.
 */
export function buildCombinedReturnLorryRecord(params: {
  newPoNo: string;
  referencePoNo: string;
  insp: any;
  inspDetails: any[];
  sourcePo: any;
  sourcePoDetails: any[];
  matchedFa?: any;
  matchedTmr?: any;
  weightMt: number;
  lorrySeqNo: number;
}): ReturnLorryRecord {
  const {
    newPoNo,
    referencePoNo,
    insp,
    inspDetails,
    sourcePo,
    sourcePoDetails,
    matchedFa,
    matchedTmr,
    weightMt,
    lorrySeqNo,
  } = params;

  const todayStr = new Date().toISOString().split('T')[0];
  const mrNo = String(insp?.mr_no || matchedFa?.final_arrival_no || matchedFa?.mr_no || '').trim();
  const tempArrNo = String(
    insp?.arrival_no ||
    insp?.temporary_arrival_no ||
    matchedFa?.temporary_arrival_no ||
    matchedTmr?.temporary_arrival_no ||
    mrNo
  ).trim();
  const lorryNo = String(
    insp?.lorry_number ||
    matchedFa?.lorry_number ||
    matchedFa?.lorry_no ||
    matchedTmr?.lorry_no ||
    matchedTmr?.lorry_number ||
    ''
  ).trim().toUpperCase();

  const fy = String(
    sourcePo?.financial_year ||
    insp?.financial_year ||
    matchedFa?.financial_year ||
    '2026-2027'
  ).trim();

  const poDate = String(
    sourcePo?.po_date ||
    sourcePo?.date ||
    sourcePo?.s_date ||
    insp?.po_date ||
    matchedFa?.po_date ||
    insp?.mr_date ||
    todayStr
  ).trim();

  const supplierVal = String(
    sourcePo?.supplier ||
    insp?.supplier_name ||
    insp?.supplier ||
    matchedFa?.supplier ||
    matchedTmr?.supplier ||
    ''
  ).trim().toUpperCase();

  const brokerVal = String(
    sourcePo?.broker ||
    insp?.broker_name ||
    insp?.broker ||
    matchedFa?.broker ||
    matchedTmr?.broker ||
    ''
  ).trim().toUpperCase();

  const areaVal = String(
    sourcePo?.area ||
    inspDetails?.[0]?.area ||
    matchedFa?.arrival_area_name ||
    matchedFa?.area ||
    matchedTmr?.area ||
    ''
  ).trim().toUpperCase();

  const challanGrossSum = inspDetails.reduce((s, r) => s + (Number(r.challan_gross_wt) || 0), 0);
  const receiptGrossSum = inspDetails.reduce((s, r) => s + (Number(r.receipt_gross_wt ?? r.challan_gross_wt) || 0), 0);

  let parsedQualityMatrix: any = insp?.quality_matrix || {};
  if (typeof parsedQualityMatrix === 'string') {
    try {
      parsedQualityMatrix = JSON.parse(parsedQualityMatrix);
    } catch {
      parsedQualityMatrix = {};
    }
  }

  // Merge item details from Sauda Check Point (`sauda_check_point_details`) and Mill Inspection (`material_inspection_details`)
  const maxRows = Math.max(sourcePoDetails.length, inspDetails.length, 1);
  const combinedItems: ReturnLorryItemRow[] = [];

  for (let i = 0; i < maxRows; i++) {
    const sd = sourcePoDetails[i] || sourcePoDetails[0] || {};
    const idet = inspDetails[i] || {};
    const gradeCode = String(
      sd.grade_code ||
      sd.quality ||
      sd.grade ||
      idet.arrival_grade ||
      idet.stock_grade_code ||
      'TD5'
    ).trim().toUpperCase();
    const gradeName = String(
      sd.grade_name ||
      idet.arrival_grade ||
      idet.stock_grade_name ||
      gradeCode
    ).trim().toUpperCase();
    const agencyCode = String(sd.agency_code || sd.agency || idet.agency_code || idet.agency || '').trim().toUpperCase();
    const agencyName = String(sd.agency_name || idet.agency || agencyCode).trim().toUpperCase();
    const markaCode = String(sd.marka_code || sd.marka || idet.marka || idet.marks || '').trim().toUpperCase();
    const markaName = String(sd.marka_name || idet.marka || idet.marks || markaCode).trim().toUpperCase();

    combinedItems.push({
      return_po_no: newPoNo,
      reference_po_no: referencePoNo,
      mr_no: mrNo,
      srl_no: Number(sd.srl_no || idet.srl_no || i + 1),
      crop_year: String(sd.crop_year || sd.crop || idet.crop_year || '2026-27'),
      grade_code: gradeCode,
      grade_name: gradeName,
      arrival_grade: String(idet.arrival_grade || gradeName).toUpperCase(),
      stock_grade_code: String(idet.stock_grade_code || gradeCode).toUpperCase(),
      stock_grade_name: String(idet.stock_grade_name || gradeName).toUpperCase(),
      area: String(idet.area || areaVal).toUpperCase(),
      agency_code: agencyCode,
      agency_name: agencyName,
      marka_code: markaCode,
      marka_name: markaName,
      lot: String(idet.lot || ''),
      unit: String(idet.unit || sourcePo?.purchase_unit_name || 'BALES').toUpperCase(),
      quantity: Number(idet.quantity || sd.quantity || sd.qty || 0),
      weight_mt: Number(idet.receipt_gross_wt || idet.challan_gross_wt || sd.weight_mt || sd.weight || weightMt || 0),
      challan_gross_wt: Number(idet.challan_gross_wt || weightMt || 0),
      receipt_gross_wt: Number(idet.receipt_gross_wt || idet.challan_gross_wt || weightMt || 0),
      final_receipt_wt: Number(idet.final_receipt_wt || idet.receipt_gross_wt || idet.challan_gross_wt || weightMt || 0),
      rate_qntl: Number(sd.rate_qntl || sd.rate || sd.rs || idet.rate || idet.rate_qntl || sourcePo?.b_rate || 0),
      premium: sd.premium ?? idet.premium ?? 0,
      actual_moisture: Number(idet.actual_moisture ?? idet.moisture_act ?? insp?.actual_moisture ?? 0),
      claim_moisture: Number(idet.claim_moisture ?? idet.moisture_claim ?? insp?.claim_moisture ?? 0),
      settlement_moisture: Number(idet.settlement_moisture ?? 0),
      actual_dust: Number(idet.actual_dust ?? idet.dust_act ?? insp?.actual_dust ?? 0),
      claim_dust: Number(idet.claim_dust ?? idet.dust_claim ?? insp?.claim_dust ?? 0),
      settlement_dust: Number(idet.settlement_dust ?? 0),
      actual_ncv: Number(idet.actual_ncv ?? idet.ncv_act ?? insp?.actual_ncv ?? 0),
      claim_ncv: Number(idet.claim_ncv ?? idet.ncv_claim ?? insp?.claim_ncv ?? 0),
      settlement_ncv: Number(idet.settlement_ncv ?? 0),
      actual_grade_down: Number(idet.actual_grade_down ?? idet.grade_down_act ?? insp?.actual_grade_down ?? 0),
      claim_grade_down: Number(idet.claim_grade_down ?? idet.grade_down_claim ?? insp?.claim_grade_down ?? 0),
      settlement_grade_down: Number(idet.settlement_grade_down ?? 0),
      ropes_weight: Number(idet.ropes_weight || 0),
      ropes_grade: String(idet.ropes_grade || ''),
      chotta_weight: Number(idet.chotta_weight || 0),
      chotta_grade: String(idet.chotta_grade || ''),
      tolerable: String(idet.tolerable || 'Yes'),
      row_remarks: String(idet.row_remarks || ''),
      jqi_remarks: String(idet.jqi_remarks || ''),
      jci_remarks: String(idet.jci_remarks || ''),
    });
  }

  return {
    new_po_no: newPoNo,
    po_no: newPoNo,
    reference_po_no: referencePoNo,

    // Mill Inspection ("material_inspection") complete fields
    mr_no: mrNo,
    mr_date: String(insp?.mr_date || matchedFa?.mr_date || matchedFa?.date || todayStr),
    final_arrival_no: String(matchedFa?.final_arrival_no || mrNo),
    temporary_arrival_no: tempArrNo,
    arrival_no: tempArrNo,
    arrival_date: String(insp?.arrival_date || matchedFa?.arrival_date || matchedFa?.date || insp?.mr_date || todayStr),
    unloading_date: String(insp?.unloading_date || matchedFa?.unloading_date || insp?.arrival_date || insp?.mr_date || todayStr),
    mill_po_no: String(insp?.mill_po_no || referencePoNo),
    mill_po_date: String(insp?.mill_po_date || poDate),
    mr_spcl_print: String(insp?.mr_spcl_print || matchedFa?.way_bill_no || ''),
    broker_name: brokerVal,
    supplier_name: supplierVal,
    lorry_number: lorryNo,
    lorry_sequence_no: lorrySeqNo,
    received_weight_mt: Number(weightMt.toFixed(3)),
    challan_gross_wt: Number((Number(insp?.challan_gross_wt) || challanGrossSum || weightMt).toFixed(3)),
    receipt_gross_wt: Number((Number(insp?.receipt_gross_wt) || receiptGrossSum || challanGrossSum || weightMt).toFixed(3)),
    total_challan_gross_wt: Number((Number(insp?.total_challan_gross_wt) || challanGrossSum || weightMt).toFixed(3)),
    total_receipt_gross_wt: Number((Number(insp?.total_receipt_gross_wt) || receiptGrossSum || challanGrossSum || weightMt).toFixed(3)),
    actual_moisture: Number(insp?.actual_moisture ?? inspDetails?.[0]?.actual_moisture ?? 0),
    claim_moisture: Number(insp?.claim_moisture ?? inspDetails?.[0]?.claim_moisture ?? 0),
    actual_dust: Number(insp?.actual_dust ?? inspDetails?.[0]?.actual_dust ?? 0),
    claim_dust: Number(insp?.claim_dust ?? inspDetails?.[0]?.claim_dust ?? 0),
    actual_ncv: Number(insp?.actual_ncv ?? inspDetails?.[0]?.actual_ncv ?? 0),
    claim_ncv: Number(insp?.claim_ncv ?? inspDetails?.[0]?.claim_ncv ?? 0),
    actual_grade_down: Number(insp?.actual_grade_down ?? inspDetails?.[0]?.actual_grade_down ?? 0),
    claim_grade_down: Number(insp?.claim_grade_down ?? inspDetails?.[0]?.claim_grade_down ?? 0),
    detention_days: Number(insp?.detention_days || 0),
    delivery_claim: Number(insp?.delivery_claim || 0),
    deduction_type: String(insp?.deduction_type || ''),
    deduction_rate: Number(insp?.deduction_rate || 0),
    deduction_qty: Number(insp?.deduction_qty || 0),
    deduction_amount: Number(insp?.deduction_amount || 0),
    advance_amount: Number(insp?.advance_amount || 0),
    on_account_advance_amount: Number(insp?.on_account_advance_amount || 0),
    settlement_amount: Number(insp?.settlement_amount || 0),
    sent_settlement_date: String(insp?.sent_settlement_date || ''),
    lorry_returned: 'Yes',
    lorry_returned_other_mill: String(insp?.lorry_returned_other_mill || 'No'),
    mr_print_date: String(insp?.mr_print_date || insp?.mr_date || todayStr),
    consignment_no: String(insp?.consignment_no || matchedFa?.consignment_note_no || matchedFa?.consignment_no || ''),
    consignment_date: String(insp?.consignment_date || matchedFa?.consignment_note_date || insp?.arrival_date || todayStr),
    arival_apmc_fees: Number(insp?.arival_apmc_fees ?? matchedTmr?.apmc_fees ?? matchedFa?.apmc_fees ?? 0),
    arrival_remarks: String(insp?.arrival_remarks || matchedFa?.remarks || ''),
    insp_remarks: String(insp?.insp_remarks || insp?.remarks || ''),
    unit_name: String(insp?.unit_name || inspDetails?.[0]?.unit || sourcePo?.purchase_unit_name || 'BALES').toUpperCase(),
    quality_matrix: parsedQualityMatrix,
    inspection_details: inspDetails,
    grid_details: inspDetails,

    // Sauda Check Point ("sauda_check_point") complete fields
    financial_year: fy,
    purchase_order: String(sourcePo?.purchase_order || 'FINAL PO'),
    po_type: String(sourcePo?.po_type || 'Return Lorry'),
    status: String(sourcePo?.status || 'open'),
    ptf_no: sourcePo?.ptf_no || null,
    pending: sourcePo?.pending !== undefined ? Boolean(sourcePo.pending) : true,
    po_date: poDate,
    s_date: sourcePo?.s_date || poDate,
    broker_code: String(sourcePo?.broker_code || ''),
    broker: brokerVal,
    supplier_code: String(sourcePo?.supplier_code || ''),
    supplier: supplierVal,
    challan_supplier_code: String(sourcePo?.challan_supplier_code || ''),
    challan_supplier: String(sourcePo?.challan_supplier || supplierVal),
    area_code: String(sourcePo?.area_code || ''),
    area: areaVal,
    trans_paid_by: String(sourcePo?.trans_paid_by || 'PARTY'),
    weight_unit_kgs: Number(sourcePo?.weight_unit_kgs || 147.5),
    against_cancellation: String(sourcePo?.against_cancellation || 'No'),
    purchase_unit_code: String(sourcePo?.purchase_unit_code || '1'),
    purchase_unit_name: String(sourcePo?.purchase_unit_name || 'BALES').toUpperCase(),
    total_lorries: Number(sourcePo?.total_lorries || sourcePo?.no_of_lorries || 1),
    units_per_lorry: Number(sourcePo?.units_per_lorry || 0),
    total_units: Number(sourcePo?.total_units || 0),
    weight_per_lorry: Number(sourcePo?.weight_per_lorry || weightMt),
    total_contract_mt: Number(sourcePo?.total_contract_mt || sourcePo?.quantity_mt || weightMt),
    marka_type: String(sourcePo?.marka_type || 'Normal'),
    marka_penalty: Number(sourcePo?.marka_penalty || 0),
    qty_penalty: Number(sourcePo?.qty_penalty || 0),
    delivery_from: sourcePo?.delivery_from || null,
    delivery_to: sourcePo?.delivery_to || null,
    shipment_date: sourcePo?.shipment_date || sourcePo?.delivery_to || null,
    grace_days: Number(sourcePo?.grace_days || 0),
    shipment_days: Number(sourcePo?.shipment_days || sourcePo?.grace_days || 0),
    delivery_penalty: Number(sourcePo?.delivery_penalty || 0),
    shipment_penalty: Number(sourcePo?.shipment_penalty || sourcePo?.delivery_penalty || 0),
    contract_po_no: String(sourcePo?.contract_po_no || referencePoNo),
    sauda_no: String(sourcePo?.sauda_no || referencePoNo),
    contract_date: sourcePo?.contract_date || poDate,
    rate_detail: String(sourcePo?.rate_detail || ''),
    delivery_schedule: String(sourcePo?.delivery_schedule || ''),
    terms_condition: String(sourcePo?.terms_condition || ''),
    remarks: String(
      sourcePo?.remarks ||
      insp?.remarks ||
      `Return Lorry (< 5 MT: ${weightMt.toFixed(3)} MT) Auto-Copied from Ref P.O. ${referencePoNo} & M.R. ${mrNo}`
    ),
    po_remarks: String(sourcePo?.remarks || ''),
    po_identification: String(sourcePo?.po_identification || 'Direct Advance Payment'),
    b_rate: Number(sourcePo?.b_rate || sourcePo?.rate_qntl || sourcePo?.rate || combinedItems?.[0]?.rate_qntl || 0),
    is_return_lorry: true,
    created_at: insp?.created_at || new Date().toISOString(),
    items: combinedItems,
    sauda_details: sourcePoDetails,
    raw_inspection: insp || {},
    raw_sauda_check_point: sourcePo || {},
  };
}

/**
 * Persists a combined ReturnLorryRecord to Supabase (`return_lorry`, `return_lorry_details`,
 * `sauda_check_point`, `sauda_check_point_details`, `purchase_master`, `purchase_detail_master`)
 * and local cache without blocking UI rendering.
 */
async function persistReturnLorryRecordToDb(record: ReturnLorryRecord): Promise<void> {
  if (!supabase) return;
  const newPoNo = record.new_po_no;

  try {
    await dbModule.upsert('return_lorry', record, 'new_po_no').catch(async () => {
      await supabase!.from('return_lorry').upsert(record, { onConflict: 'new_po_no' }).then(() => {}, () => {});
    });

    if (record.items && record.items.length > 0) {
      await supabase.from('return_lorry_details').delete().eq('return_po_no', newPoNo).then(() => {}, () => {});
      await supabase.from('return_lorry_details').insert(record.items).then(() => {}, () => {});
    }

    // Mirror 4000-series PO into sauda_check_point & purchase_master so Payment & Settlement pull it seamlessly
    const mirroredPoPayload: Record<string, any> = {
      financial_year: record.financial_year,
      purchase_order: record.purchase_order,
      po_type: 'Return Lorry',
      status: 'open',
      ptf_no: record.ptf_no,
      pending: true,
      po_no: newPoNo,
      po_date: record.po_date,
      broker: record.broker,
      supplier: record.supplier,
      challan_supplier: record.challan_supplier,
      area: record.area,
      trans_paid_by: record.trans_paid_by,
      weight_unit_kgs: record.weight_unit_kgs,
      against_cancellation: record.against_cancellation,
      purchase_unit_code: record.purchase_unit_code,
      purchase_unit_name: record.purchase_unit_name,
      total_lorries: 1,
      units_per_lorry: record.units_per_lorry,
      total_units: record.total_units,
      weight_per_lorry: record.received_weight_mt,
      total_contract_mt: record.received_weight_mt,
      marka_type: record.marka_type,
      marka_penalty: record.marka_penalty,
      qty_penalty: record.qty_penalty,
      delivery_from: record.delivery_from,
      delivery_to: record.delivery_to,
      shipment_date: record.shipment_date,
      grace_days: record.grace_days,
      shipment_days: record.shipment_days,
      delivery_penalty: record.delivery_penalty,
      shipment_penalty: record.shipment_penalty,
      contract_po_no: record.reference_po_no,
      sauda_no: record.reference_po_no,
      contract_date: record.contract_date,
      rate_detail: record.rate_detail,
      delivery_schedule: record.delivery_schedule,
      terms_condition: record.terms_condition,
      remarks: `[RETURN LORRY - REF PO: ${record.reference_po_no} | MR: ${record.mr_no} | WT: ${record.received_weight_mt.toFixed(3)} MT] ${record.po_remarks || ''}`.trim(),
      po_identification: record.po_identification,
      b_rate: record.b_rate,
      s_date: record.s_date,
    };

    await dbModule.upsert('sauda_check_point', mirroredPoPayload, 'po_no').catch(async () => {
      await supabase!.from('sauda_check_point').upsert(mirroredPoPayload, { onConflict: 'po_no' }).then(() => {}, () => {});
    });

    await dbModule.upsert('purchase_master', { ...mirroredPoPayload, status: 'final' }, 'po_no').catch(async () => {
      await supabase!.from('purchase_master').upsert({ ...mirroredPoPayload, status: 'final' }, { onConflict: 'po_no' }).then(() => {}, () => {});
    });

    if (record.items && record.items.length > 0) {
      const detailRowsForPo = record.items.map((it, idx) => ({
        po_no: newPoNo,
        srl_no: it.srl_no || idx + 1,
        crop_year: it.crop_year || '2026-27',
        grade_code: it.grade_code || '',
        grade_name: it.grade_name || it.grade_code || '',
        agency_code: it.agency_code || '',
        agency_name: it.agency_name || it.agency_code || '',
        marka_code: it.marka_code || '',
        marka_name: it.marka_name || it.marka_code || '',
        quantity: Number(it.quantity || 0),
        weight_mt: Number(it.weight_mt || record.received_weight_mt || 0),
        rate_qntl: Number(it.rate_qntl || record.b_rate || 0),
        premium: Number(it.premium || 0),
      }));

      await supabase.from('sauda_check_point_details').delete().eq('po_no', newPoNo).then(() => {}, () => {});
      await supabase.from('sauda_check_point_details').insert(detailRowsForPo).then(() => {}, () => {});

      await supabase.from('purchase_detail_master').delete().eq('po_no', newPoNo).then(() => {}, () => {});
      await supabase.from('purchase_detail_master').insert(detailRowsForPo).then(() => {}, () => {});
    }
  } catch (err) {
    console.warn('[returnLorryService] Background DB persist warning:', err);
  }
}

/**
 * Checks a single Mill Inspection (`material_inspection`) save/update event.
 * If its received weight is under 5 MT (`> 0 && < 5`), automatically creates/updates
 * the Return Lorry record (4000-series P.O.) with all fields from `material_inspection`
 * and `sauda_check_point`.
 */
export async function checkAndProcessReturnLorryOnInspection(params: {
  mrNo: string;
  poNo: string;
  arrivalNo?: string;
  lorryNo?: string;
  inspectionDate?: string;
  headerForm?: any;
  detailRows?: any[];
  finalArrivalRecord?: any;
}): Promise<{
  isReturnLorry: boolean;
  weightMt: number;
  newPoNo?: string;
  referencePoNo?: string;
  record?: ReturnLorryRecord;
}> {
  const { mrNo, poNo, arrivalNo, lorryNo, headerForm, detailRows, finalArrivalRecord } = params;
  const weightMt = calculateInspectionWeightMt(headerForm, detailRows, finalArrivalRecord);

  if (weightMt <= 0 || weightMt >= 5) {
    return { isReturnLorry: false, weightMt };
  }

  ensureReturnLorryTablesExist();

  const cleanMr = normalizeStr(mrNo);
  const cleanPo = normalizeStr(poNo);
  if (!cleanMr) {
    return { isReturnLorry: true, weightMt };
  }

  const cached = getLocalCachedReturnLorries();
  const existingCached = cached.find((r) => normalizeStr(r.mr_no) === cleanMr);

  let referencePoNo = existingCached?.reference_po_no || (is4000SeriesPo(cleanPo) ? '' : String(poNo || '').trim());
  let newPoNo = existingCached?.new_po_no || (is4000SeriesPo(cleanPo) ? String(poNo).trim() : '');

  let sourcePo: any = null;
  let sourcePoDetails: any[] = [];

  if (supabase) {
    try {
      // Check if return_lorry already has this MR
      const { data: existingDb } = await supabase
        .from('return_lorry')
        .select('*')
        .ilike('mr_no', cleanMr)
        .limit(1)
        .maybeSingle();

      if (existingDb) {
        newPoNo = existingDb.new_po_no || existingDb.po_no || newPoNo;
        referencePoNo = existingDb.reference_po_no || referencePoNo;
      }

      const lookupPo = referencePoNo || cleanPo;
      if (lookupPo) {
        const [scpRes, scpDetRes, pmRes, pdmRes] = await Promise.all([
          supabase.from('sauda_check_point').select('*').ilike('po_no', lookupPo).limit(1).maybeSingle(),
          supabase.from('sauda_check_point_details').select('*').ilike('po_no', lookupPo).order('srl_no', { ascending: true }),
          supabase.from('purchase_master').select('*').ilike('po_no', lookupPo).limit(1).maybeSingle(),
          supabase.from('purchase_detail_master').select('*').ilike('po_no', lookupPo).order('srl_no', { ascending: true }),
        ]);
        sourcePo = scpRes.data || pmRes.data || null;
        sourcePoDetails = (scpDetRes.data && scpDetRes.data.length > 0) ? scpDetRes.data : (pdmRes.data || []);
        if (sourcePo && !referencePoNo) {
          referencePoNo = sourcePo.contract_po_no || sourcePo.sauda_no || sourcePo.po_no || lookupPo;
        }
      }
    } catch {}
  }

  if (!referencePoNo) {
    referencePoNo = cleanPo || `REF/${cleanMr}`;
  }

  const fy = String(sourcePo?.financial_year || headerForm?.financial_year || '2026-2027').trim();
  if (!newPoNo) {
    newPoNo = await generateNext4000SeriesPoNo(referencePoNo, fy);
  }

  const record = buildCombinedReturnLorryRecord({
    newPoNo,
    referencePoNo,
    insp: {
      ...(headerForm || {}),
      mr_no: mrNo,
      arrival_no: arrivalNo || headerForm?.arrival_no || mrNo,
      lorry_number: lorryNo || headerForm?.lorry_number || '',
    },
    inspDetails: detailRows || [],
    sourcePo: sourcePo || {},
    sourcePoDetails,
    matchedFa: finalArrivalRecord,
    weightMt,
    lorrySeqNo: Number(sourcePo?.total_lorries || 1),
  });

  // Update local cache immediately
  const updatedCache = [record, ...cached.filter((r) => normalizeStr(r.mr_no) !== cleanMr)];
  setLocalCachedReturnLorries(updatedCache);

  // Persist to DB asynchronously
  await persistReturnLorryRecordToDb(record);

  notifyDataChanged('return_lorry');
  notifyDataChanged('sauda_check_point');
  notifyDataChanged('purchase_master');

  return {
    isReturnLorry: true,
    weightMt,
    newPoNo,
    referencePoNo,
    record,
  };
}

/**
 * Batch-scans ALL `material_inspection` records (`< 5 MT`) and `sauda_check_point` records
 * in a single parallel batch (no N+1 queries) and automatically generates/updates
 * Return Lorry (4000-series P.O.) records with ALL fields from both tables.
 */
export async function syncAllReturnLorriesFromInspections(): Promise<ReturnLorryRecord[]> {
  ensureReturnLorryTablesExist();

  if (!supabase) {
    return getLocalCachedReturnLorries();
  }

  try {
    const [
      inspRes,
      inspDetRes,
      millDetRes,
      scpRes,
      scpDetRes,
      pmRes,
      pdmRes,
      faRes,
      tmrRes,
      clubRes,
      rlRes,
      rlDetRes,
    ] = await Promise.all([
      supabase.from('material_inspection').select('*').order('created_at', { ascending: false }).then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('material_inspection_details').select('*').order('srl_no', { ascending: true }).then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('mill_inspection_detail').select('*').order('srl_no', { ascending: true }).then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('sauda_check_point').select('*').order('created_at', { ascending: false }).then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('sauda_check_point_details').select('*').order('srl_no', { ascending: true }).then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('purchase_master').select('*').order('created_at', { ascending: false }).then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('purchase_detail_master').select('*').order('srl_no', { ascending: true }).then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('final_arrival').select('*').order('created_at', { ascending: false }).then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('temporary_material_received').select('*').order('created_at', { ascending: false }).then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('clubbed_pomr').select('*').then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('return_lorry').select('*').order('created_at', { ascending: false }).then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('return_lorry_details').select('*').order('srl_no', { ascending: true }).then((r) => r, () => ({ data: [] as any[] })),
    ]);

    const rawInspections: any[] = [...((inspRes as any)?.data || [])];
    // Also merge any locally cached inspection records
    try {
      const localInsp = localStorage.getItem('inspection_master_records');
      if (localInsp) {
        const parsed = JSON.parse(localInsp);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item?.mr_no && !rawInspections.some((x) => normalizeStr(x.mr_no) === normalizeStr(item.mr_no))) {
              rawInspections.push(item);
            }
          });
        }
      }
    } catch {}

    const allInspDetails: any[] = [
      ...((inspDetRes as any)?.data || []),
      ...((millDetRes as any)?.data || []),
    ];
    const allScp: any[] = (scpRes as any)?.data || [];
    const allScpDetails: any[] = (scpDetRes as any)?.data || [];
    const allPm: any[] = (pmRes as any)?.data || [];
    const allPdm: any[] = (pdmRes as any)?.data || [];
    const allFa: any[] = (faRes as any)?.data || [];
    const allTmr: any[] = (tmrRes as any)?.data || [];
    const allClubs: any[] = (clubRes as any)?.data || [];
    const existingDbReturnLorries: any[] = (rlRes as any)?.data || [];
    const existingDbRlDetails: any[] = (rlDetRes as any)?.data || [];

    // Group inspection details by MR No
    const detailsByMr = new Map<string, any[]>();
    for (const d of allInspDetails) {
      const k = normalizeStr(d.mr_no);
      if (!k) continue;
      if (!detailsByMr.has(k)) detailsByMr.set(k, []);
      const list = detailsByMr.get(k)!;
      const srl = Number(d.srl_no || list.length + 1);
      if (!list.some((existing) => Number(existing.srl_no || 0) === srl)) {
        list.push(d);
      }
    }

    // Index Final Arrivals & Temporary Arrivals
    const faByMr = new Map<string, any>();
    for (const fa of allFa) {
      [fa.final_arrival_no, fa.mr_no, fa.temporary_arrival_no, fa.arrival_no, fa.amad_no].forEach((k) => {
        const nk = normalizeStr(k);
        if (nk && !faByMr.has(nk)) faByMr.set(nk, fa);
      });
    }

    const tmrByNo = new Map<string, any>();
    for (const tmr of allTmr) {
      [tmr.temporary_arrival_no, tmr.amad_no, tmr.arrival_no, tmr.mr_no].forEach((k) => {
        const nk = normalizeStr(k);
        if (nk && !tmrByNo.has(nk)) tmrByNo.set(nk, tmr);
      });
    }

    // Index Clubbed PO-MR bindings
    const clubbedPoByMr = new Map<string, string>();
    for (const c of allClubs) {
      if (normalizeStr(c.status) === 'DELETED') continue;
      const p = String(c.po_no || c.primary_po_no || '').trim();
      if (!p) continue;
      [c.mr_no, c.final_arrival_no, c.primary_mr_no, c.temporary_arrival_no].forEach((m) => {
        const nm = normalizeStr(m);
        if (nm) clubbedPoByMr.set(nm, p);
      });
    }

    // Index Sauda Check Point & Purchase Master by exact PO No AND by canonical serial
    const scpByPo = new Map<string, any>();
    const scpBySerial = new Map<string, any>();
    // Prefer non-4000 series as reference PO
    for (const po of [...allScp, ...allPm]) {
      const pNo = normalizeStr(po.po_no);
      if (!pNo) continue;
      if (!scpByPo.has(pNo) || (!is4000SeriesPo(pNo) && is4000SeriesPo(scpByPo.get(pNo)?.po_no))) {
        scpByPo.set(pNo, po);
      }
      if (!is4000SeriesPo(pNo)) {
        const serial = extractCanonicalPoSerial(pNo);
        if (serial && !scpBySerial.has(serial)) {
          scpBySerial.set(serial, po);
        }
        [po.contract_po_no, po.sauda_no, po.ptf_no].forEach((alt) => {
          const nAlt = normalizeStr(alt);
          if (nAlt && !scpByPo.has(nAlt)) scpByPo.set(nAlt, po);
          const altSer = extractCanonicalPoSerial(alt);
          if (altSer && !scpBySerial.has(altSer)) scpBySerial.set(altSer, po);
        });
      }
    }

    // Group Sauda Check Point Details & Purchase Detail Master by PO No & canonical serial
    const poDetailsByPo = new Map<string, any[]>();
    const poDetailsBySerial = new Map<string, any[]>();
    for (const d of [...allScpDetails, ...allPdm]) {
      const pNo = normalizeStr(d.po_no);
      if (!pNo) continue;
      if (!poDetailsByPo.has(pNo)) poDetailsByPo.set(pNo, []);
      const list = poDetailsByPo.get(pNo)!;
      const srl = Number(d.srl_no || list.length + 1);
      if (!list.some((x) => Number(x.srl_no || 0) === srl)) {
        list.push(d);
      }
      if (!is4000SeriesPo(pNo)) {
        const ser = extractCanonicalPoSerial(pNo);
        if (ser) {
          if (!poDetailsBySerial.has(ser)) poDetailsBySerial.set(ser, []);
          const sList = poDetailsBySerial.get(ser)!;
          if (!sList.some((x) => Number(x.srl_no || 0) === srl)) {
            sList.push(d);
          }
        }
      }
    }

    // Track existing Return Lorry mappings by MR No and used 4000-series numbers
    const existingByMr = new Map<string, any>();
    const used4000Numbers = new Set<number>();

    const register4000No = (poStr: any) => {
      const s = normalizeStr(poStr);
      if (!s) return;
      const parts = s.split('/');
      const last = parts[parts.length - 1]?.replace(/[^0-9]/g, '') || '';
      const num = parseInt(last, 10);
      if (!isNaN(num) && num >= 4000 && num < 5000) {
        used4000Numbers.add(num);
      }
    };

    for (const rl of [...existingDbReturnLorries, ...getLocalCachedReturnLorries()]) {
      const mKey = normalizeStr(rl.mr_no || rl.final_arrival_no);
      if (mKey && !existingByMr.has(mKey)) {
        existingByMr.set(mKey, rl);
      }
      register4000No(rl.new_po_no);
      register4000No(rl.po_no);
    }
    for (const po of [...allScp, ...allPm]) {
      register4000No(po.po_no);
    }

    // Count lorry sequence per Reference PO
    const mrListByRefPo = new Map<string, string[]>();

    const resultRecords: ReturnLorryRecord[] = [];
    const processedMrSet = new Set<string>();
    const recordsToPersist: ReturnLorryRecord[] = [];

    for (const insp of rawInspections) {
      const mrKey = normalizeStr(insp.mr_no);
      if (!mrKey || processedMrSet.has(mrKey)) continue;

      const arrKey = normalizeStr(insp.arrival_no || insp.temporary_arrival_no);
      const matchedFa = faByMr.get(mrKey) || (arrKey ? faByMr.get(arrKey) : undefined);
      const matchedTmr =
        tmrByNo.get(arrKey) ||
        tmrByNo.get(mrKey) ||
        (matchedFa?.temporary_arrival_no ? tmrByNo.get(normalizeStr(matchedFa.temporary_arrival_no)) : undefined);

      let detailRows = detailsByMr.get(mrKey) || [];
      if (detailRows.length === 0 && insp.grid_details) {
        if (Array.isArray(insp.grid_details)) detailRows = insp.grid_details;
        else if (typeof insp.grid_details === 'string') {
          try {
            const p = JSON.parse(insp.grid_details);
            if (Array.isArray(p)) detailRows = p;
          } catch {}
        }
      }

      const wtMt = calculateInspectionWeightMt(insp, detailRows, matchedFa, matchedTmr);

      // Condition: If Mill Inspection weight is under 5 MT (> 0 and < 5 MT)
      if (wtMt <= 0 || wtMt >= 5) {
        continue;
      }

      processedMrSet.add(mrKey);
      const existingRl = existingByMr.get(mrKey);

      // Resolve Reference PO No (original Sauda Check Point PO)
      const isBlankPo = (v: any) => {
        const s = normalizeStr(v);
        return !s || s === 'NO' || s === 'N/A' || s === 'NONE' || s === '-';
      };

      let candidatePo = '';
      if (existingRl?.reference_po_no && !isBlankPo(existingRl.reference_po_no) && !is4000SeriesPo(existingRl.reference_po_no)) {
        candidatePo = String(existingRl.reference_po_no).trim();
      } else if (!isBlankPo(insp.reference_po_no) && !is4000SeriesPo(insp.reference_po_no)) {
        candidatePo = String(insp.reference_po_no).trim();
      } else if (!isBlankPo(insp.po_no) && !is4000SeriesPo(insp.po_no)) {
        candidatePo = String(insp.po_no).trim();
      } else if (!isBlankPo(insp.mill_po_no) && !is4000SeriesPo(insp.mill_po_no)) {
        candidatePo = String(insp.mill_po_no).trim();
      } else if (clubbedPoByMr.has(mrKey) && !is4000SeriesPo(clubbedPoByMr.get(mrKey))) {
        candidatePo = clubbedPoByMr.get(mrKey)!;
      } else if (arrKey && clubbedPoByMr.has(arrKey) && !is4000SeriesPo(clubbedPoByMr.get(arrKey))) {
        candidatePo = clubbedPoByMr.get(arrKey)!;
      } else if (matchedFa?.po_no && !isBlankPo(matchedFa.po_no) && !is4000SeriesPo(matchedFa.po_no)) {
        candidatePo = String(matchedFa.po_no).trim();
      } else if (matchedTmr?.po_no && !isBlankPo(matchedTmr.po_no) && !is4000SeriesPo(matchedTmr.po_no)) {
        candidatePo = String(matchedTmr.po_no).trim();
      } else if (!isBlankPo(insp.po_no) && is4000SeriesPo(insp.po_no)) {
        // If insp.po_no was already replaced with a 4000-series PO, look up its contract_po_no / sauda_no in scpByPo
        const po4000 = scpByPo.get(normalizeStr(insp.po_no));
        if (po4000 && !isBlankPo(po4000.contract_po_no) && !is4000SeriesPo(po4000.contract_po_no)) {
          candidatePo = String(po4000.contract_po_no).trim();
        } else if (po4000 && !isBlankPo(po4000.sauda_no) && !is4000SeriesPo(po4000.sauda_no)) {
          candidatePo = String(po4000.sauda_no).trim();
        }
      }

      // Match Sauda Check Point record
      let sourcePo: any = null;
      let sourcePoDetails: any[] = [];
      if (candidatePo) {
        const cleanCand = normalizeStr(candidatePo);
        const serialCand = extractCanonicalPoSerial(candidatePo);
        sourcePo = scpByPo.get(cleanCand) || (serialCand ? scpBySerial.get(serialCand) : null) || null;
        sourcePoDetails =
          poDetailsByPo.get(cleanCand) ||
          (sourcePo?.po_no ? poDetailsByPo.get(normalizeStr(sourcePo.po_no)) : undefined) ||
          (serialCand ? poDetailsBySerial.get(serialCand) : undefined) ||
          [];
      }

      // If still no sourcePo matched by PO number, try matching Sauda Check Point by Supplier + Broker
      if (!sourcePo) {
        const inspSupp = normalizeStr(insp.supplier_name || insp.supplier || matchedFa?.supplier);
        const inspBrok = normalizeStr(insp.broker_name || insp.broker || matchedFa?.broker);
        if (inspSupp) {
          sourcePo =
            allScp.find(
              (s) =>
                !is4000SeriesPo(s.po_no) &&
                (normalizeStr(s.supplier) === inspSupp || normalizeStr(s.challan_supplier) === inspSupp) &&
                (!inspBrok || !s.broker || normalizeStr(s.broker) === inspBrok)
            ) ||
            allPm.find(
              (s) =>
                !is4000SeriesPo(s.po_no) &&
                (normalizeStr(s.supplier) === inspSupp || normalizeStr(s.challan_supplier) === inspSupp) &&
                (!inspBrok || !s.broker || normalizeStr(s.broker) === inspBrok)
            ) ||
            null;
          if (sourcePo) {
            candidatePo = String(sourcePo.po_no || candidatePo).trim();
            sourcePoDetails = poDetailsByPo.get(normalizeStr(sourcePo.po_no)) || [];
          }
        }
      }

      const resolvedReferencePoNo = String(
        sourcePo?.po_no || candidatePo || existingRl?.reference_po_no || insp.po_no || `REF/${insp.mr_no}`
      ).trim();

      const fy = String(
        sourcePo?.financial_year || existingRl?.financial_year || insp.financial_year || '2026-2027'
      ).trim();

      const resolvedNewPoNo =
        (existingRl?.new_po_no && is4000SeriesPo(existingRl.new_po_no) ? String(existingRl.new_po_no).trim() : '') ||
        (existingRl?.po_no && is4000SeriesPo(existingRl.po_no) ? String(existingRl.po_no).trim() : '') ||
        (is4000SeriesPo(insp.po_no) ? String(insp.po_no).trim() : '') ||
        generate4000SeriesPoNoFromSet(resolvedReferencePoNo, fy, used4000Numbers);

      const refKey = normalizeStr(resolvedReferencePoNo);
      if (!mrListByRefPo.has(refKey)) {
        const linkedCount = allFa.filter(
          (f) =>
            normalizeStr(f.po_no) === refKey ||
            extractCanonicalPoSerial(f.po_no) === extractCanonicalPoSerial(resolvedReferencePoNo)
        ).length;
        mrListByRefPo.set(refKey, new Array(Math.max(linkedCount, Number(sourcePo?.total_lorries || 1))).fill(''));
      }
      const lorrySeqNo = Number(
        existingRl?.lorry_sequence_no ||
        sourcePo?.total_lorries ||
        mrListByRefPo.get(refKey)?.length ||
        1
      );

      const combinedRecord = buildCombinedReturnLorryRecord({
        newPoNo: resolvedNewPoNo,
        referencePoNo: resolvedReferencePoNo,
        insp,
        inspDetails: detailRows,
        sourcePo: sourcePo || existingRl || {},
        sourcePoDetails,
        matchedFa,
        matchedTmr,
        weightMt: wtMt,
        lorrySeqNo,
      });

      resultRecords.push(combinedRecord);

      if (!existingDbReturnLorries.some((r) => normalizeStr(r.mr_no) === mrKey && normalizeStr(r.new_po_no) === normalizeStr(resolvedNewPoNo))) {
        recordsToPersist.push(combinedRecord);
      }
    }

    // Also include any existing rows in `return_lorry` table whose MR wasn't in `rawInspections`
    for (const dbRow of existingDbReturnLorries) {
      const mKey = normalizeStr(dbRow.mr_no || dbRow.final_arrival_no);
      if (mKey && processedMrSet.has(mKey)) continue;
      if (mKey) processedMrSet.add(mKey);
      const rowItems = existingDbRlDetails.filter(
        (d) => normalizeStr(d.return_po_no) === normalizeStr(dbRow.new_po_no || dbRow.po_no)
      );
      resultRecords.push({
        ...dbRow,
        new_po_no: dbRow.new_po_no || dbRow.po_no,
        po_no: dbRow.po_no || dbRow.new_po_no,
        is_return_lorry: true,
        items: rowItems,
      });
    }

    // Cache locally immediately
    setLocalCachedReturnLorries(resultRecords);

    // Persist any newly discovered Return Lorry records in the background
    if (recordsToPersist.length > 0) {
      Promise.allSettled(recordsToPersist.map((r) => persistReturnLorryRecordToDb(r))).catch(() => {});
    }

    return resultRecords;
  } catch (err) {
    console.warn('[returnLorryService] Error during batch sync:', err);
    return getLocalCachedReturnLorries();
  }
}

/**
 * Fetches all Return Lorry records, running the fast batch sync from
 * `material_inspection` (< 5 MT) and `sauda_check_point` so records are always complete and up to date.
 */
export async function fetchAllReturnLorries(): Promise<ReturnLorryRecord[]> {
  return syncAllReturnLorriesFromInspections();
}
