import React, { useState, useMemo } from 'react';
import { CompiledReportData } from '../../services/reportCalculations';
import { 
  FileCheck, 
  Download, 
  Search, 
  CheckCircle2, 
  Clock, 
  ArrowUpDown, 
  Layers, 
  TrendingUp 
} from 'lucide-react';
import { exportToCSV } from '../../utils/exportHelpers';

interface POSummaryPercentageEngineProps {
  poSummaryEngine: CompiledReportData['poSummaryEngine'];
}

export const POSummaryPercentageEngine: React.FC<POSummaryPercentageEngineProps> = ({ poSummaryEngine }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortField, setSortField] = useState<string>('contractedMT');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredRows = useMemo(() => {
    let list = poSummaryEngine.rows.filter(r => {
      const matchSearch = r.poNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.broker.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.area.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = selectedStatus === 'ALL' || r.lifecycleStatus === selectedStatus;
      return matchSearch && matchStatus;
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
  }, [poSummaryEngine.rows, searchTerm, selectedStatus, sortField, sortAsc]);

  const handleExport = () => {
    const headers = [
      'PO Number',
      'PO Date',
      'Supplier',
      'Broker',
      'Area',
      'Contracted Wt (MT)',
      'Received Wt (MT)',
      'Pending Wt (MT)',
      'Received %',
      'Pending %',
      'Lifecycle Status',
      'Temp MR #',
      'Final MR #',
      'Settlement Status',
      'Payment Status'
    ];

    const rows = filteredRows.map(r => [
      r.poNo,
      r.poDate,
      r.supplier,
      r.broker,
      r.area,
      r.contractedMT,
      r.receivedMT,
      r.pendingMT,
      `${r.receivedPct}%`,
      `${r.pendingPct}%`,
      r.lifecycleStatus,
      r.tempMRNumber,
      r.finalMRNumber,
      r.settlementStatus,
      r.paymentStatus
    ]);

    exportToCSV(`PO_Summary_Percentage_Engine_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
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
      {/* Top Process KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <div className="bg-white border border-slate-200 rounded-lg p-2.5">
          <div className="text-[9px] font-black uppercase text-slate-500">Total PO Volume</div>
          <div className="text-base font-black font-mono mt-0.5 text-slate-900">{poSummaryEngine.poContractedMT} MT</div>
          <div className="text-[9px] text-slate-500">{poSummaryEngine.totalPOs} Purchase Orders</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-2.5">
          <div className="text-[9px] font-black uppercase text-emerald-800">MR Received MT</div>
          <div className="text-base font-black font-mono mt-0.5 text-emerald-950">{poSummaryEngine.mrReceivedMT} MT</div>
          <div className="text-[9px] text-emerald-700 font-bold">{poSummaryEngine.poReceivedPct}% Fulfilled</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-2.5">
          <div className="text-[9px] font-black uppercase text-amber-800">PO Pending MT</div>
          <div className="text-base font-black font-mono mt-0.5 text-amber-950">
            {Math.max(0, poSummaryEngine.poContractedMT - poSummaryEngine.mrReceivedMT).toFixed(2)} MT
          </div>
          <div className="text-[9px] text-amber-700 font-bold">{poSummaryEngine.poPendingPct}% Pending</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-2.5">
          <div className="text-[9px] font-black uppercase text-slate-500">Temp MR %</div>
          <div className="text-base font-black font-mono mt-0.5 text-slate-900">{poSummaryEngine.tempMRPct}%</div>
          <div className="text-[9px] text-slate-500">Gate Weighment</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-2.5">
          <div className="text-[9px] font-black uppercase text-slate-500">Final MR %</div>
          <div className="text-base font-black font-mono mt-0.5 text-slate-900">{poSummaryEngine.finalMRPct}%</div>
          <div className="text-[9px] text-slate-500">Quality Approved</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-2.5">
          <div className="text-[9px] font-black uppercase text-slate-500">Settlement %</div>
          <div className="text-base font-black font-mono mt-0.5 text-slate-900">{poSummaryEngine.settlementCompletionPct}%</div>
          <div className="text-[9px] text-slate-500">Bill Passed</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-2.5">
          <div className="text-[9px] font-black uppercase text-slate-500">Payment %</div>
          <div className="text-base font-black font-mono mt-0.5 text-emerald-700 font-bold">{poSummaryEngine.paymentCompletionPct}%</div>
          <div className="text-[9px] text-slate-500">Disbursed</div>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-md">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
              Purchase Order Lifecycle & Receipt Percentage Engine
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Line-item verification connecting PO Contract Weight, Material Received (MR), Clubbing, and Bill Passing status
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search PO Engine..."
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
          <table className="w-full text-left text-xs border-collapse min-w-[1250px]">
            <thead className="bg-slate-800 text-white sticky top-0 text-[9px] uppercase tracking-wider font-mono z-10">
              <tr>
                <th onClick={() => handleSort('poNo')} className="p-2.5 px-3 border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-between">PO # <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th className="p-2.5 border-r border-slate-700">Date</th>
                <th className="p-2.5 border-r border-slate-700">Supplier</th>
                <th className="p-2.5 border-r border-slate-700">Broker</th>
                <th className="p-2.5 border-r border-slate-700">Area</th>
                <th onClick={() => handleSort('contractedMT')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Contract Wt <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('receivedMT')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Received Wt <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('pendingMT')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Pending Wt <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('receivedPct')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Received % <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th className="p-2.5 text-center border-r border-slate-700">Lifecycle Status</th>
                <th className="p-2.5 border-r border-slate-700">Temp MR #</th>
                <th className="p-2.5 border-r border-slate-700">Final MR #</th>
                <th className="p-2.5 text-center">Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filteredRows.map((r) => (
                <tr 
                  key={r.poNo}
                  className="hover:bg-emerald-50/40 transition-colors even:bg-slate-50/50"
                >
                  <td className="p-2.5 px-3 font-sans font-bold text-slate-900 border-r border-slate-100 select-all">
                    #{r.poNo}
                  </td>
                  <td className="p-2.5 text-slate-600 border-r border-slate-100 text-[10px]">{r.poDate}</td>
                  <td className="p-2.5 font-sans text-slate-900 border-r border-slate-100 font-bold max-w-[140px] truncate" title={r.supplier}>
                    {r.supplier}
                  </td>
                  <td className="p-2.5 text-slate-700 border-r border-slate-100">{r.broker}</td>
                  <td className="p-2.5 text-slate-700 border-r border-slate-100">{r.area}</td>
                  <td className="p-2.5 text-right text-slate-900 border-r border-slate-100 font-bold">{r.contractedMT}</td>
                  <td className="p-2.5 text-right text-emerald-800 border-r border-slate-100 font-bold">{r.receivedMT}</td>
                  <td className="p-2.5 text-right text-amber-800 border-r border-slate-100 font-bold">{r.pendingMT}</td>
                  <td className="p-2.5 text-right border-r border-slate-100">
                    <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                      {r.receivedPct}%
                    </span>
                  </td>
                  <td className="p-2.5 text-center border-r border-slate-100 font-sans">
                    <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                      r.lifecycleStatus === 'Fully Received' ? 'bg-emerald-100 text-emerald-800' :
                      r.lifecycleStatus === 'Partially Received' ? 'bg-amber-100 text-amber-800' :
                      r.lifecycleStatus === 'Excess Received' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {r.lifecycleStatus}
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-600 border-r border-slate-100 text-[10px]">{r.tempMRNumber}</td>
                  <td className="p-2.5 text-slate-800 border-r border-slate-100 font-bold text-[10px]">{r.finalMRNumber}</td>
                  <td className="p-2.5 text-center font-sans">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      r.settlementStatus === 'Settled' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-600 border border-slate-200'
                    }`}>
                      {r.settlementStatus}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400 italic">
                    No matching purchase order records found.
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
