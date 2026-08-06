import React from 'react';
import { ClipboardList, Calendar } from 'lucide-react';
import SectionHeader from './SectionHeader';
import SearchableSelect from './SearchableSelect';

interface BasicDetailsProps {
  formData: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSelectChange: (field: string, value: string) => void;
  brokers: string[];
  suppliers: string[];
  areas: string[];
}

export const BasicDetailsCard: React.FC<BasicDetailsProps> = ({
  formData,
  onChange,
  onSelectChange,
  brokers,
  suppliers,
  areas
}) => {
  return (
    <div className="bg-white rounded-[18px] p-5 shadow-md border border-[#D8D3C5] hover:border-[#174C2C]/40 hover:shadow-lg transition-all">
      <SectionHeader icon={ClipboardList} title="Basic Details" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Session */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Session</label>
          <input
            type="text"
            name="session"
            value={formData.session || 'BJCL/2026-2027/'}
            onChange={onChange}
            className="bg-[#F8F7F2] border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs"
          />
        </div>

        {/* Order No. */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Order No.</label>
          <input
            type="text"
            name="sauda_no"
            value={formData.sauda_no || ''}
            onChange={onChange}
            placeholder="e.g. 0153"
            required
            className="bg-[#FFFFE8] border border-amber-300 rounded-xl px-3.5 py-2 text-xs font-black text-[#174C2C] outline-none focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs"
          />
        </div>

        {/* P.O. Type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">P.O. Type</label>
          <select
            name="po_type"
            value={formData.po_type || 'Normal'}
            onChange={onChange}
            className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs cursor-pointer"
          >
            <option value="Normal">Normal</option>
            <option value="PTF">PTF</option>
            <option value="Direct">Direct</option>
          </select>
        </div>

        {/* Contract Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Date</label>
          <div className="relative">
            <input
              type="date"
              name="date"
              value={formData.date || ''}
              onChange={onChange}
              className="w-full bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs cursor-pointer"
            />
          </div>
        </div>

        {/* Broker */}
        <SearchableSelect
          label="Broker"
          value={formData.broker || ''}
          onChange={(val) => onSelectChange('broker', val)}
          options={brokers}
          placeholder="SELECT OR TYPE BROKER..."
        />

        {/* Supplier */}
        <SearchableSelect
          label="Supplier"
          value={formData.supplier || ''}
          onChange={(val) => onSelectChange('supplier', val)}
          options={suppliers}
          placeholder="SELECT OR TYPE SUPPLIER..."
        />

        {/* Challan Supplier */}
        <SearchableSelect
          label="Challan Supplier"
          value={formData.challan_supplier || ''}
          onChange={(val) => onSelectChange('challan_supplier', val)}
          options={suppliers}
          placeholder="SELECT OR TYPE CHALLAN SUPPLIER..."
        />

        {/* Area */}
        <SearchableSelect
          label="Area"
          value={formData.area || ''}
          onChange={(val) => onSelectChange('area', val)}
          options={areas}
          placeholder="SELECT OR TYPE AREA..."
        />
      </div>
    </div>
  );
};

export default BasicDetailsCard;
