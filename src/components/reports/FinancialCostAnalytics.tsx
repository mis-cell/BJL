import React, { useState, useMemo } from 'react';
import { CompiledReportData } from '../../services/reportCalculations';
import { 
  DollarSign, 
  Search, 
  Download, 
  TrendingUp, 
  Receipt, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  ShieldCheck,
  CreditCard,
  Sliders
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { exportToCSV } from '../../utils/exportHelpers';
import { WaterfallChart, WaterfallStep } from './charts/WaterfallChart';
import { StackedHundredBarChart } from './charts/StackedHundredBarChart';

interface FinancialCostAnalyticsProps {
  financialAnalytics: CompiledReportData['financialAnalytics'];
}

export const FinancialCostAnalytics: React.FC<FinancialCostAnalyticsProps> = ({ financialAnalytics }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Gross-to-Net Settlement Waterfall Steps
  const grossAmount = financialAnalytics?.contractValue || 184500000; // ~₹18.45 Cr
  const moistureDeduction = Math.round(grossAmount * 0.022);
  const dustDeduction = Math.round(grossAmount * 0.009);
  const freightDeduction = Math.round(grossAmount * 0.015);
  const qualityPenalty = Math.round(grossAmount * 0.006);
  const tdsTaxes = Math.round(grossAmount * 0.001); // 0.1% TDS
  const netPayable = grossAmount - (moistureDeduction + dustDeduction + freightDeduction + qualityPenalty + tdsTaxes);

  const waterfallSteps: WaterfallStep[] = [
    { name: 'Gross Billed Amount', value: grossAmount },
    { name: 'Moisture Deduction', value: -moistureDeduction },
    { name: 'Dust / Foreign Matter', value: -dustDeduction },
    { name: 'Freight Offset', value: -freightDeduction },
    { name: 'Quality Penalty', value: -qualityPenalty },
    { name: 'TDS (0.1%)', value: -tdsTaxes },
    { name: 'Net Approved Payable', value: netPayable, isTotal: true }
  ];

  // 2. Payment Monthly Trend (Line Chart)
  const paymentMonthlyTrend = [
    { month: 'Apr', billedLacs: 280, approvedLacs: 265, paidLacs: 260 },
    { month: 'May', billedLacs: 340, approvedLacs: 320, paidLacs: 315 },
    { month: 'Jun', billedLacs: 410, approvedLacs: 390, paidLacs: 380 },
    { month: 'Jul', billedLacs: 480, approvedLacs: 450, paidLacs: 440 },
    { month: 'Aug', billedLacs: 420, approvedLacs: 405, paidLacs: 395 },
    { month: 'Sep', billedLacs: 360, approvedLacs: 345, paidLacs: 340 }
  ];

  // 3. Payment Ageing Stacked Horizontal Bar
  const paymentAgeingStackedData = [
    {
      name: 'Supplier Invoices',
      within15DaysPct: 68.5,
      days16To30Pct: 21.0,
      days31To45Pct: 7.5,
      over45DaysPct: 3.0
    },
    {
      name: 'Brokerage Invoices',
      within15DaysPct: 82.0,
      days16To30Pct: 12.5,
      days31To45Pct: 4.0,
      over45DaysPct: 1.5
    },
    {
      name: 'Transporter Freight',
      within15DaysPct: 91.0,
      days16To30Pct: 6.5,
      days31To45Pct: 2.0,
      over45DaysPct: 0.5
    }
  ];

  // Mock bills array for tabular audit view
  const mockBills = [
    { mrNumber: 'MR-2026-881', poNumber: 'PO-1042', supplier: 'Kishan Jute Enterprise', grossBillAmount: 1280000, moistureDeduction: 18500, dustDeduction: 7200, netPayableAmount: 1254300, passingPct: 97.9, status: 'PAID' },
    { mrNumber: 'MR-2026-884', poNumber: 'PO-1051', supplier: 'Forbesganj Fibre Corp', grossBillAmount: 960000, moistureDeduction: 24000, dustDeduction: 8400, netPayableAmount: 927600, passingPct: 96.6, status: 'APPROVED' },
    { mrNumber: 'MR-2026-889', poNumber: 'PO-1060', supplier: 'Murshidabad Agri Trader', grossBillAmount: 1450000, moistureDeduction: 12000, dustDeduction: 6100, netPayableAmount: 1431900, passingPct: 98.7, status: 'PAID' },
    { mrNumber: 'MR-2026-892', poNumber: 'PO-1065', supplier: 'Cooch Behar Sourcing', grossBillAmount: 880000, moistureDeduction: 32000, dustDeduction: 11000, netPayableAmount: 837000, passingPct: 95.1, status: 'PENDING' },
    { mrNumber: 'MR-2026-899', poNumber: 'PO-1071', supplier: 'Bengal Golden Fibre', grossBillAmount: 1620000, moistureDeduction: 21000, dustDeduction: 9500, netPayableAmount: 1589500, passingPct: 98.1, status: 'PAID' }
  ];

  const filteredBills = useMemo(() => {
    return mockBills.filter(b => 
      b.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.mrNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [mockBills, searchTerm]);

  const handleExport = () => {
    exportToCSV(filteredBills, 'financial_cost_deductions_ledger.csv');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-700" />
            Financial Settlement & Gross-to-Net Deduction Analytics
          </h3>
          <p className="text-[11px] text-slate-500">Waterfall gross bill deductions, payment approval %, cash outflow trends, and settlement ageing</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice, supplier..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 w-44 font-bold"
            />
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Primary Financial KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800">Bill Passing Rate %</span>
          <div className="text-2xl font-black font-mono text-emerald-950 mt-0.5">
            97.4%
          </div>
          <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Passed / Submitted Invoices</p>
        </div>

        <div className="bg-white border border-rose-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[9px] font-black uppercase tracking-wider text-rose-800">Deduction %</span>
          <div className="text-2xl font-black font-mono text-rose-950 mt-0.5">
            4.7%
          </div>
          <p className="text-[10px] text-rose-700 font-medium mt-0.5">Moisture, dust & quality cuts</p>
        </div>

        <div className="bg-white border border-purple-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[9px] font-black uppercase tracking-wider text-purple-800">Payment Settlement %</span>
          <div className="text-2xl font-black font-mono text-purple-950 mt-0.5">
            {financialAnalytics?.paymentCompletionPct || 92.8}%
          </div>
          <p className="text-[10px] text-purple-700 font-medium mt-0.5">Paid vs Approved Amount</p>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-800">Unsettled Liability %</span>
          <div className="text-2xl font-black font-mono text-amber-950 mt-0.5">
            {Number((100 - (financialAnalytics?.paymentCompletionPct || 92.8)).toFixed(1))}%
          </div>
          <p className="text-[10px] text-amber-700 font-medium mt-0.5">In-transit & pending validation</p>
        </div>
      </div>

      {/* Financial Waterfall Chart */}
      <WaterfallChart
        title="Gross-to-Net Settlement Deductions Waterfall"
        subtitle="Step-by-step financial audit: Gross Bill Amount → Lab & Freight Deductions → TDS → Net Approved Bank Payable"
        data={waterfallSteps}
        unit="₹"
        height={320}
      />

      {/* Visual Charts Grid: Payment Trend + Payment Ageing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment Trend (Line Chart) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Monthly Billing vs Payout Trend</h4>
              <p className="text-[10px] text-slate-500">Gross Billed, Approved and Bank Disbursed (₹ in Lacs)</p>
            </div>
            <span className="text-[9px] font-mono font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
              Line Trend
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={paymentMonthlyTrend} margin={{ top: 10, right: 15, left: -5, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `₹${v}L`} />
                <Tooltip 
                  formatter={(val: any) => [`₹${val} Lacs`, '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Legend verticalAlign="bottom" height={24} formatter={val => <span className="text-[10px] text-slate-600 font-bold">{val}</span>} />
                <Line type="monotone" dataKey="billedLacs" name="Gross Billed" stroke="#475569" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="approvedLacs" name="Approved" stroke="#0284c7" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="paidLacs" name="Bank Paid" stroke="#059669" strokeWidth={2.5} dot={{ r: 4, fill: '#059669' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Ageing (100% Stacked Bar) */}
        <StackedHundredBarChart
          title="Payment Settlement Ageing Composition (100% Stacked)"
          subtitle="Days elapsed from invoice verification to bank release"
          data={paymentAgeingStackedData}
          series={[
            { key: 'within15DaysPct', name: '< 15 Days (Prompt)', color: '#10b981' },
            { key: 'days16To30Pct', name: '16-30 Days', color: '#38bdf8' },
            { key: 'days31To45Pct', name: '31-45 Days', color: '#f59e0b' },
            { key: 'over45DaysPct', name: '> 45 Days (Overdue)', color: '#ef4444' }
          ]}
          layout="vertical"
          height={256}
        />
      </div>

      {/* Bill Passing Register Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800">
            Invoice Audit & Deduction Clearance Register ({filteredBills.length} Invoices)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Real-time ERP Accounts Payable</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-black text-[10px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-2.5">Invoice / MR No</th>
                <th className="p-2.5">Supplier</th>
                <th className="p-2.5 text-right">Gross Bill (₹)</th>
                <th className="p-2.5 text-right">Moisture Cut (₹)</th>
                <th className="p-2.5 text-right">Dust Cut (₹)</th>
                <th className="p-2.5 text-right">Net Payable (₹)</th>
                <th className="p-2.5 text-center">Passing %</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredBills.slice(0, 15).map((b, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-2.5 font-bold font-mono text-emerald-950">
                    <div>{b.mrNumber}</div>
                    <div className="text-[9.5px] text-slate-500 font-normal">{b.poNumber}</div>
                  </td>
                  <td className="p-2.5 font-bold text-slate-900">{b.supplier}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-slate-900">₹{b.grossBillAmount.toLocaleString()}</td>
                  <td className="p-2.5 text-right font-mono text-rose-700">₹{b.moistureDeduction.toLocaleString()}</td>
                  <td className="p-2.5 text-right font-mono text-amber-700">₹{b.dustDeduction.toLocaleString()}</td>
                  <td className="p-2.5 text-right font-mono font-black text-emerald-800">₹{b.netPayableAmount.toLocaleString()}</td>
                  <td className="p-2.5 text-center font-mono">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-black text-[10px]">
                      {b.passingPct}%
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                      b.status === 'PAID' ? 'bg-emerald-500 text-white' : b.status === 'APPROVED' ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
