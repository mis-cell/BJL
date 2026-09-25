import { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { dbModule } from '../../services/dbModule';
import { supabase } from '../../lib/supabase';
import { sanitizeCsvData } from '../../lib/utils';
import { calculateWeightTolerance } from '../../lib/weightTolerance';
import { comparePoInspection, compareSaudaTempArrival, PoMatchResult } from '../../lib/poMatch';
import { useLiveAutoRefresh } from '../../hooks/useLiveAutoRefresh';

interface UsePurchaseOrderDataOptions {
  isTempPo: boolean;
  isArchiveView: boolean;
  selectedYear?: string;
}

export function usePurchaseOrderData({
  isTempPo,
  isArchiveView,
  selectedYear
}: UsePurchaseOrderDataOptions) {
  const MASTER_TABLE = isArchiveView ? 'p.o_archive' : (isTempPo ? 'sauda_check_point' : 'purchase_master');
  const DETAIL_TABLE = isArchiveView ? 'po_archive' : (isTempPo ? 'sauda_check_point_details' : 'purchase_detail_master');

  const [loading, setLoading] = useState(false);
  const [poList, setPoList] = useState<any[]>([]);
  const [brokerList, setBrokerList] = useState<any[]>([]);
  const [supplierList, setSupplierList] = useState<any[]>([]);
  const [areaList, setAreaList] = useState<any[]>([]);
  const [saudaList, setSaudaList] = useState<any[]>([]);
  const [gradeList, setGradeList] = useState<any[]>([]);
  const [markaList, setMarkaList] = useState<any[]>([]);
  const [agencyList, setAgencyList] = useState<any[]>([]);
  const [unitList, setUnitList] = useState<string[]>(['DRUMS', 'BALES', 'LOOSE', 'P.BALES', 'H.BALES']);

  // Satta Chart Cache States
  const [sattaBaseRates, setSattaBaseRates] = useState<any[]>([]);
  const [sattaCalculatedRates, setSattaCalculatedRates] = useState<any[]>([]);
  const [sattaDifferentials, setSattaDifferentials] = useState<any[]>([]);

  // Cross-table linked operational data
  const [allScpDetails, setAllScpDetails] = useState<any[]>([]);
  const [sattaCalcs, setSattaCalcs] = useState<any[]>([]);
  const [sattaBases, setSattaBases] = useState<any[]>([]);
  const [allTempArrivals, setAllTempArrivals] = useState<any[]>([]);
  const [allFinalArrivals, setAllFinalArrivals] = useState<any[]>([]);
  const [allInspections, setAllInspections] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [allSettlements, setAllSettlements] = useState<any[]>([]);
  const [settledDeductions, setSettledDeductions] = useState<Record<string, any>>({});

  // Match results & DB mismatch cache
  const [matchResults, setMatchResults] = useState<Record<string, PoMatchResult>>({});
  const [dbMaterialMismatches, setDbMaterialMismatches] = useState<any[]>([]);
  const [dbSattaMismatches, setDbSattaMismatches] = useState<any[]>([]);

  // Filter temp POs from Final view
  const [tempPoNoSet, setTempPoNoSet] = useState<Set<string>>(new Set());

  // Load Unit master
  useEffect(() => {
    async function loadUnits() {
      try {
        if (supabase) {
          const { data } = await supabase.from('unit_master').select('unit_name').order('unit_name');
          if (data && data.length > 0) {
            const fetched = data.map((u: any) => u.unit_name).filter(Boolean);
            setUnitList(prev => Array.from(new Set([...fetched, ...prev])));
          }
        }
      } catch (err) {
        console.warn('Failed to load unit_master in PurchaseOrder', err);
      }
    }
    loadUnits();
  }, []);

  // Sync tempPoNoSet
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isTempPo || !supabase) { setTempPoNoSet(new Set()); return; }
      try {
        const { data } = await supabase.from('sauda_check_point').select('po_no');
        if (!cancelled) setTempPoNoSet(new Set((data || []).map((r: any) => String(r.po_no || '').trim().toUpperCase())));
      } catch (_e) { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [isTempPo, poList]);

  function isPoMismatchResolved(poOrItem: any): boolean {
    if (!poOrItem) return false;
    const item = typeof poOrItem === 'object' 
      ? poOrItem 
      : poList.find((p: any) => String(p.po_no || p.contract_po_no || '').trim().toUpperCase() === String(poOrItem).trim().toUpperCase()) || { po_no: String(poOrItem) };
    
    const poNo = String(item.po_no || '').trim().toUpperCase();
    const contractPoNo = String(item.contract_po_no || '').trim().toUpperCase();
    const saudaNo = String(item.sauda_no || item.po_contract || item.contract_no || '').trim().toUpperCase();
    const ptfNo = String(item.ptf_no || '').trim().toUpperCase();
    
    const poSuffix = poNo.split('/').pop() || '';
    const saudaSuffix = saudaNo.split('/').pop() || '';
    const tokens = [poNo, contractPoNo, saudaNo, ptfNo, poSuffix, saudaSuffix].filter(t => t && t !== 'N/A' && t !== 'UNDEFINED');

    // 1. Direct record flags on item
    if (
      item.pass_status === 'pass' ||
      item.is_pass === true ||
      item.mismatch_cleared === true || 
      item.mismatch_cleared === 'true' || 
      item.satta_dispute_approved === true || 
      item.satta_dispute_approved === 'true' ||
      item.status === 'resolved' ||
      item.status === 'cleared' ||
      item.status === 'final' ||
      item.status === 'approved' ||
      item.status === 'moved_to_final' ||
      item.is_resolved === true ||
      item.is_mismatch_resolved === true
    ) {
      return true;
    }

    // 2. Check localStorage tokens
    for (const token of tokens) {
      const tu = token.toUpperCase();
      const matCache = localStorage.getItem(`material_resolved_${tu}`);
      const satCache = localStorage.getItem(`satta_resolved_${tu}`);
      const misCache = localStorage.getItem(`material_resolved_MIS-${tu}`);
      const genCache = localStorage.getItem(`mismatch_resolved_${tu}`);
      const clrCache = localStorage.getItem(`mismatch_cleared_${tu}`);
      const passCache = localStorage.getItem(`pass_status_${tu}`);
      const saudaClrCache = localStorage.getItem(`sauda_resolved_${tu}`);
      if (matCache || satCache || misCache || genCache || clrCache || passCache || saudaClrCache) {
        return true;
      }
    }

    // 3. Check dbMaterialMismatches
    const hasMaterialResolved = dbMaterialMismatches.some((m: any) => {
      const mPo = String(m.po_no || '').trim().toUpperCase();
      const mId = String(m.mismatch_id || m.id || '').toUpperCase();
      const st = String(m.status || m.resolution_status || '').toLowerCase();
      const isResolvedStatus = st === 'resolved' || st === 'approved' || st === 'cleared' || Boolean(m.approved_by) || String(m.remarks || '').toUpperCase().includes('APPROVED');
      if (!isResolvedStatus) return false;
      
      return tokens.some(t => {
        const tu = t.toUpperCase();
        return (mPo && (mPo === tu || mPo.includes(tu) || tu.includes(mPo))) ||
               (mId && (mId === `MIS-${tu}` || mId.includes(tu)));
      });
    });
    if (hasMaterialResolved) return true;

    // 4. Check dbSattaMismatches
    const hasSattaResolved = dbSattaMismatches.some((s: any) => {
      const sPo = String(s.po_no || '').trim().toUpperCase();
      const sSauda = String(s.sauda_no || '').trim().toUpperCase();
      const sId = String(s.mismatch_id || s.id || '').toUpperCase();
      const st = String(s.status || s.resolution_status || '').toLowerCase();
      const isResolvedStatus = st === 'resolved' || st === 'approved' || st === 'cleared' || Boolean(s.approved_by) || String(s.remarks || '').toUpperCase().includes('APPROVED');
      if (!isResolvedStatus) return false;

      return tokens.some(t => {
        const tu = t.toUpperCase();
        return (sPo && (sPo === tu || sPo.includes(tu) || tu.includes(sPo))) ||
               (sSauda && (sSauda === tu || sSauda.includes(tu) || tu.includes(sSauda))) ||
               (sId && (sId === `SAT-${tu}` || sId.includes(tu)));
      });
    });
    if (hasSattaResolved) return true;

    return false;
  }

  // Header-level match against Material Inspection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || poList.length === 0) {
        setMatchResults({});
        return;
      }
      try {
        const [matInspRes, detailsRes] = await Promise.all([
          supabase.from('material_inspection').select('*').then(r => r, () => ({ data: [] as any[] })),
          supabase.from('sauda_check_point_details').select('*').then(r => r, () => ({ data: [] as any[] })),
        ]);

        const inspList = (matInspRes as any)?.data || [];
        const detailsList = (detailsRes as any)?.data || [];

        const clean = (v: any) => String(v ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
        const results: Record<string, PoMatchResult> = {};

        for (const po of poList) {
          const poNoClean = clean(po.po_no || po.contract_po_no || po.ptf_no);
          const matchInsp = inspList.find((i: any) => {
            const inspPoClean = clean(i.po_no);
            const inspMillPoClean = clean(i.mill_po_no);
            const inspPtfClean = clean(i.ptf_no);
            return (
              (inspPoClean && inspPoClean === poNoClean) || 
              (inspMillPoClean && inspMillPoClean === poNoClean) ||
              (inspPtfClean && inspPtfClean === poNoClean) ||
              (po.ptf_no && clean(po.ptf_no) && clean(po.ptf_no) === inspPoClean) ||
              (po.po_no && clean(po.po_no) && clean(po.po_no) === inspPoClean)
            );
          });
          const poDetails = detailsList.filter((d: any) => d.po_no && clean(d.po_no) === poNoClean);
          const allReceipts = inspList.filter((i: any) => {
            const inspPoClean = clean(i.po_no);
            const inspMillPoClean = clean(i.mill_po_no);
            const inspPtfClean = clean(i.ptf_no);
            return (
              (inspPoClean && inspPoClean === poNoClean) || 
              (inspMillPoClean && inspMillPoClean === poNoClean) ||
              (inspPtfClean && inspPtfClean === poNoClean)
            );
          });

          const res = comparePoInspection(po, poDetails, matchInsp || null, allReceipts);
          if (isPoMismatchResolved(po)) {
            res.status = 'match';
            res.mismatches = [];
          }
          if (po.po_no) results[po.po_no] = res;
          if (po.contract_po_no) results[po.contract_po_no] = res;
          if (po.ptf_no) results[po.ptf_no] = res;
        }
        if (!cancelled) setMatchResults(results);
      } catch (_e) {
        /* inspection match is non-fatal */
      }
    })();
    return () => { cancelled = true; };
  }, [poList, isTempPo]);

  // Fetch all registered records and masters
  const fetchPosAndMasters = useCallback(async () => {
    setLoading(true);
    const safeFetch = (table: string, orderBy?: string, ascending = false) => {
      return dbModule.fetchAll(table, orderBy, ascending).catch(err => {
        console.warn(`Failed to fetch ${table}:`, err);
        return [];
      });
    };

    const safeSupabaseSelect = async (table: string, orderCol?: string, ascending = false) => {
      if (!supabase) return { data: [] };
      try {
        let q = supabase.from(table).select('*');
        if (orderCol) {
          q = q.order(orderCol, { ascending });
        }
        const res = await q;
        if (res.error) {
          console.warn(`Supabase error on ${table}:`, res.error);
          return { data: [] };
        }
        return res || { data: [] };
      } catch (err) {
        console.warn(`Supabase failed on ${table}:`, err);
        return { data: [] };
      }
    };

    try {
      let initialPos = await safeFetch(MASTER_TABLE, 'created_at', false);
      if (isArchiveView && (!initialPos || initialPos.length === 0)) {
        const altPos = await safeFetch('po_archive', 'created_at', false);
        if (altPos && altPos.length > 0) {
          initialPos = altPos;
        } else {
          const rawActive = await safeFetch('purchase_master', 'created_at', false);
          initialPos = (rawActive || []).filter((r: any) => r.status === 'settled' || !!r.archived_at);
        }
      }

      const [
        brokers, 
        suppliers, 
        areas, 
        saudas, 
        grades, 
        markas, 
        agencies, 
        arrivals, 
        finalArrivals, 
        inspections, 
        matInspections,
        sattaBasesRes, 
        sattaCalculatedRes, 
        sattaDiffsRes,
        matMismatchesRes,
        satMismatchesRes,
        dbMatMismatches,
        dbSatMismatches,
        scpDeductions,
        payments,
        mrSettlementsRes,
        mrSettlementAltRes
      ] = await Promise.all([
        safeFetch('broker_master'),
        safeFetch('supply_master'),
        safeFetch('area_master'),
        safeFetch('sauda_master', 'created_at', false),
        safeFetch('grade_master'),
        safeFetch('marka_master'),
        safeFetch('agency_master'),
        safeFetch('temporary_material_received', 'created_at', false),
        safeFetch('final_arrival', 'created_at', false),
        safeFetch('mill_inspection_master', 'created_at', false),
        safeFetch('material_inspection', 'created_at', false),
        safeSupabaseSelect('satta_base_rates', 'start_date', false),
        safeSupabaseSelect('satta_calculated_rates'),
        safeSupabaseSelect('satta_differentials'),
        safeSupabaseSelect('material_mismatch'),
        safeSupabaseSelect('satta_mismatch'),
        safeFetch('material_mismatch'),
        safeFetch('satta_mismatch'),
        safeFetch('sauda_check_point_deductions'),
        safeFetch('payment_master', 'created_at', false),
        safeFetch('mr_settlement_master', 'created_at', false),
        safeFetch('m_r_settlement', 'created_at', false)
      ]);

      const combinedMatMismatches = [...((matMismatchesRes as any)?.data || []), ...(dbMatMismatches || [])];
      const combinedSatMismatches = [...((satMismatchesRes as any)?.data || []), ...(dbSatMismatches || [])];
      const combinedSettlements = [...(mrSettlementsRes || []), ...(mrSettlementAltRes || [])];
      setDbMaterialMismatches(combinedMatMismatches);
      setDbSattaMismatches(combinedSatMismatches);
      setSattaBases((sattaBasesRes as any)?.data || sattaBasesRes || []);
      setSattaCalcs((sattaCalculatedRes as any)?.data || sattaCalculatedRes || []);
      setAllPayments(payments || []);
      setAllSettlements(combinedSettlements);
      if (supabase) { supabase.from('sauda_check_point_details').select('*').then(({ data }) => setAllScpDetails(data || [])); }

      const dedMap: Record<string, any> = {};
      const cleanKeyFormat = (v: any) => String(v || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      (scpDeductions || []).forEach((d: any) => {
        if (d?.po_no) {
          dedMap[String(d.po_no).trim().toUpperCase()] = d;
          dedMap[cleanKeyFormat(d.po_no)] = d;
        }
        if (d?.sauda_no) {
          dedMap[String(d.sauda_no).trim().toUpperCase()] = d;
          dedMap[cleanKeyFormat(d.sauda_no)] = d;
        }
      });
      setSettledDeductions(dedMap);

      const allMergedInspections = [...(matInspections || []), ...(inspections || [])];
      const pos = initialPos;
      setAllTempArrivals(arrivals || []);
      setAllFinalArrivals(finalArrivals || []);
      setAllInspections(allMergedInspections);

      const exactPo = (a: any, b: any) => {
        const x = String(a || '').trim().toUpperCase();
        const y = String(b || '').trim().toUpperCase();
        return x !== '' && x === y;
      };
      const cleanVal = (v: any) => String(v || '').trim().replace(/[^a-z0-9]/gi, '').toLowerCase();

      const matchPoRecord = (po: any, rec: any) => {
        if (!po || !rec) return false;
        const pKeys = [
          cleanVal(po.po_no),
          cleanVal(po.contract_po_no),
          cleanVal(po.ptf_no),
          cleanVal(po.sauda_no),
          cleanVal(po.contract_no)
        ].filter(Boolean);

        const rKeys = [
          cleanVal(rec.po_no),
          cleanVal(rec.mill_po_no),
          cleanVal(rec.contract_po_no),
          cleanVal(rec.sauda_no || rec.contract_no),
          cleanVal(rec.ptf_no),
          cleanVal(rec.temporary_arrival_no || rec.arrival_no || rec.amad_no),
          cleanVal(rec.final_arrival_no || rec.mr_no)
        ].filter(Boolean);

        for (const pk of pKeys) {
          for (const rk of rKeys) {
            if (pk === rk) return true;
            if (pk.length >= 6 && rk.length >= 6 && (pk.includes(rk) || rk.includes(pk))) return true;
          }
        }
        return false;
      };

      setPoList((pos || []).map((p: any) => {
        const contractWeight = parseFloat(p.total_contract_mt) || 0;
        const matchingFinal = (finalArrivals || []).filter((ar: any) =>
          matchPoRecord(p, ar) || exactPo(p.po_no, ar.po_no) || exactPo(p.contract_po_no, ar.po_no)
        );
        const matchingTemp = (arrivals || []).filter((ar: any) =>
          (matchPoRecord(p, ar) || exactPo(p.po_no, ar.po_no) || exactPo(p.contract_po_no, ar.po_no)) &&
          !matchingFinal.some(f => 
            (f.temporary_arrival_no && ar.temporary_arrival_no && f.temporary_arrival_no === ar.temporary_arrival_no) ||
            (f.mr_no && ar.amad_no && f.mr_no === ar.amad_no) ||
            (f.lorry_number && ar.lorry_number && String(f.lorry_number).trim().toUpperCase() === String(ar.lorry_number).trim().toUpperCase())
          )
        );

        const tempWeightOf = (ar: any) => {
          if (ar.challan_material_weight && Number(ar.challan_material_weight) > 0) return Number(ar.challan_material_weight);
          if (ar.weight_reduced && Number(ar.weight_reduced) > 0) return Number(ar.weight_reduced);
          if (ar.weight_qtl && Number(ar.weight_qtl) > 0) return Number(ar.weight_qtl) / 10;
          if (ar.weight && Number(ar.weight) > 0) return Number(ar.weight) / 10;
          if (ar.electronic_net_weight && Number(ar.electronic_net_weight) > 0) {
            return Number(ar.electronic_net_weight) > 50 ? Number(ar.electronic_net_weight) / 10 : Number(ar.electronic_net_weight);
          }
          return 0;
        };
        const finalWeightOf = (ar: any) => {
          if (ar.weight_qtl && Number(ar.weight_qtl) > 0) return Number(ar.weight_qtl) / 10;
          if (ar.weight && Number(ar.weight) > 0) return Number(ar.weight) / 10;
          if (ar.electronic_net_weight && Number(ar.electronic_net_weight) > 0) {
            return Number(ar.electronic_net_weight) > 50 ? Number(ar.electronic_net_weight) / 10 : Number(ar.electronic_net_weight);
          }
          if (ar.challan_material_weight && Number(ar.challan_material_weight) > 0) return Number(ar.challan_material_weight);
          return 0;
        };

        const totalFinalMt = matchingFinal.reduce((sum: number, ar: any) => sum + finalWeightOf(ar), 0);
        const totalTempMt = matchingTemp.reduce((sum: number, ar: any) => sum + tempWeightOf(ar), 0);
        const totalReceivedMt = totalFinalMt + totalTempMt;

        const unit = p.purchase_unit_name || p.unit_type || p.unit || 'BALES';
        const tol = calculateWeightTolerance(contractWeight, totalReceivedMt, unit);
        const isExplicitCompleted = p.status === 'completed' || p.status === 'settled';
        const isWeightCompleted = tol.isCompleted;

        // 1. Check Temporary Arrival Dashboard
        const hasTempArrival = (arrivals || []).some((ar: any) => matchPoRecord(p, ar)) ||
                               matchingFinal.length > 0 ||
                               totalReceivedMt > 0;

        // 2. Check Final Arrival Dashboard
        const hasFinalArrival = matchingFinal.length > 0 || totalReceivedMt > 0;

        // 3. Check Mill Inspection
        const matchingInsp = allMergedInspections.find((i: any) => matchPoRecord(p, i));
        const hasInspection = Boolean(matchingInsp);

        // 4. Check Mismatch
        const isCleared = p.mismatch_cleared === true || 
          p.mismatch_cleared === 'true' || 
          p.satta_dispute_approved === true || 
          p.satta_dispute_approved === 'true' || 
          p.pass_status === 'pass' ||
          p.is_pass === true ||
          p.status === 'final' ||
          p.status === 'moved_to_final' ||
          isPoMismatchResolved(p);

        const hasDbMismatch = (combinedMatMismatches || []).some((m: any) => {
          if (!matchPoRecord(p, m)) return false;
          const st = String(m.status || m.resolution_status || '').toLowerCase();
          return st !== 'resolved' && st !== 'cleared' && st !== 'approved';
        }) || (combinedSatMismatches || []).some((m: any) => {
          if (!matchPoRecord(p, m)) return false;
          const st = String(m.status || m.resolution_status || '').toLowerCase();
          return st !== 'resolved' && st !== 'cleared' && st !== 'approved';
        });

        const mismatchFields: string[] = [];
        if (!isCleared) {
          const poDetails = (allScpDetails || []).filter((d: any) => matchPoRecord(p, d));
          const activeArrival = matchingTemp[0] || (arrivals || []).find((ar: any) => matchPoRecord(p, ar));
          if (activeArrival || matchingInsp) {
            const tempMatchRes = compareSaudaTempArrival(p, poDetails, activeArrival || matchingInsp, matchingInsp ? [matchingInsp] : []);
            if (tempMatchRes.hasInspection && tempMatchRes.status === 'mismatch') {
              tempMatchRes.mismatches.forEach(m => mismatchFields.push(m.mismatchLabel || m.field));
            }
          }
        }

        const isMismatch = !isCleared && (hasDbMismatch || mismatchFields.length > 0 || (p.pass_status === 'mismatch' && !isCleared));

        const matchingTempArrivals = (arrivals || []).filter((ar: any) =>
          matchPoRecord(p, ar) || exactPo(p.po_no, ar.po_no) || exactPo(p.contract_po_no, ar.po_no)
        );
        const distinctArrivalKeys = new Set<string>();
        matchingTempArrivals.forEach((ar: any) => {
          const k = ar.temporary_arrival_no || ar.amad_id || ar.lorry_number || ar.amad_no;
          if (k) distinctArrivalKeys.add(String(k).trim().toUpperCase());
        });
        matchingFinal.forEach((fa: any) => {
          const k = fa.temporary_arrival_no || fa.arrival_no || fa.lorry_number || fa.mr_no;
          if (k) distinctArrivalKeys.add(String(k).trim().toUpperCase());
        });

        const receivedLorries = Math.max(matchingTempArrivals.length, distinctArrivalKeys.size);
        const contractLorries = Math.max(1, parseInt(p.total_lorries || p.total_no_of_lorries || p.no_of_lorries || p.lorries || 1, 10) || 1);

        const cleanPoKey = String(p.po_no || '').trim().toUpperCase();
        let parsedOpenRemarks = p.open_remarks;
        if (typeof parsedOpenRemarks === 'string') {
          try { parsedOpenRemarks = JSON.parse(parsedOpenRemarks); } catch(e) {}
        }
        if (!parsedOpenRemarks) {
          try {
            const localRemarks = localStorage.getItem(`sauda_open_remarks_${cleanPoKey}`);
            if (localRemarks) parsedOpenRemarks = JSON.parse(localRemarks);
          } catch(e) {}
        }

        const isExplicitReopened = p.is_reopened === true || 
                                   p.reopened === true || 
                                   Boolean(parsedOpenRemarks) ||
                                   localStorage.getItem(`sauda_reopened_${cleanPoKey}`) === 'true';

        const isExplicitClosed = p.is_closed === true || 
                                 p.sauda_closed === true || 
                                 p.status === 'closed' || 
                                 localStorage.getItem(`sauda_closed_${cleanPoKey}`) === 'true';

        const isLorryClosed = contractLorries > 0 && receivedLorries >= contractLorries;
        const isClosed = !isExplicitReopened && (isExplicitClosed || isLorryClosed);

        // Payment status in payment_master
        const pPoClean = cleanVal(p.po_no);
        const pContractClean = cleanVal(p.contract_po_no);
        const pPtfClean = cleanVal(p.ptf_no);
        const pSaudaClean = cleanVal(p.sauda_no || p.po_contract || p.contract_no);

        const matchingPayments = (payments || []).filter((pay: any) => {
          const payPoClean = cleanVal(pay.po_no);
          const paySaudaClean = cleanVal(pay.sauda_no);
          return exactPo(p.po_no, pay.po_no) || 
                 exactPo(p.contract_po_no, pay.po_no) ||
                 matchPoRecord(p, pay) ||
                 (pPoClean && pPoClean === payPoClean) ||
                 (pContractClean && pContractClean === payPoClean) ||
                 (pPtfClean && pPtfClean === payPoClean) ||
                 (pSaudaClean && paySaudaClean && pSaudaClean === paySaudaClean);
        });
        const hasPaymentDone = matchingPayments.some((pay: any) => {
          const advDone = String(pay.advance_payment_done || pay.advance_done || '').trim().toLowerCase();
          const paid = Number(pay.paid_amount || 0);
          const pStatus = String(pay.payment_status || pay.status || '').toLowerCase().trim();

          if (advDone === 'yes' || advDone === 'y' || advDone === 'true') return true;
          if (paid > 0) return true;
          if (pStatus === 'paid' || pStatus === 'completed' || pStatus === 'settled' || pStatus === 'partially settled') return true;
          return false;
        }) || Boolean(p.has_payment_done || (p.advance_payment_done && String(p.advance_payment_done).toLowerCase() === 'yes'));

        // Settlement status in mr_settlement_master / m_r_settlement
        const matchingSettlements = (combinedSettlements || []).filter((s: any) => {
          const sPoClean = cleanVal(s.po_no || s.po_contract || s.contract_po_no);
          return exactPo(p.po_no, s.po_no) || 
                 exactPo(p.contract_po_no, s.po_no) || 
                 matchPoRecord(p, s) || 
                 (pPoClean && pPoClean === sPoClean) || 
                 (pContractClean && pContractClean === sPoClean);
        });
        const hasSettlementDone = matchingSettlements.length > 0 || p.status === 'settled';

        let workflowStage: 'temp_arrival_pending' | 'final_arrival_pending' | 'mismatch' | 'inspection_pending' | 'adv_payment_not_done' | 'settlement_pending' | 'final_po' = 'temp_arrival_pending';

        if (!hasTempArrival && !hasFinalArrival) {
          workflowStage = 'temp_arrival_pending';
        } else if (hasTempArrival && !hasFinalArrival) {
          workflowStage = 'final_arrival_pending';
        } else if (isMismatch) {
          workflowStage = 'mismatch';
        } else if (!hasInspection) {
          workflowStage = 'inspection_pending';
        } else if (!hasPaymentDone) {
          workflowStage = 'adv_payment_not_done';
        } else if (!hasSettlementDone) {
          workflowStage = 'settlement_pending';
        } else {
          workflowStage = 'final_po';
        }

        const isPass = isCleared || (workflowStage === 'final_po');
        const isWeightFulfilled = isExplicitCompleted || isWeightCompleted || isClosed;
        const isFullyComplete = isTempPo 
          ? (isWeightFulfilled && isPass)
          : isWeightFulfilled;
        const computedPending = !isFullyComplete;

        return {
          ...p,
          date: p.date || p.po_date || (p.created_at ? p.created_at.slice(0, 10) : ''),
          broker: (p.broker || '').toUpperCase(),
          supplier: (p.supplier || '').toUpperCase(),
          challan_supplier: (p.challan_supplier || p.supplier || '').toUpperCase(),
          pending: computedPending,
          received_weight_mt: totalReceivedMt,
          weight_tolerance: tol,
          contract_lorries: contractLorries,
          received_lorries: receivedLorries,
          is_closed: isClosed,
          is_reopened: isExplicitReopened,
          open_remarks: parsedOpenRemarks,
          has_settlement_done: hasSettlementDone,
          workflow_stage: workflowStage,
          stage: workflowStage,
          has_temp_arrival: hasTempArrival,
          has_final_arrival: hasFinalArrival,
          has_inspection: hasInspection,
          pass_status: isCleared ? 'pass' : (workflowStage === 'final_po' ? 'pass' : (isMismatch ? 'mismatch' : workflowStage)),
          mismatch_fields: isCleared ? [] : mismatchFields,
          has_payment_done: hasPaymentDone,
          is_fully_completed: isFullyComplete
        };
      }));

      setBrokerList((brokers || []).map((b: any) => ({
        ...b,
        brok_name: (b.brok_name || '').toUpperCase()
      })));
      setSupplierList((suppliers || []).map((s: any) => ({
        ...s,
        supp_name: (s.supp_name || '').toUpperCase()
      })));
      setAreaList(areas || []);
      setSaudaList((saudas || []).map((s: any) => ({
        ...s,
        broker: (s.broker || '').toUpperCase(),
        supplier: (s.supplier || '').toUpperCase(),
        challan_supplier: (s.challan_supplier || '').toUpperCase()
      })));
      setGradeList(grades || []);
      setMarkaList(markas || []);
      setAgencyList(agencies || []);

      const sBases = sattaBasesRes && 'data' in sattaBasesRes ? (sattaBasesRes as any).data || [] : [];
      const sCalculated = sattaCalculatedRes && 'data' in sattaCalculatedRes ? (sattaCalculatedRes as any).data || [] : [];
      const sDiffs = sattaDiffsRes && 'data' in sattaDiffsRes ? (sattaDiffsRes as any).data || [] : [];
      setSattaBaseRates(sBases);
      setSattaCalculatedRates(sCalculated);
      setSattaDifferentials(sDiffs);
    } catch (err) {
      console.error('Failed to load masters data:', err);
    } finally {
      setLoading(false);
    }
  }, [MASTER_TABLE, isArchiveView, isTempPo]);

  // Live Auto Refresh hook
  useLiveAutoRefresh(fetchPosAndMasters, [isArchiveView, isTempPo], { 
    tables: [
      'purchase_master', 
      'purchase_detail_master', 
      'sauda_check_point', 
      'sauda_check_point_details', 
      'sauda_check_point_deductions', 
      'p.o_archive', 
      'po_archive', 
      'temporary_material_received',
      'final_arrival',
      'material_inspection', 
      'mill_inspection_master', 
      'material_mismatch',
      'satta_mismatch',
      'payment_master'
    ] 
  });

  // Event Listeners & Channels
  useEffect(() => {
    fetchPosAndMasters();

    const handleDataUpdate = () => {
      fetchPosAndMasters();
    };

    window.addEventListener('app-data-updated', handleDataUpdate);
    window.addEventListener('mismatch_resolved', handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate);

    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel('po-realtime-sub')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_check_point' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_check_point_deductions' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'final_po' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_check_point_details' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'material_inspection' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mill_inspection_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'temporary_material_received' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_sauda' }, handleDataUpdate)
        .subscribe();
    }

    return () => {
      window.removeEventListener('app-data-updated', handleDataUpdate);
      window.removeEventListener('mismatch_resolved', handleDataUpdate);
      window.removeEventListener('storage', handleDataUpdate);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchPosAndMasters]);

  // CSV Export Handler
  const handleCsvDownload = async (listToExport: any[]) => {
    try {
      if (!supabase) {
        alert("Database connection client is not loaded.");
        return;
      }
      setLoading(true);

      let detailData: any[] = [];
      try {
        const { data } = await supabase.from(DETAIL_TABLE).select('*');
        detailData = data || [];
      } catch (e) {
        console.warn("Failed to fetch detail table for CSV:", e);
      }

      const detailsByPo: Record<string, any[]> = {};
      detailData.forEach((d: any) => {
        const key = String(d.po_no || '').trim().toUpperCase();
        if (!key) return;
        if (!detailsByPo[key]) detailsByPo[key] = [];
        detailsByPo[key].push(d);
      });

      if (!listToExport || listToExport.length === 0) {
        alert("No Purchase Orders found matching current view to export.");
        return;
      }

      const dataToExport = listToExport.map((row: any) => {
        const poKey = String(row.po_no || '').trim().toUpperCase();
        const poDetails = detailsByPo[poKey] || [];

        const gradeItemDetails = poDetails.map((d: any) => {
          const gName = gradeList.find((g: any) => g.grade_code === d.grade_code)?.grade_name || d.grade_name || d.grade_code || '';
          const qty = d.quantity ? `${d.quantity} Units` : '';
          const wt = d.weight_mt ? `${Number(d.weight_mt).toFixed(3)} MT` : '';
          const rate = d.rate_qntl ? `@ Rs.${d.rate_qntl}` : '';
          return [gName, qty, wt, rate].filter(Boolean).join(' ');
        }).join(' | ');

        const rawPoDate = row.po_date || row.date;
        const formattedPoDate = rawPoDate ? new Date(rawPoDate).toLocaleDateString('en-GB') : '';
        const rawSaudaDate = row.s_date || row.contract_date;
        const formattedSaudaDate = rawSaudaDate ? new Date(rawSaudaDate).toLocaleDateString('en-GB') : '';

        const contractMt = parseFloat(row.total_contract_mt) || parseFloat(row.quantity) || 0;
        const rcvdMt = parseFloat(row.received_weight_mt) || 0;
        const unit = row.purchase_unit_name || row.po_type || 'BALES';
        const tol = calculateWeightTolerance(contractMt, rcvdMt, unit);
        const pStatus = row.status ? String(row.status).toUpperCase() : (tol.isCompleted || row.pending === false ? 'COMPLETED' : 'PENDING');

        return {
          "PO / PTF No": row.po_no || row.ptf_no || '',
          "PO Date": formattedPoDate,
          "Sauda Contract No": row.sauda_no || row.contract_po_no || '',
          "Sauda Date": formattedSaudaDate,
          "Broker": row.broker || '',
          "Merchant / Supplier": row.supplier || row.merchant || '',
          "Challan Supplier": row.challan_supplier || '',
          "Area / Station": row.area || row.dispatch_station || '',
          "B. Rate (Rs/MT)": row.b_rate || 0,
          "Unit / Lorry": row.purchase_unit_name || row.po_type || 'BALES',
          "Total Lorries": row.total_lorries || 0,
          "Total Units / Bales": row.total_units || 0,
          "Total Contract Wt (MT)": contractMt,
          "Received Weight (MT)": rcvdMt,
          "Weight Tolerance": tol.formattedTolerance,
          "Acceptable Range (MT)": tol.formattedRange,
          "Status": pStatus,
          "Session / Year": row.session || row.financial_year || '',
          "Crop Year": row.crop_year || '',
          "Transport Paid By": row.trans_paid_by || row.transport_type || '',
          "Delivery From": row.delivery_from || '',
          "Delivery To": row.delivery_to || '',
          "Grace Days": row.grace_days || 0,
          "Moisture Limit %": row.moisture || 0,
          "Moisture Penalty %": row.moisture_penalty || 0,
          "Dust Limit %": row.dust || 0,
          "Dust Penalty %": row.dust_penalty || 0,
          "NCV Limit %": row.ncv || 0,
          "NCV Penalty %": row.ncv_penalty || 0,
          "Grade & Item Breakdown": gradeItemDetails || 'N/A',
          "Remarks": row.remarks || '',
          "Financial Year": row.financial_year || '',
          "Created At": row.created_at || ''
        };
      });

      const sanitizedData = sanitizeCsvData(dataToExport);
      const csv = Papa.unparse(sanitizedData);
      const csvContent = "\uFEFF" + csv;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const exportType = isTempPo ? 'Temporary_PO' : 'Final_PO';
      link.setAttribute('download', `${exportType}_Full_Export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("PO CSV Export failed:", err);
      alert("Failed to export: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    MASTER_TABLE,
    DETAIL_TABLE,
    loading,
    setLoading,
    poList,
    setPoList,
    brokerList,
    supplierList,
    areaList,
    saudaList,
    gradeList,
    markaList,
    agencyList,
    unitList,
    sattaBaseRates,
    sattaCalculatedRates,
    sattaDifferentials,
    allScpDetails,
    sattaCalcs,
    sattaBases,
    allTempArrivals,
    allFinalArrivals,
    allInspections,
    allPayments,
    allSettlements,
    settledDeductions,
    matchResults,
    dbMaterialMismatches,
    dbSattaMismatches,
    tempPoNoSet,
    fetchPosAndMasters,
    handleCsvDownload,
    isPoMismatchResolved
  };
}
