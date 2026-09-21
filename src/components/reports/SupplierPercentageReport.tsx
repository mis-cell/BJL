import React, { useState, useMemo } from 'react';
import { CompiledReportData, SupplierRating } from '../../services/reportCalculations';
import { 
  Users, 
  Download, 
  Search, 
  Award, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  ArrowUpDown,
  Filter
} from 'lucide-react';
import { exportToCSV } from '../../utils/exportHelpers';

interface SupplierPercentageReportProps {
  supplierSummary: CompiledReportData['supplierSummary'];
}

export const SupplierPercentageReport: React.FC<SupplierPercentageReportProps> = ({ supplierSummary }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRating, setSelectedRating] = useState<string>('ALL');
  const [sortField, setSortField] = useState<string>('contractedWeightMT');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredSuppliers = useMemo(() => {
    let list = supplierSummary.filter(s => {
      const matchSearch = s.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.supplierCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.broker.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.area.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRating = selectedRating === 'ALL' || s.rating === selectedRating;
      return matchSearch && matchRating;
    });

    list.sort((a: any, b: any) => {
      const valA = a[sortField] ?? 0;
      const valB = b[sortField] ?? 0;
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [supplierSummary, searchTerm, selectedRating, sortField, sortAsc]);

  const handleExport = () => {
    const headers = [
      'Supplier Name',
      'Supplier Code',
      'Broker',
      'Area',
      'Contracts',
      'Contract Wt (MT)',
      'Delivered Wt (MT)',
      'Pending Wt (MT)',
      'Delivered %',
      'Pending %',
      'Completed Contracts',
      'Partial Contracts',
      'Undelivered Contracts',
      'On-Time %',
      'Delayed %',
      'Avg Delay (Days)',
      'Avg Contract Rate',
      'Rejection %',
      'Settlement %',
      'Payment %',
      'Performance Rating'
    ];

    const rows = filteredSuppliers.map(s => [
      s.supplier,
      s.supplierCode,
      s.broker,
      s.area,
      s.totalContracts,
      s.contractedWeightMT,
      s.deliveredWeightMT,
      s.pendingWeightMT,
      `${s.deliveredPct}%`,
      `${s.pendingPct}%`,
      s.fullyCompletedCount,
      s.partiallyCompletedCount,
      s.undeliveredCount,
      `${s.onTimePct}%`,
      `${s.delayedPct}%`,
      s.avgDelayDays,
      s.avgContractRate,
      `${s.qualityRejectionPct}%`,
      `${s.settlementPct}%`,
      `${s.paymentPct}%`,
      s.rating
    ]);

    exportToCSV(`Supplier_Percentage_Report_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getRatingBadge = (rating: SupplierRating) => {
    switch (rating) {
      case 'Excellent':
        return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-[10px]">⭐ Excellent</span>;
      case 'Good':
        return <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 border border-cyan-300 rounded font-bold text-[10px]">Good</span>;
      case 'Average':
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded font-bold text-[10px]">Average</span>;
      case 'Poor':
        return <span className="px-2 py-0.5 bg-orange-100 text-orange-800 border border-orange-300 rounded font-bold text-[10px]">Poor</span>;
      case 'Critical':
        return <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded font-bold text-[10px] animate-pulse">⚠️ Critical</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-md">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
              Supplier-Wise Delivery Performance & Quality Scorecard
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Multi-criteria vendor evaluation (Weight Fulfilled %, On-Time %, Delay Days, Rejection % & Auto-Rating)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Rating Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-bold">
            {['ALL', 'Excellent', 'Good', 'Average', 'Poor', 'Critical'].map(r => (
              <button
                key={r}
                onClick={() => setSelectedRating(r)}
                className={`px-2 py-1 rounded transition-colors ${
                  selectedRating === r ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-md text-slate-800 outline-none focus:border-emerald-500 w-40"
            />
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
            <thead className="bg-slate-800 text-white sticky top-0 text-[9px] uppercase tracking-wider font-mono z-10">
              <tr>
                <th onClick={() => handleSort('supplier')} className="p-2.5 px-3 border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-between">Supplier Name <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th className="p-2.5 border-r border-slate-700">Broker</th>
                <th className="p-2.5 border-r border-slate-700">Area</th>
                <th className="p-2.5 text-center border-r border-slate-700">Contracts</th>
                <th onClick={() => handleSort('contractedWeightMT')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Contract Wt <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('deliveredWeightMT')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Delivered Wt <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('pendingWeightMT')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Pending Wt <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('deliveredPct')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Delivered % <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('pendingPct')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Pending % <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th className="p-2.5 text-right border-r border-slate-700">On-Time %</th>
                <th className="p-2.5 text-right border-r border-slate-700">Avg Delay</th>
                <th className="p-2.5 text-right border-r border-slate-700">Avg Rate</th>
                <th className="p-2.5 text-center">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filteredSuppliers.map((s) => (
                <tr 
                  key={s.supplier}
                  className="hover:bg-emerald-50/40 transition-colors even:bg-slate-50/50"
                >
                  <td className="p-2.5 px-3 font-sans font-bold text-slate-800 border-r border-slate-100">
                    <div>{s.supplier}</div>
                    <div className="text-[9px] text-slate-400 font-mono">{s.supplierCode}</div>
                  </td>
                  <td className="p-2.5 text-slate-700 border-r border-slate-100">{s.broker}</td>
                  <td className="p-2.5 text-slate-700 border-r border-slate-100">{s.area}</td>
                  <td className="p-2.5 text-center text-slate-700 border-r border-slate-100">{s.totalContracts}</td>
                  <td className="p-2.5 text-right text-slate-900 border-r border-slate-100 font-bold">{s.contractedWeightMT.toLocaleString()}</td>
                  <td className="p-2.5 text-right text-emerald-800 border-r border-slate-100 font-bold">{s.deliveredWeightMT.toLocaleString()}</td>
                  <td className="p-2.5 text-right text-amber-800 border-r border-slate-100 font-bold">{s.pendingWeightMT.toLocaleString()}</td>
                  <td className="p-2.5 text-right border-r border-slate-100">
                    <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                      {s.deliveredPct}%
                    </span>
                  </td>
                  <td className="p-2.5 text-right border-r border-slate-100">
                    <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                      {s.pendingPct}%
                    </span>
                  </td>
                  <td className="p-2.5 text-right text-slate-800 border-r border-slate-100 font-bold">{s.onTimePct}%</td>
                  <td className="p-2.5 text-right text-slate-700 border-r border-slate-100">{s.avgDelayDays}d</td>
                  <td className="p-2.5 text-right text-slate-800 border-r border-slate-100">₹{s.avgContractRate}</td>
                  <td className="p-2.5 text-center font-sans">
                    {getRatingBadge(s.rating)}
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400 italic">
                    No matching supplier records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
