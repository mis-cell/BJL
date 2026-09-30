import React from 'react';
import { AlertTriangle, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SystemReportDataset, ReportTransactionLine } from '../../services/systemReportEngine';

interface ExceptionAuditViewProps {
  dataset: SystemReportDataset;
  onDrillDown: (title: string, txns: ReportTransactionLine[]) => void;
}

export const ExceptionAuditView: React.FC<ExceptionAuditViewProps> = ({
  dataset,
  onDrillDown
}) => {
  const { filtered } = dataset;
  const abnormalLines = filtered.filter(t => t.isAbnormal);

  return (
    <div className="space-y-4 font-sans">
      
      {/* Alert Header */}
      <div className="p-4 bg-rose-950 text-white rounded-2xl border border-rose-800 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-500 flex items-center justify-center text-rose-300">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-rose-200">
              8. System-Wide Exception & Abnormal Data Control
            </h3>
            <p className="text-xs text-rose-300/80">
              Transactions violating configured mill tolerances (Moisture &gt;18%, Premium &gt;₹100, Deductions &gt;2%, Loss Margin, Delivery Delays).
            </p>
          </div>
        </div>

        <div className="text-right font-mono">
          <span className="text-2xl font-black text-white">{abnormalLines.length}</span>
          <span className="text-[10px] text-rose-300 block uppercase">Violations Detected</span>
        </div>
      </div>

      {/* Exception Breakdown Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between font-bold text-xs uppercase text-slate-700">
          <span>Active Flagged Exceptions</span>
          <span className="text-[10px] text-slate-400 font-mono">Click row to inspect complete line item</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b">
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Sauda / PO</th>
                <th className="p-2.5">Supplier</th>
                <th className="p-2.5">Broker</th>
                <th className="p-2.5 text-right">Qty (MT)</th>
                <th className="p-2.5 text-right">Purchase Rate</th>
                <th className="p-2.5 text-right">Variance / MT</th>
                <th className="p-2.5 text-right">Gross Profit</th>
                <th className="p-2.5">Flagged Reason(s)</th>
                <th className="p-2.5 text-center">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700">
              {abnormalLines.length > 0 ? (
                abnormalLines.map((t, idx) => (
                  <tr
                    key={idx}
                    onClick={() => onDrillDown(`Exception: ${t.poNo} (${t.supplier})`, [t])}
                    className="hover:bg-rose-50/50 transition cursor-pointer"
                  >
                    <td className="p-2.5 text-slate-500 whitespace-nowrap">{t.date}</td>
                    <td className="p-2.5 font-bold text-rose-950">{t.poNo}</td>
                    <td className="p-2.5 max-w-[140px] truncate">{t.supplier}</td>
                    <td className="p-2.5 max-w-[120px] truncate">{t.broker}</td>
                    <td className="p-2.5 text-right font-bold">{t.quantityMT.toFixed(2)}</td>
                    <td className="p-2.5 text-right">₹{t.purchaseRate.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-amber-700">
                      {t.rateVariance > 0 ? `+₹${t.rateVariance.toFixed(0)}` : '₹0'}
                    </td>
                    <td className="p-2.5 text-right">
                      <span className={t.grossProfit < 0 ? 'text-rose-600 font-black' : 'text-emerald-700 font-bold'}>
                        ₹{t.grossProfit.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <div className="flex flex-wrap gap-1">
                        {t.abnormalReasons.map((r, rIdx) => (
                          <span key={rIdx} className="bg-rose-100 text-rose-800 text-[9.5px] font-bold px-1.5 py-0.5 rounded">
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className="bg-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                        ALERT
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <span className="text-xs font-bold uppercase tracking-wider block">
                      No Exception Rules Violated in Filtered Set
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
