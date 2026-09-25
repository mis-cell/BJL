import React from 'react';
import { Search, Terminal, Printer, Trash2, CheckCircle2 } from 'lucide-react';
import { PrintLogEntry, PrintQueueItem, LogEntry } from './adminDeskTypes';

interface AdminDeskSystemLogsViewProps {
  systemLogs: LogEntry[];
  printLogs: PrintLogEntry[];
  printQueue: PrintQueueItem[];
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
  savePrintQueueObj: (queue: PrintQueueItem[]) => void;
  handleAddToQueue: () => void;
  handleClearPrintLogs: () => void;
  onClearLogs?: () => void;
}

export const AdminDeskSystemLogsView: React.FC<AdminDeskSystemLogsViewProps> = ({
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
  onClearLogs
}) => {
  const filteredLogs = systemLogs.filter(log => {
    const matchesSearch = 
      log.details.toLowerCase().includes(logFilter.toLowerCase()) ||
      log.event.toLowerCase().includes(logFilter.toLowerCase()) ||
      log.currentPage.toLowerCase().includes(logFilter.toLowerCase());
    
    const matchesType = logType === "ALL" || log.event === logType;
    return matchesSearch && matchesType;
  });

  const filteredPrintLogs = printLogs.filter((log) => {
    if (log.details && log.details.startsWith("[AUTO-SYNC ENGINE]")) {
      return false;
    }
    const query = logFilter.toLowerCase();
    return (
      log.user_id.toLowerCase().includes(query) ||
      log.details.toLowerCase().includes(query) ||
      (log.row_ids && log.row_ids.some((id: string) => id.toLowerCase().includes(query)))
    );
  });

  const syncLogsParsed = printLogs
    .filter((log) => log.details && log.details.trim().startsWith("[AUTO-SYNC ENGINE]"))
    .map((log) => {
      const detailsStr = log.details || "";
      const parts = detailsStr.split("|");
      
      let finalArrivalNo = "N/A";
      let mrNo = "N/A";
      let originalState: any = null;
      let updatedState: any = null;

      parts.forEach((p: string) => {
        const trimmed = p.trim();
        if (trimmed.startsWith("[AUTO-SYNC ENGINE] MATCH:")) {
          finalArrivalNo = trimmed.replace("[AUTO-SYNC ENGINE] MATCH:", "").trim();
        } else if (trimmed.startsWith("MR:")) {
          mrNo = trimmed.replace("MR:", "").trim();
        } else if (trimmed.startsWith("ORIGINAL:")) {
          try { originalState = JSON.parse(trimmed.replace("ORIGINAL:", "").trim()); } catch (e) {}
        } else if (trimmed.startsWith("UPDATED:")) {
          try { updatedState = JSON.parse(trimmed.replace("UPDATED:", "").trim()); } catch (e) {}
        }
      });

      if (finalArrivalNo === "N/A") {
        const matchArrival = detailsStr.match(/MATCH:\s*([A-Za-z0-9\-\/]+)/) || detailsStr.match(/arrival\s*#([A-Za-z0-9\-\/]+)/);
        if (matchArrival) finalArrivalNo = matchArrival[1];
      }
      if (mrNo === "N/A") {
        const matchMR = detailsStr.match(/MR:\s*([A-Za-z0-9\-\/]+)/) || detailsStr.match(/inspection\s*MR:\s*([A-Za-z0-9\-\/]+)/);
        if (matchMR) mrNo = matchMR[1];
      }

      return {
        id: log.id,
        timestamp: log.timestamp,
        user_id: log.user_id,
        finalArrivalNo,
        mrNo,
        originalState,
        updatedState,
        rawDetails: detailsStr
      };
    });

  const filteredSyncLogs = syncLogsParsed.filter((log) => {
    const query = logFilter.toLowerCase();
    return (
      log.finalArrivalNo.toLowerCase().includes(query) ||
      log.mrNo.toLowerCase().includes(query) ||
      log.user_id.toLowerCase().includes(query) ||
      log.rawDetails.toLowerCase().includes(query)
    );
  });

  const eventTypes = ["ALL", "SYSTEM_BOOT", "NAVIGATION", "TASK_STARTED", "MINIMIZE", "RESTORE", "PAGE_CLOSE", "SYSTEM_DEPART"];

  const uniqueMrNos = new Set<string>();
  printLogs.forEach(l => {
    if (l.details && l.details.trim().startsWith("[AUTO-SYNC ENGINE]")) return;
    if (Array.isArray(l.row_ids)) {
      l.row_ids.forEach((id: string) => uniqueMrNos.add(id));
    }
  });

  return (
    <div className="space-y-4 font-sans text-slate-800">
      {/* Sub-tab selection */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300">
        <button
          onClick={() => setLogSubTab("system")}
          className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            logSubTab === "system"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/10"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          💻 System activity debugger
        </button>
        <button
          onClick={() => setLogSubTab("print")}
          className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            logSubTab === "print"
              ? "border-emerald-600 text-emerald-600 bg-emerald-50/10"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          🖨️ Inspection print audit logs
        </button>
        <button
          onClick={() => setLogSubTab("sync")}
          className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            logSubTab === "sync"
              ? "border-amber-600 text-amber-600 bg-amber-100/10"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          🔄 Auto-Sync Operations Audit
        </button>
        <button
          onClick={() => setLogSubTab("queue")}
          className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            logSubTab === "queue"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/10"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          📋 Central Print Queue
        </button>
      </div>

      {/* Logs Control Panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className={`p-2 rounded-lg ${
            logSubTab === "system" 
              ? "bg-indigo-50 text-indigo-600" 
              : logSubTab === "print" 
                ? "bg-emerald-50 text-emerald-600" 
                : logSubTab === "sync"
                  ? "bg-amber-50 text-amber-600"
                  : "bg-pink-50 text-[#ec407a]"
          }`}>
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">
              {logSubTab === "system" 
                ? "System Activity Event Debugger" 
                : logSubTab === "print" 
                  ? "Material Quality Print Audit Registry" 
                  : logSubTab === "sync"
                    ? "DAEMON SUMMARY: Auto-Sync status verification ledger"
                    : "Centralized Jute Mill Document Print Queue"}
            </h4>
            <p className="text-[10px] text-slate-400 font-medium">
              {logSubTab === "system" 
                ? "Track and monitor interface states, workspace tasks, and taskbar events" 
                : logSubTab === "print"
                  ? "Authorized legal printed transaction log tracking; auditing print counts, target rows, and operational operator IDs"
                  : logSubTab === "sync"
                    ? "Traceability logs recording automatic cross-references between pending unclubbed arrivals and finalized quality inspections"
                    : "Queued documents stored for printing, allowing quick re-printing or purging without re-opening individual modules"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {logSubTab !== "queue" && (
            <div className="relative flex items-center bg-slate-50 border border-slate-200 px-2.5 py-1.5 w-full sm:w-48 text-xs rounded-lg">
              <Search className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
              <input
                type="text"
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                placeholder="Search logs..."
                className="bg-transparent border-none outline-none text-slate-700 w-full placeholder:text-slate-400 font-semibold"
              />
            </div>
          )}

          {logSubTab === "queue" && (
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto font-sans">
              <select
                value={queueModule}
                onChange={(e) => setQueueModule(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-slate-600 outline-none w-full sm:w-auto cursor-pointer"
              >
                <option value="po">P.O Contract</option>
                <option value="sauda">Sauda Agreement</option>
                <option value="amad">AMAD Entry</option>
                <option value="material_inspection">Inspection Report</option>
                <option value="stock">Stock Inventory</option>
              </select>

              <div className="relative flex items-center bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs rounded-lg w-full sm:w-44">
                <input
                  type="text"
                  value={queueDocRef}
                  onChange={(e) => setQueueDocRef(e.target.value)}
                  placeholder="Enter No/Ref..."
                  className="bg-transparent border-none outline-none text-slate-700 w-full font-extrabold placeholder:text-slate-400 uppercase font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddToQueue();
                  }}
                />
              </div>

              <button
                onClick={handleAddToQueue}
                disabled={queueLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] px-4 py-2 rounded-lg transition-all uppercase tracking-wider disabled:opacity-50 w-full sm:w-auto cursor-pointer whitespace-nowrap"
              >
                {queueLoading ? "Finding..." : "Queue Doc"}
              </button>
            </div>
          )}

          {logSubTab === "system" && (
            <select
              value={logType}
              onChange={(e) => setLogType(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-slate-600 outline-none cursor-pointer"
            >
              {eventTypes.map(t => (
                <option key={t} value={t}>{t === "ALL" ? "All Event Types" : t.replace(/_/g, " ")}</option>
              ))}
            </select>
          )}

          {logSubTab === "print" && (
            <button
              onClick={handleClearPrintLogs}
              className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-extrabold text-[10px] px-3.5 py-1.5 rounded-lg transition-all uppercase tracking-wider cursor-pointer font-sans"
            >
              Clear Audit Trail
            </button>
          )}

          {logSubTab === "system" && onClearLogs && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to purge the event log trace buffer?")) {
                  onClearLogs();
                }
              }}
              className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-extrabold text-[10px] px-3.5 py-1.5 rounded-lg transition-all uppercase tracking-wider cursor-pointer font-sans"
            >
              Clear Log Buffer
            </button>
          )}
        </div>
      </div>

      {logSubTab === "system" ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Trace Volume</span>
              <span className="text-base font-black text-slate-800 font-mono mt-0.5 block">{systemLogs.length} events</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Filtered Volume</span>
              <span className="text-base font-black text-indigo-600 font-mono mt-0.5 block">{filteredLogs.length} events</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Current Page State</span>
              <span className="text-xs font-mono font-black text-slate-700 block mt-1 truncate uppercase bg-slate-50 px-2.5 py-0.5 border border-slate-200 rounded max-w-full">{systemLogs[0]?.currentPage || "dashboard"}</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Active Tasks State</span>
              <span className="text-[10px] font-mono font-black text-emerald-600 block mt-1 truncate max-w-full">
                {systemLogs[0]?.runningPages?.join(", ") || "(none)"}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3 w-1/12 text-center">Timestamp</th>
                    <th className="p-3 w-2/12">Event Tag</th>
                    <th className="p-3 w-5/12">Execution Detail Trace</th>
                    <th className="p-3 w-2/12 text-center">Screen State</th>
                    <th className="p-3 w-2/12">Running Pages State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[10px] text-slate-700">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-sans italic">
                        No system events captured matching the specified filters. Try selecting "All Event Types" or typing other words.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";
                      if (log.event === "SYSTEM_BOOT") badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                      else if (log.event === "NAVIGATION") badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
                      else if (log.event === "TASK_STARTED") badgeClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
                      else if (log.event === "MINIMIZE") badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                      else if (log.event === "RESTORE") badgeClass = "bg-cyan-50 text-cyan-700 border-cyan-200";
                      else if (log.event === "PAGE_CLOSE") badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                      else if (log.event === "SYSTEM_DEPART") badgeClass = "bg-orange-50 text-orange-700 border-orange-200";

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/60 font-semibold transition-colors">
                          <td className="p-2.5 text-center text-slate-400 font-mono whitespace-nowrap text-[9px] border-r border-slate-100">
                            {log.timestamp}
                          </td>
                          <td className="p-2.5 whitespace-nowrap border-r border-slate-100">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-wider ${badgeClass}`}>
                              {log.event}
                            </span>
                          </td>
                          <td className="p-2.5 font-sans font-semibold text-slate-800 break-words max-w-[30vw] border-r border-slate-100">
                            {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details ?? '')}
                          </td>
                          <td className="p-2.5 text-center border-r border-slate-100">
                            <span className="bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded text-[9px] font-bold block truncate uppercase">
                              {log.currentPage}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="flex flex-wrap gap-1">
                              {log.runningPages.length === 0 ? (
                                <span className="text-[9px] text-slate-400 italic font-sans">(none)</span>
                              ) : (
                                log.runningPages.map(rp => (
                                  <span key={rp} className="bg-indigo-50/50 border border-indigo-100 text-indigo-600 text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase">
                                    {rp}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : logSubTab === "print" ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Total Print Events</span>
              <span className="text-base font-black text-slate-800 font-mono mt-0.5 block">{printLogs.length} triggers</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Filtered Records</span>
              <span className="text-base font-black text-emerald-600 font-mono mt-0.5 block">{filteredPrintLogs.length} events</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Unique printed items</span>
              <span className="text-base font-black text-[#0d47a1] font-mono mt-0.5 block">{uniqueMrNos.size} MR Nos</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Legal Framework</span>
              <span className="text-[10px] font-black text-amber-600 font-mono mt-1.5 block uppercase">Audit Safe v1.2</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3 w-2/12 text-center">Timestamp</th>
                    <th className="p-3 w-2/12">Operator ID</th>
                    <th className="p-3 w-3/12">Target Record M.R. Nos</th>
                    <th className="p-3 w-5/12">Execution Audit narrative</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[10px] text-slate-700">
                  {filteredPrintLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 font-sans italic">
                        No material inspection print events captured matching specified query.
                      </td>
                    </tr>
                  ) : (
                    filteredPrintLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors font-semibold">
                        <td className="p-2.5 text-center text-slate-400 whitespace-nowrap border-r border-slate-100 font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-2.5 font-bold text-indigo-700 border-r border-slate-100 whitespace-nowrap font-mono">
                          {log.user_id}
                        </td>
                        <td className="p-2.5 border-r border-slate-100 font-mono">
                          <div className="flex flex-wrap gap-1">
                            {log.row_ids && log.row_ids.length > 0 ? (
                              log.row_ids.map((id: string) => (
                                <span key={id} className="bg-rose-50 text-rose-700 border border-rose-200 text-[8px] font-black px-1.5 py-px rounded font-mono">
                                  {id}
                                </span>
                              ))
                            ) : (
                              <span className="text-[9px] text-slate-400 italic font-sans">(none)</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 font-sans text-slate-800 break-words">
                          {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details ?? '')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : logSubTab === "sync" ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Sync Log Volume</span>
              <span className="text-base font-black text-slate-800 font-mono mt-0.5 block">{syncLogsParsed.length} operations</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Filtered Operations</span>
              <span className="text-base font-black text-amber-600 font-mono mt-0.5 block">{filteredSyncLogs.length} events</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Sync Daemon Mode</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono block mt-1 w-fit">ACTIVE (Realtime)</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Auto-Link Engine</span>
              <span className="text-[10px] font-black text-indigo-700 font-mono mt-1 block uppercase">Unclubbed AMAD ➔ Inspection</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden flex flex-col font-sans">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3 w-2/12 text-center">Timestamp</th>
                    <th className="p-3 w-2/12">Matched Final M.R</th>
                    <th className="p-3 w-2/12">Inspection M.R No</th>
                    <th className="p-3 w-2/12">Operator / Daemon</th>
                    <th className="p-3 w-4/12 text-center">State Delta / Inspect Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[10px] text-slate-700">
                  {filteredSyncLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                        No automated synchronization events recorded matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSyncLogs.map((log) => {
                      const isExpanded = expandedSyncRow === log.id;
                      return (
                        <React.Fragment key={log.id}>
                          <tr className="hover:bg-amber-50/30 transition-colors font-semibold">
                            <td className="p-2.5 text-center text-slate-400 whitespace-nowrap border-r border-slate-100">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="p-2.5 font-extrabold text-emerald-800 border-r border-slate-100 whitespace-nowrap">
                              <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                {log.finalArrivalNo}
                              </span>
                            </td>
                            <td className="p-2.5 font-extrabold text-indigo-800 border-r border-slate-100 whitespace-nowrap">
                              <span className="bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                                {log.mrNo}
                              </span>
                            </td>
                            <td className="p-2.5 border-r border-slate-100 font-bold text-slate-600 whitespace-nowrap">
                              {log.user_id}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => setExpandedSyncRow(isExpanded ? null : log.id)}
                                className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-[9px] uppercase rounded tracking-wider cursor-pointer"
                              >
                                {isExpanded ? "Hide State Diff" : "Inspect State Payload"}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-900 text-slate-100">
                              <td colSpan={5} className="p-4 font-mono text-[10px]">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-slate-950 p-3 rounded border border-slate-800">
                                    <span className="text-amber-400 font-bold uppercase block mb-1">Original Record State (Pre-Sync)</span>
                                    <pre className="text-[9px] overflow-x-auto text-slate-300">
                                      {log.originalState ? JSON.stringify(log.originalState, null, 2) : "N/A (New Entry Linked)"}
                                    </pre>
                                  </div>
                                  <div className="bg-slate-950 p-3 rounded border border-slate-800">
                                    <span className="text-emerald-400 font-bold uppercase block mb-1">Updated Record State (Post-Sync)</span>
                                    <pre className="text-[9px] overflow-x-auto text-emerald-300">
                                      {log.updatedState ? JSON.stringify(log.updatedState, null, 2) : log.rawDetails}
                                    </pre>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Queue Total Depth</span>
              <span className="text-base font-black text-slate-800 font-mono mt-0.5 block">{printQueue.length} items</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Queue Storage Engine</span>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-mono block mt-1 w-fit">Central Registry</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Ready Documents</span>
              <span className="text-base font-black text-emerald-600 font-mono mt-0.5 block">{printQueue.length} ready</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Print Engine</span>
              <span className="text-[10px] font-black text-indigo-700 font-mono mt-1 block uppercase">A4 / Thermal / Dot Matrix</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden flex flex-col font-sans">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3 w-2/12 text-center">Queued Date/Time</th>
                    <th className="p-3 w-2/12">Module Category</th>
                    <th className="p-3 w-2/12">Document Ref / No</th>
                    <th className="p-3 w-4/12">Document Title & Summary</th>
                    <th className="p-3 w-2/12 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[10px] text-slate-700">
                  {printQueue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400 font-sans italic">
                        The Central Document Print Queue is empty. Queue items above to preview or print documents without re-opening individual modules.
                      </td>
                    </tr>
                  ) : (
                    printQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors font-semibold">
                        <td className="p-2.5 text-center text-slate-400 whitespace-nowrap border-r border-slate-100 font-mono">
                          {new Date(item.timestamp).toLocaleString()}
                        </td>
                        <td className="p-2.5 font-bold uppercase border-r border-slate-100 whitespace-nowrap">
                          <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded text-[9px]">
                            {item.module}
                          </span>
                        </td>
                        <td className="p-2.5 font-extrabold text-slate-900 border-r border-slate-100 whitespace-nowrap font-mono">
                          {item.refNo}
                        </td>
                        <td className="p-2.5 border-r border-slate-100 font-sans">
                          <div className="font-bold text-slate-800">{item.title}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[280px]">{item.summary}</div>
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setPrintingItem(item)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] uppercase rounded tracking-wider transition cursor-pointer flex items-center gap-1"
                            >
                              <Printer className="h-3 w-3" />
                              <span>Print</span>
                            </button>
                            <button
                              onClick={() => {
                                const updated = printQueue.filter(q => q.id !== item.id);
                                savePrintQueueObj(updated);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Remove from queue"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
        </>
      )}
    </div>
  );
};
