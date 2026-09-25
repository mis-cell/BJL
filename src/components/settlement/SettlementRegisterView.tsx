import React from "react";
import {
  FileCheck,
  Plus,
  Search,
  X,
  DollarSign,
  Scale,
  RefreshCcw,
  Calculator,
  FileSpreadsheet,
  Eye,
} from "lucide-react";
import LegacyLayout from "../LegacyLayout";
import { PaginationControls } from "../PaginationControls";

export interface SettlementRegisterViewProps {
  settledList: any[];
  filteredSettles: any[];
  inspections: any[];
  loading: boolean;
  searchFilter: string;
  setSearchFilter: (term: string) => void;
  onOpenCreate: () => void;
  onExportCsv: () => void;
  onRefresh: () => void;
  onOpenView: (mrNo: string) => void;
  onEdit: (mrNo: string) => Promise<void> | void;
  onDelete: (mrNo: string) => void;
  onRevert: (mrNo: string, poNo: string) => void;
  canEditOrDelete: () => boolean;
  isL5OrAdmin: () => boolean;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  onClose?: () => void;
}

export const SettlementRegisterView: React.FC<SettlementRegisterViewProps> = ({
  settledList,
  filteredSettles,
  inspections,
  loading,
  searchFilter,
  setSearchFilter,
  onOpenCreate,
  onExportCsv,
  onRefresh,
  onOpenView,
  onEdit,
  onDelete,
  onRevert,
  canEditOrDelete,
  isL5OrAdmin,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  onClose,
}) => {
  return (
    <LegacyLayout title="Settlement" subtitle="" onClose={onClose}>
      <div className="space-y-4">
        {/* Aesthetic Top Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          {/* ARCHIVED SETTLEMENTS */}
          <div className="group relative overflow-hidden bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="absolute left-0 top-0 h-full w-1 bg-rose-500" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Archived Settlements
                </p>
                <p className="mt-1 text-xl font-black text-slate-800 font-mono">
                  {settledList.length}
                  <span className="ml-1 text-xs font-bold text-slate-500">
                    Accounts
                  </span>
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 border border-rose-100 text-rose-600">
                <FileCheck className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* TOTAL SETTLED OUTFLOW */}
          <div className="group relative overflow-hidden bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="absolute left-0 top-0 h-full w-1 bg-emerald-500" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Settled Outflow
                </p>
                <p className="mt-1 text-lg font-black text-emerald-700 font-mono truncate">
                  ₹{" "}
                  {settledList
                    .reduce(
                      (sum, item) => sum + (Number(item.payable_amt) || 0),
                      0
                    )
                    .toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* AVERAGE BILL VALUE */}
          <div className="group relative overflow-hidden bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="absolute left-0 top-0 h-full w-1 bg-indigo-500" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Avg Bill Value
                </p>
                <p className="mt-1 text-lg font-black text-indigo-700 font-mono truncate">
                  ₹{" "}
                  {settledList.length
                    ? (
                        settledList.reduce(
                          (sum, item) => sum + (Number(item.payable_amt) || 0),
                          0
                        ) / settledList.length
                      ).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })
                    : "0.00"}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                <Calculator className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* PENDING AUDITS */}
          <div className="group relative overflow-hidden bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="absolute left-0 top-0 h-full w-1 bg-amber-500" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Pending Audits
                </p>
                <p className="mt-1 text-xl font-black text-amber-700 font-mono">
                  {Math.max(0, inspections.length - settledList.length)}
                  <span className="ml-1 text-xs font-bold text-slate-500">
                    Materials
                  </span>
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 border border-amber-100 text-amber-600">
                <Scale className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Controls */}
        <div className="flex bg-[#174C2C] p-3 border border-[#103A20] rounded-lg gap-3 items-center flex-wrap shadow-md">
          {/* SEARCH */}
          <div className="flex bg-white border border-white/30 rounded-md flex-1 min-w-[280px] overflow-hidden shadow-sm">
            <input
              id="query_by_m_r_no_supplier__register"
              name="query_by_m_r_no_supplier_"
              aria-label="Query by M.R. No., Supplier Name, Broker, P.O. No..."
              className="flex-1 text-xs px-3 outline-none py-2 font-sans font-semibold text-slate-700 placeholder:text-slate-400"
              placeholder="Query by M.R. No., Supplier Name, Broker, P.O. No..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
            <button className="bg-[#103A20] px-3 border-l border-[#174C2C] hover:bg-[#0b2b18] transition-colors cursor-pointer" type="button">
              <Search className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={onOpenCreate}
              type="button"
              className="bg-yellow-400 border border-[#1B5E20] rounded-md px-3.5 py-2 text-[10px] uppercase font-bold text-slate-900 flex items-center gap-1.5 hover:bg-yellow-300 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-slate-900" />
              Create Settlement
            </button>

            <button
              onClick={onExportCsv}
              type="button"
              className="bg-white border border-white/50 rounded-md px-3.5 py-2 text-[10px] uppercase font-bold text-slate-700 flex items-center gap-1.5 hover:bg-blue-50 hover:text-blue-700 shadow-sm transition-all cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
              Export CSV
            </button>

            <button
              onClick={() => setSearchFilter("")}
              type="button"
              className="bg-white border border-white/50 rounded-md px-3 py-2 text-[10px] uppercase font-bold text-slate-700 flex items-center gap-1.5 hover:bg-rose-50 hover:text-rose-700 shadow-sm transition-all cursor-pointer"
              title="Clear Search"
            >
              <X className="h-3.5 w-3.5 text-rose-600" />
              Clear
            </button>

            <button
              onClick={onRefresh}
              type="button"
              className="bg-[#103A20] hover:bg-[#0b2b18] text-white border border-white/30 rounded-md px-3.5 py-2 text-[10px] uppercase font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              disabled={loading}
            >
              <RefreshCcw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* List Table Grid of settlements */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans min-w-[1100px]">
              <thead>
                <tr className="bg-[#174C2C] text-[10px] font-black uppercase text-white tracking-wide">
                  <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                    M.R. No.
                  </th>
                  <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                    Audit Date
                  </th>
                  <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                    P.O. No.
                  </th>
                  <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                    Supplier Name
                  </th>
                  <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                    Broker Name
                  </th>
                  <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                    Lorry Number
                  </th>
                  <th className="px-3 py-2.5 border-r border-white/20 text-right whitespace-nowrap">
                    Settled Amt
                  </th>
                  <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                    Bill No / Date
                  </th>
                  <th className="px-3 py-2.5 border-r border-white/20 text-center whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 font-medium">
                {loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-10 text-xs font-bold text-slate-500 uppercase tracking-widest italic animate-pulse"
                    >
                      Retrieving Accounts settlement ledger logs from Supabase ...
                    </td>
                  </tr>
                ) : filteredSettles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-10 text-xs font-bold text-slate-400 italic"
                    >
                      No Settled M.R. Records discovered. Click &quot;Create Settlement&quot; to resolve quality entries.
                    </td>
                  </tr>
                ) : (
                  filteredSettles
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((row) => (
                      <tr
                        key={row.settlement_id || row.mr_no}
                        className="hover:bg-emerald-50/60 text-[11px] font-sans transition-colors duration-150"
                      >
                        <td className="px-3 py-2.5 border-r border-slate-100 font-bold text-rose-700 whitespace-nowrap">
                          {row.mr_no}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-100 text-slate-600 whitespace-nowrap">
                          {row.sett_date}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-100 font-semibold text-slate-700 whitespace-nowrap">
                          {row.po_no}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-100 text-slate-800 uppercase font-bold whitespace-nowrap">
                          {row.supplier}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-100 text-slate-600 whitespace-nowrap">
                          {row.broker}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                          {row.lorry_number}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-100 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                          ₹{" "}
                          {Number(row.payable_amt).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                          {row.payable_bill_no
                            ? `${row.payable_bill_no} / ${row.payable_bill_date || ""}`
                            : "-"}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-100 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[8px] font-extrabold uppercase tracking-wide ${
                              row.payment_status === "Paid"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : row.payment_status === "Settled"
                                ? "bg-blue-100 text-blue-800 border border-blue-300"
                                : row.payment_status === "Partially Paid"
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-rose-100 text-rose-700 border border-rose-300"
                            }`}
                          >
                            {row.payment_status || "Pending"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onOpenView(row.mr_no)}
                              type="button"
                              className="bg-emerald-50 hover:bg-emerald-700 hover:text-white border border-emerald-300 text-emerald-700 rounded px-2.5 py-1.5 font-bold text-[9px] uppercase transition-all cursor-pointer flex items-center gap-1"
                              title="View full settlement details & deduction breakdown table"
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </button>

                            {canEditOrDelete() && (
                              <>
                                <button
                                  onClick={() => onEdit(row.mr_no)}
                                  type="button"
                                  className="bg-slate-50 hover:bg-[#3f51b5] hover:text-white border border-slate-300 text-slate-700 rounded px-2.5 py-1.5 font-bold text-[9px] uppercase transition-all cursor-pointer"
                                  title="Edit Settlement entry"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => onDelete(row.mr_no)}
                                  type="button"
                                  className="bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-300 text-rose-600 rounded px-2.5 py-1.5 font-bold text-[9px] uppercase transition-all cursor-pointer"
                                  title="Delete Settlement record"
                                >
                                  Delete
                                </button>
                              </>
                            )}

                            {isL5OrAdmin() && (
                              <button
                                onClick={() => onRevert(row.mr_no, row.po_no)}
                                type="button"
                                className="bg-amber-50 hover:bg-amber-600 hover:text-white border border-amber-300 text-amber-800 rounded px-2.5 py-1.5 font-bold text-[9px] uppercase transition-all cursor-pointer flex items-center gap-1"
                                title="Revert Settlement: Cancels settlement and moves P.O & Final M.R data back to Final P.O & Final M.R registers (Admin/L5 Only)"
                              >
                                <span>↺</span>
                                Revert
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2 p-2 border-t border-slate-100">
            <PaginationControls
              currentPage={currentPage}
              totalItems={filteredSettles.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      </div>
    </LegacyLayout>
  );
};

export default SettlementRegisterView;
