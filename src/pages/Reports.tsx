import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  Percent,
  Scissors,
  Truck,
  Award,
  AlertTriangle,
  PieChart,
  FileSpreadsheet,
  RefreshCcw,
  Download,
  Printer,
  Clock
} from 'lucide-react';
import LegacyLayout from '../components/LegacyLayout';
import {
  loadAndProcessSystemReportData,
  calculateReportMetrics,
  ReportFilterCriteria,
  ReportTransactionLine,
  SystemReportDataset
} from '../services/systemReportEngine';

import { ReportFilterBar } from '../components/system-reports/ReportFilterBar';
import { Priority1Dashboard } from '../components/system-reports/Priority1Dashboard';
import { Priority2Analysis } from '../components/system-reports/Priority2Analysis';
import { Priority3Operations } from '../components/system-reports/Priority3Operations';
import { Priority4Detailed } from '../components/system-reports/Priority4Detailed';
import { ExceptionAuditView } from '../components/system-reports/ExceptionAuditView';
import { ContributionView } from '../components/system-reports/ContributionView';
import { TableInactivityReport } from '../components/system-reports/TableInactivityReport';
import { DrillDownModal, DrillDownViewMode } from '../components/system-reports/DrillDownModal';
import { SimpleReportView } from '../components/system-reports/SimpleReportView';

export type ReportNavSection = 
  | 'dashboard'
  | 'business_analysis'
  | 'premium_analysis'
  | 'deduction_claim'
  | 'sauda_checkpoints'
  | 'performance_ranking'
  | 'exception_abnormal'
  | 'business_contribution'
  | 'detailed_reports'
  | 'inactivity';

interface ReportsProps {
  onClose?: () => void;
  initialReportType?: string;
}

