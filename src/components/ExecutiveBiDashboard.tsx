import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  Search, 
  Calendar, 
  Truck, 
  Warehouse, 
  Layers, 
  Droplets, 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  ShieldCheck, 
  BarChart3, 
  FileSpreadsheet, 
  Printer, 
  Factory, 
  Scale, 
  Coins, 
  Users, 
  ChevronDown,
  ChevronUp,
  Activity,
  Award,
  Clock,
  Briefcase,
  Lock,
  Wallet,
  Check,
  ChevronRight,
  Filter,
  Eye
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ScatterChart, 
  Scatter, 
  LineChart, 
  Line 
} from 'recharts';
import { cn, formatIndianCurrency } from '../lib/utils';
import { hasModulePermission } from '../lib/permissions';
import { 
  computeDashboardMetrics, 
  computeInspectionMetrics,
  UnifiedContractRecord, 
  MonthSummary,
  InspectionRecord,
  MonthInspectionSummary,
  PendingStageRecord,
  exportPendingPoListCsv
} from '../services/dashboardCalculationService';
import DashboardDrilldownModal from './DashboardDrilldownModal';
import InspectionDrilldownModal, { DrilldownTabType } from './InspectionDrilldownModal';

function safeStr(val: any, fallback = 'N/A'): string {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (typeof val === 'object') {
    if (typeof val.name === 'string') return val.name;
    if (typeof val.supp_name === 'string') return val.supp_name;
    if (typeof val.brok_name === 'string') return val.brok_name;
    if (typeof val.supplier_name === 'string') return val.supplier_name;
    if (typeof val.broker_name === 'string') return val.broker_name;
    if (val.supplier) return safeStr(val.supplier, fallback);
    if (val.broker) return safeStr(val.broker, fallback);
    return fallback;
  }
  return fallback;
}

interface ExecutiveBiDashboardProps {
  arrivals: any[];
  saudas: any[];
  saudaCheckPoints?: any[];
  saudaCheckPointDetails?: any[];
  traders: any[];
  pos: any[];
  settlements: any[];
  godowns: any[];
  openingStocks: any[];
  millIssueMasters?: any[];
  millIssueDetails?: any[];
  finalArrivals: any[];
  paymentRecords: any[];
  paymentDetails?: any[];
  inspections?: any[];
  inspectionDetails?: any[];
  materialInspections?: any[];
  millInspections?: any[];
  loading: boolean;
  onRefresh: () => void;
  onNavigate?: (pageId: string) => void;
  setcurrentTab?: (tab: string) => void;
  currentTab?: string;
  allowedModules?: string[];
  isAdmin?: boolean;
}

