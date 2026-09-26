import React from 'react';
import { 
  PaymentDetailColumn, 
  PaymentMaster 
} from '../../types/payment.types';
import { 
  getColSettPct, 
  getColDeduction, 
  getColDeductionExplanation, 
  getColSettRate, 
  getColQtyQtl, 
  getColAmount 
} from '../../utils/paymentCalculations';
import { formatIndianCurrency, calculate93PctPaidAmount } from '../../lib/utils';

export interface PaymentDetailGridProps {
  detailCols: PaymentDetailColumn[];
  setDetailCols: React.Dispatch<React.SetStateAction<PaymentDetailColumn[]>>;
  setMasterData: React.Dispatch<React.SetStateAction<PaymentMaster>>;
  gradeMasterList: any[];
  areaMasterList: any[];
  agencyMasterList: any[];
}

export function PaymentDetailGrid({
  detailCols,
  setDetailCols,
  setMasterData,
  gradeMasterList,
  areaMasterList,
  agencyMasterList
}: PaymentDetailGridProps) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="p-2.5 bg-slate-100 border-b border-slate-200 text-xs font-black uppercase text-slate-800 flex items-center justify-between">
        <span>Material Grade Details (Optional Breakdown)</span>
        <span className="text-[10px] font-semibold text-slate-500">4 Column Specification Matrix</span>
      </div>
      <div className="p-3 overflow-x-auto">
        <datalist id="grade-options-list">
          {gradeMasterList.map((g, i) => (
            <option key={i} value={g.grade_name}>{g.grade_code ? `${g.grade_code} - ${g.grade_name}` : g.grade_name}</option>
          ))}
        </datalist>
        <datalist id="area-options-list">
          {areaMasterList.map((a, i) => (
            <option key={i} value={a.area_name}>{a.area_code ? `${a.area_code} - ${a.area_name}` : a.area_name}</option>
          ))}
        </datalist>
        <datalist id="agency-options-list">
          {agencyMasterList.map((ag, i) => (
            <option key={i} value={ag.agency_name}>{ag.agency_code ? `${ag.agency_code} - ${ag.agency_name}` : ag.agency_name}</option>
          ))}
        </datalist>

        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b text-[10px] uppercase font-bold text-slate-600">
              <th className="p-2 w-10">Col</th>
              <th className="p-2">Grade</th>
              <th className="p-2">Area</th>
              <th className="p-2">Agency</th>
              <th className="p-2 w-20">Packets / Qty</th>
              <th className="p-2 w-24">Weight (MT)</th>
              <th className="p-2 w-24">Rate (₹/Qtl)</th>
              <th className="p-2 w-24 bg-emerald-50/70 text-emerald-900">Premium (₹/Qtl)</th>
              <th className="p-2 w-20 bg-emerald-50/70 text-emerald-800">Sett (%)</th>
              <th className="p-2 w-24 bg-amber-50/70 text-amber-900">Deduction (₹/Qtl)</th>
              <th className="p-2 w-24 bg-blue-50/70 text-blue-900">Sett Rate (₹/Qtl)</th>
              <th className="p-2 text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {detailCols.map((col, idx) => {
              const settPct = getColSettPct(col);
              const deduction = getColDeduction(col);
              const settRate = getColSettRate(col);
              const qtyQtl = getColQtyQtl(col);
              const rowAmount = getColAmount(col);

              return (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2 font-bold text-slate-500">{col.col_index}</td>
                  <td className="p-2">
                    <input
                      id={`grade_col_${idx}`}
                      name={`grade_col_${idx}`}
                      aria-label="Grade"
                      type="text"
                      list="grade-options-list"
                      value={col.grade}
                      readOnly
                      placeholder="Grade (e.g. TD5)"
                      className="w-full p-1 border border-slate-200 bg-slate-100 text-slate-500 rounded text-xs font-semibold cursor-not-allowed"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      id={`area_col_${idx}`}
                      name={`area_col_${idx}`}
                      aria-label="Area"
                      type="text"
                      list="area-options-list"
                      value={col.area}
                      readOnly
                      placeholder="Area (e.g. DAISEE)"
                      className="w-full p-1 border border-slate-200 bg-slate-100 text-slate-500 rounded text-xs font-semibold cursor-not-allowed"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      id={`agency_col_${idx}`}
                      name={`agency_col_${idx}`}
                      aria-label="Agency"
                      type="text"
                      list="agency-options-list"
                      value={col.agency}
                      readOnly
                      placeholder="Agency (e.g. AMBAGAN)"
                      className="w-full p-1 border border-slate-200 bg-slate-100 text-slate-500 rounded text-xs font-semibold cursor-not-allowed"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      id={`quantity_col_${idx}`}
                      name={`quantity_col_${idx}`}
                      aria-label="Col quantity"
                      type="number"
                      value={col.quantity || ''}
                      onChange={e => {
                        const updated = [...detailCols];
                        updated[idx].quantity = parseFloat(e.target.value) || 0;
                        setDetailCols(updated);
                      }}
                      className="w-20 p-1 border rounded text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      id={`arr_qty_wt_col_${idx}`}
                      name={`arr_qty_wt_col_${idx}`}
                      aria-label="Col Weight MT"
                      type="number"
                      step="0.001"
                      value={col.arr_qty_wt || ''}
                      onChange={e => {
                        const updated = [...detailCols];
                        const newWt = parseFloat(e.target.value) || 0;
                        updated[idx].arr_qty_wt = newWt;
                        const qQtl = Number((newWt * 10).toFixed(3));
                        const sRate = getColSettRate(updated[idx]);
                        updated[idx].quantity_qtl = qQtl;
                        updated[idx].sett_rate = sRate;
                        updated[idx].deduction_rate = getColDeduction(updated[idx]);
                        updated[idx].amount = Number((qQtl * sRate).toFixed(2));
                        setDetailCols(updated);
                        const newTotal = updated.reduce((sum, c) => sum + getColAmount(c), 0);
                        if (newTotal > 0) {
                          const newPaid = calculate93PctPaidAmount(newTotal);
                          setMasterData(prev => ({
                            ...prev,
                            total_amount: newTotal,
                            payable_amt: newTotal,
                            net_amt: newTotal,
                            paid_amount: newPaid
                          }));
                        }
                      }}
                      className="w-24 p-1 border rounded text-xs font-mono"
                    />
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      {qtyQtl > 0 ? `${qtyQtl} Qtl` : ''}
                    </div>
                  </td>
                  <td className="p-2">
                    <input
                      id={`rate_value_col_${idx}`}
                      name={`rate_value_col_${idx}`}
                      aria-label="Col Original Rate"
                      type="number"
                      step="0.01"
                      value={col.rate_value || ''}
                      onChange={e => {
                        const updated = [...detailCols];
                        const newRate = parseFloat(e.target.value) || 0;
                        updated[idx].rate_value = newRate;
                        const sPct = getColSettPct(updated[idx]);
                        const ded = getColDeduction(updated[idx]);
                        const prem = Number(updated[idx].premium) || 0;
                        const sRate = Math.max(0, Number((newRate + prem - ded).toFixed(2)));
                        const qQtl = getColQtyQtl(updated[idx]);
                        updated[idx].deduction_rate = ded;
                        updated[idx].sett_rate = sRate;
                        updated[idx].quantity_qtl = qQtl;
                        updated[idx].amount = Number((qQtl * sRate).toFixed(2));
                        setDetailCols(updated);
                        const newTotal = updated.reduce((sum, c) => sum + getColAmount(c), 0);
                        if (newTotal > 0) {
                          const newPaid = calculate93PctPaidAmount(newTotal);
                          setMasterData(prev => ({
                            ...prev,
                            total_amount: newTotal,
                            payable_amt: newTotal,
                            net_amt: newTotal,
                            paid_amount: newPaid
                          }));
                        }
                      }}
                      className="w-24 p-1 border rounded text-xs font-mono"
                    />
                  </td>
                  {/* Premium (₹/Qtl) - Populated from Sauda Check Point / PO line items */}
                  <td className="p-2 bg-emerald-50/30">
                    <input
                      id={`premium_col_${idx}`}
                      name={`premium_col_${idx}`}
                      aria-label="Col Premium Rate"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={col.premium !== undefined && col.premium !== null && col.premium !== 0 ? col.premium : ''}
                      onChange={e => {
                        const updated = [...detailCols];
                        const newPrem = parseFloat(e.target.value) || 0;
                        updated[idx].premium = newPrem;
                        const origRate = Number(updated[idx].rate_value) || 0;
                        const ded = getColDeduction(updated[idx]);
                        const sRate = Math.max(0, Number((origRate + newPrem - ded).toFixed(2)));
                        const qQtl = getColQtyQtl(updated[idx]);
                        updated[idx].deduction_rate = ded;
                        updated[idx].sett_rate = sRate;
                        updated[idx].quantity_qtl = qQtl;
                        updated[idx].amount = Number((qQtl * sRate).toFixed(2));
                        setDetailCols(updated);
                        const newTotal = updated.reduce((sum, c) => sum + getColAmount(c), 0);
                        if (newTotal > 0) {
                          const newPaid = calculate93PctPaidAmount(newTotal);
                          setMasterData(prev => ({
                            ...prev,
                            total_amount: newTotal,
                            payable_amt: newTotal,
                            net_amt: newTotal,
                            paid_amount: newPaid
                          }));
                        }
                      }}
                      title={`Premium (₹/Qtl) from Sauda Check Point: ₹${Number(col.premium || 0).toFixed(2)}`}
                      className="w-24 p-1 border border-emerald-300 rounded text-xs font-mono font-bold text-right bg-white text-emerald-950 focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                  {/* Sett (%) - populated from Inspection Details -> Grade Down % -> Claim */}
                  <td className="p-2 bg-emerald-50/30">
                    <div className="flex flex-col">
                      <input
                        id={`sett_pct_col_${idx}`}
                        name={`sett_pct_col_${idx}`}
                        aria-label="Settlement Percentage"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={col.sett_pct !== undefined && col.sett_pct !== null ? col.sett_pct : ((col.gd_claim > 0 ? col.gd_claim : col.gd_sett) || '')}
                        onChange={e => {
                          const updated = [...detailCols];
                          const newSettPct = parseFloat(e.target.value) || 0;
                          updated[idx].sett_pct = newSettPct;
                          const origRate = Number(updated[idx].rate_value) || 0;
                          const prem = Number(updated[idx].premium) || 0;
                          const ded = getColDeduction(updated[idx]);
                          const sRate = Math.max(0, Number((origRate + prem - ded).toFixed(2)));
                          const qQtl = getColQtyQtl(updated[idx]);
                          updated[idx].deduction_rate = ded;
                          updated[idx].sett_rate = sRate;
                          updated[idx].quantity_qtl = qQtl;
                          updated[idx].amount = Number((qQtl * sRate).toFixed(2));
                          setDetailCols(updated);
                          const newTotal = updated.reduce((sum, c) => sum + getColAmount(c), 0);
                          if (newTotal > 0) {
                            const newPaid = calculate93PctPaidAmount(newTotal);
                            setMasterData(prev => ({
                              ...prev,
                              total_amount: newTotal,
                              payable_amt: newTotal,
                              net_amt: newTotal,
                              paid_amount: newPaid
                            }));
                          }
                        }}
                        placeholder="0"
                        title={`Settlement % (Populated from Inspection Details Grade Down % Claim: ${col.gd_claim || 0}%)`}
                        className="w-16 p-1 border border-emerald-300 rounded text-xs font-bold text-center bg-white text-emerald-950 focus:ring-1 focus:ring-emerald-500"
                      />
                      {col.gd_claim > 0 && (
                        <span className="text-[9px] text-amber-700 font-semibold mt-0.5" title={`Inspection Details Grade Down % Claim: ${col.gd_claim}%`}>
                          Claim: {col.gd_claim}%
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Deduction (₹/Qtl) = Settlement Basis (Original Rate) * Sett (%) / 100 */}
                  <td className="p-2 bg-amber-50/30">
                    <div 
                      className="w-24 p-1 rounded text-xs font-mono font-bold text-amber-900 bg-amber-100/60 text-right border border-amber-200 cursor-help"
                      title={getColDeductionExplanation(col) || `Deduction = ₹${deduction.toFixed(2)}/Qtl`}
                    >
                      ₹{deduction.toFixed(2)}
                    </div>
                  </td>
                  {/* Sett Rate (₹/Qtl) = Original Rate + Premium - Deduction */}
                  <td className="p-2 bg-blue-50/30">
                    <div 
                      className="w-24 p-1 rounded text-xs font-mono font-bold text-blue-900 bg-blue-100/60 text-right border border-blue-200"
                      title={`Sett Rate = (Rate: ₹${(Number(col.rate_value) || 0).toFixed(2)} + Premium: ₹${(Number(col.premium) || 0).toFixed(2)}) − Deduction: ₹${deduction.toFixed(2)} = ₹${settRate.toFixed(2)}/Qtl`}
                    >
                      ₹{settRate.toFixed(2)}
                    </div>
                  </td>
                  {/* Amount (₹) = Quantity (Qtl) * Sett Rate (₹/Qtl) */}
                  <td className="p-2 text-right">
                    <div 
                      className="font-bold text-slate-800 text-xs font-mono"
                      title={`${qtyQtl.toFixed(2)} Qtl × ₹${settRate.toFixed(2)}/Qtl = ₹${rowAmount.toFixed(2)}`}
                    >
                      {formatIndianCurrency(rowAmount)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
