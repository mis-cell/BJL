import React, { useState, useEffect } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { 
  Link, 
  Search, 
  CheckCircle2, 
  FileText, 
  RefreshCw, 
  Printer, 
  Trash2, 
  Download,
  X,
  Filter,
  Layers,
  ArrowRight,
  History,
  Truck,
  Package,
  Calendar
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PaginationControls } from '../components/PaginationControls';
import { supabase } from '../lib/supabase';
import { dbModule, notifyDataChanged } from '../services/dbModule';
import LegacyLayout from '../components/LegacyLayout';
import PrintModal from '../components/PrintModal';
import { getCurrentUserContext } from '../lib/permissions';

interface ClubbingRecord {
  id: string;
  clubbedAt: string;
  mrNo: string;
  finalArrivalNo: string;
  tempArrivalNo: string;
  arrivalDate: string;
  poNo: string;
  poDate: string;
  supplier: string;
  broker: string;
  area: string;
  lorryNumber: string;
  challanNo: string;
  packets: number;
  poNos: string[];
  amadNos: string[];
  totalPoLorries: number;
  receivedLorriesCount: number;
  totalPoWeight: number;
  totalReceivedWeight: number;
  variancePct: number;
  recordedBy: string;
  remarks: string;
}

const parseJsonArray = (val: any, fallbackSingle?: any): string[] => {
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (typeof val === 'string' && val.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
  }
  if (fallbackSingle) return [String(fallbackSingle)];
  return [];
};

const normalize = (val: any) => String(val || '').trim().toUpperCase();

const cleanAlnum = (val: any) => String(val || '').trim().replace(/[^a-z0-9]/gi, '').toUpperCase();

const extractCanonicalPoSerial = (raw: any): string => {
  const str = String(raw || '').trim().toUpperCase();
  if (!str || str === 'NO' || str === 'N/A' || str === 'NONE') return '';
  const isPtf = str.includes('PTF');
  const withoutPrefix = str
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
  const strippedZeros = withoutYear.replace(/^0+/, '') || '0';
  return isPtf ? `PTF_${strippedZeros}` : strippedZeros;
};

const getPoMatchKeys = (candidates: any[]): string[] => {
  const keys = new Set<string>();
  const ignore = new Set(['', 'NO', 'NA', 'N/A', 'NONE', 'UNDEFINED', 'NULL', 'PENDING', 'NORMAL', 'SPECIAL']);
  for (const c of candidates) {
    const raw = normalize(c);
    if (!raw || ignore.has(raw)) continue;
    keys.add(`R:${raw}`);
    const clean = cleanAlnum(raw);
    if (clean && !ignore.has(clean)) keys.add(`C:${clean}`);
    const serial = extractCanonicalPoSerial(raw);
    if (serial && !ignore.has(serial)) keys.add(`S:${serial}`);
  }
  return Array.from(keys);
};

let schemaEnsured = false;
async function ensureClubbedPomrSchema() {
  if (schemaEnsured || !supabase) return;
  schemaEnsured = true;
  const sql = `
    CREATE TABLE IF NOT EXISTS clubbed_pomr (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      club_id TEXT UNIQUE NOT NULL,
      clubbed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      primary_po_no TEXT NOT NULL,
      po_no TEXT,
      ptf_no TEXT,
      po_date TEXT,
      clubbed_po_nos JSONB DEFAULT '[]'::jsonb,
      po_nos TEXT,
      primary_mr_no TEXT,
      mr_no TEXT,
      final_arrival_no TEXT,
      temporary_arrival_no TEXT,
      arrival_date TEXT,
      clubbed_mr_nos JSONB DEFAULT '[]'::jsonb,
      amad_nos TEXT,
      supplier TEXT,
      challan_supplier TEXT,
      broker TEXT,
      area TEXT,
      lorry_number TEXT,
      challan_no TEXT,
      packets NUMERIC(15,2) DEFAULT 0,
      total_po_lorries INTEGER DEFAULT 1,
      received_lorries_count INTEGER DEFAULT 1,
      total_po_weight NUMERIC(15,3) DEFAULT 0,
      total_received_weight NUMERIC(15,3) DEFAULT 0,
      total_weight_mt NUMERIC(15,3) DEFAULT 0,
      variance_pct NUMERIC(15,2) DEFAULT 0,
      recorded_by TEXT,
      clubbed_by TEXT,
      remarks TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      unclubbed_at TIMESTAMP WITH TIME ZONE
    );
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS clubbed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS po_no TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS ptf_no TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS po_date TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS po_nos TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS mr_no TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS final_arrival_no TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS temporary_arrival_no TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS arrival_date TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS amad_nos TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS supplier TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS challan_supplier TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS broker TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS area TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS lorry_number TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS challan_no TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS packets NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS total_po_lorries INTEGER DEFAULT 1;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS received_lorries_count INTEGER DEFAULT 1;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS total_po_weight NUMERIC(15,3) DEFAULT 0;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS total_received_weight NUMERIC(15,3) DEFAULT 0;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS variance_pct NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE IF EXISTS clubbed_pomr ADD COLUMN IF NOT EXISTS recorded_by TEXT;
    ALTER TABLE IF EXISTS clubbed_pomr DISABLE ROW LEVEL SECURITY;
    NOTIFY pgrst, 'reload schema';
  `;
  try {
    await supabase.rpc('exec_sql', { query: sql });
  } catch (_e) {
    // Non-fatal if exec_sql RPC is restricted
  }
}

const getArrivalWeightMt = (fa: any): number => {
  if (!fa) return 0;
  if (fa.weight_qtl && Number(fa.weight_qtl) > 0) return Number((parseFloat(fa.weight_qtl) / 10).toFixed(3));
  if (fa.weight && Number(fa.weight) > 0) {
    const w = parseFloat(fa.weight);
    return Number((w > 50 ? w / 10 : w).toFixed(3));
  }
  if (fa.electronic_net_weight && Number(fa.electronic_net_weight) > 0) {
    const ew = parseFloat(fa.electronic_net_weight);
    return Number((ew > 50 ? ew / 10 : ew).toFixed(3));
  }
  if (fa.challan_material_weight && Number(fa.challan_material_weight) > 0) {
    return Number(parseFloat(fa.challan_material_weight).toFixed(3));
  }
  return 0;
};

