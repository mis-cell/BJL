import { supabase } from '../lib/supabase';
import { dbModule } from './dbModule';

export interface ReturnLorryRecord {
  id?: string;
  po_no: string;              // New 4000-series P.O. No (e.g. BJCL/2026-2027/4001)
  new_po_no: string;          // Same as po_no (4000-series P.O. No)
  reference_po_no: string;    // Original P.O. No (e.g. BJCL/2026-2027/0660)
  sauda_no?: string;
  ptf_no?: string;
  mr_no: string;              // M.R. No from Mill Inspection
  final_arrival_no?: string;
  temporary_arrival_no?: string;
  lorry_number?: string;
  lorry_sequence?: string;    // e.g. "6/6"
  received_lorry_index?: number;
  total_no_of_lorries?: number;
  received_weight_mt: number; // e.g. 4.500 (under 5 MT)
  received_weight_qtl?: number;
  received_bales?: number;
  total_contract_mt?: number;
  weight_per_lorry?: number;
  po_date?: string;
  s_date?: string;
  inspection_date?: string;
  supplier?: string;
  supplier_name?: string;
  challan_supplier?: string;
  broker?: string;
  broker_name?: string;
  area?: string;
  agency_name?: string;
  purchase_unit_name?: string;
  b_rate?: number;
  premium?: number;
  delivery_from?: string;
  delivery_to?: string;
  grace_days?: number;
  delivery_penalty?: number;
  marka_type?: string;
  marka_penalty?: number;
  qty_penalty?: number;
  credit_days?: number;
  cd_percent?: number;
  tds_percent?: number;
  payment_type?: string;
  quality_summary?: string;
  status?: string;
  remarks?: string;
  items?: any[];
  grid_details?: any[];
  sauda_snapshot?: any;
  created_at?: string;
  updated_at?: string;
}

let tablesInitialized = false;

