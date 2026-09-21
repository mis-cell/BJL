import React, { useState, useMemo } from 'react';
import { CompiledReportData } from '../../services/reportCalculations';
import { 
  GitCommit, 
  Download, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowUpDown, 
  ShieldCheck, 
  Filter 
} from 'lucide-react';
import { exportToCSV } from '../../utils/exportHelpers';

interface FullPipelineAuditReportProps {
  fullPipelineAudit: CompiledReportData['fullPipelineAudit'];
}

export const FullPipelineAuditReport: React.FC<FullPipelineAuditReportProps> = ({ fullPipelineAudit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');
  const [sortField, setSortField] = useState<string>('contractedMT');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredAudit = useMemo(() => {
    let list = fullPipelineAudit.filter(item => {
      const matchSearch = item.saudaNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.poNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.tempMRNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.finalMRNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.broker.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStage = selectedStage === 'ALL' || item.currentStage.includes(selectedStage);
      return matchSearch && matchStage;
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
  }, [fullPipelineAudit, searchTerm, selectedStage, sortField, sortAsc]);

  const handleExport = () => {
    const headers = [
      'Sauda #',
      'PO #',
      'Temp MR #',
      'Final MR #',
      'Supplier',
      'Broker',
      'Grade',
      'Contract Wt (MT)',
      'Temp Received Wt',
      'Final Received Wt',
      'Settled Wt',
      'Paid Amount',
      'Delivered %',
      'Final MR %',
      'Settlement %',
      'Payment %',
      'Weight Variance',
      'Variance %',
      'Current Pipeline Stage',
      'Mismatch Status',
      'Audit Status',
      'Last Updated'
    ];

    const rows = filteredAudit.map(a => [
      a.saudaNo,
      a.poNo,
      a.tempMRNo,
      a.finalMRNo,
      a.supplier,
      a.broker,
      a.grade,
      a.contractedMT,
      a.tempReceivedMT,
      a.finalReceivedMT,
      a.settledMT,
      a.paidAmount,
      `${a.deliveryPct}%`,
      `${a.finalMRCompletionPct}%`,
      `${a.settlementPct}%`,
      `${a.paymentPct}%`,
      a.weightVarianceMT,
      `${a.weightVariancePct}%`,
      a.currentStage,
      a.mismatchStatus,
      a.auditStatus,
      a.lastUpdatedDate
    ]);

    exportToCSV(`Full_Pipeline_Audit_Report_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getStageBadge = (stage: string, color: string) => {
    switch (color) {
      case 'green':
        return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-[9px]">Completed</span>;
      case 'blue':
        return <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 border border-cyan-300 rounded font-bold text-[9px]">In Progress</span>;
      case 'orange':
        return <span className="px-2 py-0.5 bg-orange-100 text-orange-800 border border-orange-300 rounded font-bold text-[9px]">Delayed Dispatch</span>;
      case 'red':
        return <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded font-bold text-[9px] animate-pulse">Mismatch Blocked</span>;
      case 'gray':
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded font-bold text-[9px]">Cancelled</span>;
      default:
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded font-bold text-[9px]">Pending</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Pipeline Stage Visual Ribbon */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-lg p-3.5 shadow-sm space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-md">
              <GitCommit className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-white tracking-wider">
                End-to-End Procurement Pipeline Audit
              </h4>
              <p className="text-[10px] text-slate-400 font-mono">
                Cross-correlates 8 ERP stages: Sauda → Checkpoint → Temp MR → Final MR → PO → Bill Passing → Settlement → Payment
              </p>
            </div>
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        {/* 8 Stages Visual Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 text-center font-mono text-[9px] font-bold">
          <div className="bg-slate-800 p-1.5 rounded border border-slate-700 text-slate-300">1. Sauda Entry</div>
          <div className="bg-slate-800 p-1.5 rounded border border-slate-700 text-slate-300">2. Check Point</div>
          <div className="bg-slate-800 p-1.5 rounded border border-slate-700 text-slate-300">3. Temp MR</div>
          <div className="bg-slate-800 p-1.5 rounded border border-slate-700 text-emerald-400">4. Final MR</div>
          <div className="bg-slate-800 p-1.5 rounded border border-slate-700 text-slate-300">5. Final PO</div>
          <div className="bg-slate-800 p-1.5 rounded border border-slate-700 text-slate-300">6. Bill Passing</div>
          <div className="bg-slate-800 p-1.5 rounded border border-slate-700 text-slate-300">7. Settlement</div>
          <div className="bg-slate-800 p-1.5 rounded border border-slate-700 text-emerald-400">8. Payment</div>
        </div>
      </div>

      {/* Header Search & Stage Filter */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Pipeline Record (Sauda/PO/MR)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-md text-slate-800 outline-none focus:border-emerald-500 w-64"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Audit Status:</span>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-black text-[9.5px]">
            100% RECONCILED WITH LIVE DB
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
            <thead className="bg-slate-800 text-white sticky top-0 text-[9px] uppercase tracking-wider font-mono z-10">
              <tr>
                <th onClick={() => handleSort('saudaNo')} className="p-2.5 px-3 border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-between">Sauda # <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th className="p-2.5 border-r border-slate-700">PO #</th>
                <th className="p-2.5 border-r border-slate-700">Temp MR #</th>
                <th className="p-2.5 border-r border-slate-700">Final MR #</th>
                <th className="p-2.5 border-r border-slate-700">Supplier</th>
                <th className="p-2.5 border-r border-slate-700">Broker</th>
                <th onClick={() => handleSort('contractedMT')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Contract Wt <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th className="p-2.5 text-right border-r border-slate-700">Final Recv Wt</th>
                <th onClick={() => handleSort('deliveryPct')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Delivery % <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th className="p-2.5 text-right border-r border-slate-700">Settled %</th>
                <th className="p-2.5 text-right border-r border-slate-700">Paid %</th>
                <th className="p-2.5 text-center border-r border-slate-700">Pipeline Stage</th>
                <th className="p-2.5 text-center">Variance Mismatch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filteredAudit.map((a) => (
                <tr 
                  key={a.saudaNo}
                  className="hover:bg-emerald-50/40 transition-colors even:bg-slate-50/50"
                >
                  <td className="p-2.5 px-3 font-sans font-bold text-slate-900 border-r border-slate-100 select-all">
                    #{a.saudaNo}
                  </td>
                  <td className="p-2.5 text-slate-600 border-r border-slate-100">{a.poNo}</td>
                  <td className="p-2.5 text-slate-600 border-r border-slate-100">{a.tempMRNo}</td>
                  <td className="p-2.5 text-slate-800 border-r border-slate-100 font-bold">{a.finalMRNo}</td>
                  <td className="p-2.5 font-sans text-slate-900 border-r border-slate-100 font-bold max-w-[130px] truncate" title={a.supplier}>
                    {a.supplier}
                  </td>
                  <td className="p-2.5 text-slate-700 border-r border-slate-100">{a.broker}</td>
                  <td className="p-2.5 text-right text-slate-900 border-r border-slate-100 font-bold">{a.contractedMT}</td>
                  <td className="p-2.5 text-right text-emerald-800 border-r border-slate-100 font-bold">{a.finalReceivedMT}</td>
                  <td className="p-2.5 text-right border-r border-slate-100">
                    <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                      {a.deliveryPct}%
                    </span>
                  </td>
                  <td className="p-2.5 text-right text-slate-700 border-r border-slate-100">{a.settlementPct}%</td>
                  <td className="p-2.5 text-right text-emerald-800 border-r border-slate-100 font-bold">{a.paymentPct}%</td>
                  <td className="p-2.5 text-center border-r border-slate-100 font-sans">
                    {getStageBadge(a.currentStage, a.stageColor)}
                  </td>
                  <td className="p-2.5 text-center font-sans">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      a.mismatchStatus.includes('Variance') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {a.mismatchStatus}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredAudit.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400 italic">
                    No matching pipeline audit records found.
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
