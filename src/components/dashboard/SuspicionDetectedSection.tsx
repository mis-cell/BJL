import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  X, 
  Search, 
  FileText, 
  Scale, 
  Calendar,
  ExternalLink,
  Info,
  Download,
  Filter,
  CheckCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { BrokerSuspicionSummary, SuspiciousAnomalyRecord } from '../../services/brokerSuspicionService';
import { cn, formatIndianCurrency } from '../../lib/utils';

interface SuspicionDetectedSectionProps {
  summaries: BrokerSuspicionSummary[];
  loading?: boolean;
  onRefresh?: () => void;
  onNavigateToAbnormalReport?: () => void;
}

export default function SuspicionDetectedSection({
  summaries = [],
  loading = false,
  onRefresh,
  onNavigateToAbnormalReport
}: SuspicionDetectedSectionProps) {
  const [selectedSummary, setSelectedSummary] = useState<BrokerSuspicionSummary | null>(null);
  const [selectedAnomalyDetail, setSelectedAnomalyDetail] = useState<SuspiciousAnomalyRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'REVIEW_REQUIRED' | 'CLEAR'>('REVIEW_REQUIRED');

  // Filters inside Investigation Modal
  const [modalSearch, setModalSearch] = useState('');
  const [modalSeverityFilter, setModalSeverityFilter] = useState<string>('ALL');
  const [modalAnomalyTypeFilter, setModalAnomalyTypeFilter] = useState<string>('ALL');

  // Verification status overrides stored in component state
  const [statusOverrides, setStatusOverrides] = useState<Record<string, SuspiciousAnomalyRecord['verificationStatus']>>({});

  const filteredSummaries = useMemo(() => {
    return summaries.filter(s => {
      if (statusFilter === 'REVIEW_REQUIRED' && s.status !== 'Review Required') return false;
      if (statusFilter === 'CLEAR' && s.status !== 'Clear') return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const match = 
          s.brokerName.toLowerCase().includes(q) ||
          s.primaryIssue.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [summaries, statusFilter, searchTerm]);

  const totalAnomalies = summaries.reduce((acc, s) => acc + s.anomalyCount, 0);
  const flaggedBrokersCount = summaries.filter(s => s.status === 'Review Required').length;

  // Filtered anomalies within the active modal
  const modalFilteredAnomalies = useMemo(() => {
    if (!selectedSummary) return [];
    return selectedSummary.anomalies.filter(a => {
      if (modalSeverityFilter !== 'ALL' && a.severity !== modalSeverityFilter) return false;
      if (modalAnomalyTypeFilter !== 'ALL' && a.anomalyType !== modalAnomalyTypeFilter) return false;
      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase().trim();
        const match =
          a.saudaNo.toLowerCase().includes(q) ||
          a.poNo.toLowerCase().includes(q) ||
          a.mrNo.toLowerCase().includes(q) ||
          a.anomalyType.toLowerCase().includes(q) ||
          a.detectionReason.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [selectedSummary, modalSeverityFilter, modalAnomalyTypeFilter, modalSearch]);

  const handleExportBrokerCsv = (summary: BrokerSuspicionSummary) => {
    if (!summary.anomalies.length) return;
    const headers = [
      'Sl No', 'Broker Name', 'MR Number', 'Sauda Number', 'P.O. Number', 'Transaction Date',
      'Contract Weight (MT)', 'Temporary Arrival Weight (MT)', 'Final Arrival Weight (MT)', 'Mill Inspection Weight (MT)',
      'Sauda B Rate (₹/Qtl)', 'Deduction Type', 'Deduction Qty or Pct', 'Deduction Amount (₹)',
      'Expected Value', 'Actual Value', 'Difference', 'Abnormality Type', 'Detection Reason', 'Severity', 'Verification Status'
    ];
    const rows = summary.anomalies.map((a, idx) => {
      const vStatus = statusOverrides[a.id] || a.verificationStatus;
      return [
        idx + 1,
        `"${a.brokerName}"`,
        `"${a.mrNo || '—'}"`,
        `"${a.saudaNo || '—'}"`,
        `"${a.poNo || '—'}"`,
        `"${a.transactionDate || '—'}"`,
        a.contractWeight > 0 ? a.contractWeight.toFixed(2) : '—',
        a.tempArrivalWeight > 0 ? a.tempArrivalWeight.toFixed(2) : '—',
        a.finalArrivalWeight > 0 ? a.finalArrivalWeight.toFixed(2) : '—',
        a.millInspectionWeight > 0 ? a.millInspectionWeight.toFixed(2) : '—',
        a.saudaRate > 0 ? a.saudaRate : '—',
        `"${a.deductionType || '—'}"`,
        `"${a.deductionQtyOrPct || '—'}"`,
        a.deductionAmount > 0 ? a.deductionAmount : '—',
        `"${a.expectedValue}"`,
        `"${a.actualValue}"`,
        `"${a.difference}"`,
        `"${a.anomalyType}"`,
        `"${a.detectionReason.replace(/"/g, '""')}"`,
        a.severity,
        vStatus
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `abnormal_data_${summary.brokerName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#FAF7F0] border-2 border-[#D6CAA8] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
      {/* ================= SECTION HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D6CAA8] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-rose-700 shadow-sm">
            <ShieldAlert className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-[#1E331B] uppercase tracking-wider">
                SUSPICION DETECTED
              </h2>
              {flaggedBrokersCount > 0 ? (
                <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                  {flaggedBrokersCount} Brokers Require Review ({totalAnomalies} Anomalies)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                  All Systems Clear
                </span>
              )}
            </div>
            <p className="text-xs text-[#5A6E54] font-medium mt-0.5">
              Deep cross-table analysis across Sauda, P.O., Arrival, Inspection, and Deduction records
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter Tab Buttons */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-[#D6CAA8] text-xs font-bold">
            <button
              onClick={() => setStatusFilter('REVIEW_REQUIRED')}
              className={cn(
                "px-3 py-1 rounded-lg transition cursor-pointer",
                statusFilter === 'REVIEW_REQUIRED'
                  ? "bg-rose-600 text-white shadow-xs font-black"
                  : "text-[#5A6E54] hover:text-[#1E331B]"
              )}
            >
              Alerts ({flaggedBrokersCount})
            </button>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={cn(
                "px-3 py-1 rounded-lg transition cursor-pointer",
                statusFilter === 'ALL'
                  ? "bg-[#1E331B] text-white shadow-xs font-black"
                  : "text-[#5A6E54] hover:text-[#1E331B]"
              )}
            >
              All Brokers ({summaries.length})
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5A6E54]" />
            <input
              type="text"
              placeholder="Search broker name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9 pr-4 bg-white border border-[#D6CAA8] rounded-xl text-xs font-semibold text-[#1E331B] focus:outline-none focus:border-[#1E331B] w-full sm:w-56"
            />
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="h-9 px-3.5 bg-[#1E331B] text-[#FAF7F0] border border-[#1E331B] rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#2A4826] transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>{loading ? 'Scanning...' : 'Re-Scan'}</span>
            </button>
          )}

          {onNavigateToAbnormalReport && (
            <button
              onClick={onNavigateToAbnormalReport}
              className="h-9 px-3.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 border border-yellow-500 rounded-xl text-xs font-black uppercase tracking-wider transition active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Open full 20-column Abnormal Data Analysis in System Reports"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Full 20-Col Report</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= SUMMARY ALERTS CARDS ================= */}
      {filteredSummaries.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-[#D6CAA8] rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-black text-[#1E331B] uppercase tracking-wider">
            {statusFilter === 'REVIEW_REQUIRED'
              ? 'No brokers requiring review in this category.'
              : 'No matching brokers found.'}
          </h3>
          <p className="text-xs text-[#5A6E54] max-w-md mx-auto">
            All audited business records, weights, and rates comply with standard tolerances and commercial policies.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSummaries.map((summary, idx) => {
            const isAlert = summary.status === 'Review Required';
            const badgeColor =
              summary.severity === 'High'
                ? 'bg-rose-600 text-white'
                : summary.severity === 'Medium'
                ? 'bg-amber-600 text-white'
                : 'bg-emerald-600 text-white';

            return (
              <div
                key={idx}
                onClick={() => setSelectedSummary(summary)}
                className={cn(
                  "border-2 rounded-xl p-4 transition-all duration-200 cursor-pointer hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between gap-3 bg-white",
                  isAlert && summary.severity === 'High' 
                    ? 'border-rose-300 hover:border-rose-500 bg-rose-50/20' 
                    : isAlert && summary.severity === 'Medium'
                    ? 'border-amber-300 hover:border-amber-500 bg-amber-50/20'
                    : 'border-[#D6CAA8] hover:border-[#1E331B]'
                )}
              >
                <div className="space-y-2.5">
                  {/* Top Bar: Broker Name & Severity */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6E54] block">
                        Broker Name
                      </span>
                      <h4 className="text-xs font-black text-[#1E331B] uppercase tracking-wider line-clamp-1">
                        {summary.brokerName}
                      </h4>
                    </div>
                    <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 shadow-2xs", badgeColor)}>
                      {summary.severity} Severity
                    </span>
                  </div>

                  {/* Operational Metrics Bar */}
                  <div className="grid grid-cols-2 gap-2 p-2 bg-[#FAF7F0] border border-[#D6CAA8] rounded-lg text-[11px]">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-[#5A6E54] font-bold block">Status</span>
                      <span className={cn("font-black uppercase text-[10px]", isAlert ? "text-rose-700" : "text-emerald-700")}>
                        {summary.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-[#5A6E54] font-bold block">Detected Issues</span>
                      <span className={cn("font-black", isAlert ? "text-rose-700 font-mono" : "text-[#1E331B]")}>
                        {summary.anomalyCount} {summary.anomalyCount === 1 ? 'Anomaly' : 'Anomalies'}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-[#D6CAA8]/50 flex items-center justify-between text-[10px] text-[#5A6E54]">
                      <span>Records Reviewed: <strong>{summary.totalRecordsReviewed}</strong></span>
                      <span className="text-emerald-800 font-bold">Deep Audit Active</span>
                    </div>
                  </div>

                  {/* Explanation Box */}
                  <div className="p-2 bg-white border border-[#D6CAA8] rounded-lg text-xs">
                    <span className="text-[9px] font-bold uppercase text-[#5A6E54] block">Explanation:</span>
                    <span className="text-[11px] font-semibold text-slate-800 line-clamp-2">
                      {summary.primaryIssue}
                    </span>
                  </div>
                </div>

                {/* Card Action Link */}
                <div className="flex items-center justify-between pt-2 border-t border-[#D6CAA8] text-xs font-bold text-[#1E331B]">
                  <span className="text-emerald-800 flex items-center gap-1.5 hover:underline">
                    <Search className="h-3.5 w-3.5" />
                    Open Investigation Popup
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#5A6E54]" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= FULL-SCREEN INVESTIGATION POPUP ================= */}
      {selectedSummary && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#FAF7F0] border-2 border-[#1E331B] w-full h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-[#1E331B] text-[#FAF7F0] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#D6CAA8]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-600/30 border border-rose-400 rounded-xl text-rose-300">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      Deep Broker Investigation
                    </span>
                    <span className="text-xs text-white/50">•</span>
                    <span className="text-xs font-bold text-white/80">
                      {selectedSummary.totalRecordsReviewed} Records Reviewed
                    </span>
                  </div>
                  <h2 className="text-base sm:text-xl font-black uppercase tracking-wider flex items-center gap-2 mt-0.5">
                    <span>Broker: {selectedSummary.brokerName}</span>
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                      selectedSummary.severity === 'High' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                    )}>
                      {selectedSummary.anomalyCount} Anomalies Flagged
                    </span>
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => handleExportBrokerCsv(selectedSummary)}
                  className="px-3 py-2 bg-yellow-400 hover:bg-yellow-300 text-[#1E331B] rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition"
                  title="Export all 20 columns to CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={() => setSelectedSummary(null)}
                  className="h-9 w-9 bg-white/10 hover:bg-white/20 text-[#FAF7F0] rounded-xl flex items-center justify-center transition cursor-pointer"
                  title="Close Window"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Sub-header Filter & Control Bar */}
            <div className="bg-[#EAE2D2] px-6 py-3 border-b border-[#D6CAA8] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5A6E54]" />
                  <input
                    type="text"
                    placeholder="Filter Sauda / PO / MR / Type..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="h-8 pl-8 pr-3 bg-white border border-[#D6CAA8] rounded-lg text-xs font-semibold text-[#1E331B] focus:outline-none focus:border-[#1E331B] w-64"
                  />
                </div>

                <select
                  value={modalSeverityFilter}
                  onChange={(e) => setModalSeverityFilter(e.target.value)}
                  className="h-8 px-2.5 bg-white border border-[#D6CAA8] rounded-lg text-xs font-bold text-[#1E331B]"
                >
                  <option value="ALL">All Severities</option>
                  <option value="High">High Severity</option>
                  <option value="Medium">Medium Severity</option>
                  <option value="Low">Low Severity</option>
                </select>

                <select
                  value={modalAnomalyTypeFilter}
                  onChange={(e) => setModalAnomalyTypeFilter(e.target.value)}
                  className="h-8 px-2.5 bg-white border border-[#D6CAA8] rounded-lg text-xs font-bold text-[#1E331B]"
                >
                  <option value="ALL">All Anomaly Types</option>
                  <option value="Exact Duplicate Transaction">Duplicate Transactions</option>
                  <option value="Contract vs Arrived Weight Mismatch">Weight Mismatch</option>
                  <option value="Zero or Missing Rate">Zero / Missing Rate</option>
                  <option value="Unusual Rate Variance">Rate Variance</option>
                  <option value="Deduction Calculation Discrepancy">Deduction Calculation</option>
                  <option value="Missing MR Number or Orphaned Arrival">Missing MR / Orphan</option>
                  <option value="Zero Contract Weight">Zero Contract Weight</option>
                </select>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-bold text-[#5A6E54]">
                <span>Showing <strong>{modalFilteredAnomalies.length}</strong> of <strong>{selectedSummary.anomalies.length}</strong> anomalies</span>
                <span className="text-[#1E331B] bg-white px-2.5 py-1 rounded-md border border-[#D6CAA8]">
                  Click row to inspect complete audit breakdown
                </span>
              </div>
            </div>

            {/* Modal Body: 20-Column Structured Table */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-[#FAF7F0]">
              <div className="bg-white border-2 border-[#D6CAA8] rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-[#EAE2D2] text-[#1E331B] text-[10px] font-black uppercase tracking-wider border-b-2 border-[#D6CAA8] sticky top-0 z-10 shadow-2xs">
                        <th className="p-3">Sl.</th>
                        <th className="p-3">Broker Name</th>
                        <th className="p-3">MR Number</th>
                        <th className="p-3">Sauda Number</th>
                        <th className="p-3">P.O. Number</th>
                        <th className="p-3">Date</th>
                        <th className="p-3 text-right">Contract Wt</th>
                        <th className="p-3 text-right">Temp Arrival</th>
                        <th className="p-3 text-right">Final Arrival</th>
                        <th className="p-3 text-right">Mill Insp Wt</th>
                        <th className="p-3 text-right">Sauda B Rate</th>
                        <th className="p-3">Deduction Type</th>
                        <th className="p-3">Deduct Qty/%</th>
                        <th className="p-3 text-right">Deduct Amt (₹)</th>
                        <th className="p-3">Expected Value</th>
                        <th className="p-3">Actual Value</th>
                        <th className="p-3">Difference</th>
                        <th className="p-3">Abnormality Type</th>
                        <th className="p-3">Detection Reason</th>
                        <th className="p-3 text-center">Severity</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D6CAA8] font-mono text-[11px] text-[#1E331B]">
                      {modalFilteredAnomalies.length > 0 ? (
                        modalFilteredAnomalies.map((item, idx) => {
                          const vStatus = statusOverrides[item.id] || item.verificationStatus;
                          const sevBadge =
                            item.severity === 'High'
                              ? 'bg-rose-600 text-white'
                              : item.severity === 'Medium'
                              ? 'bg-amber-600 text-white'
                              : 'bg-blue-600 text-white';

                          const statusBadge =
                            vStatus === 'Verified Legitimate'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : vStatus === 'Corrected'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300';

                          return (
                            <tr
                              key={idx}
                              onClick={() => setSelectedAnomalyDetail(item)}
                              className="hover:bg-amber-50/70 transition cursor-pointer select-none"
                            >
                              <td className="p-3 font-bold text-slate-500 font-sans">{idx + 1}</td>
                              <td className="p-3 font-bold font-sans text-[#1E331B]">{item.brokerName}</td>
                              <td className="p-3 font-bold text-blue-700">{item.mrNo || '—'}</td>
                              <td className="p-3 font-bold text-emerald-900">{item.saudaNo || '—'}</td>
                              <td className="p-3 font-bold text-[#1E331B]">{item.poNo || '—'}</td>
                              <td className="p-3 text-slate-600">{item.transactionDate || '—'}</td>
                              <td className="p-3 text-right font-bold">
                                {item.contractWeight > 0 ? `${item.contractWeight.toFixed(2)} MT` : '—'}
                              </td>
                              <td className="p-3 text-right">
                                {item.tempArrivalWeight > 0 ? `${item.tempArrivalWeight.toFixed(2)} MT` : '—'}
                              </td>
                              <td className="p-3 text-right font-bold text-emerald-700">
                                {item.finalArrivalWeight > 0 ? `${item.finalArrivalWeight.toFixed(2)} MT` : '—'}
                              </td>
                              <td className="p-3 text-right">
                                {item.millInspectionWeight > 0 ? `${item.millInspectionWeight.toFixed(2)} MT` : '—'}
                              </td>
                              <td className="p-3 text-right font-bold text-[#1E331B]">
                                {item.saudaRate > 0 ? `₹${item.saudaRate.toLocaleString('en-IN')}` : '₹0.00'}
                              </td>
                              <td className="p-3 font-sans max-w-[120px] truncate">{item.deductionType || '—'}</td>
                              <td className="p-3 font-sans">{item.deductionQtyOrPct || '—'}</td>
                              <td className="p-3 text-right font-bold text-rose-700">
                                {item.deductionAmount > 0 ? `₹${item.deductionAmount.toLocaleString('en-IN')}` : '—'}
                              </td>
                              <td className="p-3 font-sans text-slate-700 max-w-[160px] truncate" title={item.expectedValue}>
                                {item.expectedValue}
                              </td>
                              <td className="p-3 font-sans font-bold text-rose-800 max-w-[160px] truncate" title={item.actualValue}>
                                {item.actualValue}
                              </td>
                              <td className="p-3 font-sans font-bold text-amber-800 max-w-[120px] truncate" title={item.difference}>
                                {item.difference}
                              </td>
                              <td className="p-3 font-sans font-bold text-slate-900">
                                <span className="bg-[#FAF7F0] border border-[#D6CAA8] px-2 py-0.5 rounded-md">
                                  {item.anomalyType}
                                </span>
                              </td>
                              <td className="p-3 font-sans max-w-[220px] truncate text-slate-600" title={item.detectionReason}>
                                {item.detectionReason}
                              </td>
                              <td className="p-3 text-center">
                                <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider", sevBadge)}>
                                  {item.severity}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold border", statusBadge)}>
                                  {vStatus}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={21} className="p-12 text-center text-slate-400 font-sans">
                            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                            <span className="font-bold text-xs uppercase tracking-wider block text-slate-600">
                              No anomalies match current filter criteria.
                            </span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#EAE2D2] px-6 py-3 border-t-2 border-[#D6CAA8] flex flex-wrap items-center justify-between gap-3 text-xs text-[#5A6E54] font-medium">
              <div>
                <span>Audited broker: <strong className="text-[#1E331B]">{selectedSummary.brokerName}</strong></span>
                <span className="mx-2">•</span>
                <span>Total records analyzed: <strong className="text-[#1E331B]">{selectedSummary.totalRecordsReviewed}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedSummary(null)}
                  className="px-4 py-2 bg-[#1E331B] text-[#FAF7F0] font-bold rounded-xl hover:bg-[#2A4826] transition cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= SINGLE RECORD DEEP AUDIT POPUP ================= */}
      {selectedAnomalyDetail && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in zoom-in duration-150">
          <div className="bg-[#FAF7F0] border-2 border-[#1E331B] w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="bg-[#1E331B] text-[#FAF7F0] px-6 py-4 flex items-center justify-between border-b-2 border-[#D6CAA8]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-600/30 border border-rose-400 rounded-xl text-rose-300">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider">
                    {selectedAnomalyDetail.anomalyType}
                  </h3>
                  <p className="text-xs text-[#D6CAA8]">
                    Record Audit: {selectedAnomalyDetail.saudaNo} / {selectedAnomalyDetail.poNo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAnomalyDetail(null)}
                className="h-8 w-8 bg-white/10 hover:bg-white/20 text-[#FAF7F0] rounded-lg flex items-center justify-center transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
              {/* Alert Callout */}
              <div className="p-4 bg-white border-2 border-rose-200 rounded-xl shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">
                    Detection Rationale & Rule Trigger
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase",
                    selectedAnomalyDetail.severity === 'High' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                  )}>
                    {selectedAnomalyDetail.severity} Severity
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-800 leading-relaxed">
                  {selectedAnomalyDetail.detectionReason}
                </p>
              </div>

              {/* 20-Field Audit Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-white border border-[#D6CAA8] rounded-xl font-mono text-[11px]">
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">1. Broker Name</span>
                  <span className="font-bold text-[#1E331B]">{selectedAnomalyDetail.brokerName}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">2. MR Number</span>
                  <span className="font-bold text-blue-700">{selectedAnomalyDetail.mrNo || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">3. Sauda Number</span>
                  <span className="font-bold text-emerald-900">{selectedAnomalyDetail.saudaNo || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">4. P.O. Number</span>
                  <span className="font-bold text-[#1E331B]">{selectedAnomalyDetail.poNo || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">5. Transaction Date</span>
                  <span>{selectedAnomalyDetail.transactionDate || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">6. Contract Weight</span>
                  <span className="font-bold">{selectedAnomalyDetail.contractWeight > 0 ? `${selectedAnomalyDetail.contractWeight.toFixed(2)} MT` : '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">7. Temp Arrival Wt</span>
                  <span>{selectedAnomalyDetail.tempArrivalWeight > 0 ? `${selectedAnomalyDetail.tempArrivalWeight.toFixed(2)} MT` : '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">8. Final Arrival Wt</span>
                  <span className="font-bold text-emerald-700">{selectedAnomalyDetail.finalArrivalWeight > 0 ? `${selectedAnomalyDetail.finalArrivalWeight.toFixed(2)} MT` : '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">9. Mill Insp Wt</span>
                  <span>{selectedAnomalyDetail.millInspectionWeight > 0 ? `${selectedAnomalyDetail.millInspectionWeight.toFixed(2)} MT` : '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">10. Sauda B Rate</span>
                  <span className="font-bold text-[#1E331B]">{selectedAnomalyDetail.saudaRate > 0 ? `₹${selectedAnomalyDetail.saudaRate.toLocaleString('en-IN')}/Qtl` : '₹0.00'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">11. Deduction Type</span>
                  <span className="font-sans">{selectedAnomalyDetail.deductionType || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">12. Deduct Qty / %</span>
                  <span className="font-sans">{selectedAnomalyDetail.deductionQtyOrPct || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">13. Deduction Amount</span>
                  <span className="font-bold text-rose-700">{selectedAnomalyDetail.deductionAmount > 0 ? `₹${selectedAnomalyDetail.deductionAmount.toLocaleString('en-IN')}` : '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#5A6E54] block font-sans">Workflow Stage</span>
                  <span className="font-bold text-slate-800">{selectedAnomalyDetail.workflowStage}</span>
                </div>
              </div>

              {/* Comparison Box */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#EAE2D2] border border-[#D6CAA8] rounded-xl text-xs font-sans">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#5A6E54] block">14. Expected Value</span>
                  <span className="font-bold text-emerald-950 font-mono mt-0.5 block">{selectedAnomalyDetail.expectedValue}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#5A6E54] block">15. Actual Value</span>
                  <span className="font-bold text-rose-900 font-mono mt-0.5 block">{selectedAnomalyDetail.actualValue}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#5A6E54] block">16. Difference / Discrepancy</span>
                  <span className="font-black text-amber-900 font-mono mt-0.5 block">{selectedAnomalyDetail.difference}</span>
                </div>
              </div>

              {/* Action & Verification Status Selector */}
              <div className="p-4 bg-white border border-[#D6CAA8] rounded-xl space-y-3">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#5A6E54] block">Recommended Action:</span>
                  <p className="text-xs text-slate-700 font-medium mt-0.5">
                    {selectedAnomalyDetail.recommendedAction}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#D6CAA8] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#1E331B]">
                    Update 20. Verification Status:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {(['Pending Review', 'Under Investigation', 'Verified Legitimate', 'Corrected'] as const).map(st => {
                      const currentStatus = statusOverrides[selectedAnomalyDetail.id] || selectedAnomalyDetail.verificationStatus;
                      const isSelected = currentStatus === st;
                      return (
                        <button
                          key={st}
                          onClick={() => setStatusOverrides(prev => ({ ...prev, [selectedAnomalyDetail.id]: st }))}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border",
                            isSelected 
                              ? "bg-[#1E331B] text-white border-[#1E331B] shadow-xs" 
                              : "bg-[#FAF7F0] text-[#5A6E54] border-[#D6CAA8] hover:bg-white"
                          )}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[#EAE2D2] px-6 py-3 border-t border-[#D6CAA8] flex items-center justify-end">
              <button
                onClick={() => setSelectedAnomalyDetail(null)}
                className="px-4 py-1.5 bg-[#1E331B] text-[#FAF7F0] font-bold rounded-xl text-xs hover:bg-[#2A4826] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
