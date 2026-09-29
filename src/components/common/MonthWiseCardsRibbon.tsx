import React, { useMemo } from 'react';
import { Calendar, Filter, X, ChevronRight, Layers, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface MonthWiseCardsRibbonProps<T = any> {
  records: T[];
  getDate: (record: T) => string | Date | null | undefined;
  selectedMonth: string | null; // Format: 'YYYY-MM', e.g. '2026-04', or null for All
  onSelectMonth: (monthKey: string | null) => void;
  title?: string;
  unitLabel?: string;
  colorScheme?: 'emerald' | 'amber' | 'blue' | 'indigo' | 'purple' | 'slate' | 'teal';
  className?: string;
  showAllOption?: boolean;
}

export interface MonthData {
  key: string;       // '2026-04'
  monthName: string; // 'April'
  year: number;      // 2026
  label: string;     // 'April 2026'
  shortLabel: string;// 'Apr 2026'
  count: number;
}

export function parseMonthKey(dateVal: any): { key: string; monthName: string; year: number; label: string; shortLabel: string } | null {
  if (!dateVal) return null;
  const str = String(dateVal).trim();
  if (!str) return null;

  // Case 1: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed
    const year = parseInt(dmyMatch[3], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 0 && month <= 11) {
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;
        const monthName = d.toLocaleString('en-US', { month: 'long' });
        const shortMonth = d.toLocaleString('en-US', { month: 'short' });
        return {
          key,
          monthName,
          year,
          label: `${monthName} ${year}`,
          shortLabel: `${shortMonth} ${year}`
        };
      }
    }
  }

  // Case 2: YYYY-MM-DD or standard ISO
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthName = d.toLocaleString('en-US', { month: 'long' });
    const shortMonth = d.toLocaleString('en-US', { month: 'short' });
    return {
      key,
      monthName,
      year,
      label: `${monthName} ${year}`,
      shortLabel: `${shortMonth} ${year}`
    };
  }

  return null;
}

