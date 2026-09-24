import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Download, 
  Printer, 
  Droplets, 
  Zap
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
  const [premiumFilter, setPremiumFilter] = useState<'ALL' | 'PREMIUM_ONLY' | 'NON_PREMIUM'>('ALL');
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
          (r.poNo && r.poNo.toLowerCase().includes(q)) ||
          r.supplier.toLowerCase().includes(q) ||
          r.broker.toLowerCase().includes(q) ||
          r.vehicleNo.toLowerCase().includes(q) ||
          r.juteGrade.toLowerCase().includes(q) ||
          (r.premium && r.premium.toLowerCase().includes(q)) ||
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
      if (claimFilter === 'WITH_CLAIM' && r.totalClaimAmount <= 0 && r.claimMoisture <= 0 && r.claimDust <= 0 && r.claimGradeDown <= 0) return false;
      if (claimFilter === 'NO_CLAIM' && (r.totalClaimAmount > 0 || r.claimMoisture > 0 || r.claimDust > 0 || r.claimGradeDown > 0)) return false;

      // Premium Filter
      if (premiumFilter === 'PREMIUM_ONLY' && !r.isPremium) return false;
      if (premiumFilter === 'NON_PREMIUM' && r.isPremium) return false;

      return true;
    });
  }, [inspections, searchTerm, gradeFilter, moistureFilter, claimFilter, premiumFilter]);

  // Aggregate stats of filtered set
  const filteredStats = useMemo(() => {
    let totalWt = 0;
    let totalClaim = 0;
    let moistureSum = 0;
    let claimMoistSum = 0;
    let dustSum = 0;
    let claimDustSum = 0;
    let gradeDownSum = 0;
    let claimGradeDownSum = 0;
    let totalChottaHbKg = 0;
    let premiumLotsCount = 0;
    let moistureClaimLots = 0;

    filteredRecords.forEach(r => {
      totalWt += r.weightMt;
      totalClaim += r.totalClaimAmount;
      moistureSum += r.actualMoisture;
      claimMoistSum += r.claimMoisture;
      dustSum += r.actualDust;
      claimDustSum += r.claimDust;
      gradeDownSum += r.actualGradeDown;
      claimGradeDownSum += r.claimGradeDown;
      totalChottaHbKg += r.totalChottaHabijabiKg;
      if (r.isPremium) premiumLotsCount += 1;
      if (r.claimMoisture > 0 || r.moistureDeductionAmount > 0) moistureClaimLots += 1;
    });

    const count = filteredRecords.length;
    const avgMoist = count > 0 ? (moistureSum / count) : 0;
    const avgClaimMoist = count > 0 ? (claimMoistSum / count) : 0;
    const avgDust = count > 0 ? (dustSum / count) : 0;
    const avgClaimDust = count > 0 ? (claimDustSum / count) : 0;
    const avgGradeDown = count > 0 ? (gradeDownSum / count) : 0;
    const avgClaimGradeDown = count > 0 ? (claimGradeDownSum / count) : 0;

    return {
      count,
      totalWt,
      totalClaim,
      avgMoist,
      avgClaimMoist,
      avgDust,
      avgClaimDust,
      avgGradeDown,
      avgClaimGradeDown,
      totalChottaHbKg,
      premiumLotsCount,
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
      "PO / Contract Ref",
      "Supplier",
      "Broker",
      "Vehicle No",
      "Grade",
      "Weight (MT)",
      "Actual Moisture %",
      "Claim Moisture %",
      "Actual Dust %",
      "Claim Dust %",
      "Actual Grade Down %",
      "Claim Grade Down %",
      "Chotta & Habi Jabi (Kg)",
      "Premium (Sauda Check Point)",
      "Moisture Claim (INR)",
      "Dust Claim (INR)",
      "Grade Down Claim (INR)",
      "Total Deductions (INR)",
      "Status",
      "Remarks"
    ];

    const rows = filteredRecords.map(r => [
      `"${r.mrNo}"`,
      `"${r.date}"`,
      `"${r.poNo || ''}"`,
      `"${r.supplier.replace(/"/g, '""')}"`,
      `"${r.broker.replace(/"/g, '""')}"`,
      `"${r.vehicleNo}"`,
      `"${r.juteGrade}"`,
      r.weightMt.toFixed(3),
      r.actualMoisture.toFixed(1),
      r.claimMoisture.toFixed(1),
      r.actualDust.toFixed(1),
      r.claimDust.toFixed(1),
      r.actualGradeDown.toFixed(1),
      r.claimGradeDown.toFixed(1),
      r.totalChottaHabijabiKg.toFixed(1),
      `"${r.premium || (r.isPremium ? 'Yes' : 'No')}"`,
      r.moistureDeductionAmount.toFixed(2),
      r.dustDeductionAmount.toFixed(2),
      r.gradeDownDeductionAmount.toFixed(2),
      r.totalClaimAmount.toFixed(2),
      `"${r.status}"`,
      `"${(r.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Inspection_Summary_Data_${new Date().toISOString().slice(0, 10)}.csv`);
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
                <span>{title || "Inspection Summary Details"}</span>
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
        <div className="bg-white border-b border-[#D6CAA8] px-4 py-2.5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 shrink-0 text-xs font-sans">
          <div className="bg-[#FAF7F0] p-2 rounded-xl border border-[#EAE2D2]">
            <span className="text-[9.5px] text-slate-500 font-bold block uppercase tracking-wider">MR Inspected</span>
            <span className="font-mono font-extrabold text-[#1E331B] text-xs sm:text-sm">{filteredStats.count} MR</span>
          </div>
          <div className="bg-[#FAF7F0] p-2 rounded-xl border border-[#EAE2D2]">
            <span className="text-[9.5px] text-slate-500 font-bold block uppercase tracking-wider">Total Weight</span>
            <span className="font-mono font-extrabold text-emerald-900 text-xs sm:text-sm">
              {filteredStats.totalWt.toLocaleString('en-IN', { minimumFractionDigits: 1 })} MT
            </span>
          </div>
          <div className="bg-[#FAF7F0] p-2 rounded-xl border border-[#EAE2D2]">
            <span className="text-[9.5px] text-slate-500 font-bold block uppercase tracking-wider">Moisture % & Claim</span>
            <span className={cn(
              "font-mono font-bold text-[11px] block truncate",
              filteredStats.avgMoist <= 15 ? "text-emerald-800" : "text-amber-800"
            )}>
              {filteredStats.avgMoist.toFixed(1)}% <span className="text-rose-700 font-semibold">(Clm: {filteredStats.avgClaimMoist.toFixed(1)}%)</span>
            </span>
          </div>
          <div className="bg-[#FAF7F0] p-2 rounded-xl border border-[#EAE2D2]">
            <span className="text-[9.5px] text-slate-500 font-bold block uppercase tracking-wider">Dust % & Claim</span>
            <span className="font-mono font-bold text-[11px] text-[#1E331B] block truncate">
              {filteredStats.avgDust.toFixed(1)}% <span className="text-rose-700 font-semibold">(Clm: {filteredStats.avgClaimDust.toFixed(1)}%)</span>
            </span>
          </div>
          <div className="bg-[#FAF7F0] p-2 rounded-xl border border-[#EAE2D2]">
            <span className="text-[9.5px] text-slate-500 font-bold block uppercase tracking-wider">Grade Down %</span>
            <span className="font-mono font-bold text-[11px] text-[#1E331B] block truncate">
              {filteredStats.avgGradeDown.toFixed(1)}% <span className="text-rose-700 font-semibold">(Clm: {filteredStats.avgClaimGradeDown.toFixed(1)}%)</span>
            </span>
          </div>
          <div className="bg-[#FAF7F0] p-2 rounded-xl border border-[#EAE2D2]">
            <span className="text-[9.5px] text-slate-500 font-bold block uppercase tracking-wider">Chotta & HB</span>
            <span className="font-mono font-extrabold text-[#1E331B] text-xs sm:text-sm">
              {filteredStats.totalChottaHbKg.toLocaleString('en-IN', { minimumFractionDigits: 0 })} Kg
            </span>
          </div>
          <div className="bg-[#FAF7F0] p-2 rounded-xl border border-[#EAE2D2]">
            <span className="text-[9.5px] text-slate-500 font-bold block uppercase tracking-wider">Total Claims</span>
            <span className="font-mono font-extrabold text-rose-800 text-xs sm:text-sm">
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
              placeholder="Search MR No, PO, supplier, broker, vehicle, grade, premium..."
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
                All Moist.
              </button>
              <button
                onClick={() => { setMoistureFilter('NORMAL'); setCurrentPage(1); }}
                className={cn("px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer", moistureFilter === 'NORMAL' ? "bg-emerald-700 text-white" : "text-slate-600 hover:text-emerald-800")}
              >
                ≤ 15%
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
            </div>

            {/* Premium Filter (Sauda Check Point) */}
            <div className="flex items-center bg-white border border-[#D6CAA8] rounded-xl p-0.5 shadow-2xs text-[11px]">
              <button
                onClick={() => { setPremiumFilter('ALL'); setCurrentPage(1); }}
                className={cn("px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer", premiumFilter === 'ALL' ? "bg-[#1E331B] text-white" : "text-slate-600 hover:text-[#1E331B]")}
              >
                All MR
              </button>
              <button
                onClick={() => { setPremiumFilter('PREMIUM_ONLY'); setCurrentPage(1); }}
                className={cn("px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1", premiumFilter === 'PREMIUM_ONLY' ? "bg-amber-700 text-white" : "text-slate-600 hover:text-amber-800")}
              >
                <Zap className="w-2.5 h-2.5" />
                <span>Premium Only (SCP)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-4">
          <div className="bg-white rounded-xl border border-[#D6CAA8] overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-[#FAF7F0] border-b border-[#D6CAA8] text-[#1E331B] font-mono text-[10px] uppercase tracking-wider">
                  <th className="p-2.5 font-bold">MR No</th>
                  <th className="p-2.5 font-bold">Date</th>
                  <th className="p-2.5 font-bold">Sauda / PO</th>
                  <th className="p-2.5 font-bold">Supplier & Broker</th>
                  <th className="p-2.5 font-bold">Grade & Wt (MT)</th>
                  <th className="p-2.5 font-bold text-center">Moisture % (Act/Clm)</th>
                  <th className="p-2.5 font-bold text-center">Dust % (Act/Clm)</th>
                  <th className="p-2.5 font-bold text-center">Grade Down %</th>
                  <th className="p-2.5 font-bold text-center">Chotta & Habi Jabi</th>
                  <th className="p-2.5 font-bold text-center bg-amber-50/70 border-x border-amber-200">
                    Premium <span className="text-[8.5px] font-normal text-amber-900 block">(Sauda Check Point)</span>
                  </th>
                  <th className="p-2.5 font-bold text-right">Total Claims (₹)</th>
                  <th className="p-2.5 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2EDE0] font-sans">
                {paginatedRows.length > 0 ? (
                  paginatedRows.map((r, idx) => (
                    <tr key={r.id || `insp-${idx}`} className="hover:bg-[#FAF7F0]/60 transition-colors">
                      {/* MR No */}
                      <td className="p-2.5 font-mono font-bold text-[#1E331B]">
                        {r.mrNo}
                      </td>
                      {/* Date */}
                      <td className="p-2.5 text-slate-600 text-[11px] whitespace-nowrap">
                        {r.date}
                      </td>
                      {/* PO / Contract */}
                      <td className="p-2.5 font-mono text-[11px] text-[#2E6B3E] font-bold">
                        {r.poNo || '---'}
                      </td>
                      {/* Supplier & Broker */}
                      <td className="p-2.5">
                        <div className="font-bold text-[#1E331B] text-[11.5px]">{r.supplier}</div>
                        <div className="text-[10px] text-slate-500 font-sans">{r.broker}</div>
                      </td>
                      {/* Grade & Weight */}
                      <td className="p-2.5">
                        <span className="font-bold text-emerald-900 font-mono text-[11px] block">{r.juteGrade}</span>
                        <span className="font-mono font-extrabold text-[#1E331B] text-[11px]">{r.weightMt.toFixed(3)} MT</span>
                      </td>
                      
                      {/* Moisture % (Act & Claim) */}
                      <td className="p-2.5 text-center font-mono">
                        <div className="flex items-center justify-center gap-1">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded font-bold text-[10px]",
                            r.actualMoisture <= 15 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900 border border-amber-300"
                          )}>
                            {r.actualMoisture.toFixed(1)}%
                          </span>
                          {r.claimMoisture > 0 && (
                            <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-800 border border-rose-300">
                              Clm: {r.claimMoisture.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Dust % (Act & Claim) */}
                      <td className="p-2.5 text-center font-mono">
                        <div className="flex items-center justify-center gap-1">
                          <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-800">
                            {r.actualDust.toFixed(1)}%
                          </span>
                          {r.claimDust > 0 && (
                            <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-800 border border-rose-300">
                              Clm: {r.claimDust.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Grade Down % (Act & Claim) */}
                      <td className="p-2.5 text-center font-mono">
                        <div className="flex items-center justify-center gap-1">
                          <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-800">
                            {r.actualGradeDown.toFixed(1)}%
                          </span>
                          {r.claimGradeDown > 0 && (
                            <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-800 border border-rose-300">
                              Clm: {r.claimGradeDown.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Chotta & Habi Jabi */}
                      <td className="p-2.5 text-center font-mono text-[11px]">
                        {r.totalChottaHabijabiKg > 0 ? (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-amber-50 text-amber-900 border border-amber-200">
                            {r.totalChottaHabijabiKg} Kg
                          </span>
                        ) : (
                          <span className="text-slate-400">0 Kg</span>
                        )}
                      </td>

                      {/* Premium (ONLY FROM SAUDA CHECK POINT) */}
                      <td className="p-2.5 text-center font-mono bg-amber-50/40 border-x border-amber-200">
                        {r.isPremium || (r.premium && r.premium !== "No" && r.premium !== "-") ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10.5px] bg-amber-100 text-amber-950 border border-amber-400 shadow-2xs">
                            <Zap className="w-2.5 h-2.5 text-amber-700" />
                            <span>{r.premium || 'Yes'}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">No Premium</span>
                        )}
                      </td>

                      {/* Total Claims (₹) */}
                      <td className="p-2.5 text-right font-mono font-extrabold text-rose-800">
                        {r.totalClaimAmount > 0 ? `₹${formatIndianCurrency(r.totalClaimAmount)}` : '₹0'}
                      </td>

                      {/* Status */}
                      <td className="p-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider bg-emerald-100 border border-emerald-300 text-emerald-900">
                          {r.status || 'Audited'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-500 italic">
                      No matching Mill Inspection Information Entry records found.
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
            <span className="px-2 py-1 bg-[#1E331B] text-white rounded-lg font-bold">
              {safePage} / {totalPages}
            </span>
            <button
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
