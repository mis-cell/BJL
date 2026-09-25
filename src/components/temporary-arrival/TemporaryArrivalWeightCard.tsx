import React from 'react';

export interface TemporaryArrivalWeightCardProps {
  formData: any;
  onChange: (e: any) => void;
}

export const TemporaryArrivalWeightCard: React.FC<TemporaryArrivalWeightCardProps> = ({
  formData,
  onChange
}) => {
  return (
    <div className="w-full rounded-xl border border-[#174C2C] bg-white shadow-md overflow-hidden mt-5">
      {/* Header */}
      <div className="bg-[#174C2C] text-white px-4 py-2 border-b border-[#0F351E]">
        <h3 className="text-sm font-bold tracking-wide uppercase">
          Weight Information
        </h3>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-x divide-gray-300">
        {/* 1st: Gross Weight */}
        <div className="p-3 space-y-2">
          <h4 className="text-[11px] font-bold text-[#174C2C] border-b border-gray-300 pb-1 uppercase">
            Gross Weight
          </h4>

          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold">CHALLAN GROSS</span>
            <input
              id="actual_gross_weight_1948"
              aria-label="actual gross weight"
              type="number"
              step="0.001"
              name="actual_gross_weight"
              value={formData.actual_gross_weight || ""}
              onChange={onChange}
              className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold">MILL GROSS</span>
            <input
              id="supplier_challan_gross_1960"
              aria-label="supplier challan gross"
              type="number"
              step="0.001"
              name="supplier_challan_gross"
              value={formData.supplier_challan_gross || ""}
              onChange={onChange}
              className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold">ELECTRONIC GROSS</span>
            <input
              id="electronic_gross_weight_1972"
              aria-label="electronic gross weight"
              type="number"
              step="0.001"
              name="electronic_gross_weight"
              value={formData.electronic_gross_weight || ""}
              onChange={onChange}
              className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
            />
          </div>
        </div>

        {/* 2nd: Tare Weight */}
        <div className="p-3 space-y-2">
          <h4 className="text-[11px] font-bold text-[#174C2C] border-b border-gray-300 pb-1 uppercase">
            Tare Weight
          </h4>

          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold">CHALLAN TARE</span>
            <input
              id="actual_tare_weight_1991"
              aria-label="actual tare weight"
              type="number"
              step="0.001"
              name="actual_tare_weight"
              value={formData.actual_tare_weight || ""}
              onChange={onChange}
              className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold">MILL TARE</span>
            <input
              id="supplier_tare_weight_2003"
              aria-label="supplier tare weight"
              type="number"
              step="0.001"
              name="supplier_tare_weight"
              value={formData.supplier_tare_weight || ""}
              onChange={onChange}
              className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold">ELECTRONIC TARE</span>
            <input
              id="electronic_tare_weight_2015"
              aria-label="electronic tare weight"
              type="number"
              step="0.001"
              name="electronic_tare_weight"
              value={formData.electronic_tare_weight || ""}
              onChange={onChange}
              className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
            />
          </div>
        </div>

        {/* 3rd: Net Weight */}
        <div className="p-3 space-y-2">
          <h4 className="text-[11px] font-bold text-[#174C2C] border-b border-gray-300 pb-1 uppercase">
            Net Weight
          </h4>

          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold">CHALLAN WT</span>
            <input
              id="challan_material_weight_1905"
              aria-label="challan material weight"
              type="number"
              step="0.001"
              name="challan_material_weight"
              value={formData.challan_material_weight || 0}
              onChange={onChange}
              className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold">MILL NET</span>
            <input
              id="supplier_net_weight_1917"
              aria-label="supplier net weight"
              type="number"
              step="0.001"
              name="supplier_net_weight"
              value={formData.supplier_net_weight || 0}
              onChange={onChange}
              className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold">ELECTRONIC NET</span>
            <input
              id="electronic_net_weight_1929"
              aria-label="electronic net weight"
              type="number"
              step="0.001"
              name="electronic_net_weight"
              value={formData.electronic_net_weight || 0}
              onChange={onChange}
              className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-300 bg-gray-50 px-4 py-2 flex justify-center items-center gap-3">
        <span className="text-[11px] font-bold text-[#174C2C] uppercase">
          Final Weight (M.Ton)
        </span>

        <input
          id="weight_reduced_2034"
          aria-label="final weight"
          type="number"
          step="0.001"
          name="weight_reduced"
          value={formData.weight_reduced || ""}
          onChange={onChange}
          className="w-32 h-8 border border-red-300 rounded bg-white text-right px-2 font-black font-mono text-red-700"
        />
      </div>
    </div>
  );
};
