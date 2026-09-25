import React from 'react';
import {
  Monitor,
  Layout,
  Database,
  Terminal,
  Search,
  Plus,
  Trash2,
  Edit,
  Download,
  Upload,
  RefreshCcw,
  Sparkles,
  Lock,
  ChevronLeft
} from 'lucide-react';
import DashboardTab from '../material/DashboardTab';
import DatabaseTab from '../material/DatabaseTab';
import EmailActivityTab from '../material/EmailActivityTab';
import ExtraPagesTab from '../material/ExtraPagesTab';
import FormsChartsTab from '../material/FormsChartsTab';
import SMTPDiagnosticTab from '../material/SMTPDiagnosticTab';
import UIElementsTab from '../material/UIElementsTab';
import { TableDef } from './adminDeskTypes';
import { AdminDeskSystemLogsView } from './AdminDeskSystemLogsView';

interface AdminDeskMaterialLayoutProps {
  useMaterialTheme: boolean;
  setUseMaterialTheme: (val: boolean) => void;
  activeMaterialPage: string;
  setActiveMaterialPage: (page: string) => void;
  tables: TableDef[];
  selectedTable: TableDef | null;
  setSelectedTable: (table: TableDef | null) => void;
  data: any[];
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  currentColumns: Array<{ name: string; type: string }>;
  editorColumns: string[];
  purchaseOrders: any[];
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

export const AdminDeskMaterialLayout: React.FC<AdminDeskMaterialLayoutProps> = ({
  useMaterialTheme,
  setUseMaterialTheme,
  activeMaterialPage,
  setActiveMaterialPage,
  tables,
  selectedTable,
  setSelectedTable,
  data,
  loading,
  searchTerm,
  setSearchTerm,
  currentColumns,
  editorColumns,
  purchaseOrders,
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
    <div className="flex h-screen bg-[#F4F6F9] font-sans overflow-hidden text-slate-800">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-[#1E2022] text-slate-300 flex flex-col shrink-0 border-r border-slate-800 shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-md">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white tracking-wider font-display">SYSTEM DESK</h2>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Admin Control</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              title="Return to Application"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Primary Console</span>
            
            <button
              onClick={() => setActiveMaterialPage("db_console")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMaterialPage === "db_console"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Database className="h-4 w-4" />
              <span>Database Console</span>
            </button>

            <button
              onClick={() => setActiveMaterialPage("event_log")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMaterialPage === "event_log"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Terminal className="h-4 w-4" />
              <span>Event & Print Logs</span>
            </button>
          </div>

          <div className="space-y-1">
            <span className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Material Features</span>
            
            <button
              onClick={() => setActiveMaterialPage("dashboard")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMaterialPage === "dashboard"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Layout className="h-4 w-4" />
              <span>Executive Dashboard</span>
            </button>

            <button
              onClick={() => setActiveMaterialPage("e_commerce")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMaterialPage === "e_commerce"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Database className="h-4 w-4" />
              <span>E-Commerce Ledger</span>
            </button>

            <button
              onClick={() => setActiveMaterialPage("ui_elements")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMaterialPage === "ui_elements"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Layout className="h-4 w-4" />
              <span>UI Components Matrix</span>
            </button>

            <button
              onClick={() => setActiveMaterialPage("forms")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMaterialPage === "forms"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Layout className="h-4 w-4" />
              <span>Forms & Analytics</span>
            </button>

            <button
              onClick={() => setActiveMaterialPage("extra_pages")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMaterialPage === "extra_pages"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Layout className="h-4 w-4" />
              <span>Extra Pages Suite</span>
            </button>
          </div>
        </div>

        {/* Theme Switcher Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#17191A]">
          <button
            onClick={() => setUseMaterialTheme(false)}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold text-[10px] uppercase tracking-widest rounded-lg border border-slate-700 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Switch to Win95 Classic</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-black uppercase text-slate-800 tracking-wider font-display">
              {activeMaterialPage.replace(/_/g, " ")}
            </h1>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Exit Admin</span>
            </button>
          )}
        </div>

        {/* Dynamic Page Rendering */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeMaterialPage === "dashboard" && <DashboardTab />}
          {(activeMaterialPage === "e_commerce" || activeMaterialPage === "documentation") && (
            <DatabaseTab
              tables={tables}
              selectedTable={selectedTable}
              setSelectedTable={setSelectedTable}
              data={data}
              loading={loading}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              setEditingRow={setEditingRow}
              activeSchemaTab="row"
              setActiveSchemaTab={() => {}}
              sqlQuery=""
              setSqlQuery={() => {}}
              sqlResult={null}
              sqlExecuting={false}
              runSqlQuery={() => {}}
              currentColumns={currentColumns}
              handleDelete={handleDelete}
              handleDeleteColumn={handleDeleteColumn}
              newFieldName={newFieldName}
              setNewFieldName={setNewFieldName}
              newFieldType={newFieldType}
              setNewFieldType={setNewFieldType}
              handleAddField={handleAddField}
              newTableName={newTableName}
              setNewTableName={setNewTableName}
              handleCreateTable={handleCreateTable}
              handleDropTable={handleDropTable}
              initializeDatabase={() => {}}
              confirmDeleteTable={null}
              setConfirmDeleteTable={() => {}}
              handleCsvImport={handleCsvImport}
              onDatabaseExport={handleDatabaseExport}
              isExporting={isExporting}
            />
          )}
          {activeMaterialPage === "ui_elements" && <UIElementsTab />}
          {activeMaterialPage === "forms" && <FormsChartsTab />}
          {activeMaterialPage === "extra_pages" && <ExtraPagesTab purchaseOrders={purchaseOrders} />}
          
          {activeMaterialPage === "db_console" && (
            <div className="space-y-6">
              {/* Table Selector Bar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Target Table:</span>
                  <select
                    value={selectedTable?.name || ""}
                    onChange={(e) => {
                      const t = tables.find((x) => x.name === e.target.value);
                      if (t) setSelectedTable(t);
                    }}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-extrabold text-slate-800 outline-none cursor-pointer"
                  >
                    {tables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.label} ({t.name})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={fetchData}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
                    title="Refresh Table Records"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      if (!selectedTable) return;
                      const emptyRow: any = {};
                      editorColumns.forEach((c) => (emptyRow[c] = ""));
                      setEditingRow(emptyRow);
                    }}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Row</span>
                  </button>

                  <button
                    onClick={handleDatabaseExport}
                    disabled={isExporting}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    <span>{isExporting ? "Exporting..." : "Export All DB"}</span>
                  </button>

                  <label className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <span>Import CSV</span>
                    <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Records Data Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="relative flex items-center bg-white border border-slate-300 rounded-lg px-3 py-1.5 w-64 text-xs">
                    <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search records in view..."
                      className="bg-transparent border-none outline-none text-slate-800 w-full font-semibold placeholder:text-slate-400"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-500 font-mono">
                    Showing {filteredData.length} of {data.length} records
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-center w-24">Actions</th>
                        {currentColumns.map((col) => (
                          <th key={col.name} className="p-3 border-l border-slate-200 whitespace-nowrap">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700">
                      {loading ? (
                        <tr>
                          <td colSpan={currentColumns.length + 1} className="p-12 text-center text-slate-400 font-sans italic">
                            Loading database records...
                          </td>
                        </tr>
                      ) : filteredData.length === 0 ? (
                        <tr>
                          <td colSpan={currentColumns.length + 1} className="p-12 text-center text-slate-400 font-sans italic">
                            No records found matching query in {selectedTable?.name}.
                          </td>
                        </tr>
                      ) : (
                        filteredData.map((row, idx) => {
                          const pkVal = selectedTable ? row[selectedTable.pk] : idx;
                          return (
                            <tr key={pkVal || idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setEditingRow(row)}
                                    className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                                    title="Edit Row"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(pkVal)}
                                    className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                    title="Delete Row"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                              {currentColumns.map((col) => (
                                <td key={col.name} className="p-2.5 border-l border-slate-100 max-w-xs truncate font-medium">
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

          {activeMaterialPage === "email_activity" && <EmailActivityTab />}
          {activeMaterialPage === "smtp_diagnostic" && <SMTPDiagnosticTab />}

          {activeMaterialPage === "event_log" && (
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
        </div>
      </div>
    </div>
  );
};
