import React, { useState } from 'react';
import {
  Database,
  Plus,
  Trash2,
  Edit,
  Download,
  Upload,
  Search,
  RefreshCcw,
  X,
  Scale,
  DollarSign,
  Layers
} from 'lucide-react';
import { TableDef } from './adminDeskTypes';
import { TolerancePolicyManager } from './TolerancePolicyManager';
import { DeductionMasterManager } from './DeductionMasterManager';
import { cn } from '../../lib/utils';

interface AdminDeskClassicLayoutProps {
  tables: TableDef[];
  selectedTable: TableDef | null;
  setSelectedTable: (table: TableDef | null) => void;
  data: any[];
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  currentColumns: Array<{ name: string; type: string }>;
  editorColumns: string[];
  setEditingRow: (row: any) => void;
  setIsNewRow?: (val: boolean) => void;
  handleDelete: (pkValue: any) => void;
  handleCsvImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDatabaseExport: () => void;
  isExporting: boolean;
  fetchData: () => void;
  onClose?: () => void;
}

export const AdminDeskClassicLayout: React.FC<AdminDeskClassicLayoutProps> = ({
  tables,
  selectedTable,
  setSelectedTable,
  data,
  loading,
  searchTerm,
  setSearchTerm,
  currentColumns,
  editorColumns,
  setEditingRow,
  setIsNewRow,
  handleDelete,
  handleCsvImport,
  handleDatabaseExport,
  isExporting,
  fetchData,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'browser' | 'tolerance_policy' | 'deduction_master'>('browser');

  const filteredData = data.filter((row) =>
    Object.values(row).some((val) =>
      String(val ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="w-full h-full bg-[#dfdfdf] flex flex-col font-sans overflow-hidden text-slate-800">
      {/* Title Bar */}
      <div className="bg-[#000080] text-white px-3 py-1 flex justify-between items-center h-8 shrink-0 shadow-xs">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-white" />
          <span className="text-[11px] font-black uppercase tracking-wider italic">
            System Administration Console - Relational Schema &amp; Business Policy Desk
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-2 py-0.5 bg-[#c0c0c0] hover:bg-rose-600 hover:text-white text-slate-900 border-t-white border-l-white border-b-black border-r-black border text-[10px] font-black cursor-pointer transition-colors"
            title="Close Admin Console"
          >
            ✕
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 p-3 flex flex-col min-h-0 space-y-2 overflow-hidden bg-[#dfdfdf]">
        {/* Navigation Tabs */}
        <div className="flex border-b-2 border-slate-400 gap-1 bg-[#dfdfdf] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('browser')}
            className={cn(
              "px-4 py-1.5 text-xs font-black uppercase border-t-2 border-l-2 border-r-2 -mb-[2px] pb-2 z-10 shadow-xs cursor-pointer transition-colors flex items-center gap-1.5",
              activeTab === 'browser'
                ? "bg-[#E8E6E1] border-t-white border-l-white border-r-slate-800 text-indigo-950 font-black"
                : "bg-[#d0d0d0] hover:bg-[#dedede] border-t-slate-200 border-l-slate-200 border-r-slate-500 text-slate-700"
            )}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Row Data Browser</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tolerance_policy')}
            className={cn(
              "px-4 py-1.5 text-xs font-black uppercase border-t-2 border-l-2 border-r-2 -mb-[2px] pb-2 z-10 shadow-xs cursor-pointer transition-colors flex items-center gap-1.5",
              activeTab === 'tolerance_policy'
                ? "bg-[#f4f2ed] border-t-white border-l-white border-r-slate-800 text-indigo-900 font-black"
                : "bg-[#d0d0d0] hover:bg-[#dedede] border-t-slate-200 border-l-slate-200 border-r-slate-500 text-slate-700"
            )}
          >
            <Scale className="w-3.5 h-3.5 text-indigo-600" />
            <span>⚖️ Tolerance Policy Master</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('deduction_master')}
            className={cn(
              "px-4 py-1.5 text-xs font-black uppercase border-t-2 border-l-2 border-r-2 -mb-[2px] pb-2 z-10 shadow-xs cursor-pointer transition-colors flex items-center gap-1.5",
              activeTab === 'deduction_master'
                ? "bg-[#f4f2ed] border-t-white border-l-white border-r-slate-800 text-emerald-900 font-black"
                : "bg-[#d0d0d0] hover:bg-[#dedede] border-t-slate-200 border-l-slate-200 border-r-slate-500 text-slate-700"
            )}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span>💰 Deduction Master (Supabase)</span>
          </button>
        </div>

        {/* Tab 1: Tolerance Policy Master */}
        {activeTab === 'tolerance_policy' && (
          <div className="flex-1 bg-[#f4f2ed] border-t-white border-l-white border-b-slate-800 border-r-slate-800 border-2 p-1 flex flex-col min-h-0 overflow-hidden shadow-inner">
            <TolerancePolicyManager />
          </div>
        )}

        {/* Tab 2: Deduction Master */}
        {activeTab === 'deduction_master' && (
          <div className="flex-1 bg-[#f4f2ed] border-t-white border-l-white border-b-slate-800 border-r-slate-800 border-2 p-1 flex flex-col min-h-0 overflow-hidden shadow-inner">
            <DeductionMasterManager />
          </div>
        )}

        {/* Tab 3: Default Row Data Browser */}
        {activeTab === 'browser' && (
          <div className="flex-1 bg-[#E8E6E1] border-t-white border-l-white border-b-slate-800 border-r-slate-800 border-2 p-3 flex flex-col min-h-0 overflow-hidden shadow-inner">
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              {/* Controls Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#dfdfdf] p-2 border-t-white border-l-white border-b-slate-700 border-r-slate-700 border">
                {/* Left Controls: Select Table & Refresh */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-700">Select Table:</span>
                  <select
                    value={selectedTable?.name || ""}
                    onChange={(e) => {
                      const t = tables.find((x) => x.name === e.target.value);
                      if (t) setSelectedTable(t);
                    }}
                    className="bg-white border border-slate-400 p-1 text-xs font-bold outline-none cursor-pointer"
                  >
                    {tables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.label} ({t.name})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={fetchData}
                    className="px-2.5 py-1 bg-[#c0c0c0] hover:bg-slate-200 border-t-white border-l-white border-b-black border-r-black border text-xs font-bold cursor-pointer transition-colors"
                  >
                    <RefreshCcw className="h-3.5 w-3.5 inline mr-1" />
                    Refresh
                  </button>
                </div>

                {/* Right Controls: Search, New Record, Export, Import */}
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center bg-white border border-slate-400 px-2 py-0.5 text-xs">
                    <Search className="h-3.5 w-3.5 text-slate-500 mr-1 shrink-0" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search records..."
                      className="bg-transparent border-none outline-none text-slate-900 w-36 font-semibold"
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (!selectedTable) return;
                      const emptyRow: any = {};
                      editorColumns.forEach((c) => (emptyRow[c] = ""));
                      if (setIsNewRow) setIsNewRow(true);
                      setEditingRow(emptyRow);
                    }}
                    className="px-3 py-1 bg-[#000080] text-white font-black text-xs border-t-blue-400 border-l-blue-400 border-b-blue-950 border-r-blue-950 border cursor-pointer hover:bg-blue-900 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 inline mr-1" />
                    + New Record
                  </button>

                  <button
                    onClick={handleDatabaseExport}
                    disabled={isExporting}
                    className="px-3 py-1 bg-emerald-700 text-white font-black text-xs border-t-emerald-400 border-l-emerald-400 border-b-emerald-950 border-r-emerald-950 border cursor-pointer hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 inline mr-1" />
                    {isExporting ? "Exporting..." : "Export All DB"}
                  </button>

                  <label className="px-3 py-1 bg-indigo-700 text-white font-black text-xs border-t-indigo-400 border-l-indigo-400 border-b-indigo-950 border-r-indigo-950 border cursor-pointer hover:bg-indigo-800 transition-colors">
                    <Upload className="h-3.5 w-3.5 inline mr-1" />
                    Import CSV
                    <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 bg-white border-t-slate-800 border-l-slate-800 border-b-white border-r-white border-2 overflow-auto font-mono">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#000080] text-white sticky top-0 font-sans text-[11px] font-black uppercase tracking-wider shadow-xs">
                    <tr>
                      <th className="p-2 text-center w-20 border-r border-blue-900">ACTIONS</th>
                      {currentColumns.map((col) => (
                        <th key={col.name} className="p-2 border-r border-blue-900 whitespace-nowrap">
                          {col.name.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {loading ? (
                      <tr>
                        <td colSpan={currentColumns.length + 1} className="p-8 text-center text-slate-500 font-sans italic font-bold">
                          Querying table records...
                        </td>
                      </tr>
                    ) : filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={currentColumns.length + 1} className="p-8 text-center text-slate-500 font-sans italic font-bold">
                          No records found in table {selectedTable?.name}.
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((row, idx) => {
                        const pkVal = selectedTable ? row[selectedTable.pk] : idx;
                        return (
                          <tr key={pkVal || idx} className="hover:bg-blue-50/50 transition-colors">
                            <td className="p-1.5 text-center whitespace-nowrap border-r border-slate-200 font-sans">
                              <button
                                onClick={() => {
                                  if (setIsNewRow) setIsNewRow(false);
                                  setEditingRow(row);
                                }}
                                className="px-2 py-0.5 bg-[#c0c0c0] hover:bg-slate-300 text-slate-900 text-[10px] font-bold border border-slate-600 mr-1 cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(pkVal)}
                                className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold border border-rose-900 cursor-pointer hover:bg-rose-700"
                              >
                                Del
                              </button>
                            </td>
                            {currentColumns.map((col) => (
                              <td key={col.name} className="p-1.5 border-r border-slate-200 max-w-xs truncate font-medium text-slate-800">
                                {typeof row[col.name] === "object"
                                  ? JSON.stringify(row[col.name])
                                  : String(row[col.name] ?? "")}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

