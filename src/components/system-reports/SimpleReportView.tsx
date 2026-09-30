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
  HelpCircle
} from 'lucide-react';
import { SystemReportDataset, ReportTransactionLine } from '../../services/systemReportEngine';
import { SimpleDealSlipModal } from './SimpleDealSlipModal';

interface SimpleReportViewProps {
  dataset: SystemReportDataset;
  onOpenManagementView?: () => void;
}

export const SimpleReportView: React.FC<SimpleReportViewProps> = ({
  dataset,
  onOpenManagementView
}) => {
  const { transactions, metrics } = dataset;

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
    const todayStr = new Date().toISOString().split('T')[0];
    const curYearMonth = todayStr.substring(0, 7);
    if (dateFilter === 'TODAY') {
      list = list.filter(t => t.date === todayStr);
    } else if (dateFilter === 'THIS_MONTH') {
      list = list.filter(t => t.date && t.date.startsWith(curYearMonth));
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
      'Date (तारीख)', 'Sauda No (सौदा नं.)', 'PO No (PO नं.)', 'Party/Supplier (पार्टी)', 'Broker (दलाल)',
      'Area (एरिया)', 'Grade (ग्रेड)', 'Weight MT (वजन MT)', 'Rate Rs/Qtl (भाव ₹/क्विंटल)', 'Total Rs (कुल रकम ₹)',
      'Arrived MT (आया वजन)', 'Pending MT (बाकी वजन)', 'Paid Rs (दिया भुगतान)', 'Balance Rs (बाकी रकम)', 'Status'
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
    link.setAttribute('download', `sauda_report_simple_${new Date().toISOString().split('T')[0]}.csv`);
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
          onClick={() => setQuickFilter('ALL')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow ${
            quickFilter === 'ALL'
              ? 'bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
              कुल सौदे (Total Deals)
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              📦
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-950 font-mono">
            {metrics.totalSaudaCount || metrics.totalPOCount || transactions.length}
            <span className="text-xs font-bold text-slate-500 ml-1.5 font-sans">सौदे</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>कुल वजन:</span>
            <strong className="font-mono text-emerald-900 font-bold">
              {metrics.totalQuantityMT.toFixed(2)} MT
            </strong>
          </div>
        </div>

        {/* Card 2: Total Purchase Value */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
              कुल खरीद रकम (Total Value)
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
            <span>औसत खरीद भाव:</span>
            <strong className="font-mono text-slate-900 font-bold">
              ₹{Math.round(metrics.weightedPurchaseRate).toLocaleString()} /Qtl
            </strong>
          </div>
        </div>

        {/* Card 3: Arrival Status */}
        <div 
          onClick={() => setQuickFilter('PENDING_DELIVERY')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow ${
            quickFilter === 'PENDING_DELIVERY'
              ? 'bg-gradient-to-br from-amber-50 to-orange-100 border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
              माल की आमद (Arrival)
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
            <span className="text-emerald-700 font-bold">{deliveryProgress.toFixed(0)}% आ गया</span>
            <span className="text-amber-700 font-bold">{metrics.pendingDeliveryMT.toFixed(1)} MT बाकी</span>
          </div>
        </div>

        {/* Card 4: Payment Status */}
        <div 
          onClick={() => setQuickFilter('PAYMENT_DUE')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow ${
            quickFilter === 'PAYMENT_DUE'
              ? 'bg-gradient-to-br from-rose-50 to-red-100 border-rose-500 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
              भुगतान और बाकी (Payment)
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
              💳
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono truncate">
            ₹{(metrics.totalPayment / 100000).toFixed(2)} Lakh
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-xs flex items-center justify-between">
            <span className="text-slate-500">बाकी रकम (Due):</span>
            <strong className="font-mono text-rose-600 font-bold">
              ₹{((metrics.totalPurchaseValue - metrics.totalPayment) / 100000).toFixed(2)} Lakh
            </strong>
          </div>
        </div>

      </div>

      {/* ================= CONTROLS: SEARCH & ONE-TAP TABS ================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        
        {/* Top search & quick dates */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Simple Search */}
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="सौदा नं., पार्टी का नाम, या दलाल खोजें (Search)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-none font-medium transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Date Buttons & Export */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
              <button
                onClick={() => setDateFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  dateFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                सभी (All)
              </button>
              <button
                onClick={() => setDateFilter('THIS_MONTH')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  dateFilter === 'THIS_MONTH' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                इस महीने (Month)
              </button>
              <button
                onClick={() => setDateFilter('TODAY')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  dateFilter === 'TODAY' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                आज (Today)
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Download Excel / CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">डाउनलोड (Excel)</span>
            </button>
          </div>

        </div>

        {/* Quick Filter Pill Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-black uppercase text-slate-400 mr-1">फ़िल्टर करें:</span>

          <button
            onClick={() => setQuickFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              quickFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>सब सौदे (All Deals)</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
              {tabCounts.all}
            </span>
          </button>

          <button
            onClick={() => setQuickFilter('PENDING_DELIVERY')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              quickFilter === 'PENDING_DELIVERY'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span>🚛 माल बाकी है (Pending Delivery)</span>
            <span className="px-1.5 py-0.2 bg-black/10 rounded-full text-[10px]">
              {tabCounts.pendingDelivery}
            </span>
          </button>

          <button
            onClick={() => setQuickFilter('PAYMENT_DUE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              quickFilter === 'PAYMENT_DUE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span>💰 पेमेंट बाकी है (Payment Due)</span>
            <span className="px-1.5 py-0.2 bg-black/10 rounded-full text-[10px]">
              {tabCounts.paymentDue}
            </span>
          </button>

          <button
            onClick={() => setQuickFilter('COMPLETED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              quickFilter === 'COMPLETED'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span>✅ पूरा हो चुका (Completed)</span>
            <span className="px-1.5 py-0.2 bg-black/10 rounded-full text-[10px]">
              {tabCounts.completed}
            </span>
          </button>

          {tabCounts.alerts > 0 && (
            <button
              onClick={() => setQuickFilter('ALERTS')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                quickFilter === 'ALERTS'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
              }`}
            >
              <span>⚠️ कटौती / समस्या (Issues)</span>
              <span className="px-1.5 py-0.2 bg-black/10 rounded-full text-[10px]">
                {tabCounts.alerts}
              </span>
            </button>
          )}

          {/* Result Count */}
          <span className="ml-auto text-xs text-slate-500 font-medium">
            कुल रिकॉर्ड: <strong className="text-slate-800 font-mono">{filteredList.length}</strong>
          </span>
        </div>

      </div>

      {/* ================= MASTER SIMPLE TABLE ================= */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-2xl">
            📋
          </div>
          <h3 className="text-base font-black text-slate-800">
            कोई सौदा या खरीद रिकॉर्ड नहीं मिला (No Records Found)
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {transactions.length === 0 
              ? 'डेटाबेस में अभी कोई सौदा या खरीद रिकॉर्ड नहीं है। नया सौदा (Sauda Entry) या Final P.O. में डेटा दर्ज करने पर वह यहाँ अपने आप दिखाई देगा।' 
              : 'दिए गए फ़िल्टर या खोज के अनुसार कोई रिकॉर्ड नहीं मिला। कृपया दूसरा नाम या फ़िल्टर चुनें।'}
          </p>
          {(searchQuery || quickFilter !== 'ALL' || dateFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setQuickFilter('ALL');
                setDateFilter('ALL');
              }}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition"
            >
              सभी फ़िल्टर हटाएं (Clear Filters)
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-3.5">तारीख (Date)</th>
                  <th className="py-3 px-3">सौदा / PO नं. (No.)</th>
                  <th className="py-3 px-3">पार्टी (Party / Supplier)</th>
                  <th className="py-3 px-3">दलाल (Broker)</th>
                  <th className="py-3 px-3">ग्रेड / एरिया (Grade & Area)</th>
                  <th className="py-3 px-3 text-right">वजन (Weight MT)</th>
                  <th className="py-3 px-3 text-right">भाव (Rate ₹)</th>
                  <th className="py-3 px-3 text-right">कुल रकम (Total ₹)</th>
                  <th className="py-3 px-3.5 text-center">माल स्थिति (Arrival)</th>
                  <th className="py-3 px-3.5 text-center">पेमेंट (Payment)</th>
                  <th className="py-3 px-3 text-center">पर्ची (Slip)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
                {filteredList.map((t, idx) => {
                  const isArrivalComplete = t.pendingWeightMT <= 0.01;
                  const isPaymentComplete = t.paymentStatus === 'PAID';

                  return (
                    <tr 
                      key={t.txnId || idx}
                      onClick={() => setSelectedTxn(t)}
                      className="hover:bg-emerald-50/50 transition cursor-pointer group"
                    >
                      {/* Date */}
                      <td className="py-3 px-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {t.date || '-'}
                      </td>

                      {/* Sauda / PO */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-black text-emerald-950 block font-mono">
                          {t.saudaNo}
                        </span>
                        {t.poNo && t.poNo !== t.saudaNo && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            PO: {t.poNo}
                          </span>
                        )}
                      </td>

                      {/* Supplier */}
                      <td className="py-3 px-3">
                        <strong className="text-slate-900 block group-hover:text-emerald-900 transition">
                          {t.supplier}
                        </strong>
                      </td>

                      {/* Broker */}
                      <td className="py-3 px-3 text-slate-600">
                        {t.broker || '-'}
                      </td>

                      {/* Grade & Area */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">{t.grade}</span>
                        {t.area && t.area !== '-' && (
                          <span className="text-[10px] text-slate-500 block">{t.area}</span>
                        )}
                      </td>

                      {/* Weight */}
                      <td className="py-3 px-3 text-right font-black font-mono text-slate-900 whitespace-nowrap">
                        {t.quantityMT.toFixed(2)} MT
                      </td>

                      {/* Rate */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        ₹{t.purchaseRate.toLocaleString()}
                      </td>

                      {/* Total Gross Value */}
                      <td className="py-3 px-3 text-right font-black font-mono text-emerald-950 whitespace-nowrap">
                        ₹{Math.round(t.grossPurchaseValue).toLocaleString()}
                      </td>

                      {/* Arrival Status */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {isArrivalComplete ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            🟢 पूरा आया
                          </span>
                        ) : t.arrivedWeightMT > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                            🟡 {t.pendingWeightMT.toFixed(1)} MT बाकी
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            ⚪ माल नहीं आया
                          </span>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {isPaymentComplete ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            🟢 चुकता
                          </span>
                        ) : t.paidAmount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                            🟡 ₹{Math.round(t.pendingPayable).toLocaleString()} बाकी
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            🔴 बाकी
                          </span>
                        )}
                      </td>

                      {/* Slip Action */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTxn(t);
                          }}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 mx-auto cursor-pointer border border-emerald-200 hover:border-emerald-600"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>पर्ची</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Simple Bottom Summary Ribbon */}
          <div className="bg-slate-50 border-t border-slate-200 p-3 px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">दिखाए गए सौदे:</span>
              <span className="font-mono font-bold text-emerald-700">{filteredList.length}</span>
              <span className="text-slate-400">|</span>
              <span>कुल वजन:</span>
              <strong className="font-mono text-slate-900">
                {filteredList.reduce((acc, t) => acc + t.quantityMT, 0).toFixed(2)} MT
              </strong>
            </div>

            <div className="flex items-center gap-3">
              <span>कुल रकम:</span>
              <strong className="font-mono text-emerald-950 font-black text-sm">
                ₹{Math.round(filteredList.reduce((acc, t) => acc + t.grossPurchaseValue, 0)).toLocaleString()}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* ================= OPTIONAL MANAGEMENT VIEW LINK ================= */}
      {onOpenManagementView && (
        <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <strong className="text-sm font-black text-yellow-300 block">
                विस्तृत विश्लेषण चाहिए? (Need Detailed Management Analysis?)
              </strong>
              <p className="text-xs text-slate-300">
                सट्टा बेस रेट वेरिएन्स, मुनाफा विश्लेषण, ब्रोकर रैंकिंग और चेकपॉइंट्स देखने के लिए मैनेजमेंट मोड खोलें।
              </p>
            </div>
          </div>

          <button
            onClick={onOpenManagementView}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs rounded-xl shadow transition flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>मैनेजमेंट रिपोर्ट खोलें (Management View)</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================= SLIP MODAL ================= */}
      <SimpleDealSlipModal
        transaction={selectedTxn}
        onClose={() => setSelectedTxn(null)}
      />

    </div>
  );
};
