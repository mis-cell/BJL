import React from "react";
import PrintModal from "../PrintModal";
import {
  SettlementMaster,
  SettlementDetailColumn,
  getColWtMt,
  getColAmount,
  getEffectiveColSettRate,
} from "../../types/settlement.types";

export interface SettlementPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewModalData: {
    master: SettlementMaster;
    details: SettlementDetailColumn[];
  } | null;
  resolveGradeName?: (grade: string) => string;
}

function formatDateDdMmYyyyHyphen(dateStr?: string): string {
  if (!dateStr) return "";
  const trimmed = String(dateStr).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.split("T")[0].split("-");
    return `${d}-${m}-${y}`;
  }
  const dt = new Date(trimmed);
  if (!isNaN(dt.getTime())) {
    const d = String(dt.getDate()).padStart(2, "0");
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const y = dt.getFullYear();
    return `${d}-${m}-${y}`;
  }
  return trimmed;
}

function formatDateDdMmYySlash(dateStr?: string): string {
  if (!dateStr) return "";
  const trimmed = String(dateStr).trim();
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.split("T")[0].split("-");
    return `${d}/${m}/${y.slice(-2)}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split("-");
    return `${d}/${m}/${y.slice(-2)}`;
  }
  const dt = new Date(trimmed);
  if (!isNaN(dt.getTime())) {
    const d = String(dt.getDate()).padStart(2, "0");
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const y = String(dt.getFullYear()).slice(-2);
    return `${d}/${m}/${y}`;
  }
  return trimmed;
}

function formatDateDdMmmYy(dateStr?: string): string {
  if (!dateStr) return "";
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const trimmed = String(dateStr).trim();
  let dt: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.split("T")[0].split("-").map(Number);
    dt = new Date(y, m - 1, d);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split("-").map(Number);
    dt = new Date(y, m - 1, d);
  } else {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) dt = parsed;
  }
  if (dt && !isNaN(dt.getTime())) {
    const d = String(dt.getDate()).padStart(2, "0");
    const m = months[dt.getMonth()];
    const y = String(dt.getFullYear()).slice(-2);
    return `${d}-${m}-${y}`;
  }
  return trimmed.toUpperCase();
}

function formatIndAmount(val: number): string {
  const num = Number(val) || 0;
  if (Math.abs(num) < 0.005) return ".00";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function numberToIndianWords(num: number): string {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return "ZERO";

  const ones = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];
  const tens = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
  ];

  const convertBelowThousand = (val: number): string => {
    let str = "";
    if (val >= 100) {
      str += ones[Math.floor(val / 100)] + " HUNDRED ";
      val %= 100;
    }
    if (val >= 20) {
      str += tens[Math.floor(val / 10)] + " ";
      val %= 10;
    }
    if (val > 0) {
      str += ones[val] + " ";
    }
    return str.trim();
  };

  let words = "";
  let rem = n;

  const crore = Math.floor(rem / 10000000);
  rem %= 10000000;
  if (crore > 0) {
    words += convertBelowThousand(crore) + " CRORE ";
  }

  const lakh = Math.floor(rem / 100000);
  rem %= 100000;
  if (lakh > 0) {
    words += convertBelowThousand(lakh) + " LAKH ";
  }

  const thousand = Math.floor(rem / 1000);
  rem %= 1000;
  if (thousand > 0) {
    words += convertBelowThousand(thousand) + " THOUSAND ";
  }

  if (rem > 0) {
    words += convertBelowThousand(rem);
  }

  return words.trim().replace(/\s+/g, " ");
}

export const SettlementPrintModal: React.FC<SettlementPrintModalProps> = ({
  isOpen,
  onClose,
  viewModalData,
  resolveGradeName = (g: string) => g,
}) => {
  if (!isOpen || !viewModalData) return null;

  const { master, details } = viewModalData;

  const activeDetails = details.filter(
    (c) =>
      (Number(c.quantity) > 0 || Number(c.arr_qty_wt) > 0 || Number(c.rate_value) > 0) &&
      getColWtMt(c) > 0
  );

  // Printed On Date & User
  const todaySlash = formatDateDdMmYySlash(new Date().toISOString());
  let currentUserName = master.printed_by || "";
  if (!currentUserName) {
    try {
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        currentUserName = parsed?.username || parsed?.name || parsed?.user_id || "";
      }
    } catch {
      // ignore
    }
  }
  const printedByDisplay = (currentUserName || "KESHAV").toUpperCase();

  // Header fields
  const mrDateDisplay = formatDateDdMmYyyyHyphen(master.mr_date || master.sett_date);
  const poDateDisplay = formatDateDdMmYyyyHyphen(master.po_date || master.mr_date);
  const partyBillDateDisplay = formatDateDdMmYySlash(
    master.payable_bill_date || master.mr_date || master.sett_date
  );

  const firstActiveCol = activeDetails[0] || details[0];
  const areaPart = (firstActiveCol?.area || "").trim();
  const agencyPart = (firstActiveCol?.agency || "").trim();
  const areaAgencyDisplay =
    areaPart && agencyPart
      ? `${areaPart} / ${agencyPart}`
      : areaPart || agencyPart || "-";

  const consignNoDisplay = master.consign_no || master.challan_no || "";
  const consignDateDisplay = formatDateDdMmmYy(
    master.consign_date || master.po_date || master.mr_date
  );

  // Deductions & Miscellaneous Charges calculation
  const validInspectionDeductions = Array.isArray(master.deductions)
    ? master.deductions.filter(
        (d: any) =>
          d &&
          ((d.deduction_type && !String(d.deduction_type).includes("-- SELECT")) ||
            Number(d.deduction_rate) > 0 ||
            Number(d.deduction_amount) > 0)
      )
    : [];

  const inspectionDedItems = validInspectionDeductions.map((dItem: any) => {
    const rate = Number(dItem.deduction_rate) || 0;
    const qtyKgs = Number(dItem.deduction_qty) || (rate > 0 ? 1 : 0);
    // In jute mill accounting, when rate is "Less per Quintal" and qty is in Kgs: amount = (qtyKgs * rate) / 100
    let amount = Number(dItem.deduction_amount) || 0;
    if (amount <= 0 && qtyKgs > 0 && rate > 0) {
      amount = (qtyKgs * rate) / 100;
    } else if (amount === rate && qtyKgs > 1 && rate > 0) {
      // If deduction_amount was stored as 1*rate or qty*rate without /100 check
      amount = (qtyKgs * rate) / 100;
    }
    return {
      type: String(dItem.deduction_type || "").toUpperCase(),
      qtyKgs,
      rate,
      amount,
    };
  });

  const inspectionDedSum = inspectionDedItems.reduce((acc, item) => acc + item.amount, 0);

  // Material Value from active columns
  const computedMaterialValue = activeDetails.reduce((acc, col) => acc + getColAmount(col), 0);
  const materialValue =
    computedMaterialValue > 0
      ? computedMaterialValue
      : Number(master.val_material_value || master.summary_material_value || 0);

  // APMC / M.R. value deduction
  const actualApmc = Math.round(
    Number(master.actual_apmc_fees) > 0
      ? Number(master.actual_apmc_fees)
      : (materialValue - inspectionDedSum) * 0.01
  );
  const challanApmc = Math.round(Number(master.arival_apmc_fees) || 0);
  const settlementApmcDiff =
    Number(master.final_apmc_fees) > 0
      ? Math.round(Number(master.final_apmc_fees))
      : challanApmc > 0 && actualApmc > challanApmc
      ? actualApmc - challanApmc
      : 0;

  const miscAdd = Number(master.val_add_amt || master.summary_misc_add || 0);
  const miscLessTotal = inspectionDedSum + settlementApmcDiff;

  const totalMrAmount = materialValue + miscAdd - miscLessTotal;
  const mrAdvanceAmount = Number(master.final_on_ac_adv || master.less_advance_amount || 0);
  const balanceDueRounded = Math.round(totalMrAmount - mrAdvanceAmount);
  const onAcAdvAdjusted = Number(master.final_less_adv || master.on_account_Effect || 0);
  const netAmountToBePaid = Math.round(balanceDueRounded - onAcAdvAdjusted);

  const onAcTotalAdv = Number(master.on_ac_total_advance || 0);
  const onAcTotalAdvAdj = Number(master.on_ac_total_adv_adjusted || 0);
  const onAcBalanceAmt = Math.max(0, onAcTotalAdv - onAcTotalAdvAdj);

  return (
    <PrintModal
      isOpen={isOpen}
      onClose={onClose}
      title={`MR SETTLEMENT PRINT PREVIEW - ${master.mr_no || "N/A"}`}
    >
      <div
        id="print-modal-children-canvas"
        className="bg-white text-black px-5 py-4 mx-auto w-full max-w-[210mm] min-h-[285mm] flex flex-col justify-between text-[11px] leading-tight"
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
      >
        <div>
          {/* Top Header Line */}
          <div className="grid grid-cols-12 items-end pb-1 text-[10.5px]">
            <div className="col-span-3 text-left text-[9.5px] text-gray-800">
              Powered by
            </div>
            <div className="col-span-3 text-center font-bold text-[13px] tracking-wider uppercase">
              {master.unit_name || "BALLY"}
            </div>
            <div className="col-span-6 text-right text-[10px] whitespace-nowrap">
              Printed On : {todaySlash} by {printedByDisplay}, No of Times Printed - ONE
            </div>
          </div>

          {/* Framed Master Header Box */}
          <div className="border border-black grid grid-cols-12 text-[11px]">
            {/* Left Details (9 cols) */}
            <div className="col-span-9 p-2 space-y-1">
              {/* MR No & Date */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-2 font-normal">MR No.</div>
                <div className="col-span-5 font-bold text-[12.5px]">
                  : {master.mr_no || "-"}
                </div>
                <div className="col-span-5">
                  <span className="mr-2">Date :</span>
                  <span className="font-bold text-[12.5px]">{mrDateDisplay}</span>
                </div>
              </div>

              {/* Supplier & Address */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-2">Supplier</div>
                <div className="col-span-10">
                  <div>: {(master.supplier || "-").toUpperCase()}</div>
                  {master.supplier_address && (
                    <div className="pl-2 uppercase text-[10.5px]">
                      {master.supplier_address}
                    </div>
                  )}
                </div>
              </div>

              {/* Broker */}
              <div className="grid grid-cols-12 items-baseline pt-0.5">
                <div className="col-span-2">Broker</div>
                <div className="col-span-10 uppercase">
                  : {master.broker || master.supplier || "-"}
                </div>
              </div>

              {/* Order No & Date */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-2">Order No</div>
                <div className="col-span-5 font-bold text-[12px]">
                  : {master.po_no || "-"}
                </div>
                <div className="col-span-5">
                  <span className="mr-2">Date :</span>
                  <span className="font-bold text-[12px]">{poDateDisplay}</span>
                </div>
              </div>

              {/* Area/Agency */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-2">Area/Agency:</div>
                <div className="col-span-10 uppercase pl-2">{areaAgencyDisplay}</div>
              </div>

              {/* Consign No */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-2">Consign No.:</div>
                <div className="col-span-10 pl-2">
                  <span className="inline-block min-w-[70px]">{consignNoDisplay}</span>
                  <span>{consignDateDisplay}</span>
                </div>
              </div>

              {/* Way Bill */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-2">Way Bill</div>
                <div className="col-span-10">: {master.way_bill || ""}</div>
              </div>

              {/* Pan No */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-2">Pan No.</div>
                <div className="col-span-10">: {master.pan_no || ""}</div>
              </div>
            </div>

            {/* Right Split Box (3 cols): Party Bill No & Party Bill Date */}
            <div className="col-span-3 border-l border-black flex flex-col">
              <div className="flex-1 border-b border-black p-2 flex flex-col justify-between">
                <div className="font-bold text-center text-[11px]">Party Bill No</div>
                <div className="text-center font-bold text-[12px] pb-2">
                  {master.payable_bill_no || ""}
                </div>
              </div>
              <div className="flex-1 p-2 flex flex-col justify-between">
                <div className="font-bold text-center text-[11px]">Party Bill Date</div>
                <div className="text-center text-[11.5px] pb-2">
                  {partyBillDateDisplay}
                </div>
              </div>
            </div>
          </div>

          {/* Material Details Table */}
          <div className="mt-1">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-black font-bold text-left">
                  <th className="py-1 pr-1 w-[8%]">Grade</th>
                  <th className="py-1 px-1 w-[8%]">Marka</th>
                  <th className="py-1 px-1 w-[9%] text-right">Quantity</th>
                  <th className="py-1 px-1 w-[8%] text-center">Unit</th>
                  <th className="py-1 px-1 w-[9%] text-right">P.O Rate</th>
                  <th className="py-1 px-1 w-[12%] text-right">Type</th>
                  <th className="py-1 px-1 w-[8%] text-right">Claim</th>
                  <th className="py-1 px-1 w-[8%] text-right">Sett.</th>
                  <th className="py-1 px-1 w-[10%] text-right">Rate (+/-)</th>
                  <th className="py-1 px-1 w-[10%] text-right">Sett. Rate</th>
                  <th className="py-1 pl-1 w-[10%] text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {activeDetails.map((col, idx) => {
                  const rawGrade = resolveGradeName(col.grade || "").trim();
                  const gradeDisplay =
                    rawGrade && !rawGrade.endsWith(".") ? `${rawGrade}.` : rawGrade || "-";
                  const markaDisplay = (col.marka_crop || "").split("/")[0].trim();
                  const qtyBales = Number(col.quantity) || 0;
                  const wtMt = getColWtMt(col);
                  const wtKgs = Math.round(wtMt * 1000);
                  const unitDisplay = col.unit || "BALES";

                  const poRate = Number(col.rate_value) || 0;
                  const premVal =
                    Number(col.premium) > 0
                      ? Number(col.premium)
                      : Number(master.summary_premium_amount) > 0
                      ? Number(master.summary_premium_amount)
                      : Number(master.val_premium_amt) > 0 && wtMt > 0
                      ? Number((Number(master.val_premium_amt) / (wtMt * 10)).toFixed(2))
                      : 0;
                  const gdClaim = Number(col.gd_claim) || 0;
                  const gdSett =
                    col.sett_pct !== undefined && col.sett_pct !== null
                      ? Number(col.sett_pct)
                      : Number(col.gd_sett) > 0
                      ? Number(col.gd_sett)
                      : gdClaim;
                  const gdDedRate = Number(col.deduction_rate) || 0;
                  const gdRateAdj = gdDedRate > 0 ? -gdDedRate : 0;

                  const moistClaim =
                    Number(col.moist_claim) > 0
                      ? Number(col.moist_claim)
                      : Number(master.summary_rate_wt_claim) || 0;
                  const moistSett = Number(col.moist_sett) || 0;

                  const netRateAdj = premVal - gdDedRate;
                  const settRate = getEffectiveColSettRate(col);
                  const colValue = getColAmount(col);

                  return (
                    <React.Fragment key={idx}>
                      {/* Line 1: Grade, Marka, Qty, Unit, PO Rate, Grd.Down, Claim, Sett, Rate(-), Sett.Rate, Value */}
                      <tr className="align-top">
                        <td className="pt-1.5 pr-1 font-medium">{gradeDisplay}</td>
                        <td className="pt-1.5 px-1 uppercase">{markaDisplay}</td>
                        <td className="pt-1.5 px-1 text-right">{qtyBales}</td>
                        <td className="pt-1.5 px-1 text-center uppercase">{unitDisplay}</td>
                        <td className="pt-1.5 px-1 text-right">{poRate}</td>
                        <td className="pt-1.5 px-1 text-right">Grd.Down:</td>
                        <td className="pt-1.5 px-1 text-right">{gdClaim}</td>
                        <td className="pt-1.5 px-1 text-right">{gdSett}</td>
                        <td className="pt-1.5 px-1 text-right">{gdRateAdj}</td>
                        <td className="pt-1.5 px-1 text-right">{settRate}</td>
                        <td className="pt-1.5 pl-1 text-right">{colValue.toFixed(2)}</td>
                      </tr>

                      {/* Line 2: Weight in Kgs & Moisture */}
                      <tr className="align-top">
                        <td colSpan={2}></td>
                        <td colSpan={2} className="px-1 text-center whitespace-nowrap">
                          {wtKgs} Kgs
                        </td>
                        <td></td>
                        <td className="px-1 text-right">Moisture:</td>
                        <td className="px-1 text-right">{moistClaim}</td>
                        <td className="px-1 text-right">{moistSett > 0 ? moistSett : ""}</td>
                        <td colSpan={3}></td>
                      </tr>

                      {/* Line 3: Premium */}
                      <tr className="align-top">
                        <td colSpan={5}></td>
                        <td className="px-1 text-right">Premium:</td>
                        <td colSpan={2}></td>
                        <td className="px-1 text-right">
                          <span className="border-b border-black inline-block min-w-[44px] text-right">
                            {premVal}
                          </span>
                        </td>
                        <td colSpan={2}></td>
                      </tr>

                      {/* Line 4: Total Rate (+/-) */}
                      <tr className="border-b border-black align-top">
                        <td colSpan={5} className="pb-1.5"></td>
                        <td className="pb-1.5 px-1 text-right">Total:</td>
                        <td colSpan={2} className="pb-1.5"></td>
                        <td className="pb-1.5 px-1 text-right">{netRateAdj}</td>
                        <td colSpan={2} className="pb-1.5"></td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Miscellaneous Charges Section */}
          <div className="mt-2 mb-3">
            <div className="text-center font-bold text-[11.5px] mb-1.5">
              Miscellaneous Charges
            </div>

            <div className="space-y-1 text-[11px]">
              {inspectionDedItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 items-baseline">
                  <div className="col-span-5 uppercase">{item.type}</div>
                  <div className="col-span-2 text-right">{item.qtyKgs} Kgs.</div>
                  <div className="col-span-2 text-center">@Rs.{item.rate}</div>
                  <div className="col-span-2 text-left">Less per Quintal</div>
                  <div className="col-span-1 text-right">-{item.amount.toFixed(2)}</div>
                </div>
              ))}

              {settlementApmcDiff > 0 && (
                <div className="grid grid-cols-12 items-baseline">
                  <div className="col-span-11">
                    Miscellaneous Deduction M.R. value (Total-{actualApmc},Challan-
                    {challanApmc},Settlement-{settlementApmcDiff})
                  </div>
                  <div className="col-span-1 text-right">
                    -{settlementApmcDiff.toFixed(2)}
                  </div>
                </div>
              )}

              {miscAdd > 0 && (
                <div className="grid grid-cols-12 items-baseline">
                  <div className="col-span-11">Miscellaneous Addition (+)</div>
                  <div className="col-span-1 text-right">+{miscAdd.toFixed(2)}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Framed Summary Box + Signature Footer */}
        <div className="mt-auto">
          <div className="border border-black text-[11px]">
            {/* Top Row: Remarks */}
            <div className="border-b border-black px-2 py-1">
              Remarks :- {master.remarks || ""}
            </div>

            {/* Split Left & Right Columns */}
            <div className="grid grid-cols-12">
              {/* Left Column: On A/c Advance & Cheque Adjustments */}
              <div className="col-span-6 border-r border-black flex flex-col">
                <div className="border-b border-black p-2 space-y-1">
                  <div>Note:</div>
                  <div className="flex justify-between">
                    <span>On A/c Total Advance :</span>
                    <span>Rs. {onAcTotalAdv}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>On A/c Total Adv. Adjusted :</span>
                    <span>Rs. {onAcTotalAdvAdj}</span>
                  </div>
                </div>

                <div className="border-b border-black px-2 py-1.5 flex justify-between">
                  <span>Balance Amount :</span>
                  <span>Rs. {onAcBalanceAmt > 0 ? onAcBalanceAmt : ""}</span>
                </div>

                <div className="border-b border-black px-2 py-1 text-center font-bold">
                  On A/c Adv. Adjustment Made Against This MR
                </div>

                <div className="border-b border-black grid grid-cols-3 px-2 py-1 font-bold text-[10.5px]">
                  <div>Cheque No</div>
                  <div className="text-center">Date</div>
                  <div className="text-right">Adjusted Value</div>
                </div>

                <div className="flex-1 min-h-[110px] p-2">
                  {Array.isArray(master.cheque_adjustments) &&
                    master.cheque_adjustments.map((chk, cIdx) => (
                      <div key={cIdx} className="grid grid-cols-3 text-[10.5px] py-0.5">
                        <div>{chk.cheque_no}</div>
                        <div className="text-center">{chk.date}</div>
                        <div className="text-right">
                          {formatIndAmount(chk.adjusted_value)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Right Column: Financial Settlement Calculation Summary */}
              <div className="col-span-6 flex flex-col">
                <div className="border-b border-black p-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Material Value :</span>
                    <span>{formatIndAmount(materialValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Material Misc(+) :</span>
                    <span>{formatIndAmount(miscAdd)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Material Misc(-) :</span>
                    <span>{formatIndAmount(miscLessTotal)}</span>
                  </div>
                </div>

                <div className="border-b border-black p-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Total MR Amount :</span>
                    <span>{formatIndAmount(totalMrAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MR Advance Amount :</span>
                    <span>{formatIndAmount(mrAdvanceAmount)}</span>
                  </div>
                </div>

                <div className="border-b border-black px-2 py-1.5 flex justify-between font-bold">
                  <span>Balance Due (Rounded) :</span>
                  <span>{formatIndAmount(balanceDueRounded)}</span>
                </div>

                <div className="border-b border-black px-2 py-1.5 flex justify-between">
                  <span>On A/c Adv. Adjusted Amount:Rs.</span>
                  <span>{formatIndAmount(onAcAdvAdjusted)}</span>
                </div>

                <div className="p-2 flex-1 flex flex-col justify-between min-h-[90px]">
                  <div className="flex justify-between font-bold text-[11.5px]">
                    <span>Net Amount to be Paid :Rs.</span>
                    <span>{formatIndAmount(netAmountToBePaid)}</span>
                  </div>

                  <div className="pt-3 text-[10.5px] leading-relaxed">
                    <span className="mr-3">Rs. :</span>
                    <span>{numberToIndianWords(netAmountToBePaid)} ONLY</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Signature Footer */}
          <div className="pt-10 pb-2 px-4 flex justify-between items-end text-[11px] font-bold">
            <div className="border-b border-black pb-0.5">Prepared by</div>
            <div className="border-b border-black pb-0.5">Checked by</div>
            <div className="border-b border-black pb-0.5">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </PrintModal>
  );
};

export default SettlementPrintModal;