export default function ExecutiveBiDashboard({
  arrivals = [],
  saudas = [],
  saudaCheckPoints = [],
  saudaCheckPointDetails = [],
  traders = [],
  pos = [],
  settlements = [],
  godowns = [],
  openingStocks = [],
  millIssueMasters = [],
  millIssueDetails = [],
  finalArrivals = [],
  paymentRecords = [],
  paymentDetails = [],
  inspections = [],
  inspectionDetails = [],
  materialInspections = [],
  millInspections = [],
  loading = false,
  onRefresh,
  onNavigate,
  setcurrentTab,
  currentTab,
  allowedModules,
  isAdmin
}: ExecutiveBiDashboardProps) {

  // Selected Year for Month-Wise Summary Section
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);

  // Drilldown Modal State (Contracts)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalSubtitle, setModalSubtitle] = useState('');
  const [modalContracts, setModalContracts] = useState<UnifiedContractRecord[]>([]);
  const [modalInitialFilter, setModalInitialFilter] = useState('');

  // Drilldown Modal State (Inspections, Moisture, Claims & Pending Pipelines)
  const [inspModalOpen, setInspModalOpen] = useState(false);
  const [inspModalTitle, setInspModalTitle] = useState('');
  const [inspModalSubtitle, setInspModalSubtitle] = useState('');
  const [inspModalRecords, setInspModalRecords] = useState<InspectionRecord[]>([]);
  const [inspModalPayments, setInspModalPayments] = useState<any[]>([]);
  const [inspModalSettlements, setInspModalSettlements] = useState<any[]>([]);
  const [inspModalPendingFmr, setInspModalPendingFmr] = useState<PendingStageRecord[]>([]);
  const [inspModalPendingInsp, setInspModalPendingInsp] = useState<PendingStageRecord[]>([]);
  const [inspModalPendingPaym, setInspModalPendingPaym] = useState<PendingStageRecord[]>([]);
  const [inspModalPendingSett, setInspModalPendingSett] = useState<PendingStageRecord[]>([]);
  const [inspModalAllPending, setInspModalAllPending] = useState<PendingStageRecord[]>([]);
  const [inspModalInitialTab, setInspModalInitialTab] = useState<DrilldownTabType>('pipeline');

  // View Controls
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [collapseMonthSummary, setCollapseMonthSummary] = useState(false);
  const [collapseInspectionSummary, setCollapseInspectionSummary] = useState(false);

  const allPanelsCollapsed = collapseMonthSummary && collapseInspectionSummary;
  const toggleAllPanels = () => {
    const nextState = !allPanelsCollapsed;
    setCollapseMonthSummary(nextState);
    setCollapseInspectionSummary(nextState);
  };

  // 1. Central Single-Source-of-Truth Calculation
  const dbMetrics = useMemo(() => {
    return computeDashboardMetrics({
      saudaCheckPoints,
      saudaCheckPointDetails,
      purchaseOrders: pos,
      temporaryArrivals: arrivals,
      finalArrivals,
      paymentRecords,
      openingStocks,
      millIssueMasters,
      millIssueDetails,
      selectedYear
    });
  }, [
    saudaCheckPoints,
    saudaCheckPointDetails,
    pos,
    arrivals,
    finalArrivals,
    paymentRecords,
    openingStocks,
    millIssueMasters,
    millIssueDetails,
    selectedYear
  ]);

  // If selectedYear is not yet set, default to active year from metrics
  const activeYear = selectedYear || dbMetrics.selectedYear;

  // 2. Inspection, Claim & Moisture Calculations (Month-Wise & Aggregates)
  const inspMetrics = useMemo(() => {
    return computeInspectionMetrics({
      inspections: inspections,
      inspectionDetails,
      materialInspections,
      millInspections,
      arrivals,
      finalArrivals,
      saudaCheckPoints,
      saudaCheckPointDetails,
      paymentRecords,
      paymentDetails,
      pos,
      settlements,
      selectedYear: activeYear
    });
  }, [inspections, inspectionDetails, materialInspections, millInspections, arrivals, finalArrivals, saudaCheckPoints, saudaCheckPointDetails, paymentRecords, paymentDetails, pos, settlements, activeYear]);

  // Handler to open drilldown modal with specific records
  const handleOpenDrilldown = (params: {
    title: string;
    subtitle?: string;
    contracts: UnifiedContractRecord[];
    initialFilter?: string;
  }) => {
    setModalTitle(params.title);
    setModalSubtitle(params.subtitle || '');
    setModalContracts(params.contracts);
    setModalInitialFilter(params.initialFilter || '');
    setModalOpen(true);
  };

  // Handler to open inspection & pending pipeline drilldown modal
  const handleOpenInspectionModal = (params: {
    title: string;
    subtitle?: string;
    inspections?: InspectionRecord[];
    payments?: any[];
    settlements?: any[];
    pendingFmrList?: PendingStageRecord[];
    pendingInspectionList?: PendingStageRecord[];
    pendingPaymentList?: PendingStageRecord[];
    pendingSettlementList?: PendingStageRecord[];
    allPendingPipelineList?: PendingStageRecord[];
    initialTab?: DrilldownTabType;
  }) => {
    setInspModalTitle(params.title);
    setInspModalSubtitle(params.subtitle || '');
    setInspModalRecords(params.inspections || inspMetrics.allInspections || []);
    setInspModalPayments(params.payments || paymentRecords || []);
    setInspModalSettlements(params.settlements || settlements || []);
    setInspModalPendingFmr(params.pendingFmrList || inspMetrics.allYearPendingFmrList || []);
    setInspModalPendingInsp(params.pendingInspectionList || inspMetrics.allYearPendingInspectionList || []);
    setInspModalPendingPaym(params.pendingPaymentList || inspMetrics.allYearPendingPaymentList || []);
    setInspModalPendingSett(params.pendingSettlementList || inspMetrics.allYearPendingSettlementList || []);
    setInspModalAllPending(params.allPendingPipelineList || inspMetrics.allYearPendingPipelineList || []);
    setInspModalInitialTab(params.initialTab || 'pipeline');
    setInspModalOpen(true);
  };

  // Export Inspection CSV
  const handleExportInspectionCsv = () => {
    const headers = [
      "MR No",
      "Date",
      "PO / Contract Ref",
      "Supplier",
      "Broker",
      "Vehicle",
      "Grade",
      "Net Wt (MT)",
      "Actual Moisture %",
      "Claim Moisture %",
      "Actual Dust %",
      "Claim Dust %",
      "Actual Grade Down %",
      "Claim Grade Down %",
      "Chotta & Habi Jabi (Kg)",
      "Premium (Sauda Check Point)",
      "Moisture Claim (INR)",
      "Total Deductions (INR)",
      "Status"
    ];
    const rows = inspMetrics.allInspections.map(r => [
      `"${r.mrNo}"`,
      `"${r.date}"`,
      `"${r.poNo || ''}"`,
      `"${r.supplier.replace(/"/g, '""')}"`,
      `"${r.broker.replace(/"/g, '""')}"`,
      `"${r.vehicleNo}"`,
      `"${r.juteGrade}"`,
      r.weightMt.toFixed(3),
      r.actualMoisture.toFixed(1),
      r.claimMoisture.toFixed(1),
      r.actualDust.toFixed(1),
      r.claimDust.toFixed(1),
      r.actualGradeDown.toFixed(1),
      r.claimGradeDown.toFixed(1),
      r.totalChottaHabijabiKg.toFixed(1),
      `"${r.premium || (r.isPremium ? 'Yes' : 'No')}"`,
      r.moistureDeductionAmount.toFixed(2),
      r.totalClaimAmount.toFixed(2),
      `"${r.status}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Mill_Inspection_Information_Entry_${activeYear}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className={cn(
      "w-full space-y-5 transition-all duration-200 pb-12",
      isFullScreen ? "fixed inset-0 z-50 bg-[#FAF7F0] p-6 overflow-y-auto" : ""
    )}>
      
      {/* 1. EXECUTIVE HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#1E331B] via-[#2A4426] to-[#1E331B] rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-[#D6CAA8] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/10 text-emerald-300">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-black tracking-wide">
              Executive BI Operations Command Center
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleAllPanels}
            className={cn(
              "px-3 py-1.5 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs",
              allPanelsCollapsed 
                ? "bg-amber-400/20 text-amber-300 border-amber-400/40 hover:bg-amber-400/30" 
                : "bg-white/10 hover:bg-white/20 border-white/20 text-white"
            )}
            title={allPanelsCollapsed ? "Expand all granular breakdown panels" : "Collapse all granular breakdown panels (View only KPI Summary Cards)"}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{allPanelsCollapsed ? "Expand All Panels" : "Collapse All Panels"}</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh live data"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
          </button>

          <button
            onClick={handlePrintPdf}
            className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Print Dashboard"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-all shadow-xs cursor-pointer"
            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. TOP EXECUTIVE SUMMARY CARDS (6 COMPACT CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-3.5 w-full min-w-0">
        
        {/* CARD 1: SAUDA CHECK POINT (COMPACT, NO TABS, DIRECT BREAKDOWN) */}
        {(isAdmin || hasModulePermission('po', allowedModules, isAdmin) || hasModulePermission('sauda', allowedModules, isAdmin)) && (
          <div 
            onClick={() => handleOpenDrilldown({
              title: "Sauda Check Point — All Contracts",
              subtitle: `Total ${dbMetrics.totalContractsCount} Combined Contracts (${dbMetrics.totalWeightMt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} MT)`,
              contracts: dbMetrics.allContracts
            })}
            className="bg-white border-2 border-emerald-800/30 hover:border-emerald-700 rounded-xl p-3 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
            title="Click to view full Sauda Check Point & Final P.O breakdown"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1">
                  <span>📦</span> Sauda Check Point
                </span>
                <div className="p-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 group-hover:bg-emerald-200 transition-colors">
                  <Package className="w-3 h-3 text-emerald-800" />
                </div>
              </div>

              {/* Main Total Metrics */}
              <div className="my-1">
                <div className="text-xl font-mono font-extrabold text-[#1E331B] tracking-tight leading-tight">
                  {dbMetrics.totalContractsCount}{' '}
                  <span className="text-xs font-sans font-semibold text-[#5A6E54]">Contracts</span>
                </div>
                <div className="text-xs font-mono font-bold text-emerald-800 mt-0.5">
                  {dbMetrics.totalWeightMt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT
                </div>
              </div>

              {/* Direct Integrated Breakdown (No Tabs) */}
              <div className="pt-2 border-t border-[#F2EDE0] space-y-1 text-[10px]">
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    Sauda:
                  </span>
                  <span className="font-extrabold font-mono text-[#2E6B3E]">
                    {dbMetrics.saudaContractsCount} <span className="text-[9px] font-normal text-slate-500">({dbMetrics.saudaWeightMt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} MT)</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    P.T.F / Final:
                  </span>
                  <span className="font-extrabold font-mono text-blue-900">
                    {dbMetrics.ptfContractsCount} <span className="text-[9px] font-normal text-slate-500">({dbMetrics.ptfWeightMt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} MT)</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-dashed border-[#E5DEC9] text-[9.5px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
              <span>View All Contracts</span>
              <span className="text-xs">→</span>
            </div>
          </div>
        )}

        {/* CARD 2: PENDING SAUDA (CHECKED AGAINST TEMPORARY ARRIVAL) */}
        {(isAdmin || hasModulePermission('sauda', allowedModules, isAdmin) || hasModulePermission('sms_sauda', allowedModules, isAdmin) || hasModulePermission('po', allowedModules, isAdmin)) && (
          <div 
            onClick={() => handleOpenDrilldown({
              title: "Pending Contracts Breakdown",
              subtitle: "Contracts not yet fully arrived in Temporary Arrival register",
              contracts: dbMetrics.allContracts.filter(c => c.arrivalStatus === 'PENDING' || c.arrivalStatus === 'PARTIAL')
            })}
            className="bg-white border-2 border-amber-600/30 hover:border-amber-600 rounded-xl p-3 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
            title="Click to view pending arrival contracts"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1">
                  <span>⏳</span> Pending Sauda
                </span>
                <div className="p-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 group-hover:bg-amber-200 transition-colors">
                  <Clock className="w-3 h-3 text-amber-800" />
                </div>
              </div>

              {/* Main Total Metrics */}
              <div className="my-1">
                <div className="text-xl font-mono font-extrabold text-amber-900 tracking-tight leading-tight">
                  {dbMetrics.totalPendingContractsCount}{' '}
                  <span className="text-xs font-sans font-semibold text-[#5A6E54]">Pending</span>
                </div>
                <div className="text-xs font-mono font-bold text-amber-800 mt-0.5">
                  {dbMetrics.totalPendingWeightMt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT
                </div>
              </div>

              {/* Direct Integrated Breakdown (No Tabs) */}
              <div className="pt-2 border-t border-[#F2EDE0] space-y-1 text-[10px]">
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    Sauda:
                  </span>
                  <span className="font-extrabold font-mono text-[#2E6B3E]">
                    {dbMetrics.pendingSaudaCount} <span className="text-[9px] font-normal text-slate-500">({dbMetrics.pendingSaudaWeightMt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} MT)</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    P.T.F / Final:
                  </span>
                  <span className="font-extrabold font-mono text-blue-900">
                    {dbMetrics.pendingPtfCount} <span className="text-[9px] font-normal text-slate-500">({dbMetrics.pendingPtfWeightMt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} MT)</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-dashed border-[#E5DEC9] text-[9.5px] font-bold text-amber-800 flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
              <span>View Pending Dues</span>
              <span className="text-xs">→</span>
            </div>
          </div>
        )}

        {/* CARD 3: TOTAL PAYABLE VALUE */}
        {(isAdmin || hasModulePermission('payment', allowedModules, isAdmin)) && (
          <div 
            onClick={() => handleOpenDrilldown({
              title: "Total Payable Contracts & Payments",
              subtitle: "All approved contract payable values",
              contracts: dbMetrics.allContracts
            })}
            className="bg-white border-2 border-emerald-800/30 hover:border-emerald-700 rounded-xl p-3 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
            title="Click to view total payable value breakdown"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1">
                  <span>💳</span> Total Payable Value
                </span>
                <div className="p-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 group-hover:bg-emerald-200 transition-colors">
                  <Coins className="w-3 h-3 text-emerald-800" />
                </div>
              </div>

              <div className="my-1">
                <div className="text-lg sm:text-xl font-mono font-extrabold text-[#1E331B] tracking-tight leading-tight truncate">
                  ₹{formatIndianCurrency(dbMetrics.totalPayableValue)}
                </div>
                <div className="text-[10px] font-sans font-semibold text-[#5A6E54] mt-0.5">
                  Authoritative Payable Value
                </div>
              </div>

              <div className="pt-2 border-t border-[#F2EDE0] space-y-1 text-[10px]">
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold">Total Vouchers:</span>
                  <span className="font-extrabold font-mono text-[#2E6B3E]">
                    {paymentRecords.length} Vouchers
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold">Total Contracts:</span>
                  <span className="font-extrabold font-mono text-[#1E331B]">
                    {dbMetrics.totalContractsCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-dashed border-[#E5DEC9] text-[9.5px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
              <span>View Payable Details</span>
              <span className="text-xs">→</span>
            </div>
          </div>
        )}

        {/* CARD 4: PAID AMOUNT */}
        {(isAdmin || hasModulePermission('payment', allowedModules, isAdmin)) && (
          <div 
            onClick={() => handleOpenDrilldown({
              title: "Paid & Advance Payments Breakdown",
              subtitle: "Cleared and adjusted payments from Payment Operations",
              contracts: dbMetrics.allContracts.filter(c => c.paidAmount > 0)
            })}
            className="bg-white border-2 border-emerald-800/30 hover:border-emerald-700 rounded-xl p-3 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
            title="Click to view cleared and advance payments"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1">
                  <span>💸</span> Paid Amount
                </span>
                <div className="p-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 group-hover:bg-emerald-200 transition-colors">
                  <Wallet className="w-3 h-3 text-emerald-800" />
                </div>
              </div>

              <div className="my-1">
                <div className="text-lg sm:text-xl font-mono font-extrabold text-emerald-800 tracking-tight leading-tight truncate">
                  ₹{formatIndianCurrency(dbMetrics.totalPaidAmount)}
                </div>
                <div className="text-[10px] font-sans font-semibold text-[#5A6E54] mt-0.5">
                  Cleared / Advance Paid
                </div>
              </div>

              <div className="pt-2 border-t border-[#F2EDE0] space-y-1 text-[10px]">
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold">Paid Contracts:</span>
                  <span className="font-extrabold font-mono text-[#2E6B3E]">
                    {dbMetrics.allContracts.filter(c => c.paidAmount > 0).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold">Fully Settled:</span>
                  <span className="font-extrabold font-mono text-emerald-800">
                    {dbMetrics.allContracts.filter(c => c.paymentStatus === 'PAID').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-dashed border-[#E5DEC9] text-[9.5px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
              <span>View Paid Vouchers</span>
              <span className="text-xs">→</span>
            </div>
          </div>
        )}

        {/* CARD 5: REMAINING AMOUNT */}
        {(isAdmin || hasModulePermission('payment', allowedModules, isAdmin)) && (
          <div 
            onClick={() => handleOpenDrilldown({
              title: "Remaining Outstanding Amount Breakdown",
              subtitle: "Total Contract Value minus Paid Amount",
              contracts: dbMetrics.allContracts.filter(c => c.remainingAmount > 0)
            })}
            className="bg-white border-2 border-rose-600/30 hover:border-rose-600 rounded-xl p-3 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
            title="Click to view remaining dues and balances"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1">
                  <span>⚖️</span> Remaining Amount
                </span>
                <div className="p-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 group-hover:bg-rose-200 transition-colors">
                  <Scale className="w-3 h-3 text-rose-800" />
                </div>
              </div>

              <div className="my-1">
                <div className="text-lg sm:text-xl font-mono font-extrabold text-rose-800 tracking-tight leading-tight truncate">
                  ₹{formatIndianCurrency(dbMetrics.totalRemainingAmount)}
                </div>
                <div className="text-[10px] font-sans font-semibold text-[#5A6E54] mt-0.5">
                  Unpaid Outstanding Dues
                </div>
              </div>

              <div className="pt-2 border-t border-[#F2EDE0] space-y-1 text-[10px]">
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold">Pending Contracts:</span>
                  <span className="font-extrabold font-mono text-rose-700">
                    {dbMetrics.allContracts.filter(c => c.remainingAmount > 0).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold">Due Status:</span>
                  <span className="font-extrabold font-mono text-rose-800">
                    Active Dues
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-dashed border-[#E5DEC9] text-[9.5px] font-bold text-rose-700 flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
              <span>View Outstanding List</span>
              <span className="text-xs">→</span>
            </div>
          </div>
        )}

        {/* CARD 6: GODOWN STOCK */}
        {(isAdmin || hasModulePermission('closing_stock', allowedModules, isAdmin) || hasModulePermission('bardana', allowedModules, isAdmin) || hasModulePermission('issue', allowedModules, isAdmin)) && (
          <div 
            onClick={() => {
              if (onNavigate) {
                onNavigate('stock_summary');
              } else {
                handleOpenDrilldown({
                  title: "Godown Stock Inventory",
                  subtitle: "Live physical stock in godowns",
                  contracts: dbMetrics.allContracts
                });
              }
            }}
            className="bg-white border-2 border-emerald-800/30 hover:border-emerald-700 rounded-xl p-3 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
            title="Click to open Stock Inventory"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1">
                  <span>🏢</span> Godown Stock
                </span>
                <div className="p-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 group-hover:bg-emerald-200 transition-colors">
                  <Warehouse className="w-3 h-3 text-emerald-800" />
                </div>
              </div>

              <div className="my-1">
                <div className="text-lg sm:text-xl font-mono font-extrabold text-[#1E331B] tracking-tight leading-tight">
                  {dbMetrics.totalStockMt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span className="text-xs font-sans font-semibold text-[#5A6E54]">MT</span>
                </div>
                <div className="text-xs font-mono font-bold text-[#2E6B3E] mt-0.5">
                  {dbMetrics.godownStockBales.toLocaleString('en-IN')} Bales
                </div>
              </div>

              <div className="pt-2 border-t border-[#F2EDE0] space-y-1 text-[10px]">
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold">Active Godowns:</span>
                  <span className="font-extrabold font-mono text-[#2E6B3E]">
                    {godowns.length > 0 ? godowns.length : 20}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold">Stock Capacity:</span>
                  <span className="font-extrabold font-mono text-emerald-800">
                    Normal
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-dashed border-[#E5DEC9] text-[9.5px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
              <span>Open Stock Inventory</span>
              <span className="text-xs">→</span>
            </div>
          </div>
        )}

      </div>

      {/* 3. MONTH-WISE CONTRACT AND PAYMENT SUMMARY SECTION */}
      <div className="bg-[#FAF7F0] border-2 border-[#D6CAA8] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        
        {/* Section Header with Dynamic Year Dropdown Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D6CAA8] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#1E331B] text-emerald-300 shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-serif font-black text-[#1E331B] tracking-wide flex items-center gap-2">
                <span>Month-Wise Contract and Payment Summary</span>
                <span className="text-xs font-mono font-bold bg-[#EAE2D2] text-[#1E331B] px-2 py-0.5 rounded-md border border-[#D6CAA8]">
                  FY / Year {activeYear}
                </span>
              </h2>
            </div>
          </div>

          {/* Dynamic Year Selector Dropdown & Collapse Drawer Toggle */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <label htmlFor="dashboard-year-select" className="text-xs font-bold font-sans text-[#1E331B] flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#5A6E54]" />
              <span>Select Year:</span>
            </label>
            <select
              id="dashboard-year-select"
              value={activeYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-9 px-3 bg-white border-2 border-[#1E331B] rounded-xl text-xs font-mono font-bold text-[#1E331B] shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1E331B]/40"
            >
              {dbMetrics.availableYears.map(yr => (
                <option key={yr} value={yr} className="font-mono font-bold">
                  {yr}
                </option>
              ))}
            </select>

            <button
              onClick={() => setCollapseMonthSummary(!collapseMonthSummary)}
              className="h-9 px-3 bg-white border-2 border-[#1E331B] rounded-xl text-xs font-mono font-bold text-[#1E331B] shadow-xs cursor-pointer flex items-center gap-1.5 hover:bg-[#FAF7F0] transition-colors"
              title={collapseMonthSummary ? "Expand Month-Wise Summary" : "Collapse Month-Wise Summary"}
            >
              {collapseMonthSummary ? <ChevronDown className="w-3.5 h-3.5 text-emerald-800" /> : <ChevronUp className="w-3.5 h-3.5 text-emerald-800" />}
              <span>{collapseMonthSummary ? "Expand" : "Collapse"}</span>
            </button>
          </div>
        </div>

        {/* Month Cards Grid (Dynamic auto-fit responsive grid filling 100% available space) */}
        {!collapseMonthSummary && (
          dbMetrics.monthSummaries.length > 0 ? (
            <div className="grid gap-2.5 sm:gap-3 grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
              {dbMetrics.monthSummaries.map((m) => (
                <div
                  key={`${m.year}-${m.monthIndex}`}
                  onClick={() => handleOpenDrilldown({
                    title: `Month Summary: ${m.monthName} ${m.year}`,
                    subtitle: `${m.totalContracts} contracts belonging to ${m.monthName} ${m.year} (${m.pendingContracts} pending, ${m.partialContracts} partial)`,
                    contracts: m.contracts
                  })}
                  className="bg-white border-2 border-[#D6CAA8] hover:border-[#1E331B] rounded-xl p-2.5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group active:scale-[0.98] select-none text-xs h-full"
                  title={`Click to view ${m.monthName} ${m.year} contract records`}
                >
                  <div>
                    {/* Card Header: Month Name + Year */}
                    <div className="flex items-center justify-between gap-1 mb-1.5 pb-1 border-b border-[#F2EDE0]">
                      <h3 className="text-xs sm:text-sm font-serif font-black text-[#1E331B] flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 shrink-0"></span>
                        <span>{m.monthName}</span>
                      </h3>
                      <span className="text-[10px] font-mono text-[#5A6E54] font-semibold">{m.year}</span>
                    </div>

                    {/* Contract Count */}
                    <div className="flex items-center justify-between text-xs py-1 border-b border-[#F2EDE0]">
                      <span className="text-[#5A6E54] font-semibold">Cont:</span>
                      <span className="font-mono font-extrabold text-[#1E331B]">
                        {m.totalContracts}
                      </span>
                    </div>

                    {/* Pending Count */}
                    <div className="flex items-center justify-between text-xs py-1 border-b border-dashed border-[#F2EDE0]">
                      <span className="text-[#5A6E54] font-semibold">Pend:</span>
                      <span className={cn(
                        "font-mono font-bold px-1.5 py-0.5 rounded text-[10px]",
                        m.pendingContracts > 0 
                          ? "bg-amber-100 text-amber-900 border border-amber-300" 
                          : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      )}>
                        {m.pendingContracts > 0 ? `${m.pendingContracts}` : '0'}
                      </span>
                    </div>

                    {/* Partial Count */}
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-[#5A6E54] font-semibold">Part:</span>
                      <span className={cn(
                        "font-mono font-bold px-1.5 py-0.5 rounded text-[10px]",
                        m.partialContracts > 0 
                          ? "bg-blue-100 text-blue-900 border border-blue-300" 
                          : "bg-gray-100 text-gray-700 border border-gray-300"
                      )}>
                        {m.partialContracts > 0 ? `${m.partialContracts}` : '0'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 pt-1 border-t border-dashed border-[#EAE2D2] text-[9.5px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
                    <span>View Details</span>
                    <span className="text-[10px]">→</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-[#D6CAA8] rounded-xl p-6 text-center text-[#5A6E54]">
              <p className="text-sm font-semibold">No contract data found for year {activeYear}.</p>
              <p className="text-xs text-[#5A6E54]/80 mt-0.5">Please select another year from the dropdown above.</p>
            </div>
          )
        )}

      </div>

      {/* 4. INSPECTION SUMMARY (CLAIM, QUALITY & SAUDA CHECK POINT PREMIUM) */}
      <div className="bg-[#FAF7F0] border-2 border-[#D6CAA8] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D6CAA8] pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1E331B] text-white rounded-xl shadow-xs">
              <Droplets className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-serif font-black tracking-wide text-[#1E331B] flex items-center gap-2">
                <span>Inspection Summary</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleOpenInspectionModal({
                title: `Inspection Summary Log (${activeYear})`,
                subtitle: `Viewing all ${inspMetrics.totalInspectionsCount} inspection records for ${activeYear}`,
                inspections: inspMetrics.allInspections
              })}
              className="h-8 px-3 bg-[#1E331B] text-white text-xs font-bold rounded-xl hover:bg-[#2A4426] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="View all inspection records"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Inspection Log</span>
            </button>

            <button
              onClick={handleExportInspectionCsv}
              className="h-8 px-3 bg-white border border-[#D6CAA8] text-[#1E331B] text-xs font-bold rounded-xl hover:bg-[#FAF7F0] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Download inspection CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            {onNavigate && (
              <button
                onClick={() => onNavigate('material_inspection')}
                className="h-8 px-3 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Go to Material Inspection module"
              >
                <span>Go to Inspection Module</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => setCollapseInspectionSummary(!collapseInspectionSummary)}
              className="h-8 px-3 bg-white border border-[#D6CAA8] text-[#1E331B] text-xs font-bold rounded-xl hover:bg-[#FAF7F0] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title={collapseInspectionSummary ? "Expand Inspection Summary" : "Collapse Inspection Summary"}
            >
              {collapseInspectionSummary ? <ChevronDown className="w-3.5 h-3.5 text-emerald-800" /> : <ChevronUp className="w-3.5 h-3.5 text-emerald-800" />}
              <span>{collapseInspectionSummary ? "Expand" : "Collapse"}</span>
            </button>
          </div>
        </div>

        {/* Year-level KPI Highlights Ribbon & Month Cards */}
        {!collapseInspectionSummary && (
          <>
            {/* Year-level KPI Highlights Ribbon (Total Counts of MR/Weight, Final Arrival, Inspection, Payment, Settlement) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs font-sans">
              {/* Card 1: Total MR & Weight (From Temporary Arrival) */}
              <div 
                onClick={() => handleOpenInspectionModal({
                  title: `All Temporary MRs & Gate Deliveries (${activeYear})`,
                  subtitle: `Total ${inspMetrics.totalYearTemporaryArrivalsCount} MRs with ${inspMetrics.totalYearBales.toLocaleString()} Bales/Drums and ${inspMetrics.totalYearArrivalWeightMt.toFixed(1)} MT arrival weight`,
                  inspections: inspMetrics.allInspections,
                  allPendingPipelineList: inspMetrics.allYearPendingPipelineList,
                  initialTab: 'inspections'
                })}
                className="bg-white p-3 rounded-xl border border-[#D6CAA8] hover:border-[#1E331B] shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                title="Click to view all Temporary Arrival MR records"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#5A6E54] font-bold block uppercase tracking-wider">MR / Temp Arrival</span>
                  <span className="text-[10px] text-[#2E6B3E] font-bold group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                <span className="font-mono font-extrabold text-[#1E331B] text-base block">
                  {inspMetrics.totalYearTemporaryArrivalsCount} MR
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-900 mt-0.5 block truncate">
                  {inspMetrics.totalYearBales.toLocaleString()} Bales • {inspMetrics.totalYearArrivalWeightMt.toLocaleString('en-IN', { minimumFractionDigits: 1 })} MT
                </span>
              </div>

              {/* Card 2: Final Arrival / FMR */}
              <div 
                onClick={() => handleOpenInspectionModal({
                  title: `Final Arrival (FMR) Breakdown (${activeYear})`,
                  subtitle: `Total ${inspMetrics.totalYearFinalArrivalsCount} Final MRs created • ${inspMetrics.yearPendingFmrPoCount} Pending P.O.s (${inspMetrics.totalYearPendingFmrCount} Below FMR)`,
                  inspections: inspMetrics.allInspections,
                  pendingFmrList: inspMetrics.allYearPendingFmrList,
                  allPendingPipelineList: inspMetrics.allYearPendingPipelineList,
                  initialTab: 'pending_fmr'
                })}
                className="bg-white p-3 rounded-xl border border-[#D6CAA8] hover:border-teal-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                title="Click to view Final Arrival breakdown"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-teal-900 font-bold block uppercase tracking-wider">Final Arrival (FMR)</span>
                  <span className="text-[10px] text-teal-700 font-bold group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                <span className="font-mono font-extrabold text-teal-950 text-base block">
                  {inspMetrics.totalYearFinalArrivalsCount} FMR
                </span>
                <span className="text-[11px] text-teal-800 font-medium mt-0.5 block truncate">
                  {inspMetrics.totalYearPendingFmrCount > 0 ? `${inspMetrics.yearPendingFmrPoCount} POs (${inspMetrics.totalYearPendingFmrCount} Below FMR)` : 'All FMR Completed'}
                </span>
              </div>

              {/* Card 3: Total Inspection Count */}
              <div 
                onClick={() => handleOpenInspectionModal({
                  title: `Total Inspections Breakdown (${activeYear})`,
                  subtitle: `Completed Inspections: ${inspMetrics.totalYearInspectionsCount} • Pending Inspection: ${inspMetrics.yearPendingInspectionPoCount} P.O.s (${inspMetrics.allYearPendingInspectionList.length} MRs)`,
                  inspections: inspMetrics.allInspections,
                  pendingInspectionList: inspMetrics.allYearPendingInspectionList,
                  allPendingPipelineList: inspMetrics.allYearPendingPipelineList,
                  initialTab: 'pending_insp'
                })}
                className="bg-white p-3 rounded-xl border border-[#D6CAA8] hover:border-blue-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                title="Click to view inspection breakdown"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-blue-900 font-bold block uppercase tracking-wider">Mill Inspection</span>
                  <span className="text-[10px] text-blue-700 font-bold group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                <span className="font-mono font-extrabold text-blue-950 text-base block">
                  {inspMetrics.totalYearInspectionsCount} Insp
                </span>
                <span className="text-[11px] text-blue-800 font-medium mt-0.5 block truncate">
                  {inspMetrics.allYearPendingInspectionList.length > 0 
                    ? `${inspMetrics.yearPendingInspectionPoCount} POs Pending • ${inspMetrics.totalYearInspectionsCount} Done` 
                    : (inspMetrics.totalYearInspectionsCount > 0 ? '100% Inspected' : 'No Inspections')}
                </span>
              </div>

              {/* Card 4: Total Payment Count */}
              <div 
                onClick={() => handleOpenInspectionModal({
                  title: `Total Payments Summary (${activeYear})`,
                  subtitle: `Total ${inspMetrics.totalYearPaymentsCount} payment voucher records with ₹${formatIndianCurrency(inspMetrics.totalYearPaidAmount)} paid • ${inspMetrics.yearPendingPaymentPoCount} P.O.s Pending Payment`,
                  inspections: inspMetrics.allInspections,
                  payments: paymentRecords,
                  pendingPaymentList: inspMetrics.allYearPendingPaymentList,
                  allPendingPipelineList: inspMetrics.allYearPendingPipelineList,
                  initialTab: 'pending_paym'
                })}
                className="bg-white p-3 rounded-xl border border-[#D6CAA8] hover:border-emerald-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                title="Click to view payment voucher records"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-emerald-900 font-bold block uppercase tracking-wider">Total Payment</span>
                  <span className="text-[10px] text-emerald-700 font-bold group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                <span className="font-mono font-extrabold text-emerald-950 text-base block">
                  {inspMetrics.totalYearPaymentsCount} Vouchers
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-800 mt-0.5 block truncate">
                  ₹{formatIndianCurrency(inspMetrics.totalYearPaidAmount)} Paid {inspMetrics.yearPendingPaymentPoCount > 0 && `(${inspMetrics.yearPendingPaymentPoCount} POs Pending)`}
                </span>
              </div>

              {/* Card 5: Total Settlement Count */}
              <div 
                onClick={() => handleOpenInspectionModal({
                  title: `Total Settlements Summary (${activeYear})`,
                  subtitle: `Total ${inspMetrics.totalYearSettlementsCount} audited settlement records with ₹${formatIndianCurrency(inspMetrics.totalYearSettledAmount)} settled • ${inspMetrics.yearPendingSettlementPoCount} P.O.s Pending Settlement`,
                  inspections: inspMetrics.allInspections,
                  settlements: settlements,
                  pendingSettlementList: inspMetrics.allYearPendingSettlementList,
                  allPendingPipelineList: inspMetrics.allYearPendingPipelineList,
                  initialTab: 'pending_sett'
                })}
                className="bg-white p-3 rounded-xl border border-[#D6CAA8] hover:border-purple-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                title="Click to view settlement records"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-purple-900 font-bold block uppercase tracking-wider">Total Settlement</span>
                  <span className="text-[10px] text-purple-700 font-bold group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                <span className="font-mono font-extrabold text-purple-950 text-base block">
                  {inspMetrics.totalYearSettlementsCount} Settled
                </span>
                <span className="text-[11px] font-mono font-bold text-purple-800 mt-0.5 block truncate">
                  ₹{formatIndianCurrency(inspMetrics.totalYearSettledAmount)} {inspMetrics.yearPendingSettlementPoCount > 0 && `(${inspMetrics.yearPendingSettlementPoCount} POs Pending)`}
                </span>
              </div>
            </div>

            {/* Pipeline Workflow & Pending P.O. Tracker Banner ({activeYear}) */}
            <div className="bg-gradient-to-r from-[#FAF7F0] via-[#F3ECE0] to-[#FAF7F0] border-2 border-[#D6CAA8] rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#1E331B] text-emerald-300 rounded-lg shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-serif font-black text-[#1E331B] text-xs sm:text-sm flex items-center gap-1.5">
                    <span>Year {activeYear} Pipeline & Pending P.O. Tracker</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-200/90 text-amber-950 font-extrabold rounded-full border border-amber-400/60 shadow-2xs">
                      {inspMetrics.yearTotalPendingPoCount} Total Pending P.O.s
                    </span>
                  </h4>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleOpenInspectionModal({
                    title: `All Pending Pipeline P.O.s (${activeYear})`,
                    subtitle: `Total ${inspMetrics.allYearPendingPipelineList.length} pending items across ${inspMetrics.yearTotalPendingPoCount} unique P.O. numbers for year ${activeYear}`,
                    allPendingPipelineList: inspMetrics.allYearPendingPipelineList,
                    pendingFmrList: inspMetrics.allYearPendingFmrList,
                    pendingInspectionList: inspMetrics.allYearPendingInspectionList,
                    pendingPaymentList: inspMetrics.allYearPendingPaymentList,
                    pendingSettlementList: inspMetrics.allYearPendingSettlementList,
                    initialTab: 'pipeline'
                  })}
                  className="px-3 py-1.5 bg-[#1E331B] hover:bg-[#2A4426] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                  title="View complete list of pending P.O. numbers with stages and actions"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Pending P.O. List ({inspMetrics.yearTotalPendingPoCount})</span>
                </button>

                <button
                  onClick={() => exportPendingPoListCsv(inspMetrics.allYearPendingPipelineList, `All_Pending_POs_Pipeline_${activeYear}_${new Date().toISOString().slice(0, 10)}.csv`)}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Download All Pending P.O.s across all stages for the year in CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Pending P.O. CSV</span>
                </button>
              </div>
            </div>

            {/* Month Cards Grid (Dynamic auto-fit responsive grid filling 100% available space) */}
            {inspMetrics.monthInspectionSummaries.length > 0 ? (
              <div className="grid gap-2.5 sm:gap-3 grid-cols-[repeat(auto-fit,minmax(215px,1fr))]">
                {inspMetrics.monthInspectionSummaries.map((m) => (
                  <div
                    key={`insp-${m.year}-${m.monthIndex}`}
                    onClick={() => handleOpenInspectionModal({
                      title: `Operational & Pending P.O. Summary: ${m.monthName} ${m.year}`,
                      subtitle: `${m.temporaryArrivalsCount} MRs Inward • ${m.finalArrivalsCount} FMR (${m.pendingFmrPoCount} POs Pending FMR) • ${m.inspectionCount} Insp (${m.pendingInspectionPoCount} POs Pending Insp) • ${m.paymentCount} Payments (${m.pendingPaymentPoCount} POs Pending Paym) • ${m.settlementCount} Settlements (${m.pendingSettlementPoCount} POs Pending Sett)`,
                      inspections: m.inspections,
                      payments: m.payments,
                      settlements: m.settlements,
                      pendingFmrList: m.pendingFmrList,
                      pendingInspectionList: m.pendingInspectionList,
                      pendingPaymentList: m.pendingPaymentList,
                      pendingSettlementList: m.pendingSettlementList,
                      allPendingPipelineList: m.allPendingPipelineList,
                      initialTab: m.totalPendingPoCount > 0 ? 'pipeline' : 'inspections'
                    })}
                    className="bg-white border-2 border-[#D6CAA8] hover:border-[#1E331B] rounded-xl p-3 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group select-none text-xs h-full relative"
                    title={`Click to view ${m.monthName} ${m.year} Temporary Arrival, Final MR, Inspection, Payment, and Settlement details`}
                  >
                    <div>
                      {/* Card Header: Month Name + Year + Pending POs Badge */}
                      <div className="flex items-center justify-between gap-1 mb-2 pb-1.5 border-b border-[#F2EDE0]">
                        <h3 className="text-xs sm:text-sm font-serif font-black text-[#1E331B] flex items-center gap-1 truncate">
                          <span className="w-2 h-2 rounded-full bg-emerald-700 shrink-0"></span>
                          <span>{m.monthName}</span>
                          <span className="text-[10px] font-mono text-[#5A6E54] font-normal">{m.year}</span>
                        </h3>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          {m.totalPendingPoCount > 0 ? (
                            <span 
                              className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md shadow-2xs animate-pulse"
                              title={`${m.totalPendingPoCount} unique P.O.s currently pending at different pipeline stages in ${m.monthName} ${m.year}`}
                            >
                              ⏳ {m.totalPendingPoCount} Pending POs
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded">
                              ✓ All Done
                            </span>
                          )}
                          <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded">
                            {m.temporaryArrivalsCount} MR
                          </span>
                        </div>
                      </div>

                      {/* 1. MR (Temporary Arrival - Authoritative source from temporary_material_received) */}
                      <div className="flex items-center justify-between py-1 border-t border-[#F2EDE0]">
                        <span className="text-[11px] text-[#5A6E54] font-semibold">1. MR (Inward):</span>
                        <div className="text-right">
                          <span className="font-mono font-extrabold text-[#1E331B] text-xs">
                            {m.temporaryArrivalsCount} MR
                          </span>
                          <span className="text-[9.5px] font-mono text-slate-500 block">
                            {m.temporaryArrivalsBales.toLocaleString()} Bales • {m.temporaryArrivalsWeightMt} MT
                          </span>
                        </div>
                      </div>

                      {/* 2. MR ➔ FMR (Final Arrival & Below-FMR count & Pending POs) */}
                      <div className="flex items-center justify-between py-1 border-t border-dashed border-[#F2EDE0]">
                        <span className="text-[11px] text-[#5A6E54] font-semibold">2. MR ➔ FMR:</span>
                        <div className="text-right font-mono text-xs">
                          <span className="font-extrabold text-teal-900">
                            {m.finalArrivalsCount} FMR
                          </span>
                          {m.pendingFmrCount > 0 ? (
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInspectionModal({
                                  title: `Pending Final MR (Below FMR) - ${m.monthName} ${m.year}`,
                                  subtitle: `${m.pendingFmrPoCount} P.O. numbers (${m.pendingFmrCount} Temporary MRs) awaiting Final MR entry`,
                                  pendingFmrList: m.pendingFmrList,
                                  allPendingPipelineList: m.allPendingPipelineList,
                                  initialTab: 'pending_fmr'
                                });
                              }}
                              className="text-[9.5px] font-sans font-bold text-amber-900 bg-amber-100 px-1 py-0.2 rounded border border-amber-300 block hover:bg-amber-200 cursor-pointer mt-0.5" 
                              title={`Click to view ${m.pendingFmrPoCount} P.O.s (${m.pendingFmrCount} MRs) awaiting Final MR`}
                            >
                              ⏳ {m.pendingFmrPoCount} POs ({m.pendingFmrCount} Below FMR)
                            </span>
                          ) : (
                            <span className="text-[9px] font-sans text-emerald-700 font-semibold block">
                              (✓ 100% FMR)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 3. FMR ➔ INSP (Mill Inspection - Completed vs Pending POs) */}
                      <div className="flex items-center justify-between py-1 border-t border-dashed border-[#F2EDE0]">
                        <span className="text-[11px] text-[#5A6E54] font-semibold">3. FMR ➔ INSP:</span>
                        <div className="text-right font-mono text-xs">
                          <span className="font-extrabold text-blue-900">
                            {m.inspectionCount} Insp
                          </span>
                          {m.pendingInspectionCount > 0 || m.pendingInspectionList.length > 0 ? (
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInspectionModal({
                                  title: `Pending Mill Inspection - ${m.monthName} ${m.year}`,
                                  subtitle: `${m.pendingInspectionPoCount} P.O. numbers (${m.pendingInspectionList.length} MRs) awaiting lab test / inspection`,
                                  pendingInspectionList: m.pendingInspectionList,
                                  allPendingPipelineList: m.allPendingPipelineList,
                                  initialTab: 'pending_insp'
                                });
                              }}
                              className="text-[9.5px] font-sans font-bold text-blue-900 bg-blue-50 px-1 py-0.2 rounded border border-blue-200 block hover:bg-blue-100 cursor-pointer mt-0.5" 
                              title={`Click to view ${m.pendingInspectionPoCount} P.O.s (${m.pendingInspectionList.length} MRs) pending inspection`}
                            >
                              ⏳ {m.pendingInspectionPoCount} POs ({m.pendingInspectionList.length} Pending)
                            </span>
                          ) : m.inspectionCount > 0 ? (
                            <span className="text-[9px] font-sans text-emerald-700 font-semibold block">
                              (✓ Inspected)
                            </span>
                          ) : (
                            <span className="text-[9px] font-sans text-slate-400 block">
                              (—)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 4. INSP ➔ Paym (Payment Operations & Pending POs) */}
                      <div className="flex items-center justify-between py-1 border-t border-dashed border-[#F2EDE0]">
                        <span className="text-[11px] text-[#5A6E54] font-semibold">4. INSP ➔ Paym:</span>
                        <div className="text-right font-mono text-xs">
                          <span className="font-extrabold text-emerald-800">
                            {m.paymentCount} Vouchers
                          </span>
                          {m.pendingPaymentList.length > 0 ? (
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInspectionModal({
                                  title: `Pending Payment Vouchers - ${m.monthName} ${m.year}`,
                                  subtitle: `${m.pendingPaymentPoCount} P.O. numbers (${m.pendingPaymentList.length} MRs) inspected but awaiting payment voucher`,
                                  pendingPaymentList: m.pendingPaymentList,
                                  allPendingPipelineList: m.allPendingPipelineList,
                                  initialTab: 'pending_paym'
                                });
                              }}
                              className="text-[9.5px] font-sans font-bold text-emerald-950 bg-emerald-100 px-1 py-0.2 rounded border border-emerald-300 block hover:bg-emerald-200 cursor-pointer mt-0.5" 
                              title={`Click to view ${m.pendingPaymentPoCount} P.O.s (${m.pendingPaymentList.length} MRs) pending payment`}
                            >
                              ⏳ {m.pendingPaymentPoCount} POs Pending
                            </span>
                          ) : m.paymentPaidAmount > 0 ? (
                            <span className="text-[9.5px] font-bold text-emerald-700 block">
                              ₹{formatIndianCurrency(m.paymentPaidAmount)}
                            </span>
                          ) : (
                            <span className="text-[9px] font-sans text-slate-400 block">
                              (—)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 5. Paym ➔ Sett (Settlement & Pending POs) */}
                      <div className="flex items-center justify-between py-1 border-t border-dashed border-[#F2EDE0]">
                        <span className="text-[11px] text-[#5A6E54] font-semibold">5. Paym ➔ Sett:</span>
                        <div className="text-right font-mono text-xs">
                          <span className="font-extrabold text-purple-800">
                            {m.settlementCount} Settled
                          </span>
                          {m.pendingSettlementList.length > 0 ? (
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInspectionModal({
                                  title: `Pending Final Settlement - ${m.monthName} ${m.year}`,
                                  subtitle: `${m.pendingSettlementPoCount} P.O. numbers (${m.pendingSettlementList.length} MRs) awaiting final audit & settlement`,
                                  pendingSettlementList: m.pendingSettlementList,
                                  allPendingPipelineList: m.allPendingPipelineList,
                                  initialTab: 'pending_sett'
                                });
                              }}
                              className="text-[9.5px] font-sans font-bold text-purple-950 bg-purple-100 px-1 py-0.2 rounded border border-purple-300 block hover:bg-purple-200 cursor-pointer mt-0.5" 
                              title={`Click to view ${m.pendingSettlementPoCount} P.O.s (${m.pendingSettlementList.length} MRs) pending settlement`}
                            >
                              ⏳ {m.pendingSettlementPoCount} POs Pending
                            </span>
                          ) : m.settlementAmount > 0 ? (
                            <span className="text-[9.5px] font-bold text-purple-700 block">
                              ₹{formatIndianCurrency(m.settlementAmount)}
                            </span>
                          ) : (
                            <span className="text-[9px] font-sans text-slate-400 block">
                              (—)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 6. Moisture & Grade Down Summary */}
                      <div className="flex items-center justify-between py-1 border-t border-dashed border-[#F2EDE0] bg-slate-50/50 -mx-1 px-1 rounded">
                        <span className="text-[10.5px] text-[#5A6E54] font-semibold">Moist / Grd:</span>
                        <div className="flex items-center gap-1 font-mono text-xs text-right">
                          <span className={cn(
                            "font-bold",
                            m.avgMoisture <= 15 ? "text-emerald-800" : "text-amber-800"
                          )}>
                            {m.avgMoisture}%
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold text-[#1E331B]">
                            {m.avgGradeDown}%
                          </span>
                          {m.premiumLotsCount > 0 && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-amber-800 font-extrabold" title={`⚡ ${m.premiumLotsCount} Premium MRs`}>⚡{m.premiumLotsCount}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Month Card Bottom Actions (1-Click CSV Download & Pipeline Drilldown) */}
                    <div className="mt-2.5 pt-1.5 border-t border-[#EAE2D2] flex items-center justify-between gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (m.allPendingPipelineList.length > 0) {
                            exportPendingPoListCsv(m.allPendingPipelineList, `Pending_POs_${m.monthName}_${m.year}_${new Date().toISOString().slice(0, 10)}.csv`);
                          } else {
                            exportPendingPoListCsv(m.pendingFmrList, `Pending_POs_${m.monthName}_${m.year}_${new Date().toISOString().slice(0, 10)}.csv`);
                          }
                        }}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-md text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-2xs shrink-0"
                        title={`Download CSV of all pending P.O. numbers for ${m.monthName} ${m.year}`}
                      >
                        <Download className="w-3 h-3 text-emerald-700" />
                        <span>CSV</span>
                      </button>

                      <div className="text-[10px] font-black text-[#1E331B] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform text-right truncate">
                        <span>View Details</span>
                        <span className="text-[11px]">→</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-[#D6CAA8] rounded-xl p-6 text-center text-[#5A6E54]">
                <p className="text-sm font-semibold">No inspection or moisture data found for year {activeYear}.</p>
                <p className="text-xs text-[#5A6E54]/80 mt-0.5">Records logged in Material Inspection module will automatically display here.</p>
              </div>
            )}
          </>
        )}

      </div>

      {/* 5. DRILLDOWN MODAL (CONTRACTS) */}
      <DashboardDrilldownModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        subtitle={modalSubtitle}
        contracts={modalContracts}
        initialFilter={modalInitialFilter}
      />

      {/* 6. DRILLDOWN MODAL (INSPECTION, MOISTURE, CLAIMS & PENDING PIPELINE POS) */}
      <InspectionDrilldownModal
        isOpen={inspModalOpen}
        onClose={() => setInspModalOpen(false)}
        title={inspModalTitle}
        subtitle={inspModalSubtitle}
        inspections={inspModalRecords}
        payments={inspModalPayments}
        settlements={inspModalSettlements}
        pendingFmrList={inspModalPendingFmr}
        pendingInspectionList={inspModalPendingInsp}
        pendingPaymentList={inspModalPendingPaym}
        pendingSettlementList={inspModalPendingSett}
        allPendingPipelineList={inspModalAllPending}
        initialTab={inspModalInitialTab}
      />

    </div>
  );
}
