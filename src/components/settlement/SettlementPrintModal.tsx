import React, { useState, useEffect, useRef } from "react";
import PrintModal from "../PrintModal";
import {
  SettlementMaster,
  SettlementDetailColumn,
  getColWtMt,
  getColAmount,
  getEffectiveColSettRate,
} from "../../types/settlement.types";
import { supabase } from "../../lib/supabase";
import { dbModule } from "../../services/dbModule";
import { getAuthenticatedUser } from "../../lib/userResolver";

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

function formatIndAmount(val: number): string {
  const num = Number(val) || 0;
  if (Math.abs(num) < 0.005) return "0.00";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function countToEnglishWord(num: number): string {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n <= 0) return "ONE";
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

  if (n < 20) return ones[n];
  if (n < 100) {
    const t = tens[Math.floor(n / 10)];
    const o = ones[n % 10];
    return o ? `${t} ${o}` : t;
  }
  if (n < 1000) {
    const h = ones[Math.floor(n / 100)] + " HUNDRED";
    const rem = n % 100;
    return rem > 0 ? `${h} ${countToEnglishWord(rem)}` : h;
  }
  return String(n);
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

export function resolveLoggedInPrintUserName(): string {
  try {
    const auth = getAuthenticatedUser();
    if (auth.username && auth.username.toUpperCase() !== "UNKNOWN USER") {
      return auth.username.toUpperCase();
    }
  } catch {}

  try {
    const rawSess = typeof window !== "undefined" ? localStorage.getItem("bally_auth_session") : null;
    if (rawSess) {
      const parsed = JSON.parse(rawSess);
      const name = parsed?.username || parsed?.userName || parsed?.name || parsed?.userId;
      if (name) return String(name).toUpperCase();
    }
  } catch {}

  try {
    const rawUser = typeof window !== "undefined" ? localStorage.getItem("logged_in_user") : null;
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      const name = parsed?.username || parsed?.name;
      if (name) return String(name).toUpperCase();
    }
  } catch {}

  return "ADMIN";
}