const mapDbRowToClubRecord = (
  row: any,
  allFinalArrivals: any[] = [],
  allPos: any[] = [],
  allSaudaCheck: any[] = []
): ClubbingRecord => {
  const poNos = parseJsonArray(
    row.clubbed_po_nos ?? row.po_nos,
    row.primary_po_no || row.po_no
  );
  const amadNos = parseJsonArray(
    row.clubbed_mr_nos ?? row.amad_nos,
    row.primary_mr_no || row.mr_no || row.final_arrival_no
  );

  const primaryMr = normalize(row.final_arrival_no || row.mr_no || row.primary_mr_no || amadNos[0]);
  const primaryPo = normalize(row.po_no || row.primary_po_no || poNos[0]);

  const matchedFa = primaryMr
    ? allFinalArrivals.find(
        (fa: any) =>
          normalize(fa.final_arrival_no) === primaryMr ||
          normalize(fa.mr_no) === primaryMr ||
          normalize(fa.temporary_arrival_no) === primaryMr
      )
    : null;

  const matchedPo = primaryPo
    ? allSaudaCheck.find(
        (s: any) =>
          normalize(s.po_no) === primaryPo ||
          normalize(s.ptf_no) === primaryPo ||
          normalize(s.sauda_no) === primaryPo ||
          normalize(s.contract_po_no) === primaryPo
      ) ||
      allPos.find(
        (p: any) =>
          normalize(p.po_no) === primaryPo ||
          normalize(p.ptf_no) === primaryPo ||
          normalize(p.sauda_no) === primaryPo ||
          normalize(p.contract_po_no) === primaryPo
      )
    : null;

  const faWeightMt = getArrivalWeightMt(matchedFa);
  const poWeightMt = matchedPo
    ? Number(
        matchedPo.total_contract_mt ||
          matchedPo.quantity_mt ||
          matchedPo.total_qty_mt ||
          matchedPo.quantity ||
          (matchedPo.qty_qtl ? Number(matchedPo.qty_qtl) / 10 : 0) ||
          0
      )
    : 0;

  const totalPoWeight = Number(row.total_po_weight ?? row.totalPoWeight ?? poWeightMt ?? 0);
  const totalReceivedWeight = Number(
    row.total_received_weight ?? row.totalReceivedWeight ?? row.total_weight_mt ?? faWeightMt ?? 0
  );
  const computedVariance =
    totalPoWeight > 0
      ? Number((((totalReceivedWeight - totalPoWeight) / totalPoWeight) * 100).toFixed(2))
      : 0;

  const mrNoVal = String(row.final_arrival_no || row.mr_no || row.primary_mr_no || amadNos[0] || '');
  const tempNoVal = String(
    row.temporary_arrival_no ||
      matchedFa?.temporary_arrival_no ||
      matchedFa?.arrival_no ||
      matchedFa?.amad_no ||
      mrNoVal
  );
  const poNoVal = String(row.po_no || row.primary_po_no || poNos[0] || '');

  return {
    id: String(row.club_id || row.id || ''),
    clubbedAt: String(row.clubbed_at || row.clubbedAt || row.created_at || new Date().toISOString()).split('T')[0],
    mrNo: mrNoVal,
    finalArrivalNo: mrNoVal,
    tempArrivalNo: tempNoVal,
    arrivalDate: String(row.arrival_date || matchedFa?.date || matchedFa?.final_arrival_date || matchedFa?.mr_date || ''),
    poNo: poNoVal,
    poDate: String(row.po_date || matchedPo?.po_date || matchedPo?.date || matchedPo?.s_date || ''),
    supplier: String(
      row.supplier ||
        matchedFa?.supplier ||
        matchedFa?.challan_supplier ||
        matchedPo?.supplier ||
        'N/A'
    ),
    broker: String(row.broker || matchedFa?.broker || matchedPo?.broker || 'N/A'),
    area: String(
      row.area ||
        matchedFa?.area ||
        matchedFa?.arrival_area_name ||
        matchedFa?.arrival_area ||
        matchedPo?.area ||
        'N/A'
    ),
    lorryNumber: String(
      row.lorry_number ||
        matchedFa?.lorry_number ||
        matchedFa?.lorry_no ||
        matchedFa?.vehicle_no ||
        'N/A'
    ),
    challanNo: String(row.challan_no || matchedFa?.challan_rr_no || matchedFa?.challan_no || 'N/A'),
    packets: Number(row.packets || matchedFa?.total_packets || matchedFa?.packets || 0),
    poNos: poNos.length > 0 ? poNos : (poNoVal ? [poNoVal] : []),
    amadNos: amadNos.length > 0 ? amadNos : (mrNoVal ? [mrNoVal] : []),
    totalPoLorries: Number(row.total_po_lorries || matchedPo?.total_lorries || matchedPo?.no_of_lorries || 1),
    receivedLorriesCount: Number(row.received_lorries_count || 1),
    totalPoWeight,
    totalReceivedWeight,
    variancePct: Number(row.variance_pct ?? row.variancePct ?? computedVariance ?? 0),
    recordedBy: String(row.recorded_by || row.recordedBy || row.clubbed_by || 'ADMIN'),
    remarks: String(row.remarks || '')
  };
};

