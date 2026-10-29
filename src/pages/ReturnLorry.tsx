import React, { useState, useEffect, useMemo } from "react";
import {
  Truck,
  RefreshCw,
  Search,
  FileText,
  Eye,
  Edit3,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Printer,
  X,
  Save,
  Layers,
  Scale,
  Hash,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { dbModule } from "../services/dbModule";
import {
  ReturnLorryRecord,
  fetchAllReturnLorries,
  syncAllReturnLorriesFromInspections,
  generateNext4000SeriesPoNo,
  checkAndProcessReturnLorryOnInspection,
  calculateInspectionWeightMt,
} from "../services/returnLorryService";

export function ReturnLorry({
  onLogEvent,
}: {
  onLogEvent?: (event: string, details: string) => void;
}) {
  const [records, setRecords] = useState<ReturnLorryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Detail / Edit Modal state
  const [selectedRecord, setSelectedRecord] = useState<ReturnLorryRecord | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Manual / Assisted Copy Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [saudaList, setSaudaList] = useState<any[]>([]);
  const [inspectionList, setInspectionList] = useState<any[]>([]);
  const [selectedRefPo, setSelectedRefPo] = useState<string>("");
  const [selectedMrNo, setSelectedMrNo] = useState<string>("");
  const [manualWeightMt, setManualWeightMt] = useState<string>("4.500");
  const [customNewPoNo, setCustomNewPoNo] = useState<string>("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  const loadData = async (autoSync: boolean = true) => {
    setLoading(true);
    try {
      const data = autoSync
        ? await syncAllReturnLorriesFromInspections()
        : await fetchAllReturnLorries();
      setRecords(data);
    } catch (err) {
      console.warn("Failed to load Return Lorry records:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadLookupLists = async () => {
    if (!supabase) return;
    try {
      const [scpRes, pmRes, inspRes] = await Promise.all([
        supabase.from("sauda_check_point").select("*").order("created_at", { ascending: false }),
        supabase.from("purchase_master").select("*").order("created_at", { ascending: false }),
        supabase.from("material_inspection").select("*").order("created_at", { ascending: false }),
      ]);

      const poMap = new Map<string, any>();
      [...(pmRes?.data || []), ...(scpRes?.data || [])].forEach((p: any) => {
        const k = String(p.po_no || p.ptf_no || "").trim().replace(/^#/, "");
        if (k) poMap.set(k.toUpperCase(), { ...p, po_no: k });
      });
      setSaudaList(Array.from(poMap.values()));
      setInspectionList(inspRes?.data || []);
    } catch (e) {}
  };

  useEffect(() => {
    loadData(true);
    loadLookupLists();
  }, []);

  const handleSyncFromInspection = async () => {
    setSyncing(true);
    try {
      const synced = await syncAllReturnLorriesFromInspections();
      setRecords(synced);
      showToast(
        `Synced with Mill Inspection! Found ${synced.length} Return Lorry (4000 Series) P.O. record(s).`
      );
      if (onLogEvent) {
        onLogEvent(
          "RETURN_LORRY_SYNC",
          `Synchronized Return Lorry register with Mill Inspection (< 5 MT lorries). Total records: ${synced.length}`
        );
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenCreateModal = () => {
    const nextPo = generateNext4000SeriesPoNo(
      selectedRefPo || "BJCL/2026-2027/0001",
      records
    );
    setCustomNewPoNo(nextPo);
    setShowCreateModal(true);
  };

  const handleRefPoChange = (poVal: string) => {
    setSelectedRefPo(poVal);
    const nextPo = generateNext4000SeriesPoNo(poVal || "BJCL/2026-2027/0001", records);
    setCustomNewPoNo(nextPo);

    // Filter inspections matching this PO
    const matchingMrs = inspectionList.filter(
      (i) =>
        String(i.po_no || i.reference_po_no || "")
          .trim()
          .replace(/^#/, "")
          .toUpperCase() === poVal.trim().replace(/^#/, "").toUpperCase()
    );
    if (matchingMrs.length > 0) {
      const lastMr = matchingMrs[0];
      setSelectedMrNo(lastMr.mr_no || "");
      const wt = calculateInspectionWeightMt(lastMr);
      if (wt > 0) setManualWeightMt(wt.toFixed(3));
    }
  };

  const handleCreateReturnLorryManual = async () => {
    if (!selectedRefPo) {
      alert("Please select a Reference P.O. Number from Sauda Check Point.");
      return;
    }
    const wtNum = parseFloat(manualWeightMt) || 4.5;
    if (wtNum <= 0 || wtNum >= 5) {
      alert("Return Lorry received weight must be under 5 Tons (< 5.000 MT), e.g., 4.500 MT.");
      return;
    }
    const mrToUse = selectedMrNo.trim() || `MR-RL-${Date.now().toString().slice(-4)}`;
    const matchedInsp = inspectionList.find(
      (i) => String(i.mr_no || "").trim().toUpperCase() === mrToUse.toUpperCase()
    );

    setSyncing(true);
    try {
      const res = await checkAndProcessReturnLorryOnInspection({
        mrNo: mrToUse,
        poNo: selectedRefPo,
        arrivalNo: matchedInsp?.arrival_no || mrToUse,
        lorryNo: matchedInsp?.lorry_number || "",
        inspectionDate: matchedInsp?.mr_date || new Date().toISOString().slice(0, 10),
        headerForm: {
          ...(matchedInsp || {}),
          received_weight_mt: wtNum,
          total_actual_weight: wtNum,
        },
        detailRows: [{ receipt_gross_wt: wtNum }],
      });

      if (res.isReturnLorry) {
        // If user customized the 4000-series PO number, apply it
        if (customNewPoNo && res.returnRecord && customNewPoNo.trim() !== res.newPoNo) {
          const updatedRec = {
            ...res.returnRecord,
            po_no: customNewPoNo.trim(),
            new_po_no: customNewPoNo.trim(),
          };
          if (supabase && res.returnRecord.id) {
            await supabase
              .from("return_lorry")
              .update({
                po_no: customNewPoNo.trim(),
                new_po_no: customNewPoNo.trim(),
              })
              .eq("id", res.returnRecord.id);
            await supabase
              .from("return_lorry_details")
              .update({
                po_no: customNewPoNo.trim(),
                new_po_no: customNewPoNo.trim(),
              })
              .eq("po_no", res.newPoNo);
          }
          await dbModule.save("return_lorry", updatedRec).catch(() => {});
        }

        await loadData(false);
        setShowCreateModal(false);
        showToast(
          `Created Return Lorry P.O. #${customNewPoNo || res.newPoNo} from Reference P.O. #${selectedRefPo}!`
        );
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveEditedRecord = async () => {
    if (!selectedRecord) return;
    setSyncing(true);
    try {
      if (supabase) {
        await supabase
          .from("return_lorry")
          .upsert([selectedRecord], { onConflict: "po_no" });
      }
      await dbModule.save("return_lorry", selectedRecord).catch(() => {});
      await loadData(false);
      setIsEditing(false);
      showToast(`Saved Return Lorry P.O. #${selectedRecord.new_po_no || selectedRecord.po_no}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteRecord = async (rec: ReturnLorryRecord) => {
    const poKey = rec.new_po_no || rec.po_no;
    if (!confirm(`Delete Return Lorry P.O. #${poKey} (Ref: #${rec.reference_po_no})?`)) return;
    try {
      if (supabase) {
        await supabase.from("return_lorry_details").delete().eq("po_no", poKey);
        await supabase.from("return_lorry").delete().eq("po_no", poKey);
      }
      if (rec.id) {
        await dbModule.delete("return_lorry", rec.id).catch(() => {});
      }
      setRecords((prev) => prev.filter((r) => (r.new_po_no || r.po_no) !== poKey));
      if (selectedRecord && (selectedRecord.new_po_no || selectedRecord.po_no) === poKey) {
        setSelectedRecord(null);
      }
      showToast(`Deleted Return Lorry P.O. #${poKey}`);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        String(r.new_po_no || r.po_no || "").toLowerCase().includes(q) ||
        String(r.reference_po_no || "").toLowerCase().includes(q) ||
        String(r.mr_no || "").toLowerCase().includes(q) ||
        String(r.supplier || r.supplier_name || "").toLowerCase().includes(q) ||
        String(r.broker || r.broker_name || "").toLowerCase().includes(q) ||
        String(r.lorry_number || "").toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const stats = useMemo(() => {
    const totalCount = records.length;
    const totalWt = records.reduce((s, r) => s + (Number(r.received_weight_mt) || 0), 0);
    const uniqueRefs = new Set(records.map((r) => r.reference_po_no).filter(Boolean)).size;
    return { totalCount, totalWt, uniqueRefs };
  }, [records]);

  return (
    <div className="min-h-screen bg-[#fdfaf5] p-3 md:p-5 space-y-4">
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-red-900 text-white px-4 py-3 rounded-xl shadow-xl border border-red-400 flex items-center gap-2.5 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#8b1e1e] via-[#a32424] to-[#7a1818] text-white rounded-xl p-4 shadow-md border border-red-300/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/15 rounded-xl border border-white/20">
            <Truck className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-wide uppercase">
                Return Lorry Desk (4000 Series P.O.)
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-amber-400 text-red-950 rounded-md">
                Under 5 Ton (&lt; 5 MT) Auto-Copy
              </span>
            </div>
            <p className="text-xs text-red-100 mt-0.5">
              Automatically copies Sauda Check Point P.O. data when a Mill Inspection Lorry is received under 5 MT, generating a 4000-Series P.O. for Payment &amp; Settlement.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-red-950 font-black text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Return Lorry P.O. (4000 Series)</span>
          </button>

          <button
            type="button"
            onClick={handleSyncFromInspection}
            disabled={syncing}
            className="px-3.5 py-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            <span>Sync &lt; 5 MT from Mill Inspection</span>
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3.5 border border-red-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-red-700">
              4000-Series Return P.O.s
            </p>
            <p className="text-2xl font-black text-red-950 mt-1 font-mono">
              {stats.totalCount}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Active for Payment &amp; Settlement
            </p>
          </div>
          <div className="p-2.5 bg-red-50 rounded-lg border border-red-200 text-red-700">
            <Hash className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-amber-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
              Reference Saudas Copied
            </p>
            <p className="text-2xl font-black text-amber-950 mt-1 font-mono">
              {stats.uniqueRefs}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              From Sauda Check Point
            </p>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-700">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-rose-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700">
              Total Return Lorry Wt
            </p>
            <p className="text-2xl font-black text-rose-950 mt-1 font-mono">
              {stats.totalWt.toFixed(3)} <span className="text-xs font-bold">MT</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Under 5 Ton Short Lorries
            </p>
          </div>
          <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200 text-rose-700">
            <Scale className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
              Downstream Integration
            </p>
            <p className="text-sm font-black text-emerald-950 mt-1.5">
              Payment &amp; Settlement Ready
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              Auto-pulls M.R. &amp; 4000-Series P.O.
            </p>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-700">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by 4000-Series P.O. No, Reference P.O. (e.g. 0660), M.R. No, Supplier, Broker, Lorry No..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-red-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-600" />
          <span>Red Row in Mill Inspection = Return Lorry (&lt; 5 MT)</span>
        </div>
      </div>

      {/* Main Register Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-red-950 text-white font-bold uppercase text-[10px] tracking-wider">
                <th className="p-3">New P.O. No (4000 Series)</th>
                <th className="p-3">Reference P.O. No</th>
                <th className="p-3">M.R. No. (Inspection)</th>
                <th className="p-3">Lorry No.</th>
                <th className="p-3 text-center">Lorry Seq</th>
                <th className="p-3 text-right">Recd Wt (&lt; 5 MT)</th>
                <th className="p-3 text-right">Contract MT</th>
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Broker Name</th>
                <th className="p-3">Grades / Quality</th>
                <th className="p-3 text-right">Base Rate (₹)</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 font-semibold">
                    Loading Return Lorry (4000 Series) records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
                      <p className="text-sm font-bold text-slate-700">
                        No Return Lorry (4000 Series) Records Found
                      </p>
                      <p className="text-xs text-slate-500">
                        When a Mill Inspection lorry is saved with received weight under 5 Tons (&lt; 5 MT, e.g., 4.5 MT on the 6th lorry), its Sauda Check Point P.O. is automatically copied here with a 4000-series P.O. number. You can also click &quot;Generate Return Lorry P.O.&quot; above.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => (
                  <tr
                    key={rec.id || rec.po_no || idx}
                    className="bg-red-50/70 hover:bg-red-100/80 border-l-4 border-l-red-600 transition-colors"
                  >
                    <td className="p-3 font-mono font-black text-red-800">
                      <div className="flex flex-col">
                        <span className="text-xs">#{rec.new_po_no || rec.po_no}</span>
                        <span className="text-[9px] font-bold uppercase text-red-600">
                          4000 Series P.O.
                        </span>
                      </div>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-800">
                      <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-950">
                        #{rec.reference_po_no}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-red-950">
                      <div className="flex flex-col">
                        <span>{rec.mr_no || "-"}</span>
                        <span className="text-[9px] text-red-700 font-semibold">
                          {rec.inspection_date || rec.po_date || ""}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800">
                      {rec.lorry_number || "-"}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-red-600 text-white font-mono font-black text-[10px]">
                        {rec.lorry_sequence || `${rec.received_lorry_index || 1}/${rec.total_no_of_lorries || 6}`}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-black text-red-700">
                      {Number(rec.received_weight_mt || 0).toFixed(3)} MT
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-slate-700">
                      {Number(rec.total_contract_mt || 0).toFixed(3)} MT
                    </td>
                    <td className="p-3 font-bold uppercase text-slate-900 max-w-[160px] truncate">
                      {rec.supplier || rec.supplier_name || "-"}
                    </td>
                    <td className="p-3 font-semibold uppercase text-slate-700 max-w-[140px] truncate">
                      {rec.broker || rec.broker_name || "-"}
                    </td>
                    <td className="p-3 text-slate-800 font-semibold max-w-[160px] truncate">
                      {rec.quality_summary ||
                        (rec.items || [])
                          .map((i: any) => i.grade_name || i.grade || i.quality)
                          .filter(Boolean)
                          .join(", ") ||
                        "-"}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-900">
                      ₹{Number(rec.b_rate || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRecord(rec);
                            setIsEditing(false);
                          }}
                          className="p-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg cursor-pointer"
                          title="View Copied Sauda Check Point Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRecord(rec);
                            setIsEditing(true);
                          }}
                          className="p-1.5 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-lg cursor-pointer"
                          title="Edit Return Lorry P.O."
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(rec)}
                          className="p-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View / Edit Copied Sauda Check Point Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-red-200 overflow-hidden">
            <div className="bg-red-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Truck className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide">
                    Return Lorry P.O. #{selectedRecord.new_po_no || selectedRecord.po_no}
                  </h3>
                  <p className="text-[11px] text-red-200">
                    Copied from Sauda Check Point Reference P.O.: #{selectedRecord.reference_po_no} | M.R. No.: {selectedRecord.mr_no}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <button
                    type="button"
                    onClick={handleSaveEditedRecord}
                    disabled={syncing}
                    className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-red-950 font-black text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 hover:bg-white/20 rounded-lg text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Top Identity Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-red-50/60 p-3.5 rounded-xl border border-red-200">
                <div>
                  <label className="text-[10px] font-bold uppercase text-red-800 block">
                    New P.O. No (4000 Series)
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={selectedRecord.new_po_no || selectedRecord.po_no}
                      onChange={(e) =>
                        setSelectedRecord({
                          ...selectedRecord,
                          po_no: e.target.value,
                          new_po_no: e.target.value,
                        })
                      }
                      className="mt-1 w-full px-2 py-1 border border-red-300 rounded font-mono font-bold bg-white"
                    />
                  ) : (
                    <p className="font-mono font-black text-sm text-red-900 mt-0.5">
                      #{selectedRecord.new_po_no || selectedRecord.po_no}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-600 block">
                    Reference P.O. (Sauda Check Point)
                  </label>
                  <p className="font-mono font-black text-sm text-amber-900 mt-0.5">
                    #{selectedRecord.reference_po_no}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-600 block">
                    Mill Inspection M.R. No.
                  </label>
                  <p className="font-mono font-black text-sm text-slate-900 mt-0.5">
                    {selectedRecord.mr_no} ({selectedRecord.lorry_sequence || "Last Lorry"})
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-red-800 block">
                    Received Weight (&lt; 5 MT)
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.001"
                      value={selectedRecord.received_weight_mt}
                      onChange={(e) =>
                        setSelectedRecord({
                          ...selectedRecord,
                          received_weight_mt: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="mt-1 w-full px-2 py-1 border border-red-300 rounded font-mono font-bold bg-white"
                    />
                  ) : (
                    <p className="font-mono font-black text-sm text-red-700 mt-0.5">
                      {Number(selectedRecord.received_weight_mt || 0).toFixed(3)} MT
                    </p>
                  )}
                </div>
              </div>

              {/* Copied Sauda Check Point Fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Supplier</span>
                  <span className="font-bold text-slate-900">{selectedRecord.supplier || selectedRecord.supplier_name || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Broker</span>
                  <span className="font-bold text-slate-900">{selectedRecord.broker || selectedRecord.broker_name || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Area / Agency</span>
                  <span className="font-bold text-slate-900">{selectedRecord.area || selectedRecord.agency_name || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Lorry Number</span>
                  <span className="font-mono font-bold text-slate-900">{selectedRecord.lorry_number || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Contract Total MT</span>
                  <span className="font-mono font-bold text-slate-900">{Number(selectedRecord.total_contract_mt || 0).toFixed(3)} MT ({selectedRecord.total_no_of_lorries || 6} Lorries)</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Base Rate</span>
                  <span className="font-mono font-bold text-emerald-800">₹{Number(selectedRecord.b_rate || 0).toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Delivery Period</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedRecord.delivery_from || "-"} to {selectedRecord.delivery_to || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Unit / Marka</span>
                  <span className="font-bold text-slate-900">
                    {selectedRecord.purchase_unit_name || "BALES"} / {selectedRecord.marka_type || "STD"}
                  </span>
                </div>
              </div>

              {/* Copied Sauda Check Point Grade / Quality Table */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Copied Sauda Check Point Quality &amp; Grade Schedule
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                        <th className="p-2.5">Srl</th>
                        <th className="p-2.5">Agency</th>
                        <th className="p-2.5">Grade / Quality</th>
                        <th className="p-2.5">Marka</th>
                        <th className="p-2.5 text-right">Bales</th>
                        <th className="p-2.5 text-right">Weight (MT)</th>
                        <th className="p-2.5 text-right">Rate (₹)</th>
                        <th className="p-2.5 text-right">Premium (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedRecord.items || []).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-slate-400">
                            No itemized grade rows found on reference P.O.
                          </td>
                        </tr>
                      ) : (
                        (selectedRecord.items || []).map((it: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono">{it.srl_no || i + 1}</td>
                            <td className="p-2.5 font-semibold">{it.agency_name || it.agency_code || "-"}</td>
                            <td className="p-2.5 font-bold text-blue-900">{it.grade_name || it.grade || it.quality || "-"}</td>
                            <td className="p-2.5 font-mono">{it.marka || "-"}</td>
                            <td className="p-2.5 text-right font-mono">{it.bales || 0}</td>
                            <td className="p-2.5 text-right font-mono">{Number(it.weight_mt || 0).toFixed(3)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-800">
                              ₹{Number(it.rate_qntl || it.rate || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="p-2.5 text-right font-mono">{Number(it.premium || 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual / Assisted Generate Return Lorry Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-red-200 overflow-hidden">
            <div className="bg-red-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-black uppercase">
                  Copy Sauda Check Point to Return Lorry (4000 Series)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-white/20 rounded-lg text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 uppercase text-[10px] block mb-1">
                  1. Select Reference P.O. (From Sauda Check Point)
                </label>
                <select
                  value={selectedRefPo}
                  onChange={(e) => handleRefPoChange(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-800"
                >
                  <option value="">-- Select Reference P.O. (e.g. BJCL/2026-2027/0660) --</option>
                  {saudaList.map((s) => (
                    <option key={s.po_no} value={s.po_no}>
                      #{s.po_no} — {s.supplier || s.supplier_name || "Supplier"} ({s.total_no_of_lorries || s.no_of_lorries || 6} Lorries)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase text-[10px] block mb-1">
                  2. Mill Inspection M.R. No. (Last Lorry / Under 5 Ton)
                </label>
                <select
                  value={selectedMrNo}
                  onChange={(e) => {
                    setSelectedMrNo(e.target.value);
                    const found = inspectionList.find((i) => i.mr_no === e.target.value);
                    if (found) {
                      const wt = calculateInspectionWeightMt(found);
                      if (wt > 0 && wt < 5) setManualWeightMt(wt.toFixed(3));
                    }
                  }}
                  className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-800"
                >
                  <option value="">-- Select or Auto-Assign M.R. No. --</option>
                  {inspectionList.map((i) => (
                    <option key={i.mr_no} value={i.mr_no}>
                      {i.mr_no} — PO: #{i.po_no || "N/A"} — Lorry: {i.lorry_number || "N/A"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-red-800 uppercase text-[10px] block mb-1">
                    3. Received Weight (MT &lt; 5 Ton)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    max="4.999"
                    value={manualWeightMt}
                    onChange={(e) => setManualWeightMt(e.target.value)}
                    className="w-full p-2 rounded-lg border border-red-300 font-mono font-black text-red-800 bg-red-50/40"
                  />
                </div>

                <div>
                  <label className="font-bold text-red-800 uppercase text-[10px] block mb-1">
                    4. Generated 4000-Series P.O. No
                  </label>
                  <input
                    type="text"
                    value={customNewPoNo}
                    onChange={(e) => setCustomNewPoNo(e.target.value)}
                    className="w-full p-2 rounded-lg border border-red-300 font-mono font-black text-red-900 bg-red-50/40"
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-950 flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  All Sauda Check Point header and grade details from Reference P.O.{" "}
                  <strong>#{selectedRefPo || "..."}</strong> will be copied to{" "}
                  <strong>#{customNewPoNo || "4000-Series"}</strong>, highlighted in red in Mill Inspection, and available in Payment &amp; Settlement.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateReturnLorryManual}
                  disabled={syncing}
                  className="px-4 py-2 rounded-lg bg-red-800 hover:bg-red-700 text-white font-black cursor-pointer"
                >
                  {syncing ? "Copying Sauda Data..." : "Copy Sauda & Generate 4000-Series P.O."}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ReturnLorry;
