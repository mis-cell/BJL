import { getPaddedDetails, calculateProportionalNetto } from "../utils/temporaryArrivalCalculations";
import { TemporaryArrivalGrid } from "../components/temporary-arrival/TemporaryArrivalGrid";
import { TemporaryArrivalWeightCard } from "../components/temporary-arrival/TemporaryArrivalWeightCard";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveAutoRefresh, notifyDataChanged } from '../hooks/useLiveAutoRefresh';
import { getAgenciesForArea, getUniqueAgenciesForArea, validateAreaAgencyCombination } from '../services/areaLogicService';
import { 
  Save, 
  X, 
  Plus, 
  Trash2,
  RefreshCw,
  Archive,
  ChevronDown,
  ArrowLeft,
  Lock,
  Unlock,
  AlertTriangle
} from 'lucide-react';
import { cn, sanitizeDate } from '../lib/utils';
import { Amad, ArrivalDetailRow } from '../types';
import { dbModule } from '../services/dbModule';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { supabase } from '../lib/supabase';
import { enforceEditOrDeletePermission, getCurrentUserContext } from '../lib/permissions';
import { screenDraftService } from '../services/screenDraftService';

export default function TemporaryArrival({ onSave, onCancel, initialData }: { onSave?: (d: any) => void; onCancel?: () => void; initialData?: Amad }) {
  const [loading, setLoading] = useState(false);
  const [showPoDropdown, setShowPoDropdown] = useState(false);
  const [closedSaudaMap, setClosedSaudaMap] = useState<Map<string, { po_no: string; sauda_no?: string; contractLorries: number; receivedLorries: number; isClosed: boolean }>>(new Map());

  const amadContainerRef = useRef<HTMLDivElement>(null);
  useKeyboardNavigation(amadContainerRef, () => {
    handleSave();
  });
  const [brokers, setBrokers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [markas, setMarkas] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  const [details, setDetails] = useState<ArrivalDetailRow[]>(() => {
    if (initialData) return getPaddedDetails(initialData);
    return screenDraftService.getDraft('amad_entry_details', getPaddedDetails(initialData));
  });
  const [unitList, setUnitList] = useState<string[]>(['BALES', 'DRUMS', 'LOOSE', 'P.BALES', 'H.BALES']);

  const emptyDetailRow = (): ArrivalDetailRow => ({
    quality: '',
    agency: '',
    marka: '',
    bales: 0,
    wt: 0
  } as any);

  const handleAddRow = () => {
    setDetails(prev => [
      ...prev,
      {
        srl_no: prev.length + 1,
        receipt_grade_code: '',
        receipt_grade_name: '',
        crop_year: '2026-27',
        challan_grade_name: '',
        agency_code: '',
        agency_name: '',
        challan_marka_code: '',
        challan_marka_name: '',
        netto_pnto: 0,
        quantity_chln: 0,
        quantity_rcpt: 0,
        remarks: ''
      }
    ]);
  };

  const handleDeleteRow = () => {
    setDetails(prev => {
      if (prev.length <= 1) return prev;
      const copy = prev.slice(0, -1);
      return copy.map((row, idx) => ({ ...row, srl_no: idx + 1 }));
    });
  };

  const handleDeleteRowAt = (index: number) => {
    setDetails(prev => {
      if (prev.length <= 1) {
        return [{
          srl_no: 1,
          receipt_grade_code: '',
          receipt_grade_name: '',
          crop_year: '2026-27',
          challan_grade_name: '',
          agency_code: '',
          agency_name: '',
          challan_marka_code: '',
          challan_marka_name: '',
          netto_pnto: 0,
          quantity_chln: 0,
          quantity_rcpt: 0,
          remarks: ''
        }];
      }
      const copy = prev.filter((_, idx) => idx !== index);
      return copy.map((row, idx) => ({ ...row, srl_no: idx + 1 }));
    });
  };

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
        console.warn("Failed to fetch unit_master in AmadEntry", err);
      }
    }
    loadUnits();
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const parseLorry = (lorry?: string) => {
    let prefix = '';
    let suffix = '';
    if (lorry) {
      const parts = lorry.split('-');
      if (parts.length > 1) {
        prefix = parts[0];
        suffix = parts.slice(1).join('-');
      } else {
        prefix = lorry;
      }
    }
    return { prefix, suffix };
  };

  const createDefaultFormData = (data?: any) => {
    const lorryInfo = parseLorry(data?.lorry_number || (data as any)?.lorry_no || (data as any)?.vehicle_no);
    return {
      financial_year: data?.financial_year || '2026-2027',
      arrival_no: data?.temporary_arrival_no || data?.amad_no || 'AR0',
      po_no: data?.po_no || '',
      date: data?.date || '',
      jci: data?.jci || 'No',
      challan_supplier: (data?.challan_supplier || '').toUpperCase(),
      supplier: (data?.supplier || '').toUpperCase(),
      broker: (data?.broker || '').toUpperCase(),
      transporter_name: data?.transporter_name || '',
      challan_rr_no: data?.challan_rr_no || data?.challan_railway_receipt_no || '',
      challan_railway_receipt_no: data?.challan_railway_receipt_no || data?.challan_rr_no || '',
      lorry_prefix: lorryInfo.prefix,
      lorry_suffix: lorryInfo.suffix,
      pan_no: data?.pan_no || '',
      lorry_date: data?.lorry_date || '',
      consignment_note: data?.consignment_note || data?.consignment_note_no || '',
      consignment_note_no: data?.consignment_note || data?.consignment_note_no || '',
      di_no: data?.di_no || '',
      di_date: data?.di_date || '',
      invoice_no: data?.invoice_no || '',
      invoice_date: data?.invoice_date || '',
      ptf: data?.ptf || 'No',
      lorry_returned: data?.lorry_returned || 'No',
      lorry_returned_other_mill: data?.lorry_returned_other_mill || 'No',
      arrival_area_code: data?.arrival_area_code || '',
      arrival_area_name: (data?.arrival_area_name || '').toUpperCase(),
      unit_code: data?.unit_code || 'I',
      unit_name: data?.unit_name || 'BALES',
      way_bill_no: data?.way_bill_no || '',
      way_bill_date: data?.way_bill_date || '',
      apmc_fees: Number(data?.apmc_fees ?? (data as any)?.arival_apmc_fees ?? 0),
      remarks: data?.remarks || '',

      // Bottom weights
      challan_material_weight: data?.challan_material_weight || 0,
      actual_gross_weight: data?.actual_gross_weight || 0,
      actual_tare_weight: data?.actual_tare_weight || 0,
      supplier_net_weight: data?.supplier_net_weight || 0,
      supplier_challan_gross: data?.supplier_challan_gross || 0,
      supplier_tare_weight: data?.supplier_tare_weight || 0,
      electronic_net_weight: data?.electronic_net_weight || 0,
      electronic_gross_weight: data?.electronic_gross_weight || 0,
      electronic_tare_weight: data?.electronic_tare_weight || 0,
      weight_reduced: data?.weight_reduced || 0
    };
  };



  const [formData, setFormData] = useState(() => {
    const defaultData = createDefaultFormData(initialData);
    if (initialData) return defaultData;
    const draft = screenDraftService.getDraft('amad_entry_form', defaultData);
    if (!draft.arrival_no || draft.arrival_no === 'MR') {
      draft.arrival_no = 'AR0';
    }
    return draft;
  });

  const filteredArrivalAgencies = useMemo(() => {
    const currentArea = (formData.arrival_area_name || formData.arrival_area_code || '').trim();
    if (!currentArea) return [];
    return getUniqueAgenciesForArea(currentArea);
  }, [formData.arrival_area_name, formData.arrival_area_code]);

  useEffect(() => {
    if (initialData) {
      setFormData(createDefaultFormData(initialData));
    } else {
      screenDraftService.clearDraft('amad_entry_form');
      screenDraftService.clearDraft('amad_entry_details');
      setFormData(createDefaultFormData());
      setDetails([emptyDetailRow()]);
    }
  }, [initialData]);

  useEffect(() => {
    if (!initialData && formData) {
      screenDraftService.saveDraft('amad_entry_form', formData);
      screenDraftService.saveDraft('amad_entry_details', details);
    }
  }, [formData, details, initialData]);

  const fetchPurchaseOrders = async () => {
    try {
      const [scpRes, amadRes, faRes] = await Promise.all([
        supabase ? supabase.from('sauda_check_point').select('*').order('created_at', { ascending: false }) : dbModule.fetchAll('sauda_check_point', 'created_at', false).then(d => ({ data: d, error: null })),
        supabase ? supabase.from('temporary_material_received').select('*') : dbModule.fetchAll('temporary_material_received').then(d => ({ data: d, error: null })),
        supabase ? supabase.from('final_arrival').select('*') : dbModule.fetchAll('final_arrival').then(d => ({ data: d, error: null }))
      ]);

      const amadList = amadRes?.data || [];
      const faList = faRes?.data || [];
      const tempPoData = (scpRes?.data || []).map((po: any) => ({ ...po, status: po.status || 'temp', sourceTable: 'sauda_check_point' }));

      // Deduplicate by po_no from sauda_check_point
      const uniqueMap = new Map<string, any>();
      tempPoData.forEach((po: any) => {
        if (po && po.po_no) {
          const key = String(po.po_no).trim().toUpperCase();
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, po);
          }
        }
      });

      const cleanVal = (v: any) => String(v || '').trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
      const NON_PO_TOKENS = new Set([
        '', '20262027', '20252026', '202627', '202526', 'normal', 'special',
        'pending', 'temp', 'final', 'finalpo', 'direct', 'no', 'yes', 'mr', 'bales', 'loose'
      ]);

      const extractCanonicalPoSerial = (raw: any): string => {
        const str = String(raw || '').trim().toUpperCase();
        if (!str) return '';
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

      const isSamePoIdentifier = (a: any, b: any): boolean => {
        const rawA = String(a || '').trim().toUpperCase();
        const rawB = String(b || '').trim().toUpperCase();
        if (!rawA || !rawB) return false;
        const cleanA = cleanVal(rawA);
        const cleanB = cleanVal(rawB);
        if (NON_PO_TOKENS.has(cleanA) || NON_PO_TOKENS.has(cleanB)) return false;
        if (rawA === rawB || cleanA === cleanB) return true;
        const serialA = extractCanonicalPoSerial(rawA);
        const serialB = extractCanonicalPoSerial(rawB);
        if (serialA && serialB && !NON_PO_TOKENS.has(serialA.toLowerCase()) && serialA === serialB) {
          return true;
        }
        return false;
      };

      const matchPoRecord = (po: any, rec: any): boolean => {
        if (!po || !rec) return false;
        const pCandidates = [
          po.po_no,
          po.contract_po_no,
          po.ptf_no,
          po.sauda_no,
          po.contract_no
        ].filter(Boolean);

        const rCandidates = [
          rec.po_no,
          rec.mill_po_no,
          rec.contract_po_no,
          rec.sauda_no,
          rec.contract_no,
          rec.ptf_no
        ].filter(Boolean);

        for (const pk of pCandidates) {
          for (const rk of rCandidates) {
            if (isSamePoIdentifier(pk, rk)) return true;
          }
        }
        return false;
      };

      const uniquePos = Array.from(uniqueMap.values());
      const nextClosedMap = new Map<string, { po_no: string; sauda_no?: string; contractLorries: number; receivedLorries: number; isClosed: boolean }>();

      const filtered = uniquePos
        .filter((po: any) => {
          if (!po.po_no) return false;
          const poKey = String(po.po_no).trim().toUpperCase();
          const saudaKey = String(po.sauda_no || po.contract_po_no || '').trim().toUpperCase();
          const statusLower = String(po.status || '').trim().toLowerCase();

          const isCancelled = statusLower === 'cancelled' || 
                              po.is_cancelled === true || 
                              localStorage.getItem(`sauda_cancelled_${poKey}`) === 'true' ||
                              (saudaKey && localStorage.getItem(`sauda_cancelled_${saudaKey}`) === 'true');
          if (isCancelled) return false;

          const isCurrentMatch = initialData && initialData.po_no && (
            isSamePoIdentifier(initialData.po_no, po.po_no) ||
            (saudaKey && isSamePoIdentifier(initialData.po_no, saudaKey))
          );

          let parsedOpenRemarks = po.open_remarks;
          if (typeof parsedOpenRemarks === 'string') {
            try { parsedOpenRemarks = JSON.parse(parsedOpenRemarks); } catch (e) { parsedOpenRemarks = null; }
          }
          if (!parsedOpenRemarks) {
            try {
              const localRemarks = localStorage.getItem(`sauda_open_remarks_${poKey}`) || (saudaKey ? localStorage.getItem(`sauda_open_remarks_${saudaKey}`) : null);
              if (localRemarks) parsedOpenRemarks = JSON.parse(localRemarks);
            } catch (e) {}
          }

          const isForceClosedLocal = localStorage.getItem(`sauda_closed_${poKey}`) === 'true' ||
                                     (saudaKey ? localStorage.getItem(`sauda_closed_${saudaKey}`) === 'true' : false);
          const isReopenedLocal = localStorage.getItem(`sauda_reopened_${poKey}`) === 'true' ||
                                  (saudaKey ? localStorage.getItem(`sauda_reopened_${saudaKey}`) === 'true' : false);

          // 1. Check if explicitly reopened by Level 4 or Admin (identical to Sauda Check Point)
          const isExplicitReopened = !isCancelled && !isForceClosedLocal && statusLower !== 'closed' && (
                                     po.is_reopened === true || 
                                     po.reopened === true || 
                                     statusLower === 'open' ||
                                     Boolean(parsedOpenRemarks && typeof parsedOpenRemarks === 'object' && Object.keys(parsedOpenRemarks).length > 0) ||
                                     isReopenedLocal
          );

          // 2. Check if explicitly closed
          const isExplicitClosed = !isExplicitReopened && (
                                   po.is_closed === true || 
                                   po.sauda_closed === true || 
                                   statusLower === 'closed' || 
                                   isForceClosedLocal
          );

          // 3. Contract lorries
          const contractLorries = Math.max(1, parseInt(po.total_lorries || po.total_no_of_lorries || po.no_of_lorries || po.lorries || 1, 10) || 1);

          // 4. Calculate received lorries from both temporary material received and final arrival (identical to Sauda Check Point)
          const faMatches = (faList || []).filter((f: any) => matchPoRecord(po, f));
          const amadMatches = amadList.filter((a: any) => matchPoRecord(po, a));

          const unpromotedAmad = amadMatches.filter((ar: any) =>
            !faMatches.some((f: any) =>
              (f.temporary_arrival_no && (ar.temporary_arrival_no || ar.amad_no) && String(f.temporary_arrival_no).trim().toUpperCase() === String(ar.temporary_arrival_no || ar.amad_no).trim().toUpperCase()) ||
              (f.arrival_no && (ar.temporary_arrival_no || ar.amad_no) && String(f.arrival_no).trim().toUpperCase() === String(ar.temporary_arrival_no || ar.amad_no).trim().toUpperCase()) ||
              (f.mr_no && (ar.temporary_arrival_no || ar.amad_no) && String(f.mr_no).trim().toUpperCase() === String(ar.temporary_arrival_no || ar.amad_no).trim().toUpperCase()) ||
              (f.lorry_number && ar.lorry_number && String(f.lorry_number).trim().toUpperCase() === String(ar.lorry_number).trim().toUpperCase())
            )
          );

          const receivedLorries = Math.max(amadMatches.length, faMatches.length + unpromotedAmad.length);

          const tempWeightOf = (ar: any) => {
            if (ar.challan_material_weight && Number(ar.challan_material_weight) > 0) return Number(ar.challan_material_weight);
            if (ar.weight_reduced && Number(ar.weight_reduced) > 0) return Number(ar.weight_reduced);
            if (ar.weight_qtl && Number(ar.weight_qtl) > 0) return Number(ar.weight_qtl) / 10;
            if (ar.weight && Number(ar.weight) > 0) return Number(ar.weight) / 10;
            return 0;
          };
          const finalWeightOf = (ar: any) => {
            if (ar.weight_qtl && Number(ar.weight_qtl) > 0) return Number(ar.weight_qtl) / 10;
            if (ar.weight && Number(ar.weight) > 0) return Number(ar.weight) / 10;
            if (ar.challan_material_weight && Number(ar.challan_material_weight) > 0) return Number(ar.challan_material_weight);
            return 0;
          };

          const totalReceivedMt = faMatches.reduce((sum: number, f: any) => sum + finalWeightOf(f), 0) +
                                  unpromotedAmad.reduce((sum: number, a: any) => sum + tempWeightOf(a), 0);

          const contractWeight = parseFloat(po.total_contract_mt) || 0;

          // Identical to Sauda Check Point: Sauda is considered closed if all contracted lorries have arrived or explicitly closed,
          // UNLESS explicitly reopened by Admin or Level 4 user.
          const isLorryClosed = contractLorries > 0 && receivedLorries >= contractLorries;
          const isClosed = !isExplicitReopened && (isExplicitClosed || isLorryClosed);

          if (isClosed) {
            const closedEntry = {
              po_no: String(po.po_no).trim(),
              sauda_no: (po.sauda_no || po.contract_po_no) ? String(po.sauda_no || po.contract_po_no).trim() : undefined,
              contractLorries,
              receivedLorries,
              contractWeight,
              receivedWeight: totalReceivedMt,
              isClosed: true
            };
            nextClosedMap.set(poKey, closedEntry);
            if (saudaKey) nextClosedMap.set(saudaKey, closedEntry);
          }

          if (isClosed && !isCurrentMatch) {
            return false;
          }

          return true;
        })
        .map((po: any) => {
          const poKey = String(po.po_no).trim().toUpperCase();
          const saudaKey = String(po.sauda_no || po.contract_po_no || '').trim().toUpperCase();
          const statusLower = String(po.status || '').trim().toLowerCase();

          let parsedOpenRemarks = po.open_remarks;
          if (typeof parsedOpenRemarks === 'string') {
            try { parsedOpenRemarks = JSON.parse(parsedOpenRemarks); } catch (e) { parsedOpenRemarks = null; }
          }
          if (!parsedOpenRemarks) {
            try {
              const localRemarks = localStorage.getItem(`sauda_open_remarks_${poKey}`) || (saudaKey ? localStorage.getItem(`sauda_open_remarks_${saudaKey}`) : null);
              if (localRemarks) parsedOpenRemarks = JSON.parse(localRemarks);
            } catch (e) {}
          }

          const isForceClosedLocal = localStorage.getItem(`sauda_closed_${poKey}`) === 'true' ||
                                     (saudaKey ? localStorage.getItem(`sauda_closed_${saudaKey}`) === 'true' : false);
          const isReopenedLocal = localStorage.getItem(`sauda_reopened_${poKey}`) === 'true' ||
                                  (saudaKey ? localStorage.getItem(`sauda_reopened_${saudaKey}`) === 'true' : false);

          const isExplicitReopened = !isForceClosedLocal && statusLower !== 'closed' && (
                                     po.is_reopened === true || 
                                     po.reopened === true || 
                                     statusLower === 'open' ||
                                     Boolean(parsedOpenRemarks && typeof parsedOpenRemarks === 'object' && Object.keys(parsedOpenRemarks).length > 0) ||
                                     isReopenedLocal
          );

          const contractLorries = Math.max(1, parseInt(po.total_lorries || po.total_no_of_lorries || po.no_of_lorries || po.lorries || 1, 10) || 1);

          const faMatches = (faList || []).filter((f: any) => matchPoRecord(po, f));
          const amadMatches = amadList.filter((a: any) => matchPoRecord(po, a));
          const unpromotedAmad = amadMatches.filter((ar: any) =>
            !faMatches.some((f: any) =>
              (f.temporary_arrival_no && (ar.temporary_arrival_no || ar.amad_no) && String(f.temporary_arrival_no).trim().toUpperCase() === String(ar.temporary_arrival_no || ar.amad_no).trim().toUpperCase()) ||
              (f.arrival_no && (ar.temporary_arrival_no || ar.amad_no) && String(f.arrival_no).trim().toUpperCase() === String(ar.temporary_arrival_no || ar.amad_no).trim().toUpperCase()) ||
              (f.mr_no && (ar.temporary_arrival_no || ar.amad_no) && String(f.mr_no).trim().toUpperCase() === String(ar.temporary_arrival_no || ar.amad_no).trim().toUpperCase()) ||
              (f.lorry_number && ar.lorry_number && String(f.lorry_number).trim().toUpperCase() === String(ar.lorry_number).trim().toUpperCase())
            )
          );
          const receivedLorries = Math.max(amadMatches.length, faMatches.length + unpromotedAmad.length);

          return {
            ...po,
            po_no: String(po.po_no).trim(),
            broker: (po.broker || '').toUpperCase(),
            supplier: (po.supplier || po.party_name || po.merchant || '').toUpperCase(),
            challan_supplier: (po.challan_supplier || po.supplier || po.party_name || po.merchant || '').toUpperCase(),
            area: (po.area || '').toUpperCase(),
            contract_lorries: contractLorries,
            received_lorries: receivedLorries,
            is_reopened: isExplicitReopened
          };
        });

      setClosedSaudaMap(nextClosedMap);
      setPurchaseOrders(filtered);
    } catch (err) {
      console.warn("Error in fetchPurchaseOrders from sauda_check_point:", err);
    }
  };

  useLiveAutoRefresh(fetchPurchaseOrders, [], { tables: ['temporary_material_received', 'sauda_check_point', 'sauda_check_point_details', 'purchase_master', 'purchase_detail_master', 'lorry_weighments', 'final_arrival'] });

  useEffect(() => {
    const handleSaudaStatusChange = () => {
      fetchPurchaseOrders();
    };
    window.addEventListener('storage', handleSaudaStatusChange);
    window.addEventListener('sauda_status_changed', handleSaudaStatusChange);
    return () => {
      window.removeEventListener('storage', handleSaudaStatusChange);
      window.removeEventListener('sauda_status_changed', handleSaudaStatusChange);
    };
  }, []);

  // Load master records and set up real-time PO query subscription
  useEffect(() => {
    async function loadMastersAndIncrement() {
      try {
        const [brokData, suppData, areaData, agcData, gradeData, markaData, allAmads] = await Promise.all([
          dbModule.fetchAll('broker_master').catch(() => []),
          dbModule.fetchAll('supply_master').catch(() => []),
          dbModule.fetchAll('area_master').catch(() => []),
          dbModule.fetchAll('agency_master').catch(() => []),
          dbModule.fetchAll('grade_master').catch(() => []),
          dbModule.fetchAll('marka_master').catch(() => []),
          dbModule.fetchAll('temporary_material_received').catch(() => [])
        ]);

        setBrokers((brokData || []).map((b: any) => ({ ...b, brok_name: (b.brok_name || '').toUpperCase() })));
        setSuppliers((suppData || []).map((s: any) => ({ ...s, supp_name: (s.supp_name || '').toUpperCase() })));
        setAreas((areaData || []).map((a: any) => ({ ...a, area_name: (a.area_name || '').toUpperCase() })));
        setAgencies(agcData || []);
        setGrades(gradeData || []);

        await fetchPurchaseOrders();

        let finalMarkas = markaData || [];
        if (finalMarkas.length === 0) {
          const fallbackNames = ["NO MARK", "SH", "CHANGE", "MJ", "BSP", "RT", "PUROHIT", "DB", "KK", "C.M", "BS", "IM", "NI", "RIEEM", "MAA", "V VISHNU", "KR", "SUNIL", "SARTAJ", "J.S.J", "PK", "ANAND", "RR", "HARI", "PS", "RS", "MR", "GOPAL", "A.P.J.S", "SUN", "SAHEB", "C.R.D", "SM", "SA", "AM", "RABI", "AD", "ML", "RK", "MUBIN", "AMAN", "SKB", "ANTIMA", "SHM", "JMP", "HM", "SN", "KT", "LN", "RAJU", "RA", "SS", "SR", "RAHA", "TT", "USHA", "OP", "ST", "PB", "SK", "BAHETI", "DR", "ROHIT", "BK", "KAMAL", "JM", "CHAIN", "SSB", "SANVI", "BR", "UDM", "JAYA", "MM", "SANGITA", "S", "HBGM", "DHRUV", "SD", "AS", "BALAJI", "AJAY", "SG", "GS", "SB", "RE", "JS", "RM", "RBT", "BD", "MS", "RAEEM", "TS", "TOSH", "LC", "SUMAN", "VANSH", "DK", "BHAWANI", "BP", "SHIV", "SHREE HARI", "A", "KS", "KJ", "VK", "JK", "ARHAM", "SOVA", "KM", "PRAMOD", "PUJA", "DURGA", "JSB", "NS", "JAY HANUMAN", "MB", "MANOJ", "SHUBHAM", "KISHAN", "JAY", "AX", "SKC", "YUNUS", "BIJOY", "BN", "A.J.P", "J/MU/DK", "J/MU/HP", "AP", "ANISH", "RISHAV", "SKS", "BUL BUL", "KEDIA", "SMB", "NAIZA", "MH", "BULBUL", "RAKHECHA", "R.JAIN", "MKC", "NC", "MRR", "P", "J.A.K.", "JAK", "GOBINDA", "RAM", "TULSI G", "PP", "HARI OM", "MOTI", "GK", "KRISHNA", "SANJOY", "AA", "MP", "TANU", "ASHA", "DNJ(BHOWMICK)", "SUMIT", "TULSI/H", "KP", "K.L.K", "SWASTIK", "JC", "PM", "BB", "GM", "SHREE"];
          // Try to async insert them to the DB so they are persistent
          try {
            await Promise.all(
              fallbackNames.map((name, i) => {
                const codeStr = String(i + 1).padStart(2, '0');
                return dbModule.insert('marka_master', { marka_code: codeStr, marka_name: name }).catch(() => null);
              })
            );
          } catch(e) {
            console.warn("Could not insert seed markas to DB:", e);
          }
          finalMarkas = fallbackNames.map((name, i) => ({
            id: i + 1,
            marka_code: String(i + 1).padStart(2, '0'),
            marka_name: name
          }));
        }
        setMarkas(finalMarkas);

        if (!initialData) {
          // Dynamic auto-increment to establish a clean reference voucher serial
          let nextNum = 168; // default base starting number
          if (allAmads && allAmads.length > 0) {
            let lastNum = 167;
            allAmads.forEach((a: any) => {
              const an = String(a.temporary_arrival_no || a.amad_no || '');
              const num = parseInt(an.replace(/[^0-9]/g, ''), 10);
              if (!isNaN(num) && num > lastNum) {
                lastNum = num;
              }
            });
            nextNum = lastNum + 1;
          }
          
          setFormData(prev => ({
            ...prev,
            arrival_no: initialData?.temporary_arrival_no || initialData?.amad_no || 'AR0',
            challan_supplier: '',
            supplier: '',
            agency_name: '',
            broker: '',
            arrival_area_name: '',
            arrival_area_code: ''
          }));
        }
      } catch (e) {
        console.error("Error loading master templates:", e);
      }
    }
    loadMastersAndIncrement();
  }, [initialData]);

  // Draft features disabled to ensure form is always a fresh blank form on click, per user request
  useEffect(() => {
    // Left empty intentionally to prevent restoring old drafts
  }, [initialData]);

  // Auto-match and pull weights and party info from lorry_weighments table based on Lorry Arrival Date & Lorry Number
  useEffect(() => {
    const lorryDateStr = (formData.lorry_date || '').trim();
    const lorryPrefix = (formData.lorry_prefix || '').trim();
    const lorrySuffix = (formData.lorry_suffix || '').trim();
    const combinedLorryClean = `${lorryPrefix}${lorrySuffix}`.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // BOTH Lorry Arrival Date AND Full Lorry Number (Prefix & Suffix) are MANDATORY before pulling data
    if (!lorryDateStr || !lorryPrefix || !lorrySuffix || !combinedLorryClean) return;

    let isMounted = true;

    const syncFromLorryWeighments = async () => {
      try {
        let rows: any[] = [];
        if (supabase) {
          const { data } = await supabase.from('lorry_weighments').select('*');
          rows = data || [];
        } else {
          rows = await dbModule.fetchAll('lorry_weighments').catch(() => []);
        }

        if (!rows || rows.length === 0 || !isMounted) return;

        // Exact match by entry_date (or date) and lorry_no (or lorry_number / vehicle_no)
        const matched = rows.find((r: any) => {
          const rDate = String(r.entry_date || r.date || r.created_at || '').split('T')[0].trim();
          const rLorryClean = String(r.lorry_no || r.lorry_number || r.vehicle_no || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

          const dateMatch = rDate === lorryDateStr;
          const lorryMatch = rLorryClean === combinedLorryClean;

          return dateMatch && lorryMatch;
        });

        if (matched && isMounted) {
          const formatToMT = (val: any): number => {
            if (val === null || val === undefined || val === '') return 0;
            const num = Number(val);
            if (isNaN(num) || num <= 0) return 0;
            return num > 200 ? Number((num / 1000).toFixed(3)) : Number(num.toFixed(3));
          };

          const gateNet = formatToMT(matched.gate_net_weight ?? matched.stage1_net_weight);
          const gateGross = formatToMT(matched.gate_gross_weight ?? matched.stage1_gross_weight);
          const gateTare = formatToMT(matched.gate_tare_weight ?? matched.stage1_tare_weight);

          const millGrossNum = Number(matched.mill_gross_weight ?? matched.stage2_gross_weight ?? 0);
          const millTareNum = Number(matched.mill_tare_weight ?? matched.stage2_tare_weight ?? 0);
          const millGross = formatToMT(millGrossNum);
          const millTare = formatToMT(millTareNum);

          let millNet = 0;
          if (millGrossNum > 0 && millTareNum > 0) {
            millNet = formatToMT(millGrossNum - millTareNum);
          } else {
            millNet = formatToMT(matched.mill_net_weight ?? matched.stage2_net_weight);
          }

          const elecGrossNum = Number(matched.electric_gross_weight ?? matched.stage3_gross_weight ?? 0);
          const elecTareNum = Number(matched.electric_tare_weight ?? matched.stage3_tare_weight ?? 0);
          const elecGross = formatToMT(elecGrossNum);
          const elecTare = formatToMT(elecTareNum);

          let elecNet = 0;
          if (elecGrossNum > 0 && elecTareNum > 0) {
            elecNet = formatToMT(elecGrossNum - elecTareNum);
          } else {
            elecNet = formatToMT(matched.electric_net_weight ?? matched.stage3_net_weight);
          }

          setFormData(prev => {
            const updated = { ...prev };

            // Weight fields
            if (gateNet > 0) updated.challan_material_weight = gateNet;
            if (millNet > 0) updated.supplier_net_weight = millNet;
            if (elecNet > 0) updated.electronic_net_weight = elecNet;

            if (gateGross > 0) updated.actual_gross_weight = gateGross;
            if (millGross > 0) updated.supplier_challan_gross = millGross;
            if (elecGross > 0) updated.electronic_gross_weight = elecGross;

            if (gateTare > 0) updated.actual_tare_weight = gateTare;
            if (millTare > 0) updated.supplier_tare_weight = millTare;
            if (elecTare > 0) updated.electronic_tare_weight = elecTare;

            // Auto-fill party_name if P.O. Number is BLANK
            if (!prev.po_no || !prev.po_no.trim()) {
              const party = (matched.party_name || matched.broker || matched.supplier || '').toUpperCase();
              if (party) {
                updated.broker = party;
                updated.challan_supplier = party;
                updated.supplier = party;
              }
            }

            return updated;
          });
        }
      } catch (err) {
        console.warn("Error matching with lorry_weighments:", err);
      }
    };

    syncFromLorryWeighments();

    return () => {
      isMounted = false;
    };
  }, [formData.lorry_date, formData.lorry_prefix, formData.lorry_suffix, formData.po_no]);

  
  // Sync and dynamically calculate net weights based on scale inputs and determine Final Weight (lowest Net Weight)
  useEffect(() => {
    setFormData(prev => {
      const grossChln = Number(prev.actual_gross_weight) || 0;
      const tareChln = Number(prev.actual_tare_weight) || 0;
      const grossMill = Number(prev.supplier_challan_gross) || 0;
      const tareMill = Number(prev.supplier_tare_weight) || 0;
      const grossElec = Number(prev.electronic_gross_weight) || 0;
      const tareElec = Number(prev.electronic_tare_weight) || 0;

      const calculatedChallanNet = grossChln > 0 ? Math.round(Math.max(0, grossChln - tareChln) * 1000) / 1000 : (Number(prev.challan_material_weight) || 0);
      const calculatedSupplierNet = grossMill > 0 ? Math.round(Math.max(0, grossMill - tareMill) * 1000) / 1000 : (Number(prev.supplier_net_weight) || 0);
      const calculatedElectronicNet = grossElec > 0 ? Math.round(Math.max(0, grossElec - tareElec) * 1000) / 1000 : (Number(prev.electronic_net_weight) || 0);

      // Final Weight is lowest value among the Net Weight section (CHALLAN WT, MILL NET, ELECTRONIC NET)
      const validNetWeights = [
        calculatedChallanNet,
        calculatedSupplierNet,
        calculatedElectronicNet
      ].filter(v => v > 0);

      const minNetWeight = validNetWeights.length > 0 ? Math.round(Math.min(...validNetWeights) * 1000) / 1000 : (Number(prev.weight_reduced) || 0);

      if (
        calculatedChallanNet === prev.challan_material_weight &&
        calculatedSupplierNet === prev.supplier_net_weight &&
        calculatedElectronicNet === prev.electronic_net_weight &&
        minNetWeight === prev.weight_reduced
      ) {
        return prev;
      }

      return {
        ...prev,
        challan_material_weight: calculatedChallanNet,
        supplier_net_weight: calculatedSupplierNet,
        electronic_net_weight: calculatedElectronicNet,
        weight_reduced: minNetWeight
      };
    });
  }, [
    formData.actual_gross_weight,
    formData.actual_tare_weight,
    formData.supplier_challan_gross,
    formData.supplier_tare_weight,
    formData.electronic_gross_weight,
    formData.electronic_tare_weight,
    formData.challan_material_weight,
    formData.supplier_net_weight,
    formData.electronic_net_weight
  ]);

  // Recalculate Receipt Grade Details Netto (M.T) whenever Final Weight or quantity_rcpt/quantity_chln changes (non-LOOSE only)
  useEffect(() => {
    const isLoose = (formData.unit_name || '').toUpperCase().includes('LOOSE');
    if (isLoose) return; // Strictly not applicable for LOOSE

    const finalWeight = Number(formData.weight_reduced) || 0;
    setDetails(prev => {
      const recalculated = calculateProportionalNetto(finalWeight, prev, formData.unit_name);
      const isDifferent = recalculated.some((r, i) => r.netto_pnto !== prev[i]?.netto_pnto);
      return isDifferent ? recalculated : prev;
    });
  }, [
    formData.weight_reduced,
    formData.unit_name,
    details.map(d => `${d.quantity_rcpt}_${d.quantity_chln}_${d.unit}`).join(',')
  ]);

  const loadDetailsFromPo = async (poNo: string) => {
    if (!poNo || !poNo.trim()) return;
    try {
      const poNoUpper = poNo.trim().toUpperCase();
      let filteredDetails: any[] = [];

      // 1. Query Supabase directly if available
      if (supabase) {
        const [scpRes, pdmRes] = await Promise.all([
          supabase.from('sauda_check_point_details').select('*').eq('po_no', poNo.trim()),
          supabase.from('purchase_detail_master').select('*').eq('po_no', poNo.trim())
        ]);
        const scp = scpRes.data || [];
        const pdm = pdmRes.data || [];

        if (scp.length > 0) {
          filteredDetails = scp;
        } else if (pdm.length > 0) {
          filteredDetails = pdm;
        } else {
          // Case insensitive fallback
          const [scpIns, pdmIns] = await Promise.all([
            supabase.from('sauda_check_point_details').select('*').ilike('po_no', poNoUpper),
            supabase.from('purchase_detail_master').select('*').ilike('po_no', poNoUpper)
          ]);
          filteredDetails = (scpIns.data && scpIns.data.length > 0) ? scpIns.data : (pdmIns.data || []);
        }
      }

      // 2. Query dbModule fallback if still empty
      if (!filteredDetails || filteredDetails.length === 0) {
        const [allScp, allPdm] = await Promise.all([
          dbModule.fetchAll('sauda_check_point_details').catch(() => []),
          dbModule.fetchAll('purchase_detail_master').catch(() => [])
        ]);
        const scp = (allScp || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poNoUpper);
        const pdm = (allPdm || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poNoUpper);
        filteredDetails = scp.length > 0 ? scp : pdm;
      }

      // 3. Fallback to embedded items in purchaseOrders list
      if (!filteredDetails || filteredDetails.length === 0) {
        const matchedPo = purchaseOrders.find((p: any) => String(p.po_no).trim().toUpperCase() === poNoUpper);
        if (matchedPo) {
          if (Array.isArray(matchedPo.items) && matchedPo.items.length > 0) {
            filteredDetails = matchedPo.items;
          } else if (Array.isArray(matchedPo.details) && matchedPo.details.length > 0) {
            filteredDetails = matchedPo.details;
          }
        }
      }

      if (filteredDetails && filteredDetails.length > 0) {
        const newDetails: ArrivalDetailRow[] = filteredDetails.map((fd: any, index: number) => {
          const rawGrade = String(fd.grade_code || fd.grade_name || fd.grade || '').trim();
          const matchingGrade = grades.find(g => 
            String(g.grade_code || '').trim().toUpperCase() === rawGrade.toUpperCase() || 
            String(g.grade_name || '').trim().toUpperCase() === rawGrade.toUpperCase()
          );
          const gradeName = matchingGrade ? matchingGrade.grade_name : rawGrade;
          const gradeCode = matchingGrade ? matchingGrade.grade_code : rawGrade;

          const rawMarka = String(fd.marka_code || fd.marka_name || fd.marka || fd.challan_marka_name || fd.challan_marka_code || '').trim();
          const matchingMarka = markas.find(m => 
            String(m.marka_code || '').trim().toUpperCase() === rawMarka.toUpperCase() || 
            String(m.marka_name || '').trim().toUpperCase() === rawMarka.toUpperCase()
          );
          const markaName = matchingMarka ? matchingMarka.marka_name : (rawMarka || 'NO MARK');
          const markaCode = matchingMarka ? matchingMarka.marka_code : (rawMarka || '01');

          const rawAgency = String(fd.agency_name || fd.agency || fd.agency_code || '').trim().replace(/\s*\(Code\s*\d+\)$/i, '').replace(/\s*Code\s*\d+$/i, '').trim();
          const matchingAgency = agencies.find(a =>
            String(a.agency_code || a.AGENCY_CODE || '').trim().toUpperCase() === rawAgency.toUpperCase() ||
            String(a.agency_name || a.AGENCY_NAME || '').trim().replace(/\s*\(Code\s*\d+\)$/i, '').toUpperCase() === rawAgency.toUpperCase()
          );
          const agencyName = matchingAgency ? (matchingAgency.agency_name || matchingAgency.AGENCY_NAME) : rawAgency;
          const agencyCode = matchingAgency ? (matchingAgency.agency_code || matchingAgency.AGENCY_CODE) : (fd.agency_code || rawAgency);

          const weightVal = parseFloat(fd.weight_mt || fd.netto_pnto || fd.weight || fd.weight_reduced || (fd.weight_qtl ? (parseFloat(fd.weight_qtl) / 10) : 0) || 0) || 0;
          const qtyVal = parseInt(fd.quantity || fd.quantity_rcpt || fd.quantity_chln || 0, 10) || 0;

          return {
            srl_no: index + 1,
            receipt_grade_code: gradeCode,
            receipt_grade_name: gradeName,
            crop_year: fd.crop_year || '2026-27',
            challan_grade_name: gradeName,
            agency_code: agencyCode,
            agency_name: agencyName,
            challan_marka_code: markaCode,
            challan_marka_name: markaName,
            netto_pnto: weightVal,
            quantity_chln: qtyVal,
            quantity_rcpt: qtyVal,
            remarks: fd.remarks || ''
          };
        });
        setDetails(newDetails);
      }
    } catch (e) {
      console.warn("Error loading details from PO:", e);
    }
  };

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (name === 'arrival_no') {
      const upper = String(value || '').toUpperCase();
      if (upper.startsWith('AR0')) {
        finalValue = 'AR0' + upper.slice(3);
      } else if (upper === 'AR' || upper === 'A' || upper === '') {
        finalValue = 'AR0';
      } else {
        const suffix = upper.replace(/^(AR0?|MR0?)/i, '');
        finalValue = 'AR0' + suffix;
      }
    } else if (name === 'broker' || name === 'supplier' || name === 'challan_supplier' || name === 'arrival_area_name') {
      finalValue = (value || '').toUpperCase();
    }
    if (name === 'date' ) {
      formData.lorry_date = value;
    }
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: name.includes('weight') || name.includes('fees') ? (finalValue === '' ? '' : Number(finalValue)) : finalValue
      };

      if (name === 'po_no' && finalValue) {
        const matched = purchaseOrders.find((po: any) => String(po.po_no).trim().toUpperCase() === String(finalValue).trim().toUpperCase());
        if (matched) {
          updated.supplier = (matched.supplier || prev.supplier || '').toUpperCase();
          updated.challan_supplier = (matched.challan_supplier || matched.supplier || prev.challan_supplier || '').toUpperCase();
          updated.broker = (matched.broker || prev.broker || '').toUpperCase();
          updated.arrival_area_name = (matched.area || prev.arrival_area_name || '').toUpperCase();
          const matchedArea = areas.find((a: any) => String(a.area_name).trim().toUpperCase() === String(matched.area).trim().toUpperCase());
          if (matchedArea) {
            updated.arrival_area_code = matchedArea.area_code;
          }
          const matchedUnit = matched.purchase_unit_name || matched.unit_name || matched.unit || prev.unit_name || 'BALES';
          updated.unit_name = matchedUnit;
          const codeMap: Record<string, string> = {
            BALES: 'I',
            LOOSE: 'II',
            DRUMS: '2',
            'P.BALES': '4',
            'H.BALES': '5',
          };
          updated.unit_code = matched.purchase_unit_code || matched.unit_code || codeMap[matchedUnit] || prev.unit_code || 'I';
          updated.ptf = (matched.ptf_no || matched.is_ptf) ? 'Yes' : 'No';
        }
        
        // Pull details from purchase_detail_master / sauda_check_point_details
        loadDetailsFromPo(finalValue);
      }

      return updated;
    });
  };

  const handleDetailChange = (index: number, field: keyof ArrivalDetailRow, value: any) => {
    setDetails(prev => {
      const updated = [...prev];

      updated[index] = {
        ...updated[index],
        [field]: value
      };

      // Auto-update grade labels and code when selected by Name
      if (field === 'receipt_grade_name') {
        const foundGrade = grades.find(g => g.grade_name === value);
        if (foundGrade) {
          updated[index].receipt_grade_code = foundGrade.grade_code || '';
          updated[index].challan_grade_name = foundGrade.grade_name || '';
        } else {
          updated[index].receipt_grade_code = '';
          updated[index].challan_grade_name = '';
        }
      }

      if (field === 'quantity_rcpt') {
        updated[index].quantity_rcpt = Number(value) || 0;
      }

      if (field === 'quantity_chln') {
        updated[index].quantity_chln = Number(value) || 0;
      }

      // Auto-update marka labels and code when selected by Name
      if (field === 'challan_marka_name') {
        const inputVal = (value || '').trim().toUpperCase();
        const foundMarka = markas.find(m => (m.marka_name || '').trim().toUpperCase() === inputVal);
        if (foundMarka) {
          updated[index].challan_marka_code = foundMarka.marka_code || '';
          updated[index].challan_marka_name = foundMarka.marka_name; // preserve the standard casing
        } else {
          updated[index].challan_marka_code = ''; // manually typed entry - code will be assigned on save
          updated[index].challan_marka_name = value ? value.toUpperCase() : ''; // keep as uppercase custom marka
        }
      }

      if (field === 'agency_name') {
        const inputVal = (value || '').trim().replace(/\s*\(Code\s*\d+\)$/i, '').replace(/\s*Code\s*\d+$/i, '').trim().toUpperCase();
        const foundAgency = agencies.find(a => (a.agency_name || a.AGENCY_NAME || '').trim().replace(/\s*\(Code\s*\d+\)$/i, '').toUpperCase() === inputVal);
        if (foundAgency) {
          updated[index].agency_code = foundAgency.agency_code || foundAgency.AGENCY_CODE || '';
          updated[index].agency_name = foundAgency.agency_name || foundAgency.AGENCY_NAME;
        } else {
          updated[index].agency_code = updated[index].agency_code || '';
          updated[index].agency_name = value ? inputVal : '';
        }
      }

      if (field === 'agency_code') {
        const inputCode = (value || '').trim().toUpperCase();
        const foundAgency = agencies.find(a => String(a.agency_code || '').trim().toUpperCase() === inputCode);
        if (foundAgency) {
          updated[index].agency_code = foundAgency.agency_code || inputCode;
          updated[index].agency_name = foundAgency.agency_name || updated[index].agency_name;
        } else {
          updated[index].agency_code = inputCode;
        }
      }

      if (field === 'netto_pnto') {
        updated[index].netto_pnto = Number(value) || 0;
      }

      return updated;
    });
  };

  const clearForm = () => {
    setDetails([{
      srl_no: 1,
      receipt_grade_code: '',
      receipt_grade_name: '',
      crop_year: '2026-27',
      challan_grade_name: '',
      agency_code: '',
      agency_name: '',
      challan_marka_code: '',
      challan_marka_name: '',
      netto_pnto: 0,
      quantity_chln: 0,
      quantity_rcpt: 0,
      remarks: ''
    }]);
    setFormData(prev => ({
      ...prev,
      po_no: '',
      transporter_name: '',
      challan_rr_no: '',
      lorry_prefix: '',
      lorry_suffix: '',
      pan_no: '',
      lorry_date: '',
      consignment_note_no: '',
      di_no: '',
      di_date: '',
      invoice_no: '',
      invoice_date: '',
      ptf: 'No',
      lorry_returned: 'No',
      lorry_returned_other_mill: 'No',
      way_bill_no: '',
      way_bill_date: '',
      apmc_fees: 0,
      remarks: '',
      challan_material_weight: 0,
      actual_gross_weight: 0,
      actual_tare_weight: 0,
      supplier_net_weight: 0,
      supplier_challan_gross: 0,
      supplier_tare_weight: 0,
      electronic_net_weight: 0,
      electronic_gross_weight: 0,
      electronic_tare_weight: 0,
      weight_reduced: 0
    }));
    localStorage.removeItem('amad_draft_form');
    localStorage.removeItem('amad_draft_details');
  };

  const handleSave = async () => {
    if (initialData && !enforceEditOrDeletePermission("Edit")) {
      return;
    }
    
    if(formData.arrival_no==='' || formData.arrival_no===null){
       alert('Please enter Arrival No.');
      return
    }
    if(formData.arrival_no!='' || formData.arrival_no!=null){
      const hasArrivalNo = String(formData.arrival_no || '').trim().replace(/^(MR0?|AR0?)/i, '').trim().length > 0;
      if (!hasArrivalNo) {
        alert('Please enter Arrival No.');
        return;
      }
    } 
    if(formData.date==='' || formData.date===null){
       alert('Please Enter The Arrival Date.');
      return
    }
    if(formData.challan_supplier==='' || formData.challan_supplier===null){
       alert('Please Select Challan Supplier.');
      return
    }
    if(formData.supplier==='' || formData.supplier===null){
       alert('Please Select Supplier.');
      return
    }
    if(formData.broker==='' || formData.broker===null){
       alert('Please Select Broker.');
      return
    }
    if(formData.challan_rr_no==='' || formData.challan_rr_no===null){
       alert('Please Enter The Challan No & Date.');
      return
    }
    if(formData.lorry_suffix==='' || formData.lorry_suffix===null){
       alert('Please Enter Lorry No.');
      return
    }
    if(formData.unit_name==='' || formData.unit_name===null){
       alert('Please Select Unit.');
      return
    }
    if(formData.arrival_area_name==='' || formData.arrival_area_name===null){
       alert('Please Select Area.');
      return
    }

    // Row-wise validation
    for (let i = 0; i < details.length; i++) {
      const row12 = details[i];
      if (!row12.receipt_grade_name || !String(row12.receipt_grade_name).trim() ) {
        alert(`Row ${i + 1}: Receipt Grade Name is required.`);
        return;
      }
      if (!row12.crop_year || !String(row12.crop_year || "").trim()) {
        alert(`Row ${i + 1}: Crop Year is required.`);
        return;
      }
      if (!row12.agency_name || !String(row12.agency_name || "").trim()) {
        alert(`Row ${i + 1}: Agency Name is required.`);
        return;
      }
      if (!row12.netto_pnto || !String(row12.netto_pnto || "").trim()) {
        alert(`Row ${i + 1}: Net WT is required.`);
        return;
      }
    }
    
    if(formData.challan_material_weight==='' || formData.challan_material_weight===null || Number(formData.supplier_net_weight) <= 0){
       alert('Please Enter The Challan Net Weight.');
      return
    }
    if(formData.supplier_net_weight==='' || formData.supplier_net_weight===null || Number(formData.supplier_net_weight) <= 0){
       alert('Please Enter The Mill Net Weight.');
      return
    }
    if (formData.electronic_net_weight === "" || formData.electronic_net_weight == null || Number(formData.electronic_net_weight) <= 0 ) {
      alert("Please Enter The Electronic Net Weight.");
      return;
    }
    
    

    // Guard: Prohibit creating new temporary arrivals against cancelled or closed saudas
    const cleanEnteredPo = String(formData.po_no || '').trim().toUpperCase();
    const poObj = purchaseOrders.find((p: any) => String(p.po_no || '').trim().toUpperCase() === cleanEnteredPo);
    const saudaKey = String(poObj?.sauda_no || poObj?.contract_po_no || '').trim().toUpperCase();
    const isCancelledLocal = localStorage.getItem(`sauda_cancelled_${cleanEnteredPo}`) === 'true' ||
                             (saudaKey ? localStorage.getItem(`sauda_cancelled_${saudaKey}`) === 'true' : false);
    const isForceClosedLocal = localStorage.getItem(`sauda_closed_${cleanEnteredPo}`) === 'true' ||
                               (saudaKey ? localStorage.getItem(`sauda_closed_${saudaKey}`) === 'true' : false);
    const isReopenedLocal = localStorage.getItem(`sauda_reopened_${cleanEnteredPo}`) === 'true' ||
                            (saudaKey ? localStorage.getItem(`sauda_reopened_${saudaKey}`) === 'true' : false);
    const poStatusLower = String(poObj?.status || '').trim().toLowerCase();
    const isExplicitReopened = !isCancelledLocal && !isForceClosedLocal && poStatusLower !== 'closed' && (
      poObj?.is_reopened === true ||
      poObj?.reopened === true ||
      poStatusLower === 'open' ||
      Boolean(poObj?.open_remarks) ||
      isReopenedLocal
    );
    const isPoObjCancelled = poObj && (poStatusLower === 'cancelled' || poObj.is_cancelled === true);
    const isPoObjClosed = poObj && !isExplicitReopened && (poObj.is_closed === true || poStatusLower === 'closed');
    const isPoCancelled = isCancelledLocal || isPoObjCancelled;
    const isPoClosed = !isExplicitReopened && (closedSaudaMap.has(cleanEnteredPo) || isForceClosedLocal || isPoObjClosed);

    if (!initialData && cleanEnteredPo && (isPoCancelled || isPoClosed)) {
      if (isPoCancelled) {
        alert(`🚫 Action Prohibited: Sauda / Purchase Order #${cleanEnteredPo} is CANCELLED (VOID).\n\nCancelled Saudas cannot accept any Material Receipts (MR) or Temporary Arrivals. It must first be Restored by a Level 4 user or Admin from Sauda Check Point.`);
      } else {
        alert(`🔒 Action Prohibited: Purchase Order #${cleanEnteredPo} is CLOSED.\n\nClosed P.O.s are not accepted in Temporary Arrival. It must first be Reopened by a Level 4 user or Admin from Sauda Check Point.`);
      }
      return;
    }

    setLoading(true);
    try {
      const activeRows = details.filter(row => 
        row.receipt_grade_code || 
        row.receipt_grade_name ||
        row.challan_grade_name || 
        row.challan_marka_name ||
        row.agency_name ||
        Number(row.netto_pnto) > 0 || 
        Number(row.quantity_rcpt) > 0 || 
        Number(row.quantity_chln) > 0
      );

      // Validate selected Area and Agency combination against area_logic
      if (formData.arrival_area_name) {
        for (const row of activeRows) {
          if (row.agency_name || row.agency_code) {
            const isValid = validateAreaAgencyCombination(
              formData.arrival_area_name,
              row.agency_code || row.agency_name
            );
            if (!isValid) {
              alert(`Selected Agency "${row.agency_name || row.agency_code}" is not valid for Area "${formData.arrival_area_name}" according to area_logic.`);
              setLoading(false);
              return;
            }
          }
        }
      }

      // Check if there are any new manual marks to insert into the database
      const uniqueNewMarkas: string[] = [];
      activeRows.forEach(row => {
        const markaName = (row.challan_marka_name || '').trim();
        if (markaName) {
          const exists = markas.some(m => (m.marka_name || '').trim().toUpperCase() === markaName.toUpperCase());
          if (!exists && !uniqueNewMarkas.some(n => n.toUpperCase() === markaName.toUpperCase())) {
            uniqueNewMarkas.push(markaName);
          }
        }
      });

      if (uniqueNewMarkas.length > 0) {
        let maxMarkaCode = markas.reduce((acc, m) => {
          const codeVal = parseInt(m.marka_code || '0', 10);
          return isNaN(codeVal) ? acc : Math.max(acc, codeVal);
        }, 170);

        for (const name of uniqueNewMarkas) {
          maxMarkaCode += 1;
          const codeStr = String(maxMarkaCode).padStart(2, '0');
          try {
            await dbModule.insert('marka_master', {
              marka_code: codeStr,
              marka_name: name.toUpperCase() // Save nicely as uppercase standard
            });
            // Update in activeRows detail so it saves with the newly generated code str
            activeRows.forEach(r => {
              if ((r.challan_marka_name || '').trim().toUpperCase() === name.toUpperCase()) {
                r.challan_marka_code = codeStr;
                r.challan_marka_name = name.toUpperCase();
              }
            });
          } catch (e) {
            console.error("Failed to insert new marka name:", name, e);
          }
        }
      }

      const totalPacketsSum = Math.round(activeRows.reduce((acc, curr) => acc + (Number(curr.quantity_rcpt) || 0), 0));
      const totalWeightSum = activeRows.reduce((acc, curr) => acc + (Number(curr.netto_pnto) || 0), 0);
      const lorryCombined = `${formData.lorry_prefix}-${formData.lorry_suffix}`.trim();

      const primaryRow = activeRows.find(r => (Number(r.netto_pnto) > 0 || Number(r.quantity_chln) > 0 || Number(r.quantity_rcpt) > 0)) || activeRows[0];

      const payload = {
        financial_year: formData.financial_year,
        amad_no: formData.arrival_no,
        temporary_arrival_no: formData.arrival_no,
        po_no: formData.po_no,
        date: sanitizeDate(formData.date),
        jci: formData.jci,
        challan_supplier: formData.challan_supplier,
        supplier: formData.supplier,
        broker: formData.broker,
        transporter_name: formData.transporter_name,
        challan_rr_no: formData.challan_rr_no || (formData as any).challan_railway_receipt_no || '',
        challan_railway_receipt_no: (formData as any).challan_railway_receipt_no || formData.challan_rr_no || '',
        lorry_number: lorryCombined,
        pan_no: formData.pan_no,
        lorry_date: sanitizeDate(formData.lorry_date),
        consignment_note: (formData as any).consignment_note || formData.consignment_note_no || '',
        consignment_note_no: (formData as any).consignment_note || formData.consignment_note_no || '',
        di_no: formData.di_no,
        di_date: sanitizeDate(formData.di_date),
        invoice_no: formData.invoice_no,
        invoice_date: sanitizeDate(formData.invoice_date),
        ptf: formData.ptf,
        lorry_returned: formData.lorry_returned,
        lorry_returned_other_mill: formData.lorry_returned_other_mill,
        arrival_area_code: formData.arrival_area_code,
        arrival_area_name: formData.arrival_area_name,
        unit_code: formData.unit_code,
        unit_name: formData.unit_name,
        way_bill_no: formData.way_bill_no,
        way_bill_date: sanitizeDate(formData.way_bill_date),
        apmc_fees: Number(formData.apmc_fees) || 0,
        remarks: formData.remarks,
        total_packets: totalPacketsSum,
        weight_qtl: totalWeightSum * 10,
        grid_details: activeRows.map(row => {
          return {
            srl_no: Number(row.srl_no) || 1,
            remarks: row.remarks || '',
            crop_year: row.crop_year || '2026-27',
            netto_pnto: Number(row.netto_pnto) || 0,
            agency_code: row.agency_code || '',
            agency_name: row.agency_name || '',
            quantity_chln: Math.round(Number(row.quantity_chln) || 0),
            quantity_rcpt: Math.round(Number(row.quantity_rcpt) || 0),
            challan_grade_name: row.challan_grade_name || row.receipt_grade_name || '',
            challan_marka_code: row.challan_marka_code || '',
            challan_marka_name: row.challan_marka_name || '',
            receipt_grade_code: row.receipt_grade_code || '',
            receipt_grade_name: row.receipt_grade_name || ''
          };
        }),

        // Weighments
        challan_material_weight: formData.challan_material_weight || 0,
        actual_gross_weight: formData.actual_gross_weight || 0,
        actual_tare_weight: formData.actual_tare_weight || 0,
        supplier_net_weight: formData.supplier_net_weight || 0,
        supplier_challan_gross: formData.supplier_challan_gross || 0,
        supplier_tare_weight: formData.supplier_tare_weight || 0,
        electronic_net_weight: formData.electronic_net_weight || 0,
        electronic_gross_weight: formData.electronic_gross_weight || 0,
        electronic_tare_weight: formData.electronic_tare_weight || 0,
        weight_reduced: formData.weight_reduced || 0,

        // Backward compatibility properties & grade indexing
        packets: totalPacketsSum,
        weight: totalWeightSum * 10,
        commodity: 'RAW JUTE',
        variety: primaryRow?.receipt_grade_name || primaryRow?.challan_grade_name || 'TOSSA',
        grading: primaryRow?.receipt_grade_name || primaryRow?.challan_grade_name || 'TD6',
        marka: primaryRow?.challan_marka_name || 'DIRECT',
        status: 'Active'
      };

      let changesSummaryArr: string[] = [];
      if (initialData) {
        const keysToCompare = [
          { key: 'po_no', label: 'PO No' },
          { key: 'date', label: 'Date' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'lorry_number', label: 'Lorry Number' },
          { key: 'total_packets', label: 'Total Packets' },
          { key: 'remarks', label: 'Remarks' },
          { key: 'actual_gross_weight', label: 'Gross Weight' },
          { key: 'actual_tare_weight', label: 'Tare Weight' }
        ];

        keysToCompare.forEach(({ key, label }) => {
          const oldVal = (initialData as any)[key];
          const newVal = (payload as any)[key];
          if (String(oldVal || '').trim() !== String(newVal || '').trim()) {
            changesSummaryArr.push(`${label}: "${oldVal ?? ''}" → "${newVal ?? ''}"`);
          }
        });
      }

      // Prepare standard database payload (strip non-table properties)
      const dbPayload = { ...payload };
      delete (dbPayload as any).amad_no;
      delete (dbPayload as any).grade;

      const tryDbOperation = async (operation: () => Promise<any>) => {
        try {
          return await operation();
        } catch (e: any) {
          const errMsg = e?.message || String(e || '');
          const match = errMsg.match(/Could not find the '([^']+)' column/i);
          if (match && match[1] && (dbPayload as any)[match[1]] !== undefined) {
            if (match[1] === 'apmc_fees' && supabase) {
              try {
                await supabase.rpc('exec_sql', {
                  query: `ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS apmc_fees NUMERIC(15,2) DEFAULT 0; NOTIFY pgrst, 'reload schema';`
                });
                return await operation();
              } catch (_) {}
            }
            console.warn(`Stripping unknown column '${match[1]}' from payload and retrying`);
            delete (dbPayload as any)[match[1]];
            return await operation();
          }
          if (errMsg.includes('amad_no')) {
            delete (dbPayload as any).amad_no;
            return await operation();
          }
          if (errMsg.includes('temporary_arrival_no')) {
            delete (dbPayload as any).temporary_arrival_no;
            return await operation();
          }
          throw e;
        }
      };

      if (initialData && initialData.amad_id) {
        await Promise.all([
          tryDbOperation(() => dbModule.update('temporary_material_received', 'amad_id', initialData.amad_id, dbPayload)).catch((e) => {
            console.error("Error updating temporary_material_received:", e);
            throw e;
          }),
          tryDbOperation(() => dbModule.update('issue_master', 'amad_id', initialData.amad_id, dbPayload)).catch((e) => {
            console.warn("Could not sync with issue_master or issue_master didn't exist for update, skipping:", e);
          })
        ]);

        // Insert audit trail for update
        const historyLog = {
          amad_no: formData.arrival_no || 'UNKNOWN',
          amad_id: initialData.amad_id,
          action_type: 'UPDATE',
          modified_by: getCurrentUserContext().username || 'ADMIN',
          old_values: JSON.stringify(initialData),
          new_values: JSON.stringify(payload),
          changes_summary: changesSummaryArr.join(', ') || 'Voucher record updated (re-saved)'
        };
        await dbModule.insert('amad_change_history', historyLog).catch((e) => {
          console.error("Failed to write update log:", e);
        });

        screenDraftService.clearDraft('amad_entry_form');
        screenDraftService.clearDraft('amad_entry_details');
        alert(`Arrival Register Voucher #${formData.arrival_no} updated successfully!`);
      } else {
        let insertAmadError: any = null;
        let insertIssueError: any = null;
        await Promise.all([
          tryDbOperation(() => dbModule.insert('temporary_material_received', dbPayload)).catch((e) => { insertAmadError = e; return null; }),
          tryDbOperation(() => dbModule.insert('issue_master', dbPayload)).catch((e) => { insertIssueError = e; return null; })
        ]);
        if (insertAmadError) {
          alert(`Failed to save to Database: ${insertAmadError.message || insertAmadError}`);
          return;
        }

        // Insert audit trail for insert
        const historyLog = {
          amad_no: formData.arrival_no || 'UNKNOWN',
          amad_id: formData.arrival_no,
          action_type: 'INSERT',
          modified_by: getCurrentUserContext().username || 'ADMIN',
          old_values: null,
          new_values: JSON.stringify(payload),
          changes_summary: `New Arrival Voucher registered by ${getCurrentUserContext().username || 'ADMIN'} containing ${payload.total_packets} Packets`
        };
        await dbModule.insert('amad_change_history', historyLog).catch((e) => {
          console.error("Failed to write insert log:", e);
        });

        screenDraftService.clearDraft('amad_entry_form');
        screenDraftService.clearDraft('amad_entry_details');
        alert(`Arrival Register Saved successfully!\nAdded under Arrival Voucher #${formData.arrival_no}`);
      }

      // Propagate A.P.M.C Fees (Rs.) downstream to Final Arrival, Inspection, and Settlement if linked records exist
      const savedApmcFees = Number(formData.apmc_fees) || 0;
      const cleanArrNo = (formData.arrival_no || '').trim();
      if (supabase && cleanArrNo) {
        try {
          await Promise.all([
            supabase.from('final_arrival').update({ apmc_fees: savedApmcFees }).or(`temporary_arrival_no.eq.${cleanArrNo},arrival_no.eq.${cleanArrNo},final_arrival_no.eq.${cleanArrNo}`).then(() => {}, () => {}),
            supabase.from('material_inspection').update({ arival_apmc_fees: savedApmcFees }).or(`arrival_no.eq.${cleanArrNo},mr_no.eq.${cleanArrNo}`).then(() => {}, () => {}),
            supabase.from('mill_inspection_master').update({ arival_apmc_fees: savedApmcFees }).or(`arrival_no.eq.${cleanArrNo},mr_no.eq.${cleanArrNo}`).then(() => {}, () => {}),
            supabase.from('mr_settlement_master').update({ arival_apmc_fees: savedApmcFees }).or(`arrival_no.eq.${cleanArrNo},mr_no.eq.${cleanArrNo}`).then(() => {}, () => {})
          ]);
        } catch (_) {}
      }

      // Dynamically calculate and update status of PO & Sauda based on total received quantities/weights
      const currentPoNo = formData.po_no ? formData.po_no.trim().toUpperCase() : '';
      if (currentPoNo) {
        try {
          let matchedPo: any = null;
          if (supabase) {
            const { data } = await supabase.from('purchase_master').select('*').eq('po_no', currentPoNo).maybeSingle();
            matchedPo = data;
          }

          if (matchedPo) {
            let totalReceivedMt = 0;
            if (supabase) {
              const { data: relatedAmads } = await supabase
                .from('temporary_material_received')
                .select('amad_no, temporary_arrival_no, weight_qtl')
                .eq('po_no', currentPoNo);
              
              (relatedAmads || []).forEach((am: any) => {
                if (payload && (formData.arrival_no === am.amad_no || formData.arrival_no === am.temporary_arrival_no)) return;
                totalReceivedMt += (Number(am.weight_qtl) || 0) / 10;
              });
            }

            totalReceivedMt += totalWeightSum;

            const contractWeight = Number(matchedPo.total_contract_mt) || 0;
            const isComplete = contractWeight > 0 && totalReceivedMt >= (contractWeight - 0.01);
            const newStatus = isComplete ? 'completed' : 'in progress';

            if (matchedPo.po_id) {
              await dbModule.update('purchase_master', 'po_id', matchedPo.po_id, {
                pending: !isComplete,
                status: newStatus
              }).catch((err) => console.warn("Failed to update purchase_master status:", err));
            }

            if (supabase) {
              const exactSaudaRef = String(matchedPo.sauda_no || matchedPo.contract_po_no || currentPoNo).trim();
              if (exactSaudaRef) {
                Promise.resolve(supabase.from('sauda_master').update({ status: newStatus }).or(`sauda_no.eq.${exactSaudaRef},session.eq.${currentPoNo}`)).catch(() => {});
              }
            }
          }
        } catch (err) {
          console.warn("Error running PO/Sauda status trigger logic:", err);
        }
      }

      localStorage.removeItem('amad_draft_form');
      localStorage.removeItem('amad_draft_details');
      screenDraftService.clearDraft('amad_entry_form');
      screenDraftService.clearDraft('amad_entry_details');
      notifyDataChanged('temporary_material_received');
      notifyDataChanged('purchase_master');
      setFormData(createDefaultFormData());
      setDetails([emptyDetailRow()]);
      onSave?.(payload);
    } catch (e: any) {
      console.error(e);
      alert("Error saving Arrival voucher: " + (e.message || "Could not write transaction."));
    } finally {
      setLoading(false);
    }
  };

  return (
    
    <LegacyLayout title="Temporary M.R" subtitle="ARRIVAL WORKSTATION" onClose={onCancel}>
      <div className="flex-1 flex flex-col font-sans text-slate-800 space-y-5">
        <div className="relative px-6 py-4 bg-[#F7AFA8] border border-[#FBCFCB] rounded-xl flex items-center justify-between shrink-0 shadow-md overflow-hidden w-full text-white">
          {/* Background Mill Illustration Artwork on the Right with light opacity */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 pointer-events-none bg-no-repeat bg-right bg-contain filter brightness-200"
            style={{ backgroundImage: `url('https://res.cloudinary.com/x6tw39wi/image/upload/v1785928946/icon_vffvx9.png')` }}
          />

          <div className="relative z-10 flex flex-col gap-1">
            <h2 className="font-serif font-black text-2xl text-[#FDE7E6] tracking-tight leading-none">
              New Arrival
            </h2>
          </div>

          {/* Action Controls & Session Badge */}
          <div className="relative z-10 flex items-center gap-3">
            <button
              type="button"
              className="px-3.5 py-1.5 bg-[#D94B5A] hover:bg-[#F7AFA8] text-[#FDE7E6] border border-[#FBCFCB] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
              title="Back to Sauda Desk (Esc)"
              onClick={onCancel}
            >
              <ArrowLeft className="h-4 w-4 text-[#FDE7E6]" />
              <span>Back</span>
            </button>
            <div className="bg-[#D94B5A] border border-[#FBCFCB] px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-2xs">
              <span className="text-[#FBCFCB] font-medium">Session:</span>
              <span className="font-bold text-[#FDE7E6] font-mono text-xs">{ 'BJCL/2026-2027/'}</span>
            </div>
          </div>
        </div>

        {/* ================= Receipt Voucher Info ================= */}
        <div className="w-full rounded-xl border border-[#F7AFA8] bg-white shadow-xs overflow-visible relative z-30 mt-3">
          {/* Header */}
          <div className="px-4 py-1.5 bg-[#F7AFA8] border-b border-[#FBCFCB] rounded-t-[11px]">
            <h2 className="text-xs font-bold text-white tracking-wide uppercase">
              Receipt Voucher Info
            </h2>
          </div>
          {/* Body */}
          <div className="p-3">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-1.5">

              {/* LEFT COLUMN */}
              <div className="space-y-1.5">

                {/* Temporary M.R No. */}
                <div className="flex items-center gap-2">
                  <label htmlFor="arrival_no_1077" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Temporary M.R No. <span className="text-rose-600 font-black text-sm">*</span>
                  </label>
                  <input
                    id="arrival_no_1077" aria-label="Temporary M.R No."
                    type="text"
                    name="arrival_no"
                    value={formData.arrival_no?.startsWith('AR0') ? formData.arrival_no : `AR0${String(formData.arrival_no || '').replace(/^(AR0?|MR0?)/i, '')}`}
                    onChange={handleChange}
                    onKeyDown={(e) => {
                      const target = e.currentTarget;
                      const start = target.selectionStart ?? 0;
                      const end = target.selectionEnd ?? 0;
                      if ((e.key === 'Backspace' && start <= 3 && end <= 3) || (e.key === 'Delete' && start < 3)) {
                        e.preventDefault();
                      }
                    }}
                    onClick={(e) => {
                      const target = e.currentTarget;
                      if ((target.selectionStart ?? 0) < 3) {
                        target.setSelectionRange(3, Math.max(3, target.selectionEnd ?? 3));
                      }
                    }}
                    onFocus={(e) => {
                      const target = e.currentTarget;
                      setTimeout(() => {
                        if ((target.selectionStart ?? 0) < 3) {
                          const len = target.value.length;
                          target.setSelectionRange(len, len);
                        }
                      }, 0);
                    }}
                    className="flex-1 border border-sky-300 rounded bg-[#FDE7E6] text-sky-950 px-2 h-7 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                {/* P.O Number */}
                <div className="flex items-center gap-2 relative">
                  <label htmlFor="po_no_1094" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    P.O. Number <span className="text-rose-600 font-black"></span>
                  </label>

                  <div className="flex-1 flex gap-1 relative overflow-visible">
                    <div className="flex-1 flex relative">
                      <input
                        id="po_no_1094" aria-label="P.O. Number"
                        type="text"
                        name="po_no"
                        value={formData.po_no}
                        onChange={(e) => {
                          handleChange(e);
                          setShowPoDropdown(true);
                        }}
                        onFocus={() => {
                          setShowPoDropdown(true);
                          fetchPurchaseOrders();
                        }}
                        onBlur={() => setTimeout(() => setShowPoDropdown(false), 200)}
                        autoComplete="off"
                        placeholder="-- TYPE OR SELECT P.O. * --"
                        style={{ backgroundColor: '#FFFFFF' }}
                        className="w-full border-2 border-rose-300 rounded bg-white text-slate-900 px-2.5 h-7 font-bold uppercase font-mono text-[11px] pr-7 focus:border-rose-500 focus:outline-none"
                      />

                      <div
                        className="absolute right-0 top-0 bottom-0 w-7 flex items-center justify-center cursor-pointer text-gray-500 hover:text-black"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const nextState = !showPoDropdown;
                          setShowPoDropdown(nextState);
                          if (nextState) fetchPurchaseOrders();
                        }}
                      >
                        <ChevronDown size={14} />
                      </div>
                    </div>

                    {(() => {
                      const cleanEntered = String(formData.po_no || '').trim().toUpperCase();
                      const closedItem = closedSaudaMap.get(cleanEntered);
                      if (closedItem && !initialData) {
                        return (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-1 rounded">
                            <Lock className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>Sauda #{closedItem.po_no} is CLOSED ({closedItem.receivedLorries}/{closedItem.contractLorries} Lorries Received). Reopen by Admin or Level 4 User is required.</span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {showPoDropdown && (
                      <div className="absolute top-8 left-0 min-w-0 sm:min-w-[320px] w-full max-w-[calc(100vw-32px)] sm:max-w-[480px] bg-white border-2 border-indigo-600 rounded-lg shadow-2xl max-h-56 overflow-y-auto z-[9999]">
                        {purchaseOrders.length === 0 ? (
                          <div className="p-3 text-xs text-gray-500 italic text-center">
                            No active P.O. records found in sauda_check_point
                          </div>
                        ) : (
                          (() => {
                            const filteredList = purchaseOrders.filter(po => {
                              if (!formData.po_no) return true;
                              const search = formData.po_no.toLowerCase().trim();
                              const poNo = String(po.po_no || '').toLowerCase();
                              const supp = String(po.supplier || po.party_name || po.merchant || '').toLowerCase();
                              const brok = String(po.broker || '').toLowerCase();
                              return poNo.includes(search) || supp.includes(search) || brok.includes(search);
                            });

                            if (filteredList.length === 0) {
                              const searchUpper = (formData.po_no || '').trim().toUpperCase();
                              const closedMatch = Array.from(closedSaudaMap.values()).find(
                                c => c.po_no.toUpperCase().includes(searchUpper) || (c.sauda_no && String(c.sauda_no).toUpperCase().includes(searchUpper))
                              );

                              if (closedMatch) {
                                return (
                                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold text-amber-950">
                                      <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                      <span>Sauda #{closedMatch.po_no} is CLOSED</span>
                                    </div>
                                    <p className="text-[11px] text-amber-900 leading-snug">
                                      All {closedMatch.contractLorries} contracted {closedMatch.contractLorries === 1 ? 'lorry has' : 'lorries have'} been received ({closedMatch.receivedLorries}/{closedMatch.contractLorries}).
                                    </p>
                                    <p className="text-[10px] font-semibold text-rose-800 bg-white/80 p-1.5 rounded border border-rose-200">
                                      🔒 Closed Saudas are NOT shown for Temporary Arrival. An Admin or Level 4 user must Reopen this Sauda in Sauda Check Point to record further arrivals.
                                    </p>
                                  </div>
                                );
                              }

                              return (
                                <div className="p-3 text-xs text-gray-500 italic text-center">
                                  No matching active P.O. found for "{formData.po_no}"
                                </div>
                              );
                            }

                            return filteredList.map(po => (
                              <div 
                                key={po.po_id || po.po_no} 
                                className="px-2.5 py-1.5 text-xs font-mono cursor-pointer hover:bg-indigo-50 hover:text-indigo-900 uppercase border-b border-gray-100 last:border-b-0 transition-colors"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    const poSupplier = (po.supplier || po.party_name || po.merchant || '').toUpperCase();
                                    const poBroker = (po.broker || '').toUpperCase();
                                    const poChallanSupplier = (po.challan_supplier || poSupplier).toUpperCase();
                                    const poArea = (po.area || '').toUpperCase();

                                    setFormData(prev => {
                                      const updated = {
                                        ...prev,
                                        po_no: po.po_no,
                                        supplier: poSupplier || prev.supplier,
                                        challan_supplier: poChallanSupplier || poSupplier || prev.challan_supplier,
                                        broker: poBroker || prev.broker,
                                        arrival_area_name: poArea || prev.arrival_area_name,
                                        jci: 'No'
                                      };

                                      const matchedArea = areas.find((a: any) => String(a.area_name).trim().toUpperCase() === poArea);
                                      if (matchedArea) {
                                        updated.arrival_area_code = matchedArea.area_code;
                                      }
                                      if (po.purchase_unit_code) updated.unit_code = po.purchase_unit_code;
                                      if (po.purchase_unit_name) updated.unit_name = po.purchase_unit_name;
                                      if (po.ptf_no || po.is_ptf) updated.ptf = 'Yes';

                                      return updated;
                                    });

                                    loadDetailsFromPo(po.po_no);
                                    setShowPoDropdown(false);
                                }}
                              >
                                <div className="flex items-center justify-between font-bold text-indigo-950">
                                  <span className="flex items-center gap-1.5">
                                    P.O. #{po.po_no}
                                    {po.is_reopened ? (
                                      <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-sans font-bold flex items-center gap-0.5">
                                        <Unlock className="w-2.5 h-2.5 text-amber-700" />
                                        <span>REOPENED ({po.received_lorries || 0}/{po.contract_lorries || 1} Lorry)</span>
                                      </span>
                                    ) : (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-sans normal-case">
                                        Sauda Check Point
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-[10px] text-gray-500 font-normal">{po.po_date || ''}</span>
                                </div>
                                <div className="text-[11px] text-gray-600 flex items-center justify-between gap-2 mt-0.5">
                                  <span className="truncate">Supp: <strong className="text-gray-800">{po.supplier || po.party_name || po.merchant || 'N/A'}</strong></span>
                                  <span className="shrink-0 font-semibold text-emerald-700">{po.total_contract_mt || po.quantity || 0} MT</span>
                                </div>
                              </div>
                            ));
                          })()
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Receipt Date */}
                <div className="flex items-center gap-2">
                  <label htmlFor="date_1140" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Temporary Date <span className="text-rose-600 font-black text-sm">*</span>
                  </label>

                  <div className="flex-1 flex gap-2">
                    <input
                      id="date_1140" aria-label="Receipt Date"
                      type="date"
                      name="date"
                      required
                      value={formData.date}
                      onChange={handleChange}
                      className="flex-1 border-2 border-rose-300 rounded bg-[#FDE7E6] text-slate-900 px-2 h-7 text-xs font-bold focus:border-rose-500 focus:outline-none"
                    />

                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-red-700 text-[10px]">J.C.I</span>

                      <select
                        id="jci_1151" aria-label="jci"
                        name="jci"
                        value={formData.jci}
                        onChange={handleChange}
                        className="border border-gray-400 rounded bg-white px-1.5 h-7 text-xs font-bold"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Challan Supplier */}
                <div className="flex items-center gap-2">
                  <label htmlFor="challan_supplier_1171" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Challan Supplier <span className="text-rose-600 font-black text-sm">*</span>
                  </label>

                  <div className="flex-1">
                    {/* <input
                      id="challan_supplier_1171" aria-label="Challan Supplier"
                      type="text"
                      name="challan_supplier"
                      value={formData.challan_supplier}
                      onChange={handleChange}
                      list="challan_supplier_list"
                      placeholder="-- TYPE OR SELECT CHALLAN SUPPLIER --"
                      className={`w-full border rounded px-2.5 h-7 uppercase font-bold font-mono text-[11px] ${
                        formData.challan_supplier ? 'bg-[#FDE7E6] border-sky-300 text-sky-950' : 'bg-white border-gray-400'
                      }`}
                    /> */}
                    <input
                      id="challan_supplier_1171"
                      aria-label="Challan Supplier"
                      type="text"
                      name="challan_supplier"
                      value={formData.challan_supplier}
                      onChange={handleChange}
                      list="challan_supplier_list"
                      placeholder="-- TYPE OR SELECT CHALLAN SUPPLIER --"
                      required
                      className={`w-full border rounded px-2.5 h-7 uppercase font-bold font-mono text-[11px] ${
                        formData.challan_supplier
                          ? 'bg-[#FDE7E6] border-sky-300 text-sky-950'
                          : 'bg-white border-gray-400'
                      }`}
                    />

                    <datalist id="challan_supplier_list">
                      {suppliers.map((s) => (
                        <option key={s.id || s.supp_name} value={s.supp_name}>
                          {s.supp_name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Supplier */}
                <div className="flex items-center gap-2">
                  <label htmlFor="supplier_1198" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Supplier <span className="text-rose-600 font-black text-sm">*</span>
                  </label>

                  <div className="flex-1">
                    <input
                      id="supplier_1198" aria-label="Supplier"
                      type="text"
                      name="supplier"
                      value={formData.supplier}
                      onChange={handleChange}
                      list="supplier_list"
                      required
                      placeholder="-- TYPE OR SELECT ACTUAL SUPPLIER --"
                      className={`w-full border rounded px-2.5 h-7 uppercase font-bold font-mono text-[11px] ${
                        formData.supplier
                          ? 'bg-[#FDE7E6] border-sky-300 text-sky-950'
                          : 'bg-white border-gray-400'
                      }`}
                    />

                    <datalist id="supplier_list">
                      {suppliers.map((s) => (
                        <option key={s.id || s.supp_name} value={s.supp_name}>
                          {s.supp_name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-1.5">

                {/* Broker */}
                <div className="flex items-center gap-2">
                  <label htmlFor="broker_1230" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Broker <span className="text-rose-600 font-black text-sm">*</span>
                  </label>

                  <div className="flex-1">
                    <input
                      id="broker_1230" aria-label="Broker"
                      type="text"
                      name="broker"
                      value={formData.broker}
                      onChange={handleChange}
                      list="broker_list"
                      placeholder="-- TYPE OR SELECT BROKER --"
                      required
                      className={`w-full border rounded px-2.5 h-7 uppercase font-bold font-mono text-[11px] ${
                        formData.broker ? 'bg-[#FDE7E6] border-sky-300 text-sky-950' : 'bg-white border-gray-400'
                      }`}
                    />

                    <datalist id="broker_list">
                      <option value="DIRECT" />
                      {brokers.map((b) => (
                        <option key={b.id || b.brok_name} value={b.brok_name}>
                          {b.brok_name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Transporter */}
                <div className="flex items-center gap-2">
                  <label htmlFor="transporter_name_1257" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Transporter Name
                  </label>

                  <input
                    id="transporter_name_1257" aria-label="Transporter Name"
                    type="text"
                    name="transporter_name"
                    value={formData.transporter_name}
                    onChange={handleChange}
                    className="flex-1 border border-gray-400 rounded bg-white px-2.5 h-7 text-xs font-bold"
                  />
                </div>

                {/* Challan */}
                <div className="flex items-center gap-2">
                  <label htmlFor="challan_rr_no_1272" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Challan No & Date. <span className="text-rose-600 font-black text-sm">*</span>
                  </label>

                  <input
                    id="challan_rr_no_1272" aria-label="Challan / R.R. No."
                    type="text"
                    name="challan_rr_no"
                    value={formData.challan_rr_no}
                    onChange={handleChange}
                    required
                    className="flex-1 border border-gray-400 rounded bg-white px-2.5 h-7 text-xs font-bold"
                  />
                </div>

                {/* Lorry */}
                <div className="flex items-center gap-2">
                  <label htmlFor="lorry_prefix_1288" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Lorry Number <span className="text-rose-600 font-black text-sm">*</span>
                  </label>

                  <div className="flex-1 flex gap-1.5">
                    <input
                      id="lorry_prefix_1288" aria-label="Lorry Number"
                      type="text"
                      name="lorry_prefix"
                      value={formData.lorry_prefix}
                      onChange={handleChange}
                      placeholder="PREFIX"
                      required
                      className="w-24 text-center uppercase border border-gray-400 rounded h-7 text-xs font-bold"
                    />

                    <input
                      id="lorry_suffix_1297" aria-label="SUFFIX"
                      type="text"
                      name="lorry_suffix"
                      value={formData.lorry_suffix}
                      onChange={handleChange}
                      placeholder="SUFFIX"
                      required
                      className="flex-1 text-center uppercase border border-gray-400 rounded h-7 text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Pan */}
                <div className="flex items-center gap-2">
                  <label htmlFor="pan_no_1314" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Pan No.
                  </label>

                  <input
                    id="pan_no_1314" aria-label="Pan No."
                    type="text"
                    name="pan_no"
                    value={formData.pan_no}
                    onChange={handleChange}
                    className="flex-1 border border-gray-400 rounded bg-white px-2.5 h-7 text-xs font-bold font-mono"
                  />
                </div>

                {/* Arrival Date */}
                <div className="flex items-center gap-2">
                  <label htmlFor="lorry_date_1329" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Lorry Arrival Date <span className="text-rose-600 font-black text-sm">*</span>
                  </label>

                  <input
                    id="lorry_date_1329" aria-label="Lorry Arrival Date"
                    type="date"
                    name="lorry_date"
                    value={formData.lorry_date}
                    onChange={handleChange}
                    required
                    className="flex-1 border border-gray-400 rounded bg-white px-2 h-7 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#F7AFA8]"
                  />
                </div>

              </div>

            </div>
          </div>
        </div>

        {/* ===========================Transport & Document Info=========================== */}
        <div className="w-full rounded-xl border border-[#F7AFA8] bg-white shadow-xs overflow-visible relative z-10 mt-3">

          {/* Header */}
          <div className="bg-[#F7AFA8] px-4 py-1.5 rounded-t-[11px]">
            <h3 className="text-white text-xs font-bold tracking-wide uppercase">
              Transport & Document Information
            </h3>
          </div>

          {/* Body */}
          <div className="p-3">

            <div className="grid grid-cols-2 gap-x-6 gap-y-2">

              {/* ================= LEFT ================= */}
              <div className="space-y-1.5">

                {/* Consignment */}
                <div>
                  <label htmlFor="consignment_note_no_1368" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Consignment Note No.
                  </label>

                  <input
                    id="consignment_note_no_1368" aria-label="Consignment Note No."
                    type="text"
                    name="consignment_note_no"
                    value={formData.consignment_note_no}
                    onChange={handleChange}
                    readOnly={formData.jci === 'No'}
                    className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#F7AFA8]"  }`}
                  />
                </div>

                {/* DI */}
                <div>
                  <label htmlFor="di_no_1385" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    D.I. Details
                  </label>

                  <div className="grid grid-cols-2 gap-2">

                    <input
                      id="di_no_1385" aria-label="D.I. Details"
                      type="text"
                      name="di_no"
                      placeholder="DI Number"
                      value={formData.di_no}
                      onChange={handleChange}
                      readOnly={formData.jci === 'No'}
                      className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#F7AFA8]"  }`}
                      //className="h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                    />

                    <input
                      id="di_date_1394" aria-label="di date"
                      type="date"
                      name="di_date"
                      value={formData.di_date}
                      onChange={handleChange}
                      //className="h-7 rounded border border-gray-300 px-2 text-xs"
                      readOnly={formData.jci === 'No'}
                      className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#F7AFA8]"  }`}
                    />

                  </div>
                </div>

                {/* Invoice */}
                <div>
                  <label htmlFor="invoice_no_1413" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Invoice Details
                  </label>

                  <div className="grid grid-cols-2 gap-2">

                    <input
                      id="invoice_no_1413" aria-label="Invoice Details"
                      type="text"
                      name="invoice_no"
                      placeholder="Invoice Number"
                      value={formData.invoice_no}
                      onChange={handleChange}
                      readOnly={formData.jci === 'No'}
                      className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#F7AFA8]"  }`}
                      //className="h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                    />

                    <input
                      id="invoice_date_1422" aria-label="invoice date"
                      type="date"
                      name="invoice_date"
                      value={formData.invoice_date}
                      onChange={handleChange}
                      readOnly={formData.jci === 'No'}
                      className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#F7AFA8]"  }`}
                      //className="h-7 rounded border border-gray-300 px-2 text-xs"
                    />

                  </div>
                </div>

                {/* PTF */}
                <div>
                  <label htmlFor="ptf_1439" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    P.T.F
                  </label>

                  <select
                    id="ptf_1439" aria-label="P.T.F"
                    name="ptf"
                    value={formData.ptf}
                    onChange={handleChange}
                    className="w-full h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                {/* Lorry */}
                <div>
                  <label htmlFor="lorry_returned_1458" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Lorry Returned
                  </label>

                  <div className="grid grid-cols-2 gap-2">

                    <select
                      id="lorry_returned_1458" aria-label="Lorry Returned"
                      name="lorry_returned"
                      value={formData.lorry_returned}
                      onChange={handleChange}
                      className="h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>

                    <select
                      id="lorry_returned_other_mill_1468" aria-label="lorry returned other mill"
                      name="lorry_returned_other_mill"
                      value={formData.lorry_returned_other_mill}
                      onChange={handleChange}
                      className="h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                    >
                      <option value="No">Ret. Other Mill : No</option>
                      <option value="Yes">Ret. Other Mill : Yes</option>
                    </select>

                  </div>
                </div>

                {/* Arrival Area */}
                <div>
                  <label htmlFor="arrival_area_code_1489" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Arrival Area <span className="text-rose-600 font-black text-sm">*</span>
                  </label>

                  <div className="flex gap-2">

                    <input
                      id="arrival_area_code_1489" aria-label="Arrival Area"
                      type="text"
                      name="arrival_area_code"
                      value={formData.arrival_area_code}
                      readOnly
                      className="w-16 h-7 rounded border border-gray-300 bg-slate-100 text-center text-xs font-bold"
                    />

                    <select
                      id="arrival_area_name_1497"
                      aria-label="Arrival area name"
                      name="arrival_area_name"
                      value={formData.arrival_area_name}
                      onChange={(e) => {
                        const areaVal = e.target.value;
                        const matchedArea = areas.find(a => a.area_name === areaVal);

                        const validAgencies = areaVal ? getAgenciesForArea(areaVal) : [];
                        const validSet = new Set([
                          ...validAgencies.map(a => a.AGENCY_NAME.toUpperCase()),
                          ...validAgencies.map(a => a.AGENCY_CODE.toUpperCase())
                        ]);

                        setDetails(prev => prev.map(d => {
                          const agName = (d.agency_name || '').trim().toUpperCase();
                          const agCode = (d.agency_code || '').trim().toUpperCase();
                          if ((agName && !validSet.has(agName)) || (agCode && !validSet.has(agCode))) {
                            return { ...d, agency_name: '', agency_code: '' };
                          }
                          return d;
                        }));

                        setFormData(prev => ({
                          ...prev,
                          arrival_area_name: areaVal,
                          arrival_area_code: matchedArea ? matchedArea.area_code : prev.arrival_area_code
                        }));
                      }}
                      required
                      className="flex-1 h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                    >
                      <option value="">-- SELECT AREA --</option>

                      {areas.map(a => (
                        <option key={a.id} value={a.area_name}>
                          {a.area_name}
                        </option>
                      ))}
                    </select>

                  </div>
                </div>

              </div>

              {/* ================= RIGHT ================= */}

              <div className="space-y-1.5">

                {/* Unit */}
                <div>
                  <label htmlFor="unit_code_1541" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Unit <span className="text-rose-600 font-black text-sm">*</span>
                  </label>

                  <div className="flex gap-2">

                    <input
                      id="unit_code_1541" aria-label="Unit"
                      type="text"
                      name="unit_code"
                      value={formData.unit_code}
                      readOnly
                      required
                      className="w-16 h-7 rounded border border-gray-300 bg-slate-100 text-center text-xs font-bold"
                    />

                    <select
                      id="unit_name_1549" aria-label="unit name"
                      name="unit_name"
                      required
                      value={formData.unit_name || "BALES"}
                      onChange={(e) => {
                        const uVal = e.target.value;

                        const codeMap = {
                          BALES: "I",
                          LOOSE: "II",
                          DRUMS: "2",
                          "P.BALES": "4",
                          "H.BALES": "5",
                        };

                        setFormData(prev => ({
                          ...prev,
                          unit_name: uVal,
                          unit_code:
                            codeMap[uVal] ||
                            prev.unit_code ||
                            "1",
                        }));
                      }}
                      className="flex-1 h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                    >
                      {Array.from(
                        new Set(
                          [...unitList, formData.unit_name].filter(Boolean)
                        )
                      ).map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>

                  </div>
                </div>

                {/* Way Bill */}
                <div>
                  <label htmlFor="way_bill_no_1596" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Way Bill
                  </label>

                  <div className="grid grid-cols-2 gap-2">

                    <input
                      id="way_bill_no_1596" aria-label="Way Bill"
                      type="text"
                      name="way_bill_no"
                      value={formData.way_bill_no}
                      onChange={handleChange}
                      placeholder="Way Bill No."
                      //className="h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                      readOnly={formData.jci === 'No'}
                      className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#F7AFA8]"  }`}
                    />

                    <input
                      id="way_bill_date_1605" aria-label="way bill date"
                      type="date"
                      name="way_bill_date"
                      value={formData.way_bill_date}
                      onChange={handleChange}
                      //className="h-7 rounded border border-gray-300 px-2 text-xs"
                      readOnly={formData.jci === 'No'}
                      className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#F7AFA8]"  }`}
                    />

                  </div>
                </div>

                {/* APMC */}
                <div>
                  <label htmlFor="apmc_fees_1622" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    A.P.M.C Fees (Rs.) 
                  </label>

                  <input
                    id="apmc_fees_1622" aria-label="A.P.M.C Fees (Rs.)"
                    type="number"
                    step="0.01"
                    min="0"
                    name="apmc_fees"
                    placeholder="0.00"
                    value={formData.apmc_fees !== undefined && formData.apmc_fees !== null ? formData.apmc_fees : ""}
                    onChange={handleChange}
                    className="w-full h-7 rounded border border-gray-300 px-2 text-right text-xs font-bold focus:border-[#F7AFA8]"
                  />
                </div>

                {/* Remarks */}
                <div>
                  <label htmlFor="remarks_1638" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Remarks
                  </label>

                  <textarea
                    id="remarks_1638" aria-label="Remarks"
                    name="remarks"
                    rows={2}
                    value={formData.remarks}
                    onChange={handleChange}
                    placeholder="Enter Remarks..."
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-semibold resize-none h-14"
                  />
                </div>

              </div>

            </div>

          </div>

        </div>

                {/* ===========================Receipt Grade Details & Weight Information=========================== */}
        <TemporaryArrivalGrid
          details={details}
          unitName={formData.unit_name}
          grades={grades}
          agencies={filteredArrivalAgencies}
          markas={markas}
          formDataArea={formData.arrival_area_name}
          onAddRow={handleAddRow}
          onDeleteRow={handleDeleteRow}
          onDeleteRowAt={handleDeleteRowAt}
          onDetailChange={handleDetailChange}
        />

        <TemporaryArrivalWeightCard
          formData={formData}
          onChange={handleChange}
        />

        {/* Bottom Action Bar */}
        <div className="w-full rounded-xl border border-[#F7AFA8] bg-[#F7AFA8] shadow-md overflow-hidden mt-5">
          <div className="flex justify-end items-center gap-3">
            <button
              onClick={clearForm}
              className="flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow transition-all duration-200 hover:scale-[1.02] active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Clear (F2)
            </button>

            <button
              onClick={onCancel}
              className="flex items-center gap-2 h-9 px-5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow transition-all duration-200 hover:scale-[1.02] active:scale-95"
            >
              <X className="w-3.5 h-3.5" />
              Exit (Esc)
            </button>

            <button
              onClick={handleSave}
              disabled={loading}
              className={`flex items-center gap-2 h-9 px-6 rounded-lg text-xs font-semibold shadow transition-all duration-200 active:scale-95 ${
                loading
                  ? "bg-gray-500 text-white cursor-not-allowed"
                  : "bg-[#ffb900] hover:bg-[#e6a700] text-black"
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              {loading ? "SAVING..." : "SAVE ARRIVAL"}
            </button>
          </div>
        </div>

      </div>
        <div>
          <datalist id="markas_list">
            {markas.map((m, mIdx) => (
              <option key={m.id || mIdx} value={m.marka_name} />
            ))}
          </datalist>

          <datalist id="agencies_list">
            {filteredArrivalAgencies.map((a, aIdx) => (
              <option key={a.AGENCY_NAME || aIdx} value={a.AGENCY_NAME} />
            ))}
          </datalist>
        </div>
    </LegacyLayout>
  );
}
