import React from 'react';
import { Settings, Plus, Trash2 } from 'lucide-react';
import SectionHeader from './SectionHeader';

interface QualityDetailsTableProps {
  qualityDetails: any[];
  onQualityChange: (index: number, field: string, value: any) => void;
  onAddRow: () => void;
  onDeleteRow: () => void;
  onRemoveRowAt: (index: number) => void;
  grades: any[];
  agencies: any[];
  markas: any[];
}

export const QualityDetailsTable: React.FC<QualityDetailsTableProps> = ({
  qualityDetails,
  onQualityChange,
  onAddRow,
  onDeleteRow,
  onRemoveRowAt,
  grades,
  agencies,
  markas
}) => {
  return (
    <div className="bg-white rounded-[18px] p-5 shadow-xs border border-[#E5E7EB] transition-all hover:shadow-sm">
      <SectionHeader
        icon={Settings}
        title="Quality Details"
        rightAction={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddRow}
              className="bg-[#174C2C] hover:bg-[#113A21] text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Spawn Row</span>
            </button>
            <button
              type="button"
              onClick={onDeleteRow}
              className="border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Row</span>
            </button>
          </div>
        }
      />

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#E0DBCF] shadow-2xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#EDF4EF] text-[#174C2C] font-bold text-xs uppercase border-b border-[#D8E4DC]">
              <th className="px-3.5 py-2.5 w-1/4">Quality</th>
              <th className="px-3.5 py-2.5 w-1/6 text-right">Qty</th>
              <th className="px-3.5 py-2.5 w-1/4">Agency</th>
              <th className="px-3.5 py-2.5 w-1/5">Marka</th>
              <th className="px-3.5 py-2.5 w-1/6 text-right">Rs.</th>
              <th className="px-2 py-2.5 w-12 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAE6DD] text-xs">
            {qualityDetails.map((qd, i) => (
              <tr key={i} className="hover:bg-[#F9F8F5] transition-colors">
                {/* Quality */}
                <td className="p-2">
                  <select
                    value={qd.quality || ''}
                    onChange={(e) => onQualityChange(i, 'quality', e.target.value)}
                    className="w-full bg-white border border-[#D5D0C5] focus:border-[#174C2C] focus:ring-1 focus:ring-[#174C2C] rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none transition-all cursor-pointer"
                  >
                    <option value="">--Select Quality--</option>
                    {qd.quality && !grades.some(g => g.grade_name === qd.quality || g.grade_code === qd.quality) && (
                      <option value={qd.quality}>{qd.quality}</option>
                    )}
                    {grades.map((g, idx) => (
                      <option key={idx} value={g.grade_name || g.grade_code}>
                        {g.grade_name || g.grade_code}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Qty */}
                <td className="p-2">
                  <input
                    type="number"
                    value={qd.qty ?? ''}
                    onChange={(e) => onQualityChange(i, 'qty', e.target.value)}
                    placeholder="Qty"
                    className="w-full bg-white border border-[#D5D0C5] focus:border-[#174C2C] focus:ring-1 focus:ring-[#174C2C] rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 text-right outline-none transition-all"
                  />
                </td>

                {/* Agency */}
                <td className="p-2">
                  <input
                    type="text"
                    value={qd.agency || ''}
                    onChange={(e) => onQualityChange(i, 'agency', e.target.value.toUpperCase())}
                    list={`agency_options_${i}`}
                    placeholder="Agency"
                    className="w-full bg-white border border-[#D5D0C5] focus:border-[#174C2C] focus:ring-1 focus:ring-[#174C2C] rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase text-slate-800 outline-none transition-all"
                  />
                  <datalist id={`agency_options_${i}`}>
                    {agencies.map((a: any, idx: number) => (
                      <option key={idx} value={a.agency_name || a} />
                    ))}
                  </datalist>
                </td>

                {/* Marka */}
                <td className="p-2">
                  <input
                    type="text"
                    value={qd.marka || ''}
                    onChange={(e) => onQualityChange(i, 'marka', e.target.value.toUpperCase())}
                    list={`marka_options_${i}`}
                    placeholder="Marka"
                    className="w-full bg-white border border-[#D5D0C5] focus:border-[#174C2C] focus:ring-1 focus:ring-[#174C2C] rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase text-slate-800 outline-none transition-all"
                  />
                  <datalist id={`marka_options_${i}`}>
                    {markas.map((m: any, idx: number) => (
                      <option key={idx} value={m.marka_name || m} />
                    ))}
                  </datalist>
                </td>

                {/* Rs. */}
                <td className="p-2">
                  <input
                    type="number"
                    step="0.01"
                    value={qd.rs ?? ''}
                    onChange={(e) => onQualityChange(i, 'rs', e.target.value)}
                    placeholder="Rs."
                    className="w-full bg-white border border-[#D5D0C5] focus:border-[#174C2C] focus:ring-1 focus:ring-[#174C2C] rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 text-right outline-none transition-all"
                  />
                </td>

                {/* Action Delete */}
                <td className="p-2 text-center">
                  <button
                    type="button"
                    onClick={() => onRemoveRowAt(i)}
                    title="Delete row"
                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QualityDetailsTable;
