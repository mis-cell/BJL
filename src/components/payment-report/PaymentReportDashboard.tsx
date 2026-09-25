import React from 'react';
import { 
  Wallet, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Search, 
  Download, 
  RefreshCcw 
} from 'lucide-react';
import { cn, formatIndianCurrency } from '../../lib/utils';
import { PaginationControls } from '../PaginationControls';
import { PaymentMaster } from '../../types/payment.types';

export interface PaymentReportDashboardProps {
  paymentList: PaymentMaster[];
  filteredPayments: PaymentMaster[];
  totalPaidSum: number;
  totalPayableSum: number;
  totalPendingSum: number;
  completedCount: number;
  pendingCount: number;
  searchFilter: string;
  setSearchFilter: (val: string) => void;
  loading: boolean;
  onRefresh: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  currentPage: number;
  pageSize: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export const PaymentReportDashboard: React.FC<PaymentReportDashboardProps> = ({
  paymentList,
  filteredPayments,
  totalPaidSum,
  totalPayableSum,
  totalPendingSum,
  completedCount,
  pendingCount,
  searchFilter,
  setSearchFilter,
  loading,
  onRefresh,
  onExportCsv,
  onExportPdf,
  currentPage,
  pageSize,
  setCurrentPage,
  setPageSize
}) => {
  return (
    <div className="space-y-4">
      {/* Dashboard Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-fr">
        {/* Total Vouchers */}
        <div className="h-full min-w-0 bg-gradient-to-br from-blue-600 to-blue-800 text-white p-3 rounded-xl border border-blue-400/40 shadow-md flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100">
              Total Vouchers
            </p>
            <h3 className="text-xl font-black mt-0.5">
              {paymentList.length}
            </h3>
          </div>
          <div className="shrink-0 ml-2 p-2 bg-white/15 rounded-lg text-white">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {/* Total Paid Amount */}
        <div className="h-full min-w-0 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-3 rounded-xl border border-emerald-400/40 shadow-md flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
              Total Paid Amount
            </p>
            <h3 className="text-lg font-black mt-0.5 truncate">
              {formatIndianCurrency(totalPaidSum)}
            </h3>
            <p className="text-[9px] text-emerald-200 mt-0.5 truncate">
              {completedCount} Vouchers Cleared
            </p>
          </div>
          <div className="shrink-0 ml-2 p-2 bg-white/15 rounded-lg text-white">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Total Payable Value */}
        <div className="h-full min-w-0 bg-gradient-to-br from-violet-600 to-violet-800 text-white p-3 rounded-xl border border-violet-400/40 shadow-md flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-100">
              Total Payable Value
            </p>
            <h3 className="text-lg font-black mt-0.5 truncate">
              {formatIndianCurrency(totalPayableSum)}
            </h3>
            <p className="text-[9px] text-violet-200 mt-0.5 truncate">
              Total Gross Invoice Value
            </p>
          </div>
          <div className="shrink-0 ml-2 p-2 bg-white/15 rounded-lg text-white">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Pending / Retention */}
        <div className="h-full min-w-0 bg-gradient-to-br from-orange-500 to-orange-700 text-white p-3 rounded-xl border border-orange-300/50 shadow-md flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-100 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Pending / Retention
            </p>
            <h3 className="text-lg font-black mt-0.5 text-white truncate">
              {formatIndianCurrency(totalPendingSum)}
            </h3>
            <p className="text-[9px] text-orange-100 mt-0.5 font-semibold truncate">
              {pendingCount} Outstanding / Retention
            </p>
          </div>
          <div className="shrink-0 ml-2 p-2 bg-white/15 rounded-lg text-white">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Bar & Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-[220px] w-full sm:w-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="search_by_voucher_no_part_1467"
            name="search_by_voucher_no_part"
            aria-label="Search by Voucher No, Party Name, M.R No, P.O No, Reference..."
            type="text"
            placeholder="Search by Supplier Name, M.R No ..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="relative flex-1 min-w-0 sm:min-w-[220px] w-full sm:w-auto">
          <select
            id="search_by_payment_from_filter"
            name="search_by_payment_from"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Select Payment From</option>
            <option value="1">FROM BANK</option>
            <option value="2">RXIL</option>
            <option value="3">TReDS </option>
            <option value="4">Invoice Mart</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportCsv}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={onExportPdf}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
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
            Payment Records ({filteredPayments.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase font-black text-slate-600">
                <th className="p-2.5">M.R No</th>
                <th className="p-2.5">Supplier</th>
                <th className="p-2.5 text-center">Advance Done</th>
                <th className="p-2.5 text-right">Payable Amount</th>
                <th className="p-2.5 text-right">Paid Amount</th>
                <th className="p-2.5 text-right">Pending Amount</th>
                <th className="p-2.5 text-right">Payment From</th>
                <th className="p-2.5">Payment Settle date</th>
                <th className="p-2.5">Tenor</th>
                <th className="p-2.5">Re-Payment Date </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPayments.length > 0 ? (
                filteredPayments.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((p, idx) => {
                  const payable = Number(p.payable_amt || (p as any).total_amount || 0);
                  const paid = Number((p as any).paid_amount || 0);
                  const pending = payable - paid;
                  const isAdvanceYes = (p.advance_payment_done || 'No').toLowerCase() === 'yes';
                  const advance_payment_from = p.advance_payment_from || '';
                  return (
                    <tr key={p.payment_id || p.voucher_no || idx} className="hover:bg-purple-50/40 transition-colors">
                      <td className="p-2.5 font-mono text-slate-600">
                        <div className="text-[11px] font-bold text-slate-700">{p.mr_no || '-'}</div>
                        {p.po_no && <div className="text-[9px] text-slate-400">P.O: {p.po_no}</div>}
                      </td>
                      
                      <td className="p-2.5 font-semibold text-slate-800">
                        {p.party_name || p.supplier || '-'}
                      </td>
                      
                      <td className="p-2.5 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border inline-flex items-center gap-1",
                          isAdvanceYes
                            ? "bg-green-100 text-green-900 border-green-300"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                          {isAdvanceYes ? 'YES' : 'NO'}
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
                            {formatIndianCurrency(pending)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                            ₹0 (Cleared)
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {(advance_payment_from === '' || advance_payment_from === '1') && (
                          <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">FROM BANK</span>
                        )}
                        {advance_payment_from === '2' && (
                          <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">RXIL</span>
                        )}
                        {advance_payment_from === '3' && (
                          <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">TReDS</span>
                        )}
                        {advance_payment_from === '4' && (
                          <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">Invoice Mart</span>
                        )} 
                      </td>
                      <td className="p-2.5 font-medium text-slate-600 text-center">
                        {p.payment_settlementdate ? new Date(p.payment_settlementdate).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="p-2.5 font-medium text-slate-600 text-center">
                        {p.tenor || '-'}
                      </td>
                      <td className="p-2.5 font-medium text-slate-600 text-center">
                        {p.repayment_date ? new Date(p.repayment_date).toLocaleDateString('en-IN') : '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 italic text-xs">
                    No payment records found in `payment_master`.
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
};
