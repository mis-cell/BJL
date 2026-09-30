import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  RefreshCcw,
  Printer,
  Table as TableIcon,
  Calendar,
  CheckCircle2,
  Database,
  SlidersHorizontal,
  XCircle,
  FileSpreadsheet,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import LegacyLayout from '../components/LegacyLayout';
import { dbModule } from '../services/dbModule';

interface ReportModuleDef {
  key: string;
  label: string;
  table: string;
  icon: string;
}

const REPORT_MODULES: ReportModuleDef[] = [
  { key: 'sauda_master', label: 'Sauda Entry Register', table: 'sauda_master', icon: '📝' },
  { key: 'sauda_check_point', label: 'Sauda Check Point', table: 'sauda_check_point', icon: '📋' },
  { key: 'temporary_arrival', label: 'Amad / Temporary Arrival', table: 'temporary_material_received', icon: '🚚' },
  { key: 'final_arrival', label: 'Final Arrival Register', table: 'final_arrival', icon: '🏭' },
  { key: 'material_inspection', label: 'Mill Inspection Register', table: 'material_inspection', icon: '🔬' },
  { key: 'purchase_master', label: 'Final P.O Register', table: 'purchase_master', icon: '💼' },
  { key: 'payment_master', label: 'Payment & Settlement Ledger', table: 'payment_master', icon: '💳' },
  { key: 'satta_base_rates', label: 'Satta Base Rates Schedule', table: 'satta_base_rates', icon: '📈' },
  { key: 'user_master', label: 'User Master Directory', table: 'user_master', icon: '👤' },
  { key: 'material_mismatch', label: 'System Mismatch Register', table: 'material_mismatch', icon: '⚠️' }
];

