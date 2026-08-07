import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";
import {
  ShieldCheck,
  Plus,
  Search,
  Trash2,
  Save,
  X,
  Printer,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Database,
  ArrowLeftRight,
  Info,
  Download,
  RefreshCcw,
  FileSpreadsheet,
  Edit,
  Clock,
  ChevronDown,
  Loader2,
  ArrowLeft
} from "lucide-react";
import LegacyLayout from "../components/LegacyLayout";
import { supabase } from "../lib/supabase";
import { dbModule } from "../services/dbModule";
import { enforceEditOrDeletePermission, canEditOrDelete, canViewCompletedData, getCurrentUserContext } from "../lib/permissions";
import { comparePoInspection } from "../lib/poMatch";
import { sanitizeCsvData } from "../lib/utils";
import PrintModal from "../components/PrintModal";
import InspectionPrintSlip from "../components/InspectionPrintSlip";

// Type declarations matching the schema created in Supabase
interface InspectionMaster {
  id?: string;
  mr_no: string;
  mr_date: string;
  arrival_no: string;
  arrival_date: string;
  po_no: string;
  po_date: string;
  broker_name: string;
  supplier_name: string;
  lorry_number?: string;
  actual_moisture: number;
  claim_moisture: number;
  actual_dust: number;
  claim_dust: number;
  actual_ncv: number;
  claim_ncv: number;
  detention_days: number;
  unloading_date: string;
  mill_po_no: string;
  mill_po_date: string;
  mr_spcl_print: string;
  remarks: string;
}

interface InspectionDetailRow {
  id?: string;
  srl_no: number;
  arrival_grade: string;
  stock_grade_code: string;
  stock_grade_name: string;
  area: string;
  agency: string;
  marka: string;
  crop_year: string;
  lot: string;
  quantity: number | string;
  unit: string;
  challan_gross_wt: number | string;
}

interface SupabaseAutoCompleteInputProps {
  label: string;
  name: "arrival_no" | "po_no";
  fieldColumn: "temporary_arrival_no" | "po_no";
  value: string;
  disabled?: boolean;
  placeholder: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectOption?: (val: string, record?: any) => void;
  savedInspections?: any[];
}

