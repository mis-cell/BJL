import React from 'react';
import { 
  Wallet, 
  FileText, 
  AlertTriangle, 
  Clock, 
  Save, 
  X 
} from 'lucide-react';
import { cn, formatIndianCurrency, calculate93PctPaidAmount } from '../../lib/utils';
import { 
  PaymentMaster, 
  PaymentDetailColumn 
} from '../../types/payment.types';
import { SearchablePoSelect } from './SearchablePoSelect';
import { SearchableMrSelect } from './SearchableMrSelect';
import { PaymentDetailGrid } from './PaymentDetailGrid';

export interface PaymentEntryFormProps {
  masterData: PaymentMaster;
  setMasterData: React.Dispatch<React.SetStateAction<PaymentMaster>>;
  detailCols: PaymentDetailColumn[];
  setDetailCols: React.Dispatch<React.SetStateAction<PaymentDetailColumn[]>>;
  selectedPoNo: string;
  setSelectedPoNo: (poNo: string) => void;
  selectedMrNo: string;
  setSelectedMrNo: (mrNo: string) => void;
  selectedPoData: any;
  isEdit: boolean;
  eligiblePos: any[];
  availableArrivals: any[];
  verifiedArrivals: any[];
  paymentList: PaymentMaster[];
  purchaseOrders: any[];
  saudaCheckPoints: any[];
  gradeMasterList: any[];
  areaMasterList: any[];
  agencyMasterList: any[];
  isPoEligibleForPayment: (po: any) => boolean;
  handlePoSelection: (poNo: string) => void;
  handleMrSelection: (mrNo: string, overridePo?: any) => void;
  findMatchingPo: (poNo: string, poArray: any[]) => any;
  handleSavePayment: () => void;
  onCancel: () => void;
  loading: boolean;
  errorMessage: string;
  setErrorMessage: (msg: string) => void;
}

