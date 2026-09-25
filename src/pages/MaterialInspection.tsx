import React, { useState, useEffect, useRef } from "react";
import { useLiveAutoRefresh } from "../hooks/useLiveAutoRefresh";
import Papa from "papaparse";
import {
  ShieldCheck,
  Save,
  X,
  Printer,
  FileText,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Edit,
  User,
  Calendar
} from "lucide-react";
import LegacyLayout from "../components/LegacyLayout";
import { supabase } from "../lib/supabase";
import { dbModule } from "../services/dbModule";
import { enforceEditOrDeletePermission, canEditOrDelete, canViewCompletedData, getCurrentUserContext } from "../lib/permissions";
import { comparePoInspection } from "../lib/poMatch";
import { sanitizeCsvData, formatIndianCurrency, formatIndianNumber, calculateFloor1000, calculate93PctPaidAmount } from "../lib/utils";
import PrintModal from "../components/PrintModal";
import InspectionPrintSlip from "../components/InspectionPrintSlip";
import {
  InspectionMaster,
  InspectionDetailRow,
  QualityMatrixState,
  parseDateOnly,
  safeRenderText
} from "../types/inspection.types";
import { SupabaseAutoCompleteInput } from "../components/inspection/SupabaseAutoCompleteInput";
import { InspectionBasicInfoCard } from "../components/inspection/InspectionBasicInfoCard";
import { InspectionLorrySettlementCard } from "../components/inspection/InspectionLorrySettlementCard";
import { InspectionCommoditySpecsCard } from "../components/inspection/InspectionCommoditySpecsCard";
import { InspectionHistoricSearchModal } from "../components/inspection/InspectionHistoricSearchModal";
import { MaterialInspectionRegisterView } from "../components/inspection/MaterialInspectionRegisterView";


