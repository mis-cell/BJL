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
  Activity,
  Award,
  Clock,
  Briefcase,
  Lock,
  Wallet,
  Check,
  ChevronRight,
  Filter
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
  MonthInspectionSummary
} from '../services/dashboardCalculationService';
import DashboardDrilldownModal from './DashboardDrilldownModal';
import InspectionDrilldownModal from './InspectionDrilldownModal';

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

  // Drilldown Modal State (Inspections, Moisture & Claims)
  const [inspModalOpen, setInspModalOpen] = useState(false);
  const [inspModalTitle, setInspModalTitle] = useState('');
  const [inspModalSubtitle, setInspModalSubtitle] = useState('');
  const [inspModalRecords, setInspModalRecords] = useState<InspectionRecord[]>([]);

  // View Controls
  const [isFullScreen, setIsFullScreen] = useState(false);

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
      inspections: inspections.length > 0 ? inspections : arrivals,
      inspectionDetails,
      arrivals,
      saudaCheckPoints,
      saudaCheckPointDetails,
      paymentRecords,
      paymentDetails,
      pos,
      selectedYear: activeYear
    });
  }, [inspections, inspectionDetails, arrivals, saudaCheckPoints, saudaCheckPointDetails, paymentRecords, paymentDetails, pos, activeYear]);

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

  // Handler to open inspection drilldown modal
  const handleOpenInspectionModal = (params: {
    title: string;
    subtitle?: string;
    inspections: InspectionRecord[];
  }) => {
    setInspModalTitle(params.title);
    setInspModalSubtitle(params.subtitle || '');
    setInspModalRecords(params.inspections);
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
          <p className="text-xs sm:text-sm text-emerald-200/90 font-sans mt-1">
            Real-time live procurement analytics, contract fulfillment, weighbridge tracking & financial ledger
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
              <p className="text-xs text-[#5A6E54] font-sans mt-0.5">
                Sauda contracts allocated by <strong>Contract Date</strong> • Final P.O. allocated by <strong>P.O. Date</strong> • Pending checked against <strong>Temporary Arrival</strong>
              </p>
            </div>
          </div>

          {/* Dynamic Year Selector Dropdown */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
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
          </div>
        </div>

        {/* Month Cards Grid (1/4 size compact cards showing only Contract and Pending) */}
        {dbMetrics.monthSummaries.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-2.5 sm:gap-3">
            {dbMetrics.monthSummaries.map((m) => (
              <div
                key={`${m.year}-${m.monthIndex}`}
                onClick={() => handleOpenDrilldown({
                  title: `Month Summary: ${m.monthName} ${m.year}`,
                  subtitle: `${m.totalContracts} contracts belonging to ${m.monthName} ${m.year} (${m.pendingContracts} pending)`,
                  contracts: m.contracts
                })}
                className="bg-white border-2 border-[#D6CAA8] hover:border-[#1E331B] rounded-xl p-2.5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group active:scale-[0.98] select-none"
                title={`Click to view ${m.monthName} ${m.year} contract records`}
              >
                <div>
                  {/* Card Header: Month Name + Year */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <h3 className="text-xs sm:text-sm font-serif font-black text-[#1E331B] flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 shrink-0"></span>
                      <span>{m.monthName}</span>
                      <span className="text-[10px] font-mono text-[#5A6E54] font-normal">{m.year}</span>
                    </h3>
                  </div>

                  {/* Contract Count */}
                  <div className="flex items-center justify-between text-xs py-1 border-t border-[#F2EDE0]">
                    <span className="text-[11px] text-[#5A6E54] font-semibold">Contract:</span>
                    <span className="font-mono font-extrabold text-[#1E331B] text-xs">
                      {m.totalContracts}
                    </span>
                  </div>

                  {/* Pending Count */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-dashed border-[#F2EDE0]">
                    <span className="text-[11px] text-[#5A6E54] font-semibold">Pending:</span>
                    <span className={cn(
                      "font-mono font-bold px-1.5 py-0.5 rounded text-[10px]",
                      m.pendingContracts > 0 
                        ? "bg-amber-100 text-amber-900 border border-amber-300" 
                        : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                    )}>
                      {m.pendingContracts > 0 ? `${m.pendingContracts}` : '0'}
                    </span>
                  </div>
                </div>

                <div className="mt-2 pt-1 border-t border-dashed border-[#EAE2D2] text-[9px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
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
          </div>
        </div>

        {/* Year-level KPI Highlights Ribbon (4 Essential Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2.5 text-xs font-sans">
          {/* Total MR & Weight - Count MR_No number only */}
          <div className="bg-white p-2.5 rounded-xl border border-[#D6CAA8] shadow-2xs">
            <span className="text-[9.5px] text-[#5A6E54] font-bold block uppercase tracking-wider">MR / Weight</span>
            <span className="font-mono font-extrabold text-[#1E331B] text-sm block">
              {inspMetrics.totalInspectionsCount} MR
            </span>
            <span className="text-[10.5px] font-mono font-bold text-emerald-900">
              {inspMetrics.totalInspectedWeightMt.toLocaleString('en-IN', { minimumFractionDigits: 1 })} MT
            </span>
          </div>

          {/* Moisture % & Claim */}
          <div className="bg-white p-2.5 rounded-xl border border-[#D6CAA8] shadow-2xs">
            <span className="text-[9.5px] text-[#5A6E54] font-bold block uppercase tracking-wider">Moisture % (Claim)</span>
            <span className={cn(
              "font-mono font-extrabold text-sm block",
              inspMetrics.overallAvgMoisture <= 15 ? "text-emerald-800" : "text-amber-800"
            )}>
              {inspMetrics.overallAvgMoisture}%
            </span>
            <span className="text-[10px] font-mono font-bold text-rose-700">
              Avg Clm: {inspMetrics.overallAvgClaimMoisture}%
            </span>
          </div>

          {/* Grade Down % */}
          <div className="bg-white p-2.5 rounded-xl border border-[#D6CAA8] shadow-2xs">
            <span className="text-[9.5px] text-[#5A6E54] font-bold block uppercase tracking-wider">Grade Down %</span>
            <span className="font-mono font-extrabold text-[#1E331B] text-sm block">
              {inspMetrics.overallAvgGradeDown}%
            </span>
            <span className="text-[10px] font-mono font-bold text-rose-700">
              Avg Clm: {inspMetrics.overallAvgClaimGradeDown}%
            </span>
          </div>

          {/* Premium (Payment Operations / Sauda Check Point) */}
          <div className="bg-white p-2.5 rounded-xl border border-amber-300 shadow-2xs bg-amber-50/30">
            <span className="text-[9.5px] text-amber-900 font-bold block uppercase tracking-wider">⚡ Premium (SCP)</span>
            <span className="font-mono font-extrabold text-amber-950 text-sm block">
              {inspMetrics.totalPremiumLots} MR
            </span>
            <span className="text-[10px] text-amber-800 font-medium">
              {inspMetrics.totalPremiumSum > 0 ? `₹${formatIndianCurrency(inspMetrics.totalPremiumSum)}` : (inspMetrics.totalPremiumLots > 0 ? `Avg ₹${inspMetrics.avgPremiumRate}/Qtl` : 'From Payment / SCP')}
            </span>
          </div>
        </div>

        {/* Month Cards Grid (1/4 size compact cards matching Contract & Payment style) */}
        {inspMetrics.monthInspectionSummaries.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-2.5 sm:gap-3">
            {inspMetrics.monthInspectionSummaries.map((m) => (
              <div
                key={`insp-${m.year}-${m.monthIndex}`}
                onClick={() => handleOpenInspectionModal({
                  title: `Inspection Summary: ${m.monthName} ${m.year}`,
                  subtitle: `${m.totalInspections} MRs inspected in ${m.monthName} ${m.year} (${m.lotsWithMoistureClaim} MRs with moisture claim)`,
                  inspections: m.inspections
                })}
                className="bg-white border-2 border-[#D6CAA8] hover:border-[#1E331B] rounded-xl p-2.5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group active:scale-[0.98] select-none text-xs"
                title={`Click to view ${m.monthName} ${m.year} inspection details`}
              >
                <div>
                  {/* Card Header: Month Name + Year */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <h3 className="text-xs sm:text-sm font-serif font-black text-[#1E331B] flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-700 shrink-0"></span>
                      <span>{m.monthName}</span>
                      <span className="text-[10px] font-mono text-[#5A6E54] font-normal">{m.year}</span>
                    </h3>
                  </div>

                  {/* Inspected MR / Weight */}
                  <div className="flex items-center justify-between py-1 border-t border-[#F2EDE0]">
                    <span className="text-[10.5px] text-[#5A6E54] font-semibold">MR / Wt:</span>
                    <span className="font-mono font-extrabold text-[#1E331B] text-[11px]">
                      {m.totalInspections} <span className="text-[9.5px] font-normal text-slate-500">({m.totalWeightMt.toFixed(1)} MT)</span>
                    </span>
                  </div>

                  {/* Moisture % & Claim */}
                  <div className="flex items-center justify-between py-0.5 border-t border-[#F2EDE0]">
                    <span className="text-[10.5px] text-[#5A6E54] font-semibold">Moisture:</span>
                    <span className={cn(
                      "font-mono font-bold text-[10px]",
                      m.avgMoisture <= 15 ? "text-emerald-800" : "text-amber-800"
                    )}>
                      {m.avgMoisture}% {m.avgClaimMoisture > 0 && <span className="text-rose-700 font-semibold text-[9.5px]">(Clm {m.avgClaimMoisture}%)</span>}
                    </span>
                  </div>

                  {/* Grade Down % & Claim */}
                  <div className="flex items-center justify-between py-0.5 border-t border-[#F2EDE0]">
                    <span className="text-[10.5px] text-[#5A6E54] font-semibold">Grade Down:</span>
                    <span className="font-mono font-bold text-[10px] text-[#1E331B]">
                      {m.avgGradeDown}% {m.avgClaimGradeDown > 0 && <span className="text-rose-700 font-semibold text-[9.5px]">(Clm {m.avgClaimGradeDown}%)</span>}
                    </span>
                  </div>

                  {/* Premium (Payment Operations / Sauda Check Point) */}
                  <div className="flex items-center justify-between py-0.5 border-t border-[#F2EDE0] bg-amber-50/40 -mx-1 px-1 rounded">
                    <span className="text-[10px] text-amber-900 font-bold">⚡ Premium:</span>
                    <span className="font-mono font-bold text-[10px] text-amber-950">
                      {m.premiumLotsCount > 0 ? `${m.premiumLotsCount} MR (${m.premiumTotalSum > 0 ? `₹${formatIndianCurrency(m.premiumTotalSum)}` : `₹${m.avgPremiumRate}/Q`})` : '0'}
                    </span>
                  </div>
                </div>

                <div className="mt-2 pt-1 border-t border-dashed border-[#EAE2D2] text-[9px] font-bold text-[#1E331B] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
                  <span>Inspection Details</span>
                  <span className="text-[10px]">→</span>
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

      {/* 6. DRILLDOWN MODAL (INSPECTION, MOISTURE & CLAIMS) */}
      <InspectionDrilldownModal
        isOpen={inspModalOpen}
        onClose={() => setInspModalOpen(false)}
        title={inspModalTitle}
        subtitle={inspModalSubtitle}
        inspections={inspModalRecords}
      />

    </div>
  );
}
