import React, { useState, useMemo, useEffect } from 'react';
import {
  ClipboardList,
  Scale,
  Layers,
  TrendingUp,
  Download,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Eye,
  Search,
  Filter,
  RefreshCw,
  ShieldCheck,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MONTHS } from './types';
import { isUserId10, getCurrentUserContext } from '../../lib/permissions';
import { supabase } from '../../lib/supabase';
import { dbModule } from '../../services/dbModule';
import SaudaPrintSlip from '../SaudaPrintSlip';

interface SaudaDashboardViewProps {
  saudaData: any[];
}

export const SaudaDashboardView: React.FC<SaudaDashboardViewProps> = ({ saudaData: initialSaudaData }) => {
  const [saudaList, setSaudaList] = useState<any[]>(initialSaudaData || []);
  const [selectedSaudaForPreview, setSelectedSaudaForPreview] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isUser10 = isUserId10();
  const userCtx = getCurrentUserContext();
  const currentUsername = String(userCtx?.username || userCtx?.userName || userCtx?.userId || 'USER 10').toUpperCase();

  useEffect(() => {
    setSaudaList(initialSaudaData || []);
  }, [initialSaudaData]);

  const refreshSaudas = async () => {
    try {
      const data = await dbModule.fetchAll('sauda_master');
      if (data) setSaudaList(data);
    } catch (err) {
      console.error("Failed to refresh saudas:", err);
    }
  };

  const handleApprove = async (sauda: any) => {
    const sId = sauda.sauda_id || sauda.id;
    if (!sId) return;
    setActionLoading(sId);
    try {
      if (supabase) {
        const { error } = await supabase
          .from('sauda_master')
          .update({
            status: 'approved',
            approval_status: 'approved',
            approved_by: currentUsername,
            approved_at: new Date().toISOString(),
            rejected_by: null,
            rejected_at: null
          })
          .eq('sauda_id', sId);
        if (error) throw error;
      }

      setSaudaList(prev => prev.map(s => {
        if ((s.sauda_id || s.id) === sId) {
          return {
            ...s,
            status: 'approved',
            approval_status: 'approved',
            approved_by: currentUsername,
            approved_at: new Date().toISOString(),
            rejected_by: null,
            rejected_at: null
          };
        }
        return s;
      }));

      window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: 'sauda_master' } }));
      alert(`Order #${sauda.sauda_no} has been APPROVED! It is now available in Sauda Check Point under P.O Contract.`);
    } catch (err: any) {
      console.error("Approval error:", err);
      alert("Failed to approve contract: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (sauda: any) => {
    const sId = sauda.sauda_id || sauda.id;
    if (!sId) return;
    const confirmReject = window.confirm(`Are you sure you want to REJECT Sauda Order #${sauda.sauda_no}? It will NOT appear in Sauda Check Point.`);
    if (!confirmReject) return;

    setActionLoading(sId);
    try {
      if (supabase) {
        const { error } = await supabase
          .from('sauda_master')
          .update({
            status: 'rejected',
            approval_status: 'rejected',
            rejected_by: currentUsername,
            rejected_at: new Date().toISOString()
          })
          .eq('sauda_id', sId);
        if (error) throw error;
      }

      setSaudaList(prev => prev.map(s => {
        if ((s.sauda_id || s.id) === sId) {
          return {
            ...s,
            status: 'rejected',
            approval_status: 'rejected',
            rejected_by: currentUsername,
            rejected_at: new Date().toISOString()
          };
        }
        return s;
      }));

      window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: 'sauda_master' } }));
      alert(`Order #${sauda.sauda_no} has been REJECTED. It will not appear in Sauda Check Point.`);
    } catch (err: any) {
      console.error("Rejection error:", err);
      alert("Failed to reject contract: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUser10Saudas = useMemo(() => {
    return saudaList.filter(s => {
      const st = String(s.status || s.approval_status || 'pending').toLowerCase();
      const isAppr = st === 'approved' || Boolean(s.approved_by && st !== 'rejected');
      const isRej = st === 'rejected' || Boolean(s.rejected_by && st === 'rejected');
      const isPend = !isAppr && !isRej;

      if (filterStatus === 'pending' && !isPend) return false;
      if (filterStatus === 'approved' && !isAppr) return false;
      if (filterStatus === 'rejected' && !isRej) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const no = String(s.sauda_no || '').toLowerCase();
        const broker = String(s.broker || '').toLowerCase();
        const supplier = String(s.supplier || '').toLowerCase();
        const rate = String(s.b_rate || '').toLowerCase();
        return no.includes(q) || broker.includes(q) || supplier.includes(q) || rate.includes(q);
      }

      return true;
    });
  }, [saudaList, filterStatus, searchQuery]);

  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());

  const saudaAggregates = useMemo(() => {
    let count = saudaList.length;
    let totalWeight = 0;
    let totalUnits = 0;
    let sumRate = 0;
    let rateCount = 0;

    saudaList.forEach(s => {
      totalWeight += Number(s.total_wt_in_ton) || 0;
      totalUnits += Number(s.total_unit) || 0;
      if (s.b_rate) {
        sumRate += Number(s.b_rate);
        rateCount++;
      }
    });

    return {
      count,
      totalWeight: parseFloat(totalWeight.toFixed(3)),
      totalUnits,
      avgRate: rateCount > 0 ? parseFloat((sumRate / rateCount).toFixed(2)) : 0
    };
  }, [saudaList]);

  const saudaChartData = useMemo(() => {
    const brokerMap: Record<string, number> = {};
    saudaList.forEach(s => {
      const bName = s.broker || 'DIRECT';
      const wt = Number(s.total_wt_in_ton) || 0;
      brokerMap[bName] = (brokerMap[bName] || 0) + wt;
    });
    return Object.entries(brokerMap).map(([name, weight]) => ({
      name,
      weight: parseFloat(weight.toFixed(3))
    })).sort((a, b) => b.weight - a.weight).slice(0, 8);
  }, [saudaList]);

  const monthlySaudaList = useMemo(() => {
    return saudaList.filter(item => {
      if (!item.date) return false;
      const d = new Date(item.date);
      return (d.getMonth() + 1) === reportMonth && d.getFullYear() === reportYear;
    });
  }, [saudaList, reportMonth, reportYear]);

  const monthlySaudaAggregates = useMemo(() => {
    let count = monthlySaudaList.length;
    let totalWeight = 0;
    let totalUnits = 0;
    let sumRate = 0;
    let rateCount = 0;

    monthlySaudaList.forEach(s => {
      totalWeight += Number(s.total_wt_in_ton) || 0;
      totalUnits += Number(s.total_unit) || 0;
      if (s.b_rate) {
        sumRate += Number(s.b_rate);
        rateCount++;
      }
    });

    return {
      count,
      totalWeight: parseFloat(totalWeight.toFixed(3)),
      totalUnits,
      avgRate: rateCount > 0 ? parseFloat((sumRate / rateCount).toFixed(2)) : 0
    };
  }, [monthlySaudaList]);

  const handleDownloadPdf = () => {
    if (monthlySaudaList.length === 0) {
      alert("No Sauda contracts available for the selected month to export.");
      return;
    }

    try {
      const doc = new jsPDF();
      const monthLabel = MONTHS.find(m => m.value === reportMonth)?.label || 'Report';
      const yearLabel = reportYear;

      // Draw elegant branding header
      doc.setFillColor(30, 41, 59); // deep slate
      doc.rect(0, 0, 210, 38, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("MILL SAUDA ASSOCIATES", 15, 16);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Monthly Sauda Contract Summary: ${monthLabel.toUpperCase()} - ${yearLabel}`, 15, 23);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`, 15, 29);

      // KPIs container background
      doc.setFillColor(241, 245, 249);
      doc.rect(15, 45, 180, 24, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(15, 45, 180, 24, 'S');

      doc.setTextColor(15, 23, 42); // slate-900
      
      // KPI 1: CONTRACTS
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("TOTAL CONTRACTS", 20, 52);
      doc.setFontSize(12);
      doc.text(`${monthlySaudaAggregates.count}`, 20, 61);

      // KPI 2: TOTAL WEIGHT
      doc.setFontSize(8);
      doc.text("AGGREGATE MASS (MT)", 65, 52);
      doc.setFontSize(12);
      doc.text(`${monthlySaudaAggregates.totalWeight.toLocaleString()} MT`, 65, 61);

      // KPI 3: TOTAL UNITS
      doc.setFontSize(8);
      doc.text("TOTAL UNITS (BALES)", 115, 52);
      doc.setFontSize(12);
      doc.text(`${monthlySaudaAggregates.totalUnits.toLocaleString()}`, 115, 61);

      // KPI 4: AVERAGE RATE
      doc.setFontSize(8);
      doc.text("AVG B_RATE (PER QTL)", 155, 52);
      doc.setFontSize(12);
      doc.text(`INR ${monthlySaudaAggregates.avgRate.toLocaleString()}`, 155, 61);

      // Table Headers and data rows
      const headers = [['DATE', 'SAUDA NO', 'SUPPLIER NAME', 'BROKER NAME', 'SOURCING AREA', 'UNIT QTY', 'RATE (QTL)', 'NET MASS (MT)']];
      const rows = monthlySaudaList.map(item => [
        item.date ? new Date(item.date).toLocaleDateString('en-GB') : 'N/A',
        `#${item.sauda_no || 'N/A'}`,
        item.supplier || 'DIRECT',
        item.broker || 'DIRECT',
        item.area || 'N/A',
        `${item.total_unit || 0} ${item.unit_type || 'BALES'}`,
        item.b_rate ? `Rs ${Number(item.b_rate).toFixed(2)}` : '--',
        `${(Number(item.total_wt_in_ton) || 0).toFixed(3)} MT`
      ]);

      // jspdf-autotable injection
      autoTable(doc, {
        startY: 76,
        head: headers,
        body: rows,
        theme: 'striped',
        styles: {
          fontSize: 8.5,
          font: 'helvetica',
          textColor: [51, 65, 85],
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [13, 148, 136],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 38 },
          3: { cellWidth: 34 },
          4: { cellWidth: 25, halign: 'center' },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 22, halign: 'right' },
          7: { cellWidth: 24, halign: 'right' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { left: 15, right: 15 },
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            data.settings.margin.left,
            doc.internal.pageSize.height - 10
          );
          doc.text(
            "Mill PO Automation System - All Rights Reserved",
            doc.internal.pageSize.width - data.settings.margin.right - 70,
            doc.internal.pageSize.height - 10
          );
        }
      });

      doc.save(`Sauda_Monthly_Report_${monthLabel}_${yearLabel}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Error generating PDF: " + (error as Error).message);
    }
  };

  if (isUser10) {
    return (
      <div className="flex flex-col space-y-4 font-sans text-slate-800">
        {/* User 10 Executive Header */}
        <div className="bg-[#174C2C] text-white p-4 rounded-2xl shadow-md border border-[#0F351E] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 font-black flex items-center justify-center shadow-inner text-sm">
              U10
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-wide uppercase text-amber-300">
                  Sauda Dashboard • User ID 10 Approval Desk
                </h2>
                <span className="bg-amber-400/20 text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-400/30">
                  Authority Level
                </span>
              </div>
              <p className="text-xs text-emerald-200">
                Review, preview, and approve or reject Sauda Contracts before they appear in Sauda Check Point.
              </p>
            </div>
          </div>

          <button
            onClick={refreshSaudas}
            className="px-3 py-1.5 bg-emerald-800/80 hover:bg-emerald-800 border border-emerald-500/40 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Action & Filter Toolbar */}
        <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Order #, Broker, Supplier, Rate..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 font-medium outline-none focus:border-emerald-600 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({saudaList.length})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              Pending Approval ({saudaList.filter(s => {
                const st = String(s.status || s.approval_status || '').toLowerCase();
                return st !== 'approved' && st !== 'rejected' && !s.approved_by && !s.rejected_by;
              }).length})
            </button>
            <button
              onClick={() => setFilterStatus('approved')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'approved'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              Approved ({saudaList.filter(s => {
                const st = String(s.status || s.approval_status || '').toLowerCase();
                return st === 'approved' || (s.approved_by && st !== 'rejected');
              }).length})
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'rejected'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              Rejected ({saudaList.filter(s => {
                const st = String(s.status || s.approval_status || '').toLowerCase();
                return st === 'rejected' || (s.rejected_by && st === 'rejected');
              }).length})
            </button>
          </div>
        </div>

        {/* User ID 10 Specific Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto min-h-[350px]">
            <table className="w-full border-collapse text-xs min-w-[700px]">
              <thead className="bg-[#174C2C] text-white sticky top-0 z-10">
                <tr className="h-10 text-[11px] font-black uppercase tracking-wider">
                  <th className="px-4 py-2 text-center">Date</th>
                  <th className="px-4 py-2 text-center">Order No.</th>
                  <th className="px-5 py-2 text-left">Broker</th>
                  <th className="px-5 py-2 text-right">B. Rate</th>
                  <th className="px-4 py-2 text-center">Print Preview Only</th>
                  <th className="px-4 py-2 text-center">Approve</th>
                  <th className="px-4 py-2 text-center">Reject</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUser10Saudas.map((entry, idx) => {
                  const sId = entry.sauda_id || entry.id;
                  const st = String(entry.status || entry.approval_status || 'pending').toLowerCase();
                  const isApproved = st === 'approved' || Boolean(entry.approved_by && st !== 'rejected');
                  const isRejected = st === 'rejected' || Boolean(entry.rejected_by && st === 'rejected');
                  const isLoading = actionLoading === sId;

                  return (
                    <tr
                      key={sId || idx}
                      className={`h-12 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      } hover:bg-amber-50/50`}
                    >
                      {/* 1. Date */}
                      <td className="px-4 text-center font-mono text-[11px] text-slate-600 font-bold">
                        {entry.date ? new Date(entry.date).toLocaleDateString('en-GB') : '--'}
                      </td>

                      {/* 2. Order No. */}
                      <td className="px-4 text-center font-bold text-slate-900 font-mono">
                        <span className="bg-slate-100 text-slate-900 px-2 py-0.5 rounded-md border border-slate-200">
                          #{entry.sauda_no}
                        </span>
                      </td>

                      {/* 3. Broker */}
                      <td className="px-5 text-left font-bold text-slate-800 uppercase">
                        {entry.broker || 'DIRECT'}
                      </td>

                      {/* 4. B. Rate */}
                      <td className="px-5 text-right font-black font-mono text-emerald-800 bg-emerald-50/30">
                        ₹{Number(entry.b_rate || 0).toLocaleString()}
                      </td>

                      {/* 5. Print Preview Only */}
                      <td className="px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedSaudaForPreview(entry)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                          title="Print Preview Only"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                          <span>Print Preview Only</span>
                        </button>
                      </td>

                      {/* 6. Approve */}
                      <td className="px-4 text-center">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-[11px] font-black">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Approved
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleApprove(entry)}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1 active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                            <span>Approve</span>
                          </button>
                        )}
                      </td>

                      {/* 7. Reject */}
                      <td className="px-4 text-center">
                        {isRejected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-[11px] font-black">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            Rejected
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleReject(entry)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1 active:scale-95"
                          >
                            <XCircle className="w-3.5 h-3.5 text-white" />
                            <span>Reject</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredUser10Saudas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 bg-slate-50/50">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <ClipboardList className="h-8 w-8 text-slate-400" />
                        <p className="font-bold text-sm text-slate-700">No Sauda Contracts Found</p>
                        <p className="text-xs text-slate-400">No contracts match the selected status or search filter.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Print Preview Modal */}
        {selectedSaudaForPreview && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-4 shadow-2xl max-w-2xl w-full flex flex-col space-y-3 max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase">
                  <Printer className="w-4 h-4 text-emerald-700" />
                  <span>Print Preview — Sauda Contract #{selectedSaudaForPreview.sauda_no}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSaudaForPreview(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-x-auto flex justify-center py-2 bg-slate-100 rounded-xl">
                <SaudaPrintSlip
                  sauda={selectedSaudaForPreview}
                  onClose={() => setSelectedSaudaForPreview(null)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedSaudaForPreview(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Contract</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <React.Fragment>
      {/* Monthly Summary Export Header */}
      <div className="bg-white border border-emerald-100 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase text-emerald-950 tracking-wider">
            Monthly Summary:
          </span>
          <select
            value={reportMonth}
            onChange={(e) => setReportMonth(Number(e.target.value))}
            className="text-[10px] font-bold bg-slate-50 border border-emerald-200 rounded-lg px-2 py-1 text-slate-800"
          >
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <input
            type="number"
            value={reportYear}
            onChange={(e) => setReportYear(Number(e.target.value))}
            className="w-16 text-[10px] font-bold bg-slate-50 border border-emerald-200 rounded-lg px-2 py-1 text-slate-800"
          />
        </div>

        <button
          onClick={handleDownloadPdf}
          className="bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Download className="h-3 w-3" />
          Export Month PDF ({monthlySaudaList.length} deals)
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-emerald-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-black text-emerald-900 leading-none mb-1">
                {saudaAggregates.count}
              </p>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                Sauda Contracts
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <ClipboardList className="h-4 w-4 text-emerald-700" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-blue-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-black text-blue-900 leading-none mb-1">
                {saudaAggregates.totalWeight.toLocaleString()} T
              </p>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                Total Weight Out
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Scale className="h-4 w-4 text-blue-700" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-teal-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-black text-teal-900 leading-none mb-1">
                {saudaAggregates.totalUnits.toLocaleString()}
              </p>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                Aggregate Units
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
              <Layers className="h-4 w-4 text-teal-700" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-amber-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-black text-amber-900 leading-none mb-1">
                ₹ {saudaAggregates.avgRate.toLocaleString()}
              </p>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                Weighted Avg Rate / Ql
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-amber-700" />
            </div>
          </div>
        </div>
      </div>

      {/* CHART + SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CHART */}
        <div className="lg:col-span-2 bg-white border border-emerald-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-[10px] font-black uppercase text-emerald-950 tracking-wider">
                Top Brokers by Contract Weight
              </h4>
              <p className="text-[8px] text-slate-400 italic">
                Distribution based on registered Sauda logs
              </p>
            </div>
            <span className="text-[8px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg">
              LIVE DATA
            </span>
          </div>

          <div className="h-56 mt-2 font-mono text-[9px]">
            {saudaChartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                <span>No transaction records found</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <BarChart data={saudaChartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                  <XAxis dataKey="name" tick={{ fontSize: 7.5 }} />
                  <YAxis tick={{ fontSize: 7.5 }} />
                  <RechartsTooltip
                    contentStyle={{
                      fontSize: 9,
                      borderRadius: 10,
                      border: "1px solid #d1fae5"
                    }}
                  />
                  <Bar dataKey="weight" fill="#047857" radius={[5, 5, 0, 0]}>
                    {saudaChartData.map((_entry, index) => {
                      const colors = [
                        '#047857',
                        '#0f766e',
                        '#15803d',
                        '#059669',
                        '#16a34a'
                      ];
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={colors[index % colors.length]}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* SUMMARY PANEL */}
        <div className="bg-white border border-emerald-100 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div>
              <h4 className="text-[10px] font-black uppercase text-emerald-950 tracking-wider">
                Sauda Sourcing Statistics
              </h4>
              <p className="text-[8px] text-slate-400 italic">
                Analytical summary of contract registry
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-3">
              <div>
                <span className="text-[7px] font-bold text-emerald-600 uppercase block">
                  Prime Broker
                </span>
                <span className="font-black text-emerald-950 text-[10px] block truncate">
                  {saudaChartData[0]?.name || 'DIRECT'} ({saudaChartData[0]?.weight || 0} MT)
                </span>
              </div>

              <div className="border-t border-emerald-100 pt-2 flex justify-between gap-2">
                <div>
                  <span className="text-[7px] font-bold text-slate-400 uppercase block">
                    Brokers Count
                  </span>
                  <span className="font-black text-slate-800 block">
                    {saudaChartData.length} active
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[7px] font-bold text-slate-400 uppercase block">
                    Total Mass
                  </span>
                  <span className="font-black text-emerald-800 block">
                    {saudaAggregates.totalWeight.toLocaleString()} MT
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[8.5px] text-amber-900 leading-normal">
              💡 <strong>Sourcing Insight:</strong> Sauda contracts are mapped against live buyer commitments. Track weight discrepancies periodically.
            </div>
          </div>

          <button
            id="download-sauda-ins"
            onClick={() => {
              window.print();
            }}
            className="w-full mt-3 bg-emerald-700 hover:bg-emerald-800 text-white py-2 rounded-xl border border-emerald-800 text-[9px] font-black uppercase tracking-wider shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Active Sauda
          </button>
        </div>
      </div>
    </React.Fragment>
  );
};
