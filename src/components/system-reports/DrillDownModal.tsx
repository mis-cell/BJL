import React from 'react';
import { X, Download, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ReportTransactionLine } from '../../services/systemReportEngine';

interface DrillDownModalProps {
  title: string;
  subtitle?: string;
  transactions: ReportTransactionLine[];
  onClose: () => void;
}

export const DrillDownModal: React.FC<DrillDownModalProps> = ({
  title,
  subtitle,
  transactions,
  onClose
}) => {
  const exportDrillDownCSV = () => {
    if (!transactions.length) return;
    const headers = [
      'Txn ID', 'Date', 'Sauda No', 'PO No', 'Supplier', 'Broker', 'Agency', 'Area', 'Grade',
      'Qty (MT)', 'Purchase Rate (₹/Qtl)', 'Base Rate (₹/Qtl)', 'Variance (₹)', 'Gross Value (₹)',
      'Premium (₹)', 'Deductions (₹)', 'Effective Cost (₹)', 'Realization (₹)', 'Gross Profit (₹)',
      'Profit %', 'Status', 'Arrived MT', 'Pending MT', 'Paid (₹)', 'Pending (₹)'
    ];

    const rows = transactions.map(t => [
      t.txnId,
      t.date,
      t.saudaNo,
      t.poNo,
      `"${t.supplier}"`,
      `"${t.broker}"`,
      `"${t.agency}"`,
      `"${t.area}"`,
      t.grade,
      t.quantityMT.toFixed(3),
      t.purchaseRate.toFixed(2),
      t.baseRate.toFixed(2),
      t.rateVariance.toFixed(2),
      t.grossPurchaseValue.toFixed(2),
      t.premiumAmount.toFixed(2),
      t.deductionAmount.toFixed(2),
      t.effectiveCost.toFixed(2),
      t.realizationValue.toFixed(2),
      t.grossProfit.toFixed(2),
      t.profitPct.toFixed(2),
      t.profitStatus,
      t.arrivedWeightMT.toFixed(3),
      t.pendingWeightMT.toFixed(3),
      t.paidAmount.toFixed(2),
      t.pendingPayable.toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `drilldown_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalQty = transactions.reduce((acc, t) => acc + t.quantityMT, 0);
  const totalVal = transactions.reduce((acc, t) => acc + t.grossPurchaseValue, 0);
  const totalProfit = transactions.reduce((acc, t) => acc + t.grossProfit, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white border-2 border-emerald-900 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden font-sans">
        
        {/* Header */}
        <div className="bg-emerald-950 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-emerald-950">
                Transaction Line Grain
              </span>
              <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-yellow-300">
                {title}
              </h3>
            </div>
            {subtitle && (
              <p className="text-xs text-emerald-200/90 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportDrillDownCSV}
              className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold border border-emerald-600 transition flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-800/80 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="bg-emerald-50/60 px-5 py-2.5 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-4">
            <span>Records: <strong className="text-emerald-900">{transactions.length}</strong></span>
            <span>Total Weight: <strong className="text-emerald-900">{totalQty.toFixed(3)} MT</strong></span>
            <span>Gross Value: <strong className="text-emerald-900">₹{totalVal.toLocaleString()}</strong></span>
            <span>Gross Margin: <strong className={totalProfit >= 0 ? 'text-emerald-700 font-black' : 'text-rose-600 font-black'}>
              ₹{totalProfit.toLocaleString()}
            </strong></span>
          </div>
          <span className="text-[10px] text-slate-500 uppercase">
            Click any row to inspect line details
          </span>
        </div>

        {/* Data Table */}
        <div className="overflow-auto flex-1 p-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200">
                <th className="p-2.5 text-center">#</th>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Sauda / PO</th>
                <th className="p-2.5">Supplier</th>
                <th className="p-2.5">Broker</th>
                <th className="p-2.5">Area & Grade</th>
                <th className="p-2.5 text-right">Qty (MT)</th>
                <th className="p-2.5 text-right">Purchase Rate</th>
                <th className="p-2.5 text-right">Base Rate</th>
                <th className="p-2.5 text-right">Variance</th>
                <th className="p-2.5 text-right">Gross Value</th>
                <th className="p-2.5 text-right">Eff. Cost</th>
                <th className="p-2.5 text-right">Profit</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {transactions.map((t, idx) => (
                <tr key={t.txnId || idx} className="hover:bg-emerald-50/40 transition font-mono text-[11px]">
                  <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                  <td className="p-2 text-slate-600 whitespace-nowrap">{t.date}</td>
                  <td className="p-2 font-bold text-emerald-950">
                    <div>{t.poNo}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{t.saudaNo}</div>
                  </td>
                  <td className="p-2 max-w-[140px] truncate" title={t.supplier}>{t.supplier}</td>
                  <td className="p-2 max-w-[120px] truncate" title={t.broker}>{t.broker}</td>
                  <td className="p-2">
                    <span className="font-bold text-slate-800">{t.grade}</span>
                    <span className="text-[10px] text-slate-500 block">{t.area}</span>
                  </td>
                  <td className="p-2 text-right font-bold">{t.quantityMT.toFixed(3)}</td>
                  <td className="p-2 text-right">₹{t.purchaseRate.toLocaleString()}</td>
                  <td className="p-2 text-right text-slate-500">₹{t.baseRate.toLocaleString()}</td>
                  <td className="p-2 text-right">
                    <span className={t.rateVariance > 0 ? 'text-amber-700 font-bold' : (t.rateVariance < 0 ? 'text-emerald-700 font-bold' : 'text-slate-400')}>
                      {t.rateVariance > 0 ? `+₹${t.rateVariance.toFixed(0)}` : (t.rateVariance < 0 ? `-₹${Math.abs(t.rateVariance).toFixed(0)}` : '₹0')}
                    </span>
                  </td>
                  <td className="p-2 text-right">₹{t.grossPurchaseValue.toLocaleString()}</td>
                  <td className="p-2 text-right text-slate-900 font-bold">₹{t.effectiveCost.toLocaleString()}</td>
                  <td className="p-2 text-right">
                    <span className={t.grossProfit >= 0 ? 'text-emerald-700 font-black' : 'text-rose-600 font-black'}>
                      {t.grossProfit >= 0 ? `+₹${t.grossProfit.toLocaleString()}` : `-₹${Math.abs(t.grossProfit).toLocaleString()}`}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      t.profitStatus === 'PROFITABLE' ? 'bg-emerald-100 text-emerald-800' :
                      t.profitStatus === 'LOSS' ? 'bg-rose-100 text-rose-800' :
                      t.profitStatus === 'BREAK-EVEN' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {t.profitStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            Granular Line Item Audit: {transactions.length} rows evaluated
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition"
          >
            Close Drill-Down
          </button>
        </div>

      </div>
    </div>
  );
};
