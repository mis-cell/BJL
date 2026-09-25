import React from "react";
import { Save } from "lucide-react";
import { cn } from "../../lib/utils";
import { SettlementMaster, SettlementDetailColumn } from "../../types/settlement.types";
import SettlementDeductionsTable from "./SettlementDeductionsTable";

export interface SettlementValuationCardProps {
  masterData: SettlementMaster;
  handleMasterChange: (field: keyof SettlementMaster, value: any) => void;
  detailCols: SettlementDetailColumn[];
  calculateWeightedRatePerMT: (cols: SettlementDetailColumn[]) => number;
  saudaDeductionRecord: any;
  selectedPoNo: string;
  errorMessage: string;
  onExit: () => void;
  onSave: () => void;
}

export const SettlementValuationCard: React.FC<SettlementValuationCardProps> = ({
  masterData,
  handleMasterChange,
  detailCols,
  calculateWeightedRatePerMT,
  saudaDeductionRecord,
  selectedPoNo,
  errorMessage,
  onExit,
  onSave,
}) => {
  return (
    <div className="space-y-2.5">
      {/* 1. Grade-Wise Summary Panel */}
      <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs relative">
        <div className="inline-block bg-[#f4ece1] border border-[#e5dcce] text-[#2d3748] text-[9.5px] font-extrabold uppercase px-2.5 py-0.5 rounded shadow-2xs mb-2">
          GRADE-WISE SUMMARY PANEL
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          {/* Row 1 */}
          <div className="flex flex-col">
            <div className="group relative flex items-center gap-1 mb-0.5">
              <label className="text-[9px] uppercase font-bold text-slate-600">Rate / M.T</label>
              <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
              <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                DB Reference: <code className="text-yellow-400 font-mono">mr_settlement_master.summary_rate_qtel</code>
                <p className="mt-1">Format: Numeric dec. Jute price per 1000 kg (Metric Ton) used to compute the value of the material received.</p>
              </div>
            </div>
            <input
              id="masterdata_summary_rate_qtel"
              name="summary_rate_qtel"
              aria-label="Summary Rate per MT"
              type="number"
              step="0.01"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.summary_rate_qtel || calculateWeightedRatePerMT(detailCols) || ""}
              onChange={(e) => handleMasterChange("summary_rate_qtel", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="rate_aff_cd_cl_input" className="text-[9px] uppercase font-bold text-slate-600 mb-0.5">Rate aff. Cd. Cl</label>
            <input
              id="rate_aff_cd_cl_input"
              name="rate_aff_cd_cl"
              aria-label="Rate aff. Cd. Cl"
              type="number"
              step="0.01"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.summary_rate_aff_cd_cl || ""}
              onChange={(e) => handleMasterChange("summary_rate_aff_cd_cl", parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Row 2 */}
          <div className="flex flex-col">
            <label htmlFor="delivery_claim_input" className="text-[9px] uppercase font-bold text-[#991b1b] mb-0.5">Delivery Claim (-)</label>
            <input
              id="delivery_claim_input"
              name="delivery_claim"
              aria-label="Delivery Claim (-)"
              type="number"
              step="0.01"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#991b1b] shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.summary_delivery_claim || ""}
              onChange={(e) => handleMasterChange("summary_delivery_claim", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex flex-col">
            <div className="group relative flex items-center gap-1 mb-0.5">
              <label className="text-[9px] uppercase font-bold text-[#991b1b]">Moisture (%)</label>
              <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
              <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-52 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                <p className="text-yellow-300 font-bold">Moisture Sensor Average (%)</p>
                <p>Synced directly from mill inspection gate-pass records for this M.R.</p>
              </div>
            </div>
            <input
              id="summary_moisture_rate_wt_claim"
              name="summary_rate_wt_claim"
              aria-label="Moisture %"
              type="number"
              step="0.01"
              className="bg-amber-50/60 border border-amber-300 rounded-md px-2 py-1 h-7 text-right font-mono font-black text-xs text-blue-900 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.summary_rate_wt_claim || ""}
              onChange={(e) => handleMasterChange("summary_rate_wt_claim", parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Row 3 */}
          <div className="flex flex-col">
            <label htmlFor="instl_rate_input" className="text-[9px] uppercase font-bold text-slate-600 mb-0.5">Instl Rate</label>
            <input
              id="instl_rate_input"
              name="instl_rate"
              aria-label="Instl Rate"
              type="number"
              step="0.01"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.summary_instl_rate || ""}
              onChange={(e) => handleMasterChange("summary_instl_rate", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="premium_wt_input" className="text-[9px] uppercase font-bold text-slate-600 mb-0.5">Premium WT (Qtl)</label>
            <input
              id="premium_wt_input"
              name="premium_wt"
              aria-label="Premium WT"
              type="number"
              step="0.01"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.summary_premium_wt !== undefined && masterData.summary_premium_wt !== null ? masterData.summary_premium_wt : (masterData.summary_less_amount || "")}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                handleMasterChange("summary_premium_wt", val);
                handleMasterChange("summary_less_amount", val);
              }}
            />
          </div>

          {/* Row 4 */}
          <div className="flex flex-col col-span-2">
            <label htmlFor="summary_mat_val_input" className="text-[9px] uppercase font-bold text-slate-600 mb-0.5">Mat. Value</label>
            <input
              id="summary_mat_val_input"
              name="material_value"
              aria-label="Mat. Value"
              type="number"
              step="0.01"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.summary_material_value || ""}
              onChange={(e) => handleMasterChange("summary_material_value", parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Row 5 */}
          <div className="flex flex-col">
            <label htmlFor="misc_add_input" className="text-[9px] uppercase font-bold text-[#047857] mb-0.5">Misc Add (+)</label>
            <input
              id="misc_add_input"
              name="misc_add"
              aria-label="Misc Add (+)"
              type="number"
              step="0.01"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#047857] shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.summary_misc_add || ""}
              onChange={(e) => handleMasterChange("summary_misc_add", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="misc_less_input" className="text-[9px] uppercase font-bold text-[#991b1b] mb-0.5">Misc Less (-)</label>
            <input
              id="misc_less_input"
              name="misc_less"
              aria-label="Misc Less (-)"
              type="number"
              step="0.01"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#991b1b] shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.summary_misc_less || ""}
              onChange={(e) => handleMasterChange("summary_misc_less", parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Row 6 */}
          <div className="flex flex-col">
            <label htmlFor="summary_premium_rate_input" className="text-[9px] uppercase font-bold text-slate-600 mb-0.5">Premium Rate (₹/Qtl)</label>
            <input
              id="summary_premium_rate_input"
              name="summary_premium_rate"
              aria-label="Premium Rate"
              type="number"
              step="0.01"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.summary_premium_amount || ""}
              onChange={(e) => handleMasterChange("summary_premium_amount", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="addtl_claims_input" className="text-[9px] uppercase font-bold text-[#991b1b] mb-0.5">Addtl Quality Claims (Qtl)</label>
            <input
              id="addtl_claims_input"
              name="addtl_quality_claims"
              aria-label="Addtl Quality claims"
              type="number"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#991b1b] shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.summary_less_amount || ""}
              onChange={(e) => handleMasterChange("summary_less_amount", parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Deductions Breakdown Table */}
          <SettlementDeductionsTable masterData={masterData} />

          {/* Deduction Amount Input */}
          <div className="flex flex-col col-span-2">
            <label htmlFor="summary_deduction_amount_input" className="text-[9px] uppercase font-extrabold text-[#991b1b] mb-0.5">Deduction Amount (-)</label>
            <input
              id="summary_deduction_amount_input"
              name="summary_deduction_amount"
              aria-label="Deduction Amount (-)"
              type="number"
              step="0.01"
              className="bg-[#fff1f2] border border-[#fecdd3] rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#991b1b] shadow-2xs focus:outline-none w-full"
              value={masterData.summary_deduction_amount || ""}
              onChange={(e) => handleMasterChange("summary_deduction_amount", parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* 2. M.R. Valuation Matrix */}
      <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs relative">
        <div className="inline-block bg-[#f4ece1] border border-[#e5dcce] text-[#2d3748] text-[9.5px] font-extrabold uppercase px-2.5 py-0.5 rounded shadow-2xs mb-2">
          M.R. VALUATION MATRIX
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          <div className="flex flex-col">
            <label htmlFor="val_material_value_input" className="text-[9px] font-bold text-slate-600 mb-0.5">Material Value</label>
            <input
              id="val_material_value_input"
              name="val_material_value"
              aria-label="Material Value"
              type="number"
              disabled
              className="bg-[#f1f5f9] border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-900 shadow-2xs w-full"
              value={Number(masterData.val_material_value || 0).toFixed(2)}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="val_add_amt_input" className="text-[9px] font-bold text-[#047857] mb-0.5">Add Amt(+)</label>
            <input
              id="val_add_amt_input"
              name="val_add_amt"
              aria-label="Add Amt(+)"
              type="number"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#047857] shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.val_add_amt || ""}
              onChange={(e) => handleMasterChange("val_add_amt", parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Val Less Amt with Sauda Checkpoint Info */}
          <div className="flex flex-col col-span-1">
            <div className="group relative flex items-center justify-between gap-1 mb-0.5">
              <div className="flex items-center gap-1">
                <label htmlFor="val_less_amt_input" className="text-[9px] font-bold text-slate-600">Val Less Amt(-)</label>
                <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-64 bg-slate-900 text-white p-2 text-[8.5px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                  <p className="text-amber-300 font-bold">Sauda Checkpoint Deduction</p>
                  <p>Table: <code className="text-cyan-300">sauda_check_point_deductions</code></p>
                  <p>PO Lookup: <code className="text-white">{selectedPoNo || masterData.po_no || "N/A"}</code></p>
                  {saudaDeductionRecord ? (
                    <>
                      <p>Reason: <span className="text-amber-300 font-bold uppercase">{saudaDeductionRecord.variation_type || "N/A"}</span></p>
                      <p>Deduction Amount: <span className="text-emerald-300 font-bold font-mono">₹{Number(saudaDeductionRecord.deduction_amount || 0).toFixed(2)}</span></p>
                      <p>Quantity: <span className="text-white">{saudaDeductionRecord.deduction_qty_mt} MT</span></p>
                      <p className="text-amber-200 text-[7.5px] mt-1 border-t border-slate-700 pt-1 italic">* Applied on Last Final M.R.</p>
                    </>
                  ) : (
                    <p className="text-slate-400 italic">No checkpoint deduction for this M.R.</p>
                  )}
                </div>
              </div>

              {saudaDeductionRecord && (
                <span className={cn(
                  "text-[7.5px] font-black px-1.5 py-0.2 rounded uppercase border shrink-0",
                  saudaDeductionRecord.variation_type === "excess"
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-rose-100 text-rose-900 border-rose-300"
                )}>
                  {saudaDeductionRecord.variation_type === "excess" ? "Excess Wt" : "Short Wt"}
                </span>
              )}
            </div>

            <input
              id="val_less_amt_input"
              name="val_less_amt"
              aria-label="Val Less Amt(-)"
              type="number"
              step="0.01"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.val_less_amt || ""}
              onChange={(e) => handleMasterChange("val_less_amt", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex flex-col">
            <div className="group relative flex items-center gap-1 mb-0.5">
              <label className="text-[9px] font-bold text-slate-600">Premium Amt (+)</label>
              <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
              <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-56 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                <p className="text-yellow-300 font-bold">Total Premium Amount</p>
                <p>Formula: Premium Rate × Premium WT (Qtl)</p>
                <p><code className="text-cyan-300">₹{masterData.summary_premium_amount || 0}/Qtl × {(masterData.summary_premium_wt !== undefined && masterData.summary_premium_wt !== null && Number(masterData.summary_premium_wt) > 0 ? masterData.summary_premium_wt : (masterData.summary_less_amount || 0))} Qtl</code></p>
              </div>
            </div>
            <input
              id="val_premium_amt_input"
              name="val_premium_amt"
              aria-label="Premium Amt (+)"
              type="number"
              step="0.01"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.val_premium_amt || ""}
              onChange={(e) => handleMasterChange("val_premium_amt", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="ded_claim_total_input" className="text-[9px] font-bold text-[#991b1b] mb-0.5">Ded Claim Total (-)</label>
            <input
              id="ded_claim_total_input"
              name="ded_claim_total"
              aria-label="Ded Claim Total (-)"
              type="number"
              disabled
              className="bg-[#fff1f2] border border-[#fecdd3] rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#991b1b] shadow-2xs w-full"
              value={(0).toFixed(2)}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="qty_claim_input" className="text-[9px] font-bold text-slate-600 mb-0.5">Qty Claim</label>
            <input
              id="qty_claim_input"
              name="qty_claim"
              aria-label="Qty Claim"
              type="number"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.val_qty_claim || ""}
              onChange={(e) => handleMasterChange("val_qty_claim", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex flex-col col-span-2">
            <label htmlFor="ex_short_input" className="text-[9px] font-bold text-slate-600 mb-0.5">Ex/Short (-)</label>
            <input
              id="ex_short_input"
              name="ex_short"
              aria-label="Ex/Short (-)"
              type="number"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.val_ex_short || ""}
              onChange={(e) => handleMasterChange("val_ex_short", parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* 3. Final MR Net Value */}
      <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs relative">
        <div className="inline-block bg-[#f4ece1] border border-[#e5dcce] text-[#2d3748] text-[9.5px] font-extrabold uppercase px-2.5 py-0.5 rounded shadow-2xs mb-2">
          FINAL MR NET VALUE
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          <div className="flex flex-col">
            <label htmlFor="less_adv_input" className="text-[9px] font-bold text-slate-600 mb-0.5">Less Adv (-)</label>
            <input
              id="less_adv_input"
              name="less_adv"
              aria-label="Less Adv (-)"
              type="number"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.final_less_adv || ""}
              onChange={(e) => handleMasterChange("final_less_adv", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="on_ac_adv_input" className="text-[9px] font-bold text-slate-600 mb-0.5">On/Ac Adv</label>
            <input
              id="on_ac_adv_input"
              name="on_ac_adv"
              aria-label="On/Ac Adv"
              type="number"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              value={masterData.final_on_ac_adv || ""}
              onChange={(e) => handleMasterChange("final_on_ac_adv", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="apmc_fees_input" className="text-[9px] font-bold text-slate-600 mb-0.5">APMC Fees</label>
            <input
              id="apmc_fees_input"
              name="apmc_fees"
              aria-label="APMC Fees"
              type="number"
              disabled
              className="bg-[#f1f5f9] border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-900 shadow-2xs w-full"
              value={((Number(masterData.arival_apmc_fees) || 0) - (Number(masterData.actual_apmc_fees) || 0)).toFixed(2)}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="cst_tax_input" className="text-[9px] font-bold text-slate-600 mb-0.5">C.S.T. (Tax) %</label>
            <input
              id="cst_tax_input"
              name="c_s_t_tax"
              aria-label="C.S.T. (Tax) %"
              type="number"
              className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
              placeholder="e.g. 5"
              value={masterData.final_cst_pct_amt || ""}
              onChange={(e) => handleMasterChange("final_cst_pct_amt", parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* 4. Net Settle Outflow Payable */}
      <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs relative">
        <div className="inline-block bg-[#f4ece1] border border-[#e5dcce] text-[#2d3748] text-[9.5px] font-extrabold uppercase px-2.5 py-0.5 rounded shadow-2xs mb-2">
          NET SETTLE OUTFLOW PAYABLE
        </div>

        <div className="space-y-2 font-bold text-xs">
          <div className="bg-[#0b1329] rounded-md p-2.5 text-center border border-slate-800 shadow-inner">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <label className="text-[8.5px] uppercase tracking-wider font-extrabold text-[#00e676]">RESOLVED PAYABLE ACCOUNT</label>
            </div>
            <div className="text-xl font-black font-mono text-[#00e676] tracking-wide">
              ₹ {Number(masterData.payable_amt || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Bill No & Bill Date */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col">
              <label htmlFor="payable_bill_no_input" className="text-[9px] font-bold text-slate-700 mb-0.5 flex items-center justify-between">
                <span>Bill No. <span className="text-rose-600">*</span></span>
                <span className="text-rose-500 font-bold text-[8px]">Mandatory</span>
              </label>
              <input
                id="payable_bill_no_input"
                name="bill_no"
                aria-label="Bill No."
                type="text"
                required
                placeholder="e.g. BILL-101"
                className={cn(
                  "bg-white border rounded-md px-2 py-1 h-7 font-mono uppercase font-bold text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-none w-full",
                  !masterData.payable_bill_no && errorMessage.includes("Bill No.") ? "border-rose-500 bg-rose-50/50 ring-1 ring-rose-500" : "border-slate-300"
                )}
                value={masterData.payable_bill_no || ""}
                onChange={(e) => handleMasterChange("payable_bill_no", e.target.value)}
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="payable_bill_date_input" className="text-[9px] font-bold text-slate-700 mb-0.5 flex items-center justify-between">
                <span>Bill Date <span className="text-rose-600">*</span></span>
                <span className="text-rose-500 font-bold text-[8px]">Mandatory</span>
              </label>
              <input
                id="payable_bill_date_input"
                name="bill_date"
                aria-label="Bill Date"
                type="date"
                required
                className={cn(
                  "bg-white border rounded-md px-2 py-1 h-7 font-mono font-bold text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-none w-full",
                  !masterData.payable_bill_date && errorMessage.includes("Bill Date") ? "border-rose-500 bg-rose-50/50 ring-1 ring-rose-500" : "border-slate-300"
                )}
                value={masterData.payable_bill_date || ""}
                onChange={(e) => handleMasterChange("payable_bill_date", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={onExit}
          className="bg-white hover:bg-slate-50 border-2 border-slate-700 rounded-md py-2 text-xs font-bold uppercase text-slate-800 tracking-wider shadow-xs transition-all active:scale-[0.98] text-center cursor-pointer"
        >
          EXIT GATE
        </button>
        <button
          type="button"
          onClick={onSave}
          className="bg-[#000080] hover:bg-blue-950 border-2 border-[#000080] rounded-md py-2 text-xs font-bold uppercase text-white tracking-wider shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Save className="h-4 w-4 text-green-300" />
          SETTLE ACCOUNT
        </button>
      </div>
    </div>
  );
};

export default SettlementValuationCard;
