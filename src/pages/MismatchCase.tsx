import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Scale, 
  Clock, 
  TrendingUp, 
  Check, 
  FileSpreadsheet, 
  RefreshCw,
  Info
} from 'lucide-react';
import { cn, canApproveMismatch } from '../lib/utils';
import { dbModule } from '../services/dbModule';
import { supabase } from '../lib/supabase';
import { comparePoInspection, PoMismatchDetail } from '../lib/poMatch';
import LegacyLayout from '../components/LegacyLayout';
import { getCurrentUserContext } from '../lib/permissions';

const inMemorySattaResolutions: Record<string, any> = {};

// Excel Seed Data for Satta differentials
const EXCEL_SEED_DATA = [
  {
    area: "DAISEE",
    diffs: { TD4: 600, TD5: -300, TD6: -200, TD7: -500, TD8: -1000, "H.BALES": -50, DRUMS: -100 }
  },
  {
    area: "TULSIHATTA",
    diffs: { TD5: 750, TD6: 350, TD7: -55, TD8: -550 }
  },
  {
    area: "BANGLADESH",
    diffs: { "BTR HD KS": 2800, "BTR HD CS": 2300, "BTR HD BS": 1800, "BTR NB KS": 800, "BTR NB FFS": 1300, "BTR NB (SMR)": 200 }
  },
  {
    area: "GRP LOOSE",
    diffs: { TD5: 400, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "L/A TARABARI",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100 }
  },
  {
    area: "U/ASSAM",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100, LOOSE: -200 }
  },
  {
    area: "KANKI",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "RAIGANJ",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "DHULIYAAN",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "SAMSI JUNGLE",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "RAIGANJ Loose",
    diffs: { TD5: 400, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "NORTHERN",
    diffs: { TD6: 3200, TD7: 2800, TD8: 2300, TD9: 1800, TD10: 1300, W5: 1800, W6: 1300 }
  },
  {
    area: "GAJAL LOOSE",
    diffs: {}
  },
  {
    area: "BADURIA",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "BASIRHAT",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "GOLABRI D/D",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "HARIPAL",
    diffs: { TD5: -300, TD6: -205, TD7: -500, TD8: -1000 }
  },
  {
    area: "MAYNA D/S",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "S/N ISLAMPUR",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "SHEORAPHULLY",
    diffs: { HBJB: -1000, ROPES: -1000, CUTTING: -700, "TH.WASTE": -10000, "RRY CUTT": -12000 }
  },
  {
    area: "PURNEA(BIHAR)",
    diffs: { TD5: 500, TD6: 100, TD7: -300, TD8: -800 }
  }
];

const GRADE_SATTA_VARIANCE_LIMITS: Record<string, number> = {
  'TD4': 0,
  'TD5': 0,
  'TD6': 0,
  'TD7': 0,
  'TD8': 0,
  'DEFAULT': 0
};

export interface MaterialMismatchItem {
  id: string;
  poNo: string;
  saudaNo: string;
  supplierName: string;
  brokerName: string;
  area: string;
  grade: string;
  agency: string;
  ptfMode: string;
  poContract: string;
  challanSupplier: string;
  ratePerMt: string;
  lorryNumber: string;
  lorryProgress: {
    totalLorries: number;
    receivedLorries: number;
    remainingLorries: number;
  };
  mismatchedFields: string[];
  mismatchDetailsList: PoMismatchDetail[];
  detectedAt: string;
  issueDescription: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'resolved';
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  approvalLevel?: string;
}

export interface SattaMismatchItem {
  id: string;
  poNo: string;
  poDate: string;
  supplierName: string;
  brokerName: string;
  area: string;
  grade: string;
  poRate: number;
  sattaBaseRate: number;
  differential: number;
  sattaFinalRate: number;
  status: 'dispute' | 'ok' | 'resolved';
  issueDescription: string;
  difference: number;
  weightMt: number;
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export default function MismatchCase({ onClose, variant = 'satta' }: { onClose?: () => void; variant?: 'satta' | 'material' }) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'ruka_to_satta' | 'material_inspection'>(variant === 'material' ? 'material_inspection' : 'ruka_to_satta');
  
  // Material Mismatch States
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [selectedBroker, setSelectedBroker] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [mismatchList, setMismatchList] = useState<MaterialMismatchItem[]>([]);
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  
  // Satta Mismatch States
  const [sattaMismatchList, setSattaMismatchList] = useState<SattaMismatchItem[]>([]);
  const [sattaFilterStatus, setSattaFilterStatus] = useState<'all' | 'dispute' | 'ok' | 'resolved'>('dispute');

