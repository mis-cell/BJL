import React, { useState, useMemo } from "react";
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
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import LegacyLayout from "../LegacyLayout";
import { PaginationControls } from "../PaginationControls";
import { parseRecordDate } from "../../services/dashboardCalculationService";
import { cn, formatIndianCurrency } from "../../lib/utils";

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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function getSettlementDate(item: any): string {
  return item.sett_date || item.audit_date || item.date || item.payable_bill_date || item.arrival_date || item.po_date || item.created_at || '';
}

function getInspectionDate(item: any): string {
  return item.arrival_date || item.date || item.unloading_date || item.mr_date || item.created_at || '';
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
  // Extract all available years from settled records and inspections
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYr = new Date().getFullYear();
    years.add(currentYr);

    settledList.forEach(s => {
      const d = getSettlementDate(s);
      const parsed = parseRecordDate(d);
      if (parsed.isValid && parsed.year >= 2000 && parsed.year <= 2100) {
        years.add(parsed.year);
      }
    });

    inspections.forEach(i => {
      const d = getInspectionDate(i);
      const parsed = parseRecordDate(d);
      if (parsed.isValid && parsed.year >= 2000 && parsed.year <= 2100) {
        years.add(parsed.year);
      }
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [settledList, inspections]);

  // Year and Month selection state
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return availableYears.length > 0 ? availableYears[0] : new Date().getFullYear();
  });

  const activeYear = availableYears.includes(selectedYear) ? selectedYear : (availableYears[0] || new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [collapseMonthSummary, setCollapseMonthSummary] = useState(false);

  // Month-wise summaries for activeYear
  const monthSummaries = useMemo(() => {
    return Array.from({ length: 12 }, (_, mIdx) => {
      const monthSettles = settledList.filter(s => {
        const d = getSettlementDate(s);
        const parsed = parseRecordDate(d);
        return parsed.isValid && parsed.year === activeYear && parsed.month === mIdx;
      });

      const monthInspections = inspections.filter(i => {
        const d = getInspectionDate(i);
        const parsed = parseRecordDate(d);
        return parsed.isValid && parsed.year === activeYear && parsed.month === mIdx;
      });

      const totalPayable = monthSettles.reduce((sum, item) => sum + (Number(item.payable_amt) || 0), 0);
      const settlementsCount = monthSettles.length;
      const avgBillValue = settlementsCount > 0 ? totalPayable / settlementsCount : 0;
      const pendingAudits = Math.max(0, monthInspections.length - settlementsCount);

      return {
        monthIndex: mIdx,
        monthName: MONTH_NAMES[mIdx],
        shortName: MONTH_SHORT_NAMES[mIdx],
        year: activeYear,
        settlementsCount,
        totalPayable,
        avgBillValue,
        monthInspectionsCount: monthInspections.length,
        pendingAudits,
        settlements: monthSettles
      };
    });
  }, [settledList, inspections, activeYear]);

  // Only show month cards that HAVE DATA
  const activeMonthSummaries = useMemo(() => {
    return monthSummaries.filter(m => m.settlementsCount > 0 || m.totalPayable > 0);
  }, [monthSummaries]);

  // Filter records based on selected Year & Month
  const yearMonthFilteredSettles = useMemo(() => {
    return settledList.filter(s => {
      const d = getSettlementDate(s);
      const parsed = parseRecordDate(d);
      
      if (!parsed.isValid || parsed.year === 0) {
        return selectedMonth === null;
      }

      if (parsed.year !== activeYear) return false;
      if (selectedMonth !== null && parsed.month !== selectedMonth) return false;
      return true;
    });
  }, [settledList, activeYear, selectedMonth]);

  // Filter inspections in active scope for pending audits calculation
  const scopedInspections = useMemo(() => {
    return inspections.filter(i => {
      const d = getInspectionDate(i);
      const parsed = parseRecordDate(d);
      if (!parsed.isValid || parsed.year === 0) {
        return selectedMonth === null;
      }
      if (parsed.year !== activeYear) return false;
      if (selectedMonth !== null && parsed.month !== selectedMonth) return false;
      return true;
    });
  }, [inspections, activeYear, selectedMonth]);

  // Scoped metrics for top KPI cards
  const totalSettledOutflow = useMemo(() => {
    return yearMonthFilteredSettles.reduce((sum, item) => sum + (Number(item.payable_amt) || 0), 0);
  }, [yearMonthFilteredSettles]);

  const avgBillValue = useMemo(() => {
    return yearMonthFilteredSettles.length > 0 ? totalSettledOutflow / yearMonthFilteredSettles.length : 0;
  }, [yearMonthFilteredSettles, totalSettledOutflow]);

  const pendingAuditsCount = useMemo(() => {
    return Math.max(0, scopedInspections.length - yearMonthFilteredSettles.length);
  }, [scopedInspections, yearMonthFilteredSettles]);

  // Combined with text search
  const finalFilteredSettles = useMemo(() => {
    if (!searchFilter.trim()) return yearMonthFilteredSettles;
    const term = searchFilter.toLowerCase().trim();
    return yearMonthFilteredSettles.filter(s => {
      return (
        (s.mr_no && String(s.mr_no).toLowerCase().includes(term)) ||
        (s.po_no && String(s.po_no).toLowerCase().includes(term)) ||
        (s.supplier && String(s.supplier).toLowerCase().includes(term)) ||
        (s.broker && String(s.broker).toLowerCase().includes(term)) ||
        (s.lorry_number && String(s.lorry_number).toLowerCase().includes(term)) ||
        (s.payable_bill_no && String(s.payable_bill_no).toLowerCase().includes(term))
      );
    });
  }, [yearMonthFilteredSettles, searchFilter]);

  const activeScopeLabel = selectedMonth !== null
    ? `${MONTH_NAMES[selectedMonth]} ${activeYear}`
    : `FY / Year ${activeYear} (All Months)`;

  return (
    <LegacyLayout title="Settlement" subtitle="" onClose={onClose}>
      <div className="space-y-4">
        {/* Aesthetic Top Stats Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                Settlement KPI Summary
              </span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                {activeScopeLabel}
              </span>
            </div>

            {selectedMonth !== null && (
              <button
                onClick={() => setSelectedMonth(null)}
                className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                Reset to All Months ({activeYear})
              </button>
            )}
          </div>

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
                    {yearMonthFilteredSettles.length}
                    <span className="ml-1 text-xs font-bold text-slate-500">
                      Accounts
                    </span>
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5">{activeScopeLabel}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 border border-rose-100 text-rose-600 shrink-0">
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
                    ₹ {formatIndianCurrency(totalSettledOutflow)}
                  </p>
                  <p className="text-[9px] text-emerald-600 mt-0.5">Authoritative Net Settle Value</p>
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
                    ₹ {formatIndianCurrency(avgBillValue)}
                  </p>
                  <p className="text-[9px] text-indigo-500 mt-0.5">Per M.R. Settlement Account</p>
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
                    {pendingAuditsCount}
                    <span className="ml-1 text-xs font-bold text-slate-500">
                      Materials
                    </span>
                  </p>
                  <p className="text-[9px] text-amber-600 mt-0.5">Unsettled Arrivals</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 border border-amber-100 text-amber-600 shrink-0">
                  <Scale className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MONTH-WISE SUMMARY SECTION (SINGLE LINE & ONLY MONTHS WITH DATA) */}
        <div className="bg-gradient-to-b from-emerald-50/70 to-slate-50 border-2 border-emerald-200/80 rounded-2xl p-2.5 sm:p-3 shadow-sm space-y-2.5">
          {/* Compact Control Toolbar */}
          <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#174C2C] text-emerald-200 shadow-xs">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-[#103A20]">
                Month-Wise Summary {activeMonthSummaries.length > 0 ? `(${activeMonthSummaries.length} Active ${activeMonthSummaries.length === 1 ? 'Month' : 'Months'})` : ''}
              </span>
            </div>

            {/* Dynamic Year Selector & Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <label htmlFor="settlement-year-select" className="text-xs font-bold text-[#103A20] flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-emerald-700" />
                <span>Year:</span>
              </label>
              <select
                id="settlement-year-select"
                value={activeYear}
                onChange={(e) => {
                  setSelectedYear(Number(e.target.value));
                  setSelectedMonth(null);
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 bg-white border-2 border-[#174C2C] rounded-lg text-xs font-mono font-bold text-[#103A20] shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {availableYears.map(yr => (
                  <option key={yr} value={yr} className="font-mono font-bold">
                    {yr}
                  </option>
                ))}
              </select>

              {/* All Months Filter Pill */}
              <button
                onClick={() => {
                  setSelectedMonth(null);
                  setCurrentPage(1);
                }}
                className={cn(
                  "h-8 px-3 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                  selectedMonth === null
                    ? "bg-[#174C2C] text-white border-[#103A20] shadow-xs"
                    : "bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-100"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All Months</span>
              </button>

              {/* Collapse / Expand Toggle */}
              <button
                onClick={() => setCollapseMonthSummary(!collapseMonthSummary)}
                className="h-8 px-2.5 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-lg text-xs font-bold text-emerald-900 transition-colors flex items-center gap-1 cursor-pointer"
                title={collapseMonthSummary ? "Expand Month Cards" : "Collapse Month Cards"}
              >
                {collapseMonthSummary ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                <span>{collapseMonthSummary ? "Expand" : "Collapse"}</span>
              </button>
            </div>
          </div>

          {/* Month Cards Grid (SINGLE LINE ROW, ONLY ACTIVE MONTHS WITH DATA) */}
          {!collapseMonthSummary && (
            activeMonthSummaries.length > 0 ? (
              <div className="flex flex-row flex-nowrap overflow-x-auto gap-2.5 pb-2 pt-0.5 scrollbar-thin">
                {activeMonthSummaries.map((m) => {
                  const isSelected = selectedMonth === m.monthIndex;

                  return (
                    <div
                      key={`${m.year}-${m.monthIndex}`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedMonth(null);
                        } else {
                          setSelectedMonth(m.monthIndex);
                        }
                        setCurrentPage(1);
                      }}
                      className={cn(
                        "min-w-[185px] flex-1 max-w-[240px] shrink-0 rounded-xl p-2.5 transition-all flex flex-col justify-between cursor-pointer group active:scale-[0.98] select-none text-xs relative",
                        isSelected
                          ? "bg-gradient-to-br from-[#103A20] to-[#174C2C] text-white border-2 border-emerald-400 shadow-md ring-2 ring-emerald-400/40"
                          : "bg-white border-2 border-emerald-200/90 hover:border-emerald-600 hover:shadow-md text-slate-800"
                      )}
                      title={`Click to filter Settlements to ${m.monthName} ${m.year}`}
                    >
                      <div>
                        {/* Card Header: Month Name + Year */}
                        <div className={cn(
                          "flex items-center justify-between gap-1 mb-1.5 pb-1 border-b",
                          isSelected ? "border-emerald-700/60" : "border-slate-100"
                        )}>
                          <h3 className={cn(
                            "text-xs font-black uppercase tracking-wider flex items-center gap-1 truncate",
                            isSelected ? "text-emerald-100" : "text-[#103A20]"
                          )}>
                            <span className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              isSelected ? "bg-emerald-300" : "bg-emerald-600"
                            )} />
                            <span>{m.shortName}</span>
                          </h3>
                          <span className={cn(
                            "text-[9px] font-mono font-semibold",
                            isSelected ? "text-emerald-200" : "text-slate-500"
                          )}>
                            {m.year}
                          </span>
                        </div>

                        {/* Settlements Count */}
                        <div className={cn(
                          "flex items-center justify-between text-[11px] py-0.5 border-b",
                          isSelected ? "border-emerald-800/60" : "border-slate-100"
                        )}>
                          <span className={isSelected ? "text-emerald-200 font-semibold" : "text-slate-500 font-semibold"}>
                            Settled:
                          </span>
                          <span className={cn(
                            "font-mono font-black",
                            isSelected ? "text-white" : "text-[#103A20]"
                          )}>
                            {m.settlementsCount} Accounts
                          </span>
                        </div>

                        {/* Outflow Amount */}
                        <div className={cn(
                          "flex items-center justify-between text-[10px] py-0.5 border-b border-dashed",
                          isSelected ? "border-emerald-800/60" : "border-slate-100"
                        )}>
                          <span className={isSelected ? "text-emerald-200 font-semibold" : "text-slate-500 font-semibold"}>
                            Outflow:
                          </span>
                          <span className={cn(
                            "font-mono font-bold truncate max-w-[95px]",
                            isSelected ? "text-emerald-300" : "text-emerald-700"
                          )}>
                            ₹{formatIndianCurrency(m.totalPayable)}
                          </span>
                        </div>

                        {/* Avg Bill Value */}
                        <div className="flex items-center justify-between text-[10px] pt-1">
                          <span className={isSelected ? "text-emerald-200 font-semibold" : "text-slate-500 font-semibold"}>
                            Avg Value:
                          </span>
                          <span className={cn(
                            "font-mono font-bold truncate max-w-[95px]",
                            isSelected ? "text-white" : "text-slate-700"
                          )}>
                            ₹{formatIndianCurrency(m.avgBillValue)}
                          </span>
                        </div>
                      </div>

                      {/* Card Footer / Action Hint */}
                      <div className={cn(
                        "mt-2 pt-1 border-t border-dashed text-[9px] font-bold flex items-center justify-between transition-transform",
                        isSelected 
                          ? "border-emerald-700 text-emerald-200" 
                          : "border-slate-200 text-emerald-700 group-hover:translate-x-0.5"
                      )}>
                        <span>{isSelected ? '✓ Active Filter' : 'View Month'}</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-emerald-200 rounded-xl p-4 text-center text-slate-500 text-xs font-semibold">
                No settlement transactions found for year {activeYear}. Please select another year from the dropdown above.
              </div>
            )
          )}
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
              onChange={(e) => {
                setSearchFilter(e.target.value);
                setCurrentPage(1);
              }}
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

        {/* Active Filter Notification Ribbon (if Month is filtered) */}
        {selectedMonth !== null && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 px-3 flex items-center justify-between text-xs font-bold text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>
                Showing {MONTH_NAMES[selectedMonth]} {activeYear} ({finalFilteredSettles.length} Settlements found)
              </span>
            </div>
            <button
              onClick={() => setSelectedMonth(null)}
              className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300 text-[10px] uppercase font-black tracking-wider transition-colors cursor-pointer"
            >
              Clear Month Filter (View All)
            </button>
          </div>
        )}

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
                ) : finalFilteredSettles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-10 text-xs font-bold text-slate-400 italic"
                    >
                      No Settled M.R. Records discovered for {activeScopeLabel}.
                    </td>
                  </tr>
                ) : (
                  finalFilteredSettles
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
              totalItems={finalFilteredSettles.length}
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