const SupabaseAutoCompleteInput: React.FC<SupabaseAutoCompleteInputProps> = ({
  label,
  name,
  fieldColumn,
  value,
  disabled = false,
  placeholder,
  onChange,
  onSelectOption,
  savedInspections = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbRecords, setDbRecords] = useState<any[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch data directly from Supabase
  const fetchLiveData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      let data: any[] = [];
      if (supabase) {
        const { data: res, error } = await supabase
          .from("temporary_material_received")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        data = res || [];
      } else {
        data = await dbModule.fetchAll("temporary_material_received").catch(() => []);
      }
      setDbRecords(data);
    } catch (err: any) {
      console.error(`Error fetching temporary_material_received for ${name}:`, err);
      setFetchError("Unable to connect to database");
    } finally {
      setLoading(false);
    }
  };

  const handleFocusOrClick = () => {
    if (disabled) return;
    setIsOpen(true);
    fetchLiveData();
  };

  // Extract, deduplicate, filter and sort options in ascending order
  const getOptions = () => {
    const map = new Map<string, { val: string; record: any }>();

    dbRecords.forEach((record) => {
      let rawVal = "";
      if (fieldColumn === "temporary_arrival_no") {
        rawVal = (record.temporary_arrival_no || record.amad_no || record.arrival_no || "").toString().trim();
      } else if (fieldColumn === "po_no") {
        rawVal = (record.po_no || "").toString().trim();
      }

      if (!rawVal) return;

      const upperKey = rawVal.toUpperCase();

      // Check if already inspected (unless it matches current selected value)
      const isAlreadyInspected = savedInspections.some(
        (insp) =>
          (insp.arrival_no || insp.temporary_arrival_no || "").trim().toUpperCase() === upperKey ||
          (fieldColumn === "po_no" && (insp.po_no || "").trim().toUpperCase() === upperKey)
      );

      if (isAlreadyInspected && (value || "").trim().toUpperCase() !== upperKey) {
        return;
      }

      if (!map.has(upperKey)) {
        map.set(upperKey, { val: rawVal, record });
      }
    });

    // Convert map to array and sort ascending
    const uniqueOptions = Array.from(map.values()).sort((a, b) => {
      return a.val.localeCompare(b.val, undefined, { numeric: true, sensitivity: "base" });
    });

    // Filter based on user typing
    if (!value || !value.trim()) {
      return uniqueOptions;
    }

    const searchLower = value.trim().toLowerCase();
    return uniqueOptions.filter((opt) => {
      const valMatches = opt.val.toLowerCase().includes(searchLower);
      const poMatches = opt.record?.po_no?.toString().toLowerCase().includes(searchLower);
      const suppMatches = opt.record?.supplier?.toString().toLowerCase().includes(searchLower);
      const tempArrivalMatches = opt.record?.temporary_arrival_no?.toString().toLowerCase().includes(searchLower);
      return valMatches || poMatches || suppMatches || tempArrivalMatches;
    });
  };

  const options = getOptions();

  const handleSelect = (opt: { val: string; record: any }) => {
    const fakeEvent = {
      target: {
        name,
        value: opt.val,
      },
    } as React.ChangeEvent<HTMLInputElement>;

    onChange(fakeEvent);

    if (onSelectOption) {
      onSelectOption(opt.val, opt.record);
    }

    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative flex items-center">
        <input
          type="text"
          name={name}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={handleFocusOrClick}
          onClick={handleFocusOrClick}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-white border border-gray-400 rounded px-2 py-0.5 pr-6 text-xs font-semibold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
        />
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-500 absolute right-1.5 pointer-events-none transition-transform duration-200 ${
            isOpen ? "rotate-180 text-blue-600" : ""
          }`}
        />
      </div>

      {/* Auto-complete Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[240px] max-w-md bg-white border border-blue-400 rounded-md shadow-2xl z-[100] max-h-60 overflow-y-auto divide-y divide-gray-100 animate-in fade-in duration-100">
          {loading ? (
            <div className="p-3 text-xs text-slate-500 flex items-center justify-center gap-2 font-medium bg-slate-50">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Fetching live records...</span>
            </div>
          ) : fetchError ? (
            <div className="p-2.5 text-xs text-red-600 font-semibold bg-red-50 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{fetchError}</span>
            </div>
          ) : options.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 text-center font-medium italic bg-slate-50">
              No records found
            </div>
          ) : (
            <div className="py-1">
              <div className="px-2 py-1 bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider flex justify-between">
                <span>{label}</span>
                <span>Live Supabase Records</span>
              </div>
              {options.map((opt, idx) => (
                <div
                  key={idx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt);
                  }}
                  className="px-2.5 py-1.5 text-xs hover:bg-blue-50 cursor-pointer transition-colors flex items-center justify-between gap-2 border-b border-slate-100 last:border-b-0"
                >
                  <span className="font-bold text-blue-900 shrink-0">
                    {opt.val}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate text-right">
                    {fieldColumn === "temporary_arrival_no"
                      ? `${opt.record?.po_no ? `P.O. #${opt.record.po_no}` : ""}${
                          opt.record?.supplier ? ` | ${opt.record.supplier}` : ""
                        }`
                      : `${
                          opt.record?.temporary_arrival_no
                            ? `Temp Arr: ${opt.record.temporary_arrival_no}`
                            : ""
                        }${opt.record?.supplier ? ` | ${opt.record.supplier}` : ""}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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

  // Page States
  const [viewMode, setViewMode] = useState<"dashboard" | "entry">("dashboard");
  const [isEditMode, setIsEditMode] = useState(false);
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
  const [expandedMrNo, setExpandedMrNo] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, InspectionDetailRow[]>>({});
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false);
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
  });

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
  const calculateClaimMoisture = (
    actualM: number,
    dateStr: string,
    areaStr: string,
    rules: any[] = []
  ): number => {
    if (!actualM || actualM <= 0) return 0;

    let month = 7;
    if (dateStr) {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        if (parts[0].length === 4) month = parseInt(parts[1], 10) || 7;
        else if (parts[2].length === 4) month = parseInt(parts[1], 10) || 7;
      }
    }

    const isWetSeason = month >= 1 && month <= 6;
    const seasonKeyword = isWetSeason ? "JANUARY TO JUNE" : "JULY TO DECEMBER";
    const isDaisee = (areaStr || "").toUpperCase().includes("DAISEE");

    let threshold = isDaisee ? (isWetSeason ? 18 : 20) : (isWetSeason ? 16 : 18);

    const allRules = rules && rules.length > 0 ? rules : [
      { season: "JULY TO DECEMBER (DRY SEASON)", operating_area: "DAISEE Operating Areas", threshold_limit: "Moisture threshold limit is 20%" },
      { season: "JANUARY TO JUNE (WET SEASON)", operating_area: "DAISEE Operating Areas", threshold_limit: "Moisture threshold limit is 18%" },
      { season: "JULY TO DECEMBER (DRY SEASON)", operating_area: "Standard / Non-DAISEE", threshold_limit: "Moisture threshold limit is 18%" },
      { season: "JANUARY TO JUNE (WET SEASON)", operating_area: "Standard / Non-DAISEE", threshold_limit: "Moisture threshold limit is 16%" },
    ];

    const matched = allRules.find((r) => {
      const rSeason = (r.season || "").toUpperCase();
      const rArea = (r.operating_area || "").toUpperCase();
      const seasonMatch = rSeason.includes(seasonKeyword);
      const areaMatch = isDaisee ? rArea.includes("DAISEE") : (rArea.includes("NON-DAISEE") || rArea.includes("STANDARD"));
      return seasonMatch && areaMatch;
    });

    if (matched && matched.threshold_limit) {
      const matchVal = matched.threshold_limit.match(/(\d+(\.\d+)?)/);
      if (matchVal) {
        threshold = parseFloat(matchVal[1]);
      }
    }

    const claim = actualM - threshold;
    return claim > 0 ? Math.round(claim * 10) / 10 : 0;
  };

  const [masterData, setMasterData] =
    useState<InspectionMaster>(initialMasterState());
  const [detailsList, setDetailsList] = useState<InspectionDetailRow[]>(
    [1, 2, 3, 4, 5].map(createEmptyRow),
  );

  // Fetch Master Data references on load to feed datalists (autocompletion)
  const loadAllMasters = async () => {
    try {
      if (supabase) {
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
        ] = await Promise.all([
          supabase
            .from("broker_master")
            .select("brok_name")
            .order("brok_name")
            .limit(150),
          supabase
            .from("supply_master")
            .select("supp_name")
            .order("supp_name")
            .limit(150),
          supabase
            .from("grade_master")
            .select("grade_code, grade_name")
            .order("grade_code")
            .limit(150),
          supabase.from("area_master").select("area_name").order("area_name").limit(150),
          supabase
            .from("agency_master")
            .select("agency_name")
            .order("agency_name")
            .limit(150),
          supabase.from("marka_master").select("marka_name").order("marka_name").limit(150),
          supabase
            .from("temporary_material_received")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(250),
          supabase.from("unit_master").select("unit_name").order("unit_name").limit(150),
          supabase.from("moisture_logic").select("*"),
        ]);

        if (b) setBrokers(b.map(x => ({ name: x.brok_name })));
        if (s) setSuppliers(s.map(x => ({ name: x.supp_name })));
        if (g) setGrades(g.map(x => ({ code: x.grade_code, name: x.grade_name })));
        if (ar) setAreas(ar.map(x => ({ name: x.area_name })));
        if (ag) setAgencies(ag.map(x => ({ name: x.agency_name })));
        if (m) setMarkas(m.map(x => ({ name: x.marka_name })));
        if (av) setArrivalVouchers(av);
        if (uData && uData.length > 0) {
          const fetchedUnits = uData.map((x: any) => x.unit_name).filter(Boolean);
          setUnitList(prev => Array.from(new Set([...fetchedUnits, ...prev])));
        }
        if (mL && mL.length > 0) {
          setMoistureLogicRules(mL);
        }
      } else {
        const [b, s, g, ar, ag, m, av, fa] = await Promise.all([
          dbModule.fetchAll('broker_master').catch(() => []),
          dbModule.fetchAll('supply_master').catch(() => []),
          dbModule.fetchAll('grade_master').catch(() => []),
          dbModule.fetchAll('area_master').catch(() => []),
          dbModule.fetchAll('agency_master').catch(() => []),
          dbModule.fetchAll('marka_master').catch(() => []),
          dbModule.fetchAll('temporary_material_received', 'created_at', false).catch(() => []),
          dbModule.fetchAll('final_arrival', 'created_at', false).catch(() => []),
        ]);
        if (b) setBrokers(b.map((x: any) => ({ name: x.brok_name })));
        if (s) setSuppliers(s.map((x: any) => ({ name: x.supp_name })));
        if (g) setGrades(g.map((x: any) => ({ code: x.grade_code, name: x.grade_name })));
        if (ar) setAreas(ar.map((x: any) => ({ name: x.area_name })));
        if (ag) setAgencies(ag.map((x: any) => ({ name: x.agency_name })));
        if (m) setMarkas(m.map((x: any) => ({ name: x.marka_name })));
        const mergedVouchers = [...(av || []), ...(fa || []).map((f: any) => ({
          ...f,
          temporary_arrival_no: f.final_arrival_no || f.temporary_arrival_no || f.arrival_no,
        }))];
        setArrivalVouchers(mergedVouchers);
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'temporary_material_received' }, () => {
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

  // Automatically retrieve the exact P.O. date from purchase_master whenever po_no changes
  useEffect(() => {
    if (!supabase || !masterData.po_no) return;
    const fetchActualPoDate = async () => {
      try {
        const { data, error } = await supabase
          .from("purchase_master")
          .select("po_date")
          .eq("po_no", masterData.po_no.trim())
          .maybeSingle();
        if (error) throw error;
        if (data && data.po_date) {
          setMasterData((prev) => {
            if (prev.po_date !== data.po_date) {
              return { ...prev, po_date: data.po_date };
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn("Failed to fetch exact PO date from purchase_master:", err);
      }
    };
    fetchActualPoDate();
  }, [masterData.po_no]);

  // Sync / Load inspection records for Modal View search
  const loadSavedInspectionsList = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("mill_inspection_master")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSavedInspections(data || []);

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

  // Load a historical inspection directly into the active workbench
  const loadInspectionIntoForm = async (insp: InspectionMaster) => {
    if (!supabase) return;
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      // Set Master fields in uppercase
      const voucher = getVoucherForInspection(insp);
      const mappedInsp = {
        ...insp,
        broker_name: (insp.broker_name || "").toUpperCase(),
        supplier_name: (insp.supplier_name || "").toUpperCase(),
        lorry_number: insp.lorry_number || (voucher as any)?.lorry_number || (voucher as any)?.lorry_no || (voucher as any)?.vehicle_no || "",
      };
      setMasterData(mappedInsp);

      // Fetch corresponding details rows
      const { data, error } = await supabase
        .from("mill_inspection_detail")
        .select("*")
        .eq("mr_no", insp.mr_no)
        .order("srl_no", { ascending: true });

      if (error) throw error;

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
      } else {
        // Fallback placeholder rows
        setDetailsList([1, 2, 3, 4, 5].map(createEmptyRow));
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

    setMasterData((prev) => ({
      ...prev,
      arrival_no: voucher.temporary_arrival_no || voucher.amad_no || prev.arrival_no,
      arrival_date: voucher.date || prev.arrival_date,
      po_no: voucher.po_no || prev.po_no,
      po_date: voucher.lorry_date || voucher.date || prev.po_date,
      broker_name: (voucher.broker || prev.broker_name || "").toUpperCase(),
      supplier_name: (
        voucher.supplier ||
        prev.supplier_name ||
        ""
      ).toUpperCase(),
      lorry_number: voucher.lorry_number || voucher.lorry_no || voucher.vehicle_no || prev.lorry_number || "",
      remarks: voucher.remarks || prev.remarks,
    }));

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

        return {
          srl_no: i + 1,
          arrival_grade: (
            row.challan_grade_name ||
            row.receipt_grade_name ||
            ""
          ).toUpperCase(),
          stock_grade_code: (row.receipt_grade_code || "").toUpperCase(),
          stock_grade_name: (row.receipt_grade_name || "").toUpperCase(),
          area: (voucher.arrival_area_name || "").toUpperCase(),
          agency: (row.agency_name || "").toUpperCase(),
          marka: (row.challan_marka_name || "").toUpperCase(),
          crop_year: (() => {
            const rawCy = String(row.crop_year || voucher.financial_year || "").trim();
            if (!rawCy) return "2026-27";
            if (rawCy === "2025-25" || rawCy === "2025-2026") return "2025-26";
            if (rawCy === "2024-2025") return "2024-25";
            if (rawCy === "2026-2027") return "2026-27";
            if (rawCy === "2027-2028") return "2027-28";
            return rawCy;
          })(),
          lot: "",
          quantity: derivedQuantity,
          unit: rowUnit,
          challan_gross_wt: row.netto_pnto || row.challan_gross_wt || "",
        };
      });

      const defaultUnit = voucherUnit || "BALES";
      while (mappedDetails.length < 5) {
        mappedDetails.push({
          srl_no: mappedDetails.length + 1,
          arrival_grade: "",
          stock_grade_code: "",
          stock_grade_name: "",
          area: "",
          agency: "",
          marka: "",
          crop_year: "2026-27",
          lot: "",
          quantity: "",
          unit: defaultUnit,
          challan_gross_wt: "",
        });
      }

      setDetailsList(mappedDetails);
      setSuccessMessage(
        `Matched & Auto-filled parameter fields & ledger rows as per Jute Arrival / PO #${voucher.po_no || voucher.temporary_arrival_no || voucher.amad_no || ""}!`,
      );
    } else {
      setSuccessMessage(
        `Matched & Auto-filled parameters as per Jute Arrival / PO #${voucher.po_no || voucher.temporary_arrival_no || voucher.amad_no || ""}! Fill custom table parameters.`,
      );
    }
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
    if (field === "quantity" || field === "challan_gross_wt") {
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
      const finalIndexed = filtered.map((row, i) => ({
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

  // Delete current transaction fully (Restricted to L4, L5, Admin)
  const handleDeleteAction = async () => {
    if (!enforceEditOrDeletePermission("Delete")) {
      return;
    }

    if (
      !window.confirm(
        `Permanently delete all logs for MR No.: ${masterData.mr_no}?`,
      )
    )
      return;
    if (!supabase) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const { error: detailErr } = await supabase
        .from("mill_inspection_detail")
        .delete()
        .eq("mr_no", masterData.mr_no);
      if (detailErr) console.warn("Notice deleting mill_inspection_detail:", detailErr);

      const { error } = await supabase
        .from("mill_inspection_master")
        .delete()
        .eq("mr_no", masterData.mr_no);

      if (error) throw error;

      setSuccessMessage(
        `Inspection report ${masterData.mr_no} completely purged from the system.`,
      );
      setViewMode("dashboard");
      loadSavedInspectionsList();
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
  const handleSaveAction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      // 1. Save or Update Master
      const { data: existing } = await supabase
        .from("mill_inspection_master")
        .select("mr_no")
        .eq("mr_no", masterData.mr_no)
        .maybeSingle();

      if (existing) {
        // Edit update
        const { error: masterErr } = await supabase
          .from("mill_inspection_master")
          .update({
            mr_date: masterData.mr_date || null,
            arrival_no: masterData.arrival_no,
            arrival_date: masterData.arrival_date || null,
            po_no: masterData.po_no,
            po_date: masterData.po_date || null,
            broker_name: masterData.broker_name,
            supplier_name: masterData.supplier_name,
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
          })
          .eq("mr_no", masterData.mr_no);

        if (masterErr) throw masterErr;
      } else {
        // Insert new master
        const { error: masterInsertErr } = await supabase
          .from("mill_inspection_master")
          .insert({
            mr_no: masterData.mr_no,
            mr_date: masterData.mr_date || null,
            arrival_no: masterData.arrival_no,
            arrival_date: masterData.arrival_date || null,
            po_no: masterData.po_no,
            po_date: masterData.po_date || null,
            broker_name: masterData.broker_name,
            supplier_name: masterData.supplier_name,
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
          });

        if (masterInsertErr) throw masterInsertErr;
      }

      // 2. Clean out old Detail Rows (to safely rewrite or insert)
      await supabase
        .from("mill_inspection_detail")
        .delete()
        .eq("mr_no", masterData.mr_no);

      // 3. Filter valid rows to write (must have at least grade or agency input)
      const validRowsToWrite = detailsList
        .filter(
          (row) =>
            row.arrival_grade || row.stock_grade_code || row.area || row.agency,
        )
        .map((row) => ({
          mr_no: masterData.mr_no,
          srl_no: row.srl_no,
          arrival_grade: row.arrival_grade,
          stock_grade_code: row.stock_grade_code,
          stock_grade_name: row.stock_grade_name,
          area: row.area,
          agency: row.agency,
          marka: row.marka,
          crop_year: row.crop_year,
          lot: row.lot,
          quantity: row.quantity === "" ? 0 : Number(row.quantity),
          unit: row.unit || "BALES",
          challan_gross_wt:
            row.challan_gross_wt === "" ? 0 : Number(row.challan_gross_wt),
        }));

      if (validRowsToWrite.length > 0) {
        const { error: detailsInsertErr } = await supabase
          .from("mill_inspection_detail")
          .insert(validRowsToWrite);

        if (detailsInsertErr) throw detailsInsertErr;
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
        <div className="w-full px-2 space-y-3 font-sans max-w-full">
          {/* Dashboard Stats Panel */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#d4d0c8] border border-white border-b-gray-600 border-r-gray-600 p-2 shadow-sm">
              <p className="text-[9px] font-black uppercase text-gray-500">
                Quality Audits Completed
              </p>
              <p className="text-base font-mono font-black text-blue-900">
                {totalInspections} Reports
              </p>
            </div>
            <div className="bg-[#d4d0c8] border border-white border-b-gray-600 border-r-gray-600 p-2 shadow-sm">
              <p className="text-[9px] font-black uppercase text-gray-500">
                Moisture Profile (Avg Actual %)
              </p>
              <p className="text-base font-mono font-black text-emerald-850">
                {avgMoisture.toFixed(2)} %
              </p>
            </div>
            <div className="bg-[#d4d0c8] border border-white border-b-gray-600 border-r-gray-600 p-2 shadow-sm">
              <p className="text-[9px] font-black uppercase text-gray-500">
                Dust Profiling (Avg Actual %)
              </p>
              <p className="text-base font-mono font-black text-rose-850">
                {avgDust.toFixed(2)} %
              </p>
            </div>
            <div className="bg-[#d4d0c8] border border-white border-b-gray-600 border-r-gray-600 p-2 shadow-sm">
              <p className="text-[9px] font-black uppercase text-gray-500">
                P.O. Total Contract
              </p>
              <p className="text-base font-mono font-black text-sky-800">
                {totalContractWeight.toFixed(3)} MT
              </p>
            </div>
            <div className="bg-[#d4d0c8] border border-white border-b-gray-600 border-r-gray-600 p-2 shadow-sm">
              <p className="text-[9px] font-black uppercase text-gray-500">
                P.O. Received Weight
              </p>
              <p className="text-base font-mono font-black text-emerald-800">
                {totalReceivedWeight.toFixed(3)} MT
              </p>
            </div>
            <div className="bg-[#d4d0c8] border border-white border-b-gray-600 border-r-gray-600 p-2 shadow-sm">
              <p className="text-[9px] font-black uppercase text-gray-500">
                P.O. Pending Outstanding
              </p>
              <p className="text-base font-mono font-black text-amber-800">
                {totalPendingWeight.toFixed(3)} MT
              </p>
            </div>
          </div>

          {/* Top Control Bar with search */}
          <div className="flex bg-[#c0c0c0] p-1.5 border border-black/20 gap-2.5 items-center flex-wrap shadow-sm">
            <div className="flex bg-white border border-gray-400 p-px flex-1 min-w-[280px]">
              <input
                className="flex-1 text-xs px-2.5 outline-none py-1.5 font-sans font-bold"
                placeholder="Search M.R. No, Supplier name, Broker name, P.O. No..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
              <button className="bg-[#d4d0c8] px-3 border-l border-gray-400 hover:bg-gray-300 transition-colors">
                <Search className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Arrival Date Range Picker */}
            <div className="flex items-center gap-1.5 bg-[#d4d0c8] px-2.5 py-1 border border-black/15 shadow-inner">
              <span className="text-[9px] font-black uppercase text-slate-800 ">Arrival From:</span>
              <input
                type="date"
                value={arrivalStartDate}
                onChange={(e) => setArrivalStartDate(e.target.value)}
                className="bg-white border border-gray-400 text-[10.5px] px-1.5 py-0.5 font-mono font-bold outline-none cursor-pointer"
              />
              <span className="text-[9px] font-black uppercase text-slate-800 ">To:</span>
              <input
                type="date"
                value={arrivalEndDate}
                onChange={(e) => setArrivalEndDate(e.target.value)}
                className="bg-white border border-gray-400 text-[10.5px] px-1.5 py-0.5 font-mono font-bold outline-none cursor-pointer"
              />
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => {
                  setSearchFilter("");
                  setArrivalStartDate("");
                  setArrivalEndDate("");
                }}
                className="bg-[#d4d0c8] border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3 py-1.5 text-[10px] uppercase font-black tracking-tight flex items-center gap-1.5 active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] active:translate-y-px cursor-pointer"
              >
                <X className="h-3.5 w-3.5 text-blue-900" /> Clear
              </button>
              <button
                onClick={handleRefreshDatabase}
                title="Refresh database records"
                className="bg-emerald-700 hover:bg-[#1b5e20] text-white border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3 py-1.5 text-[10px] uppercase font-black tracking-tight flex items-center gap-1.5 active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] active:translate-y-px cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-wait" disabled={loading}
              >
                <RefreshCcw className={`h-3.5 w-3.5 text-emerald-100 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex gap-1.5 flex-wrap items-center">
            <button
              onClick={() => {
                setMasterData(initialMasterState());
                setDetailsList([1, 2, 3, 4, 5].map(createEmptyRow));
                setIsEditMode(true);
                setErrorMessage("");
                setSuccessMessage("");
                setViewMode("entry");
              }}
              className="bg-[#0d47a1] hover:bg-blue-800 text-white border-2 border-slate-400 hover:border-slate-600 font-extrabold text-[10px] px-5 py-2 uppercase tracking-wide rounded-sm active:translate-y-px flex items-center gap-1 shadow cursor-pointer "
            >
              <Plus className="h-4 w-4" />
              New Inspection
            </button>

             <button
              onClick={handleExportToExcel}
              className="bg-[#1e7145] hover:bg-[#155231] text-white border-2 border-[#103e25] font-extrabold text-[10px] px-5 py-2 uppercase tracking-wide rounded-sm active:translate-y-px flex items-center gap-1.5 shadow cursor-pointer "
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export to Excel
            </button>



            {/* View Settings Dropdown */}
            <div className="relative inline-block text-left">
              <button
                type="button"
                onClick={() => setViewSettingsOpen(!viewSettingsOpen)}
                className="bg-[#d4d0c8] hover:bg-gray-200 text-slate-800 border-2 border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] font-extrabold text-[10px] px-4 py-2 uppercase tracking-wide rounded-sm active:translate-y-px flex items-center gap-1.5 cursor-pointer "
              >
                ⚙️ View Settings
                <span className="text-[8px]">{viewSettingsOpen ? "▲" : "▼"}</span>
              </button>
              {viewSettingsOpen && (
                <div className="origin-top-left absolute left-0 md:left-auto md:right-0 mt-1 w-56 rounded-md shadow-lg bg-white border border-gray-400 ring-1 ring-black ring-opacity-5 z-20 p-2 text-xs font-semibold">
                  <div className="border-b border-gray-200 pb-1 mb-1 flex items-center justify-between ">
                    <span className="text-[9px] uppercase font-black tracking-wider text-gray-500">Toggle Column View</span>
                    <button
                      onClick={() => setViewSettingsOpen(false)}
                      className="text-gray-405 hover:text-gray-900 font-extrabold font-mono text-sm"
                    >
                      ×
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {Object.keys(visibleColumns).map((colKey) => {
                      return (
                        <label key={colKey} className="flex items-center gap-2 hover:bg-slate-100 p-1 rounded cursor-pointer ">
                          <input
                            type="checkbox"
                            checked={visibleColumns[colKey]}
                            onChange={(e) => {
                              setVisibleColumns(prev => ({
                                ...prev,
                                [colKey]: e.target.checked
                              }));
                            }}
                            className="cursor-pointer h-3.5 w-3.5 border-gray-400"
                          />
                          <span className="text-[11px] text-slate-700 font-bold">{columnLabels[colKey] || colKey}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* M.R Wise Pending List Button */}
            <button
              type="button"
              onClick={() => setCurrentTab(currentTab === "inspections" ? "pending_mr" : "inspections")}
              className={`border-2 border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] font-extrabold text-[10px] px-4 py-2 uppercase tracking-wide rounded-sm active:translate-y-px flex items-center gap-1.5 cursor-pointer  transition-all ${
                currentTab === "pending_mr"
                  ? "bg-amber-700 text-white hover:bg-amber-800"
                  : "bg-[#d4d0c8] hover:bg-gray-200 text-slate-800"
              }`}
            >
              ⏳ M.R Wise Pending List ({(() => {
                const pendingCount = arrivalVouchers.filter((v) => {
                  const arrivalVal = (v.temporary_arrival_no || v.amad_no || "").trim().toUpperCase();
                  if (!arrivalVal) return false;
                  return !savedInspections.some(
                    (insp) => (insp.arrival_no || "").trim().toUpperCase() === arrivalVal
                  );
                }).length;
                return pendingCount;
              })()})
            </button>

            {selectedMrNos.length > 0 && currentTab === "inspections" && (
              <button
                onClick={handleBatchPrint}
                className="bg-[#2a3088] hover:bg-[#1a2168] text-white border-2 border-slate-400 font-extrabold text-[10px] px-5 py-2 uppercase tracking-wide rounded-sm active:translate-y-px flex items-center gap-1.5 shadow cursor-pointer "
              >
                <Printer className="h-4 w-4 text-cyan-200 animate-pulse" />
                Batch Print Selected ({selectedMrNos.length})
              </button>
            )}

            <div className="flex-1" />

            <div className="flex items-center text-[10.5px] font-bold text-slate-700  uppercase">
              <span>
                {currentTab === "inspections" ? (
                  <>
                    Total Inspections Logged:{" "}
                    <b className="text-[#0d47a1] text-xs font-black">
                      {filteredSavedInspections.length}
                    </b>
                  </>
                ) : (
                  <>
                    Total Pending Inspections:{" "}
                    <b className="text-amber-850 text-xs font-black">
                      {filteredPendingMrList.length}
                    </b>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Grid Table */}
          <div className="border border-gray-400 bg-white overflow-x-auto min-h-[440px]">
            <table className="w-full border-collapse text-[10px] whitespace-nowrap">
              <thead className="bg-[#c0c0c0] sticky top-0 z-10 ">
                {currentTab === "inspections" ? (
                  <tr className="border-b border-gray-400 text-slate-800 h-8 font-black uppercase text-center">
                    {visibleColumns.select && (
                      <th className="px-2 text-center border-r border-gray-300 w-10">
                        <input
                          type="checkbox"
                          checked={
                            filteredSavedInspections.length > 0 &&
                            filteredSavedInspections.every((item) =>
                              selectedMrNos.includes(item.mr_no)
                            )
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMrNos(
                                filteredSavedInspections.map((item) => item.mr_no)
                              );
                            } else {
                              setSelectedMrNos([]);
                            }
                          }}
                          className="cursor-pointer"
                        />
                      </th>
                    )}
                    {visibleColumns.mr_no && (
                      <th className="px-3 text-left border-r border-gray-300 w-28">
                        M.R. No.
                      </th>
                    )}
                    {visibleColumns.mr_date && (
                      <th className="px-2 border-r border-gray-300 w-24">
                        M.R. Date
                      </th>
                    )}
                    {visibleColumns.supplier && (
                      <th className="px-4 text-left border-r border-gray-300">
                        Supplier/Merchant
                      </th>
                    )}
                    {visibleColumns.broker && (
                      <th className="px-4 text-left border-r border-gray-300">
                        Broker Name
                      </th>
                    )}
                    {visibleColumns.po_ref && (
                      <th className="px-3 border-r border-gray-300 w-32">
                        P.O. Reference
                      </th>
                    )}
                    {visibleColumns.moisture && (
                      <th className="px-2 border-r border-gray-300 w-24">
                        Moisture %
                      </th>
                    )}
                    {visibleColumns.weft_dust && (
                      <th className="px-2 border-r border-gray-300 w-24">
                        Weft Dust %
                      </th>
                    )}
                    {visibleColumns.ncv && (
                      <th className="px-2 border-r border-gray-300 w-24">NCV %</th>
                    )}
                    {visibleColumns.detn_days && (
                      <th className="px-2 border-r border-gray-300 w-20">
                        Detn. Days
                      </th>
                    )}
                    {visibleColumns.arrival_no && (
                      <th className="px-2 border-r border-gray-300 w-24">
                        Arrival No
                      </th>
                    )}
                    {visibleColumns.unloading && (
                      <th className="px-3 border-r border-gray-300 w-24">
                        Unloading
                      </th>
                    )}
                    {visibleColumns.print_status && (
                      <th className="px-3 border-r border-gray-300 w-24">
                        Print Status
                      </th>
                    )}
                    {visibleColumns.lorry_number && (
                      <th className="px-3 border-r border-gray-300 w-28">
                        Lorry Number
                      </th>
                    )}
                    {visibleColumns.gate_entry_time && (
                      <th className="px-3 border-r border-gray-300 w-28">
                        Gate Entry Time
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th className="px-3 text-center">Actions</th>
                    )}
                  </tr>
                ) : (
                  <tr className="border-b border-gray-400 text-slate-800 h-8 font-black uppercase text-center">
                    <th className="px-3 text-left border-r border-gray-300 w-28">M.R. / Arrival No.</th>
                    <th className="px-3 border-r border-gray-300 w-28">Arrival Date</th>
                    <th className="px-3 border-r border-gray-300 w-32">P.O. Reference</th>
                    <th className="px-4 text-left border-r border-gray-300">Supplier / Merchant</th>
                    <th className="px-4 text-left border-r border-gray-300">Broker Name</th>
                    <th className="px-3 border-r border-gray-300 w-24 text-right">Qty</th>
                    <th className="px-3 border-r border-gray-300 w-24 text-right">Weight</th>
                    <th className="px-3 border-r border-gray-300 w-32 text-center">Status</th>
                    <th className="px-3 text-center w-36">Actions</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-200 font-bold bg-white text-slate-800">
                {currentTab === "inspections" ? (
                  filteredSavedInspections.map((row, idx) => {
                  const activeColSpanCount = Object.values(visibleColumns).filter(Boolean).length;
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        onClick={() => {
                          loadInspectionIntoForm(row);
                          handleToggleExpand(row);
                        }}
                        onDoubleClick={() => {
                          if (canEditOrDelete()) {
                            loadInspectionIntoForm(row);
                            setIsEditMode(true);
                            setViewMode("entry");
                          }
                        }}
                        title="Click to toggle expand / Double-click to instantly edit this report"
                        className={`h-9 cursor-pointer hover:bg-amber-100/50 transition-colors ${
                          expandedMrNo === row.mr_no 
                            ? "bg-amber-50" 
                            : idx % 2 === 0 
                            ? "bg-white" 
                            : "bg-slate-50/50"
                        }`}
                      >
                        {visibleColumns.select && (
                          <td
                            className="px-2 text-center border-r border-slate-200 w-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedMrNos.includes(row.mr_no)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMrNos((prev) => [...prev, row.mr_no]);
                                } else {
                                  setSelectedMrNos((prev) =>
                                    prev.filter((no) => no !== row.mr_no)
                                  );
                                }
                              }}
                              className="cursor-pointer"
                            />
                          </td>
                        )}
                        {visibleColumns.mr_no && (
                          <td className="px-3 font-extrabold text-[#0d47a1] border-r border-slate-200">
                            {row.mr_no}
                          </td>
                        )}
                        {visibleColumns.mr_date && (
                          <td className="px-2 text-center font-mono border-r border-slate-200">
                            {row.mr_date}
                          </td>
                        )}
                        {visibleColumns.supplier && (
                          <td className="px-4 font-bold uppercase truncate max-w-[200px] border-r border-slate-200">
                            {row.supplier_name || "-"}
                          </td>
                        )}
                        {visibleColumns.broker && (
                          <td className="px-4 font-bold uppercase truncate max-w-[150px] border-r border-slate-200">
                            {row.broker_name || "-"}
                          </td>
                        )}
                        {visibleColumns.po_ref && (() => {
                          const hasFinalArrival = row.po_no && finalArrivals.some(
                            fa => fa.po_no && String(fa.po_no).trim().toUpperCase() === String(row.po_no).trim().toUpperCase()
                          );
                          return (
                            <td className="px-3 text-center border-r border-slate-200">
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <span className="font-mono text-stone-600 font-bold">
                                  {row.po_no ? `#${row.po_no}` : "-"}
                                </span>
                                {hasFinalArrival && (
                                  <span className="inline-block bg-emerald-100 text-emerald-800 border border-emerald-300 text-[8px] font-black uppercase px-1 rounded tracking-wider leading-normal  shadow-xs" title="Final received data exists in Final Arrival Register">
                                    ✓ FINAL RECEIVED
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })()}
                        {visibleColumns.moisture && (
                          <td className="px-2 text-center font-black font-mono text-emerald-850 border-r border-slate-200">
                            {row.actual_moisture ? `${row.actual_moisture} %` : "-"}
                          </td>
                        )}
                        {visibleColumns.weft_dust && (
                          <td className="px-2 text-center font-mono text-orange-850 border-r border-slate-200">
                            {row.actual_dust ? `${row.actual_dust} %` : "-"}
                          </td>
                        )}
                        {visibleColumns.ncv && (
                          <td className="px-2 text-center font-mono text-stone-700 border-r border-slate-200">
                            {row.actual_ncv ? `${row.actual_ncv} %` : "-"}
                          </td>
                        )}
                        {visibleColumns.detn_days && (
                          <td className="px-2 text-center font-mono border-r border-slate-200">
                            {row.detention_days ?? 0}
                          </td>
                        )}
                        {visibleColumns.arrival_no && (
                          <td className="px-2 text-center font-mono uppercase text-sky-850 border-r border-slate-200">
                            {row.arrival_no || "-"}
                          </td>
                        )}
                        {visibleColumns.unloading && (
                          <td className="px-3 text-center font-mono border-r border-slate-200">
                            {row.unloading_date || "-"}
                          </td>
                        )}
                        {visibleColumns.print_status && (
                          <td className="px-3 text-center border-r border-slate-200">
                            {printedInspections[row.mr_no] ? (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-250 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                                Printed
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-550 border border-slate-200 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                                Pending
                              </span>
                            )}
                          </td>
                        )}
                        {visibleColumns.lorry_number && (
                          <td className="px-3 border-r border-slate-200 font-mono text-slate-700">
                            {row.lorry_number || (getVoucherForInspection(row) as any)?.lorry_number || (getVoucherForInspection(row) as any)?.lorry_no || (getVoucherForInspection(row) as any)?.vehicle_no || "-"}
                          </td>
                        )}
                        {visibleColumns.gate_entry_time && (
                          <td className="px-3 border-r border-gray-300 font-mono text-slate-600">
                            {getVoucherForInspection(row)?.created_at 
                              ? new Date(getVoucherForInspection(row).created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                              : "-"}
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td
                            className="px-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex justify-center gap-2">
                              {/* Edit Icon Button */}
                              {canEditOrDelete() && (
                                <button
                                  onClick={() => {
                                    loadInspectionIntoForm(row);
                                    setIsEditMode(true);
                                    setViewMode("entry");
                                  }}
                                  className="p-1 hover:bg-blue-100 text-blue-700 rounded transition-all active:scale-90 cursor-pointer"
                                  title="Edit Inspection (Double-click row to edit directly)"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              )}
                              
                              {/* Print Icon Button */}
                              <button
                                onClick={(e) => handlePreparePrintInspection(row, e)}
                                className="p-1 hover:bg-emerald-100 text-emerald-700 rounded transition-all active:scale-90 cursor-pointer"
                                title="Print Quality Audit Slip"
                              >
                                <Printer className="h-4 w-4" />
                              </button>

                              {/* Delete Icon Button */}
                              {canEditOrDelete() && (
                                <button
                                  onClick={async () => {
                                    if (!enforceEditOrDeletePermission("Delete")) return;
                                    if (
                                      confirm(
                                        `Are you sure you want to delete Inspection record ${row.mr_no}?`,
                                      )
                                    ) {
                                      try {
                                        setLoading(true);
                                        await supabase
                                          .from("mill_inspection_detail")
                                          .delete()
                                          .eq("mr_no", row.mr_no);
                                        const { error } = await supabase
                                          .from("mill_inspection_master")
                                          .delete()
                                          .eq("mr_no", row.mr_no);
                                        if (error) throw error;
                                        loadSavedInspectionsList();
                                      } catch (err: any) {
                                        alert("Delete failed: " + err.message);
                                      } finally {
                                        setLoading(false);
                                      }
                                    }
                                  }}
                                  className="p-1 hover:bg-rose-100 text-rose-700 rounded transition-all active:scale-90 cursor-pointer"
                                  title="Delete Record"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* Expandable panel row */}
                      {expandedMrNo === row.mr_no && (
                        <tr className="bg-amber-50/15">
                          <td colSpan={activeColSpanCount} className="p-3 bg-[#fdfaf2] border-b border-gray-400">
                            <div className="bg-white border-2 border-[#808080] p-4 shadow-inner">
                              <div className="flex items-center justify-between border-b border-dashed border-gray-300 pb-2 mb-3">
                                <span className="text-xs font-black text-blue-950 uppercase tracking-widest flex items-center gap-1.5  animate-fade-in">
                                  🔍 Expanded Quality & Grade Allocation Audit [M.R. No: {row.mr_no}]
                                </span>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setExpandedMrNo(null); }}
                                  className="text-stone-400 hover:text-stone-750 text-xs font-black uppercase tracking-tight cursor-pointer"
                                >
                                  Hide Details
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-bold leading-normal">
                                {/* Column 1: Moisture Profile */}
                                <div className="bg-emerald-50/50 p-2.5 border border-emerald-200 rounded">
                                  <h5 className="font-black text-emerald-800 uppercase text-[9px] tracking-wider mb-1.5">💧 Moisture Profile (Actual vs Clm)</h5>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between">
                                      <span className="text-slate-550">Actual Moisture:</span>
                                      <span className="font-mono font-black text-emerald-950">{row.actual_moisture ? `${row.actual_moisture}%` : "-"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-550">Claim Moisture:</span>
                                      <span className="font-mono font-bold text-slate-700">{row.claim_moisture ? `${row.claim_moisture}%` : "-"}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-emerald-100 pt-1 mt-1 font-bold">
                                      <span className="text-slate-550">Variance/Excess:</span>
                                      <span className="font-mono text-[#d32f2f]">
                                        {row.actual_moisture && row.claim_moisture ? `${(row.actual_moisture - row.claim_moisture).toFixed(2)}%` : "0.00%"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Column 2: Impurities / NCV */}
                                <div className="bg-orange-50/50 p-2.5 border border-orange-200 rounded">
                                  <h5 className="font-black text-orange-850 uppercase text-[9px] tracking-wider mb-1.5">🍂 Dust & NCV Profile</h5>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between">
                                      <span className="text-slate-550">Actual Dust:</span>
                                      <span className="font-mono font-bold text-orange-950">{row.actual_dust ? `${row.actual_dust}%` : "-"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-550">Average NCV %:</span>
                                      <span className="font-mono font-bold text-stone-800">{row.actual_ncv ? `${row.actual_ncv}%` : "-"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-550">Unloading Period:</span>
                                      <span className="font-mono font-bold text-slate-700">{row.unloading_date || "-"}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Column 3: Logistics & Reference */}
                                <div className="bg-sky-50/50 p-2.5 border border-sky-200 rounded">
                                  <h5 className="font-black text-sky-850 uppercase text-[9px] tracking-wider mb-1.5">📋 Logistics & Reference</h5>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between">
                                      <span className="text-slate-550">Lorry Number:</span>
                                      <span className="font-mono font-black text-slate-800">{row.lorry_number || (getVoucherForInspection(row) as any)?.lorry_number || (getVoucherForInspection(row) as any)?.lorry_no || (getVoucherForInspection(row) as any)?.vehicle_no || "-"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-550">Gate Entry:</span>
                                      <span className="font-mono font-bold text-slate-650">
                                        {getVoucherForInspection(row)?.created_at ? new Date(getVoucherForInspection(row).created_at).toLocaleString() : "-"}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-550">Mill P.O. Number:</span>
                                      <span className="font-mono font-bold text-sky-900">{row.mill_po_no || "-"}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Column 4: Remarks */}
                                <div className="bg-slate-50 p-2.5 border border-slate-200 rounded">
                                  <h5 className="font-black text-slate-500 uppercase text-[9px] tracking-wider mb-1.5">💬 Technician Remarks</h5>
                                  <p className="text-[11px] text-slate-700 italic leading-relaxed whitespace-pre-wrap break-words bg-white p-1.5 border border-slate-100 rounded min-h-[50px]">
                                    {row.remarks || "(No custom remarks reported for this cargo)"}
                                  </p>
                                </div>
                              </div>

                              {/* Itemized Grade Allotment List */}
                              <div className="mt-4 bg-[#f8f9fa] border border-[#d4d0c8] p-3 rounded-sm">
                                <h6 className="font-black text-slate-750 uppercase text-[9px] tracking-wider mb-2 flex items-center gap-1">
                                  🏷️ Itemized Component Allocations & Color Grades
                                </h6>
                                {expandedDetails[row.mr_no] ? (
                                  expandedDetails[row.mr_no].length > 0 ? (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-[10.5px] font-semibold border-collapse">
                                        <thead>
                                          <tr className="bg-slate-200 text-slate-700 font-extrabold uppercase text-[9px] border-b border-slate-300">
                                            <th className="p-1 px-2">Srl No.</th>
                                            <th className="p-1">Arrival Grade / Color Spec</th>
                                            <th className="p-1">Stock Grade Code</th>
                                            <th className="p-1">Stock Grade Name</th>
                                            <th className="p-1">Milled Area/Zone</th>
                                            <th className="p-1">Milled Agency</th>
                                            <th className="p-1">Marka/Code</th>
                                            <th className="p-1">Crop Year</th>
                                            <th className="p-1">Lot No</th>
                                            <th className="p-1 text-right">Qty</th>
                                            <th className="p-1">Unit</th>
                                            <th className="p-1 text-right">Challan Gross Wt</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {expandedDetails[row.mr_no].map((d) => (
                                            <tr key={d.id || d.srl_no} className="hover:bg-slate-105/50 font-medium">
                                              <td className="p-1 px-2 font-mono text-[10px] text-slate-450">{d.srl_no}</td>
                                              <td className="p-1 text-indigo-700 font-bold uppercase">{d.arrival_grade || "N/A"}</td>
                                              <td className="p-1 font-mono text-emerald-800 font-black">{d.stock_grade_code || "-"}</td>
                                              <td className="p-1 uppercase text-slate-600">{d.stock_grade_name || "-"}</td>
                                              <td className="p-1 uppercase text-slate-650">{d.area || "-"}</td>
                                              <td className="p-1 uppercase text-slate-650">{d.agency || "-"}</td>
                                              <td className="p-1 font-mono text-stone-605">{d.marka || "-"}</td>
                                              <td className="p-1 font-mono text-slate-500">{d.crop_year || "-"}</td>
                                              <td className="p-1 font-mono text-slate-700">{d.lot || "-"}</td>
                                              <td className="p-1 font-mono text-right font-bold text-sky-905">{d.quantity}</td>
                                              <td className="p-1 text-slate-500">{d.unit || "BALES"}</td>
                                              <td className="p-1 font-mono text-right font-medium text-slate-600">{d.challan_gross_wt}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-[10px] italic text-slate-450 uppercase py-1">No split components parsed for this record.</p>
                                  )
                                ) : (
                                  <div className="flex items-center gap-1.5 py-1">
                                    <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-slate-550 border-t-transparent rounded-full"></span>
                                    <span className="text-[10.5px] italic text-slate-450 uppercase font-black tracking-wider animate-pulse">Synchronizing allocations ...</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                filteredPendingMrList.map((row, idx) => {
                  const arrivalDateFormatted = row.date ? new Date(row.date).toLocaleDateString("en-GB") : "--";
                  const bales = Number(row.total_packets || row.packets || 0);
                  const weightMt = Number(row.weight_qtl || row.weight || 0) / 10;
                  const arrivalVal = row.temporary_arrival_no || row.amad_no;

                  return (
                    <tr
                      key={row.id || idx}
                      className={`h-9 hover:bg-amber-50/50 transition-colors ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                      }`}
                    >
                      {/* M.R. / Arrival No. */}
                      <td className="px-3 font-extrabold text-[#b45309] border-r border-slate-200">
                        {arrivalVal}
                      </td>

                      {/* Arrival Date */}
                      <td className="px-3 text-center font-mono border-r border-slate-200 text-stone-600">
                        {arrivalDateFormatted}
                      </td>

                      {/* P.O. Reference */}
                      <td className="px-3 text-center font-mono text-stone-600 border-r border-slate-200">
                        {row.po_no ? `#${row.po_no}` : "-"}
                      </td>

                      {/* Supplier */}
                      <td className="px-4 font-bold uppercase truncate max-w-[200px] border-r border-slate-200">
                        {row.supplier || "-"}
                      </td>

                      {/* Broker */}
                      <td className="px-4 font-semibold uppercase truncate max-w-[150px] border-r border-slate-200 text-slate-650">
                        {row.broker || "-"}
                      </td>

                      {/* Bales */}
                      <td className="px-3 text-right font-mono text-blue-700 border-r border-slate-200">
                        {bales}
                      </td>

                      {/* Weight */}
                      <td className="px-3 text-right font-mono text-red-700 border-r border-slate-200">
                        {weightMt.toFixed(3)}
                      </td>

                      {/* Status */}
                      <td className="px-3 text-center border-r border-slate-200 ">
                        <span className="bg-amber-50 text-amber-700 border border-amber-250 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
                          ⏳ PENDING INSPECTION
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 text-center">
                        <button
                          onClick={() => {
                            // Reset state first to new master state template
                            const freshMaster = initialMasterState();
                            setMasterData({
                              ...freshMaster,
                              arrival_no: arrivalVal
                            });
                            setDetailsList([1, 2, 3, 4, 5].map(createEmptyRow));
                            setIsEditMode(true);
                            setErrorMessage("");
                            setSuccessMessage("");
                            setViewMode("entry");

                            // Trigger auto-fill using the full arrival row object
                            handleAutoFillFromVoucher(row);
                          }}
                          className="bg-[#0d47a1] hover:bg-blue-800 text-white font-black text-[9px] uppercase px-3 py-1 shadow-[1px_1px_0_0_black] border border-white active:shadow-[inset_1px_1px_0_0_black] rounded cursor-pointer transition-colors"
                        >
                          🔬 Inspect Quality
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Empty State */}
              {((currentTab === "inspections" && filteredSavedInspections.length === 0) ||
                (currentTab === "pending_mr" && filteredPendingMrList.length === 0)) && (
                <tr>
                  <td
                    colSpan={currentTab === "inspections" ? Object.values(visibleColumns).filter(Boolean).length : 9}
                    className="py-16 text-center text-gray-500 font-bold uppercase text-[11px] leading-relaxed bg-white"
                  >
                    {currentTab === "inspections" 
                      ? "No Registered Quality Inspections Found matching the criteria."
                      : "No Pending Material Arrival Records found. All Arrivals have recorded Quality Inspections."}
                  </td>
                </tr>
              )}

              {/* Blank spacer rows to maintain retro height */}
              {Array.from({
                length: Math.max(
                  0,
                  12 - (currentTab === "inspections" ? filteredSavedInspections.length : filteredPendingMrList.length)
                ),
              }).map((_, i) => (
                <tr key={`spacer-${i}`} className="h-9 border-b border-gray-100 opacity-25">
                  <td colSpan={currentTab === "inspections" ? Object.values(visibleColumns).filter(Boolean).length : 9}></td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>

          {/* Status Bar */}
          <div className="bg-[#cbd5e1] border border-slate-400 p-2 text-slate-800 font-mono text-[9.5px] flex justify-between items-center  uppercase">
            <span>
              * Click on any Record Row above to view parameters details. Double
              click to customize reports *
            </span>
            <span className="font-extrabold italic text-[#0d47a1]">
              System Connected Secure Core node BJCL-95
            </span>
          </div>
        </div>

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
            <option key={idx} value={b.name} />
          ))}
        </datalist>
        <datalist id="suppliersList">
          {suppliers.map((s, idx) => (
            <option key={idx} value={s.name} />
          ))}
        </datalist>
        <datalist id="gradesList">
          {grades.map((g, idx) => (
            <option key={idx} value={g.code} />
          ))}
        </datalist>
        <datalist id="areasList">
          {areas.map((a, idx) => (
            <option key={idx} value={a.name} />
          ))}
        </datalist>
        <datalist id="agenciesList">
          {agencies.map((ag, idx) => (
            <option key={idx} value={ag.name} />
          ))}
        </datalist>
        <datalist id="markasList">
          {markas.map((m, idx) => (
            <option key={idx} value={m.name} />
          ))}
        </datalist>
        <datalist id="arrivalPoList">
          {arrivalVouchers
            .filter((v) => {
              if (!v.po_no) return false;
              const arrivalVal = (v.temporary_arrival_no || v.arrival_no || v.amad_no || "").trim().toUpperCase();
              if (!arrivalVal) return false;
              const isAlreadyInspected = savedInspections.some(
                (insp) => (insp.arrival_no || insp.temporary_arrival_no || "").trim().toUpperCase() === arrivalVal
              );
              if (isAlreadyInspected && (masterData.po_no || "").trim().toUpperCase() !== (v.po_no || "").trim().toUpperCase()) {
                return false;
              }
              return true;
            })
            .map((v, idx) => (
              <option
                key={idx}
                value={v.po_no}
              >{`P.O. #${v.po_no} | Temp Arrival No: ${v.temporary_arrival_no || v.arrival_no || v.amad_no || ""} | Supplier: ${v.supplier || ""}`}</option>
            ))}
        </datalist>
        <datalist id="arrivalNoList">
          {arrivalVouchers
            .filter((v) => {
              const arrivalVal = (v.temporary_arrival_no || v.arrival_no || v.amad_no || "").trim().toUpperCase();
              if (!arrivalVal) return false;
              const isAlreadyInspected = savedInspections.some(
                (insp) => (insp.arrival_no || insp.temporary_arrival_no || "").trim().toUpperCase() === arrivalVal
              );
              if (isAlreadyInspected && (masterData.arrival_no || "").trim().toUpperCase() !== arrivalVal) {
                return false;
              }
              return true;
            })
            .map((v, idx) => {
              const arrivalVal = v.temporary_arrival_no || v.arrival_no || v.amad_no;
              return (
                <option
                  key={idx}
                  value={arrivalVal}
                >{`Temp Arrival No: ${arrivalVal} | P.O. #${v.po_no || ""} | Supplier: ${v.supplier || ""}`}</option>
              );
            })}
        </datalist>

        {/* MAIN VISUAL CARD CONTAINER */}
        
        <div className="flex-1 flex flex-col font-sans text-slate-800 space-y-5">
          <div className="relative px-6 py-4 bg-[#174C2C] border border-[#0F351E] rounded-xl flex items-center justify-between shrink-0 shadow-md overflow-hidden max-w-7xl mx-auto w-full text-white">
            {/* Background Mill Illustration Artwork on the Right with light opacity */}
            <div 
              className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 pointer-events-none bg-no-repeat bg-right bg-contain filter brightness-200"
              style={{ backgroundImage: `url('https://res.cloudinary.com/x6tw39wi/image/upload/v1785928946/icon_vffvx9.png')` }}
            />
  
            <div className="relative z-10 flex flex-col gap-1">
              <h2 className="font-serif font-black text-2xl text-amber-300 tracking-tight leading-none">
                Mill Inspection Information
              </h2>
            </div>
  
            {/* Action Controls & Session Badge */}
            <div className="relative z-10 flex items-center gap-3">
              <button
                type="button"
                className="px-3.5 py-1.5 bg-[#103A20] hover:bg-[#1C5130] text-amber-300 border border-[#235E39] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
                title="Back to Sauda Desk (Esc)"
              >
                <ArrowLeft className="h-4 w-4 text-amber-300" />
                <span>Back </span>
              </button>
              <div className="bg-[#103A20] border border-[#235E39] px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-2xs">
                <span className="text-emerald-200/80 font-medium">Session:</span>
                <span className="font-bold text-amber-300 font-mono text-xs">{ 'BJCL/2026-2027/'}</span>
              </div>
            </div>
          </div>
          
          
          <div className="max-w-7xl mx-auto w-full rounded-xl border border-[#174C2C] bg-white shadow-md overflow-hidden">

            {/* Header */}
            <div className="px-6 py-3 bg-[#174C2C] border-b border-[#0F351E]">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Material Receipt Information
              </h2>
            </div>

            {/* Body */}
            <div className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">

                {/* M.R. No */}
                <div className="flex items-center gap-3">
                  <label className="w-36 text-[11px] font-bold">
                    M. R. No.
                  </label>
                  <input
                    type="text"
                    name="mr_no"
                    value={masterData.mr_no}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 h-8 rounded-md border border-gray-300 px-2 text-xs"
                  />
                </div>

                {/* M.R. Date */}
                <div className="flex items-center gap-3">
                  <label className="w-36 text-[11px] font-bold">
                    M. R. Date
                  </label>
                  <input
                    type="date"
                    name="mr_date"
                    value={masterData.mr_date}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 h-8 rounded-md border border-gray-300 px-2 text-xs"
                  />
                </div>

                {/* Temporary Arrival No */}
                <div className="flex items-center gap-3">
                  <label className="w-36 text-[11px] font-bold">
                    Temporary Arrival No.
                  </label>

                  <SupabaseAutoCompleteInput
                    label="Temporary Arrival No."
                    name="arrival_no"
                    fieldColumn="temporary_arrival_no"
                    value={masterData.arrival_no}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    onSelectOption={(_val, record) => {
                      if (record) handleAutoFillFromVoucher(record);
                    }}
                    placeholder="Temporary Arrival Number"
                    savedInspections={savedInspections}
                  />
                </div>

                {/* Arrival Date */}
                <div className="flex items-center gap-3">
                  <label className="w-36 text-[11px] font-bold">
                    Arrival Date
                  </label>
                  <input
                    type="date"
                    name="arrival_date"
                    value={masterData.arrival_date}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 h-8 rounded-md border border-gray-300 px-2 text-xs"
                  />
                </div>

                {/* Lorry Number */}
                <div className="flex items-center gap-3">
                  <label className="w-36 text-[11px] font-bold text-amber-900">
                    Lorry Number
                  </label>
                  <input
                    type="text"
                    name="lorry_number"
                    value={masterData.lorry_number || ""}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 h-8 rounded-md border border-amber-300 bg-amber-50 px-2 text-xs"
                  />
                </div>

                <div></div>

                {/* P.O. No */}
                <div className="flex items-center gap-3">
                  <label className="w-36 text-[11px] font-bold">
                    P. O. No.
                  </label>

                  <SupabaseAutoCompleteInput
                    label="P. O. No."
                    name="po_no"
                    fieldColumn="po_no"
                    value={masterData.po_no}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    onSelectOption={(_val, record) => {
                      if (record) handleAutoFillFromVoucher(record);
                    }}
                    placeholder="P. O. Number"
                    savedInspections={savedInspections}
                  />
                </div>

                {/* P.O. Date */}
                <div className="flex items-center gap-3">
                  <label className="w-36 text-[11px] font-bold">
                    P. O. Date
                  </label>
                  <input
                    type="date"
                    name="po_date"
                    value={masterData.po_date}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 h-8 rounded-md border border-gray-300 px-2 text-xs"
                  />
                </div>

              </div>
            </div>
          </div>
          {/* ================= Broker & Supplier Information ================= */}
          <div className="max-w-7xl mx-auto w-full mt-5 rounded-xl border border-[#174C2C] bg-white shadow-md overflow-hidden">

            {/* Header */}
            <div className="px-6 py-3 bg-[#174C2C] border-b border-[#0F351E]">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Broker & Supplier Information
              </h2>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">

              {/* Broker Name */}
              <div className="flex items-center gap-4">
                <label className="w-44 text-[11px] font-bold text-slate-700">
                  Broker Name
                </label>

                <input
                  type="text"
                  name="broker_name"
                  list="brokersList"
                  value={masterData.broker_name}
                  disabled={!isEditMode}
                  onChange={handleMasterChange}
                  placeholder="Enter or Select Broker Name"
                  className="flex-1 h-9 rounded-md border border-gray-300 px-3 text-xs font-semibold uppercase bg-white focus:outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 disabled:bg-slate-100"
                />
              </div>

              {/* Supplier Name */}
              <div className="flex items-center gap-4">
                <label className="w-44 text-[11px] font-bold text-slate-700">
                  Supplier Name
                </label>

                <input
                  type="text"
                  name="supplier_name"
                  list="suppliersList"
                  value={masterData.supplier_name}
                  disabled={!isEditMode}
                  onChange={handleMasterChange}
                  placeholder="Enter or Select Jute Merchant Supplier"
                  className="flex-1 h-9 rounded-md border border-gray-300 px-3 text-xs font-semibold uppercase bg-white focus:outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 disabled:bg-slate-100"
                />
              </div>

            </div>
          </div>

          {/* ================= Moisture & Technical Parameters ================= */}
          <div className="max-w-7xl mx-auto w-full mt-5 rounded-xl border border-[#174C2C] bg-white shadow-md overflow-hidden">

            {/* Header */}
            <div className="px-6 py-3 bg-[#174C2C] border-b border-[#0F351E]">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Moisture & Technical Parameters
              </h2>
            </div>

            {/* Body */}
            <div className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">

                {/* LEFT SIDE */}

                {/* Actual Moisture */}
                <div className="flex items-center gap-3">
                  <label className="w-40 text-[11px] font-bold">
                    Actual Moisture %
                  </label>

                  <input
                    type="number"
                    step="0.1"
                    name="actual_moisture"
                    value={masterData.actual_moisture || ""}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="0.0"
                    className="flex-1 h-8 rounded-md border border-gray-300 px-2 text-xs font-bold text-center"
                  />
                </div>

                {/* Claim Moisture */}
                {(() => {
                  const currentVal = Number(masterData.claim_moisture ?? 0);

                  const isOverridden =
                    !adminApproved.claim_moisture &&
                    (
                      overriddenFields.claim_moisture ||
                      Math.abs(currentVal - autoValues.claim_moisture) > 0.05
                    );

                  return (
                    <div className="flex items-center gap-3 relative">

                      <label className="w-40 text-[11px] font-bold shrink-0 flex items-center justify-between">
                        <span>Claim Moisture %</span>

                        {isOverridden && (
                          <span className="text-[9px] font-extrabold text-red-700 bg-red-100 border border-red-300 px-1 rounded animate-pulse">
                            Manual
                          </span>
                        )}
                      </label>

                      <div
                        className="relative flex-1 flex items-center"
                        onMouseEnter={() => setHoveredField("claim_moisture")}
                        onMouseLeave={() => setHoveredField(null)}
                      >

                        <input
                          type="number"
                          step="0.1"
                          name="claim_moisture"
                          value={masterData.claim_moisture ?? ""}
                          disabled={!isEditMode}
                          onChange={handleMasterChange}
                          placeholder="0.0"
                          className={`w-full h-8 rounded-md px-2 text-xs font-bold text-center transition-all focus:outline-none disabled:bg-slate-100 ${
                            isOverridden
                              ? "border-2 border-red-500 bg-red-50 text-red-900 ring-2 ring-red-200"
                              : "border border-gray-300 bg-white focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20"
                          }`}
                        />

                        {isOverridden && (
                          <span className="absolute right-2 text-red-600 text-xs font-bold pointer-events-none">
                            📌
                          </span>
                        )}

                        {isOverridden &&
                          hoveredField === "claim_moisture" && (
                            <div className="absolute bottom-full left-0 mb-2 w-80 z-50 rounded-lg border-2 border-amber-400 bg-amber-100 p-3 text-[11px] shadow-2xl">

                              <div className="flex items-center justify-between border-b border-amber-300 pb-1 mb-2">
                                <span className="font-black text-red-700">
                                  📌 Sticky Note: Manual Entry
                                </span>

                                <span className="rounded bg-amber-200 px-2 py-0.5 text-[9px] font-bold uppercase">
                                  Modified
                                </span>
                              </div>

                              <div className="space-y-2">

                                <div className="flex justify-between">
                                  <span>Past Automatic Value</span>

                                  <span className="font-bold text-blue-900">
                                    {autoValues.claim_moisture}%
                                  </span>
                                </div>

                                <div className="flex justify-between">
                                  <span>Current Manual Entry</span>

                                  <span className="font-bold text-red-700">
                                    {masterData.claim_moisture}%
                                  </span>
                                </div>

                              </div>

                              <div className="mt-3 flex gap-2">

                                <button
                                  type="button"
                                  onClick={() => revertToAuto("claim_moisture")}
                                  className="flex-1 rounded bg-blue-600 py-1 text-[10px] font-bold text-white hover:bg-blue-700 cursor-pointer"
                                >
                                  Reset Auto ({autoValues.claim_moisture}%)
                                </button>

                                <button
                                  type="button"
                                  onClick={() => markAsNormal("claim_moisture")}
                                  className="rounded bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
                                >
                                  Accept Normal
                                </button>

                              </div>

                            </div>
                          )}

                      </div>

                    </div>
                  );
                })()}

                {/* Actual Dust */}
                <div className="flex items-center gap-3">
                  <label className="w-40 text-[11px] font-bold">
                    Actual Dust %
                  </label>

                  <input
                    type="number"
                    step="0.1"
                    name="actual_dust"
                    value={masterData.actual_dust || ""}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="0.0"
                    className="flex-1 h-8 rounded-md border border-gray-300 px-2 text-xs font-bold text-center"
                  />
                </div>

                {/* ================= Claim Dust ================= */}
                {(() => {
                  const currentVal = Number(masterData.claim_dust ?? 0);

                  const isOverridden =
                    !adminApproved.claim_dust &&
                    (
                      overriddenFields.claim_dust ||
                      Math.abs(currentVal - autoValues.claim_dust) > 0.05
                    );

                  return (
                    <div className="flex items-center gap-3 relative">

                      <label className="w-40 text-[11px] font-bold shrink-0 flex items-center justify-between">
                        <span>Claim Dust %</span>

                        {isOverridden && (
                          <span className="text-[9px] font-extrabold text-red-700 bg-red-100 border border-red-300 px-1 rounded animate-pulse">
                            Manual
                          </span>
                        )}
                      </label>

                      <div
                        className="relative flex-1 flex items-center"
                        onMouseEnter={() => setHoveredField("claim_dust")}
                        onMouseLeave={() => setHoveredField(null)}
                      >

                        <input
                          type="number"
                          step="0.1"
                          name="claim_dust"
                          value={masterData.claim_dust ?? ""}
                          disabled={!isEditMode}
                          onChange={handleMasterChange}
                          placeholder="0.0"
                          className={`w-full h-8 rounded-md px-2 text-xs font-bold text-center transition-all focus:outline-none disabled:bg-slate-100 ${
                            isOverridden
                              ? "border-2 border-red-500 bg-red-50 text-red-900 ring-2 ring-red-200"
                              : "border border-gray-300 bg-white focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20"
                          }`}
                        />

                        {isOverridden && (
                          <span className="absolute right-2 text-red-600 text-xs font-bold pointer-events-none">
                            📌
                          </span>
                        )}

                        {isOverridden &&
                          hoveredField === "claim_dust" && (
                            <div className="absolute bottom-full left-0 mb-2 w-80 z-50 rounded-lg border-2 border-amber-400 bg-amber-100 p-3 text-[11px] shadow-2xl">

                              <div className="flex items-center justify-between border-b border-amber-300 pb-1 mb-2">
                                <span className="font-black text-red-700">
                                  📌 Sticky Note: Manual Entry
                                </span>

                                <span className="rounded bg-amber-200 px-2 py-0.5 text-[9px] font-bold uppercase">
                                  Modified
                                </span>
                              </div>

                              <div className="space-y-2">

                                <div className="flex justify-between">
                                  <span>Past Automatic Value</span>

                                  <span className="font-bold text-blue-900">
                                    {autoValues.claim_dust}%
                                  </span>
                                </div>

                                <div className="flex justify-between">
                                  <span>Current Manual Entry</span>

                                  <span className="font-bold text-red-700">
                                    {masterData.claim_dust}%
                                  </span>
                                </div>

                              </div>

                              <div className="mt-3 flex gap-2">

                                <button
                                  type="button"
                                  onClick={() => revertToAuto("claim_dust")}
                                  className="flex-1 rounded bg-blue-600 py-1 text-[10px] font-bold text-white hover:bg-blue-700 cursor-pointer"
                                >
                                  Reset Auto ({autoValues.claim_dust}%)
                                </button>

                                <button
                                  type="button"
                                  onClick={() => markAsNormal("claim_dust")}
                                  className="rounded bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
                                >
                                  Accept Normal
                                </button>

                              </div>

                            </div>
                          )}

                      </div>

                    </div>
                  );
                })()}

                {/* Actual NCV */}
                <div className="flex items-center gap-3">
                  <label className="w-40 text-[11px] font-bold">
                    Actual NCV %
                  </label>

                  <input
                    type="number"
                    step="0.1"
                    name="actual_ncv"
                    value={masterData.actual_ncv || ""}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="0.0"
                    className="flex-1 h-8 rounded-md border border-gray-300 px-2 text-xs font-bold text-center"
                  />
                </div>

                {/* ================= Claim NCV ================= */}
                {(() => {
                  const currentVal = Number(masterData.claim_ncv ?? 0);

                  const isOverridden =
                    !adminApproved.claim_ncv &&
                    (
                      overriddenFields.claim_ncv ||
                      Math.abs(currentVal - autoValues.claim_ncv) > 0.05
                    );

                  return (
                    <div className="flex items-center gap-3 relative">

                      <label className="w-40 text-[11px] font-bold shrink-0 flex items-center justify-between">
                        <span>Claim NCV %</span>

                        {isOverridden && (
                          <span className="text-[9px] font-extrabold text-red-700 bg-red-100 border border-red-300 px-1 rounded animate-pulse">
                            Manual
                          </span>
                        )}
                      </label>

                      <div
                        className="relative flex-1 flex items-center"
                        onMouseEnter={() => setHoveredField("claim_ncv")}
                        onMouseLeave={() => setHoveredField(null)}
                      >

                        <input
                          type="number"
                          step="0.1"
                          name="claim_ncv"
                          value={masterData.claim_ncv ?? ""}
                          disabled={!isEditMode}
                          onChange={handleMasterChange}
                          placeholder="0.0"
                          className={`w-full h-8 rounded-md px-2 text-xs font-bold text-center transition-all focus:outline-none disabled:bg-slate-100 ${
                            isOverridden
                              ? "border-2 border-red-500 bg-red-50 text-red-900 ring-2 ring-red-200"
                              : "border border-gray-300 bg-white focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20"
                          }`}
                        />

                        {isOverridden && (
                          <span className="absolute right-2 text-red-600 text-xs font-bold pointer-events-none">
                            📌
                          </span>
                        )}

                        {isOverridden &&
                          hoveredField === "claim_ncv" && (
                            <div className="absolute bottom-full left-0 mb-2 w-80 z-50 rounded-lg border-2 border-amber-400 bg-amber-100 p-3 text-[11px] shadow-2xl">

                              <div className="flex items-center justify-between border-b border-amber-300 pb-1 mb-2">
                                <span className="font-black text-red-700">
                                  📌 Sticky Note: Manual Entry
                                </span>

                                <span className="rounded bg-amber-200 px-2 py-0.5 text-[9px] font-bold uppercase">
                                  Modified
                                </span>
                              </div>

                              <div className="space-y-2">

                                <div className="flex justify-between">
                                  <span>Past Automatic Value</span>

                                  <span className="font-bold text-blue-900">
                                    {autoValues.claim_ncv}%
                                  </span>
                                </div>

                                <div className="flex justify-between">
                                  <span>Current Manual Entry</span>

                                  <span className="font-bold text-red-700">
                                    {masterData.claim_ncv}%
                                  </span>
                                </div>

                              </div>

                              <div className="mt-3 flex gap-2">

                                <button
                                  type="button"
                                  onClick={() => revertToAuto("claim_ncv")}
                                  className="flex-1 rounded bg-blue-600 py-1 text-[10px] font-bold text-white hover:bg-blue-700 cursor-pointer"
                                >
                                  Reset Auto ({autoValues.claim_ncv}%)
                                </button>

                                <button
                                  type="button"
                                  onClick={() => markAsNormal("claim_ncv")}
                                  className="rounded bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
                                >
                                  Accept Normal
                                </button>

                              </div>

                            </div>
                          )}

                      </div>

                    </div>
                  );
                })()}

                {/* Detention Days */}
                <div className="flex items-center gap-3">
                  <label className="w-40 text-[11px] font-bold">
                    Detention Days
                  </label>

                  <input
                    type="number"
                    name="detention_days"
                    value={masterData.detention_days || ""}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 h-8 rounded-md border border-gray-300 px-2 text-xs font-bold text-center"
                  />
                </div>

                {/* Unloading Date */}
                <div className="flex items-center gap-3">
                  <label className="w-40 text-[11px] font-bold">
                    Unloading Date
                  </label>

                  <input
                    type="date"
                    name="unloading_date"
                    value={masterData.unloading_date || ""}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 h-8 rounded-md border border-gray-300 px-2 text-xs"
                  />
                </div>

                {/* Mill P.O. No. */}
                <div className="flex items-center gap-3">
                  <label className="w-40 text-[11px] font-bold">
                    Mill P.O. No.
                  </label>

                  <input
                    type="text"
                    name="mill_po_no"
                    value={masterData.mill_po_no || ""}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 h-8 rounded-md border border-gray-300 px-2 text-xs"
                  />
                </div>

                {/* Mill P.O. Date */}
                <div className="flex items-center gap-3">
                  <label className="w-40 text-[11px] font-bold">
                    Mill P.O. Date
                  </label>

                  <input
                    type="date"
                    name="mill_po_date"
                    value={masterData.mill_po_date || ""}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 h-8 rounded-md border border-gray-300 px-2 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ================= Special Print & Remarks ================= */}
          <div className="max-w-7xl mx-auto w-full mt-5 rounded-xl border border-[#174C2C] bg-white shadow-md">
            <div className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">

                {/* MR. Spcl Print */}
                <div className="flex items-center gap-3">
                  <label className="w-40 text-[11px] font-bold text-slate-700">
                    MR. Spcl Print
                  </label>

                  <input
                    type="text"
                    name="mr_spcl_print"
                    value={masterData.mr_spcl_print || ""}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="Enter Special Print"
                    className="flex-1 h-8 rounded-md border border-gray-300 px-3 text-xs font-semibold focus:outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 disabled:bg-slate-100"
                  />
                </div>

                {/* Empty column for alignment */}
                <div></div>

                {/* Remarks */}
                <div className="lg:col-span-2 flex items-start gap-3">
                  <label className="w-40 text-[11px] font-bold text-slate-700 pt-2">
                    Remarks
                  </label>

                  <textarea
                    name="remarks"
                    rows={3}
                    value={masterData.remarks}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="Inspection remarks, dampness details, parameters observation, log details..."
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold resize-none focus:outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 disabled:bg-slate-100"
                  />
                </div>

              </div>
            </div>
          </div>

          {/* ========================= INSPECTION DETAILS ========================= */}
          <div className="max-w-7xl mx-auto w-full mt-5 rounded-xl border border-[#174C2C] bg-white shadow-md overflow-hidden">

            {/* Section Header */}
            <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-[#174C2C] to-[#1F6B3D] border-b border-[#0F351E]">
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                  Inspection Details
                </h2>
                <p className="text-[10px] text-emerald-100 mt-0.5">
                  Grade • Area • Agency • Marka • Quantity • Challan Details
                </p>
              </div>
            </div>

            {/* Table Body */}
            <div className="p-4 bg-slate-50 overflow-x-auto">
              {/* GRID TABLE */}
              <table className="w-full border-collapse border border-slate-300 min-w-[1000px]">
                <thead className="bg-[#0c48a1] text-white text-[10px] uppercase font-bold text-center  divide-y divide-blue-800">
                  <tr className="divide-x divide-blue-800">
                    <th rowSpan={2} className="px-1.5 py-1.5 w-12 text-center">
                      Srl No.
                    </th>
                    <th
                      rowSpan={2}
                      className="px-2 py-1.5 min-w-[90px] text-left"
                    >
                      Arrival Grade
                    </th>
                    <th
                      colSpan={2}
                      className="px-2 py-1 text-center border-b border-blue-900"
                    >
                      Stock Grade
                    </th>
                    <th
                      rowSpan={2}
                      className="px-2 py-1.5 min-w-[120px] text-left"
                    >
                      Area
                    </th>
                    <th
                      rowSpan={2}
                      className="px-2 py-1.5 min-w-[120px] text-left"
                    >
                      Agency
                    </th>
                    <th
                      rowSpan={2}
                      className="px-2 py-1.5 min-w-[120px] text-left"
                    >
                      Marka
                    </th>
                    <th
                      rowSpan={2}
                      className="px-2 py-1.5 min-w-[85px] text-center"
                    >
                      Crop Year
                    </th>
                    <th
                      rowSpan={2}
                      className="px-2 py-1.5 min-w-[70px] text-left"
                    >
                      Lot
                    </th>
                    <th rowSpan={2} className="px-2 py-1.5 w-24 text-right">
                      Quantity
                    </th>
                    <th rowSpan={2} className="px-2 py-1.5 w-20 text-center">
                      Unit
                    </th>
                    <th rowSpan={2} className="px-2 py-1.5 w-28 text-right">
                      Challan Gross Wt
                    </th>
                  </tr>
                  <tr className="divide-x divide-blue-800 text-center">
                    <th className="px-2 py-1 min-w-[75px] text-left">Code</th>
                    <th className="px-2 py-1 min-w-[140px] text-left">Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 text-[11px] font-semibold">
                  {detailsList.map((row, index) => (
                    <tr
                      key={index}
                      className="hover:bg-blue-50/50 bg-white transition-colors"
                    >
                      {/* Srl No (with double click detection to trigger single record clear) */}
                      <td
                        onDoubleClick={() => handleRowDoubleClick(index)}
                        className="px-1.5 py-1 text-center font-bold text-red-900 bg-red-50/60 border-r border-slate-300 cursor-cell "
                        title="Double-click to clear row"
                      >
                        {row.srl_no}
                      </td>

                      {/* Arrival Grade */}
                      <td className="p-1 border-r border-slate-300">
                        <input
                          type="text"
                          list="gradesList"
                          value={row.arrival_grade}
                          disabled={!isEditMode}
                          onChange={(e) =>
                            handleDetailChange(
                              index,
                              "arrival_grade",
                              e.target.value,
                            )
                          }
                          className="w-full bg-transparent px-1 py-0.5 outline-none font-bold text-slate-805 disabled:text-slate-500 uppercase"
                          placeholder="Grade"
                        />
                      </td>

                      {/* Stock Grade Code */}
                      <td className="p-1 border-r border-slate-300">
                        <input
                          type="text"
                          list="gradesList"
                          value={row.stock_grade_code}
                          disabled={!isEditMode}
                          onChange={(e) =>
                            handleDetailChange(
                              index,
                              "stock_grade_code",
                              e.target.value,
                            )
                          }
                          className="w-full bg-transparent px-1 py-0.5 outline-none font-bold text-indigo-900 disabled:text-slate-500 uppercase"
                          placeholder="Code"
                        />
                      </td>

                      {/* Stock Grade Name */}
                      <td className="p-1 border-r border-slate-300 bg-slate-50/60">
                        <input
                          type="text"
                          value={row.stock_grade_name}
                          readOnly
                          className="w-full bg-transparent px-1 py-0.5 outline-none text-slate-500 font-medium cursor-not-allowed uppercase"
                          placeholder="Auto loaded grade name"
                        />
                      </td>

                      {/* Area */}
                      <td className="p-1 border-r border-slate-300">
                        <input
                          type="text"
                          list="areasList"
                          value={row.area}
                          disabled={!isEditMode}
                          onChange={(e) =>
                            handleDetailChange(index, "area", e.target.value)
                          }
                          className="w-full bg-transparent px-1 py-0.5 outline-none text-slate-755 disabled:text-slate-500 uppercase"
                          placeholder="Area block"
                        />
                      </td>

                      {/* Agency */}
                      <td className="p-1 border-r border-slate-300">
                        <input
                          type="text"
                          list="agenciesList"
                          value={row.agency}
                          disabled={!isEditMode}
                          onChange={(e) =>
                            handleDetailChange(index, "agency", e.target.value)
                          }
                          className="w-full bg-transparent px-1 py-0.5 outline-none text-slate-755 disabled:text-slate-500 uppercase"
                          placeholder="Select Agency"
                        />
                      </td>

                      {/* Marka */}
                      <td className="p-1 border-r border-slate-300">
                        <input
                          type="text"
                          list="markasList"
                          value={row.marka}
                          disabled={!isEditMode}
                          onChange={(e) =>
                            handleDetailChange(index, "marka", e.target.value)
                          }
                          className="w-full bg-transparent px-1 py-0.5 outline-none text-slate-755 disabled:text-slate-500 uppercase"
                          placeholder="Marka code"
                        />
                      </td>

                      {/* Crop Year */}
                      <td className="p-0.5 border-r border-slate-300">
                        <input
                          type="text"
                          value={row.crop_year || ""}
                          disabled={!isEditMode}
                          onChange={(e) =>
                            handleDetailChange(index, "crop_year", e.target.value)
                          }
                          className="w-full bg-transparent px-1 py-0.5 outline-none text-[10px] font-bold text-center uppercase disabled:text-slate-500"
                          placeholder="2026-27"
                        />
                      </td>

                      {/* Lot */}
                      <td className="p-1 border-r border-slate-300">
                        <input
                          type="text"
                          value={row.lot}
                          disabled={!isEditMode}
                          onChange={(e) =>
                            handleDetailChange(index, "lot", e.target.value)
                          }
                          className="w-full bg-transparent px-1 py-0.5 outline-none text-center uppercase"
                          placeholder="Lot No"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="p-1 border-r border-slate-300">
                        <input
                          type="number"
                          value={row.quantity}
                          disabled={!isEditMode}
                          onChange={(e) =>
                            handleDetailChange(index, "quantity", e.target.value)
                          }
                          className="w-full bg-transparent px-1 py-0.5 outline-none text-right font-bold text-slate-800 disabled:text-slate-500"
                          placeholder="0"
                        />
                      </td>

                      {/* Unit */}
                      <td className="p-0.5 border-r border-slate-300">
                        <select
                          value={row.unit || 'BALES'}
                          disabled={!isEditMode}
                          onChange={(e) =>
                            handleDetailChange(index, "unit", e.target.value)
                          }
                          className="w-full bg-transparent py-0.5 text-center font-bold text-[10px] cursor-pointer"
                        >
                          {Array.from(new Set([...unitList, row.unit].filter(Boolean))).map((u: string) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>

                      {/* Challan Gross Wt. */}
                      <td className="p-1">
                        <input
                          type="number"
                          value={row.challan_gross_wt}
                          disabled={!isEditMode}
                          onChange={(e) =>
                            handleDetailChange(
                              index,
                              "challan_gross_wt",
                              e.target.value,
                            )
                          }
                          className="w-full bg-transparent px-1 py-0.5 outline-none text-right font-bold text-slate-800 disabled:text-slate-500"
                          placeholder="0.0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Note banner double-click cleared notification */}
              <div className="bg-sky-50 border border-sky-300 px-3 py-2 text-stone-900 border-dashed text-[10.5px] mt-2 text-center rounded flex items-center justify-center gap-1.5">
                <Info className="h-4 w-4 text-sky-600 animate-bounce" />
                <span>
                  To Delete a Single Record Double Click on Srl No. ( Inspection
                  Details )
                </span>
                {isEditMode && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleAddNewGridRow}
                      className="bg-[#0d47a1] hover:bg-blue-900 text-white px-2 py-0.5 text-[9.5px] uppercase font-black tracking-tight rounded border border-blue-600 active:scale-95 shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-emerald-300" /> [+] Spawn Row
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteLastGridRow}
                      className="bg-rose-800 hover:bg-rose-900 text-white px-2 py-0.5 text-[9.5px] uppercase font-black tracking-tight rounded border border-rose-900 active:scale-95 shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3 text-rose-200" /> [-] Delete Row
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ======================= ACTION BUTTONS ======================= */}
          <div className="max-w-7xl mx-auto w-full mt-5 rounded-xl border border-[#174C2C] bg-[#174C2C] shadow-lg">

            <div className="p-4 flex flex-wrap justify-center items-center gap-3">

              {/* Add Button */}
              <button
                type="button"
                onClick={handleAddAction}
                disabled={loading}
                className="min-w-[130px] bg-white hover:bg-emerald-50 border border-white text-emerald-800 font-bold text-[11px] px-6 py-2.5 rounded-lg shadow transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>

              {/* Edit & Delete */}
              {canEditOrDelete() && (
                <>
                  <button
                    type="button"
                    onClick={handleEditAction}
                    disabled={loading || isEditMode}
                    className="min-w-[130px] bg-white hover:bg-blue-50 border border-white text-blue-800 font-bold text-[11px] px-6 py-2.5 rounded-lg shadow transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    <FileText className="h-4 w-4" />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteAction}
                    disabled={loading || !masterData.mr_no}
                    className="min-w-[130px] bg-white hover:bg-rose-50 border border-white text-rose-700 font-bold text-[11px] px-6 py-2.5 rounded-lg shadow transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </>
              )}

              {/* Print */}
              <button
                type="button"
                onClick={() => handlePreparePrintInspection(masterData)}
                disabled={loading || !masterData.mr_no}
                className="min-w-[140px] bg-white hover:bg-emerald-50 border border-white text-emerald-800 font-bold text-[11px] px-6 py-2.5 rounded-lg shadow transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Print Form
              </button>

              {/* Save */}
              <button
                type="button"
                onClick={() => handleSaveAction()}
                disabled={loading || !isEditMode}
                className="min-w-[140px] bg-emerald-600 hover:bg-emerald-700 border border-emerald-800 text-white font-bold text-[11px] px-6 py-2.5 rounded-lg shadow transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                {loading ? "Processing..." : "Save"}
              </button>

              {/* Cancel */}
              <button
                type="button"
                onClick={handleCancelAction}
                disabled={loading}
                className="min-w-[130px] bg-white hover:bg-amber-50 border border-white text-amber-700 font-bold text-[11px] px-6 py-2.5 rounded-lg shadow transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>

              {/* Exit */}
              <button
                type="button"
                onClick={() => {
                  setViewMode("dashboard");
                  loadSavedInspectionsList();
                }}
                disabled={loading}
                className="min-w-[130px] bg-white hover:bg-slate-100 border border-white text-slate-800 font-bold text-[11px] px-6 py-2.5 rounded-lg shadow transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                <XCircle className="h-4 w-4 text-rose-600" />
                Exit
              </button>

              {/* View Register */}
              <button
                type="button"
                onClick={() => {
                  setViewMode("dashboard");
                  loadSavedInspectionsList();
                }}
                disabled={loading}
                className="min-w-[150px] bg-amber-500 hover:bg-amber-400 border border-amber-600 text-[#174C2C] font-bold text-[11px] px-6 py-2.5 rounded-lg shadow transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                <Search className="h-4 w-4" />
                View Register
              </button>

            </div>
          </div>


        </div>

        {/* <div className="bg-white border-2 border-slate-300 shadow-xl rounded-md overflow-hidden"> */}
          {/* Header Bar with slanted Yellow stripes on blue background */}
          {/* <div className="relative bg-[#0d47a1] text-white py-3.5 text-center border-b-4 border-yellow-400  overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full w-24 opacity-90 pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, #fbbf24, #fbbf24 8px, transparent 8px, transparent 18px)",
              }}
            />

            <div
              className="absolute right-0 top-0 h-full w-24 opacity-90 pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, #fbbf24, #fbbf24 8px, transparent 8px, transparent 18px)",
              }}
            />

            <h2 className="text-lg md:text-xl font-black uppercase tracking-widest relative z-10 drop-shadow-[1px_2px_2px_rgba(0,0,0,0.8)]">
              Mill Inspection Information
            </h2>
          </div> */}

          {/* FORM GRID LAYOUT */}
          {/* <div className="p-4 bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 text-[12px]">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold w-32 shrink-0">
                    M. R. No.
                  </label>
                  <input
                    type="text"
                    name="mr_no"
                    value={masterData.mr_no}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="M. R. Number"
                    className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-black text-blue-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold w-32 shrink-0">
                    Temporary Arrival No.
                  </label>
                  <SupabaseAutoCompleteInput
                    label="Temporary Arrival No."
                    name="arrival_no"
                    fieldColumn="temporary_arrival_no"
                    value={masterData.arrival_no}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    onSelectOption={(_val, record) => {
                      if (record) {
                        handleAutoFillFromVoucher(record);
                      }
                    }}
                    placeholder="Temporary Arrival Number"
                    savedInspections={savedInspections}
                  />
                </div>

                
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold w-32 shrink-0 text-amber-900">
                    Lorry Number
                  </label>
                  <input
                    type="text"
                    name="lorry_number"
                    value={masterData.lorry_number || ''}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="Lorry / Lorry Number"
                    className="flex-1 bg-amber-50 border border-amber-400 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                  />
                </div>

               
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold w-32 shrink-0">
                    P. O. No.
                  </label>
                  <SupabaseAutoCompleteInput
                    label="P. O. No."
                    name="po_no"
                    fieldColumn="po_no"
                    value={masterData.po_no}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    onSelectOption={(_val, record) => {
                      if (record) {
                        handleAutoFillFromVoucher(record);
                      }
                    }}
                    placeholder="P. O. Number"
                    savedInspections={savedInspections}
                  />
                </div>
              </div>

              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold w-32 shrink-0">
                    M. R. Date
                  </label>
                  <input
                    type="date"
                    name="mr_date"
                    value={masterData.mr_date}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                  />
                </div>

                
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold w-32 shrink-0">
                    Arrival Date
                  </label>
                  <input
                    type="date"
                    name="arrival_date"
                    value={masterData.arrival_date}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                  />
                </div>

               
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold w-32 shrink-0">
                    P.O Date
                  </label>
                  <input
                    type="date"
                    name="po_date"
                    value={masterData.po_date}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                  />
                </div>
              </div>

              
              <div className="col-span-1 md:col-span-2 space-y-2 mt-2">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold w-32 shrink-0">
                    Broker Name
                  </label>
                  <input
                    type="text"
                    name="broker_name"
                    list="brokersList"
                    value={masterData.broker_name}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="Enter or select Broker Name"
                    className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 uppercase"
                  />
                </div>

               
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold w-32 shrink-0">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    name="supplier_name"
                    list="suppliersList"
                    value={masterData.supplier_name}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="Enter or select Jute Merchant Supplier"
                    className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 uppercase"
                  />
                </div>
              </div>

              
              <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-12 mt-2 border-t border-slate-200 pt-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold w-32 shrink-0">
                      Actual Moisture %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="actual_moisture"
                      value={masterData.actual_moisture || ""}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      placeholder="0.0"
                      className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-bold text-center focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold w-32 shrink-0">
                      Actual Dust %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="actual_dust"
                      value={masterData.actual_dust || ""}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      placeholder="0.0"
                      className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-bold text-center focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold w-32 shrink-0">
                      Actual NCV %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="actual_ncv"
                      value={masterData.actual_ncv || ""}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      placeholder="0.0"
                      className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-bold text-center focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold w-32 shrink-0">
                      Detention Days
                    </label>
                    <input
                      type="number"
                      name="detention_days"
                      value={masterData.detention_days || ""}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      placeholder="0"
                      className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-bold text-center focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold w-32 shrink-0">
                      Mill P. O. No.
                    </label>
                    <input
                      type="text"
                      name="mill_po_no"
                      value={masterData.mill_po_no}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      placeholder="Mill Purchase Order Link"
                      className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {(() => {
                    const currentVal = Number(masterData.claim_moisture ?? 0);
                    const isOverridden = !adminApproved.claim_moisture && (overriddenFields.claim_moisture || Math.abs(currentVal - autoValues.claim_moisture) > 0.05);
                    return (
                      <div className="flex items-center gap-2 relative">
                        <label className="text-[11px] font-bold w-32 shrink-0 flex items-center justify-between">
                          <span>Claim Moisture %</span>
                          {isOverridden && (
                            <span className="text-[9px] text-red-700 font-extrabold bg-red-100 border border-red-300 px-1 rounded animate-pulse">
                              Manual
                            </span>
                          )}
                        </label>
                        <div 
                          className="relative flex-1 flex items-center"
                          onMouseEnter={() => setHoveredField("claim_moisture")}
                          onMouseLeave={() => setHoveredField(null)}
                        >
                          <input
                            type="number"
                            step="0.1"
                            name="claim_moisture"
                            value={masterData.claim_moisture ?? ""}
                            disabled={!isEditMode}
                            onChange={handleMasterChange}
                            placeholder="0.0"
                            className={`w-full rounded px-2 py-0.5 text-xs font-bold text-center focus:outline-none disabled:bg-slate-100 transition-all ${
                              isOverridden
                                ? "border-2 border-red-500 bg-red-50 text-red-900 font-extrabold ring-2 ring-red-200"
                                : "bg-white border border-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            }`}
                          />
                          {isOverridden && (
                            <span className="absolute right-1 text-red-600 font-bold text-xs pointer-events-none">
                              📌
                            </span>
                          )}
                          {isOverridden && hoveredField === "claim_moisture" && (
                            <div className="absolute bottom-full mb-1 -left-12 w-80 z-50 bg-amber-100 border-2 border-amber-400 text-amber-950 text-[11px] p-2 rounded-lg shadow-2xl animate-in fade-in zoom-in duration-150 pointer-events-auto">
                              <div className="flex items-center justify-between font-black border-b border-amber-300 pb-1 mb-1 text-amber-900">
                                <span className="flex items-center gap-1 text-red-700">
                                  📌 Sticky Note: Manual Entry
                                </span>
                                <span className="text-[9px] bg-amber-200 px-1.5 py-0.5 rounded text-amber-900 uppercase tracking-wider font-extrabold">
                                  Modified
                                </span>
                              </div>
                              <div className="space-y-1 my-1">
                                <div className="flex justify-between items-center text-[10.5px]">
                                  <span className="text-slate-700 font-medium">Past Automatic Value:</span>
                                  <span className="font-extrabold text-blue-900 bg-amber-200 px-1 rounded">{autoValues.claim_moisture}%</span>
                                </div>
                                <div className="flex justify-between items-center text-[10.5px]">
                                  <span className="text-slate-700 font-medium">Current Manual Entry:</span>
                                  <span className="font-extrabold text-red-700 bg-red-100 px-1 rounded">{masterData.claim_moisture}%</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 pt-1 mt-1 border-t border-amber-300">
                                <button
                                  type="button"
                                  onClick={() => revertToAuto("claim_moisture")}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[9.5px] font-bold px-2 py-0.5 rounded shadow cursor-pointer transition-colors"
                                >
                                  Reset Auto ({autoValues.claim_moisture}%)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => markAsNormal("claim_moisture")}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-bold px-2 py-0.5 rounded shadow cursor-pointer transition-colors"
                                >
                                  Accept Normal
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {(() => {
                    const currentVal = Number(masterData.claim_dust ?? 0);
                    const isOverridden = !adminApproved.claim_dust && (overriddenFields.claim_dust || Math.abs(currentVal - autoValues.claim_dust) > 0.05);
                    return (
                      <div className="flex items-center gap-2 relative">
                        <label className="text-[11px] font-bold w-32 shrink-0 flex items-center justify-between">
                          <span>Claim Dust %</span>
                          {isOverridden && (
                            <span className="text-[9px] text-red-700 font-extrabold bg-red-100 border border-red-300 px-1 rounded animate-pulse">
                              Manual
                            </span>
                          )}
                        </label>
                        <div 
                          className="relative flex-1 flex items-center"
                          onMouseEnter={() => setHoveredField("claim_dust")}
                          onMouseLeave={() => setHoveredField(null)}
                        >
                          <input
                            type="number"
                            step="0.1"
                            name="claim_dust"
                            value={masterData.claim_dust ?? ""}
                            disabled={!isEditMode}
                            onChange={handleMasterChange}
                            placeholder="0.0"
                            className={`w-full rounded px-2 py-0.5 text-xs font-bold text-center focus:outline-none disabled:bg-slate-100 transition-all ${
                              isOverridden
                                ? "border-2 border-red-500 bg-red-50 text-red-900 font-extrabold ring-2 ring-red-200"
                                : "bg-white border border-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            }`}
                          />
                          {isOverridden && (
                            <span className="absolute right-1 text-red-600 font-bold text-xs pointer-events-none">
                              📌
                            </span>
                          )}
                          {isOverridden && hoveredField === "claim_dust" && (
                            <div className="absolute bottom-full mb-1 -left-12 w-80 z-50 bg-amber-100 border-2 border-amber-400 text-amber-950 text-[11px] p-2 rounded-lg shadow-2xl animate-in fade-in zoom-in duration-150 pointer-events-auto">
                              <div className="flex items-center justify-between font-black border-b border-amber-300 pb-1 mb-1 text-amber-900">
                                <span className="flex items-center gap-1 text-red-700">
                                  📌 Sticky Note: Manual Entry
                                </span>
                                <span className="text-[9px] bg-amber-200 px-1.5 py-0.5 rounded text-amber-900 uppercase tracking-wider font-extrabold">
                                  Modified
                                </span>
                              </div>
                              <div className="space-y-1 my-1">
                                <div className="flex justify-between items-center text-[10.5px]">
                                  <span className="text-slate-700 font-medium">Past Automatic Value:</span>
                                  <span className="font-extrabold text-blue-900 bg-amber-200 px-1 rounded">{autoValues.claim_dust}%</span>
                                </div>
                                <div className="flex justify-between items-center text-[10.5px]">
                                  <span className="text-slate-700 font-medium">Current Manual Entry:</span>
                                  <span className="font-extrabold text-red-700 bg-red-100 px-1 rounded">{masterData.claim_dust}%</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 pt-1 mt-1 border-t border-amber-300">
                                <button
                                  type="button"
                                  onClick={() => revertToAuto("claim_dust")}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[9.5px] font-bold px-2 py-0.5 rounded shadow cursor-pointer transition-colors"
                                >
                                  Reset Auto ({autoValues.claim_dust}%)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => markAsNormal("claim_dust")}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-bold px-2 py-0.5 rounded shadow cursor-pointer transition-colors"
                                >
                                  Accept Normal
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {(() => {
                    const currentVal = Number(masterData.claim_ncv ?? 0);
                    const isOverridden = !adminApproved.claim_ncv && (overriddenFields.claim_ncv || Math.abs(currentVal - autoValues.claim_ncv) > 0.05);
                    return (
                      <div className="flex items-center gap-2 relative">
                        <label className="text-[11px] font-bold w-32 shrink-0 flex items-center justify-between">
                          <span>Claim NCV %</span>
                          {isOverridden && (
                            <span className="text-[9px] text-red-700 font-extrabold bg-red-100 border border-red-300 px-1 rounded animate-pulse">
                              Manual
                            </span>
                          )}
                        </label>
                        <div 
                          className="relative flex-1 flex items-center"
                          onMouseEnter={() => setHoveredField("claim_ncv")}
                          onMouseLeave={() => setHoveredField(null)}
                        >
                          <input
                            type="number"
                            step="0.1"
                            name="claim_ncv"
                            value={masterData.claim_ncv ?? ""}
                            disabled={!isEditMode}
                            onChange={handleMasterChange}
                            placeholder="0.0"
                            className={`w-full rounded px-2 py-0.5 text-xs font-bold text-center focus:outline-none disabled:bg-slate-100 transition-all ${
                              isOverridden
                                ? "border-2 border-red-500 bg-red-50 text-red-900 font-extrabold ring-2 ring-red-200"
                                : "bg-white border border-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            }`}
                          />
                          {isOverridden && (
                            <span className="absolute right-1 text-red-600 font-bold text-xs pointer-events-none">
                              📌
                            </span>
                          )}
                          {isOverridden && hoveredField === "claim_ncv" && (
                            <div className="absolute bottom-full mb-1 -left-12 w-80 z-50 bg-amber-100 border-2 border-amber-400 text-amber-950 text-[11px] p-2 rounded-lg shadow-2xl animate-in fade-in zoom-in duration-150 pointer-events-auto">
                              <div className="flex items-center justify-between font-black border-b border-amber-300 pb-1 mb-1 text-amber-900">
                                <span className="flex items-center gap-1 text-red-700">
                                  📌 Sticky Note: Manual Entry
                                </span>
                                <span className="text-[9px] bg-amber-200 px-1.5 py-0.5 rounded text-amber-900 uppercase tracking-wider font-extrabold">
                                  Modified
                                </span>
                              </div>
                              <div className="space-y-1 my-1">
                                <div className="flex justify-between items-center text-[10.5px]">
                                  <span className="text-slate-700 font-medium">Past Automatic Value:</span>
                                  <span className="font-extrabold text-blue-900 bg-amber-200 px-1 rounded">{autoValues.claim_ncv}%</span>
                                </div>
                                <div className="flex justify-between items-center text-[10.5px]">
                                  <span className="text-slate-700 font-medium">Current Manual Entry:</span>
                                  <span className="font-extrabold text-red-700 bg-red-100 px-1 rounded">{masterData.claim_ncv}%</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 pt-1 mt-1 border-t border-amber-300">
                                <button
                                  type="button"
                                  onClick={() => revertToAuto("claim_ncv")}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[9.5px] font-bold px-2 py-0.5 rounded shadow cursor-pointer transition-colors"
                                >
                                  Reset Auto ({autoValues.claim_ncv}%)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => markAsNormal("claim_ncv")}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-bold px-2 py-0.5 rounded shadow cursor-pointer transition-colors"
                                >
                                  Accept Normal
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold w-32 shrink-0">
                      Unloading Date
                    </label>
                    <input
                      type="date"
                      name="unloading_date"
                      value={masterData.unloading_date || ""}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold w-32 shrink-0">
                      Mill P.O Date
                    </label>
                    <input
                      type="date"
                      name="mill_po_date"
                      value={masterData.mill_po_date}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              
              <div className="col-span-1 md:col-span-2 space-y-2 mt-2 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold w-32 shrink-0">
                    MR. Spcl Print
                  </label>
                  <input
                    type="text"
                    name="mr_spcl_print"
                    value={masterData.mr_spcl_print}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="MR Special Printing Instructions/Notes"
                    className="flex-1 bg-white border border-gray-400 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <label className="text-[11px] font-bold w-32 shrink-0 pt-1">
                    Remarks
                  </label>
                  <textarea
                    name="remarks"
                    rows={2}
                    value={masterData.remarks}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="Inspection remarks, dampness details, parameters observation log details"
                    className="flex-1 bg-white border border-gray-400 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>{" "}
          </div> */}

          {/* INSPECTION DETAILS PARTITION */}
          {/* <div className="relative bg-[#0d47a1] text-white py-2 text-center uppercase tracking-widest font-black text-xs  border-t-2 border-yellow-400 mt-4 shadow flex items-center justify-center">
            Inspection Details
          </div> */}

          {/* <div className="p-4 bg-slate-50 overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 min-w-[1000px]">
              <thead className="bg-[#0c48a1] text-white text-[10px] uppercase font-bold text-center  divide-y divide-blue-800">
                <tr className="divide-x divide-blue-800">
                  <th rowSpan={2} className="px-1.5 py-1.5 w-12 text-center">
                    Srl No.
                  </th>
                  <th
                    rowSpan={2}
                    className="px-2 py-1.5 min-w-[90px] text-left"
                  >
                    Arrival Grade
                  </th>
                  <th
                    colSpan={2}
                    className="px-2 py-1 text-center border-b border-blue-900"
                  >
                    Stock Grade
                  </th>
                  <th
                    rowSpan={2}
                    className="px-2 py-1.5 min-w-[120px] text-left"
                  >
                    Area
                  </th>
                  <th
                    rowSpan={2}
                    className="px-2 py-1.5 min-w-[120px] text-left"
                  >
                    Agency
                  </th>
                  <th
                    rowSpan={2}
                    className="px-2 py-1.5 min-w-[120px] text-left"
                  >
                    Marka
                  </th>
                  <th
                    rowSpan={2}
                    className="px-2 py-1.5 min-w-[85px] text-center"
                  >
                    Crop Year
                  </th>
                  <th
                    rowSpan={2}
                    className="px-2 py-1.5 min-w-[70px] text-left"
                  >
                    Lot
                  </th>
                  <th rowSpan={2} className="px-2 py-1.5 w-24 text-right">
                    Quantity
                  </th>
                  <th rowSpan={2} className="px-2 py-1.5 w-20 text-center">
                    Unit
                  </th>
                  <th rowSpan={2} className="px-2 py-1.5 w-28 text-right">
                    Challan Gross Wt
                  </th>
                </tr>
                <tr className="divide-x divide-blue-800 text-center">
                  <th className="px-2 py-1 min-w-[75px] text-left">Code</th>
                  <th className="px-2 py-1 min-w-[140px] text-left">Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 text-[11px] font-semibold">
                {detailsList.map((row, index) => (
                  <tr
                    key={index}
                    className="hover:bg-blue-50/50 bg-white transition-colors"
                  >
                    <td
                      onDoubleClick={() => handleRowDoubleClick(index)}
                      className="px-1.5 py-1 text-center font-bold text-red-900 bg-red-50/60 border-r border-slate-300 cursor-cell "
                      title="Double-click to clear row"
                    >
                      {row.srl_no}
                    </td>

                    <td className="p-1 border-r border-slate-300">
                      <input
                        type="text"
                        list="gradesList"
                        value={row.arrival_grade}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          handleDetailChange(
                            index,
                            "arrival_grade",
                            e.target.value,
                          )
                        }
                        className="w-full bg-transparent px-1 py-0.5 outline-none font-bold text-slate-805 disabled:text-slate-500 uppercase"
                        placeholder="Grade"
                      />
                    </td>

                    <td className="p-1 border-r border-slate-300">
                      <input
                        type="text"
                        list="gradesList"
                        value={row.stock_grade_code}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          handleDetailChange(
                            index,
                            "stock_grade_code",
                            e.target.value,
                          )
                        }
                        className="w-full bg-transparent px-1 py-0.5 outline-none font-bold text-indigo-900 disabled:text-slate-500 uppercase"
                        placeholder="Code"
                      />
                    </td>

                    <td className="p-1 border-r border-slate-300 bg-slate-50/60">
                      <input
                        type="text"
                        value={row.stock_grade_name}
                        readOnly
                        className="w-full bg-transparent px-1 py-0.5 outline-none text-slate-500 font-medium cursor-not-allowed uppercase"
                        placeholder="Auto loaded grade name"
                      />
                    </td>

                    <td className="p-1 border-r border-slate-300">
                      <input
                        type="text"
                        list="areasList"
                        value={row.area}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          handleDetailChange(index, "area", e.target.value)
                        }
                        className="w-full bg-transparent px-1 py-0.5 outline-none text-slate-755 disabled:text-slate-500 uppercase"
                        placeholder="Area block"
                      />
                    </td>

                    <td className="p-1 border-r border-slate-300">
                      <input
                        type="text"
                        list="agenciesList"
                        value={row.agency}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          handleDetailChange(index, "agency", e.target.value)
                        }
                        className="w-full bg-transparent px-1 py-0.5 outline-none text-slate-755 disabled:text-slate-500 uppercase"
                        placeholder="Select Agency"
                      />
                    </td>

                    <td className="p-1 border-r border-slate-300">
                      <input
                        type="text"
                        list="markasList"
                        value={row.marka}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          handleDetailChange(index, "marka", e.target.value)
                        }
                        className="w-full bg-transparent px-1 py-0.5 outline-none text-slate-755 disabled:text-slate-500 uppercase"
                        placeholder="Marka code"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-300">
                      <input
                        type="text"
                        value={row.crop_year || ""}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          handleDetailChange(index, "crop_year", e.target.value)
                        }
                        className="w-full bg-transparent px-1 py-0.5 outline-none text-[10px] font-bold text-center uppercase disabled:text-slate-500"
                        placeholder="2026-27"
                      />
                    </td>

                    <td className="p-1 border-r border-slate-300">
                      <input
                        type="text"
                        value={row.lot}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          handleDetailChange(index, "lot", e.target.value)
                        }
                        className="w-full bg-transparent px-1 py-0.5 outline-none text-center uppercase"
                        placeholder="Lot No"
                      />
                    </td>

                    <td className="p-1 border-r border-slate-300">
                      <input
                        type="number"
                        value={row.quantity}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          handleDetailChange(index, "quantity", e.target.value)
                        }
                        className="w-full bg-transparent px-1 py-0.5 outline-none text-right font-bold text-slate-800 disabled:text-slate-500"
                        placeholder="0"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-300">
                      <select
                        value={row.unit || 'BALES'}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          handleDetailChange(index, "unit", e.target.value)
                        }
                        className="w-full bg-transparent py-0.5 text-center font-bold text-[10px] cursor-pointer"
                      >
                        {Array.from(new Set([...unitList, row.unit].filter(Boolean))).map((u: string) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>

                    <td className="p-1">
                      <input
                        type="number"
                        value={row.challan_gross_wt}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          handleDetailChange(
                            index,
                            "challan_gross_wt",
                            e.target.value,
                          )
                        }
                        className="w-full bg-transparent px-1 py-0.5 outline-none text-right font-bold text-slate-800 disabled:text-slate-500"
                        placeholder="0.0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bg-sky-50 border border-sky-300 px-3 py-2 text-stone-900 border-dashed text-[10.5px] mt-2 text-center rounded flex items-center justify-center gap-1.5">
              <Info className="h-4 w-4 text-sky-600 animate-bounce" />
              <span>
                To Delete a Single Record Double Click on Srl No. ( Inspection
                Details )
              </span>
              {isEditMode && (
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAddNewGridRow}
                    className="bg-[#0d47a1] hover:bg-blue-900 text-white px-2 py-0.5 text-[9.5px] uppercase font-black tracking-tight rounded border border-blue-600 active:scale-95 shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-emerald-300" /> [+] Spawn Row
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteLastGridRow}
                    className="bg-rose-800 hover:bg-rose-900 text-white px-2 py-0.5 text-[9.5px] uppercase font-black tracking-tight rounded border border-rose-900 active:scale-95 shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3 text-rose-200" /> [-] Delete Row
                  </button>
                </div>
              )}
            </div>
          </div> */}

          {/* LOWER ACTION CONTROL PANEL DIRECTORY */}
          {/* <div className="bg-[#cbd5e1] border-t-2 border-slate-400 p-3.5 flex flex-wrap justify-center items-center gap-3 md:gap-4 ">
            <button
              type="button"
              onClick={handleAddAction}
              disabled={loading}
              className="bg-white hover:bg-emerald-50 border-2 border-slate-400 font-black text-emerald-800 text-[10px] px-6 py-2 uppercase tracking-wide rounded-sm active:translate-y-px flex items-center gap-1 shadow hover:border-emerald-600 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>

            {canEditOrDelete() && (
              <>
                <button
                  type="button"
                  onClick={handleEditAction}
                  disabled={loading || isEditMode}
                  className="bg-white hover:bg-blue-50 border-2 border-slate-400 font-black text-blue-900 text-[10px] px-6 py-2 uppercase tracking-wide rounded-sm active:translate-y-px flex items-center gap-1 shadow hover:border-blue-650 disabled:opacity-40"
                >
                  <FileText className="h-4 w-4" />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={handleDeleteAction}
                  disabled={loading || !masterData.mr_no}
                  className="bg-white hover:bg-rose-50 border-2 border-slate-400 font-black text-rose-800 text-[10px] px-6 py-2 uppercase tracking-wide rounded-sm active:translate-y-px flex items-center gap-1 shadow hover:border-rose-600 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => handlePreparePrintInspection(masterData)}
              disabled={loading || !masterData.mr_no}
              className="bg-white hover:bg-emerald-50 border-2 border-slate-400 font-black text-emerald-800 text-[10px] px-6 py-2 uppercase tracking-wide rounded-sm active:translate-y-px flex items-center gap-1 shadow hover:border-emerald-600 disabled:opacity-40"
            >
              <Printer className="h-4 w-4 text-emerald-700" />
              Print Form
            </button>

            <button
              type="button"
              onClick={() => handleSaveAction()}
              disabled={loading || !isEditMode}
              className="bg-emerald-750 bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-emerald-900 font-black text-[10px] px-8 py-2 uppercase tracking-wide rounded-sm active:translate-y-px flex items-center gap-1 shadow-md disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              {loading ? "Processing..." : "Save"}
            </button>

            <button
              type="button"
              onClick={handleCancelAction}
              disabled={loading}
              className="bg-white hover:bg-amber-50 border-2 border-slate-400 font-black text-amber-700 text-[10px] px-6 py-2 uppercase tracking-wide rounded-sm active:translate-y-px flex items-center gap-1 shadow hover:border-amber-600 disabled:opacity-40"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode("dashboard");
                loadSavedInspectionsList();
              }}
              disabled={loading}
              className="bg-white hover:bg-slate-100 border-2 border-slate-400 font-black text-indigo-950 text-[10px] px-6 py-2 uppercase tracking-wide rounded-sm active:translate-y-px flex items-center gap-1 shadow hover:border-slate-800 disabled:opacity-40  cursor-pointer"
            >
              <XCircle className="h-4 w-4 text-rose-700" />
              Exit
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode("dashboard");
                loadSavedInspectionsList();
              }}
              disabled={loading}
              className="bg-indigo-900 text-white hover:bg-indigo-950 border-2 border-indigo-950 font-black text-[10px] px-6 py-2 uppercase tracking-wide rounded-sm active:translate-y-px flex items-center gap-1 shadow disabled:opacity-40  cursor-pointer"
            >
              <Search className="h-4 w-4" />
              View Register
            </button>
          </div> */}
        {/* </div> */}

        {/* --- DIALOG MODAL: HISTORIC INSPECTIONS SELECTOR --- */}
        <AnimatePresence>
          {showSearchModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border-2 border-slate-400 shadow-2xl rounded-sm w-full max-w-4xl max-h-[85vh] flex flex-col"
              >
                {/* Modal Title bar */}
                <div className="bg-[#0d47a1] text-white px-4 py-2 flex items-center justify-between border-b border-yellow-405">
                  <span className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Database className="h-4 w-4" />
                    Historic Jute Mill Inspection Reports directory
                  </span>
                  <button
                    onClick={() => setShowSearchModal(false)}
                    className="text-white hover:bg-white/20 p-1 rounded-full transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Sub search input */}
                <div className="p-3 bg-slate-100 border-b border-slate-3 * text-[11px] flex items-center gap-2">
                  <span className="font-extrabold uppercase shrink-0">
                    Search Records:
                  </span>
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search by M.R. Number, order reference, merchant, broker name..."
                    className="flex-1 bg-white border border-slate-400 rounded px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-blue-600"
                  />
                  <span>({filteredSavedInspections.length} total found)</span>
                </div>

                {/* Table search container */}
                <div className="flex-1 overflow-auto p-4">
                  <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
                    <thead className="bg-slate-200 font-black text-slate-800 text-left sticky top-0 uppercase">
                      <tr className="border-b border-slate-300 divide-x divide-white">
                        <th className="px-3 py-2">M.R. No.</th>
                        <th className="px-2 py-2">M.R. Date</th>
                        <th className="px-3 py-2">Supplier / Merchant</th>
                        <th className="px-3 py-2">Broker</th>
                        <th className="px-2 py-2 text-center">
                          Moisture Register
                        </th>
                        <th className="px-2 py-2 text-center text-rose-800">
                          Unloading Date
                        </th>
                        <th className="px-3 py-2 text-center w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-250 font-bold bg-white text-slate-700">
                      {filteredSavedInspections.length > 0 ? (
                        filteredSavedInspections.map((row) => (
                          <tr
                            key={row.id}
                            className="hover:bg-indigo-50/50 transition-colors h-9"
                          >
                            <td className="px-3 text-indigo-900 font-extrabold text-xs">
                              {row.mr_no}
                            </td>
                            <td className="px-2 font-mono">{row.mr_date}</td>
                            <td className="px-3 uppercase truncate max-w-[150px]">
                              {row.supplier_name || "-"}
                            </td>
                            <td className="px-3 uppercase truncate max-w-[130px]">
                              {row.broker_name || "-"}
                            </td>
                            <td className="px-2 text-center font-bold font-mono text-emerald-800">
                              {row.actual_moisture} %
                            </td>
                            <td className="px-2 text-center font-mono">
                              {row.unloading_date}
                            </td>
                            <td className="px-3 text-center py-1">
                              <button
                                onClick={() => loadInspectionIntoForm(row)}
                                className="bg-[#0d47a1] text-white px-2.5 py-1 rounded-sm text-[9.5px] uppercase font-black whitespace-nowrap active:scale-95 transition-all shadow-sm border border-blue-800 hover:bg-slate-800"
                              >
                                [ Load Record ]
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={7}
                            className="text-center py-12 text-slate-400 italic font-medium uppercase font-sans"
                          >
                            No stored inspections found matching terms
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Status bottom info */}
                <div className="bg-slate-150 border-t border-slate-300 px-4 py-2 text-stone-500 font-mono text-[9px] uppercase italic text-center">
                  * Select any record to pull full parameter detail blocks
                  instantly back to active console table
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>



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
