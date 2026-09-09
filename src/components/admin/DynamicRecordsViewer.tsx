import React, { useState, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
  FileSpreadsheet,
  Layers,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { TableDef } from "./MasterTableNav";

interface ColumnDef {
  name: string;
  type: string;
}

interface DynamicRecordsViewerProps {
  selectedTable?: TableDef | null;
  columns: ColumnDef[];
  data: any[];
  loading: boolean;
  onEditRow: (row: any) => void;
  onDeleteRow: (pkValue: any) => void;
  onAddNewRow: () => void;
  onRefreshData: () => void;
  onCsvImport?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const DynamicRecordsViewer: React.FC<DynamicRecordsViewerProps> = ({
  selectedTable,
  columns,
  data,
  loading,
  onEditRow,
  onDeleteRow,
  onAddNewRow,
  onRefreshData,
  onCsvImport,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute table columns: if schema columns are provided, use them; otherwise extract from data keys
  const displayColumns = useMemo(() => {
    if (columns && columns.length > 0) {
      return columns;
    }
    if (data && data.length > 0) {
      const keys = Object.keys(data[0]);
      return keys.map((k) => ({
        name: k,
        type: typeof data[0][k] === "number" ? "numeric" : "text",
      }));
    }
    return [];
  }, [columns, data]);

  // Client-side search filtering across all record values
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();
    return data.filter((row) => {
      if (!row || typeof row !== "object") return false;
      return Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [data, searchQuery]);

  // Reset to first page when search changes or selected table changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTable?.name]);

  // If no table is selected yet, render friendly loading/placeholder state
  if (!selectedTable) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-50/50 rounded-xl border border-slate-200/80 min-h-[300px]">
        <Database className="w-8 h-8 mb-2 animate-pulse text-slate-400" />
        <p className="text-xs font-semibold text-slate-600">Loading master table records...</p>
      </div>
    );
  }

  // Pagination calculations
  const totalRecords = filteredData.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalRecords / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    if (pageSize === -1) return filteredData;
    const start = (validCurrentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, validCurrentPage, pageSize]);

  // CSV export helper
  const handleExportCsv = () => {
    if (!filteredData || filteredData.length === 0) {
      alert("No records to export.");
      return;
    }
    const headers = displayColumns.map((c) => c.name);
    const rows = filteredData.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return '""';
        const str = typeof val === "object" ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selectedTable.name}_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format cell display
  const renderCellContent = (row: any, col: ColumnDef) => {
    const val = row[col.name];
    if (val === null || val === undefined) {
      return <span className="text-slate-300 font-mono text-[11px]">—</span>;
    }

    const colLower = col.name.toLowerCase();
    const typeLower = (col.type || "").toLowerCase();

    // Boolean or Active flag
    if (
      typeLower.includes("bool") ||
      colLower === "is_active" ||
      colLower === "status" ||
      val === true ||
      val === false
    ) {
      const isActive =
        String(val).toLowerCase() === "true" ||
        val === true ||
        val === 1 ||
        val === "1" ||
        String(val).toLowerCase() === "active";

      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
            isActive
              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isActive ? "bg-emerald-600" : "bg-slate-400"
            }`}
          />
          {isActive ? "Active" : "Inactive"}
        </span>
      );
    }

    // JSON objects
    if (typeof val === "object") {
      const jsonStr = JSON.stringify(val);
      return (
        <span
          title={jsonStr}
          className="font-mono text-[11px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 truncate max-w-[180px] inline-block align-middle"
        >
          {jsonStr}
        </span>
      );
    }

    // Date formatting if ISO string
    if (
      (typeLower.includes("timestamp") || typeLower.includes("date") || colLower.includes("date") || colLower.includes("created_at")) &&
      typeof val === "string" &&
      val.length >= 10 &&
      !isNaN(Date.parse(val))
    ) {
      const d = new Date(val);
      const formatted = d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      return (
        <span title={val} className="text-slate-700 font-medium whitespace-nowrap">
          {formatted}
        </span>
      );
    }

    const strVal = String(val);
    return (
      <span
        title={strVal}
        className="text-slate-800 truncate max-w-[220px] block font-mono text-[11px]"
      >
        {strVal}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-3 min-h-0">
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50/90 border border-slate-200/90 rounded-xl shrink-0 shadow-xs">
        {/* Table Title & Summary Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-xs">
              {React.createElement(selectedTable.icon || Database, { className: "h-4 w-4" })}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  {selectedTable.label}
                </h3>
                <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold">
                  {selectedTable.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Showing {totalRecords} {totalRecords === 1 ? "record" : "records"}
                {searchQuery ? ` (filtered from ${data.length})` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Right Action Tools: Search, Refresh, Import/Export, + Add Record */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search input within records */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter records..."
              className="pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 w-44 sm:w-56 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={onRefreshData}
            title="Refresh table data"
            className="p-2 text-slate-600 hover:text-emerald-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>

          {/* CSV Export */}
          <button
            onClick={handleExportCsv}
            title="Export filtered records to CSV"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          {/* CSV Import */}
          {onCsvImport && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={onCsvImport}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Import records from CSV file"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                <Upload className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden sm:inline">Import</span>
              </button>
            </>
          )}

          {/* Primary "+ Add Record" Button */}
          <button
            onClick={onAddNewRow}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg transition-all shadow-xs cursor-pointer active:scale-98"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Record</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs flex flex-col min-h-0">
        <div className="flex-1 overflow-auto relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs z-20 flex items-center justify-center">
              <div className="flex items-center gap-2.5 px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-md">
                <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
                <span className="text-xs font-semibold text-slate-700">
                  Loading records...
                </span>
              </div>
            </div>
          )}

          {paginatedData.length === 0 ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center p-8 text-center">
              <div className="p-3 bg-slate-100 rounded-full text-slate-400 mb-3">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">
                {searchQuery ? "No matching records found" : "No records in this table yet"}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                {searchQuery
                  ? `No entries matched your filter "${searchQuery}". Try a different keyword or clear search.`
                  : `This table currently has 0 rows. Click below to add the first record.`}
              </p>
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Clear Search Filter
                </button>
              ) : (
                <button
                  onClick={onAddNewRow}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create First Record</span>
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/95 sticky top-0 z-10 border-b border-slate-200 backdrop-blur-xs">
                <tr>
                  {/* Actions column */}
                  <th className="py-2.5 px-3 text-center w-[120px] font-bold text-slate-700 uppercase tracking-wider text-[10.5px] border-r border-slate-200/80">
                    Actions
                  </th>

                  {/* Dynamic Columns */}
                  {displayColumns.map((col) => (
                    <th
                      key={col.name}
                      className="py-2.5 px-3 font-bold text-slate-700 uppercase tracking-wider text-[10.5px] border-r border-slate-200/80 whitespace-nowrap"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span>{col.name.replace(/_/g, " ")}</span>
                        <span className="text-[9px] font-mono text-slate-400 lowercase font-normal">
                          {col.type}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.map((row, idx) => {
                  const pkVal = row[selectedTable.pk] ?? row.id ?? idx;
                  return (
                    <tr
                      key={pkVal ?? idx}
                      onClick={() => onEditRow(row)}
                      title="Click row to edit record"
                      className="hover:bg-emerald-50/40 cursor-pointer transition-colors group"
                    >
                      {/* Action buttons cell */}
                      <td
                        className="py-2 px-3 text-center border-r border-slate-200/60 whitespace-nowrap bg-white group-hover:bg-transparent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditRow(row)}
                            title="Edit record"
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-900 border border-emerald-200/80 rounded-md transition-colors cursor-pointer"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Permanently delete this record? This action cannot be revoked.`)) {
                                onDeleteRow(pkVal);
                              }
                            }}
                            title="Delete record"
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 border border-rose-200/80 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Del</span>
                          </button>
                        </div>
                      </td>

                      {/* Dynamic columns cells */}
                      {displayColumns.map((col) => (
                        <td
                          key={col.name}
                          className="py-2 px-3 border-r border-slate-200/60 max-w-[240px]"
                        >
                          {renderCellContent(row, col)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination & Summary Footer */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-slate-600 font-medium">
              Showing{" "}
              <strong className="text-slate-800">
                {totalRecords === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-800">
                {pageSize === -1 ? totalRecords : Math.min(validCurrentPage * pageSize, totalRecords)}
              </strong>{" "}
              of <strong className="text-slate-800">{totalRecords}</strong> records
            </span>

            {/* Page size select */}
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="text-[11px]">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-emerald-600 cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={-1}>All</option>
              </select>
            </div>
          </div>

          {/* Page navigation buttons */}
          {pageSize !== -1 && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                disabled={validCurrentPage <= 1}
                onClick={() => setCurrentPage(1)}
                title="First Page"
                className="p-1 border border-slate-200 rounded bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </button>
              <button
                disabled={validCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                title="Previous Page"
                className="p-1 border border-slate-200 rounded bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-slate-700 font-semibold text-[11px]">
                Page {validCurrentPage} of {totalPages}
              </span>
              <button
                disabled={validCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                title="Next Page"
                className="p-1 border border-slate-200 rounded bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                disabled={validCurrentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                title="Last Page"
                className="p-1 border border-slate-200 rounded bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DynamicRecordsViewer;
