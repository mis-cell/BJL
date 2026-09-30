import React from 'react';
import { X, Printer, CheckCircle2, Clock, AlertTriangle, Building2, User, MapPin, Scale, DollarSign, Calendar } from 'lucide-react';
import { ReportTransactionLine } from '../../services/systemReportEngine';

interface SimpleDealSlipModalProps {
  transaction: ReportTransactionLine | null;
  onClose: () => void;
}

export const SimpleDealSlipModal: React.FC<SimpleDealSlipModalProps> = ({
  transaction,
  onClose
}) => {
  if (!transaction) return null;

  const t = transaction;
  const isAllArrived = t.pendingWeightMT <= 0.01;
  const isPaid = t.paymentStatus === 'PAID';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden font-sans print:shadow-none print:border-none print:max-w-none">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-green-900 text-white p-5 flex items-center justify-between print:bg-emerald-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📄</span>
              <h2 className="text-lg font-black tracking-wide uppercase">
                सौदा विवरण पर्ची (Sauda Deal Slip)
              </h2>
            </div>
            <p className="text-xs text-emerald-100 mt-0.5">
              सौदे की पूरी जानकारी एवं हिसाब-किताब
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>प्रिंट पर्ची (Print)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slip Body */}
        <div className="p-6 space-y-5 text-slate-800">
          
          {/* Sauda / PO Identification Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">सौदा नं. (Sauda No)</span>
              <strong className="text-sm font-black text-emerald-950 font-mono block mt-0.5">
                {t.saudaNo || 'N/A'}
              </strong>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">PO नं. (PO Number)</span>
              <strong className="text-sm font-black text-slate-900 font-mono block mt-0.5">
                {t.poNo || 'Pending'}
              </strong>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">तारीख (Date)</span>
              <strong className="text-sm font-bold text-slate-900 block mt-0.5">
                {t.date || '-'}
              </strong>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">वित्तीय वर्ष (FY)</span>
              <strong className="text-sm font-bold text-slate-900 font-mono block mt-0.5">
                {t.financialYear || '-'}
              </strong>
            </div>
          </div>

          {/* Parties & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
              <span className="text-[11px] font-black uppercase text-slate-400 block tracking-wider">
                पार्टी व दलाल (Party & Broker)
              </span>
              <div className="flex items-start gap-2.5">
                <Building2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500 font-medium">सप्लायर / पार्टी (Supplier):</div>
                  <div className="text-sm font-black text-slate-900">{t.supplier || 'Unassigned'}</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 pt-1 border-t border-slate-100">
                <User className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500 font-medium">दलाल (Broker):</div>
                  <div className="text-sm font-bold text-slate-900">{t.broker || 'Direct'}</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
              <span className="text-[11px] font-black uppercase text-slate-400 block tracking-wider">
                मंडी व माल विवरण (Location & Grade)
              </span>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500 font-medium">एरिया व एजेंसी (Area & Agency):</div>
                  <div className="text-sm font-bold text-slate-900">
                    {t.area || '-'} {t.agency && t.agency !== '-' ? `(${t.agency})` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 pt-1 border-t border-slate-100">
                <Scale className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500 font-medium">ग्रेड (Grade / Quality):</div>
                  <div className="text-sm font-black text-slate-900">{t.grade || '-'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quantity, Rate & Calculations */}
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3">
            <span className="text-[11px] font-black uppercase text-emerald-900 block tracking-wider">
              वजन और भाव (Weight & Pricing)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">कुल वजन (Contract MT)</span>
                <strong className="text-base font-black text-emerald-950 font-mono">
                  {t.quantityMT.toFixed(2)} MT
                </strong>
                <span className="text-[10px] text-slate-500 block">{(t.quantityMT * 10).toFixed(0)} क्विंटल (Qtl)</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">खरीद भाव (Rate)</span>
                <strong className="text-base font-black text-slate-900 font-mono">
                  ₹{t.purchaseRate.toLocaleString()}
                </strong>
                <span className="text-[10px] text-slate-500 block">प्रति क्विंटल (/Qtl)</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">सट्टा बेस रेट (Base Rate)</span>
                <strong className="text-base font-black text-slate-700 font-mono">
                  {t.baseRate > 0 ? `₹${t.baseRate.toLocaleString()}` : '-'}
                </strong>
                <span className="text-[10px] text-slate-500 block">
                  {t.rateVariance !== 0 ? `${t.rateVariance > 0 ? '+' : ''}₹${t.rateVariance.toFixed(0)} अंतर` : 'बराबर'}
                </span>
              </div>

              <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-xs">
                <span className="text-[10px] font-bold text-emerald-100 uppercase block">कुल खरीद रकम (Gross ₹)</span>
                <strong className="text-base font-black font-mono">
                  ₹{Math.round(t.grossPurchaseValue).toLocaleString()}
                </strong>
                <span className="text-[10px] text-emerald-200 block">सौदा मूल्य</span>
              </div>
            </div>
          </div>

          {/* Operational Progress: Arrival & Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Arrival Progress */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-slate-500">
                  माल की आमद (Arrival Status)
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  isAllArrived ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isAllArrived ? '🟢 पूरा आ गया (Arrived)' : '🟡 माल आना बाकी (Pending)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">आया हुआ माल</span>
                  <strong className="text-sm font-black text-emerald-700 font-mono">
                    {t.arrivedWeightMT.toFixed(2)} MT
                  </strong>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">बाकी माल</span>
                  <strong className={`text-sm font-black font-mono ${t.pendingWeightMT > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {t.pendingWeightMT.toFixed(2)} MT
                  </strong>
                </div>
              </div>
              {t.moisturePct > 0 && (
                <div className="text-xs text-slate-600 pt-1 flex items-center justify-between">
                  <span>जांच में नमी (Moisture):</span>
                  <strong className="font-mono text-slate-900">{t.moisturePct.toFixed(1)}%</strong>
                </div>
              )}
            </div>

            {/* Payment Progress */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-slate-500">
                  भुगतान स्थिति (Payment Status)
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {isPaid ? '🟢 पूरा चुकता (Paid)' : (t.paidAmount > 0 ? '🟡 कुछ दिया, बाकी है' : '🔴 भुगतान बाकी (Unpaid)')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">दिया गया भुगतान</span>
                  <strong className="text-sm font-black text-emerald-700 font-mono">
                    ₹{Math.round(t.paidAmount).toLocaleString()}
                  </strong>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">बाकी रकम (Due)</span>
                  <strong className={`text-sm font-black font-mono ${t.pendingPayable > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    ₹{Math.round(t.pendingPayable).toLocaleString()}
                  </strong>
                </div>
              </div>
              {t.deductionAmount > 0 && (
                <div className="text-xs text-rose-600 pt-1 flex items-center justify-between font-bold">
                  <span>कटौती (Deduction):</span>
                  <span className="font-mono">-₹{Math.round(t.deductionAmount).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Alerts / Notes if any */}
          {t.abnormalReasons && t.abnormalReasons.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800">
                <strong className="block font-bold">ध्यान देने योग्य बातें (Alerts):</strong>
                <span>{t.abnormalReasons.join(' • ')}</span>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <span>सिस्टम सौदा आईडी: <strong className="font-mono text-slate-700">{t.txnId}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
          >
            बंद करें (Close)
          </button>
        </div>

      </div>
    </div>
  );
};
