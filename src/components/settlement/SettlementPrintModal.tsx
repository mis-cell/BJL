import React, { useState, useEffect, useRef, useMemo } from "react";
import { jsPDF } from "jspdf";
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

// Canonical fallback matching /public/templates/settlement_template.csv & /public/assets/aistudio/templest_a48a2340.csv
const DEFAULT_SETTLEMENT_TEMPLATE_CSV = `BALLY JUTE COMPANY LIMITED,,,,,,,,,,,,,,,,,,,,,,
,  Powered by KatEye™,,,"Printed On : 28/10/26 by ADMIN, No of Times Printed - THREE       ",,,,,,,,,,,,,,,,,,
,  MR No.,,:,,,Date,:,,,Party Bill No,,,,,,,,,,,,
 ,  Supplier,,:,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,  Broker,,:,,,,,,,,,,,,,,,,,,,
,  Order No,,:,,,Date,:,,,Party Bill Date,,,,,,,,,,,,
,  Area/Agency,,:,,,,,,,,,,,,,,,,,,,
,  Consign No.,,:,,,,,,,,,,,,,,,,,,,
,  Way Bill,,:,,,,,,,,,,,,,,,,,,,
,  Pan No.,,:,,,,,,,,,,,,,,,,,,,
,Grade,Marka,Quantity,Unit,"P.O
Rate",Type,Claim,Sett.,"Rate
(+/-)","Sett.
Rate",Value,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,Grd.Down:,,,,,,,,,,,,,,,,
,,,,,,Moisture:,,,,,,,,,,,,,,,,
,,,,,,Premium:,,,,,,,,,,,,,,,,
,,,,,,Total:,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,Miscellaneous Charges,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,  Remarks :-,,,,,,,,,,,,,,,,,,,,,
,  Note:,,,,,,  Material Value,,,:,,,,,,,,,,,,
,  On A/c Total Advance,,,,: Rs.   0.00,,  Material Misc(+),,,:,,,,,,,,,,,,
,  On A/c Total Adv. Adjusted,,,,: Rs.   0.00,,  Material Misc(-),,,:,,,,,,,,,,,,
,  Balance Amount,,,,: Rs.   0.00,,  Total MR Amount,,,:,,,,,,,,,,,,
,On A/c Adv. Adjustment Made Against This MR,,,,,,MR Advance Amount,,,:,,,,,,,,,,,,
,Cheque No,,Date,,Adjusted Value,, Balance Due(Rounded),,,:,0,,,,,,,,,,,
,,,,,,, On A/c Adv. Adjusted Amount :,,,,0,,,,,,,,,,,
,,,,,,,Net Amount to be Paid,,,:,,,,,,,,,,,,
,,,,,,,Rs. :  EIGHTEEN LAKH FIFTY THOUSAND NINE HUNDRED FORTY THREE ONLY,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,
,Prepared by,,,,,Checked by,,,,Authorised Signatory,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,`;

