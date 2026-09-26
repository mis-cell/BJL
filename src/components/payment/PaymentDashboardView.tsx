import React from 'react';
import { 
  Wallet, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  FileCheck, 
  Search, 
  BookOpen, 
  Download, 
  RefreshCcw, 
  Trash2 
} from 'lucide-react';
import { PaymentMaster } from '../../types/payment.types';
import { cn, formatIndianCurrency } from '../../lib/utils';
import { PaginationControls } from '../PaginationControls';

export interface PaymentDashboardViewProps {
  paymentList: PaymentMaster[];
  verifiedArrivals: any[];
  searchFilter: string;
  setSearchFilter: (s: string) => void;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  pageSize: number;
  setPageSize: (ps: number) => void;
  loading: boolean;
  onRefresh: () => void;
  onEdit: (p: PaymentMaster) => void;
  onViewLedger: (partyName: string) => void;
  onDelete: (voucherNo: string) => void;
  onExportPdf: () => void;
}

export function PaymentDashboardView({
  paymentList,
  verifiedArrivals,
  searchFilter,
  setSearchFilter,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  loading,
  onRefresh,
  onEdit,
  onViewLedger,
  onDelete,
  onExportPdf
}: PaymentDashboardViewProps) {
  // Totals calculations
  const totalPaidSum = paymentList.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
  const totalPayableSum = paymentList.reduce((sum, p) => sum + (Number(p.payable_amt || p.total_amount || 0)), 0);
  const totalPendingSum = paymentList.reduce((sum, p) => {
    const payable = Number(p.payable_amt || p.total_amount || 0);
    const paid = Number(p.paid_amount || 0);
    const pending = payable - paid;
    return sum + (pending > 0 ? pending : 0);
  }, 0);

  const completedCount = paymentList.filter(
    p => (p.status || p.payment_status || '').toLowerCase() === 'completed' || 
         (p.status || p.payment_status || '').toLowerCase() === 'paid'
  ).length;

  const pendingCount = paymentList.filter(p => {
    const payable = Number(p.payable_amt || p.total_amount || 0);
    const paid = Number(p.paid_amount || 0);
    return (payable - paid) > 0 || (p.status || p.payment_status || '').toLowerCase() === 'pending';
  }).length;

  const filteredPayments = paymentList.filter(p => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase().trim();
    return (
      (p.voucher_no && p.voucher_no.toLowerCase().includes(term)) ||
      (p.party_name && p.party_name.toLowerCase().includes(term)) ||
      (p.supplier && p.supplier.toLowerCase().includes(term)) ||
      (p.mr_no && p.mr_no.toLowerCase().includes(term)) ||
      (p.po_no && p.po_no.toLowerCase().includes(term)) ||
      (p.reference_no && p.reference_no.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-4">
      {/* Dashboard Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-3 rounded-xl border border-indigo-700/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Total Vouchers</p>
            <h3 className="text-xl font-black mt-0.5">{paymentList.length}</h3>
            <p className="text-[9px] text-indigo-300 mt-0.5">Records in `payment_master`</p>
          </div>
          <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-300">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white p-3 rounded-xl border border-emerald-700/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Total Paid Amount</p>
            <h3 className="text-lg font-black mt-0.5">{formatIndianCurrency(totalPaidSum)}</h3>
            <p className="text-[9px] text-emerald-300 mt-0.5">{completedCount} Vouchers Cleared</p>
          </div>
          <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-300">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-900 to-slate-900 text-white p-3 rounded-xl border border-purple-700/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-200">Total Payable Value</p>
            <h3 className="text-lg font-black mt-0.5">{formatIndianCurrency(totalPayableSum)}</h3>
            <p className="text-[9px] text-purple-300 mt-0.5">Total Gross Invoice Value</p>
          </div>
          <div className="p-2 bg-purple-500/20 rounded-lg text-purple-300">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-950 via-amber-900 to-slate-900 text-white p-3 rounded-xl border border-amber-600/60 shadow-sm flex items-center justify-between ring-2 ring-amber-500/30">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              Pending / Retention
            </p>
            <h3 className="text-lg font-black mt-0.5 text-amber-300">{formatIndianCurrency(totalPendingSum)}</h3>
            <p className="text-[9px] text-amber-200 mt-0.5 font-semibold">{pendingCount} Outstanding / Retention</p>
          </div>
          <div className="p-2 bg-amber-500/20 rounded-lg text-amber-300">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-950 text-white p-3 rounded-xl border border-slate-700/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Verified Arrivals</p>
            <h3 className="text-xl font-black mt-0.5">{verifiedArrivals.length}</h3>
            <p className="text-[9px] text-slate-400 mt-0.5">Ready for Payment</p>
          </div>
          <div className="p-2 bg-slate-700/40 rounded-lg text-slate-300">
            <FileCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Bar & Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-[220px] w-full sm:w-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="search_by_voucher_no_payment_dashboard"
            name="search_by_voucher_no_payment_dashboard"
            aria-label="Search by Voucher No, Party Name, M.R No, P.O No, Reference..."
            type="text"
            placeholder="Search by Voucher No, Party Name, M.R No, P.O No, Reference..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewLedger('')}
            className="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Party Ledger View
          </button>
          <button
            onClick={onExportPdf}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh Table"
          >
            <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin text-purple-600")} />
          </button>
        </div>
      </div>

      {/* Payment Master Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
            <Wallet className="w-4 h-4 text-purple-600" />
            Payment Master Records ({filteredPayments.length})
          </h3>
          <span className="text-[10px] text-slate-500 font-semibold">
            Real-Time Database Sync (`payment_master`)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase font-black text-slate-600">
                <th className="p-2.5">Voucher No</th>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Party / Supplier</th>
                <th className="p-2.5">M.R / P.O Reference</th>
                <th className="p-2.5 text-center">Advance Done?</th>
                <th className="p-2.5 text-right">Payable Amt</th>
                <th className="p-2.5 text-right">Paid Amount</th>
                <th className="p-2.5 text-right">Pending / Retention</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPayments.length > 0 ? (
                filteredPayments.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((p, idx) => {
                  const payable = Number(p.payable_amt || p.total_amount || 0);
                  const paid = Number(p.paid_amount || 0);
                  const pending = payable - paid;
                  const isAdvanceYes = (p.advance_payment_done || 'No').toLowerCase() === 'yes';
                  return (
                    <tr key={p.payment_id || p.voucher_no || idx} className="hover:bg-purple-50/40 transition-colors">
                      <td className="p-2.5 font-bold font-mono text-purple-900">{p.voucher_no}</td>
                      <td className="p-2.5 font-medium text-slate-600">
                        {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-800">
                        {p.party_name || p.supplier || '-'}
                      </td>
                      <td className="p-2.5 font-mono text-slate-600">
                        <div className="text-[11px] font-bold text-slate-700">{p.mr_no || '-'}</div>
                        {p.po_no && <div className="text-[9px] text-slate-400">P.O: {p.po_no}</div>}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border inline-flex items-center gap-1",
                          isAdvanceYes
                            ? "bg-green-100 text-green-900 border-green-300"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                          {isAdvanceYes ? '✓ YES' : 'NO'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-700">
                        {formatIndianCurrency(payable)}
                      </td>
                      <td className="p-2.5 text-right font-extrabold text-emerald-700">
                        {formatIndianCurrency(paid)}
                      </td>
                      <td className="p-2.5 text-right">
                        {pending > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-600" />
                            {formatIndianCurrency(pending)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                            ₹0 (Cleared)
                          </span>
                        )}
                      </td>
                      <td className="p-2.5">
                        {(() => {
                          const totalVal = Number(p.payable_amt || p.total_amount || 0);
                          const paidVal = Number(p.paid_amount || 0);
                          let statusText = 'Pending';
                          let badgeStyle = 'bg-amber-100 text-amber-800 border-amber-300';

                          if (totalVal > 0 && paidVal >= totalVal - 0.01) {
                            statusText = 'Fully Settled';
                            badgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                          } else if (paidVal > 0) {
                            statusText = 'Partially Settled';
                            badgeStyle = 'bg-sky-100 text-sky-800 border-sky-300';
                          } else {
                            statusText = 'Pending';
                            badgeStyle = 'bg-amber-100 text-amber-800 border-amber-300';
                          }

                          return (
                            <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border inline-flex items-center gap-1 shadow-2xs", badgeStyle)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", statusText === 'Fully Settled' ? 'bg-emerald-600' : statusText === 'Partially Settled' ? 'bg-sky-600' : 'bg-amber-600')} />
                              {statusText}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEdit(p)}
                            className="px-2 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors cursor-pointer"
                          >
                            Edit / View
                          </button>
                          <button
                            onClick={() => onViewLedger(p.party_name || p.supplier || '')}
                            className="px-2 py-1 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors cursor-pointer"
                            title="View Party Ledger"
                          >
                            Ledger
                          </button>
                          <button
                            onClick={() => onDelete(p.voucher_no)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 italic text-xs">
                    No payment records found in `payment_master`. Click "New Payment Voucher" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-2">
          <PaginationControls
            currentPage={currentPage}
            totalItems={filteredPayments.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </div>
  );
}
