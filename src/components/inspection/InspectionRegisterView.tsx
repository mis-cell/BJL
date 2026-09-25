import React from "react";
import {
  ShieldCheck,
  Percent,
  TrendingDown,
  CheckCircle2,
  Layers,
  Search,
  Filter,
  Download,
  RefreshCw,
  Edit3,
  Printer,
  Trash2
} from "lucide-react";
import { InspectionMasterRecord } from "../../types/inspection.types";
import { PaginationControls } from "../PaginationControls";

export interface InspectionRegisterViewProps {
  filteredRecords: InspectionMasterRecord[];
  loading: boolean;
  totalInspections: number;
  avgMoisture: string | number;
  totalDeductions: number;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  sortField: string;
  sortOrder: "asc" | "desc";
  onToggleSort: (field: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  onExportCsv: () => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  onEditRecord: (rec: InspectionMasterRecord) => void;
  onPrintRecord: (rec: InspectionMasterRecord) => void;
  onDeleteRecord: (mrNo: string) => void;
}

export const InspectionRegisterView: React.FC<InspectionRegisterViewProps> = ({
  filteredRecords,
  loading,
  totalInspections,
  avgMoisture,
  totalDeductions,
  searchQuery,
  setSearchQuery,
  sortField,
  sortOrder,
  onToggleSort,
  statusFilter,
  setStatusFilter,
  onExportCsv,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  onEditRecord,
  onPrintRecord,
  onDeleteRecord,
}) => {
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <>
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
            placeholder="Search by Arrival No, P.O. No, Supplier, Lorry No..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/50 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* SORT BY ARRIVAL DATE CONTROL */}
          <div className="flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-[11px] font-black uppercase text-slate-500">Sort:</span>
            <span className="text-xs font-black text-slate-800">Arrival Date</span>
            <button
              type="button"
              onClick={() => onToggleSort("arrival_date")}
              className="ml-1 px-2 py-0.5 bg-white hover:bg-slate-200 text-slate-900 border border-slate-300 rounded text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all shadow-2xs"
              title="Toggle Ascending / Descending by Arrival Date"
            >
              {sortField === "arrival_date" && sortOrder === "asc" ? "↑ Oldest" : "↓ Newest"}
            </button>
          </div>

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
            type="button"
            onClick={onExportCsv}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* REGISTER TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-[#174C2C] text-white font-extrabold uppercase tracking-wider text-[11px] border-b border-[#0F351E]">
                <th
                  onClick={() => onToggleSort("arrival_no")}
                  className="py-3 px-4 cursor-pointer hover:bg-[#123920] select-none transition-colors"
                  title="Click to sort by Arrival No"
                >
                  Arrival No {sortField === "arrival_no" ? (sortOrder === "desc" ? "↓" : "↑") : "↕"}
                </th>
                <th
                  onClick={() => onToggleSort("arrival_date")}
                  className="py-3 px-4 cursor-pointer hover:bg-[#123920] select-none transition-colors bg-[#123920]/40"
                  title="Click to sort by Arrival Date"
                >
                  Arrival Date {sortField === "arrival_date" ? (sortOrder === "desc" ? "↓" : "↑") : "↕"}
                </th>
                <th className="py-3 px-4">P.O. No</th>
                <th className="py-3 px-4">Supplier Name</th>
                <th className="py-3 px-4">Broker Name</th>
                <th className="py-3 px-4">Lorry No</th>
                <th className="py-3 px-4 text-center">Act. Moisture %</th>
                <th className="py-3 px-4 text-center">Act. Dust %</th>
                <th className="py-3 px-4 text-right">Deduction (₹)</th>
                <th
                  onClick={() => onToggleSort("status")}
                  className="py-3 px-4 text-center cursor-pointer hover:bg-[#123920] select-none transition-colors"
                  title="Click to sort by Status"
                >
                  Status {sortField === "status" ? (sortOrder === "desc" ? "↓" : "↑") : "↕"}
                </th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-700 mb-2" />
                    Loading inspection records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No inspection records found matching your query.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((rec) => (
                  <tr
                    key={rec.mr_no}
                    onClick={() => onEditRecord(rec)}
                    className="hover:bg-emerald-50/60 transition-colors cursor-pointer select-none"
                    title="Click to view and edit inspection & deduction details"
                  >
                    <td className="py-3 px-4 font-black text-emerald-950 font-mono flex items-center gap-1.5">
                      <span>{rec.arrival_no || rec.mr_no}</span>
                      {rec.arrival_no && rec.mr_no && rec.arrival_no !== rec.mr_no && (
                        <span className="text-[10px] text-slate-400 font-normal">({rec.mr_no})</span>
                      )}
                      {rec.deductions &&
                        Array.isArray(rec.deductions) &&
                        rec.deductions.filter(
                          (d: any) => d.deduction_type || Number(d.deduction_amount) > 0
                        ).length > 0 && (
                          <span
                            className="text-[9px] bg-amber-100 text-amber-800 border border-amber-300 font-bold px-1.5 py-0.2 rounded"
                            title="Contains deduction details"
                          >
                            Ded:{" "}
                            {
                              rec.deductions.filter(
                                (d: any) => d.deduction_type || Number(d.deduction_amount) > 0
                              ).length
                            }
                          </span>
                        )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {rec.mr_date
                        ? new Date(rec.mr_date).toLocaleDateString("en-GB")
                        : rec.arrival_date
                        ? new Date(rec.arrival_date).toLocaleDateString("en-GB")
                        : "-"}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{rec.po_no || "N/A"}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 max-w-[180px] truncate">
                      {rec.supplier_name || "-"}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{rec.broker_name || "-"}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">{rec.lorry_number || "-"}</td>
                    <td className="py-3 px-4 text-center font-bold text-blue-700">
                      {rec.actual_moisture ? `${rec.actual_moisture}%` : "-"}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-amber-700">
                      {rec.actual_dust ? `${rec.actual_dust}%` : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-700">
                      {rec.deduction_amount
                        ? `₹ ${Number(rec.deduction_amount).toLocaleString()}`
                        : "₹ 0"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                        {rec.status || "Completed"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div
                        className="flex items-center justify-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onEditRecord(rec)}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white rounded font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                          title="Open Inspection and View Deductions"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintRecord(rec)}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                          title="Print Marks & Quality Received Mill Copy"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRecord(rec.mr_no)}
                          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded cursor-pointer transition-colors"
                          title="Delete Record"
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
      <div className="mt-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <PaginationControls
          currentPage={currentPage}
          totalItems={filteredRecords.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </>
  );
};
