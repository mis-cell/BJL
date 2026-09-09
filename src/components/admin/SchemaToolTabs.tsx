import React, { useState } from "react";
import {
  Columns,
  Terminal,
  Play,
  Copy,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  Database,
  Code,
} from "lucide-react";
import { TableDef } from "./MasterTableNav";

interface ColumnDef {
  name: string;
  type: string;
}

interface ColumnStructureTabProps {
  selectedTable: TableDef | null;
  columns: ColumnDef[];
  newFieldName: string;
  setNewFieldName: (val: string) => void;
  newFieldType: string;
  setNewFieldType: (val: string) => void;
  onAddField: () => void;
  onDeleteColumn: (colName: string) => void;
  canDelete: boolean;
}

export const ColumnStructureTab: React.FC<ColumnStructureTabProps> = ({
  selectedTable,
  columns,
  newFieldName,
  setNewFieldName,
  newFieldType,
  setNewFieldType,
  onAddField,
  onDeleteColumn,
  canDelete,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Card: Existing Column Field Catalog */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Columns className="h-4 w-4 text-emerald-700" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Schema Fields Catalog
              </h4>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {columns.length} columns in {selectedTable?.name}
            </span>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
            {columns.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs font-medium">
                No column metadata discovered for this entity.
              </div>
            ) : (
              columns.map((col) => {
                const isPk = col.name === selectedTable?.pk || col.name === "id";
                return (
                  <div
                    key={col.name}
                    className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-slate-800">
                        {col.name}
                      </span>
                      {isPk && (
                        <span className="bg-amber-100 text-amber-800 text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider">
                          PK
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {col.type}
                      </span>
                    </div>

                    {canDelete && !isPk && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Permanently drop column "${col.name}"? This cannot be undone.`)) {
                            onDeleteColumn(col.name);
                          }
                        }}
                        title={`Drop column ${col.name}`}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Card: Append Column Field */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs space-y-3.5">
          <div className="pb-2 border-b border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Add Field to {selectedTable?.label}
            </h4>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Append a new column to the PostgreSQL schema.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Column Name
              </label>
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                placeholder="e.g. tracking_number"
                className="w-full bg-white border border-slate-300 font-mono text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Data Type
              </label>
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value)}
                className="w-full bg-white border border-slate-300 text-xs font-semibold px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 cursor-pointer"
              >
                <option value="TEXT">TEXT (String / Monospace)</option>
                <option value="NUMERIC">NUMERIC (Decimal currency / weights)</option>
                <option value="INTEGER">INTEGER (Whole numbers)</option>
                <option value="BOOLEAN">BOOLEAN (True / False)</option>
                <option value="TIMESTAMPTZ">TIMESTAMPTZ (Date with Timezone)</option>
                <option value="DATE">DATE (Calendar date)</option>
                <option value="JSONB">JSONB (Structured Document Object)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={onAddField}
              disabled={!newFieldName.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer mt-2"
            >
              <Plus className="h-4 w-4" />
              <span>Deploy Column Field</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SqlCommandShellTabProps {
  sqlQuery: string;
  setSqlQuery: (q: string) => void;
  onExecute: () => void;
  sqlResult: any;
  sqlExecuting: boolean;
}

export const SqlCommandShellTab: React.FC<SqlCommandShellTabProps> = ({
  sqlQuery,
  setSqlQuery,
  onExecute,
  sqlResult,
  sqlExecuting,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyResult = () => {
    if (!sqlResult) return;
    navigator.clipboard.writeText(JSON.stringify(sqlResult, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Code Editor Frame */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        {/* Terminal Header */}
        <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-xs font-mono font-semibold text-slate-400 ml-2 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              PostgreSQL Direct Query Terminal
            </span>
          </div>

          <span className="text-[10px] text-slate-500 font-mono">
            Press Ctrl + Enter to run
          </span>
        </div>

        {/* Textarea */}
        <textarea
          rows={6}
          value={sqlQuery}
          onChange={(e) => setSqlQuery(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              onExecute();
            }
          }}
          placeholder="-- Write valid PostgreSQL statements here...&#10;SELECT * FROM user_master LIMIT 10;"
          className="w-full bg-slate-900 text-emerald-400 font-mono text-xs p-4 focus:outline-none focus:ring-0 border-0 resize-y"
        />

        {/* Action Bar */}
        <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            Execute DDL/DML safely.
          </span>
          <button
            type="button"
            onClick={onExecute}
            disabled={sqlExecuting || !sqlQuery.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>{sqlExecuting ? "Executing..." : "Execute Statement"}</span>
          </button>
        </div>
      </div>

      {/* Query Results Display */}
      {sqlResult && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Execution Output
            </span>
            <button
              onClick={handleCopyResult}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? "Copied" : "Copy JSON"}</span>
            </button>
          </div>
          <pre className="p-4 text-xs font-mono bg-slate-50/50 text-slate-800 max-h-[260px] overflow-auto whitespace-pre-wrap">
            {JSON.stringify(sqlResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

interface WeightReconciliationTabProps {
  reconRecords: any[];
  selectedReconId: string | null;
  setSelectedReconId: (id: string) => void;
  reconLoading: boolean;
  onRefresh: () => void;
}

export const WeightReconciliationTab: React.FC<WeightReconciliationTabProps> = ({
  reconRecords,
  selectedReconId,
  setSelectedReconId,
  reconLoading,
  onRefresh,
}) => {
  const [filterQuery, setFilterQuery] = useState("");

  const filteredReconRecords = reconRecords.filter((r) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      String(r.final_arrival_no || "").toLowerCase().includes(q) ||
      String(r.supplier || "").toLowerCase().includes(q) ||
      String(r.lorry_number || "").toLowerCase().includes(q)
    );
  });

  const selRec = reconRecords.find((r) => r.final_arrival_id === selectedReconId);

  // Math parameters extraction
  const grossRaw = selRec ? Number(selRec.weight_qtl || 0) / 10 : 0;
  let moisture = 16;
  let dust = 0;
  let ncv = 0;
  if (selRec?.grid_details) {
    try {
      const parsed = typeof selRec.grid_details === "string"
        ? (selRec.grid_details === "undefined" || selRec.grid_details === "null" ? [] : JSON.parse(selRec.grid_details))
        : selRec.grid_details;
      if (Array.isArray(parsed) && parsed.length > 0) {
        moisture = Number(parsed[0].moisture_pct || parsed[0].moisture || parsed[0].actual_moisture || 16);
        dust = Number(parsed[0].dust_pct || parsed[0].dust || parsed[0].actual_dust || 0);
        ncv = Number(parsed[0].ncv_pct || parsed[0].ncv || parsed[0].actual_ncv || 0);
      }
    } catch (e) {}
  } else if (selRec) {
    moisture = Number(selRec.actual_moisture || 16);
    dust = Number(selRec.actual_dust || 0);
    ncv = Number(selRec.actual_ncv || 0);
  }

  const area = String(selRec?.arrival_area_name || "").toLowerCase();
  const isDaisee = area.includes("daisee");
  let month = 0;
  if (selRec?.po_date || selRec?.date) {
    const d = new Date(selRec.po_date || selRec.date);
    if (!isNaN(d.getTime())) {
      month = d.getMonth();
    }
  }
  const isJanToJune = month >= 0 && month <= 5;
  const moistureLimit = isJanToJune ? (isDaisee ? 18 : 16) : (isDaisee ? 20 : 18);
  const moistureExcess = moisture > moistureLimit ? moisture - moistureLimit : 0;
  const totalDeductions = moistureExcess + dust + ncv;
  const reconciledNet = grossRaw * (1 - totalDeductions / 100);
  const weighedNet = Number(selRec?.electronic_net_weight || selRec?.supplier_net_weight || grossRaw);
  const totalDeductionWeight = grossRaw * (totalDeductions / 100);
  const discrepancy = Math.abs(weighedNet - reconciledNet);

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap justify-between items-center gap-3">
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            Weight Deduction Reconciliations
          </h4>
          <p className="text-[11px] text-slate-500 font-medium">
            Mathematical audit trace comparing gross vs net weights with moisture limits.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          {reconLoading ? "Refreshing..." : "Refresh Records"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left: selectable records list */}
        <div className="md:col-span-4 bg-white border border-slate-200 rounded-xl p-3 flex flex-col space-y-2 max-h-[500px]">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search arrival slips..."
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
          />

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1">
            {filteredReconRecords.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">No arrival records found.</p>
            ) : (
              filteredReconRecords.map((r, i) => {
                const isSel = r.final_arrival_id === selectedReconId;
                return (
                  <div
                    key={r.final_arrival_id || i}
                    onClick={() => setSelectedReconId(r.final_arrival_id)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-colors text-left my-1 ${
                      isSel
                        ? "bg-emerald-50 text-emerald-950 border border-emerald-300 font-bold"
                        : "hover:bg-slate-50 text-slate-700 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        FA-#{r.final_arrival_no || String(r.final_arrival_id).substring(0, 8)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {r.date ? new Date(r.date).toLocaleDateString("en-IN") : "--"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate mt-0.5">
                      {r.supplier || "DIRECT SUPPLIER"}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1">
                      <span>Lorry: {r.lorry_number || "--"}</span>
                      <span>{r.weight_qtl ? `${r.weight_qtl} QTL` : "--"}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Specific Math Breakdown card */}
        <div className="md:col-span-8 bg-white border border-slate-200 rounded-xl p-4">
          {!selRec ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <p className="text-xs font-semibold">
                Select a Final Arrival slip from the list to view the detailed reconciliation audit.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Audit Sheet: Final Arrival #{selRec.final_arrival_no}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Supplier: <strong className="text-slate-800">{selRec.supplier || "DIRECT"}</strong> • Area:{" "}
                    <strong className="text-slate-800">{selRec.arrival_area_name || "CENTRAL"}</strong>
                  </p>
                </div>
                <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-semibold">
                  {String(selRec.final_arrival_id).substring(0, 8)}
                </span>
              </div>

              {/* Stat Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Gross Weight</span>
                  <span className="text-xs font-mono font-bold text-slate-900 block mt-0.5">{grossRaw.toFixed(3)} MT</span>
                  <span className="text-[10px] text-slate-400 font-mono">({selRec.weight_qtl || 0} QTL)</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Weighed Net (WB)</span>
                  <span className="text-xs font-mono font-bold text-slate-900 block mt-0.5">{weighedNet.toFixed(3)} MT</span>
                  <span className="text-[10px] text-slate-400">Certified Weight</span>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wide block">Audit Match Net</span>
                  <span className="text-xs font-mono font-bold text-blue-950 block mt-0.5">{reconciledNet.toFixed(3)} MT</span>
                  <span className="text-[10px] text-blue-600">Calculated</span>
                </div>
                <div className={`border rounded-lg p-2.5 text-center ${discrepancy > 0.15 ? "bg-rose-50 border-rose-200 text-rose-900" : "bg-emerald-50 border-emerald-200 text-emerald-900"}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wide block">Discrepancy</span>
                  <span className="text-xs font-mono font-bold block mt-0.5">{discrepancy.toFixed(3)} MT</span>
                  <span className="text-[10px] font-bold block">
                    {discrepancy > 0.15 ? "⚠️ Review Needed" : "✓ Reconciled"}
                  </span>
                </div>
              </div>

              {/* Mathematical Steps */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Calculation Formula Breakdown
                </span>
                <div className="divide-y divide-slate-200 text-xs space-y-1.5 font-medium">
                  <div className="pt-1 flex justify-between">
                    <span className="text-slate-600">1. Operating Area & DAISEE Status:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {selRec.arrival_area_name || "CENTRAL"} ({isDaisee ? "DAISEE STATION" : "STANDARD"})
                    </span>
                  </div>
                  <div className="pt-1 flex justify-between">
                    <span className="text-slate-600">2. Arrival Season:</span>
                    <span className="font-mono text-slate-800">
                      {isJanToJune ? "Jan-June Season" : "July-Dec Season"}
                    </span>
                  </div>
                  <div className="pt-1 flex justify-between">
                    <span className="text-slate-600">3. Moisture Permissible Limit:</span>
                    <span className="font-mono font-bold text-emerald-700">{moistureLimit}%</span>
                  </div>
                  <div className="pt-1 flex justify-between">
                    <span className="text-slate-600">4. Recorded vs Limit Excess:</span>
                    <span className="font-mono text-slate-800">
                      Recorded: {moisture}% | Excess: <strong className="text-rose-600">{moistureExcess.toFixed(2)}%</strong>
                    </span>
                  </div>
                  <div className="pt-1 flex justify-between">
                    <span className="text-slate-600">5. Dust & NCV Deductions:</span>
                    <span className="font-mono text-slate-800">Dust: {dust}% | NCV: {ncv}%</span>
                  </div>
                  <div className="pt-1 flex justify-between">
                    <span className="text-slate-600 font-bold">6. Total Deduction Rate:</span>
                    <span className="font-mono font-bold text-rose-700">{totalDeductions.toFixed(2)}% Cumulative</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-2.5 font-mono text-xs mt-3 text-slate-800 space-y-1">
                  <p className="text-slate-500 font-sans text-[11px] font-semibold">Mathematical Result:</p>
                  <p className="font-bold text-emerald-900">
                    Reconciled Net Weight: {grossRaw.toFixed(3)} MT * (1 - {totalDeductions.toFixed(2)} / 100) = {reconciledNet.toFixed(3)} MT
                  </p>
                  <p className="text-slate-500 text-[10px]">
                    Net deduction mass loss: {totalDeductionWeight.toFixed(3)} MT
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
