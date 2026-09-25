import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  Scale,
  Layers,
  TrendingUp,
  Download,
  Printer,
  FileSpreadsheet
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

interface SaudaDashboardViewProps {
  saudaData: any[];
}

export const SaudaDashboardView: React.FC<SaudaDashboardViewProps> = ({ saudaData }) => {
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());

  const saudaAggregates = useMemo(() => {
    let count = saudaData.length;
    let totalWeight = 0;
    let totalUnits = 0;
    let sumRate = 0;
    let rateCount = 0;

    saudaData.forEach(s => {
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
  }, [saudaData]);

  const saudaChartData = useMemo(() => {
    const brokerMap: Record<string, number> = {};
    saudaData.forEach(s => {
      const bName = s.broker || 'DIRECT';
      const wt = Number(s.total_wt_in_ton) || 0;
      brokerMap[bName] = (brokerMap[bName] || 0) + wt;
    });
    return Object.entries(brokerMap).map(([name, weight]) => ({
      name,
      weight: parseFloat(weight.toFixed(3))
    })).sort((a, b) => b.weight - a.weight).slice(0, 8);
  }, [saudaData]);

  const monthlySaudaList = useMemo(() => {
    return saudaData.filter(item => {
      if (!item.date) return false;
      const d = new Date(item.date);
      return (d.getMonth() + 1) === reportMonth && d.getFullYear() === reportYear;
    });
  }, [saudaData, reportMonth, reportYear]);

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
