import React, { useState } from 'react';
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
  Legend 
} from 'recharts';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LegacyFieldset } from '../LegacyLayout';
import QuickReport from '../QuickReport';
import { QuickReportState } from './types';

export interface AnalyticalInsightsConsoleProps {
  arrivalTrendsData: any[];
  poDistributionData: any[];
  settlementPieData: any[];
  gradeArrivalTrendsData: { trends: any[]; grades: string[] };
  gradeStockLevelsData: any[];
  quickReportData: QuickReportState;
  loadStats: () => void;
  onNavigate: (page: any, subId?: string) => void | Promise<boolean>;
  recentAmad: any[];
}

export default function AnalyticalInsightsConsole({
  arrivalTrendsData,
  poDistributionData,
  settlementPieData,
  gradeArrivalTrendsData,
  gradeStockLevelsData,
  quickReportData,
  loadStats,
  onNavigate,
  recentAmad
}: AnalyticalInsightsConsoleProps) {
  const [activeChartTab, setActiveChartTab] = useState<'general' | 'grades'>('general');

  return (
    <div className="space-y-6">
      {/* Analytical Insights Recharts Consoles */}
      <LegacyFieldset legend="Analytical Insights Console">
        <div className="flex border-b border-slate-200 mb-4 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveChartTab('general')}
            className={cn(
              "px-4 py-2.5 text-[10px] uppercase tracking-wider font-black border-b-2 transition-all cursor-pointer whitespace-nowrap",
              activeChartTab === 'general' 
                ? "border-blue-600 text-blue-600 bg-blue-50/20" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            📁 Bales, Regions & Settlements
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('grades')}
            className={cn(
              "px-4 py-2.5 text-[10px] uppercase tracking-wider font-black border-b-2 transition-all cursor-pointer whitespace-nowrap",
              activeChartTab === 'grades' 
                ? "border-emerald-500 text-emerald-600 bg-emerald-50/20" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            🏷️ Jute Grade Stocks & Inspections
          </button>
        </div>

        {activeChartTab === 'general' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-1 ">
            {/* Chart 1: Arrival Trends */}
            <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-sm">
              <h4 className="text-[10px] font-black uppercase text-indigo-950 mb-2 tracking-wider flex items-center gap-1 border-b pb-1">
                📈 Station Arrival Trends (Packets/Day)
              </h4>
              <div className="h-44 w-full">
                {arrivalTrendsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                    <BarChart data={arrivalTrendsData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 7 }} />
                      <YAxis tick={{ fontSize: 7 }} />
                      <Tooltip contentStyle={{ fontSize: 8, fontWeight: 'bold' }} />
                      <Bar dataKey="packets" fill="#2563eb" radius={[1, 1, 0, 0]} name="Bale Packets" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 italic text-[9px]">
                    No recent arrivals loaded...
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: PO Regional Contract Volume Distribution */}
            <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-sm">
              <h4 className="text-[10px] font-black uppercase text-indigo-950 mb-2 tracking-wider flex items-center gap-1 border-b pb-1">
                📂 PO Contract Weight by Region (MT Tons)
              </h4>
              <div className="h-44 w-full">
                {poDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                    <AreaChart data={poDistributionData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 6.5, width: 50 }} interval={0} />
                      <YAxis tick={{ fontSize: 7 }} />
                      <Tooltip contentStyle={{ fontSize: 8, fontWeight: 'bold' }} />
                      <Area type="monotone" dataKey="weight" stroke="#4f46e5" fill="#e0e7ff" name="Contract Weight" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 italic text-[9px]">
                    No historical PO contracts area distribution...
                  </div>
                )}
              </div>
            </div>

            {/* Chart 3: Settlement Payment Status Breakdown */}
            <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-sm">
              <h4 className="text-[10px] font-black uppercase text-indigo-950 mb-2 tracking-wider flex items-center gap-1 border-b pb-1">
                ⚖️ Claim Settlement Payments Status Summary
              </h4>
              <div className="h-44 w-full flex items-center justify-center">
                {settlementPieData.length > 0 ? (
                  <>
                    <div className="w-1/2 h-full">
                      <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                        <PieChart>
                          <Pie
                            data={settlementPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={28}
                            outerRadius={45}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {settlementPieData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 8, fontWeight: 'bold' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-1/2 space-y-1.5 pl-1 shrink-0">
                      {settlementPieData.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1 text-[8.5px] font-black leading-none">
                          <div className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-500 uppercase truncate" style={{ maxWidth: '60px' }}>{item.name}:</span>
                          <span className="text-slate-900 font-mono font-extrabold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 italic text-[9px]">
                    No records in claim settlement nodes.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-1 ">
            {/* Grade-wise Arrival Trends Stacked */}
            <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-sm md:col-span-2">
              <h4 className="text-[10px] font-black uppercase text-indigo-950 mb-2 tracking-wider flex items-center justify-between border-b pb-1">
                <span>📈 Station Arrival Volume Trends by Grade (MT Tons)</span>
              </h4>
              <div className="h-44 w-full">
                {gradeArrivalTrendsData.trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                    <BarChart data={gradeArrivalTrendsData.trends} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 7 }} />
                      <YAxis tick={{ fontSize: 7 }} />
                      <Tooltip contentStyle={{ fontSize: 8, fontWeight: 'bold' }} />
                      <Legend wrapperStyle={{ fontSize: 7.5, fontWeight: 'bold' }} />
                      {gradeArrivalTrendsData.grades.map((grade, idx) => {
                        const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];
                        return (
                          <Bar key={grade} dataKey={grade} stackId="a" fill={COLORS[idx % COLORS.length]} name={grade} />
                        );
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 italic text-[9px]">
                    No recent grade arrivals tracked. Keep loading Material Quality inspections first.
                  </div>
                )}
              </div>
            </div>

            {/* Grade-wise Stock Levels Bar */}
            <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-sm">
              <h4 className="text-[10px] font-black uppercase text-indigo-950 mb-2 tracking-wider flex items-center justify-between border-b pb-1">
                <span>📦 Warehouse Stock Levels (Bales)</span>
              </h4>
              <div className="h-44 w-full">
                {gradeStockLevelsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                    <BarChart data={gradeStockLevelsData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="grade" tick={{ fontSize: 7 }} />
                      <YAxis tick={{ fontSize: 7 }} />
                      <Tooltip contentStyle={{ fontSize: 8, fontWeight: 'bold' }} />
                      <Bar dataKey="quantity" fill="#ec4899" radius={[1, 1, 0, 0]} name="Bales Quantity" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 italic text-[9px]">
                    No stock records found in Stock Inventory. Use "Stock Inventory" console to create opening stock entries.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </LegacyFieldset>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Report Widget */}
          <QuickReport
            totalArrivals={quickReportData.totalArrivals}
            pendingMrSettlements={quickReportData.pendingMrSettlements}
            totalPackets={quickReportData.totalPackets}
            totalWeightQtl={quickReportData.totalWeightQtl}
            loading={quickReportData.loading}
            onRefresh={loadStats}
            onNavigate={onNavigate}
          />

          {/* Dynamic Activity Ledger */}
          <LegacyFieldset legend="Arrivals Activity Log Ledger">
            <div className="bg-white border border-slate-300 shadow-sm rounded-xl overflow-x-auto min-h-[220px]">
              <table className="w-full text-left text-[10px] font-bold border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5 border-r border-slate-100">Time</th>
                    <th className="px-3 py-2.5 border-r border-slate-100">Lorry Number</th>
                    <th className="px-3 py-2.5 border-r border-slate-100">Vyapari Name</th>
                    <th className="px-3 py-2.5 border-r border-slate-100">Station</th>
                    <th className="px-3 py-2.5 border-r border-slate-100">Qty (Bale)</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentAmad.length > 0 ? recentAmad.map((row, i) => {
                    const safeCell = (v: any, fallback = '...') => {
                      if (v === null || v === undefined) return fallback;
                      if (typeof v === 'object') return v.name || v.title || JSON.stringify(v);
                      return String(v);
                    };

                    return (
                      <tr key={i} className="hover:bg-slate-50 cursor-default transition-colors">
                        <td className="px-3 py-2.5 border-r border-slate-100 text-slate-400 font-mono italic">
                          {row.created_at && !isNaN(new Date(row.created_at).getTime()) ? new Date(row.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-100">{safeCell(row.truck_no || row.lorry_number || row.vehicle_no, '-')}</td>
                        <td className="px-3 py-2.5 border-r border-slate-100 text-indigo-950 font-extrabold">{safeCell(row.vyapari_name || row.supplier, 'LOCAL')}</td>
                        <td className="px-3 py-2.5 border-r border-slate-100">{safeCell(row.station, 'MAIN')}</td>
                        <td className="px-3 py-2.5 border-r border-slate-100 text-slate-700">{safeCell(row.packets, '0')}</td>
                        <td className="px-3 py-2.5 text-emerald-700">{safeCell(row.status, 'RECEIVED')}</td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-slate-400 italic">No recent transactions found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </LegacyFieldset>
        </div>

        {/* Quick Actions & Node details */}
        <div className="space-y-4">
          <LegacyFieldset legend="Quick Actions Center">
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => onNavigate('material_inspection')}
                className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 p-2.5 text-[10px] font-black uppercase text-left flex flex-row items-center justify-between group text-emerald-800 rounded-lg cursor-pointer transition-colors"
              >
                <span>Log Quality Audit Inspection</span>
                <ArrowUpRight className="h-3 w-3 text-emerald-400 group-hover:text-emerald-750 font-extrabold" />
              </button>
            </div>
          </LegacyFieldset>

          <LegacyFieldset legend="System State Metadata">
            <div className="space-y-3 py-1 font-mono text-[9px] font-bold text-slate-400">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span>STATION:</span>
                <span className="text-indigo-950 font-black">BJCL-M01-WB</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span>PERSISTENCE:</span>
                <span className="text-emerald-600 font-extrabold">SUPABASE DATABASE (LIVE)</span>
              </div>
              <div className="flex justify-between pb-1">
                <span>BUILD VERSION:</span>
                <span className="text-slate-600">4.8.2-STABLE</span>
              </div>
            </div>
          </LegacyFieldset>
        </div>
      </div>
    </div>
  );
}
