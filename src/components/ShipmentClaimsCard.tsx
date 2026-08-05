import React from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import SectionHeader from './SectionHeader';

interface ShipmentClaimsCardProps {
  formData: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ShipmentClaimsCard: React.FC<ShipmentClaimsCardProps> = ({ formData, onChange }) => {
  return (
    <div className="bg-white rounded-[18px] p-5 shadow-xs border border-[#E5E7EB] transition-all hover:shadow-sm">
      <SectionHeader icon={Calendar} title="Shipment & Claims" />

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Shipment Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Shipment Date</label>
          <input
            type="date"
            name="shipment_date"
            value={formData.shipment_date || ''}
            onChange={onChange}
            className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs cursor-pointer"
          />
        </div>

        {/* Shipment Days */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Days</label>
          <input
            type="number"
            name="shipment_days"
            value={formData.shipment_days ?? 0}
            onChange={onChange}
            className="bg-[#F8F7F2] border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 text-right outline-none focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs"
          />
        </div>

        {/* Penalty Per Day */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Penalty/Day</label>
          <input
            type="number"
            step="0.01"
            name="shipment_penalty"
            value={formData.shipment_penalty ?? 5}
            onChange={onChange}
            className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 text-right outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs"
          />
        </div>

        {/* Marks Claim */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Marks Claim</label>
          <input
            type="number"
            step="0.01"
            name="marks_claim"
            value={formData.marks_claim ?? 0}
            onChange={onChange}
            className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 text-right outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs"
          />
        </div>

        {/* Quantity Claim */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Quantity Claim</label>
          <input
            type="number"
            step="0.01"
            name="quantity_claim"
            value={formData.quantity_claim ?? 0}
            onChange={onChange}
            className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 text-right outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs"
          />
        </div>
      </div>
    </div>
  );
};

export default ShipmentClaimsCard;
