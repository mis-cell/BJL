import React from 'react';
import {
  Database,
  Plus,
  Trash2,
  Edit,
  Download,
  Upload,
  Search,
  Lock,
  RefreshCcw,
  Sparkles,
  Terminal,
  FileSpreadsheet,
  X,
  XCircle
} from 'lucide-react';
import { TableDef } from './adminDeskTypes';
import { AdminDeskSystemLogsView } from './AdminDeskSystemLogsView';

interface AdminDeskClassicLayoutProps {
  useMaterialTheme: boolean;
  setUseMaterialTheme: (val: boolean) => void;
  activeSchemaTab: 'row' | 'column' | 'sql' | 'event_log' | 'reconciliation_log';
  setActiveSchemaTab: (tab: 'row' | 'column' | 'sql' | 'event_log' | 'reconciliation_log') => void;
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
  handleDelete: (pkValue: any) => void;
  handleDeleteColumn: (columnName: string) => void;
  handleAddField: () => void;
  handleCreateTable: () => void;
  handleDropTable: (tableName: string) => void;
  handleCsvImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDatabaseExport: () => void;
  newFieldName: string;
  setNewFieldName: (val: string) => void;
  newFieldType: string;
  setNewFieldType: (val: string) => void;
  newTableName: string;
  setNewTableName: (val: string) => void;
  isExporting: boolean;
  fetchData: () => void;
  reconRecords: any[];
  selectedReconId: string;
  setSelectedReconId: (id: string) => void;
  reconLoading: boolean;
  systemLogs: any[];
  printLogs: any[];
  printQueue: any[];
  logFilter: string;
  setLogFilter: (val: string) => void;
  logType: string;
  setLogType: (val: string) => void;
  logSubTab: 'system' | 'print' | 'queue' | 'sync';
  setLogSubTab: (tab: 'system' | 'print' | 'queue' | 'sync') => void;
  queueModule: 'po' | 'sauda' | 'amad' | 'material_inspection' | 'stock';
  setQueueModule: (val: 'po' | 'sauda' | 'amad' | 'material_inspection' | 'stock') => void;
  queueDocRef: string;
  setQueueDocRef: (val: string) => void;
  queueLoading: boolean;
  queueError: string;
  expandedSyncRow: string | null;
  setExpandedSyncRow: (val: string | null) => void;
  setPrintingItem: (item: any) => void;
  savePrintQueueObj: (queue: any[]) => void;
  handleAddToQueue: () => void;
  handleClearPrintLogs: () => void;
  onClearLogs?: () => void;
  onClose?: () => void;
}

