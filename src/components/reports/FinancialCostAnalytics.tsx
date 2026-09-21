import React from 'react';
import { CompiledReportData } from '../../services/reportCalculations';
import { 
  DollarSign, 
  Download, 
  TrendingUp, 
  Percent, 
  ShieldCheck, 
  Layers, 
  ArrowUpRight, 
  CreditCard 
} from 'lucide-react';
import { exportToCSV } from '../../utils/exportHelpers';

interface FinancialCostAnalyticsProps {
  financialAnalytics: CompiledReportData['financialAnalytics'];
}

export const FinancialCostAnalytics: React.FC<FinancialCostAnalyticsProps> = ({ financialAnalytics }) => {
  const handleExport = () => {
    const headers = ['Financial Metric', 'Amount (INR)', 'Percentage (%) / Unit'];
    const rows = [
      ['Total Contract Value', financialAnalytics.contractValue, 'Base Contract'],
      ['Received Material Value', financialAnalytics.receivedMaterialValue, 'Fulfilled Value'],
      ['Pending Procurement Value', financialAnalytics.pendingProcurementValue, 'Pipeline Value'],
      ['Total Brokerage Payable', financialAnalytics.brokeragePayable, '₹25 / MT Standard'],
      ['Settlement Amount (Net of Deductions)', financialAnalytics.settlementAmount, 'Bill Passing'],
      ['Deduction / Penalty Amount', financialAnalytics.deductionAmount, 'Quality / Delay'],
      ['Excess / Short Adjustment', financialAnalytics.excessShortAdjustment, 'Weight Variance'],
      ['Advance Payments Disbursed', financialAnalytics.advancePayment, '20% Advance'],
      ['Final Payments Settled', financialAnalytics.finalPayment, 'Account Cleared'],
      ['Outstanding Payable Balance', financialAnalytics.outstandingAmount, 'Pending Liquidation'],
      ['Payment Completion Percentage', `${financialAnalytics.paymentCompletionPct}%`, 'Overall Payment %']
    ];

    exportToCSV(`Financial_Cost_Analytics_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-md">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
              Financial, Cost & Settlement Completion Analytics
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Reconciliation of contracted values, bill passing amounts, brokerage liability, and outstanding disbursement ledgers
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

      {/* Financial KPI Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Total Contracted Procurement Value */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Contract Value</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{(financialAnalytics.contractValue / 100000).toFixed(2)} <span className="text-xs font-sans text-slate-500">Lakhs</span>
          </div>
          <div className="text-xs text-slate-500 font-medium pt-1 border-t border-slate-100 flex justify-between font-mono">
            <span>Raw Value:</span>
            <span>₹{financialAnalytics.contractValue.toLocaleString()}</span>
          </div>
        </div>

        {/* Received Material Value */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800">Received Value</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950 font-mono">
            ₹{(financialAnalytics.receivedMaterialValue / 100000).toFixed(2)} <span className="text-xs font-sans text-emerald-700">Lakhs</span>
          </div>
          <div className="text-xs text-slate-500 font-medium pt-1 border-t border-slate-100 flex justify-between font-mono">
            <span>Pending Value:</span>
            <span className="text-amber-800 font-bold">₹{(financialAnalytics.pendingProcurementValue / 100000).toFixed(2)} L</span>
          </div>
        </div>

        {/* Payment Completion % */}
        <div className="bg-emerald-900 text-white border border-emerald-950 rounded-lg p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-emerald-300">
            <span className="text-[9px] font-black uppercase tracking-wider">Payment Completion</span>
            <Percent className="w-4 h-4 text-emerald-300" />
          </div>
          <div className="text-2xl font-black font-mono">
            {financialAnalytics.paymentCompletionPct}%
          </div>
          <div className="text-xs text-emerald-200 font-medium pt-1 border-t border-emerald-800 flex justify-between font-mono">
            <span>Paid vs Settlement:</span>
            <span>Cleared OK</span>
          </div>
        </div>
      </div>

      {/* Cost & Settlement Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
        <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
          Financial Liquidation Ledger
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="space-y-2">
            <div className="flex justify-between p-2.5 bg-slate-50 border border-slate-200 rounded">
              <span className="text-slate-600 font-sans font-bold">Brokerage Liability (Total Payable):</span>
              <span className="font-black text-slate-900">₹{financialAnalytics.brokeragePayable.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-50 border border-slate-200 rounded">
              <span className="text-slate-600 font-sans font-bold">Bill Passed / Eligible Settlement:</span>
              <span className="font-black text-slate-900">₹{financialAnalytics.settlementAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-50 border border-slate-200 rounded">
              <span className="text-slate-600 font-sans font-bold">Deductions & Weight Shortage:</span>
              <span className="font-black text-rose-700">- ₹{financialAnalytics.deductionAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between p-2.5 bg-slate-50 border border-slate-200 rounded">
              <span className="text-slate-600 font-sans font-bold">Advance Payments Disbursed:</span>
              <span className="font-black text-emerald-800">₹{financialAnalytics.advancePayment.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-50 border border-slate-200 rounded">
              <span className="text-slate-600 font-sans font-bold">Final Payments Released:</span>
              <span className="font-black text-emerald-800">₹{financialAnalytics.finalPayment.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-amber-50 border border-amber-200 rounded">
              <span className="text-amber-900 font-sans font-bold">Outstanding Payable Balance:</span>
              <span className="font-black text-amber-950">₹{financialAnalytics.outstandingAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