function parseCsvToGrid(csvText: string, minRows = 58, minCols = 23): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  const cleanText = csvText.replace(/^\uFEFF/, "");

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    const nextCh = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"' && nextCh === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (ch === "\r" && nextCh === "\n") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
        i++;
      } else if (ch === "\n" || ch === "\r") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  while (rows.length < minRows) {
    rows.push(Array(minCols).fill(""));
  }

  return rows.map((r) => {
    const copy = [...r];
    while (copy.length < minCols) copy.push("");
    return copy;
  });
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
  const [rawTemplateCsv, setRawTemplateCsv] = useState<string>(DEFAULT_SETTLEMENT_TEMPLATE_CSV);
  const [viewMode, setViewMode] = useState<"pdf" | "sheet">("pdf");
  const isPrintingRef = useRef(false);
  const pdfIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Load the saved CSV template file from /templates/settlement_template.csv or /assets/aistudio/templest_a48a2340.csv
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const loadTemplateFile = async () => {
      const paths = [
        "/templates/settlement_template.csv",
        "/assets/aistudio/templest_a48a2340.csv",
      ];
      for (const path of paths) {
        try {
          const res = await fetch(path, { cache: "no-store" });
          if (res.ok) {
            const text = await res.text();
            if (text && text.includes("BALLY JUTE COMPANY LIMITED") && active) {
              setRawTemplateCsv(text);
              return;
            }
          }
        } catch {
          // continue to fallback
        }
      }
    };
    loadTemplateFile();
    return () => {
      active = false;
    };
  }, [isOpen]);

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

  const master = viewModalData?.master || ({} as SettlementMaster);
  const details = viewModalData?.details || [];

  const activeDetails = useMemo(
    () =>
      details.filter(
        (c) =>
          (Number(c.quantity) > 0 || Number(c.arr_qty_wt) > 0 || Number(c.rate_value) > 0) &&
          getColWtMt(c) > 0
      ),
    [details]
  );

  const printNow = new Date();
  const todaySlash = `${String(printNow.getDate()).padStart(2, "0")}/${String(printNow.getMonth() + 1).padStart(2, "0")}/${String(printNow.getFullYear()).slice(-2)}`;
  const printedByDisplay = resolveLoggedInPrintUserName();

  const targetPrintNum = persistedPrintCount + 1;
  const printCountWord = countToEnglishWord(targetPrintNum);

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

  // Build the populated 55x23 logical CSV grid directly from the loaded CSV template
  // Note: Logical CSV Row 12 contains 3 embedded newlines ("P.O\nRate", "Rate\n(+/-)", "Sett.\nRate"),
  // so logical row indices after Row 12 are 3 less than physical file line numbers:
  //   Row 12: Table Header
  //   Rows 13..30: Grade items area (18 rows -> up to 4 grade blocks x 4 rows)
  //   Row 31: Miscellaneous Charges header
  //   Rows 32..39: Miscellaneous Charges items (8 rows)
  //   Row 40: Remarks :-
  //   Row 41: Note: | Material Value
  //   Row 42: On A/c Total Advance | Material Misc(+)
  //   Row 43: On A/c Total Adv. Adjusted | Material Misc(-)
  //   Row 44: Balance Amount | Total MR Amount
  //   Row 45: On A/c Adv. Adjustment Made Against This MR | MR Advance Amount
  //   Row 46: Cheque No / Date / Adjusted Value | Balance Due(Rounded)
  //   Row 47: (Cheque Row 1) | On A/c Adv. Adjusted Amount :
  //   Row 48: (Cheque Row 2) | Net Amount to be Paid
  //   Row 49: (Cheque Row 3) | Rs. : <AMOUNT IN WORDS> ONLY
  //   Row 54: Prepared by | Checked by | Authorised Signatory
  const populatedGrid = useMemo(() => {
    const grid = parseCsvToGrid(rawTemplateCsv, 56, 23);
    const setCell = (r1Based: number, c0Based: number, val: string | number) => {
      if (r1Based >= 1 && r1Based <= grid.length && c0Based >= 0 && c0Based < grid[0].length) {
        grid[r1Based - 1][c0Based] = String(val ?? "");
      }
    };

    // Row 1: Company Title
    if (master.unit_name) {
      setCell(1, 0, master.unit_name);
    }

    // Row 2: Printed On metadata
    setCell(
      2,
      4,
      `Printed On : ${todaySlash} by ${printedByDisplay}, No of Times Printed - ${printCountWord}`
    );

    // Row 3: MR No. & Date
    setCell(3, 4, master.mr_no || "");
    setCell(3, 8, mrDateDisplay);

    // Row 4: Supplier & Party Bill No value
    setCell(4, 4, (master.supplier || "").toUpperCase());
    setCell(4, 10, master.payable_bill_no || "");

    // Row 5: Supplier Address
    setCell(5, 4, String((master as any).supplier_address || "").toUpperCase());

    // Row 6: Broker
    setCell(6, 4, (master.broker || master.supplier || "").toUpperCase());

    // Row 7: Order No & Date
    setCell(7, 4, master.po_no || "");
    setCell(7, 8, poDateDisplay);

    // Row 8: Area/Agency & Party Bill Date value
    setCell(8, 4, areaAgencyDisplay);
    setCell(8, 10, partyBillDateDisplay);

    // Row 9: Consign No.
    setCell(9, 4, consignNoDisplay);

    // Row 10: Way Bill
    setCell(10, 4, master.way_bill || "");

    // Row 11: Pan No.
    setCell(11, 4, master.pan_no || "");

    // Clear default template placeholder rows 13..30 before populating grade items
    for (let r = 13; r <= 30; r++) {
      for (let c = 0; c < 23; c++) {
        setCell(r, c, "");
      }
    }

    // Populate Grade items (4 rows per grade item starting at logical Row 14)
    activeDetails.forEach((col, idx) => {
      const baseRow = 14 + idx * 4;
      if (baseRow + 3 > 30) return;
      const rawGrade = resolveGradeName(col.grade || "").trim();
      const gradeDisplay =
        rawGrade && !rawGrade.endsWith(".") ? `${rawGrade}.` : rawGrade || "-";
      const markaDisplay = (col.marka_crop || "").split("/")[0].trim();
      const qtyBales = Number(col.quantity) || 0;
      const wtMt = getColWtMt(col);
      const wtKgs = Math.round(wtMt * 1000);
      const unitDisplay = (col.unit || "BALES").toUpperCase();
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

      setCell(baseRow, 1, gradeDisplay);
      setCell(baseRow, 2, markaDisplay);
      setCell(baseRow, 3, qtyBales);
      setCell(baseRow, 4, unitDisplay);
      setCell(baseRow, 5, poRate);
      setCell(baseRow, 6, "Grd.Down:");
      setCell(baseRow, 7, gdClaim > 0 ? gdClaim : "");
      setCell(baseRow, 8, gdSett > 0 ? gdSett : "");
      setCell(baseRow, 9, gdRateAdj);
      setCell(baseRow, 10, settRate);
      setCell(baseRow, 11, colValue.toFixed(2));

      setCell(baseRow + 1, 3, wtKgs);
      setCell(baseRow + 1, 4, "Kgs");
      setCell(baseRow + 1, 6, "Moisture:");
      setCell(baseRow + 1, 7, moistClaim > 0 ? moistClaim : "");

      setCell(baseRow + 2, 6, "Premium:");
      setCell(baseRow + 2, 9, premVal);

      setCell(baseRow + 3, 6, "Total:");
      setCell(baseRow + 3, 9, netRateAdj);
    });

    // Clear logical rows 32..39 before populating Miscellaneous Charges items
    for (let r = 32; r <= 39; r++) {
      for (let c = 0; c < 23; c++) {
        setCell(r, c, "");
      }
    }

    // Logical Rows 32..39: Miscellaneous Charges items
    let miscRowCursor = 32;
    inspectionDedItems.forEach((item) => {
      if (miscRowCursor <= 38) {
        setCell(miscRowCursor, 1, item.type);
        setCell(miscRowCursor, 5, `${item.qtyKgs} Kgs.`);
        setCell(miscRowCursor, 7, `@Rs.${item.rate}`);
        setCell(miscRowCursor, 9, "Less per Quintal");
        setCell(miscRowCursor, 11, `-${item.amount.toFixed(2)}`);
        miscRowCursor++;
      }
    });
    if (settlementApmcDiff > 0 && miscRowCursor <= 39) {
      setCell(
        miscRowCursor,
        1,
        `Miscellaneous Deduction M.R. value (Total-${actualApmc},Challan-${challanApmc},Settlement-${settlementApmcDiff})`
      );
      setCell(miscRowCursor, 11, `-${settlementApmcDiff.toFixed(2)}`);
      miscRowCursor++;
    }
    if (miscAdd > 0 && miscRowCursor <= 39) {
      setCell(miscRowCursor, 1, "Miscellaneous Addition (+)");
      setCell(miscRowCursor, 11, `+${miscAdd.toFixed(2)}`);
    }

    // Logical Row 40: Remarks :-
    setCell(40, 1, `  Remarks :- ${master.remarks || ""}`);

    // Logical Rows 41..49: Summary & Note values
    setCell(41, 11, formatIndAmount(materialValue));
    setCell(42, 5, `: Rs.   ${formatIndAmount(onAcTotalAdv)}`);
    setCell(42, 11, formatIndAmount(miscAdd));
    setCell(43, 5, `: Rs.   ${formatIndAmount(onAcTotalAdvAdj)}`);
    setCell(43, 11, formatIndAmount(miscLessTotal));
    setCell(44, 5, `: Rs.   ${formatIndAmount(onAcBalanceAmt)}`);
    setCell(44, 11, formatIndAmount(totalMrAmount));
    setCell(45, 11, formatIndAmount(effectiveAdvanceAmount));
    setCell(46, 11, formatIndAmount(effectiveBalanceDueRounded));
    setCell(47, 11, formatIndAmount(onAcAdvAdjusted));
    setCell(48, 11, formatIndAmount(effectiveNetAmountToBePaid));
    setCell(
      49,
      7,
      `Rs. :  ${numberToIndianWords(effectiveNetAmountToBePaid)} ONLY`
    );

    if (Array.isArray(master.cheque_adjustments)) {
      master.cheque_adjustments.slice(0, 3).forEach((chk, cIdx) => {
        setCell(47 + cIdx, 1, chk.cheque_no || "");
        setCell(47 + cIdx, 3, chk.date || "");
        setCell(47 + cIdx, 5, formatIndAmount(chk.adjusted_value));
      });
    }

    return grid;
  }, [
    rawTemplateCsv,
    master,
    activeDetails,
    todaySlash,
    printedByDisplay,
    printCountWord,
    mrDateDisplay,
    poDateDisplay,
    partyBillDateDisplay,
    areaAgencyDisplay,
    consignNoDisplay,
    inspectionDedItems,
    settlementApmcDiff,
    actualApmc,
    challanApmc,
    miscAdd,
    materialValue,
    onAcTotalAdv,
    onAcTotalAdvAdj,
    miscLessTotal,
    onAcBalanceAmt,
    totalMrAmount,
    effectiveAdvanceAmount,
    effectiveBalanceDueRounded,
    onAcAdvAdjusted,
    effectiveNetAmountToBePaid,
    resolveGradeName,
  ]);

  // Generate a 1-page A4 vector PDF matching /public/assets/aistudio/Templest_pdf_b9e41bd0.pdf same-to-same
  const buildPdfDocument = (withAutoPrint = false): jsPDF => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const cell = (r1: number, c0: number) =>
      (populatedGrid[r1 - 1]?.[c0] || "").trim();

    const L = 8.5; // Left margin (mm) matching Templest_pdf_b9e41bd0.pdf
    const R = 201.5; // Right margin (mm)
    const W = R - L; // 193mm width

    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.32);

    // Row 1: Company Title (Centered Bold Serif)
    doc.setFont("times", "bold");
    doc.setFontSize(13.5);
    doc.text(cell(1, 0) || "BALLY JUTE COMPANY LIMITED", 105, 10.5, {
      align: "center",
    });

    // Row 2: Powered by KatEye™ (Left Bold-Italic Serif) & Printed On (Right Bold Sans-Serif)
    doc.setFont("times", "bolditalic");
    doc.setFontSize(9.5);
    doc.text(cell(2, 1) || "Powered by KatEye™", L + 1.5, 17.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.text(cell(2, 4), R - 1, 17.5, { align: "right" });

    // Outer Main Frame Box: y = 19.2mm to y = 260.0mm
    const boxTop = 19.2;
    const boxBottom = 260.0;
    doc.rect(L, boxTop, W, boxBottom - boxTop);

    // Master Header Section (Rows 3 to 11): y = 19.2mm to y = 63.8mm
    const headerBottom = 63.8;
    const splitX = 158.0; // Vertical divider for Party Bill No / Party Bill Date
    doc.line(L, headerBottom, R, headerBottom);
    doc.line(splitX, boxTop, splitX, headerBottom);

    // Left Master Details (Rows 3 to 11)
    const labelX = L + 2.2;
    const colonX = L + 31.5;
    const valX = L + 34.5;
    const dateLabelX = L + 85.0;
    const dateColonX = L + 107.0;
    const dateValX = L + 110.0;

    const headerRows = [
      { r: 3, y: 23.0, hasDate: true },
      { r: 4, y: 27.9, hasDate: false },
      { r: 5, y: 32.8, hasDate: false, isAddress: true },
      { r: 6, y: 37.7, hasDate: false },
      { r: 7, y: 42.6, hasDate: true },
      { r: 8, y: 47.5, hasDate: false },
      { r: 9, y: 52.4, hasDate: false },
      { r: 10, y: 57.3, hasDate: false },
      { r: 11, y: 62.2, hasDate: false },
    ];

    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    headerRows.forEach(({ r, y, hasDate, isAddress }) => {
      if (isAddress) {
        const addr = cell(r, 4);
        if (addr) {
          doc.setFont("times", "normal");
          doc.text(addr, valX, y);
        }
        return;
      }
      const lbl = cell(r, 1);
      const val = cell(r, 4);
      doc.setFont("times", "bold");
      doc.text(lbl, labelX, y);
      doc.text(":", colonX, y);
      doc.setFont("times", "bold");
      doc.text(val, valX, y);

      if (hasDate) {
        const dLbl = cell(r, 6) || "Date";
        const dVal = cell(r, 8);
        doc.setFont("times", "bold");
        doc.text(dLbl, dateLabelX, y);
        doc.text(":", dateColonX, y);
        doc.text(dVal, dateValX, y);
      }
    });

    // Right Split Box: Party Bill No (Row 3..6) & Party Bill Date (Row 7..11)
    const partyBillNoHeaderBottom = 24.3;
    const partyMidY = 39.2;
    const partyBillDateHeaderBottom = 44.3;
    const partyBoxCenter = (splitX + R) / 2;

    doc.line(splitX, partyBillNoHeaderBottom, R, partyBillNoHeaderBottom);
    doc.line(splitX, partyMidY, R, partyMidY);
    doc.line(splitX, partyBillDateHeaderBottom, R, partyBillDateHeaderBottom);

    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    doc.text(cell(3, 10) || "Party Bill No", partyBoxCenter, 23.0, {
      align: "center",
    });
    doc.text(cell(4, 10), partyBoxCenter, 31.5, { align: "center" });

    doc.text(cell(7, 10) || "Party Bill Date", partyBoxCenter, 43.0, {
      align: "center",
    });
    doc.text(cell(8, 10), partyBoxCenter, 52.0, {
      align: "center",
    });

    // Row 12: Table Header (pure white background, NO vertical lines)
    const tblHeaderBottom = 74.2;
    doc.line(L, tblHeaderBottom, R, tblHeaderBottom);

    // Well-spaced X-coordinates matching Templest_pdf_b9e41bd0.pdf so Sett. Rate and Value never touch
    const colX = {
      grade: L + 1.0, // Left
      marka: L + 16.5, // Left
      qtyHdr: L + 33.0, // Left header
      qtyVal: L + 48.0, // Right numeric
      unit: L + 51.5, // Left
      poRateHdr: L + 68.0, // Left header
      poRateVal: L + 79.0, // Right numeric
      type: L + 86.5, // Left ("Type", "Grd.Down:", "Moisture:", "Premium:", "Total:")
      claimHdr: L + 108.5, // Left header
      claimVal: L + 118.0, // Right numeric
      settHdr: L + 122.0, // Left header
      settVal: L + 131.0, // Right numeric
      rateAdjHdr: L + 136.0, // Left header
      rateAdjVal: L + 146.0, // Right numeric
      settRateHdr: L + 151.0, // Left header
      settRateVal: L + 163.0, // Right numeric (37mm away from right edge!)
      valueHdr: L + 173.0, // Left header
      valueVal: R - 1.5, // Right numeric (200.0mm)
    };

    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    // Multi-line headers first row
    doc.text("P.O", colX.poRateHdr, 68.3);
    doc.text("Rate", colX.rateAdjHdr, 68.3);
    doc.text("Sett.", colX.settRateHdr, 68.3);

    // Bottom-aligned header row
    doc.text("Grade", colX.grade, 72.8);
    doc.text("Marka", colX.marka, 72.8);
    doc.text("Quantity", colX.qtyHdr, 72.8);
    doc.text("Unit", colX.unit, 72.8);
    doc.text("Rate", colX.poRateHdr, 72.8);
    doc.text("Type", colX.type, 72.8);
    doc.text("Claim", colX.claimHdr, 72.8);
    doc.text("Sett.", colX.settHdr, 72.8);
    doc.text("(+/-)", colX.rateAdjHdr, 72.8);
    doc.text("Rate", colX.settRateHdr, 72.8);
    doc.text("Value", colX.valueHdr, 72.8);

    // Logical Rows 14..30: Grade items (4 lines per grade, matching Templest_pdf_b9e41bd0.pdf)
    let curY = tblHeaderBottom + 4.2;
    const itemCount = Math.min(activeDetails.length, 4);
    const rowStep = 4.6;

    if (itemCount === 0) {
      // If no active details, show the template default labels (Grd.Down:, Moisture:, Premium:, Total:)
      doc.setFont("times", "normal");
      doc.setFontSize(9);
      doc.text("Grd.Down:", colX.type, curY);
      doc.text("Moisture:", colX.type, curY + rowStep);
      doc.text("Premium:", colX.type, curY + rowStep * 2);
      doc.text("Total:", colX.type, curY + rowStep * 3);
    } else {
      for (let idx = 0; idx < itemCount; idx++) {
        const baseRow = 14 + idx * 4;

        // Line 1: Grade, Marka, Qty, Unit, PO Rate, Grd.Down:, Claim, Sett., Rate(+/-), Sett.Rate, Value
        doc.setFont("times", "bold");
        doc.setFontSize(9.2);
        doc.text(cell(baseRow, 1), colX.grade, curY);
        doc.setFont("times", "normal");
        doc.text(cell(baseRow, 2), colX.marka, curY);
        doc.text(cell(baseRow, 3), colX.qtyVal, curY, { align: "right" });
        doc.text(cell(baseRow, 4), colX.unit, curY);
        doc.text(cell(baseRow, 5), colX.poRateVal, curY, { align: "right" });
        doc.text(cell(baseRow, 6) || "Grd.Down:", colX.type, curY);
        if (cell(baseRow, 7)) {
          doc.text(cell(baseRow, 7), colX.claimVal, curY, { align: "right" });
        }
        if (cell(baseRow, 8)) {
          doc.text(cell(baseRow, 8), colX.settVal, curY, { align: "right" });
        }
        doc.text(cell(baseRow, 9), colX.rateAdjVal, curY, { align: "right" });
        doc.text(cell(baseRow, 10), colX.settRateVal, curY, { align: "right" });
        doc.text(cell(baseRow, 11), colX.valueVal, curY, { align: "right" });

        // Line 2: Weight in Kgs & Moisture:
        curY += rowStep;
        doc.text(cell(baseRow + 1, 3), colX.qtyVal, curY, { align: "right" });
        doc.text(cell(baseRow + 1, 4) || "Kgs", colX.unit, curY);
        doc.text(cell(baseRow + 1, 6) || "Moisture:", colX.type, curY);
        if (cell(baseRow + 1, 7)) {
          doc.text(cell(baseRow + 1, 7), colX.claimVal, curY, { align: "right" });
        }

        // Line 3: Premium:
        curY += rowStep;
        doc.text(cell(baseRow + 2, 6) || "Premium:", colX.type, curY);
        doc.text(cell(baseRow + 2, 9), colX.rateAdjVal, curY, { align: "right" });
        doc.line(colX.rateAdjVal - 11, curY + 0.9, colX.rateAdjVal, curY + 0.9);

        // Line 4: Total:
        curY += rowStep;
        doc.text(cell(baseRow + 3, 6) || "Total:", colX.type, curY);
        doc.text(cell(baseRow + 3, 9), colX.rateAdjVal, curY, { align: "right" });

        curY += rowStep + 1.5;
      }
    }

    // Logical Row 31: Miscellaneous Charges Section (Fixed top line at y = 154.5mm matching Templest_pdf_b9e41bd0.pdf)
    const miscTopLineY = 154.5;
    doc.line(L, miscTopLineY, R, miscTopLineY);

    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    doc.text(cell(31, 1) || "Miscellaneous Charges", 105, miscTopLineY + 4.5, {
      align: "center",
    });

    // Logical Rows 32..39: Miscellaneous Charges items
    let miscY = miscTopLineY + 9.5;
    doc.setFont("times", "normal");
    doc.setFontSize(9.0);
    for (let r = 32; r <= 39; r++) {
      const desc = cell(r, 1);
      const amt = cell(r, 11);
      if (!desc && !amt) continue;
      const qtyStr = cell(r, 5);
      const rateStr = cell(r, 7);
      const perStr = cell(r, 9);

      doc.text(desc, L + 2.2, miscY);
      if (qtyStr) doc.text(qtyStr, L + 90, miscY, { align: "right" });
      if (rateStr) doc.text(rateStr, L + 118, miscY, { align: "right" });
      if (perStr) doc.text(perStr, L + 152, miscY, { align: "right" });
      if (amt) doc.text(amt, R - 1.5, miscY, { align: "right" });
      miscY += 4.5;
    }

    // Logical Row 40: Remarks Band (y = 201.5mm to 209.2mm matching Templest_pdf_b9e41bd0.pdf)
    const remarksTop = 201.5;
    const remarksBottom = 209.2;
    doc.line(L, remarksTop, R, remarksTop);
    doc.line(L, remarksBottom, R, remarksBottom);
    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    doc.text(cell(40, 1) || "Remarks :-", L + 2.2, remarksTop + 5.5);

    // Logical Rows 41..49: Bottom Split Box (y = 209.2mm to 260.0mm)
    const midX = 113.5; // Vertical divider between Left Note/Cheque box and Right Summary box
    doc.line(midX, remarksBottom, midX, boxBottom);

    // Horizontal lines inside Bottom Split Box matching Templest_pdf_b9e41bd0.pdf:
    const line1Y = 223.8; // Full line across L..R (below On A/c Total Adv. Adjusted & Material Misc(-))
    const line2LeftY = 228.8; // Left-half line across L..midX (below Balance Amount)
    const line3Y = 233.8; // Full line across L..R (below On A/c Adv. Adjustment Made Against This MR & MR Advance Amount)
    const line4Y = 239.0; // Full line across L..R (below Cheque No / Date / Adjusted Value & Balance Due(Rounded))
    const line5RightY = 244.0; // Right-half line across midX..R (below On A/c Adv. Adjusted Amount :)

    doc.line(L, line1Y, R, line1Y);
    doc.line(L, line2LeftY, midX, line2LeftY);
    doc.line(L, line3Y, R, line3Y);
    doc.line(L, line4Y, R, line4Y);
    doc.line(midX, line5RightY, R, line5RightY);

    // Left Half (Logical Rows 41..49)
    doc.setFont("times", "bold");
    doc.setFontSize(9.5);

    // Logical Row 41: Note:
    const noteLbl = cell(41, 1) || "Note:";
    doc.text(noteLbl, L + 2.2, 213.0);
    doc.line(L + 2.2, 213.6, L + 11.2, 213.6); // Underline Note:

    // Logical Row 42: On A/c Total Advance
    doc.text(cell(42, 1) || "On A/c Total Advance", L + 2.2, 218.0);
    doc.text(": Rs.", L + 67.5, 218.0);
    doc.text(formatIndAmount(onAcTotalAdv), L + 83.0, 218.0, {
      align: "right",
    });

    // Logical Row 43: On A/c Total Adv. Adjusted
    doc.text(cell(43, 1) || "On A/c Total Adv. Adjusted", L + 2.2, 222.5);
    doc.text(": Rs.", L + 67.5, 222.5);
    doc.text(formatIndAmount(onAcTotalAdvAdj), L + 83.0, 222.5, {
      align: "right",
    });

    // Logical Row 44: Balance Amount (left-aligned at L + 2.2 matching Templest_pdf_b9e41bd0.pdf)
    doc.text("Balance Amount", L + 2.2, 227.5);
    doc.text(": Rs.", L + 67.5, 227.5);
    doc.text(formatIndAmount(onAcBalanceAmt), L + 83.0, 227.5, {
      align: "right",
    });

    // Logical Row 45: On A/c Adv. Adjustment Made Against This MR
    doc.text(
      cell(45, 1) || "On A/c Adv. Adjustment Made Against This MR",
      (L + midX) / 2,
      232.5,
      { align: "center" }
    );

    // Logical Row 46: Cheque No | Date | Adjusted Value (no vertical lines inside cheque box matching Templest_pdf_b9e41bd0.pdf)
    doc.text(cell(46, 1) || "Cheque No", L + 16.0, 237.6, {
      align: "center",
    });
    doc.text(cell(46, 3) || "Date", L + 49.0, 237.6, {
      align: "center",
    });
    doc.text(cell(46, 5) || "Adjusted Value", L + 85.0, 237.6, {
      align: "center",
    });

    // Cheque Adjustment rows (Logical Rows 47..49)
    doc.setFont("times", "normal");
    for (let cIdx = 0; cIdx < 3; cIdx++) {
      const rNum = 47 + cIdx;
      const cy = 243.5 + cIdx * 4.8;
      if (cell(rNum, 1)) {
        doc.text(cell(rNum, 1), L + 16.0, cy, { align: "center" });
      }
      if (cell(rNum, 3)) {
        doc.text(cell(rNum, 3), L + 49.0, cy, { align: "center" });
      }
      if (cell(rNum, 5)) {
        doc.text(cell(rNum, 5), L + 95.0, cy, { align: "right" });
      }
    }

    // Right Half (Logical Rows 41..49): Financial Summary
    const rLabelX = midX + 2.2;
    const rColonX = midX + 41.5;
    const rValX = R - 1.2;

    doc.setFont("times", "bold");
    doc.setFontSize(9.5);

    // Logical Row 41: Material Value
    doc.text(cell(41, 7) || "Material Value", rLabelX, 213.0);
    doc.text(":", rColonX, 213.0);
    doc.text(cell(41, 11), rValX, 213.0, { align: "right" });

    // Logical Row 42: Material Misc(+)
    doc.text(cell(42, 7) || "Material Misc(+)", rLabelX, 218.0);
    doc.text(":", rColonX, 218.0);
    doc.text(cell(42, 11), rValX, 218.0, { align: "right" });

    // Logical Row 43: Material Misc(-)
    doc.text(cell(43, 7) || "Material Misc(-)", rLabelX, 222.5);
    doc.text(":", rColonX, 222.5);
    doc.text(cell(43, 11), rValX, 222.5, { align: "right" });

    // Logical Row 44: Total MR Amount
    doc.text(cell(44, 7) || "Total MR Amount", rLabelX, 227.5);
    doc.text(":", rColonX, 227.5);
    doc.text(cell(44, 11), rValX, 227.5, { align: "right" });

    // Logical Row 45: MR Advance Amount
    doc.text(cell(45, 7) || "MR Advance Amount", rLabelX + 2.0, 232.5);
    doc.text(":", rColonX, 232.5);
    doc.text(cell(45, 11), rValX, 232.5, { align: "right" });

    // Logical Row 46: Balance Due(Rounded)
    doc.text(cell(46, 7) || "Balance Due(Rounded)", rLabelX + 1.0, 237.6);
    doc.text(":", rColonX, 237.6);
    doc.text(cell(46, 11), rValX, 237.6, { align: "right" });

    // Logical Row 47: On A/c Adv. Adjusted Amount :
    doc.text(cell(47, 7) || "On A/c Adv. Adjusted Amount :", rLabelX + 0.5, 242.6);
    doc.text(cell(47, 11), rValX, 242.6, { align: "right" });

    // Logical Row 48: Net Amount to be Paid
    doc.text(cell(48, 7) || "Net Amount to be Paid", rLabelX + 2.0, 247.8);
    doc.text(":", rColonX, 247.8);
    doc.text(cell(48, 11), rValX, 247.8, { align: "right" });

    // Logical Row 49: Amount in Words ("Rs. :  EIGHTEEN LAKH ... ONLY")
    const fullWords = numberToIndianWords(effectiveNetAmountToBePaid) + " ONLY";
    doc.setFont("times", "bold");
    doc.setFontSize(8.5);
    doc.text("Rs. :", midX + 0.8, 253.0);

    doc.setFontSize(7.0);
    const wrappedWords = doc.splitTextToSize(fullWords, R - (midX + 10.5));
    if (wrappedWords.length > 0) {
      doc.text(wrappedWords[0], midX + 9.2, 253.0);
    }
    if (wrappedWords.length > 1) {
      doc.text(wrappedWords.slice(1).join(" "), midX + 0.8, 258.2);
    }

    // Logical Row 54: Bottom Signatures (outside the main frame box at y = 278.5mm)
    const sigY = 278.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);

    const sig1 = cell(54, 1) || "Prepared by";
    const sig2 = cell(54, 6) || "Checked by";
    const sig3 = cell(54, 10) || "Authorised Signatory";

    doc.text(sig1, L + 7.0, sigY);
    const sig1W = doc.getTextWidth(sig1);
    doc.line(L + 7.0, sigY + 0.8, L + 7.0 + sig1W, sigY + 0.8);

    doc.text(sig2, 105.0, sigY, { align: "center" });
    const sig2W = doc.getTextWidth(sig2);
    doc.line(105.0 - sig2W / 2, sigY + 0.8, 105.0 + sig2W / 2, sigY + 0.8);

    doc.text(sig3, R - 7.0, sigY, { align: "right" });
    const sig3W = doc.getTextWidth(sig3);
    doc.line(R - 7.0 - sig3W, sigY + 0.8, R - 7.0, sigY + 0.8);

    if (withAutoPrint) {
      doc.autoPrint();
    }

    return doc;
  };

  // Generate PDF Blob URL and Base64 for live PDF preview, email attachment, and PDF printing
  const { pdfBlobUrl, pdfBase64 } = useMemo(() => {
    if (!isOpen || !viewModalData) {
      return { pdfBlobUrl: "", pdfBase64: "" };
    }
    try {
      const doc = buildPdfDocument(false);
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const dataUri = doc.output("datauristring");
      const base64 = dataUri.split(",")[1] || "";
      return { pdfBlobUrl: url, pdfBase64: base64 };
    } catch (err) {
      console.error("Failed to generate Settlement PDF from CSV template:", err);
      return { pdfBlobUrl: "", pdfBase64: "" };
    }
  }, [isOpen, viewModalData, populatedGrid]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  if (!isOpen || !viewModalData) return null;

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

  // Send the generated PDF directly to the printer
  const handleSendPdfToPrinter = async () => {
    try {
      // If the visible PDF iframe is loaded, trigger its native PDF print dialog directly
      if (pdfIframeRef.current?.contentWindow) {
        pdfIframeRef.current.contentWindow.focus();
        pdfIframeRef.current.contentWindow.print();
        return;
      }
    } catch {
      // Fallback below
    }

    try {
      const doc = buildPdfDocument(true);
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const printFrame = document.createElement("iframe");
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "1px";
      printFrame.style.height = "1px";
      printFrame.style.border = "0";
      printFrame.src = url;
      document.body.appendChild(printFrame);
      printFrame.onload = () => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch {
          window.print();
        }
        setTimeout(() => {
          document.body.removeChild(printFrame);
          URL.revokeObjectURL(url);
        }, 60000);
      };
    } catch {
      window.print();
    }
  };

  const handleDownloadPdf = () => {
    const doc = buildPdfDocument(false);
    const safeMr = (master.mr_no || "MR").replace(/[^a-zA-Z0-9_-]/g, "_");
    doc.save(`MR_Settlement_${safeMr}.pdf`);
  };

  const handleDownloadPopulatedCsv = () => {
    const escapeCsvField = (field: string) => {
      if (field.includes(",") || field.includes('"') || field.includes("\n")) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent =
      "\uFEFF" +
      populatedGrid.map((row) => row.map(escapeCsvField).join(",")).join("\r\n") +
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
      title={`MR SETTLEMENT PDF PREVIEW - ${master.mr_no || "N/A"}`}
      onPrint={handleInitiatePrint}
      customPrintHandler={handleSendPdfToPrinter}
      customPdfBase64={pdfBase64}
      showTip={false}
      hideActionBar={true}
    >
      {/* Embedded Live PDF Viewer (Screenshot 2 view + Close button) */}
      {pdfBlobUrl && (
        <div className="pdf-embed-container no-print w-full bg-[#323639] flex flex-col items-center">
          <iframe
            ref={pdfIframeRef}
            src={`${pdfBlobUrl}#toolbar=1&navpanes=0&view=FitH`}
            title={`Settlement PDF - ${master.mr_no || ""}`}
            onLoad={() => {
              try {
                const win = pdfIframeRef.current?.contentWindow;
                if (win) {
                  win.addEventListener("beforeprint", () => {
                    handleInitiatePrint();
                  });
                }
              } catch {
                // ignore cross-origin or browser restrictions
              }
            }}
            className="w-full h-[88vh] bg-white border-0"
          />
        </div>
      )}

      {/* Clean A4 Template Sheet (Used for Sheet View, Email HTML, and fallback print) */}
      <div
        id="print-modal-children-canvas"
        className={`${
          viewMode === "pdf" ? "hidden print:flex" : "flex"
        } bg-white text-black px-3 py-2 mx-auto w-full max-w-[193mm] min-h-[275mm] flex-col justify-between text-[12px] leading-tight select-text`}
        style={{
          fontFamily: "'Times New Roman', Times, serif",
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
              display: flex !important;
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

        {/* Top Section (Rows 1 to 39 of CSV Template) */}
        <div className="w-full">
          {/* Row 1: Company Title Centered at Very Top */}
          <div className="text-center font-bold text-[17px] tracking-wide uppercase leading-tight pb-1">
            {master.unit_name || "BALLY JUTE COMPANY LIMITED"}
          </div>

          {/* Row 2: Powered by KatEye™ (Left) & Printed On (Right) */}
          <div className="flex justify-between items-baseline pb-1 text-[11.5px] w-full px-0.5">
            <div className="text-left whitespace-nowrap italic font-bold">
              Powered by KatEye™
            </div>
            <div
              className="text-right whitespace-nowrap font-bold text-[10.5px]"
              style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
            >
              Printed On : {todaySlash} by {printedByDisplay}, No of Times Printed -{" "}
              {printCountWord}
            </div>
          </div>

          {/* Main Outer Frame Box (Rows 3 to 49 of Template) */}
          <div className="border border-black flex flex-col justify-between min-h-[242mm]">
            <div>
              {/* Framed Master Header Box (Rows 3 to 11 of Template) */}
              <div className="grid grid-cols-12 text-[12px] border-b border-black">
                {/* Left Details (9 cols) */}
                <div className="col-span-9 px-2 py-1 space-y-0.5 leading-[1.35]">
                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">MR No.</div>
                    <div className="col-span-5 font-bold">
                      : &nbsp;{master.mr_no || ""}
                    </div>
                    <div className="col-span-5 grid grid-cols-12">
                      <span className="col-span-5 font-bold">Date</span>
                      <span className="col-span-7 font-bold">: &nbsp;{mrDateDisplay}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Supplier</div>
                    <div className="col-span-10 uppercase font-bold">
                      : &nbsp;{(master.supplier || "").toUpperCase()}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-baseline min-h-[14px]">
                    <div className="col-span-2"></div>
                    <div className="col-span-10 uppercase pl-3">
                      {(master as any).supplier_address || ""}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Broker</div>
                    <div className="col-span-10 uppercase font-bold">
                      : &nbsp;{(master.broker || master.supplier || "").toUpperCase()}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Order No</div>
                    <div className="col-span-5 font-bold">
                      : &nbsp;{master.po_no || ""}
                    </div>
                    <div className="col-span-5 grid grid-cols-12">
                      <span className="col-span-5 font-bold">Date</span>
                      <span className="col-span-7 font-bold">: &nbsp;{poDateDisplay}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Area/Agency</div>
                    <div className="col-span-10 uppercase font-bold">
                      : &nbsp;{areaAgencyDisplay}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Consign No.</div>
                    <div className="col-span-10 font-bold">
                      : &nbsp;{consignNoDisplay || ""}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Way Bill</div>
                    <div className="col-span-10 font-bold">
                      : &nbsp;{master.way_bill || ""}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Pan No.</div>
                    <div className="col-span-10 font-bold">
                      : &nbsp;{master.pan_no || ""}
                    </div>
                  </div>
                </div>

                {/* Right Split Box: Party Bill No & Party Bill Date (3 cols) */}
                <div className="col-span-3 border-l border-black flex flex-col justify-between text-[12px]">
                  <div className="flex-1 border-b border-black flex flex-col">
                    <div className="border-b border-black py-0.5 px-1 text-center font-bold">
                      Party Bill No
                    </div>
                    <div className="flex-1 flex items-center justify-center px-1 text-center font-bold">
                      {master.payable_bill_no || ""}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="border-b border-black py-0.5 px-1 text-center font-bold">
                      Party Bill Date
                    </div>
                    <div className="flex-1 flex items-center justify-center px-1 text-center font-bold">
                      {partyBillDateDisplay}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 12: Material Details Table (.clean-print-table bypasses global index.css table rules) */}
              <div className="min-h-[82mm] flex flex-col justify-between border-b border-black">
                <table className="clean-print-table w-full text-[12px] table-fixed border-collapse bg-white">
                  <colgroup>
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "16%" }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-black bg-white text-black font-bold text-[12px] leading-tight">
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
                      <th className="py-1 px-1 text-left align-bottom leading-tight bg-white border-0">
                        <div>P.O</div>
                        <div>Rate</div>
                      </th>
                      <th className="py-1 px-1 text-left align-bottom bg-white border-0">
                        Type
                      </th>
                      <th className="py-1 px-1 text-left align-bottom bg-white border-0">
                        Claim
                      </th>
                      <th className="py-1 px-1 text-left align-bottom bg-white border-0">
                        Sett.
                      </th>
                      <th className="py-1 px-1 text-left align-bottom leading-tight bg-white border-0">
                        <div>Rate</div>
                        <div>(+/-)</div>
                      </th>
                      <th className="py-1 px-1 text-left align-bottom leading-tight bg-white border-0">
                        <div>Sett.</div>
                        <div>Rate</div>
                      </th>
                      <th className="py-1 px-1 text-center align-bottom bg-white border-0">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[12px] leading-[1.35] bg-white">
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

                      const cellCls = "py-0 px-1 border-0 align-top bg-white";

                      return (
                        <React.Fragment key={idx}>
                          <tr className="border-0 bg-white">
                            <td className={`${cellCls} pt-1 font-bold text-left`}>
                              {gradeDisplay}
                            </td>
                            <td className={`${cellCls} pt-1 uppercase text-left`}>
                              {markaDisplay}
                            </td>
                            <td className={`${cellCls} pt-1 text-right`}>
                              {qtyBales}
                            </td>
                            <td className={`${cellCls} pt-1 text-left uppercase`}>
                              {unitDisplay}
                            </td>
                            <td className={`${cellCls} pt-1 text-right pr-3`}>{poRate}</td>
                            <td className={`${cellCls} pt-1 text-left`}>
                              Grd.Down:
                            </td>
                            <td className={`${cellCls} pt-1 text-right pr-2`}>
                              {gdClaim > 0 ? gdClaim : ""}
                            </td>
                            <td className={`${cellCls} pt-1 text-right pr-2`}>
                              {gdSett > 0 ? gdSett : ""}
                            </td>
                            <td className={`${cellCls} pt-1 text-right pr-3`}>
                              {gdRateAdj}
                            </td>
                            <td className={`${cellCls} pt-1 text-right pr-3`}>
                              {settRate}
                            </td>
                            <td className={`${cellCls} pt-1 text-right`}>
                              {colValue.toFixed(2)}
                            </td>
                          </tr>

                          <tr className="border-0 bg-white">
                            <td className={cellCls}></td>
                            <td className={cellCls}></td>
                            <td className={`${cellCls} text-right`}>{wtKgs}</td>
                            <td className={`${cellCls} text-left`}>Kgs</td>
                            <td className={cellCls}></td>
                            <td className={`${cellCls} text-left`}>
                              Moisture:
                            </td>
                            <td className={`${cellCls} text-right pr-2`}>
                              {moistClaim > 0 ? moistClaim : ""}
                            </td>
                            <td className={cellCls}></td>
                            <td className={cellCls}></td>
                            <td className={cellCls}></td>
                            <td className={cellCls}></td>
                          </tr>

                          <tr className="border-0 bg-white">
                            <td className={cellCls}></td>
                            <td className={cellCls}></td>
                            <td className={cellCls}></td>
                            <td className={cellCls}></td>
                            <td className={cellCls}></td>
                            <td className={`${cellCls} text-left`}>
                              Premium:
                            </td>
                            <td className={cellCls}></td>
                            <td className={cellCls}></td>
                            <td className={`${cellCls} text-right pr-3`}>
                              <div className="border-b border-black inline-block min-w-[38px] text-right">
                                {premVal}
                              </div>
                            </td>
                            <td className={cellCls}></td>
                            <td className={cellCls}></td>
                          </tr>

                          <tr className="border-0 bg-white">
                            <td className={`${cellCls} pb-1.5`}></td>
                            <td className={`${cellCls} pb-1.5`}></td>
                            <td className={`${cellCls} pb-1.5`}></td>
                            <td className={`${cellCls} pb-1.5`}></td>
                            <td className={`${cellCls} pb-1.5`}></td>
                            <td className={`${cellCls} pb-1.5 text-left`}>
                              Total:
                            </td>
                            <td className={`${cellCls} pb-1.5`}></td>
                            <td className={`${cellCls} pb-1.5`}></td>
                            <td className={`${cellCls} pb-1.5 text-right pr-3`}>
                              {netRateAdj}
                            </td>
                            <td className={`${cellCls} pb-1.5`}></td>
                            <td className={`${cellCls} pb-1.5`}></td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Row 31: Miscellaneous Charges Section */}
              <div className="px-2 py-1.5 text-[12px] min-h-[42mm]">
                <div className="text-center font-bold text-[12px] mb-1.5">
                  Miscellaneous Charges
                </div>

                <div className="space-y-0.5 text-[11.5px]">
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
                      <div className="w-[85%]">
                        Miscellaneous Deduction M.R. value (Total-{actualApmc}
                        ,Challan-{challanApmc},Settlement-{settlementApmcDiff})
                      </div>
                      <div className="w-[15%] text-right">
                        -{settlementApmcDiff.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {miscAdd > 0 && (
                    <div className="flex justify-between items-baseline">
                      <div className="w-[85%]">Miscellaneous Addition (+)</div>
                      <div className="w-[15%] text-right">
                        +{miscAdd.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Section inside Main Frame (Logical Rows 40 to 49 of Template) */}
            <div>
              {/* Logical Row 40: Remarks Box */}
              <div className="border-t border-b border-black px-2 py-1 text-[12px] font-bold">
                Remarks :-{" "}
                <span className="font-normal">{master.remarks || ""}</span>
              </div>

              {/* Logical Rows 41 to 49: Split Bottom Summary Box */}
              <div className="grid grid-cols-12 text-[12px]">
                {/* Left Half (Cols 1..7) */}
                <div className="col-span-6 border-r border-black flex flex-col justify-between">
                  <div>
                    <div className="px-2 pt-0.5 pb-0.5 border-b border-black leading-[1.35]">
                      <div className="font-bold underline">Note:</div>
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-7 font-bold">
                          On A/c Total Advance
                        </div>
                        <div className="col-span-2 font-bold">: Rs.</div>
                        <div className="col-span-3 text-right font-bold pr-4">
                          {formatIndAmount(onAcTotalAdv)}
                        </div>
                      </div>
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-7 font-bold">
                          On A/c Total Adv. Adjusted
                        </div>
                        <div className="col-span-2 font-bold">: Rs.</div>
                        <div className="col-span-3 text-right font-bold pr-4">
                          {formatIndAmount(onAcTotalAdvAdj)}
                        </div>
                      </div>
                    </div>

                    <div className="px-2 py-0.5 border-b border-black grid grid-cols-12 items-baseline">
                      <div className="col-span-7 font-bold">
                        Balance Amount
                      </div>
                      <div className="col-span-2 font-bold">: Rs.</div>
                      <div className="col-span-3 text-right font-bold pr-4">
                        {formatIndAmount(onAcBalanceAmt)}
                      </div>
                    </div>

                    <div className="py-0.5 px-1 border-b border-black text-center font-bold">
                      On A/c Adv. Adjustment Made Against This MR
                    </div>

                    <div className="grid grid-cols-12 border-b border-black font-bold text-center py-0.5">
                      <div className="col-span-4">Cheque No</div>
                      <div className="col-span-4">Date</div>
                      <div className="col-span-4">Adjusted Value</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 flex-1 min-h-[48px] text-[11.5px] py-0.5">
                    <div className="col-span-4 px-2 text-center">
                      {Array.isArray(master.cheque_adjustments) &&
                        master.cheque_adjustments.map((c, i) => (
                          <div key={i}>{c.cheque_no}</div>
                        ))}
                    </div>
                    <div className="col-span-4 px-2 text-center">
                      {Array.isArray(master.cheque_adjustments) &&
                        master.cheque_adjustments.map((c, i) => (
                          <div key={i}>{c.date}</div>
                        ))}
                    </div>
                    <div className="col-span-4 px-4 text-right">
                      {Array.isArray(master.cheque_adjustments) &&
                        master.cheque_adjustments.map((c, i) => (
                          <div key={i}>
                            {formatIndAmount(c.adjusted_value)}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Right Half (Cols 8..12) */}
                <div className="col-span-6 flex flex-col justify-between text-[12px] leading-[1.35]">
                  <div>
                    <div className="px-2 pt-0.5 pb-0.5 border-b border-black">
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-6 font-bold">
                          Material Value
                        </div>
                        <div className="col-span-1 font-bold">:</div>
                        <div className="col-span-5 text-right font-bold">
                          {formatIndAmount(materialValue)}
                        </div>
                      </div>
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-6 font-bold">
                          Material Misc(+)
                        </div>
                        <div className="col-span-1 font-bold">:</div>
                        <div className="col-span-5 text-right font-bold">
                          {formatIndAmount(miscAdd)}
                        </div>
                      </div>
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-6 font-bold">
                          Material Misc(-)
                        </div>
                        <div className="col-span-1 font-bold">:</div>
                        <div className="col-span-5 text-right font-bold">
                          {formatIndAmount(miscLessTotal)}
                        </div>
                      </div>
                    </div>

                    <div className="px-2 py-0.5 border-b border-black">
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-6 font-bold">
                          Total MR Amount
                        </div>
                        <div className="col-span-1 font-bold">:</div>
                        <div className="col-span-5 text-right font-bold">
                          {formatIndAmount(totalMrAmount)}
                        </div>
                      </div>
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-6 pl-2 font-bold">
                          MR Advance Amount
                        </div>
                        <div className="col-span-1 font-bold">:</div>
                        <div className="col-span-5 text-right font-bold">
                          {formatIndAmount(effectiveAdvanceAmount)}
                        </div>
                      </div>
                    </div>

                    <div className="px-2 py-0.5 border-b border-black">
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-6 pl-1 font-bold">
                          Balance Due(Rounded)
                        </div>
                        <div className="col-span-1 font-bold">:</div>
                        <div className="col-span-5 text-right font-bold">
                          {formatIndAmount(effectiveBalanceDueRounded)}
                        </div>
                      </div>
                    </div>

                    <div className="px-2 py-0.5 border-b border-black">
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-8 font-bold">
                          On A/c Adv. Adjusted Amount :
                        </div>
                        <div className="col-span-4 text-right font-bold">
                          {formatIndAmount(onAcAdvAdjusted)}
                        </div>
                      </div>
                    </div>

                    <div className="px-2 py-0.5">
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-6 pl-2 font-bold">
                          Net Amount to be Paid
                        </div>
                        <div className="col-span-1 font-bold">:</div>
                        <div className="col-span-5 text-right font-bold">
                          {formatIndAmount(effectiveNetAmountToBePaid)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-1.5 pt-0.5 pb-1 font-bold text-[9.5px] leading-snug uppercase">
                    <span className="text-[11px]">Rs. : </span>
                    {numberToIndianWords(effectiveNetAmountToBePaid)} ONLY
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Logical Row 54: Bottom Signatures */}
        <div
          className="pt-7 pb-1 px-4 flex justify-between items-end text-[11px] font-bold"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          <div className="underline">Prepared by</div>
          <div className="underline">Checked by</div>
          <div className="underline">Authorised Signatory</div>
        </div>
      </div>
    </PrintModal>
  );
};

export default SettlementPrintModal;
