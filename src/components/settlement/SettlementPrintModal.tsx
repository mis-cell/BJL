import React from "react";
import PrintModal from "../PrintModal";
import { SettlementMaster, SettlementDetailColumn, getColWtMt, getColAmount } from "../../types/settlement.types";

export interface SettlementPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewModalData: {
    master: SettlementMaster;
    details: SettlementDetailColumn[];
  } | null;
  resolveGradeName?: (grade: string) => string;
}

export const SettlementPrintModal: React.FC<SettlementPrintModalProps> = ({
  isOpen,
  onClose,
  viewModalData,
  resolveGradeName = (g: string) => g,
}) => {
  if (!isOpen || !viewModalData) return null;

  return (
    <PrintModal
      isOpen={isOpen}
      onClose={onClose}
      title={`SETTLEMENT STATEMENT - M.R. #${viewModalData.master.mr_no || 'N/A'}`}
    >
      <div id="print-modal-children-canvas" className="p-6 bg-white text-slate-900 font-sans space-y-4">
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-3 text-center">
          <h2 className="text-xl font-black tracking-wide text-[#2a3088] uppercase">BALLY JUTE COMPANY LIMITED</h2>
          <p className="text-[11px] text-slate-600 font-medium">P.O. BALLY, DIST: HOWRAH, WEST BENGAL - 711201</p>
          <div className="inline-block mt-2 bg-slate-900 text-white text-xs font-black uppercase px-4 py-1 tracking-wider rounded-xs">
            M.R. SETTLEMENT &amp; QUALITY AUDIT STATEMENT
          </div>
        </div>

        {/* Top Summary Info */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 bg-slate-50 border border-slate-300 p-3 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">M.R. Number</span>
            <span className="font-mono font-black text-rose-700 text-sm">{viewModalData.master.mr_no || '-'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Settlement Date</span>
            <span className="font-bold">{viewModalData.master.sett_date || '-'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Purchase Order No</span>
            <span className="font-mono font-bold text-blue-800">{viewModalData.master.po_no || '-'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Lorry / Vehicle No</span>
            <span className="font-mono font-bold">{viewModalData.master.lorry_number || '-'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Moisture (%)</span>
            <span className="font-mono font-black text-blue-900">
              {Number(viewModalData.master.summary_rate_wt_claim || 0) > 0 ? `${Number(viewModalData.master.summary_rate_wt_claim).toFixed(2)}%` : '-'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Supplier Name</span>
            <span className="font-bold text-slate-800 uppercase">{viewModalData.master.supplier || '-'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Broker Name</span>
            <span className="font-bold text-slate-700">{viewModalData.master.broker || '-'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Bill No &amp; Date</span>
            <span className="font-mono">
              {viewModalData.master.payable_bill_no ? `${viewModalData.master.payable_bill_no} (${viewModalData.master.payable_bill_date || '-'})` : '-'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Payment Status</span>
            <span className="font-bold uppercase text-emerald-700">{viewModalData.master.payment_status || 'Settled'}</span>
          </div>
        </div>

        {/* Quality & Grade Specification Table */}
        <div className="space-y-1">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
            1. Material Quality &amp; Specification Breakdown
          </h4>
          <div className="border border-slate-300 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-black uppercase text-slate-700">
                  <th className="p-1.5 border-r border-slate-300">Col #</th>
                  <th className="p-1.5 border-r border-slate-300">Grade</th>
                  <th className="p-1.5 border-r border-slate-300">Area</th>
                  <th className="p-1.5 border-r border-slate-300">Agency</th>
                  <th className="p-1.5 border-r border-slate-300">Marka</th>
                  <th className="p-1.5 border-r border-slate-300 text-center">Moisture (%)</th>
                  <th className="p-1.5 border-r border-slate-300 text-right">Quantity</th>
                  <th className="p-1.5 border-r border-slate-300 text-right">Weight (MT)</th>
                  <th className="p-1.5 border-r border-slate-300 text-right">Rate (₹/Qtl)</th>
                  <th className="p-1.5 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {viewModalData.details.filter(c => (Number(c.quantity) > 0 || Number(c.arr_qty_wt) > 0 || Number(c.rate_value) > 0)).map((col, idx) => {
                  const wtMt = getColWtMt(col);
                  const amt = getColAmount(col);
                  const moistVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-1.5 border-r border-slate-200 font-bold">{col.col_index || idx + 1}</td>
                      <td className="p-1.5 border-r border-slate-200 font-bold text-blue-900">{resolveGradeName(col.grade)}</td>
                      <td className="p-1.5 border-r border-slate-200">{col.area || '-'}</td>
                      <td className="p-1.5 border-r border-slate-200">{col.agency || '-'}</td>
                      <td className="p-1.5 border-r border-slate-200">{col.marka_crop || '-'}</td>
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold text-blue-950">
                        {moistVal > 0 ? `${moistVal.toFixed(2)}%` : (Number(viewModalData.master.summary_rate_wt_claim) > 0 ? `${Number(viewModalData.master.summary_rate_wt_claim).toFixed(2)}%` : '-')}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono">{col.quantity || 0}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold">{wtMt.toFixed(3)}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono">₹{Number(col.rate_value || 0).toFixed(2)}</td>
                      <td className="p-1.5 text-right font-mono font-black text-slate-900">₹{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* DEDUCTION BREAKDOWN */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between border-b border-slate-300 pb-1">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">
              2. Deduction Breakdown
            </h4>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Inspection Deductions &amp; Penalties
            </span>
          </div>
          
          <div className="border border-[#cbd5e1] rounded-lg overflow-hidden bg-white shadow-xs">
            <table className="w-full text-xs text-left border-collapse font-sans">
              <thead>
                <tr className="bg-[#eef3f9] border-b-2 border-[#2563eb] text-[11px] font-black uppercase text-slate-800 tracking-wider">
                  <th className="py-2.5 px-4 border-r border-[#cbd5e1] text-left w-7/12">
                    DEDUCTION TYPE
                  </th>
                  <th className="py-2.5 px-4 border-r border-[#cbd5e1] text-center w-3/12">
                    DEDUCTION RATE (₹)
                  </th>
                  <th className="py-2.5 px-4 text-center w-2/12">
                    QTY
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#cbd5e1]">
                {(() => {
                  const deds = (viewModalData.master.deductions && Array.isArray(viewModalData.master.deductions))
                    ? viewModalData.master.deductions.filter((d: any) => d && ((d.deduction_type && !String(d.deduction_type).includes('-- SELECT')) || Number(d.deduction_rate) > 0 || Number(d.deduction_amount) > 0))
                    : [];

                  if (deds.length === 0) {
                    return (
                      <tr>
                        <td colSpan={3} className="py-3.5 px-4 text-center text-xs font-semibold text-slate-400 italic bg-slate-50/40">
                          No Deductions or Penalties Applied (₹0.00)
                        </td>
                      </tr>
                    );
                  }

                  return deds.map((dItem, dIdx) => {
                    const rate = Number(dItem.deduction_rate) || 0;
                    const qty = Number(dItem.deduction_qty) || (rate > 0 ? 1 : 0);

                    return (
                      <tr key={dIdx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 border-r border-[#cbd5e1] font-bold text-xs text-slate-900 uppercase">
                          {dItem.deduction_type || '-'}
                        </td>
                        <td className="py-3 px-4 border-r border-[#cbd5e1] text-center font-mono font-bold text-xs text-slate-900">
                          ₹{rate}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-xs text-slate-900">
                          {qty}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-[#cbd5e1] font-bold text-xs text-slate-700">
                  <td className="py-2 px-4 border-r border-[#cbd5e1] text-right font-black uppercase text-[10px] text-slate-600">
                    Total Deduction Subtracted (-):
                  </td>
                  <td colSpan={2} className="py-2 px-4 text-center font-mono font-black text-xs text-[#991b1b]">
                    ₹ {Number(viewModalData.master.summary_deduction_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Financial Summary & Payable Calculation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-300 p-3 rounded-xs text-xs">
          <div className="space-y-1.5">
            <p className="font-black text-slate-700 uppercase text-[10px] border-b border-slate-200 pb-1">Valuation Calculations</p>
            <div className="flex justify-between">
              <span className="text-slate-600">Material Value (+):</span>
              <span className="font-mono font-bold">₹ {Number(viewModalData.master.val_material_value || viewModalData.master.summary_material_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Additional Charges (+):</span>
              <span className="font-mono font-bold">₹ {Number(viewModalData.master.val_add_amt || viewModalData.master.summary_misc_add || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Premium Amount (+):</span>
              <span className="font-mono font-bold text-emerald-700">₹ {Number(viewModalData.master.val_premium_amt || viewModalData.master.summary_premium_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Quality Claims &amp; Deductions (-):</span>
              <span className="font-mono font-bold text-rose-700">₹ {Number(viewModalData.master.summary_deduction_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="space-y-1.5 md:border-l md:border-slate-300 md:pl-4">
            <p className="font-black text-slate-700 uppercase text-[10px] border-b border-slate-200 pb-1">Final Settlement Outflow</p>
            <div className="flex justify-between">
              <span className="text-slate-600">Less Advance (-):</span>
              <span className="font-mono font-bold">₹ {Number(viewModalData.master.final_less_adv || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">On Account Advance (-):</span>
              <span className="font-mono font-bold">₹ {Number(viewModalData.master.final_on_ac_adv || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">APMC Fees (-):</span>
              <span className="font-mono font-bold">₹ {Number(viewModalData.master.final_apmc_fees || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-slate-300 text-sm">
              <span className="font-black uppercase text-slate-900">Net Payable Amount:</span>
              <span className="font-mono font-black text-emerald-800">₹ {Number(viewModalData.master.payable_amt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Signature Area */}
        <div className="pt-6 grid grid-cols-2 gap-12 text-center text-xs font-bold text-slate-700">
          <div className="border-t border-slate-400 pt-1">Prepared By</div>
          <div className="border-t border-slate-400 pt-1">Quality Inspector</div>
        </div>
      </div>
    </PrintModal>
  );
};

export default SettlementPrintModal;