export default function MaterialInspection({
  onClose,
  onLogEvent,
}: {
  onClose?: () => void;
  onLogEvent?: (event: string, details: string) => void;
}) {
  // Autocomplete lists from database
  const [brokers, setBrokers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [markas, setMarkas] = useState<any[]>([]);
  const [arrivalVouchers, setArrivalVouchers] = useState<any[]>([]);
  const [deductionMasterList, setDeductionMasterList] = useState<any[]>([]);
  const [selectedPoData, setSelectedPoData] = useState<any>(null);
  const [selectedDeductionTypes, setSelectedDeductionTypes] = useState<string[]>([]);
  const [isDeductionDropdownOpen, setIsDeductionDropdownOpen] = useState(false);

  // Page States
  const [viewMode, setViewMode] = useState<"dashboard" | "entry">("dashboard");
  const [isEditMode, setIsEditMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [currentTab, setCurrentTab] = useState<"inspections" | "pending_mr">("inspections");

  const [selectedMrNos, setSelectedMrNos] = useState<string[]>([]);
  const [printedInspections, setPrintedInspections] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("printed_inspections") === "undefined" ? "{}" : (localStorage.getItem("printed_inspections") || "{}"));
    } catch {
      return {};
    }
  });
  const [printingBatch, setPrintingBatch] = useState<{ master: InspectionMaster; details: any[] }[] | null>(null);

  const markAsPrinted = (mrNos: string[]) => {
    setPrintedInspections((prev) => {
      const updated = { ...prev };
      mrNos.forEach((no) => {
        updated[no] = true;
      });
      try {
        localStorage.setItem("printed_inspections", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save printed inspections:", err);
      }
      return updated;
    });
  };

  const logPrintEvent = async (mrNos: string[]) => {
    const currentUser = getCurrentUserContext().username || "prosunmajhi@gmail.com";
    const timestamp = new Date().toISOString();
    const logEntry = {
      id: Math.random().toString(36).substring(2, 9),
      user_id: currentUser,
      timestamp,
      row_ids: mrNos,
      details: `Printed inspection reports for M.R. No(s): ${mrNos.join(", ")}`,
    };

    try {
      const existingLogs = JSON.parse(localStorage.getItem("mill_inspection_print_logs") === "undefined" ? "[]" : (localStorage.getItem("mill_inspection_print_logs") || "[]"));
      localStorage.setItem("mill_inspection_print_logs", JSON.stringify([logEntry, ...existingLogs]));
    } catch (err) {
      console.error("Local print event log error:", err);
    }

    try {
      if (supabase) {
        await supabase.from("mill_inspection_print_logs").insert({
          user_id: currentUser,
          row_ids: mrNos,
          timestamp,
          details: logEntry.details,
        });
      }
    } catch (err) {
      console.warn("Bypassed remote db print event insert:", err);
    }

    if (onLogEvent) {
      onLogEvent("PRINT_INSPECTION", `User ${currentUser} triggered printing of inspection report(s) for MR No(s): ${mrNos.join(", ")}`);
    }
  };

  const handleBatchPrint = async () => {
    if (selectedMrNos.length === 0) {
      alert("Please select at least one inspection record to print.");
      return;
    }
    setLoading(true);
    try {
      const batchItems: { master: InspectionMaster; details: any[] }[] = [];
      for (const mrNo of selectedMrNos) {
        const master = savedInspections.find((item) => item.mr_no === mrNo);
        if (!master) continue;

        const poNo = master.po_no || master.mill_po_no;
        if (poNo && supabase) {
          try {
            const poClean = String(poNo).trim();
            const { data: scp } = await supabase
              .from('sauda_check_point')
              .select('*')
              .eq('po_no', poClean)
              .maybeSingle();

            if (scp) {
              const isClosed = scp.status === 'closed' || scp.is_closed === true || scp.status === 'final' || scp.status === 'moved_to_final' || scp.status === 'settled';
              
              const { data: matMismatches } = await supabase
                .from('material_mismatch')
                .select('*')
                .eq('po_no', poClean);
              const { data: satMismatches } = await supabase
                .from('satta_mismatch')
                .select('*')
                .eq('po_no', poClean);

              const hasActiveMatMismatch = (matMismatches || []).some(m => {
                const st = String(m.status || m.resolution_status || '').toLowerCase();
                return st !== 'resolved' && st !== 'cleared' && st !== 'approved';
              });
              const hasActiveSatMismatch = (satMismatches || []).some(m => {
                const st = String(m.status || m.resolution_status || '').toLowerCase();
                return st !== 'resolved' && st !== 'cleared' && st !== 'approved';
              });

              const isCleared = scp.mismatch_cleared === true || scp.mismatch_cleared === 'true' || scp.satta_dispute_approved === true || scp.satta_dispute_approved === 'true';
              const isMismatch = !isCleared && (hasActiveMatMismatch || hasActiveSatMismatch || scp.pass_status === 'mismatch');

              if (!isClosed || isMismatch) {
                alert(`M.R. No. ${mrNo} (P.O. ${poClean}) skipped: Sauda Check Point is not CLOSED or has an unresolved mismatch.`);
                continue;
              }
            }
          } catch (err) {
            console.warn("Error validating print permissions in batch:", err);
          }
        }

        let details: any[] = [];
        if (supabase) {
          const { data, error } = await supabase
            .from("mill_inspection_detail")
            .select("*")
            .eq("mr_no", mrNo)
            .order("srl_no", { ascending: true });
          if (!error && data) {
            details = data.map((row: any) => {
              if ((row.quantity === 0 || row.quantity === "" || row.quantity == null) && Number(row.challan_gross_wt) > 0) {
                return {
                  ...row,
                  quantity: Math.round(Number(row.challan_gross_wt))
                };
              }
              return row;
            });
          }
        }
        batchItems.push({ master, details });
      }

      if (batchItems.length === 0) {
        alert("Could not load details for selected inspections.");
        return;
      }

      await logPrintEvent(selectedMrNos);
      markAsPrinted(selectedMrNos);
      setPrintingBatch(batchItems);
    } catch (err: any) {
      console.error("Batch print preparation issues:", err);
      alert("Failed to compile batch report details: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const [printingInspection, setPrintingInspection] =
    useState<InspectionMaster | null>(null);
  const [printingInspectionDetails, setPrintingInspectionDetails] = useState<
    InspectionDetailRow[]
  >([]);

  const handlePreparePrintInspection = async (
    insp: InspectionMaster,
    e?: React.MouseEvent,
  ) => {
    if (e) {
      e.stopPropagation();
    }

    const poNo = insp.po_no || insp.mill_po_no;
    if (poNo && supabase) {
      try {
        const poClean = String(poNo).trim();
        const { data: scp } = await supabase
          .from('sauda_check_point')
          .select('*')
          .eq('po_no', poClean)
          .maybeSingle();

        if (scp) {
          const isClosed = scp.status === 'closed' || scp.is_closed === true || scp.status === 'final' || scp.status === 'moved_to_final' || scp.status === 'settled';
          
          const { data: matMismatches } = await supabase
            .from('material_mismatch')
            .select('*')
            .eq('po_no', poClean);
          const { data: satMismatches } = await supabase
            .from('satta_mismatch')
            .select('*')
            .eq('po_no', poClean);

          const hasActiveMatMismatch = (matMismatches || []).some(m => {
            const st = String(m.status || m.resolution_status || '').toLowerCase();
            return st !== 'resolved' && st !== 'cleared' && st !== 'approved';
          });
          const hasActiveSatMismatch = (satMismatches || []).some(m => {
            const st = String(m.status || m.resolution_status || '').toLowerCase();
            return st !== 'resolved' && st !== 'cleared' && st !== 'approved';
          });

          const isCleared = scp.mismatch_cleared === true || scp.mismatch_cleared === 'true' || scp.satta_dispute_approved === true || scp.satta_dispute_approved === 'true';
          const isMismatch = !isCleared && (hasActiveMatMismatch || hasActiveSatMismatch || scp.pass_status === 'mismatch');

          if (!isClosed || isMismatch) {
            alert(`Mill Inspection Print Not Allowed!\n\nThis Purchase Order (${poClean}) does not satisfy the required conditions:\n- Sauda Check Point Status must be CLOSED (Current: ${isClosed ? 'CLOSED' : 'OPEN'})\n- Pass/Mismatch must be PASS (Current: ${isMismatch ? 'MISMATCH' : 'PASS'})\n\nPlease ensure Sauda Check Point is Closed and there are no unresolved mismatches before printing.`);
            return;
          }
        }
      } catch (err) {
        console.warn("Error validating print permissions:", err);
      }
    }

    setLoading(true);
    try {
      let details: any[] = [];
      if (viewMode === "entry" && detailsList && detailsList.length > 0) {
        // Filter out blank rows from the live form edit state
        details = detailsList.filter(
          (row) =>
            row.arrival_grade ||
            row.stock_grade_code ||
            row.area ||
            row.agency ||
            row.marka ||
            row.lot ||
            row.quantity ||
            row.challan_gross_wt
        );
      } else if (supabase) {
        const { data, error } = await supabase
          .from("mill_inspection_detail")
          .select("*")
          .eq("mr_no", insp.mr_no)
          .order("srl_no", { ascending: true });
        if (!error && data) {
          details = data.map((row: any) => {
            if ((row.quantity === 0 || row.quantity === "" || row.quantity == null) && Number(row.challan_gross_wt) > 0) {
              return {
                ...row,
                quantity: Math.round(Number(row.challan_gross_wt))
              };
            }
            return row;
          });
        }
      }

      setPrintingInspection(insp);
      setPrintingInspectionDetails(details);
      await logPrintEvent([insp.mr_no]);
      markAsPrinted([insp.mr_no]);
    } catch (err: any) {
      console.error("Failed to prepare printing details:", err);
      alert("Error loading print data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = () => {
    try {
      if (filteredSavedInspections.length === 0) {
        alert("No filtered inspection records found to export.");
        return;
      }

      const dataToExport = filteredSavedInspections.map((row: any) => ({
        "M.R. No.": row.mr_no,
        "M.R. Date": row.mr_date || "",
        "Supplier/Merchant": row.supplier_name || "-",
        "Broker Name": row.broker_name || "-",
        "P.O. Reference": row.po_no ? `#${row.po_no}` : "-",
        "Moisture %": row.actual_moisture || "-",
        "Weft Dust %": row.actual_dust || "-",
        "NCV %": row.actual_ncv || "-",
        "Detn. Days": row.detention_days ?? 0,
        "Arrival No": row.arrival_no || "-",
        "Unloading Date": row.unloading_date || "-",
        "Print Status": printedInspections[row.mr_no] ? "Printed" : "Pending"
      }));

      const sanitizedData = sanitizeCsvData(dataToExport);
      const csv = Papa.unparse(sanitizedData);
      const csvContent = "\uFEFF" + csv;
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Mill_Inspections_Filtered_Export_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Export to Excel failed:", err);
      alert("Failed to export: " + err.message);
    }
  };

  const handleCsvDownload = async () => {
    try {
      if (!supabase) {
        alert("Database connection client is not available.");
        return;
      }
      setLoading(true);
      const { data: fullData, error } = await supabase
        .from("mill_inspection_master")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!fullData || fullData.length === 0) {
        alert("No inspection records found in database to export.");
        return;
      }

      const dataToExport = fullData.map((row: any) => ({
        "M.R. No": row.mr_no,
        "M.R. Date": row.mr_date
          ? new Date(row.mr_date).toLocaleDateString("en-GB")
          : "",
        "Arrival No": row.arrival_no || "",
        "Arrival Date": row.arrival_date
          ? new Date(row.arrival_date).toLocaleDateString("en-GB")
          : "",
        "P.O. No": row.po_no || "",
        "P.O. Date": row.po_date
          ? new Date(row.po_date).toLocaleDateString("en-GB")
          : "",
        "Broker Name": row.broker_name || "",
        "Supplier Name": row.supplier_name || "",
        "Actual Moisture %": row.actual_moisture || 0,
        "Claim Moisture %": row.claim_moisture || 0,
        "Actual Dust %": row.actual_dust || 0,
        "Claim Dust %": row.claim_dust || 0,
        "Actual NCV %": row.actual_ncv || 0,
        "Claim NCV %": row.claim_ncv || 0,
        "Detention Days": row.detention_days || 0,
        "Unloading Date": row.unloading_date
          ? new Date(row.unloading_date).toLocaleDateString("en-GB")
          : "",
        "Mill P.O. No": row.mill_po_no || "",
        "Mill P.O. Date": row.mill_po_date
          ? new Date(row.mill_po_date).toLocaleDateString("en-GB")
          : "",
        "MR Spcl Print": row.mr_spcl_print || "",
        Remarks: row.remarks || "",
        "Created At": row.created_at || "",
      }));

      const sanitizedData = sanitizeCsvData(dataToExport);
      const csv = Papa.unparse(sanitizedData);
      const csvContent = "\uFEFF" + csv;
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Mill_Inspections_Full_Export_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Inspection CSV Export failed:", err);
      alert("Failed to export: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Masters Search List Modal
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [savedInspections, setSavedInspections] = useState<any[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [finalArrivals, setFinalArrivals] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  // New dashboard features states
  const [arrivalStartDate, setArrivalStartDate] = useState("");
  const [arrivalEndDate, setArrivalEndDate] = useState("");

  // 100-rows per page pagination (searches full dataset, displays paginated)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [pendingCurrentPage, setPendingCurrentPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(100);

  useEffect(() => {
    setCurrentPage(1);
    setPendingCurrentPage(1);
  }, [searchFilter, arrivalStartDate, arrivalEndDate]);
  const [expandedMrNo, setExpandedMrNo] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, InspectionDetailRow[]>>({});
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false);
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    select: true,
    mr_no: true,
    mr_date: true,
    supplier: true,
    broker: true,
    po_ref: true,
    moisture: true,
    weft_dust: true,
    ncv: true,
    detn_days: true,
    arrival_no: true,
    unloading: true,
    print_status: true,
    lorry_number: true,
    gate_entry_time: true,
    actions: true,
  });

  const columnLabels: Record<string, string> = {
    select: "Selection Box",
    mr_no: "M.R. Number",
    mr_date: "M.R. Date",
    supplier: "Supplier/Merchant",
    broker: "Broker Name",
    po_ref: "P.O. Reference",
    moisture: "Moisture %",
    weft_dust: "Weft Dust %",
    ncv: "NCV %",
    detn_days: "Detention Days",
    arrival_no: "Arrival No",
    unloading: "Unloading Date",
    print_status: "Print Status",
    lorry_number: "Lorry Number",
    gate_entry_time: "Gate Entry Time",
    actions: "Actions",
  };

  // Default initial blank State
  const initialMasterState = (): InspectionMaster => ({
    mr_no: `MR/INSP/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`,
    mr_date: new Date().toISOString().split("T")[0],
    arrival_no: "",
    arrival_date: new Date().toISOString().split("T")[0],
    po_no: "",
    po_date: new Date().toISOString().split("T")[0],
    broker_name: "",
    supplier_name: "",
    lorry_number: "",
    actual_moisture: 0,
    claim_moisture: 0,
    actual_dust: 0,
    claim_dust: 0,
    actual_ncv: 0,
    claim_ncv: 0,
    detention_days: 0,
    unloading_date: new Date().toISOString().split("T")[0],
    mill_po_no: "",
    mill_po_date: new Date().toISOString().split("T")[0],
    mr_spcl_print: "",
    remarks: "",
    delivery_claim: 0,
    deduction_type: "",
    deduction_types: [],
    deduction_rate: 0,
    deduction_qty: 0,
    deduction_amount: 0,
    advance_amount: 0,
    on_account_advance_amount: 0,
    settlement_amount: 0,
    sent_settlement_date: "",
    lorry_returned: "No",
    lorry_returned_other_mill: "No",
    mr_print_date: new Date().toISOString().split("T")[0],
    consignment_no: "",
    consignment_date: new Date().toISOString().split("T")[0],
    arrival_remarks: "",
    arival_apmc_fees: 0,
  });

  const createEmptyRow = (srl: number): InspectionDetailRow => ({
    srl_no: srl,
    arrival_grade: "",
    stock_grade_code: "",
    stock_grade_name: "",
    area: "",
    agency: "",
    marka: "",
    crop_year: "2026-2027",
    lot: "",
    quantity: "",
    unit: "BALES",
    challan_gross_wt: "",
    receipt_gross_wt: "",
  });

  const [showWeightsBreakdown, setShowWeightsBreakdown] = useState<boolean>(true);
  const [unitList, setUnitList] = useState<string[]>(["BALES", "DRUMS", "LOOSE", "P.BALES", "H.BALES", "BAGS", "KGS", "M.T."]);
  const [moistureLogicRules, setMoistureLogicRules] = useState<any[]>([]);

  // User role & Admin detection
  const userCtx = getCurrentUserContext();
  const currentUser = userCtx.username || "prosunmajhi@gmail.com";
  const userRole = (userCtx.userRole || "").toUpperCase();
  const isAdmin = currentUser.toLowerCase().includes("admin") || userRole.includes("ADMIN");

  // Auto-calculated past values and manual override tracking
  const [autoValues, setAutoValues] = useState({
    claim_moisture: 0,
    claim_dust: 0,
    claim_ncv: 0,
  });

  const [overriddenFields, setOverriddenFields] = useState({
    claim_moisture: false,
    claim_dust: false,
    claim_ncv: false,
  });

  const [adminApproved, setAdminApproved] = useState<{ [key: string]: boolean }>({
    claim_moisture: false,
    claim_dust: false,
    claim_ncv: false,
  });

  const [hoveredField, setHoveredField] = useState<string | null>(null);

  // Calculate Claim Moisture % based on moisture_logic rules
  // Formula: Claim Moisture % = CEIL(MAX(0, Actual Moisture % - Applicable Moisture %))
  const calculateClaimMoisture = (
    actualM: number,
    dateStr: string,
    areaStr: string,
    rules: any[] = []
  ): number => {
    if (!actualM || actualM <= 0) return 0;

    let month = 7;
    if (dateStr) {
      const trimmed = String(dateStr).trim();
      const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (isoMatch) {
        month = parseInt(isoMatch[2], 10) || 7;
      } else {
        const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (ddmmyyyyMatch) {
          month = parseInt(ddmmyyyyMatch[2], 10) || 7;
        } else {
          const parts = trimmed.split("-");
          if (parts.length === 3) {
            if (parts[0].length === 4) month = parseInt(parts[1], 10) || 7;
            else if (parts[2].length === 4) month = parseInt(parts[1], 10) || 7;
          }
        }
      }
    }

    const isWetSeason = month >= 1 && month <= 6;
    const seasonKeyword = isWetSeason ? "JANUARY TO JUNE" : "JULY TO DECEMBER";
    const cleanArea = String(areaStr || "").trim().toUpperCase();
    const isDaisee = cleanArea.includes("DAISEE");

    let threshold = isDaisee ? (isWetSeason ? 18 : 20) : (isWetSeason ? 16 : 18);

    const allRules = rules && rules.length > 0 ? rules : [
      { season: "JULY TO DECEMBER (DRY SEASON)", operating_area: "DAISEE Operating Areas", threshold_limit: "Moisture threshold limit is 20%" },
      { season: "JANUARY TO JUNE (WET SEASON)", operating_area: "DAISEE Operating Areas", threshold_limit: "Moisture threshold limit is 18%" },
      { season: "JULY TO DECEMBER (DRY SEASON)", operating_area: "Standard / Non-DAISEE", threshold_limit: "Moisture threshold limit is 18%" },
      { season: "JANUARY TO JUNE (WET SEASON)", operating_area: "Standard / Non-DAISEE", threshold_limit: "Moisture threshold limit is 16%" },
    ];

    const exactMatch = allRules.find((r) => {
      const rSeason = (r.season || "").toUpperCase();
      const rArea = (r.operating_area || "").toUpperCase();
      const seasonMatch = rSeason.includes(seasonKeyword);
      return seasonMatch && cleanArea && rArea === cleanArea;
    });

    const categoryMatch = allRules.find((r) => {
      const rSeason = (r.season || "").toUpperCase();
      const rArea = (r.operating_area || "").toUpperCase();
      const seasonMatch = rSeason.includes(seasonKeyword);
      const areaMatch = isDaisee ? (rArea.includes("DAISEE") && !rArea.includes("NON-DAISEE")) : (rArea.includes("NON-DAISEE") || rArea.includes("STANDARD") || (!rArea.includes("DAISEE") && cleanArea && (rArea.includes(cleanArea) || cleanArea.includes(rArea))));
      return seasonMatch && areaMatch;
    });

    const matched = exactMatch || categoryMatch;
    if (matched && matched.threshold_limit) {
      const matchVal = String(matched.threshold_limit).match(/(\d+(\.\d+)?)/);
      if (matchVal) {
        threshold = parseFloat(matchVal[1]);
      }
    }

    const excess = actualM - threshold;
    if (excess <= 0) return 0;
    return Math.ceil(excess);
  };

  const [masterData, setMasterData] =
    useState<InspectionMaster>(initialMasterState());
  const [detailsList, setDetailsList] = useState<InspectionDetailRow[]>(
    [1, 2, 3, 4, 5].map(createEmptyRow),
  );

  const initialQualityMatrix = () => ({
    grade_down: {
      '1st': { dept: '', claim: '', sett: '' },
      '2nd': { dept: '', claim: '', sett: '' },
      '3rd': { dept: '', claim: '', sett: '' },
      '4th': { dept: '', claim: '', sett: '' },
    },
    moisture: {
      '1st': { dept: '', claim: '', sett: '' },
      '2nd': { dept: '', claim: '', sett: '' },
      '3rd': { dept: '', claim: '', sett: '' },
      '4th': { dept: '', claim: '', sett: '' },
    },
    dust: {
      '1st': { dept: '', claim: '', sett: '' },
      '2nd': { dept: '', claim: '', sett: '' },
      '3rd': { dept: '', claim: '', sett: '' },
      '4th': { dept: '', claim: '', sett: '' },
    },
    moc: {
      '1st': { dept: '', claim: '', sett: '' },
      '2nd': { dept: '', claim: '', sett: '' },
      '3rd': { dept: '', claim: '', sett: '' },
      '4th': { dept: '', claim: '', sett: '' },
    },
    po_rate: {
      '1st': { dept: '', claim: '', sett: '' },
      '2nd': { dept: '', claim: '', sett: '' },
      '3rd': { dept: '', claim: '', sett: '' },
      '4th': { dept: '', claim: '', sett: '' },
    },
  });

  const [qualityMatrix, setQualityMatrix] = useState<any>(initialQualityMatrix());
  const [showAllFourSpecs, setShowAllFourSpecs] = useState(true);

  const hasDataInRow = (i: number) => {
    const row = detailsList[i];
    if (!row) return false;
    return Boolean(
      (row.arrival_grade && row.arrival_grade.trim()) ||
      (row.quantity && String(row.quantity).trim() !== '' && Number(row.quantity) > 0) ||
      (row.challan_gross_wt && String(row.challan_gross_wt).trim() !== '' && Number(row.challan_gross_wt) > 0) ||
      (row.agency && row.agency.trim()) ||
      (row.area && row.area.trim()) ||
      (row.marka && row.marka.trim())
    );
  };

  const show3rdAnd4th = showAllFourSpecs || hasDataInRow(2) || hasDataInRow(3);

  const updateMatrixVal = (rowKey: string, colKey: string, subKey: string, val: string) => {
    setQualityMatrix((prev: any) => ({
      ...prev,
      [rowKey]: {
        ...prev[rowKey],
        [colKey]: {
          ...(prev[rowKey]?.[colKey] || {}),
          [subKey]: val,
        },
      },
    }));
  };

  // Fetch Master Data references on load to feed datalists (autocompletion)
  const loadAllMasters = async () => {
    try {
      if (supabase) {
        const withTimeout = (promise: Promise<any>, ms: number = 3000) => {
          return Promise.race([
            promise,
            new Promise(resolve => setTimeout(() => resolve({ data: null, error: 'timeout' }), ms))
          ]);
        };

        const [
          { data: b },
          { data: s },
          { data: g },
          { data: ar },
          { data: ag },
          { data: m },
          { data: av },
          { data: uData },
          { data: mL },
          dData,
        ] = await Promise.all([
          withTimeout(Promise.resolve(supabase.from("broker_master").select("brok_name").order("brok_name").limit(150))),
          withTimeout(Promise.resolve(supabase.from("supply_master").select("supp_name").order("supp_name").limit(150))),
          withTimeout(Promise.resolve(supabase.from("grade_master").select("grade_code, grade_name").order("grade_code").limit(150))),
          withTimeout(Promise.resolve(supabase.from("area_master").select("area_name").order("area_name").limit(150))),
          withTimeout(Promise.resolve(supabase.from("agency_master").select("agency_name").order("agency_name").limit(150))),
          withTimeout(Promise.resolve(supabase.from("marka_master").select("marka_name").order("marka_name").limit(150))),
          withTimeout(Promise.resolve(supabase.from("mill_inspection_master").select("*").order("created_at", { ascending: false }).limit(250))),
          withTimeout(Promise.resolve(supabase.from("unit_master").select("unit_name").order("unit_name").limit(150))),
          withTimeout(Promise.resolve(supabase.from("moisture_logic").select("*"))),
          withTimeout(Promise.resolve(supabase.from("deduction_master").select("*"))).then((r: any) => r?.data || [], () => []),
        ]);

        if (b) setBrokers(b.map((x: any) => ({ name: x.brok_name })));
        if (s) setSuppliers(s.map((x: any) => ({ name: x.supp_name })));
        if (g) setGrades(g.map((x: any) => ({ code: x.grade_code, name: x.grade_name })));
        if (ar) setAreas(ar.map((x: any) => ({ name: x.area_name })));
        if (ag) setAgencies(ag.map((x: any) => ({ name: x.agency_name })));
        if (m) setMarkas(m.map((x: any) => ({ name: x.marka_name })));
        if (av) {
          const mapped = av.map((v: any) => ({
            ...v,
            temporary_arrival_no: v.arrival_no || v.temporary_arrival_no || v.ref_arrival_no || v.mr_no,
            supplier: v.supplier_name || v.supplier,
            broker: v.broker_name || v.broker,
          }));
          setArrivalVouchers(mapped);
        }
        if (uData && uData.length > 0) {
          const fetchedUnits = uData.map((x: any) => x.unit_name).filter(Boolean);
          setUnitList(prev => Array.from(new Set([...fetchedUnits, ...prev])));
        }
        if (mL && mL.length > 0) {
          setMoistureLogicRules(mL);
        }

        const defaultDeductions = [
          { deduction: "Shortage", rate_per_qntl: 0 },
          { deduction: "Moisture Excess", rate_per_qntl: 0 },
          { deduction: "Tare Loss", rate_per_qntl: 0 },
          { deduction: "Quality Rebate", rate_per_qntl: 0 },
          { deduction: "Freight Penalty", rate_per_qntl: 0 },
          { deduction: "Insurance Claim", rate_per_qntl: 0 },
          { deduction: "Late Delivery", rate_per_qntl: 0 },
          { deduction: "Grade Down Claim", rate_per_qntl: 0 },
          { deduction: "Dust Claim", rate_per_qntl: 0 },
          { deduction: "NCV Claim", rate_per_qntl: 0 },
          { deduction: "Miscellaneous", rate_per_qntl: 0 },
        ];
        if (dData && dData.length > 0) {
          setDeductionMasterList(dData);
        } else {
          setDeductionMasterList(defaultDeductions);
        }
      } else {
        const [b, s, g, ar, ag, m, av] = await Promise.all([
          dbModule.fetchAll('broker_master').catch(() => []),
          dbModule.fetchAll('supply_master').catch(() => []),
          dbModule.fetchAll('grade_master').catch(() => []),
          dbModule.fetchAll('area_master').catch(() => []),
          dbModule.fetchAll('agency_master').catch(() => []),
          dbModule.fetchAll('marka_master').catch(() => []),
          dbModule.fetchAll('mill_inspection_master', 'created_at', false).catch(() => []),
        ]);
        if (b) setBrokers(b.map((x: any) => ({ name: x.brok_name })));
        if (s) setSuppliers(s.map((x: any) => ({ name: x.supp_name })));
        if (g) setGrades(g.map((x: any) => ({ code: x.grade_code, name: x.grade_name })));
        if (ar) setAreas(ar.map((x: any) => ({ name: x.area_name })));
        if (ag) setAgencies(ag.map((x: any) => ({ name: x.agency_name })));
        if (m) setMarkas(m.map((x: any) => ({ name: x.marka_name })));
        if (av) {
          const mapped = av.map((v: any) => ({
            ...v,
            temporary_arrival_no: v.arrival_no || v.temporary_arrival_no || v.ref_arrival_no || v.mr_no,
            supplier: v.supplier_name || v.supplier,
            broker: v.broker_name || v.broker,
          }));
          setArrivalVouchers(mapped);
        }
      }
    } catch (err) {
      console.warn("Failed to load autocomplete lists:", err);
    }
  };

  const handleRefreshDatabase = async () => {
    setLoading(true);
    await loadAllMasters();
    await loadSavedInspectionsList();
    setLoading(false);
  };

  useEffect(() => {
    loadAllMasters();
    loadSavedInspectionsList();

    const handleLocalUpdate = () => {
      loadAllMasters();
      loadSavedInspectionsList();
    };
    window.addEventListener('app-data-updated', handleLocalUpdate);

    let sub: any = null;
    if (supabase) {
      sub = supabase
        .channel('material_inspection_masters_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mill_inspection_master' }, () => {
          loadAllMasters();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'material_inspections' }, () => {
          loadSavedInspectionsList();
        })
        .subscribe();
    }

    return () => {
      window.removeEventListener('app-data-updated', handleLocalUpdate);
      if (sub && supabase) {
        supabase.removeChannel(sub);
      }
    };
  }, []);

  // Draft auto-save and restore disabled to ensure form is always a fresh blank form on open, per user request

  // Automatically retrieve full P.O. data from purchase_master whenever po_no changes
  useEffect(() => {
    if (!supabase || !masterData.po_no) {
      setSelectedPoData(null);
      return;
    }
    const fetchActualPoData = async () => {
      try {
        const { data, error } = await supabase
          .from("purchase_master")
          .select("*")
          .eq("po_no", masterData.po_no.trim())
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setSelectedPoData(data);
          if (data.po_date) {
            setMasterData((prev) => {
              if (prev.po_date !== data.po_date) {
                return { ...prev, po_date: data.po_date };
              }
              return prev;
            });
          }
        }

        // Fetch matching Temporary Arrival Number based on PO No
        const { data: tempArrival } = await supabase
          .from("temporary_material_received")
          .select("temporary_arrival_no")
          .eq("po_no", masterData.po_no.trim())
          .limit(1)
          .maybeSingle();

        if (tempArrival && tempArrival.temporary_arrival_no) {
          setMasterData((prev) => {
            if (prev.arrival_no !== tempArrival.temporary_arrival_no) {
              return { ...prev, arrival_no: tempArrival.temporary_arrival_no };
            }
            return prev;
          });
        } else {
          // Check final_arrival table as fallback
          const { data: finalArrival } = await supabase
            .from("final_arrival")
            .select("temporary_arrival_no")
            .eq("po_no", masterData.po_no.trim())
            .limit(1)
            .maybeSingle();

          if (finalArrival && finalArrival.temporary_arrival_no) {
            setMasterData((prev) => {
              if (prev.arrival_no !== finalArrival.temporary_arrival_no) {
                return { ...prev, arrival_no: finalArrival.temporary_arrival_no };
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn("Failed to fetch exact PO and Temporary Arrival No:", err);
      }
    };
    fetchActualPoData();
  }, [masterData.po_no]);

  // Memoized total weights summation for inspection rows
  const totalChallanGrossWt = React.useMemo(() => {
    return detailsList.reduce((acc, r) => acc + (Number(r.challan_gross_wt) || 0), 0);
  }, [detailsList]);

  const [paymentOpsInfo, setPaymentOpsInfo] = useState<{
    paidAmount: number;
    totalBill: number;
    pct: number;
    source: 'payment_master' | 'calculated_93' | null;
    voucherNo?: string | null;
    advanceDone?: string;
    loading: boolean;
  }>({
    paidAmount: 0,
    totalBill: 0,
    pct: 93.0,
    source: null,
    loading: false,
  });

  const syncAdvanceFromPaymentOperations = async (forceUpdate: boolean = false, overrideArrival?: any) => {
    try {
      const arrNo = (overrideArrival?.temporary_arrival_no || overrideArrival?.arrival_no || masterData.arrival_no || '').trim();
      const poNo = (overrideArrival?.po_no || overrideArrival?.mill_po_no || masterData.po_no || '').trim();
      const mrNo = (overrideArrival?.mr_no || masterData.mr_no || '').trim();

      if (!arrNo && !poNo && !mrNo) return;

      setPaymentOpsInfo(prev => ({ ...prev, loading: true }));

      let foundPayment: any = null;
      if (supabase) {
        if (mrNo) {
          const { data } = await supabase.from('payment_master').select('*').eq('mr_no', mrNo).maybeSingle();
          if (data) foundPayment = data;
        }
        if (!foundPayment && arrNo) {
          const { data } = await supabase.from('payment_master').select('*').or(`arrival_no.eq.${arrNo},mr_no.eq.${arrNo}`).maybeSingle();
          if (data) foundPayment = data;
        }
        if (!foundPayment && poNo) {
          const { data } = await supabase.from('payment_master').select('*').eq('po_no', poNo).maybeSingle();
          if (data) foundPayment = data;
        }
      }

      if (!foundPayment) {
        const localPay: any[] = await dbModule.fetchAll('payment_master').catch(() => []);
        foundPayment = localPay.find(p => 
          (mrNo && (p.mr_no === mrNo || p.arrival_no === mrNo)) ||
          (arrNo && (p.arrival_no === arrNo || p.mr_no === arrNo)) ||
          (poNo && p.po_no === poNo)
        );
      }

      if (foundPayment && Number(foundPayment.paid_amount || 0) > 0) {
        const paidAmt = Number(foundPayment.paid_amount || 0);
        const payableAmt = Number(foundPayment.payable_amt || foundPayment.total_amount || 0);
        const pct = payableAmt > 0 ? Math.round((paidAmt / payableAmt) * 1000) / 10 : 93.0;

        setPaymentOpsInfo({
          paidAmount: paidAmt,
          totalBill: payableAmt,
          pct,
          source: 'payment_master',
          voucherNo: foundPayment.voucher_no || null,
          advanceDone: foundPayment.advance_payment_done || 'No',
          loading: false,
        });

        if (forceUpdate || !(masterData as any).advance_amount || Number((masterData as any).advance_amount) === 0) {
          setMasterData(prev => ({
            ...prev,
            advance_amount: paidAmt,
          }));
        }
        return;
      }

      let poRecord = selectedPoData;
      if (!poRecord && poNo && supabase) {
        const { data } = await supabase.from('purchase_master').select('*').eq('po_no', poNo).maybeSingle();
        if (data) poRecord = data;
      }

      let rate = Number(poRecord?.b_rate || poRecord?.rate_qntl || poRecord?.rate || 0);
      if (rate === 0 && poNo && supabase) {
        const { data: details } = await supabase.from('purchase_detail_master').select('*').eq('po_no', poNo).limit(1);
        if (details && details.length > 0) {
          rate = Number(details[0].rate || details[0].rate_qntl || details[0].b_rate || 0);
        }
      }

      const grossWtMt = (overrideArrival && Number(overrideArrival.challan_gross_wt || overrideArrival.total_actual_weight || 0) > 0)
        ? (Number(overrideArrival.challan_gross_wt || overrideArrival.total_actual_weight) > 100 ? Number(overrideArrival.challan_gross_wt || overrideArrival.total_actual_weight) / 1000 : Number(overrideArrival.challan_gross_wt || overrideArrival.total_actual_weight))
        : (totalChallanGrossWt > 0 ? totalChallanGrossWt : Number(masterData.challan_gross_wt || 0));

      let totalBill = 0;
      if (rate > 0 && grossWtMt > 0) {
        totalBill = Math.round(grossWtMt * 10 * rate * 100) / 100;
      } else if (poRecord?.total_amount && Number(poRecord.total_amount) > 0) {
        totalBill = Number(poRecord.total_amount);
      } else if (poRecord?.contract_value && Number(poRecord.contract_value) > 0) {
        totalBill = Number(poRecord.contract_value);
      }

      const default93 = totalBill > 0 ? calculate93PctPaidAmount(totalBill) : 0;

      setPaymentOpsInfo({
        paidAmount: default93,
        totalBill,
        pct: 93.0,
        source: 'calculated_93',
        voucherNo: null,
        loading: false,
      });

      if (forceUpdate || !(masterData as any).advance_amount || Number((masterData as any).advance_amount) === 0) {
        if (default93 > 0) {
          setMasterData(prev => ({
            ...prev,
            advance_amount: default93,
          }));
        }
      }
    } catch (err) {
      console.warn("Error syncing advance amount from Payment Operations:", err);
      setPaymentOpsInfo(prev => ({ ...prev, loading: false }));
    }
  };

  React.useEffect(() => {
    syncAdvanceFromPaymentOperations(false);
  }, [masterData.arrival_no, masterData.po_no, totalChallanGrossWt]);

  const totalReceiptGrossWt = React.useMemo(() => {
    return detailsList.reduce((acc, r) => acc + (Number(r.receipt_gross_wt ?? r.challan_gross_wt) || 0), 0);
  }, [detailsList]);

  // Calculate Delivery Claim logic (Delivery To vs Receipt Date)
  const calculateDeliveryClaimVal = (): number => {
    if (!selectedPoData || !selectedPoData.delivery_to) return 0;
    const deliveryToObj = parseDateOnly(selectedPoData.delivery_to);
    const receiptDateObj = parseDateOnly(masterData.unloading_date || masterData.arrival_date || masterData.mr_date);

    if (deliveryToObj && receiptDateObj && receiptDateObj.getTime() > deliveryToObj.getTime()) {
      const diffMs = receiptDateObj.getTime() - deliveryToObj.getTime();
      const lateDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const penaltyPerDay = Number(selectedPoData.delivery_penalty) || Number(selectedPoData.shipment_penalty) || Number(selectedPoData.qty_penalty) || 0;

      const totalGrossWtMt = detailsList.reduce((acc, r) => acc + (Number(r.challan_gross_wt) || 0), 0);
      const totalQtyBalesOrQtl = detailsList.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
      const scaleQuintals = totalGrossWtMt > 0 ? (totalGrossWtMt * 10) : (totalQtyBalesOrQtl > 0 ? totalQtyBalesOrQtl : 100);

      return Number((lateDays * penaltyPerDay * scaleQuintals).toFixed(2));
    }
    return 0;
  };

  // Auto-update Delivery Claim when dates/PO/details change
  useEffect(() => {
    const autoClaim = calculateDeliveryClaimVal();
    if (autoClaim > 0 && !(masterData as any).delivery_claim) {
      setMasterData((prev) => ({
        ...prev,
        delivery_claim: autoClaim,
      }));
    }
  }, [selectedPoData, masterData.unloading_date, masterData.arrival_date, masterData.mr_date, detailsList]);

  // Handler for Multi-Select Deduction Type
  const handleToggleDeduction = (dedName: string) => {
    setSelectedDeductionTypes((prev) => {
      let next: string[];
      if (prev.includes(dedName)) {
        next = prev.filter((d) => d !== dedName);
      } else {
        next = [...prev, dedName];
      }
      const deductionStr = next.join(", ");

      let totalRate = 0;
      next.forEach((d) => {
        const matchObj = deductionMasterList.find((item) => item.deduction === d);
        if (matchObj) {
          totalRate += Number(matchObj.rate_per_unit || matchObj.rate_per_qntl || 0);
        }
      });

      const currentQty = Number((masterData as any).deduction_qty) || 1;
      const currentRate = totalRate > 0 ? totalRate : (Number((masterData as any).deduction_rate) || 0);
      const calculatedAmt = Number((currentRate * currentQty).toFixed(2));

      setMasterData((m) => ({
        ...m,
        deduction_type: deductionStr,
        deduction_types: next,
        deduction_rate: currentRate,
        deduction_qty: currentQty,
        deduction_amount: calculatedAmt,
      }));
      return next;
    });
  };

  // Sync / Load inspection records for Modal View search and selection
  const loadSavedInspectionsList = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const matInspRes = await supabase.from("material_inspection").select("*").order("created_at", { ascending: false }).then(r => r, () => ({ data: [] }));

      const combined = [
        ...((matInspRes as any)?.data || []),
      ];

      const uniqueMap = new Map();
      combined.forEach((item: any) => {
        const key = item.mr_no || item.id;
        if (key && !uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      });

      // Merge cached inspection_master_records from localStorage if present
      try {
        const cached = localStorage.getItem("inspection_master_records");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              const key = item.mr_no || item.id;
              if (key && !uniqueMap.has(key)) {
                uniqueMap.set(key, item);
              }
            });
          }
        }
      } catch (e) {}

      const allInspections = Array.from(uniqueMap.values());
      setSavedInspections(allInspections);

      // Fetch final arrivals to identify "Final received" POs
      const { data: arrivalsData, error: arrivalsErr } = await supabase
        .from("final_arrival")
        .select("*")
        .order("date", { ascending: false });
      if (!arrivalsErr && arrivalsData) {
        setFinalArrivals(arrivalsData);
      }

      // Fetch purchase master orders to calculate Pending/Received and Contract totals
      const { data: poData, error: poErr } = await supabase
        .from("purchase_master")
        .select("*")
        .order("po_date", { ascending: false });
      if (!poErr && poData) {
        setPurchaseOrders(poData.filter((po: any) => po.po_no && po.status !== 'cancelled'));
      }
    } catch (err: any) {
      setErrorMessage("Load failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger modal visibility
  const handleViewRecords = () => {
    loadSavedInspectionsList();
    setShowSearchModal(true);
  };

  const handleSyncSettlementAmount = async () => {
    if (!supabase) return;
    try {
      setLoading(true);
      let amt = 0;
      const { data: allSettles, error } = await supabase
        .from("m_r_settlement")
        .select("po_no, mr_no, lorry_number, payable_amt, quantity, amount");

      if (!error && allSettles) {
        const targetPo = (masterData.po_no || "").trim().toLowerCase();
        const targetMr = (masterData.mr_no || "").trim().toLowerCase();
        const targetLorry = (masterData.lorry_number || "").trim().toLowerCase();

        const match = allSettles.find((s: any) => {
          const sPo = (s.po_no || "").trim().toLowerCase();
          const sMr = (s.mr_no || "").trim().toLowerCase();
          const sLorry = (s.lorry_number || "").trim().toLowerCase();

          if (targetPo && sPo && sPo === targetPo) return true;
          if (targetMr && sMr && sMr === targetMr) return true;
          if (targetLorry && sLorry && sLorry === targetLorry) return true;
          return false;
        });

        if (match && Number(match.payable_amt || match.amount || 0) > 0) {
          amt = Number(match.payable_amt || match.amount);
        } else if (targetPo) {
          const poMatch = allSettles.find((s: any) => (s.po_no || "").trim().toLowerCase().includes(targetPo) || targetPo.includes((s.po_no || "").trim().toLowerCase()));
          if (poMatch && Number(poMatch.payable_amt || poMatch.amount || 0) > 0) {
            amt = Number(poMatch.payable_amt || poMatch.amount);
          }
        }
        if (amt === 0 && allSettles.length > 0) {
          const lastSettle = allSettles[allSettles.length - 1];
          if (Number(lastSettle.payable_amt || lastSettle.amount || 0) > 0) {
            amt = Number(lastSettle.payable_amt || lastSettle.amount);
          }
        }
      }

      if (amt > 0) {
        setMasterData(prev => ({ ...prev, settlement_amount: amt }));
        setSuccessMessage(`Successfully synced Settlement Amount (Settled Amt): ₹${amt.toFixed(2)}`);
      } else {
        setErrorMessage(`No settlement record found for P.O. #${masterData.po_no || 'N/A'} or M.R. #${masterData.mr_no || 'N/A'}`);
      }
    } catch (err: any) {
      setErrorMessage("Error syncing settlement amount: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load a historical inspection directly into the active workbench
  const loadInspectionIntoForm = async (insp: InspectionMaster) => {
    if (!supabase) return;
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      // Set Master fields in uppercase
      const voucher = getVoucherForInspection(insp);
      let resolvedPayableAmt = Number((insp as any).settlement_amount) || 0;
      if (!resolvedPayableAmt && insp.mr_no) {
        try {
          const { data: settData } = await supabase
            .from("m_r_settlement")
            .select("payable_amt")
            .eq("mr_no", insp.mr_no)
            .maybeSingle();
          if (settData && Number(settData.payable_amt) > 0) {
            resolvedPayableAmt = Number(settData.payable_amt);
          }
        } catch (e) {}
      }
      const poNo = insp.po_no || (insp as any).mill_po_no || "";
      if (!resolvedPayableAmt && poNo) {
        try {
          const { data: settPoData } = await supabase
            .from("m_r_settlement")
            .select("payable_amt")
            .eq("po_no", poNo)
            .limit(1);
          if (settPoData && settPoData.length > 0 && Number(settPoData[0].payable_amt) > 0) {
            resolvedPayableAmt = Number(settPoData[0].payable_amt);
          }
        } catch (e) {}
      }

      const mappedInsp = {
        ...insp,
        settlement_amount: resolvedPayableAmt > 0 ? resolvedPayableAmt : (Number((insp as any).settlement_amount) || 0),
        unloading_date: safeRenderText(insp.unloading_date || (insp as any).date || (insp as any).mr_date || (voucher as any)?.unloading_date || (voucher as any)?.date || insp.arrival_date, ""),
        po_no: safeRenderText(poNo, ""),
        broker_name: safeRenderText(insp.broker_name || (insp as any).broker || "", "").toUpperCase(),
        supplier_name: safeRenderText(insp.supplier_name || (insp as any).supplier || "", "").toUpperCase(),
        lorry_number: safeRenderText(insp.lorry_number || (voucher as any)?.lorry_number || (voucher as any)?.lorry_no || (voucher as any)?.vehicle_no, ""),
      };
      setMasterData(mappedInsp);

      const dedStr = (insp as any).deduction_type || "";
      const dedArr = dedStr
        ? dedStr.split(",").map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray((insp as any).deduction_types) ? (insp as any).deduction_types : [];
      setSelectedDeductionTypes(dedArr);

      // Fetch corresponding details rows from all detail tables
      let { data, error } = await supabase
        .from("inspection_checklist_details")
        .select("*")
        .eq("mr_no", insp.mr_no)
        .order("srl_no", { ascending: true });

      if (error || !data || data.length === 0) {
        const fallback1 = await supabase
          .from("inspection_details")
          .select("*")
          .eq("mr_no", insp.mr_no)
          .order("srl_no", { ascending: true });
        data = fallback1.data;
      }

      if (!data || data.length === 0) {
        const fallback = await supabase
          .from("mill_inspection_detail")
          .select("*")
          .eq("mr_no", insp.mr_no)
          .order("srl_no", { ascending: true });
        data = fallback.data;
      }

      if (data && data.length > 0) {
        const enrichedData = data.map((row: any) => {
          if ((row.quantity === 0 || row.quantity === "" || row.quantity == null) && Number(row.challan_gross_wt) > 0) {
            return {
              ...row,
              quantity: Math.round(Number(row.challan_gross_wt))
            };
          }
          return row;
        });
        setDetailsList(enrichedData);

        // Populate qualityMatrix from stored matrix or detail rows
        const colKeys = ['1st', '2nd', '3rd', '4th'];
        let loadedMatrix = (insp as any).quality_matrix;
        if (typeof loadedMatrix === "string") {
          try {
            loadedMatrix = JSON.parse(loadedMatrix);
          } catch (e) {}
        }
        if (!loadedMatrix || typeof loadedMatrix !== "object" || !loadedMatrix.grade_down) {
          loadedMatrix = initialQualityMatrix();
          enrichedData.slice(0, 4).forEach((row: any, i: number) => {
            const col = colKeys[i];
            loadedMatrix.grade_down[col] = {
              dept: String(row.actual_grade_down ?? row.grade_down_act ?? (i === 0 ? insp.actual_grade_down : '') ?? ''),
              claim: String(row.claim_grade_down ?? row.grade_down_claim ?? (i === 0 ? insp.claim_grade_down : '') ?? ''),
              sett: String(row.settlement_grade_down ?? '')
            };
            loadedMatrix.moisture[col] = {
              dept: String(row.actual_moisture ?? row.moisture_act ?? (i === 0 ? insp.actual_moisture : '') ?? ''),
              claim: String(row.claim_moisture ?? row.moisture_claim ?? (i === 0 ? insp.claim_moisture : '') ?? ''),
              sett: String(row.settlement_moisture ?? '')
            };
            loadedMatrix.dust[col] = {
              dept: String(row.actual_dust ?? row.dust_act ?? (i === 0 ? insp.actual_dust : '') ?? ''),
              claim: String(row.claim_dust ?? row.dust_claim ?? (i === 0 ? insp.claim_dust : '') ?? ''),
              sett: String(row.settlement_dust ?? '')
            };
            loadedMatrix.moc[col] = {
              dept: String(row.actual_ncv ?? row.ncv_act ?? (i === 0 ? insp.actual_ncv : '') ?? ''),
              claim: String(row.claim_ncv ?? row.ncv_claim ?? (i === 0 ? insp.claim_ncv : '') ?? ''),
              sett: String(row.settlement_ncv ?? '')
            };
            loadedMatrix.po_rate[col] = {
              dept: String(row.rate ?? row.rate_qntl ?? ''),
              claim: String(row.rate_claim ?? ''),
              sett: String(row.rate_sett ?? '')
            };
          });
        }
        setQualityMatrix(loadedMatrix);
      } else {
        // Fallback placeholder rows
        setDetailsList([1, 2, 3, 4, 5].map(createEmptyRow));
        setQualityMatrix(initialQualityMatrix());
      }

      setIsEditMode(true);
      setShowSearchModal(false);
      setViewMode("entry");
      setSuccessMessage(
        `Inspection Record loaded corresponding to MR No.: ${insp.mr_no}`,
      );
    } catch (err: any) {
      setErrorMessage("Error loading details: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFillFromVoucher = (voucher: any) => {
    if (!voucher) return;

    let pDetails: any[] = [];
    if (voucher.grid_details) {
      if (typeof voucher.grid_details === "string") {
        try {
          const parsed = voucher.grid_details === 'undefined' || voucher.grid_details === 'null' ? [] : JSON.parse(voucher.grid_details === "undefined" ? "null" : voucher.grid_details);
          if (Array.isArray(parsed)) {
            pDetails = parsed;
          }
        } catch (e) {
          console.error("Error parsing grid_details JSON:", e);
        }
      } else if (Array.isArray(voucher.grid_details)) {
        pDetails = voucher.grid_details;
      }
    }

    const selectedPoNo = voucher.mill_po_no || voucher.po_no || "";

    setMasterData((prev) => {
      const voucherArrivalDate = voucher.date || voucher.arrival_date || prev.arrival_date || new Date().toISOString().split("T")[0];
      const voucherUnloadingDate = voucher.unloading_date || voucher.date || voucher.arrival_date || prev.unloading_date || voucherArrivalDate;

      return {
        ...prev,
        arrival_no: safeRenderText(voucher.temporary_arrival_no || voucher.arrival_no || voucher.amad_no || prev.arrival_no, ""),
        arrival_date: safeRenderText(voucherArrivalDate, ""),
        unloading_date: safeRenderText(voucherUnloadingDate, ""),
        consignment_date: safeRenderText(voucher.consignment_date || voucher.date || voucher.arrival_date || prev.consignment_date, ""),
        mr_print_date: safeRenderText(voucher.mr_print_date || voucher.date || prev.mr_print_date, ""),
        po_no: safeRenderText(selectedPoNo || prev.po_no, ""),
        po_date: safeRenderText(voucher.mill_po_date || voucher.po_date || voucher.lorry_date || voucher.date || prev.po_date, ""),
        broker_name: safeRenderText(
          voucher.broker_name || voucher.broker || prev.broker_name || "",
          ""
        ).toUpperCase(),
        supplier_name: safeRenderText(
          voucher.supplier_name || voucher.supplier || prev.supplier_name || "",
          ""
        ).toUpperCase(),
        lorry_number: safeRenderText(voucher.lorry_number || voucher.lorry_no || voucher.vehicle_no || prev.lorry_number, ""),
        remarks: safeRenderText(voucher.remarks || prev.remarks, ""),
        arival_apmc_fees: Number(voucher.apmc_fees || 0),
      };
    });

    if (voucher.po_no && supabase) {
      (async () => {
        try {
          const { data } = await supabase
            .from("purchase_master")
            .select("po_date, purchase_unit_name")
            .eq("po_no", voucher.po_no.trim())
            .maybeSingle();
          if (data) {
            if (data.po_date) {
              setMasterData((prev) => ({
                ...prev,
                po_date: data.po_date,
              }));
            }
            if (data.purchase_unit_name) {
              const pUnit = data.purchase_unit_name.toUpperCase();
              setDetailsList((prev) =>
                prev.map((r) => ({
                  ...r,
                  unit: (!r.unit || r.unit === "BALES") ? pUnit : r.unit,
                }))
              );
            }
          }
        } catch (err) {
          console.warn("Async po_date load error:", err);
        }
      })();
    }

    const voucherUnit = (
      voucher.unit_name ||
      voucher.unit ||
      voucher.purchase_unit_name ||
      ""
    ).toUpperCase();

    // If pDetails is empty, attempt to load from purchase_detail_master
    if ((!pDetails || pDetails.length === 0) && voucher.po_no && supabase) {
      (async () => {
        try {
          const { data: pdm } = await supabase
            .from("purchase_detail_master")
            .select("*")
            .or(`po_no.eq.${voucher.po_no.trim()},po_no.ilike.${voucher.po_no.trim()}`);
          if (pdm && pdm.length > 0) {
            handleAutoFillFromVoucher({ ...voucher, grid_details: pdm });
          }
        } catch (e) {
          console.warn("Async purchase details load error:", e);
        }
      })();
    }

    if (pDetails && pDetails.length > 0) {
      const mappedDetails = pDetails.map((row: any, i: number) => {
        const qtyRcpt = Number(row.quantity_rcpt) || 0;
        const qtyChln = Number(row.quantity_chln) || 0;
        const qtyOld = Number(row.quantity) || 0;
        const netto = Number(row.netto_pnto) || 0;
        const challanGrossWt = Number(row.challan_gross_wt) || 0;

        let derivedQuantity = "";
        if (qtyRcpt > 0) derivedQuantity = String(qtyRcpt);
        else if (qtyChln > 0) derivedQuantity = String(qtyChln);
        else if (qtyOld > 0) derivedQuantity = String(qtyOld);
        else if (netto > 0) derivedQuantity = String(Math.round(netto));
        else if (challanGrossWt > 0) derivedQuantity = String(Math.round(challanGrossWt));

        const rowUnit = (
          row.unit ||
          row.unit_name ||
          voucherUnit ||
          "BALES"
        ).toUpperCase();

        const rowArea = (
          row.area_name ||
          row.area ||
          row.arrival_area_name ||
          row.arrival_area ||
          voucher.arrival_area_name ||
          voucher.arrival_area ||
          voucher.area_name ||
          voucher.area ||
          ""
        ).toUpperCase();

        const rowRate = row.rate_qntl || row.rate || row.b_rate || row.base_rate || "";

        return {
          srl_no: i + 1,
          arrival_grade: (
            row.challan_grade_name ||
            row.receipt_grade_name ||
            row.arrival_grade ||
            ""
          ).toUpperCase(),
          stock_grade_code: (row.receipt_grade_code || row.stock_grade_code || "").toUpperCase(),
          stock_grade_name: (row.receipt_grade_name || row.stock_grade_name || "").toUpperCase(),
          area: rowArea,
          agency: (row.agency_name || row.agency || "").toUpperCase(),
          marka: (row.challan_marka_name || row.marka || "").toUpperCase(),
          marks: (row.challan_marka_name || row.marks || row.marka || "").toUpperCase(),
          crop_year: (() => {
            const rawCy = String(row.crop_year || voucher.financial_year || "").trim();
            if (!rawCy) return "2026-27";
            if (rawCy === "2025-25" || rawCy === "2025-2026") return "2025-26";
            if (rawCy === "2024-2025") return "2024-25";
            if (rawCy === "2026-2027") return "2026-27";
            if (rawCy === "2027-2028") return "2027-28";
            return rawCy;
          })(),
          lot: row.lot || "",
          quantity: derivedQuantity,
          unit: rowUnit,
          rate: rowRate,
          challan_gross_wt: row.netto_pnto || row.challan_gross_wt || "",
          actual_moisture: row.moisture_act || row.actual_moisture || voucher.actual_moisture || voucher.moisture_act || "",
          claim_moisture: row.moisture_claim || row.claim_moisture || voucher.claim_moisture || voucher.moisture_claim || "",
          actual_dust: row.dust_act || row.actual_dust || voucher.actual_dust || voucher.dust_act || "",
          claim_dust: row.dust_claim || row.claim_dust || voucher.claim_dust || voucher.dust_claim || "",
          actual_ncv: row.ncv_act || row.actual_ncv || voucher.actual_ncv || voucher.ncv_act || "",
          claim_ncv: row.ncv_claim || row.claim_ncv || voucher.claim_ncv || voucher.ncv_claim || "",
          actual_grade_down: row.grade_down_act || row.actual_grade_down || voucher.actual_grade_down || voucher.grade_down_act || "",
          claim_grade_down: row.grade_down_claim || row.claim_grade_down || voucher.claim_grade_down || voucher.grade_down_claim || "",
        };
      });

      const voucherAreaHeader = (
        voucher.arrival_area_name ||
        voucher.arrival_area ||
        voucher.area_name ||
        voucher.area ||
        ""
      ).toUpperCase();

      const defaultUnit = voucherUnit || "BALES";
      while (mappedDetails.length < 5) {
        mappedDetails.push({
          srl_no: mappedDetails.length + 1,
          arrival_grade: "",
          stock_grade_code: "",
          stock_grade_name: "",
          area: voucherAreaHeader,
          agency: "",
          marka: "",
          marks: "",
          crop_year: "2026-27",
          lot: "",
          quantity: "",
          rate: "",
          unit: defaultUnit,
          challan_gross_wt: "",
          actual_moisture: "",
          claim_moisture: "",
          actual_dust: "",
          claim_dust: "",
          actual_ncv: "",
          claim_ncv: "",
          actual_grade_down: "",
          claim_grade_down: "",
        });
      }

      setDetailsList(mappedDetails);

      // Populate quality matrix
      const colKeys = ['1st', '2nd', '3rd', '4th'];
      const newMatrix = initialQualityMatrix();
      mappedDetails.slice(0, 4).forEach((row: any, i: number) => {
        const col = colKeys[i];
        newMatrix.grade_down[col] = {
          dept: String(row.actual_grade_down || (i === 0 ? masterData.actual_grade_down : '') || ''),
          claim: String(row.claim_grade_down || (i === 0 ? masterData.claim_grade_down : '') || ''),
          sett: ''
        };
        newMatrix.moisture[col] = {
          dept: String(row.actual_moisture || (i === 0 ? masterData.actual_moisture : '') || ''),
          claim: String(row.claim_moisture || (i === 0 ? masterData.claim_moisture : '') || ''),
          sett: ''
        };
        newMatrix.dust[col] = {
          dept: String(row.actual_dust || (i === 0 ? masterData.actual_dust : '') || ''),
          claim: String(row.claim_dust || (i === 0 ? masterData.claim_dust : '') || ''),
          sett: ''
        };
        newMatrix.moc[col] = {
          dept: String(row.actual_ncv || (i === 0 ? masterData.actual_ncv : '') || ''),
          claim: String(row.claim_ncv || (i === 0 ? masterData.claim_ncv : '') || ''),
          sett: ''
        };
        newMatrix.po_rate[col] = {
          dept: String(row.rate || ''),
          claim: '',
          sett: ''
        };
      });
      setQualityMatrix(newMatrix);

      setSuccessMessage(
        `Matched & Auto-filled parameter fields & ledger rows as per Jute Arrival / PO #${voucher.po_no || voucher.temporary_arrival_no || voucher.amad_no || ""}!`,
      );
    } else {
      const voucherAreaHeader = (
        voucher.arrival_area_name ||
        voucher.arrival_area ||
        voucher.area_name ||
        voucher.area ||
        ""
      ).toUpperCase();

      if (voucherAreaHeader) {
        setDetailsList((prev) =>
          prev.map((r) => ({
            ...r,
            area: r.area || voucherAreaHeader,
          }))
        );
      }
      setSuccessMessage(
        `Matched & Auto-filled parameters as per Jute Arrival / PO #${voucher.po_no || voucher.temporary_arrival_no || voucher.amad_no || ""}! Fill custom table parameters.`,
      );
    }
    syncAdvanceFromPaymentOperations(true, voucher);
  };

  // Automatically calculate claim moisture, claim dust, and claim ncv when actual parameters or rules change
  useEffect(() => {
    const actualM = Number(masterData.actual_moisture) || 0;
    const actualD = Number(masterData.actual_dust) || 0;
    const actualN = Number(masterData.actual_ncv) || 0;
    const dateStr = masterData.unloading_date || masterData.arrival_date || masterData.mr_date || new Date().toISOString().split("T")[0];
    const areaStr = detailsList.find((d) => d.area)?.area || masterData.arrival_no || "";

    const computedMoisture = calculateClaimMoisture(actualM, dateStr, areaStr, moistureLogicRules);
    const computedDust = actualD;
    const computedNcv = actualN;

    setAutoValues({
      claim_moisture: computedMoisture,
      claim_dust: computedDust,
      claim_ncv: computedNcv,
    });

    setMasterData((prev) => {
      let updated = { ...prev };
      let changed = false;

      if (!overriddenFields.claim_moisture && prev.claim_moisture !== computedMoisture) {
        updated.claim_moisture = computedMoisture;
        changed = true;
      }
      if (!overriddenFields.claim_dust && prev.claim_dust !== computedDust) {
        updated.claim_dust = computedDust;
        changed = true;
      }
      if (!overriddenFields.claim_ncv && prev.claim_ncv !== computedNcv) {
        updated.claim_ncv = computedNcv;
        changed = true;
      }

      return changed ? updated : prev;
    });
  }, [
    masterData.actual_moisture,
    masterData.actual_dust,
    masterData.actual_ncv,
    masterData.unloading_date,
    masterData.arrival_date,
    masterData.mr_date,
    detailsList,
    moistureLogicRules,
  ]);

  const revertToAuto = (fieldName: "claim_moisture" | "claim_dust" | "claim_ncv") => {
    const autoVal = autoValues[fieldName];
    setMasterData((prev) => ({ ...prev, [fieldName]: autoVal }));
    setOverriddenFields((prev) => ({ ...prev, [fieldName]: false }));
    setAdminApproved((prev) => ({ ...prev, [fieldName]: false }));
  };

  const markAsNormal = (fieldName: "claim_moisture" | "claim_dust" | "claim_ncv") => {
    setAdminApproved((prev) => ({ ...prev, [fieldName]: true }));
    setOverriddenFields((prev) => ({ ...prev, [fieldName]: false }));
  };

  // Master field inputs change handler
  const handleMasterChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (name === "broker_name" || name === "supplier_name") {
      finalValue = (value || "").toUpperCase();
    }
    // Standardize numeric type casts
    const numericFields = [
      "actual_moisture",
      "claim_moisture",
      "actual_dust",
      "claim_dust",
      "actual_ncv",
      "claim_ncv",
      "detention_days",
    ];

    if (name === "claim_moisture") {
      const numVal = finalValue === "" ? 0 : Number(finalValue);
      setOverriddenFields((prev) => ({
        ...prev,
        claim_moisture: numVal !== autoValues.claim_moisture,
      }));
    } else if (name === "claim_dust") {
      const numVal = finalValue === "" ? 0 : Number(finalValue);
      setOverriddenFields((prev) => ({
        ...prev,
        claim_dust: numVal !== autoValues.claim_dust,
      }));
    } else if (name === "claim_ncv") {
      const numVal = finalValue === "" ? 0 : Number(finalValue);
      setOverriddenFields((prev) => ({
        ...prev,
        claim_ncv: numVal !== autoValues.claim_ncv,
      }));
    }

    setMasterData((prev) => {
      const updated = {
        ...prev,
        [name]: numericFields.includes(name)
          ? finalValue === ""
            ? 0
            : Number(finalValue)
          : finalValue,
      };

      if (name === "po_no" && finalValue) {
        const matched = arrivalVouchers.find(
          (v) =>
            (v.po_no || "").toLowerCase() === finalValue.trim().toLowerCase(),
        );
        if (matched) {
          setTimeout(() => handleAutoFillFromVoucher(matched), 20);
        }
      } else if (name === "arrival_no" && finalValue) {
        const matched = arrivalVouchers.find(
          (v) =>
            (v.temporary_arrival_no || v.amad_no || "").toLowerCase() === finalValue.trim().toLowerCase(),
        );
        if (matched) {
          setTimeout(() => handleAutoFillFromVoucher(matched), 20);
        }
      }

      return updated;
    });
  };

  // Detail tables change handler
  const handleDetailChange = (
    index: number,
    field: keyof InspectionDetailRow,
    val: any,
  ) => {
    const updated = [...detailsList];

    // Typecast numbers where necessary
    let processedValue = val;
    if (field === "quantity" || field === "challan_gross_wt" || field === "receipt_gross_wt") {
      processedValue = val === "" ? "" : Number(val);
    }

    updated[index] = {
      ...updated[index],
      [field]: processedValue,
    };

    // Auto-calculate quantity based on challan_gross_wt rounding if not present
    if (field === "challan_gross_wt") {
      const rounded = Math.round(Number(processedValue) || 0);
      if (!updated[index].quantity) updated[index].quantity = rounded;
    }

    // Auto load Stock Grade Name from master list matching Code selection
    if (field === "stock_grade_code") {
      const matchedGrade = grades.find((g) => g.code === val);
      if (matchedGrade) {
        updated[index].stock_grade_name = matchedGrade.name;
      }
    }

    setDetailsList(updated);
  };

  // Double click cell row deletion handler (Mockup mandated feature)
  const handleRowDoubleClick = (index: number) => {
    if (
      window.confirm(
        `Are you sure you want to delete Single Record at Srl No. ${index + 1}?`,
      )
    ) {
      const filtered = detailsList.filter((_, i) => i !== index);
      // Re-index Srl numbers
      const finalIndexed: InspectionDetailRow[] = filtered.map((row, i) => ({
        ...row,
        srl_no: i + 1,
      }));
      // Pad empty row if too small, keeping visually neat
      while (finalIndexed.length < 5) {
        finalIndexed.push(createEmptyRow(finalIndexed.length + 1));
      }
      setDetailsList(finalIndexed);
      setSuccessMessage(`Row #${index + 1} cleared.`);
    }
  };

  // Fresh master setup (Add button trigger)
  const handleAddAction = () => {
    setMasterData(initialMasterState());
    setDetailsList([1, 2, 3, 4, 5].map(createEmptyRow));
    setOverriddenFields({ claim_moisture: false, claim_dust: false, claim_ncv: false });
    setIsEditMode(true);
    setErrorMessage("");
    setSuccessMessage(
      "Fresh Inspection log sheet initialized. Fill all parameters.",
    );
  };

  // Edit enabled trigger (Restricted to L4, L5, Admin)
  const handleEditAction = () => {
    if (!enforceEditOrDeletePermission("Edit")) {
      return;
    }
    if (!masterData.mr_no) {
      setErrorMessage(
        "No active record loaded to edit. Use 'Add' or 'View' first.",
      );
      return;
    }
    setIsEditMode(true);
    setSuccessMessage("Edit mode enabled for active record.");
  };

  // Comprehensive delete helper: removes inspection from ALL linked database tables and localStorage
  const deleteInspectionPermanently = async (target: any) => {
    if (!target) return;
    const mrNo = target.mr_no || masterData.mr_no;
    const poNo = target.po_no || target.mill_po_no || masterData.po_no;
    const arrNo = target.arrival_no || target.temporary_arrival_no || masterData.arrival_no;
    const inspNo = (target as any).inspection_no || (masterData as any).inspection_no;
    const recordId = target.id;

    if (!mrNo && !poNo && !recordId) {
      throw new Error("No record identifier found to delete.");
    }

    if (supabase) {
      // 1. Delete details across all detail tables
      const detailDeletes: PromiseLike<any>[] = [];
      if (mrNo) {
        detailDeletes.push(
          supabase.from("inspection_checklist_details").delete().eq("mr_no", mrNo),
          supabase.from("inspection_details").delete().eq("mr_no", mrNo),
          supabase.from("mill_inspection_detail").delete().eq("mr_no", mrNo),
          supabase.from("material_inspection_details").delete().eq("mr_no", mrNo)
        );
      }
      if (poNo) {
        detailDeletes.push(
          supabase.from("inspection_checklist_details").delete().eq("po_no", poNo),
          supabase.from("inspection_details").delete().eq("po_no", poNo),
          supabase.from("mill_inspection_detail").delete().eq("po_no", poNo),
          supabase.from("material_inspection_details").delete().eq("po_no", poNo)
        );
      }
      await Promise.all(detailDeletes.map(p => Promise.resolve(p).catch(() => ({}))));

      // 2. Delete masters across all master tables
      const masterDeletes: PromiseLike<any>[] = [];
      if (mrNo) {
        masterDeletes.push(
          supabase.from("inspection_checklist").delete().eq("mr_no", mrNo),
          supabase.from("inspection_master").delete().eq("mr_no", mrNo),
          supabase.from("mill_inspection_master").delete().eq("mr_no", mrNo),
          supabase.from("material_inspection").delete().eq("mr_no", mrNo),
          supabase.from("mill_inspection_print_logs").delete().eq("mr_no", mrNo)
        );
      }
      if (recordId) {
        masterDeletes.push(
          supabase.from("inspection_checklist").delete().eq("id", recordId),
          supabase.from("inspection_master").delete().eq("id", recordId),
          supabase.from("mill_inspection_master").delete().eq("id", recordId),
          supabase.from("material_inspection").delete().eq("id", recordId)
        );
      }
      if (poNo) {
        masterDeletes.push(
          supabase.from("inspection_checklist").delete().eq("po_no", poNo),
          supabase.from("inspection_master").delete().eq("po_no", poNo),
          supabase.from("mill_inspection_master").delete().eq("po_no", poNo),
          supabase.from("material_inspection").delete().eq("po_no", poNo)
        );
      }
      await Promise.all(masterDeletes.map(p => Promise.resolve(p).catch(() => ({}))));
    }

    // 3. Clean up localStorage caches
    try {
      const isTarget = (r: any) => {
        if (!r) return false;
        if (mrNo && (r.mr_no === mrNo || r.id === mrNo)) return true;
        if (recordId && r.id === recordId) return true;
        if (poNo && (r.po_no === poNo || r.mill_po_no === poNo)) return true;
        if (arrNo && (r.arrival_no === arrNo || r.temporary_arrival_no === arrNo)) return true;
        if (inspNo && r.inspection_no === inspNo) return true;
        return false;
      };

      const cachedInsp = localStorage.getItem("inspection_master_records");
      if (cachedInsp) {
        const parsed = JSON.parse(cachedInsp);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(r => !isTarget(r));
          localStorage.setItem("inspection_master_records", JSON.stringify(filtered));
        }
      }
      const cachedMat = localStorage.getItem("material_inspection_records");
      if (cachedMat) {
        const parsed = JSON.parse(cachedMat);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(r => !isTarget(r));
          localStorage.setItem("material_inspection_records", JSON.stringify(filtered));
        }
      }
      localStorage.removeItem("AUTOSAVE_MATERIAL_INSPECTION");
    } catch (e) {
      console.warn("Storage cleanup warning:", e);
    }

    // 4. Update local component state
    setSavedInspections(prev => prev.filter(r => {
      if (mrNo && r.mr_no === mrNo) return false;
      if (recordId && r.id === recordId) return false;
      if (poNo && (r.po_no === poNo || r.mill_po_no === poNo)) return false;
      return true;
    }));

    // 5. Notify the rest of the application
    window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: 'inspection_master', mr_no: mrNo } }));
    window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: 'mill_inspection_master', mr_no: mrNo } }));
    window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: 'inspection_checklist', mr_no: mrNo } }));
  };

  // Delete current transaction fully (Restricted to L4, L5, Admin)
  const handleDeleteAction = async () => {
    if (!enforceEditOrDeletePermission("Delete")) {
      return;
    }

    const targetMrNo = masterData.mr_no || masterData.po_no;
    if (!targetMrNo) {
      setErrorMessage("No active record loaded to delete.");
      return;
    }

    if (
      !window.confirm(
        `Permanently delete all logs for MR No.: ${targetMrNo}? This will delete the inspection from all database tables.`,
      )
    )
      return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await deleteInspectionPermanently(masterData);

      setSuccessMessage(
        `Inspection report ${targetMrNo} completely purged from all respective tables.`,
      );
      setMasterData(initialMasterState());
      setDetailsList([1, 2, 3, 4, 5].map(createEmptyRow));
      setIsEditMode(false);
      setViewMode("dashboard");
      await loadSavedInspectionsList();
    } catch (err: any) {
      setErrorMessage("Delete operation halted: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset to neutral blank form (Cancel button trigger)
  const handleCancelAction = () => {
    try {
      localStorage.removeItem("AUTOSAVE_MATERIAL_INSPECTION");
    } catch (e) {
      console.warn(e);
    }
    setMasterData(initialMasterState());
    setDetailsList([1, 2, 3, 4, 5].map(createEmptyRow));
    setOverriddenFields({ claim_moisture: false, claim_dust: false, claim_ncv: false });
    setIsEditMode(false);
    setErrorMessage("");
    setSuccessMessage("");
    setViewMode("dashboard");
    loadSavedInspectionsList();
  };

  // Add detail row button helper
  const handleAddNewGridRow = () => {
    const nextSrl = detailsList.length + 1;
    setDetailsList((prev) => [...prev, createEmptyRow(nextSrl)]);
  };

  // Delete last detail row button helper
  const handleDeleteLastGridRow = () => {
    if (detailsList.length === 0) return;
    const lastIndex = detailsList.length - 1;
    const filtered = detailsList.filter((_, i) => i !== lastIndex);
    const finalIndexed = filtered.map((row, i) => ({
      ...row,
      srl_no: i + 1,
    }));
    setDetailsList(finalIndexed);
    setSuccessMessage(`Row #${lastIndex + 1} removed.`);
  };

  // Master validation and save script
  const handleSaveAction = async (e?: React.FormEvent | boolean) => {
    if (typeof e === 'object' && e && 'preventDefault' in e) {
      e.preventDefault();
    }
    if (!supabase) {
      setErrorMessage(
        "Local mock persistence failed. Direct database offline.",
      );
      return;
    }

    const missingFields: string[] = [];
    if (!masterData.mr_no.trim()) missingFields.push("MR No");

    const activeInspectionRows = detailsList.filter(
      (row) => row.arrival_grade || row.stock_grade_code || row.area || row.agency || (Number(row.quantity) || 0) > 0 || (Number(row.challan_gross_wt) || 0) > 0
    );

    if (activeInspectionRows.length === 0) {
      missingFields.push("At least one valid inspection row in details grid");
    }

    if (missingFields.length > 0) {
      const errTxt = "Please complete the required fields for Material Inspection:\n• " + missingFields.join("\n• ");
      setErrorMessage(errTxt);
      alert(errTxt);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Master payload
      const masterPayload = {
        mr_no: masterData.mr_no,
        mr_date: masterData.mr_date || null,
        date: masterData.mr_date || masterData.arrival_date || null,
        arrival_no: masterData.arrival_no,
        arrival_date: masterData.arrival_date || null,
        po_no: masterData.po_no,
        po_date: masterData.po_date || null,
        broker_name: masterData.broker_name,
        broker: masterData.broker_name,
        supplier_name: masterData.supplier_name,
        supplier: masterData.supplier_name,
        actual_moisture: masterData.actual_moisture,
        claim_moisture: masterData.claim_moisture,
        actual_dust: masterData.actual_dust,
        claim_dust: masterData.claim_dust,
        actual_ncv: masterData.actual_ncv,
        claim_ncv: masterData.claim_ncv,
        detention_days: masterData.detention_days,
        unloading_date: masterData.unloading_date || null,
        mill_po_no: masterData.mill_po_no,
        mill_po_date: masterData.mill_po_date || null,
        mr_spcl_print: masterData.mr_spcl_print,
        remarks: masterData.remarks,
        lorry_number: masterData.lorry_number,
        delivery_claim: (masterData as any).delivery_claim || 0,
        deduction_type: (masterData as any).deduction_type || selectedDeductionTypes.join(', '),
        deduction_rate: (masterData as any).deduction_rate || 0,
        deduction_qty: (masterData as any).deduction_qty || 0,
        deduction_amount: (masterData as any).deduction_amount || 0,
        advance_amount: Number((masterData as any).advance_amount) || 0,
        on_account_advance_amount: Number((masterData as any).on_account_advance_amount) || 0,
        settlement_amount: Number((masterData as any).settlement_amount) || 0,
        sent_settlement_date: (masterData as any).sent_settlement_date || null,
        lorry_returned: (masterData as any).lorry_returned || 'No',
        lorry_returned_other_mill: (masterData as any).lorry_returned_other_mill || 'No',
        mr_print_date: (masterData as any).mr_print_date || null,
        consignment_no: (masterData as any).consignment_no || null,
        consignment_date: (masterData as any).consignment_date || null,
        arrival_remarks: (masterData as any).arrival_remarks || null,
        arival_apmc_fees: Number((masterData as any).arival_apmc_fees) || 0,
        quality_matrix: qualityMatrix,
        grid_details: detailsList,
        details: detailsList,
        status: 'Completed'
      };

      // Enforce Sauda Check Point PO Date as single source of truth dynamically
      if (masterPayload.po_no) {
        try {
          const { data: scpData } = await supabase
            .from('purchase_master')
            .select('po_date')
            .eq('po_no', masterPayload.po_no.trim())
            .maybeSingle();
          if (scpData && scpData.po_date) {
            masterPayload.po_date = scpData.po_date;
            masterPayload.mill_po_date = scpData.po_date;
          } else {
            const { data: scpViewData } = await supabase
              .from('sauda_check_point')
              .select('po_date, s_date')
              .eq('po_no', masterPayload.po_no.trim())
              .maybeSingle();
            if (scpViewData) {
              const matchedPoDate = scpViewData.po_date || scpViewData.s_date;
              if (matchedPoDate) {
                masterPayload.po_date = matchedPoDate;
                masterPayload.mill_po_date = matchedPoDate;
              }
            }
          }
        } catch (poErr) {
          console.warn("Error resolving PO Date source of truth:", poErr);
        }
      }

      console.log("[MATERIAL INSPECTION - FRONTEND BEFORE SAVE & PRODUCTION VALIDATION]", {
        timestamp: new Date().toISOString(),
        mr_no: masterPayload.mr_no,
        arrival_no: masterPayload.arrival_no,
        po_no: masterPayload.po_no,
        supplier: masterPayload.supplier,
        broker: masterPayload.broker,
        detailsCount: detailsList.length
      });

      // 1. Save or Update Master into active material_inspection table
      const { error: masterErr } = await supabase.from("material_inspection").upsert(masterPayload);
      if (masterErr) {
        console.warn("Primary upsert to material_inspection error:", masterErr);
      } else {
        console.log("[MATERIAL INSPECTION - FRONTEND AFTER SAVE SUCCESS]", {
          timestamp: new Date().toISOString(),
          status: "COMMITTED",
          mr_no: masterPayload.mr_no
        });
      }

      // 2. Clean out old Detail Rows (to safely rewrite or insert)
      await supabase.from("inspection_details").delete().eq("mr_no", masterData.mr_no).then(() => {}, () => {});
      await supabase.from("inspection_checklist_details").delete().eq("mr_no", masterData.mr_no).then(() => {}, () => {});
      await supabase.from("mill_inspection_detail").delete().eq("mr_no", masterData.mr_no).then(() => {}, () => {});
      await supabase.from("material_inspection_details").delete().eq("mr_no", masterData.mr_no).then(() => {}, () => {});

      // 3. Filter valid rows to write (must have at least grade or agency input)
      const colKeys = ['1st', '2nd', '3rd', '4th'];
      const validRowsToWrite = detailsList
        .filter(
          (row) =>
            row.arrival_grade || row.stock_grade_code || row.area || row.agency,
        )
        .map((row, idx) => {
          const colKey = colKeys[idx];

          const qmGradeDownDept = qualityMatrix.grade_down?.[colKey]?.dept;
          const qmGradeDownClaim = qualityMatrix.grade_down?.[colKey]?.claim;
          const qmGradeDownSett = qualityMatrix.grade_down?.[colKey]?.sett;

          const qmMoistureDept = qualityMatrix.moisture?.[colKey]?.dept;
          const qmMoistureClaim = qualityMatrix.moisture?.[colKey]?.claim;
          const qmMoistureSett = qualityMatrix.moisture?.[colKey]?.sett;

          const qmDustDept = qualityMatrix.dust?.[colKey]?.dept;
          const qmDustClaim = qualityMatrix.dust?.[colKey]?.claim;
          const qmDustSett = qualityMatrix.dust?.[colKey]?.sett;

          const qmNcvDept = qualityMatrix.moc?.[colKey]?.dept;
          const qmNcvClaim = qualityMatrix.moc?.[colKey]?.claim;
          const qmNcvSett = qualityMatrix.moc?.[colKey]?.sett;

          const qmPoRateDept = qualityMatrix.po_rate?.[colKey]?.dept;
          const qmPoRateClaim = qualityMatrix.po_rate?.[colKey]?.claim;
          const qmPoRateSett = qualityMatrix.po_rate?.[colKey]?.sett;

          const rowGradeDownAct = Number(qmGradeDownDept ?? row.actual_grade_down ?? row.grade_down_act ?? (idx === 0 ? masterData.actual_grade_down : 0)) || 0;
          const rowGradeDownClaim = Number(qmGradeDownClaim ?? row.claim_grade_down ?? row.grade_down_claim ?? (idx === 0 ? masterData.claim_grade_down : 0)) || 0;
          const rowGradeDownSett = Number(qmGradeDownSett ?? row.settlement_grade_down ?? 0) || 0;

          const rowMoistureAct = Number(qmMoistureDept ?? row.actual_moisture ?? row.moisture_act ?? (idx === 0 ? masterData.actual_moisture : 0)) || 0;
          const rowMoistureClaim = Number(qmMoistureClaim ?? row.claim_moisture ?? row.moisture_claim ?? (idx === 0 ? masterData.claim_moisture : 0)) || 0;
          const rowMoistureSett = Number(qmMoistureSett ?? row.settlement_moisture ?? 0) || 0;

          const rowDustAct = Number(qmDustDept ?? row.actual_dust ?? row.dust_act ?? (idx === 0 ? masterData.actual_dust : 0)) || 0;
          const rowDustClaim = Number(qmDustClaim ?? row.claim_dust ?? row.dust_claim ?? (idx === 0 ? masterData.claim_dust : 0)) || 0;
          const rowDustSett = Number(qmDustSett ?? row.settlement_dust ?? 0) || 0;

          const rowNcvAct = Number(qmNcvDept ?? row.actual_ncv ?? row.ncv_act ?? (idx === 0 ? masterData.actual_ncv : 0)) || 0;
          const rowNcvClaim = Number(qmNcvClaim ?? row.claim_ncv ?? row.ncv_claim ?? (idx === 0 ? masterData.claim_ncv : 0)) || 0;
          const rowNcvSett = Number(qmNcvSett ?? row.settlement_ncv ?? 0) || 0;

          const rowRate = Number(qmPoRateDept ?? row.rate ?? row.rate_qntl ?? 0) || 0;

          const rowGrossWtVal = row.challan_gross_wt === "" ? 0 : Number(row.challan_gross_wt);
          const rowMoistPctVal = rowMoistureClaim || rowMoistureAct || rowMoistureSett || 0;
          const rowDustPctVal = rowDustClaim || rowDustAct || rowDustSett || 0;
          const rowNcvPctVal = rowNcvClaim || rowNcvAct || rowNcvSett || 0;

          const rowMoistureDeductionKg = rowGrossWtVal > 0 && rowMoistPctVal > 0 ? Math.round(rowGrossWtVal * 1000 * (rowMoistPctVal / 100)) : 0;
          const rowDustDeductionKg = rowGrossWtVal > 0 && rowDustPctVal > 0 ? Math.round(rowGrossWtVal * 1000 * (rowDustPctVal / 100)) : 0;
          const rowNcvDeductionKg = rowGrossWtVal > 0 && rowNcvPctVal > 0 ? Math.round(rowGrossWtVal * 1000 * (rowNcvPctVal / 100)) : 0;

          return {
            mr_no: masterData.mr_no,
            srl_no: row.srl_no || idx + 1,
            arrival_grade: row.arrival_grade || "",
            stock_grade_code: row.stock_grade_code || "",
            stock_grade_name: row.stock_grade_name || "",
            area: row.area || "",
            agency: row.agency || "",
            agency_code: (row as any).agency_code || "",
            marka: row.marka || "",
            marks: row.marka || "",
            crop_year: row.crop_year || "2026-27",
            lot: row.lot || "",
            quantity: row.quantity === "" ? 0 : Number(row.quantity),
            unit: row.unit || "BALES",
            rate: rowRate,
            rate_qntl: rowRate,
            challan_gross_wt: row.challan_gross_wt === "" ? 0 : Number(row.challan_gross_wt),
            receipt_gross_wt: Number((row as any).receipt_gross_wt) || 0,
            gross_weight_batch: Number((row as any).gross_weight_batch) || 0,
            add_weight: Number((row as any).add_weight) || 0,
            less_weight: Number((row as any).less_weight) || 0,
            reduced_weight: Number((row as any).reduced_weight) || 0,
            lorry_moisture_min: Number((row as any).lorry_moisture_min) || 0,
            lorry_moisture_max: Number((row as any).lorry_moisture_max) || 0,
            lorry_read_min: Number((row as any).lorry_read_min) || 0,
            lorry_read_max: Number((row as any).lorry_read_max) || 0,
            lorry_read_avg: Number((row as any).lorry_read_avg) || 0,
            insp_read_min: Number((row as any).insp_read_min) || 0,
            insp_read_max: Number((row as any).insp_read_max) || 0,
            insp_read_avg: Number((row as any).insp_read_avg) || 0,
            moisture_act: rowMoistureAct,
            moisture_claim: rowMoistureClaim,
            dust_act: rowDustAct,
            dust_claim: rowDustClaim,
            ncv_act: rowNcvAct,
            ncv_claim: rowNcvClaim,
            grade_down_act: rowGradeDownAct,
            grade_down_claim: rowGradeDownClaim,
            actual_moisture: rowMoistureAct,
            claim_moisture: rowMoistureClaim,
            actual_dust: rowDustAct,
            claim_dust: rowDustClaim,
            actual_ncv: rowNcvAct,
            claim_ncv: rowNcvClaim,
            actual_grade_down: rowGradeDownAct,
            claim_grade_down: rowGradeDownClaim,
            moisture_deduction_kg: rowMoistureDeductionKg,
            dust_deduction_kg: rowDustDeductionKg,
            ncv_deduction_kg: rowNcvDeductionKg,
            final_receipt_wt: Number((row as any).final_receipt_wt) || 0,
            settlement_moisture: rowMoistureSett,
            settlement_grade_down: rowGradeDownSett,
            settlement_dust: rowDustSett,
            settlement_ncv: rowNcvSett,
            ropes_weight: Number((row as any).ropes_weight) || 0,
            ropes_tot_wt_grd: Number((row as any).ropes_tot_wt_grd) || 0,
            ropes_grade: (row as any).ropes_grade || "",
            chotta_weight: Number((row as any).chotta_weight) || 0,
            chotta_tot_wt_grd: Number((row as any).chotta_tot_wt_grd) || 0,
            chotta_grade: (row as any).chotta_grade || "",
            tolerable: (row as any).tolerable || "Yes",
            premium: (row as any).premium !== undefined && (row as any).premium !== null ? String((row as any).premium) : "No",
            is_premium: Boolean((row as any).is_premium),
            row_remarks: (row as any).row_remarks || "",
            jqi_remarks: (row as any).jqi_remarks || "",
            jci_remarks: (row as any).jci_remarks || (row as any).jqi_remarks || "",
          };
        });

      if (validRowsToWrite.length > 0) {
        await supabase.from("inspection_details").insert(validRowsToWrite).then(() => {}, () => {});
        await supabase.from("inspection_checklist_details").insert(validRowsToWrite).then(() => {}, () => {});
        await supabase.from("mill_inspection_detail").insert(validRowsToWrite).then(() => {}, () => {});
        await supabase.from("material_inspection_details").insert(validRowsToWrite).then(() => {}, () => {});
      }

      // 4. Sync to final_arrival table which connects to the "Final Arrival" dashboard
      try {
        const totalPackets = validRowsToWrite.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
        const totalWeightKgs = validRowsToWrite.reduce((sum, row) => sum + (Number(row.challan_gross_wt) || 0), 0);

        // Find the vehicle number from the arrivalVouchers
        const matchingVoucher = arrivalVouchers.find(
          (v) => (v.temporary_arrival_no || v.amad_no || '').trim().toLowerCase() === (masterData.arrival_no || '').trim().toLowerCase()
        );
        const lorryNo = masterData.lorry_number || matchingVoucher?.lorry_number || matchingVoucher?.lorry_no || matchingVoucher?.vehicle_no || masterData.arrival_no || null;

        await supabase
          .from("final_arrival")
          .upsert({
            mr_no: masterData.mr_no,
            mr_date: masterData.mr_date || null,
            temporary_arrival_no: masterData.arrival_no,
            arrival_date: masterData.arrival_date || null,
            date: masterData.arrival_date || masterData.mr_date || null,
            po_no: masterData.po_no,
            po_date: masterPayload.po_date || null,
            broker: masterData.broker_name,
            broker_name: masterData.broker_name,
            supplier: masterData.supplier_name,
            supplier_name: masterData.supplier_name,
            actual_moisture: masterData.actual_moisture ? Number(masterData.actual_moisture) : null,
            claim_moisture: masterData.claim_moisture ? Number(masterData.claim_moisture) : null,
            actual_dust: masterData.actual_dust ? Number(masterData.actual_dust) : null,
            claim_dust: masterData.claim_dust ? Number(masterData.claim_dust) : null,
            actual_ncv: masterData.actual_ncv ? Number(masterData.actual_ncv) : null,
            claim_ncv: masterData.claim_ncv ? Number(masterData.claim_ncv) : null,
            detention_days: masterData.detention_days ? Number(masterData.detention_days) : null,
            unloading_date: masterData.unloading_date || null,
            remarks: masterData.remarks,
            lorry_number: masterData.lorry_number || lorryNo,
            final_arrival_no: masterData.mr_no,
            total_packets: totalPackets,
            total_actual_weight: totalWeightKgs,
            grid_details: JSON.stringify(validRowsToWrite.map(r => ({
              crop: r.crop_year || '2025-26',
              grade_name: r.arrival_grade || 'TD5',
              marka: r.marka || 'NO MARK',
              qty: Number(r.quantity) || 0,
              weight_kgs: Number(r.challan_gross_wt) || 0,
              area: r.area || '',
              agency: r.agency || ''
            })))
          }, { onConflict: 'mr_no' });
      } catch (e) {
        console.warn("Failed to sync to final_arrival table:", e);
      }

      // --- 5. Automatic Ruka PO matching and movement to Final PO ---
      try {
        if (masterData.po_no && masterData.po_no !== 'N/A' && masterData.po_no.trim() !== '') {
          const { data: tempPo } = await supabase.from('purchase_master').select('*').eq('po_no', masterData.po_no).neq('status', 'final').maybeSingle();
          if (tempPo) {
            const { data: tempPoDetails } = await supabase.from('purchase_detail_master').select('*').eq('po_no', masterData.po_no);
            
            // We use comparePoInspection for full 11-field comparison
            // But we need to enrich masterData with amad details to have area, po_type, etc.
            const { data: amad } = await supabase.from('temporary_material_received').select('*').eq('po_no', masterData.po_no).maybeSingle();
            const enrichedInsp = { ...masterData, ...(amad || {}) };
            
            // To ensure comparePoInspection calculates Total Wt correctly for this inspection form:
            enrichedInsp.total_wt_in_ton = validRowsToWrite.reduce((sum, r) => sum + (Number(r.challan_gross_wt) || 0), 0) / 1000;
            enrichedInsp.grid_details = validRowsToWrite.map(r => ({ grade_name: r.arrival_grade, marka: r.marka, area: r.area }));

            const matchRes = comparePoInspection(tempPo, tempPoDetails || [], enrichedInsp, []);
            let isMatch = matchRes.status === 'match';
            let mismatchReason = matchRes.mismatches.map(m => m.field).join(', ') + ' mismatch';

            let savedResolutions: any = {};
            try {
               const raw = localStorage.getItem('bjcl_mismatch_resolutions');
               if (raw && raw !== 'undefined' && raw !== 'null') savedResolutions = JSON.parse(raw);
            } catch(e) {}
            
            const existingMismatch = savedResolutions[`MIS-RUKA-${masterData.po_no}`];
            const isResolved = (existingMismatch && existingMismatch.status === 'resolved' && existingMismatch.decision !== 'REJECT') || tempPo.mismatch_cleared === true;

            if (isMatch || isResolved) {
               const poToInsert = { ...tempPo };
               delete poToInsert.po_id;
               delete poToInsert.created_at;
               
               const { error: insPoErr } = await supabase.from('purchase_master').insert(poToInsert);
               if (!insPoErr) {
                  if (tempPoDetails && tempPoDetails.length > 0) {
                     const detailsToInsert = tempPoDetails.map((d: any) => {
                         const copy = { ...d };
                         delete copy.item_id;
                         return copy;
                     });
                     await supabase.from('purchase_detail_master').insert(detailsToInsert);
                  }
                  await supabase.from('sauda_check_point_details').delete().eq('po_no', masterData.po_no);
                  await supabase.from('sauda_check_point').delete().eq('po_no', masterData.po_no);
                  
                  if (existingMismatch) {
                     delete savedResolutions[`MIS-RUKA-${masterData.po_no}`];
                     localStorage.setItem('bjcl_mismatch_resolutions', JSON.stringify(savedResolutions));
                  }
                  setSuccessMessage(prev => prev + ' | Sauda Check Point moved to Final P.O successfully.');
               }
            } else {
               savedResolutions[`MIS-RUKA-${masterData.po_no}`] = {
                  poNo: masterData.po_no,
                  supplier: masterData.supplier_name,
                  reason: mismatchReason || "Detail fields did not match between Sauda Check Point and Material Inspection",
                  status: 'pending',
                  timestamp: new Date().toISOString()
               };
               localStorage.setItem('bjcl_mismatch_resolutions', JSON.stringify(savedResolutions));
               setErrorMessage(`Sauda Check Point could not be moved to Final P.O due to mismatch: ${mismatchReason}. Please resolve in Mismatch section.`);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to process Ruka to Final PO movement:", e);
      }

      setSuccessMessage(
        `System Database Updated: Inspection report ${masterData.mr_no} registered successfully!`,
      );
      if (onLogEvent) {
        onLogEvent(
          "PO_SYNC",
          `Matched & Sync'd Material Inspection [MR: ${masterData.mr_no}] against Purchase P.O [PO: ${masterData.po_no || "N/A"}] with Audit Quantity: ${detailsList.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)} MT`,
        );
      }
      try {
        localStorage.removeItem("AUTOSAVE_MATERIAL_INSPECTION");
      } catch (e) {
        console.warn(e);
      }
      setIsEditMode(false);
      setViewMode("dashboard");
      window.dispatchEvent(new CustomEvent('app-data-updated'));
      window.dispatchEvent(new CustomEvent('storage'));
      loadSavedInspectionsList();
    } catch (err: any) {
      setErrorMessage("System save failure: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getVoucherForInspection = (row: any) => {
    if (!row.arrival_no) return null;
    return arrivalVouchers.find(
      (v) => (v.temporary_arrival_no || v.amad_no || '').trim().toLowerCase() === (row.arrival_no || '').trim().toLowerCase()
    );
  };

  const handleToggleExpand = async (row: any) => {
    const isCurrentlyExpanded = expandedMrNo === row.mr_no;
    if (isCurrentlyExpanded) {
      setExpandedMrNo(null);
    } else {
      setExpandedMrNo(row.mr_no);
      if (!expandedDetails[row.mr_no] && supabase) {
        try {
          const { data, error } = await supabase
            .from("mill_inspection_detail")
            .select("*")
            .eq("mr_no", row.mr_no)
            .order("srl_no", { ascending: true });
          if (!error && data) {
            setExpandedDetails(prev => ({ ...prev, [row.mr_no]: data }));
          }
        } catch (err) {
          console.error("Error loading inspection detail on expand:", err);
        }
      }
    }
  };

  const filteredSavedInspections = savedInspections.filter((item) => {
    if (!canViewCompletedData()) return false;
    const term = searchFilter.toLowerCase();
    const matchesSearch = (
      item.mr_no.toLowerCase().includes(term) ||
      (item.po_no || "").toLowerCase().includes(term) ||
      (item.supplier_name || "").toLowerCase().includes(term) ||
      (item.broker_name || "").toLowerCase().includes(term)
    );

    let matchesDates = true;
    if (arrivalStartDate) {
      if (!item.arrival_date || item.arrival_date < arrivalStartDate) {
        matchesDates = false;
      }
    }
    if (arrivalEndDate) {
      if (!item.arrival_date || item.arrival_date > arrivalEndDate) {
        matchesDates = false;
      }
    }

    return matchesSearch && matchesDates;
  }).sort((a, b) => {
    // 1. Arrival No
    const arrA = (a.arrival_no || a.mr_no || '').toUpperCase();
    const arrB = (b.arrival_no || b.mr_no || '').toUpperCase();
    const arrDiff = arrA.localeCompare(arrB, undefined, { numeric: true, sensitivity: 'base' });
    if (arrDiff !== 0) return arrDiff;

    // 2. Arrival Date (descending for newest date first)
    const dateA = a.arrival_date || a.mr_date || '';
    const dateB = b.arrival_date || b.mr_date || '';
    const dateDiff = new Date(dateB || 0).getTime() - new Date(dateA || 0).getTime();
    if (dateDiff !== 0) return dateDiff;

    // 3. Status
    const statusA = (a.status || 'Completed').toUpperCase();
    const statusB = (b.status || 'Completed').toUpperCase();
    return statusA.localeCompare(statusB);
  });

  const filteredPendingMrList = arrivalVouchers.filter((v) => {
    const arrivalVal = (v.temporary_arrival_no || v.amad_no || "").trim().toUpperCase();
    if (!arrivalVal) return false;

    // Check if already inspected
    const isInspected = savedInspections.some(
      (insp) => (insp.arrival_no || "").trim().toUpperCase() === arrivalVal
    );
    if (isInspected) return false;

    // Apply search filter
    const term = searchFilter.toLowerCase();
    const matchesSearch = (
      arrivalVal.toLowerCase().includes(term) ||
      (v.po_no || "").toLowerCase().includes(term) ||
      (v.supplier || "").toLowerCase().includes(term) ||
      (v.broker || "").toLowerCase().includes(term)
    );

    // Apply date range filter (on v.date, since that's arrival date)
    let matchesDates = true;
    if (arrivalStartDate) {
      if (!v.date || v.date < arrivalStartDate) {
        matchesDates = false;
      }
    }
    if (arrivalEndDate) {
      if (!v.date || v.date > arrivalEndDate) {
        matchesDates = false;
      }
    }

    return matchesSearch && matchesDates;
  }).sort((a, b) => {
    // 1. Arrival No
    const arrA = (a.temporary_arrival_no || a.amad_no || '').toUpperCase();
    const arrB = (b.temporary_arrival_no || b.amad_no || '').toUpperCase();
    const arrDiff = arrA.localeCompare(arrB, undefined, { numeric: true, sensitivity: 'base' });
    if (arrDiff !== 0) return arrDiff;

    // 2. Arrival Date
    const dateA = a.date || '';
    const dateB = b.date || '';
    const dateDiff = new Date(dateB || 0).getTime() - new Date(dateA || 0).getTime();
    if (dateDiff !== 0) return dateDiff;

    // 3. Status
    return (a.status || 'Pending').localeCompare(b.status || 'Pending');
  });

  const totalInspections = savedInspections.length;
  const avgMoisture =
    totalInspections > 0
      ? savedInspections.reduce(
          (sum, item) => sum + (Number(item.actual_moisture) || 0),
          0,
        ) / totalInspections
      : 0;
  const avgDust =
    totalInspections > 0
      ? savedInspections.reduce(
          (sum, item) => sum + (Number(item.actual_dust) || 0),
          0,
        ) / totalInspections
      : 0;

  // P.O Procurement Balance Calculations
  const totalContractWeight = purchaseOrders.reduce((sum, po) => sum + (Number(po.total_contract_mt) || 0), 0);
  const totalPendingWeight = purchaseOrders.reduce((sum, po) => sum + (Number(po.pending_received) || 0), 0);
  const totalReceivedWeight = Math.max(0, totalContractWeight - totalPendingWeight);

  if (viewMode === "dashboard") {
    return (
      <LegacyLayout
        title="Inspection"
        subtitle=""
        onClose={onClose}
      >
        <MaterialInspectionRegisterView
          savedInspections={savedInspections}
          filteredSavedInspections={filteredSavedInspections}
          filteredPendingMrList={filteredPendingMrList}
          arrivalVouchers={arrivalVouchers}
          purchaseOrders={purchaseOrders}
          finalArrivals={finalArrivals}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          arrivalStartDate={arrivalStartDate}
          setArrivalStartDate={setArrivalStartDate}
          arrivalEndDate={arrivalEndDate}
          setArrivalEndDate={setArrivalEndDate}
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          visibleColumns={visibleColumns}
          setVisibleColumns={setVisibleColumns}
          selectedMrNos={selectedMrNos}
          setSelectedMrNos={setSelectedMrNos}
          printedInspections={printedInspections}
          expandedMrNo={expandedMrNo}
          setExpandedMrNo={setExpandedMrNo}
          expandedDetails={expandedDetails}
          handleToggleExpand={handleToggleExpand}
          loadInspectionIntoForm={loadInspectionIntoForm}
          setIsEditMode={setIsEditMode}
          setViewMode={setViewMode}
          handlePreparePrintInspection={handlePreparePrintInspection}
          handleBatchPrint={handleBatchPrint}
          handleExportCsv={handleExportToExcel}
          handleRefreshDatabase={handleRefreshDatabase}
          deleteInspectionPermanently={deleteInspectionPermanently}
          loadSavedInspectionsList={loadSavedInspectionsList}
          setSuccessMessage={setSuccessMessage}
          setLoading={setLoading}
          loading={loading}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          pendingCurrentPage={pendingCurrentPage}
          setPendingCurrentPage={setPendingCurrentPage}
          pendingPageSize={pendingPageSize}
          setPendingPageSize={setPendingPageSize}
          initialMasterState={initialMasterState}
          createEmptyRow={createEmptyRow}
          setMasterData={setMasterData}
          setDetailsList={setDetailsList}
          setErrorMessage={setErrorMessage}
          handleAutoFillFromVoucher={handleAutoFillFromVoucher}
        />

        <PrintModal
          isOpen={printingInspection !== null}
          onClose={() => setPrintingInspection(null)}
          title={`QUALITY INSPECTION REPORT - M.R. NO: ${printingInspection?.mr_no}`}
        >
          {printingInspection && (
            <InspectionPrintSlip
              master={printingInspection}
              details={printingInspectionDetails}
            />
          )}
        </PrintModal>

        <PrintModal
          isOpen={printingBatch !== null}
          onClose={() => setPrintingBatch(null)}
          title={`BATCH QUALITY INSPECTION REPORT - ${printingBatch?.length} RECORDS`}
        >
          {printingBatch && (
            <div className="flex flex-col gap-8 print:gap-0 print:block">
              {printingBatch.map((item) => (
                <div key={item.master.mr_no} className="print:break-after-page print:page-break-after-always">
                  <InspectionPrintSlip
                    master={item.master}
                    details={item.details}
                  />
                </div>
              ))}
            </div>
          )}
        </PrintModal>
      </LegacyLayout>
    );
  }

  return (
    <LegacyLayout
      title="Material Quality audit system"
      subtitle="Mill Inspection Record Ledger"
      onClose={() => setViewMode("dashboard")}
    >
      <div className="w-full px-2 space-y-4 font-bold text-[11px] text-slate-800">
        {/* State Alerts display ribbon */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-300 p-2 text-red-800 font-extrabold rounded-sm flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0 text-red-600 animate-pulse" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-300 p-2 text-emerald-800 font-extrabold rounded-sm flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* --- Datalists for autocompletion --- */}
        <datalist id="brokersList">
          {brokers.map((b, idx) => (
            <option key={idx} value={safeRenderText(b.name, "")} />
          ))}
        </datalist>
        <datalist id="suppliersList">
          {suppliers.map((s, idx) => (
            <option key={idx} value={safeRenderText(s.name, "")} />
          ))}
        </datalist>
        <datalist id="gradesList">
          {grades.map((g, idx) => (
            <option key={idx} value={safeRenderText(g.code || g.name, "")} />
          ))}
        </datalist>
        <datalist id="areasList">
          {areas.map((a, idx) => (
            <option key={idx} value={safeRenderText(a.name, "")} />
          ))}
        </datalist>
        <datalist id="agenciesList">
          {agencies.map((ag, idx) => (
            <option key={idx} value={safeRenderText(ag.name, "")} />
          ))}
        </datalist>
        <datalist id="markasList">
          {markas.map((m, idx) => (
            <option key={idx} value={safeRenderText(m.name, "")} />
          ))}
        </datalist>
        <datalist id="arrivalPoList">
          {arrivalVouchers
            .filter((v) => {
              if (!v.po_no) return false;
              const arrivalVal = safeRenderText(v.temporary_arrival_no || v.arrival_no || v.amad_no, "").trim().toUpperCase();
              if (!arrivalVal) return false;
              return true;
            })
            .map((v, idx) => (
              <option
                key={idx}
                value={safeRenderText(v.po_no, "")}
              >{`P.O. #${safeRenderText(v.po_no, "")} | Inspection MR / Arr: ${safeRenderText(v.mr_no || v.temporary_arrival_no || v.arrival_no, "")} | Supplier: ${safeRenderText(v.supplier || v.supplier_name, "")}`}</option>
            ))}
        </datalist>
        <datalist id="arrivalNoList">
          {arrivalVouchers
            .filter((v) => {
              const arrivalVal = safeRenderText(v.temporary_arrival_no || v.arrival_no || v.amad_no, "").trim().toUpperCase();
              if (!arrivalVal) return false;
              return true;
            })
            .map((v, idx) => {
              const arrivalVal = safeRenderText(v.temporary_arrival_no || v.arrival_no || v.amad_no, "");
              return (
                <option
                  key={idx}
                  value={arrivalVal}
                >{`Inspection MR / Arr No: ${arrivalVal} | P.O. #${safeRenderText(v.po_no, "")} | Supplier: ${safeRenderText(v.supplier || v.supplier_name, "")}`}</option>
              );
            })}
        </datalist>

        {/* MAIN VISUAL CARD CONTAINER */}
        <div className="flex-1 flex flex-col font-sans text-slate-800 space-y-4 w-full pb-10">
          {/* HEADER BAR */}
          <div className="bg-[#174C2C] text-white px-6 py-4 rounded-xl shadow-lg flex flex-wrap items-center justify-between border border-[#0F351E] gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-800/40 border border-emerald-400/40 flex items-center justify-center text-amber-300 shadow-inner">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-base font-bold text-white tracking-wide">
                  INSPECTION CHECKLIST
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-3.5 py-1.5 bg-[#103A20] hover:bg-[#1C5130] text-amber-300 border border-[#235E39] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
                title="Back to Sauda Desk (Esc)"
                onClick={() => setViewMode("dashboard")}
              >
                <ArrowLeft className="h-4 w-4 text-amber-300" />
                <span>Back</span>
              </button>
              
              <button
                type="button"
                onClick={() => handlePreparePrintInspection(masterData)}
                className="px-4 py-2 bg-[#0b2415]/80 hover:bg-[#123920] border border-emerald-400/50 rounded-lg text-xs font-bold text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* CARD 1: BASIC INFORMATION */}
          <InspectionBasicInfoCard
            masterData={masterData}
            isEditMode={isEditMode}
            handleMasterChange={handleMasterChange}
            setMasterData={setMasterData}
            handleAutoFillFromVoucher={handleAutoFillFromVoucher}
            savedInspections={savedInspections}
            detailsList={detailsList}
            handleDetailChange={handleDetailChange}
            totalChallanGrossWt={totalChallanGrossWt}
            totalReceiptGrossWt={totalReceiptGrossWt}
            showWeightsBreakdown={showWeightsBreakdown}
            setShowWeightsBreakdown={setShowWeightsBreakdown}
            unitList={unitList}
          />

          {/* CARD 2: LORRY & SETTLEMENT DETAILS */}
          <InspectionLorrySettlementCard
            masterData={masterData}
            isEditMode={isEditMode}
            handleMasterChange={handleMasterChange}
            syncAdvanceFromPaymentOperations={syncAdvanceFromPaymentOperations}
            paymentOpsInfo={paymentOpsInfo}
            handleSyncSettlementAmount={handleSyncSettlementAmount}
          />

          {/* CARD 3: INSPECTION DETAILS */}
          <InspectionCommoditySpecsCard
            isEditMode={isEditMode}
            show3rdAnd4th={show3rdAnd4th}
            setShowAllFourSpecs={setShowAllFourSpecs}
            detailsList={detailsList}
            handleDetailChange={handleDetailChange}
            qualityMatrix={qualityMatrix}
            updateMatrixVal={updateMatrixVal}
            masterData={masterData}
            setMasterData={setMasterData}
          />

          {/* BOTTOM ACTION BAR */}
          <div className="bg-slate-100 rounded-xl border border-slate-300 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSaveAction(false)}
                disabled={loading || !isEditMode}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? "Saving..." : "Save"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveAction(true)}
                disabled={loading || !isEditMode}
                className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 active:scale-95"
              >
                <FileText className="w-4 h-4" />
                <span>Save as Draft</span>
              </button>

              <button
                type="button"
                onClick={handleCancelAction}
                disabled={loading}
                className="px-6 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-lg shadow flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 active:scale-95"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>

              {!isEditMode && (
                <button
                  type="button"
                  onClick={handleEditAction}
                  disabled={loading}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit Form</span>
                </button>
              )}
            </div>

            {/* Right Metadata */}
            <div className="flex items-center gap-6 text-xs text-slate-600 font-semibold">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                <span>Created By :</span>
                <span className="font-bold text-slate-800">{currentUser || "System"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Created At :</span>
                <span className="font-bold text-slate-800">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Historic search modal */}
        <InspectionHistoricSearchModal
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          filteredSavedInspections={filteredSavedInspections}
          loadInspectionIntoForm={loadInspectionIntoForm}
          setIsEditMode={setIsEditMode}
          setViewMode={setViewMode}
        />

        <PrintModal
          isOpen={printingInspection !== null}
          onClose={() => setPrintingInspection(null)}
          title={`QUALITY INSPECTION REPORT - M.R. NO: ${printingInspection?.mr_no}`}
        >
          {printingInspection && (
            <InspectionPrintSlip
              master={printingInspection}
              details={printingInspectionDetails}
            />
          )}
        </PrintModal>
      </div>
    </LegacyLayout>
  );
}
