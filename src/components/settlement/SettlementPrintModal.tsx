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

  // Build the populated 58x23 CSV grid directly from the loaded CSV template
  const populatedGrid = useMemo(() => {
    const grid = parseCsvToGrid(rawTemplateCsv, 58, 23);
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

    // Clear default template placeholder rows 14..33 before populating grade items
    for (let r = 14; r <= 33; r++) {
      for (let c = 0; c < 23; c++) {
        setCell(r, c, "");
      }
    }

    // Populate Grade items (4 rows per grade item starting at Row 14)
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

    // Rows 35..42: Miscellaneous Charges items
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

    // Row 43: Remarks
    setCell(43, 1, `  Remarks :- ${master.remarks || ""}`);

    // Rows 44..52: Summary & Note values
    setCell(44, 11, formatIndAmount(materialValue));
    setCell(45, 5, `: Rs.   ${formatIndAmount(onAcTotalAdv)}`);
    setCell(45, 11, formatIndAmount(miscAdd));
    setCell(46, 5, `: Rs.   ${formatIndAmount(onAcTotalAdvAdj)}`);
    setCell(46, 11, formatIndAmount(miscLessTotal));
    setCell(47, 5, `: Rs.   ${formatIndAmount(onAcBalanceAmt)}`);
    setCell(47, 11, formatIndAmount(totalMrAmount));
    setCell(48, 11, formatIndAmount(effectiveAdvanceAmount));
    setCell(49, 11, formatIndAmount(effectiveBalanceDueRounded));
    setCell(50, 11, formatIndAmount(onAcAdvAdjusted));
    setCell(51, 11, formatIndAmount(effectiveNetAmountToBePaid));
    setCell(
      52,
      7,
      `Rs. :  ${numberToIndianWords(effectiveNetAmountToBePaid)} ONLY`
    );

    if (Array.isArray(master.cheque_adjustments)) {
      master.cheque_adjustments.slice(0, 3).forEach((chk, cIdx) => {
        setCell(50 + cIdx, 1, chk.cheque_no || "");
        setCell(50 + cIdx, 3, chk.date || "");
        setCell(50 + cIdx, 5, formatIndAmount(chk.adjusted_value));
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

  // Generate a 1-page A4 vector PDF directly from the populated CSV template grid
  const buildPdfDocument = (withAutoPrint = false): jsPDF => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const cell = (r1: number, c0: number) =>
      (populatedGrid[r1 - 1]?.[c0] || "").trim();

    const L = 10; // Left margin (mm)
    const R = 200; // Right margin (mm)
    const W = R - L; // 190mm width

    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);

    // Row 1: Company Title (from CSV cell[1,0])
    doc.setFont("courier", "bold");
    doc.setFontSize(13);
    doc.text(cell(1, 0) || "BALLY JUTE COMPANY LIMITED", 105, 10.5, {
      align: "center",
    });

    // Row 2: Powered by KatEye™ (cell[2,1]) & Printed On (cell[2,4])
    doc.setFont("courier", "bolditalic");
    doc.setFontSize(8.5);
    doc.text(cell(2, 1) || "Powered by KatEye™", L, 15.5);

    doc.setFont("courier", "bold");
    doc.setFontSize(8.5);
    doc.text(cell(2, 4), R, 15.5, { align: "right" });

    // Outer Main Frame Box (Rows 3 to 52 of CSV template): y = 17.5mm to y = 266mm
    const boxTop = 17.5;
    const boxBottom = 266;
    doc.rect(L, boxTop, W, boxBottom - boxTop);

    // Master Header Section (Rows 3 to 11): y = 17.5mm to y = 57.5mm
    const headerBottom = 57.5;
    const splitX = 166; // Vertical divider for Party Bill No / Party Bill Date
    doc.line(L, headerBottom, R, headerBottom);
    doc.line(splitX, boxTop, splitX, headerBottom);

    // Left Master Details (Rows 3 to 11 from CSV template)
    const labelX = L + 2;
    const colonX = L + 27;
    const valX = L + 30;
    const dateLabelX = L + 98;
    const dateValX = L + 111;

    const headerRows = [
      { r: 3, y: 21.8, hasDate: true },
      { r: 4, y: 26.0, hasDate: false },
      { r: 5, y: 30.2, hasDate: false, isAddress: true },
      { r: 6, y: 34.4, hasDate: false },
      { r: 7, y: 38.6, hasDate: true },
      { r: 8, y: 42.8, hasDate: false },
      { r: 9, y: 47.0, hasDate: false },
      { r: 10, y: 51.2, hasDate: false },
      { r: 11, y: 55.4, hasDate: false },
    ];

    doc.setFontSize(9);
    headerRows.forEach(({ r, y, hasDate, isAddress }) => {
      if (isAddress) {
        const addr = cell(r, 4);
        if (addr) {
          doc.setFont("courier", "bold");
          doc.text(addr, valX, y);
        }
        return;
      }
      const lbl = cell(r, 1);
      const val = cell(r, 4);
      doc.setFont("courier", "bold");
      doc.text(lbl, labelX, y);
      doc.text(":", colonX, y);
      doc.text(val, valX, y);

      if (hasDate) {
        const dLbl = cell(r, 6) || "Date";
        const dVal = cell(r, 8);
        doc.text(`${dLbl} :`, dateLabelX, y);
        doc.text(dVal, dateValX, y);
      }
    });

    // Right Split Box: Party Bill No (Row 3..6) & Party Bill Date (Row 7..11)
    const partyMidY = 37.5;
    const partyBoxCenter = (splitX + R) / 2;
    doc.line(splitX, partyMidY, R, partyMidY);
    doc.line(splitX, boxTop + 5.5, R, boxTop + 5.5);
    doc.line(splitX, partyMidY + 5.5, R, partyMidY + 5.5);

    doc.setFont("courier", "bold");
    doc.setFontSize(8.5);
    doc.text(cell(3, 10) || "Party Bill No", partyBoxCenter, boxTop + 4, {
      align: "center",
    });
    doc.setFontSize(9.5);
    doc.text(cell(4, 10), partyBoxCenter, boxTop + 12, { align: "center" });

    doc.setFontSize(8.5);
    doc.text(cell(7, 10) || "Party Bill Date", partyBoxCenter, partyMidY + 4, {
      align: "center",
    });
    doc.setFontSize(9.5);
    doc.text(cell(8, 10), partyBoxCenter, partyMidY + 11.5, {
      align: "center",
    });

    // Row 12: Table Header (pure white background, NO vertical lines!)
    const tblHeaderBottom = 66.5;
    doc.line(L, tblHeaderBottom, R, tblHeaderBottom);

    // X-coordinates for the 11 columns (B..L in CSV template)
    const colX = {
      grade: L + 2, // Left
      marka: L + 16, // Left
      qty: L + 49, // Right
      unit: L + 52, // Left
      poRate: L + 81, // Right
      type: L + 104, // Right
      claim: L + 121, // Right
      sett: L + 137, // Right
      rateAdj: L + 154, // Right
      settRate: L + 170, // Right
      value: R - 2, // Right
    };

    doc.setFont("courier", "bold");
    doc.setFontSize(8.8);
    // Multi-line headers first row
    doc.text("P.O", colX.poRate, 61.5, { align: "right" });
    doc.text("Rate", colX.rateAdj, 61.5, { align: "right" });
    doc.text("Sett.", colX.settRate, 61.5, { align: "right" });

    // Bottom-aligned header row
    doc.text(cell(12, 1) || "Grade", colX.grade, 65.0);
    doc.text(cell(12, 2) || "Marka", colX.marka, 65.0);
    doc.text(cell(12, 3) || "Quantity", colX.qty, 65.0, { align: "right" });
    doc.text(cell(12, 4) || "Unit", colX.unit, 65.0);
    doc.text("Rate", colX.poRate, 65.0, { align: "right" });
    doc.text(cell(12, 6) || "Type", colX.type, 65.0, { align: "right" });
    doc.text(cell(12, 7) || "Claim", colX.claim, 65.0, { align: "right" });
    doc.text(cell(12, 8) || "Sett.", colX.sett, 65.0, { align: "right" });
    doc.text("(+/-)", colX.rateAdj, 65.0, { align: "right" });
    doc.text("Rate", colX.settRate, 65.0, { align: "right" });
    doc.text(cell(12, 11) || "Value", colX.value, 65.0, { align: "right" });

    // Rows 14..33: Grade items (4 lines per grade, NO internal gray lines)
    let curY = tblHeaderBottom + 4.5;
    const itemCount = Math.min(activeDetails.length, 5);
    const rowStep = itemCount > 3 ? 3.6 : 4.2;

    for (let idx = 0; idx < itemCount; idx++) {
      const baseRow = 14 + idx * 4;

      // Line 1: Grd.Down
      doc.setFont("courier", "bold");
      doc.setFontSize(8.8);
      doc.text(cell(baseRow, 1), colX.grade, curY);
      doc.setFont("courier", "normal");
      doc.text(cell(baseRow, 2), colX.marka, curY);
      doc.text(cell(baseRow, 3), colX.qty, curY, { align: "right" });
      doc.text(cell(baseRow, 4), colX.unit, curY);
      doc.text(cell(baseRow, 5), colX.poRate, curY, { align: "right" });
      doc.setFont("courier", "bold");
      doc.text(cell(baseRow, 6) || "Grd.Down:", colX.type, curY, {
        align: "right",
      });
      doc.setFont("courier", "normal");
      if (cell(baseRow, 7)) {
        doc.text(cell(baseRow, 7), colX.claim, curY, { align: "right" });
      }
      if (cell(baseRow, 8)) {
        doc.text(cell(baseRow, 8), colX.sett, curY, { align: "right" });
      }
      doc.text(cell(baseRow, 9), colX.rateAdj, curY, { align: "right" });
      doc.text(cell(baseRow, 10), colX.settRate, curY, { align: "right" });
      doc.text(cell(baseRow, 11), colX.value, curY, { align: "right" });

      // Line 2: Weight in Kgs & Moisture
      curY += rowStep;
      doc.setFont("courier", "normal");
      doc.text(cell(baseRow + 1, 3), colX.qty, curY, { align: "right" });
      doc.text(cell(baseRow + 1, 4) || "Kgs", colX.unit, curY);
      doc.setFont("courier", "bold");
      doc.text(cell(baseRow + 1, 6) || "Moisture:", colX.type, curY, {
        align: "right",
      });
      doc.setFont("courier", "normal");
      if (cell(baseRow + 1, 7)) {
        doc.text(cell(baseRow + 1, 7), colX.claim, curY, { align: "right" });
      }

      // Line 3: Premium (with underline under Premium value)
      curY += rowStep;
      doc.setFont("courier", "bold");
      doc.text(cell(baseRow + 2, 6) || "Premium:", colX.type, curY, {
        align: "right",
      });
      doc.setFont("courier", "normal");
      doc.text(cell(baseRow + 2, 9), colX.rateAdj, curY, { align: "right" });
      doc.line(colX.rateAdj - 12, curY + 0.9, colX.rateAdj, curY + 0.9);

      // Line 4: Total
      curY += rowStep + 0.3;
      doc.setFont("courier", "bold");
      doc.text(cell(baseRow + 3, 6) || "Total:", colX.type, curY, {
        align: "right",
      });
      doc.setFont("courier", "normal");
      doc.text(cell(baseRow + 3, 9), colX.rateAdj, curY, { align: "right" });

      // Bottom separator line after each grade block
      curY += 2.0;
      doc.line(L, curY, R, curY);
      curY += 4.2;
    }

    // Row 34: Miscellaneous Charges
    const miscHeaderY = Math.max(curY + 1, 142);
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text(cell(34, 1) || "Miscellaneous Charges", 105, miscHeaderY, {
      align: "center",
    });

    let miscY = miscHeaderY + 5;
    doc.setFont("courier", "normal");
    doc.setFontSize(8.6);
    for (let r = 35; r <= 42; r++) {
      const desc = cell(r, 1);
      const amt = cell(r, 11);
      if (!desc && !amt) continue;
      const qtyStr = cell(r, 5);
      const rateStr = cell(r, 7);
      const perStr = cell(r, 9);

      doc.text(desc, L + 2, miscY);
      if (qtyStr) doc.text(qtyStr, L + 90, miscY, { align: "right" });
      if (rateStr) doc.text(rateStr, L + 118, miscY, { align: "right" });
      if (perStr) doc.text(perStr, L + 152, miscY, { align: "right" });
      if (amt) doc.text(amt, R - 2, miscY, { align: "right" });
      miscY += 4.2;
    }

    // Row 43: Remarks Band (y = 190mm to 197mm)
    const remarksTop = 190;
    const remarksBottom = 197;
    doc.line(L, remarksTop, R, remarksTop);
    doc.line(L, remarksBottom, R, remarksBottom);
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text(cell(43, 1) || "Remarks :-", L + 2, remarksTop + 4.8);

    // Rows 44..52: Bottom Split Box (y = 197mm to 266mm)
    const midX = 104; // Vertical divider between Note/Cheque table and Material Summary
    doc.line(midX, remarksBottom, midX, boxBottom);

    // Left Half (Rows 44..52, Cols B..F)
    doc.setFont("courier", "bold");
    doc.setFontSize(8.6);
    const noteLbl = cell(44, 1) || "Note:";
    doc.text(noteLbl, L + 2, 201.5);
    doc.line(L + 2, 202.2, L + 12, 202.2); // Underline Note:

    // Row 45: On A/c Total Advance
    doc.text(cell(45, 1) || "On A/c Total Advance", L + 2, 206.5);
    doc.text(": Rs.", L + 60, 206.5);
    doc.text(formatIndAmount(onAcTotalAdv), midX - 2, 206.5, {
      align: "right",
    });

    // Row 46: On A/c Total Adv. Adjusted
    doc.text(cell(46, 1) || "On A/c Total Adv. Adjusted", L + 2, 211.2);
    doc.text(": Rs.", L + 60, 211.2);
    doc.text(formatIndAmount(onAcTotalAdvAdj), midX - 2, 211.2, {
      align: "right",
    });

    // Short horizontal line above Balance Amount value
    doc.line(L + 75, 213.2, midX - 1.5, 213.2);

    // Row 47: Balance Amount
    doc.text(cell(47, 1) || "Balance Amount : Rs.", L + 34, 217.5);
    doc.text(formatIndAmount(onAcBalanceAmt), midX - 2, 217.5, {
      align: "right",
    });
    doc.line(L + 75, 219.2, midX - 1.5, 219.2);

    // Row 48: On A/c Adv. Adjustment Made Against This MR
    const adjBannerTop = 221.5;
    const adjBannerBottom = 227.5;
    doc.line(L, adjBannerTop, midX, adjBannerTop);
    doc.line(L, adjBannerBottom, midX, adjBannerBottom);
    doc.setFontSize(8.2);
    doc.text(
      cell(48, 1) || "On A/c Adv. Adjustment Made Against This MR",
      (L + midX) / 2,
      adjBannerTop + 4.2,
      { align: "center" }
    );

    // Row 49: Cheque No | Date | Adjusted Value
    const chkHeaderBottom = 233.5;
    const chkCol1X = L + 31;
    const chkCol2X = L + 59;
    doc.line(L, chkHeaderBottom, midX, chkHeaderBottom);
    doc.line(chkCol1X, adjBannerBottom, chkCol1X, boxBottom);
    doc.line(chkCol2X, adjBannerBottom, chkCol2X, boxBottom);

    doc.setFontSize(8.4);
    doc.text(cell(49, 1) || "Cheque No", (L + chkCol1X) / 2, 231.5, {
      align: "center",
    });
    doc.text(cell(49, 3) || "Date", (chkCol1X + chkCol2X) / 2, 231.5, {
      align: "center",
    });
    doc.text(cell(49, 5) || "Adjusted Value", (chkCol2X + midX) / 2, 231.5, {
      align: "center",
    });

    // Cheque Adjustment rows (Rows 50..52)
    doc.setFont("courier", "normal");
    for (let cIdx = 0; cIdx < 3; cIdx++) {
      const rNum = 50 + cIdx;
      const cy = 239 + cIdx * 5;
      if (cell(rNum, 1)) {
        doc.text(cell(rNum, 1), (L + chkCol1X) / 2, cy, { align: "center" });
      }
      if (cell(rNum, 3)) {
        doc.text(cell(rNum, 3), (chkCol1X + chkCol2X) / 2, cy, {
          align: "center",
        });
      }
      if (cell(rNum, 5)) {
        doc.text(cell(rNum, 5), midX - 2, cy, { align: "right" });
      }
    }

    // Right Half (Rows 44..52, Cols H..L): Financial Summary
    const rLabelX = midX + 8;
    const rColonX = midX + 54;
    const rValX = R - 2;

    doc.setFont("courier", "bold");
    doc.setFontSize(8.8);

    // Row 44: Material Value
    doc.text(cell(44, 7) || "Material Value", rLabelX, 201.5);
    doc.text(":", rColonX, 201.5);
    doc.text(cell(44, 11), rValX, 201.5, { align: "right" });

    // Row 45: Material Misc(+)
    doc.text(cell(45, 7) || "Material Misc(+)", rLabelX, 206.2);
    doc.text(":", rColonX, 206.2);
    doc.text(cell(45, 11), rValX, 206.2, { align: "right" });

    // Row 46: Material Misc(-)
    doc.text(cell(46, 7) || "Material Misc(-)", rLabelX, 210.9);
    doc.text(":", rColonX, 210.9);
    doc.text(cell(46, 11), rValX, 210.9, { align: "right" });

    // Separator line
    doc.line(rLabelX, 213.2, R, 213.2);

    // Row 47: Total MR Amount
    doc.text(cell(47, 7) || "Total MR Amount", rLabelX, 217.5);
    doc.text(":", rColonX, 217.5);
    doc.text(cell(47, 11), rValX, 217.5, { align: "right" });

    // Row 48: MR Advance Amount
    doc.text(cell(48, 7) || "MR Advance Amount", rLabelX, 222.2);
    doc.text(":", rColonX, 222.2);
    doc.text(cell(48, 11), rValX, 222.2, { align: "right" });

    // Separator line
    doc.line(rLabelX, 224.5, R, 224.5);

    // Row 49: Balance Due(Rounded)
    doc.text(cell(49, 7) || "Balance Due(Rounded)", rLabelX, 229.0);
    doc.text(":", rColonX, 229.0);
    doc.text(cell(49, 11), rValX, 229.0, { align: "right" });

    // Full right-half separator line
    doc.line(midX, 231.5, R, 231.5);

    // Row 50: On A/c Adv. Adjusted Amount :Rs.
    doc.text("On A/c Adv. Adjusted Amount :Rs.", midX + 2, 236.2);
    doc.text(cell(50, 11), rValX, 236.2, { align: "right" });

    // Full right-half separator line
    doc.line(midX, 238.8, R, 238.8);

    // Row 51: Net Amount to be Paid :Rs.
    doc.text(cell(51, 7) || "Net Amount to be Paid", rLabelX, 243.5);
    doc.text(":Rs.", rColonX, 243.5);
    doc.text(cell(51, 11), rValX, 243.5, { align: "right" });

    // Row 52: Amount in Words
    doc.setFontSize(7.8);
    const wordsText = cell(52, 7);
    const wrappedWords = doc.splitTextToSize(wordsText, R - midX - 4);
    doc.text(wrappedWords, midX + 2, 254.0);

    // Row 57: Bottom Signatures (outside the main frame box at y = 283mm)
    const sigY = 283;
    doc.setFont("courier", "bold");
    doc.setFontSize(9);

    const sig1 = cell(57, 1) || "Prepared by";
    const sig2 = cell(57, 6) || "Checked by";
    const sig3 = cell(57, 10) || "Authorised Signatory";

    doc.text(sig1, L + 2, sigY);
    doc.line(L + 2, sigY + 1, L + 26, sigY + 1);

    doc.text(sig2, 95, sigY, { align: "center" });
    doc.line(84, sigY + 1, 106, sigY + 1);

    doc.text(sig3, R - 2, sigY, { align: "right" });
    doc.line(R - 43, sigY + 1, R - 2, sigY + 1);

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
      title={`MR SETTLEMENT PDF PREVIEW (CSV TEMPLATE) - ${master.mr_no || "N/A"}`}
      onPrint={handleInitiatePrint}
      customPrintHandler={handleSendPdfToPrinter}
      customPdfBase64={pdfBase64}
      showTip={false}
      extraActions={
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex border border-gray-400 bg-white rounded overflow-hidden mr-1">
            <button
              type="button"
              onClick={() => setViewMode("pdf")}
              className={`px-2.5 h-8 text-[11px] font-black cursor-pointer transition ${
                viewMode === "pdf"
                  ? "bg-[#2a3088] text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              📄 PDF PREVIEW
            </button>
            <button
              type="button"
              onClick={() => setViewMode("sheet")}
              className={`px-2.5 h-8 text-[11px] font-black cursor-pointer transition border-l border-gray-300 ${
                viewMode === "sheet"
                  ? "bg-[#2a3088] text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              🖨️ TEMPLATE SHEET
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="bg-blue-700 hover:bg-blue-800 text-white border border-blue-950 shadow-[1px_1px_0_0_rgba(0,0,0,0.4)] px-3 text-xs font-black h-8 flex items-center gap-1.5 cursor-pointer transition"
            title="Download generated PDF file"
          >
            ⬇ DOWNLOAD PDF
          </button>

          <button
            type="button"
            onClick={handleDownloadPopulatedCsv}
            className="bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-950 shadow-[1px_1px_0_0_rgba(0,0,0,0.4)] px-3 text-xs font-black h-8 flex items-center gap-1.5 cursor-pointer transition"
            title="Download populated CSV template file"
          >
            📊 DOWNLOAD CSV
          </button>
        </div>
      }
    >
      {/* Embedded Live PDF Viewer (Generated directly from /public/templates/settlement_template.csv) */}
      {viewMode === "pdf" && pdfBlobUrl && (
        <div className="pdf-embed-container no-print w-full bg-neutral-800 p-3 flex flex-col items-center">
          <div className="w-full max-w-[960px] bg-neutral-900 text-white px-3 py-1.5 text-[11px] font-mono flex justify-between items-center rounded-t border border-neutral-700">
            <span>
              ✓ Generated from GitHub CSV Template: <strong>/public/templates/settlement_template.csv</strong>
            </span>
            <span>A4 Portrait PDF • Ready for Laser / Dot-Matrix Print</span>
          </div>
          <iframe
            ref={pdfIframeRef}
            src={`${pdfBlobUrl}#toolbar=1&navpanes=0&view=FitH`}
            title={`Settlement PDF - ${master.mr_no || ""}`}
            className="w-full max-w-[960px] h-[78vh] bg-white border border-neutral-700 rounded-b shadow-2xl"
          />
        </div>
      )}

      {/* Clean A4 Template Sheet (Used for Sheet View, Email HTML, and fallback print) */}
      <div
        id="print-modal-children-canvas"
        className={`${
          viewMode === "pdf" ? "hidden print:flex" : "flex"
        } bg-white text-black px-3 py-2 mx-auto w-full max-w-[192mm] min-h-[275mm] flex-col justify-between text-[11px] leading-tight select-text font-mono`}
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

        {/* Top Section (Rows 1 to 42 of CSV Template) */}
        <div className="w-full">
          {/* Row 1: Company Title Centered at Very Top */}
          <div className="text-center font-extrabold text-[15px] tracking-wider uppercase leading-tight pb-0.5">
            {master.unit_name || "BALLY JUTE COMPANY LIMITED"}
          </div>

          {/* Row 2: Powered by KatEye™ (Left) & Printed On (Right) */}
          <div className="flex justify-between items-baseline pb-1 text-[10.5px] w-full">
            <div className="text-left whitespace-nowrap italic font-bold">
              Powered by KatEye™
            </div>
            <div className="text-right whitespace-nowrap font-bold">
              Printed On : {todaySlash} by {printedByDisplay}, No of Times Printed -{" "}
              {printCountWord}
            </div>
          </div>

          {/* Main Outer Frame Box (Rows 3 to 52 of Template) */}
          <div className="border border-black flex flex-col justify-between min-h-[242mm]">
            <div>
              {/* Framed Master Header Box (Rows 3 to 11 of Template) */}
              <div className="grid grid-cols-12 text-[11px] border-b border-black">
                {/* Left Details (Cols B to J -> 10 cols) */}
                <div className="col-span-10 px-2 py-1.5 space-y-0.5 leading-[1.35]">
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

                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Supplier</div>
                    <div className="col-span-10 uppercase font-bold">
                      : {(master.supplier || "-").toUpperCase()}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-baseline min-h-[13px]">
                    <div className="col-span-2"></div>
                    <div className="col-span-10 uppercase pl-2 font-bold">
                      {(master as any).supplier_address || ""}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Broker</div>
                    <div className="col-span-10 uppercase font-bold">
                      : {(master.broker || master.supplier || "-").toUpperCase()}
                    </div>
                  </div>

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

                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Area/Agency</div>
                    <div className="col-span-10 uppercase font-bold">
                      : {areaAgencyDisplay}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Consign No.</div>
                    <div className="col-span-10 font-bold">
                      : {consignNoDisplay || ""}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Way Bill</div>
                    <div className="col-span-10 font-bold">
                      : {master.way_bill || ""}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-baseline">
                    <div className="col-span-2 font-bold">Pan No.</div>
                    <div className="col-span-10 font-bold">
                      : {master.pan_no || ""}
                    </div>
                  </div>
                </div>

                {/* Right Split Box: Party Bill No & Party Bill Date */}
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

              {/* Row 12: Material Details Table (.clean-print-table bypasses global index.css table rules) */}
              <table className="clean-print-table w-full text-[11px] table-fixed border-collapse bg-white">
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
                    <th className="py-1 px-1 text-right align-bottom bg-white border-0">
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
                <tbody className="text-[11px] leading-[1.3] bg-white">
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
                          <td className={`${cellCls} pt-1 text-right`}>{poRate}</td>
                          <td className={`${cellCls} pt-1 text-right font-bold`}>
                            Grd.Down:
                          </td>
                          <td className={`${cellCls} pt-1 text-right`}>
                            {gdClaim > 0 ? gdClaim : ""}
                          </td>
                          <td className={`${cellCls} pt-1 text-right`}>
                            {gdSett > 0 ? gdSett : ""}
                          </td>
                          <td className={`${cellCls} pt-1 text-right`}>
                            {gdRateAdj}
                          </td>
                          <td className={`${cellCls} pt-1 text-right`}>
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
                          <td className={`${cellCls} text-right font-bold`}>
                            Moisture:
                          </td>
                          <td className={`${cellCls} text-right`}>
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
                          <td className={`${cellCls} text-right font-bold`}>
                            Premium:
                          </td>
                          <td className={cellCls}></td>
                          <td className={cellCls}></td>
                          <td className={`${cellCls} text-right`}>
                            <div className="border-b border-black inline-block min-w-[46px] text-right">
                              {premVal}
                            </div>
                          </td>
                          <td className={cellCls}></td>
                          <td className={cellCls}></td>
                        </tr>

                        <tr className="border-b border-black bg-white">
                          <td className={`${cellCls} pb-1`}></td>
                          <td className={`${cellCls} pb-1`}></td>
                          <td className={`${cellCls} pb-1`}></td>
                          <td className={`${cellCls} pb-1`}></td>
                          <td className={`${cellCls} pb-1`}></td>
                          <td className={`${cellCls} pb-1 text-right font-bold`}>
                            Total:
                          </td>
                          <td className={`${cellCls} pb-1`}></td>
                          <td className={`${cellCls} pb-1`}></td>
                          <td className={`${cellCls} pb-1 text-right`}>
                            {netRateAdj}
                          </td>
                          <td className={`${cellCls} pb-1`}></td>
                          <td className={`${cellCls} pb-1`}></td>
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

            {/* Bottom Section inside Main Frame (Rows 43 to 52 of Template) */}
            <div>
              {/* Row 43: Remarks Box */}
              <div className="border-t border-b border-black px-2 py-1 text-[11px] font-bold">
                Remarks :-{" "}
                <span className="font-normal">{master.remarks || ""}</span>
              </div>

              {/* Rows 44 to 52: Split Bottom Summary Box */}
              <div className="grid grid-cols-12 text-[11px]">
                {/* Left Half */}
                <div className="col-span-6 border-r border-black flex flex-col justify-between">
                  <div className="px-2 pt-1 pb-1 text-[11px] leading-[1.4]">
                    <div className="font-bold underline mb-0.5">Note:</div>
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
                      <div className="col-span-3 text-right font-bold border-b border-black pb-0.5">
                        {formatIndAmount(onAcTotalAdvAdj)}
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-baseline pt-0.5">
                      <div className="col-span-7 text-right pr-2 font-bold">
                        Balance Amount
                      </div>
                      <div className="col-span-2 font-bold">: Rs.</div>
                      <div className="col-span-3 text-right font-bold border-b border-black pb-0.5">
                        {formatIndAmount(onAcBalanceAmt)}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-black flex-1 flex flex-col">
                    <div className="border-b border-black py-0.5 px-1 text-center font-bold text-[10.5px]">
                      On A/c Adv. Adjustment Made Against This MR
                    </div>
                    <div className="grid grid-cols-12 border-b border-black font-bold text-center text-[10.5px]">
                      <div className="col-span-4 border-r border-black py-0.5">
                        Cheque No
                      </div>
                      <div className="col-span-4 border-r border-black py-0.5">
                        Date
                      </div>
                      <div className="col-span-4 py-0.5">Adjusted Value</div>
                    </div>
                    <div className="grid grid-cols-12 flex-1 min-h-[75px] text-[10.5px]">
                      <div className="col-span-4 border-r border-black px-1 py-0.5">
                        {Array.isArray(master.cheque_adjustments) &&
                          master.cheque_adjustments.map((c, i) => (
                            <div key={i}>{c.cheque_no}</div>
                          ))}
                      </div>
                      <div className="col-span-4 border-r border-black px-1 py-0.5 text-center">
                        {Array.isArray(master.cheque_adjustments) &&
                          master.cheque_adjustments.map((c, i) => (
                            <div key={i}>{c.date}</div>
                          ))}
                      </div>
                      <div className="col-span-4 px-1 py-0.5 text-right">
                        {Array.isArray(master.cheque_adjustments) &&
                          master.cheque_adjustments.map((c, i) => (
                            <div key={i}>
                              {formatIndAmount(c.adjusted_value)}
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Half */}
                <div className="col-span-6 flex flex-col justify-between text-[11px] leading-[1.4]">
                  <div>
                    <div className="px-2 pt-1 pb-0.5">
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-1"></div>
                        <div className="col-span-6 font-bold">
                          Material Value
                        </div>
                        <div className="col-span-1 font-bold">:</div>
                        <div className="col-span-4 text-right font-bold">
                          {formatIndAmount(materialValue)}
                        </div>
                      </div>
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-1"></div>
                        <div className="col-span-6 font-bold">
                          Material Misc(+)
                        </div>
                        <div className="col-span-1 font-bold">:</div>
                        <div className="col-span-4 text-right font-bold">
                          {formatIndAmount(miscAdd)}
                        </div>
                      </div>
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-1"></div>
                        <div className="col-span-6 font-bold border-b border-black pb-0.5">
                          Material Misc(-)
                        </div>
                        <div className="col-span-1 font-bold border-b border-black pb-0.5">
                          :
                        </div>
                        <div className="col-span-4 text-right font-bold border-b border-black pb-0.5">
                          {formatIndAmount(miscLessTotal)}
                        </div>
                      </div>
                    </div>

                    <div className="px-2 py-0.5">
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-1"></div>
                        <div className="col-span-6 font-bold">
                          Total MR Amount
                        </div>
                        <div className="col-span-1 font-bold">:</div>
                        <div className="col-span-4 text-right font-bold">
                          {formatIndAmount(totalMrAmount)}
                        </div>
                      </div>
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-1"></div>
                        <div className="col-span-6 font-bold border-b border-black pb-0.5">
                          MR Advance Amount
                        </div>
                        <div className="col-span-1 font-bold border-b border-black pb-0.5">
                          :
                        </div>
                        <div className="col-span-4 text-right font-bold border-b border-black pb-0.5">
                          {formatIndAmount(effectiveAdvanceAmount)}
                        </div>
                      </div>
                    </div>

                    <div className="px-2 py-0.5 border-b border-black">
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-1"></div>
                        <div className="col-span-6 font-bold">
                          Balance Due(Rounded)
                        </div>
                        <div className="col-span-1 font-bold">:</div>
                        <div className="col-span-4 text-right font-bold">
                          {formatIndAmount(effectiveBalanceDueRounded)}
                        </div>
                      </div>
                    </div>

                    <div className="px-2 py-0.5 border-b border-black">
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-8 font-bold">
                          On A/c Adv. Adjusted Amount :Rs.
                        </div>
                        <div className="col-span-4 text-right font-bold">
                          {formatIndAmount(onAcAdvAdjusted)}
                        </div>
                      </div>
                    </div>

                    <div className="px-2 py-0.5">
                      <div className="grid grid-cols-12 items-baseline">
                        <div className="col-span-1"></div>
                        <div className="col-span-6 font-bold">
                          Net Amount to be Paid
                        </div>
                        <div className="col-span-1 font-bold">:Rs.</div>
                        <div className="col-span-4 text-right font-bold">
                          {formatIndAmount(effectiveNetAmountToBePaid)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-2 pt-2 pb-1.5 font-bold text-[10px] leading-snug uppercase">
                    Rs. : {numberToIndianWords(effectiveNetAmountToBePaid)} ONLY
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 57: Bottom Signatures */}
        <div className="pt-8 pb-1 px-2 flex justify-between items-end text-[11px] font-bold">
          <div className="underline">Prepared by</div>
          <div className="underline">Checked by</div>
          <div className="underline">Authorised Signatory</div>
        </div>
      </div>
    </PrintModal>
  );
};

export default SettlementPrintModal;
