import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Search,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Trash2,
  Printer,
  ChevronDown,
  ChevronUp,
  Layers,
  Scale,
  Hash,
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';
import LegacyLayout from '../components/LegacyLayout';
import PrintModal from '../components/PrintModal';
import { supabase } from '../lib/supabase';
import { notifyDataChanged } from '../services/dbModule';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import {
  ReturnLorryRecord,
  ensureReturnLorryTablesExist,
  syncAllReturnLorriesFromInspections,
  normalizeStr,
} from '../services/returnLorryService';

export default function ReturnLorry({ onClose }: { onClose?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [records, setRecords] = useState<ReturnLorryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPoNo, setExpandedPoNo] = useState<string | null>(null);
  const [printingRecord, setPrintingRecord] = useState<ReturnLorryRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadAndSyncData = async (isManualRefresh = false) => {
    if (isManualRefresh) setSyncing(true);
    else setLoading(true);

    try {
      ensureReturnLorryTablesExist();
      const synced = await syncAllReturnLorriesFromInspections();
      setRecords(synced);
      if (isManualRefresh) {
        showToast(
          `Synced ${synced.length} Return Lorry (< 5 MT) record(s) automatically from material_inspection & sauda_check_point.`
        );
      }
    } catch (err) {
      console.error('Failed to auto-sync Return Lorry records:', err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadAndSyncData(false);
  }, []);

  useLiveAutoRefresh(
    () => {
      loadAndSyncData(false);
    },
    [],
    {
      tables: [
        'material_inspection',
        'material_inspection_details',
        'mill_inspection_detail',
        'sauda_check_point',
        'sauda_check_point_details',
        'purchase_master',
        'final_arrival',
        'temporary_material_received',
        'clubbed_pomr',
        'return_lorry',
      ],
    }
  );

  const handleDeleteRecord = async (rec: ReturnLorryRecord) => {
    if (!supabase) return;
    if (
      !window.confirm(
        `Remove Return Lorry 4000-Series P.O. #${rec.new_po_no} (Ref: #${rec.reference_po_no}, MR: ${rec.mr_no})?`
      )
    ) {
      return;
    }
    try {
      await Promise.all([
        supabase.from('return_lorry_details').delete().eq('return_po_no', rec.new_po_no),
        supabase.from('return_lorry').delete().eq('new_po_no', rec.new_po_no),
        supabase.from('sauda_check_point_details').delete().eq('po_no', rec.new_po_no),
        supabase.from('sauda_check_point').delete().eq('po_no', rec.new_po_no),
        supabase.from('purchase_detail_master').delete().eq('po_no', rec.new_po_no),
        supabase.from('purchase_master').delete().eq('po_no', rec.new_po_no),
      ]);
      notifyDataChanged('return_lorry');
      notifyDataChanged('sauda_check_point');
      notifyDataChanged('purchase_master');
      setRecords((prev) => prev.filter((r) => r.new_po_no !== rec.new_po_no));
      showToast(`Deleted Return Lorry P.O. #${rec.new_po_no}.`);
    } catch (err: any) {
      alert('Failed to delete: ' + (err.message || String(err)));
    }
  };

  const filteredRecords = useMemo(() => {
    const q = normalizeStr(searchQuery);
    if (!q) return records;
    return records.filter(
      (r) =>
        normalizeStr(r.new_po_no).includes(q) ||
        normalizeStr(r.reference_po_no).includes(q) ||
        normalizeStr(r.mr_no).includes(q) ||
        normalizeStr(r.arrival_no).includes(q) ||
        normalizeStr(r.supplier || r.supplier_name).includes(q) ||
        normalizeStr(r.broker || r.broker_name).includes(q) ||
        normalizeStr(r.lorry_number).includes(q) ||
        normalizeStr(r.area).includes(q)
    );
  }, [records, searchQuery]);

  const totalReturnWt = useMemo(
    () => records.reduce((s, r) => s + (Number(r.received_weight_mt) || 0), 0),
    [records]
  );

  return (
    <LegacyLayout title="RETURN LORRY" onClose={onClose}>
      <div className="bg-[#FDF6F6] min-h-screen p-3 space-y-3 text-slate-800 font-sans">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="bg-emerald-900 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center justify-between text-xs font-bold border border-emerald-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-emerald-200 hover:text-white font-black ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Top Header Banner (100% Automatic — No Manual Generate Button) */}
        <div className="bg-gradient-to-r from-[#8B1D1D] via-[#A32424] to-[#7A1818] text-white rounded-xl p-3.5 shadow-md border border-red-900/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center shadow-inner">
              <Truck className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm font-black uppercase tracking-wider text-white">
                  RETURN LORRY DESK
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadAndSyncData(true)}
              disabled={syncing || loading}
              className="px-3.5 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/30 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing || loading ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Auto-Syncing...' : 'Refresh Auto-Sync'}</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-3 border border-red-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-red-800">
                4000-SERIES RETURN P.O.s
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                {records.length}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold">
                Auto-Copied from &lt; 5 MT Inspections
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-700">
              <Hash className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-amber-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                REFERENCE SAUDAS COPIED
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                {new Set(records.map((r) => r.reference_po_no).filter(Boolean)).size}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold">
                From sauda_check_point
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <FileText className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-rose-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                TOTAL RETURN LORRY WT (&lt; 5 MT)
              </div>
              <div className="text-2xl font-black text-rose-700 font-mono mt-0.5">
                {totalReturnWt.toFixed(3)} <span className="text-xs font-bold">MT</span>
              </div>
              <div className="text-[10px] text-slate-500 font-semibold">
                From material_inspection
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
              <Scale className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-emerald-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                DOWNSTREAM INTEGRATION
              </div>
              <div className="text-sm font-black text-emerald-900 mt-1">
                Payment &amp; Settlement Ready
              </div>
              <div className="text-[10px] text-slate-500 font-semibold">
                All Mill Inspection + Sauda Fields Included
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-xl p-2.5 border border-red-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by 4000-Series P.O. No, Reference P.O. (e.g. 0660), M.R. No, Arrival No, Supplier, Broker, Lorry No..."
              className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-50 text-red-800 border border-red-200">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              Click any row to view all copied Mill Inspection + Sauda Check Point fields
            </span>
          </div>
        </div>

        {/* Main Return Lorry Register Table (Showing Both Mill Inspection & Sauda Check Point Columns) */}
        <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#FCE4E4] text-red-950 border-b border-red-200 font-black uppercase tracking-wider whitespace-nowrap">
                  <th className="py-2.5 px-2.5">4000-Series P.O.</th>
                  <th className="py-2.5 px-2.5">Ref P.O. (Sauda)</th>
                  <th className="py-2.5 px-2.5">P.O. Date</th>
                  <th className="py-2.5 px-2.5">M.R. No. (Insp)</th>
                  <th className="py-2.5 px-2.5">M.R. Date</th>
                  <th className="py-2.5 px-2.5">Arrival No.</th>
                  <th className="py-2.5 px-2.5">Lorry No.</th>
                  <th className="py-2.5 px-2.5 text-center">Lorry Seq</th>
                  <th className="py-2.5 px-2.5 text-right">Recd Wt (&lt; 5 MT)</th>
                  <th className="py-2.5 px-2.5 text-right">Challan Wt</th>
                  <th className="py-2.5 px-2.5 text-right">Contract MT</th>
                  <th className="py-2.5 px-2.5">Supplier Name</th>
                  <th className="py-2.5 px-2.5">Broker Name</th>
                  <th className="py-2.5 px-2.5">Area</th>
                  <th className="py-2.5 px-2.5">Unit</th>
                  <th className="py-2.5 px-2.5">Grades / Marka</th>
                  <th className="py-2.5 px-2.5 text-right">Base Rate (₹)</th>
                  <th className="py-2.5 px-2.5 text-center">Moist (Act/Clm)</th>
                  <th className="py-2.5 px-2.5 text-center">Dust (Act/Clm)</th>
                  <th className="py-2.5 px-2.5 text-center">NCV (Act/Clm)</th>
                  <th className="py-2.5 px-2.5 text-center">Detn Days</th>
                  <th className="py-2.5 px-2.5 text-right">APMC Fees</th>
                  <th className="py-2.5 px-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100 font-semibold">
                {loading ? (
                  <tr>
                    <td colSpan={23} className="py-8 text-center text-slate-500 font-bold">
                      Syncing &lt; 5 MT Return Lorry records from material_inspection &amp; sauda_check_point...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={23} className="py-8 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-1.5">
                        <AlertTriangle className="w-6 h-6 text-amber-500" />
                        <span className="font-bold text-slate-700">
                          No Mill Inspection (material_inspection) records under 5 MT (&lt; 5.000 MT) found yet.
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Whenever a Mill Inspection record has a received weight under 5 MT, it automatically appears here with all fields copied from material_inspection and sauda_check_point.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => {
                    const isExpanded = expandedPoNo === rec.new_po_no;
                    const gradeSummary =
                      rec.items && rec.items.length > 0
                        ? rec.items
                            .map(
                              (it) =>
                                `${it.grade_code || it.arrival_grade || it.grade_name}${
                                  it.marka_code || it.marka_name ? ` (${it.marka_code || it.marka_name})` : ''
                                }`
                            )
                            .join(', ')
                        : 'Standard';
                    return (
                      <React.Fragment key={rec.new_po_no + '_' + rec.mr_no}>
                        <tr
                          onClick={() => setExpandedPoNo(isExpanded ? null : rec.new_po_no)}
                          className="bg-red-50/60 hover:bg-red-100/80 transition-colors border-l-4 border-l-red-600 cursor-pointer whitespace-nowrap"
                        >
                          <td className="py-2 px-2.5 font-mono font-black text-red-800">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white text-[11px] shadow-2xs">
                              {rec.new_po_no}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-mono font-bold text-slate-800">
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300 text-[10.5px]">
                              {rec.reference_po_no}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-mono text-slate-700">{rec.po_date || '-'}</td>
                          <td className="py-2 px-2.5 font-mono font-black text-blue-900">
                            {rec.mr_no || '-'}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-slate-700">{rec.mr_date || '-'}</td>
                          <td className="py-2 px-2.5 font-mono text-sky-900">{rec.arrival_no || '-'}</td>
                          <td className="py-2 px-2.5 font-mono font-bold text-slate-800">
                            {rec.lorry_number || '-'}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono text-[10px] font-black">
                              {rec.lorry_sequence_no || 1} / {rec.total_lorries || 1}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-black text-red-700">
                            <span className="px-2 py-0.5 rounded bg-red-200/80 text-red-950 border border-red-400">
                              {Number(rec.received_weight_mt || 0).toFixed(3)} MT
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-slate-700">
                            {Number(rec.challan_gross_wt || rec.received_weight_mt || 0).toFixed(3)} MT
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-slate-600">
                            {Number(rec.total_contract_mt || 0).toFixed(3)} MT
                          </td>
                          <td className="py-2 px-2.5 font-bold text-slate-900 uppercase max-w-[160px] truncate">
                            {rec.supplier || rec.supplier_name || '-'}
                          </td>
                          <td className="py-2 px-2.5 font-semibold text-slate-700 uppercase max-w-[140px] truncate">
                            {rec.broker || rec.broker_name || '-'}
                          </td>
                          <td className="py-2 px-2.5 text-slate-700 uppercase">{rec.area || '-'}</td>
                          <td className="py-2 px-2.5 font-mono text-slate-700">
                            {rec.purchase_unit_name || rec.unit_name || 'BALES'}
                          </td>
                          <td className="py-2 px-2.5 text-[10.5px] font-bold text-slate-700 max-w-[180px] truncate">
                            {gradeSummary}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-black text-emerald-800">
                            {Number(rec.b_rate || 0) > 0
                              ? `₹${Number(rec.b_rate).toLocaleString('en-IN')}`
                              : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-emerald-900">
                            {rec.actual_moisture || 0}% / {rec.claim_moisture || 0}%
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-amber-900">
                            {rec.actual_dust || 0}% / {rec.claim_dust || 0}%
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-purple-900">
                            {rec.actual_ncv || 0}% / {rec.claim_ncv || 0}%
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-slate-700">
                            {rec.detention_days || 0}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-slate-800">
                            ₹{Number(rec.arival_apmc_fees || 0).toLocaleString('en-IN')}
                          </td>
                          <td
                            className="py-2 px-2.5 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setExpandedPoNo(isExpanded ? null : rec.new_po_no)}
                                title="View All Mill Inspection & Sauda Check Point Fields"
                                className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 cursor-pointer flex items-center gap-1 text-[10px] font-black"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3.5 h-3.5" />
                                    <span>Hide Fields</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>All Fields</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => setPrintingRecord(rec)}
                                title="Print Return Lorry 4000-Series P.O. Slip"
                                className="p-1 rounded bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(rec)}
                                title="Delete Return Lorry Record"
                                className="p-1 rounded bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Full Field Copy Panel: All Fields from material_inspection + sauda_check_point */}
                        {isExpanded && (
                          <tr className="bg-white border-b-2 border-red-300">
                            <td colSpan={23} className="p-4 bg-[#FFFDFD]">
                              <div className="space-y-4">
                                {/* Panel 1: Complete Mill Inspection ("material_inspection") Copied Fields */}
                                <div className="rounded-xl border-2 border-blue-200 bg-blue-50/30 overflow-hidden shadow-xs">
                                  <div className="bg-[#0e2a4a] text-white px-3.5 py-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <ClipboardCheck className="w-4 h-4 text-amber-300" />
                                      <span className="text-xs font-black uppercase tracking-wider">
                                        1. Mill Inspection (&quot;material_inspection&quot;) — Complete Copied Data [M.R. No: {rec.mr_no}]
                                      </span>
                                    </div>
                                    <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">
                                      Return Lorry Weight: {Number(rec.received_weight_mt || 0).toFixed(3)} MT (&lt; 5 MT)
                                    </span>
                                  </div>

                                  <div className="p-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px]">
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">M.R. No. (mr_no)</div>
                                      <div className="font-mono font-black text-blue-900">{rec.mr_no || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">M.R. Date (mr_date)</div>
                                      <div className="font-mono font-bold text-slate-800">{rec.mr_date || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Arrival No. (arrival_no)</div>
                                      <div className="font-mono font-bold text-sky-900">{rec.arrival_no || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Arrival Date (arrival_date)</div>
                                      <div className="font-mono font-bold text-slate-800">{rec.arrival_date || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Unloading Date</div>
                                      <div className="font-mono font-bold text-slate-800">{rec.unloading_date || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Lorry Number</div>
                                      <div className="font-mono font-black text-slate-900">{rec.lorry_number || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Broker (broker_name)</div>
                                      <div className="font-bold text-slate-800 uppercase">{rec.broker_name || rec.broker || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Supplier (supplier_name)</div>
                                      <div className="font-bold text-slate-800 uppercase">{rec.supplier_name || rec.supplier || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Challan Receipt No (mill_po_no)</div>
                                      <div className="font-mono font-bold text-slate-800">{rec.mill_po_no || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Challan Receipt Date</div>
                                      <div className="font-mono font-bold text-slate-800">{rec.mill_po_date || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Way Bill No (mr_spcl_print)</div>
                                      <div className="font-mono font-bold text-slate-800">{rec.mr_spcl_print || '-'}</div>
                                    </div>
                                    <div className="bg-red-50 p-2 rounded border border-red-300">
                                      <div className="text-[9px] font-black text-red-700 uppercase">Challan / Receipt Gross Wt (MT)</div>
                                      <div className="font-mono font-black text-red-900">
                                        {Number(rec.challan_gross_wt || rec.received_weight_mt || 0).toFixed(3)} / {Number(rec.receipt_gross_wt || rec.received_weight_mt || 0).toFixed(3)} MT
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Actual / Claim Moisture %</div>
                                      <div className="font-mono font-bold text-emerald-900">
                                        {rec.actual_moisture ?? 0}% / {rec.claim_moisture ?? 0}%
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Actual / Claim Dust %</div>
                                      <div className="font-mono font-bold text-amber-900">
                                        {rec.actual_dust ?? 0}% / {rec.claim_dust ?? 0}%
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Actual / Claim NCV %</div>
                                      <div className="font-mono font-bold text-purple-900">
                                        {rec.actual_ncv ?? 0}% / {rec.claim_ncv ?? 0}%
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Actual / Claim Grade Down</div>
                                      <div className="font-mono font-bold text-blue-900">
                                        {rec.actual_grade_down ?? 0} / {rec.claim_grade_down ?? 0}
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Detention Days</div>
                                      <div className="font-mono font-bold text-slate-800">{rec.detention_days ?? 0}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Delivery Claim (₹)</div>
                                      <div className="font-mono font-bold text-slate-800">₹{Number(rec.delivery_claim || 0).toLocaleString('en-IN')}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Deduction Type / Amt</div>
                                      <div className="font-mono font-bold text-slate-800">
                                        {rec.deduction_type || 'None'} (₹{Number(rec.deduction_amount || 0).toLocaleString('en-IN')})
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Advance / On-Account Adv (₹)</div>
                                      <div className="font-mono font-bold text-emerald-800">
                                        ₹{Number(rec.advance_amount || 0).toLocaleString('en-IN')} / ₹{Number(rec.on_account_advance_amount || 0).toLocaleString('en-IN')}
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Settlement Amt / Sent Date</div>
                                      <div className="font-mono font-bold text-slate-800">
                                        ₹{Number(rec.settlement_amount || 0).toLocaleString('en-IN')} ({rec.sent_settlement_date || '-'})
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Lorry Returned / Other Mill</div>
                                      <div className="font-mono font-black text-red-700">
                                        {rec.lorry_returned || 'Yes'} / {rec.lorry_returned_other_mill || 'No'}
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Consignment No / Date</div>
                                      <div className="font-mono font-bold text-slate-800">
                                        {rec.consignment_no || '-'} ({rec.consignment_date || '-'})
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Arrival APMC Fees / Print Date</div>
                                      <div className="font-mono font-bold text-amber-900">
                                        ₹{Number(rec.arival_apmc_fees || 0).toLocaleString('en-IN')} ({rec.mr_print_date || '-'})
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200 col-span-2 sm:col-span-3">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Arrival Remarks</div>
                                      <div className="font-semibold text-slate-700">{rec.arrival_remarks || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200 col-span-2 sm:col-span-3">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Inspection Remarks (remarks)</div>
                                      <div className="font-semibold text-slate-700">{rec.insp_remarks || rec.remarks || '-'}</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Panel 2: Complete Sauda Check Point ("sauda_check_point") Copied Fields */}
                                <div className="rounded-xl border-2 border-red-200 bg-red-50/30 overflow-hidden shadow-xs">
                                  <div className="bg-[#7A1818] text-white px-3.5 py-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <ShieldCheck className="w-4 h-4 text-amber-300" />
                                      <span className="text-xs font-black uppercase tracking-wider">
                                        2. Sauda Check Point (&quot;sauda_check_point&quot;) — Complete Copied P.O. Data [New P.O: #{rec.new_po_no} | Ref P.O: #{rec.reference_po_no}]
                                      </span>
                                    </div>
                                    <span className="bg-amber-400 text-red-950 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                                      4000-Series Return P.O.
                                    </span>
                                  </div>

                                  <div className="p-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px]">
                                    <div className="bg-red-50 p-2 rounded border border-red-300">
                                      <div className="text-[9px] font-black text-red-700 uppercase">New 4000-Series P.O. (po_no)</div>
                                      <div className="font-mono font-black text-red-900">{rec.new_po_no}</div>
                                    </div>
                                    <div className="bg-amber-50 p-2 rounded border border-amber-300">
                                      <div className="text-[9px] font-black text-amber-800 uppercase">Reference P.O. (contract_po_no)</div>
                                      <div className="font-mono font-black text-amber-950">{rec.reference_po_no}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Financial Year</div>
                                      <div className="font-mono font-bold text-slate-800">{rec.financial_year || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Purchase Order / Type</div>
                                      <div className="font-bold text-slate-800">{rec.purchase_order || 'FINAL PO'} / {rec.po_type || 'Return Lorry'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">P.O. Date / Sauda Date</div>
                                      <div className="font-mono font-bold text-slate-800">{rec.po_date || '-'} / {rec.s_date || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Status / Pending</div>
                                      <div className="font-mono font-bold text-emerald-800 uppercase">
                                        {rec.status || 'open'} ({rec.pending ? 'Pending: Yes' : 'Pending: No'})
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Broker (Code / Name)</div>
                                      <div className="font-bold text-slate-800 uppercase">
                                        {rec.broker_code ? `[${rec.broker_code}] ` : ''}{rec.broker || '-'}
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Supplier (Code / Name)</div>
                                      <div className="font-bold text-slate-800 uppercase">
                                        {rec.supplier_code ? `[${rec.supplier_code}] ` : ''}{rec.supplier || '-'}
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Challan Supplier</div>
                                      <div className="font-bold text-slate-800 uppercase">
                                        {rec.challan_supplier_code ? `[${rec.challan_supplier_code}] ` : ''}{rec.challan_supplier || rec.supplier || '-'}
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Area (Code / Name)</div>
                                      <div className="font-bold text-slate-800 uppercase">
                                        {rec.area_code ? `[${rec.area_code}] ` : ''}{rec.area || '-'}
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Transport Paid By / Cancel</div>
                                      <div className="font-bold text-slate-800">
                                        {rec.trans_paid_by || 'PARTY'} / Cancel: {rec.against_cancellation || 'No'}
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Purchase Unit / Wt Unit Kgs</div>
                                      <div className="font-mono font-bold text-slate-800">
                                        {rec.purchase_unit_name || 'BALES'} ({rec.weight_unit_kgs || 147.5} Kg)
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Total Lorries / Units Per Lorry</div>
                                      <div className="font-mono font-bold text-slate-800">
                                        {rec.total_lorries || 1} Lorries / {rec.units_per_lorry || 0} Units
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Total Units / Wt Per Lorry</div>
                                      <div className="font-mono font-bold text-slate-800">
                                        {rec.total_units || 0} / {Number(rec.weight_per_lorry || 0).toFixed(3)} MT
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Total Contract MT</div>
                                      <div className="font-mono font-black text-blue-900">
                                        {Number(rec.total_contract_mt || 0).toFixed(3)} MT
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Marka Type / Penalty / Qty Pen</div>
                                      <div className="font-mono font-bold text-slate-800">
                                        {rec.marka_type || 'Normal'} / ₹{rec.marka_penalty || 0} / {rec.qty_penalty || 0}%
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Delivery From / To</div>
                                      <div className="font-mono font-bold text-slate-800">
                                        {rec.delivery_from || '-'} to {rec.delivery_to || '-'}
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Grace Days / Delivery Penalty</div>
                                      <div className="font-mono font-bold text-slate-800">
                                        {rec.grace_days || 0} Days / ₹{rec.delivery_penalty || 0}
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Sauda No / Contract Date</div>
                                      <div className="font-mono font-bold text-slate-800">
                                        {rec.sauda_no || rec.reference_po_no} ({rec.contract_date || '-'})
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">P.O. Identification</div>
                                      <div className="font-bold text-slate-800">{rec.po_identification || '-'}</div>
                                    </div>
                                    <div className="bg-emerald-50 p-2 rounded border border-emerald-300">
                                      <div className="text-[9px] font-black text-emerald-800 uppercase">Base Rate (b_rate)</div>
                                      <div className="font-mono font-black text-emerald-900">
                                        ₹{Number(rec.b_rate || 0).toLocaleString('en-IN')} / Qtl
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Rate Detail / Schedule</div>
                                      <div className="font-semibold text-slate-700 truncate">
                                        {rec.rate_detail || '-'} / {rec.delivery_schedule || '-'}
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200 col-span-2">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Terms &amp; Condition</div>
                                      <div className="font-semibold text-slate-700">{rec.terms_condition || '-'}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-slate-200 col-span-2">
                                      <div className="text-[9px] font-black text-slate-400 uppercase">Sauda Check Point Remarks</div>
                                      <div className="font-semibold text-slate-700">{rec.po_remarks || rec.remarks || '-'}</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Panel 3: Combined Commodity Grade / Specification Details Table */}
                                <div className="rounded-xl border border-slate-300 bg-white overflow-hidden shadow-2xs">
                                  <div className="bg-slate-800 text-white px-3.5 py-2 text-xs font-black uppercase tracking-wider flex items-center justify-between">
                                    <span>
                                      3. Copied Commodity Item Specifications (Mill Inspection Details + Sauda Check Point Details)
                                    </span>
                                    <span className="text-[10px] text-amber-300 font-mono">
                                      {(rec.items || []).length} Item Row(s)
                                    </span>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-[11px] border-collapse">
                                      <thead>
                                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-black uppercase whitespace-nowrap">
                                          <th className="py-1.5 px-2.5">Srl</th>
                                          <th className="py-1.5 px-2.5">Crop Year</th>
                                          <th className="py-1.5 px-2.5">Sauda Grade</th>
                                          <th className="py-1.5 px-2.5">Arrival / Stock Grade</th>
                                          <th className="py-1.5 px-2.5">Area</th>
                                          <th className="py-1.5 px-2.5">Agency</th>
                                          <th className="py-1.5 px-2.5">Marka</th>
                                          <th className="py-1.5 px-2.5 text-right">Qty / Unit</th>
                                          <th className="py-1.5 px-2.5 text-right">Challan Wt (MT)</th>
                                          <th className="py-1.5 px-2.5 text-right">Receipt Wt (MT)</th>
                                          <th className="py-1.5 px-2.5 text-right">Rate (₹/Qtl)</th>
                                          <th className="py-1.5 px-2.5 text-right">Premium</th>
                                          <th className="py-1.5 px-2.5 text-center">Moist (Act/Clm)</th>
                                          <th className="py-1.5 px-2.5 text-center">Dust (Act/Clm)</th>
                                          <th className="py-1.5 px-2.5 text-center">NCV (Act/Clm)</th>
                                          <th className="py-1.5 px-2.5 text-center">Grd Dn (Act/Clm)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-semibold">
                                        {(rec.items || []).map((it, idx) => (
                                          <tr key={idx} className="hover:bg-slate-50">
                                            <td className="py-1.5 px-2.5 font-mono">{it.srl_no || idx + 1}</td>
                                            <td className="py-1.5 px-2.5 font-mono">{it.crop_year || '2026-27'}</td>
                                            <td className="py-1.5 px-2.5 font-bold text-red-900">
                                              {it.grade_code || it.grade_name || '-'}
                                            </td>
                                            <td className="py-1.5 px-2.5 font-bold text-blue-900">
                                              {it.arrival_grade || it.stock_grade_code || it.grade_name || '-'}
                                            </td>
                                            <td className="py-1.5 px-2.5">{it.area || rec.area || '-'}</td>
                                            <td className="py-1.5 px-2.5">{it.agency_name || it.agency_code || '-'}</td>
                                            <td className="py-1.5 px-2.5">{it.marka_name || it.marka_code || '-'}</td>
                                            <td className="py-1.5 px-2.5 text-right font-mono">
                                              {it.quantity || 0} {it.unit || rec.purchase_unit_name || 'BALES'}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-amber-900">
                                              {Number(it.challan_gross_wt || it.weight_mt || 0).toFixed(3)}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-red-700">
                                              {Number(it.receipt_gross_wt || it.weight_mt || 0).toFixed(3)}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-emerald-800">
                                              ₹{Number(it.rate_qntl || 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-right font-mono">
                                              {it.premium || 0}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-center font-mono text-emerald-900">
                                              {it.actual_moisture ?? rec.actual_moisture ?? 0}% / {it.claim_moisture ?? rec.claim_moisture ?? 0}%
                                            </td>
                                            <td className="py-1.5 px-2.5 text-center font-mono text-amber-900">
                                              {it.actual_dust ?? rec.actual_dust ?? 0}% / {it.claim_dust ?? rec.claim_dust ?? 0}%
                                            </td>
                                            <td className="py-1.5 px-2.5 text-center font-mono text-purple-900">
                                              {it.actual_ncv ?? rec.actual_ncv ?? 0}% / {it.claim_ncv ?? rec.claim_ncv ?? 0}%
                                            </td>
                                            <td className="py-1.5 px-2.5 text-center font-mono text-blue-900">
                                              {it.actual_grade_down ?? rec.actual_grade_down ?? 0} / {it.claim_grade_down ?? rec.claim_grade_down ?? 0}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Print Preview Modal */}
        <PrintModal
          isOpen={printingRecord !== null}
          onClose={() => setPrintingRecord(null)}
          title={`RETURN LORRY P.O. SLIP - ${printingRecord?.new_po_no || ''}`}
        >
          {printingRecord && (
            <div className="p-6 bg-white text-black font-serif text-xs space-y-4 border border-black max-w-4xl mx-auto">
              <div className="text-center border-b-2 border-black pb-3">
                <h2 className="text-lg font-black uppercase tracking-wider">
                  BALLY JUTE COMPANY LIMITED
                </h2>
                <p className="text-xs font-bold uppercase mt-0.5">
                  RETURN LORRY PURCHASE ORDER (4000 SERIES — UNDER 5 MT AUTO-COPY)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-black pb-3">
                <div className="space-y-1">
                  <div>
                    <span className="font-bold inline-block w-36">4000-Series P.O. No:</span>
                    <span className="font-mono font-black">{printingRecord.new_po_no}</span>
                  </div>
                  <div>
                    <span className="font-bold inline-block w-36">Reference P.O. No:</span>
                    <span className="font-mono font-bold">{printingRecord.reference_po_no}</span>
                  </div>
                  <div>
                    <span className="font-bold inline-block w-36">Supplier Name:</span>
                    <span className="font-bold">{printingRecord.supplier || printingRecord.supplier_name}</span>
                  </div>
                  <div>
                    <span className="font-bold inline-block w-36">Broker Name:</span>
                    <span className="font-bold">{printingRecord.broker || printingRecord.broker_name}</span>
                  </div>
                  <div>
                    <span className="font-bold inline-block w-36">Area / Unit:</span>
                    <span>{printingRecord.area || '-'} / {printingRecord.purchase_unit_name || 'BALES'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div>
                    <span className="font-bold inline-block w-36">M.R. No (Inspection):</span>
                    <span className="font-mono font-black">{printingRecord.mr_no} ({printingRecord.mr_date})</span>
                  </div>
                  <div>
                    <span className="font-bold inline-block w-36">Arrival No:</span>
                    <span className="font-mono">{printingRecord.arrival_no} ({printingRecord.arrival_date})</span>
                  </div>
                  <div>
                    <span className="font-bold inline-block w-36">Lorry Number:</span>
                    <span className="font-mono font-bold">{printingRecord.lorry_number || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-bold inline-block w-36">Received Wt (&lt; 5 MT):</span>
                    <span className="font-mono font-black">
                      {Number(printingRecord.received_weight_mt || 0).toFixed(3)} MT
                    </span>
                  </div>
                  <div>
                    <span className="font-bold inline-block w-36">Moisture / Dust / NCV:</span>
                    <span className="font-mono">
                      {printingRecord.actual_moisture || 0}% / {printingRecord.actual_dust || 0}% / {printingRecord.actual_ncv || 0}%
                    </span>
                  </div>
                </div>
              </div>

              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="border-b border-black bg-gray-100 font-bold">
                    <th className="border-r border-black p-1.5 text-left">Srl</th>
                    <th className="border-r border-black p-1.5 text-left">Grade</th>
                    <th className="border-r border-black p-1.5 text-left">Agency</th>
                    <th className="border-r border-black p-1.5 text-left">Marka</th>
                    <th className="border-r border-black p-1.5 text-right">Qty</th>
                    <th className="border-r border-black p-1.5 text-right">Weight (MT)</th>
                    <th className="p-1.5 text-right">Rate (₹/Qtl)</th>
                  </tr>
                </thead>
                <tbody>
                  {(printingRecord.items || []).map((it, idx) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="border-r border-black p-1.5">{it.srl_no || idx + 1}</td>
                      <td className="border-r border-black p-1.5 font-bold">
                        {it.grade_code || it.arrival_grade || it.grade_name}
                      </td>
                      <td className="border-r border-black p-1.5">{it.agency_name || it.agency_code || '-'}</td>
                      <td className="border-r border-black p-1.5">{it.marka_name || it.marka_code || '-'}</td>
                      <td className="border-r border-black p-1.5 text-right font-mono">{it.quantity || 0}</td>
                      <td className="border-r border-black p-1.5 text-right font-mono">
                        {Number(it.receipt_gross_wt || it.weight_mt || 0).toFixed(3)}
                      </td>
                      <td className="p-1.5 text-right font-mono">
                        {Number(it.rate_qntl || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PrintModal>
      </div>
    </LegacyLayout>
  );
}
