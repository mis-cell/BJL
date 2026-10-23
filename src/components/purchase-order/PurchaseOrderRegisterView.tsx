import React, { useState } from 'react';
import { 
  X, 
  ChevronDown, 
  Search, 
  Printer, 
  Plus, 
  RefreshCcw, 
  Download, 
  Clock, 
  Check, 
  AlertTriangle, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Lock, 
  Unlock, 
  UserCheck, 
  Trash2, 
  TrendingUp, 
  ClipboardList,
  BarChart3
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from 'recharts';
import { cn } from '../../lib/utils';
import { PaginationControls } from '../PaginationControls';
import { calculateWeightTolerance } from '../../lib/weightTolerance';
import { getCurrentUserContext, isUserAdmin, isL5OrAdmin, isUserId2, isLevel4OrAbove } from '../../lib/permissions';
import { PoHistogramHistoryModal } from './PoHistogramHistoryModal';

export interface PurchaseOrderRegisterViewProps {
  isArchiveView: boolean;
  isTempPo: boolean;
  onClose?: () => void;
  statusFilter: 'all' | 'pending' | 'completed' | 'short' | 'excess' | 'cancelled';
  setStatusFilter: (status: any) => void;
  totalPendingPos: number;
  totalGeneratedPos: number;
  totalCompletedPos: number;
  totalShortPos: number;
  totalExcessPos: number;
  cumulativeWeight: number;
  statusPieData: any[];
  STATUS_COLORS: string[];
  scopedPos: any[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  selectedMonth?: string | null;
  setSelectedMonth?: (monthKey: string | null) => void;
  handleCsvDownload: () => void;
  fetchPosAndMasters: () => void;
  loading: boolean;
  handleGlobalAdd: () => void;
  selectedPoNo: string;
  setSelectedPoNo: (poNo: string) => void;
  poList: any[];
  handlePrintPo: (po: any) => void;
  handleDeletePo: (poNo: string) => void;
  handleSort: (col: string) => void;
  renderSortIndicator: (col: string) => React.ReactNode;
  sortedPos: any[];
  filteredPos: any[];
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  handleLoadSelectedPo: (item: any) => void;
  isPoMismatchResolved: (item: any) => boolean;
  setClosedNoticePo: (po: any) => void;
  openReopenAuthModal: (po: any) => void;
  setAuditViewPo: (po: any) => void;
  handleCloseSauda: (po: any) => void;
  allPayments: any[];
  allSettlements: any[];
  checkIsAdvancePaymentDone: (item: any, paymentsList: any[]) => boolean;
  checkIsSettlementDone: (item: any, settlementsList: any[]) => boolean;
  setExcessShortModalPo: (po: any) => void;
  handlePassToFinal: (item: any) => void;
  actionMenu: any;
  setActionMenu: (menu: any) => void;
  canEditOrDelete: () => boolean;
  sattaBaseRates?: any[];
  allTempArrivals?: any[];
  allInspections?: any[];
}

export const PurchaseOrderRegisterView: React.FC<PurchaseOrderRegisterViewProps> = ({
  isArchiveView,
  isTempPo,
  onClose,
  statusFilter,
  setStatusFilter,
  totalPendingPos,
  totalGeneratedPos,
  totalCompletedPos,
  totalShortPos,
  totalExcessPos,
  cumulativeWeight,
  statusPieData,
  STATUS_COLORS,
  scopedPos,
  searchTerm,
  setSearchTerm,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedMonth = null,
  setSelectedMonth,
  handleCsvDownload,
  fetchPosAndMasters,
  loading,
  handleGlobalAdd,
  selectedPoNo,
  setSelectedPoNo,
  poList,
  handlePrintPo,
  handleDeletePo,
  handleSort,
  renderSortIndicator,
  sortedPos,
  filteredPos,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  handleLoadSelectedPo,
  isPoMismatchResolved,
  setClosedNoticePo,
  openReopenAuthModal,
  setAuditViewPo,
  handleCloseSauda,
  allPayments,
  allSettlements,
  checkIsAdvancePaymentDone,
  checkIsSettlementDone,
  setExcessShortModalPo,
  handlePassToFinal,
  actionMenu,
  setActionMenu,
  canEditOrDelete,
  sattaBaseRates = [],
  allTempArrivals = [],
  allInspections = []
}) => {
  const [histogramModalPo, setHistogramModalPo] = useState<any | null>(null);

  const normalizeDateYMD = (d: any) => {
    if (!d) return '';
    const str = String(d).trim();
    if (str.length >= 10 && str[4] === '-' && str[7] === '-') return str.slice(0, 10);
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return str.slice(0, 10);
  };

  const getTd5BaseRateForDate = (dateStr: string): number => {
    const targetYmd = normalizeDateYMD(dateStr);
    const baseList = sattaBaseRates || [];
    if (baseList.length > 0) {
      const matches = baseList.filter((b: any) => {
        const bDateYmd = normalizeDateYMD(b.start_date || b.start || b.date || '');
        return bDateYmd && bDateYmd <= targetYmd;
      }).sort((a: any, b: any) => {
        const d1 = normalizeDateYMD(a.start_date || a.start || a.date || '');
        const d2 = normalizeDateYMD(b.start_date || b.start || b.date || '');
        return d2.localeCompare(d1);
      });
      if (matches.length > 0) {
        const r = Number(matches[0].base_rate || matches[0].rate || 0);
        if (r > 0) return r;
      }
    }
    return 13500;
  };

  return (
    <div className="space-y-2.5">
      {/* Top Stat Cards & Chart layout (Colour Full as per card titles) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Card 1: Active Pending P.O. (Light Rose) */}
        <div 
          onClick={() => setStatusFilter('pending')}
          className={`rounded-xl p-3 shadow-xs hover:shadow-md transition-all flex items-center justify-between cursor-pointer border ${
            statusFilter === 'pending' 
              ? 'bg-rose-100/90 border-rose-400 ring-2 ring-rose-400/50 scale-[1.02]' 
              : 'bg-gradient-to-br from-rose-50 via-white to-rose-50/60 border-rose-200 hover:-translate-y-0.5'
          }`}
          title="Filter table by Active Pending P.O."
        >
          <div>
            <p className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider mb-0.5">Active Pending P.O.</p>
            <p className="text-xl sm:text-2xl font-black text-rose-950 font-mono tracking-tight">{totalPendingPos}</p>
          </div>
          <div className="p-2.5 bg-rose-100/80 border border-rose-200 rounded-xl text-rose-600 shadow-xs">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2: Total Generated POs (Light Indigo/Blue) */}
        <div 
          onClick={() => setStatusFilter('all')}
          className={`rounded-xl p-3 shadow-xs hover:shadow-md transition-all flex items-center justify-between cursor-pointer border ${
            statusFilter === 'all' 
              ? 'bg-blue-100/90 border-blue-400 ring-2 ring-blue-400/50 scale-[1.02]' 
              : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50/60 border-blue-200 hover:-translate-y-0.5'
          }`}
          title="Show all generated P.O records"
        >
          <div>
            <p className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider mb-0.5">Total Generated POs</p>
            <p className="text-xl sm:text-2xl font-black text-blue-950 font-mono tracking-tight">{totalGeneratedPos}</p>
          </div>
          <div className="p-2.5 bg-blue-100/80 border border-blue-200 rounded-xl text-blue-600 shadow-xs">
            <ClipboardList className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Cumulative PO Weight (Light Emerald/Teal) */}
        <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50/60 rounded-xl p-3 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between border border-emerald-200">
          <div>
            <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider mb-0.5">Cumulative PO Weight</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-950 font-mono tracking-tight">
              {cumulativeWeight.toFixed(2)} <span className="text-xs font-bold text-emerald-700">Tons</span>
            </p>
          </div>
          <div className="p-2.5 bg-emerald-100/80 border border-emerald-200 rounded-xl text-emerald-600 shadow-xs">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* Card 4: Status Mix (Light Purple/Violet) */}
        <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50/60 rounded-xl p-3 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between gap-2 border border-purple-200">
          <div className="flex-1 min-w-[85px]">
            <p className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider mb-1">Status Mix</p>
            <div className="space-y-1">
              <button 
                onClick={() => setStatusFilter('pending')}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer text-left w-full text-xs font-bold ${
                  statusFilter === 'pending' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-800 border border-rose-200/80 hover:bg-rose-100'
                }`}
                title="Filter by Pending"
              >
                <span className={`w-2 h-2 rounded-full inline-block ${statusFilter === 'pending' ? 'bg-white' : 'bg-rose-500'}`} />
                <span className="truncate">Pending ({totalPendingPos})</span>
              </button>
              <button 
                onClick={() => setStatusFilter('completed')}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer text-left w-full text-xs font-bold ${
                  statusFilter === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100'
                }`}
                title="Filter by Completed"
              >
                <span className={`w-2 h-2 rounded-full inline-block ${statusFilter === 'completed' ? 'bg-white' : 'bg-emerald-500'}`} />
                <span className="truncate">Completed ({totalCompletedPos})</span>
              </button>
            </div>
          </div>
          <div className="w-14 h-11 relative flex justify-center items-center shrink-0">
            {scopedPos.length === 0 ? (
              <div className="text-purple-400 text-[8.5px] font-bold">No Data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={80} minHeight={44}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={9}
                    outerRadius={18}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[index]} stroke="#c084fc" strokeWidth={1} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ background: '#ffffff', border: '1px solid #c084fc', color: '#1e1b4b', fontSize: '9px', borderRadius: '8px', padding: '2px 6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                    itemStyle={{ padding: 0, color: '#1e1b4b' }}
                    formatter={(value: any, name: any) => [`${value} POs`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Register Search and Mode Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs flex flex-wrap items-center gap-2 justify-between">
        {/* Search Box */}
        <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input  id="search_by_po_no_broker_na_2911" name="search_by_po_no_broker_na" aria-label="Search by PO No, Broker Name, Supplier Name, Station/Area..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F7AFA8]/20 focus:border-[#F7AFA8] transition-all" 
            placeholder="Search by PO No, Broker Name, Supplier Name, Station/Area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Beside Search Box: New Manual P.O (PTF) & Status Filter Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {isTempPo && (
            <button
              onClick={handleGlobalAdd}
              className="bg-[#F7AFA8] hover:bg-[#D94B5A] text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
              title="Create empty PTF PO directly"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-300" />
              <span>New Manual P.O (PTF)</span>
            </button>
          )}

          {/* Status Filter Toggle Options */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg gap-0.5 border border-slate-200 shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show all Purchase Orders"
            >
              All ({totalGeneratedPos})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-rose-600 text-white shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
              title="Show only Active Pending Purchase Orders"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'pending' ? 'bg-white' : 'bg-rose-500'}`} />
              Pending ({totalPendingPos})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-emerald-800'
              }`}
              title="Show Completed / Fully Received Purchase Orders"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'completed' ? 'bg-white' : 'bg-emerald-500'}`} />
              Completed ({totalCompletedPos})
            </button>
            <button
              onClick={() => setStatusFilter('short')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                statusFilter === 'short'
                  ? 'bg-amber-600 text-white shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-amber-800'
              }`}
              title="Show Short Weight Purchase Orders"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'short' ? 'bg-white' : 'bg-amber-500'}`} />
              Short Wt ({totalShortPos})
            </button>
            <button
              onClick={() => setStatusFilter('excess')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                statusFilter === 'excess'
                  ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-blue-800'
              }`}
              title="Show Excess Weight Purchase Orders"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'excess' ? 'bg-white' : 'bg-blue-500'}`} />
              Excess Wt ({totalExcessPos})
            </button>
          </div>
        </div>

        {/* Date Filters & Quick Actions */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-xs">
            <span className="text-[9.5px] font-bold text-slate-500 uppercase px-1">From</span>
            <input  id="startdate_2921" name="startdate" aria-label="startdate" type="date" className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-[9.5px] font-bold text-slate-500 uppercase px-1">To</span>
            <input  id="enddate_2923" name="enddate" aria-label="enddate" type="date" className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <button 
            onClick={handleCsvDownload} 
            className="bg-[#F7AFA8] hover:bg-[#D94B5A] text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
            title="Download filtered records as CSV"
          >
            <Download className="h-3.5 w-3.5 text-emerald-200" /> Export CSV
          </button>
          <button
            onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setStatusFilter('all'); }}
            title="Clear search and status filter"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
          <button 
            onClick={fetchPosAndMasters}
            title="Refresh Purchase Orders from database"
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50" disabled={loading}
          >
            <RefreshCcw className={`h-3.5 w-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* PO Grid Table */}
      <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-xs overflow-x-auto overflow-y-auto max-h-[calc(100vh-250px)] min-h-[400px] w-full max-w-full touch-overflow-container">
         <table className="w-full min-w-[1880px] border-collapse text-xs text-[#111111]">
            <thead className="bg-[#FDE7E6] sticky top-0 z-20 font-black border-b-2 border-[#D94B5A] shadow-2xs">
               <tr className="h-10 text-[#111111] text-[11px] sm:text-[12px] uppercase tracking-wider">
                  <th 
                    onClick={() => handleSort('po_no')}
                    className="px-3 py-2.5 text-left border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider cursor-pointer select-none hover:bg-[#FBCFCB] transition-colors group min-w-[160px]"
                    title="Sort by PO / PTF No"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>PO / PTF NO</span>
                      {renderSortIndicator('po_no')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('date')}
                    className="px-3 py-2.5 text-center border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider cursor-pointer select-none hover:bg-[#FBCFCB] transition-colors group min-w-[110px]"
                    title="Sort by Date"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>DATE</span>
                      {renderSortIndicator('date')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('type')}
                    className="px-3 py-2.5 text-center border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider cursor-pointer select-none hover:bg-[#FBCFCB] transition-colors group min-w-[120px]"
                    title="Sort by Type"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>TYPE</span>
                      {renderSortIndicator('type')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('broker')}
                    className="px-3 py-2.5 text-left border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider cursor-pointer select-none hover:bg-[#FBCFCB] transition-colors group min-w-[190px]"
                    title="Sort by Broker"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>BROKER</span>
                      {renderSortIndicator('broker')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('supplier')}
                    className="px-3 py-2.5 text-left border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider cursor-pointer select-none hover:bg-[#FBCFCB] transition-colors group min-w-[220px]"
                    title="Sort by Party / Supplier"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>PARTY / SUPPLIER</span>
                      {renderSortIndicator('supplier')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('unit')}
                    className="px-3 py-2.5 text-center border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider cursor-pointer select-none hover:bg-[#FBCFCB] transition-colors group min-w-[100px]"
                    title="Sort by Unit"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>UNIT</span>
                      {renderSortIndicator('unit')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('total_units')}
                    className="px-3 py-2.5 text-right border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider cursor-pointer select-none hover:bg-[#FBCFCB] transition-colors group min-w-[100px]"
                    title="Sort by Count"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>COUNT</span>
                      {renderSortIndicator('total_units')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('weight')}
                    className="px-3 py-2.5 text-right border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider cursor-pointer select-none hover:bg-[#FBCFCB] transition-colors group min-w-[200px]"
                    title="Sort by Weight"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>WEIGHT</span>
                      {renderSortIndicator('weight')}
                    </div>
                  </th>
                   <th 
                    onClick={() => handleSort('status')}
                    className="px-3 py-2.5 text-center border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider cursor-pointer select-none hover:bg-[#FBCFCB] transition-colors group min-w-[125px]"
                    title="Sort by Status"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>STATUS</span>
                      {renderSortIndicator('status')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('closed_open')}
                    className="px-3 py-2.5 text-center border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider cursor-pointer select-none hover:bg-[#FBCFCB] transition-colors group min-w-[155px]"
                    title="Sort by Lorry Status (Closed / Open)"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>LORRY STATUS</span>
                      {renderSortIndicator('closed_open')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('excess_short')}
                    className="px-3 py-2.5 text-center border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider cursor-pointer select-none hover:bg-[#FBCFCB] transition-colors group min-w-[155px]"
                    title="Sort by WT Status. Policy: Lower of 5% or 1500 kg is Tolerable; Penalty = TD5 Difference × Excess Qtl"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>WT STATUS</span>
                      {renderSortIndicator('excess_short')}
                    </div>
                  </th>
                  {isTempPo && (
                    <>
                      <th 
                        onClick={() => handleSort('pass_mismatch')}
                        className="px-3 py-2.5 text-center border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider cursor-pointer select-none hover:bg-[#FBCFCB] transition-colors group min-w-[120px]"
                        title="Sort by Pass / Mis"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>PASS/MIS</span>
                          {renderSortIndicator('pass_mismatch')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2.5 text-center border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider min-w-[145px]"
                        title="Current Process Stage"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>STAGE</span>
                        </div>
                      </th>
                    </>
                  )}
                  <th 
                    className="px-2 py-2.5 text-center border-r border-[#CBD5E1] whitespace-nowrap font-black uppercase tracking-wider min-w-[56px] bg-[#FBCFCB] text-[#111111]"
                    title="P.O. Histogram & Complete Multi-M.R. History"
                  >
                    <div className="flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-[#D94B5A]" />
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap font-black uppercase tracking-wider min-w-[130px] bg-[#FDE7E6] text-[#111111]">ACTIONS</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] font-medium">
               {sortedPos.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item, idx) => {
                  const isSelected = selectedPoNo === item.po_no;
                  const isVoid = item.status === 'cancelled';
                  return (
                  <tr 
                     key={item.po_no} 
                     onClick={() => setSelectedPoNo(item.po_no)}
                     onDoubleClick={() => { 
                        if (!isVoid) {
                           const userCtx = getCurrentUserContext();
                           const isUser002Only = isUserId2(userCtx) && !isLevel4OrAbove(userCtx);
                           if (isUser002Only && isTempPo) {
                             alert("🔒 Access Denied: Only Level 4 or Admin can edit saved records in Sauda Check Point Dashboard.");
                             return;
                           }

                           const currentUserRole = (userCtx?.userRole || (userCtx as any)?.role || "USER").toUpperCase();
                           const currentUserLevel = (userCtx?.userLevel || (userCtx as any)?.level || "L1").toUpperCase();
                           const isAdminUser = isUserAdmin(userCtx) || currentUserRole === "ADMIN" || currentUserRole === "ADMINISTRATOR" || Boolean((userCtx as any)?.isAdmin) || currentUserLevel === "ADMIN" || currentUserLevel === "L5" || isL5OrAdmin();

                           const contractLorries = item.contract_lorries || item.total_no_of_lorries || 1;
                           const receivedLorries = item.received_lorries || 0;
                           const isClosed = !item.is_reopened && Boolean(item.is_closed || item.status === 'closed' || (contractLorries > 0 && receivedLorries >= contractLorries));

                           if (isClosed && !isAdminUser) {
                             if (setClosedNoticePo) setClosedNoticePo(item);
                             return;
                           }

                           handleLoadSelectedPo(item);
                        }
                     }}
                     className={cn(
                        "h-10 cursor-pointer transition-colors text-xs font-semibold",
                        isSelected ? "bg-[#FBCFCB] text-[#111111]" : 
                        isVoid ? "bg-rose-50/40 text-slate-400 line-through decoration-rose-400/50" :
                        (idx % 2 === 0 ? "bg-white hover:bg-[#FFF2CC]" : "bg-[#FFFCFB] hover:bg-[#FFF2CC]")
                     )}
                  >
                     <td className={cn("px-2.5 py-1.5 font-mono font-bold select-text whitespace-nowrap border-r border-[#CBD5E1]", isVoid ? "text-rose-400" : "text-[#111111]")}>{item.po_no}</td>
                     <td className="px-2 py-1.5 text-center font-mono whitespace-nowrap border-r border-[#CBD5E1] text-[#262626]">{item.po_date || item.created_at?.slice(0, 10) || ''}</td>
                     <td className="px-2 py-1.5 text-center whitespace-nowrap border-r border-[#CBD5E1]">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold tracking-tight", item.ptf_no ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-emerald-100 text-emerald-900 border border-emerald-300")}>
                           {item.ptf_no ? 'PTF ENTRY' : 'SAUDA LINKED'}
                        </span>
                     </td>
                     <td className="px-2.5 py-1.5 uppercase font-semibold border-r border-[#CBD5E1] text-[#111111] max-w-[200px] truncate" title={item.broker}>{item.broker || '-'}</td>
                     <td className="px-2.5 py-1.5 uppercase font-bold border-r border-[#CBD5E1] text-[#111111] max-w-[220px] truncate" title={item.supplier}>{item.supplier || '-'}</td>
                     <td className="px-2 py-1.5 text-center font-bold uppercase whitespace-nowrap border-r border-[#CBD5E1] text-[10px] text-[#262626]">{item.purchase_unit_name || 'BALES'}</td>
                     <td className="px-2 py-1.5 text-right font-mono font-bold whitespace-nowrap border-r border-[#CBD5E1] text-[#111111]">{item.total_units || 0}</td>
                     <td className="px-2.5 py-1.5 text-left font-mono border-r border-[#CBD5E1] min-w-[180px]">
                        {(() => {
                           const contract = parseFloat(item.total_contract_mt || 0) || 0;
                           const rcvd = Number(item.received_weight_mt || 0);
                           const unit = item.purchase_unit_name || item.unit_type || item.unit || 'BALES';
                           const tol = item.weight_tolerance || calculateWeightTolerance(contract, rcvd, unit);
                           const pct = contract > 0 ? Math.min(100, Math.max(0, (rcvd / contract) * 100)) : 0;
                           const barGradient = tol.isCompleted 
                              ? 'from-emerald-500 to-green-600' 
                              : pct > 0 
                              ? 'from-blue-600 to-indigo-600' 
                              : 'from-slate-300 to-slate-400';
                           return (
                              <div>
                                 <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
                                    <span className={cn("whitespace-nowrap font-mono", tol.isCompleted ? "text-emerald-800 font-extrabold" : "text-[#111111]")}>
                                       {rcvd.toFixed(3)} MT Rcvd
                                    </span>
                                    <span className="font-sans text-[9px] text-[#404040]">of</span>
                                    <span className="font-mono font-bold whitespace-nowrap text-[#111111]">
                                       {contract.toFixed(3)} MT
                                    </span>
                                 </div>
                                 <div className="mt-1 space-y-0.5">
                                    <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden" title={`${pct.toFixed(1)}% received.`}>
                                       <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-300", barGradient)} style={{ width: `${tol.isCompleted ? 100 : pct}%` }} />
                                    </div>
                                 </div>
                              </div>
                           );
                        })()}
                     </td>
                      {/* Operational Status Column */}
                      <td className="px-2 py-1.5 text-center whitespace-nowrap border-r border-[#CBD5E1] min-w-[110px]">
                         {(() => {
                            const contractLorries = item.contract_lorries || item.total_no_of_lorries || 1;
                            const receivedLorries = item.received_lorries || 0;
                            const isClosed = !item.is_reopened && Boolean(item.is_closed || item.status === "closed" || (contractLorries > 0 && receivedLorries >= contractLorries));
                            const isResolved = isPoMismatchResolved(item);
                            const stage = item.workflow_stage || (item.pass_status === "pass" ? "final_po" : item.pass_status) || "temp_arrival_pending";

                            const isMismatch = !isResolved && (
                              stage === "mismatch" || 
                              (item.mismatch_fields && item.mismatch_fields.length > 0) || 
                              Boolean(item.has_mismatch)
                            );

                            if (isMismatch) {
                              return (
                                <span 
                                  className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1"
                                  title="Has an active Mismatch awaiting approval"
                                >
                                  <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                  <span>MISMATCH</span>
                                </span>
                              );
                            }

                            if (isClosed) {
                              return (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-[#166534] bg-[#DCFCE7] border border-[#86EFAC] inline-flex items-center gap-1">
                                  <Check className="w-3 h-3 text-[#166534]" />
                                  <span>COMPLETED</span>
                                </span>
                              );
                            }

                            return (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-[#92400E] bg-[#FFF2CC] border border-[#FFE08A] inline-flex items-center gap-1">
                                <span>PENDING</span>
                              </span>
                            );
                         })()}
                      </td>

                      {/* CLOSED / OPEN Column (Lorry-wise) */}
                      <td className="px-2 py-1.5 text-center whitespace-nowrap border-r border-[#CBD5E1] min-w-[145px]">
                         {(() => {
                            const userCtx = getCurrentUserContext();
                            const userRole = String(userCtx?.userRole || "").toUpperCase();
                            const userLevel = String(userCtx?.userLevel || "").toUpperCase();
                            const isAdminOrL4 = isUserAdmin(userCtx) || userRole === "ADMIN" || userRole === "ADMINISTRATOR" || isL5OrAdmin() || userLevel === "L4" || userLevel === "L5" || userLevel === "MAX";

                            const contract = parseFloat(item.total_contract_mt || 0) || 0;
                            const rcvd = Number(item.received_weight_mt || 0);
                            const contractLorries = item.contract_lorries || item.total_no_of_lorries || 1;
                            const receivedLorries = item.received_lorries || 0;
                            const isClosed = !item.is_reopened && Boolean(item.is_closed || item.status === "closed" || (contractLorries > 0 && receivedLorries >= contractLorries));

                            const canShowReopen = isAdminOrL4 && isClosed;

                            let openRemarksData = item.open_remarks;
                            if (typeof openRemarksData === 'string') {
                              try { openRemarksData = JSON.parse(openRemarksData); } catch (e) {}
                            }

                            if (isClosed) {
                              return (
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <span 
                                    onClick={(e) => { e.stopPropagation(); setClosedNoticePo(item); }}
                                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700 flex items-center gap-1 whitespace-nowrap cursor-pointer hover:bg-slate-700 transition-colors"
                                    title={`Sauda is CLOSED: ${receivedLorries} of ${contractLorries} Lorries Received.`}
                                  >
                                    <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                    <span>CLOSED ({receivedLorries}/{contractLorries} Lorry)</span>
                                  </span>

                                  {canShowReopen ? (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); openReopenAuthModal(item); }}
                                      className="text-[9px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Click to Reopen this Closed Sauda"
                                    >
                                      <Unlock className="w-2.5 h-2.5 text-emerald-700" />
                                      <span>Reopen</span>
                                    </button>
                                  ) : (
                                    <span className="text-[8px] font-semibold text-slate-500 italic">
                                      Within Tolerance
                                    </span>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span 
                                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#166534] border border-[#86EFAC] flex items-center gap-1 whitespace-nowrap"
                                  title={`Sauda is OPEN: ${receivedLorries} of ${contractLorries} Lorries Received.`}
                                >
                                  <Unlock className="w-2.5 h-2.5 text-[#166534] shrink-0" />
                                  <span>OPEN ({receivedLorries}/{contractLorries} Lorry)</span>
                                </span>

                                {openRemarksData && (
                                  <div
                                    onClick={(e) => { e.stopPropagation(); setAuditViewPo(item); }}
                                    className="flex items-center gap-1 text-[8.5px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors max-w-[150px]"
                                    title={`Reopened by: ${openRemarksData.opened_by}`}
                                  >
                                    <UserCheck className="w-2.5 h-2.5 text-indigo-700 shrink-0" />
                                    <span className="truncate">By {openRemarksData.opened_by}</span>
                                  </div>
                                )}

                                {isAdminOrL4 && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleCloseSauda(item); }}
                                    className="text-[8.5px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded border border-slate-300 transition-colors flex items-center gap-0.5 cursor-pointer"
                                    title="Manually Close this Sauda"
                                  >
                                    <Lock className="w-2 h-2 text-slate-600" />
                                    <span>Force Close</span>
                                  </button>
                                )}
                              </div>
                            );
                         })()}
                      </td>

                      {/* EXCESS / SHORT WEIGHT Column */}
                      <td className="px-2 py-1.5 text-center whitespace-nowrap border-r border-[#CBD5E1] min-w-[145px]">
                         {(() => {
                            const contract = parseFloat(item.total_contract_mt || 0) || 0;
                            const rcvd = Number(item.received_weight_mt || 0);
                            const unit = item.purchase_unit_name || item.unit_type || item.unit || 'BALES';
                            const tol = item.weight_tolerance || calculateWeightTolerance(contract, rcvd, unit);

                            if (rcvd <= 0) {
                              return (
                                <div
                                  onClick={(e) => { e.stopPropagation(); setExcessShortModalPo(item); }}
                                  className="cursor-pointer group flex flex-col items-center justify-center"
                                  title="No arrival received yet."
                                >
                                  <span className="text-[10px] text-slate-500 font-medium italic group-hover:text-[#D94B5A] transition-colors">Pending Arrival</span>
                                </div>
                              );
                            }

                            if (tol.isWithinTolerance) {
                              return (
                                <div 
                                  onClick={(e) => { e.stopPropagation(); setExcessShortModalPo(item); }}
                                  className="flex flex-col items-center justify-center gap-0.5 cursor-pointer group"
                                  title={`Weight within tolerance.`}
                                >
                                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">
                                    ✓ TOLERABLE (±{tol.toleranceMt.toFixed(2)} MT)
                                  </span>
                                  <span className="text-[8px] font-bold text-[#404040]">
                                    Diff: {tol.diffMt >= 0 ? `+${tol.diffMt.toFixed(3)}` : tol.diffMt.toFixed(3)} MT
                                  </span>
                                </div>
                              );
                            }

                            const cleanPo = (s: any) => String(s || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                            const targetPo = cleanPo(item.po_no);
                            const targetSauda = cleanPo(item.sauda_no || item.contract_po_no);
                            const matchedArrival = allTempArrivals?.find((ar: any) => {
                              const arPo = cleanPo(ar.po_no || ar.sauda_no || ar.contract_po_no || ar.temporary_arrival_no);
                              return arPo && (arPo === targetPo || arPo === targetSauda);
                            });

                            const saudaDateStr = item.s_date || item.po_date || item.date || item.contract_date || item.created_at?.slice(0, 10) || '';
                            const arrivalDateStr = matchedArrival?.date || matchedArrival?.arrival_date || item.last_arrival_date || item.arrival_date || saudaDateStr;

                            const saudaTd5Rate = parseFloat(item.b_rate || 0) > 0 ? parseFloat(item.b_rate) : getTd5BaseRateForDate(saudaDateStr);
                            const arrivalTd5Rate = getTd5BaseRateForDate(arrivalDateStr);
                            const td5RateDiff = Math.abs((arrivalTd5Rate || 0) - (saudaTd5Rate || 0));

                            if (tol.isOverDelivery) {
                              const excessMt = Math.max(0, tol.excessOverToleranceMt || 0);
                              const excessQtl = Math.max(0, tol.excessOverToleranceQtl || 0);
                              const rawPenalty = td5RateDiff * excessQtl;
                              const penaltyAmount = isNaN(rawPenalty) || rawPenalty < 0 ? 0 : Math.round(rawPenalty * 100) / 100;

                              return (
                                <div
                                  onClick={(e) => { e.stopPropagation(); setExcessShortModalPo(item); }}
                                  className="flex flex-col items-center justify-center gap-0.5 cursor-pointer group"
                                >
                                  <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded border border-purple-300 bg-purple-100 text-purple-950">
                                    +{excessMt.toFixed(3)} MT Excess
                                  </span>
                                  <span className="text-[8px] font-extrabold text-[#991B1B] bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded-full">
                                    Penalty: ₹{penaltyAmount.toLocaleString()}
                                  </span>
                                </div>
                              );
                            }

                            if (tol.isUnderDelivery) {
                              const shortMt = Math.max(0, tol.shortUnderToleranceMt || 0);

                              return (
                                <div
                                  onClick={(e) => { e.stopPropagation(); setExcessShortModalPo(item); }}
                                  className="flex flex-col items-center justify-center gap-0.5 cursor-pointer group"
                                >
                                  <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded border border-[#FFE08A] bg-[#FFF2CC] text-[#92400E]">
                                    -{shortMt.toFixed(3)} MT Short
                                  </span>
                                  <span className="text-[8px] font-bold text-[#92400E]">
                                    Beyond Tol.
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <div
                                onClick={(e) => { e.stopPropagation(); setExcessShortModalPo(item); }}
                                className="cursor-pointer group flex flex-col items-center justify-center"
                              >
                                <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">
                                  Exact (0.00 MT)
                                </span>
                              </div>
                            );
                         })()}
                      </td>

                      {isTempPo && (
                        <>
                          {/* PASS / MISMATCH STATUS */}
                          <td className="px-2 py-1.5 text-center whitespace-nowrap border-r border-[#CBD5E1] min-w-[110px]">
                            {(() => {
                              const contractLorries = item.contract_lorries || item.total_no_of_lorries || 1;
                              const receivedLorries = item.received_lorries || 0;
                              const isClosed = !item.is_reopened && (Boolean(item.is_closed) || (receivedLorries >= contractLorries && contractLorries > 0));

                              const isResolved = isPoMismatchResolved(item);
                              const stage = item.workflow_stage || (item.pass_status === "pass" ? "final_po" : item.pass_status) || "temp_arrival_pending";

                              const isMismatch = !isResolved && (
                                stage === "mismatch" || 
                                (item.mismatch_fields && item.mismatch_fields.length > 0) || 
                                Boolean(item.has_mismatch)
                              );

                              if (isMismatch) {
                                return (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                    <span>Mismatch Case</span>
                                  </span>
                                );
                              }

                              if (!isClosed) {
                                return null;
                              }

                              return (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] inline-flex items-center gap-1">
                                  <Check className="w-3 h-3 text-[#166534] shrink-0" />
                                  <span>Pass</span>
                                </span>
                              );
                            })()}
                          </td>

                          {/* PROCESS STAGE & PASS ACTION */}
                          <td className="px-2 py-1.5 text-center whitespace-nowrap border-r border-[#CBD5E1] min-w-[135px]">
                            {(() => {
                              const contractLorries = item.contract_lorries || item.total_no_of_lorries || 1;
                              const receivedLorries = item.received_lorries || 0;
                              const isClosed = !item.is_reopened && (Boolean(item.is_closed) || (receivedLorries >= contractLorries && contractLorries > 0));

                              const isAdvDone = checkIsAdvancePaymentDone(item, allPayments);
                              const isSettlementDone = checkIsSettlementDone(item, allSettlements);

                              if (!isAdvDone) {
                                return (
                                  <span className="text-[9px] font-bold text-[#404040] bg-slate-100 px-2 py-0.5 rounded border border-slate-300 inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-500" />
                                    <span>ADVANCE PENDING</span>
                                  </span>
                                );
                              }

                              if (!isClosed) {
                                return (
                                  <span className="text-[9px] font-bold text-[#92400E] bg-[#FFF2CC] px-2 py-0.5 rounded border border-[#FFE08A] inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-[#92400E]" />
                                    <span>LORRY PENDING</span>
                                  </span>
                                );
                              }

                              if (!isSettlementDone) {
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      setExcessShortModalPo(item);
                                    }}
                                    className="text-[9px] font-black px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-300 uppercase cursor-pointer inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                                  >
                                    <Clock className="w-3 h-3 text-blue-700" />
                                    <span>SETTLEMENT PENDING</span>
                                  </button>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handlePassToFinal(item); }}
                                  className="text-[9px] font-black px-2.5 py-1 rounded bg-[#D94B5A] hover:bg-[#E85A5A] text-white uppercase shadow-xs cursor-pointer inline-flex items-center gap-1 transition-all active:scale-95 whitespace-nowrap"
                                >
                                  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                  <span>PASS → FINAL P.O</span>
                                </button>
                              );
                            })()}
                          </td>
                        </>
                      )}

                      {/* HISTOGRAM SMALL ICON ONLY COLUMN */}
                      <td className="px-1.5 py-1.5 text-center whitespace-nowrap border-r border-[#CBD5E1] min-w-[48px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistogramModalPo(item);
                          }}
                          className="p-1.5 rounded-lg border border-[#FBCFCB] bg-[#FDE7E6] hover:bg-[#FBCFCB] text-[#D94B5A] transition-all inline-flex items-center justify-center cursor-pointer active:scale-95"
                          title={`📊 Open P.O. Histogram (${item.po_no})`}
                        >
                          <BarChart3 className="w-3.5 h-3.5 text-[#D94B5A] shrink-0" />
                        </button>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-3 py-1.5 text-center min-w-[110px] whitespace-nowrap">
                         {isVoid ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] uppercase border border-rose-200">CANCELLED</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setActionMenu(actionMenu && actionMenu.item.po_no === item.po_no ? null : { item, x: r.right, y: r.bottom });
                                }}
                                className="px-2 py-1 rounded-lg border font-bold text-[10px] uppercase flex items-center gap-1 cursor-pointer bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-800"
                              >
                                Actions <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                         ) : (
                         <div className="flex justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setActionMenu(actionMenu && actionMenu.item.po_no === item.po_no ? null : { item, x: r.right, y: r.bottom });
                              }}
                              className="px-3 py-1 rounded-lg border border-[#CBD5E1] font-bold text-[10px] uppercase flex items-center gap-1 bg-white hover:bg-[#FFF2CC] text-[#111111] transition-colors cursor-pointer shadow-2xs"
                              title="Actions"
                            >
                              Actions <ChevronDown className="w-3 h-3 text-[#404040]" />
                            </button>
                         </div>
                         )}
                      </td>
                   </tr>
                )})}
                {filteredPos.length === 0 && (
                   <tr>
                      <td colSpan={isTempPo ? 15 : 13} className="py-12 text-center text-[#64748B] uppercase font-bold italic">
                        No Saved Purchase Orders found matching criteria.
                      </td>
                   </tr>
                )}
             </tbody>
          </table>
       </div>

       {/* Pagination / Total bar */}
       <div className="bg-white border border-[#CBD5E1] rounded-xl p-3 shadow-2xs flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-wrap gap-3 items-center">
             <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3.5 py-1.5 flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#404040] uppercase">Cumulative Weight:</span>
                <span className="text-xs font-black text-[#111111] font-mono">
                  {filteredPos.reduce((acc, s) => acc + parseFloat(s.total_contract_mt || 0), 0).toFixed(3)} MT
                </span>
             </div>
             <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3.5 py-1.5 flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#404040] uppercase">Closed P.O.s:</span>
                <span className="text-xs font-black text-[#166534] font-mono">
                  {filteredPos.filter(p => p.pending === false || p.pending === 'No').length} Closed
                </span>
             </div>
             <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3.5 py-1.5 flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#404040] uppercase">Total Records:</span>
                <span className="text-xs font-black text-[#111111] font-mono">
                  {filteredPos.length} POs
                </span>
             </div>
          </div>
          <div className="flex-1 max-w-xl">
             <PaginationControls
               currentPage={currentPage}
               totalItems={sortedPos.length}
               pageSize={pageSize}
               onPageChange={setCurrentPage}
               onPageSizeChange={setPageSize}
             />
          </div>
       </div>

       {/* Histogram Lifecycle & Story Modal */}
       {histogramModalPo && (
         <PoHistogramHistoryModal
           isOpen={Boolean(histogramModalPo)}
           onClose={() => setHistogramModalPo(null)}
           po={histogramModalPo}
           allPayments={allPayments}
           allSettlements={allSettlements}
           allArrivals={allTempArrivals}
           allInspections={allInspections}
         />
       )}
    </div>
  );
};

const selectPoRowStyle = (isSelected: boolean) => {
  return isSelected ? "bg-rose-500 text-white border-rose-400" : "text-rose-700 bg-rose-50 border-rose-200";
};
