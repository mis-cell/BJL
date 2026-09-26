import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { FinalArrivalEntryFormData } from './finalArrivalTypes';

interface FinalArrivalEntryHeaderProps {
  formData: FinalArrivalEntryFormData;
  handleInputChange: (field: string, val: any) => void;
  handleAreaChange: (val: string) => void;
  handleSelectPoOption: (item: any) => void;
  loadDetailsFromAmad: (tempMrNo: string) => void;
  showPoDropdown: boolean;
  setShowPoDropdown: (show: boolean) => void;
  combinedPoOptions: any[];
  brokers: any[];
  suppliers: any[];
  areas: any[];
  unitList: string[];
}

export function FinalArrivalEntryHeader({
  formData,
  handleInputChange,
  handleAreaChange,
  handleSelectPoOption,
  loadDetailsFromAmad,
  showPoDropdown,
  setShowPoDropdown,
  combinedPoOptions,
  brokers,
  suppliers,
  areas,
  unitList
}: FinalArrivalEntryHeaderProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E6DDC8] shadow-xs p-4 space-y-3.5 text-xs text-slate-800">
      {/* ROW 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
        {/* Temporary M.R No */}
        <div className="lg:col-span-1">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Temporary M.R No</label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={formData.temporary_arrival_no || 'MR'}
              onChange={(e) => handleInputChange('temporary_arrival_no', e.target.value)}
              onBlur={() => {
                if (formData.temporary_arrival_no) loadDetailsFromAmad(formData.temporary_arrival_no);
              }}
              placeholder="Enter Temporary M.R No"
              className={cn(
                "w-full h-8 rounded px-2 outline-none text-xs font-mono focus:ring-1 focus:ring-sky-600 transition-colors",
                formData.temporary_arrival_no 
                  ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                  : "bg-white border border-slate-300 font-semibold"
              )}
            />
            <button
              type="button"
              onClick={() => loadDetailsFromAmad(formData.temporary_arrival_no)}
              className="bg-[#103A20] hover:bg-[#1c5932] text-white px-2.5 h-8 rounded text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              Pick
            </button>
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Temporary Date <span className="text-rose-600 font-black">*</span></label>
          <input
            type="date"
            value={formData.temporary_arrival_date || ''}
            onChange={(e) => handleInputChange('temporary_arrival_date', e.target.value)}
            className={cn(
              "w-full h-8 rounded px-2 outline-none text-xs transition-colors",
              formData.temporary_arrival_date 
                ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                : "bg-white border border-slate-300 text-slate-800"
            )}
          />
        </div>

        {/* Arrival No */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Arrival No</label>
          <input
            type="text"
            value={formData.arrival_no || ''}
            onChange={(e) => handleInputChange('arrival_no', e.target.value)}
            className="w-full h-8 bg-red-50/30 border border-red-500 rounded px-2 outline-none text-xs font-mono font-bold text-red-600 focus:border-red-700"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Arrival Date</label>
          <input
            type="date"
            value={formData.date || ''}
            onChange={(e) => handleInputChange('date', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs text-slate-800 focus:border-[#103A20]"
          />
        </div>

        {/* MR / P.O No. */}
        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">MR / P.O No.</label>
          <div className="relative">
            <input
              type="text"
              value={formData.po_no || ''}
              onChange={(e) => handleInputChange('po_no', e.target.value)}
              onFocus={() => setShowPoDropdown(true)}
              onBlur={() => setTimeout(() => setShowPoDropdown(false), 200)}
              placeholder="-- SELECT MR / P.O --"
              className={cn(
                "w-full h-8 rounded px-2 outline-none text-xs font-mono uppercase pr-6 transition-colors",
                formData.po_no 
                  ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                  : "bg-white border border-slate-300"
              )}
            />
            <div
              className="absolute right-1 top-0 bottom-0 w-6 flex items-center justify-center cursor-pointer text-slate-500"
              onMouseDown={(e) => { e.preventDefault(); setShowPoDropdown(!showPoDropdown); }}
            >
              <ChevronDown size={14} />
            </div>
            {showPoDropdown && combinedPoOptions.length > 0 && (
              <div className="absolute top-9 left-0 w-[420px] bg-white border border-slate-300 rounded-lg max-h-60 overflow-y-auto z-[9999] shadow-xl">
                {combinedPoOptions
                  .filter(opt => 
                    !formData.po_no || 
                    opt.po_no.toLowerCase().includes(formData.po_no.toLowerCase()) || 
                    opt.temp_mr_no.toLowerCase().includes(formData.po_no.toLowerCase()) ||
                    opt.display_label.toLowerCase().includes(formData.po_no.toLowerCase())
                  )
                  .map((opt, idx) => (
                    <div
                      key={opt.id || idx}
                      className="px-3 py-2 text-xs font-mono cursor-pointer hover:bg-emerald-50 border-b border-slate-100 last:border-b-0 flex flex-col gap-0.5"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectPoOption(opt);
                      }}
                    >
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <span>{opt.po_no}</span>
                          {opt.temp_mr_no && opt.temp_mr_no !== opt.po_no && (
                            <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-1 rounded">
                              Temp MR #{opt.temp_mr_no}
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {opt.source === 'temporary_material_received' ? '✨ From Temporary MR' : '📋 PO Entry'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center justify-between">
                        <span>{opt.supplier}</span>
                        {opt.lorry_number && <span className="font-semibold text-slate-700">🚛 {opt.lorry_number}</span>}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* PO Date */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">P.O Date</label>
          <input
            type="date"
            value={formData.po_date || ''}
            onChange={(e) => handleInputChange('po_date', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs text-slate-800 focus:border-[#103A20]"
          />
        </div>

        {/* JCI */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">JCI</label>
          <select
            value={formData.jci || 'No'}
            onChange={(e) => handleInputChange('jci', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs font-semibold focus:border-[#103A20]"
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
      </div>

      {/* ROW 2: Suppliers and Transporters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {/* Challan Supplier */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Challan Supplier</label>
          <input
            list="challan-supplier-list"
            type="text"
            value={formData.challan_supplier || ''}
            onChange={(e) => handleInputChange('challan_supplier', e.target.value.toUpperCase())}
            placeholder="Search / Enter Challan Supplier"
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs uppercase focus:border-[#103A20]"
          />
          <datalist id="challan-supplier-list">
            {suppliers.map((s, idx) => (
              <option key={idx} value={s.supp_name || s.name} />
            ))}
          </datalist>
        </div>

        {/* Supplier */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Supplier</label>
          <input
            list="supplier-list"
            type="text"
            value={formData.supplier || ''}
            onChange={(e) => handleInputChange('supplier', e.target.value.toUpperCase())}
            placeholder="Search / Enter Supplier"
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs uppercase focus:border-[#103A20]"
          />
          <datalist id="supplier-list">
            {suppliers.map((s, idx) => (
              <option key={idx} value={s.supp_name || s.name} />
            ))}
          </datalist>
        </div>

        {/* Broker */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Broker</label>
          <input
            list="broker-list"
            type="text"
            value={formData.broker || ''}
            onChange={(e) => handleInputChange('broker', e.target.value.toUpperCase())}
            placeholder="Search / Enter Broker"
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs uppercase focus:border-[#103A20]"
          />
          <datalist id="broker-list">
            {brokers.map((b, idx) => (
              <option key={idx} value={b.brok_name || b.name} />
            ))}
          </datalist>
        </div>

        {/* Transporter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Transporter Name</label>
          <input
            type="text"
            value={formData.transporter_name || ''}
            onChange={(e) => handleInputChange('transporter_name', e.target.value)}
            placeholder="Enter Transporter"
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs focus:border-[#103A20]"
          />
        </div>
      </div>

      {/* ROW 3: Challan, Lorry, PAN, Consignment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Challan/RR No */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Challan / RR No.</label>
          <input
            type="text"
            value={formData.challan_rr_no || formData.challan_railway_receipt_no || ''}
            onChange={(e) => handleInputChange('challan_rr_no', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs font-mono uppercase focus:border-[#103A20]"
          />
        </div>

        {/* Challan/RR Date */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Challan / RR Date</label>
          <input
            type="date"
            value={formData.challan_rr_date || ''}
            onChange={(e) => handleInputChange('challan_rr_date', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs text-slate-800 focus:border-[#103A20]"
          />
        </div>

        {/* Lorry Number */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Lorry Number</label>
          <input
            type="text"
            value={formData.lorry_number || ''}
            onChange={(e) => handleInputChange('lorry_number', e.target.value.toUpperCase())}
            placeholder="WB-XX-XXXX"
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs font-mono font-bold uppercase focus:border-[#103A20]"
          />
        </div>

        {/* PAN / Part No */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">PAN / Part No</label>
          <input
            type="text"
            value={formData.pan_no || formData.part_no || ''}
            onChange={(e) => handleInputChange('pan_no', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs font-mono uppercase focus:border-[#103A20]"
          />
        </div>

        {/* Consignment Note */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Consignment Note</label>
          <input
            type="text"
            value={formData.consignment_note || formData.consignment_note_no || ''}
            onChange={(e) => handleInputChange('consignment_note', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs font-mono uppercase focus:border-[#103A20]"
          />
        </div>

        {/* Consignment Date */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Consignment Date</label>
          <input
            type="date"
            value={formData.consignment_note_date || ''}
            onChange={(e) => handleInputChange('consignment_note_date', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs text-slate-800 focus:border-[#103A20]"
          />
        </div>
      </div>

      {/* ROW 4: DI, Invoice, PTF, Area, Unit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
        {/* DI No */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">DI No</label>
          <input
            type="text"
            value={formData.di_no || ''}
            onChange={(e) => handleInputChange('di_no', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs font-mono uppercase focus:border-[#103A20]"
          />
        </div>

        {/* DI Date */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">DI Date</label>
          <input
            type="date"
            value={formData.di_date || ''}
            onChange={(e) => handleInputChange('di_date', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs text-slate-800 focus:border-[#103A20]"
          />
        </div>

        {/* Invoice No */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Invoice No</label>
          <input
            type="text"
            value={formData.invoice_no || ''}
            onChange={(e) => handleInputChange('invoice_no', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs font-mono uppercase focus:border-[#103A20]"
          />
        </div>

        {/* Invoice Date */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Invoice Date</label>
          <input
            type="date"
            value={formData.invoice_date || ''}
            onChange={(e) => handleInputChange('invoice_date', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs text-slate-800 focus:border-[#103A20]"
          />
        </div>

        {/* PTF */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">PTF</label>
          <select
            value={formData.ptf || 'No'}
            onChange={(e) => handleInputChange('ptf', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs font-semibold focus:border-[#103A20]"
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        {/* Area */}
        <div className="lg:col-span-2">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Area</label>
          <input
            list="area-list"
            type="text"
            value={formData.arrival_area_name || formData.area || ''}
            onChange={(e) => handleAreaChange(e.target.value)}
            placeholder="Search / Enter Area"
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs uppercase focus:border-[#103A20]"
          />
          <datalist id="area-list">
            {areas.map((a, idx) => (
              <option key={idx} value={a.area_name} />
            ))}
          </datalist>
        </div>

        {/* Unit */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Unit</label>
          <select
            value={formData.unit_name || 'BALES'}
            onChange={(e) => handleInputChange('unit_name', e.target.value)}
            className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs font-bold uppercase focus:border-[#103A20]"
          >
            {unitList.map((u, idx) => (
              <option key={idx} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