export const MonthWiseCardsRibbon = <T,>({
  records = [],
  getDate,
  selectedMonth,
  onSelectMonth,
  title = "Month-Wise Distribution",
  unitLabel = "Records",
  colorScheme = "emerald",
  className = "",
  showAllOption = true,
}: MonthWiseCardsRibbonProps<T>) => {

  // Aggregate records into month buckets
  // REQUIREMENT: "If Any Month Have No Data Then This month Card Not Shown There"
  const { monthCards, totalRecordsCount } = useMemo(() => {
    const map = new Map<string, MonthData>();
    let validCount = 0;

    for (const r of records) {
      const d = getDate(r);
      const parsed = parseMonthKey(d);
      if (!parsed) continue;

      validCount++;
      const existing = map.get(parsed.key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(parsed.key, {
          key: parsed.key,
          monthName: parsed.monthName,
          year: parsed.year,
          label: parsed.label,
          shortLabel: parsed.shortLabel,
          count: 1
        });
      }
    }

    // Strictly filter out any month with count <= 0 (if any)
    const list = Array.from(map.values()).filter(m => m.count > 0);

    // Sort descending by month key so current/latest month comes first, or chronological
    list.sort((a, b) => b.key.localeCompare(a.key));

    return { monthCards: list, totalRecordsCount: validCount };
  }, [records, getDate]);

  // Color theme presets
  const themeStyles = {
    emerald: {
      activeBorder: 'border-emerald-600 ring-2 ring-emerald-500 bg-emerald-50/80',
      activeText: 'text-emerald-950',
      activeBadge: 'bg-emerald-600 text-white',
      cardHover: 'hover:border-emerald-300 hover:bg-emerald-50/30',
      iconBg: 'bg-emerald-100 text-emerald-800',
      headerAccent: 'text-emerald-800',
      countText: 'text-emerald-900',
    },
    blue: {
      activeBorder: 'border-blue-600 ring-2 ring-blue-500 bg-blue-50/80',
      activeText: 'text-blue-950',
      activeBadge: 'bg-blue-600 text-white',
      cardHover: 'hover:border-blue-300 hover:bg-blue-50/30',
      iconBg: 'bg-blue-100 text-blue-800',
      headerAccent: 'text-blue-800',
      countText: 'text-blue-900',
    },
    amber: {
      activeBorder: 'border-amber-600 ring-2 ring-amber-500 bg-amber-50/80',
      activeText: 'text-amber-950',
      activeBadge: 'bg-amber-600 text-white',
      cardHover: 'hover:border-amber-300 hover:bg-amber-50/30',
      iconBg: 'bg-amber-100 text-amber-800',
      headerAccent: 'text-amber-800',
      countText: 'text-amber-900',
    },
    indigo: {
      activeBorder: 'border-indigo-600 ring-2 ring-indigo-500 bg-indigo-50/80',
      activeText: 'text-indigo-950',
      activeBadge: 'bg-indigo-600 text-white',
      cardHover: 'hover:border-indigo-300 hover:bg-indigo-50/30',
      iconBg: 'bg-indigo-100 text-indigo-800',
      headerAccent: 'text-indigo-800',
      countText: 'text-indigo-900',
    },
    teal: {
      activeBorder: 'border-teal-600 ring-2 ring-teal-500 bg-teal-50/80',
      activeText: 'text-teal-950',
      activeBadge: 'bg-teal-600 text-white',
      cardHover: 'hover:border-teal-300 hover:bg-teal-50/30',
      iconBg: 'bg-teal-100 text-teal-800',
      headerAccent: 'text-teal-800',
      countText: 'text-teal-900',
    },
    purple: {
      activeBorder: 'border-purple-600 ring-2 ring-purple-500 bg-purple-50/80',
      activeText: 'text-purple-950',
      activeBadge: 'bg-purple-600 text-white',
      cardHover: 'hover:border-purple-300 hover:bg-purple-50/30',
      iconBg: 'bg-purple-100 text-purple-800',
      headerAccent: 'text-purple-800',
      countText: 'text-purple-900',
    },
    slate: {
      activeBorder: 'border-slate-700 ring-2 ring-slate-600 bg-slate-100',
      activeText: 'text-slate-950',
      activeBadge: 'bg-slate-800 text-white',
      cardHover: 'hover:border-slate-400 hover:bg-slate-50',
      iconBg: 'bg-slate-200 text-slate-800',
      headerAccent: 'text-slate-800',
      countText: 'text-slate-900',
    },
  }[colorScheme] || {
    activeBorder: 'border-emerald-600 ring-2 ring-emerald-500 bg-emerald-50/80',
    activeText: 'text-emerald-950',
    activeBadge: 'bg-emerald-600 text-white',
    cardHover: 'hover:border-emerald-300 hover:bg-emerald-50/30',
    iconBg: 'bg-emerald-100 text-emerald-800',
    headerAccent: 'text-emerald-800',
    countText: 'text-emerald-900',
  };

  // If there are zero months with data, return null or empty banner
  if (monthCards.length === 0) {
    return null;
  }

  return (
    <div className={cn("w-full bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs transition-all", className)}>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg shadow-2xs", themeStyles.iconBg)}>
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className={cn("text-xs font-black uppercase tracking-wider", themeStyles.headerAccent)}>
              {title}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              Click any month card to filter records &middot; Showing {monthCards.length} active month{monthCards.length > 1 ? 's' : ''} (months with 0 data are hidden)
            </p>
          </div>
        </div>

        {selectedMonth && (
          <button
            type="button"
            onClick={() => onSelectMonth(null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Reset month filter and show all records"
          >
            <X className="w-3.5 h-3.5 text-rose-500" />
            <span>Clear Filter ({monthCards.find(m => m.key === selectedMonth)?.label || selectedMonth})</span>
          </button>
        )}
      </div>

      {/* Month Cards Scroll/Grid */}
      <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {/* Optional 'All Months' Overview Card */}
        {showAllOption && (
          <button
            type="button"
            onClick={() => onSelectMonth(null)}
            className={cn(
              "flex-shrink-0 min-w-[130px] p-2.5 rounded-xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between shadow-2xs",
              selectedMonth === null
                ? cn(themeStyles.activeBorder, "shadow-xs")
                : "border-slate-200 bg-slate-50/50 hover:bg-white " + themeStyles.cardHover
            )}
            title="View all records across all months"
          >
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                All Months
              </span>
              <Layers className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div>
              <div className="text-lg font-black text-slate-800 font-mono leading-none tracking-tight">
                {totalRecordsCount.toLocaleString()}
              </div>
              <div className="text-[9.5px] font-semibold text-slate-400 mt-0.5">
                Total {unitLabel}
              </div>
            </div>
            {selectedMonth === null && (
              <div className="mt-1.5 pt-1 border-t border-emerald-200/50 flex items-center gap-1 text-[9px] font-bold text-emerald-700">
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>Showing All</span>
              </div>
            )}
          </button>
        )}

        {/* Individual Month Cards - Strictly showing only months with count > 0 */}
        {monthCards.map((m) => {
          const isSelected = selectedMonth === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onSelectMonth(isSelected ? null : m.key)}
              className={cn(
                "flex-shrink-0 min-w-[145px] p-2.5 rounded-xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between shadow-2xs group relative overflow-hidden",
                isSelected
                  ? cn(themeStyles.activeBorder, "shadow-xs")
                  : "border-slate-200 bg-white " + themeStyles.cardHover
              )}
              title={`Filter by ${m.label} (${m.count} ${unitLabel})`}
            >
              {/* Subtle top indicator bar */}
              <div
                className={cn(
                  "absolute top-0 left-0 right-0 h-1 transition-all",
                  isSelected ? "bg-emerald-600" : "bg-transparent group-hover:bg-slate-300"
                )}
              />

              <div className="flex items-center justify-between gap-1 mb-1.5 pt-0.5">
                <span className={cn(
                  "text-[10.5px] font-black uppercase tracking-wider truncate",
                  isSelected ? themeStyles.activeText : "text-slate-700 group-hover:text-slate-900"
                )}>
                  {m.label}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-colors font-mono",
                    isSelected ? themeStyles.activeBadge : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                  )}
                >
                  {m.year}
                </span>
              </div>

              <div>
                <div className={cn(
                  "text-xl font-black font-mono leading-none tracking-tight",
                  isSelected ? themeStyles.countText : "text-slate-800 group-hover:text-slate-900"
                )}>
                  {m.count.toLocaleString()}
                </div>
                <div className="text-[9.5px] font-semibold text-slate-400 mt-1 flex items-center justify-between">
                  <span>{unitLabel}</span>
                  {isSelected && (
                    <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Active
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MonthWiseCardsRibbon;
