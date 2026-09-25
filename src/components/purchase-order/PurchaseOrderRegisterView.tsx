import React from 'react';
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
  ClipboardList
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
import { getCurrentUserContext, isUserAdmin, isL5OrAdmin } from '../../lib/permissions';

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
}) => {
  return (
    <div className="space-y-3">
      {/* Top Stat Cards & Chart layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending POs */}
        <div 
          onClick={() => setStatusFilter('pending')}
          className={`bg-white border rounded-[18px] p-4 shadow-xs hover:shadow-md transition-all flex items-center justify-between cursor-pointer ${
            statusFilter === 'pending' ? 'ring-2 ring-rose-500 border-rose-400 bg-rose-50/20' : 'border-slate-200'
          }`}
          title="Filter table by Active Pending P.O."
        >
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Active Pending P.O.</p>
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">{totalPendingPos}</p>
          </div>
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 shadow-xs">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        {/* Card 2: Generated POs */}
        <div 
          onClick={() => setStatusFilter('all')}
          className={`bg-white border rounded-[18px] p-4 shadow-xs hover:shadow-md transition-all flex items-center justify-between cursor-pointer ${
            statusFilter === 'all' ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-50/20' : 'border-slate-200'
          }`}
          title="Show all generated P.O records"
        >
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Generated POs</p>
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">{totalGeneratedPos}</p>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600 shadow-xs">
            <ClipboardList className="h-6 w-6" />
          </div>
        </div>

        {/* Card 3: Cumulative PO Weight */}
        <div className="bg-white border border-slate-200 rounded-[18px] p-4 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cumulative PO Weight</p>
            <p className="text-2xl font-black text-emerald-800 font-mono tracking-tight">{cumulativeWeight.toFixed(2)} <span className="text-xs font-bold text-slate-500">Tons</span></p>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 shadow-xs">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Card 4: Status Distribution Pie Chart Widget */}
        <div className="bg-white border border-slate-200 rounded-[18px] p-4 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between gap-3">
          <div className="flex-1 min-w-[90px]">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status Mix</p>
            <div className="space-y-1">
              <button 
                onClick={() => setStatusFilter('pending')}
                className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg transition-all cursor-pointer text-left w-full ${
                  statusFilter === 'pending' ? 'bg-rose-100/70 font-black' : 'hover:bg-slate-100'
                }`}
                title="Filter by Pending"
              >
                <span className="w-2 h-2 rounded-full inline-block bg-rose-600" />
                <span className="text-xs font-bold text-rose-700">Pending ({totalPendingPos})</span>
              </button>
              <button 
                onClick={() => setStatusFilter('completed')}
                className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg transition-all cursor-pointer text-left w-full ${
                  statusFilter === 'completed' ? 'bg-emerald-100/70 font-black' : 'hover:bg-slate-100'
                }`}
                title="Filter by Completed"
              >
                <span className="w-2 h-2 rounded-full inline-block bg-emerald-600" />
                <span className="text-xs font-bold text-emerald-700">Completed ({totalCompletedPos})</span>
              </button>
            </div>
          </div>
          <div className="w-16 h-12 relative flex justify-center items-center shrink-0">
            {scopedPos.length === 0 ? (
              <div className="text-slate-400 text-[9px] font-bold">No Data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={10}
                    outerRadius={20}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[index]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '9px', borderRadius: '8px', padding: '2px 6px' }}
                    itemStyle={{ padding: 0 }}
                    formatter={(value: any, name: any) => [`${value} POs`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Register Search and Mode Controls */}
      <div className="bg-white border border-slate-200 rounded-[18px] p-3 shadow-xs flex flex-wrap lg:flex-nowrap items-center gap-3 justify-between">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input  id="search_by_po_no_broker_na_2911" name="search_by_po_no_broker_na" aria-label="Search by PO No, Broker Name, Supplier Name, Station/Area..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#174C2C]/20 focus:border-[#174C2C] transition-all" 
            placeholder="Search by PO No, Broker Name, Supplier Name, Station/Area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase px-2">From</span>
          <input  id="startdate_2921" name="startdate" aria-label="startdate" type="date" className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span className="text-[10px] font-bold text-slate-500 uppercase px-2">To</span>
          <input  id="enddate_2923" name="enddate" aria-label="enddate" type="date" className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={handleCsvDownload} 
            className="bg-[#174C2C] hover:bg-[#103A20] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Download filtered records as CSV"
          >
            <Download className="h-3.5 w-3.5 text-emerald-200" /> Export CSV
          </button>
          <button
            onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setStatusFilter('all'); }}
            title="Clear search and status filter"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
          <button 
            onClick={fetchPosAndMasters}
            title="Refresh Purchase Orders from database"
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50" disabled={loading}
          >
            <RefreshCcw className={`h-3.5 w-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Top Toolbar Action Belt */}
      <div className="bg-white border border-slate-200 rounded-[18px] p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
         <div className="flex flex-wrap items-center gap-2">
           {isTempPo && (
             <button
               onClick={handleGlobalAdd}
               className="bg-[#174C2C] hover:bg-[#103A20] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
               title="Create empty PTF PO directly"
             >
               <Plus className="w-4 h-4 text-emerald-300" /> New Manual P.O (PTF)
             </button>
           )}

           <button
             onClick={() => {
               if (selectedPoNo) {
                 const match = poList.find(p => p.po_no === selectedPoNo);
                 if (match) handlePrintPo(match);
               } else {
                 alert("Please select a Purchase Order row in the table first.");
               }
             }}
             className="bg-white hover:bg-slate-50 text-slate-700 hover:text-[#174C2C] border border-slate-300 hover:border-[#174C2C] px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
           >
             <Printer className="w-4 h-4 text-slate-600" /> Print Selected
           </button>

           {canEditOrDelete() && (
             <button
               onClick={() => {
                 if (selectedPoNo) {
                   handleDeletePo(selectedPoNo);
                 } else {
                   alert("Please select a Purchase Order in the table first.");
                 }
               }}
               className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 hover:border-rose-400 px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
             >
               <Trash2 className="w-4 h-4 text-rose-600" /> Delete Selected
             </button>
           )}

           <div className="h-6 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

           {/* Status Filter Toggle Options right beside Print/Delete */}
           <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
             <button
               onClick={() => setStatusFilter('all')}
               className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                 statusFilter === 'all'
                   ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-extrabold'
                   : 'text-slate-600 hover:text-slate-900'
               }`}
               title="Show all Purchase Orders"
             >
               All ({totalGeneratedPos})
             </button>
             <button
               onClick={() => setStatusFilter('pending')}
               className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                 statusFilter === 'pending'
                   ? 'bg-rose-50 text-rose-800 border border-rose-200 shadow-xs font-extrabold'
                   : 'text-slate-600 hover:text-rose-700'
               }`}
               title="Show only Active Pending Purchase Orders"
             >
               <span className="w-2 h-2 rounded-full bg-rose-500" />
               Pending ({totalPendingPos})
             </button>
             <button
               onClick={() => setStatusFilter('completed')}
               className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                 statusFilter === 'completed'
                   ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                   : 'text-slate-600 hover:text-emerald-800'
               }`}
               title="Show Completed / Fully Received Purchase Orders"
             >
               <span className={`w-2 h-2 rounded-full ${statusFilter === 'completed' ? 'bg-white' : 'bg-emerald-500'}`} />
               Completed ({totalCompletedPos})
             </button>
             <button
               onClick={() => setStatusFilter('short')}
               className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                 statusFilter === 'short'
                   ? 'bg-amber-600 text-white shadow-xs font-extrabold'
                   : 'text-slate-600 hover:text-amber-800'
               }`}
               title="Show Short Weight Purchase Orders"
             >
               <span className={`w-2 h-2 rounded-full ${statusFilter === 'short' ? 'bg-white' : 'bg-amber-500'}`} />
               Short Wt ({totalShortPos})
             </button>
             <button
               onClick={() => setStatusFilter('excess')}
               className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                 statusFilter === 'excess'
                   ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                   : 'text-slate-600 hover:text-blue-800'
               }`}
               title="Show Excess Weight Purchase Orders"
             >
               <span className={`w-2 h-2 rounded-full ${statusFilter === 'excess' ? 'bg-white' : 'bg-blue-500'}`} />
               Excess Wt ({totalExcessPos})
             </button>
           </div>
         </div>

         <div className="text-xs text-slate-500 font-medium italic">
           Click any row to select. Double-click to open and edit details.
         </div>
      </div>

      {/* PO Grid Table */}
      <div className="bg-white border border-slate-200 rounded-[18px] shadow-xs overflow-x-auto overflow-y-auto min-h-[360px] w-full max-w-full">
         <table className={cn("w-full border-collapse text-xs text-black", isTempPo ? "min-w-[1380px]" : "min-w-[1200px]")}>
            <thead className="bg-slate-100/90 sticky top-0 z-10 font-bold border-b border-slate-200">
               <tr className="h-10 text-slate-700">
                  <th 
                    onClick={() => handleSort('po_no')}
                    className="px-3 text-left border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-200/70 transition-colors group"
                    title="Sort by PO / PTF No"
                  >
                    <div className="flex items-center gap-1">
                      <span>PO / PTF No</span>
                      {renderSortIndicator('po_no')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('date')}
                    className="px-3 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-200/70 transition-colors group"
                    title="Sort by Date"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Date</span>
                      {renderSortIndicator('date')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('type')}
                    className="px-3 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-200/70 transition-colors group"
                    title="Sort by Type"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Type</span>
                      {renderSortIndicator('type')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('broker')}
                    className="px-3 text-left border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-200/70 transition-colors group"
                    title="Sort by Broker"
                  >
                    <div className="flex items-center gap-1">
                      <span>Broker</span>
                      {renderSortIndicator('broker')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('unit')}
                    className="px-3 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-200/70 transition-colors group"
                    title="Sort by Unit / Lorry"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Unit / Lorry</span>
                      {renderSortIndicator('unit')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('total_units')}
                    className="px-3 text-right border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-200/70 transition-colors group"
                    title="Sort by Total Units"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Units</span>
                      {renderSortIndicator('total_units')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('weight')}
                    className="px-3 text-right border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-200/70 transition-colors group"
                    title="Sort by Weight (MT)"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Weight (MT)<br/><span className="text-[8px] font-medium opacity-70 normal-case">Rcvd / Contract</span></span>
                      {renderSortIndicator('weight')}
                    </div>
                  </th>
                   <th 
                    onClick={() => handleSort('status')}
                    className="px-3 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-200/70 transition-colors group min-w-[100px]"
                    title="Sort by Status"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status</span>
                      {renderSortIndicator('status')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('closed_open')}
                    className="px-3 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-200/70 transition-colors group min-w-[130px]"
                    title="Sort by Closed / Open"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Closed / Open</span>
                      {renderSortIndicator('closed_open')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('excess_short')}
                    className="px-3 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-200/70 transition-colors group min-w-[130px]"
                    title="Sort by Excess / Short"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Excess / Short</span>
                      {renderSortIndicator('excess_short')}
                    </div>
                  </th>
                  {isTempPo && (
                    <>
                      <th 
                        onClick={() => handleSort('pass_mismatch')}
                        className="px-3 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-200/70 transition-colors group min-w-[130px]"
                        title="Sort by Pass / Mismatch"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Pass / Mismatch</span>
                          {renderSortIndicator('pass_mismatch')}
                        </div>
                      </th>
                      <th 
                        className="px-3 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider min-w-[150px]"
                        title="Current Process Stage"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Stage</span>
                        </div>
                      </th>
                    </>
                  )}
                  <th className="px-3 text-center whitespace-nowrap text-[10px] font-bold uppercase tracking-wider min-w-[100px]">Actions</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
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
                           const currentUserRole = (userCtx?.userRole || (userCtx as any)?.role || "USER").toUpperCase();
                           const currentUserLevel = (userCtx?.userLevel || (userCtx as any)?.level || "L1").toUpperCase();
                           const isAdminUser = isUserAdmin(userCtx) || currentUserRole === "ADMIN" || currentUserRole === "ADMINISTRATOR" || Boolean((userCtx as any)?.isAdmin) || currentUserLevel === "ADMIN" || currentUserLevel === "L5" || isL5OrAdmin();

                           const contractLorries = item.contract_lorries || item.total_no_of_lorries || 1;
                           const receivedLorries = item.received_lorries || 0;
                           const isClosed = Boolean(item.is_closed || item.status === 'closed' || (contractLorries > 0 && receivedLorries >= contractLorries));

                           if (isClosed && !isAdminUser) {
                             alert(`🔒 Closed Sauda Record: Sauda #${item.po_no} is Closed.\n\nClosed Sauda records can only be opened or edited by an Admin.`);
                             return;
                           }

                           handleLoadSelectedPo(item);
                        }
                     }}
                     className={cn(
                        "h-10 cursor-pointer transition-colors text-xs font-medium",
                        isSelected ? "bg-[#174C2C] text-white" : 
                        isVoid ? "bg-rose-50/40 text-slate-400 line-through decoration-rose-400/50" :
                        (idx % 2 === 0 ? "bg-white hover:bg-amber-50/50" : "bg-slate-50/40 hover:bg-amber-50/50")
                     )}
                  >
                     <td className={cn("px-3 font-mono font-bold select-text whitespace-nowrap border-r border-slate-200/60", isVoid ? "text-rose-400" : (isSelected ? "text-white" : "text-slate-900"))}>{item.po_no}</td>
                     <td className={cn("px-3 text-center font-mono whitespace-nowrap border-r border-slate-200/60", isSelected ? "text-slate-100" : "text-slate-700")}>{item.po_date || item.created_at?.slice(0, 10) || ''}</td>
                     <td className="px-3 text-center whitespace-nowrap border-r border-slate-200/60">
                        <span className={cn("px-2 py-0.5 rounded-md text-[9.5px] font-black tracking-tight", item.ptf_no ? (isSelected ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-800 border border-orange-200") : (isSelected ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-800 border border-emerald-200"))}>
                           {item.ptf_no ? 'PTF ENTRY' : 'SAUDA LINKED'}
                        </span>
                     </td>
                     <td className={cn("px-3 uppercase truncate max-w-[150px] whitespace-nowrap border-r border-slate-200/60", isSelected ? "text-slate-100" : "text-slate-700")}>{item.broker}</td>
                     <td className={cn("px-3 text-center font-bold uppercase whitespace-nowrap border-r border-slate-200/60 text-[10px]", isSelected ? "text-slate-200" : "text-slate-700")}>{item.purchase_unit_name || 'BALES'}</td>
                     <td className={cn("px-3 text-right font-mono font-bold whitespace-nowrap border-r border-slate-200/60", isSelected ? "text-white" : "text-slate-900")}>{item.total_units || 0}</td>
                     <td className="px-3 py-1.5 text-left font-mono border-r border-slate-200/60 min-w-[220px]">
                        {(() => {
                           const contract = parseFloat(item.total_contract_mt || 0) || 0;
                           const rcvd = Number(item.received_weight_mt || 0);
                           const unit = item.purchase_unit_name || item.unit_type || item.unit || 'BALES';
                           const tol = item.weight_tolerance || calculateWeightTolerance(contract, rcvd, unit);
                           const pct = contract > 0 ? Math.min(100, Math.max(0, (rcvd / contract) * 100)) : 0;
                           const barGradient = tol.isCompleted 
                              ? 'from-emerald-500 to-green-400' 
                              : pct > 0 
                              ? 'from-blue-600 to-cyan-400' 
                              : 'from-slate-300 to-slate-400';
                           return (
                              <div>
                                 <div className="flex items-center justify-between gap-1 text-[10px]">
                                    <span className={cn("font-black whitespace-nowrap", isSelected ? "text-emerald-200" : (tol.isCompleted ? "text-emerald-700 font-bold" : "text-emerald-800"))}>
                                       {rcvd.toFixed(3)} MT Rcvd
                                    </span>
                                    <span className={cn("font-sans text-[8.5px]", isSelected ? "text-slate-200" : "text-slate-400")}>of</span>
                                    <span className={cn("font-bold whitespace-nowrap", isSelected ? "text-white" : "text-slate-800")}>
                                       {contract.toFixed(3)} MT
                                    </span>
                                 </div>
                                 <div className="mt-1 space-y-0.5">
                                    <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden p-0.2" title={`${pct.toFixed(1)}% received.`}>
                                       <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-300", barGradient)} style={{ width: `${tol.isCompleted ? 100 : pct}%` }} />
                                    </div>
                                 </div>
                              </div>
                           );
                        })()}
                     </td>
                      {/* Operational Status Column */}
                      <td className="px-3 text-center whitespace-nowrap border-r border-slate-200/60 min-w-[100px]">
                         {(() => {
                            const contractLorries = item.contract_lorries || item.total_no_of_lorries || 1;
                            const receivedLorries = item.received_lorries || 0;
                            const isClosed = Boolean(item.is_closed || item.status === "closed" || (contractLorries > 0 && receivedLorries >= contractLorries));
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
                                  className="text-[9.5px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs inline-flex items-center gap-1 animate-pulse"
                                  title="Has an active Mismatch awaiting approval"
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                  <span>MISMATCH</span>
                                </span>
                              );
                            }

                            if (isClosed) {
                              return (
                                <span className={cn(
                                  "text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs inline-flex items-center gap-1", 
                                  isSelected ? "bg-emerald-500 text-white border-emerald-400" : "text-emerald-700 bg-emerald-50 border-emerald-300"
                                )}>
                                  <Check className="w-2.5 h-2.5" />
                                  <span>COMPLETED</span>
                                </span>
                              );
                            }

                            return (
                              <span className={cn(
                                "text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs inline-flex items-center gap-1", 
                                selectPoRowStyle(isSelected)
                              )}>
                                <span>PENDING</span>
                              </span>
                            );
                         })()}
                      </td>

                      {/* CLOSED / OPEN Column (Lorry-wise) */}
                      <td className="px-3 text-center whitespace-nowrap border-r border-slate-200/60 min-w-[130px]">
                         {(() => {
                            const userCtx = getCurrentUserContext();
                            const userRole = String(userCtx?.userRole || "").toUpperCase();
                            const userLevel = String(userCtx?.userLevel || "").toUpperCase();
                            const isAdminOrL4 = isUserAdmin(userCtx) || userRole === "ADMIN" || userRole === "ADMINISTRATOR" || isL5OrAdmin() || userLevel === "L4" || userLevel === "L5" || userLevel === "MAX";

                            const contract = parseFloat(item.total_contract_mt || 0) || 0;
                            const rcvd = Number(item.received_weight_mt || 0);
                            const contractLorries = item.contract_lorries || item.total_no_of_lorries || 1;
                            const receivedLorries = item.received_lorries || 0;
                            const isClosed = Boolean(item.is_closed || item.status === "closed" || (contractLorries > 0 && receivedLorries >= contractLorries));

                            const allowedTolMt = Math.min(contract * 0.03, 1.500);
                            const shortageOrExcessMt = Math.abs(contract - rcvd);
                            const canShowReopen = isAdminOrL4 && isClosed && shortageOrExcessMt > allowedTolMt;

                            let openRemarksData = item.open_remarks;
                            if (typeof openRemarksData === 'string') {
                              try { openRemarksData = JSON.parse(openRemarksData); } catch (e) {}
                            }

                            if (isClosed) {
                              return (
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <span 
                                    onClick={(e) => { e.stopPropagation(); setClosedNoticePo(item); }}
                                    className="text-[9.5px] font-black px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700 shadow-2xs flex items-center gap-1 whitespace-nowrap cursor-pointer hover:bg-slate-700 transition-colors"
                                    title={`Sauda is CLOSED: ${receivedLorries} of ${contractLorries} Lorries Received (${rcvd.toFixed(3)} MT of ${contract.toFixed(3)} MT).`}
                                  >
                                    <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                    <span>CLOSED ({receivedLorries}/{contractLorries} Lorry)</span>
                                  </span>

                                  {canShowReopen ? (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); openReopenAuthModal(item); }}
                                      className="text-[8.5px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                                      title="Discrepancy exceeds tolerance policy. Click to Reopen this Closed Sauda (Admin / Super User Password Required)"
                                    >
                                      <Unlock className="w-2.5 h-2.5 text-emerald-600" />
                                      <span>Reopen</span>
                                    </button>
                                  ) : (
                                    <span className="text-[7.5px] font-semibold text-slate-400 italic" title="Within tolerance policy – Reopen option disabled">
                                      Within Tolerance
                                    </span>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span 
                                  className={cn(
                                    "text-[9.5px] font-black px-2.5 py-0.5 rounded-full border shadow-2xs flex items-center gap-1 whitespace-nowrap",
                                    isSelected 
                                      ? "bg-emerald-500 text-white border-emerald-400" 
                                      : "bg-emerald-50 text-emerald-800 border-emerald-300"
                                  )}
                                  title={`Sauda is OPEN: ${receivedLorries} of ${contractLorries} Lorries Received.`}
                                >
                                  <Unlock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                  <span>OPEN ({receivedLorries}/{contractLorries} Lorry)</span>
                                </span>

                                {openRemarksData && (
                                  <div
                                    onClick={(e) => { e.stopPropagation(); setAuditViewPo(item); }}
                                    className="flex items-center gap-1 text-[8px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors max-w-[150px] shadow-2xs"
                                    title={`Reopened by: ${openRemarksData.opened_by}\nRemarks: "${openRemarksData.remarks}"\nClick to view audit log.`}
                                  >
                                    <UserCheck className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                    <span className="truncate">By {openRemarksData.opened_by}</span>
                                  </div>
                                )}

                                {isAdminOrL4 && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleCloseSauda(item); }}
                                    className="text-[8px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded border border-slate-200 transition-colors flex items-center gap-0.5 cursor-pointer shadow-2xs"
                                    title="Manually Close this Sauda before all lorries arrive"
                                  >
                                    <Lock className="w-2 h-2 text-slate-500" />
                                    <span>Force Close</span>
                                  </button>
                                )}
                              </div>
                            );
                         })()}
                      </td>

                      {/* EXCESS / SHORT WEIGHT Column */}
                      <td className="px-3 text-center whitespace-nowrap border-r border-slate-200/60 min-w-[130px]">
                         {(() => {
                            const contract = parseFloat(item.total_contract_mt || 0) || 0;
                            const rcvd = Number(item.received_weight_mt || 0);
                            const unit = item.purchase_unit_name || item.unit_type || item.unit || 'BALES';
                            const tol = item.weight_tolerance || calculateWeightTolerance(contract, rcvd, unit);

                            if (rcvd <= 0) {
                              return <span className="text-[10px] text-slate-400 font-medium italic">-</span>;
                            }

                            const diffMt = typeof tol?.diffMt === 'number' && !isNaN(tol.diffMt)
                              ? tol.diffMt
                              : (typeof tol?.differenceMt === 'number' && !isNaN(tol.differenceMt)
                                ? tol.differenceMt
                                : (rcvd - contract));
                            const absDiff = Math.abs(diffMt);

                            if (absDiff < 0.0005) {
                              return (
                                <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Exact (0.00 MT)
                                </span>
                              );
                            }

                            if (diffMt > 0) {
                              return (
                                <span className={cn(
                                  "text-[9.5px] font-black px-2 py-0.5 rounded border shadow-2xs inline-flex items-center gap-1",
                                  tol.isCompleted
                                    ? "bg-blue-50 text-blue-800 border-blue-200"
                                    : "bg-blue-100 text-blue-900 border-blue-300"
                                )}>
                                  <span>+{absDiff.toFixed(3)} MT Excess</span>
                                </span>
                              );
                            }

                            return (
                              <span className={cn(
                                "text-[9.5px] font-black px-2 py-0.5 rounded border shadow-2xs inline-flex items-center gap-1",
                                tol.isCompleted
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-amber-100 text-amber-900 border-amber-300"
                              )}>
                                <span>-{absDiff.toFixed(3)} MT Short</span>
                              </span>
                            );
                         })()}
                      </td>

                      {isTempPo && (
                        <>
                          {/* PASS / MISMATCH STATUS */}
                          <td className="px-3 text-center whitespace-nowrap border-r border-slate-200/60 min-w-[130px]">
                            {(() => {
                              const isResolved = isPoMismatchResolved(item);
                              const stage = item.workflow_stage || (item.pass_status === "pass" ? "final_po" : item.pass_status) || "temp_arrival_pending";

                              const isMismatch = !isResolved && (
                                stage === "mismatch" || 
                                (item.mismatch_fields && item.mismatch_fields.length > 0) || 
                                Boolean(item.has_mismatch)
                              );

                              if (isMismatch) {
                                return (
                                  <span className="text-[9.5px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs inline-flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                    <span>Mismatch Case</span>
                                  </span>
                                );
                              }

                              return (
                                <span className="text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs inline-flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>Clean Pass</span>
                                </span>
                              );
                            })()}
                          </td>

                          {/* PROCESS STAGE & PASS ACTION */}
                          <td className="px-3 text-center whitespace-nowrap border-r border-slate-200/60 min-w-[150px]">
                            {(() => {
                              const isAdvDone = checkIsAdvancePaymentDone(item, allPayments);
                              const isSettlementDone = checkIsSettlementDone(item, allSettlements);

                              if (!isAdvDone) {
                                return (
                                  <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>ADVANCE PENDING</span>
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
                                    title="Advance Payment completed. Account Settlement is pending — Click to open Excess / Short Settlement."
                                    className="text-[9px] font-black px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-300 uppercase cursor-pointer inline-flex items-center gap-1 whitespace-nowrap transition-colors shadow-2xs"
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
                                  title="Advance Payment & Settlement Completed! Click to Move this P.O to Final P.O"
                                  className="text-[9px] font-black px-2.5 py-1 rounded bg-[#174C2C] hover:bg-[#103A20] text-white uppercase shadow-xs cursor-pointer inline-flex items-center gap-1 transition-all active:scale-95 whitespace-nowrap"
                                >
                                  <Check className="w-3 h-3 text-white stroke-[3]" />
                                  <span>PASS → FINAL P.O</span>
                                </button>
                              );
                            })()}
                          </td>
                        </>
                      )}
                     <td className="px-3 text-center min-w-[100px] whitespace-nowrap">
                        {isVoid ? (
                           <div className="flex items-center justify-center gap-2">
                             <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] uppercase border border-rose-200">VOID</span>
                             <button
                               onClick={(e) => { e.stopPropagation(); handleDeletePo(item.po_no); }}
                               className="p-1 text-rose-600 hover:text-rose-800 rounded transition-colors cursor-pointer"
                               title="Delete Permanently"
                             >
                               <Trash2 className="w-3.5 h-3.5" />
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
                             className={cn(
                               "px-3 py-1 rounded-lg border font-bold text-[10px] uppercase flex items-center gap-1 shadow-xs transition-colors cursor-pointer",
                               isSelected ? "bg-white/20 text-white border-white/30 hover:bg-white/30" : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
                             )}
                             title="Actions"
                           >
                             Actions <ChevronDown className="w-3 h-3" />
                           </button>
                        </div>
                        )}
                     </td>
                  </tr>
               )})}
               {filteredPos.length === 0 && (
                  <tr>
                     <td colSpan={isTempPo ? 13 : 11} className="py-12 text-center text-slate-400 uppercase font-black italic">
                       No Saved Purchase Orders found matching criteria.
                     </td>
                  </tr>
               )}
            </tbody>
         </table>
      </div>

      {/* Pagination / Total bar */}
      <div className="bg-white border border-slate-200 rounded-[18px] p-3 shadow-xs flex flex-wrap justify-between items-center gap-3">
         <div className="flex flex-wrap gap-3 items-center">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2">
               <span className="text-[10px] font-bold text-slate-500 uppercase">Cumulative Weight:</span>
               <span className="text-xs font-black text-slate-900 font-mono">
                 {filteredPos.reduce((acc, s) => acc + parseFloat(s.total_contract_mt || 0), 0).toFixed(3)} MT
               </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2">
               <span className="text-[10px] font-bold text-slate-500 uppercase">Closed P.O.s:</span>
               <span className="text-xs font-black text-emerald-700 font-mono">
                 {filteredPos.filter(p => p.pending === false || p.pending === 'No').length} Closed
               </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2">
               <span className="text-[10px] font-bold text-slate-500 uppercase">Total Records:</span>
               <span className="text-xs font-black text-slate-900 font-mono">
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

      {/* Floating Quick Add Button - Only for Sauda Check Point */}
      {isTempPo && (
        <button
          onClick={handleGlobalAdd}
          className="fixed bottom-12 right-8 z-30 bg-[#174C2C] hover:bg-[#103A20] text-white p-4 rounded-2xl shadow-xl flex items-center gap-2.5 font-bold text-xs transition-all hover:scale-105 active:scale-95 cursor-pointer border border-[#0d301b] group"
          title="Create New Manual P.O"
        >
          <Plus className="w-5 h-5 text-emerald-300 group-hover:rotate-90 transition-transform duration-300" />
          <span>New P.O</span>
        </button>
      )}
    </div>
  );
};

const selectPoRowStyle = (isSelected: boolean) => {
  return isSelected ? "bg-rose-500 text-white border-rose-400" : "text-rose-700 bg-rose-50 border-rose-200";
};