export const SettlementPrintModal: React.FC<SettlementPrintModalProps> = ({
  isOpen,
  onClose,
  viewModalData,
  resolveGradeName = (g: string) => g,
}) => {
  const [persistedPrintCount, setPersistedPrintCount] = useState<number>(0);
  const [advancePayment, setAdvancePaymentDone] = useState<string>('Yes');
  const isPrintingRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !viewModalData?.master?.mr_no) return;
    let isMounted = true;
    const mrNo = viewModalData.master.mr_no;
    const initialCount = Number(viewModalData.master.print_count) || 0;
    setPersistedPrintCount(initialCount);

    const loadDbCount = async () => {
      if (!supabase) return;
      //alert('11111')
      try {
        const { data: paymentData, error: paymentError } = await supabase
          .from("payment_master")
          .select("advance_payment_done")
          .eq("mr_no", mrNo)
          .maybeSingle();
        if (paymentData && paymentData.advance_payment_done !== null && paymentData.advance_payment_done !== undefined ) {
            setAdvancePaymentDone(paymentData.advance_payment_done);
        }
        //alert('2222')
        const { data } = await supabase
          .from("mr_settlement_master")
          .select("print_count")
          .eq("mr_no", mrNo)
          .maybeSingle();
        if (data && data.print_count !== null && data.print_count !== undefined) {
          if (isMounted) setPersistedPrintCount(Number(data.print_count));
          return;
        }

        const { data: histData } = await supabase
          .from("settlement_print_history")
          .select("print_count")
          .eq("mr_no", mrNo)
          .order("print_count", { ascending: false })
          .limit(1);
        if (histData && histData.length > 0 && histData[0].print_count !== undefined) {
          if (isMounted) setPersistedPrintCount(Number(histData[0].print_count));
        }
        
        
      } catch {
        // ignore
      }
    };

    loadDbCount();
    return () => {
      isMounted = false;
    };
  }, [isOpen, viewModalData?.master?.mr_no]);

  if (!isOpen || !viewModalData) return null;

  const { master, details } = viewModalData;

  const activeDetails = details.filter(
    (c) =>
      (Number(c.quantity) > 0 || Number(c.arr_qty_wt) > 0 || Number(c.rate_value) > 0) &&
      getColWtMt(c) > 0
  );

  const printNow = new Date();
  const todaySlash = `${String(printNow.getDate()).padStart(2, "0")}/${String(printNow.getMonth() + 1).padStart(2, "0")}/${String(printNow.getFullYear()).slice(-2)}`;
  const printedByDisplay = resolveLoggedInPrintUserName();

  const targetPrintNum = persistedPrintCount + 1;
  const printCountWord = countToEnglishWord(targetPrintNum);

  const handleInitiatePrint = async () => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;

    const mrNo = master.mr_no;
    const nextCount = persistedPrintCount + 1;
    const nowIso = new Date().toISOString();
    const userName = printedByDisplay;
    let userId: string | null = null;
    try {
      const auth = getAuthenticatedUser();
      userId = auth.userId || null;
    } catch {}

    try {
      if (supabase && mrNo) {
        await supabase
          .from("mr_settlement_master")
          .update({
            print_count: nextCount,
            last_printed_at: nowIso,
            last_printed_by_name: userName,
          })
          .eq("mr_no", mrNo);

        await supabase
          .from("settlement_print_history")
          .insert({
            mr_no: mrNo,
            print_count: nextCount,
            printed_by_name: userName,
            printed_by_id: userId,
            printed_at: nowIso,
          });
      }

      try {
        await dbModule.update("mr_settlement_master", "mr_no", mrNo, {
          print_count: nextCount,
          last_printed_at: nowIso,
          last_printed_by_name: userName,
        });
      } catch {}

      master.print_count = nextCount;
      master.last_printed_at = nowIso;
      master.last_printed_by_name = userName;

      setPersistedPrintCount(nextCount);
    } catch (err) {
      console.error("Failed to record settlement print tracking:", err);
    } finally {
      setTimeout(() => {
        isPrintingRef.current = false;
      }, 1500);
    }
  };

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

  const consignNoDisplay = (
    master.consign_no ||
    master.challan_rr_no ||
    master.challan_railway_receipt_no ||
    master.challan_no ||
    ""
  ).trim();

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
    let amount = Number(dItem.deduction_amount) || 0;
    if (amount <= 0 && qtyKgs > 0 && rate > 0) {
      amount = (qtyKgs * rate) / 100;
    } else if (amount === rate && qtyKgs > 1 && rate > 0) {
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

  const computedMaterialValue = activeDetails.reduce((acc, col) => acc + getColAmount(col), 0);
  const materialValue =
    computedMaterialValue > 0
      ? computedMaterialValue
      : Number(master.val_material_value || master.summary_material_value || 0);

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
      onPrint={handleInitiatePrint}
    >
      <div
        id="print-modal-children-canvas"
        className="bg-white text-black px-3 py-2 mx-auto w-full max-w-[190mm] min-h-[275mm] flex flex-col justify-between text-[10px] leading-tight select-text"
        style={{ fontFamily: "'font-sans', font-sans, font-sans", boxSizing: "border-box" }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 8mm 8mm 8mm;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #print-modal-children-canvas {
              width: 100% !important;
              max-width: 100% !important;
              min-height: auto !important;
              padding: 0 !important;
              margin: 0 !important;
              box-sizing: border-box !important;
            }
            .print-grade-table thead,
            .print-grade-table thead tr,
            .print-grade-table thead th {
              background: #fff !important;
              background-color: #fff !important;
              border: none !important;
              box-shadow: none !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
        `}} />

        
        {/* Top Header Line */}
        <div className="flex justify-between items-baseline pb-1.5 text-[10px] w-full">
          <div className="text-left whitespace-nowrap text-[10px] font-extrabold font-sans">
            Powered by KatEye
          </div>
          <div className="text-center font-bold text-[13px] font-extrabold tracking-widest uppercase">
            {master.unit_name || "BALLY JUTE COMPANY LIMITED"}
          </div>
          <div className="text-right whitespace-nowrap text-[11px] font-extrabold font-sans">
            Printed On : {todaySlash} by {printedByDisplay}, No of Times Printed - {printCountWord}
          </div>
        </div>
        <div className="border-2 border-black">
          {/* Framed Master Header Box */}
          <div className="grid grid-cols-12 text-[11px]">
            {/* Left Details (9 cols) */}
            <div className="col-span-9 p-2 space-y-0.5">
              {/* MR No & Date */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-3 text-[13px] font-extrabold">MR No.</div>
                <div className="col-span-4 text-[13px] font-extrabold">: {master.mr_no || "-"}</div>
                <div className="col-span-5 text-right pr-6">
                  <span className="mr-2 text-[12px] font-extrabold">Date :</span>
                  <span className=" text-[12px] font-extrabold">{mrDateDisplay}</span>
                </div>
              </div>

              {/* Supplier & Address */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-3 text-[12px] font-extrabold">Supplier</div>
                <div className="col-span-9 uppercase text-[12px] font-extrabold">: {(master.supplier || "-").toUpperCase()}</div>
              </div>

              {/* Broker */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-3 text-[12px] font-extrabold">Broker</div>
                <div className="col-span-9 uppercase text-[12px] font-extrabold">: {master.broker || master.supplier || "-"}</div>
              </div>

              {/* Order No & Date */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-3 text-[12px] font-extrabold">Order No</div>
                <div className="col-span-4 font-bold text-[12px] font-extrabold">: {master.po_no || "-"}</div>
                <div className="col-span-5 text-right pr-6">
                  <span className="mr-2 text-[12px] font-extrabold">Date :</span>
                  <span className="text-[12px] font-extrabold">{poDateDisplay}</span>
                </div>
              </div>

              {/* Area/Agency */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-3 text-[12px] font-extrabold">Area/Agency</div>
                <div className="col-span-9 uppercase text-[12px] font-extrabold">: {areaAgencyDisplay}</div>
              </div>

              {/* Consign No */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-3 text-[12px] font-extrabold">Consign No.</div>
                <div className="col-span-9 text-[12px] font-extrabold">: {consignNoDisplay || "-"}</div>
              </div>

              {/* Way Bill */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-3 text-[12px] font-extrabold">Way Bill</div>
                <div className="col-span-9 text-[12px] font-extrabold">: {master.way_bill || ""}</div>
              </div>

              {/* Pan No */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-3 text-[12px] font-extrabold">Pan No.</div>
                <div className="col-span-9 text-[12px] font-extrabold">: {master.pan_no || ""}</div>
              </div>
            </div>

            {/* Right Split Box (3 cols): Party Bill No & Party Bill Date */}
            <div className="col-span-3 border-l border-black flex flex-col justify-between">
              <div className="flex-1 border-b border-black p-2 flex flex-col justify-between items-center text-center">
                <div className="text-[12px] font-extrabold">Party Bill No</div>
                <div className="text-[12px] font-extrabold pb-1">
                  {master.payable_bill_no || ""}
                </div>
              </div>
              <div className="flex-1 p-2 flex flex-col justify-between items-center text-center">
                <div className="text-[12px] font-extrabold">Party Bill Date</div>
                <div className="text-[12px] font-extrabold pb-1">
                  {partyBillDateDisplay}
                </div>
              </div>
            </div>
          </div>

          {/* Material Details Table */}
          <div className="">
            <table className="w-full text-[9px] table-fixed border-y border-black font-sans">
              <colgroup>
                <col style={{ width: "7.5%" }} />
                <col style={{ width: "7.5%" }} />
                <col style={{ width: "11.0%" }} />
                <col style={{ width: "6.5%" }} />
                <col style={{ width: "8.5%" }} />
                <col style={{ width: "11.5%" }} />
                <col style={{ width: "7.5%" }} />
                <col style={{ width: "7.5%" }} />
                <col style={{ width: "8.5%" }} />
                <col style={{ width: "9.5%" }} />
                <col style={{ width: "14.5%" }} />
              </colgroup>
              <thead className="bg-white">
                <tr className=" font-normal bg-white text-black text-[9px] leading-tight">
                  <th className="py-1 px-1 text-left align-middle whitespace-nowrap bg-white">Grade</th>
                  <th className="py-1 px-1 text-left align-middle whitespace-nowrap bg-white">Marka</th>
                  <th className="py-1 px-1 text-center align-middle whitespace-nowrap bg-white">Quantity</th>
                  <th className="py-1 px-1 text-center align-middle whitespace-nowrap bg-white">Unit</th>
                  <th className="py-1 px-0.5 text-center align-middle leading-none whitespace-nowrap bg-white">
                    <div>P.O</div>
                    <div>Rate</div>
                  </th>
                  <th className="py-1 px-1 text-center align-middle whitespace-nowrap bg-white">Type</th>
                  <th className="py-1 px-1 text-center align-middle whitespace-nowrap bg-white">Claim</th>
                  <th className="py-1 px-1 text-center align-middle whitespace-nowrap bg-white">Sett.</th>
                  <th className="py-1 px-0.5 text-center align-middle leading-none whitespace-nowrap bg-white">
                    <div>Rate</div>
                    <div>(+/-)</div>
                  </th>
                  <th className="py-1 px-0.5 text-center align-middle leading-none whitespace-nowrap bg-white">
                    <div>Sett.</div>
                    <div>Rate</div>
                  </th>
                  <th className="py-1 px-1 text-center align-middle whitespace-nowrap bg-white">Value</th>
                </tr>
              </thead>
              <tbody className="text-[8px] leading-[9px]">
                {activeDetails.map((col, idx) => {
                  const rawGrade = resolveGradeName(col.grade || "").trim();
                  const gradeDisplay =
                    rawGrade && !rawGrade.endsWith(".")
                      ? `${rawGrade}.`
                      : rawGrade || "-";

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
                      ? Number(
                          (Number(master.val_premium_amt) / (wtMt * 10)).toFixed(2)
                        )
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
                    col.moist_claim !== undefined &&
                    col.moist_claim !== null &&
                    !isNaN(Number(col.moist_claim))
                      ? Number(col.moist_claim)
                      : Number(master.summary_rate_wt_claim) || 0;

                  const netRateAdj = premVal - gdDedRate;
                  const settRate = getEffectiveColSettRate(col);
                  const colValue = getColAmount(col);

                  const cell = "p-0 border-0 align-top leading-[9px]";

                  return (
                    <React.Fragment key={idx}>
                      {/* Row 1: Main details */}
                      <tr className="border-0">
                        <td className={`${cell} font-bold text-left`}>{gradeDisplay}</td>
                        <td className={`${cell} uppercase text-left`}>{markaDisplay}</td>
                        <td className={`${cell} text-center`}>{qtyBales}</td>
                        <td className={`${cell} text-center uppercase`}>{unitDisplay}</td>
                        <td className={`${cell} text-center`}>{poRate}</td>
                        <td className={`${cell} text-center`}>Grd.Down:</td>
                        <td className={`${cell} text-center`}>{gdClaim}</td>
                        <td className={`${cell} text-center`}>{gdSett}</td>
                        <td className={`${cell} text-center`}>{gdRateAdj}</td>
                        <td className={`${cell} text-center`}>{settRate}</td>
                        <td className={`${cell} text-center`}>{colValue.toFixed(2)}</td>
                      </tr>

                      {/* Row 2: Weight and Moisture */}
                      <tr className="border-0">
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={`${cell} text-center`}>{wtKgs} Kgs</td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={`${cell} text-center`}>Moisture:</td>
                        <td className={`${cell} text-center`}>{moistClaim}</td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                      </tr>

                      {/* Row 3: Premium */}
                      <tr className="border-0">
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={`${cell} text-center`}>Premium:</td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={`${cell} text-center`}>
                          <span className="inline-block min-w-[45px] text-center">
                            {premVal}
                          </span>
                        </td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                      </tr>

                      {/* Row 4: Total Rate */}
                      <tr className="border-0">
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={`${cell} text-center`}>Total:</td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                        <td className={`${cell} text-center`}>{netRateAdj}</td>
                        <td className={cell}></td>
                        <td className={cell}></td>
                      </tr> 
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Miscellaneous Charges Section */}
          {/* <div className="mt-2 mb-2 border border-black"> */}
          <div className="mt-2 mb-2">
            <div className=" p-2 text-[11px]">
              <div className="text-center font-bold text-[11px] font-extrabold font-sans mb-2 uppercase tracking-wide">
                Miscellaneous Charges
              </div>

              <div className="space-y-1 text-[11px]">
                {inspectionDedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-baseline px-1 font-extrabold font-sans">
                    <div className="w-[42%] uppercase">{item.type}</div>
                    <div className="w-[18%] text-right">{item.qtyKgs} Kgs.</div>
                    <div className="w-[15%] text-center">@Rs.{item.rate}</div>
                    <div className="w-[15%] text-left">Less per Quintal</div>
                    <div className="w-[10%] text-right font-medium">-{item.amount.toFixed(2)}</div>
                  </div>
                ))}

                {settlementApmcDiff > 0 && (
                  <div className="flex justify-between items-baseline px-1 font-extrabold font-sans">
                    <div className="w-[90%]">
                      Miscellaneous Deduction M.R. value (Total-{actualApmc},Challan-
                      {challanApmc},Settlement-{settlementApmcDiff})
                    </div>
                    <div className="w-[10%] text-right font-medium">
                      -{settlementApmcDiff.toFixed(2)}
                    </div>
                  </div>
                )}

                {miscAdd > 0 && (
                  <div className="flex justify-between items-baseline px-1">
                    <div className="w-[90%]">Miscellaneous Addition (+)</div>
                    <div className="w-[10%] text-right font-medium">+{miscAdd.toFixed(2)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        
          {/* Bottom Section: Framed Summary Box + Signature Footer */}
          <div className="mt-auto pt-1">
            <div className="border-y border-black text-[11px]">
              {/* Top Row: Remarks */}
              <div className="border-b border-black px-2 py-1 text-[12px] font-sans">
                Remarks :- {master.remarks || ""}
              </div>

              {/* Split Left & Right Columns */}
              <div className="grid grid-cols-12">
                {/* Left Column: On A/c Advance & Cheque Adjustments */}
                <div className="col-span-6 border-r border-black flex flex-col justify-between">
                  <div>
                    <div className="border-b border-black p-2 space-y-1">
                      <div className="underline text-[12px] font-extrabold font-sans">Note:</div>
                      <div className="flex justify-between pr-4 text-[12px] font-extrabold font-sans">
                        <span>On A/c Total Advance</span>
                        <span>: Rs. {onAcTotalAdv || "0.00"}</span>
                      </div>
                      <div className="flex justify-between pr-4 text-[12px] font-extrabold font-sans">
                        <span>On A/c Total Adv. Adjusted</span>
                        <span>: Rs. {onAcTotalAdvAdj || "0.00"}</span>
                      </div>
                    </div>

                    <div className="border-b border-black px-2 py-1 flex justify-between pr-4 text-[12px] font-extrabold font-sans">
                      <span>Balance Amount</span>
                      <span>: Rs. {onAcBalanceAmt > 0 ? onAcBalanceAmt : "0.00"}</span>
                    </div>

                    <div className="border-b border-black px-2 py-1 text-center text-[12px] font-extrabold font-sans">
                      On A/c Adv. Adjustment Made Against This MR
                    </div>

                    <div className="border-b border-black grid grid-cols-3 px-1 py-1 text-[12px] font-extrabold font-sans text-center">
                      <div className="border-r border-black">Cheque No</div>
                      <div className="border-r border-black">Date</div>
                      <div>Adjusted Value</div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[75px] p-1">
                    {Array.isArray(master.cheque_adjustments) &&
                      master.cheque_adjustments.map((chk, cIdx) => (
                        <div key={cIdx} className="grid grid-cols-3 text-[10.5px] py-0.5 text-center">
                          <div className="border-r border-black px-1 text-left">{chk.cheque_no}</div>
                          <div className="border-r border-black px-1">{chk.date}</div>
                          <div className="px-1 text-right">
                            {formatIndAmount(chk.adjusted_value)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Right Column: Financial Settlement Calculation Summary */}
                <div className="col-span-6 flex flex-col justify-between">
                  <div>
                    <div className="border-b border-black p-1.5 space-y-1">
                      <div className="flex justify-between text-[12px] font-extrabold font-sans">
                        <span>Material Value</span>
                        <span>: {formatIndAmount(materialValue)}</span>
                      </div>
                      <div className="flex justify-between text-[12px] font-sans">
                        <span>Material Misc(+)</span>
                        <span>: {formatIndAmount(miscAdd)}</span>
                      </div>
                      <div className="flex justify-between text-[12px] font-sans">
                        <span>Material Misc(-)</span>
                        <span>: {formatIndAmount(miscLessTotal)}</span>
                      </div>
                    </div>

                    <div className="border-b border-black p-1.5 space-y-1">
                      <div className="flex justify-between text-[13px] font-extrabold font-sans">
                        <span>Total MR Amount</span>
                        <span>: {formatIndAmount(totalMrAmount)}</span>
                      </div>
                      <div className="flex justify-between text-[12px] font-extrabold font-sans">
                        <span>MR Advance Amount</span>
                        {advancePayment === 'Yes' && (
                          <span>: {formatIndAmount(mrAdvanceAmount)}</span>
                        )}
                        {advancePayment === 'No' && (
                          <span>: {formatIndAmount(0.00)}</span>
                        )}
                        
                      </div>
                    </div>

                    <div className="border-b border-black px-1.5 py-1 flex justify-between text-[13px] font-extrabold font-sans">
                      <span>Balance Due (Rounded)</span>
                      {advancePayment === 'Yes' && (
                        <span>: {formatIndAmount(balanceDueRounded)}</span>
                      )}
                      {advancePayment === 'No' && (
                        <span>: {formatIndAmount(totalMrAmount)}</span>
                      )}
                      
                    </div>

                    <div className="border-b border-black px-1.5 py-1 flex justify-between text-[11px] font-sans">
                      <span>On A/c Adv. Adjusted Amount</span>
                      <span>:Rs. {formatIndAmount(onAcAdvAdjusted)}</span>
                    </div>
                  </div>

                  <div className="p-1.5 flex-1 flex flex-col justify-between min-h-[75px]">
                    <div className="flex justify-between text-[11px] font-extrabold font-sans">
                      <span>Net Amount to be Paid</span>
                      {advancePayment === 'Yes' && (
                        <span className="font-extrabold font-sans">:Rs. {formatIndAmount(netAmountToBePaid)}</span>
                      )}
                      {advancePayment === 'No' && (
                       <span className="font-extrabold font-sans">:Rs.  {formatIndAmount(totalMrAmount)}</span>
                      )}
                      
                    </div>

                    <div className="pt-2 text-[10px] leading-snug">
                      <span className="mr-1 text-[11px] font-sans">Rs. :</span>
                      {advancePayment === 'Yes' && (
                        <span className="text-[11px] font-sans">{numberToIndianWords(netAmountToBePaid)} ONLY</span>
                      )}
                      {advancePayment === 'No' && (
                        <span className="text-[11px] font-sans">{numberToIndianWords(totalMrAmount)} ONLY</span>
                      )}
                      
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Signature Footer */}
            <div className="pt-3 pb-1 px-6 flex justify-between items-end text-[11px] font-bold">
              <div>
                <u className="pb-0 inline-block text-[12px] font-extrabold font-sans">Prepared by</u>
              </div>
              <div>
                <u className="pb-0 inline-block text-[12px] font-extrabold font-sans">Checked by</u>
              </div>
              <div>
                <u className="pb-0 inline-block text-[12px] font-extrabold font-sans">Authorised Signatory</u>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PrintModal>
  );
};

export default SettlementPrintModal;
