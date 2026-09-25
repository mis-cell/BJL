import React from "react";
import { Search, Printer, Edit, Trash2, FileSpreadsheet, ArrowUpDown, ChevronUp, ChevronDown, CheckCircle, Clock } from "lucide-react";
import { PaginationControls } from "../PaginationControls";
import { InspectionMasterRecord } from "../../types/inspection.types";
import { formatIndianCurrency } from "../../lib/utils";

export interface InspectionRegisterViewProps {
  filteredRecords: InspectionMasterRecord[];
  loading: boolean;
  totalInspections: number;
  avgMoisture: string | number;
  totalDeductions: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortField: "arrival_date" | "arrival_no" | "status";
  sortOrder: "asc" | "desc";
  onToggleSort: (field: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  onExportCsv: () => void;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  pageSize: number;
  setPageSize: (s: number) => void;
  onEditRecord: (rec: InspectionMasterRecord) => void;
  onPrintRecord: (rec: InspectionMasterRecord) => void;
  onDeleteRecord: (mr_no: string) => Promise<void>;
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
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4">
      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Total Inspections</div>
            <div className="text-2xl font-black text-blue-900 mt-1">{totalInspections}</div>
          </div>
          <CheckCircle className="w-8 h-8 text-blue-500/30" />
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Avg Actual Moisture</div>
            <div className="text-2xl font-black text-emerald-800 mt-1">{avgMoisture}%</div>
          </div>
          <Clock className="w-8 h-8 text-emerald-500/30" />
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Total Deductions (₹)</div>
            <div className="text-2xl font-black text-amber-800 mt-1">{formatIndianCurrency(totalDeductions)}</div>
          </div>
          <Printer className="w-8 h-8 text-amber-500/30" />
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search MR No, Supplier, Broker, PO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
            <option value="Draft">Draft</option>
          </select>
        </div>

        <button
          onClick={onExportCsv}
          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                <th className="p-3">M.R. No.</th>
                <th
                  className="p-3 cursor-pointer select-none hover:bg-slate-200 transition-colors"
                  onClick={() => onToggleSort("arrival_no")}
                >
                  <div className="flex items-center gap-1">
                    <span>Arrival No.</span>
                    {sortField === "arrival_no" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>
                <th
                  className="p-3 cursor-pointer select-none hover:bg-slate-200 transition-colors"
                  onClick={() => onToggleSort("arrival_date")}
                >
                  <div className="flex items-center gap-1">
                    <span>Arrival Date</span>
                    {sortField === "arrival_date" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="p-3">P.O. No.</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Broker</th>
                <th className="p-3 text-right">Moisture %</th>
                <th className="p-3 text-right">Deduction (₹)</th>
                <th
                  className="p-3 text-center cursor-pointer select-none hover:bg-slate-200 transition-colors"
                  onClick={() => onToggleSort("status")}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    {sortField === "status" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400 font-medium">
                    Loading inspection records...
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400 font-medium">
                    No inspection records found.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => (
                  <tr
                    key={r.id || r.mr_no || idx}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="p-3 font-bold text-blue-900">{r.mr_no}</td>
                    <td className="p-3 font-medium">{r.arrival_no || "-"}</td>
                    <td className="p-3 font-mono text-slate-600">{r.arrival_date || r.mr_date || "-"}</td>
                    <td className="p-3 font-mono">{r.po_no ? `#${r.po_no}` : "-"}</td>
                    <td className="p-3 font-bold uppercase truncate max-w-[160px]">{r.supplier_name || "-"}</td>
                    <td className="p-3 uppercase truncate max-w-[140px] text-slate-600">{r.broker_name || "-"}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-800">{r.actual_moisture ? `${r.actual_moisture}%` : "-"}</td>
                    <td className="p-3 text-right font-mono text-amber-800">{formatIndianCurrency(r.deduction_amount || 0)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.status === "Completed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {r.status || "Completed"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onEditRecord(r)}
                          className="p-1 hover:bg-blue-100 text-blue-700 rounded transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onPrintRecord(r)}
                          className="p-1 hover:bg-emerald-100 text-emerald-700 rounded transition-colors cursor-pointer"
                          title="Print"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteRecord(r.mr_no)}
                          className="p-1 hover:bg-rose-100 text-rose-700 rounded transition-colors cursor-pointer"
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

        <div className="p-3 border-t border-slate-200">
          <PaginationControls
            currentPage={currentPage}
            totalItems={filteredRecords.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </div>
  );
};
