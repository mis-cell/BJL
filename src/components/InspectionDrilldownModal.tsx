import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Download, 
  Printer, 
  Droplets, 
  ShieldAlert, 
  FileText, 
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { cn, formatIndianCurrency } from '../lib/utils';
import { InspectionRecord } from '../services/dashboardCalculationService';

interface InspectionDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  inspections: InspectionRecord[];
}

export default function InspectionDrilldownModal({
  isOpen,
  onClose,
  title,
  subtitle,
  inspections = []
}: InspectionDrilldownModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [moistureFilter, setMoistureFilter] = useState<'ALL' | 'NORMAL' | 'HIGH'>('ALL');
  const [claimFilter, setClaimFilter] = useState<'ALL' | 'WITH_CLAIM' | 'NO_CLAIM'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Filtered dataset
  const filteredRecords = useMemo(() => {
    return inspections.filter(r => {
      // Search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const match = 
          r.mrNo.toLowerCase().includes(q) ||
          r.supplier.toLowerCase().includes(q) ||
          r.broker.toLowerCase().includes(q) ||
          r.vehicleNo.toLowerCase().includes(q) ||
          r.juteGrade.toLowerCase().includes(q) ||
          r.remarks.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Grade Filter
      if (gradeFilter !== 'ALL' && r.juteGrade.toUpperCase() !== gradeFilter.toUpperCase()) {
        return false;
      }

      // Moisture Filter (>15% is High Moisture)
      if (moistureFilter === 'NORMAL' && r.actualMoisture > 15) return false;
      if (moistureFilter === 'HIGH' && r.actualMoisture <= 15) return false;

      // Claim Filter
      if (claimFilter === 'WITH_CLAIM' && r.totalClaimAmount <= 0 && r.claimMoisture <= 0) return false;
      if (claimFilter === 'NO_CLAIM' && (r.totalClaimAmount > 0 || r.claimMoisture > 0)) return false;

      return true;
    });
  }, [inspections, searchTerm, gradeFilter, moistureFilter, claimFilter]);

  // Aggregate stats of filtered set
  const filteredStats = useMemo(() => {
    let totalWt = 0;
    let totalClaim = 0;
    let moistureSum = 0;
    let moistureClaimLots = 0;

    filteredRecords.forEach(r => {
      totalWt += r.weightMt;
      totalClaim += r.totalClaimAmount;
      moistureSum += r.actualMoisture;
      if (r.claimMoisture > 0 || r.moistureDeductionAmount > 0) moistureClaimLots += 1;
    });

    const avgMoist = filteredRecords.length > 0 ? (moistureSum / filteredRecords.length) : 0;

    return {
      count: filteredRecords.length,
      totalWt,
      totalClaim,
      avgMoist,
      moistureClaimLots
    };
  }, [filteredRecords]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRecords.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      "MR No",
      "Date",
      "Supplier",
      "Broker",
      "Vehicle No",
      "Grade",
      "Weight (MT)",
      "Actual Moisture %",
      "Claim Moisture %",
      "Moisture Claim (INR)",
      "Quality Claim (INR)",
      "Delivery Claim (INR)",
      "Total Deductions (INR)",
      "Status",
      "Remarks"
    ];

    const rows = filteredRecords.map(r => [
      `"${r.mrNo}"`,
      `"${r.date}"`,
      `"${r.supplier.replace(/"/g, '""')}"`,
      `"${r.broker.replace(/"/g, '""')}"`,
      `"${r.vehicleNo}"`,
      `"${r.juteGrade}"`,
      r.weightMt.toFixed(3),
      r.actualMoisture.toFixed(1),
      r.claimMoisture.toFixed(1),
      r.moistureDeductionAmount.toFixed(2),
      r.qualityDeductionAmount.toFixed(2),
      r.deliveryClaimAmount.toFixed(2),
      r.totalClaimAmount.toFixed(2),
      `"${r.status}"`,
      `"${(r.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Inspection_Moisture_Claims_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#FAF7F0] border-2 border-[#1E331B] rounded-2xl shadow-2xl w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-[#1E331B] text-white p-4 sm:p-5 flex items-center justify-between border-b border-[#D6CAA8] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 text-emerald-300">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-serif font-black tracking-wide flex items-center gap-2">
                <span>{title || "Inspection, Moisture & Quality Claims Traceability"}</span>
              </h2>
              {subtitle && (
                <p className="text-xs text-emerald-200/90 font-sans mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Download filtered records as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Print Inspection Report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-900/80 text-white transition-colors cursor-pointer border border-white/20"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Aggregate KPI Ribbon */}
        <div className="bg-white border-b border-[#D6CAA8] px-4 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 text-xs font-sans">
          <div className="bg-[#FAF7F0] p-2 rounded-xl border border-[#EAE2D2]">
            <span className="text-[10px] text-slate-500 font-bold block">Inspected Lots</span>
            <span className="font-mono font-extrabold text-[#1E331B] text-sm">{filteredStats.count} Lots</span>
          </div>
          <div className="bg-[#FAF7F0] p-2 rounded-xl border border-[#EAE2D2]">
            <span className="text-[10px] text-slate-500 font-bold block">Total Inspected Weight</span>
            <span className="font-mono font-extrabold text-emerald-900 text-sm">
              {filteredStats.totalWt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} MT
            </span>
          </div>
          <div className="bg-[#FAF7F0] p-2 rounded-xl border border-[#EAE2D2]">
            <span className="text-[10px] text-slate-500 font-bold block">Average Moisture %</span>
            <span className={cn(
              "font-mono font-extrabold text-sm",
              filteredStats.avgMoist <= 15 ? "text-emerald-800" : "text-amber-800"
            )}>
              {filteredStats.avgMoist.toFixed(1)}% {filteredStats.avgMoist <= 15 ? "✓ Normal" : "⚠️ High"}
            </span>
          </div>
          <div className="bg-[#FAF7F0] p-2 rounded-xl border border-[#EAE2D2]">
            <span className="text-[10px] text-slate-500 font-bold block">Total Deductions & Claims</span>
            <span className="font-mono font-extrabold text-rose-800 text-sm">
              ₹{formatIndianCurrency(filteredStats.totalClaim)}
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-3 bg-[#FAF7F0] border-b border-[#D6CAA8] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search MR No, supplier, broker, vehicle, grade..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="h-8 pl-8 pr-3 bg-white border border-[#D6CAA8] rounded-xl text-xs text-[#1E331B] focus:outline-none focus:ring-1 focus:ring-[#1E331B] w-full shadow-2xs"
            />
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Moisture Filter */}
            <div className="flex items-center bg-white border border-[#D6CAA8] rounded-xl p-0.5 shadow-2xs text-[11px]">
              <button
                onClick={() => { setMoistureFilter('ALL'); setCurrentPage(1); }}
                className={cn("px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer", moistureFilter === 'ALL' ? "bg-[#1E331B] text-white" : "text-slate-600 hover:text-[#1E331B]")}
              >
                All Moisture
              </button>
              <button
                onClick={() => { setMoistureFilter('NORMAL'); setCurrentPage(1); }}
                className={cn("px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer", moistureFilter === 'NORMAL' ? "bg-emerald-700 text-white" : "text-slate-600 hover:text-emerald-800")}
              >
                ≤ 15% Normal
              </button>
              <button
                onClick={() => { setMoistureFilter('HIGH'); setCurrentPage(1); }}
                className={cn("px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer", moistureFilter === 'HIGH' ? "bg-amber-700 text-white" : "text-slate-600 hover:text-amber-800")}
              >
                &gt; 15% High
              </button>
            </div>

            {/* Claim Filter */}
            <div className="flex items-center bg-white border border-[#D6CAA8] rounded-xl p-0.5 shadow-2xs text-[11px]">
              <button
                onClick={() => { setClaimFilter('ALL'); setCurrentPage(1); }}
                className={cn("px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer", claimFilter === 'ALL' ? "bg-[#1E331B] text-white" : "text-slate-600 hover:text-[#1E331B]")}
              >
                All Claims
              </button>
              <button
                onClick={() => { setClaimFilter('WITH_CLAIM'); setCurrentPage(1); }}
                className={cn("px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer", claimFilter === 'WITH_CLAIM' ? "bg-rose-700 text-white" : "text-slate-600 hover:text-rose-800")}
              >
                With Claims
              </button>
              <button
                onClick={() => { setClaimFilter('NO_CLAIM'); setCurrentPage(1); }}
                className={cn("px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer", claimFilter === 'NO_CLAIM' ? "bg-emerald-700 text-white" : "text-slate-600 hover:text-emerald-800")}
              >
                Zero Claims
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-4">
          <div className="bg-white rounded-xl border border-[#D6CAA8] overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#FAF7F0] border-b border-[#D6CAA8] text-[#1E331B] font-mono text-[10.5px] uppercase tracking-wider">
                  <th className="p-2.5 font-bold">MR / Pass No</th>
                  <th className="p-2.5 font-bold">Date</th>
                  <th className="p-2.5 font-bold">Supplier</th>
                  <th className="p-2.5 font-bold">Broker</th>
                  <th className="p-2.5 font-bold">Grade</th>
                  <th className="p-2.5 font-bold text-right">Weight (MT)</th>
                  <th className="p-2.5 font-bold text-center">Actual Moist. %</th>
                  <th className="p-2.5 font-bold text-center">Claim Moist. %</th>
                  <th className="p-2.5 font-bold text-right">Moist. Claim (₹)</th>
                  <th className="p-2.5 font-bold text-right">Total Ded. (₹)</th>
                  <th className="p-2.5 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2EDE0] font-sans">
                {paginatedRows.length > 0 ? (
                  paginatedRows.map((r, idx) => (
                    <tr key={r.id || `insp-${idx}`} className="hover:bg-[#FAF7F0]/60 transition-colors">
                      <td className="p-2.5 font-mono font-bold text-[#1E331B]">
                        {r.mrNo}
                      </td>
                      <td className="p-2.5 text-slate-600 text-[11px] whitespace-nowrap">
                        {r.date}
                      </td>
                      <td className="p-2.5 font-medium text-[#1E331B]">
                        {r.supplier}
                      </td>
                      <td className="p-2.5 text-slate-600 text-[11px]">
                        {r.broker}
                      </td>
                      <td className="p-2.5 font-bold text-emerald-900 font-mono">
                        {r.juteGrade}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-[#1E331B]">
                        {r.weightMt.toFixed(3)}
                      </td>
                      <td className="p-2.5 text-center font-mono">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md font-bold text-[10.5px]",
                          r.actualMoisture <= 15 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900 border border-amber-300"
                        )}>
                          {r.actualMoisture.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-mono">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md font-bold text-[10.5px]",
                          r.claimMoisture > 0 ? "bg-rose-100 text-rose-800 border border-rose-300" : "text-slate-400"
                        )}>
                          {r.claimMoisture > 0 ? `${r.claimMoisture.toFixed(1)}%` : '0%'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-rose-700">
                        {r.moistureDeductionAmount > 0 ? `₹${formatIndianCurrency(r.moistureDeductionAmount)}` : '₹0'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-extrabold text-rose-800">
                        {r.totalClaimAmount > 0 ? `₹${formatIndianCurrency(r.totalClaimAmount)}` : '₹0'}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider bg-emerald-100 border border-emerald-300 text-emerald-900">
                          {r.status || 'Audited'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-500 italic">
                      No matching inspection or moisture audit records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer / Pagination */}
        <div className="p-3 bg-[#FAF7F0] border-t border-[#D6CAA8] flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 text-xs text-slate-600 font-mono">
          <span>
            Showing page {safePage} of {totalPages} ({filteredRecords.length} records found)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={safePage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 bg-white border border-[#D6CAA8] rounded-lg disabled:opacity-50 font-bold hover:bg-[#EAE2D2] cursor-pointer shadow-2xs"
            >
              Previous
            </button>
            <span className="font-bold text-[#1E331B] px-1">{safePage}</span>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1 bg-white border border-[#D6CAA8] rounded-lg disabled:opacity-50 font-bold hover:bg-[#EAE2D2] cursor-pointer shadow-2xs"
            >
              Next
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