export default function ClubPOMR({ onClose }: { onClose?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Unbound Lists
  const [unboundFinalArrivals, setUnboundFinalArrivals] = useState<any[]>([]);
  const [unboundPOs, setUnboundPOs] = useState<any[]>([]);

  // Selection for Detail views and Binding Modal
  const [selectedArrivalForBind, setSelectedArrivalForBind] = useState<any | null>(null);
  const [chosenPoForBind, setChosenPoForBind] = useState<any | null>(null);
  const [selectedDetailMr, setSelectedDetailMr] = useState<any | null>(null);
  const [showAllPOsInModal, setShowAllPOsInModal] = useState(false);
  const [modalPoSearch, setModalPoSearch] = useState('');

  // Binding Form remarks
  const [remarks, setRemarks] = useState('');

  // Manual Clubbed History Modal & Data (strictly from clubbed_pomr table)
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [clubbingHistory, setClubbingHistory] = useState<ClubbingRecord[]>([]);

  // Pagination for History Modal
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [printingClub, setPrintingClub] = useState<ClubbingRecord | null>(null);

  useEffect(() => {
    ensureClubbedPomrSchema();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSupplier, historySearch]);

  // Load all initial data & master entries
  const loadInitialData = async () => {
    setLoading(true);
    try {
      await ensureClubbedPomrSchema();

      const [
        allPos,
        allSaudaCheck,
        allSaudaMaster,
        allFinalArrivals,
        allTempArrivals,
        allClubbed
      ] = await Promise.all([
        dbModule.fetchAll('purchase_master', 'created_at', false).catch(() => []),
        dbModule.fetchAll('sauda_check_point', 'created_at', false).catch(() => []),
        dbModule.fetchAll('sauda_master', 'created_at', false).catch(() => []),
        dbModule.fetchAll('final_arrival', 'created_at', false).catch(() => []),
        dbModule.fetchAll('temporary_material_received', 'created_at', false).catch(() => []),
        dbModule.fetchAll('clubbed_pomr', 'created_at', false).catch(() => [])
      ]);

      // Build Supplier filter options
      const supplierSet = new Set<string>();
      (allPos || []).forEach((p: any) => { if (p.supplier) supplierSet.add(p.supplier); });
      (allSaudaCheck || []).forEach((s: any) => { if (s.supplier) supplierSet.add(s.supplier); });
      (allFinalArrivals || []).forEach((f: any) => {
        if (f.supplier) supplierSet.add(f.supplier);
        if (f.challan_supplier) supplierSet.add(f.challan_supplier);
      });

      const suppliersList = Array.from(supplierSet).filter(Boolean).sort();
      setSuppliers(suppliersList);

      // History ONLY includes records manually clubbed and stored in clubbed_pomr
      const manualHistory = (allClubbed || [])
        .filter((row: any) => String(row.status || 'ACTIVE').toUpperCase() !== 'DELETED')
        .map((row: any) => mapDbRowToClubRecord(row, allFinalArrivals, allPos, allSaudaCheck));

      setClubbingHistory(manualHistory);

      // Compute unbound Final Arrivals & Open Multi-Lorry P.Os
      computeOpenArrivalsAndPOs(
        selectedSupplier || 'ALL',
        allPos || [],
        allSaudaCheck || [],
        allSaudaMaster || [],
        allFinalArrivals || [],
        allTempArrivals || []
      );
    } catch (err) {
      console.error('Error loading Club P.O & Arrival data:', err);
    } finally {
      setLoading(false);
    }
  };

  const computeOpenArrivalsAndPOs = (
    supplierName: string,
    allPos: any[],
    allSaudaCheck: any[],
    allSaudaMaster: any[],
    allFinalArrivals: any[],
    allTempArrivals: any[]
  ) => {
    const isAll = !supplierName || supplierName === 'ALL';

    // Build index of Temporary Arrivals by temporary_arrival_no / amad_no / mr_no for enriching Final Arrivals
    const tempByNo = new Map<string, any>();
    (allTempArrivals || []).forEach((ta: any) => {
      [ta.temporary_arrival_no, ta.amad_no, ta.arrival_no, ta.mr_no].forEach((k) => {
        const nk = normalize(k);
        if (nk && !tempByNo.has(nk)) tempByNo.set(nk, ta);
      });
    });

    // 1. Untagged Final Arrivals: records in final_arrival where po_no is blank/empty/NO/N/A
    const filteredFinalArrivals = (allFinalArrivals || [])
      .filter((fa: any) => {
        const poNoStr = normalize(fa.po_no);
        const isPoBlank = !poNoStr || poNoStr === 'NO' || poNoStr === 'N/A' || poNoStr === 'NONE';
        if (!isPoBlank) return false;

        // Also check if linked temporary_arrival already has a valid PO or keep it untagged if final_arrival has no PO
        const matchesSupplier =
          isAll ||
          normalize(fa.supplier) === normalize(supplierName) ||
          normalize(fa.challan_supplier) === normalize(supplierName);
        return matchesSupplier;
      })
      .map((fa: any) => {
        const tempKey = normalize(fa.temporary_arrival_no || fa.arrival_no || fa.amad_no || fa.mr_no);
        const linkedTemp = tempKey ? tempByNo.get(tempKey) : null;
        return {
          ...fa,
          temporary_arrival_no:
            fa.temporary_arrival_no ||
            fa.arrival_no ||
            linkedTemp?.temporary_arrival_no ||
            linkedTemp?.amad_no ||
            fa.final_arrival_no ||
            fa.mr_no,
          supplier: fa.supplier || fa.challan_supplier || linkedTemp?.supplier || 'N/A',
          broker: fa.broker || linkedTemp?.broker || 'N/A',
          area:
            fa.area ||
            fa.arrival_area_name ||
            fa.arrival_area ||
            linkedTemp?.arrival_area_name ||
            linkedTemp?.arrival_area ||
            'N/A',
          lorry_number:
            fa.lorry_number ||
            fa.lorry_no ||
            fa.vehicle_no ||
            linkedTemp?.lorry_number ||
            'N/A',
          challan_rr_no:
            fa.challan_rr_no ||
            fa.challan_no ||
            linkedTemp?.challan_rr_no ||
            linkedTemp?.challan_railway_receipt_no ||
            'N/A'
        };
      });

    // 2. Build fast lookup indices for Final Arrivals & Temp Arrivals by PO keys (same logic as Sauda Check Point)
    const buildPoRecordIndex = (records: any[], getCands: (r: any) => any[]) => {
      const idx = new Map<string, any[]>();
      for (const r of records || []) {
        if (!r) continue;
        const keys = getPoMatchKeys(getCands(r));
        for (const k of keys) {
          let bucket = idx.get(k);
          if (!bucket) {
            bucket = [r];
            idx.set(k, bucket);
          } else if (!bucket.includes(r)) {
            bucket.push(r);
          }
        }
      }
      return idx;
    };

    const queryPoIndex = (idx: Map<string, any[]>, poKeys: string[]): any[] => {
      const res: any[] = [];
      const seen = new Set<any>();
      for (const k of poKeys) {
        const bucket = idx.get(k);
        if (!bucket) continue;
        for (const item of bucket) {
          if (!seen.has(item)) {
            seen.add(item);
            res.push(item);
          }
        }
      }
      return res;
    };

    const finalByPoIndex = buildPoRecordIndex(allFinalArrivals, (r) => [
      r.po_no,
      r.contract_no,
      r.contract_po_no,
      r.sauda_no,
      r.ptf_no
    ]);

    const tempByPoIndex = buildPoRecordIndex(allTempArrivals, (r) => [
      r.po_no,
      r.contract_po_no,
      r.sauda_no,
      r.contract_no,
      r.ptf_no
    ]);

    const saudaByKeyIndex = buildPoRecordIndex(allSaudaMaster, (s) => [
      s.sauda_no,
      s.po_no,
      s.contract_no
    ]);

    // 3. Process Open P.O / Sauda Check Point Contracts:
    // A P.O / Sauda with multiple lorries (e.g. 6 lorries on BJCL/2026-2027/0660) MUST remain available
    // until all contracted lorries have been received/tagged (receivedLorries < contractLorries) and it is not closed.
    const combinedPOsMap = new Map<string, any>();

    const processPo = (po: any) => {
      const poNo = po.po_no || po.ptf_no || po.po_ptf_no || po.sauda_no || po.contract_po_no || po.contract_no;
      if (!poNo) return;

      const normPoNo = normalize(poNo);
      if (combinedPOsMap.has(normPoNo)) return;

      const matchesSupplier = isAll || normalize(po.supplier) === normalize(supplierName);
      if (!matchesSupplier) return;

      const poKeys = getPoMatchKeys([
        po.po_no,
        po.contract_po_no,
        po.ptf_no,
        po.sauda_no,
        po.po_contract,
        po.contract_no
      ]);

      const matchedSaudas = queryPoIndex(saudaByKeyIndex, poKeys);
      const matchedSauda = matchedSaudas[0] || null;

      // Total Contract Lorries (e.g., 6 Lorries for BJCL/2026-2027/0660)
      const contractLorries = Math.max(
        1,
        parseInt(
          po.total_lorries ||
            po.total_no_of_lorries ||
            po.no_of_lorries ||
            po.lorries ||
            matchedSauda?.no_of_lorries ||
            matchedSauda?.total_lorries ||
            1,
          10
        ) || 1
      );

      // Match all Final Arrivals and Temporary Arrivals already tagged to this P.O
      const matchingFinal = queryPoIndex(finalByPoIndex, poKeys);
      const matchingTempArrivals = queryPoIndex(tempByPoIndex, poKeys);

      // Deduplicate Temp Arrivals that are already represented in Final Arrivals (1 Lorry = 1 MR)
      const matchingTempDeduped = matchingTempArrivals.filter(
        (ar: any) =>
          !matchingFinal.some(
            (f: any) =>
              (f.temporary_arrival_no &&
                (ar.temporary_arrival_no || ar.amad_no) &&
                normalize(f.temporary_arrival_no) === normalize(ar.temporary_arrival_no || ar.amad_no)) ||
              (f.arrival_no &&
                (ar.temporary_arrival_no || ar.amad_no) &&
                normalize(f.arrival_no) === normalize(ar.temporary_arrival_no || ar.amad_no)) ||
              (f.mr_no &&
                (ar.temporary_arrival_no || ar.amad_no) &&
                normalize(f.mr_no) === normalize(ar.temporary_arrival_no || ar.amad_no)) ||
              (f.final_arrival_no &&
                (ar.temporary_arrival_no || ar.amad_no || ar.mr_no) &&
                normalize(f.final_arrival_no) === normalize(ar.temporary_arrival_no || ar.amad_no || ar.mr_no)) ||
              (f.lorry_number &&
                ar.lorry_number &&
                normalize(f.lorry_number) === normalize(ar.lorry_number))
          )
      );

      const receivedLorries = Math.max(
        matchingTempArrivals.length,
        matchingFinal.length + matchingTempDeduped.length
      );

      const receivedWeightMt =
        matchingFinal.reduce((sum: number, r: any) => sum + getArrivalWeightMt(r), 0) +
        matchingTempDeduped.reduce((sum: number, r: any) => sum + getArrivalWeightMt(r), 0);

      const linkedMrNos = Array.from(
        new Set(
          [
            ...matchingFinal.map((r: any) => String(r.final_arrival_no || r.mr_no || '').trim()),
            ...matchingTempDeduped.map((r: any) => String(r.temporary_arrival_no || r.amad_no || r.mr_no || '').trim())
          ].filter(Boolean)
        )
      );

      // Check if explicitly closed or cancelled
      const statusLower = String(po.status || '').toLowerCase();
      const isExplicitClosed =
        !po.is_reopened &&
        (Boolean(po.is_closed) || statusLower === 'closed' || statusLower === 'cancelled');

      // Keep P.O visible as long as it is not explicitly closed and receivedLorries < contractLorries
      const hasOpenLorries = !isExplicitClosed && receivedLorries < contractLorries;

      if (hasOpenLorries) {
        const totalContractMt = Number(
          po.total_contract_mt ||
            po.quantity_mt ||
            po.total_qty_mt ||
            po.quantity ||
            matchedSauda?.total_wt_in_ton ||
            (po.qty_qtl ? Number(po.qty_qtl) / 10 : 0) ||
            0
        );

        combinedPOsMap.set(normPoNo, {
          ...po,
          po_no: poNo,
          po_date: po.po_date || po.date || po.s_date || matchedSauda?.date || '',
          broker: po.broker || po.broker_name || matchedSauda?.broker || 'N/A',
          area:
            po.area ||
            po.arrival_area_name ||
            po.arrival_yard ||
            po.area_name ||
            po.dispatch_place ||
            matchedSauda?.area ||
            'N/A',
          supplier: po.supplier || matchedSauda?.supplier || 'N/A',
          total_contract_mt: totalContractMt,
          received_weight_mt: Number(receivedWeightMt.toFixed(3)),
          contract_lorries: contractLorries,
          received_lorries: receivedLorries,
          remaining_lorries: Math.max(0, contractLorries - receivedLorries),
          linked_mr_nos: linkedMrNos
        });
      }
    };

    // Prioritize Sauda Check Point records, then Final P.O (purchase_master)
    (allSaudaCheck || []).forEach(processPo);
    (allPos || []).forEach(processPo);

    setUnboundFinalArrivals(filteredFinalArrivals);
    setUnboundPOs(Array.from(combinedPOsMap.values()));
  };

  useLiveAutoRefresh(loadInitialData, [selectedSupplier], {
    tables: [
      'purchase_master',
      'sauda_check_point',
      'sauda_master',
      'final_arrival',
      'temporary_material_received',
      'clubbed_pomr'
    ]
  });

  useEffect(() => {
    loadInitialData();
  }, [selectedSupplier]);

  // Execute Voucher Binding (Updates Final Arrival, Temporary Arrival based on Final Arrival, Mill Inspection, and saves to clubbed_pomr)
  const handleConfirmBinding = async () => {
    if (!selectedArrivalForBind || !chosenPoForBind) return;

    setLoading(true);
    try {
      await ensureClubbedPomrSchema();

      const faNo = String(
        selectedArrivalForBind.final_arrival_no || selectedArrivalForBind.mr_no || ''
      ).trim();
      const poNo = String(chosenPoForBind.po_no || chosenPoForBind.ptf_no || '').trim();
      const poDate = String(
        chosenPoForBind.po_date ||
          chosenPoForBind.ptf_date ||
          chosenPoForBind.date ||
          chosenPoForBind.sauda_date ||
          chosenPoForBind.s_date ||
          ''
      ).trim();

      if (!faNo || !poNo) {
        throw new Error('Missing Final Arrival MR No or P.O No for binding.');
      }

      // 1. Lookup exact Final Arrival record from `final_arrival` to get its `temporary_arrival_no`
      let exactFaRecord: any = selectedArrivalForBind;
      if (supabase) {
        const { data: faRows } = await supabase
          .from('final_arrival')
          .select('*')
          .or(`final_arrival_no.eq.${faNo},mr_no.eq.${faNo}`)
          .limit(1);
        if (faRows && faRows.length > 0) {
          exactFaRecord = { ...selectedArrivalForBind, ...faRows[0] };
        }
      }

      // Extract `temporary_arrival_no` from Final Arrival table (`final_arrival.temporary_arrival_no`)
      const tempArrivalNo = String(
        exactFaRecord.temporary_arrival_no ||
          exactFaRecord.arrival_no ||
          exactFaRecord.amad_no ||
          selectedArrivalForBind.temporary_arrival_no ||
          faNo
      ).trim();

      const faWeightMt = getArrivalWeightMt(exactFaRecord);
      const poWeightMt = Number(chosenPoForBind.total_contract_mt || 0);
      const variance =
        poWeightMt > 0
          ? Number((((faWeightMt - poWeightMt) / poWeightMt) * 100).toFixed(2))
          : 0;

      const contractLorries = Number(chosenPoForBind.contract_lorries || chosenPoForBind.total_lorries || 1);
      const newReceivedLorriesCount = Number(chosenPoForBind.received_lorries || 0) + 1;

      const clubId = `CLUB-${Date.now().toString().slice(-6)}`;
      const clubbedIso = new Date().toISOString();
      const clubbedDate = clubbedIso.split('T')[0];

      const supplierName =
        exactFaRecord.supplier ||
        exactFaRecord.challan_supplier ||
        chosenPoForBind.supplier ||
        'N/A';
      const brokerName = exactFaRecord.broker || chosenPoForBind.broker || 'N/A';
      const areaName =
        exactFaRecord.area ||
        exactFaRecord.arrival_area_name ||
        exactFaRecord.arrival_area ||
        chosenPoForBind.area ||
        'N/A';
      const lorryNo =
        exactFaRecord.lorry_number ||
        exactFaRecord.lorry_no ||
        exactFaRecord.vehicle_no ||
        'N/A';
      const challanNo =
        exactFaRecord.challan_rr_no || exactFaRecord.challan_no || 'N/A';
      const packetsCount = Number(
        exactFaRecord.total_packets || exactFaRecord.packets || 0
      );

      const userCtx = getCurrentUserContext();
      const currentUserName = userCtx?.username || 'ADMIN';

      const poUpdatePayload: Record<string, any> = { po_no: poNo };
      if (poDate) poUpdatePayload.po_date = poDate;

      // =========================================================================
      // STEP A: UPDATE FINAL ARRIVAL (`final_arrival`)
      // =========================================================================
      if (exactFaRecord.final_arrival_id) {
        await dbModule
          .update('final_arrival', 'final_arrival_id', exactFaRecord.final_arrival_id, {
            ...poUpdatePayload,
            contract_no: poNo
          })
          .catch(() => {});
      }
      await dbModule
        .update('final_arrival', 'final_arrival_no', faNo, {
          ...poUpdatePayload,
          contract_no: poNo
        })
        .catch(() => {});
      await dbModule
        .update('final_arrival', 'mr_no', faNo, {
          ...poUpdatePayload,
          contract_no: poNo
        })
        .catch(() => {});

      if (supabase) {
        await supabase
          .from('final_arrival')
          .update(poUpdatePayload)
          .or(`final_arrival_no.eq.${faNo},mr_no.eq.${faNo}`);
      }

      // =========================================================================
      // STEP B: BASED ON FINAL ARRIVAL (`temporary_arrival_no`), UPDATE TEMPORARY ARRIVAL (`temporary_material_received`)
      // =========================================================================
      const tempLookupKeys = Array.from(
        new Set([tempArrivalNo, faNo, exactFaRecord.arrival_no, exactFaRecord.amad_no].map(v => String(v || '').trim()).filter(Boolean))
      );

      for (const tKey of tempLookupKeys) {
        await dbModule
          .update('temporary_material_received', 'temporary_arrival_no', tKey, poUpdatePayload)
          .catch(() => {});
        await dbModule
          .update('temporary_material_received', 'amad_no', tKey, poUpdatePayload)
          .catch(() => {});
        await dbModule
          .update('temporary_material_received', 'mr_no', tKey, poUpdatePayload)
          .catch(() => {});
        await dbModule
          .update('temporary_material_received', 'arrival_no', tKey, poUpdatePayload)
          .catch(() => {});

        if (supabase) {
          await supabase
            .from('temporary_material_received')
            .update(poUpdatePayload)
            .eq('temporary_arrival_no', tKey);
          await supabase
            .from('temporary_material_received')
            .update(poUpdatePayload)
            .eq('amad_no', tKey);
        }
      }

      // =========================================================================
      // STEP C: UPDATE MILL INSPECTION (`material_inspection`, `mill_inspection_master`, `inspection_master`, `inspection_checklist`)
      // =========================================================================
      const inspectionPayloadWithMillPo: Record<string, any> = {
        ...poUpdatePayload,
        mill_po_no: poNo,
        ...(poDate ? { mill_po_date: poDate } : {})
      };

      for (const mrKey of tempLookupKeys) {
        // 1. material_inspection
        await dbModule.update('material_inspection', 'mr_no', mrKey, inspectionPayloadWithMillPo).catch(() => {});
        await dbModule.update('material_inspection', 'arrival_no', mrKey, inspectionPayloadWithMillPo).catch(() => {});
        await dbModule.update('material_inspection', 'temporary_arrival_no', mrKey, inspectionPayloadWithMillPo).catch(() => {});

        // 2. mill_inspection_master
        await dbModule.update('mill_inspection_master', 'mr_no', mrKey, poUpdatePayload).catch(() => {});
        await dbModule.update('mill_inspection_master', 'arrival_no', mrKey, poUpdatePayload).catch(() => {});

        // 3. inspection_master
        await dbModule.update('inspection_master', 'mr_no', mrKey, inspectionPayloadWithMillPo).catch(() => {});
        await dbModule.update('inspection_master', 'arrival_no', mrKey, inspectionPayloadWithMillPo).catch(() => {});

        // 4. inspection_checklist
        await dbModule.update('inspection_checklist', 'mr_no', mrKey, inspectionPayloadWithMillPo).catch(() => {});
        await dbModule.update('inspection_checklist', 'arrival_no', mrKey, inspectionPayloadWithMillPo).catch(() => {});

        if (supabase) {
          await supabase.from('material_inspection').update(poUpdatePayload).or(`mr_no.eq.${mrKey},arrival_no.eq.${mrKey}`);
          await supabase.from('mill_inspection_master').update(poUpdatePayload).or(`mr_no.eq.${mrKey},arrival_no.eq.${mrKey}`);
          await supabase.from('inspection_master').update(poUpdatePayload).or(`mr_no.eq.${mrKey},arrival_no.eq.${mrKey}`);
          await supabase.from('inspection_checklist').update(poUpdatePayload).or(`mr_no.eq.${mrKey},arrival_no.eq.${mrKey}`);
        }
      }

      // Sync cached Mill Inspection records in localStorage if present
      try {
        const cachedInsp = localStorage.getItem('inspection_master_records');
        if (cachedInsp) {
          const parsed = JSON.parse(cachedInsp);
          if (Array.isArray(parsed)) {
            const normSet = new Set(tempLookupKeys.map(normalize));
            const updated = parsed.map((item: any) => {
              if (
                normSet.has(normalize(item.mr_no)) ||
                normSet.has(normalize(item.arrival_no)) ||
                normSet.has(normalize(item.temporary_arrival_no))
              ) {
                return {
                  ...item,
                  po_no: poNo,
                  ...(poDate ? { po_date: poDate } : {}),
                  mill_po_no: poNo
                };
              }
              return item;
            });
            localStorage.setItem('inspection_master_records', JSON.stringify(updated));
          }
        }
      } catch (_e) {}

      // =========================================================================
      // STEP D: SAVE MANUAL CLUBBING RECORD TO SUPABASE (`clubbed_pomr`)
      // =========================================================================
      const arrivalDateStr = String(
        exactFaRecord.date || exactFaRecord.final_arrival_date || exactFaRecord.mr_date || ''
      );

      const newClubRecord: ClubbingRecord = {
        id: clubId,
        clubbedAt: clubbedDate,
        mrNo: faNo,
        finalArrivalNo: faNo,
        tempArrivalNo,
        arrivalDate: arrivalDateStr,
        poNo,
        poDate,
        supplier: supplierName,
        broker: brokerName,
        area: areaName,
        lorryNumber: lorryNo,
        challanNo,
        packets: packetsCount,
        poNos: [poNo],
        amadNos: [faNo],
        totalPoLorries: contractLorries,
        receivedLorriesCount: newReceivedLorriesCount,
        totalPoWeight: poWeightMt,
        totalReceivedWeight: faWeightMt,
        variancePct: variance,
        recordedBy: currentUserName,
        remarks:
          remarks ||
          `Manually clubbed MR ${faNo} (Temp Arrival: ${tempArrivalNo}) with P.O ${poNo} (Lorry ${newReceivedLorriesCount}/${contractLorries})`
      };

      await dbModule.insert('clubbed_pomr', {
        club_id: clubId,
        primary_po_no: poNo,
        po_no: poNo,
        ptf_no: chosenPoForBind.ptf_no || poNo,
        po_date: poDate || null,
        clubbed_po_nos: [poNo],
        po_nos: JSON.stringify([poNo]),
        primary_mr_no: faNo,
        mr_no: faNo,
        final_arrival_no: faNo,
        temporary_arrival_no: tempArrivalNo,
        arrival_date: arrivalDateStr || null,
        clubbed_mr_nos: [faNo],
        amad_nos: JSON.stringify([faNo]),
        supplier: supplierName,
        challan_supplier: exactFaRecord.challan_supplier || supplierName,
        broker: brokerName,
        area: areaName,
        lorry_number: lorryNo,
        challan_no: challanNo,
        packets: packetsCount,
        total_po_lorries: contractLorries,
        received_lorries_count: newReceivedLorriesCount,
        total_weight_mt: faWeightMt,
        total_po_weight: poWeightMt,
        total_received_weight: faWeightMt,
        variance_pct: variance,
        recorded_by: currentUserName,
        clubbed_by: currentUserName,
        clubbed_at: clubbedIso,
        remarks: newClubRecord.remarks,
        status: 'ACTIVE'
      });

      // Invalidate caches and notify all modules
      notifyDataChanged('final_arrival');
      notifyDataChanged('temporary_material_received');
      notifyDataChanged('material_inspection');
      notifyDataChanged('mill_inspection_master');
      notifyDataChanged('clubbed_pomr');

      setSuccessToast(
        `Bound MR #${faNo} (Temp Arrival #${tempArrivalNo}) with P.O #${poNo} [Lorry ${newReceivedLorriesCount}/${contractLorries}]! Updated Final Arrival, Temporary Arrival & Mill Inspection.`
      );

      // Reset modal state
      setSelectedArrivalForBind(null);
      setChosenPoForBind(null);
      setRemarks('');
      setShowAllPOsInModal(false);
      setModalPoSearch('');

      // Reload data so multi-lorry P.O remains visible if newReceivedLorriesCount < contractLorries
      await loadInitialData();

      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      console.error('Error executing voucher binding:', err);
      alert(`Failed to execute binding: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete pairing record from database
  const deleteClubItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this manual clubbing record from history?')) return;
    try {
      await dbModule.delete('clubbed_pomr', 'club_id', id).catch(() => {});
      await dbModule.delete('clubbed_pomr', 'id', id).catch(() => {});
      setClubbingHistory(prev => prev.filter(c => c.id !== id));
      setSuccessToast(`History record #${id} removed.`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      console.error('Delete pairing error:', err);
      alert('Failed to delete pairing record: ' + (err.message || err));
    }
  };

  // Filtered list inside Binding Modal based on Broker, Area, and Modal Search
  const getMatchingPOsForModal = () => {
    if (!selectedArrivalForBind) return [];

    const arrBroker = normalize(selectedArrivalForBind.broker || selectedArrivalForBind.broker_name);
    const arrArea = normalize(
      selectedArrivalForBind.area ||
        selectedArrivalForBind.arrival_area_name ||
        selectedArrivalForBind.arrival_area ||
        selectedArrivalForBind.arrival_yard
    );

    const baseList = showAllPOsInModal
      ? unboundPOs
      : unboundPOs.filter(po => {
          const poBroker = normalize(po.broker || po.broker_name);
          const poArea = normalize(
            po.area || po.arrival_area_name || po.arrival_yard || po.area_name
          );

          const brokerMatch =
            !arrBroker || arrBroker === 'N/A' || !poBroker || poBroker === 'N/A' || poBroker === arrBroker;
          const areaMatch =
            !arrArea || arrArea === 'N/A' || !poArea || poArea === 'N/A' || poArea === arrArea;

          return brokerMatch && areaMatch;
        });

    if (!modalPoSearch.trim()) return baseList;
    const q = modalPoSearch.toLowerCase().trim();
    return baseList.filter(
      po =>
        String(po.po_no || '').toLowerCase().includes(q) ||
        String(po.supplier || '').toLowerCase().includes(q) ||
        String(po.broker || '').toLowerCase().includes(q) ||
        String(po.area || '').toLowerCase().includes(q)
    );
  };

  // Filtered UI Search for Untagged Final Arrivals
  const filteredArrivals = unboundFinalArrivals.filter(fa => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(fa.final_arrival_no || fa.mr_no || '').toLowerCase().includes(q) ||
      String(fa.temporary_arrival_no || '').toLowerCase().includes(q) ||
      String(fa.supplier || '').toLowerCase().includes(q) ||
      String(fa.broker || '').toLowerCase().includes(q) ||
      String(fa.area || fa.arrival_area_name || '').toLowerCase().includes(q) ||
      String(fa.lorry_number || '').toLowerCase().includes(q) ||
      String(fa.challan_rr_no || '').toLowerCase().includes(q)
    );
  });

  // Filtered History list inside History Modal
  const filteredHistory = clubbingHistory.filter(item => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase().trim();
    return (
      item.id.toLowerCase().includes(q) ||
      item.mrNo.toLowerCase().includes(q) ||
      item.tempArrivalNo.toLowerCase().includes(q) ||
      item.poNo.toLowerCase().includes(q) ||
      item.supplier.toLowerCase().includes(q) ||
      item.broker.toLowerCase().includes(q) ||
      item.lorryNumber.toLowerCase().includes(q)
    );
  });

  return (
    <LegacyLayout
      title="Club P.O & Arrival Section"
      subtitle="Match & Bind Open Final Arrivals with Multi-Lorry Sauda Check Point & P.O Contracts"
      onClose={onClose}
    >
      <div className="space-y-4 max-w-full px-1 sm:px-4 text-left font-sans">
        {/* Top Control Header */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-3">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    LEVEL 4 AUTHORIZED
                  </span>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400">Binding Console</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    <span>Untagged Arrivals & P.O Matching Console</span>
                  </h2>

                  {/* History Button Beside Console Heading */}
                  <button
                    onClick={() => setShowHistoryModal(true)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    title="View Manually Clubbed P.O & MR History"
                  >
                    <History className="h-3.5 w-3.5 text-indigo-600" />
                    <span>History</span>
                    <span className="bg-indigo-700 text-white text-[9px] font-mono px-1.5 py-0.2 rounded-full">
                      {clubbingHistory.length}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              {/* Supplier Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Supplier:</span>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="bg-transparent text-[10.5px] font-black text-slate-800 uppercase focus:outline-none cursor-pointer"
                >
                  <option value="ALL">ALL SUPPLIERS</option>
                  {suppliers.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Search Box */}
              <div className="relative flex-1 md:w-64">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search MR No, Temp No, Lorry, Broker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-[11px] font-semibold pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              {/* Refresh Button */}
              <button
                onClick={loadInitialData}
                className="p-1.5 px-3 border border-slate-200 rounded-lg hover:bg-slate-100 transition cursor-pointer flex items-center gap-1 text-[10px] font-extrabold uppercase text-slate-700 bg-slate-50"
                title="Refresh Master Documents"
              >
                <RefreshCw className={cn('h-3.5 w-3.5 text-indigo-700', loading && 'animate-spin')} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Success Alert Toast */}
        {successToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs font-bold text-emerald-900 animate-in fade-in slide-in-from-top-2 duration-200">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 flex-shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Untagged Final Arrivals Workspace - SINGLE MR PER ROW */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-3">
          <div className="border-b border-slate-100 pb-2.5 flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Untagged Final Arrivals (Single MR View)
                </h3>
                <p className="text-[9.5px] font-semibold text-slate-400 uppercase">
                  Each lorry arrival (MR) is listed row-by-row • Bind with Open Multi-Lorry P.O / Sauda Contracts ({unboundPOs.length} Open P.Os Available)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {unboundPOs.length} Open P.Os
              </span>
              <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                {filteredArrivals.length} Untagged MRs
              </span>
            </div>
          </div>

          {/* Single-MR List Container */}
          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {filteredArrivals.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  No Untagged Final Arrival Records Found
                </p>
                <p className="text-[9.5px] font-semibold text-slate-400 mt-1">
                  All lorry final arrivals are bound with P.O contracts
                </p>
              </div>
            ) : (
              filteredArrivals.map((mr, idx) => {
                const faNo = mr.final_arrival_no || mr.mr_no || `FA-${idx + 1}`;
                const tempNo = mr.temporary_arrival_no || mr.arrival_no || mr.amad_no || faNo;
                const weightMt = getArrivalWeightMt(mr).toFixed(3);
                const packets = mr.total_packets || mr.packets || '0';
                const arrivalDate = mr.date || mr.final_arrival_date || mr.mr_date || 'N/A';
                const lorryNo = mr.lorry_number || mr.lorry_no || mr.vehicle_no || 'N/A';
                const challanNo = mr.challan_rr_no || mr.challan_no || 'N/A';

                return (
                  <div
                    key={faNo || idx}
                    className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/15 hover:shadow-sm bg-white transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                  >
                    {/* Col 1: MR / Final Arrival No, Temp Arrival No & Date */}
                    <div className="flex flex-wrap items-center gap-2.5 min-w-[240px]">
                      <div className="bg-indigo-950 text-white px-3 py-1.5 rounded-lg text-center min-w-[105px]">
                        <span className="text-[8px] font-bold uppercase text-indigo-300 block leading-none">
                          Final MR No
                        </span>
                        <span className="text-xs font-black font-mono tracking-wider block mt-0.5">
                          {faNo}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9.5px] font-extrabold font-mono text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Temp MR: {tempNo}
                          </span>
                          <span className="text-[9.5px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {arrivalDate}
                          </span>
                        </div>
                        <div className="text-[11px] font-black text-slate-900 uppercase">
                          Supplier: <span className="text-indigo-950">{mr.supplier || mr.challan_supplier || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Broker & Arrival Yard */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex-1 max-w-md">
                      <div>
                        <span className="text-[8px] font-extrabold text-slate-400 uppercase block">
                          Broker Name
                        </span>
                        <span className="text-[10.5px] text-slate-900 uppercase font-black truncate block">
                          {mr.broker || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-extrabold text-slate-400 uppercase block">
                          Arrival Area / Yard
                        </span>
                        <span className="text-[10.5px] text-indigo-900 uppercase font-black truncate block">
                          {mr.area || mr.arrival_area_name || mr.arrival_area || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Col 3: Lorry, Challan & Weight */}
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="text-left">
                        <div className="text-[10px] font-black text-slate-800 uppercase flex items-center gap-1">
                          <Truck className="h-3.5 w-3.5 text-slate-500" />
                          <span>{lorryNo}</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">
                          Challan: {challanNo}
                        </span>
                      </div>

                      <div className="text-right bg-emerald-50/70 border border-emerald-200 px-3 py-1 rounded-lg min-w-[100px]">
                        <span className="text-xs font-black text-emerald-950 block font-mono">
                          {weightMt} MT
                        </span>
                        <span className="text-[8.5px] font-bold text-emerald-700 uppercase flex items-center justify-end gap-1">
                          <Package className="h-2.5 w-2.5" />
                          {packets} Bales
                        </span>
                      </div>
                    </div>

                    {/* Col 4: Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <button
                        onClick={() => setSelectedDetailMr(mr)}
                        className="px-3 py-1.5 text-[9.5px] font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 uppercase transition cursor-pointer"
                      >
                        Details
                      </button>

                      <button
                        onClick={() => {
                          setSelectedArrivalForBind(mr);
                          setChosenPoForBind(null);
                          setShowAllPOsInModal(false);
                          setModalPoSearch('');
                        }}
                        className="px-4 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-black text-[10px] uppercase tracking-wider rounded-lg shadow-xs hover:shadow transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Bind P.O / PTF</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ===========================================================================
          MODAL 1: MANUAL CLUBBING HISTORY (Triggered by "History" Button in Header)
         =========================================================================== */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-indigo-200 w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col font-sans overflow-hidden max-h-[92vh] animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-indigo-950 text-white p-4 px-6 flex justify-between items-center border-b border-indigo-900">
              <div className="flex items-center gap-2.5">
                <History className="h-5 w-5 text-indigo-300" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Manual Clubbed P.O & MR History (`clubbed_pomr`)
                  </h3>
                  <p className="text-[9.5px] text-indigo-200 font-mono uppercase tracking-tight mt-0.5">
                    Showing only records manually clubbed in this console ({filteredHistory.length} records)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    const csvContent =
                      'data:text/csv;charset=utf-8,' +
                      [
                        'Club ID,Date,Final MR No,Temp Arrival No,P.O / Sauda No,P.O Date,Supplier,Broker,Area,Lorry No,Lorry Progress,PO Weight (MT),MR Weight (MT),Variance %,Remarks'
                      ]
                        .concat(
                          filteredHistory.map(
                            c =>
                              `"${c.id}","${c.clubbedAt}","${c.finalArrivalNo}","${c.tempArrivalNo}","${c.poNo}","${c.poDate}","${c.supplier}","${c.broker}","${c.area}","${c.lorryNumber}","${c.receivedLorriesCount}/${c.totalPoLorries}","${c.totalPoWeight}","${c.totalReceivedWeight}","${c.variancePct.toFixed(2)}","${(c.remarks || '').replace(/"/g, '""')}"`
                          )
                        )
                        .join('\n');
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement('a');
                    link.setAttribute('href', encodedUri);
                    link.setAttribute(
                      'download',
                      `BJCL-Manual-Clubbed-POMR-History-${new Date().toISOString().split('T')[0]}.csv`
                    );
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 border border-indigo-700 rounded-lg text-[10px] font-extrabold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-indigo-900/50 rounded-lg transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Search Toolbar inside History Modal */}
            <div className="p-3 px-6 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search History by MR No, Temp No, P.O No, Supplier, Lorry..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full text-xs font-semibold pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <span className="text-[10px] font-extrabold uppercase text-slate-500">
                Supabase Table: <code className="text-indigo-700 font-mono">clubbed_pomr</code>
              </span>
            </div>

            {/* History Table */}
            <div className="p-4 px-6 overflow-y-auto flex-1">
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[9.5px] font-black uppercase text-slate-600 border-b border-slate-200">
                      <th className="p-2.5">Club ID</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Final MR No</th>
                      <th className="p-2.5">Temp Arrival No</th>
                      <th className="p-2.5">Bound P.O / Sauda No</th>
                      <th className="p-2.5">Supplier & Broker</th>
                      <th className="p-2.5">Lorry & Yard</th>
                      <th className="p-2.5 text-center">Lorry Count</th>
                      <th className="p-2.5 text-right">PO WT</th>
                      <th className="p-2.5 text-right">MR WT</th>
                      <th className="p-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td
                          colSpan={11}
                          className="p-10 text-center text-slate-400 uppercase tracking-wider font-extrabold text-[11px]"
                        >
                          No manual clubbing records saved yet
                        </td>
                      </tr>
                    ) : (
                      filteredHistory
                        .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                        .map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-slate-100 hover:bg-slate-50 transition text-slate-800"
                          >
                            <td className="p-2.5 font-black font-mono text-[10.5px] text-slate-900">
                              {item.id}
                            </td>
                            <td className="p-2.5 font-mono text-[10.5px] text-slate-600">
                              {item.clubbedAt}
                            </td>
                            <td className="p-2.5">
                              <span className="text-[10px] font-black font-mono bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded">
                                {item.finalArrivalNo}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <span className="text-[10px] font-black font-mono bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded">
                                {item.tempArrivalNo}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <span className="text-[10px] font-black font-mono bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded">
                                {item.poNo}
                              </span>
                              {item.poDate && (
                                <span className="block text-[8.5px] font-bold text-slate-400 mt-0.5">
                                  PO Date: {item.poDate}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <div className="font-black text-[10.5px] uppercase text-slate-900">
                                {item.supplier}
                              </div>
                              <div className="text-[9px] font-bold text-slate-500 uppercase">
                                Broker: {item.broker}
                              </div>
                            </td>
                            <td className="p-2.5">
                              <div className="font-mono font-bold text-[10px] text-slate-800">
                                {item.lorryNumber}
                              </div>
                              <div className="text-[9px] font-bold text-indigo-700 uppercase">
                                {item.area}
                              </div>
                            </td>
                            <td className="p-2.5 text-center">
                              <span className="text-[9.5px] font-black font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                                {item.receivedLorriesCount}/{item.totalPoLorries}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-mono font-semibold text-[10.5px]">
                              {item.totalPoWeight.toFixed(2)} MT
                            </td>
                            <td className="p-2.5 text-right font-mono font-black text-slate-900 text-[10.5px]">
                              {item.totalReceivedWeight.toFixed(2)} MT
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex justify-center gap-1.5">
                                <button
                                  onClick={() => setPrintingClub(item)}
                                  className="p-1.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 rounded transition cursor-pointer"
                                  title="Print binding receipt"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteClubItem(item.id)}
                                  className="p-1.5 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-700 rounded transition cursor-pointer"
                                  title="Delete history record"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3">
                <PaginationControls
                  currentPage={currentPage}
                  totalItems={filteredHistory.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-3.5 px-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[10px] tracking-wider rounded-lg transition cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===========================================================================
          MODAL 2: SELECT P.O / PTF TO BIND (Supports Multi-Lorry Sauda / P.O)
         =========================================================================== */}
      {selectedArrivalForBind && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-indigo-200 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col font-sans overflow-hidden max-h-[92vh] animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-indigo-950 text-white p-4 flex justify-between items-center px-6 border-b border-indigo-900">
              <div className="flex items-center gap-2.5">
                <Link className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Select Open P.O / Sauda Contract for Binding
                  </h3>
                  <p className="text-[9.5px] text-indigo-200 font-mono uppercase tracking-tight mt-0.5">
                    Multi-Lorry Sauda Contracts Remain Open Until All Lorries Are Tagged • Updates Final Arrival, Temporary Arrival & Mill Inspection
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedArrivalForBind(null);
                  setChosenPoForBind(null);
                }}
                className="p-1 text-slate-300 hover:text-white hover:bg-indigo-900/50 rounded-lg transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-800 bg-slate-50/50">
              {/* Selected Final Arrival Header Card */}
              <div className="bg-white border-2 border-indigo-100 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap justify-between items-center border-b border-indigo-50 pb-2 gap-2">
                  <span className="text-[9.5px] font-black uppercase tracking-widest text-indigo-600">
                    Selected Final Arrival Lorry (MR)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-mono font-black text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      Final MR No: {selectedArrivalForBind.final_arrival_no || selectedArrivalForBind.mr_no}
                    </span>
                    <span className="text-[10.5px] font-mono font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Temp Arrival No: {selectedArrivalForBind.temporary_arrival_no || selectedArrivalForBind.arrival_no || selectedArrivalForBind.final_arrival_no}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-left">
                  <div>
                    <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Supplier</span>
                    <strong className="text-slate-900 uppercase text-[11px] block mt-0.5">
                      {selectedArrivalForBind.supplier || selectedArrivalForBind.challan_supplier || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Broker Name</span>
                    <strong className="text-indigo-900 uppercase text-[11px] block mt-0.5 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 inline-block">
                      {selectedArrivalForBind.broker || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Arrival Yard</span>
                    <strong className="text-indigo-900 uppercase text-[11px] block mt-0.5 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 inline-block">
                      {selectedArrivalForBind.area || selectedArrivalForBind.arrival_area_name || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Lorry No</span>
                    <strong className="text-slate-900 font-mono text-[11px] block mt-0.5">
                      {selectedArrivalForBind.lorry_number || selectedArrivalForBind.lorry_no || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Net Weight</span>
                    <strong className="text-emerald-800 font-mono text-xs block mt-0.5">
                      {getArrivalWeightMt(selectedArrivalForBind).toFixed(3)} MT
                    </strong>
                  </div>
                </div>
              </div>

              {/* Matching Criteria & Search Bar inside Modal */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-indigo-50/80 border border-indigo-200 p-3 rounded-xl">
                <div className="text-[10.5px] font-bold text-indigo-950">
                  {showAllPOsInModal ? (
                    <span>Showing <strong>All Open P.O / Sauda Contracts</strong> with remaining lorries</span>
                  ) : (
                    <span>
                      Matching Broker: <span className="font-black underline">{selectedArrivalForBind.broker || 'ANY'}</span> & Yard:{' '}
                      <span className="font-black underline">
                        {selectedArrivalForBind.area || selectedArrivalForBind.arrival_area_name || 'ANY'}
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-52">
                    <Search className="h-3 w-3 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Search P.O No (e.g. 0660)..."
                      value={modalPoSearch}
                      onChange={(e) => setModalPoSearch(e.target.value)}
                      className="w-full text-[10.5px] font-semibold pl-7 pr-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    onClick={() => setShowAllPOsInModal(!showAllPOsInModal)}
                    className="text-[9.5px] font-extrabold text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 uppercase cursor-pointer whitespace-nowrap"
                  >
                    {showAllPOsInModal ? 'Filter by Broker/Yard' : 'Show All Open P.Os'}
                  </button>
                </div>
              </div>

              {/* Matching Open P.O List */}
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Select One Open P.O / Sauda Contract To Bind:
                </h4>

                {(() => {
                  const matchingPOs = getMatchingPOsForModal();

                  if (matchingPOs.length === 0) {
                    return (
                      <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-200 space-y-2">
                        <p className="text-[11px] font-black text-rose-600 uppercase">
                          No Open P.O / Sauda Contracts Match Criteria
                        </p>
                        <p className="text-[10px] text-slate-500 font-semibold">
                          Broker "{selectedArrivalForBind.broker || 'N/A'}" and Area "{selectedArrivalForBind.area || selectedArrivalForBind.arrival_area_name || 'N/A'}"
                        </p>
                        {!showAllPOsInModal && (
                          <button
                            onClick={() => setShowAllPOsInModal(true)}
                            className="mt-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold text-[10px] uppercase rounded-lg hover:bg-indigo-100 transition cursor-pointer"
                          >
                            View All Open P.O Contracts ({unboundPOs.length})
                          </button>
                        )}
                      </div>
                    );
                  }

                  return matchingPOs.map((po, idx) => {
                    const poNo = po.po_no;
                    const isSelected = chosenPoForBind?.po_no === poNo;
                    const contractLorries = po.contract_lorries || 1;
                    const receivedLorries = po.received_lorries || 0;
                    const remainingLorries = po.remaining_lorries ?? Math.max(0, contractLorries - receivedLorries);

                    return (
                      <div
                        key={poNo || idx}
                        onClick={() => setChosenPoForBind(po)}
                        className={cn(
                          'p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center gap-3',
                          isSelected
                            ? 'bg-indigo-950 text-white border-indigo-950 shadow-md'
                            : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20'
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'text-xs font-black font-mono',
                                isSelected ? 'text-indigo-200' : 'text-indigo-950'
                              )}
                            >
                              P.O / Sauda: {poNo}
                            </span>
                            <span
                              className={cn(
                                'text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded',
                                isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              Date: {po.po_date || po.date || po.sauda_date || 'N/A'}
                            </span>
                            {/* Lorry Progress Badge (e.g. OPEN 3/6 Lorries) */}
                            <span
                              className={cn(
                                'text-[9px] font-black uppercase px-2 py-0.5 rounded border font-mono',
                                isSelected
                                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              )}
                            >
                              OPEN ({receivedLorries}/{contractLorries} Lorries) • {remainingLorries} Left
                            </span>
                          </div>

                          <p
                            className={cn(
                              'text-[10.5px] font-bold uppercase',
                              isSelected ? 'text-slate-200' : 'text-slate-800'
                            )}
                          >
                            Supplier: {po.supplier || 'N/A'}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-[9.5px] font-semibold opacity-90 pt-0.5">
                            <span>
                              Broker: <strong>{po.broker || 'N/A'}</strong>
                            </span>
                            <span>
                              Yard: <strong>{po.area || 'N/A'}</strong>
                            </span>
                            {po.linked_mr_nos && po.linked_mr_nos.length > 0 && (
                              <span>
                                Tagged MRs: <strong className="font-mono">{po.linked_mr_nos.join(', ')}</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right flex sm:flex-col items-center sm:items-end justify-between gap-1.5">
                          <div>
                            <span
                              className={cn(
                                'text-xs font-black font-mono block',
                                isSelected ? 'text-white' : 'text-slate-900'
                              )}
                            >
                              {Number(po.received_weight_mt || 0).toFixed(2)} /{' '}
                              {Number(po.total_contract_mt || 0).toFixed(2)} MT
                            </span>
                            <span
                              className={cn(
                                'text-[8.5px] font-bold uppercase block',
                                isSelected ? 'text-indigo-200' : 'text-slate-400'
                              )}
                            >
                              Received / Contract WT
                            </span>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setChosenPoForBind(po);
                            }}
                            className={cn(
                              'px-3 py-1 text-[9.5px] font-black uppercase rounded-lg transition border cursor-pointer',
                              isSelected
                                ? 'bg-emerald-500 text-white border-emerald-400'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                            )}
                          >
                            {isSelected ? '✓ Selected' : 'Select P.O'}
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Remarks Box */}
              <div className="space-y-1 pt-1">
                <label className="text-[9.5px] font-extrabold uppercase text-slate-500 block">
                  Binding Sign-off Remarks:
                </label>
                <input
                  type="text"
                  placeholder="Enter optional binding comments..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 px-6 border-t border-slate-200 flex justify-between items-center gap-3">
              <button
                onClick={() => {
                  setSelectedArrivalForBind(null);
                  setChosenPoForBind(null);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-extrabold uppercase text-[10px] tracking-wider rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmBinding}
                disabled={!chosenPoForBind || loading}
                className={cn(
                  'px-6 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-black uppercase text-[10.5px] tracking-wider rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer',
                  (!chosenPoForBind || loading) && 'opacity-50 cursor-not-allowed hover:bg-indigo-700'
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm & Bind (Update Final Arrival, Temp Arrival & Mill Inspection)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal for Selected Final Arrival */}
      {selectedDetailMr && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 w-full max-w-3xl rounded-xl shadow-2xl flex flex-col font-sans overflow-hidden max-h-[92vh] animate-in fade-in zoom-in duration-150">
            <div className="bg-slate-900 text-white p-3.5 flex justify-between items-center px-5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="h-[18px] w-[18px] text-teal-400" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider">Final Arrival Details</h3>
                  <p className="text-[9px] font-mono opacity-65 uppercase mt-0.5">
                    Final MR No: {selectedDetailMr.final_arrival_no || selectedDetailMr.mr_no} • Temp Arrival No:{' '}
                    {selectedDetailMr.temporary_arrival_no || selectedDetailMr.arrival_no || 'N/A'}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedDetailMr(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-800 bg-slate-50/50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Final Arrival No</span>
                  <span className="font-mono font-black text-sm text-slate-900">
                    {selectedDetailMr.final_arrival_no || selectedDetailMr.mr_no || 'N/A'}
                  </span>
                </div>
                <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Temp Arrival No</span>
                  <span className="font-mono font-black text-xs text-amber-800">
                    {selectedDetailMr.temporary_arrival_no || selectedDetailMr.arrival_no || 'N/A'}
                  </span>
                </div>
                <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Net Weight</span>
                  <span className="font-mono font-black text-xs text-indigo-700">
                    {getArrivalWeightMt(selectedDetailMr).toFixed(3)} MT
                  </span>
                </div>
                <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Packets / Bales</span>
                  <span className="font-mono font-black text-xs text-emerald-700">
                    {selectedDetailMr.total_packets || selectedDetailMr.packets || '0'}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                <h4 className="text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 pb-1">
                  Supplier & Logistics Identification
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[8.5px] font-extrabold text-slate-400 uppercase block">Supplier Name</span>
                    <strong className="uppercase text-slate-900 text-xs block">
                      {selectedDetailMr.supplier || selectedDetailMr.challan_supplier || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-extrabold text-slate-400 uppercase block">Broker Name</span>
                    <strong className="uppercase text-slate-900 text-xs block">
                      {selectedDetailMr.broker || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-extrabold text-slate-400 uppercase block">Arrival Yard</span>
                    <strong className="uppercase text-indigo-900 text-xs block">
                      {selectedDetailMr.area || selectedDetailMr.arrival_area_name || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-extrabold text-slate-400 uppercase block">Vehicle / Lorry</span>
                    <strong className="uppercase text-slate-900 text-xs block">
                      {selectedDetailMr.lorry_number || selectedDetailMr.lorry_no || selectedDetailMr.vehicle_no || 'N/A'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 px-5 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedArrivalForBind(selectedDetailMr);
                  setSelectedDetailMr(null);
                }}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-black uppercase text-[10px] tracking-wider rounded-lg transition cursor-pointer"
              >
                Bind This Arrival
              </button>
              <button
                onClick={() => setSelectedDetailMr(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold uppercase text-[10px] tracking-wider rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Audit Modal */}
      {printingClub && (
        <PrintModal
          isOpen={!!printingClub}
          onClose={() => setPrintingClub(null)}
          title={`Binding Statement: ${printingClub.id}`}
        >
          <div className="p-5 space-y-4 text-xs" id="printable-binding-receipt">
            <div className="text-center border-b border-slate-200 pb-3">
              <h2 className="text-sm font-black uppercase text-slate-900">BALLY JUTE COMPANY LIMITED</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                MANUAL P.O & MR ASSOCIATION REPORT
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3 text-slate-700">
              <div>
                <p>
                  <span className="font-extrabold uppercase text-[9px] text-slate-400 block tracking-wider">
                    BINDING REFERENCE ID
                  </span>{' '}
                  <strong>{printingClub.id}</strong>
                </p>
                <p className="mt-2">
                  <span className="font-extrabold uppercase text-[9px] text-slate-400 block tracking-wider">
                    DATE ESTABLISHED
                  </span>{' '}
                  {printingClub.clubbedAt}
                </p>
              </div>
              <div className="text-right">
                <p>
                  <span className="font-extrabold uppercase text-[9px] text-slate-400 block tracking-wider">
                    SUPPLIER ACCOUNT
                  </span>{' '}
                  <strong className="uppercase text-[11px] text-slate-900">{printingClub.supplier}</strong>
                </p>
                <p className="mt-2">
                  <span className="font-extrabold uppercase text-[9px] text-slate-400 block tracking-wider">
                    AUDITED BY
                  </span>{' '}
                  {printingClub.recordedBy}
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-extrabold uppercase text-[9px] text-slate-400 tracking-wider mb-2">
                Mapped Vouchers Inventory
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50/50">
                  <span className="font-bold text-[9px] text-slate-450 block uppercase">P.O / Sauda Contract</span>
                  <p className="font-mono mt-1 font-semibold text-slate-800">{printingClub.poNo}</p>
                </div>
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50/50">
                  <span className="font-bold text-[9px] text-slate-450 block uppercase">Final Arrival MR</span>
                  <p className="font-mono mt-1 font-semibold text-slate-800">{printingClub.finalArrivalNo}</p>
                </div>
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50/50">
                  <span className="font-bold text-[9px] text-slate-450 block uppercase">Temporary Arrival MR</span>
                  <p className="font-mono mt-1 font-semibold text-slate-800">{printingClub.tempArrivalNo}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-b border-slate-200 py-3 mt-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase block">PO Contract WT</span>
                  <span className="text-xs font-black text-slate-800 block mt-0.5">
                    {printingClub.totalPoWeight.toFixed(2)} MT
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Arrival Gate WT</span>
                  <span className="text-xs font-black text-slate-800 block mt-0.5">
                    {printingClub.totalReceivedWeight.toFixed(2)} MT
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Lorry Progress</span>
                  <span className="text-xs font-black text-indigo-700 block mt-0.5">
                    {printingClub.receivedLorriesCount}/{printingClub.totalPoLorries} Lorries
                  </span>
                </div>
              </div>
            </div>

            {printingClub.remarks && (
              <div className="bg-slate-50 p-2.5 border border-slate-150 rounded">
                <span className="font-extrabold text-[8.5px] text-slate-400 block uppercase">Remarks</span>
                <p className="italic text-slate-600 mt-1 font-semibold">"{printingClub.remarks}"</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-8 text-[9px] text-slate-400 uppercase font-bold tracking-widest">
              <span>Sign (Authorized Jute Mill Executive)</span>
              <span>Sign (Audit Desk)</span>
            </div>
          </div>
        </PrintModal>
      )}
    </LegacyLayout>
  );
}
