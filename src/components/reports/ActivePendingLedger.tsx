import React, { useState, useMemo } from 'react';
import { CompiledReportData, AgeingBucketKey } from '../../services/reportCalculations';
import { 
  AlertCircle, 
  Download, 
  Search, 
  Clock, 
  Calendar, 
  User, 
  ArrowUpDown,
  Filter,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { exportToCSV } from '../../utils/exportHelpers';

interface ActivePendingLedgerProps {
  activePendingLedger: CompiledReportData['activePendingLedger'];
  ageingDistribution: CompiledReportData['ageingDistribution'];
}

export const ActivePendingLedger: React.FC<ActivePendingLedgerProps> = ({ 
  activePendingLedger, 
  ageingDistribution 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBucket, setSelectedBucket] = useState<string>('ALL');
  const [sortField, setSortField] = useState<string>('daysPending');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredLedger = useMemo(() => {
    let list = activePendingLedger.filter(item => {
      const matchSearch = item.saudaNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.poNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.broker.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.area.toLowerCase().includes(searchTerm.toLowerCase());
      const matchBucket = selectedBucket === 'ALL' || item.ageingBucket === selectedBucket;
      return matchSearch && matchBucket;
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
  }, [activePendingLedger, searchTerm, selectedBucket, sortField, sortAsc]);

  const handleExport = () => {
    const headers = [
      'Sauda No',
      'PO No',
      'Contract Date',
      'Supplier',
      'Broker',
      'Area',
      'Grade',
      'Contract Wt (MT)',
      'Delivered Wt (MT)',
      'Pending Wt (MT)',
      'Delivered %',
      'Pending %',
      'Scheduled Date',
      'Days Overdue',
      'Delay Status',
      'Last Receipt Date',
      'Responsible Person',
      'Next Action',
      'Final Status'
    ];

    const rows = filteredLedger.map(item => [
      item.saudaNo,
      item.poNo,
      item.contractDate,
      item.supplier,
      item.broker,
      item.area,
      item.grade,
      item.contractedWeightMT,
      item.deliveredWeightMT,
      item.pendingWeightMT,
      `${item.deliveredPct}%`,
      `${item.pendingPct}%`,
      item.scheduledDeliveryDate,
      item.daysPending,
      item.delayStatus,
      item.lastReceiptDate,
      item.responsiblePerson,
      item.nextAction,
      item.finalStatus
    ]);

    exportToCSV(`Active_Pending_Contracts_Ledger_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
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
      {/* Ageing Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        <div 
          onClick={() => setSelectedBucket('ALL')}
          className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
            selectedBucket === 'ALL'
              ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          <div className="text-[9px] font-black uppercase tracking-wider opacity-70">Total Pending</div>
          <div className="text-base font-black font-mono mt-0.5">
            {activePendingLedger.reduce((sum, r) => sum + r.pendingWeightMT, 0).toFixed(2)} MT
          </div>
          <div className="text-[9px] opacity-80 mt-0.5">{activePendingLedger.length} Contracts</div>
        </div>

        {ageingDistribution.map(b => {
          const isSelected = selectedBucket === b.bucket;
          const isSevere = b.bucket === '31_60_days' || b.bucket === 'above_60_days';
          const isMedium = b.bucket === '8_15_days' || b.bucket === '16_30_days';
          return (
            <div
              key={b.bucket}
              onClick={() => setSelectedBucket(isSelected ? 'ALL' : b.bucket)}
              className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-emerald-700 border-emerald-700 text-white shadow-sm'
                  : isSevere
                  ? 'bg-rose-50/60 border-rose-200 hover:border-rose-400 text-rose-950'
                  : isMedium
                  ? 'bg-amber-50/60 border-amber-200 hover:border-amber-400 text-amber-950'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
              }`}
            >
              <div className="text-[9px] font-black uppercase tracking-wider opacity-80 truncate">{b.label}</div>
              <div className="text-base font-black font-mono mt-0.5">{b.weight} MT</div>
              <div className="text-[9px] font-bold opacity-80 mt-0.5 flex justify-between">
                <span>{b.count} Lines</span>
                <span className="font-mono font-black">{b.percentage}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-50 text-amber-700 rounded-md">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
              Active Pending Contracts & Ageing Delay Ledger
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Line-item tracking of unfulfilled Sauda contracts, delay durations, and assigned operational escalation actions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Pending Ledger..."
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
                <th onClick={() => handleSort('saudaNo')} className="p-2.5 px-3 border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-between">Sauda # <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th className="p-2.5 border-r border-slate-700">Date</th>
                <th onClick={() => handleSort('supplier')} className="p-2.5 border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-between">Supplier <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th className="p-2.5 border-r border-slate-700">Broker</th>
                <th className="p-2.5 border-r border-slate-700">Area</th>
                <th className="p-2.5 border-r border-slate-700">Grade</th>
                <th className="p-2.5 text-right border-r border-slate-700">Contract Wt</th>
                <th className="p-2.5 text-right border-r border-slate-700">Delivered Wt</th>
                <th onClick={() => handleSort('pendingWeightMT')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700 text-amber-300">
                  <div className="flex items-center justify-end gap-1">Pending Wt <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('pendingPct')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Pending % <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('daysPending')} className="p-2.5 text-center border-r border-slate-700 cursor-pointer hover:bg-slate-700 text-rose-300">
                  <div className="flex items-center justify-center gap-1">Overdue <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th className="p-2.5 border-r border-slate-700">Action Plan</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filteredLedger.map((row) => (
                <tr 
                  key={row.saudaNo}
                  className="hover:bg-amber-50/40 transition-colors even:bg-slate-50/50"
                >
                  <td className="p-2.5 px-3 font-sans font-bold text-slate-900 border-r border-slate-100 select-all">
                    #{row.saudaNo}
                  </td>
                  <td className="p-2.5 text-slate-600 border-r border-slate-100 text-[10px]">{row.contractDate}</td>
                  <td className="p-2.5 font-sans text-slate-900 border-r border-slate-100 font-bold max-w-[140px] truncate" title={row.supplier}>
                    {row.supplier}
                  </td>
                  <td className="p-2.5 text-slate-700 border-r border-slate-100">{row.broker}</td>
                  <td className="p-2.5 text-slate-700 border-r border-slate-100">{row.area}</td>
                  <td className="p-2.5 text-slate-800 border-r border-slate-100 font-bold">{row.grade}</td>
                  <td className="p-2.5 text-right text-slate-900 border-r border-slate-100">{row.contractedWeightMT}</td>
                  <td className="p-2.5 text-right text-emerald-800 border-r border-slate-100">{row.deliveredWeightMT}</td>
                  <td className="p-2.5 text-right text-amber-800 border-r border-slate-100 font-black">{row.pendingWeightMT}</td>
                  <td className="p-2.5 text-right border-r border-slate-100">
                    <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[10px]">
                      {row.pendingPct}%
                    </span>
                  </td>
                  <td className="p-2.5 text-center border-r border-slate-100">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      row.daysPending > 30 ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse' :
                      row.daysPending > 7 ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {row.daysPending > 0 ? `${row.daysPending}d` : 'On Time'}
                    </span>
                  </td>
                  <td className="p-2.5 text-[10px] text-slate-700 font-sans border-r border-slate-100 max-w-[150px] truncate" title={row.nextAction}>
                    {row.nextAction}
                  </td>
                  <td className="p-2.5 text-center font-sans">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      row.finalStatus === 'Delayed' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {row.finalStatus}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredLedger.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400 italic">
                    No active pending contract records matching selected criteria.
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