export function PaymentEntryForm({
  masterData,
  setMasterData,
  detailCols,
  setDetailCols,
  selectedPoNo,
  setSelectedPoNo,
  selectedMrNo,
  setSelectedMrNo,
  selectedPoData,
  isEdit,
  eligiblePos,
  availableArrivals,
  verifiedArrivals,
  paymentList,
  purchaseOrders,
  saudaCheckPoints,
  gradeMasterList,
  areaMasterList,
  agencyMasterList,
  isPoEligibleForPayment,
  handlePoSelection,
  handleMrSelection,
  findMatchingPo,
  handleSavePayment,
  onCancel,
  loading,
  errorMessage,
  setErrorMessage
}: PaymentEntryFormProps) {
  const handleTenorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tenor = Number(e.target.value);

    if (masterData.payment_settlementdate) {
      const paysettledate = new Date(masterData.payment_settlementdate);
      paysettledate.setDate(paysettledate.getDate() + tenor);

      const year = paysettledate.getFullYear();
      const month = String(paysettledate.getMonth() + 1).padStart(2, "0");
      const day = String(paysettledate.getDate()).padStart(2, "0");
      const repaymentDate = `${year}-${month}-${day}`;

      setMasterData({
        ...masterData,
        tenor: e.target.value,
        repayment_date: repaymentDate
      });
    } else {
      setMasterData({
        ...masterData,
        tenor: e.target.value
      });
    }
  };

  const selectedArrival = verifiedArrivals.find(
    a => (a.mr_no === selectedMrNo || a.final_arrival_no === selectedMrNo)
  );
  const inspectionPoNo = selectedArrival?.po_no || selectedArrival?.mill_po_no || '';
  const matchedFinalPo = inspectionPoNo ? findMatchingPo(inspectionPoNo, purchaseOrders) : null;
  const matchedScpPo = (!matchedFinalPo && inspectionPoNo) ? findMatchingPo(inspectionPoNo, saudaCheckPoints) : null;
  const isPoNotInFinal = Boolean(selectedMrNo && inspectionPoNo && !matchedFinalPo);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-600" />
            {isEdit ? 'Edit Payment Voucher' : 'New Payment Voucher Entry'}
          </h3>
          <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded border border-purple-200">
            Voucher: {masterData.voucher_no}
          </span>
        </div>

        {/* CONTRACT P.O & VERIFIED M.R REFERENCE PANEL */}
        <div className="bg-gradient-to-r from-slate-50 via-purple-50/50 to-indigo-50/50 p-3.5 rounded-xl border border-purple-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-700" />
              <span className="text-xs font-black uppercase text-purple-950 tracking-wide">
                P.O & Linked Verified M.R Reference
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded border border-purple-200">
                {eligiblePos.length} Eligible P.O Records (Pending Payment)
              </span>
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                {availableArrivals.length} Unpaid M.R Records ({verifiedArrivals.length} Total Verified)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* P.O Selector */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-black uppercase text-purple-900">
                <label className="flex items-center gap-1.5">
                  <span>P.O</span>
                  {selectedPoNo && <span className="text-purple-700 font-mono font-bold">({selectedPoNo})</span>}
                </label>
                <span className="text-[10px] font-semibold text-purple-700">
                  {eligiblePos.length} Pending Payment
                </span>
              </div>
              <SearchablePoSelect
                selectedPoNo={selectedPoNo}
                onSelectPo={handlePoSelection}
                displayPos={eligiblePos}
                matchedFinalPo={matchedFinalPo}
                isPoEligibleForPayment={isPoEligibleForPayment}
                verifiedArrivals={verifiedArrivals}
                paymentList={paymentList}
                currentVoucherNo={isEdit ? masterData.voucher_no : undefined}
              />
            </div>

            {/* Verified M.R & Inspection Selector */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase text-emerald-900 flex items-center justify-between">
                <span>Inspection</span>
                {selectedMrNo && <span className="text-emerald-700 font-mono font-bold">M.R: {selectedMrNo}</span>}
              </label>
              <SearchableMrSelect
                selectedMrNo={selectedMrNo}
                onSelectMr={handleMrSelection}
                verifiedArrivals={availableArrivals}
                allArrivals={verifiedArrivals}
                selectedPoNo={selectedPoNo}
              />
            </div>
          </div>

          {/* Notice if Inspection P.O is in Check Point and not in P.O list */}
          {isPoNotInFinal && (
            <div className="p-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-2 shadow-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-bold flex items-center gap-2">
                  <span>Inspection P.O ({inspectionPoNo}) is NOT in P.O list yet</span>
                  <span className="bg-amber-200 text-amber-900 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                    Status: In Sauda Check Point
                  </span>
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  {matchedScpPo ? (
                    <span>
                      This P.O is currently located in <strong>Sauda Check Point / Temporary P.O</strong> (Sauda: {matchedScpPo.sauda_no || matchedScpPo.po_no}). Once mismatches are cleared and approved in Sauda Check Point, click <strong>"Pass ✓"</strong> to promote it to P.O.
                    </span>
                  ) : (
                    <span>
                      This P.O has not yet been passed/promoted to <strong>P.O</strong> (purchase_master). You can still proceed with Inspection details, or select an existing P.O using "Show All".
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Active PO / MR Summary Linkage Banner */}
          {(selectedPoData || selectedMrNo || masterData.po_no || masterData.mr_no) ? (
            <div className="bg-white/90 p-2.5 rounded-lg border border-purple-200 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-700 shadow-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-slate-900 text-[11px]">Contract Active Linkage:</span>
                {masterData.po_no && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-900 font-mono font-bold rounded border border-purple-300 text-[10px]">
                    P.O: {masterData.po_no}
                  </span>
                )}
                {masterData.mr_no && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-mono font-bold rounded border border-emerald-300 text-[10px]">
                    M.R: {masterData.mr_no}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px] flex-wrap">
                <div><span className="text-slate-400">Supplier:</span> <strong className="text-slate-900">{masterData.supplier || masterData.party_name || '-'}</strong></div>
                <div><span className="text-slate-400">Broker:</span> <strong className="text-slate-900">{masterData.broker || '-'}</strong></div>
                <div><span className="text-slate-400">Lorry / Vehicle:</span> <strong className="text-slate-900">{masterData.lorry_number || '-'}</strong></div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50/90 p-2 rounded-lg border border-amber-200 text-xs flex items-center gap-2 text-amber-800 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Please select a <strong>P.O</strong> or <strong>Inspection</strong> record. At least one selection is required to save a payment record.</span>
            </div>
          )}
        </div>

        {/* Header Form Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label htmlFor="voucher_no_entry" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Voucher No *</label>
            <input
              id="voucher_no_entry"
              name="voucher_no_entry"
              aria-label="Voucher No *"
              type="text"
              value={masterData.voucher_no}
              onChange={e => setMasterData({ ...masterData, voucher_no: e.target.value })}
              className="w-full p-2 font-mono font-bold border border-slate-300 rounded bg-slate-50 focus:bg-white"
            />
          </div>

          <div>
            <label htmlFor="payment_date_entry" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Payment Date *</label>
            <input
              id="payment_date_entry"
              name="payment_date_entry"
              aria-label="Payment Date *"
              type="date"
              value={masterData.payment_date}
              onChange={e => setMasterData({ ...masterData, payment_date: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label htmlFor="selected_mr_no_entry" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Selected M.R No</label>
            <input
              id="selected_mr_no_entry"
              name="selected_mr_no_entry"
              aria-label="Selected M.R No"
              type="text"
              value={masterData.mr_no || selectedMrNo}
              onChange={e => {
                setMasterData({ ...masterData, mr_no: e.target.value });
                setSelectedMrNo(e.target.value);
              }}
              placeholder="M.R / Arrival No"
              className="w-full p-2 border border-slate-300 rounded bg-emerald-50/40 font-mono font-bold text-slate-800"
            />
          </div>

          <div>
            <label htmlFor="selected_po_no_entry" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Selected P.O No</label>
            <input
              id="selected_po_no_entry"
              name="selected_po_no_entry"
              aria-label="Selected P.O No"
              type="text"
              value={masterData.po_no || selectedPoNo}
              onChange={e => {
                setMasterData({ ...masterData, po_no: e.target.value });
                setSelectedPoNo(e.target.value);
              }}
              placeholder="Purchase Order No"
              className="w-full p-2 border border-slate-300 rounded bg-purple-50/40 font-mono font-bold text-slate-800"
            />
          </div>

          <div>
            <label htmlFor="party_name_entry" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Party / Supplier Name *</label>
            <input
              id="party_name_entry"
              name="party_name_entry"
              aria-label="Party / Supplier Name *"
              type="text"
              value={masterData.party_name || masterData.supplier}
              onChange={e => setMasterData({ ...masterData, party_name: e.target.value, supplier: e.target.value })}
              placeholder="Supplier / Party Name"
              className="w-full p-2 border border-slate-300 rounded font-semibold"
            />
          </div>

          <div>
            <label htmlFor="broker_name_entry" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Broker Name</label>
            <input
              id="broker_name_entry"
              name="broker_name_entry"
              aria-label="Broker Name"
              type="text"
              value={masterData.broker}
              onChange={e => setMasterData({ ...masterData, broker: e.target.value })}
              placeholder="Broker Name"
              className="w-full p-2 border border-slate-300 rounded"
            />
          </div>

          <div>
            <label htmlFor="payment_mode_entry" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Payment Mode</label>
            <select
              id="payment_mode_entry"
              name="payment_mode_entry"
              aria-label="Payment Mode"
              value={masterData.payment_mode}
              onChange={e => setMasterData({ ...masterData, payment_mode: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded"
            >
              <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
              <option value="Cheque">Cheque</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Demand Draft">Demand Draft</option>
            </select>
          </div>

          <div>
            <label htmlFor="ref_no_entry" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Ref / UTR / Cheque No</label>
            <input
              id="ref_no_entry"
              name="ref_no_entry"
              aria-label="Ref / UTR / Cheque No"
              type="text"
              value={masterData.reference_no}
              onChange={e => setMasterData({ ...masterData, reference_no: e.target.value })}
              placeholder="Transaction Reference No"
              className="w-full p-2 border border-slate-300 rounded font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-purple-900 mb-1 flex items-center justify-between">
              <span>Advance Payment Done? *</span>
              <span className={cn(
                "text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase",
                (masterData.advance_payment_done || 'No') === 'Yes'
                  ? "bg-green-100 text-green-800"
                  : "bg-slate-200 text-slate-700"
              )}>
                {(masterData.advance_payment_done || 'No') === 'Yes' ? 'ADVANCE DONE' : 'NO ADVANCE'}
              </span>
            </label>
            <select 
              id="advance_payment_done_entry" 
              name="advance_payment_done_entry" 
              aria-label="Advance Payment Done"
              value={masterData.advance_payment_done || 'No'}
              onChange={e => setMasterData({ ...masterData, advance_payment_done: e.target.value })}
              className={cn(
                "w-full p-2 border rounded font-black text-xs transition-colors",
                (masterData.advance_payment_done || 'No') === 'Yes'
                  ? "bg-green-50 text-green-950 border-green-400 focus:ring-2 focus:ring-green-500"
                  : "bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-purple-500"
              )}
            >
              <option value="No">No </option>
              <option value="Yes">Yes </option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-purple-900 mb-1 flex items-center justify-between">
              <span>Payment from</span>
            </label>
            <select 
              id="advance_payment_from_entry" 
              name="advance_payment_from_entry" 
              aria-label="Payment from"
              value={masterData.advance_payment_from || '1'}
              onChange={e => setMasterData({ ...masterData, advance_payment_from: e.target.value })}
              className="w-full p-2 border rounded font-black text-xs transition-colors"
            >
              <option value="1">From Bank </option>
              <option value="2">RXIL </option>
              <option value="3">TReDS </option>
              <option value="4">Invoice Mart </option>
            </select>
          </div>

          {masterData.advance_payment_from !== '1' && (
            <>
              <div>
                <label htmlFor="payment_settlementdate_entry" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Payment Settlement Date *</label>
                <input 
                  id="payment_settlementdate_entry" 
                  name="payment_settlementdate_entry" 
                  aria-label="Payment Settlement Date *"
                  type="date"
                  value={masterData.payment_settlementdate}
                  onChange={e => setMasterData({ ...masterData, payment_settlementdate: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div>
                <label htmlFor="tenor_entry" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Tenor</label>
                <input 
                  id="tenor_entry" 
                  name="tenor_entry" 
                  aria-label="Tenor" 
                  type="text"
                  value={masterData.tenor}
                  onChange={handleTenorChange}
                  placeholder="Tenor Days"
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="repayment_date_entry" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Repayment Date </label>
                <input
                  id="repayment_date_entry"
                  name="repayment_date_entry"
                  aria-label="Repayment Date"
                  type="date"
                  value={masterData.repayment_date || ""}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500"
                  readOnly={true}
                />
              </div>
            </>
          )}
        </div>

        {/* Financial Amounts & Settlement Panel */}
        <div className="p-3 bg-gradient-to-r from-slate-50 via-purple-50/20 to-amber-50/20 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Payable Net Amount */}
          <div>
            <label htmlFor="payable_net_amount_input" className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
              Payable Net Amount (₹)
            </label>
            <input 
              id="payable_net_amount_input" 
              name="payable_net_amount_input" 
              aria-label="Payable Net Amount (₹)"
              type="number"
              step="0.01"
              value={masterData.payable_amt.toFixed(2)}
              onChange={e => {
                const val = parseFloat(e.target.value) || 0;
                const defaultPaid = calculate93PctPaidAmount(val);
                setMasterData({
                  ...masterData,
                  payable_amt: val,
                  total_amount: val,
                  paid_amount: defaultPaid
                });
              }}
              className="w-full p-2 font-black text-sm border border-slate-300 rounded bg-white text-slate-900 shadow-xs focus:ring-2 focus:ring-purple-500"
            />
            <span className="text-[10px] text-slate-500 font-medium">
              Full Invoice Value: {formatIndianCurrency(masterData.payable_amt)}
            </span>
          </div>

          {/* Paid Amount (93% Default / Custom / 0) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold uppercase text-emerald-900">
                Paid Amount (₹)
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setMasterData({ ...masterData, paid_amount: 0 });
                  }}
                  className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300 transition-colors cursor-pointer"
                  title="Set Paid Amount to ₹0 (Full Pending)"
                >
                  ₹0 (Pending)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = calculate93PctPaidAmount(masterData.payable_amt || 0);
                    setMasterData({ ...masterData, paid_amount: p });
                  }}
                  className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 transition-colors cursor-pointer"
                  title="Apply 93% standard payment (floor rounded to nearest ₹1,000)"
                >
                  93% (Floor ₹1K)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMasterData({ ...masterData, paid_amount: masterData.payable_amt || 0 });
                  }}
                  className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-300 transition-colors cursor-pointer"
                  title="Set 100% Full Payment"
                >
                  100% Full
                </button>
              </div>
            </div>
            <input
              id="paid_amount_input"
              name="paid_amount_input"
              aria-label="Paid Amount"
              type="number"
              step="0.01"
              value={masterData.paid_amount ?? 0}
              onChange={e => {
                const rawVal = e.target.value;
                const parsed = parseFloat(rawVal);
                setMasterData({ ...masterData, paid_amount: isNaN(parsed) ? 0 : parsed });
              }}
              className="w-full p-2 font-black text-sm border border-emerald-400 rounded bg-emerald-50/70 text-emerald-950 focus:ring-2 focus:ring-emerald-500 shadow-xs"
            />
            <span className="text-[10px] text-emerald-700 font-bold">
              {masterData.payable_amt > 0
                ? `${formatIndianCurrency(masterData.paid_amount || 0)} (${masterData.payable_amt > 0 ? (((masterData.paid_amount || 0) / masterData.payable_amt) * 100).toFixed(1) : '0.0'}% of bill)`
                : 'Enter Paid Advance Amount'}
            </span>
          </div>

          {/* Pending Balance for Final Settlement (7% Retention) */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/80 p-2.5 rounded-lg border border-amber-300 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                Pending Amount
              </span>
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 border border-amber-300">
                {masterData.payable_amt > 0
                  ? `${(((masterData.payable_amt - masterData.paid_amount) / masterData.payable_amt) * 100).toFixed(1)}%`
                  : '7.0%'}
              </span>
            </div>
            <div className="text-base font-black text-amber-950 font-mono my-0.5">
              {formatIndianCurrency(Math.max(0, masterData.payable_amt - masterData.paid_amount))}
            </div>
            <span className="text-[9.5px] text-amber-800 font-semibold leading-tight">
              Retention for Final Settlement
            </span>
          </div>

          {/* Bill / Invoice No */}
          <div>
            <label htmlFor="payable_bill_no_input" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Bill / Invoice No</label>
            <input
              id="payable_bill_no_input"
              name="payable_bill_no_input"
              aria-label="Bill / Invoice No"
              type="text"
              value={masterData.payable_bill_no}
              onChange={e => setMasterData({ ...masterData, payable_bill_no: e.target.value })}
              placeholder="Supplier Bill No"
              className="w-full p-2 border border-slate-300 rounded font-semibold focus:ring-1 focus:ring-purple-500"
            />
            <span className="text-[10px] text-slate-400 font-medium">Invoice Reference</span>
          </div>

          {/* Remarks */}
          <div>
            <label htmlFor="remarks_input" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Remarks</label>
            <input
              id="remarks_input"
              name="remarks_input"
              aria-label="Remarks"
              type="text"
              value={masterData.remarks}
              onChange={e => setMasterData({ ...masterData, remarks: e.target.value })}
              placeholder="Payment Remarks"
              className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500"
            />
            <span className="text-[10px] text-slate-400 font-medium">Optional Payment Notes</span>
          </div>
        </div>

        {/* 4-Column Specification Grid */}
        <PaymentDetailGrid
          detailCols={detailCols}
          setDetailCols={setDetailCols}
          setMasterData={setMasterData}
          gradeMasterList={gradeMasterList}
          areaMasterList={areaMasterList}
          agencyMasterList={agencyMasterList}
        />

        {/* Inline Error Message */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-red-800 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="p-1 hover:bg-red-100 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSavePayment}
            disabled={loading}
            className="px-5 py-2 text-xs font-black text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Payment Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
