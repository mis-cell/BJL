import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Package,
  Truck,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Printer,
  FileText,
  ChevronRight,
  ArrowUpDown,
  Building2,
  Calendar,
  XCircle,
  TrendingUp,
  BarChart3,
  Award,
  Scissors,
  Users,
  PieChart
} from 'lucide-react';
import { SystemReportDataset, ReportTransactionLine, normalizeToISODate, getTodayISODate } from '../../services/systemReportEngine';
import { SimpleDealSlipModal } from './SimpleDealSlipModal';
import { formatIndianCurrency } from '../../lib/utils';

interface SimpleReportViewProps {
  dataset: SystemReportDataset;
  onOpenManagementView?: () => void;
}

type TabDimension = 
  | 'OVERVIEW'
  | 'BROKER'
  | 'AGENCY'
  | 'AREA'
  | 'GRADE'
  | 'SUPPLIER'
  | 'MONTH'
  | 'DEDUCTION'
  | 'CHECKPOINTS'
  | 'ALL_DEALS';

export const SimpleReportView: React.FC<SimpleReportViewProps> = ({
  dataset,
  onOpenManagementView
}) => {
  const { transactions, metrics } = dataset;

  // Active Tab Dimension
  const [activeTab, setActiveTab] = useState<TabDimension>('OVERVIEW');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'PENDING_DELIVERY' | 'PAYMENT_DUE' | 'COMPLETED' | 'ALERTS'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'TODAY'>('ALL');
  
  // Selected Slip Modal
  const [selectedTxn, setSelectedTxn] = useState<ReportTransactionLine | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<'date' | 'quantityMT' | 'grossPurchaseValue'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Filtered & Sorted Transactions
  const filteredList = useMemo(() => {
    let list = [...transactions];

    // Quick tab filters
    if (quickFilter === 'PENDING_DELIVERY') {
      list = list.filter(t => t.pendingWeightMT > 0.01);
    } else if (quickFilter === 'PAYMENT_DUE') {
      list = list.filter(t => t.pendingPayable > 100);
    } else if (quickFilter === 'COMPLETED') {
      list = list.filter(t => t.pendingWeightMT <= 0.01 && t.paymentStatus === 'PAID');
    } else if (quickFilter === 'ALERTS') {
      list = list.filter(t => t.isAbnormal || t.deductionAmount > 0 || t.grossProfit < 0);
    }

    // Date filter
    const todayStr = getTodayISODate();
    const curYearMonth = todayStr.substring(0, 7);
    if (dateFilter === 'TODAY') {
      list = list.filter(t => t.date && (t.date === todayStr || normalizeToISODate(t.date) === todayStr));
    } else if (dateFilter === 'THIS_MONTH') {
      list = list.filter(t => t.date && (t.date.startsWith(curYearMonth) || normalizeToISODate(t.date).startsWith(curYearMonth)));
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t =>
        t.saudaNo.toLowerCase().includes(q) ||
        t.poNo.toLowerCase().includes(q) ||
        t.supplier.toLowerCase().includes(q) ||
        t.broker.toLowerCase().includes(q) ||
        t.area.toLowerCase().includes(q) ||
        t.grade.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (sortField === 'date') {
        valA = new Date(valA || '1970-01-01').getTime();
        valB = new Date(valB || '1970-01-01').getTime();
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [transactions, quickFilter, dateFilter, searchQuery, sortField, sortAsc]);

  // Active Sub-Analysis View for Dimensional Tabs
  const [subAnalysisMode, setSubAnalysisMode] = useState<'VOLUME' | 'DEDUCTION' | 'CHECKPOINTS' | 'PREMIUM' | 'RANKING' | 'ABNORMAL' | 'PROFITABILITY'>('VOLUME');

  // Aggregation Helper Function for multi-dimensional analysis
  const aggregateByDimension = (keyGetter: (t: ReportTransactionLine) => string) => {
    const map = new Map<string, {
      key: string;
      dealCount: number;
      quantityMT: number;
      arrivedMT: number;
      pendingMT: number;
      grossValue: number;
      deductionAmount: number;
      premiumAmount: number;
      grossProfit: number;
      paidAmount: number;
      pendingPayable: number;
      avgRate: number;
      profitableDeals: number;
      lossDeals: number;
      abnormalDeals: number;
      moistureSum: number;
      moistureCount: number;
      saudaCheckpointCount: number;
      tempArrivalCount: number;
      finalArrivalCount: number;
      millInspectionCount: number;
      paymentOperationCount: number;
      settlementCount: number;
    }>();

    filteredList.forEach(t => {
      const rawKey = keyGetter(t) || 'Unassigned';
      const key = rawKey.trim() || 'Unassigned';
      const existing = map.get(key) || {
        key,
        dealCount: 0,
        quantityMT: 0,
        arrivedMT: 0,
        pendingMT: 0,
        grossValue: 0,
        deductionAmount: 0,
        premiumAmount: 0,
        grossProfit: 0,
        paidAmount: 0,
        pendingPayable: 0,
        avgRate: 0,
        profitableDeals: 0,
        lossDeals: 0,
        abnormalDeals: 0,
        moistureSum: 0,
        moistureCount: 0,
        saudaCheckpointCount: 0,
        tempArrivalCount: 0,
        finalArrivalCount: 0,
        millInspectionCount: 0,
        paymentOperationCount: 0,
        settlementCount: 0
      };

      existing.dealCount += 1;
      existing.quantityMT += t.quantityMT;
      existing.arrivedMT += t.arrivedWeightMT;
      existing.pendingMT += t.pendingWeightMT;
      existing.grossValue += t.grossPurchaseValue;
      existing.deductionAmount += t.deductionAmount;
      existing.premiumAmount += t.premiumAmount;
      existing.grossProfit += t.grossProfit;
      existing.paidAmount += t.paidAmount;
      existing.pendingPayable += t.pendingPayable;

      if (t.grossProfit >= 0 && t.profitStatus !== 'LOSS') {
        existing.profitableDeals += 1;
      } else {
        existing.lossDeals += 1;
      }

      if (t.isAbnormal || t.moisturePct > 14 || t.deductionAmount > 0 || t.grossProfit < 0) {
        existing.abnormalDeals += 1;
      }

      if (t.moisturePct > 0) {
        existing.moistureSum += t.moisturePct * t.quantityMT;
        existing.moistureCount += t.quantityMT;
      }

      existing.saudaCheckpointCount += 1;
      if (t.arrivedWeightMT > 0) existing.tempArrivalCount += 1;
      if (t.pendingWeightMT <= 0.01) existing.finalArrivalCount += 1;
      if (t.moisturePct > 0 || t.deductionAmount > 0) existing.millInspectionCount += 1;
      if (t.paidAmount > 0) existing.paymentOperationCount += 1;
      if (t.paymentStatus === 'PAID') existing.settlementCount += 1;

      map.set(key, existing);
    });

    const list = Array.from(map.values()).map(item => {
      const avgRate = item.quantityMT > 0 ? (item.grossValue / (item.quantityMT * 10)) : 0;
      const avgMoisture = item.moistureCount > 0 ? (item.moistureSum / item.moistureCount) : 0;
      
      let tier: 'BEST' | 'MEDIUM' | 'LOWER' = 'MEDIUM';
      if (item.grossProfit >= 0 && item.abnormalDeals === 0 && item.quantityMT >= 10) {
        tier = 'BEST';
      } else if (item.grossProfit < 0 || item.abnormalDeals > 1 || item.quantityMT < 5) {
        tier = 'LOWER';
      }

      return {
        ...item,
        avgRate,
        avgMoisture,
        tier
      };
    });

    return list.sort((a, b) => b.grossValue - a.grossValue);
  };

  const brokerData = useMemo(() => aggregateByDimension(t => t.broker), [filteredList]);
  const agencyData = useMemo(() => aggregateByDimension(t => t.agency), [filteredList]);
  const areaData = useMemo(() => aggregateByDimension(t => t.area), [filteredList]);
  const gradeData = useMemo(() => aggregateByDimension(t => t.grade), [filteredList]);
  const supplierData = useMemo(() => aggregateByDimension(t => t.supplier), [filteredList]);
  const monthData = useMemo(() => aggregateByDimension(t => t.month || (t.date ? t.date.substring(0, 7) : 'Unknown')), [filteredList]);

  // Counts for quick tabs
  const tabCounts = useMemo(() => {
    return {
      all: transactions.length,
      pendingDelivery: transactions.filter(t => t.pendingWeightMT > 0.01).length,
      paymentDue: transactions.filter(t => t.pendingPayable > 100).length,
      completed: transactions.filter(t => t.pendingWeightMT <= 0.01 && t.paymentStatus === 'PAID').length,
      alerts: transactions.filter(t => t.isAbnormal || t.deductionAmount > 0 || t.grossProfit < 0).length
    };
  }, [transactions]);

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredList.length) return;
    const headers = [
      'Date', 'Sauda No', 'PO No', 'Supplier/Party', 'Broker',
      'Area', 'Grade', 'Weight MT', 'Rate Rs/Qtl', 'Total Rs',
      'Arrived MT', 'Pending MT', 'Paid Rs', 'Balance Rs', 'Status'
    ];
    const rows = filteredList.map(t => [
      t.date, t.saudaNo, t.poNo, `"${t.supplier}"`, `"${t.broker}"`,
      `"${t.area}"`, t.grade, t.quantityMT, t.purchaseRate, t.grossPurchaseValue,
      t.arrivedWeightMT, t.pendingWeightMT, t.paidAmount, t.pendingPayable, t.saudaStatus
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `sauda_procurement_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deliveryProgress = metrics.totalQuantityMT > 0
    ? Math.min(100, (metrics.arrivedMT / metrics.totalQuantityMT) * 100)
    : 0;

  return (
    <div className="space-y-5 font-sans text-slate-800">

      {/* ================= 4 BIG SIMPLE METRIC CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Card 1: Total Saudas */}
        <div 
          onClick={() => { setActiveTab('OVERVIEW'); setQuickFilter('ALL'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow ${
            activeTab === 'OVERVIEW' && quickFilter === 'ALL'
              ? 'bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
              Total Deals
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              📦
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-950 font-mono">
            {metrics.totalSaudaCount || metrics.totalPOCount || transactions.length}
            <span className="text-xs font-bold text-slate-500 ml-1.5 font-sans">Deals</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>Total Weight:</span>
            <strong className="font-mono text-emerald-900 font-bold">
              {metrics.totalQuantityMT.toFixed(2)} MT
            </strong>
          </div>
        </div>

        {/* Card 2: Total Purchase Value */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
              Total Purchase Value
            </span>
            <div className="w-9 h-9 rounded-xl bg-yellow-100 text-yellow-800 flex items-center justify-center font-bold">
              💰
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono truncate">
            ₹{metrics.totalPurchaseValue >= 10000000 
              ? `${(metrics.totalPurchaseValue / 10000000).toFixed(2)} Cr` 
              : `${(metrics.totalPurchaseValue / 100000).toFixed(2)} Lakh`}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>Average Rate:</span>
            <strong className="font-mono text-slate-900 font-bold">
              ₹{Math.round(metrics.weightedPurchaseRate).toLocaleString()} /Qtl
            </strong>
          </div>
        </div>

        {/* Card 3: Arrival Status */}
        <div 
          onClick={() => { setActiveTab('OVERVIEW'); setQuickFilter('PENDING_DELIVERY'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow ${
            activeTab === 'OVERVIEW' && quickFilter === 'PENDING_DELIVERY'
              ? 'bg-gradient-to-br from-amber-50 to-orange-100 border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
              Material Arrival
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              🚛
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {metrics.arrivedMT.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-slate-400">/ {metrics.totalQuantityMT.toFixed(1)} MT</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
            <div 
              className="bg-emerald-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${deliveryProgress}%` }}
            />
          </div>

          <div className="mt-2 text-xs flex items-center justify-between">
            <span className="text-emerald-700 font-bold">{deliveryProgress.toFixed(0)}% Delivered</span>
            <span className="text-amber-700 font-bold">{metrics.pendingDeliveryMT.toFixed(1)} MT Pending</span>
          </div>
        </div>

        {/* Card 4: Payment Status */}
        <div 
          onClick={() => { setActiveTab('OVERVIEW'); setQuickFilter('PAYMENT_DUE'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow ${
            activeTab === 'OVERVIEW' && quickFilter === 'PAYMENT_DUE'
              ? 'bg-gradient-to-br from-rose-50 to-red-100 border-rose-500 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
              Payment & Balance
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
              💳
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono truncate">
            ₹{(metrics.totalPayment / 100000).toFixed(2)} Lakh
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-xs flex items-center justify-between">
            <span className="text-slate-500">Pending Balance:</span>
            <strong className="font-mono text-rose-600 font-bold">
              ₹{((metrics.totalPurchaseValue - metrics.totalPayment) / 100000).toFixed(2)} Lakh
            </strong>
          </div>
        </div>

      </div>

      {/* ================= MULTI-DIMENSIONAL ANALYSIS NAVIGATION TABS ================= */}
      <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800 flex items-center gap-1.5 flex-wrap text-xs shadow-inner">
        {[
          { id: 'OVERVIEW' as const, label: 'Overview & Charts', icon: BarChart3 },
          { id: 'BROKER' as const, label: 'Broker Wise', icon: Users, count: brokerData.length },
          { id: 'AGENCY' as const, label: 'Agency Wise', icon: Building2, count: agencyData.length },
          { id: 'AREA' as const, label: 'Area Wise', icon: Package, count: areaData.length },
          { id: 'GRADE' as const, label: 'Grade Wise', icon: Award, count: gradeData.length },
          { id: 'SUPPLIER' as const, label: 'Supplier Wise', icon: Users, count: supplierData.length },
          { id: 'MONTH' as const, label: 'Month Wise', icon: Calendar, count: monthData.length },
          { id: 'DEDUCTION' as const, label: 'Deductions & Quality', icon: Scissors },
          { id: 'CHECKPOINTS' as const, label: 'Checkpoints Pipeline', icon: Truck },
          { id: 'ALL_DEALS' as const, label: 'All Transactions Ledger', icon: FileText, count: filteredList.length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-yellow-400 text-slate-950 font-black shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isActive ? 'bg-slate-950 text-yellow-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: DIMENSIONAL BREAKDOWN CONTENT ================= */}
      {activeTab !== 'OVERVIEW' && activeTab !== 'DEDUCTION' && activeTab !== 'CHECKPOINTS' && activeTab !== 'ALL_DEALS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-3 gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                {activeTab === 'BROKER' && 'Broker Wise Report & Analytics'}
                {activeTab === 'AGENCY' && 'Agency Wise Report & Analytics'}
                {activeTab === 'AREA' && 'Area Wise Report & Analytics'}
                {activeTab === 'GRADE' && 'Grade Wise Report & Analytics'}
                {activeTab === 'SUPPLIER' && 'Supplier / Party Wise Report & Analytics'}
                {activeTab === 'MONTH' && 'Monthly Progress & Analytics'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Toggle below to analyze Deductions, Pipeline Checkpoints, Premium, Performance Rankings, Abnormal Data, or Profitability.
              </p>
            </div>
            {onOpenManagementView && (
              <button
                onClick={onOpenManagementView}
                className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer self-start md:self-auto"
              >
                Full Management Matrix (P1-P4) →
              </button>
            )}
          </div>

          {/* Sub-Analysis Filter Bar */}
          <div className="flex items-center gap-1.5 flex-wrap bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-bold">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider px-2">Sub Report View:</span>
            {[
              { id: 'VOLUME' as const, label: '📦 Business Provided (Volume & Rate)', icon: '📊' },
              { id: 'DEDUCTION' as const, label: '✂️ All Types Deduction (Moisture & Grade Down)', icon: '✂️' },
              { id: 'CHECKPOINTS' as const, label: '🚚 Checkpoints Pipeline (Sauda to Sett)', icon: '🚚' },
              { id: 'PREMIUM' as const, label: '💰 Premium Given', icon: '💰' },
              { id: 'RANKING' as const, label: '🏆 Ranking Cards (Best, Medium, Lower)', icon: '🏆' },
              { id: 'ABNORMAL' as const, label: '⚠️ Abnormal Data vs Top Performers', icon: '⚠️' },
              /* { id: 'PROFITABILITY' as const, label: '📈 Satta Wise Profitability & Loss', icon: '📈' }, */
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setSubAnalysisMode(sub.id)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  subAnalysisMode === sub.id
                    ? 'bg-emerald-800 text-white shadow-sm font-black'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{sub.label}</span>
              </button>
            ))}
          </div>

          {/* Render Active Sub-View Data */}
          {(() => {
            const totalcurrentData = (
              activeTab === 'BROKER' ? brokerData :
              activeTab === 'AGENCY' ? agencyData :
              activeTab === 'AREA' ? areaData :
              activeTab === 'GRADE' ? gradeData :
              activeTab === 'SUPPLIER' ? supplierData : monthData
            );
            const currentData = activeTab === 'MONTH' ? [...totalcurrentData].sort((a, b) => { const [yearA, monthA] = String(a.key).split('-').map(Number); const [yearB, monthB] = String(b.key).split('-').map(Number); return ( new Date(yearB, monthB - 1).getTime() - new Date(yearA, monthA - 1).getTime() ); }) : totalcurrentData;

            if (subAnalysisMode === 'VOLUME') {
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b">
                        <th className="p-3">Rank / Entity Name</th>
                        <th className="p-3 text-center">Deals</th>
                        <th className="p-3 text-right">Contract Weight (MT)</th>
                        <th className="p-3 text-right">Arrived Weight (MT)</th>
                        <th className="p-3 text-right">Avg Rate (₹/Qtl)</th>
                        <th className="p-3 text-right">Total Business Value</th>
                        <th className="p-3 text-right text-emerald-800">Paid Amount (₹)</th>
                        <th className="p-3 text-right text-rose-800">Pending Balance</th>
                        <th className="p-3 text-center">Volume Tag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {currentData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono flex items-center justify-center font-bold">
                              {idx + 1}
                            </span>
                            <span>{row.key}</span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-600">{row.dealCount}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-950">{row.quantityMT.toFixed(2)} MT</td>
                          <td className="p-3 text-right font-mono text-slate-700">{row.arrivedMT.toFixed(2)} MT</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800">₹{Math.round(row.avgRate).toLocaleString()}</td>
                          <td className="p-3 text-right font-mono font-black text-slate-900">{formatIndianCurrency(row.grossValue)}</td>
                          <td className="p-3 text-right font-mono text-emerald-800 font-bold">{formatIndianCurrency(row.paidAmount)}</td>
                          <td className="p-3 text-right font-mono text-rose-800 font-bold">{formatIndianCurrency(row.pendingPayable)}</td>
                          <td className="p-3 text-center">
                            {idx < Math.ceil(currentData.length * 0.3) ? (
                              <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                🌟 Top Business Provider
                              </span>
                            ) : idx >= currentData.length - Math.ceil(currentData.length * 0.3) ? (
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                📉 Lower Business Volume
                              </span>
                            ) : (
                              <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                ⚖️ Regular Business
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }

            if (subAnalysisMode === 'DEDUCTION') {
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b">
                        <th className="p-3">Entity Name</th>
                        <th className="p-3 text-center">Deals</th>
                        <th className="p-3 text-right">Contract MT</th>
                        <th className="p-3 text-right text-rose-700">Total Deduction (₹)</th>
                        <th className="p-3 text-right">Deduction % of Value</th>
                        <th className="p-3 text-right">Avg Moisture %</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {currentData.map((row, idx) => {
                        const dedPct = row.grossValue > 0 ? (row.deductionAmount / row.grossValue) * 100 : 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-3 font-bold text-slate-900">{row.key}</td>
                            <td className="p-3 text-center font-mono">{row.dealCount}</td>
                            <td className="p-3 text-right font-mono">{row.quantityMT.toFixed(2)} MT</td>
                            <td className="p-3 text-right font-mono font-black text-rose-700">
                              {row.deductionAmount > 0 ? `-₹${Math.round(row.deductionAmount).toLocaleString()}` : '₹0'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-800">
                              {dedPct.toFixed(2)}%
                            </td>
                            <td className="p-3 text-right font-mono text-slate-700">
                              {row.avgMoisture > 0 ? `${row.avgMoisture.toFixed(1)}%` : 'Standard'}
                            </td>
                            <td className="p-3 text-center">
                              {dedPct > 1 ? (
                                <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  ⚠️ High Deduction Claim
                                </span>
                              ) : (
                                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  ✓ Standard Quality
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            }

            if (subAnalysisMode === 'CHECKPOINTS') {
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b">
                        <th className="p-3">Entity Name</th>
                        <th className="p-3 text-center bg-emerald-50">1. Sauda Check Point</th>
                        <th className="p-3 text-center bg-blue-50">2. Temporary Arrival</th>
                        <th className="p-3 text-center bg-indigo-50">3. Final Arrival</th>
                        <th className="p-3 text-center bg-purple-50">4. Mill Inspection</th>
                        <th className="p-3 text-center bg-yellow-50">5. Payment Operation</th>
                        <th className="p-3 text-center bg-emerald-100">6. Settlement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {currentData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-bold text-slate-900">{row.key}</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-900 bg-emerald-50/50">{row.saudaCheckpointCount} Deals</td>
                          <td className="p-3 text-center font-mono font-bold text-blue-900 bg-blue-50/50">{row.tempArrivalCount} Arrivals</td>
                          <td className="p-3 text-center font-mono font-bold text-indigo-900 bg-indigo-50/50">{row.finalArrivalCount} Completed</td>
                          <td className="p-3 text-center font-mono font-bold text-purple-900 bg-purple-50/50">{row.millInspectionCount} Inspected</td>
                          <td className="p-3 text-center font-mono font-bold text-yellow-900 bg-yellow-50/50">{row.paymentOperationCount} Paid</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-950 bg-emerald-100/50">{row.settlementCount} Settled</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }

            if (subAnalysisMode === 'PREMIUM') {
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b">
                        <th className="p-3">Entity Name</th>
                        <th className="p-3 text-center">Deals</th>
                        <th className="p-3 text-right">Contract MT</th>
                        <th className="p-3 text-right text-emerald-700">Total Premium Given (₹)</th>
                        <th className="p-3 text-right">Avg Premium Rate (₹/Qtl)</th>
                        <th className="p-3 text-center">Premium Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {currentData.map((row, idx) => {
                        const premRate = row.quantityMT > 0 ? (row.premiumAmount / (row.quantityMT * 10)) : 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-3 font-bold text-slate-900">{row.key}</td>
                            <td className="p-3 text-center font-mono">{row.dealCount}</td>
                            <td className="p-3 text-right font-mono">{row.quantityMT.toFixed(2)} MT</td>
                            <td className="p-3 text-right font-mono font-black text-emerald-800">
                              {row.premiumAmount > 0 ? `+₹${Math.round(row.premiumAmount).toLocaleString()}` : '₹0'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-800">
                              ₹{premRate.toFixed(2)}
                            </td>
                            <td className="p-3 text-center">
                              {row.premiumAmount > 0 ? (
                                <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  🌟 Premium Granted
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  Standard Base Rate
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            }

            if (subAnalysisMode === 'RANKING') {
              const bests = currentData.filter(d => d.tier === 'BEST');
              const mediums = currentData.filter(d => d.tier === 'MEDIUM');
              const lowers = currentData.filter(d => d.tier === 'LOWER');

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <span className="text-xs font-black uppercase text-emerald-900 block">🥇 Best Performers ({bests.length})</span>
                      <p className="text-[10px] text-emerald-700 mt-1">High business volume, profitable deals, and zero quality issues.</p>
                      <div className="mt-2 space-y-1">
                        {bests.slice(0, 5).map((b, i) => (
                          <div key={i} className="flex justify-between text-xs font-bold text-emerald-950">
                            <span>{b.key}</span>
                            <span className="font-mono">{b.quantityMT.toFixed(1)} MT</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                      <span className="text-xs font-black uppercase text-blue-900 block">🥈 Medium Performers ({mediums.length})</span>
                      <p className="text-[10px] text-blue-700 mt-1">Steady volume with average performance and standard settlement.</p>
                      <div className="mt-2 space-y-1">
                        {mediums.slice(0, 5).map((m, i) => (
                          <div key={i} className="flex justify-between text-xs font-bold text-blue-950">
                            <span>{m.key}</span>
                            <span className="font-mono">{m.quantityMT.toFixed(1)} MT</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                      <span className="text-xs font-black uppercase text-rose-900 block">🥉 Lower Performers ({lowers.length})</span>
                      <p className="text-[10px] text-rose-700 mt-1">Low volume, high deduction claims, or loss-making transactions.</p>
                      <div className="mt-2 space-y-1">
                        {lowers.slice(0, 5).map((l, i) => (
                          <div key={i} className="flex justify-between text-xs font-bold text-rose-950">
                            <span>{l.key}</span>
                            <span className="font-mono">{l.quantityMT.toFixed(1)} MT</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (subAnalysisMode === 'ABNORMAL') {
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b">
                        <th className="p-3">Entity Name</th>
                        <th className="p-3 text-center">Deals</th>
                        <th className="p-3 text-center text-amber-800">Abnormal / Flagged Deals</th>
                        <th className="p-3 text-right text-rose-700">Quality Deductions (₹)</th>
                        <th className="p-3 text-center">Performance Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {currentData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-bold text-slate-900">{row.key}</td>
                          <td className="p-3 text-center font-mono">{row.dealCount}</td>
                          <td className="p-3 text-center font-mono font-bold text-amber-900">
                            {row.abnormalDeals > 0 ? `⚠️ ${row.abnormalDeals} Deals` : 'None'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-rose-700">
                            {row.deductionAmount > 0 ? `-₹${Math.round(row.deductionAmount).toLocaleString()}` : '₹0'}
                          </td>
                          <td className="p-3 text-center">
                            {row.abnormalDeals === 0 ? (
                              <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                🌟 Very Good Performer
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                ⚠️ Quality Claims Flagged
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }

            if (subAnalysisMode === 'PROFITABILITY') {
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b">
                        <th className="p-3">Entity Name</th>
                        <th className="p-3 text-center">Total Deals</th>
                        <th className="p-3 text-center text-emerald-800">Profitable Deals</th>
                        <th className="p-3 text-center text-rose-800">Loss-Making Deals</th>
                        <th className="p-3 text-right">Net Profit / Loss (₹)</th>
                        <th className="p-3 text-center">Satta Profitability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {currentData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-bold text-slate-900">{row.key}</td>
                          <td className="p-3 text-center font-mono">{row.dealCount}</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-800">{row.profitableDeals}</td>
                          <td className="p-3 text-center font-mono font-bold text-rose-800">{row.lossDeals}</td>
                          <td className="p-3 text-right font-mono font-black">
                            <span className={row.grossProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}>
                              {row.grossProfit >= 0 ? `+${formatIndianCurrency(row.grossProfit)}` : formatIndianCurrency(row.grossProfit)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {row.grossProfit >= 0 ? (
                              <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                📈 Profitable Business
                              </span>
                            ) : (
                              <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                📉 Loss / Non-Profitable POs
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }

            return null;
          })()}
        </div>
      )}

      {/* ================= TAB 2: DEDUCTIONS & QUALITY SUMMARY ================= */}
      {activeTab === 'DEDUCTION' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Scissors className="w-5 h-5 text-rose-600" />
                Deduction & Quality Inspection Analysis
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Moisture claims, Grade Down demotions, quality penalties, and claim settlements across suppliers and brokers.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
              <span className="text-xs font-bold text-rose-900 uppercase block">Total Quality Deductions</span>
              <strong className="text-2xl font-black text-rose-950 font-mono block mt-1">
                {formatIndianCurrency(metrics.totalDeduction)}
              </strong>
              <span className="text-[10px] text-rose-700 mt-1 block">Moisture + Grade Down + Short Weight</span>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <span className="text-xs font-bold text-emerald-900 uppercase block">Total Premium Paid</span>
              <strong className="text-2xl font-black text-emerald-950 font-mono block mt-1">
                {formatIndianCurrency(metrics.totalPremium)}
              </strong>
              <span className="text-[10px] text-emerald-700 mt-1 block">Premium allowed for superior quality / agency</span>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <span className="text-xs font-bold text-amber-900 uppercase block">Abnormal / Flagged Transactions</span>
              <strong className="text-2xl font-black text-amber-950 font-mono block mt-1">
                {metrics.abnormalCount} Deals
              </strong>
              <span className="text-[10px] text-amber-700 mt-1 block">High Moisture, High Deduction, or Loss-Making</span>
            </div>
          </div>

          {/* Supplier Deductions Ranking Table */}
          <div className="pt-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
              Supplier Wise Deduction Ranking
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b">
                    <th className="p-2.5">Supplier / Party</th>
                    <th className="p-2.5 text-center">Deals</th>
                    <th className="p-2.5 text-right">Contract MT</th>
                    <th className="p-2.5 text-right">Total Business Value</th>
                    <th className="p-2.5 text-right text-rose-700">Deduction Amount (₹)</th>
                    <th className="p-2.5 text-right">Deduction % of Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplierData
                    .filter(s => s.deductionAmount > 0)
                    .sort((a, b) => b.deductionAmount - a.deductionAmount)
                    .map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{s.key}</td>
                        <td className="p-2.5 text-center font-mono">{s.dealCount}</td>
                        <td className="p-2.5 text-right font-mono">{s.quantityMT.toFixed(2)} MT</td>
                        <td className="p-2.5 text-right font-mono">{formatIndianCurrency(s.grossValue)}</td>
                        <td className="p-2.5 text-right font-mono font-black text-rose-700">-₹{Math.round(s.deductionAmount).toLocaleString()}</td>
                        <td className="p-2.5 text-right font-mono text-slate-700">
                          {s.grossValue > 0 ? `${((s.deductionAmount / s.grossValue) * 100).toFixed(2)}%` : '0%'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: CHECKPOINTS PIPELINE ================= */}
      {activeTab === 'CHECKPOINTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                Procurement Checkpoints Pipeline & Stage Status
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sauda Check Point $\to$ Temporary Arrival $\to$ Final Arrival $\to$ Mill Inspection $\to$ Payment $\to$ Settlement
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Sauda Check Point', count: transactions.length, status: 'Completed', color: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
              { label: 'Temporary Arrival', count: transactions.filter(t => t.arrivedWeightMT > 0).length, status: 'Active', color: 'bg-blue-50 border-blue-200 text-blue-900' },
              { label: 'Final Arrival', count: transactions.filter(t => t.pendingWeightMT <= 0.01).length, status: 'In Progress', color: 'bg-indigo-50 border-indigo-200 text-indigo-900' },
              { label: 'Mill Inspection', count: transactions.filter(t => t.moisturePct > 0 || t.deductionAmount > 0).length, status: 'Inspected', color: 'bg-purple-50 border-purple-200 text-purple-900' },
              { label: 'Payment Operation', count: transactions.filter(t => t.paidAmount > 0).length, status: 'Processing', color: 'bg-yellow-50 border-yellow-200 text-yellow-900' },
              { label: 'Settlement', count: transactions.filter(t => t.paymentStatus === 'PAID').length, status: 'Closed', color: 'bg-emerald-100 border-emerald-300 text-emerald-950' },
            ].map((st, i) => (
              <div key={i} className={`p-3 rounded-2xl border ${st.color}`}>
                <span className="text-[10px] font-bold uppercase block text-slate-500">{st.label}</span>
                <strong className="text-xl font-black font-mono block mt-1">{st.count}</strong>
                <span className="text-[9px] font-bold uppercase tracking-wider block mt-1 text-slate-600">{st.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= MAIN TRANSACTIONS LEDGER VIEW ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-700" />
              Complete Transaction Ledger ({filteredList.length} Records)
            </h3>
            <p className="text-xs text-slate-500">
              Click any transaction row to open the complete Executive Sauda Deal Slip.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Sauda No, Party, Broker..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl w-60 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Date Quick Filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setDateFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition ${dateFilter === 'ALL' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
              >
                All
              </button>
              <button
                onClick={() => setDateFilter('THIS_MONTH')}
                className={`px-2.5 py-1 rounded-lg transition ${dateFilter === 'THIS_MONTH' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
              >
                This Month
              </button>
              <button
                onClick={() => setDateFilter('TODAY')}
                className={`px-2.5 py-1 rounded-lg transition ${dateFilter === 'TODAY' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
              >
                Today
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Quick Filter Pill Buttons */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">Filter:</span>
          
          <button
            onClick={() => setQuickFilter('ALL')}
            className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer ${
              quickFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Deals ({tabCounts.all})
          </button>

          <button
            onClick={() => setQuickFilter('PENDING_DELIVERY')}
            className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer ${
              quickFilter === 'PENDING_DELIVERY'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span>🚚 Delivery Pending ({tabCounts.pendingDelivery})</span>
          </button>

          <button
            onClick={() => setQuickFilter('PAYMENT_DUE')}
            className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer ${
              quickFilter === 'PAYMENT_DUE'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span>💳 Payment Due ({tabCounts.paymentDue})</span>
          </button>

          <button
            onClick={() => setQuickFilter('COMPLETED')}
            className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer ${
              quickFilter === 'COMPLETED'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span>✓ Completed ({tabCounts.completed})</span>
          </button>

          <button
            onClick={() => setQuickFilter('ALERTS')}
            className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer ${
              quickFilter === 'ALERTS'
                ? 'bg-red-700 text-white'
                : 'bg-red-50 text-red-900 border border-red-200 hover:bg-red-100'
            }`}
          >
            <span>⚠️ Issues & Alerts ({tabCounts.alerts})</span>
          </button>

          {(searchQuery || quickFilter !== 'ALL' || dateFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setQuickFilter('ALL');
                setDateFilter('ALL');
              }}
              className="text-xs font-bold text-rose-600 hover:underline ml-auto cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Master Transaction Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b">
                <th className="p-3">
                  <button 
                    onClick={() => { setSortField('date'); setSortAsc(!sortAsc); }}
                    className="flex items-center gap-1 hover:text-slate-950 font-bold uppercase cursor-pointer"
                  >
                    Date
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="p-3">Sauda / PO No.</th>
                <th className="p-3">Party / Supplier</th>
                <th className="p-3">Broker</th>
                <th className="p-3">Grade & Area</th>
                <th className="p-3 text-right">
                  <button 
                    onClick={() => { setSortField('quantityMT'); setSortAsc(!sortAsc); }}
                    className="flex items-center gap-1 hover:text-slate-950 font-bold uppercase ml-auto cursor-pointer"
                  >
                    Weight (MT)
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="p-3 text-right">Rate (₹/Qtl)</th>
                <th className="p-3 text-right">
                  <button 
                    onClick={() => { setSortField('grossPurchaseValue'); setSortAsc(!sortAsc); }}
                    className="flex items-center gap-1 hover:text-slate-950 font-bold uppercase ml-auto cursor-pointer"
                  >
                    Total Value
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="p-3 text-center">Arrival</th>
                <th className="p-3 text-center">Payment</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredList.length > 0 ? (
                filteredList.map((t, idx) => {
                  const isAllArrived = t.pendingWeightMT <= 0.01;
                  const isPaid = t.paymentStatus === 'PAID';

                  return (
                    <tr
                      key={t.txnId || idx}
                      onClick={() => setSelectedTxn(t)}
                      className="hover:bg-emerald-50/60 transition cursor-pointer group"
                    >
                      <td className="p-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {t.date || '-'}
                      </td>

                      <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div>{t.saudaNo}</div>
                        {t.poNo && t.poNo !== t.saudaNo && (
                          <span className="text-[10px] text-slate-400 font-normal block">
                            PO: {t.poNo}
                          </span>
                        )}
                      </td>

                      <td className="p-3 font-bold text-slate-900 max-w-[180px] truncate" title={t.supplier}>
                        {t.supplier || 'Unassigned'}
                      </td>

                      <td className="p-3 text-slate-700 font-semibold max-w-[120px] truncate" title={t.broker}>
                        {t.broker || '-'}
                      </td>

                      <td className="p-3 text-slate-800">
                        <div className="font-bold text-emerald-950">{t.grade || '-'}</div>
                        <span className="text-[10px] text-slate-500 block">{t.area || '-'}</span>
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {t.quantityMT.toFixed(2)} MT
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                        ₹{t.purchaseRate.toLocaleString()}
                      </td>

                      <td className="p-3 text-right font-mono font-black text-slate-950 whitespace-nowrap">
                        ₹{Math.round(t.grossPurchaseValue).toLocaleString()}
                      </td>

                      <td className="p-3 text-center whitespace-nowrap">
                        {isAllArrived ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            🟢 Arrived
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800" title={`${t.pendingWeightMT.toFixed(1)} MT Pending`}>
                            🟡 {t.arrivedWeightMT > 0 ? `${t.arrivedWeightMT.toFixed(1)} MT` : 'Pending'}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center whitespace-nowrap">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            🟢 Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800" title={`Due: ₹${Math.round(t.pendingPayable).toLocaleString()}`}>
                            🔴 Due
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedTxn(t);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px] rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1 mx-auto"
                        >
                          <FileText className="w-3 h-3 text-emerald-700" />
                          <span>Slip</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-400 space-y-2">
                    <XCircle className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="font-bold text-slate-700 text-sm">No Transaction Records Found</div>
                    <p className="text-xs text-slate-500">
                      Try clearing search filters or selecting a different date range.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single Deal Slip Modal */}
      <SimpleDealSlipModal
        transaction={selectedTxn}
        onClose={() => setSelectedTxn(null)}
      />

    </div>
  );
};
