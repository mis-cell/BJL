import React from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Package, FileText, Users, AlertTriangle,
  Clock, ShieldAlert, Award, Layers, BarChart3, CheckCircle2, ChevronRight
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { SystemReportDataset, ReportTransactionLine, groupTransactionsByDimension } from '../../services/systemReportEngine';

interface Priority1DashboardProps {
  dataset: SystemReportDataset;
  onDrillDown: (title: string, txns: ReportTransactionLine[]) => void;
}

export const Priority1Dashboard: React.FC<Priority1DashboardProps> = ({
  dataset,
  onDrillDown
}) => {
  const { metrics, filtered } = dataset;

  // Monthly Trend Chart Data
  const monthlyData = React.useMemo(() => {
    return groupTransactionsByDimension(filtered, 'month').slice(0, 12).map(m => ({
      month: m.key,
      volumeMT: Number(m.quantityMT.toFixed(1)),
      valueLakh: Number((m.purchaseValue / 100000).toFixed(2)),
      profitLakh: Number((m.grossProfit / 100000).toFixed(2)),
      avgRate: Math.round(m.avgPurchaseRate),
      baseRate: Math.round(m.avgBaseRate)
    }));
  }, [filtered]);

  // Grade Share Data
  const gradeData = React.useMemo(() => {
    return groupTransactionsByDimension(filtered, 'grade').map(g => ({
      name: g.key,
      quantityMT: Number(g.quantityMT.toFixed(1)),
      profit: Math.round(g.grossProfit)
    }));
  }, [filtered]);

  return (
    <div className="space-y-6 font-sans">
      
      {/* ================= SECTION A: SOURCING FOOTPRINT ================= */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Sourcing Footprint
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">SAUDA CHECK POINT // PRIORITY 1</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {/* 1. Total Quantity */}
          <div 
            onClick={() => onDrillDown('All Sauda Quantities (Sauda Check Point)', filtered)}
            className="p-3 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl shadow-xs transition hover:shadow-sm cursor-pointer group"
          >
            <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Total Quantity</span>
            <div className="text-sm font-black text-slate-900 mt-1 font-mono truncate">
              {metrics.totalQuantityMT.toFixed(2)} MT
            </div>
            <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5 mt-1">
              View All <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>

          {/* 2. Total PO */}
          <div 
            onClick={() => onDrillDown('All Purchase Orders (Sauda Check Point)', filtered.filter(t => t.poNo && t.poNo !== 'Pending P.O.' && t.poNo !== '-'))}
            className="p-3 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl shadow-xs transition hover:shadow-sm cursor-pointer group"
          >
            <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Total PO</span>
            <div className="text-sm font-black text-emerald-950 mt-1 font-mono">
              {metrics.totalPOCount} POs
            </div>
            <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5 mt-1">
              View All <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>

          {/* 3. Total Supplier */}
          <div 
            onClick={() => onDrillDown('All Suppliers (Sauda Check Point)', filtered.filter(t => t.supplier && t.supplier !== 'Unassigned Supplier' && t.supplier !== '-'))}
            className="p-3 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl shadow-xs transition hover:shadow-sm cursor-pointer group"
          >
            <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Total Supplier</span>
            <div className="text-sm font-black text-indigo-950 mt-1 font-mono">
              {metrics.totalSupplierCount} Active
            </div>
            <span className="text-[9px] text-indigo-600 font-bold flex items-center gap-0.5 mt-1">
              View All <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>

          {/* 4. Total Broker */}
          <div 
            onClick={() => onDrillDown('All Brokers (Sauda Check Point)', filtered.filter(t => t.broker && t.broker !== 'Direct' && t.broker !== '-'))}
            className="p-3 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl shadow-xs transition hover:shadow-sm cursor-pointer group"
          >
            <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Total Broker</span>
            <div className="text-sm font-black text-indigo-950 mt-1 font-mono">
              {metrics.totalBrokerCount} Brokers
            </div>
            <span className="text-[9px] text-indigo-600 font-bold flex items-center gap-0.5 mt-1">
              View All <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>

          {/* 5. Total Agency */}
          <div 
            onClick={() => onDrillDown('All Agencies (Sauda Check Point)', filtered.filter(t => t.agency && t.agency !== '-'))}
            className="p-3 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl shadow-xs transition hover:shadow-sm cursor-pointer group"
          >
            <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Total Agency</span>
            <div className="text-sm font-black text-slate-800 mt-1 font-mono">
              {metrics.totalAgencyCount} Agencies
            </div>
            <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5 mt-1">
              View All <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>

          {/* 6. Total Area */}
          <div 
            onClick={() => onDrillDown('All Sourcing Areas / Belts (Sauda Check Point)', filtered.filter(t => t.area && t.area !== '-'))}
            className="p-3 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl shadow-xs transition hover:shadow-sm cursor-pointer group"
          >
            <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Total Area</span>
            <div className="text-sm font-black text-slate-800 mt-1 font-mono">
              {metrics.totalAreaCount} Belts
            </div>
            <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5 mt-1">
              View All <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>

          {/* 7. Total Grade */}
          <div 
            onClick={() => onDrillDown('All Quality Grades (Sauda Check Point)', filtered.filter(t => t.grade && t.grade !== '-'))}
            className="p-3 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl shadow-xs transition hover:shadow-sm cursor-pointer group"
          >
            <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Total Grade</span>
            <div className="text-sm font-black text-slate-800 mt-1 font-mono">
              {metrics.totalGradeCount} Grades
            </div>
            <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5 mt-1">
              View All <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </div>

      {/* ================= SECTION B: FINANCIAL SUMMARY ================= */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              B. Financial & Commercial Profitability Summary
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">LANDED MARGIN ENGINE</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {/* Purchase Value */}
          <div className="p-3.5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl shadow-sm">
            <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Purchase Value</span>
            <div className="text-base font-black font-mono mt-1">
              ₹{metrics.totalPurchaseValue.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-400 font-mono mt-1 block">
              Avg: ₹{metrics.weightedPurchaseRate.toFixed(2)}/Qtl
            </span>
          </div>

          {/* Premium */}
          <div 
            onClick={() => onDrillDown('Transactions with Premium', filtered.filter(t => t.premiumAmount > 0))}
            className="p-3.5 bg-white border border-amber-200 rounded-xl shadow-sm hover:shadow transition cursor-pointer"
          >
            <span className="text-[9.5px] font-bold text-amber-700 uppercase block">Total Premium Paid</span>
            <div className="text-base font-black text-amber-800 font-mono mt-1">
              ₹{metrics.totalPremium.toLocaleString()}
            </div>
            <span className="text-[10px] text-amber-600 font-mono mt-1 block">
              Above Base Rate
            </span>
          </div>

          {/* Deduction */}
          <div 
            onClick={() => onDrillDown('Transactions with Deductions', filtered.filter(t => t.deductionAmount > 0))}
            className="p-3.5 bg-white border border-rose-200 rounded-xl shadow-sm hover:shadow transition cursor-pointer"
          >
            <span className="text-[9.5px] font-bold text-rose-700 uppercase block">Total Deductions</span>
            <div className="text-base font-black text-rose-800 font-mono mt-1">
              ₹{metrics.totalDeduction.toLocaleString()}
            </div>
            <span className="text-[10px] text-rose-600 font-mono mt-1 block">
              Moisture & Quality
            </span>
          </div>

          {/* Gross Profit */}
          <div className="p-3.5 bg-gradient-to-br from-emerald-900 to-green-950 text-white rounded-xl shadow-sm">
            <span className="text-[9.5px] font-bold text-emerald-300 uppercase block">Gross Margin / Profit</span>
            <div className={`text-base font-black font-mono mt-1 ${metrics.grossProfit >= 0 ? 'text-yellow-300' : 'text-rose-300'}`}>
              ₹{metrics.grossProfit.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-200 font-mono mt-1 block">
              Margin: {metrics.profitMarginPct.toFixed(2)}%
            </span>
          </div>

          {/* Loss / Non-Profitable */}
          <div 
            onClick={() => onDrillDown('Loss-Making Contracts', filtered.filter(t => t.grossProfit < 0))}
            className="p-3.5 bg-white border border-red-300 rounded-xl shadow-sm hover:shadow transition cursor-pointer"
          >
            <span className="text-[9.5px] font-bold text-rose-700 uppercase block">Loss-Making Volume</span>
            <div className="text-base font-black text-rose-700 font-mono mt-1">
              ₹{metrics.totalLoss.toLocaleString()}
            </div>
            <span className="text-[10px] text-rose-600 font-bold mt-1 block">
              {metrics.lossMakingCount} Saudas in Negative
            </span>
          </div>
        </div>

        {/* Secondary Financial Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2.5">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono flex justify-between items-center">
            <span className="text-slate-500">Disbursed Payment:</span>
            <strong className="text-slate-800">₹{metrics.totalPayment.toLocaleString()}</strong>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono flex justify-between items-center">
            <span className="text-slate-500">Total Claims:</span>
            <strong className="text-slate-800">₹{metrics.totalClaim.toLocaleString()}</strong>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono flex justify-between items-center">
            <span className="text-slate-500">Total Settlements:</span>
            <strong className="text-slate-800">₹{metrics.totalSettlement.toLocaleString()}</strong>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono flex justify-between items-center">
            <span className="text-slate-500">Weighted Base Rate:</span>
            <strong className="text-emerald-800">₹{metrics.weightedBaseRate.toFixed(2)}/Qtl</strong>
          </div>
        </div>
      </div>

      {/* ================= SECTION C: OPERATIONAL SUMMARY ================= */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              C. Operational Pipeline & Gate Status
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">FLOW: SAUDA → AMAD → INSP → PAY</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          <div 
            onClick={() => onDrillDown('Sauda Pending Delivery', filtered.filter(t => t.pendingWeightMT > 0))}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-amber-500 transition cursor-pointer"
          >
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Sauda Pending</span>
            <div className="text-sm font-black text-amber-700 font-mono mt-1">
              {metrics.pendingDeliveryMT.toFixed(2)} MT
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">{metrics.saudaPendingCount} Contracts</span>
          </div>

          <div 
            onClick={() => onDrillDown('Temporary Arrival Pending', filtered.filter(t => t.arrivalStatus === 'PENDING'))}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-amber-500 transition cursor-pointer"
          >
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Amad Pending</span>
            <div className="text-sm font-black text-slate-800 font-mono mt-1">
              {metrics.temporaryArrivalPendingCount}
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">Gate Entry</span>
          </div>

          <div 
            onClick={() => onDrillDown('Final Arrival Pending', filtered.filter(t => t.arrivalStatus === 'IN_TRANSIT'))}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-amber-500 transition cursor-pointer"
          >
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Final Arrival Pending</span>
            <div className="text-sm font-black text-slate-800 font-mono mt-1">
              {metrics.finalArrivalPendingCount}
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">Weighbridge</span>
          </div>

          <div 
            onClick={() => onDrillDown('Mill Inspection Pending', filtered.filter(t => t.inspectionStatus === 'PENDING'))}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-amber-500 transition cursor-pointer"
          >
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Inspection Pending</span>
            <div className="text-sm font-black text-slate-800 font-mono mt-1">
              {metrics.millInspectionPendingCount}
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">Quality Lab</span>
          </div>

          <div 
            onClick={() => onDrillDown('Payment Pending', filtered.filter(t => t.paymentStatus !== 'PAID'))}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-amber-500 transition cursor-pointer"
          >
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Payment Pending</span>
            <div className="text-sm font-black text-blue-700 font-mono mt-1">
              {metrics.paymentPendingCount}
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">Vouchers</span>
          </div>

          <div 
            onClick={() => onDrillDown('Settlement Pending', filtered.filter(t => t.settlementStatus !== 'SETTLED'))}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-amber-500 transition cursor-pointer"
          >
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Settlement Pending</span>
            <div className="text-sm font-black text-indigo-700 font-mono mt-1">
              {metrics.settlementPendingCount}
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">Final Clearance</span>
          </div>
        </div>
      </div>

      {/* ================= SECTION D: EXCEPTION / ALERT SUMMARY ================= */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
            <h3 className="text-xs font-black uppercase tracking-wider text-rose-900">
              D. Exception & Alert Summary (Business Rule Violations)
            </h3>
          </div>
          <span className="text-[10px] text-rose-600 font-bold font-mono">ACTION REQUIRED</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
          <div 
            onClick={() => onDrillDown('All Abnormal Transactions', filtered.filter(t => t.isAbnormal))}
            className="p-3 bg-rose-50 border border-rose-200 rounded-xl shadow-sm hover:bg-rose-100 transition cursor-pointer"
          >
            <span className="text-[9px] font-black text-rose-800 uppercase block">Abnormal Data</span>
            <div className="text-base font-black text-rose-900 font-mono mt-1">
              {metrics.abnormalCount}
            </div>
            <span className="text-[8.5px] text-rose-600 block mt-0.5">Total Violations</span>
          </div>

          <div 
            onClick={() => onDrillDown('High Deduction Lots', filtered.filter(t => t.deductionPct > 2))}
            className="p-3 bg-white border border-rose-200 rounded-xl shadow-sm hover:bg-rose-50 transition cursor-pointer"
          >
            <span className="text-[9px] font-black text-slate-600 uppercase block">High Deduction</span>
            <div className="text-base font-black text-rose-700 font-mono mt-1">
              {metrics.highDeductionCount}
            </div>
            <span className="text-[8.5px] text-slate-400 block mt-0.5">&gt;2% Cut</span>
          </div>

          <div 
            onClick={() => onDrillDown('High Premium Lots', filtered.filter(t => t.rateVariance > 100))}
            className="p-3 bg-white border border-amber-200 rounded-xl shadow-sm hover:bg-amber-50 transition cursor-pointer"
          >
            <span className="text-[9px] font-black text-slate-600 uppercase block">High Premium</span>
            <div className="text-base font-black text-amber-700 font-mono mt-1">
              {metrics.highPremiumCount}
            </div>
            <span className="text-[8.5px] text-slate-400 block mt-0.5">&gt;₹100/Qtl</span>
          </div>

          <div 
            onClick={() => onDrillDown('High Moisture Lots', filtered.filter(t => t.moisturePct > 18))}
            className="p-3 bg-white border border-blue-200 rounded-xl shadow-sm hover:bg-blue-50 transition cursor-pointer"
          >
            <span className="text-[9px] font-black text-slate-600 uppercase block">High Moisture</span>
            <div className="text-base font-black text-blue-700 font-mono mt-1">
              {metrics.highMoistureCount}
            </div>
            <span className="text-[8.5px] text-slate-400 block mt-0.5">&gt;18.0%</span>
          </div>

          <div 
            onClick={() => onDrillDown('Grade Down Lots', filtered.filter(t => t.gradeDownQty > 0))}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition cursor-pointer"
          >
            <span className="text-[9px] font-black text-slate-600 uppercase block">Grade Down</span>
            <div className="text-base font-black text-slate-800 font-mono mt-1">
              {metrics.gradeDownCount}
            </div>
            <span className="text-[8.5px] text-slate-400 block mt-0.5">Demotions</span>
          </div>

          <div 
            onClick={() => onDrillDown('High Claims', filtered.filter(t => t.claimAmount > 5000))}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition cursor-pointer"
          >
            <span className="text-[9px] font-black text-slate-600 uppercase block">High Claim</span>
            <div className="text-base font-black text-slate-800 font-mono mt-1">
              {metrics.highClaimCount}
            </div>
            <span className="text-[8.5px] text-slate-400 block mt-0.5">&gt;₹5,000</span>
          </div>

          <div 
            onClick={() => onDrillDown('Loss-Making Deals', filtered.filter(t => t.grossProfit < 0))}
            className="p-3 bg-rose-50 border border-rose-300 rounded-xl shadow-sm hover:bg-rose-100 transition cursor-pointer"
          >
            <span className="text-[9px] font-black text-rose-800 uppercase block">Loss Sauda</span>
            <div className="text-base font-black text-rose-700 font-mono mt-1">
              {metrics.lossMakingCount}
            </div>
            <span className="text-[8.5px] text-rose-600 block mt-0.5">Negative Margin</span>
          </div>

          <div 
            onClick={() => onDrillDown('Delayed Overdue Contracts', filtered.filter(t => t.isDelayed))}
            className="p-3 bg-amber-50 border border-amber-300 rounded-xl shadow-sm hover:bg-amber-100 transition cursor-pointer"
          >
            <span className="text-[9px] font-black text-amber-800 uppercase block">Delayed Deals</span>
            <div className="text-base font-black text-amber-800 font-mono mt-1">
              {metrics.delayedCount}
            </div>
            <span className="text-[8.5px] text-amber-700 block mt-0.5">Overdue Delivery</span>
          </div>
        </div>
      </div>

      {/* ================= CHARTS OVERVIEW ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
        
        {/* Month-on-Month Volume & Profit Trend */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Monthly Sourcing Volume & Landed Margin Trend
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">Volume (MT) vs Profit (₹ Lakh)</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar yAxisId="left" dataKey="volumeMT" name="Volume (MT)" fill="#0f766e" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="profitLakh" name="Profit (₹ Lakh)" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Purchase Rate vs Base Rate Comparison */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Purchase Rate vs. Satta Base Rate Benchmark
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">₹/Qtl Variance Tracking</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 100', 'dataMax + 100']} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line type="monotone" dataKey="avgRate" name="Actual Purchase Rate" stroke="#1e293b" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="baseRate" name="Satta Base Rate" stroke="#059669" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
};
