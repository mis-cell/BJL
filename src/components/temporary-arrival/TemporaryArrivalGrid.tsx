import React from 'react';
import { cn } from '../../lib/utils';
import { ArrivalDetailRow } from '../../types';

export interface TemporaryArrivalGridProps {
  details: ArrivalDetailRow[];
  unitName?: string;
  grades: any[];
  agencies: any[];
  markas: any[];
  onAddRow: () => void;
  onDeleteRow: () => void;
  onDetailChange: (index: number, field: keyof ArrivalDetailRow, value: any) => void;
}

export const TemporaryArrivalGrid: React.FC<TemporaryArrivalGridProps> = ({
  details,
  unitName,
  grades,
  agencies,
  markas,
  onAddRow,
  onDeleteRow,
  onDetailChange
}) => {
  return (
    <div className="w-full rounded-xl border border-[#174C2C] bg-white shadow-md overflow-hidden mt-5">
      {/* Header */}
      <div className="bg-[#174C2C] text-white px-4 py-2 flex items-center justify-between border-b border-[#0F351E]">
        <h3 className="text-sm font-bold tracking-wide uppercase">
          Arrival Item Details Grid
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onAddRow}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
          >
            + Add Row
          </button>
          <button
            type="button"
            onClick={onDeleteRow}
            className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
          >
            - Delete Row
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="w-full overflow-x-auto">
        <table className="w-full table-fixed min-w-[950px] border-collapse text-left text-[11px] font-sans">
          <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
            <tr className="bg-slate-800 text-white font-bold uppercase text-[9px]/tight text-center">
              <th className="p-1 border border-gray-400 w-10 shrink-0" rowSpan={2}>Srl</th>
              <th className="p-1 border border-gray-400 text-center w-52" colSpan={2}>Receipt Grade</th>
              <th className="p-1 border border-gray-400 w-24" rowSpan={2}>Crop Year</th>
              <th className="p-1 border border-gray-400 w-28" rowSpan={2}>Challan Grade</th>
              <th className="p-1 border border-gray-400 text-center w-48" colSpan={2}>Agency</th>
              <th className="p-1 border border-gray-400 text-center w-48" colSpan={2}>Challan Marka</th>
              <th className="p-1 border border-gray-400 w-24" rowSpan={2}>Netto (M.T)</th>
              <th className="p-1 border border-gray-400 w-32" colSpan={2}>Quantity</th>
              <th className="p-1 border border-gray-400 w-36" rowSpan={2}>Remarks</th>
            </tr>
            <tr className="bg-slate-200 text-black font-extrabold text-[8px] text-center border-b border-gray-400">
              <th className="p-0.5 border border-gray-400 w-16">Code</th>
              <th className="p-0.5 border border-gray-400 w-36">Name</th>
              <th className="p-0.5 border border-gray-400 w-14">Code</th>
              <th className="p-0.5 border border-gray-400 w-34">Name</th>
              <th className="p-0.5 border border-gray-400 w-14">Code</th>
              <th className="p-0.5 border border-gray-400 w-34">Name</th>
              <th className="p-0.5 border border-gray-400 w-16">Chln</th>
              <th className="p-0.5 border border-gray-400 w-16">Rcpt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300">
            {details.map((detail, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors h-7 text-[10.5px]">
                {/* Srl */}
                <td className="p-1 text-center font-bold text-gray-900 border border-gray-300 bg-slate-100 w-10">
                  {detail.srl_no}
                </td>

                {/* Receipt Grade Code */}
                <td className="p-0.5 border border-gray-300 w-16 bg-slate-50 text-center">
                  <input
                    type="text"
                    value={detail.receipt_grade_code}
                    readOnly
                    placeholder="--"
                    className="w-full bg-transparent border-0 p-0 text-center font-bold text-gray-800 outline-none"
                  />
                </td>

                {/* Receipt Grade Name */}
                <td className="p-0.5 border border-gray-300 w-36">
                  <select
                    value={detail.receipt_grade_name}
                    onChange={(e) => onDetailChange(idx, 'receipt_grade_name', e.target.value)}
                    className="w-full bg-white border border-gray-300 p-0 text-left font-bold text-gray-900 outline-none h-6"
                  >
                    <option value=""></option>
                    {detail.receipt_grade_name && !grades.some(g => g.grade_name === detail.receipt_grade_name) && (
                      <option value={detail.receipt_grade_name}>{detail.receipt_grade_name}</option>
                    )}
                    {grades.map(g => (
                      <option key={g.id || g.grade_code} value={g.grade_name}>{g.grade_name}</option>
                    ))}
                  </select>
                </td>

                {/* Crop Year */}
                <td className="p-0.5 border border-gray-300 w-24">
                  <select
                    value={detail.crop_year}
                    onChange={(e) => onDetailChange(idx, 'crop_year', e.target.value)}
                    className="w-full bg-white border border-gray-300 p-0 text-center font-bold text-gray-900 outline-none h-6 text-xs"
                  >
                    <option value=""></option>
                    {detail.crop_year && !['2024-25', '2025-26', '2026-27', '2027-28', '2028-29'].includes(detail.crop_year) && (
                      <option value={detail.crop_year}>{detail.crop_year}</option>
                    )}
                    <option value="2024-25">2024-25</option>
                    <option value="2025-26">2025-26</option>
                    <option value="2026-27">2026-27</option>
                    <option value="2027-28">2027-28</option>
                    <option value="2028-29">2028-29</option>
                  </select>
                </td>

                {/* Challan Grade Name */}
                <td className="p-0.5 border border-gray-300 w-28">
                  <input
                    type="text"
                    value={detail.challan_grade_name}
                    onChange={(e) => onDetailChange(idx, 'challan_grade_name', e.target.value)}
                    className="w-full bg-transparent border-0 p-0 outline-none px-1"
                  />
                </td>

                {/* Agency Code */}
                <td className="p-0.5 border border-gray-300 w-14 bg-slate-50 text-center">
                  <input
                    type="text"
                    value={detail.agency_code || ''}
                    onChange={(e) => onDetailChange(idx, 'agency_code', e.target.value)}
                    placeholder="--"
                    className="w-full bg-transparent border-0 p-0 text-center font-bold text-gray-800 outline-none uppercase font-mono"
                  />
                </td>

                {/* Agency Name */}
                <td className="p-0.5 border border-gray-300 w-34">
                  <input
                    list="agencies_list"
                    placeholder="Type/Select Agency..."
                    value={detail.agency_name || ''}
                    onChange={(e) => onDetailChange(idx, 'agency_name', e.target.value)}
                    className="w-full bg-white text-left font-bold text-gray-900 outline-none px-1 h-6 uppercase font-mono border-0"
                  />
                </td>

                {/* Challan Marka Code */}
                <td className="p-0.5 border border-gray-300 w-14 bg-slate-50 text-center">
                  <input
                    type="text"
                    value={detail.challan_marka_code}
                    readOnly
                    placeholder="--"
                    className="w-full bg-transparent border-0 p-0 text-center font-bold text-gray-800 outline-none"
                  />
                </td>

                {/* Challan Marka Name */}
                <td className="p-0.5 border border-gray-300 w-34">
                  <input
                    list="markas_list"
                    placeholder="Type/Select Marka..."
                    value={detail.challan_marka_name || ''}
                    onChange={(e) => onDetailChange(idx, 'challan_marka_name', e.target.value)}
                    className="w-full bg-white text-left font-bold text-gray-900 outline-none px-1 h-6 uppercase font-mono border-0"
                  />
                </td>

                {/* Netto Pnto */}
                <td className="p-0.5 border border-gray-300 w-24">
                  {(() => {
                    const rowUnit = (detail.unit || unitName || 'BALES').toString().trim().toUpperCase();
                    const isBales = rowUnit === 'BALES' || rowUnit.includes('BALE') || rowUnit === 'DRUMS' || rowUnit.includes('DRUM');
                    return (
                      <input
                        id={`netto_pnto_main_${idx}`}
                        name={`netto_pnto_main_${idx}`}
                        aria-label="Netto M.T"
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        readOnly={isBales}
                        value={detail.netto_pnto !== undefined && detail.netto_pnto !== null ? detail.netto_pnto : 0}
                        onChange={(e) => {
                          if (!isBales) {
                            const val = e.target.value;
                            onDetailChange(idx, 'netto_pnto', val === '' ? 0 : Number(val));
                          }
                        }}
                        title={isBales ? "Auto-calculated: (RCPT / Total RCPT) * Final Weight" : "Enter Netto Weight"}
                        className={cn(
                          "w-full p-0 text-right font-bold outline-none pr-1 transition-colors",
                          isBales
                            ? "bg-amber-50/90 border border-amber-300 text-amber-950 cursor-not-allowed"
                            : "bg-white border border-gray-300 text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                        )}
                      />
                    );
                  })()}
                </td>

                {/* Quantity Chln */}
                <td className="p-0.5 border border-gray-300 w-16">
                  <input
                    type="number"
                    step="1"
                    placeholder="0"
                    value={detail.quantity_chln !== undefined && detail.quantity_chln !== null ? detail.quantity_chln : 0}
                    onChange={(e) => {
                      const val = e.target.value;
                      onDetailChange(idx, 'quantity_chln', val === '' ? 0 : Number(val));
                    }}
                    className="w-full bg-white border border-blue-200 p-0 text-center font-bold text-blue-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </td>

                {/* Quantity Rcpt */}
                <td className="p-0.5 border border-gray-300 w-16">
                  <input
                    type="number"
                    step="1"
                    placeholder="0"
                    value={detail.quantity_rcpt !== undefined && detail.quantity_rcpt !== null ? detail.quantity_rcpt : 0}
                    onChange={(e) => {
                      const val = e.target.value;
                      onDetailChange(idx, 'quantity_rcpt', val === '' ? 0 : Number(val));
                    }}
                    className="w-full bg-white border border-indigo-200 p-0 text-center font-bold text-indigo-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                </td>

                {/* Remarks */}
                <td className="p-0.5 border border-gray-300 w-36">
                  <input
                    type="text"
                    value={detail.remarks}
                    onChange={(e) => onDetailChange(idx, 'remarks', e.target.value)}
                    className="w-full bg-transparent border-0 p-0 text-left outline-none px-1"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
