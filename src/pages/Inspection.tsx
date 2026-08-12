import React, { useState, useEffect } from "react";
import {
  Scale,
  Search,
  Filter,
  Plus,
  Printer,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  FileText,
  Truck,
  Building2,
  Layers,
  X,
  Trash2,
  Calendar,
  ChevronRight,
  ShieldCheck,
  Percent,
  TrendingDown
} from "lucide-react";
import { supabase } from "../lib/supabase";
import LegacyLayout from "../components/LegacyLayout";

interface MaterialInspectionRecord {
  mr_no: string;
  mr_date?: string;
  arrival_no?: string;
  arrival_date?: string;
  po_no?: string;
  po_date?: string;
  broker_name?: string;
  supplier_name?: string;
  actual_moisture?: number;
  claim_moisture?: number;
  actual_dust?: number;
  claim_dust?: number;
  actual_ncv?: number;
  claim_ncv?: number;
  detention_days?: number;
  unloading_date?: string;
  remarks?: string;
  lorry_number?: string;
  delivery_claim?: number;
  deduction_type?: string;
  deduction_rate?: number;
  deduction_qty?: number;
  deduction_amount?: number;
  status?: string;
  created_at?: string;
}

interface InspectionProps {
  onNavigate?: (page: string) => void;
}

export default function Inspection({ onNavigate }: InspectionProps) {
  const [records, setRecords] = useState<MaterialInspectionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRecord, setSelectedRecord] = useState<MaterialInspectionRecord | null>(null);
  const [selectedRecordDetails, setSelectedRecordDetails] = useState<any[]>([]);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // New Inspection Form State
  const [newMrNo, setNewMrNo] = useState<string>(`MRRC-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [newMrDate, setNewMrDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [newPoNo, setNewPoNo] = useState<string>("");
  const [newSupplier, setNewSupplier] = useState<string>("");
  const [newBroker, setNewBroker] = useState<string>("");
  const [newLorryNo, setNewLorryNo] = useState<string>("");
  const [newMoisture, setNewMoisture] = useState<number>(0);
  const [newDust, setNewDust] = useState<number>(0);
  const [newDeductionAmt, setNewDeductionAmt] = useState<number>(0);
  const [newRemarks, setNewRemarks] = useState<string>("");

  useEffect(() => {
    fetchInspectionRecords();
  }, []);

  const fetchInspectionRecords = async () => {
    setLoading(true);
    try {
      let dataList: MaterialInspectionRecord[] = [];
      if (supabase) {
        // First try primary table material_inspection
        const { data, error } = await supabase
          .from("material_inspection")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          dataList = data;
        } else {
          // Fallback to mill_inspection_master
          const { data: fallbackData } = await supabase
            .from("mill_inspection_master")
            .select("*")
            .order("created_at", { ascending: false });
          if (fallbackData) dataList = fallbackData;
        }
      }

      if (dataList.length === 0) {
        try {
          const cached = localStorage.getItem("material_inspection_records");
          if (cached) dataList = JSON.parse(cached);
        } catch (e) {}
      } else {
        try {
          localStorage.setItem("material_inspection_records", JSON.stringify(dataList));
        } catch (e) {}
      }

      setRecords(dataList);
    } catch (err) {
      console.error("Error fetching material_inspection records:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (rec: MaterialInspectionRecord) => {
    setSelectedRecord(rec);
    setShowDetailModal(true);
    setSelectedRecordDetails([]);
    if (supabase) {
      const { data } = await supabase
        .from("material_inspection_details")
        .select("*")
        .eq("mr_no", rec.mr_no);
      if (data && data.length > 0) {
        setSelectedRecordDetails(data);
      } else {
        const { data: fallback } = await supabase
          .from("mill_inspection_detail")
          .select("*")
          .eq("mr_no", rec.mr_no);
        if (fallback) setSelectedRecordDetails(fallback);
      }
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMrNo.trim() || !newSupplier.trim()) {
      alert("Please fill in required fields: M.R. Number and Supplier Name");
      return;
    }

    const payload: MaterialInspectionRecord = {
      mr_no: newMrNo,
      mr_date: newMrDate,
      po_no: newPoNo,
      supplier_name: newSupplier,
      broker_name: newBroker,
      lorry_number: newLorryNo,
      actual_moisture: newMoisture,
      actual_dust: newDust,
      deduction_amount: newDeductionAmt,
      remarks: newRemarks,
      status: "Completed",
      created_at: new Date().toISOString()
    };

    try {
      if (supabase) {
        await supabase.from("material_inspection").insert([payload]);
        await supabase.from("mill_inspection_master").insert([payload]).then(() => {}, () => {});
      }
      alert(`Material Inspection Record ${newMrNo} created successfully!`);
      setShowCreateModal(false);
      setNewMrNo(`MRRC-2026-${Math.floor(1000 + Math.random() * 9000)}`);
      setNewPoNo("");
      setNewSupplier("");
      setNewBroker("");
      setNewLorryNo("");
      setNewMoisture(0);
      setNewDust(0);
      setNewDeductionAmt(0);
      setNewRemarks("");
      fetchInspectionRecords();
    } catch (err: any) {
      alert("Failed to save inspection: " + err.message);
    }
  };

  const handleDeleteRecord = async (mr_no: string) => {
    if (!confirm(`Are you sure you want to delete inspection record ${mr_no}?`)) return;
    try {
      if (supabase) {
        await supabase.from("material_inspection").delete().eq("mr_no", mr_no);
        await supabase.from("material_inspection_details").delete().eq("mr_no", mr_no);
        await supabase.from("mill_inspection_master").delete().eq("mr_no", mr_no).then(() => {}, () => {});
        await supabase.from("mill_inspection_detail").delete().eq("mr_no", mr_no).then(() => {}, () => {});
      }
      setRecords(prev => prev.filter(r => r.mr_no !== mr_no));
      setShowDetailModal(false);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleExportCsv = () => {
    if (records.length === 0) return alert("No records to export");
    const headers = ["MR No", "MR Date", "PO No", "Supplier", "Broker", "Lorry No", "Moisture %", "Dust %", "Deductions", "Status"];
    const rows = filteredRecords.map(r => [
      r.mr_no,
      r.mr_date || "",
      r.po_no || "",
      `"${r.supplier_name || ""}"`,
      `"${r.broker_name || ""}"`,
      r.lorry_number || "",
      r.actual_moisture || 0,
      r.actual_dust || 0,
      r.deduction_amount || 0,
      r.status || "Completed"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Material_Inspection_Register_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecords = records.filter(r => {
    const query = searchQuery.toLowerCase();
    const matchesQuery =
      (r.mr_no || "").toLowerCase().includes(query) ||
      (r.po_no || "").toLowerCase().includes(query) ||
      (r.supplier_name || "").toLowerCase().includes(query) ||
      (r.broker_name || "").toLowerCase().includes(query) ||
      (r.lorry_number || "").toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "all" ||
      (r.status || "Completed").toLowerCase() === statusFilter.toLowerCase();

    return matchesQuery && matchesStatus;
  });

  const totalInspections = records.length;
  const avgMoisture = records.length > 0 ? (records.reduce((acc, r) => acc + (Number(r.actual_moisture) || 0), 0) / records.length).toFixed(1) : "0.0";
  const totalDeductions = records.reduce((acc, r) => acc + (Number(r.deduction_amount) || 0), 0);

  return (
    <LegacyLayout title="Material Inspection Module" subtitle="Quality audit register & inspection tracking">
      <div className="flex-1 flex flex-col font-sans text-slate-800 space-y-4 max-w-7xl mx-auto w-full pb-10">

        {/* HEADER BAR */}
        <div className="bg-[#174C2C] text-white px-6 py-4 rounded-xl shadow-lg flex flex-wrap items-center justify-between border border-[#0F351E] gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800/40 border border-emerald-400/40 flex items-center justify-center text-amber-300 shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="bg-[#0b2415] text-amber-300 text-[11px] font-extrabold px-2.5 py-0.5 rounded border border-emerald-700/60 tracking-wider">
                  BJL 2026 - 2027
                </span>
                <span className="text-xs text-emerald-200 font-semibold uppercase tracking-widest">
                  Table: material_inspection
                </span>
              </div>
              <h1 className="text-xl font-black text-white tracking-wide mt-0.5">
                INSPECTION MODULE
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigate && onNavigate("material_inspection")}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
            >
              <FileText className="w-4 h-4 text-slate-900" />
              <span>Inspection Checklist</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4 text-amber-300" />
              <span>New Inspection</span>
            </button>

            <button
              onClick={fetchInspectionRecords}
              className="p-2 bg-[#0b2415]/80 hover:bg-[#123920] border border-emerald-400/50 rounded-lg text-white transition-all cursor-pointer shadow-sm active:scale-95"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 text-amber-300 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* KPI STATS BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Audits</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{totalInspections}</p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">material_inspection records</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Moisture %</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{avgMoisture}%</p>
              <p className="text-[11px] text-blue-600 font-semibold mt-0.5">Quality Parameter</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Percent className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Deductions</p>
              <p className="text-2xl font-black text-slate-900 mt-1">₹ {totalDeductions.toLocaleString()}</p>
              <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Quality Claims</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sync Status</p>
              <p className="text-xl font-black text-emerald-700 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Live DB
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Synced with Supabase</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by M.R. No, P.O. No, Supplier, Lorry No..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/50 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <button
              onClick={handleExportCsv}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* RECORDS TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead>
                <tr className="bg-[#174C2C] text-white font-extrabold uppercase tracking-wider text-[11px] border-b border-[#0F351E]">
                  <th className="py-3 px-4">M.R. No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">P.O. No</th>
                  <th className="py-3 px-4">Supplier Name</th>
                  <th className="py-3 px-4">Lorry No</th>
                  <th className="py-3 px-4 text-center">Moisture %</th>
                  <th className="py-3 px-4 text-center">Dust %</th>
                  <th className="py-3 px-4 text-right">Deduction (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-700 mb-2" />
                      Loading material inspection records...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No material inspection records found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => (
                    <tr key={rec.mr_no} className="hover:bg-emerald-50/50 transition-colors">
                      <td className="py-3 px-4 font-black text-emerald-950 font-mono">{rec.mr_no}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {rec.mr_date ? new Date(rec.mr_date).toLocaleDateString("en-GB") : "-"}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{rec.po_no || "N/A"}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 max-w-[180px] truncate">
                        {rec.supplier_name || "-"}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{rec.lorry_number || "-"}</td>
                      <td className="py-3 px-4 text-center font-bold text-blue-700">
                        {rec.actual_moisture ? `${rec.actual_moisture}%` : "-"}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-amber-700">
                        {rec.actual_dust ? `${rec.actual_dust}%` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-700">
                        {rec.deduction_amount ? `₹ ${Number(rec.deduction_amount).toLocaleString()}` : "₹ 0"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                          {rec.status || "Completed"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleViewDetails(rec)}
                            className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 rounded-lg transition-colors"
                            title="View Record Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(rec.mr_no)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 rounded-lg transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* CREATE MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-[#174C2C] text-white p-4 px-6 flex items-center justify-between border-b border-[#0F351E]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-300" />
                  <h2 className="text-base font-black uppercase tracking-wide">New Material Inspection Record</h2>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-1 rounded bg-emerald-900/50 text-white hover:bg-emerald-950">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateRecord} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">M.R. Number *</label>
                    <input
                      type="text"
                      required
                      value={newMrNo}
                      onChange={(e) => setNewMrNo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">M.R. Date</label>
                    <input
                      type="date"
                      value={newMrDate}
                      onChange={(e) => setNewMrDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">P.O. Number</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-2026-001"
                      value={newPoNo}
                      onChange={(e) => setNewPoNo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Lorry Number</label>
                    <input
                      type="text"
                      placeholder="e.g. WB23A1234"
                      value={newLorryNo}
                      onChange={(e) => setNewLorryNo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Supplier Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Supplier / Mill Name"
                      value={newSupplier}
                      onChange={(e) => setNewSupplier(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Broker Name</label>
                    <input
                      type="text"
                      placeholder="Broker Name"
                      value={newBroker}
                      onChange={(e) => setNewBroker(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Actual Moisture %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newMoisture}
                      onChange={(e) => setNewMoisture(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Actual Dust %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newDust}
                      onChange={(e) => setNewDust(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Deduction Amount (₹)</label>
                  <input
                    type="number"
                    value={newDeductionAmt}
                    onChange={(e) => setNewDeductionAmt(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Remarks</label>
                  <textarea
                    rows={2}
                    value={newRemarks}
                    onChange={(e) => setNewRemarks(e.target.value)}
                    placeholder="Enter inspection audit observations..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium bg-slate-50 focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#174C2C] hover:bg-[#0f351e] text-amber-300 font-extrabold text-xs rounded-lg shadow-md"
                  >
                    Save Inspection Record
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DETAIL MODAL */}
        {showDetailModal && selectedRecord && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-[#174C2C] text-white p-4 px-6 flex items-center justify-between border-b border-[#0F351E]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-300" />
                  <h2 className="text-base font-black uppercase tracking-wide">Inspection Details [{selectedRecord.mr_no}]</h2>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-1 rounded bg-emerald-900/50 text-white hover:bg-emerald-950">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 font-bold block">M.R. NO</span>
                    <span className="font-mono font-black text-slate-900 text-sm">{selectedRecord.mr_no}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">P.O. NO</span>
                    <span className="font-bold text-slate-900">{selectedRecord.po_no || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">SUPPLIER</span>
                    <span className="font-bold text-slate-900">{selectedRecord.supplier_name || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">LORRY NO</span>
                    <span className="font-mono font-bold text-slate-900">{selectedRecord.lorry_number || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">MOISTURE %</span>
                    <span className="font-bold text-blue-700">{selectedRecord.actual_moisture || 0}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">DUST %</span>
                    <span className="font-bold text-amber-700">{selectedRecord.actual_dust || 0}%</span>
                  </div>
                </div>

                {selectedRecordDetails.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Item Grade Details</h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 font-bold text-slate-600">
                          <tr>
                            <th className="p-2 border-b">Grade</th>
                            <th className="p-2 border-b">Area</th>
                            <th className="p-2 border-b text-right">Quantity</th>
                            <th className="p-2 border-b text-right">Gross Wt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {selectedRecordDetails.map((dt, idx) => (
                            <tr key={idx}>
                              <td className="p-2 font-bold">{dt.arrival_grade || dt.stock_grade_code || "-"}</td>
                              <td className="p-2">{dt.area || "-"}</td>
                              <td className="p-2 text-right font-mono font-bold">{dt.quantity || 0} {dt.unit || "BALES"}</td>
                              <td className="p-2 text-right font-mono">{dt.challan_gross_wt || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedRecord.remarks && (
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs">
                    <span className="font-bold text-amber-900 block">Remarks:</span>
                    <p className="text-amber-800 mt-0.5">{selectedRecord.remarks}</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => handleDeleteRecord(selectedRecord.mr_no)}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Record</span>
                </button>

                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </LegacyLayout>
  );
}
