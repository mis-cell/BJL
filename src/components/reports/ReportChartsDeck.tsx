import React from 'react';
import { CompiledReportData } from '../../services/reportCalculations';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ComposedChart
} from 'recharts';
import { PieChart as PieIcon, BarChart3, TrendingUp, Layers } from 'lucide-react';

interface ReportChartsDeckProps {
  reportData: CompiledReportData;
}

const PIE_COLORS = ['#059669', '#d97706', '#6366f1', '#e11d48'];

export const ReportChartsDeck: React.FC<ReportChartsDeckProps> = ({ reportData }) => {
  const { kpis, brokerSummary, monthWisePerformance, gradeItemSummary, ageingDistribution } = reportData;

  const pieData = [
    { name: 'Delivered', value: kpis.deliveredWeightMT, color: '#059669' },
    { name: 'Pending', value: kpis.pendingWeightMT, color: '#d97706' },
    ...(kpis.excessWeightMT > 0 ? [{ name: 'Excess', value: kpis.excessWeightMT, color: '#6366f1' }] : []),
    ...(kpis.cancelledWeightMT > 0 ? [{ name: 'Cancelled', value: kpis.cancelledWeightMT, color: '#e11d48' }] : [])
  ];

  const topBrokersData = brokerSummary.slice(0, 6).map(b => ({
    name: b.broker.length > 12 ? `${b.broker.substring(0, 10)}...` : b.broker,
    deliveredMT: b.deliveredWeightMT,
    pendingMT: b.pendingWeightMT,
    deliveredPct: b.deliveredPct
  }));

  const monthlyTrendData = monthWisePerformance.map(m => ({
    month: m.monthLabel.split(' ')[0],
    deliveredMT: m.deliveredMT,
    contractedMT: m.newContractedMT,
    deliveredPct: m.deliveredPct
  }));

  const gradeData = gradeItemSummary.slice(0, 5).map(g => ({
    name: g.grade,
    deliveredMT: g.deliveredWeightMT,
    pendingMT: g.pendingWeightMT
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Chart 1: Delivery vs Pending Doughnut */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-black uppercase text-slate-700 tracking-wider">
            <span className="flex items-center gap-1.5">
              <PieIcon className="w-3.5 h-3.5 text-emerald-700" />
              Weight Fulfilled Distribution
            </span>
            <span className="text-[10px] font-mono text-emerald-700 font-bold">{kpis.deliveredPct}% Complete</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`${Number(value).toFixed(2)} MT`, 'Volume']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={30} 
                  formatter={(val) => <span className="text-[10px] text-slate-600 font-bold">{val}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Top Brokers Stacked Delivery */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-black uppercase text-slate-700 tracking-wider">
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-700" />
              Top Broker Delivery Volumes (MT)
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBrokersData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' }} />
                <Legend verticalAlign="bottom" height={30} formatter={(val) => <span className="text-[10px] text-slate-600 font-bold">{val}</span>} />
                <Bar dataKey="deliveredMT" name="Delivered MT" fill="#059669" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pendingMT" name="Pending MT" fill="#d97706" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Month-Wise Delivery Trend */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-black uppercase text-slate-700 tracking-wider">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
              Monthly Procurement Trend (MT)
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' }} />
                <Legend verticalAlign="bottom" height={30} formatter={(val) => <span className="text-[10px] text-slate-600 font-bold">{val}</span>} />
                <Line type="monotone" dataKey="contractedMT" name="Contracted MT" stroke="#334155" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="deliveredMT" name="Delivered MT" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