export const AdminDeskClassicLayout: React.FC<AdminDeskClassicLayoutProps> = ({
  useMaterialTheme,
  setUseMaterialTheme,
  activeSchemaTab,
  setActiveSchemaTab,
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
  handleDelete,
  handleDeleteColumn,
  handleAddField,
  handleCreateTable,
  handleDropTable,
  handleCsvImport,
  handleDatabaseExport,
  newFieldName,
  setNewFieldName,
  newFieldType,
  setNewFieldType,
  newTableName,
  setNewTableName,
  isExporting,
  fetchData,
  reconRecords,
  selectedReconId,
  setSelectedReconId,
  reconLoading,
  systemLogs,
  printLogs,
  printQueue,
  logFilter,
  setLogFilter,
  logType,
  setLogType,
  logSubTab,
  setLogSubTab,
  queueModule,
  setQueueModule,
  queueDocRef,
  setQueueDocRef,
  queueLoading,
  queueError,
  expandedSyncRow,
  setExpandedSyncRow,
  setPrintingItem,
  savePrintQueueObj,
  handleAddToQueue,
  handleClearPrintLogs,
  onClearLogs,
  onClose
}) => {
  const filteredData = data.filter((row) =>
    Object.values(row).some((val) =>
      String(val ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="w-full h-full bg-[#dfdfdf] flex flex-col font-sans overflow-hidden text-slate-800">
      {/* Title Bar */}
      <div className="bg-[#000080] text-white px-2 py-1 flex justify-between items-center h-8 shrink-0">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          <span className="text-[11px] font-black uppercase tracking-wider italic">
            System Administration Console - Relational Schema Master
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setUseMaterialTheme(true)}
            className="px-2 py-0.5 bg-[#c0c0c0] hover:bg-slate-300 text-slate-900 border-t-white border-l-white border-b-black border-r-black border text-[9px] font-extrabold uppercase cursor-pointer"
          >
            Material Theme
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-2 py-0.5 bg-[#c0c0c0] hover:bg-rose-600 hover:text-white text-slate-900 border-t-white border-l-white border-b-black border-r-black border text-[9px] font-black cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main App Container */}
      <div className="flex-1 p-3 flex flex-col min-h-0 space-y-3 overflow-hidden">
        {/* Navigation Schema Tabs */}
        <div className="flex border-b-2 border-slate-400 gap-1 bg-[#dfdfdf] shrink-0">
          {[
            { id: "row", label: "Row Data Browser" },
            { id: "column", label: "Schema & Fields" },
            { id: "sql", label: "Table Operations & SQL" },
            { id: "event_log", label: "System & Print Logs" },
            { id: "reconciliation_log", label: "Reconciliation Audit" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSchemaTab(tab.id as any)}
              className={`px-4 py-1.5 text-xs font-black uppercase border-t-2 border-l-2 border-r-2 cursor-pointer transition-all ${
                activeSchemaTab === tab.id
                  ? "bg-[#E8E6E1] border-t-white border-l-white border-r-slate-800 text-indigo-950 -mb-[2px] pb-2 z-10"
                  : "bg-[#c0c0c0] border-t-slate-100 border-l-slate-100 border-r-slate-600 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 bg-[#E8E6E1] border-t-white border-l-white border-b-slate-800 border-r-slate-800 border-2 p-3 flex flex-col min-h-0 overflow-hidden shadow-inner">
          {activeSchemaTab === "row" && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              {/* Controls Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#dfdfdf] p-2 border-t-white border-l-white border-b-slate-700 border-r-slate-700 border">
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
                    className="px-2 py-1 bg-[#c0c0c0] hover:bg-slate-200 border-t-white border-l-white border-b-black border-r-black border text-xs font-bold cursor-pointer"
                  >
                    <RefreshCcw className="h-3.5 w-3.5 inline mr-1" />
                    Refresh
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!selectedTable) return;
                      const emptyRow: any = {};
                      editorColumns.forEach((c) => (emptyRow[c] = ""));
                      setEditingRow(emptyRow);
                    }}
                    className="px-3 py-1 bg-[#000080] text-white font-black text-xs border-t-blue-400 border-l-blue-400 border-b-blue-950 border-r-blue-950 border cursor-pointer hover:bg-blue-900"
                  >
                    <Plus className="h-3.5 w-3.5 inline mr-1" />
                    New Record
                  </button>
                  <button
                    onClick={handleDatabaseExport}
                    disabled={isExporting}
                    className="px-3 py-1 bg-emerald-700 text-white font-black text-xs border-t-emerald-400 border-l-emerald-400 border-b-emerald-950 border-r-emerald-950 border cursor-pointer hover:bg-emerald-800 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5 inline mr-1" />
                    {isExporting ? "Exporting..." : "Export All DB"}
                  </button>
                  <label className="px-3 py-1 bg-indigo-700 text-white font-black text-xs border-t-indigo-400 border-l-indigo-400 border-b-indigo-950 border-r-indigo-950 border cursor-pointer hover:bg-indigo-800">
                    <Upload className="h-3.5 w-3.5 inline mr-1" />
                    Import CSV
                    <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 bg-white border-t-slate-800 border-l-slate-800 border-b-white border-r-white border-2 overflow-auto font-mono">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#000080] text-white sticky top-0 font-sans text-[11px] font-black uppercase tracking-wider">
                    <tr>
                      <th className="p-2 text-center w-20 border-r border-blue-900">Actions</th>
                      {currentColumns.map((col) => (
                        <th key={col.name} className="p-2 border-r border-blue-900 whitespace-nowrap">
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {loading ? (
                      <tr>
                        <td colSpan={currentColumns.length + 1} className="p-8 text-center text-slate-500 font-sans italic">
                          Querying table records...
                        </td>
                      </tr>
                    ) : filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={currentColumns.length + 1} className="p-8 text-center text-slate-500 font-sans italic">
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
                                onClick={() => setEditingRow(row)}
                                className="px-1.5 py-0.5 bg-[#c0c0c0] hover:bg-slate-300 text-slate-900 text-[10px] font-bold border border-slate-600 mr-1 cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(pkVal)}
                                className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold border border-rose-900 cursor-pointer"
                              >
                                Del
                              </button>
                            </td>
                            {currentColumns.map((col) => (
                              <td key={col.name} className="p-1.5 border-r border-slate-200 max-w-xs truncate">
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
          )}

          {activeSchemaTab === "column" && (
            <div className="flex-1 flex flex-col space-y-4 font-sans">
              <div className="bg-[#dfdfdf] p-3 border-t-white border-l-white border-b-slate-700 border-r-slate-700 border">
                <h3 className="text-xs font-black uppercase text-indigo-950 mb-2">Add New Column to {selectedTable?.name}</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="Field Name..."
                    className="bg-white border border-slate-400 p-1.5 text-xs font-bold outline-none"
                  />
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value)}
                    className="bg-white border border-slate-400 p-1.5 text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="TEXT">TEXT</option>
                    <option value="NUMERIC">NUMERIC</option>
                    <option value="INTEGER">INTEGER</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                    <option value="DATE">DATE</option>
                    <option value="TIMESTAMP">TIMESTAMP</option>
                  </select>
                  <button
                    onClick={handleAddField}
                    className="px-3 py-1.5 bg-[#000080] text-white font-black text-xs border cursor-pointer hover:bg-blue-900"
                  >
                    Add Column
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-white border-2 border-slate-600 overflow-auto p-3">
                <h4 className="text-xs font-black uppercase text-slate-800 mb-2">Existing Column Schema</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-mono">
                  {currentColumns.map((col) => (
                    <div key={col.name} className="bg-slate-100 p-2 border border-slate-300 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-extrabold text-slate-900 block">{col.name}</span>
                        <span className="text-[10px] text-indigo-700 font-bold uppercase">{col.type}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteColumn(col.name)}
                        className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold cursor-pointer hover:bg-rose-700"
                      >
                        Drop
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSchemaTab === "sql" && (
            <div className="flex-1 flex flex-col space-y-4 font-sans">
              <div className="bg-[#dfdfdf] p-3 border-t-white border-l-white border-b-slate-700 border-r-slate-700 border">
                <h3 className="text-xs font-black uppercase text-indigo-950 mb-2">Create New Table</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="table_name..."
                    className="bg-white border border-slate-400 p-1.5 text-xs font-bold outline-none"
                  />
                  <button
                    onClick={handleCreateTable}
                    className="px-3 py-1.5 bg-[#000080] text-white font-black text-xs border cursor-pointer hover:bg-blue-900"
                  >
                    Deploy Table
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-white border-2 border-slate-600 overflow-auto p-3 space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-800">Deployed Tables Registry</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-mono">
                  {tables.map((t) => (
                    <div key={t.name} className="bg-slate-100 p-2 border border-slate-300 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-extrabold text-slate-900 block">{t.label}</span>
                        <span className="text-[10px] text-slate-500">{t.name}</span>
                      </div>
                      <button
                        onClick={() => handleDropTable(t.name)}
                        className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold cursor-pointer hover:bg-rose-700"
                      >
                        Drop Table
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSchemaTab === "event_log" && (
            <AdminDeskSystemLogsView
              systemLogs={systemLogs}
              printLogs={printLogs}
              printQueue={printQueue}
              logFilter={logFilter}
              setLogFilter={setLogFilter}
              logType={logType}
              setLogType={setLogType}
              logSubTab={logSubTab}
              setLogSubTab={setLogSubTab}
              queueModule={queueModule}
              setQueueModule={setQueueModule}
              queueDocRef={queueDocRef}
              setQueueDocRef={setQueueDocRef}
              queueLoading={queueLoading}
              queueError={queueError}
              expandedSyncRow={expandedSyncRow}
              setExpandedSyncRow={setExpandedSyncRow}
              setPrintingItem={setPrintingItem}
              savePrintQueueObj={savePrintQueueObj}
              handleAddToQueue={handleAddToQueue}
              handleClearPrintLogs={handleClearPrintLogs}
              onClearLogs={onClearLogs}
            />
          )}

          {activeSchemaTab === "reconciliation_log" && (
            <div className="flex-1 flex flex-col space-y-3 font-sans">
              <div className="bg-[#dfdfdf] p-3 border-t-white border-l-white border-b-slate-700 border-r-slate-700 border">
                <h3 className="text-xs font-black uppercase text-indigo-950">Reconciliation Audit Log</h3>
              </div>
              <div className="flex-1 bg-white border-2 border-slate-600 p-4 overflow-auto">
                {reconLoading ? (
                  <p className="text-xs text-slate-500 font-mono">Loading reconciliation records...</p>
                ) : reconRecords.length === 0 ? (
                  <p className="text-xs text-slate-400 font-mono italic">No reconciliation entries found.</p>
                ) : (
                  <div className="space-y-2 font-mono text-xs">
                    {reconRecords.map((r, idx) => (
                      <div key={r.id || idx} className="p-2 bg-slate-50 border border-slate-200 rounded">
                        <span className="font-bold text-slate-800">{r.po_no || r.final_arrival_no || r.id}</span>
                        <pre className="text-[10px] text-slate-600 mt-1">{JSON.stringify(r, null, 2)}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