export default function Reports({ onClose, initialReportType }: { onClose?: () => void; initialReportType?: string }) {
  const [selectedModuleKey, setSelectedModuleKey] = useState<string>('sauda_master');
  const [loading, setLoading] = useState<boolean>(false);
  const [rawRecords, setRawRecords] = useState<any[]>([]);

  // Filter States
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recordLimit, setRecordLimit] = useState<number>(100);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showColumnSelector, setShowColumnSelector] = useState<boolean>(false);

  const activeModule = useMemo(() => {
    return REPORT_MODULES.find(m => m.key === selectedModuleKey) || REPORT_MODULES[0];
  }, [selectedModuleKey]);

  // Load raw records for chosen module from database
  const loadModuleData = async () => {
    setLoading(true);
    try {
      const data = await dbModule.fetchAll(activeModule.table as any).catch(() => []);
      setRawRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading report module data:', err);
      setRawRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModuleData();
  }, [selectedModuleKey]);

  // Available Column Names
  const availableColumns = useMemo(() => {
    if (!rawRecords || rawRecords.length === 0) return [];
    const keysSet = new Set<string>();
    rawRecords.slice(0, 20).forEach(rec => {
      if (rec && typeof rec === 'object') {
        Object.keys(rec).forEach(k => {
          if (!k.startsWith('_') && k !== 'password') keysSet.add(k);
        });
      }
    });
    return Array.from(keysSet);
  }, [rawRecords]);

  // Default to first 8 columns if visibleColumns empty
  useEffect(() => {
    if (availableColumns.length > 0) {
      setVisibleColumns(availableColumns.slice(0, 8));
    } else {
      setVisibleColumns([]);
    }
  }, [availableColumns]);

  // Filtered Records Output
  const filteredRecords = useMemo(() => {
    let list = [...rawRecords];

    // Search query filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(row => {
        return Object.values(row || {}).some(val => 
          val !== null && val !== undefined && String(val).toLowerCase().includes(q)
        );
      });
    }

    // Date Range Filter
    if (dateFrom || dateTo) {
      const fromTime = dateFrom ? new Date(dateFrom).getTime() : 0;
      const toTime = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;

      list = list.filter(row => {
        const rowDateStr = row.date || row.po_date || row.mr_date || row.arrival_date || row.created_at || row.start_date;
        if (!rowDateStr) return true;
        const rowTime = new Date(rowDateStr).getTime();
        if (isNaN(rowTime)) return true;
        return rowTime >= fromTime && rowTime <= toTime;
      });
    }

    // Limit
    if (recordLimit > 0) {
      return list.slice(0, recordLimit);
    }
    return list;
  }, [rawRecords, searchQuery, dateFrom, dateTo, recordLimit]);

  // Reset Filters
  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
    setRecordLimit(100);
    if (availableColumns.length > 0) {
      setVisibleColumns(availableColumns.slice(0, 8));
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredRecords || filteredRecords.length === 0) {
      alert('No records available to export.');
      return;
    }

    const cols = visibleColumns.length > 0 ? visibleColumns : availableColumns;
    const headerRow = cols.join(',');
    const bodyRows = filteredRecords.map(row => 
      cols.map(c => {
        const val = row[c];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headerRow, ...bodyRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeModule.key}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <LegacyLayout title="System Reporting Console" onClose={onClose}>
      <div className="space-y-4 font-sans text-slate-800">

        {/* ================= HEADER BAR ================= */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-green-900 text-white p-4 rounded-2xl shadow-md border border-emerald-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{activeModule.icon}</span>
              <h2 className="text-lg font-black uppercase tracking-wider text-yellow-300">
                System Reporting Console
              </h2>
              <span className="bg-emerald-800/80 text-emerald-200 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-700 font-mono uppercase">
                Dynamic Reporting Workspace
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 mt-1">
              Select module, apply custom criteria, and inspect real-time system database report logs.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={loadModuleData}
              disabled={loading}
              className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl border border-emerald-600 transition flex items-center gap-1.5 shadow-sm"
              title="Reload module dataset"
            >
              <RefreshCcw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 text-emerald-950 text-xs font-black rounded-xl border border-yellow-200 transition flex items-center gap-1.5 shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrintReport}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* ================= MODULE SELECTOR TABS ================= */}
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-900 border border-slate-800 rounded-xl shadow-inner">
          {REPORT_MODULES.map(m => {
            const isActive = selectedModuleKey === m.key;
            return (
              <button
                key={m.key}
                onClick={() => {
                  setSelectedModuleKey(m.key);
                  setSearchQuery('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer",
                  isActive
                    ? "bg-yellow-400 text-slate-950 font-black shadow-md scale-[1.02]"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* ================= FILTER & QUERY TOOLBAR ================= */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            
            {/* Search Filter */}
            <div className="relative">
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                In-Report Search
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by keyword, ID, supplier..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-none font-medium"
                />
              </div>
            </div>

            {/* Date From */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                Start Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-none font-medium"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                End Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-none font-medium"
              />
            </div>

            {/* Limit */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                Row Display Limit
              </label>
              <select
                value={recordLimit}
                onChange={e => setRecordLimit(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-none font-medium"
              >
                <option value={25}>25 Records</option>
                <option value={50}>50 Records</option>
                <option value={100}>100 Records</option>
                <option value={250}>250 Records</option>
                <option value={500}>500 Records</option>
                <option value={0}>All Records (Unlimited)</option>
              </select>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Configure Columns ({visibleColumns.length}/{availableColumns.length})</span>
              </button>

              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-bold transition flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>

            <div className="text-xs font-bold text-slate-500 font-mono">
              Matching Records: <strong className="text-emerald-700 font-black">{filteredRecords.length}</strong> / Total DB: {rawRecords.length}
            </div>
          </div>

          {/* Column Selector Toggle Area */}
          {showColumnSelector && availableColumns.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-700">Toggle Visible Columns</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVisibleColumns([...availableColumns])}
                    className="text-[10px] font-bold text-emerald-700 hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setVisibleColumns(availableColumns.slice(0, 5))}
                    className="text-[10px] font-bold text-slate-500 hover:underline"
                  >
                    Reset Default
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                {availableColumns.map(col => {
                  const isChecked = visibleColumns.includes(col);
                  return (
                    <button
                      key={col}
                      onClick={() => {
                        if (isChecked) {
                          setVisibleColumns(visibleColumns.filter(c => c !== col));
                        } else {
                          setVisibleColumns([...visibleColumns, col]);
                        }
                      }}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-bold rounded-lg border transition",
                        isChecked
                          ? "bg-emerald-700 text-white border-emerald-800"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {col.replace(/_/g, ' ')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ================= REPORT DATA CANVAS / TABLE ================= */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[350px]">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
              <RefreshCcw className="w-8 h-8 animate-spin text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-widest font-mono">
                Querying System Database Records...
              </span>
            </div>
          ) : filteredRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-950 text-white font-black uppercase text-[10px] tracking-wider border-b border-emerald-900">
                    <th className="p-3 w-10 text-center border-r border-emerald-900">#</th>
                    {(visibleColumns.length > 0 ? visibleColumns : availableColumns).map(col => (
                      <th key={col} className="p-3 border-r border-emerald-900/60 whitespace-nowrap">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredRecords.map((row, idx) => (
                    <tr 
                      key={row.id || row.sauda_id || row.po_no || row.mr_no || idx}
                      className="hover:bg-emerald-50/50 transition-colors"
                    >
                      <td className="p-2.5 text-center font-mono text-[10px] text-slate-400 border-r border-slate-100">
                        {idx + 1}
                      </td>
                      {(visibleColumns.length > 0 ? visibleColumns : availableColumns).map(col => {
                        const val = row[col];
                        let displayVal = val !== null && val !== undefined ? String(val) : '-';
                        if (typeof val === 'boolean') {
                          displayVal = val ? 'TRUE' : 'FALSE';
                        }
                        return (
                          <td key={col} className="p-2.5 border-r border-slate-100 max-w-xs truncate whitespace-nowrap font-mono text-[11px]">
                            {displayVal}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* BLANK REPORTING WORKSPACE CANVAS STATE */
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 my-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-3xl shadow-inner">
                {activeModule.icon}
              </div>

              <div className="max-w-md space-y-1">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
                  Blank System Reporting Canvas — {activeModule.label}
                </h3>
                <p className="text-xs text-slate-500">
                  {rawRecords.length === 0
                    ? `No records found in database table "${activeModule.table}". Create new entries in the module or run an import.`
                    : `No records match the active search query or date range filters.`}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {rawRecords.length > 0 && (
                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition"
                  >
                    Clear Search Filters ({rawRecords.length} DB Records)
                  </button>
                )}

                <button
                  onClick={loadModuleData}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Reload Module Data
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================= FOOTER STATUS RIBBON ================= */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900 text-slate-300 rounded-xl text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>SYSTEM REPORTING CONSOLE — ACTIVE WORKSPACE</span>
          </div>
          <span className="text-[10px] text-slate-400">
            Module: <strong className="text-yellow-400">{activeModule.table}</strong> | Columns: {visibleColumns.length}
          </span>
        </div>

      </div>
    </LegacyLayout>
  );
}
