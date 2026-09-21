import React, { useState, useMemo } from 'react';
import { CompiledReportData } from '../../services/reportCalculations';
import { 
  Package, 
  Download, 
  Search, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  ArrowUpDown 
} from 'lucide-react';
import { exportToCSV } from '../../utils/exportHelpers';

interface GradeItemPercentageReportProps {
  gradeItemSummary: CompiledReportData['gradeItemSummary'];
}

export const GradeItemPercentageReport: React.FC<GradeItemPercentageReportProps> = ({ gradeItemSummary }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('contractedWeightMT');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredGrades = useMemo(() => {
    let list = gradeItemSummary.filter(g => 
      g.grade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.marka.toLowerCase().includes(searchTerm.toLowerCase())
    );

    list.sort((a: any, b: any) => {
      const valA = a[sortField] ?? 0;
      const valB = b[sortField] ?? 0;
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [gradeItemSummary, searchTerm, sortField, sortAsc]);

  const handleExport = () => {
    const headers = [
      'Item Name',
      'Grade',
      'Crop Year',
      'Marka',
      'Contracted Wt (MT)',
      'Delivered Wt (MT)',
      'Pending Wt (MT)',
      'Delivered %',
      'Pending %',
      'Total Bags',
      'Accepted Bags',
      'Rejected Bags',
      'Acceptance %',
      'Rejection %',
      'Avg Contract Rate',
      'Avg Received Rate',
      'Rate Variance %',
      'Total Purchase Value'
    ];

    const rows = filteredGrades.map(g => [
      g.item,
      g.grade,
      g.cropYear,
      g.marka,
      g.contractedWeightMT,
      g.deliveredWeightMT,
      g.pendingWeightMT,
      `${g.deliveredPct}%`,
      `${g.pendingPct}%`,
      g.receivedBags,
      g.acceptedBags,
      g.rejectedBags,
      `${g.acceptancePct}%`,
      `${g.rejectionPct}%`,
      g.avgContractRate,
      g.avgReceivedRate,
      `${g.rateVariancePct}%`,
      g.totalPurchaseValue
    ]);

    exportToCSV(`Grade_Item_Percentage_Analysis_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-md">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
              Grade-Wise & Item-Wise Quality, Volume & Variance Analysis
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Breakdown by Jute Grade (TD5, TD6, W5), Marka, Crop Year, Bag Acceptance/Rejection %, and Grade-Specific Rates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Grade / Marka..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-md text-slate-800 outline-none focus:border-emerald-500 w-44"
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
          <table className="w-full text-left text-xs border-collapse min-w-[1150px]">
            <thead className="bg-slate-800 text-white sticky top-0 text-[9px] uppercase tracking-wider font-mono z-10">
              <tr>
                <th onClick={() => handleSort('grade')} className="p-2.5 px-3 border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-between">Grade / Quality <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th className="p-2.5 border-r border-slate-700">Item Name</th>
                <th className="p-2.5 border-r border-slate-700">Crop Year</th>
                <th className="p-2.5 border-r border-slate-700">Marka</th>
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
                <th className="p-2.5 text-right border-r border-slate-700">Total Bags</th>
                <th className="p-2.5 text-right border-r border-slate-700">Accept %</th>
                <th className="p-2.5 text-right border-r border-slate-700">Reject %</th>
                <th className="p-2.5 text-right border-r border-slate-700">Avg Rate (₹/Qtl)</th>
                <th className="p-2.5 text-right">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filteredGrades.map((g) => (
                <tr 
                  key={g.grade}
                  className="hover:bg-emerald-50/40 transition-colors even:bg-slate-50/50"
                >
                  <td className="p-2.5 px-3 font-sans font-bold text-slate-900 border-r border-slate-100">
                    <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-black text-slate-800 text-[10px]">
                      {g.grade}
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-700 border-r border-slate-100 font-medium">{g.item}</td>
                  <td className="p-2.5 text-slate-600 border-r border-slate-100">{g.cropYear}</td>
                  <td className="p-2.5 text-slate-700 border-r border-slate-100 font-bold">{g.marka}</td>
                  <td className="p-2.5 text-right text-slate-900 border-r border-slate-100 font-bold">{g.contractedWeightMT.toLocaleString()}</td>
                  <td className="p-2.5 text-right text-emerald-800 border-r border-slate-100 font-bold">{g.deliveredWeightMT.toLocaleString()}</td>
                  <td className="p-2.5 text-right text-amber-800 border-r border-slate-100 font-bold">{g.pendingWeightMT.toLocaleString()}</td>
                  <td className="p-2.5 text-right border-r border-slate-100">
                    <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                      {g.deliveredPct}%
                    </span>
                  </td>
                  <td className="p-2.5 text-right text-slate-700 border-r border-slate-100">{g.receivedBags.toLocaleString()}</td>
                  <td className="p-2.5 text-right text-emerald-800 border-r border-slate-100 font-bold">{g.acceptancePct}%</td>
                  <td className="p-2.5 text-right text-rose-700 border-r border-slate-100">{g.rejectionPct}%</td>
                  <td className="p-2.5 text-right text-slate-800 border-r border-slate-100 font-bold">₹{g.avgContractRate}</td>
                  <td className="p-2.5 text-right text-slate-900 font-bold">₹{(g.totalPurchaseValue / 100000).toFixed(2)} L</td>
                </tr>
              ))}
              {filteredGrades.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400 italic">
                    No matching grade or quality records found.
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
