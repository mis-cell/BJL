import React, { useState, useMemo } from 'react';
import {
  TrendingUp, BarChart3, Award, DollarSign, Filter, ChevronRight, Layers, ArrowUpDown
} from 'lucide-react';
import {
  SystemReportDataset,
  ReportTransactionLine,
  groupTransactionsByDimension
} from '../../services/systemReportEngine';

interface Priority2AnalysisProps {
  dataset: SystemReportDataset;
  onDrillDown: (title: string, txns: ReportTransactionLine[]) => void;
  defaultSubTab?: 'business' | 'profitability' | 'premium' | 'deduction' | 'ranking';
}

type DimensionType = 'broker' | 'supplier' | 'agency' | 'area' | 'grade' | 'month' | 'saudaNo' | 'poNo';

export const Priority2Analysis: React.FC<Priority2AnalysisProps> = ({
  dataset,
  onDrillDown,
  defaultSubTab = 'profitability'
}) => {
  const { filtered, metrics } = dataset;
  const [subTab, setSubTab] = useState<'business' | 'profitability' | 'premium' | 'deduction' | 'ranking'>(defaultSubTab);
  const [dimension, setDimension] = useState<DimensionType>('broker');

  // Compute grouped rows
  const groupedData = useMemo(() => {
    return groupTransactionsByDimension(filtered, dimension);
  }, [filtered, dimension]);

  // Dimension label helper
  const getDimensionLabel = (d: DimensionType) => {
    switch (d) {
      case 'broker': return 'Broker Wise';
      case 'supplier': return 'Supplier Wise';
      case 'agency': return 'Agency Wise';
      case 'area': return 'Area Wise';
      case 'grade': return 'Grade Wise';
      case 'month': return 'Month Wise';
      case 'saudaNo': return 'Sauda Wise';
      case 'poNo': return 'P.O Wise';
    }
  };

  return (
    <div className="space-y-4 font-sans">
      
      {/* Top Nav Sub-tabs for Priority 2 */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          {[
            { id: 'profitability' as const, label: '2. Profitability Analysis' },
            { id: 'business' as const, label: '1. Business Performance' },
            { id: 'premium' as const, label: '3. Premium Analysis' },
            { id: 'deduction' as const, label: '4. Deduction Analysis' },
            { id: 'ranking' as const, label: '5. Performance Rankings' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg transition ${
                subTab === t.id
                  ? 'bg-emerald-900 text-yellow-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Dimension Selector */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[10px] font-black uppercase text-slate-400">Group By:</span>
          <div className="flex flex-wrap gap-1 bg-white border border-slate-200 p-0.5 rounded-lg shadow-sm">
            {(['broker', 'supplier', 'agency', 'area', 'grade', 'month', 'saudaNo', 'poNo'] as DimensionType[]).map(d => (
              <button
                key={d}
                onClick={() => setDimension(d)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded capitalize transition ${
                  dimension === d
                    ? 'bg-emerald-800 text-white font-black'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {d === 'saudaNo' ? 'Sauda' : (d === 'poNo' ? 'PO' : d)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TOP PROFITABILITY METRIC CARDS (Specification Section 28) */}
      {subTab === 'profitability' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Business</span>
            <div className="text-sm font-black text-slate-900 font-mono mt-0.5">
              ₹{metrics.totalPurchaseValue.toLocaleString()}
            </div>
            <span className="text-[8.5px] text-slate-400 block mt-0.5">Landed Turnout</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Cost</span>
            <div className="text-sm font-black text-slate-800 font-mono mt-0.5">
              ₹{(metrics.totalPurchaseValue + metrics.totalPremium - metrics.totalDeduction).toLocaleString()}
            </div>
            <span className="text-[8.5px] text-slate-400 block mt-0.5">Effective Landing</span>
          </div>

          <div className="p-3 bg-white border border-emerald-300 rounded-xl shadow-sm bg-emerald-50/30">
            <span className="text-[9px] font-black text-emerald-800 uppercase block">Gross Margin</span>
            <div className={`text-sm font-black font-mono mt-0.5 ${metrics.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              ₹{metrics.grossProfit.toLocaleString()}
            </div>
            <span className="text-[8.5px] text-emerald-600 font-bold block mt-0.5">
              {metrics.profitMarginPct.toFixed(2)}% Margin
            </span>
          </div>

          <div className="p-3 bg-white border border-rose-200 rounded-xl shadow-sm bg-rose-50/30">
            <span className="text-[9px] font-black text-rose-800 uppercase block">Total Loss</span>
            <div className="text-sm font-black text-rose-700 font-mono mt-0.5">
              ₹{metrics.totalLoss.toLocaleString()}
            </div>
            <span className="text-[8.5px] text-rose-600 font-bold block mt-0.5">
              {metrics.lossMakingCount} Loss Deals
            </span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Profitable Saudas</span>
            <div className="text-sm font-black text-emerald-700 font-mono mt-0.5">
              {metrics.profitableCount} / {metrics.totalSaudaCount}
            </div>
            <span className="text-[8.5px] text-slate-400 block mt-0.5">Net Positive</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-[9px] font-bold text-slate-500 uppercase block">Rate Variance</span>
            <div className="text-sm font-black text-amber-700 font-mono mt-0.5">
              +₹{(metrics.weightedPurchaseRate - metrics.weightedBaseRate).toFixed(1)}/Qtl
            </div>
            <span className="text-[8.5px] text-slate-400 block mt-0.5">Pur vs Base Rate</span>
          </div>
        </div>
      )}

      {/* MAIN DATA TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-emerald-950">
              {getDimensionLabel(dimension)} — {subTab.toUpperCase()} LEDGER
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              ({groupedData.length} Grouped Entities)
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Click any row to drill down into underlying Transaction lines
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-emerald-950 text-white font-black uppercase text-[10px] tracking-wider border-b border-emerald-900">
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3">{getDimensionLabel(dimension).replace(' Wise', '')}</th>
                <th className="p-3 text-right">Qty (MT)</th>
                <th className="p-3 text-right">Avg Pur Rate</th>
                <th className="p-3 text-right">Avg Base Rate</th>
                {subTab === 'premium' && <th className="p-3 text-right">Premium (₹)</th>}
                {subTab === 'premium' && <th className="p-3 text-right">Premium %</th>}
                {subTab === 'deduction' && <th className="p-3 text-right">Deductions (₹)</th>}
                {subTab === 'deduction' && <th className="p-3 text-right">Avg Moisture</th>}
                <th className="p-3 text-right">Landed Cost (₹)</th>
                <th className="p-3 text-right">Gross Margin (₹)</th>
                <th className="p-3 text-right">Profit %</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center w-12">Drill</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {groupedData.map((row, idx) => {
                const rowTxns = filtered.filter(t => String(t[dimension] || 'UNASSIGNED') === row.key);

                return (
                  <tr
                    key={row.key}
                    onClick={() => onDrillDown(`${getDimensionLabel(dimension)}: ${row.key}`, rowTxns)}
                    className="hover:bg-emerald-50/50 transition cursor-pointer font-mono text-[11px]"
                  >
                    <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-emerald-950 flex items-center justify-between">
                      <span className="truncate max-w-xs">{row.key}</span>
                      <span className="text-[9px] text-slate-400 font-normal ml-2">({row.txnCount} lines)</span>
                    </td>
                    <td className="p-2.5 text-right font-bold">{row.quantityMT.toFixed(3)}</td>
                    <td className="p-2.5 text-right">₹{Math.round(row.avgPurchaseRate).toLocaleString()}</td>
                    <td className="p-2.5 text-right text-slate-500">₹{Math.round(row.avgBaseRate).toLocaleString()}</td>

                    {subTab === 'premium' && (
                      <td className="p-2.5 text-right text-amber-700 font-bold">
                        ₹{row.premiumAmount.toLocaleString()}
                      </td>
                    )}
                    {subTab === 'premium' && (
                      <td className="p-2.5 text-right text-amber-600">
                        {row.premiumPct.toFixed(2)}%
                      </td>
                    )}

                    {subTab === 'deduction' && (
                      <td className="p-2.5 text-right text-rose-700 font-bold">
                        ₹{row.deductionAmount.toLocaleString()}
                      </td>
                    )}
                    {subTab === 'deduction' && (
                      <td className="p-2.5 text-right text-blue-700">
                        {row.avgMoisture.toFixed(2)}%
                      </td>
                    )}

                    <td className="p-2.5 text-right text-slate-900 font-bold">₹{row.effectiveCost.toLocaleString()}</td>
                    <td className="p-2.5 text-right">
                      <span className={row.grossProfit >= 0 ? 'text-emerald-700 font-black' : 'text-rose-600 font-black'}>
                        {row.grossProfit >= 0 ? `+₹${row.grossProfit.toLocaleString()}` : `-₹${Math.abs(row.grossProfit).toLocaleString()}`}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <span className={row.profitPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                        {row.profitPct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        row.status === 'PROFITABLE' ? 'bg-emerald-100 text-emerald-800' :
                        row.status === 'LOSS' ? 'bg-rose-100 text-rose-800' :
                        row.status === 'BREAK-EVEN' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-center text-emerald-600">
                      <ChevronRight className="w-4 h-4 mx-auto" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
