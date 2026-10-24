import React, { useState, useEffect } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { 
  Link, 
  Search, 
  CheckCircle2, 
  FileCheck, 
  FileText, 
  RefreshCw, 
  Printer, 
  Trash2, 
  Download,
  X,
  Filter,
  Layers,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PaginationControls } from '../components/PaginationControls';
import { supabase } from '../lib/supabase';
import { dbModule } from '../services/dbModule';
import LegacyLayout from '../components/LegacyLayout';
import PrintModal from '../components/PrintModal';

interface ClubbingRecord {
  id: string;
  clubbedAt: string;
  supplier: string;
  poNos: string[];
  amadNos: string[];
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
    row.primary_mr_no || row.mr_no
  );

  // Enrich from Final Arrival & PO / PTF records if missing in clubbed_pomr schema
  const primaryMr = normalize(amadNos[0] || row.primary_mr_no || row.mr_no);
  const primaryPo = normalize(poNos[0] || row.primary_po_no || row.po_no);

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
          normalize(s.ptf_no) === primaryPo ||
          normalize(s.po_no) === primaryPo ||
          normalize(s.po_ptf_no) === primaryPo ||
          normalize(s.sauda_no) === primaryPo ||
          normalize(s.contract_no) === primaryPo
      ) ||
      allPos.find(
        (p: any) =>
          normalize(p.po_no) === primaryPo ||
          normalize(p.ptf_no) === primaryPo ||
          normalize(p.po_ptf_no) === primaryPo ||
          normalize(p.sauda_no) === primaryPo ||
          normalize(p.contract_no) === primaryPo
      )
    : null;

  const faWeightMt = matchedFa?.weight_qtl
    ? Number((parseFloat(matchedFa.weight_qtl) / 10).toFixed(2))
    : 0;
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

  return {
    id: String(row.club_id || row.id || ''),
    clubbedAt: String(row.clubbed_at || row.clubbedAt || row.created_at || new Date().toISOString()).split('T')[0],
    supplier: String(
      row.supplier ||
        matchedFa?.supplier ||
        matchedFa?.challan_supplier ||
        matchedPo?.supplier ||
        'N/A'
    ),
    poNos,
    amadNos,
    totalPoWeight,
    totalReceivedWeight,
    variancePct: Number(row.variance_pct ?? row.variancePct ?? computedVariance ?? 0),
    recordedBy: String(row.recorded_by || row.recordedBy || row.clubbed_by || 'LEVEL-4-USER'),
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
  const [selectedDetailPo, setSelectedDetailPo] = useState<any | null>(null);
  const [showAllPOsInModal, setShowAllPOsInModal] = useState(false);

  // Binding Form remarks
  const [remarks, setRemarks] = useState('');

  // Clubbed History Register
  const [clubbingHistory, setClubbingHistory] = useState<ClubbingRecord[]>([]);

  // Pagination for History Register
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [printingClub, setPrintingClub] = useState<ClubbingRecord | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSupplier]);

  // Load all initial data & master entries
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [allPos, allSaudaCheck, allFinalArrivals, allClubbed] = await Promise.all([
        dbModule.fetchAll('purchase_master').catch(() => []),
        dbModule.fetchAll('sauda_check_point').catch(() => []),
        dbModule.fetchAll('final_arrival').catch(() => []),
        dbModule.fetchAll('clubbed_pomr').catch(() => [])
      ]);

      // Supplier set
      const supplierSet = new Set<string>();
      allPos.forEach((p: any) => { if (p.supplier) supplierSet.add(p.supplier); });
      allSaudaCheck.forEach((s: any) => { if (s.supplier) supplierSet.add(s.supplier); });
      allFinalArrivals.forEach((f: any) => { 
        if (f.supplier) supplierSet.add(f.supplier); 
        if (f.challan_supplier) supplierSet.add(f.challan_supplier);
      });

      const suppliersList = Array.from(supplierSet).filter(Boolean).sort();
      setSuppliers(suppliersList);

      const mappedHistory = (allClubbed || []).map((row: any) =>
        mapDbRowToClubRecord(row, allFinalArrivals, allPos, allSaudaCheck)
      );

      // Also include any bound pairings from final_arrival that aren't in clubbed_pomr yet
      const recordedPairs = new Set<string>();
      mappedHistory.forEach(item => {
        item.amadNos.forEach(a => recordedPairs.add(normalize(a)));
      });

      (allFinalArrivals || []).forEach((fa: any) => {
        const poNoStr = normalize(fa.po_no);
        const faNoStr = String(fa.final_arrival_no || fa.mr_no || '').trim();
        if (
          poNoStr &&
          poNoStr !== 'NO' &&
          poNoStr !== 'N/A' &&
          poNoStr !== 'NONE' &&
          faNoStr &&
          !recordedPairs.has(normalize(faNoStr))
        ) {
          // Check if it was bound to a PTF / Sauda Check Point contract or explicitly bound
          const matchedScp = (allSaudaCheck || []).find(
            (s: any) =>
              normalize(s.ptf_no) === poNoStr ||
              normalize(s.po_no) === poNoStr ||
              normalize(s.po_ptf_no) === poNoStr ||
              normalize(s.sauda_no) === poNoStr
          );
          if (matchedScp || poNoStr.startsWith('PTF')) {
            mappedHistory.push(
              mapDbRowToClubRecord(
                {
                  club_id: `BOUND-${faNoStr}`,
                  primary_po_no: fa.po_no,
                  clubbed_po_nos: [fa.po_no],
                  primary_mr_no: faNoStr,
                  clubbed_mr_nos: [faNoStr],
                  created_at: fa.updated_at || fa.created_at || fa.date,
                  supplier: fa.supplier || fa.challan_supplier || matchedScp?.supplier,
                  clubbed_by: 'LEVEL-4-USER',
                  remarks: `Bound Final Arrival ${faNoStr} with ${fa.po_no}`
                },
                allFinalArrivals,
                allPos,
                allSaudaCheck
              )
            );
            recordedPairs.add(normalize(faNoStr));
          }
        }
      });

      setClubbingHistory(mappedHistory);

      // Fetch unbound lists
      await fetchSupplierDocuments(selectedSupplier || 'ALL');

    } catch (err) {
      console.error('Error loading Master entries:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unbound Final Arrival records and unbound P.O / PTF contracts
  const fetchSupplierDocuments = async (supplierName: string) => {
    if (!supplierName) return;
    setLoading(true);
    try {
      const [allPos, allSaudaCheck, allFinalArrivals, allClubbed] = await Promise.all([
        dbModule.fetchAll('purchase_master').catch(() => []),
        dbModule.fetchAll('sauda_check_point').catch(() => []),
        dbModule.fetchAll('final_arrival').catch(() => []),
        dbModule.fetchAll('clubbed_pomr').catch(() => [])
      ]);

      const isAll = supplierName === 'ALL';

      // Track PO/PTF numbers already bound in final_arrival or clubbed_pomr
      const boundPoNos = new Set<string>();
      (allFinalArrivals || []).forEach((fa: any) => {
        const p = normalize(fa.po_no);
        if (p && p !== 'NO' && p !== 'N/A' && p !== 'NONE') boundPoNos.add(p);
      });
      (allClubbed || []).forEach((c: any) => {
        const pList = parseJsonArray(c.clubbed_po_nos ?? c.po_nos, c.primary_po_no || c.po_no);
        pList.forEach(p => {
          const norm = normalize(p);
          if (norm) boundPoNos.add(norm);
        });
      });

      // 1. Unbound Final Arrivals: records in final_arrival where po_no is blank/empty/NO/N/A
      const filteredFinalArrivals = allFinalArrivals.filter((fa: any) => {
        const poNoStr = normalize(fa.po_no);
        const isPoBlank = !poNoStr || poNoStr === 'NO' || poNoStr === 'N/A' || poNoStr === 'NONE';
        const matchesSupplier = isAll || 
          normalize(fa.supplier) === normalize(supplierName) || 
          normalize(fa.challan_supplier) === normalize(supplierName);
        return isPoBlank && matchesSupplier;
      });

      // 2. Unbound POs / PTFs: records in purchase_master / sauda_check_point where mr_no / final_arrival_no is blank and not already bound
      const combinedPOsMap = new Map<string, any>();
      
      const processPo = (po: any) => {
        const poNo = po.ptf_no || po.po_no || po.po_ptf_no || po.sauda_no || po.contract_no;
        if (!poNo) return;

        const normPoNo = normalize(poNo);
        const mrNoStr = normalize(po.mr_no || po.final_arrival_no || po.temporary_arrival_no);
        const isMrBlank = (!mrNoStr || mrNoStr === 'NO' || mrNoStr === 'N/A' || mrNoStr === 'NONE') && !boundPoNos.has(normPoNo);
        const matchesSupplier = isAll || normalize(po.supplier) === normalize(supplierName);

        if (isMrBlank && matchesSupplier && !combinedPOsMap.has(normPoNo)) {
          combinedPOsMap.set(normPoNo, {
            ...po,
            po_no: poNo,
            broker: po.broker || po.broker_name || 'N/A',
            area: po.area || po.arrival_area_name || po.arrival_yard || po.area_name || po.dispatch_place || 'N/A',
            supplier: po.supplier || 'N/A',
            total_contract_mt: Number(
              po.total_contract_mt ||
                po.quantity_mt ||
                po.total_qty_mt ||
                po.quantity ||
                (po.qty_qtl ? Number(po.qty_qtl) / 10 : 0) ||
                0
            )
          });
        }
      };

      allSaudaCheck.forEach(processPo);
      allPos.forEach(processPo);

      const filteredPOs = Array.from(combinedPOsMap.values());

      setUnboundFinalArrivals(filteredFinalArrivals);
      setUnboundPOs(filteredPOs);

    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useLiveAutoRefresh(loadInitialData, [], { tables: ['purchase_master', 'sauda_check_point', 'final_arrival', 'clubbed_pomr'] });
  
  useEffect(() => {
    fetchSupplierDocuments(selectedSupplier);
  }, [selectedSupplier]);

  // Execute Voucher Binding
  const handleConfirmBinding = async () => {
    if (!selectedArrivalForBind || !chosenPoForBind) return;

    setLoading(true);
    try {
      const faNo = selectedArrivalForBind.final_arrival_no || selectedArrivalForBind.mr_no;
      const poNo = chosenPoForBind.po_no || chosenPoForBind.ptf_no;
      const poDate = chosenPoForBind.po_date || chosenPoForBind.ptf_date || chosenPoForBind.date || chosenPoForBind.sauda_date || '';

      const faWeightMt = Number((parseFloat(selectedArrivalForBind.weight_qtl || '0') / 10).toFixed(2));
      const poWeightMt = Number(chosenPoForBind.total_contract_mt || 0);
      const variance = poWeightMt > 0 ? Number((((faWeightMt - poWeightMt) / poWeightMt) * 100).toFixed(2)) : 0;

      const clubId = `CLUB-${Date.now().toString().slice(-6)}`;
      const clubbedDate = new Date().toISOString().split('T')[0];

      const supplierName = selectedArrivalForBind.supplier || selectedArrivalForBind.challan_supplier || chosenPoForBind.supplier || 'MULTI-SUPPLIER';

      const poUpdatePayload: Record<string, any> = { po_no: poNo };
      if (poDate) poUpdatePayload.po_date = poDate;

      // 1. Update final_arrival table with linked P.O / PTF
      if (selectedArrivalForBind.final_arrival_id) {
        await dbModule.update(
          'final_arrival',
          'final_arrival_id',
          selectedArrivalForBind.final_arrival_id,
          { ...poUpdatePayload, contract_no: poNo }
        ).catch(() => {});
      }
      if (selectedArrivalForBind.id) {
        await dbModule.update(
          'final_arrival',
          'id',
          selectedArrivalForBind.id,
          { ...poUpdatePayload, contract_no: poNo }
        ).catch(() => {});
      }
      if (selectedArrivalForBind.final_arrival_no) {
        await dbModule.update(
          'final_arrival',
          'final_arrival_no',
          selectedArrivalForBind.final_arrival_no,
          { ...poUpdatePayload, contract_no: poNo }
        ).catch(() => {});
      }

      // 2. Collect all candidate Arrival / MR keys & Lorry Numbers to propagate P.O / PTF to Temporary Arrival & Mill Inspection
      const candidateKeys = new Set<string>(
        [
          faNo,
          selectedArrivalForBind.mr_no,
          selectedArrivalForBind.final_arrival_no,
          selectedArrivalForBind.arrival_no,
          selectedArrivalForBind.temporary_arrival_no,
          selectedArrivalForBind.amad_no
        ]
          .map(v => String(v || '').trim())
          .filter(Boolean)
      );

      const candidateLorry = normalize(
        selectedArrivalForBind.lorry_number ||
          selectedArrivalForBind.lorry_no ||
          selectedArrivalForBind.vehicle_no
      );

      // 2a. Update Temporary Arrival Section (`temporary_material_received`)
      const allTempArrivals = await dbModule.fetchAll('temporary_material_received').catch(() => []);
      const normCandidateKeys = new Set(Array.from(candidateKeys).map(normalize));

      for (const ta of allTempArrivals || []) {
        const taTempNo = String(ta.temporary_arrival_no || '').trim();
        const taAmadNo = String(ta.amad_no || '').trim();
        const taArrNo = String(ta.arrival_no || '').trim();
        const taMrNo = String(ta.mr_no || '').trim();
        const taLorry = normalize(ta.lorry_number || ta.lorry_no || ta.vehicle_no);

        const isMatchByNo =
          (taTempNo && normCandidateKeys.has(normalize(taTempNo))) ||
          (taAmadNo && normCandidateKeys.has(normalize(taAmadNo))) ||
          (taArrNo && normCandidateKeys.has(normalize(taArrNo))) ||
          (taMrNo && normCandidateKeys.has(normalize(taMrNo)));

        const isMatchByLorryAndSupplier =
          !isMatchByNo &&
          candidateLorry &&
          taLorry === candidateLorry &&
          normalize(ta.supplier) === normalize(selectedArrivalForBind.supplier || selectedArrivalForBind.challan_supplier);

        if (isMatchByNo || isMatchByLorryAndSupplier) {
          if (taTempNo) candidateKeys.add(taTempNo);
          if (taAmadNo) candidateKeys.add(taAmadNo);
          if (taArrNo) candidateKeys.add(taArrNo);
          if (taMrNo) candidateKeys.add(taMrNo);

          if (ta.amad_id) {
            await dbModule.update('temporary_material_received', 'amad_id', ta.amad_id, poUpdatePayload).catch(() => {});
          } else if (taTempNo) {
            await dbModule.update('temporary_material_received', 'temporary_arrival_no', taTempNo, poUpdatePayload).catch(() => {});
          } else if (taAmadNo) {
            await dbModule.update('temporary_material_received', 'amad_no', taAmadNo, poUpdatePayload).catch(() => {});
          }
        }
      }

      // Direct fallback updates on temporary_material_received for all candidate keys
      for (const key of Array.from(candidateKeys)) {
        await dbModule.update('temporary_material_received', 'temporary_arrival_no', key, poUpdatePayload).catch(() => {});
        await dbModule.update('temporary_material_received', 'amad_no', key, poUpdatePayload).catch(() => {});
        await dbModule.update('temporary_material_received', 'mr_no', key, poUpdatePayload).catch(() => {});
      }

      // 2b. Update Mill Inspection Section (`material_inspection`, `mill_inspection_master`, `inspection_master`, `inspection_checklist`)
      const updatedNormKeys = new Set(Array.from(candidateKeys).map(normalize));
      const [allMatInsp, allMillInsp] = await Promise.all([
        dbModule.fetchAll('material_inspection').catch(() => []),
        dbModule.fetchAll('mill_inspection_master').catch(() => [])
      ]);

      for (const mi of allMatInsp || []) {
        const miMr = normalize(mi.mr_no);
        const miArr = normalize(mi.arrival_no);
        const miTemp = normalize(mi.temporary_arrival_no);
        if (
          (miMr && updatedNormKeys.has(miMr)) ||
          (miArr && updatedNormKeys.has(miArr)) ||
          (miTemp && updatedNormKeys.has(miTemp))
        ) {
          if (mi.id) {
            await dbModule.update('material_inspection', 'id', mi.id, poUpdatePayload).catch(() => {});
          }
          if (mi.mr_no) {
            await dbModule.update('material_inspection', 'mr_no', mi.mr_no, poUpdatePayload).catch(() => {});
          }
        }
      }

      for (const mm of allMillInsp || []) {
        const mmMr = normalize(mm.mr_no);
        const mmArr = normalize(mm.arrival_no);
        if ((mmMr && updatedNormKeys.has(mmMr)) || (mmArr && updatedNormKeys.has(mmArr))) {
          if (mm.id) {
            await dbModule.update('mill_inspection_master', 'id', mm.id, poUpdatePayload).catch(() => {});
          }
          if (mm.mr_no) {
            await dbModule.update('mill_inspection_master', 'mr_no', mm.mr_no, poUpdatePayload).catch(() => {});
          }
        }
      }

      for (const mrKey of Array.from(candidateKeys)) {
        await dbModule.update('material_inspection', 'mr_no', mrKey, poUpdatePayload).catch(() => {});
        await dbModule.update('material_inspection', 'arrival_no', mrKey, poUpdatePayload).catch(() => {});
        await dbModule.update('mill_inspection_master', 'mr_no', mrKey, poUpdatePayload).catch(() => {});
        await dbModule.update('mill_inspection_master', 'arrival_no', mrKey, poUpdatePayload).catch(() => {});
        await dbModule.update('inspection_master', 'mr_no', mrKey, poUpdatePayload).catch(() => {});
        await dbModule.update('inspection_master', 'arrival_no', mrKey, poUpdatePayload).catch(() => {});
        await dbModule.update('inspection_checklist', 'mr_no', mrKey, poUpdatePayload).catch(() => {});
        await dbModule.update('inspection_checklist', 'arrival_no', mrKey, poUpdatePayload).catch(() => {});
      }

      // 3. Update sauda_check_point & purchase_master (if columns exist)
      await dbModule.update('sauda_check_point', 'po_no', poNo, { 
        mr_no: faNo, 
        final_arrival_no: faNo 
      }).catch(() => {});
      await dbModule.update('sauda_check_point', 'ptf_no', poNo, { 
        mr_no: faNo, 
        final_arrival_no: faNo 
      }).catch(() => {});

      await dbModule.update('purchase_master', 'po_no', poNo, { 
        mr_no: faNo, 
        final_arrival_no: faNo 
      }).catch(() => {});

      // 4. Record in persistent history table (`clubbed_pomr` uses UUID `id` and required `club_id`, `primary_po_no`)
      const newClubRecord: ClubbingRecord = {
        id: clubId,
        clubbedAt: clubbedDate,
        supplier: supplierName,
        poNos: [poNo],
        amadNos: [faNo],
        totalPoWeight: poWeightMt,
        totalReceivedWeight: faWeightMt,
        variancePct: variance,
        recordedBy: 'LEVEL-4-USER',
        remarks: remarks || `Bound Final Arrival ${faNo} with P.O / PTF ${poNo}`
      };

      await dbModule.insert('clubbed_pomr', {
        club_id: clubId,
        primary_po_no: poNo,
        clubbed_po_nos: [poNo],
        primary_mr_no: faNo,
        clubbed_mr_nos: [faNo],
        total_weight_mt: faWeightMt,
        po_no: poNo,
        mr_no: faNo,
        po_nos: JSON.stringify([poNo]),
        amad_nos: JSON.stringify([faNo]),
        supplier: supplierName,
        total_po_weight: poWeightMt,
        total_received_weight: faWeightMt,
        variance_pct: variance,
        recorded_by: 'LEVEL-4-USER',
        clubbed_by: 'LEVEL-4-USER',
        clubbed_at: new Date().toISOString(),
        remarks: newClubRecord.remarks,
        status: 'ACTIVE'
      }).catch(() => {});

      // Update local state by removing bound items
      setUnboundFinalArrivals(prev => prev.filter(fa => (fa.final_arrival_no || fa.mr_no) !== faNo));
      setUnboundPOs(prev => prev.filter(po => (po.po_no || po.ptf_no) !== poNo));
      setClubbingHistory(prev => {
        const filtered = prev.filter(item => item.id !== clubId && !item.amadNos.includes(faNo));
        return [newClubRecord, ...filtered];
      });

      setSuccessToast(`Successfully bound Final Arrival #${faNo} with P.O / PTF #${poNo}! Updated Temporary Arrival, Mill Inspection & Final Arrival.`);

      // Reset modal state
      setSelectedArrivalForBind(null);
      setChosenPoForBind(null);
      setRemarks('');
      setShowAllPOsInModal(false);

      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error('Error executing voucher binding:', err);
      alert(`Failed to execute binding: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete pairing record from database
  const deleteClubItem = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this pairing record from history?")) return;
    try {
      await dbModule.delete('clubbed_pomr', 'club_id', id).catch(() => {});
      await dbModule.delete('clubbed_pomr', 'id', id).catch(() => {});
      setClubbingHistory(prev => prev.filter(c => c.id !== id));
      setSuccessToast(`Pairing record #${id} removed.`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      console.error("Delete pairing error:", err);
      alert("Failed to delete pairing record: " + (err.message || err));
    }
  };

  // Filtered list inside Binding Modal based on Broker and Area matching
  const getMatchingPOsForModal = () => {
    if (!selectedArrivalForBind) return [];
    if (showAllPOsInModal) return unboundPOs;

    const arrBroker = normalize(selectedArrivalForBind.broker || selectedArrivalForBind.broker_name);
    const arrArea = normalize(selectedArrivalForBind.area || selectedArrivalForBind.arrival_area_name || selectedArrivalForBind.arrival_yard);

    return unboundPOs.filter(po => {
      const poBroker = normalize(po.broker || po.broker_name);
      const poArea = normalize(po.area || po.arrival_area_name || po.arrival_yard || po.area_name);

      const brokerMatch = !arrBroker || !poBroker || poBroker === arrBroker;
      const areaMatch = !arrArea || !poArea || poArea === arrArea;

      return brokerMatch && areaMatch;
    });
  };

  // Filtered UI Search
  const filteredArrivals = unboundFinalArrivals.filter(fa => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(fa.final_arrival_no || '').toLowerCase().includes(q) ||
      String(fa.supplier || '').toLowerCase().includes(q) ||
      String(fa.broker || '').toLowerCase().includes(q) ||
      String(fa.area || fa.arrival_area_name || '').toLowerCase().includes(q) ||
      String(fa.challan_rr_no || '').toLowerCase().includes(q)
    );
  });

  return (
    <LegacyLayout title="Club P.O & Arrival Section" subtitle="Match & Bind Open Final Arrivals with Sauda Check Point Contracts">
      <div className="space-y-6 max-w-full px-1 sm:px-4 text-left font-sans">
        
        {/* Top Control Header */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  LEVEL 4 AUTHORIZED
                </span>
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Binding Console</span>
              </div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide mt-1 flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600" />
                <span>Untagged Arrivals & P.O Matching Console</span>
              </h2>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
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
              <div className="relative flex-1 md:w-56">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search No, Broker, Yard..."
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
                <RefreshCw className={cn("h-3.5 w-3.5 text-indigo-700", loading && "animate-spin")} />
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

        {/* Untagged Final Arrivals Workspace */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-3">
          <div className="border-b border-slate-100 pb-2.5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Untagged Final Arrivals</h3>
                <p className="text-[9px] font-semibold text-slate-400 uppercase">Lorry arrivals awaiting P.O / PTF linkage</p>
              </div>
            </div>
            <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              {filteredArrivals.length} Untagged
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
            {filteredArrivals.length === 0 ? (
              <div className="col-span-full p-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">No Untagged Final Arrival Records Found</p>
                <p className="text-[9.5px] font-semibold text-slate-400 mt-1">All lorry final arrivals are fully bound with P.O contracts</p>
              </div>
            ) : (
              filteredArrivals.map((mr, idx) => {
                const faNo = mr.final_arrival_no || mr.mr_no || `FA-${idx+1}`;
                const weightMt = mr.weight_qtl ? (parseFloat(mr.weight_qtl) / 10).toFixed(2) : '0.00';
                
                return (
                  <div
                    key={faNo || idx}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md bg-white transition-all group relative space-y-2"
                  >
                    {/* Card Header */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black font-mono text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            FA No: {faNo}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">
                            Date: {mr.date || mr.final_arrival_date || 'N/A'}
                          </span>
                        </div>
                        <p className="text-[10.5px] font-black text-slate-900 uppercase mt-1">
                          Supplier: {mr.supplier || mr.challan_supplier || 'N/A'}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-slate-900 block font-mono">
                          {weightMt} MT
                        </span>
                        <span className="text-[8.5px] font-bold text-slate-400 uppercase block">
                          {mr.total_packets || mr.packets || '0'} Bales
                        </span>
                      </div>
                    </div>

                    {/* Broker & Arrival Yard Info Badges */}
                    <div className="grid grid-cols-2 gap-2 text-[9.5px] font-bold bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Broker Name:</span>
                        <span className="text-slate-900 uppercase font-black truncate block">
                          {mr.broker || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Arrival Yard:</span>
                        <span className="text-indigo-900 uppercase font-black truncate block">
                          {mr.area || mr.arrival_area_name || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Transport details & Bind Button */}
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100 gap-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[200px]">
                        Lorry: {mr.lorry_number || mr.lorry_no || mr.vehicle_no || 'N/A'} • Challan: {mr.challan_rr_no || 'N/A'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedDetailMr(mr)}
                          className="px-2 py-1 text-[9px] font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 uppercase transition"
                        >
                          Details
                        </button>
                        
                        <button
                          onClick={() => {
                            setSelectedArrivalForBind(mr);
                            setChosenPoForBind(null);
                            setShowAllPOsInModal(false);
                          }}
                          className="px-3 py-1 bg-indigo-700 hover:bg-indigo-800 text-white font-black text-[9.5px] uppercase tracking-wider rounded-lg shadow-xs hover:shadow transition flex items-center gap-1 cursor-pointer"
                        >
                          <span>Bind P.O / PTF</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Historical Voucher Pairings Register Table (Bottom Panel) */}
        <div className="bg-white border border-slate-200 p-4.5 rounded-xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Historical Bound Voucher Pairings Register</h3>
            </div>
            
            <button 
              onClick={() => {
                const csvContent = "data:text/csv;charset=utf-8," 
                  + ["Binding ID,Date,Supplier,POs Included,Arrivals Included,Total Contract weight,Total Received weight,Deviation %"]
                    .concat(clubbingHistory.map(c => 
                      `"${c.id}","${c.clubbedAt}","${c.supplier}","${c.poNos.join(';') || ''}","${c.amadNos.join(';') || ''}","${c.totalPoWeight}","${c.totalReceivedWeight}","${c.variancePct.toFixed(2)}"`
                    )).join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `BJCL-Bound-Vouchers-Ledger-${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-extrabold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Bindings Ledger</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                  <th className="p-3">Reference ID</th>
                  <th className="p-3 font-mono">Date</th>
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3 text-center">P.O / PTF Bound</th>
                  <th className="p-3 text-center">Final Arrival Bound</th>
                  <th className="p-3 text-right">PO Weight</th>
                  <th className="p-3 text-right">Arrival Weight</th>
                  <th className="p-3 text-center">Variance %</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clubbingHistory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 uppercase tracking-wider font-extrabold text-[10px]">
                      No historical voucher pairings established yet
                    </td>
                  </tr>
                ) : (
                  clubbingHistory.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition text-slate-800">
                      <td className="p-3 font-black text-slate-900 uppercase">
                        {item.id}
                      </td>
                      <td className="p-3 font-mono text-[10.5px]">
                        {item.clubbedAt}
                      </td>
                      <td className="p-3 font-bold text-[11px] uppercase">
                        {item.supplier}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {item.poNos.map(p => (
                            <span key={p} className="text-[8.5px] font-extrabold bg-emerald-50 text-emerald-900 border border-emerald-200 px-1.5 py-0.5 rounded">
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {item.amadNos.map(a => (
                            <span key={a} className="text-[8.5px] font-extrabold bg-indigo-50 text-indigo-900 border border-indigo-200 px-1.5 py-0.5 rounded">
                              {a}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right font-semibold font-mono">
                        {item.totalPoWeight.toFixed(2)} MT
                      </td>
                      <td className="p-3 text-right font-black text-slate-900 font-mono">
                        {item.totalReceivedWeight.toFixed(2)} MT
                      </td>
                      <td className="p-3 text-center font-bold">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black border",
                          item.variancePct > 0 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : 
                          item.variancePct < 0 ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-slate-50 text-slate-800 border-slate-200"
                        )}>
                          {item.variancePct > 0 ? '+' : ''}{item.variancePct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => setPrintingClub(item)}
                            className="p-1.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 rounded transition cursor-pointer"
                            title="Print binding invoice"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteClubItem(item.id)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-700 rounded transition cursor-pointer"
                            title="Delete pairing"
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

          <div className="mt-2">
            <PaginationControls
              currentPage={currentPage}
              totalItems={clubbingHistory.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>

      </div>

      {/* POPUP MODAL: SELECT P.O / PTF TO BIND (Triggered when clicking "Bind P.O / PTF" on Left Side) */}
      {selectedArrivalForBind && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-indigo-200 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col font-sans overflow-hidden max-h-[92vh] animate-in fade-in zoom-in duration-150">
            
            {/* Modal Header */}
            <div className="bg-indigo-950 text-white p-4 flex justify-between items-center px-6 border-b border-indigo-900">
              <div className="flex items-center gap-2.5">
                <Link className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Select P.O / PTF Contract for Binding</h3>
                  <p className="text-[9.5px] text-indigo-200 font-mono uppercase tracking-tight mt-0.5">
                    Matching by Broker Name & Arrival Yard
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSelectedArrivalForBind(null);
                  setChosenPoForBind(null);
                }}
                className="p-1 text-slate-300 hover:text-white hover:bg-indigo-900/50 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-800 bg-slate-50/50">
              
              {/* Selected Final Arrival Header Card */}
              <div className="bg-white border-2 border-indigo-100 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b border-indigo-50 pb-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600">Selected Final Arrival Lorry</span>
                  <span className="text-[10px] font-mono font-extrabold text-slate-500">FA No: {selectedArrivalForBind.final_arrival_no || selectedArrivalForBind.mr_no}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                  <div>
                    <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Supplier</span>
                    <strong className="text-slate-900 uppercase text-[11px] block mt-0.5">{selectedArrivalForBind.supplier || selectedArrivalForBind.challan_supplier || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Broker Name</span>
                    <strong className="text-indigo-900 uppercase text-[11px] block mt-0.5 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 inline-block">{selectedArrivalForBind.broker || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Arrival Yard</span>
                    <strong className="text-indigo-900 uppercase text-[11px] block mt-0.5 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 inline-block">{selectedArrivalForBind.area || selectedArrivalForBind.arrival_area_name || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Net Weight</span>
                    <strong className="text-slate-900 font-mono text-xs block mt-0.5">{(parseFloat(selectedArrivalForBind.weight_qtl || '0') / 10).toFixed(2)} MT</strong>
                  </div>
                </div>
              </div>

              {/* Matching Criteria Status Banner */}
              <div className="flex justify-between items-center bg-indigo-50/80 border border-indigo-200 p-3 rounded-xl">
                <div className="text-[10.5px] font-bold text-indigo-950">
                  Showing unbound P.O / PTF contracts matching Broker: <span className="font-black underline">{selectedArrivalForBind.broker || 'ANY'}</span> & Yard: <span className="font-black underline">{selectedArrivalForBind.area || selectedArrivalForBind.arrival_area_name || 'ANY'}</span>
                </div>
                
                <button
                  onClick={() => setShowAllPOsInModal(!showAllPOsInModal)}
                  className="text-[9.5px] font-extrabold text-indigo-700 hover:text-indigo-900 underline uppercase cursor-pointer"
                >
                  {showAllPOsInModal ? "Strict Filter Match Only" : "Show All Unbound Contracts"}
                </button>
              </div>

              {/* Matching Unbound P.O List */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Select One P.O / PTF Contract To Bind:</h4>
                
                {(() => {
                  const matchingPOs = getMatchingPOsForModal();
                  
                  if (matchingPOs.length === 0) {
                    return (
                      <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-200 space-y-2">
                        <p className="text-[11px] font-black text-rose-600 uppercase">No Unbound P.O / PTF Contracts Match Both Broker & Yard</p>
                        <p className="text-[10px] text-slate-500 font-semibold">
                          Broker "{selectedArrivalForBind.broker || 'N/A'}" and Area "{selectedArrivalForBind.area || selectedArrivalForBind.arrival_area_name || 'N/A'}"
                        </p>
                        <button
                          onClick={() => setShowAllPOsInModal(true)}
                          className="mt-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold text-[10px] uppercase rounded-lg hover:bg-indigo-100 transition"
                        >
                          View All Unbound P.O Contracts
                        </button>
                      </div>
                    );
                  }

                  return matchingPOs.map((po, idx) => {
                    const poNo = po.po_no;
                    const isSelected = chosenPoForBind?.po_no === poNo;

                    return (
                      <div
                        key={poNo || idx}
                        onClick={() => setChosenPoForBind(po)}
                        className={cn(
                          "p-3.5 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center gap-3",
                          isSelected
                            ? "bg-indigo-950 text-white border-indigo-950 shadow-md"
                            : "bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20"
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-xs font-black font-mono",
                              isSelected ? "text-indigo-200" : "text-indigo-950"
                            )}>
                              P.O / PTF: {poNo}
                            </span>
                            <span className={cn(
                              "text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded",
                              isSelected ? "bg-indigo-800 text-indigo-100" : "bg-slate-100 text-slate-600"
                            )}>
                              Date: {po.date || po.sauda_date || 'N/A'}
                            </span>
                          </div>

                          <p className={cn(
                            "text-[10px] font-bold uppercase",
                            isSelected ? "text-slate-200" : "text-slate-800"
                          )}>
                            Supplier: {po.supplier || 'N/A'}
                          </p>

                          <div className="flex items-center gap-3 text-[9px] font-semibold opacity-90 pt-0.5">
                            <span>Broker: <strong>{po.broker || 'N/A'}</strong></span>
                            <span>Yard: <strong>{po.area || po.arrival_area_name || po.arrival_yard || 'N/A'}</strong></span>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end gap-1">
                          <span className={cn(
                            "text-xs font-black font-mono",
                            isSelected ? "text-white" : "text-slate-900"
                          )}>
                            {po.total_contract_mt ? `${po.total_contract_mt.toFixed(2)} MT` : '0.00 MT'}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setChosenPoForBind(po);
                            }}
                            className={cn(
                              "px-2.5 py-1 text-[9px] font-black uppercase rounded transition border cursor-pointer",
                              isSelected
                                ? "bg-emerald-500 text-white border-emerald-400"
                                : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                            )}
                          >
                            {isSelected ? "Selected" : "Select"}
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Remarks Box */}
              <div className="space-y-1 pt-2">
                <label className="text-[9.5px] font-extrabold uppercase text-slate-500 block">Binding Sign-off Remarks:</label>
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
                  "px-6 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-black uppercase text-[10.5px] tracking-wider rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer",
                  (!chosenPoForBind || loading) && "opacity-50 cursor-not-allowed hover:bg-indigo-700"
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm & Bind Vouchers</span>
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
                  <p className="text-[9px] font-mono opacity-65 uppercase mt-0.5">FA No: {selectedDetailMr.final_arrival_no || selectedDetailMr.mr_no}</p>
                </div>
              </div>
              <button onClick={() => setSelectedDetailMr(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-800 bg-slate-50/50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Arrival No</span>
                  <span className="font-mono font-black text-sm text-slate-900">{selectedDetailMr.final_arrival_no || selectedDetailMr.mr_no || 'N/A'}</span>
                </div>
                <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Date</span>
                  <span className="font-mono font-black text-xs text-slate-900">{selectedDetailMr.date || selectedDetailMr.final_arrival_date || 'N/A'}</span>
                </div>
                <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Net Weight</span>
                  <span className="font-mono font-black text-xs text-indigo-700">{(parseFloat(selectedDetailMr.weight_qtl || '0') / 10).toFixed(2)} MT</span>
                </div>
                <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Packets / Bales</span>
                  <span className="font-mono font-black text-xs text-emerald-700">{selectedDetailMr.total_packets || selectedDetailMr.packets || '0'}</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                <h4 className="text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 pb-1">Supplier & Logistics Identification</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[8.5px] font-extrabold text-slate-400 uppercase block">Supplier Name</span>
                    <strong className="uppercase text-slate-900 text-xs block">{selectedDetailMr.supplier || selectedDetailMr.challan_supplier || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-extrabold text-slate-400 uppercase block">Broker Name</span>
                    <strong className="uppercase text-slate-900 text-xs block">{selectedDetailMr.broker || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-extrabold text-slate-400 uppercase block">Arrival Yard</span>
                    <strong className="uppercase text-indigo-900 text-xs block">{selectedDetailMr.area || selectedDetailMr.arrival_area_name || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-extrabold text-slate-400 uppercase block">Vehicle / Lorry</span>
                    <strong className="uppercase text-slate-900 text-xs block">{selectedDetailMr.lorry_number || selectedDetailMr.lorry_no || selectedDetailMr.vehicle_no || 'N/A'}</strong>
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
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-black uppercase text-[10px] tracking-wider rounded-lg transition"
              >
                Bind This Arrival
              </button>
              <button
                onClick={() => setSelectedDetailMr(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold uppercase text-[10px] tracking-wider rounded-lg transition"
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
              <h2 className="text-sm font-black uppercase text-slate-900">MILL INTEGRATED MANAGEMENT</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">VOUCHERS ASSOCIATION REPORT</p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3 text-slate-700">
              <div>
                <p><span className="font-extrabold uppercase text-[9px] text-slate-400 block tracking-wider">BINDING REFERENCE ID</span> <strong>{printingClub.id}</strong></p>
                <p className="mt-2"><span className="font-extrabold uppercase text-[9px] text-slate-400 block tracking-wider">DATE ESTABLISHED</span> {printingClub.clubbedAt}</p>
              </div>
              <div className="text-right">
                <p><span className="font-extrabold uppercase text-[9px] text-slate-400 block tracking-wider">SUPPLIER ACCOUNT</span> <strong className="uppercase text-[11px] text-slate-900">{printingClub.supplier}</strong></p>
                <p className="mt-2"><span className="font-extrabold uppercase text-[9px] text-slate-400 block tracking-wider">AUDITED BY</span> {printingClub.recordedBy}</p>
              </div>
            </div>

            <div>
              <h4 className="font-extrabold uppercase text-[9px] text-slate-400 tracking-wider mb-2">Mapped Vouchers Inventory</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50/50">
                  <span className="font-bold text-[9px] text-slate-450 block uppercase">P.O / PTF Contracts</span>
                  <p className="font-mono mt-1 font-semibold text-slate-800 leading-relaxed">
                    {printingClub.poNos.join(', ')}
                  </p>
                </div>
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50/50">
                  <span className="font-bold text-[9px] text-slate-450 block uppercase">Final Arrivals</span>
                  <p className="font-mono mt-1 font-semibold text-slate-800 leading-relaxed">
                    {printingClub.amadNos.join(', ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-b border-slate-200 py-3 mt-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase block">PO Contract WT</span>
                  <span className="text-xs font-black text-slate-800 block mt-0.5">{printingClub.totalPoWeight.toFixed(2)} MT</span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Arrival Gate WT</span>
                  <span className="text-xs font-black text-slate-800 block mt-0.5">{printingClub.totalReceivedWeight.toFixed(2)} MT</span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Variance %</span>
                  <span className={cn(
                    "text-xs font-black block mt-0.5",
                    printingClub.variancePct > 0 ? "text-emerald-600" : printingClub.variancePct < 0 ? "text-rose-500" : "text-slate-600"
                  )}>
                    {printingClub.variancePct > 0 ? '+' : ''}{printingClub.variancePct.toFixed(2)}%
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
