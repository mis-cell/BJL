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
  const [advancePayment, setAdvancePaymentDone] = useState<string>("Yes");
  const isPrintingRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !viewModalData?.master?.mr_no) return;
    let isMounted = true;
    const mrNo = viewModalData.master.mr_no;
    const initialCount = Number(viewModalData.master.print_count) || 0;
    setPersistedPrintCount(initialCount);

    const loadDbCount = async () => {
      if (!supabase) return;
      try {
        const { data: paymentRows } = await supabase
          .from("payment_master")
          .select("advance_payment_done, paid_amount, updated_at")
          .eq("mr_no", mrNo)
          .order("updated_at", { ascending: false });

        if (Array.isArray(paymentRows) && paymentRows.length > 0 && isMounted) {
          const hasAnyYes = paymentRows.some(
            (r: any) =>
              String(r.advance_payment_done || "Yes").trim().toLowerCase() !== "no" &&
              Number(r.paid_amount || 0) > 0
          );
          const topDecision = String(paymentRows[0].advance_payment_done || "Yes").trim();
          setAdvancePaymentDone(
            topDecision.toLowerCase() === "no" && !hasAnyYes ? "No" : "Yes"
          );
        }

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
  const rawMrAdvanceAmount = Number(master.final_on_ac_adv || master.less_advance_amount || 0);
  const effectiveAdvanceAmount = advancePayment === "No" ? 0 : rawMrAdvanceAmount;
  const effectiveBalanceDueRounded = Math.round(totalMrAmount - effectiveAdvanceAmount);
  const onAcAdvAdjusted = Number(master.final_less_adv || master.on_account_Effect || 0);
  const effectiveNetAmountToBePaid = Math.round(effectiveBalanceDueRounded - onAcAdvAdjusted);

  const onAcTotalAdv = Number(master.on_ac_total_advance || 0);
  const onAcTotalAdvAdj = Number(master.on_ac_total_adv_adjusted || 0);
  const onAcBalanceAmt = Math.max(0, onAcTotalAdv - onAcTotalAdvAdj);

  // Generate and download the exact 58-row x 23-column Google Sheet / CSV template
  const handleDownloadTemplateCsv = () => {
    const TOTAL_ROWS = 58;
    const TOTAL_COLS = 23;
    const grid: string[][] = Array.from({ length: TOTAL_ROWS }, () =>
      Array(TOTAL_COLS).fill("")
    );

    const setCell = (r1Based: number, c0Based: number, val: string | number) => {
      if (r1Based >= 1 && r1Based <= TOTAL_ROWS && c0Based >= 0 && c0Based < TOTAL_COLS) {
        grid[r1Based - 1][c0Based] = String(val ?? "");
      }
    };

    // Row 1: Company Title
    setCell(1, 0, master.unit_name || "BALLY JUTE COMPANY LIMITED");

    // Row 2: Powered by KatEye™ & Printed On
    setCell(2, 1, "  Powered by KatEye™");
    setCell(
      2,
      4,
      `Printed On : ${todaySlash} by ${printedByDisplay}, No of Times Printed - ${printCountWord}       `
    );

    // Row 3: MR No., Date, Party Bill No
    setCell(3, 1, "  MR No.");
    setCell(3, 3, ":");
    setCell(3, 4, master.mr_no || "");
    setCell(3, 6, "Date");
    setCell(3, 7, ":");
    setCell(3, 8, mrDateDisplay);
    setCell(3, 10, "Party Bill No");

    // Row 4: Supplier & Party Bill No value
    setCell(4, 0, " ");
    setCell(4, 1, "  Supplier");
    setCell(4, 3, ":");
    setCell(4, 4, (master.supplier || "").toUpperCase());
    setCell(4, 10, master.payable_bill_no || "");

    // Row 5: Supplier Address (if any)
    if ((master as any).supplier_address) {
      setCell(5, 4, String((master as any).supplier_address).toUpperCase());
    }

    // Row 6: Broker
    setCell(6, 1, "  Broker");
    setCell(6, 3, ":");
    setCell(6, 4, (master.broker || master.supplier || "").toUpperCase());

    // Row 7: Order No, Date, Party Bill Date
    setCell(7, 1, "  Order No");
    setCell(7, 3, ":");
    setCell(7, 4, master.po_no || "");
    setCell(7, 6, "Date");
    setCell(7, 7, ":");
    setCell(7, 8, poDateDisplay);
    setCell(7, 10, "Party Bill Date");

    // Row 8: Area/Agency & Party Bill Date value
    setCell(8, 1, "  Area/Agency");
    setCell(8, 3, ":");
    setCell(8, 4, areaAgencyDisplay);
    setCell(8, 10, partyBillDateDisplay);

    // Row 9: Consign No.
    setCell(9, 1, "  Consign No.");
    setCell(9, 3, ":");
    setCell(9, 4, consignNoDisplay);

    // Row 10: Way Bill
    setCell(10, 1, "  Way Bill");
    setCell(10, 3, ":");
    setCell(10, 4, master.way_bill || "");

    // Row 11: Pan No.
    setCell(11, 1, "  Pan No.");
    setCell(11, 3, ":");
    setCell(11, 4, master.pan_no || "");

    // Row 12: Table Header
    setCell(12, 1, "Grade");
    setCell(12, 2, "Marka");
    setCell(12, 3, "Quantity");
    setCell(12, 4, "Unit");
    setCell(12, 5, "P.O\nRate");
    setCell(12, 6, "Type");
    setCell(12, 7, "Claim");
    setCell(12, 8, "Sett.");
    setCell(12, 9, "Rate\n(+/-)");
    setCell(12, 10, "Sett.\nRate");
    setCell(12, 11, "Value");

    // Grade items starting from Row 14 (4 rows per grade item, up to Row 33)
    activeDetails.forEach((col, idx) => {
      const baseRow = 14 + idx * 4;
      if (baseRow + 3 > 33) return;
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
        col.moist_claim !== undefined &&
        col.moist_claim !== null &&
        !isNaN(Number(col.moist_claim))
          ? Number(col.moist_claim)
          : Number(master.summary_rate_wt_claim) || 0;
      const netRateAdj = premVal - gdDedRate;
      const settRate = getEffectiveColSettRate(col);
      const colValue = getColAmount(col);

      // Line 1: Grd.Down
      setCell(baseRow, 1, gradeDisplay);
      setCell(baseRow, 2, markaDisplay);
      setCell(baseRow, 3, qtyBales);
      setCell(baseRow, 4, unitDisplay);
      setCell(baseRow, 5, poRate);
      setCell(baseRow, 6, "Grd.Down:");
      setCell(baseRow, 7, gdClaim || "");
      setCell(baseRow, 8, gdSett || "");
      setCell(baseRow, 9, gdRateAdj);
      setCell(baseRow, 10, settRate);
      setCell(baseRow, 11, colValue.toFixed(2));

      // Line 2: Moisture & Kgs
      setCell(baseRow + 1, 3, `${wtKgs} Kgs`);
      setCell(baseRow + 1, 6, "Moisture:");
      setCell(baseRow + 1, 7, moistClaim || "");

      // Line 3: Premium
      setCell(baseRow + 2, 6, "Premium:");
      setCell(baseRow + 2, 9, premVal);

      // Line 4: Total
      setCell(baseRow + 3, 6, "Total:");
      setCell(baseRow + 3, 9, netRateAdj);
    });

    // Row 34: Miscellaneous Charges
    setCell(34, 1, "Miscellaneous Charges");
    let miscRowCursor = 35;
    inspectionDedItems.forEach((item) => {
      if (miscRowCursor <= 41) {
        setCell(miscRowCursor, 1, item.type);
        setCell(miscRowCursor, 5, `${item.qtyKgs} Kgs.`);
        setCell(miscRowCursor, 7, `@Rs.${item.rate}`);
        setCell(miscRowCursor, 9, "Less per Quintal");
        setCell(miscRowCursor, 11, `-${item.amount.toFixed(2)}`);
        miscRowCursor++;
      }
    });
    if (settlementApmcDiff > 0 && miscRowCursor <= 42) {
      setCell(
        miscRowCursor,
        1,
        `Miscellaneous Deduction M.R. value (Total-${actualApmc},Challan-${challanApmc},Settlement-${settlementApmcDiff})`
      );
      setCell(miscRowCursor, 11, `-${settlementApmcDiff.toFixed(2)}`);
      miscRowCursor++;
    }
    if (miscAdd > 0 && miscRowCursor <= 42) {
      setCell(miscRowCursor, 1, "Miscellaneous Addition (+)");
      setCell(miscRowCursor, 11, `+${miscAdd.toFixed(2)}`);
    }

    // Row 43: Remarks :-
    setCell(43, 1, `  Remarks :- ${master.remarks || ""}`);

    // Row 44: Note & Material Value
    setCell(44, 1, "  Note:");
    setCell(44, 7, "  Material Value");
    setCell(44, 10, ":");
    setCell(44, 11, formatIndAmount(materialValue));

    // Row 45: On A/c Total Advance & Material Misc(+)
    setCell(45, 1, "  On A/c Total Advance");
    setCell(45, 5, `: Rs.   ${formatIndAmount(onAcTotalAdv)}`);
    setCell(45, 7, "  Material Misc(+)");
    setCell(45, 10, ":");
    setCell(45, 11, formatIndAmount(miscAdd));

    // Row 46: On A/c Total Adv. Adjusted & Material Misc(-)
    setCell(46, 1, "  On A/c Total Adv. Adjusted");
    setCell(46, 5, `: Rs.   ${formatIndAmount(onAcTotalAdvAdj)}`);
    setCell(46, 7, "  Material Misc(-)");
    setCell(46, 10, ":");
    setCell(46, 11, formatIndAmount(miscLessTotal));

    // Row 47: Balance Amount & Total MR Amount
    setCell(47, 1, "  Balance Amount");
    setCell(47, 5, `: Rs.   ${formatIndAmount(onAcBalanceAmt)}`);
    setCell(47, 7, "  Total MR Amount");
    setCell(47, 10, ":");
    setCell(47, 11, formatIndAmount(totalMrAmount));

    // Row 48: On A/c Adv. Adjustment Made Against This MR & MR Advance Amount
    setCell(48, 1, "On A/c Adv. Adjustment Made Against This MR");
    setCell(48, 7, "MR Advance Amount");
    setCell(48, 10, ":");
    setCell(48, 11, formatIndAmount(effectiveAdvanceAmount));

    // Row 49: Cheque No / Date / Adjusted Value & Balance Due(Rounded)
    setCell(49, 1, "Cheque No");
    setCell(49, 3, "Date");
    setCell(49, 5, "Adjusted Value");
    setCell(49, 7, " Balance Due(Rounded)");
    setCell(49, 10, ":");
    setCell(49, 11, formatIndAmount(effectiveBalanceDueRounded));

    // Row 50: On A/c Adv. Adjusted Amount
    setCell(50, 7, " On A/c Adv. Adjusted Amount :");
    setCell(50, 11, formatIndAmount(onAcAdvAdjusted));

    // Row 51: Net Amount to be Paid
    setCell(51, 7, "Net Amount to be Paid");
    setCell(51, 10, ":");
    setCell(51, 11, formatIndAmount(effectiveNetAmountToBePaid));

    // Row 52: Amount in words
    setCell(
      52,
      7,
      `Rs. :  ${numberToIndianWords(effectiveNetAmountToBePaid)} ONLY`
    );

    // Populate any cheque adjustments in rows 50..52
    if (Array.isArray(master.cheque_adjustments)) {
      master.cheque_adjustments.slice(0, 3).forEach((chk, cIdx) => {
        setCell(50 + cIdx, 1, chk.cheque_no || "");
        setCell(50 + cIdx, 3, chk.date || "");
        setCell(50 + cIdx, 5, formatIndAmount(chk.adjusted_value));
      });
    }

    // Row 57: Signatures
    setCell(57, 1, "Prepared by");
    setCell(57, 6, "Checked by");
    setCell(57, 10, "Authorised Signatory");

    const escapeCsvField = (field: string) => {
      if (field.includes(",") || field.includes('"') || field.includes("\n")) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent =
      "\uFEFF" +
      grid.map((row) => row.map(escapeCsvField).join(",")).join("\r\n") +
      "\r\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `Settlement_Template_${(master.mr_no || "MR").replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <PrintModal
      isOpen={isOpen}
      onClose={onClose}
      title={`MR SETTLEMENT PRINT PREVIEW - ${master.mr_no || "N/A"}`}
      onPrint={handleInitiatePrint}
      extraActions={
        <button
          type="button"
          onClick={handleDownloadTemplateCsv}
          className="bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-950 shadow-[1px_1px_0_0_rgba(0,0,0,0.4)] px-3 text-xs font-black h-8 flex items-center gap-1.5 cursor-pointer transition"
          title="Download populated Google Sheet / CSV template matching your exact template structure"
        >
          📊 DOWNLOAD SHEET TEMPLATE (.CSV)
        </button>
      }
    >
      <div
        id="print-modal-children-canvas"
        className="bg-white text-black px-3 py-2 mx-auto w-full max-w-[192mm] min-h-[275mm] flex flex-col justify-between text-[11px] leading-tight select-text font-mono"
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          boxSizing: "border-box",
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
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
              min-height: 275mm !important;
              padding: 0 !important;
              margin: 0 !important;
              box-sizing: border-box !important;
            }
          }
        `,
          }}
        />

        {/* Top Section (Rows 1 to 42 of Template) */}
        <div className="w-full">
          {/* Row 1: Company Title Centered at Very Top */}
          <div className="text-center font-extrabold text-[15px] tracking-wider uppercase leading-tight pb-0.5">
            {master.unit_name || "BALLY JUTE COMPANY LIMITED"}
          </div>

          {/* Row 2: Powered by KatEye™ (Left) & Printed On (Right) */}
          <div className="flex justify-between items-baseline pb-1 text-[11px] w-full">
            <div className="text-left whitespace-nowrap italic font-bold text-[10.5px]">
              Powered by KatEye™
            </div>
            <div className="text-right whitespace-nowrap text-[11px] font-bold">
              Printed On : {todaySlash} by {printedByDisplay}, No of Times Printed -{" "}
              {printCountWord}
            </div>
          </div>

          {/* Main Outer Frame Box (Rows 3 to 52 of Template) */}
          <div className="border border-black flex flex-col justify-between min-h-[242mm]">
            <div>
              {/* Framed Master Header Box (Rows 3 to 11 of Template) */}
              <div className="grid grid-cols-12 text-[11.5px] border-b border-black">
                {/* Left Details (Cols B to J -> 9 cols) */}
                <div className="col-span-10 px-2 py-1.5 space-y-0.5 leading-[1.35]">
                  {/* Row 3: MR No. & Date */}
                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">MR No.</div>
                    <div className="col-span-5 font-bold">
                      : {master.mr_no || "-"}
                    </div>
                    <div className="col-span-5">
                      <span className="font-bold">Date : </span>
                      <span className="font-bold">{mrDateDisplay}</span>
                    </div>
                  </div>

                  {/* Row 4: Supplier */}
                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Supplier</div>
                    <div className="col-span-10 uppercase font-bold">
                      : {(master.supplier || "-").toUpperCase()}
                    </div>
                  </div>

                  {/* Row 5: Second line of Supplier / Address spacing row */}
                  <div className="grid grid-cols-12 items-baseline min-h-[14px]">
                    <div className="col-span-2"></div>
                    <div className="col-span-10 uppercase pl-2 font-bold">
                      {(master as any).supplier_address || ""}
                    </div>
                  </div>

                  {/* Row 6: Broker */}
                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Broker</div>
                    <div className="col-span-10 uppercase font-bold">
                      : {(master.broker || master.supplier || "-").toUpperCase()}
                    </div>
                  </div>

                  {/* Row 7: Order No & Date */}
                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Order No</div>
                    <div className="col-span-5 font-bold">
                      : {master.po_no || "-"}
                    </div>
                    <div className="col-span-5">
                      <span className="font-bold">Date : </span>
                      <span className="font-bold">{poDateDisplay}</span>
                    </div>
                  </div>

                  {/* Row 8: Area/Agency */}
                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Area/Agency</div>
                    <div className="col-span-10 uppercase font-bold">
                      : {areaAgencyDisplay}
                    </div>
                  </div>

                  {/* Row 9: Consign No. */}
                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Consign No.</div>
                    <div className="col-span-10 font-bold">
                      : {consignNoDisplay || ""}
                    </div>
                  </div>

                  {/* Row 10: Way Bill */}
                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Way Bill</div>
                    <div className="col-span-10 font-bold">
                      : {master.way_bill || ""}
                    </div>
                  </div>

                  {/* Row 11: Pan No. */}
                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Pan No.</div>
                    <div className="col-span-10 font-bold">
                      : {master.pan_no || ""}
                    </div>
                  </div>
                </div>

                {/* Right Split Box (Cols K to L -> 2 cols): Party Bill No & Party Bill Date */}
                <div className="col-span-2 border-l border-black flex flex-col justify-between text-[11px]">
                  <div className="flex-1 border-b border-black flex flex-col">
                    <div className="border-b border-black py-0.5 px-1 text-center font-bold">
                      Party Bill No
                    </div>
                    <div className="flex-1 flex items-start justify-center pt-1.5 px-1 text-center font-bold text-[12px]">
                      {master.payable_bill_no || ""}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="border-b border-black py-0.5 px-1 text-center font-bold">
                      Party Bill Date
                    </div>
                    <div className="flex-1 flex items-start justify-center pt-1.5 px-1 text-center font-bold text-[12px]">
                      {partyBillDateDisplay}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 12: Material Details Table (Cols B to L -> 11 Columns) */}
              <table className="w-full text-[11px] table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "14%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-black bg-white text-black font-bold text-[11px] leading-tight">
                    <th className="py-1 px-1 text-left align-bottom bg-white border-0">
                      Grade
                    </th>
                    <th className="py-1 px-1 text-left align-bottom bg-white border-0">
                      Marka
                    </th>
                    <th className="py-1 px-1 text-right align-bottom bg-white border-0">
                      Quantity
                    </th>
                    <th className="py-1 px-1 text-left align-bottom bg-white border-0">
                      Unit
                    </th>
                    <th className="py-1 px-1 text-right align-bottom leading-tight bg-white border-0">
                      <div>P.O</div>
                      <div>Rate</div>
                    </th>
                    <th className="py-1 px-1 text-left align-bottom bg-white border-0">
                      Type
                    </th>
                    <th className="py-1 px-1 text-right align-bottom bg-white border-0">
                      Claim
                    </th>
                    <th className="py-1 px-1 text-right align-bottom bg-white border-0">
                      Sett.
                    </th>
                    <th className="py-1 px-1 text-right align-bottom leading-tight bg-white border-0">
                      <div>Rate</div>
                      <div>(+/-)</div>
                    </th>
                    <th className="py-1 px-1 text-right align-bottom leading-tight bg-white border-0">
                      <div>Sett.</div>
                      <div>Rate</div>
                    </th>
                    <th className="py-1 px-1 text-right align-bottom bg-white border-0">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="text-[11px] leading-[1.3]">
                  {activeDetails.map((col, idx) => {
                    const rawGrade = resolveGradeName(col.grade || "").trim();
                    const gradeDisplay =
                      rawGrade && !rawGrade.endsWith(".")
                        ? `${rawGrade}.`
                        : rawGrade || "-";

                    const markaDisplay = (col.marka_crop || "")
                      .split("/")[0]
                      .trim();
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
                            (Number(master.val_premium_amt) / (wtMt * 10)).toFixed(
                              2
                            )
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

                    const cell = "py-0 px-1 border-0 align-top";

                    return (
                      <React.Fragment key={idx}>
                        {/* Row 1: Main details + Grd.Down */}
                        <tr className="border-0">
                          <td className={`${cell} pt-1 font-bold text-left`}>
                            {gradeDisplay}
                          </td>
                          <td className={`${cell} pt-1 uppercase text-left`}>
                            {markaDisplay}
                          </td>
                          <td className={`${cell} pt-1 text-right`}>
                            {qtyBales}
                          </td>
                          <td className={`${cell} pt-1 text-left uppercase`}>
                            {unitDisplay}
                          </td>
                          <td className={`${cell} pt-1 text-right`}>{poRate}</td>
                          <td className={`${cell} pt-1 text-right font-bold`}>
                            Grd.Down:
                          </td>
                          <td className={`${cell} pt-1 text-right`}>
                            {gdClaim > 0 ? gdClaim : ""}
                          </td>
                          <td className={`${cell} pt-1 text-right`}>
                            {gdSett > 0 ? gdSett : ""}
                          </td>
                          <td className={`${cell} pt-1 text-right`}>
                            {gdRateAdj}
                          </td>
                          <td className={`${cell} pt-1 text-right`}>
                            {settRate}
                          </td>
                          <td className={`${cell} pt-1 text-right`}>
                            {colValue.toFixed(2)}
                          </td>
                        </tr>

                        {/* Row 2: Weight in Kgs & Moisture */}
                        <tr className="border-0">
                          <td className={cell}></td>
                          <td className={cell}></td>
                          <td className={`${cell} text-right`}>{wtKgs}</td>
                          <td className={`${cell} text-left`}>Kgs</td>
                          <td className={cell}></td>
                          <td className={`${cell} text-right font-bold`}>
                            Moisture:
                          </td>
                          <td className={`${cell} text-right`}>
                            {moistClaim > 0 ? moistClaim : ""}
                          </td>
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
                          <td className={`${cell} text-right font-bold`}>
                            Premium:
                          </td>
                          <td className={cell}></td>
                          <td className={cell}></td>
                          <td className={`${cell} text-right`}>
                            <div className="border-b border-black inline-block min-w-[46px] text-right">
                              {premVal}
                            </div>
                          </td>
                          <td className={cell}></td>
                          <td className={cell}></td>
                        </tr>

                        {/* Row 4: Total Rate Adjustment */}
                        <tr className="border-b border-black">
                          <td className={`${cell} pb-1`}></td>
                          <td className={`${cell} pb-1`}></td>
                          <td className={`${cell} pb-1`}></td>
                          <td className={`${cell} pb-1`}></td>
                          <td className={`${cell} pb-1`}></td>
                          <td className={`${cell} pb-1 text-right font-bold`}>
                            Total:
                          </td>
                          <td className={`${cell} pb-1`}></td>
                          <td className={`${cell} pb-1`}></td>
                          <td className={`${cell} pb-1 text-right`}>
                            {netRateAdj}
                          </td>
                          <td className={`${cell} pb-1`}></td>
                          <td className={`${cell} pb-1`}></td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* Row 34: Miscellaneous Charges Section */}
              <div className="px-2 py-2 text-[11px] min-h-[75px]">
                <div className="text-center font-bold text-[11.5px] mb-1.5">
                  Miscellaneous Charges
                </div>

                <div className="space-y-0.5 text-[11px]">
                  {inspectionDedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-baseline"
                    >
                      <div className="w-[40%] uppercase">{item.type}</div>
                      <div className="w-[15%] text-right">
                        {item.qtyKgs} Kgs.
                      </div>
                      <div className="w-[15%] text-right">@Rs.{item.rate}</div>
                      <div className="w-[18%] text-center">Less per Quintal</div>
                      <div className="w-[12%] text-right">
                        -{item.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}

                  {settlementApmcDiff > 0 && (
                    <div className="flex justify-between items-baseline">
                      <div className="w-[88%]">
                        Miscellaneous Deduction M.R. value (Total-{actualApmc}
                        ,Challan-{challanApmc},Settlement-{settlementApmcDiff})
                      </div>
                      <div className="w-[12%] text-right">
                        -{settlementApmcDiff.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {miscAdd > 0 && (
                    <div className="flex justify-between items-baseline">
                      <div className="w-[88%]">Miscellaneous Addition (+)</div>
                      <div className="w-[12%] text-right">
                        +{miscAdd.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Summary Section (Rows 43 to 52 of Template) */}
            <div className="border-t border-black text-[11px]">
              {/* Row 43: Remarks :- */}
              <div className="border-b border-black px-2 py-1 text-[11.5px] font-bold">
                Remarks :- {master.remarks || ""}
              </div>

              {/* Split Left (Cols B..G) & Right (Cols H..L) Columns */}
              <div className="grid grid-cols-12">
                {/* Left Column: Note, On A/c Advance & Cheque Adjustments */}
                <div className="col-span-6 border-r border-black flex flex-col justify-between">
                  <div>
                    {/* Rows 44 to 46: Note, On A/c Total Advance, On A/c Total Adv. Adjusted */}
                    <div className="border-b border-black px-2 py-1.5 space-y-0.5">
                      <div className="underline font-bold">Note:</div>
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-7 font-bold">
                          On A/c Total Advance
                        </div>
                        <div className="col-span-2 font-bold">: Rs.</div>
                        <div className="col-span-3 text-right font-bold">
                          {formatIndAmount(onAcTotalAdv)}
                        </div>
                      </div>
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-7 font-bold">
                          On A/c Total Adv. Adjusted
                        </div>
                        <div className="col-span-2 font-bold">: Rs.</div>
                        <div className="col-span-3 text-right font-bold">
                          {formatIndAmount(onAcTotalAdvAdj)}
                        </div>
                      </div>
                    </div>

                    {/* Row 47: Balance Amount */}
                    <div className="border-b border-black px-2 py-1.5 grid grid-cols-12 items-baseline">
                      <div className="col-span-7 text-right pr-2 font-bold">
                        Balance Amount
                      </div>
                      <div className="col-span-2 font-bold">: Rs.</div>
                      <div className="col-span-3 text-right font-bold border-b border-black pb-0.5">
                        {formatIndAmount(onAcBalanceAmt)}
                      </div>
                    </div>

                    {/* Row 48: On A/c Adv. Adjustment Made Against This MR */}
                    <div className="border-b border-black px-1 py-1 text-center font-bold text-[11px]">
                      On A/c Adv. Adjustment Made Against This MR
                    </div>

                    {/* Row 49: Cheque No | Date | Adjusted Value */}
                    <div className="border-b border-black grid grid-cols-12 text-[11px] font-bold text-center">
                      <div className="col-span-4 border-r border-black py-0.5">
                        Cheque No
                      </div>
                      <div className="col-span-4 border-r border-black py-0.5">
                        Date
                      </div>
                      <div className="col-span-4 py-0.5">Adjusted Value</div>
                    </div>
                  </div>

                  {/* Rows 50 to 52: Cheque Adjustment Values with Vertical Lines */}
                  <div className="flex-1 min-h-[76px] grid grid-cols-12">
                    <div className="col-span-4 border-r border-black p-1 space-y-0.5">
                      {Array.isArray(master.cheque_adjustments) &&
                        master.cheque_adjustments.map((chk, cIdx) => (
                          <div key={cIdx} className="text-[10.5px] text-left">
                            {chk.cheque_no}
                          </div>
                        ))}
                    </div>
                    <div className="col-span-4 border-r border-black p-1 space-y-0.5">
                      {Array.isArray(master.cheque_adjustments) &&
                        master.cheque_adjustments.map((chk, cIdx) => (
                          <div key={cIdx} className="text-[10.5px] text-center">
                            {chk.date}
                          </div>
                        ))}
                    </div>
                    <div className="col-span-4 p-1 space-y-0.5">
                      {Array.isArray(master.cheque_adjustments) &&
                        master.cheque_adjustments.map((chk, cIdx) => (
                          <div key={cIdx} className="text-[10.5px] text-right">
                            {formatIndAmount(chk.adjusted_value)}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Financial Settlement Calculation Summary */}
                <div className="col-span-6 flex flex-col justify-between">
                  <div>
                    {/* Rows 44 to 46: Material Value, Material Misc(+), Material Misc(-) */}
                    <div className="border-b border-black px-2 py-1.5 space-y-0.5">
                      <div className="grid grid-cols-12 items-baseline font-bold">
                        <div className="col-span-1"></div>
                        <div className="col-span-6">Material Value</div>
                        <div className="col-span-1">:</div>
                        <div className="col-span-4 text-right">
                          {formatIndAmount(materialValue)}
                        </div>
                      </div>
                      <div className="grid grid-cols-12 items-baseline font-bold">
                        <div className="col-span-1"></div>
                        <div className="col-span-6">Material Misc(+)</div>
                        <div className="col-span-1">:</div>
                        <div className="col-span-4 text-right">
                          {formatIndAmount(miscAdd)}
                        </div>
                      </div>
                      <div className="grid grid-cols-12 items-baseline font-bold">
                        <div className="col-span-1"></div>
                        <div className="col-span-6">Material Misc(-)</div>
                        <div className="col-span-1">:</div>
                        <div className="col-span-4 text-right">
                          {formatIndAmount(miscLessTotal)}
                        </div>
                      </div>
                    </div>

                    {/* Rows 47 to 48: Total MR Amount & MR Advance Amount */}
                    <div className="border-b border-black px-2 py-1 space-y-0.5">
                      <div className="grid grid-cols-12 items-baseline font-bold">
                        <div className="col-span-1"></div>
                        <div className="col-span-6">Total MR Amount</div>
                        <div className="col-span-1">:</div>
                        <div className="col-span-4 text-right">
                          {formatIndAmount(totalMrAmount)}
                        </div>
                      </div>
                      <div className="grid grid-cols-12 items-baseline font-bold">
                        <div className="col-span-1"></div>
                        <div className="col-span-6">MR Advance Amount</div>
                        <div className="col-span-1">:</div>
                        <div className="col-span-4 text-right">
                          {formatIndAmount(effectiveAdvanceAmount)}
                        </div>
                      </div>
                    </div>

                    {/* Row 49: Balance Due(Rounded) */}
                    <div className="border-b border-black px-2 py-1 grid grid-cols-12 items-baseline font-bold">
                      <div className="col-span-1"></div>
                      <div className="col-span-6">Balance Due(Rounded)</div>
                      <div className="col-span-1">:</div>
                      <div className="col-span-4 text-right">
                        {formatIndAmount(effectiveBalanceDueRounded)}
                      </div>
                    </div>

                    {/* Row 50: On A/c Adv. Adjusted Amount : */}
                    <div className="border-b border-black px-2 py-1 grid grid-cols-12 items-baseline font-bold">
                      <div className="col-span-8">
                        On A/c Adv. Adjusted Amount :Rs.
                      </div>
                      <div className="col-span-4 text-right">
                        {formatIndAmount(onAcAdvAdjusted)}
                      </div>
                    </div>
                  </div>

                  {/* Rows 51 to 52: Net Amount to be Paid & Words */}
                  <div className="px-2 py-1.5 flex-1 flex flex-col justify-between min-h-[60px]">
                    <div className="grid grid-cols-12 items-baseline font-bold">
                      <div className="col-span-1"></div>
                      <div className="col-span-6">Net Amount to be Paid</div>
                      <div className="col-span-1">:Rs.</div>
                      <div className="col-span-4 text-right">
                        {formatIndAmount(effectiveNetAmountToBePaid)}
                      </div>
                    </div>

                    <div className="pt-1.5 text-[10px] leading-snug font-bold flex items-start">
                      <span className="whitespace-nowrap mr-1.5">Rs. :</span>
                      <span>
                        {numberToIndianWords(effectiveNetAmountToBePaid)} ONLY
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 57: Signature Footer Outside/Below Main Box */}
        <div className="pt-5 pb-1 px-4 flex justify-between items-end text-[12px] font-bold">
          <div>
            <u className="inline-block">Prepared by</u>
          </div>
          <div>
            <u className="inline-block">Checked by</u>
          </div>
          <div>
            <u className="inline-block">Authorised Signatory</u>
          </div>
        </div>
      </div>
    </PrintModal>
  );
};

export default SettlementPrintModal;