export default function Reports({ onClose }: ReportsProps) {
  const [viewMode, setViewMode] = useState<'simple' | 'management'>('simple');
  const [activeSection, setActiveSection] = useState<ReportNavSection>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);
  
  // Master transactions and filters
  const [allTransactions, setAllTransactions] = useState<ReportTransactionLine[]>([]);
  const [masterLists, setMasterLists] = useState<SystemReportDataset['masterLists']>({
    brokers: [],
    suppliers: [],
    agencies: [],
    areas: [],
    grades: [],
    months: [],
    financialYears: [],
    saudas: [],
    pos: []
  });

  const [filters, setFilters] = useState<ReportFilterCriteria>({});

  // Drill-down Modal State
  const [drillDownInfo, setDrillDownInfo] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    transactions: ReportTransactionLine[];
    viewMode?: DrillDownViewMode;
  }>({
    isOpen: false,
    title: '',
    transactions: [],
    viewMode: 'transactions'
  });

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const { allTransactions: txns, masterLists: lists } = await loadAndProcessSystemReportData();
      setAllTransactions(txns);
      setMasterLists(lists);
    } catch (err) {
      console.error('Error loading system report dataset:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter transactions dynamically
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const match = 
          t.saudaNo.toLowerCase().includes(q) ||
          t.poNo.toLowerCase().includes(q) ||
          t.supplier.toLowerCase().includes(q) ||
          t.broker.toLowerCase().includes(q) ||
          t.area.toLowerCase().includes(q) ||
          t.grade.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (filters.financialYear && t.financialYear !== filters.financialYear) return false;
      if (filters.month && t.month !== filters.month) return false;
      if (filters.broker && t.broker !== filters.broker) return false;
      if (filters.supplier && t.supplier !== filters.supplier) return false;
      if (filters.agency && t.agency !== filters.agency) return false;
      if (filters.area && t.area !== filters.area) return false;
      if (filters.grade && t.grade !== filters.grade) return false;
      if (filters.saudaStatus && t.saudaStatus !== filters.saudaStatus) return false;

      if (filters.dateFrom) {
        if (new Date(t.date) < new Date(filters.dateFrom)) return false;
      }
      if (filters.dateTo) {
        if (new Date(t.date) > new Date(filters.dateTo + 'T23:59:59')) return false;
      }

      return true;
    });
  }, [allTransactions, filters]);

  // Aggregated Metrics
  const metrics = useMemo(() => {
    return calculateReportMetrics(filteredTransactions);
  }, [filteredTransactions]);

  const dataset: SystemReportDataset = {
    transactions: allTransactions,
    filtered: filteredTransactions,
    masterLists,
    metrics
  };

  const handleOpenDrillDown = (title: string, txns: ReportTransactionLine[], viewMode?: DrillDownViewMode) => {
    setDrillDownInfo({
      isOpen: true,
      title,
      subtitle: `Viewing underlying records (Filtered)`,
      transactions: txns,
      viewMode: viewMode || 'transactions'
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!filteredTransactions.length) return;
    const headers = [
      'Txn ID', 'Date', 'Sauda No', 'PO No', 'Supplier', 'Broker', 'Agency', 'Area', 'Grade',
      'Qty (MT)', 'Purchase Rate', 'Base Rate', 'Gross Value', 'Premium', 'Deductions', 'Effective Cost'
    ];
    const rows = filteredTransactions.map(t => [
      t.txnId, t.date, t.saudaNo, t.poNo, `"${t.supplier}"`, `"${t.broker}"`, `"${t.agency}"`, `"${t.area}"`, t.grade,
      t.quantityMT, t.purchaseRate, t.baseRate, t.grossPurchaseValue, t.premiumAmount, t.deductionAmount, t.effectiveCost
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `system_report_${activeSection}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <LegacyLayout title="Report" onClose={onClose}>
      <div className="space-y-4 font-sans text-slate-800">
        
        {/* ================= HEADER BAR ================= */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-green-950 text-white p-4 rounded-2xl shadow-md border border-emerald-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl">📊</span>
              <h2 className="text-lg font-black uppercase tracking-wider text-yellow-300">
                Report
              </h2>
            </div>
            {/* {viewMode === 'simple' && (
              <p className="text-xs text-emerald-100/90 mt-1">
                Executive Procurement Summary — Total Deals, Arrival Progress, and Payment Status
              </p>
            )} */}
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {/* Mode Switcher Toggle */}
            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 text-xs font-black">
              <button
                onClick={() => setViewMode('simple')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'simple'
                    ? 'bg-yellow-400 text-slate-950 shadow-md font-black'
                    : 'text-emerald-100 hover:text-white'
                }`}
              >
                <span>Summary</span>
              </button>
              <button
                onClick={() => setViewMode('management')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'management'
                    ? 'bg-yellow-400 text-slate-950 shadow-md font-black'
                    : 'text-emerald-100 hover:text-white'
                }`}
              >
                <span>Analysis</span>
              </button>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl border border-emerald-600 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Reload database"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-yellow-400 hover:bg-yellow-300 text-emerald-950 text-xs font-black rounded-xl border border-yellow-200 transition flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* ================= VIEW MODE CONDITIONAL RENDERING ================= */}
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-400 space-y-3 shadow-xs">
            <RefreshCcw className="w-9 h-9 animate-spin text-emerald-600 mx-auto" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Loading Records...
            </h3>
            {/* <span className="text-xs text-slate-500 block">
              sauda_master, purchase_master, final_arrival, material_inspection, payment_master
            </span> */}
          </div>
        ) : viewMode === 'simple' ? (
          /* SIMPLE VIEW FOR UNDER-LEVEL USER */
          <SimpleReportView
            dataset={dataset}
            onOpenManagementView={() => setViewMode('management')}
          />
        ) : (
          /* MANAGEMENT ANALYSIS (PRIORITY 1 TO 4) */
          <div className="space-y-4">
            {/* SECTION 18: REPORT NAVIGATION STRUCTURE */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-inner">
              {[
                { id: 'dashboard' as const, label: '1. Dashboard', icon: LayoutDashboard, badge: 'Priority 1' },
                { id: 'business_analysis' as const, label: '2. Business Analysis', icon: BarChart3, badge: 'P2' },
                { id: 'premium_analysis' as const, label: '3. Premium Analysis', icon: Percent, badge: 'P2' },
                { id: 'deduction_claim' as const, label: '4. Deduction & Claim', icon: Scissors, badge: 'P3' },
                { id: 'sauda_checkpoints' as const, label: '5. Checkpoints Pipeline', icon: Truck, badge: 'P3' },
                { id: 'performance_ranking' as const, label: '6. Performance Ranking', icon: Award, badge: 'P2' },
                { id: 'exception_abnormal' as const, label: '7. Exception / Abnormal', icon: AlertTriangle, badge: `${metrics.abnormalCount}` },
                { id: 'business_contribution' as const, label: '8. Contribution & Pareto', icon: PieChart, badge: 'P9' },
                { id: 'detailed_reports' as const, label: '9. Detailed Registers', icon: FileSpreadsheet, badge: 'Grain' },
                { id: 'inactivity' as const, label: '10. Inactivity', icon: Clock, badge: '3 Days' },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSection(tab.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-yellow-400 text-slate-950 font-black shadow-md scale-[1.02]'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                    <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-slate-950 text-yellow-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {tab.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* SECTION 19: STANDARD FILTER BAR */}
            <ReportFilterBar
              filters={filters}
              masterLists={masterLists}
              onFilterChange={setFilters}
              onReset={() => setFilters({})}
              filteredCount={filteredTransactions.length}
              totalCount={allTransactions.length}
            />

            {/* 1. Dashboard (Priority 1) */}
            {activeSection === 'dashboard' && (
              <Priority1Dashboard dataset={dataset} onDrillDown={handleOpenDrillDown} />
            )}

            {/* 2. Business Analysis (Priority 2) */}
            {activeSection === 'business_analysis' && (
              <Priority2Analysis dataset={dataset} onDrillDown={handleOpenDrillDown} defaultSubTab="business" />
            )}

            {/* 3. Premium Analysis (Priority 2) */}
            {activeSection === 'premium_analysis' && (
              <Priority2Analysis dataset={dataset} onDrillDown={handleOpenDrillDown} defaultSubTab="premium" />
            )}

            {/* 5. Deduction & Claim (Priority 3) */}
            {activeSection === 'deduction_claim' && (
              <Priority3Operations dataset={dataset} onDrillDown={handleOpenDrillDown} defaultSubTab="quality" />
            )}

            {/* 6. Sauda / PO Checkpoints (Priority 3) */}
            {activeSection === 'sauda_checkpoints' && (
              <Priority3Operations dataset={dataset} onDrillDown={handleOpenDrillDown} defaultSubTab="pipeline" />
            )}

            {/* 7. Performance Ranking (Priority 2) */}
            {activeSection === 'performance_ranking' && (
              <Priority2Analysis dataset={dataset} onDrillDown={handleOpenDrillDown} defaultSubTab="ranking" />
            )}

            {/* 8. Exception / Abnormal (Priority 1-D / 8) */}
            {activeSection === 'exception_abnormal' && (
              <ExceptionAuditView dataset={dataset} onDrillDown={handleOpenDrillDown} />
            )}

            {/* 9. Business Contribution (Priority 9) */}
            {activeSection === 'business_contribution' && (
              <ContributionView dataset={dataset} onDrillDown={handleOpenDrillDown} />
            )}

            {/* 10. Detailed Reports (Priority 4) */}
            {activeSection === 'detailed_reports' && (
              <Priority4Detailed dataset={dataset} onDrillDown={handleOpenDrillDown} />
            )}

            {/* 11. Table Inactivity Audit (Priority P1-P4) */}
            {activeSection === 'inactivity' && (
              <TableInactivityReport />
            )}

          </div>
        )}

        {/* ================= DRILL-DOWN MODAL ================= */}
        {drillDownInfo.isOpen && (
          <DrillDownModal
            title={drillDownInfo.title}
            subtitle={drillDownInfo.subtitle}
            transactions={drillDownInfo.transactions}
            viewMode={drillDownInfo.viewMode}
            onClose={() => setDrillDownInfo(prev => ({ ...prev, isOpen: false }))}
          />
        )}

      </div>
    </LegacyLayout>
  );
}
