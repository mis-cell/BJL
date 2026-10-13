import React, { useState } from 'react';
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
  Info
} from 'lucide-react';
import { BrokerSuspicionSummary, SuspiciousAnomalyRecord } from '../../services/brokerSuspicionService';
import { cn, formatIndianCurrency } from '../../lib/utils';

interface SuspicionDetectedSectionProps {
  summaries: BrokerSuspicionSummary[];
  loading?: boolean;
  onRefresh?: () => void;
}

export default function SuspicionDetectedSection({
  summaries = [],
  loading = false,
  onRefresh
}: SuspicionDetectedSectionProps) {
  const [selectedSummary, setSelectedSummary] = useState<BrokerSuspicionSummary | null>(null);
  const [selectedAnomalyDetail, setSelectedAnomalyDetail] = useState<SuspiciousAnomalyRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSummaries = summaries.filter(s => 
    s.brokerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.primaryIssue.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAnomalies = summaries.reduce((acc, s) => acc + s.anomalyCount, 0);
  const highSeverityCount = summaries.filter(s => s.severity === 'High').length;

  return (
    <div className="bg-[#FAF7F0] border-2 border-[#D6CAA8] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D6CAA8] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-rose-700 shadow-sm">
            <ShieldAlert className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-[#1E331B] uppercase tracking-wider">
                SUSPICION DETECTED
              </h2>
              {totalAnomalies > 0 ? (
                <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                  {totalAnomalies} Anomalies Found
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                  All Clear
                </span>
              )}
            </div>
            <p className="text-xs text-[#5A6E54] font-medium mt-0.5">
              Automated anomaly detection across all broker-wise Sauda, P.O., arrival, and rate records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5A6E54]" />
            <input
              type="text"
              placeholder="Filter broker or anomaly..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9 pr-4 bg-white border-2 border-[#D6CAA8] rounded-xl text-xs font-semibold text-[#1E331B] focus:outline-none focus:border-[#1E331B] w-full sm:w-64"
            />
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="h-9 px-4 bg-[#1E331B] text-[#FAF7F0] border-2 border-[#1E331B] rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#2A4826] transition active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>{loading ? 'Analyzing...' : 'Re-Scan'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards Grid / Table */}
      {summaries.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-[#D6CAA8] rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-black text-[#1E331B] uppercase tracking-wider">
            No anomalies detected in the available data.
          </h3>
          <p className="text-xs text-[#5A6E54] max-w-md mx-auto">
            All broker transactions, weights, and rates comply with standard business validation rules and tolerances.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSummaries.map((summary, idx) => {
            const severityColor = 
              summary.severity === 'High' 
                ? 'bg-rose-50 border-rose-300 text-rose-900' 
                : summary.severity === 'Medium'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-blue-50 border-blue-300 text-blue-900';

            const badgeColor =
              summary.severity === 'High'
                ? 'bg-rose-600 text-white'
                : summary.severity === 'Medium'
                ? 'bg-amber-600 text-white'
                : 'bg-blue-600 text-white';

            return (
              <div
                key={idx}
                onClick={() => setSelectedSummary(summary)}
                className={cn(
                  "border-2 rounded-xl p-4 transition-all duration-200 cursor-pointer hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between gap-4 bg-white",
                  summary.severity === 'High' ? 'border-rose-300 hover:border-rose-500' : 'border-[#D6CAA8] hover:border-[#1E331B]'
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-black text-[#1E331B] uppercase tracking-wider line-clamp-1">
                      {summary.brokerName}
                    </span>
                    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider", badgeColor)}>
                      {summary.severity} Severity
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#5A6E54]">
                    <span>{summary.totalRecordsReviewed} Records Reviewed</span>
                    <span>•</span>
                    <span className="text-rose-700 font-extrabold">{summary.anomalyCount} Anomalies Found</span>
                  </div>

                  <div className="p-2 bg-[#FAF7F0] border border-[#D6CAA8] rounded-lg text-xs font-medium text-[#1E331B]">
                    <span className="font-bold block text-[10px] text-[#5A6E54] uppercase">Primary Issue:</span>
                    <span className="line-clamp-2">{summary.primaryIssue}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#D6CAA8] text-xs font-bold text-[#1E331B]">
                  <span className="text-emerald-800 flex items-center gap-1">
                    <Search className="h-3.5 w-3.5" />
                    Inspect Details
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#5A6E54]" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full-Screen Detailed Investigation Popup */}
      {selectedSummary && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-[#FAF7F0] border-2 border-[#1E331B] w-full h-full max-w-[98vw] max-h-[96vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="bg-[#1E331B] text-[#FAF7F0] px-6 py-4 flex items-center justify-between border-b-2 border-[#D6CAA8]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-600/30 border border-rose-400 rounded-xl text-rose-300">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black uppercase tracking-wider">
                      INVESTIGATION: {selectedSummary.brokerName}
                    </h2>
                    <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                      {selectedSummary.anomalyCount} Anomalies Detected
                    </span>
                  </div>
                  <p className="text-xs text-[#D6CAA8] font-medium mt-0.5">
                    Detailed record inspection, expected vs actual values, and detection rationale
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedSummary(null)}
                className="h-10 w-10 bg-white/10 hover:bg-white/20 text-[#FAF7F0] rounded-xl flex items-center justify-center transition cursor-pointer"
                title="Close Window"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 text-amber-900">
                <Info className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs font-medium space-y-1">
                  <span className="font-bold block uppercase tracking-wider">Audit Instructions</span>
                  <p>
                    The table below displays the exact Sauda and P.O. records that triggered the system anomaly detection rules. Click any row to inspect full calculation parameters and recommended verification actions.
                  </p>
                </div>
              </div>

              <div className="bg-white border-2 border-[#D6CAA8] rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#EAE2D2] text-[#1E331B] text-[11px] font-black uppercase tracking-wider border-b-2 border-[#D6CAA8]">
                        <th className="p-3">Sl.</th>
                        <th className="p-3">Anomaly Type</th>
                        <th className="p-3">Severity</th>
                        <th className="p-3">Sauda / P.O. No.</th>
                        <th className="p-3 text-right">Contract Wt (MT)</th>
                        <th className="p-3 text-right">Arrived Wt (MT)</th>
                        <th className="p-3 text-right">Rate (₹/Qtl)</th>
                        <th className="p-3">Detection Summary</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D6CAA8] text-xs font-semibold text-[#1E331B]">
                      {selectedSummary.anomalies.map((anomaly, idx) => {
                        const sevBadge =
                          anomaly.severity === 'High'
                            ? 'bg-rose-600 text-white'
                            : anomaly.severity === 'Medium'
                            ? 'bg-amber-600 text-white'
                            : 'bg-blue-600 text-white';

                        return (
                          <tr 
                            key={anomaly.id} 
                            onClick={() => setSelectedAnomalyDetail(anomaly)}
                            className="hover:bg-amber-50/60 transition cursor-pointer"
                          >
                            <td className="p-3 font-bold text-[#5A6E54]">{idx + 1}</td>
                            <td className="p-3 font-black text-rose-800">{anomaly.anomalyType}</td>
                            <td className="p-3">
                              <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase", sevBadge)}>
                                {anomaly.severity}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-bold">{anomaly.saudaNo}</div>
                              <div className="text-[10px] text-[#5A6E54] font-medium">PO: {anomaly.poNo}</div>
                            </td>
                            <td className="p-3 text-right font-bold">{anomaly.contractWeight.toFixed(2)} MT</td>
                            <td className="p-3 text-right font-bold">{anomaly.arrivedWeight > 0 ? `${anomaly.arrivedWeight.toFixed(2)} MT` : '—'}</td>
                            <td className="p-3 text-right font-bold">₹{anomaly.saudaRate.toFixed(2)}</td>
                            <td className="p-3 text-xs text-[#5A6E54] max-w-xs truncate" title={anomaly.reason}>
                              {anomaly.reason}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAnomalyDetail(anomaly);
                                }}
                                className="px-3 py-1.5 bg-[#1E331B] text-[#FAF7F0] rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#2A4826] transition cursor-pointer"
                              >
                                View Rationale
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#EAE2D2] border-t-2 border-[#D6CAA8] px-6 py-4 flex items-center justify-between">
              <span className="text-xs font-bold text-[#5A6E54]">
                Broker: <span className="text-[#1E331B] font-black">{selectedSummary.brokerName}</span> ({selectedSummary.anomalies.length} total records flagged)
              </span>
              <button
                onClick={() => setSelectedSummary(null)}
                className="px-5 py-2 bg-[#1E331B] text-[#FAF7F0] font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#2A4826] transition cursor-pointer"
              >
                Close Window
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Single Anomaly Deep-Dive Inspection Modal */}
      {selectedAnomalyDetail && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F0] border-2 border-[#1E331B] w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#1E331B] text-[#FAF7F0] px-6 py-4 flex items-center justify-between border-b-2 border-[#D6CAA8]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-600/30 border border-rose-400 rounded-xl text-rose-300">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    ANOMALY RATIONALE & CALCULATION
                  </h3>
                  <p className="text-[11px] text-[#D6CAA8] font-medium">
                    {selectedAnomalyDetail.anomalyType} — {selectedAnomalyDetail.brokerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAnomalyDetail(null)}
                className="h-8 w-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition cursor-pointer text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-[#D6CAA8] rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-black text-[#5A6E54] uppercase">Broker Name</span>
                  <p className="text-xs font-bold text-[#1E331B]">{selectedAnomalyDetail.brokerName}</p>
                </div>

                <div className="bg-white border border-[#D6CAA8] rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-black text-[#5A6E54] uppercase">Sauda & P.O. Number</span>
                  <p className="text-xs font-bold text-[#1E331B]">
                    Sauda: {selectedAnomalyDetail.saudaNo} | PO: {selectedAnomalyDetail.poNo}
                  </p>
                </div>

                <div className="bg-white border border-[#D6CAA8] rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-black text-[#5A6E54] uppercase">Contract Weight vs Arrived Weight</span>
                  <p className="text-xs font-bold text-[#1E331B]">
                    Contract: {selectedAnomalyDetail.contractWeight.toFixed(2)} MT | Arrived: {selectedAnomalyDetail.arrivedWeight.toFixed(2)} MT
                  </p>
                </div>

                <div className="bg-white border border-[#D6CAA8] rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-black text-[#5A6E54] uppercase">Weight Difference</span>
                  <p className={cn("text-xs font-black", selectedAnomalyDetail.weightDifference !== 0 ? 'text-rose-700' : 'text-emerald-700')}>
                    {selectedAnomalyDetail.weightDifference > 0 ? `+${selectedAnomalyDetail.weightDifference.toFixed(2)}` : selectedAnomalyDetail.weightDifference.toFixed(2)} MT
                  </p>
                </div>

                <div className="bg-white border border-[#D6CAA8] rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-black text-[#5A6E54] uppercase">Sauda B Rate & Comparison Rate</span>
                  <p className="text-xs font-bold text-[#1E331B]">
                    Actual: ₹{selectedAnomalyDetail.saudaRate.toFixed(2)}/Qtl | Broker Avg: ₹{selectedAnomalyDetail.comparisonRate.toFixed(2)}/Qtl
                  </p>
                </div>

                <div className="bg-white border border-[#D6CAA8] rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-black text-[#5A6E54] uppercase">Expected Value vs Actual Value</span>
                  <p className="text-xs font-bold text-[#1E331B]">
                    Exp: {selectedAnomalyDetail.expectedValue} | Act: {selectedAnomalyDetail.actualValue}
                  </p>
                </div>
              </div>

              <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 space-y-2">
                <span className="text-xs font-black text-rose-900 uppercase tracking-wider block">Reason for Detection</span>
                <p className="text-xs text-rose-800 font-medium leading-relaxed">
                  {selectedAnomalyDetail.reason}
                </p>
              </div>

              <div className="bg-white border border-[#D6CAA8] rounded-xl p-4 space-y-2">
                <span className="text-xs font-black text-[#1E331B] uppercase tracking-wider block">Detection Rule & Calculation</span>
                <p className="text-xs text-[#5A6E54] font-medium font-mono bg-[#FAF7F0] p-2.5 rounded-lg border border-[#D6CAA8]">
                  {selectedAnomalyDetail.detectionRule}
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-2">
                <span className="text-xs font-black text-emerald-900 uppercase tracking-wider block">Recommended Action for Verification</span>
                <p className="text-xs text-emerald-800 font-medium">
                  {selectedAnomalyDetail.recommendedAction}
                </p>
              </div>
            </div>

            <div className="bg-[#EAE2D2] border-t-2 border-[#D6CAA8] px-6 py-4 flex items-center justify-end">
              <button
                onClick={() => setSelectedAnomalyDetail(null)}
                className="px-5 py-2 bg-[#1E331B] text-[#FAF7F0] font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#2A4826] transition cursor-pointer"
              >
                Back to Investigation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
