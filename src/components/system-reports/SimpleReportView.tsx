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
  | 'ALLSAUDA'
  | 'ALL_DEALS';

const formatSettVal = (sett: number | undefined | null, claim: number | undefined | null): string => {
  const s = Number(sett || 0);
  const c = Number(claim || 0);
  const val = s > 0 ? s : (c > 0 ? c : 0);
  if (val <= 0) return '—';
  return `${val.toFixed(2)}%`;
};

export const SimpleReportView: React.FC<SimpleReportViewProps> = ({
  dataset,
  onOpenManagementView
}) => {
  const { transactions, metrics, allPoSummary } = dataset;

  // Active Tab Dimension
  const [activeTab, setActiveTab] = useState<TabDimension>('ALLSAUDA');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  
  // Selected Slip Modal & Broker Full-Screen Modal
  const [selectedTxn, setSelectedTxn] = useState<ReportTransactionLine | null>(null);
  const [selectedBrokerModalBroker, setSelectedBrokerModalBroker] = useState<string | null>(null);

  // Sauda records from sauda_master, sauda_check_point, purchase_master (Sauda / PO level, exactly 1 row per Sauda, NOT split by grade)
  const allSaudaRecords = useMemo(() => {
    return allPoSummary?.records || [];
  }, [allPoSummary]);

  // Available Months for Month Wise Filter
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    allSaudaRecords.forEach(r => {
      if (r.month) set.add(r.month);
      else if (r.date && r.date.length >= 7) set.add(r.date.substring(0, 7));
    });
    transactions.forEach(t => {
      if (t.month) set.add(t.month);
      else if (t.date && t.date.length >= 7) set.add(t.date.substring(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [allSaudaRecords, transactions]);

  const formatMonthLabel = (m: string) => {
    if (!m) return '';
    try {
      const [year, month] = m.split('-');
      if (year && month) {
        const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
        return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      }
    } catch {
      // fallback
    }
    return m;
  };

  // Sorting for All Sauda Table
  const [sortField, setSortField] = useState<'date' | 'saudaNo' | 'supplier' | 'broker' | 'quantityMT'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false); // Default false = Latest Date First

  // Pagination for All Sauda Table
  const [allSaudaPage, setAllSaudaPage] = useState<number>(1);
  const [allSaudaPageSize, setAllSaudaPageSize] = useState<number>(50);

  const handleSort = (field: 'date' | 'saudaNo' | 'supplier' | 'broker' | 'quantityMT') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'date' ? false : true);
    }
    setAllSaudaPage(1);
  };

  // Filtered & Sorted All Sauda List (Each Sauda / PO is 1 row, full total weight, from sauda_master, scp, pm)
  const filteredSaudaList = useMemo(() => {
    let list = [...allSaudaRecords];

    // Month Wise Filter
    if (selectedMonth && selectedMonth !== 'ALL') {
      list = list.filter(r =>
        r.month === selectedMonth ||
        (r.date && (r.date === selectedMonth || r.date.startsWith(selectedMonth) || normalizeToISODate(r.date).startsWith(selectedMonth)))
      );
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r =>
        (r.saudaNo || '').toLowerCase().includes(q) ||
        (r.poNo || '').toLowerCase().includes(q) ||
        (r.supplier || '').toLowerCase().includes(q) ||
        (r.broker || '').toLowerCase().includes(q) ||
        (r.area || '').toLowerCase().includes(q) ||
        (r.date || '').toLowerCase().includes(q)
      );
    }

    // Sort with Date as default (latest first) and Sauda / PO No. as secondary sort
    list.sort((a, b) => {
      if (sortField === 'date') {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        const diff = sortAsc ? dateA - dateB : dateB - dateA;
        if (diff !== 0) return diff;

        // Secondary sort: Sauda / PO No. (natural numeric sort)
        const strA = a.saudaNo || a.poNo || '';
        const strB = b.saudaNo || b.poNo || '';
        return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
      }

      if (sortField === 'saudaNo') {
        const strA = a.saudaNo || a.poNo || '';
        const strB = b.saudaNo || b.poNo || '';
        const comp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
        if (comp !== 0) return sortAsc ? comp : -comp;

        // Secondary sort: Date (latest date first)
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      }

      if (sortField === 'supplier') {
        const supA = a.supplier || '';
        const supB = b.supplier || '';
        const comp = supA.localeCompare(supB, undefined, { sensitivity: 'base' });
        if (comp !== 0) return sortAsc ? comp : -comp;
        return (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0);
      }

      if (sortField === 'broker') {
        const brkA = a.broker || '';
        const brkB = b.broker || '';
        const comp = brkA.localeCompare(brkB, undefined, { sensitivity: 'base' });
        if (comp !== 0) return sortAsc ? comp : -comp;
        return (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0);
      }

      if (sortField === 'quantityMT') {
        const wtA = Number(a.quantityMT || 0);
        const wtB = Number(b.quantityMT || 0);
        const diff = sortAsc ? wtA - wtB : wtB - wtA;
        if (diff !== 0) return diff;
        return (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0);
      }

      return 0;
    });

    return list;
  }, [allSaudaRecords, selectedMonth, searchQuery, sortField, sortAsc]);

  // Filtered & Sorted Transactions (Used for Dimensional Breakdown Tabs like Broker, Agency, Grade, etc.)
  const filteredList = useMemo(() => {
    let list = [...transactions];

    // Month Wise Filter
    if (selectedMonth && selectedMonth !== 'ALL') {
      list = list.filter(t =>
        t.month === selectedMonth ||
        (t.date && (t.date === selectedMonth || t.date.startsWith(selectedMonth) || normalizeToISODate(t.date).startsWith(selectedMonth)))
      );
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t =>
        (t.saudaNo || '').toLowerCase().includes(q) ||
        (t.poNo || '').toLowerCase().includes(q) ||
        (t.supplier || '').toLowerCase().includes(q) ||
        (t.broker || '').toLowerCase().includes(q) ||
        (t.area || '').toLowerCase().includes(q) ||
        (t.grade || '').toLowerCase().includes(q)
      );
    }

    // Sort with Date as default (latest first) and Sauda / PO No. as secondary sort
    list.sort((a, b) => {
      if (sortField === 'date') {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        const diff = sortAsc ? dateA - dateB : dateB - dateA;
        if (diff !== 0) return diff;

        // Secondary sort: Sauda / PO No. (natural numeric sort)
        const strA = a.saudaNo || a.poNo || '';
        const strB = b.saudaNo || b.poNo || '';
        return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
      }

      if (sortField === 'saudaNo') {
        const strA = a.saudaNo || a.poNo || '';
        const strB = b.saudaNo || b.poNo || '';
        const comp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
        if (comp !== 0) return sortAsc ? comp : -comp;

        // Secondary sort: Date (latest date first)
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      }

      if (sortField === 'supplier') {
        const supA = a.supplier || '';
        const supB = b.supplier || '';
        const comp = supA.localeCompare(supB, undefined, { sensitivity: 'base' });
        if (comp !== 0) return sortAsc ? comp : -comp;
        return (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0);
      }

      if (sortField === 'broker') {
        const brkA = a.broker || '';
        const brkB = b.broker || '';
        const comp = brkA.localeCompare(brkB, undefined, { sensitivity: 'base' });
        if (comp !== 0) return sortAsc ? comp : -comp;
        return (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0);
      }

      if (sortField === 'quantityMT') {
        const wtA = Number(a.quantityMT || 0);
        const wtB = Number(b.quantityMT || 0);
        const diff = sortAsc ? wtA - wtB : wtB - wtA;
        if (diff !== 0) return diff;
        return (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0);
      }

      return 0;
    });

    return list;
  }, [transactions, selectedMonth, searchQuery, sortField, sortAsc]);

  // Active Sub-Analysis View for Dimensional Tabs
  const [subAnalysisMode, setSubAnalysisMode] = useState<'VOLUME' | 'DEDUCTION' | 'CHECKPOINTS' | 'PREMIUM' | 'RANKING'>('VOLUME');

  // Combine transactions and allSaudaRecords to ensure every broker/entity with a Sauda or P.O. in the session is included
  const allDimensionRecords = useMemo(() => {
    const txnList = [...transactions];
    const existingPoSaudas = new Set(txnList.map(t => `${t.poNo}_${t.saudaNo}`));
    
    allSaudaRecords.forEach(r => {
      const key = `${r.poNo}_${r.saudaNo}`;
      if (!existingPoSaudas.has(key)) {
        txnList.push({
          txnId: r.id || r.poNo || r.saudaNo,
          saudaNo: r.saudaNo || '-',
          poNo: r.poNo || '-',
          date: r.date || '',
          month: r.month || '',
          financialYear: r.financialYear || '',
          supplier: r.supplier || 'Unassigned',
          broker: r.broker || 'Direct',
          agency: r.agency || '-',
          area: r.area || '-',
          grade: r.grade || '-',
          quantityMT: Number(r.quantityMT || 0),
          purchaseRate: Number(r.rate || 0),
          baseRate: Number(r.rate || 0),
          rateVariance: 0,
          rateVariancePct: 0,
          grossPurchaseValue: Number(r.grossValue || (r.quantityMT * r.rate * 10) || 0),
          baseRateValue: Number(r.grossValue || 0),
          premiumRate: 0,
          premiumAmount: 0,
          premiumPct: 0,
          deductionAmount: 0,
          deductionPct: 0,
          moisturePct: 0,
          gradeDownQty: 0,
          effectiveCost: Number(r.rate || 0),
          realizationRate: Number(r.rate || 0),
          realizationValue: Number(r.grossValue || 0),
          grossProfit: 0,
          profitPct: 0,
          profitStatus: 'BREAK-EVEN',
          saudaStatus: 'IN_PROGRESS',
          arrivalStatus: 'PENDING',
          inspectionStatus: 'PENDING',
          paymentStatus: 'PENDING',
          settlementStatus: 'PENDING',
          arrivedWeightMT: 0,
          pendingWeightMT: Number(r.quantityMT || 0),
          paidAmount: 0,
          pendingPayable: Number(r.grossValue || 0),
          claimAmount: 0,
          claimSettled: 0,
          isDelayed: false,
          isAbnormal: false,
          abnormalReasons: []
        });
      }
    });

    return txnList;
  }, [transactions, allSaudaRecords]);

  // Aggregation Helper Function for multi-dimensional analysis across all session records
  const aggregateByDimension = (keyGetter: (t: ReportTransactionLine) => string, customSource?: ReportTransactionLine[]) => {
    const map = new Map<string, {
      key: string;
      dealCount: number;
      quantityMT: number;
      arrivedMT: number;
      pendingMT: number;
      grossValue: number;
      deductionAmount: number;
      premiumAmount: number;
      paidAmount: number;
      pendingPayable: number;
      avgRate: number;
      abnormalDeals: number;
      moistureSum: number;
      moistureCount: number;
      saudaCheckpointCount: number;
      tempArrivalCount: number;
      finalArrivalCount: number;
      millInspectionCount: number;
      paymentOperationCount: number;
      settlementCount: number;
      poCount: number;
      poQuantityMT: number;
      poGrossValue: number;
    }>();

    const source = customSource || allDimensionRecords;

    source.forEach(t => {
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
        paidAmount: 0,
        pendingPayable: 0,
        avgRate: 0,
        abnormalDeals: 0,
        moistureSum: 0,
        moistureCount: 0,
        saudaCheckpointCount: 0,
        tempArrivalCount: 0,
        finalArrivalCount: 0,
        millInspectionCount: 0,
        paymentOperationCount: 0,
        settlementCount: 0,
        poCount: 0,
        poQuantityMT: 0,
        poGrossValue: 0
      };

      existing.dealCount += 1;
      existing.quantityMT += t.quantityMT;
      existing.arrivedMT += t.arrivedWeightMT;
      existing.pendingMT += t.pendingWeightMT;
      existing.grossValue += t.grossPurchaseValue;
      existing.deductionAmount += t.deductionAmount;
      existing.premiumAmount += t.premiumAmount;
      existing.paidAmount += t.paidAmount;
      existing.pendingPayable += t.pendingPayable;

      const hasValidPO = Boolean(t.poNo && t.poNo !== 'Pending P.O.' && t.poNo !== '-');
      if (hasValidPO) {
        existing.poCount += 1;
        existing.poQuantityMT += t.quantityMT;
        existing.poGrossValue += t.grossPurchaseValue;
      }

      if (t.isAbnormal || t.moisturePct > 14 || t.deductionAmount > 0) {
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
      if (item.abnormalDeals === 0 && item.deductionAmount === 0 && item.quantityMT >= 10) {
        tier = 'BEST';
      } else if (item.abnormalDeals > 1 || item.deductionAmount > 5000 || item.quantityMT < 5) {
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

  const brokerData = useMemo(() => {
    const list = aggregateByDimension(t => t.broker);
    const existingKeys = new Set(list.map(item => item.key.toLowerCase()));
    (dataset.masterLists.brokers || []).forEach(b => {
      const bName = String(b).trim();
      if (bName && !existingKeys.has(bName.toLowerCase())) {
        list.push({
          key: bName,
          dealCount: 0,
          quantityMT: 0,
          arrivedMT: 0,
          pendingMT: 0,
          grossValue: 0,
          deductionAmount: 0,
          premiumAmount: 0,
          paidAmount: 0,
          pendingPayable: 0,
          avgRate: 0,
          abnormalDeals: 0,
          moistureSum: 0,
          moistureCount: 0,
          saudaCheckpointCount: 0,
          tempArrivalCount: 0,
          finalArrivalCount: 0,
          millInspectionCount: 0,
          paymentOperationCount: 0,
          settlementCount: 0,
          poCount: 0,
          poQuantityMT: 0,
          poGrossValue: 0,
          avgMoisture: 0,
          tier: 'MEDIUM'
        });
      }
    });
    return list.sort((a, b) => b.grossValue - a.grossValue);
  }, [allDimensionRecords, dataset.masterLists.brokers]);

  const agencyData = useMemo(() => aggregateByDimension(t => t.agency), [allDimensionRecords]);
  const areaData = useMemo(() => aggregateByDimension(t => t.area), [allDimensionRecords]);
  const gradeData = useMemo(() => aggregateByDimension(t => t.grade), [allDimensionRecords]);

  const supplierData = useMemo(() => {
    const list = aggregateByDimension(t => t.supplier);
    const existingKeys = new Set(list.map(item => item.key.toLowerCase()));
    (dataset.masterLists.suppliers || []).forEach(s => {
      const sName = String(s).trim();
      if (sName && !existingKeys.has(sName.toLowerCase())) {
        list.push({
          key: sName,
          dealCount: 0,
          quantityMT: 0,
          arrivedMT: 0,
          pendingMT: 0,
          grossValue: 0,
          deductionAmount: 0,
          premiumAmount: 0,
          paidAmount: 0,
          pendingPayable: 0,
          avgRate: 0,
          abnormalDeals: 0,
          moistureSum: 0,
          moistureCount: 0,
          saudaCheckpointCount: 0,
          tempArrivalCount: 0,
          finalArrivalCount: 0,
          millInspectionCount: 0,
          paymentOperationCount: 0,
          settlementCount: 0,
          poCount: 0,
          poQuantityMT: 0,
          poGrossValue: 0,
          avgMoisture: 0,
          tier: 'MEDIUM'
        });
      }
    });
    return list.sort((a, b) => b.grossValue - a.grossValue);
  }, [allDimensionRecords, dataset.masterLists.suppliers]);

  const monthData = useMemo(() => aggregateByDimension(t => t.month || (t.date ? t.date.substring(0, 7) : 'Unknown')), [allDimensionRecords]);

  // CSV Export
  const handleExportCSV = () => {
    const exportList = activeTab === 'ALLSAUDA' ? filteredSaudaList : filteredList;
    if (!exportList.length) return;
    const headers = [
      'Date', 'Sauda / PO No', 'Party / Supplier', 'Broker', 'Weight (MT)'
    ];
    const rows = exportList.map(t => {
      const saudaPo = t.saudaNo && t.poNo && t.saudaNo !== t.poNo
        ? `${t.saudaNo} / ${t.poNo}`
        : (t.saudaNo || t.poNo || '-');
      return [
        t.date || '-',
        `"${saudaPo}"`,
        `"${t.supplier || 'Unassigned'}"`,
        `"${t.broker || 'Direct'}"`,
        (t.quantityMT || 0).toFixed(2)
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `all_sauda_report_${selectedMonth !== 'ALL' ? selectedMonth : 'all'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 font-sans text-slate-800">

      {/* ================= MULTI-DIMENSIONAL ANALYSIS NAVIGATION TABS ================= */}
      <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800 flex items-center gap-1.5 flex-wrap text-xs shadow-inner">
        {[
          /* { id: 'OVERVIEW' as const, label: 'Overview & Charts', icon: BarChart3 }, */
          /* { id: 'ALL_DEALS' as const, label: 'All Transactions', icon: FileText, count: filteredList.length }, */
          { id: 'BROKER' as const, label: 'Broker Wise', icon: Users, count: brokerData.filter(b => b.dealCount > 0).length },
          { id: 'AGENCY' as const, label: 'Agency Wise', icon: Building2, count: agencyData.filter(a => a.dealCount > 0).length },
          { id: 'AREA' as const, label: 'Area Wise', icon: Package, count: areaData.filter(a => a.dealCount > 0).length },
          { id: 'GRADE' as const, label: 'Grade Wise', icon: Award, count: gradeData.filter(g => g.dealCount > 0).length },
          { id: 'SUPPLIER' as const, label: 'Supplier Wise', icon: Users, count: supplierData.filter(s => s.dealCount > 0).length },
          { id: 'MONTH' as const, label: 'Month Wise', icon: Calendar, count: monthData.length },
          { id: 'DEDUCTION' as const, label: 'Deductions & Quality', icon: Scissors },
          { id: 'CHECKPOINTS' as const, label: 'Checkpoints Pipeline', icon: Truck },
          { id: 'ALLSAUDA' as const, label: 'All Sauda', icon: Building2, count: filteredSaudaList.length }
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
      {activeTab !== 'ALLSAUDA' && activeTab !== 'OVERVIEW' && activeTab !== 'DEDUCTION' && activeTab !== 'CHECKPOINTS' && activeTab !== 'ALL_DEALS' && (
        <div className="space-y-4">

          {/* Sub-Analysis Filter Bar */}
<div className="flex w-full flex-wrap items-stretch gap-2 rounded-2xl border border-[#DCE7D9] bg-gradient-to-br from-white via-[#FAFCF9] to-[#F1F6EF] p-3 shadow-[0_4px_16px_rgba(23,76,44,0.06)]">

  {[
    { id: 'VOLUME' as const, label: 'Business Provided', sub: 'Volume & Rate', icon: '📦' },
    { id: 'DEDUCTION' as const, label: 'Deduction', sub: 'Moisture & Grade Down', icon: '✂️' },
    { id: 'CHECKPOINTS' as const, label: 'Checkpoints Pipeline', sub: 'Sauda to Settlement', icon: '🚚' },
    { id: 'PREMIUM' as const, label: 'Premium Given', sub: 'Premium Analysis', icon: '💰' },
    { id: 'RANKING' as const, label: 'Ranking Cards', sub: 'Best, Medium, Lower', icon: '🏆' },
  ].map((item) => {
    const isActive = subAnalysisMode === item.id;

    return (
      <button
        key={item.id}
        onClick={() => setSubAnalysisMode(item.id)}
        className={` group relative flex flex-1 min-w-[220px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 ${ isActive ? 'border-[#174C2C] bg-gradient-to-br from-[#1E5A32] to-[#123D25] text-white shadow-md' : 'border-[#E2E9DF] bg-white text-[#334536] hover:border-[#B7CDB5] hover:bg-[#F4F8F1] hover:shadow-sm' } `}
      >
        <span
          className={`
            flex h-9 w-9 shrink-0 items-center justify-center
            rounded-lg text-base transition-colors
            ${
              isActive
                ? 'bg-white/15 shadow-inner'
                : 'bg-[#EEF4EA] group-hover:bg-[#E3EEDF]'
            }
          `}
        >
          {item.icon}
        </span>

        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="whitespace-nowrap text-xs font-extrabold tracking-wide">
            {item.label}
          </span>
          <span
            className={`whitespace-nowrap text-[10px] font-medium ${
              isActive ? 'text-green-100' : 'text-slate-500'
            }`}
          >
            {item.sub}
          </span>
        </span>

        {isActive && (
          <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-[#D4AF37]" />
        )}
      </button>
    );
  })}
</div>


          {/* Render Active Sub-View Data */}
          {(() => {
            const rawCurrentData = (
              activeTab === 'BROKER' ? brokerData :
              activeTab === 'AGENCY' ? agencyData :
              activeTab === 'AREA' ? areaData :
              activeTab === 'GRADE' ? gradeData :
              activeTab === 'SUPPLIER' ? supplierData : monthData
            );
            const totalcurrentData = rawCurrentData.filter(item => item.dealCount > 0);
            const currentData = activeTab === 'MONTH' ? [...totalcurrentData].sort((a, b) => { const [yearA, monthA] = String(a.key).split('-').map(Number); const [yearB, monthB] = String(b.key).split('-').map(Number); return ( new Date(yearB, monthB - 1).getTime() - new Date(yearA, monthA - 1).getTime() ); }) : totalcurrentData;

            if (subAnalysisMode === 'VOLUME') {
              if (activeTab === 'MONTH') {
                return (
                  <div className="space-y-4">
                    {/* Month Summary Cards for Sauda Check Point + Final P.O */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-300 rounded-xl shadow-xs">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                          <span>🟢</span> 1. Sauda Check Point Section (Month Wise Total)
                        </span>
                        <div className="mt-2.5 grid grid-cols-3 gap-2 font-mono text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Total Deals</span>
                            <strong className="text-slate-900 font-bold text-sm">{monthData.reduce((acc, m) => acc + m.dealCount, 0)} Deals</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Contract Weight</span>
                            <strong className="text-emerald-900 font-bold text-sm">{monthData.reduce((acc, m) => acc + m.quantityMT, 0).toFixed(2)} MT</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Sauda Value</span>
                            <strong className="text-slate-900 font-bold text-sm">{formatIndianCurrency(monthData.reduce((acc, m) => acc + m.grossValue, 0))}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="p-3.5 bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-300 rounded-xl shadow-xs">
                        <span className="text-xs font-black uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                          <span>📄</span> 2. Final P.O Section (Month Wise Total)
                        </span>
                        <div className="mt-2.5 grid grid-cols-3 gap-2 font-mono text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Total Final POs</span>
                            <strong className="text-slate-900 font-bold text-sm">{monthData.reduce((acc, m) => acc + m.poCount, 0)} POs</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">PO Weight</span>
                            <strong className="text-blue-900 font-bold text-sm">{monthData.reduce((acc, m) => acc + m.poQuantityMT, 0).toFixed(2)} MT</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">PO Value</span>
                            <strong className="text-slate-900 font-bold text-sm">{formatIndianCurrency(monthData.reduce((acc, m) => acc + m.poGrossValue, 0))}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Integrated Both Section Month Wise Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-wider">
                            <th className="p-3 border-r border-slate-800" rowSpan={2}>Month</th>
                            <th className="p-2 text-center bg-emerald-950 text-emerald-200 border-r border-emerald-900" colSpan={4}>
                              🟢 SAUDA CHECK POINT SECTION
                            </th>
                            <th className="p-2 text-center bg-blue-950 text-blue-200" colSpan={5}>
                              📄 FINAL P.O SECTION
                            </th>
                          </tr>
                          <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b">
                            <th className="p-2.5 text-center bg-emerald-50">Contract Sauda</th>
                            <th className="p-2.5 text-right bg-emerald-50">Contract Wt (MT)</th>
                            <th className="p-2.5 text-right bg-emerald-50">Avg Rate (₹)</th>
                            <th className="p-2.5 text-right bg-emerald-50 border-r border-slate-200">Sauda Value</th>
                            
                            <th className="p-2.5 text-center bg-blue-50">Final POs</th>
                            <th className="p-2.5 text-right bg-blue-50">PO Weight (MT)</th>
                            <th className="p-2.5 text-right bg-blue-50">Arrived Wt (MT)</th>
                            <th className="p-2.5 text-right bg-blue-50">Paid Amount</th>
                            <th className="p-2.5 text-right bg-blue-50 text-rose-800">Pending Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium font-mono text-[11px]">
                          {currentData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition">
                              <td className="p-2.5 font-bold text-slate-900 font-sans border-r border-slate-200 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center font-bold">
                                  {idx + 1}
                                </span>
                                <span>{row.key}</span>
                              </td>
                              {/* Sauda Check Point */}
                              <td className="p-2.5 text-center font-bold text-emerald-900 bg-emerald-50/30">{row.dealCount}</td>
                              <td className="p-2.5 text-right font-bold text-emerald-950 bg-emerald-50/30">{row.quantityMT.toFixed(2)} MT</td>
                              <td className="p-2.5 text-right text-slate-800 bg-emerald-50/30">₹{Math.round(row.avgRate).toLocaleString()}</td>
                              <td className="p-2.5 text-right font-bold text-slate-900 bg-emerald-50/30 border-r border-slate-200">{formatIndianCurrency(row.grossValue)}</td>

                              {/* Final PO */}
                              <td className="p-2.5 text-center font-bold text-blue-900 bg-blue-50/30">{row.poCount}</td>
                              <td className="p-2.5 text-right font-bold text-blue-950 bg-blue-50/30">{row.poQuantityMT.toFixed(2)} MT</td>
                              <td className="p-2.5 text-right text-slate-700 bg-blue-50/30">{row.arrivedMT.toFixed(2)} MT</td>
                              <td className="p-2.5 text-right font-bold text-emerald-800 bg-blue-50/30">{formatIndianCurrency(row.paidAmount)}</td>
                              <td className="p-2.5 text-right font-bold text-rose-800 bg-blue-50/30">{formatIndianCurrency(row.pendingPayable)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b">
                        <th className="p-3">
                          {activeTab === 'BROKER' ? 'Broker Name' : 
                           activeTab === 'SUPPLIER' ? 'Supplier Name' : 
                           activeTab === 'AGENCY' ? 'Agency Name' : 
                           activeTab === 'AREA' ? 'Area Name' : 
                           activeTab === 'GRADE' ? 'Grade Name' : 
                           'Broker Name'}
                        </th>
                        <th className="p-3 text-center">Contract Sauda</th>
                        <th className="p-3 text-right">Contract MT</th>
                        <th className="p-3 text-right">Arrived Weight (MT)</th>
                        <th className="p-3 text-right">Avg Rate (₹/Qtl)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                    {[...currentData]
                        .sort((a, b) => {
                          const [yearA, monthA] = String(a.key).split("-").map(Number);
                          const [yearB, monthB] = String(b.key).split("-").map(Number);

                          return (
                            new Date(yearB, monthB - 1).getTime() -
                            new Date(yearA, monthA - 1).getTime()
                          );
                        })
                        .map((row, idx) => (
                          <tr
                            key={idx}
                            onClick={() => {
                              if (activeTab === 'BROKER') {
                                setSelectedBrokerModalBroker(row.key);
                              }
                            }}
                            className={`transition ${activeTab === 'BROKER' ? 'hover:bg-emerald-50/60 cursor-pointer' : 'hover:bg-slate-50'}`}
                          >
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
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                        <td className="p-3">Total / Summary ({currentData.length} Entities)</td>
                        <td className="p-3 text-center font-mono">{currentData.reduce((acc, r) => acc + r.dealCount, 0)}</td>
                        <td className="p-3 text-right font-mono text-emerald-950">{currentData.reduce((acc, r) => acc + r.quantityMT, 0).toFixed(2)} MT</td>
                        <td className="p-3 text-right font-mono text-slate-700">{currentData.reduce((acc, r) => acc + r.arrivedMT, 0).toFixed(2)} MT</td>
                        <td className="p-3 text-right font-mono text-slate-800">
                          ₹{currentData.length > 0 ? Math.round(currentData.reduce((acc, r) => acc + (r.avgRate * r.quantityMT), 0) / (currentData.reduce((acc, r) => acc + r.quantityMT, 0) || 1)).toLocaleString() : 0}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            }

            if (subAnalysisMode === 'DEDUCTION') {
              // Ensure brokers with settlement deduction records are included even if zero active Saudas
              const deductionRows = activeTab === 'BROKER'
                ? rawCurrentData.filter(row => {
                    const sett = dataset.brokerSettlementMap?.[row.key.toUpperCase()];
                    return row.dealCount > 0 || (sett && (sett.allDeductionValue > 0 || sett.details?.length > 0));
                  }).sort((a, b) => {
                    const settA = dataset.brokerSettlementMap?.[a.key.toUpperCase()];
                    const settB = dataset.brokerSettlementMap?.[b.key.toUpperCase()];
                    const dedA = settA?.allDeductionValue || a.deductionAmount || 0;
                    const dedB = settB?.allDeductionValue || b.deductionAmount || 0;
                    return dedB - dedA;
                  })
                : currentData;

              return (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs bg-white">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b">
                          <th className="p-3">
                            {activeTab === 'BROKER' ? 'Broker Name' : 
                             activeTab === 'SUPPLIER' ? 'Supplier Name' : 
                             activeTab === 'AGENCY' ? 'Agency Name' : 
                             activeTab === 'AREA' ? 'Area Name' : 
                             activeTab === 'GRADE' ? 'Grade Name' : 
                             'Broker Name'}
                          </th>
                          <th className="p-3 text-center">Contract Sauda</th>
                          <th className="p-3 text-right">Contract MT</th>
                          <th className="p-3 text-right" title="Moisture Sett (%) - Average of claim_moisture (>0) from material_inspection: SUM / COUNT(>0)">Moisture Sett (%)</th>
                          <th className="p-3 text-right" title="Dust Sett (%) - Average of claim_dust (>0) from material_inspection: SUM / COUNT(>0)">Dust Sett (%)</th>
                          <th className="p-3 text-right" title="Gradedown Sett (%) - Average of claim_grade_down (>0) from material_inspection: SUM / COUNT(>0)">Gradedown Sett (%)</th>
                          <th className="p-3 text-right" title="Shortage/Excess Deduction calculated in Amount (₹)">Short / Excess (₹)</th>
                          <th className="p-3 text-left" title="Specific Deduction Types applied (e.g. Katta, Bardan, Quality, etc.)">Deduction Type</th>
                          <th className="p-3 text-right" title="Explicit Deduction Amount in Rupees">Deduction Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium font-mono">
                        {deductionRows.map((row, idx) => {
                          const settInfo = dataset.brokerSettlementMap?.[row.key.toUpperCase()] || {
                            moistureClaim: 0,
                            moistureSett: 0,
                            dustClaim: 0,
                            dustSett: 0,
                            gradedownClaim: 0,
                            gradedownSett: 0,
                            moistCount: 0,
                            dustCount: 0,
                            gdCount: 0,
                            shortExcess: 0,
                            otherDeductionAmount: 0,
                            deductionTypes: [],
                            allDeductionValue: row.deductionAmount,
                            inspMoistSum: 0,
                            inspMoistCount: 0,
                            inspDustSum: 0,
                            inspDustCount: 0,
                            inspGdSum: 0,
                            inspGdCount: 0,
                            moistureSettAvg: 0,
                            dustSettAvg: 0,
                            gradedownSettAvg: 0,
                            details: []
                          };

                          // Average of non-zero values: SUM(field_value) / COUNT(rows where field_value > 0)
                          // Strictly ignore and exclude rows where value is 0
                          const moistAvg = (settInfo.inspMoistCount && settInfo.inspMoistCount > 0)
                            ? (settInfo.inspMoistSum! / settInfo.inspMoistCount!)
                            : (settInfo.moistureSettAvg || 0);

                          const dustAvg = (settInfo.inspDustCount && settInfo.inspDustCount > 0)
                            ? (settInfo.inspDustSum! / settInfo.inspDustCount!)
                            : (settInfo.dustSettAvg || 0);

                          const gdAvg = (settInfo.inspGdCount && settInfo.inspGdCount > 0)
                            ? (settInfo.inspGdSum! / settInfo.inspGdCount!)
                            : (settInfo.gradedownSettAvg || 0);

                          const moistVal = moistAvg > 0 ? `${moistAvg.toFixed(2)}%` : '—';
                          const dustVal = dustAvg > 0 ? `${dustAvg.toFixed(2)}%` : '—';
                          const gdVal = gdAvg > 0 ? `${gdAvg.toFixed(2)}%` : '—';

                          const shortExcessVal = settInfo.shortExcess !== 0
                            ? `₹${Math.round(settInfo.shortExcess).toLocaleString()}`
                            : '—';

                          const dedAmountVal = (settInfo.otherDeductionAmount || 0) > 0
                            ? `₹${Math.round(settInfo.otherDeductionAmount || 0).toLocaleString()}`
                            : '—';

                          return (
                            <tr
                              key={idx}
                              onClick={() => {
                                if (activeTab === 'BROKER') {
                                  setSelectedBrokerModalBroker(row.key);
                                }
                              }}
                              className={`transition ${activeTab === 'BROKER' ? 'hover:bg-emerald-50/70 cursor-pointer' : 'hover:bg-slate-50'}`}
                            >
                              <td className="p-3 font-bold text-slate-900 font-sans flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono flex items-center justify-center font-bold">
                                  {idx + 1}
                                </span>
                                <span>{row.key}</span>
                              </td>
                              <td className="p-3 text-center font-bold text-slate-700">{row.dealCount}</td>
                              <td className="p-3 text-right font-bold text-emerald-950">{row.quantityMT.toFixed(2)} MT</td>
                              <td className="p-3 text-right text-slate-700 font-mono font-semibold">{moistVal}</td>
                              <td className="p-3 text-right text-slate-700 font-mono font-semibold">{dustVal}</td>
                              <td className="p-3 text-right text-slate-700 font-mono font-semibold">{gdVal}</td>
                              <td className="p-3 text-right text-slate-700 font-mono">{shortExcessVal}</td>
                              <td className="p-3 text-left font-sans text-slate-700">
                                {settInfo.deductionTypes && settInfo.deductionTypes.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {settInfo.deductionTypes.map((dt, dIdx) => (
                                      <span key={dIdx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                                        {dt}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono font-semibold text-slate-800">{dedAmountVal}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                          <td className="p-3 font-sans">Total / Summary ({deductionRows.length} Entities)</td>
                          <td className="p-3 text-center font-mono">{deductionRows.reduce((acc, r) => acc + r.dealCount, 0)}</td>
                          <td className="p-3 text-right font-mono text-emerald-950">{deductionRows.reduce((acc, r) => acc + r.quantityMT, 0).toFixed(2)} MT</td>
                          <td className="p-3 text-right font-mono text-slate-800">
                            {(() => {
                              let totalSum = 0;
                              let totalCount = 0;
                              deductionRows.forEach(r => {
                                const s = dataset.brokerSettlementMap?.[r.key.toUpperCase()];
                                if (s && s.inspMoistCount && s.inspMoistCount > 0) {
                                  totalSum += s.inspMoistSum || 0;
                                  totalCount += s.inspMoistCount;
                                }
                              });
                              if (totalCount === 0) return '—';
                              return `${(totalSum / totalCount).toFixed(2)}%`;
                            })()}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-800">
                            {(() => {
                              let totalSum = 0;
                              let totalCount = 0;
                              deductionRows.forEach(r => {
                                const s = dataset.brokerSettlementMap?.[r.key.toUpperCase()];
                                if (s && s.inspDustCount && s.inspDustCount > 0) {
                                  totalSum += s.inspDustSum || 0;
                                  totalCount += s.inspDustCount;
                                }
                              });
                              if (totalCount === 0) return '—';
                              return `${(totalSum / totalCount).toFixed(2)}%`;
                            })()}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-800">
                            {(() => {
                              let totalSum = 0;
                              let totalCount = 0;
                              deductionRows.forEach(r => {
                                const s = dataset.brokerSettlementMap?.[r.key.toUpperCase()];
                                if (s && s.inspGdCount && s.inspGdCount > 0) {
                                  totalSum += s.inspGdSum || 0;
                                  totalCount += s.inspGdCount;
                                }
                              });
                              if (totalCount === 0) return '—';
                              return `${(totalSum / totalCount).toFixed(2)}%`;
                            })()}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-800">
                            ₹{Math.round(deductionRows.reduce((acc, r) => {
                              const sett = dataset.brokerSettlementMap?.[r.key.toUpperCase()];
                              return acc + (sett?.shortExcess || 0);
                            }, 0)).toLocaleString()}
                          </td>
                          <td className="p-3 text-left font-mono text-slate-500">—</td>
                          <td className="p-3 text-right font-mono text-slate-800">
                            ₹{Math.round(deductionRows.reduce((acc, r) => {
                              const sett = dataset.brokerSettlementMap?.[r.key.toUpperCase()];
                              return acc + (sett?.otherDeductionAmount || 0);
                            }, 0)).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
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
                        {/* <th className="p-3 text-right">Avg Premium Rate (₹/Qtl)</th> */}
                       {/*  <th className="p-3 text-center">Premium Status</th> */}
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
                            {/* <td className="p-3 text-right font-mono font-bold text-slate-800">
                              ₹{premRate.toFixed(2)}
                            </td> */}
                            {/* <td className="p-3 text-center">
                              {row.premiumAmount > 0 ? (
                                <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  🌟 Premium Granted
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  Standard Base Rate
                                </span>
                              )}
                            </td> */}
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
                      <p className="text-[10px] text-emerald-700 mt-1">High business volume, prompt delivery, and zero quality issues.</p>
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
                      <p className="text-[10px] text-rose-700 mt-1">Low volume, high deduction claims, or quality issues.</p>
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
              {/* <p className="text-xs text-slate-500 mt-0.5">
                Moisture claims, Grade Down demotions, quality penalties, and claim settlements across suppliers and brokers.
              </p> */}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
              <span className="text-xs font-bold text-rose-900 uppercase block">Total Quality Deductions</span>
              <strong className="text-2xl font-black text-rose-950 font-mono block mt-1">
                {formatIndianCurrency(metrics.totalDeduction)}
              </strong>
              {/* <span className="text-[10px] text-rose-700 mt-1 block">Moisture + Grade Down + Short Weight</span> */}
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <span className="text-xs font-bold text-emerald-900 uppercase block">Total Premium Paid</span>
              <strong className="text-2xl font-black text-emerald-950 font-mono block mt-1">
                {formatIndianCurrency(metrics.totalPremium)}
              </strong>
              {/* <span className="text-[10px] text-emerald-700 mt-1 block">Premium allowed for superior quality / agency</span> */}
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <span className="text-xs font-bold text-amber-900 uppercase block">Abnormal / Flagged Transactions</span>
              <strong className="text-2xl font-black text-amber-950 font-mono block mt-1">
                {metrics.abnormalCount} Deals
              </strong>
              {/* <span className="text-[10px] text-amber-700 mt-1 block">High Moisture, High Deduction, or Quality Exception</span> */}
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
                    <th className="p-2.5 text-right">Total Value</th>
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
              {/* <p className="text-xs text-slate-500 mt-0.5">
                Sauda Check Point $\to$ Temporary Arrival $\to$ Final Arrival $\to$ Mill Inspection $\to$ Payment $\to$ Settlement
              </p> */}
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
      {activeTab === 'ALLSAUDA' && (
       <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-700" />
              All Sauda ({filteredSaudaList.length})
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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
            {/* Month Wise Filter */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold">
              <Calendar className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-slate-600 text-[11px] whitespace-nowrap">Month:</span>
              <select
                value={selectedMonth}
                onChange={e => { setSelectedMonth(e.target.value); setAllSaudaPage(1); }}
                className="bg-transparent font-bold text-slate-900 text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Months</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            {(searchQuery || selectedMonth !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedMonth('ALL');
                }}
                className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
              >
                Clear Filters
              </button>
            )}

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-wider border-b border-slate-800 select-none">
                <th className="p-3 cursor-pointer hover:bg-slate-800 transition" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1.5">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:bg-slate-800 transition" onClick={() => handleSort('saudaNo')}>
                  <div className="flex items-center gap-1.5">
                    <span>Sauda / PO No.</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:bg-slate-800 transition" onClick={() => handleSort('supplier')}>
                  <div className="flex items-center gap-1.5">
                    <span>Party / Supplier</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:bg-slate-800 transition" onClick={() => handleSort('broker')}>
                  <div className="flex items-center gap-1.5">
                    <span>Broker</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3 text-right cursor-pointer hover:bg-slate-800 transition" onClick={() => handleSort('quantityMT')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Weight (MT)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredSaudaList.length > 0 ? (
                filteredSaudaList
                  .slice((allSaudaPage - 1) * allSaudaPageSize, allSaudaPage * allSaudaPageSize)
                  .map((t, idx) => {
                    const saudaPoDisplay = t.saudaNo && t.poNo && t.saudaNo !== t.poNo
                      ? `${t.saudaNo} / ${t.poNo}`
                      : (t.saudaNo || t.poNo || '-');

                    return (
                      <tr
                        key={t.id || t.poNo || t.saudaNo || idx}
                        className="hover:bg-slate-50 transition"
                      >
                        <td className="p-3 text-slate-700 font-mono text-[11px] whitespace-nowrap">
                          {t.date || '-'}
                        </td>

                        <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {saudaPoDisplay}
                        </td>

                        <td className="p-3 font-bold text-slate-900 max-w-[220px] truncate" title={t.supplier || 'Unassigned'}>
                          {t.supplier || 'Unassigned'}
                        </td>

                        <td className="p-3 text-slate-700 font-semibold max-w-[180px] truncate" title={t.broker || 'Direct'}>
                          {t.broker || 'Direct'}
                        </td>

                        <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {Number(t.quantityMT || 0).toFixed(2)} MT
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400 space-y-2">
                    <XCircle className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="font-bold text-slate-700 text-sm">No Sauda Records Found</div>
                    <p className="text-xs text-slate-500">
                      Try clearing search filters or selecting a different month.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {filteredSaudaList.length > 0 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs font-sans rounded-b-2xl">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Rows per page:</span>
              <select
                value={allSaudaPageSize}
                onChange={e => { setAllSaudaPageSize(Number(e.target.value)); setAllSaudaPage(1); }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
              <span className="text-slate-500 ml-2 font-medium">
                Showing {(allSaudaPage - 1) * allSaudaPageSize + 1} to {Math.min(allSaudaPage * allSaudaPageSize, filteredSaudaList.length)} of {filteredSaudaList.length} records
              </span>
            </div>

            <div className="flex items-center gap-1 font-bold">
              <button
                disabled={allSaudaPage === 1}
                onClick={() => setAllSaudaPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer"
              >
                Prev
              </button>
              <span className="px-2 font-mono">Page {allSaudaPage} of {Math.ceil(filteredSaudaList.length / allSaudaPageSize) || 1}</span>
              <button
                disabled={allSaudaPage >= Math.ceil(filteredSaudaList.length / allSaudaPageSize)}
                onClick={() => setAllSaudaPage(prev => Math.min(Math.ceil(filteredSaudaList.length / allSaudaPageSize), prev + 1))}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      )}
      <SimpleDealSlipModal
        transaction={selectedTxn}
        onClose={() => setSelectedTxn(null)}
      />

      {/* BROKER WISE FULL SCREEN DETAILS POPUP */}
      {selectedBrokerModalBroker && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col p-3 md:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div>
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold block">Broker Wise Sauda Details Report</span>
                <h2 className="text-lg font-black tracking-wide flex items-center gap-2 mt-0.5">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <span>Broker: {selectedBrokerModalBroker}</span>
                </h2>
              </div>
              <button
                onClick={() => setSelectedBrokerModalBroker(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                title="Close Full-Screen View"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body / Table */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b">
                      <th className="p-3.5 w-14 text-center">#</th>
                      <th className="p-3.5">Broker</th>
                      <th className="p-3.5">MR No</th>
                      <th className="p-3.5">PO No</th>
                      <th className="p-3.5 text-right" title="Moisture Sett (%) - claim_moisture from material_inspection">Moisture Sett (%)</th>
                      <th className="p-3.5 text-right" title="Dust Sett (%) - claim_dust from material_inspection">Dust Sett (%)</th>
                      <th className="p-3.5 text-right" title="Gradedown Sett (%) - claim_grade_down from material_inspection">Gradedown Sett (%)</th>
                      <th className="p-3.5 text-right" title="Weight Shortage/Excess in Rupees">Short / Excess (₹)</th>
                      <th className="p-3.5">Vehicle / Lorry No</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium font-mono text-[11px]">
                    {(() => {
                      const target = selectedBrokerModalBroker.trim().toUpperCase();
                      const settInfo = dataset.brokerSettlementMap?.[target];
                      const details = settInfo?.details || [];

                      if (details.length > 0) {
                        return details.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-3.5 text-center font-bold text-slate-500">{idx + 1}</td>
                            <td className="p-3.5 font-bold text-slate-900 font-sans">{item.broker || selectedBrokerModalBroker}</td>
                            <td className="p-3.5 font-bold text-slate-800">{item.mr_no || '—'}</td>
                            <td className="p-3.5 font-bold text-slate-800">{item.po_no || '—'}</td>
                            <td className="p-3.5 text-right text-slate-700 font-semibold font-mono">
                              {formatSettVal(item.moist_sett, item.moist_claim)}
                            </td>
                            <td className="p-3.5 text-right text-slate-700 font-semibold font-mono">
                              {formatSettVal(item.dust_sett, item.dust_claim)}
                            </td>
                            <td className="p-3.5 text-right text-slate-700 font-semibold font-mono">
                              {formatSettVal(item.gd_sett, item.gd_claim)}
                            </td>
                            <td className="p-3.5 text-right text-slate-700 font-mono">{item.val_ex_short ? `₹${Number(item.val_ex_short).toLocaleString()}` : '—'}</td>
                            <td className="p-3.5 text-slate-800">{item.lorry_number || '—'}</td>
                          </tr>
                        ));
                      }

                      // Fallback to matched transactions
                      const matchedTxns = transactions.filter(t => (t.broker || 'Direct').trim().toLowerCase() === selectedBrokerModalBroker.trim().toLowerCase());
                      if (matchedTxns.length > 0) {
                        return matchedTxns.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-3.5 text-center font-bold text-slate-500">{idx + 1}</td>
                            <td className="p-3.5 font-bold text-slate-900 font-sans">{item.broker || selectedBrokerModalBroker}</td>
                            <td className="p-3.5 text-slate-800">{item.mrNo || '—'}</td>
                            <td className="p-3.5 text-slate-800">{item.poNo || '—'}</td>
                            <td className="p-3.5 text-right text-slate-700 font-mono">{item.moisturePct ? `${Number(item.moisturePct).toFixed(2)}%` : '—'}</td>
                            <td className="p-3.5 text-right text-slate-700 font-mono">—</td>
                            <td className="p-3.5 text-right text-slate-700 font-mono">—</td>
                            <td className="p-3.5 text-right text-slate-700 font-mono">—</td>
                            <td className="p-3.5 text-slate-800">—</td>
                          </tr>
                        ));
                      }

                      return (
                        <tr>
                          <td colSpan={9} className="p-12 text-center text-slate-400">
                            No settlement or Sauda records found for broker {selectedBrokerModalBroker}.
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                  {(() => {
                    const target = selectedBrokerModalBroker.trim().toUpperCase();
                    const settInfo = dataset.brokerSettlementMap?.[target];
                    const details = settInfo?.details || [];
                    if (details.length === 0) return null;

                    const moistRows = details.filter((d: any) => Number(d.moist_sett || d.moist_claim || 0) > 0);
                    const dustRows = details.filter((d: any) => Number(d.dust_sett || d.dust_claim || 0) > 0);
                    const gdRows = details.filter((d: any) => Number(d.gd_sett || d.gd_claim || 0) > 0);
                    const totalShort = details.reduce((acc: number, d: any) => acc + Number(d.val_ex_short || 0), 0);

                    const moistAvgStr = moistRows.length > 0
                      ? `${(moistRows.reduce((acc: number, d: any) => acc + Number(d.moist_sett || d.moist_claim || 0), 0) / moistRows.length).toFixed(2)}%`
                      : '—';
                    const dustAvgStr = dustRows.length > 0
                      ? `${(dustRows.reduce((acc: number, d: any) => acc + Number(d.dust_sett || d.dust_claim || 0), 0) / dustRows.length).toFixed(2)}%`
                      : '—';
                    const gdAvgStr = gdRows.length > 0
                      ? `${(gdRows.reduce((acc: number, d: any) => acc + Number(d.gd_sett || d.gd_claim || 0), 0) / gdRows.length).toFixed(2)}%`
                      : '—';

                    return (
                      <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 text-[11px]">
                          <td className="p-3.5 text-center font-mono">Total</td>
                          <td className="p-3.5 font-sans" colSpan={3}>Average of Non-Zero ({details.length} Records)</td>
                          <td className="p-3.5 text-right font-mono text-slate-800">{moistAvgStr}</td>
                          <td className="p-3.5 text-right font-mono text-slate-800">{dustAvgStr}</td>
                          <td className="p-3.5 text-right font-mono text-slate-800">{gdAvgStr}</td>
                          <td className="p-3.5 text-right font-mono text-slate-800">{totalShort !== 0 ? `₹${Math.round(totalShort).toLocaleString()}` : '—'}</td>
                          <td className="p-3.5 text-slate-400">—</td>
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-white px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Showing all Sauda records for broker: <strong>{selectedBrokerModalBroker}</strong></span>
              <button
                onClick={() => setSelectedBrokerModalBroker(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
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
