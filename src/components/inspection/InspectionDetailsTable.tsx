import React from "react";
import { Plus, Printer, Save, Loader2, Lock, Sparkles } from "lucide-react";
import {
  InspectionDetailRow,
  InspectionMasterRecord,
  detailFieldsConfig
} from "../../types/inspection.types";
import { InspectionDetailRowItem } from "./InspectionDetailRowItem";
import { InspectionExpandedPanel } from "./InspectionExpandedPanel";

export interface InspectionDetailsTableProps {
  detailRows: InspectionDetailRow[];
  headerForm: Partial<InspectionMasterRecord>;
  isSaving: boolean;
  onDetailChange: (index: number, field: keyof InspectionDetailRow, value: any) => void;
  onToggleExpand: (index: number) => void;
  onDuplicateRow: (index: number) => void;
  onDeleteRow: (index: number) => void;
  onAddRow: () => void;
  onPrintRecord: () => void;
  onSaveForm: () => void;
}

export const InspectionDetailsTable: React.FC<InspectionDetailsTableProps> = ({
  detailRows,
  headerForm,
  isSaving,
  onDetailChange,
  onToggleExpand,
  onDuplicateRow,
  onDeleteRow,
  onAddRow,
  onPrintRecord,
  onSaveForm,
}) => {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
      <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-extrabold text-slate-900">Inspection Details</h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-extrabold px-3 py-0.5 rounded-full border border-blue-200">
              {detailRows.length} {detailRows.length === 1 ? "Row" : "Rows"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Horizontal scroll + Expand Row on every record for comprehensive quality audit details
          </p>
        </div>

        {/* Color Legend & Add Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs text-[11px]">
            <span className="font-bold text-slate-500 mr-1">Field Legend:</span>
            <span
              className="inline-flex items-center gap-1 bg-blue-100/90 text-blue-900 border border-blue-300 px-2 py-0.5 rounded font-extrabold shadow-2xs"
              title="Auto-populated from Arrival / PO / Master (Protected from manual edits)"
            >
              <Lock className="w-3 h-3 text-blue-700" />
              Auto-Populated &amp; Blocked
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded font-medium">
              Manual Entry Allowed
            </span>
          </div>

          <button
            type="button"
            onClick={onAddRow}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Row</span>
          </button>
        </div>
      </div>

      <style>{`
        .table-scroll::-webkit-scrollbar {
          width: 7px;
          height: 11px;
        }
      `}</style>
      <div className="table-scroll overflow-auto max-h-[calc(100vh-180px)] border-t border-slate-200">
        <table className="min-w-[4300px] w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#1e3a8a] text-white text-[12px] font-bold">
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center sticky left-0 bg-[#1e3a8a] z-20 min-w-[50px]">Srl No.</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[120px]">Arrival Grade</th>
              <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Stock Grade</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Area</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Agency</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Marks</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Crop Year</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Lot</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Quantity</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Unit</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px]">Challan Gross Wt. MT.</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px]">Receipt Gross Wt. MT.</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px]">Gross Weight (Batch)</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[120px] bg-gradient-to-b from-[#065f46] to-[#047857] text-white font-extrabold shadow-inner">
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <span>Add Weight</span>
                  <span className="text-[9px] font-semibold text-emerald-200">M.Ton</span>
                </div>
              </th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[120px] bg-gradient-to-b from-[#991b1b] to-[#b91c1c] text-white font-extrabold shadow-inner">
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <span>Less Weight</span>
                  <span className="text-[9px] font-semibold text-rose-200">M.Ton</span>
                </div>
              </th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px] bg-gradient-to-b from-[#3730a3] to-[#4338ca] text-white font-extrabold shadow-inner">
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <span>Reduced Weight</span>
                  <span className="text-[9px] font-semibold text-indigo-200">M.Ton</span>
                </div>
              </th>
              <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1e40af]">Lorry Moisture Read (%)</th>
              <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Insp. Moisture Read (%)</th>
              <th colSpan={2} className="p-2 border-r border-blue-400 text-center bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white font-black shadow-inner">
                <div className="flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3 text-cyan-300 fill-cyan-300" />
                  <span className="tracking-wide">Moisture %</span>
                </div>
              </th>
              <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Dust %</th>
              <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1e40af]">NCV %</th>
              <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Grade Down %</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[140px]">Final Receipt Wt. (Claim)</th>
              <th colSpan={4} className="p-2 border-r border-emerald-400 text-center bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-black shadow-inner">
                <div className="flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                  <span className="tracking-wide">Mill Settlement %</span>
                </div>
              </th>
              <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Ropes</th>
              <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1e40af]">Chotta &amp; Habi Jabi</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[90px]">Tolerable</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px] bg-gradient-to-b from-[#1d4ed8] to-[#1e3a8a] text-amber-300">
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <span className="font-black flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                    Premium
                  </span>
                  <span className="text-[9px] font-semibold text-blue-100 opacity-90">(Show Qty in MT)</span>
                </div>
              </th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[125px] bg-gradient-to-b from-[#1e40af] to-[#1e3a8a] text-white font-extrabold shadow-inner">
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <span>Amount</span>
                  <span className="text-[9px] font-semibold text-amber-300 font-mono">₹ Total</span>
                </div>
              </th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[140px]">Remarks</th>
              <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[140px]">JCI Remarks</th>
              <th rowSpan={2} className="p-2 text-center sticky right-0 bg-[#1e3a8a] z-20 min-w-[190px]">Row Actions</th>
            </tr>
            <tr className="bg-[#243b68] text-white text-[11px]">
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Code</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[120px]">Name</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Min</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Max</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Avg</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Min</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Max</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Avg</th>
              <th className="p-1.5 border-r border-blue-500 text-center min-w-[90px] bg-blue-900 text-blue-100 font-black" title="Auto-pulled highest value between Lorry Avg and Insp Avg">Act.</th>
              <th className="p-1.5 border-r border-blue-500 text-center min-w-[90px] bg-blue-900 text-blue-100 font-black" title="Auto-pulled highest value between Lorry Avg and Insp Avg">Claim</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Act.</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Claim</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Act.</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Claim</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Act.</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Claim</th>
              <th className="p-1.5 border-r border-emerald-500 text-center min-w-[90px] bg-emerald-800 text-emerald-100 font-black" title="Auto-pulled from Moisture % Act.">Moisture</th>
              <th className="p-1.5 border-r border-emerald-500 text-center min-w-[90px] bg-emerald-800 text-emerald-100 font-black" title="Auto-pulled from Grade Down % Act.">Gr. Down</th>
              <th className="p-1.5 border-r border-emerald-500 text-center min-w-[90px] bg-emerald-800 text-emerald-100 font-black" title="Auto-pulled from Dust % Act.">Dust</th>
              <th className="p-1.5 border-r border-emerald-500 text-center min-w-[90px] bg-emerald-800 text-emerald-100 font-black" title="Auto-pulled from NCV % Act.">NCV</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Weight (Kg)</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[100px]">Tot. Wt. Grd%</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Grade</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Weight (Kg)</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[100px]">Tot. Wt. Grd%</th>
              <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Grade</th>
            </tr>
          </thead>
          <tbody>
            {detailRows.map((row, idx) => (
              <React.Fragment key={idx}>
                <InspectionDetailRowItem
                  row={row}
                  index={idx}
                  headerForm={headerForm}
                  onDetailChange={onDetailChange}
                  onToggleExpand={onToggleExpand}
                  onDuplicateRow={onDuplicateRow}
                  onDeleteRow={onDeleteRow}
                />
                {row.expanded && (
                  <InspectionExpandedPanel
                    row={row}
                    index={idx}
                    configs={detailFieldsConfig}
                    onToggleExpand={onToggleExpand}
                    onDetailChange={onDetailChange}
                  />
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* FOOTER BAR */}
      <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          Tip: Use <b className="text-blue-700">Expand</b> to edit/view the complete row without losing the wide-table structure. <b className="text-rose-700">Delete</b> removes only that inspection row.
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddRow}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>＋ Add New Inspection Row</span>
          </button>
          <button
            type="button"
            onClick={onPrintRecord}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            title="Print Marks & Quality Received Mill Copy"
          >
            <Printer className="w-4 h-4" />
            <span>Print Slip</span>
          </button>
          <button
            type="button"
            onClick={onSaveForm}
            disabled={isSaving}
            className={`px-5 py-2 font-black text-xs rounded-lg flex items-center gap-1.5 shadow-md transition-all ${
              isSaving
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-amber-400 hover:bg-amber-300 text-slate-950 active:scale-95 cursor-pointer"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Inspection</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
};
