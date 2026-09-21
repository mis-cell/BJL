import React from 'react';
import { CompiledReportData } from '../../services/reportCalculations';
import { 
  FileText, 
  Scale, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  ShieldCheck, 
  XCircle, 
  Truck,
  ArrowUpRight,
  PieChart as PieChartIcon
} from 'lucide-react';

interface PercentageKPISectionProps {
  kpis: CompiledReportData['kpis'];
  onCardClick?: (kpiType: string) => void;
}

export const PercentageKPISection: React.FC<PercentageKPISectionProps> = ({ kpis, onCardClick }) => {
  return (
    <div className="space-y-3.5">
      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {/* Total Contracts */}
        <div 
          onClick={() => onCardClick?.('total_contracts')}
          className="bg-white border border-slate-200 rounded-lg p-3 hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Total Contracts</span>
            <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono tracking-tight">{kpis.totalContracts}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-1">
            <span>{kpis.fullyDeliveredContracts} Completed</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-bold">{kpis.fullyDeliveredPct}%</span>
          </div>
        </div>

        {/* Contracted Weight */}
        <div 
          onClick={() => onCardClick?.('contracted_wt')}
          className="bg-white border border-slate-200 rounded-lg p-3 hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Contracted Wt</span>
            <Scale className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono tracking-tight">{kpis.contractedWeightMT.toLocaleString()} <span className="text-xs font-normal text-slate-500">MT</span></div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">
            Base procurement volume
          </div>
        </div>

        {/* Delivered Weight & % */}
        <div 
          onClick={() => onCardClick?.('delivered_wt')}
          className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800">Delivered Wt</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-950 font-mono tracking-tight">{kpis.deliveredWeightMT.toLocaleString()} <span className="text-xs font-normal text-emerald-700">MT</span></div>
          <div className="text-[10px] text-emerald-800 font-bold mt-0.5 flex items-center justify-between">
            <span>Fulfilled</span>
            <span className="bg-emerald-200/60 px-1.5 py-0.2 rounded text-[10px]">{kpis.deliveredPct}%</span>
          </div>
        </div>

        {/* Pending Weight & % */}
        <div 
          onClick={() => onCardClick?.('pending_wt')}
          className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-800">Pending Wt</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-950 font-mono tracking-tight">{kpis.pendingWeightMT.toLocaleString()} <span className="text-xs font-normal text-amber-700">MT</span></div>
          <div className="text-[10px] text-amber-800 font-bold mt-0.5 flex items-center justify-between">
            <span>To Deliver</span>
            <span className="bg-amber-200/60 px-1.5 py-0.2 rounded text-[10px]">{kpis.pendingPct}%</span>
          </div>
        </div>

        {/* On-Time Delivery % */}
        <div 
          onClick={() => onCardClick?.('on_time')}
          className="bg-white border border-slate-200 rounded-lg p-3 hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">On-Time %</span>
            <Truck className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono tracking-tight">{kpis.onTimePct}%</div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center justify-between">
            <span>Delayed: {kpis.delayedPct}%</span>
          </div>
        </div>

        {/* Payment Completion % */}
        <div 
          onClick={() => onCardClick?.('payment_pct')}
          className="bg-white border border-slate-200 rounded-lg p-3 hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Payment %</span>
            <DollarSign className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono tracking-tight">{kpis.paymentCompletionPct}%</div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center justify-between">
            <span>Settled: {kpis.settlementCompletionPct}%</span>
          </div>
        </div>
      </div>

      {/* Progress Bar with Exact Stacked Visual Representation */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-black uppercase text-slate-700 tracking-wider text-[11px] flex items-center gap-1.5">
            <PieChartIcon className="w-3.5 h-3.5 text-emerald-700" />
            Overall Sauda Progress & Weight Distribution
          </span>
          <div className="flex items-center gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
              Delivered: {kpis.deliveredPct}% ({kpis.deliveredWeightMT.toLocaleString()} MT)
            </span>
            <span className="flex items-center gap-1 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
              Pending: {kpis.pendingPct}% ({kpis.pendingWeightMT.toLocaleString()} MT)
            </span>
            {kpis.excessWeightMT > 0 && (
              <span className="flex items-center gap-1 text-indigo-700">
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                Excess: {kpis.excessPct}% ({kpis.excessWeightMT.toLocaleString()} MT)
              </span>
            )}
            {kpis.cancelledWeightMT > 0 && (
              <span className="flex items-center gap-1 text-rose-700">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                Cancelled: {kpis.cancelledPct}% ({kpis.cancelledWeightMT.toLocaleString()} MT)
              </span>
            )}
          </div>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/80 shadow-inner">
          <div 
            style={{ width: `${Math.min(100, kpis.deliveredPct)}%` }} 
            className="bg-emerald-600 h-full transition-all duration-500 relative"
            title={`Delivered: ${kpis.deliveredWeightMT} MT (${kpis.deliveredPct}%)`}
          />
          <div 
            style={{ width: `${Math.min(100 - kpis.deliveredPct, kpis.pendingPct)}%` }} 
            className="bg-amber-400 h-full transition-all duration-500"
            title={`Pending: ${kpis.pendingWeightMT} MT (${kpis.pendingPct}%)`}
          />
          {kpis.cancelledPct > 0 && (
            <div 
              style={{ width: `${kpis.cancelledPct}%` }} 
              className="bg-rose-400 h-full transition-all duration-500"
              title={`Cancelled: ${kpis.cancelledWeightMT} MT (${kpis.cancelledPct}%)`}
            />
          )}
        </div>

        {/* Breakdown Sub-metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-[10px] font-mono">
          <div className="flex justify-between px-2 py-1 bg-slate-50 rounded">
            <span className="text-slate-500 font-sans">Avg Contract Rate:</span>
            <span className="font-bold text-slate-800">₹{kpis.avgContractRate.toLocaleString()}/Qtl</span>
          </div>
          <div className="flex justify-between px-2 py-1 bg-slate-50 rounded">
            <span className="text-slate-500 font-sans">Total Contract Value:</span>
            <span className="font-bold text-slate-800">₹{(kpis.totalContractValue / 100000).toFixed(2)} Lakhs</span>
          </div>
          <div className="flex justify-between px-2 py-1 bg-slate-50 rounded">
            <span className="text-slate-500 font-sans">Total Dispatched Value:</span>
            <span className="font-bold text-emerald-800">₹{(kpis.totalDispatchedValue / 100000).toFixed(2)} Lakhs</span>
          </div>
          <div className="flex justify-between px-2 py-1 bg-slate-50 rounded">
            <span className="text-slate-500 font-sans">Contracts Status:</span>
            <span className="font-bold text-slate-800">{kpis.fullyDeliveredContracts} Full / {kpis.partiallyDeliveredContracts} Part / {kpis.notStartedContracts} New</span>
          </div>
        </div>
      </div>
    </div>
  );
};
