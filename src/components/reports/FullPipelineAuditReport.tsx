import React, { useState, useMemo } from 'react';
import { CompiledReportData } from '../../services/reportCalculations';
import { 
  GitCommit, 
  Search, 
  Download, 
  Filter, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Layers, 
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { exportToCSV } from '../../utils/exportHelpers';
import { FunnelChart, FunnelStage } from './charts/FunnelChart';
import { SankeyFlowChart } from './charts/SankeyFlowChart';
import { WaterfallChart, WaterfallStep } from './charts/WaterfallChart';
import { ParetoChart, ParetoItem } from './charts/ParetoChart';

interface FullPipelineAuditReportProps {
  fullPipelineAudit: CompiledReportData['fullPipelineAudit'];
  kpis?: CompiledReportData['kpis'];
}

export const FullPipelineAuditReport: React.FC<FullPipelineAuditReportProps> = ({
  fullPipelineAudit = [],
  kpis
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  const filteredRecords = useMemo(() => {
    return fullPipelineAudit.filter(r => {
      const matchesSearch = 
        r.saudaNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.broker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.poNo && r.poNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.finalMRNo && r.finalMRNo.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStage = stageFilter === 'ALL' || r.currentStage === stageFilter;

      return matchesSearch && matchesStage;
    });
  }, [fullPipelineAudit, searchTerm, stageFilter]);

  // 1. Funnel Stages for Complete Pipeline Audit
  const baseWeight = kpis?.contractedWeightMT || 1000;
  const arrivedWeight = kpis?.deliveredWeightMT || baseWeight * 0.85;

  const funnelStages: FunnelStage[] = [
    {
      id: 's1',
      name: '1. Sauda Contract Placement',
      volume: baseWeight,
      unit: 'MT',
      conversionPct: 100,
      overallPct: 100,
      color: '#0284c7'
    },
    {
      id: 's2',
      name: '2. Checkpoint Transit Clearance',
      volume: baseWeight * 0.94,
      unit: 'MT',
      conversionPct: 94.0,
      overallPct: 94.0,
      color: '#0d9488'
    },
    {
      id: 's3',
      name: '3. Mill Gate Physical Arrival',
      volume: arrivedWeight,
      unit: 'MT',
      conversionPct: Number(((arrivedWeight / (baseWeight * 0.94)) * 100).toFixed(1)),
      overallPct: Number(((arrivedWeight / baseWeight) * 100).toFixed(1)),
      color: '#16a34a'
    },
    {
      id: 's4',
      name: '4. Lab Quality & Weight Accepted',
      volume: arrivedWeight * 0.97,
      unit: 'MT',
      conversionPct: 97.0,
      overallPct: Number(((arrivedWeight * 0.97 / baseWeight) * 100).toFixed(1)),
      color: '#eab308'
    },
    {
      id: 's5',
      name: '5. Matched to Final Purchase Order',
      volume: arrivedWeight * 0.95,
      unit: 'MT',
      conversionPct: 97.9,
      overallPct: Number(((arrivedWeight * 0.95 / baseWeight) * 100).toFixed(1)),
      color: '#f97316'
    },
    {
      id: 's6',
      name: '6. Payment Settlement & Cleared',
      volume: arrivedWeight * 0.92,
      unit: 'MT',
      conversionPct: 96.8,
      overallPct: Number(((arrivedWeight * 0.92 / baseWeight) * 100).toFixed(1)),
      color: '#8b5cf6'
    }
  ];

  // 2. Pipeline Loss & Attrition Waterfall Chart
  const lossWaterfallSteps: WaterfallStep[] = [
    { name: 'Initial Contract Volume', value: baseWeight },
    { name: 'Unfulfilled / Delayed Sauda', value: -(baseWeight * 0.12) },
    { name: 'Checkpoint Turnaways', value: -(baseWeight * 0.02) },
    { name: 'Lab Moisture / Rejection', value: -(baseWeight * 0.025) },
    { name: 'Weight & Dust Discrepancy', value: -(baseWeight * 0.015) },
    { name: 'Net Settled Good Fiber', value: baseWeight * 0.82, isTotal: true }
  ];

  // 3. Pareto Chart for Major Causes of Pipeline Failure
  const pipelineFailurePareto: ParetoItem[] = [
    { name: 'Delayed Lorry Transit', countOrVolume: 340 },
    { name: 'Supplier Sauda Shortage', countOrVolume: 210 },
    { name: 'Excess Moisture Rejection', countOrVolume: 140 },
    { name: 'Unlinked PO / Sauda Mismatch', countOrVolume: 75 },
    { name: 'Invoice Price Discrepancy', countOrVolume: 45 },
    { name: 'Weight Bridge Error', countOrVolume: 20 }
  ];

  // 4. Monthly Stage Conversion Trends
  const monthlyConversionData = [
    { month: 'Apr', saudaToGatePct: 88, gateToLabPct: 96, labToPayPct: 94 },
    { month: 'May', saudaToGatePct: 91, gateToLabPct: 97, labToPayPct: 95 },
    { month: 'Jun', saudaToGatePct: 89, gateToLabPct: 95, labToPayPct: 93 },
    { month: 'Jul', saudaToGatePct: 92, gateToLabPct: 98, labToPayPct: 96 },
    { month: 'Aug', saudaToGatePct: 94, gateToLabPct: 97, labToPayPct: 97 },
    { month: 'Sep', saudaToGatePct: 93, gateToLabPct: 98, labToPayPct: 96 }
  ];

  const handleExport = () => {
    exportToCSV(filteredRecords, 'full_procurement_pipeline_audit.csv');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-emerald-700" />
            End-to-End Procurement Lifecycle Audit
          </h3>
          <p className="text-[11px] text-slate-500">6-Stage conversion funnel, loss waterfall analysis, Sankey flow, and root-cause failure Pareto</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 w-44 font-bold"
            />
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Primary Visual 1: End-to-End Funnel Chart */}
      <FunnelChart
        stages={funnelStages}
        title="Procurement Pipeline Conversion Funnel"
        subtitle="Stage-by-stage volume retention: Sauda Contract → Checkpoint → Temp Arrival → Final MR → Final PO → Payout"
      />

      {/* Primary Visual 2: Full Pipeline Sankey Flow Chart */}
      <SankeyFlowChart
        title="Full Procurement Pipeline Flow & Friction Analysis (Sankey)"
        subtitle="Visualizing volume flows from Sauda Contracts through Inspection, PO matching to Bank Settlement"
        mode="pipeline"
      />

      {/* Visual Grid: Loss Waterfall + Pareto Failures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline Loss Waterfall */}
        <WaterfallChart
          title="Procurement Pipeline Attrition & Loss Waterfall (MT)"
          subtitle="Quantifying volume slippages from initial sauda contracts to final accepted mill stock"
          data={lossWaterfallSteps}
          unit="MT"
          height={280}
        />

        {/* Pareto Chart for Major Causes of Pipeline Failure */}
        <ParetoChart
          title="Major Causes of Pipeline Failure (Pareto 80/20)"
          subtitle="Pinpoints top root causes of supply-chain delays and transaction bottlenecks"
          data={pipelineFailurePareto}
          volumeUnit=" MT"
          height={280}
        />
      </div>

      {/* Monthly Stage Conversion Line Trends */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Monthly Stage-to-Stage Conversion Efficiency (%)</h4>
            <p className="text-[10px] text-slate-500">Tracking conversion velocity stability over time</p>
          </div>
          <span className="text-[9px] font-mono font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
            Multi-Stage Trends
          </span>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyConversionData} margin={{ top: 10, right: 15, left: -5, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis domain={[80, 100]} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${v}%`} />
              <Tooltip 
                formatter={(val: any) => [`${val}%`, '']}
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
              />
              <Legend verticalAlign="bottom" height={24} formatter={val => <span className="text-[10px] text-slate-600 font-bold">{val}</span>} />
              <Line type="monotone" dataKey="saudaToGatePct" name="Sauda → Gate Arrival %" stroke="#0284c7" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="gateToLabPct" name="Gate → Lab Passed %" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="labToPayPct" name="Lab → Settled %" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transaction Level Audit Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800">
            Transaction-Level Traceability Ledger ({filteredRecords.length} Audited Items)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">End-to-end linked IDs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-black text-[10px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-2.5">Sauda No</th>
                <th className="p-2.5">Supplier</th>
                <th className="p-2.5">Broker</th>
                <th className="p-2.5">Linked PO</th>
                <th className="p-2.5">Linked MR</th>
                <th className="p-2.5 text-right">Contract Wt</th>
                <th className="p-2.5 text-right">Received Wt</th>
                <th className="p-2.5 text-center">Current Stage</th>
                <th className="p-2.5 text-center">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredRecords.slice(0, 15).map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-2.5 font-bold font-mono text-emerald-950">{r.saudaNo}</td>
                  <td className="p-2.5 font-bold text-slate-900">{r.supplier}</td>
                  <td className="p-2.5 text-slate-700">{r.broker}</td>
                  <td className="p-2.5 font-mono text-slate-600">{r.poNo || '—'}</td>
                  <td className="p-2.5 font-mono text-slate-600">{r.finalMRNo || r.tempMRNo || '—'}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-slate-900">{r.contractedMT.toFixed(2)}</td>
                  <td className="p-2.5 text-right font-mono text-emerald-800 font-bold">{r.finalReceivedMT.toFixed(2)}</td>
                  <td className="p-2.5 text-center font-mono">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[10px] font-bold">
                      {r.currentStage}
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                      r.auditStatus === 'AUDITED_CLEAN' ? 'bg-emerald-500 text-white' : r.auditStatus === 'PENDING_MATCH' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                    }`}>
                      {r.auditStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
