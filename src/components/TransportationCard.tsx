import React from 'react';
import { Truck, CheckCircle2, AlertTriangle } from 'lucide-react';
import SectionHeader from './SectionHeader';

interface TransportationCardProps {
  formData: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  unitOptions: string[];
}

export const TransportationCard: React.FC<TransportationCardProps> = ({
  formData,
  onChange,
  unitOptions
}) => {
  const hasValidationIssues = (Number(formData.no_of_lorries) || 0) <= 0;

  return (
    <div className="bg-white rounded-[18px] p-5 shadow-xs border border-[#E5E7EB] transition-all hover:shadow-sm">
      <SectionHeader icon={Truck} title="Unit & Transportation Details" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* No. of Lorries */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">No. of Lorries</label>
          <input
            type="number"
            min="1"
            name="no_of_lorries"
            value={formData.no_of_lorries ?? 1}
            onChange={onChange}
            className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 text-right outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs"
          />
        </div>

        {/* Units/Lorry */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Units/Lorry</label>
          <select
            name="units_per_lorry_type"
            value={formData.units_per_lorry_type || 'BALES'}
            onChange={onChange}
            className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs cursor-pointer"
          >
            {unitOptions.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>

        {/* Total Unit */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Total Unit</label>
          <input
            type="number"
            name="total_unit"
            value={formData.total_unit ?? 0}
            onChange={onChange}
            className="bg-[#F8F7F2] border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 text-right outline-none focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs"
          />
        </div>

        {/* Weight/Lorry */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Wt/Lorry</label>
          <input
            type="number"
            step="0.01"
            name="wt_per_lorry"
            value={formData.wt_per_lorry ?? 0}
            onChange={onChange}
            className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 text-right outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs"
          />
        </div>

        {/* Unit Type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Unit Type</label>
          <select
            name="unit_type"
            value={formData.unit_type || 'BALES'}
            onChange={onChange}
            className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs cursor-pointer"
          >
            {unitOptions.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>

        {/* Total Weight in Ton */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Total Wt. in Ton</label>
          <input
            type="number"
            step="0.001"
            name="total_wt_in_ton"
            value={formData.total_wt_in_ton ?? 0}
            onChange={onChange}
            className="bg-[#F8F7F2] border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-bold text-[#174C2C] text-right outline-none focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs"
          />
        </div>

        {/* Issue Validation Panel */}
        <div className="md:col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Issue</label>
          {hasValidationIssues ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Please specify a valid lorry count greater than 0</span>
            </div>
          ) : (
            <div className="bg-[#F0FDF4] border border-[#DCFCE7] text-[#166534] rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0" />
              <span>No issues recorded</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransportationCard;
