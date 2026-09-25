import React from "react";
import { Calculator } from "lucide-react";
import { LegacyFieldset } from "../LegacyLayout";
import {
  SettlementDetailColumn,
  SettlementMaster,
  getColWtMt,
  getColAmount,
} from "../../types/settlement.types";

export interface SettlementSpecificationsGridProps {
  detailCols: SettlementDetailColumn[];
  handleColChange: (index: number, field: keyof SettlementDetailColumn, value: any) => void;
  visibleSpecCols: number[];
  visibleDeductionCols: number[];
  showAllSpecCols: boolean;
  setShowAllSpecCols: (val: boolean) => void;
  showAllDeductionCols: boolean;
  setShowAllDeductionCols: (val: boolean) => void;
  masterData: SettlementMaster;
  selectedPoData: any;
  calculateWeightedRatePerMT: (cols: SettlementDetailColumn[]) => number;
}

export const SettlementSpecificationsGrid: React.FC<SettlementSpecificationsGridProps> = ({
  detailCols,
  handleColChange,
  visibleSpecCols,
  visibleDeductionCols,
  showAllSpecCols,
  setShowAllSpecCols,
  showAllDeductionCols,
  setShowAllDeductionCols,
  masterData,
  selectedPoData,
  calculateWeightedRatePerMT,
}) => {
  return (
    <div className="space-y-3">
      {/* Grid 1: Vertical Spec Table */}
      <div className="flex items-center justify-between pb-1 px-1">
        <span className="text-[9.5px] text-gray-600 font-bold uppercase tracking-wider">
          Settlement Columns {visibleSpecCols.length < 4 ? `(${visibleSpecCols.length} Active with Arr. Wt)` : ""}
        </span>
        <button
          type="button"
          onClick={() => setShowAllSpecCols(!showAllSpecCols)}
          className="text-[9px] px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold cursor-pointer transition-colors shadow-2xs"
        >
          {showAllSpecCols ? "Hide Unarrived Columns" : "Show All 4 Columns"}
        </button>
      </div>

      <div className="bg-white border border-gray-400 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse font-sans text-[10px]">
          <thead>
            <tr className="bg-[#e4dfd8] border-b border-gray-400 text-center font-black uppercase text-gray-700">
              <th className="px-2 py-1.5 border-r border-gray-300 w-24">Grade Spec</th>
              {visibleSpecCols.map((idx, colPos) => (
                <th
                  key={idx}
                  className={`px-2 py-1.5 ${colPos < visibleSpecCols.length - 1 ? "border-r border-gray-300" : ""}`}
                >
                  Column {idx} {detailCols[idx - 1]?.grade ? `(${detailCols[idx - 1]?.grade})` : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300 font-bold">
            {/* Grade */}
            <tr className="hover:bg-slate-50">
              <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Grade</td>
              {visibleSpecCols.map((idx) => (
                <td key={idx} className="p-0.5 border-r border-gray-200">
                  <input
                    id={`grade_name_col_${idx}`}
                    name={`grade_name_col_${idx}`}
                    aria-label={`Grade Name Col ${idx}`}
                    type="text"
                    className="w-full bg-transparent p-1 outline-none text-center font-black text-slate-800"
                    placeholder="Grade Name"
                    value={detailCols[idx - 1]?.grade || ""}
                    onChange={(e) => handleColChange(idx, "grade", e.target.value)}
                  />
                </td>
              ))}
            </tr>

            {/* Area */}
            <tr className="hover:bg-slate-50">
              <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Area</td>
              {visibleSpecCols.map((idx) => (
                <td key={idx} className="p-0.5 border-r border-gray-200">
                  <input
                    id={`area_col_${idx}`}
                    name={`area_col_${idx}`}
                    aria-label={`Area Col ${idx}`}
                    type="text"
                    className="w-full bg-transparent p-1 outline-none text-center"
                    placeholder="Area"
                    value={detailCols[idx - 1]?.area || ""}
                    onChange={(e) => handleColChange(idx, "area", e.target.value)}
                  />
                </td>
              ))}
            </tr>

            {/* Agency */}
            <tr className="hover:bg-slate-50">
              <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Agency</td>
              {visibleSpecCols.map((idx) => (
                <td key={idx} className="p-0.5 border-r border-gray-200">
                  <input
                    id={`agency_col_${idx}`}
                    name={`agency_col_${idx}`}
                    aria-label={`Agency Col ${idx}`}
                    type="text"
                    className="w-full bg-transparent p-1 outline-none text-center"
                    placeholder="Agency"
                    value={detailCols[idx - 1]?.agency || ""}
                    onChange={(e) => handleColChange(idx, "agency", e.target.value)}
                  />
                </td>
              ))}
            </tr>

            {/* Marka/Crop */}
            <tr className="hover:bg-slate-50">
              <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Marka/Crop</td>
              {visibleSpecCols.map((idx) => (
                <td key={idx} className="p-0.5 border-r border-gray-200">
                  <input
                    id={`marka_crop_col_${idx}`}
                    name={`marka_crop_col_${idx}`}
                    aria-label={`Marka/Crop Col ${idx}`}
                    type="text"
                    className="w-full bg-transparent p-1 outline-none text-center text-[9px] font-mono"
                    placeholder="Marka/Crop"
                    value={detailCols[idx - 1]?.marka_crop || ""}
                    onChange={(e) => handleColChange(idx, "marka_crop", e.target.value)}
                  />
                </td>
              ))}
            </tr>

            {/* Quantity */}
            <tr className="hover:bg-slate-50">
              <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 text-rose-800 uppercase">Quantity (B)</td>
              {visibleSpecCols.map((idx) => (
                <td key={idx} className="p-0.5 border-r border-gray-200">
                  <input
                    id={`quantity_col_${idx}`}
                    name={`quantity_col_${idx}`}
                    aria-label={`Quantity Col ${idx}`}
                    type="number"
                    className="w-full bg-transparent p-1 outline-none text-center font-mono font-bold text-rose-800 bg-rose-50/40"
                    placeholder="0"
                    value={detailCols[idx - 1]?.quantity || ""}
                    onChange={(e) => handleColChange(idx, "quantity", parseInt(e.target.value) || 0)}
                  />
                </td>
              ))}
            </tr>

            {/* Arr. Qty/Wt */}
            <tr className="hover:bg-slate-50">
              <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Arr. Qty/Wt</td>
              {visibleSpecCols.map((idx) => (
                <td key={idx} className="p-0.5 border-r border-gray-200">
                  <input
                    id={`arr_qty_wt_col_${idx}`}
                    name={`arr_qty_wt_col_${idx}`}
                    aria-label={`Arr Qty Wt Col ${idx}`}
                    type="number"
                    className="w-full bg-transparent p-1 outline-none text-center font-mono"
                    placeholder="0.000"
                    value={detailCols[idx - 1]?.arr_qty_wt || ""}
                    onChange={(e) => handleColChange(idx, "arr_qty_wt", parseFloat(e.target.value) || 0)}
                  />
                </td>
              ))}
            </tr>

            {/* Min.Qty/Wt */}
            <tr className="hover:bg-slate-50">
              <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-bold">
                <div className="flex flex-col">
                  <span>Min.Qty/Wt</span>
                  <span className="text-[7.5px] text-gray-400 font-normal lowercase">(3% acceptable)</span>
                </div>
              </td>
              {visibleSpecCols.map((idx) => (
                <td key={idx} className="p-0.5 border-r border-gray-200">
                  <input
                    id={`min_qty_wt_${idx}`}
                    name={`min_qty_wt_${idx}`}
                    aria-label={`Min.Qty/Wt Col ${idx}`}
                    type="number"
                    step="0.001"
                    className="w-full bg-transparent p-1 outline-none text-center font-mono font-bold text-slate-700"
                    placeholder="0.000"
                    value={detailCols[idx - 1]?.min_qty_wt || ""}
                    onChange={(e) => handleColChange(idx, "min_qty_wt", parseFloat(e.target.value) || 0)}
                  />
                </td>
              ))}
            </tr>

            {/* Wt/Quantity */}
            <tr className="bg-indigo-50/40 hover:bg-indigo-50 font-black">
              <td className="px-2 py-1 border-r border-gray-200 uppercase text-indigo-900">
                <div className="flex flex-col">
                  <span>Wt/Quantity</span>
                  <span className="text-[7.5px] text-indigo-700 font-normal lowercase">(Round Kg / Qty)</span>
                </div>
              </td>
              {visibleSpecCols.map((idx) => {
                const col = detailCols[idx - 1];
                const qty = Number(col?.quantity) || 0;
                const arrWt = Number(col?.arr_qty_wt) || 0;
                const wtPerQty =
                  qty > 0 && arrWt > 0
                    ? Math.round((arrWt <= 50 ? arrWt * 1000 : arrWt) / qty)
                    : Number(col?.wt_quantity) || Number(col?.wt_phota) || 0;
                return (
                  <td key={idx} className="p-1 border-r border-gray-200 text-center font-mono font-black text-indigo-950 text-xs">
                    {wtPerQty > 0 ? `${wtPerQty} kg` : "-"}
                  </td>
                );
              })}
            </tr>

            {/* Recon Rate */}
            <tr className="bg-indigo-50/40 hover:bg-slate-50 font-black">
              <td className="px-2 py-1 border-r border-gray-200 uppercase text-indigo-900">
                Recon Rate
              </td>
              {visibleSpecCols.map((idx) => (
                <td key={idx} className="p-0.5 border-r border-gray-200">
                  <input
                    id={`recon_rate_${idx}`}
                    name={`recon_rate_${idx}`}
                    aria-label={`₹ Rate Col ${idx}`}
                    type="number"
                    className="w-full bg-white text-center p-0.5 font-mono text-indigo-950 font-bold border border-indigo-200 text-[10px]"
                    placeholder="₹ Rate"
                    value={detailCols[idx - 1]?.rate_value || ""}
                    onChange={(e) => handleColChange(idx, "rate_value", parseFloat(e.target.value) || 0)}
                  />
                </td>
              ))}
            </tr>

            {/* Calculated Column Amount */}
            <tr className="bg-[#eef7f2] hover:bg-[#e2f0e8] font-black border-t border-emerald-300">
              <td className="px-2 py-1 border-r border-gray-300 uppercase text-emerald-950 font-extrabold flex items-center justify-between text-[10px] bg-[#e2f0e8]">
                <span>Recon Amount</span>
                <span className="text-[8.5px] text-emerald-800 font-mono">(₹)</span>
              </td>
              {visibleSpecCols.map((idx) => {
                const colAmt = getColAmount(
                  detailCols[idx - 1],
                  Number(masterData.rate_qntl) || Number(selectedPoData?.b_rate) || 0
                );
                return (
                  <td key={idx} className="p-1 border-r border-gray-300 text-center font-mono font-bold text-emerald-950 text-[11px] bg-[#eef7f2]">
                    ₹{colAmt.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Recon Rate, Rate / m.T & Actual APMC Fees Clean Summary Card */}
      {(() => {
        const activeColsForCalc = visibleSpecCols;
        const grandTotal = activeColsForCalc.reduce((sum, idx) => sum + getColAmount(detailCols[idx - 1]), 0);
        const apmc1Pct = grandTotal * 0.01;
        const weightedRateMt = calculateWeightedRatePerMT(detailCols);
        const totalWtMt = activeColsForCalc.reduce((sum, idx) => sum + getColWtMt(detailCols[idx - 1]), 0);

        return (
          <div className="mt-2 bg-[#f8fafc] border border-indigo-200 rounded p-2.5 shadow-sm text-slate-800">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5 text-indigo-700" />
                <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-950">
                  Calculation Breakdown Summary
                </h4>
              </div>
              <span className="text-[8.5px] text-indigo-900 font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                Rate / m.T = Total Amount ÷ Total Weight ({totalWtMt.toFixed(3)} MT)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 text-center text-xs">
              {activeColsForCalc.map((idx) => {
                const col = detailCols[idx - 1];
                const colAmt = getColAmount(col);
                const wt = getColWtMt(col);
                return (
                  <div key={idx} className="bg-white border border-slate-200 rounded p-1.5 flex flex-col justify-between">
                    <span className="text-[8.5px] font-bold text-slate-500 uppercase">
                      Col {idx} {col?.grade ? `(${col.grade})` : ""} Amt
                    </span>
                    <span className="my-0.5 font-mono font-bold text-slate-900 text-xs">
                      ₹{colAmt.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                    </span>
                    <span className="text-[7.5px] text-slate-500 font-mono">{wt.toFixed(3)} MT</span>
                  </div>
                );
              })}

              <div className="bg-[#eef7f2] border border-emerald-300 rounded p-1.5 flex flex-col justify-between">
                <span className="text-[8.5px] font-black text-emerald-900 uppercase">Grand Total</span>
                <span className="my-0.5 font-mono font-black text-emerald-950 text-xs">
                  ₹{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                </span>
                <span className="text-[7.5px] text-emerald-700 font-mono">Sum of Recon Amts</span>
              </div>

              <div className="bg-[#eef4ff] border border-blue-300 rounded p-1.5 flex flex-col justify-between">
                <span className="text-[8.5px] font-black text-blue-900 uppercase">Rate / m.T</span>
                <span className="my-0.5 font-mono font-black text-blue-950 text-xs">
                  ₹{weightedRateMt.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                </span>
                <span className="text-[7.5px] text-blue-700 font-mono">Weighted / MT</span>
              </div>

              <div className="bg-[#fffbeb] border border-amber-300 rounded p-1.5 flex flex-col justify-between">
                <span className="text-[8.5px] font-black text-amber-900 uppercase">Actual APMC Fees</span>
                <span className="my-0.5 font-mono font-black text-amber-950 text-xs">
                  ₹{apmc1Pct.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                </span>
                <span className="text-[7.5px] text-amber-700 font-mono">1% of Total</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Grid 2: Claims Subdivided Grid Layout */}
      <LegacyFieldset legend="Active Deductions / Claims Audit Sheet (Moisture, Dust, Grade Down, NCV & L.Dely claims)">
        <div className="flex items-center justify-between pb-1 px-1">
          <span className="text-[9.5px] text-gray-600 font-bold uppercase tracking-wider">
            {visibleDeductionCols.length > 0
              ? `Audit Columns (${visibleDeductionCols.length} Active with Claim > 0)`
              : "No columns with active claims (Total Claim = 0)"}
          </span>
          <button
            type="button"
            onClick={() => setShowAllDeductionCols(!showAllDeductionCols)}
            className="text-[9px] px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold cursor-pointer transition-colors shadow-2xs"
          >
            {showAllDeductionCols ? "Hide 0% Claim Columns" : "Show All Columns to Edit Claims"}
          </button>
        </div>

        {visibleDeductionCols.length === 0 ? (
          <div className="p-4 text-center bg-slate-50 border border-gray-300 rounded text-slate-500 text-xs">
            <p className="font-semibold text-gray-600 mb-1">All columns currently have Total Claim = 0.00% (No Deductions).</p>
            <p className="text-[11px] text-gray-400">Columns with 0 claim are hidden. Click below if you need to view or manually enter deduction percentages.</p>
            <button
              type="button"
              onClick={() => setShowAllDeductionCols(true)}
              className="mt-2 text-xs px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded border border-rose-300 font-bold cursor-pointer transition-colors"
            >
              Show All Columns to Enter Claims
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-400 overflow-x-auto">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="bg-[#ffd2ce] border-b border-gray-400 font-extrabold uppercase text-[#dc2626] text-center">
                  <th className="px-2 py-1.5 border-r border-gray-300 w-28 text-[10px]">Deductions</th>
                  {visibleDeductionCols.map((idx) => (
                    <th key={idx} colSpan={3} className="px-2 py-1.5 border-r border-gray-300 text-[10.5px]">
                      Col {idx} - {detailCols[idx - 1]?.grade || "Empty Spec"}
                    </th>
                  ))}
                </tr>

                <tr className="bg-[#fff1f0] border-b border-gray-400 font-black uppercase text-gray-700 text-[9px] text-center">
                  <th className="px-1.5 py-1 border-r border-gray-300">Metric</th>
                  {visibleDeductionCols.map((idx) => (
                    <React.Fragment key={idx}>
                      <th className="px-1 py-1 border-r border-gray-200 text-rose-850 font-bold">Claim (%)</th>
                      <th className="px-1 py-1 border-r border-gray-200 text-blue-900 font-bold">SETT (%)</th>
                      <th className="px-1 py-1 border-r border-gray-300 text-emerald-800 font-extrabold bg-emerald-50/60">Final (%)</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 font-black text-center font-mono">
                {/* Grade Down */}
                <tr className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">
                    Grade Down (%)
                  </td>
                  {visibleDeductionCols.map((idx) => {
                    const gdVal =
                      Number(detailCols[idx - 1]?.gd_sett) > 0
                        ? Number(detailCols[idx - 1]?.gd_sett)
                        : Number(detailCols[idx - 1]?.gd_claim || 0);
                    return (
                      <React.Fragment key={idx}>
                        <td className="p-1 border-r border-gray-200">
                          <input
                            id={`detailcols_${idx}_gd_claim`}
                            name={`detailcols_${idx}_gd_claim`}
                            aria-label={`detailcols ${idx} gd claim`}
                            type="number"
                            step="0.1"
                            className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded"
                            value={detailCols[idx - 1]?.gd_claim || ""}
                            onChange={(e) => handleColChange(idx, "gd_claim", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-1 border-r border-gray-200">
                          <input
                            id={`detailcols_${idx}_gd_sett`}
                            name={`detailcols_${idx}_gd_sett`}
                            aria-label={`detailcols ${idx} gd sett`}
                            type="number"
                            step="0.1"
                            className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded"
                            value={detailCols[idx - 1]?.gd_sett ?? 0}
                            onChange={(e) => handleColChange(idx, "gd_sett", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">
                          {gdVal.toFixed(1)}%
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>

                {/* Moisture */}
                <tr className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">
                    Moisture (%)
                  </td>
                  {visibleDeductionCols.map((idx) => {
                    const mVal =
                      Number(detailCols[idx - 1]?.moist_sett) > 0
                        ? Number(detailCols[idx - 1]?.moist_sett)
                        : Number(detailCols[idx - 1]?.moist_claim || 0);
                    return (
                      <React.Fragment key={idx}>
                        <td className="p-1 border-r border-gray-200">
                          <input
                            id={`detailcols_${idx}_moist_claim`}
                            name={`detailcols_${idx}_moist_claim`}
                            aria-label={`detailcols ${idx} moist claim`}
                            type="number"
                            step="0.1"
                            className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded"
                            value={detailCols[idx - 1]?.moist_claim || ""}
                            onChange={(e) => handleColChange(idx, "moist_claim", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-1 border-r border-gray-200">
                          <input
                            id={`detailcols_${idx}_moist_sett`}
                            name={`detailcols_${idx}_moist_sett`}
                            aria-label={`detailcols ${idx} moist sett`}
                            type="number"
                            step="0.1"
                            className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded"
                            value={detailCols[idx - 1]?.moist_sett ?? 0}
                            onChange={(e) => handleColChange(idx, "moist_sett", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">
                          {mVal.toFixed(2)}%
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>

                {/* Dust */}
                <tr className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">
                    Dust (%)
                  </td>
                  {visibleDeductionCols.map((idx) => {
                    const dVal =
                      Number(detailCols[idx - 1]?.dust_sett) > 0
                        ? Number(detailCols[idx - 1]?.dust_sett)
                        : Number(detailCols[idx - 1]?.dust_claim || 0);
                    return (
                      <React.Fragment key={idx}>
                        <td className="p-1 border-r border-gray-200">
                          <input
                            id={`detailcols_${idx}_dust_claim`}
                            name={`detailcols_${idx}_dust_claim`}
                            aria-label={`detailcols ${idx} dust claim`}
                            type="number"
                            step="0.1"
                            className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded"
                            value={detailCols[idx - 1]?.dust_claim || ""}
                            onChange={(e) => handleColChange(idx, "dust_claim", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-1 border-r border-gray-200">
                          <input
                            id={`detailcols_${idx}_dust_sett`}
                            name={`detailcols_${idx}_dust_sett`}
                            aria-label={`detailcols ${idx} dust sett`}
                            type="number"
                            step="0.1"
                            className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded"
                            value={detailCols[idx - 1]?.dust_sett ?? 0}
                            onChange={(e) => handleColChange(idx, "dust_sett", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">
                          {dVal.toFixed(2)}%
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>

                {/* NCV */}
                <tr className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">
                    NCV (%)
                  </td>
                  {visibleDeductionCols.map((idx) => {
                    const nVal =
                      Number(detailCols[idx - 1]?.ncv_sett) > 0
                        ? Number(detailCols[idx - 1]?.ncv_sett)
                        : Number(detailCols[idx - 1]?.ncv_claim || 0);
                    return (
                      <React.Fragment key={idx}>
                        <td className="p-1 border-r border-gray-200">
                          <input
                            id={`detailcols_${idx}_ncv_claim`}
                            name={`detailcols_${idx}_ncv_claim`}
                            aria-label={`detailcols ${idx} ncv claim`}
                            type="number"
                            step="0.1"
                            className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded"
                            value={detailCols[idx - 1]?.ncv_claim || ""}
                            onChange={(e) => handleColChange(idx, "ncv_claim", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-1 border-r border-gray-200">
                          <input
                            id={`detailcols_${idx}_ncv_sett`}
                            name={`detailcols_${idx}_ncv_sett`}
                            aria-label={`detailcols ${idx} ncv sett`}
                            type="number"
                            step="0.1"
                            className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded"
                            value={detailCols[idx - 1]?.ncv_sett ?? 0}
                            onChange={(e) => handleColChange(idx, "ncv_sett", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">
                          {nVal.toFixed(2)}%
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>

                {/* PO / Late Dely */}
                <tr className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold leading-none">
                    PO/Grade/A/L.Dely (Amt)
                  </td>
                  {visibleDeductionCols.map((idx) => {
                    const poVal =
                      Number(detailCols[idx - 1]?.po_grade_sett) > 0
                        ? Number(detailCols[idx - 1]?.po_grade_sett)
                        : Number(detailCols[idx - 1]?.po_grade_claim || 0);
                    return (
                      <React.Fragment key={idx}>
                        <td className="p-1 border-r border-gray-200">
                          <input
                            id={`detailcols_${idx}_po_grade_claim`}
                            name={`detailcols_${idx}_po_grade_claim`}
                            aria-label={`detailcols ${idx} po grade claim`}
                            type="number"
                            step="0.1"
                            className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded"
                            value={detailCols[idx - 1]?.po_grade_claim || ""}
                            onChange={(e) => handleColChange(idx, "po_grade_claim", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-1 border-r border-gray-200">
                          <input
                            id={`detailcols_${idx}_po_grade_sett`}
                            name={`detailcols_${idx}_po_grade_sett`}
                            aria-label={`detailcols ${idx} po grade sett`}
                            type="number"
                            step="0.1"
                            className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded"
                            value={detailCols[idx - 1]?.po_grade_sett ?? 0}
                            onChange={(e) => handleColChange(idx, "po_grade_sett", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">
                          {poVal.toFixed(1)}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>

                {/* Remarks */}
                <tr className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">
                    Remarks
                  </td>
                  {visibleDeductionCols.map((idx) => (
                    <td key={idx} colSpan={3} className="p-1 border-r border-gray-300">
                      <input
                        id={`audit_remarks_${idx}`}
                        name={`audit_remarks_${idx}`}
                        aria-label="Audit remarks..."
                        type="text"
                        className="w-full bg-transparent p-0.5 outline-none font-sans font-medium text-left px-2 text-[9.5px]"
                        placeholder="Audit remarks..."
                        value={detailCols[idx - 1]?.remark || ""}
                        onChange={(e) => handleColChange(idx, "remark", e.target.value)}
                      />
                    </td>
                  ))}
                </tr>

                {/* Total Claim */}
                <tr className="bg-rose-50/70 hover:bg-rose-100">
                  <td className="px-2 py-1.5 border-r border-gray-200 text-red-900 uppercase font-sans text-[9px] text-left font-bold">
                    Total Claim
                  </td>
                  {visibleDeductionCols.map((idx) => {
                    const col = detailCols[idx - 1];
                    const isColActive =
                      (Number(col?.quantity) || 0) > 0 ||
                      (Number(col?.arr_qty_wt) || 0) > 0 ||
                      (Number(col?.wt_quantity) || 0) > 0;
                    const gdVal = Number(col?.gd_sett) > 0 ? Number(col?.gd_sett) : Number(col?.gd_claim || 0);
                    const mVal = Number(col?.moist_sett) > 0 ? Number(col?.moist_sett) : Number(col?.moist_claim || 0);
                    const dVal = Number(col?.dust_sett) > 0 ? Number(col?.dust_sett) : Number(col?.dust_claim || 0);
                    const nVal = Number(col?.ncv_sett) > 0 ? Number(col?.ncv_sett) : Number(col?.ncv_claim || 0);
                    const totalClaimVal = gdVal + mVal + dVal + nVal;
                    return (
                      <td
                        key={idx}
                        colSpan={3}
                        className="px-2 py-1.5 border-r border-gray-300 text-center font-black text-red-700 bg-red-100/50 text-[11px]"
                      >
                        {isColActive ? `${totalClaimVal.toFixed(2)}%` : "0.0%"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </LegacyFieldset>
    </div>
  );
};

export default SettlementSpecificationsGrid;
