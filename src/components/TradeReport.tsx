import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Download, 
  Printer, 
  Filter, 
  ArrowUpDown, 
  TrendingUp, 
  Scale, 
  Layers, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileSpreadsheet,
  Building,
  RefreshCw,
  Eye,
  X
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { cn } from '../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface TradeReportProps {
  saudaData: any[];
  saudaDetails?: any[];
  amadData?: any[];
  onRefresh?: () => void;
}

export const TradeReport: React.FC<TradeReportProps> = ({
  saudaData = [],
  saudaDetails = [],
  amadData = [],
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'PENDING'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<any | null>(null);
  const [activeView, setActiveView] = useState<'ledger' | 'charts'>('ledger');

  // Process and normalize trade rows
  const trades = useMemo(() => {
    return saudaData.map((s: any) => {
      const saudaNo = s.sauda_no || s.satta_no || s.id || 'N/A';
      const party = s.party_name || s.trader_name || s.supplier || s.party || 'DIRECT TRADER';
      const broker = s.broker || s.dalal || s.broker_name || '-';
      const grade = s.grade || s.item_name || s.variety || 'Standard';
      
      // Calculate contracted weight
      let contractWt = Number(s.contracted_mt) || Number(s.weight_mt) || Number(s.total_contract_mt) || 0;
      if (contractWt === 0) {
        const units = Number(s.units) || Number(s.total_units) || 0;
        const perUnit = Number(s.weight_per_unit) || 50;
        contractWt = (units * perUnit) / 1000;
      }

      // Calculate executed weight from linked arrivals or details if present
      let executedWt = Number(s.dispatched_mt) || Number(s.executed_mt) || Number(s.lifted_mt) || 0;
      if (executedWt === 0 && amadData.length > 0) {
        const linkedAmad = amadData.filter(
          (a) => String(a.sauda_no || a.satta_no).trim() === String(saudaNo).trim()
        );
        executedWt = linkedAmad.reduce((sum, a) => sum + (Number(a.weight_mt) || Number(a.actual_weight) || 0), 0);
      }

      const balanceWt = Math.max(0, contractWt - executedWt);
      const fulfillmentPct = contractWt > 0 ? Math.min(100, Math.round((executedWt / contractWt) * 100)) : 0;
      
      const rate = Number(s.rate) || Number(s.b_rate) || Number(s.base_rate) || 0;
      const totalAmount = contractWt * (rate > 1000 ? rate : rate * 10); // Normalizing per MT vs per Qtl

      const dateStr = s.date || s.sauda_date || s.created_at || '';
      let formattedDate = '-';
      let timestamp = 0;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString('en-GB');
          timestamp = d.getTime();
        }
      }

      let tradeStatus: 'ACTIVE' | 'COMPLETED' | 'PENDING' = 'ACTIVE';
      if (fulfillmentPct >= 100 || s.status === 'COMPLETED' || s.status === 'closed') {
        tradeStatus = 'COMPLETED';
      } else if (fulfillmentPct === 0) {
        tradeStatus = 'PENDING';
      } else {
        tradeStatus = 'ACTIVE';
      }

      return {
        id: s.id || saudaNo,
        saudaNo,
        party,
        broker,
        grade,
        contractWt,
        executedWt,
        balanceWt,
        fulfillmentPct,
        rate,
        totalAmount,
        date: formattedDate,
        rawDate: dateStr,
        timestamp,
        status: tradeStatus,
        remarks: s.remarks || s.narration || '',
        raw: s
      };
    });
  }, [saudaData, amadData]);

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchParty = t.party.toLowerCase().includes(q);
        const matchBroker = t.broker.toLowerCase().includes(q);
        const matchNo = String(t.saudaNo).toLowerCase().includes(q);
        const matchGrade = t.grade.toLowerCase().includes(q);
        if (!matchParty && !matchBroker && !matchNo && !matchGrade) return false;
      }

      if (statusFilter !== 'ALL' && t.status !== statusFilter) {
        return false;
      }

      if (dateFrom && t.rawDate) {
        const dFrom = new Date(dateFrom).getTime();
        if (t.timestamp < dFrom) return false;
      }

      if (dateTo && t.rawDate) {
        const dTo = new Date(dateTo).getTime() + 86400000;
        if (t.timestamp > dTo) return false;
      }

      return true;
    });
  }, [trades, searchTerm, statusFilter, dateFrom, dateTo]);

  // KPI calculations
  const stats = useMemo(() => {
    const count = filteredTrades.length;
    const totalContractWt = filteredTrades.reduce((sum, t) => sum + t.contractWt, 0);
    const totalExecutedWt = filteredTrades.reduce((sum, t) => sum + t.executedWt, 0);
    const totalBalanceWt = filteredTrades.reduce((sum, t) => sum + t.balanceWt, 0);
    const totalValuation = filteredTrades.reduce((sum, t) => sum + t.totalAmount, 0);
    const avgRate = count > 0 ? filteredTrades.reduce((sum, t) => sum + t.rate, 0) / count : 0;
    const completedCount = filteredTrades.filter((t) => t.status === 'COMPLETED').length;
    const activeCount = filteredTrades.filter((t) => t.status === 'ACTIVE').length;
    const pendingCount = filteredTrades.filter((t) => t.status === 'PENDING').length;

    return {
      count,
      totalContractWt,
      totalExecutedWt,
      totalBalanceWt,
      totalValuation,
      avgRate,
      completedCount,
      activeCount,
      pendingCount
    };
  }, [filteredTrades]);

  // Top 5 Traders by Contract Volume
  const topTradersData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTrades.forEach((t) => {
      map[t.party] = (map[t.party] || 0) + t.contractWt;
    });
    return Object.entries(map)
      .map(([name, weight]) => ({ name: name.length > 15 ? name.substring(0, 15) + '...' : name, weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);
  }, [filteredTrades]);

  // Status breakdown for Pie Chart
  const statusChartData = useMemo(() => [
    { name: 'Completed', value: stats.completedCount, color: '#16a34a' },
    { name: 'Active', value: stats.activeCount, color: '#2563eb' },
    { name: 'Pending', value: stats.pendingCount, color: '#f59e0b' },
  ].filter(d => d.value > 0), [stats]);

  // Export CSV
  const handleExportCsv = () => {
    if (filteredTrades.length === 0) return;
    const headers = [
      'Trade / Sauda No',
      'Date',
      'Trader / Party',
      'Broker',
      'Item / Grade',
      'Contracted (MT)',
      'Executed (MT)',
      'Balance (MT)',
      'Fulfillment %',
      'Rate',
      'Valuation (INR)',
      'Status'
    ];

    const formatCell = (val: any) => {
      if (val === null || val === undefined) return '""';
      let s = String(val).replace(/"/g, '""');
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return `"${s}"`;
    };

    const rows = filteredTrades.map((t) => [
      formatCell(t.saudaNo),
      formatCell(t.date),
      formatCell(t.party),
      formatCell(t.broker),
      formatCell(t.grade),
      formatCell(t.contractWt.toFixed(2)),
      formatCell(t.executedWt.toFixed(2)),
      formatCell(t.balanceWt.toFixed(2)),
      formatCell(`${t.fulfillmentPct}%`),
      formatCell(t.rate.toFixed(2)),
      formatCell(t.totalAmount.toFixed(2)),
      formatCell(t.status)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Trade_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF
  const handlePrintPdf = () => {
    if (filteredTrades.length === 0) return;
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 297, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("COMMERCIAL TRADE & SAUDA EXECUTION LEDGER", 14, 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} | Total Records: ${filteredTrades.length}`, 200, 15);

    autoTable(doc, {
      startY: 30,
      head: [['Sauda #', 'Date', 'Trader / Party', 'Broker', 'Grade', 'Contract (MT)', 'Executed (MT)', 'Bal (MT)', 'Status', 'Rate (₹)', 'Amount (₹)']],
      body: filteredTrades.map(t => [
        t.saudaNo,
        t.date,
        t.party,
        t.broker,
        t.grade,
        t.contractWt.toFixed(2),
        t.executedWt.toFixed(2),
        t.balanceWt.toFixed(2),
        t.status,
        t.rate.toLocaleString('en-IN'),
        t.totalAmount.toLocaleString('en-IN')
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Trade_Ledger_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-4" id="trade-report-module-container">
      {/* Module Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Scale className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              Commercial Trade & Sauda Analysis
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {stats.count} Trades
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Real-time trade fulfillment, commercial deals ledger, party balance analytics, and rate tracking.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveView('ledger')}
              className={cn(
                "px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer",
                activeView === 'ledger' ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Ledger Table
            </button>
            <button
              onClick={() => setActiveView('charts')}
              className={cn(
                "px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer",
                activeView === 'charts' ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Visual Analytics
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            disabled={filteredTrades.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrintPdf}
            disabled={filteredTrades.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>PDF Print</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Deals</span>
          <div className="text-lg font-black text-slate-800 mt-1">{stats.count}</div>
          <div className="text-[9.5px] font-semibold text-emerald-600 mt-0.5">{stats.completedCount} Completed</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Contracted Mass</span>
          <div className="text-lg font-black text-slate-800 mt-1">{stats.totalContractWt.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal text-slate-500">MT</span></div>
          <div className="text-[9.5px] font-semibold text-slate-500 mt-0.5">Commercial Commitments</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Delivered / Lifted</span>
          <div className="text-lg font-black text-emerald-700 mt-1">{stats.totalExecutedWt.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal text-emerald-600">MT</span></div>
          <div className="text-[9.5px] font-semibold text-emerald-600 mt-0.5">
            {stats.totalContractWt > 0 ? `${Math.round((stats.totalExecutedWt / stats.totalContractWt) * 100)}% Fulfilled` : '0%'}
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pending Execution</span>
          <div className="text-lg font-black text-amber-700 mt-1">{stats.totalBalanceWt.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal text-amber-600">MT</span></div>
          <div className="text-[9.5px] font-semibold text-amber-600 mt-0.5">Unlifted Balance</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Average Rate</span>
          <div className="text-lg font-black text-indigo-700 mt-1">₹{Math.round(stats.avgRate).toLocaleString('en-IN')}</div>
          <div className="text-[9.5px] font-semibold text-indigo-600 mt-0.5">Per Standard Unit</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Valuation</span>
          <div className="text-lg font-black text-purple-800 mt-1 truncate" title={`₹${stats.totalValuation.toLocaleString('en-IN')}`}>
            ₹{(stats.totalValuation / 100000).toFixed(1)}L
          </div>
          <div className="text-[9.5px] font-semibold text-purple-600 mt-0.5">Gross Contract Value</div>
        </div>
      </div>

      {/* Filter and Search Ribbon */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Sauda #, Trader / Vyapari, Broker, Grade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all outline-hidden"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            {(['ALL', 'ACTIVE', 'COMPLETED', 'PENDING'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer",
                  statusFilter === st
                    ? "bg-white text-slate-800 shadow-2xs font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-hidden"
              title="From Date"
            />
            <span>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-hidden"
              title="To Date"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Visual Analytics View */}
      {activeView === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
              <Building className="h-4 w-4 text-blue-600" />
              Top Trading Parties by Contract Volume (MT)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTradersData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                  <RechartsTooltip />
                  <Bar dataKey="weight" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={16}>
                    {topTradersData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][index % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-600" />
              Trade Execution Status Distribution
            </h3>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.name} (${entry.value})`}
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Main Ledger Table View */}
      {activeView === 'ledger' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-[580px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 text-[10.5px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Trade Ref #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Trader / Vyapari</th>
                  <th className="py-2.5 px-3">Broker</th>
                  <th className="py-2.5 px-3">Grade / Item</th>
                  <th className="py-2.5 px-3 text-right">Contract (MT)</th>
                  <th className="py-2.5 px-3 text-right">Lifted (MT)</th>
                  <th className="py-2.5 px-3 text-right">Balance (MT)</th>
                  <th className="py-2.5 px-3 text-center">Fulfillment</th>
                  <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                  <th className="py-2.5 px-3 text-right">Valuation</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrades.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400">
                      <Scale className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="font-semibold">No trade transactions match the selected criteria.</p>
                      <p className="text-[11px] text-slate-400 mt-1">Try adjusting your search terms or filters.</p>
                    </td>
                  </tr>
                ) : (
                  filteredTrades.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setSelectedTrade(t)}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {t.saudaNo}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{t.date}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 max-w-[180px] truncate" title={t.party}>
                        {t.party}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[130px] truncate" title={t.broker}>
                        {t.broker}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono text-[11px]">{t.grade}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                        {t.contractWt.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {t.executedWt.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                        {t.balanceWt.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="w-20 mx-auto bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div
                            className={cn(
                              "h-full transition-all duration-300",
                              t.fulfillmentPct >= 100 ? "bg-emerald-600" : t.fulfillmentPct > 50 ? "bg-blue-600" : "bg-amber-500"
                            )}
                            style={{ width: `${t.fulfillmentPct}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-extrabold text-slate-500 mt-0.5 block">{t.fulfillmentPct}%</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                        ₹{t.rate.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                        ₹{Math.round(t.totalAmount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={cn(
                            "inline-block px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase tracking-tight",
                            t.status === 'COMPLETED'
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : t.status === 'ACTIVE'
                              ? "bg-blue-50 text-blue-800 border border-blue-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          )}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedTrade(t)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View Trade Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade Detail Modal */}
      {selectedTrade && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                  <Scale className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                    Trade Deal: {selectedTrade.saudaNo}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">Date: {selectedTrade.date}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTrade(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Trader / Party</span>
                <p className="font-bold text-slate-800 mt-0.5">{selectedTrade.party}</p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Broker</span>
                <p className="font-bold text-slate-800 mt-0.5">{selectedTrade.broker}</p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Commodity / Grade</span>
                <p className="font-bold text-slate-800 mt-0.5">{selectedTrade.grade}</p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Agreed Rate</span>
                <p className="font-bold text-slate-800 mt-0.5 font-mono">₹{selectedTrade.rate.toLocaleString('en-IN')}</p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Contract Quantity</span>
                <p className="font-bold text-slate-800 mt-0.5">{selectedTrade.contractWt.toFixed(2)} MT</p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Fulfilled Quantity</span>
                <p className="font-bold text-emerald-700 mt-0.5">{selectedTrade.executedWt.toFixed(2)} MT ({selectedTrade.fulfillmentPct}%)</p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Remaining Balance</span>
                <p className="font-bold text-amber-700 mt-0.5">{selectedTrade.balanceWt.toFixed(2)} MT</p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Estimated Total Value</span>
                <p className="font-bold text-purple-800 mt-0.5 font-mono">₹{Math.round(selectedTrade.totalAmount).toLocaleString('en-IN')}</p>
              </div>
            </div>

            {selectedTrade.remarks && (
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">Trade Remarks / Terms</span>
                <p className="text-slate-700 mt-0.5">{selectedTrade.remarks}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTrade(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeReport;