export const ensureReturnLorryTablesExist = async (): Promise<void> => {
  if (tablesInitialized || !supabase) return;
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS public.return_lorry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        po_no TEXT UNIQUE NOT NULL,
        new_po_no TEXT NOT NULL,
        reference_po_no TEXT NOT NULL,
        sauda_no TEXT,
        ptf_no TEXT,
        mr_no TEXT,
        final_arrival_no TEXT,
        temporary_arrival_no TEXT,
        lorry_number TEXT,
        lorry_sequence TEXT,
        received_lorry_index INTEGER DEFAULT 1,
        total_no_of_lorries INTEGER DEFAULT 1,
        received_weight_mt NUMERIC DEFAULT 0,
        received_weight_qtl NUMERIC DEFAULT 0,
        received_bales NUMERIC DEFAULT 0,
        total_contract_mt NUMERIC DEFAULT 0,
        weight_per_lorry NUMERIC DEFAULT 0,
        po_date TEXT,
        s_date TEXT,
        inspection_date TEXT,
        supplier TEXT,
        supplier_name TEXT,
        challan_supplier TEXT,
        broker TEXT,
        broker_name TEXT,
        area TEXT,
        agency_name TEXT,
        purchase_unit_name TEXT DEFAULT 'BALES',
        b_rate NUMERIC DEFAULT 0,
        premium NUMERIC DEFAULT 0,
        delivery_from TEXT,
        delivery_to TEXT,
        grace_days NUMERIC DEFAULT 0,
        delivery_penalty NUMERIC DEFAULT 0,
        marka_type TEXT,
        marka_penalty NUMERIC DEFAULT 0,
        qty_penalty NUMERIC DEFAULT 0,
        credit_days NUMERIC DEFAULT 0,
        cd_percent NUMERIC DEFAULT 0,
        tds_percent NUMERIC DEFAULT 0,
        payment_type TEXT,
        quality_summary TEXT,
        status TEXT DEFAULT 'ACTIVE',
        remarks TEXT,
        items JSONB DEFAULT '[]'::jsonb,
        grid_details JSONB DEFAULT '[]'::jsonb,
        sauda_snapshot JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.return_lorry_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        return_lorry_id UUID,
        po_no TEXT NOT NULL,
        new_po_no TEXT,
        reference_po_no TEXT,
        mr_no TEXT,
        srl_no INTEGER DEFAULT 1,
        agency_code TEXT,
        agency_name TEXT,
        grade_code TEXT,
        grade_name TEXT,
        grade TEXT,
        quality TEXT,
        marka TEXT,
        bales NUMERIC DEFAULT 0,
        weight_qtl NUMERIC DEFAULT 0,
        weight_mt NUMERIC DEFAULT 0,
        percentage NUMERIC DEFAULT 0,
        rate_qntl NUMERIC DEFAULT 0,
        rate_per_mt NUMERIC DEFAULT 0,
        rate NUMERIC DEFAULT 0,
        premium NUMERIC DEFAULT 0,
        moisture NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      ALTER TABLE public.return_lorry DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.return_lorry_details DISABLE ROW LEVEL SECURITY;
      GRANT ALL ON public.return_lorry TO anon, authenticated, service_role;
      GRANT ALL ON public.return_lorry_details TO anon, authenticated, service_role;

      ALTER TABLE public.material_inspection ADD COLUMN IF NOT EXISTS is_return_lorry BOOLEAN DEFAULT false;
      ALTER TABLE public.material_inspection ADD COLUMN IF NOT EXISTS return_po_no TEXT;
      ALTER TABLE public.material_inspection ADD COLUMN IF NOT EXISTS reference_po_no TEXT;
      ALTER TABLE public.material_inspection ADD COLUMN IF NOT EXISTS received_weight_mt NUMERIC;

      ALTER TABLE public.mill_inspection_master ADD COLUMN IF NOT EXISTS is_return_lorry BOOLEAN DEFAULT false;
      ALTER TABLE public.mill_inspection_master ADD COLUMN IF NOT EXISTS return_po_no TEXT;
      ALTER TABLE public.mill_inspection_master ADD COLUMN IF NOT EXISTS reference_po_no TEXT;
      ALTER TABLE public.mill_inspection_master ADD COLUMN IF NOT EXISTS received_weight_mt NUMERIC;

      ALTER TABLE public.final_arrival ADD COLUMN IF NOT EXISTS is_return_lorry BOOLEAN DEFAULT false;
      ALTER TABLE public.final_arrival ADD COLUMN IF NOT EXISTS return_po_no TEXT;
      ALTER TABLE public.final_arrival ADD COLUMN IF NOT EXISTS reference_po_no TEXT;

      NOTIFY pgrst, 'reload schema';
    `;
    await supabase.rpc('exec_sql', { sql_query: sql }).then(() => {}, () => {});
    tablesInitialized = true;
  } catch (err) {
    console.warn('Could not auto-initialize return_lorry tables via exec_sql:', err);
  }
};

/**
 * Computes the received weight in Metric Tons (MT) from an inspection header and/or detail rows.
 */
export const calculateInspectionWeightMt = (
  header?: any,
  detailRows?: any[],
  arrivalRecord?: any
): number => {
  // 1. Try summing from detail rows first
  if (Array.isArray(detailRows) && detailRows.length > 0) {
    let sumMt = 0;
    for (const row of detailRows) {
      const rawWt = parseFloat(
        String(
          row.receipt_gross_wt ??
          row.final_receipt_wt ??
          row.challan_gross_wt ??
          row.actual_weight ??
          row.weight_mt ??
          row.weight_qtl ??
          row.weight ??
          0
        )
      );
      if (!isNaN(rawWt) && rawWt > 0) {
        if (rawWt > 500) {
          // Clearly in Kgs (e.g. 4500 Kgs -> 4.5 MT)
          sumMt += rawWt / 1000;
        } else if (rawWt > 35) {
          // Clearly in Quintals (e.g. 45 Qtl -> 4.5 MT)
          sumMt += rawWt / 10;
        } else {
          // Already in Metric Tons (e.g. 4.5 MT)
          sumMt += rawWt;
        }
      }
    }
    if (sumMt > 0) {
      return Number(sumMt.toFixed(3));
    }
  }

  // 2. Fallback to header fields
  const headerCandidates = [
    header?.received_weight_mt,
    header?.total_actual_weight,
    header?.electronic_net_weight,
    header?.challan_material_weight,
    header?.actual_weight,
    header?.net_weight,
    header?.weight_mt,
    header?.weight_qtl,
    arrivalRecord?.electronic_net_weight,
    arrivalRecord?.challan_material_weight,
    arrivalRecord?.weight_qtl,
    arrivalRecord?.net_weight
  ];

  for (const cand of headerCandidates) {
    const val = parseFloat(String(cand ?? 0));
    if (!isNaN(val) && val > 0) {
      if (val > 500) return Number((val / 1000).toFixed(3));
      if (val > 35) return Number((val / 10).toFixed(3));
      return Number(val.toFixed(3));
    }
  }

  return 0;
};

/**
 * Generates the next 4000-series P.O. number based on the reference P.O. prefix.
 * Example: Reference "BJCL/2026-2027/0660" -> "BJCL/2026-2027/4001"
 */
export const generateNext4000SeriesPoNo = (
  referencePoNo: string,
  existingReturnRecords: any[] = [],
  existingPoRecords: any[] = []
): string => {
  const cleanRef = String(referencePoNo || '').trim().replace(/^#/, '');
  let prefix = 'BJCL/2026-2027/';
  const lastSlashIdx = cleanRef.lastIndexOf('/');
  if (lastSlashIdx !== -1) {
    prefix = cleanRef.substring(0, lastSlashIdx + 1);
  }

  let maxNum = 4000;
  const allCandidates = [
    ...existingReturnRecords.map((r: any) => r.new_po_no || r.po_no || ''),
    ...existingPoRecords.map((r: any) => r.po_no || '')
  ];

  for (const cand of allCandidates) {
    const cleanCand = String(cand || '').trim().replace(/^#/, '');
    const parts = cleanCand.split('/');
    const lastPart = parts[parts.length - 1] || '';
    const num = parseInt(lastPart.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= 4000 && num < 5000) {
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return `${prefix}${nextNum}`;
};

const parseEmbeddedItems = (raw: any): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return [];
};

/**
 * Fetches all Return Lorry records from Supabase and local cache.
 */
export const fetchAllReturnLorries = async (): Promise<ReturnLorryRecord[]> => {
  await ensureReturnLorryTablesExist();
  let supaList: any[] = [];
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('return_lorry')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        supaList = data;
      }
    } catch (e) {}
  }

  const localList = await dbModule.fetchAll('return_lorry').catch(() => []);
  const map = new Map<string, ReturnLorryRecord>();

  [...(localList || []), ...supaList].forEach((rec: any) => {
    if (!rec) return;
    const key = String(rec.po_no || rec.new_po_no || rec.id || '').trim().toUpperCase();
    if (!key) return;
    map.set(key, {
      ...rec,
      po_no: rec.po_no || rec.new_po_no,
      new_po_no: rec.new_po_no || rec.po_no,
      reference_po_no: rec.reference_po_no || '',
      received_weight_mt: Number(rec.received_weight_mt || 0),
      items: parseEmbeddedItems(rec.items || rec.grid_details)
    });
  });

  return Array.from(map.values());
};

/**
 * Checks if a Mill Inspection M.R. qualifies as a Return Lorry (< 5 MT received weight)
 * and if so, copies all Sauda Check Point P.O. data into `return_lorry` & `return_lorry_details`
 * with a 4000-series P.O. number and the original P.O. number as `reference_po_no`.
 */
export const checkAndProcessReturnLorryOnInspection = async (params: {
  mrNo: string;
  poNo: string;
  arrivalNo?: string;
  temporaryArrivalNo?: string;
  lorryNo?: string;
  inspectionDate?: string;
  headerForm?: any;
  detailRows?: any[];
  arrivalRecord?: any;
}): Promise<{
  isReturnLorry: boolean;
  returnRecord?: ReturnLorryRecord;
  newPoNo?: string;
  referencePoNo?: string;
  weightMt: number;
}> => {
  const {
    mrNo,
    poNo,
    arrivalNo,
    temporaryArrivalNo,
    lorryNo,
    inspectionDate,
    headerForm,
    detailRows,
    arrivalRecord
  } = params;

  const weightMt = calculateInspectionWeightMt(headerForm, detailRows, arrivalRecord);
  const cleanMr = String(mrNo || arrivalNo || '').trim().toUpperCase();
  const rawPo = String(poNo || headerForm?.po_no || arrivalRecord?.po_no || '').trim().replace(/^#/, '');

  // Must have valid MR, valid PO, and received weight strictly between 0 and 5 MT (< 5 Ton)
  if (!cleanMr || !rawPo || rawPo === 'N/A' || rawPo === 'NONE' || weightMt <= 0 || weightMt >= 5) {
    return { isReturnLorry: false, weightMt };
  }

  await ensureReturnLorryTablesExist();

  try {
    // 1. Check if a return_lorry record already exists for this MR
    const existingReturns = await fetchAllReturnLorries();
    const existingForMr = existingReturns.find(
      (r) =>
        String(r.mr_no || '').trim().toUpperCase() === cleanMr ||
        String(r.final_arrival_no || '').trim().toUpperCase() === cleanMr
    );

    // If rawPo is already a 4000-series PO from an existing return record, preserve its reference_po_no
    const existingByPo = existingReturns.find(
      (r) =>
        String(r.po_no || '').trim().replace(/^#/, '').toUpperCase() === rawPo.toUpperCase() ||
        String(r.new_po_no || '').trim().replace(/^#/, '').toUpperCase() === rawPo.toUpperCase()
    );

    const referencePoNo =
      existingForMr?.reference_po_no ||
      existingByPo?.reference_po_no ||
      headerForm?.reference_po_no ||
      rawPo;

    const cleanRefPo = String(referencePoNo).trim().replace(/^#/, '');
    const withHashRefPo = `#${cleanRefPo}`;

    // 2. Fetch Sauda Check Point & Purchase Master data for the Reference P.O.
    let scpData: any = null;
    let pmData: any = null;
    let smData: any = null;
    let scpDetails: any[] = [];
    let pmDetails: any[] = [];

    if (supabase) {
      const [scpRes, pmRes, smRes, scpdRes, pdmRes] = await Promise.all([
        supabase
          .from('sauda_check_point')
          .select('*')
          .or(`po_no.eq."${cleanRefPo}",po_no.eq."${withHashRefPo}",ptf_no.eq."${cleanRefPo}",sauda_no.eq."${cleanRefPo}"`)
          .maybeSingle(),
        supabase
          .from('purchase_master')
          .select('*')
          .or(`po_no.eq."${cleanRefPo}",po_no.eq."${withHashRefPo}"`)
          .maybeSingle(),
        supabase
          .from('sauda_master')
          .select('*')
          .or(`po_no.eq."${cleanRefPo}",sauda_no.eq."${cleanRefPo}",contract_no.eq."${cleanRefPo}"`)
          .maybeSingle(),
        supabase
          .from('sauda_check_point_details')
          .select('*')
          .or(`po_no.eq."${cleanRefPo}",po_no.eq."${withHashRefPo}"`)
          .order('srl_no', { ascending: true }),
        supabase
          .from('purchase_detail_master')
          .select('*')
          .or(`po_no.eq."${cleanRefPo}",po_no.eq."${withHashRefPo}"`)
          .order('srl_no', { ascending: true })
      ]);

      scpData = scpRes?.data || null;
      pmData = pmRes?.data || null;
      smData = smRes?.data || null;
      scpDetails = scpdRes?.data || [];
      pmDetails = pdmRes?.data || [];
    }

    if (!scpData && !pmData) {
      const [localScp, localPm] = await Promise.all([
        dbModule.fetchAll('sauda_check_point').catch(() => []),
        dbModule.fetchAll('purchase_master').catch(() => [])
      ]);
      scpData = (localScp || []).find(
        (r: any) => String(r.po_no || r.ptf_no || '').trim().replace(/^#/, '').toUpperCase() === cleanRefPo.toUpperCase()
      );
      pmData = (localPm || []).find(
        (r: any) => String(r.po_no || '').trim().replace(/^#/, '').toUpperCase() === cleanRefPo.toUpperCase()
      );
    }

    const basePo = {
      ...(smData || {}),
      ...(pmData || {}),
      ...(scpData || {})
    };

    // Resolve total contract lorries (e.g. 5 or 6 lorries)
    let totalLorries =
      parseInt(
        String(
          basePo.total_no_of_lorries ??
          basePo.total_lorries ??
          basePo.no_of_lorries ??
          basePo.lorries ??
          0
        ),
        10
      ) || 0;
    const contractMt = parseFloat(
      String(basePo.total_contract_mt ?? basePo.total_wt_in_ton ?? basePo.quantity ?? 0)
    ) || 0;
    if (totalLorries <= 1 && contractMt >= 16) {
      totalLorries = Math.max(1, Math.round(contractMt / 10));
    }
    if (totalLorries <= 0) totalLorries = 1;

    // Count how many MRs exist for this Reference P.O. to determine Lorry Sequence (e.g. 6/6)
    let receivedLorryIndex = totalLorries;
    if (supabase) {
      try {
        const { data: inspList } = await supabase
          .from('material_inspection')
          .select('mr_no, final_arrival_no, po_no, reference_po_no')
          .or(`po_no.eq."${cleanRefPo}",po_no.eq."${withHashRefPo}",reference_po_no.eq."${cleanRefPo}"`);
        if (Array.isArray(inspList) && inspList.length > 0) {
          const uniqueMrs = new Set<string>();
          inspList.forEach((row: any) => {
            const m = String(row.mr_no || row.final_arrival_no || '').trim().toUpperCase();
            if (m) uniqueMrs.add(m);
          });
          uniqueMrs.add(cleanMr);
          receivedLorryIndex = uniqueMrs.size;
        }
      } catch (e) {}
    }

    const lorrySequence = `${receivedLorryIndex}/${totalLorries}`;

    // Determine or generate the 4000-series P.O. No
    const newPoNo =
      existingForMr?.new_po_no ||
      existingForMr?.po_no ||
      existingByPo?.new_po_no ||
      generateNext4000SeriesPoNo(cleanRefPo, existingReturns);

    // Resolve item details from Sauda Check Point (or Purchase Master fallback)
    const embeddedItems = parseEmbeddedItems(
      scpData?.items || scpData?.grid_details || pmData?.items || pmData?.grid_details
    );
    const sourceItems =
      scpDetails.length > 0
        ? scpDetails
        : pmDetails.length > 0
        ? pmDetails
        : embeddedItems;

    const normalizedItems = sourceItems.map((it: any, idx: number) => ({
      srl_no: Number(it.srl_no || idx + 1),
      agency_code: it.agency_code || '',
      agency_name: it.agency_name || it.agency || basePo.agency_name || '',
      grade_code: it.grade_code || '',
      grade_name: it.grade_name || it.grade || it.quality || '',
      grade: it.grade || it.grade_name || it.quality || '',
      quality: it.quality || it.grade_name || it.grade || '',
      marka: it.marka || basePo.marka_type || '',
      bales: Number(it.bales || it.quantity_bales || 0),
      weight_qtl: Number(it.weight_qtl || it.weight_quintal || (Number(it.weight_mt || 0) * 10) || 0),
      weight_mt: Number(it.weight_mt || (Number(it.weight_qtl || 0) / 10) || 0),
      percentage: Number(it.percentage || it.pct || 0),
      rate_qntl: Number(it.rate_qntl || it.rate_per_mt || it.rate || basePo.b_rate || 0),
      rate_per_mt: Number(it.rate_per_mt || it.rate_qntl || it.rate || basePo.b_rate || 0),
      rate: Number(it.rate || it.rate_qntl || it.rate_per_mt || basePo.b_rate || 0),
      premium: Number(it.premium || it.premium_amount || basePo.premium || 0),
      moisture: Number(it.moisture || it.allowable_moisture || 0)
    }));

    const qualitySummary =
      normalizedItems
        .map((it: any) => it.grade_name || it.grade || it.quality)
        .filter(Boolean)
        .join(', ') ||
      basePo.quality_summary ||
      headerForm?.quality ||
      'STD JUTE';

    const totalBales = Array.isArray(detailRows)
      ? detailRows.reduce((acc, r) => acc + (parseFloat(String(r.receipt_bale || r.challan_bale || 0)) || 0), 0)
      : Number(headerForm?.total_bales || 0);

    const returnRecord: ReturnLorryRecord = {
      ...(existingForMr?.id ? { id: existingForMr.id } : {}),
      po_no: newPoNo,
      new_po_no: newPoNo,
      reference_po_no: cleanRefPo,
      sauda_no: basePo.sauda_no || basePo.ptf_no || cleanRefPo,
      ptf_no: basePo.ptf_no || cleanRefPo,
      mr_no: cleanMr,
      final_arrival_no: arrivalNo || cleanMr,
      temporary_arrival_no: temporaryArrivalNo || headerForm?.temporary_arrival_no || arrivalRecord?.temporary_arrival_no || '',
      lorry_number: lorryNo || headerForm?.lorry_no || headerForm?.lorry_number || arrivalRecord?.lorry_number || '',
      lorry_sequence: lorrySequence,
      received_lorry_index: receivedLorryIndex,
      total_no_of_lorries: totalLorries,
      received_weight_mt: weightMt,
      received_weight_qtl: Number((weightMt * 10).toFixed(2)),
      received_bales: totalBales,
      total_contract_mt: contractMt || Number(basePo.total_contract_mt || 60),
      weight_per_lorry: Number(basePo.weight_per_lorry || 10),
      po_date: basePo.po_date || basePo.s_date || new Date().toISOString().slice(0, 10),
      s_date: basePo.s_date || basePo.po_date || new Date().toISOString().slice(0, 10),
      inspection_date: inspectionDate || headerForm?.inspection_date || new Date().toISOString().slice(0, 10),
      supplier: basePo.supplier || basePo.supplier_name || headerForm?.supplier_name || arrivalRecord?.supplier || '',
      supplier_name: basePo.supplier_name || basePo.supplier || headerForm?.supplier_name || arrivalRecord?.supplier || '',
      challan_supplier: basePo.challan_supplier || basePo.supplier || headerForm?.supplier_name || '',
      broker: basePo.broker || basePo.broker_name || headerForm?.broker_name || arrivalRecord?.broker || '',
      broker_name: basePo.broker_name || basePo.broker || headerForm?.broker_name || arrivalRecord?.broker || '',
      area: basePo.area || headerForm?.area || arrivalRecord?.area || '',
      agency_name: basePo.agency_name || normalizedItems[0]?.agency_name || '',
      purchase_unit_name: basePo.purchase_unit_name || headerForm?.unit_conversion || 'BALES',
      b_rate: Number(basePo.b_rate || basePo.rate_qntl || normalizedItems[0]?.rate_qntl || 0),
      premium: Number(basePo.premium || normalizedItems[0]?.premium || 0),
      delivery_from: basePo.delivery_from || '',
      delivery_to: basePo.delivery_to || '',
      grace_days: Number(basePo.grace_days || 0),
      delivery_penalty: Number(basePo.delivery_penalty || 0),
      marka_type: basePo.marka_type || normalizedItems[0]?.marka || '',
      marka_penalty: Number(basePo.marka_penalty || 0),
      qty_penalty: Number(basePo.qty_penalty || 0),
      credit_days: Number(basePo.credit_days || 0),
      cd_percent: Number(basePo.cd_percent || 0),
      tds_percent: Number(basePo.tds_percent || 0),
      payment_type: basePo.payment_type || 'Normal',
      quality_summary: qualitySummary,
      status: 'RETURN_LORRY',
      remarks: `Auto-generated Return Lorry (4000 Series) from Ref P.O. ${cleanRefPo} | MR: ${cleanMr} | Wt: ${weightMt.toFixed(3)} MT (< 5 MT)`,
      items: normalizedItems,
      grid_details: normalizedItems,
      sauda_snapshot: basePo,
      updated_at: new Date().toISOString()
    };

    // 3. Save to Supabase `return_lorry` and `return_lorry_details`
    let savedId = returnRecord.id;
    if (supabase) {
      const { data: upserted, error: upsertErr } = await supabase
        .from('return_lorry')
        .upsert([returnRecord], { onConflict: 'po_no' })
        .select()
        .maybeSingle();

      if (!upsertErr && upserted?.id) {
        savedId = upserted.id;
      }

      if (normalizedItems.length > 0) {
        await supabase.from('return_lorry_details').delete().eq('po_no', newPoNo);
        const detailPayloads = normalizedItems.map((it: any, idx: number) => ({
          ...it,
          return_lorry_id: savedId || null,
          po_no: newPoNo,
          new_po_no: newPoNo,
          reference_po_no: cleanRefPo,
          mr_no: cleanMr,
          srl_no: idx + 1
        }));
        await supabase.from('return_lorry_details').insert(detailPayloads);
      }

      // 4. Mark the inspection and final_arrival rows with Return Lorry metadata
      await Promise.all([
        supabase
          .from('material_inspection')
          .update({
            is_return_lorry: true,
            return_po_no: newPoNo,
            reference_po_no: cleanRefPo,
            received_weight_mt: weightMt
          })
          .or(`mr_no.eq."${cleanMr}",final_arrival_no.eq."${cleanMr}"`),
        supabase
          .from('mill_inspection_master')
          .update({
            is_return_lorry: true,
            return_po_no: newPoNo,
            reference_po_no: cleanRefPo,
            received_weight_mt: weightMt
          })
          .eq('mr_no', cleanMr),
        supabase
          .from('final_arrival')
          .update({
            is_return_lorry: true,
            return_po_no: newPoNo,
            reference_po_no: cleanRefPo
          })
          .or(`final_arrival_no.eq."${cleanMr}",mr_no.eq."${cleanMr}"`)
      ]).catch(() => {});
    }

    // Also save to local storage mirror via dbModule
    await dbModule.save('return_lorry', {
      ...returnRecord,
      id: savedId || `RL-${newPoNo}`
    }).catch(() => {});

    return {
      isReturnLorry: true,
      returnRecord: { ...returnRecord, id: savedId },
      newPoNo,
      referencePoNo: cleanRefPo,
      weightMt
    };
  } catch (err) {
    console.warn('Error in checkAndProcessReturnLorryOnInspection:', err);
    return { isReturnLorry: true, weightMt, referencePoNo: rawPo };
  }
};

/**
 * Scans all existing Mill Inspection records and auto-generates Return Lorry (4000 series)
 * records for any inspection with weight > 0 and < 5 MT that is not yet in `return_lorry`.
 */
export const syncAllReturnLorriesFromInspections = async (): Promise<ReturnLorryRecord[]> => {
  await ensureReturnLorryTablesExist();
  if (!supabase) return fetchAllReturnLorries();

  try {
    const [inspRes, detailsRes, faRes] = await Promise.all([
      supabase.from('material_inspection').select('*').order('created_at', { ascending: false }),
      supabase.from('material_inspection_details').select('*'),
      supabase.from('final_arrival').select('*')
    ]);

    const inspections = inspRes?.data || [];
    const details = detailsRes?.data || [];
    const finalArrivals = faRes?.data || [];

    const detailsByInspId = new Map<string, any[]>();
    const detailsByMr = new Map<string, any[]>();
    details.forEach((d: any) => {
      if (d.inspection_id) {
        const list = detailsByInspId.get(String(d.inspection_id)) || [];
        list.push(d);
        detailsByInspId.set(String(d.inspection_id), list);
      }
      if (d.mr_no) {
        const key = String(d.mr_no).trim().toUpperCase();
        const list = detailsByMr.get(key) || [];
        list.push(d);
        detailsByMr.set(key, list);
      }
    });

    const faByMr = new Map<string, any>();
    finalArrivals.forEach((fa: any) => {
      const k = String(fa.final_arrival_no || fa.mr_no || '').trim().toUpperCase();
      if (k) faByMr.set(k, fa);
    });

    for (const insp of inspections) {
      const mrNo = String(insp.mr_no || insp.final_arrival_no || '').trim().toUpperCase();
      if (!mrNo) continue;
      const fa = faByMr.get(mrNo);
      const dRows =
        detailsByInspId.get(String(insp.id)) ||
        detailsByMr.get(mrNo) ||
        [];
      const wtMt = calculateInspectionWeightMt(insp, dRows, fa);
      const poNo = insp.reference_po_no || insp.po_no || fa?.po_no || '';
      if (wtMt > 0 && wtMt < 5 && poNo) {
        await checkAndProcessReturnLorryOnInspection({
          mrNo,
          poNo,
          arrivalNo: insp.final_arrival_no || mrNo,
          temporaryArrivalNo: insp.temporary_arrival_no || fa?.temporary_arrival_no,
          lorryNo: insp.lorry_no || insp.lorry_number || fa?.lorry_number,
          inspectionDate: insp.inspection_date || insp.date,
          headerForm: insp,
          detailRows: dRows,
          arrivalRecord: fa
        });
      }
    }
  } catch (err) {
    console.warn('Error syncing return lorries from inspections:', err);
  }

  return fetchAllReturnLorries();
};