  const [successToast, setSuccessToast] = useState<string | null>(null);

  const parseDateToComparable = (dateStr: string) => {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) return dateStr;
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dateStr;
  };

  const getSattaRate = (date: string, poArea: string, poGrade: string, baseRates: any[], differentials: any[]) => {
    if (!date) return { baseRate: 17500, differential: 0, finalRate: 17500 };

    const sortedBase = [...baseRates].sort((a, b) => b.start_date.localeCompare(a.start_date));
    const effectiveBase = sortedBase.find(r => r.start_date <= date) || sortedBase[sortedBase.length - 1];
    const baseRate = effectiveBase ? Number(effectiveBase.base_rate) : 16700;

    const cleanArea = (poArea || '').trim().toUpperCase();
    const cleanGrade = (poGrade || '').trim().replace(/\./g, '').toUpperCase();

    const lookupAreas = [cleanArea];
    if (cleanArea === 'SEMI NORTHERN' || cleanArea.includes('SEMI NORTHERN')) {
      lookupAreas.push('NORTHERN');
    } else if (cleanArea === 'NORTHERN' || cleanArea.includes('NORTHERN')) {
      lookupAreas.push('SEMI NORTHERN');
    }

    if (cleanArea.includes('PURNEA') || cleanArea.includes('BIHAR')) {
      if (!lookupAreas.includes('PURNEA(BIHAR)')) lookupAreas.push('PURNEA(BIHAR)');
      if (!lookupAreas.includes('PURNEA')) lookupAreas.push('PURNEA');
    }

    let differential: number | undefined;
    for (const lookupArea of lookupAreas) {
      const match = differentials.find(d => 
        (d.area || '').trim().toUpperCase() === lookupArea &&
        (d.grade || '').trim().replace(/\./g, '').toUpperCase() === cleanGrade
      );
      if (match) {
        differential = Number(match.differential);
        break;
      }
    }

    if (differential === undefined) {
      for (const lookupArea of lookupAreas) {
        const seedArea = EXCEL_SEED_DATA.find(r => r.area.toUpperCase() === lookupArea);
        if (seedArea && seedArea.diffs) {
          const key = Object.keys(seedArea.diffs).find(k => k.toUpperCase() === cleanGrade);
          if (key) {
            differential = (seedArea.diffs as Record<string, number>)[key];
            break;
          }
        }
      }
    }

    if (differential === undefined) {
      differential = 0;
    }

    return {
      baseRate,
      differential,
      finalRate: baseRate + differential
    };
  };

  const loadMismatches = async () => {
    setLoading(true);
    try {
      // Direct fresh queries from database (no browser cache dependency)
      const [scpRows, scpDetailRows, amadRows, inspMasterRows, dbMismatches, purchaseMasterRows, purchaseDetailRows, sattaBaseRows, sattaDiffRows, gradeRows] = await Promise.all([
        supabase ? supabase.from('sauda_check_point').select('*').then(res => res.data || []) : dbModule.fetchAll('sauda_check_point').catch(() => []),
        supabase ? supabase.from('sauda_check_point_details').select('*').then(res => res.data || []) : dbModule.fetchAll('sauda_check_point_details').catch(() => []),
        dbModule.fetchAll('temporary_material_received').catch(() => []),
        dbModule.fetchAll('mill_inspection_master').catch(() => []),
        supabase ? supabase.from('material_mismatch').select('*').then(res => res.data || []) : Promise.resolve([]),
        dbModule.fetchAll('purchase_master').catch(() => []),
        supabase ? supabase.from('purchase_detail_master').select('*').then(res => res.data || []) : Promise.resolve([]),
        supabase ? supabase.from('satta_base_rates').select('*').then(res => res.data || []) : Promise.resolve([]),
        supabase ? supabase.from('satta_differentials').select('*').then(res => res.data || []) : Promise.resolve([]),
        dbModule.fetchAll('grade_master').catch(() => []),
      ]);

      const items: MaterialMismatchItem[] = [];

      // Combine PO sources: sauda_check_point + purchase_master
      const allPoRecords = [...scpRows, ...purchaseMasterRows];
      const poMap = new Map<string, any>();
      allPoRecords.forEach(p => {
        const pNo = String(p.po_no || p.contract_po_no || '').trim().toUpperCase();
        if (pNo && !poMap.has(pNo)) poMap.set(pNo, p);
      });

      const allDetailRecords = [...scpDetailRows, ...purchaseDetailRows];

      poMap.forEach((po, poNo) => {
        const matchingInspections = inspMasterRows.filter((i: any) => String(i.po_no || '').trim().toUpperCase() === poNo);
        const matchingAmads = amadRows.filter((a: any) => String(a.po_no || '').trim().toUpperCase() === poNo);
        const poDetails = allDetailRecords.filter((d: any) => String(d.po_no || '').trim().toUpperCase() === poNo);

        const latestInsp = matchingInspections[0] || matchingAmads[0] || null;
        if (!latestInsp) return;

        const enrichedInsp = {
          ...latestInsp,
          ...(matchingAmads[0] || {}),
        };

        const allLorryReceipts = [...matchingInspections, ...matchingAmads];

        const matchRes = comparePoInspection(po, poDetails, enrichedInsp, allLorryReceipts);

        if (matchRes.hasInspection && matchRes.status === 'mismatch' && matchRes.mismatches.length > 0) {
          const dbMm = dbMismatches.find((m: any) => 
            String(m.po_no || '').trim().toUpperCase() === poNo || 
            String(m.mismatch_id || '').toUpperCase() === `MIS-${poNo}`
          );
          
          const isCleared = po.mismatch_cleared === true || (dbMm && dbMm.status === 'resolved');

          const mismatchedLabels = matchRes.mismatches.map(m => m.mismatchLabel || `${m.field} mismatch`);

          items.push({
            id: `MIS-${poNo}`,
            poNo: poNo,
            saudaNo: po.po_contract || po.contract_no || po.sauda_no || 'N/A',
            supplierName: po.supplier || po.supplier_name || 'N/A',
            brokerName: po.broker || po.broker_name || 'N/A',
            area: po.area || 'N/A',
            grade: po.grade || po.quality || 'N/A',
            agency: po.agency || po.agency_name || 'N/A',
            ptfMode: po.ptf_mode || po.po_type || 'N/A',
            poContract: po.po_contract || po.contract_no || 'N/A',
            challanSupplier: po.challan_supplier || 'N/A',
            ratePerMt: po.b_rate ? `₹ ${po.b_rate}` : (poDetails[0]?.rate_qntl ? `₹ ${poDetails[0].rate_qntl * 10}` : 'N/A'),
            lorryNumber: enrichedInsp.lorry_number || enrichedInsp.lorry_no || 'N/A',
            lorryProgress: matchRes.lorryProgress || { totalLorries: 1, receivedLorries: 1, remainingLorries: 0 },
            mismatchedFields: mismatchedLabels,
            mismatchDetailsList: matchRes.mismatches,
            detectedAt: String(enrichedInsp.created_at || po.created_at || new Date().toISOString()).split('T')[0],
            issueDescription: `Mismatched fields detected: ${mismatchedLabels.join(', ')}.`,
            severity: matchRes.mismatches.some(m => m.field.includes('Weight') || m.field.includes('Rate')) ? 'high' : 'medium',
            status: isCleared ? 'resolved' : 'pending',
            resolutionNotes: (dbMm && dbMm.remarks) || po.mismatch_remarks || undefined,
            resolvedBy: (dbMm && dbMm.approved_by) || po.approved_by || undefined,
            resolvedAt: (dbMm && dbMm.approved_at) ? String(dbMm.approved_at).split('T')[0] : (po.approved_at ? String(po.approved_at).split('T')[0] : undefined),
            approvalLevel: (dbMm && dbMm.approval_level) || po.approval_level || 'L3/L5',
          });
        }
      });

      // Also include standalone records from material_mismatch table in DB
      dbMismatches.forEach((r: any) => {
        const poNo = String(r.po_no || '').trim().toUpperCase();
        if (poNo && !items.some(i => i.poNo === poNo)) {
          const labels = r.mismatched_fields ? r.mismatched_fields.split(', ') : ['Material mismatch'];
          items.push({
            id: r.mismatch_id || `MIS-${poNo}`,
            poNo: poNo,
            saudaNo: 'N/A',
            supplierName: r.supplier || 'N/A',
            brokerName: r.broker || 'N/A',
            area: r.area || 'N/A',
            grade: r.grade || 'N/A',
            agency: r.agency || 'N/A',
            ptfMode: r.ptf_mode || 'N/A',
            poContract: 'N/A',
            challanSupplier: r.challan_supplier || 'N/A',
            ratePerMt: r.rate_per_mt || 'N/A',
            lorryNumber: r.lorry_number || 'N/A',
            lorryProgress: { totalLorries: 1, receivedLorries: 1, remainingLorries: 0 },
            mismatchedFields: labels,
            mismatchDetailsList: [],
            detectedAt: r.created_at ? String(r.created_at).split('T')[0] : new Date().toISOString().split('T')[0],
            issueDescription: r.issue_description || `Mismatched fields: ${labels.join(', ')}.`,
            severity: (r.severity as any) || 'medium',
            status: r.status === 'resolved' ? 'resolved' : 'pending',
            resolutionNotes: r.remarks,
            resolvedBy: r.approved_by,
            resolvedAt: r.approved_at ? String(r.approved_at).split('T')[0] : undefined,
            approvalLevel: r.approval_level || 'L3/L5',
          });
        }
      });

      setMismatchList(items);

      // --- Satta Mismatch Processing ---
      const sattaItems: SattaMismatchItem[] = [];
      if (allPoRecords.length > 0 && purchaseDetailRows.length > 0) {
        purchaseDetailRows.forEach((detail: any) => {
          const matchedPo = allPoRecords.find((p: any) => p.po_no === detail.po_no);
          if (matchedPo) {
            const matchedGrade = (gradeRows || []).find((g: any) => String(g.grade_code).trim() === String(detail.grade_code).trim());
            const poGrade = (matchedGrade ? matchedGrade.grade_name || '' : (detail.grade_code || '')).trim().replace(/\./g, '').toUpperCase() || 'TD6';
            const poRate = Number(detail.rate_qntl || detail.rate_per_qtl || 0);
            const poDate = matchedPo.po_date || matchedPo.date || '2026-04-02';
            const poArea = matchedPo.area || 'NORTHERN';
            
            const { baseRate, differential, finalRate } = getSattaRate(
              parseDateToComparable(poDate),
              poArea,
              poGrade,
              sattaBaseRows,
              sattaDiffRows
            );
            
            const allowedVariance = GRADE_SATTA_VARIANCE_LIMITS[poGrade] !== undefined 
              ? GRADE_SATTA_VARIANCE_LIMITS[poGrade] 
              : (GRADE_SATTA_VARIANCE_LIMITS.DEFAULT || 0);
            const diffInRate = poRate - finalRate;
            const hasMismatch = diffInRate > allowedVariance;
            
            if (poRate > 0) {
              const id = `SAT-${detail.item_id || Math.random().toString(36).substring(2, 10)}`;
              sattaItems.push({
                id,
                poNo: detail.po_no,
                poDate: poDate,
                supplierName: matchedPo.supplier || 'UNKNOWN SUPPLIER',
                brokerName: matchedPo.broker || 'UNKNOWN BROKER',
                area: poArea,
                grade: poGrade,
                poRate: poRate,
                sattaBaseRate: baseRate,
                differential: differential,
                sattaFinalRate: finalRate,
                status: hasMismatch ? 'dispute' : 'ok',
                issueDescription: hasMismatch 
                  ? `Rate mismatch detected (PO Contract Price is HIGH). Contract specifies ₹${(poRate * 10).toLocaleString()}/m.T, which exceeds active Satta limit of ₹${(finalRate * 10).toLocaleString()}/m.T.`
                  : "Rate aligns with active Satta Chart parameters.",
                difference: diffInRate,
                weightMt: Number(detail.weight_mt || 0)
              });
            }
          }
        });
      }

      setSattaMismatchList(sattaItems);
    } catch (err) {
      console.error('Error loading mismatches from DB:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMismatches();
    const handleUpdate = () => {
      loadMismatches();
    };
    window.addEventListener('app-data-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('app-data-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleResolve = async (itemId: string, itemPoNo: string) => {
    const remarks = remarksMap[itemId] || '';
    if (!remarks.trim()) {
      alert("Mandatory approval remarks required for L3/L5 clearance.");
      return;
    }

    const ctx = getCurrentUserContext();
    const username = ctx.username || 'L3/L5 User';
    const approvalLevel = (ctx.userLevel || ctx.userRole || 'L3/L5').toUpperCase();
    const nowIso = new Date().toISOString();

    if (supabase) {
      // 1. Update material_mismatch table in DB
      await supabase.from('material_mismatch').upsert({
        mismatch_id: itemId,
        po_no: itemPoNo,
        status: 'resolved',
        remarks: remarks.trim(),
        approved_by: username,
        approved_at: nowIso,
        approval_level: approvalLevel,
      }, { onConflict: 'mismatch_id' });

      // 2. Update sauda_check_point table in DB so Sauda Check Point shows cleared
      await supabase.from('sauda_check_point').update({
        mismatch_cleared: true,
        mismatch_remarks: remarks.trim(),
        approved_by: username,
        approved_at: nowIso,
        approval_level: approvalLevel,
      }).eq('po_no', itemPoNo);
    }

    // 3. Dispatch global live update events
    window.dispatchEvent(new CustomEvent('mismatch_resolved', { detail: { poNo: itemPoNo } }));
    window.dispatchEvent(new CustomEvent('app-data-updated'));

    // 4. Refetch fresh data from database
    await loadMismatches();

    setSuccessToast(`Purchase Order [${itemPoNo}] Material Mismatch approved and cleared by ${approvalLevel} level user.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const supplierOptions = Array.from(
    new Set(mismatchList.map(i => i.supplierName).filter(s => s && s !== 'N/A'))
  ).sort();

  const brokerOptions = Array.from(
    new Set(mismatchList.map(i => i.brokerName).filter(b => b && b !== 'N/A'))
  ).sort();

  const filteredMismatchList = mismatchList.filter(item => {
    const matchesSearch = 
      item.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.poNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brokerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.grade.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.issueDescription.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      filterStatus === 'all' ? true : item.status === filterStatus;

    const matchesSupplier = 
      selectedSupplier === 'ALL' ? true : item.supplierName.toLowerCase() === selectedSupplier.toLowerCase();

    const matchesBroker = 
      selectedBroker === 'ALL' ? true : item.brokerName.toLowerCase() === selectedBroker.toLowerCase();

    return matchesSearch && matchesStatus && matchesSupplier && matchesBroker;
  });

  const filteredSattaList = sattaMismatchList.filter(item => {
    const matchesSearch = 
      item.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.poNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brokerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.grade.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      sattaFilterStatus === 'all' ? true : item.status === sattaFilterStatus;

    const matchesSupplier = 
      selectedSupplier === 'ALL' ? true : item.supplierName.toLowerCase() === selectedSupplier.toLowerCase();

    const matchesBroker = 
      selectedBroker === 'ALL' ? true : item.brokerName.toLowerCase() === selectedBroker.toLowerCase();

    return matchesSearch && matchesStatus && matchesSupplier && matchesBroker;
  });

  const downloadCSV = () => {
    let csvContent = "";
    if (activeTab === 'ruka_to_satta') {
      csvContent = "data:text/csv;charset=utf-8," 
        + ["Mismatch ID,P.O. Number,Date,Supplier,Area,Grade,PO Rate (m.T),Satta Rate (m.T),Deviation,Status,Resolution Notes"]
          .concat(sattaMismatchList.map(item => 
            `"${item.id}","${item.poNo}","${item.poDate}","${item.supplierName}","${item.area}","${item.grade}","${item.poRate * 10}","${item.sattaFinalRate * 10}","${item.difference * 10}","${item.status}","${item.resolutionNotes || 'N/A'}"`
          )).join("\n");
    } else {
      csvContent = "data:text/csv;charset=utf-8," 
        + ["P.O. Number,Supplier,Broker,Area,Grade,Mismatched Fields,Status,Approved By,Remarks"]
          .concat(mismatchList.map(item => 
            `"${item.poNo}","${item.supplierName}","${item.brokerName}","${item.area}","${item.grade}","${item.mismatchedFields.join('; ')}","${item.status}","${item.resolvedBy || 'N/A'}","${item.resolutionNotes || 'N/A'}"`
          )).join("\n");
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BJCL-Mismatch-${activeTab === 'ruka_to_satta' ? 'Satta' : 'Material'}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pendingCount = mismatchList.filter(i => i.status === 'pending').length;
  const resolvedCount = mismatchList.filter(i => i.status === 'resolved').length;

  return (
    <LegacyLayout title={variant === 'material' ? "Material Mismatch Board" : "Satta Mismatch"} subtitle="">
      <div className="space-y-5 max-w-full px-1 sm:px-2">
        
        {/* Header Stats & Quick Action Bar */}
        <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Scale className="h-5 w-5 text-indigo-700" />
              <span>{variant === 'material' ? "Material Mismatch Board (Base Mode)" : "Satta Price Mismatch"}</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Comparison across Sauda Check Point, Temporary P.O., and Material Inspections. Always fetched fresh from database.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadMismatches}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-800 transition flex items-center gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-slate-600", loading && "animate-spin")} />
              <span>Fetch Fresh Data</span>
            </button>
            <button
              onClick={downloadCSV}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded text-xs font-bold transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {successToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-2 text-xs font-bold text-emerald-800 shadow-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Main Content Area */}
        {variant === 'material' ? (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="bg-white border border-slate-300 p-3 rounded-lg shadow-xs space-y-3">
              {/* Top Row: Quick Status Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setFilterStatus('pending')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider border transition flex items-center gap-1.5",
                      filterStatus === 'pending'
                        ? "bg-rose-700 text-white border-rose-800 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Pending ({pendingCount})</span>
                  </button>
                  <button
                    onClick={() => setFilterStatus('resolved')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider border transition flex items-center gap-1.5",
                      filterStatus === 'resolved'
                        ? "bg-emerald-700 text-white border-emerald-800 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Resolved ({resolvedCount})</span>
                  </button>
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider border transition",
                      filterStatus === 'all'
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    All ({mismatchList.length})
                  </button>
                </div>

                {/* Reset Filters */}
                {(selectedSupplier !== 'ALL' || selectedBroker !== 'ALL' || searchQuery || filterStatus !== 'pending') && (
                  <button
                    onClick={() => {
                      setSelectedSupplier('ALL');
                      setSelectedBroker('ALL');
                      setFilterStatus('pending');
                      setSearchQuery('');
                    }}
                    className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline flex items-center gap-1"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Bottom Row: Dropdown Selectors & Search Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                {/* Status Dropdown */}
                <div>
                  <label htmlFor="filter_by_status_685" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                    Filter by Status
                  </label>
                  <select
 id="filter_by_status_685" name="filter_by_status" aria-label="Filter by Status"                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full text-xs py-1.5 px-2 border border-slate-300 rounded bg-white text-slate-800 font-bold focus:outline-none focus:border-indigo-600"
                  >
                    <option value="pending">Pending Approval</option>
                    <option value="resolved">Resolved / Approved</option>
                    <option value="all">All Statuses</option>
                  </select>
                </div>

                {/* Supplier Dropdown */}
                <div>
                  <label htmlFor="filter_by_supplier_701" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                    Filter by Supplier
                  </label>
                  <select
 id="filter_by_supplier_701" name="filter_by_supplier" aria-label="Filter by Supplier"                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full text-xs py-1.5 px-2 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:outline-none focus:border-indigo-600"
                  >
                    <option value="ALL">All Suppliers ({supplierOptions.length})</option>
                    {supplierOptions.map((s, idx) => (
                      <option key={idx} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Broker Dropdown */}
                <div>
                  <label htmlFor="filter_by_broker_718" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                    Filter by Broker
                  </label>
                  <select
 id="filter_by_broker_718" name="filter_by_broker" aria-label="Filter by Broker"                    value={selectedBroker}
                    onChange={(e) => setSelectedBroker(e.target.value)}
                    className="w-full text-xs py-1.5 px-2 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:outline-none focus:border-indigo-600"
                  >
                    <option value="ALL">All Brokers ({brokerOptions.length})</option>
                    {brokerOptions.map((b, idx) => (
                      <option key={idx} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {/* Search Input Bar */}
                <div>
                  <label htmlFor="search_keyword_737" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                    Search Keyword
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400 font-bold" />
                    <input
 id="search_keyword_737" name="search_keyword" aria-label="Search Keyword"                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="PO, Area, Grade, Discrepancy..."
                      className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-indigo-600 text-slate-800 font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Main Material Mismatch Base Table */}
            <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-700 border-t-transparent mx-auto" />
                  <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mt-3">Fetching fresh data from database...</p>
                </div>
              ) : filteredMismatchList.length === 0 ? (
                <div className="p-12 text-center bg-slate-50">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase">No Material Mismatches Found</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    All Purchase Orders match their corresponding Material Inspections and arrival receipts.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10.5px] tracking-wider">
                        <th className="p-3 border-r border-slate-200">P.O. Number & Date</th>
                        <th className="p-3 border-r border-slate-200">Supplier & Broker</th>
                        <th className="p-3 border-r border-slate-200">Area & Grade</th>
                        <th className="p-3 border-r border-slate-200 bg-indigo-50/50 text-indigo-950 font-black">
                          Remaining Lorries (Contract | Recv | Rem)
                        </th>
                        <th className="p-3 border-r border-slate-200 text-rose-800">Mismatched Fields</th>
                        <th className="p-3 border-r border-slate-200">Status</th>
                        <th className="p-3">Action & Approval Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredMismatchList.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition align-top">
                          {/* PO Number & Date */}
                          <td className="p-3 border-r border-slate-200 font-mono">
                            <div className="font-extrabold text-slate-900 text-sm">{item.poNo}</div>
                            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                              Detected: {item.detectedAt}
                            </div>
                            {item.saudaNo && item.saudaNo !== 'N/A' && (
                              <div className="text-[9.5px] text-indigo-700 font-bold mt-0.5">
                                Sauda: {item.saudaNo}
                              </div>
                            )}
                          </td>

                          {/* Supplier & Broker */}
                          <td className="p-3 border-r border-slate-200">
                            <div className="font-bold text-slate-900 uppercase">{item.supplierName}</div>
                            <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                              Broker: <span className="font-semibold text-slate-800">{item.brokerName}</span>
                            </div>
                            {item.challanSupplier && item.challanSupplier !== 'N/A' && (
                              <div className="text-[10px] text-slate-500">Challan Supp: {item.challanSupplier}</div>
                            )}
                          </td>

                          {/* Area & Grade */}
                          <td className="p-3 border-r border-slate-200">
                            <div className="font-bold text-slate-800">{item.area}</div>
                            <div className="text-[11px] text-slate-600 font-medium">Grade: <span className="font-bold">{item.grade}</span></div>
                            {item.agency && item.agency !== 'N/A' && (
                              <div className="text-[10px] text-slate-500">Agency: {item.agency}</div>
                            )}
                          </td>

                          {/* Remaining Lorries Column */}
                          <td className="p-3 border-r border-slate-200 bg-indigo-50/30 min-w-[180px]">
                            <div className="bg-white border border-indigo-200 rounded p-2 text-center shadow-2xs space-y-1">
                              <div className="text-[11px] font-black text-indigo-950">
                                {item.lorryProgress?.totalLorries || 1} Contract | {item.lorryProgress?.receivedLorries || 1} Recv
                              </div>
                              <div className={cn(
                                "text-[10px] font-extrabold px-2 py-0.5 rounded border inline-block",
                                (item.lorryProgress?.remainingLorries ?? 0) > 0 
                                  ? "bg-amber-100 text-amber-900 border-amber-300" 
                                  : "bg-emerald-100 text-emerald-900 border-emerald-300"
                              )}>
                                {(item.lorryProgress?.remainingLorries ?? 0) > 0 
                                  ? `⏳ Waiting For Remaining Lorries (${item.lorryProgress.remainingLorries} Left)` 
                                  : "✅ All Lorries Received"}
                              </div>
                            </div>
                          </td>

                          {/* Mismatched Fields Column */}
                          <td className="p-3 border-r border-slate-200 max-w-xs">
                            <div className="flex flex-wrap gap-1 mb-2">
                              {item.mismatchedFields.map((fieldLabel, idx) => (
                                <span
                                  key={idx}
                                  className="bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight"
                                >
                                  ⚠️ {fieldLabel}
                                </span>
                              ))}
                            </div>

                            {/* Field Discrepancy Breakdown */}
                            {item.mismatchDetailsList && item.mismatchDetailsList.length > 0 && (
                              <div className="bg-slate-50 border border-slate-200 rounded p-1.5 space-y-1 text-[10px]">
                                {item.mismatchDetailsList.map((d, dIdx) => (
                                  <div key={dIdx} className="flex items-center justify-between text-slate-700">
                                    <span className="font-bold text-slate-800">{d.field}:</span>
                                    <span className="text-slate-500 line-through mr-1">{d.poValue}</span>
                                    <span className="font-extrabold text-rose-700">➔ {d.inspValue}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="p-3 border-r border-slate-200">
                            {item.status === 'resolved' ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                                Cleared / Approved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-700" />
                                Pending Approval
                              </span>
                            )}
                          </td>

                          {/* Action & Remarks */}
                          <td className="p-3 min-w-[220px]">
                            {item.status === 'pending' ? (
                              canApproveMismatch() ? (
                                <div className="space-y-2">
                                  <textarea
 id="enter_approval_remarks_882" name="enter_approval_remarks" aria-label="Enter approval remarks..."                                    rows={2}
                                    placeholder="Enter approval remarks..."
                                    value={remarksMap[item.id] || ''}
                                    onChange={(e) => setRemarksMap({ ...remarksMap, [item.id]: e.target.value })}
                                    className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 bg-white"
                                  />
                                  <button
                                    onClick={() => handleResolve(item.id, item.poNo)}
                                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black uppercase px-3 py-1.5 rounded text-[10.5px] tracking-wider transition flex items-center justify-center gap-1.5 shadow-xs"
                                  >
                                    <Check className="h-4 w-4" />
                                    <span>Approve Mismatch</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="bg-slate-100 border border-slate-200 text-slate-600 p-2 rounded text-[10px] font-bold text-center">
                                  🔒 L3 / L5 Level User Approval Required
                                </div>
                              )
                            ) : (
                              <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-[10px] text-slate-800 space-y-1">
                                <div className="font-extrabold text-emerald-950 flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                                  <span>Approval Record</span>
                                </div>
                                <div><span className="font-bold">Approved By:</span> {item.resolvedBy || 'L3/L5 User'}</div>
                                <div><span className="font-bold">Approval Level:</span> <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-950 font-black rounded text-[9.5px]">{item.approvalLevel || 'L3/L5'}</span></div>
                                <div><span className="font-bold">Date:</span> {item.resolvedAt || 'N/A'}</div>
                                <div><span className="font-bold">Remarks:</span> "{item.resolutionNotes || 'Approved'}"</div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Satta Mismatch View */
          <div className="space-y-4">
            <div className="bg-white border border-slate-300 p-3 rounded-lg shadow-xs flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => setSattaFilterStatus('dispute')}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-extrabold uppercase border transition",
                    sattaFilterStatus === 'dispute' ? "bg-amber-700 text-white border-amber-800" : "bg-slate-50 text-slate-700 border-slate-300"
                  )}
                >
                  Price Disputes ({sattaMismatchList.filter(s => s.status === 'dispute').length})
                </button>
                <button
                  onClick={() => setSattaFilterStatus('all')}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-extrabold uppercase border transition",
                    sattaFilterStatus === 'all' ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 text-slate-700 border-slate-300"
                  )}
                >
                  All Records ({sattaMismatchList.length})
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10.5px]">
                      <th className="p-3 border-r border-slate-200">P.O Number & Date</th>
                      <th className="p-3 border-r border-slate-200">Supplier & Broker</th>
                      <th className="p-3 border-r border-slate-200">Area & Grade</th>
                      <th className="p-3 border-r border-slate-200">PO Contract Price</th>
                      <th className="p-3 border-r border-slate-200">Satta Chart Price</th>
                      <th className="p-3 border-r border-slate-200">Variance</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredSattaList.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 border-r border-slate-200 font-mono font-bold text-slate-900">
                          {item.poNo}
                          <div className="text-[10px] text-slate-500 font-semibold">{item.poDate}</div>
                        </td>
                        <td className="p-3 border-r border-slate-200 font-bold text-slate-800">
                          {item.supplierName}
                          <div className="text-[10.5px] text-slate-500 font-medium">Broker: {item.brokerName}</div>
                        </td>
                        <td className="p-3 border-r border-slate-200">
                          {item.area} / <span className="font-bold">{item.grade}</span>
                        </td>
                        <td className="p-3 border-r border-slate-200 font-extrabold text-slate-900">
                          ₹ {(item.poRate * 10).toLocaleString()} / m.T
                        </td>
                        <td className="p-3 border-r border-slate-200 font-extrabold text-indigo-900">
                          ₹ {(item.sattaFinalRate * 10).toLocaleString()} / m.T
                        </td>
                        <td className="p-3 border-r border-slate-200 font-black text-rose-700">
                          {item.difference > 0 ? `+ ₹ ${(item.difference * 10).toLocaleString()} / m.T` : 'Aligned'}
                        </td>
                        <td className="p-3 font-bold uppercase">
                          {item.status === 'dispute' ? (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[10px]">Price Dispute</span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-[10px]">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </LegacyLayout>
  );
}
