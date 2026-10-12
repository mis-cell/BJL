import React, { useState, useMemo } from 'react';
import { Download, Search, ChevronRight, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { SystemReportDataset, ReportTransactionLine } from '../../services/systemReportEngine';

interface Priority4DetailedProps {
  dataset: SystemReportDataset;
  onDrillDown: (title: string, txns: ReportTransactionLine[]) => void;
}

export const Priority4Detailed: React.FC<Priority4DetailedProps> = ({
  dataset,
  onDrillDown
}) => {
  const { filtered } = dataset;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [sortField, setSortField] = useState<keyof ReportTransactionLine>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Sorting
  const sortedRecords = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') {
        return sortAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      }
      return sortAsc ? Number(aVal || 0) - Number(bVal || 0) : Number(bVal || 0) - Number(aVal || 0);
    });
  }, [filtered, sortField, sortAsc]);

  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;
  const pagedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const handleSort = (field: keyof ReportTransactionLine) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const exportAllCSV = () => {
    if (!filtered.length) return;
    const headers = [
      'Txn ID', 'Date', 'Sauda No', 'PO No', 'Supplier', 'Broker', 'Agency', 'Area', 'Grade',
      'Quantity (MT)', 'Purchase Rate (₹/Qtl)', 'Base Rate (₹/Qtl)', 'Rate Variance (₹)',
      'Gross Purchase Value (₹)', 'Premium Amount (₹)', 'Deduction Amount (₹)',
      'Effective Landed Cost (₹)', 'Arrived MT', 'Pending Delivery MT', 'Paid Amount (₹)', 'Pending Payable (₹)'
    ];

    const rows = filtered.map(t => [
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
      t.arrivedWeightMT.toFixed(3),
      t.pendingWeightMT.toFixed(3),
      t.paidAmount.toFixed(2),
      t.pendingPayable.toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `complete_transaction_register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 font-sans">
      
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-xs font-black uppercase text-emerald-950 tracking-wider">
            10. Complete System Transaction Register (Master Grain: G0)
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">
            Every row represents an individual Transaction Line (Supplier + Sauda + PO + Grade + Rate + Qty)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportAllCSV}
            className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-emerald-950 text-xs font-black rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Full Register CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-emerald-950 text-white font-black uppercase text-[10px] tracking-wider border-b border-emerald-900 select-none">
                <th className="p-2.5 text-center w-8">#</th>
                <th className="p-2.5 cursor-pointer hover:bg-emerald-900" onClick={() => handleSort('date')}>Date</th>
                <th className="p-2.5 cursor-pointer hover:bg-emerald-900" onClick={() => handleSort('saudaNo')}>Sauda / PO</th>
                <th className="p-2.5 cursor-pointer hover:bg-emerald-900" onClick={() => handleSort('supplier')}>Supplier</th>
                <th className="p-2.5 cursor-pointer hover:bg-emerald-900" onClick={() => handleSort('broker')}>Broker</th>
                <th className="p-2.5">Area & Grade</th>
                <th className="p-2.5 text-right cursor-pointer hover:bg-emerald-900" onClick={() => handleSort('quantityMT')}>Qty (MT)</th>
                <th className="p-2.5 text-right cursor-pointer hover:bg-emerald-900" onClick={() => handleSort('purchaseRate')}>Purchase Rate</th>
                <th className="p-2.5 text-right cursor-pointer hover:bg-emerald-900" onClick={() => handleSort('baseRate')}>Base Rate</th>
                <th className="p-2.5 text-right">Variance</th>
                <th className="p-2.5 text-right cursor-pointer hover:bg-emerald-900" onClick={() => handleSort('grossPurchaseValue')}>Purchase Val</th>
                <th className="p-2.5 text-right cursor-pointer hover:bg-emerald-900" onClick={() => handleSort('premiumAmount')}>Premium</th>
                <th className="p-2.5 text-right cursor-pointer hover:bg-emerald-900" onClick={() => handleSort('deductionAmount')}>Deductions</th>
                <th className="p-2.5 text-right cursor-pointer hover:bg-emerald-900" onClick={() => handleSort('effectiveCost')}>Eff. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700 font-medium">
              {pagedRecords.map((t, idx) => (
                <tr 
                  key={t.txnId || idx}
                  onClick={() => onDrillDown(`Transaction: ${t.txnId} (${t.poNo})`, [t])}
                  className="hover:bg-emerald-50/50 transition cursor-pointer"
                >
                  <td className="p-2 text-center text-slate-400">{(currentPage - 1) * pageSize + idx + 1}</td>
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
                  <td className="p-2 text-right text-amber-700 font-bold">{t.premiumAmount > 0 ? `₹${t.premiumAmount.toLocaleString()}` : '—'}</td>
                  <td className="p-2 text-right text-rose-700 font-bold">{t.deductionAmount > 0 ? `₹${t.deductionAmount.toLocaleString()}` : '—'}</td>
                  <td className="p-2 text-right text-slate-900 font-bold">₹{t.effectiveCost.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination & Row Limit */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
            <span className="text-slate-500 ml-2">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </span>
          </div>

          <div className="flex items-center gap-1 font-bold">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100"
            >
              Prev
            </button>
            <span className="px-2 font-mono">Page {currentPage} of {totalPages}</span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100"
            >
              Next
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
