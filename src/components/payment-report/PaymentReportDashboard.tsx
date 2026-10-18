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
        {/* Total Vouchers (BJCL Theme Rose) */}
        <div className="h-full min-w-0 bg-gradient-to-br from-rose-50 via-white to-red-50/60 p-3 rounded-xl border border-rose-200 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800">
              Total Vouchers
            </p>
            <h3 className="text-xl font-black text-rose-950 font-mono mt-0.5">
              {paymentList.length}
            </h3>
            <p className="text-[9px] text-rose-700 font-semibold mt-0.5 truncate">
              Vouchers Registered
            </p>
          </div>
          <div className="shrink-0 ml-2 p-2.5 bg-rose-100/80 border border-rose-200 rounded-xl text-rose-700 shadow-xs">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {/* Total Paid Amount (Light Emerald/Teal) */}
        <div className="h-full min-w-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50/60 p-3 rounded-xl border border-emerald-200 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
              Total Paid Amount
            </p>
            <h3 className="text-xl font-black text-emerald-950 font-mono mt-0.5 truncate">
              {formatIndianCurrency(totalPaidSum)}
            </h3>
            <p className="text-[9px] text-emerald-600 font-semibold mt-0.5 truncate">
              {completedCount} Vouchers Cleared
            </p>
          </div>
          <div className="shrink-0 ml-2 p-2.5 bg-emerald-100/80 border border-emerald-200 rounded-xl text-emerald-600 shadow-xs">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Total Payable Value (Light Purple/Violet) */}
        <div className="h-full min-w-0 bg-gradient-to-br from-purple-50 via-white to-indigo-50/60 p-3 rounded-xl border border-purple-200 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700">
              Total Payable Value
            </p>
            <h3 className="text-xl font-black text-purple-950 font-mono mt-0.5 truncate">
              {formatIndianCurrency(totalPayableSum)}
            </h3>
            <p className="text-[9px] text-purple-600 font-semibold mt-0.5 truncate">
              Total Gross Invoice Value
            </p>
          </div>
          <div className="shrink-0 ml-2 p-2.5 bg-purple-100/80 border border-purple-200 rounded-xl text-purple-600 shadow-xs">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Pending / Retention (Light Rose) */}
        <div className="h-full min-w-0 bg-gradient-to-br from-rose-50 via-white to-rose-50/60 p-3 rounded-xl border border-rose-200 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 flex items-center gap-1">
              <Clock className="w-3 h-3 text-rose-600" />
              Pending / Retention
            </p>
            <h3 className="text-xl font-black text-rose-950 font-mono mt-0.5 truncate">
              {formatIndianCurrency(totalPendingSum)}
            </h3>
            <p className="text-[9px] text-rose-600 font-semibold mt-0.5 truncate">
              {pendingCount} Outstanding / Retention
            </p>
          </div>
          <div className="shrink-0 ml-2 p-2.5 bg-rose-100/80 border border-rose-200 rounded-xl text-rose-600 shadow-xs">
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
            className="px-3 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>
    </div>
  );
};
