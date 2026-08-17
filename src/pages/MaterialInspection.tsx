import React, { useState, useEffect, useRef } from "react";
import { useLiveAutoRefresh } from "../hooks/useLiveAutoRefresh";
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
  ArrowLeft,
  Scale,
  ClipboardList,
  Truck,
  CheckSquare,
  Calendar,
  User
} from "lucide-react";
import LegacyLayout from "../components/LegacyLayout";
import { supabase } from "../lib/supabase";
import { dbModule } from "../services/dbModule";
import { enforceEditOrDeletePermission, canEditOrDelete, canViewCompletedData, getCurrentUserContext } from "../lib/permissions";
import { comparePoInspection } from "../lib/poMatch";
import { sanitizeCsvData } from "../lib/utils";
import PrintModal from "../components/PrintModal";
import InspectionPrintSlip from "../components/InspectionPrintSlip";

// Helper function to parse date string without timezone offset shifts
function parseDateOnly(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (!s) return null;
  if (s.includes('T')) {
    const parts = s.split('T')[0].split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]), m = Number(parts[1]) - 1, d = Number(parts[2]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
    }
  }
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts[0].length === 4) {
      const y = Number(parts[0]), m = Number(parts[1]) - 1, d = Number(parts[2]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
    } else if (parts[2].length === 4) {
      const y = Number(parts[2]), m = Number(parts[1]) - 1, d = Number(parts[0]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
    }
  }
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts[2].length === 4) {
      const y = Number(parts[2]), m = Number(parts[1]) - 1, d = Number(parts[0]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
    }
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

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
  delivery_claim?: number;
  deduction_type?: string;
  deduction_types?: string[];
  deduction_rate?: number;
  deduction_qty?: number;
  deduction_amount?: number;
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

  useLiveAutoRefresh(fetchLiveData, [], { tables: ['mill_inspection_master', 'mill_inspection_detail', 'inspection_checklist'] });

  // Fetch data directly from Supabase (Inspection only)
  async function fetchLiveData() {
    if (dbRecords.length === 0) setLoading(true);
    setFetchError(null);
    try {
      let data: any[] = [];
      if (supabase) {
        const { data: inspRes } = await supabase
          .from("mill_inspection_master")
          .select("*")
          .order("created_at", { ascending: false });

        const { data: checklistRes } = await supabase
          .from("inspection_checklist")
          .select("*")
          .order("created_at", { ascending: false });

        const combined = [...(inspRes || []), ...(checklistRes || [])];
        const uniqueMap = new Map();
        combined.forEach((item: any) => {
          const key = item.mr_no || item.id;
          if (key && !uniqueMap.has(key)) {
            uniqueMap.set(key, item);
          }
        });
        data = Array.from(uniqueMap.values());
      } else {
        const inspRes = await dbModule.fetchAll("mill_inspection_master").catch(() => []);
        const checklistRes = await dbModule.fetchAll("inspection_checklist").catch(() => []);
        const combined = [...(inspRes || []), ...(checklistRes || [])];
        const uniqueMap = new Map();
        combined.forEach((item: any) => {
          const key = item.mr_no || item.id;
          if (key && !uniqueMap.has(key)) {
            uniqueMap.set(key, item);
          }
        });
        data = Array.from(uniqueMap.values());
      }

      setDbRecords(data);
    } catch (err: any) {
      console.error(`Error fetching inspection records for ${name}:`, err);
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
        rawVal = (record.arrival_no || record.temporary_arrival_no || record.ref_arrival_no || record.mr_no || "").toString().trim();
      } else if (fieldColumn === "po_no") {
        rawVal = (record.po_no || "").toString().trim();
      }

      if (!rawVal) return;

      const upperKey = rawVal.toUpperCase();

      // Check if already inspected (unless it matches current selected value)
      const isAlreadyInspected = savedInspections.some(
        (insp) =>
          (insp.arrival_no || insp.temporary_arrival_no || insp.mr_no || "").trim().toUpperCase() === upperKey ||
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
      const suppMatches = (opt.record?.supplier_name || opt.record?.supplier || "").toString().toLowerCase().includes(searchLower);
      const mrMatches = (opt.record?.mr_no || "").toString().toLowerCase().includes(searchLower);
      const brokerMatches = (opt.record?.broker_name || opt.record?.broker || "").toString().toLowerCase().includes(searchLower);
      return valMatches || poMatches || suppMatches || mrMatches || brokerMatches;
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
          id="value_275" aria-label="value"
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
                <span>Inspection Records</span>
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
                          (opt.record?.supplier_name || opt.record?.supplier) ? ` | ${opt.record.supplier_name || opt.record.supplier}` : ""
                        }`
                      : `${
                          opt.record?.mr_no
                            ? `Insp: ${opt.record.mr_no}`
                            : (opt.record?.arrival_no || opt.record?.temporary_arrival_no)
                            ? `Arrival: ${opt.record.arrival_no || opt.record.temporary_arrival_no}`
                            : ""
                        }${
                          (opt.record?.supplier_name || opt.record?.supplier || opt.record?.broker_name || opt.record?.broker)
                            ? ` | ${opt.record.supplier_name || opt.record.supplier || opt.record.broker_name || opt.record.broker}`
                            : ""
                        }`}
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
  const [deductionMasterList, setDeductionMasterList] = useState<any[]>([]);
  const [selectedPoData, setSelectedPoData] = useState<any>(null);
  const [selectedDeductionTypes, setSelectedDeductionTypes] = useState<string[]>([]);
  const [isDeductionDropdownOpen, setIsDeductionDropdownOpen] = useState(false);

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
    delivery_claim: 0,
    deduction_type: "",
    deduction_types: [],
    deduction_rate: 0,
    deduction_qty: 0,
    deduction_amount: 0,
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
  const [showAllFourSpecs, setShowAllFourSpecs] = useState(false);

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
            .from("mill_inspection_master")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(250),
          supabase.from("unit_master").select("unit_name").order("unit_name").limit(150),
          supabase.from("moisture_logic").select("*"),
          supabase.from("deduction_master").select("*").then(r => r.data || [], () => []),
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
      } catch (err) {
        console.warn("Failed to fetch exact PO from purchase_master:", err);
      }
    };
    fetchActualPoData();
  }, [masterData.po_no]);

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

  // Sync / Load inspection records for Modal View search
  const loadSavedInspectionsList = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      let { data, error } = await supabase
        .from("inspection_checklist")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        const fallback = await supabase
          .from("mill_inspection_master")
          .select("*")
          .order("created_at", { ascending: false });
        data = fallback.data || [];
      }
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

      const dedStr = (insp as any).deduction_type || "";
      const dedArr = dedStr
        ? dedStr.split(",").map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray((insp as any).deduction_types) ? (insp as any).deduction_types : [];
      setSelectedDeductionTypes(dedArr);

      // Fetch corresponding details rows
      let { data, error } = await supabase
        .from("inspection_checklist_details")
        .select("*")
        .eq("mr_no", insp.mr_no)
        .order("srl_no", { ascending: true });

      if (error || !data || data.length === 0) {
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

        return {
          srl_no: i + 1,
          arrival_grade: (
            row.challan_grade_name ||
            row.receipt_grade_name ||
            ""
          ).toUpperCase(),
          stock_grade_code: (row.receipt_grade_code || "").toUpperCase(),
          stock_grade_name: (row.receipt_grade_name || "").toUpperCase(),
          area: rowArea,
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
      await supabase.from("inspection_checklist_details").delete().eq("mr_no", masterData.mr_no).then(() => {}, () => {});
      await supabase.from("mill_inspection_detail").delete().eq("mr_no", masterData.mr_no).then(() => {}, () => {});
      await supabase.from("material_inspection_details").delete().eq("mr_no", masterData.mr_no).then(() => {}, () => {});

      const { error } = await supabase.from("inspection_checklist").delete().eq("mr_no", masterData.mr_no);
      await supabase.from("mill_inspection_master").delete().eq("mr_no", masterData.mr_no).then(() => {}, () => {});
      await supabase.from("material_inspection").delete().eq("mr_no", masterData.mr_no).then(() => {}, () => {});

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
        delivery_claim: (masterData as any).delivery_claim || 0,
        deduction_type: (masterData as any).deduction_type || selectedDeductionTypes.join(', '),
        deduction_rate: (masterData as any).deduction_rate || 0,
        deduction_qty: (masterData as any).deduction_qty || 0,
        deduction_amount: (masterData as any).deduction_amount || 0,
        status: 'Completed'
      };

      // 1. Save or Update Master into inspection_checklist (and secondary legacy tables)
      const { error: masterErr } = await supabase.from("inspection_checklist").upsert(masterPayload);
      if (masterErr) {
        console.warn("Primary upsert to inspection_checklist error, retrying:", masterErr);
      }
      await supabase.from("mill_inspection_master").upsert(masterPayload).then(() => {}, () => {});
      await supabase.from("material_inspection").upsert(masterPayload).then(() => {}, () => {});

      // 2. Clean out old Detail Rows (to safely rewrite or insert)
      await supabase.from("inspection_checklist_details").delete().eq("mr_no", masterData.mr_no).then(() => {}, () => {});
      await supabase.from("mill_inspection_detail").delete().eq("mr_no", masterData.mr_no).then(() => {}, () => {});
      await supabase.from("material_inspection_details").delete().eq("mr_no", masterData.mr_no).then(() => {}, () => {});

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
 id="search_m_r_no_supplier_na_2188" name="search_m_r_no_supplier_na" aria-label="Search M.R. No, Supplier name, Broker name, P.O. No..."                className="flex-1 text-xs px-2.5 outline-none py-1.5 font-sans font-bold"
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
 id="arrivalstartdate_2202" name="arrivalstartdate" aria-label="arrivalstartdate"                type="date"
                value={arrivalStartDate}
                onChange={(e) => setArrivalStartDate(e.target.value)}
                className="bg-white border border-gray-400 text-[10.5px] px-1.5 py-0.5 font-mono font-bold outline-none cursor-pointer"
              />
              <span className="text-[9px] font-black uppercase text-slate-800 ">To:</span>
              <input
 id="arrivalenddate_2209" name="arrivalenddate" aria-label="arrivalenddate"                type="date"
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
 id="checkbox_2290" name="checkbox" aria-label="checkbox"                            type="checkbox"
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
 id="checkbox_2373" name="checkbox" aria-label="checkbox"                          type="checkbox"
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
 id="checkbox_2512" name="checkbox" aria-label="checkbox"                              type="checkbox"
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
              return true;
            })
            .map((v, idx) => (
              <option
                key={idx}
                value={v.po_no}
              >{`P.O. #${v.po_no} | Inspection MR / Arr: ${v.mr_no || v.temporary_arrival_no || v.arrival_no || ""} | Supplier: ${v.supplier || v.supplier_name || ""}`}</option>
            ))}
        </datalist>
        <datalist id="arrivalNoList">
          {arrivalVouchers
            .filter((v) => {
              const arrivalVal = (v.temporary_arrival_no || v.arrival_no || v.amad_no || "").trim().toUpperCase();
              if (!arrivalVal) return false;
              return true;
            })
            .map((v, idx) => {
              const arrivalVal = v.temporary_arrival_no || v.arrival_no || v.amad_no;
              return (
                <option
                  key={idx}
                  value={arrivalVal}
                >{`Inspection MR / Arr No: ${arrivalVal} | P.O. #${v.po_no || ""} | Supplier: ${v.supplier || v.supplier_name || ""}`}</option>
              );
            })}
        </datalist>

        {/* MAIN VISUAL CARD CONTAINER - BJL 2026 - 2027 INSPECTION CHECKLIST */}
        <div className="flex-1 flex flex-col font-sans text-slate-800 space-y-4 w-full pb-10">
          
          {/* HEADER BAR */}
          <div className="bg-[#174C2C] text-white px-6 py-4 rounded-xl shadow-lg flex flex-wrap items-center justify-between border border-[#0F351E] gap-4">
            {/* Left Badge */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-800/40 border border-emerald-400/40 flex items-center justify-center text-amber-300 shadow-inner">
                <Scale className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="bg-[#0b2415] text-amber-300 text-[11px] font-extrabold px-2.5 py-0.5 rounded border border-emerald-700/60 tracking-wider">
                  BJL 2026 - 2027
                </span>
              </div>
            </div>

            {/* Center Title */}
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-widest text-amber-300 drop-shadow text-center">
              INSPECTION CHECKLIST
            </h1>

            {/* Right Controls */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handlePreparePrintInspection(masterData)}
                className="px-4 py-2 bg-[#0b2415]/80 hover:bg-[#123920] border border-emerald-400/50 rounded-lg text-xs font-bold text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>Print</span>
              </button>
              
              <div className="relative">
                <select
                  id="masterdata_mr_no_3135" name="masterdata_mr_no" aria-label="masterdata mr no"
                  value={masterData.mr_no}
                  onChange={(e) => {
                    const sel = savedInspections.find((i) => i.mr_no === e.target.value);
                    if (sel) {
                      loadInspectionIntoForm(sel);
                      setIsEditMode(true);
                      setViewMode("entry");
                    }
                  }}
                  className="bg-[#0b2415] border border-amber-400/70 text-amber-300 text-xs font-black px-3.5 py-2 rounded-lg appearance-none pr-8 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400/50 shadow-inner"
                >
                  <option value={masterData.mr_no}>{masterData.mr_no || 'MRRC-2026-0001'}</option>
                  {savedInspections.map((insp, idx) => (
                    <option key={idx} value={insp.mr_no}>{insp.mr_no} - {insp.supplier_name || 'Inspection'}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-amber-300 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* CARD 1: BASIC INFORMATION */}
          <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
            <div className="bg-slate-100 border-b border-slate-200 px-5 py-2.5 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-700" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                BASIC INFORMATION
              </h2>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-xs">
                {/* Broker * & Date * */}
                <div className="flex items-center gap-2">
                  <label className="w-28 font-semibold text-slate-700">Broker <span className="text-red-500">*</span></label>
                  <input
 id="broker_name_3170" aria-label="Broker Name"                    type="text"
                    list="brokersList"
                    name="broker_name"
                    value={masterData.broker_name || ''}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="Broker Name"
                    className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-semibold uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-24 font-semibold text-slate-700">Date <span className="text-red-500">*</span></label>
                  <input
 id="mr_date_3183" aria-label="mr date"                    type="date"
                    name="mr_date"
                    value={masterData.mr_date || ''}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium focus:border-blue-500 disabled:bg-slate-100"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-24 font-semibold text-slate-700">Lorry No. <span className="text-red-500">*</span></label>
                  <input
 id="lorry_number_3194" aria-label="Select Lorry No."                    type="text"
                    name="lorry_number"
                    value={masterData.lorry_number || ''}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="Select Lorry No."
                    className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-semibold uppercase focus:border-blue-500 disabled:bg-slate-100"
                  />
                </div>

                {/* Supplier * & Date * */}
                <div className="flex items-center gap-2">
                  <label className="w-28 font-semibold text-slate-700">Supplier <span className="text-red-500">*</span></label>
                  <input
 id="supplier_name_3208" aria-label="Supplier Name"                    type="text"
                    list="suppliersList"
                    name="supplier_name"
                    value={masterData.supplier_name || ''}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="Supplier Name"
                    className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-semibold uppercase focus:border-blue-500 disabled:bg-slate-100"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-24 font-semibold text-slate-700">Date <span className="text-red-500">*</span></label>
                  <input
 id="po_date_3221" aria-label="po date"                    type="date"
                    name="po_date"
                    value={masterData.po_date || ''}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium focus:border-blue-500 disabled:bg-slate-100"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-24 font-semibold text-slate-700">P.O. No.</label>
                  <SupabaseAutoCompleteInput
                    label="P.O. No."
                    name="po_no"
                    fieldColumn="po_no"
                    value={masterData.po_no}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    onSelectOption={(_val, record) => {
                      if (record) handleAutoFillFromVoucher(record);
                    }}
                    placeholder="P.O. Number"
                    savedInspections={savedInspections}
                  />
                </div>

                {/* P.O. Remarks & Detention Days */}
                <div className="flex items-center gap-2 lg:col-span-2">
                  <label htmlFor="remarks_3250" className="w-28 font-semibold text-slate-700">P.O. Remarks</label>
                  <input
 id="remarks_3250" aria-label="P.O. Remarks"                    type="text"
                    name="remarks"
                    value={masterData.remarks || ''}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="Enter P.O. Remarks"
                    className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium focus:border-blue-500 disabled:bg-slate-100"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="detention_days_3262" className="w-24 font-semibold text-slate-700">Detention Days</label>
                  <input
 id="detention_days_3262" aria-label="Detention Days"                    type="number"
                    name="detention_days"
                    value={masterData.detention_days || ''}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="0"
                    className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-bold text-center focus:border-blue-500 disabled:bg-slate-100"
                  />
                </div>

                {/* Arrival No. & Date * */}
                <div className="flex items-center gap-2">
                  <label className="w-28 font-semibold text-slate-700">Arrival No.</label>
                  <SupabaseAutoCompleteInput
                    label="Arrival No."
                    name="arrival_no"
                    fieldColumn="temporary_arrival_no"
                    value={masterData.arrival_no}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    onSelectOption={(_val, record) => {
                      if (record) handleAutoFillFromVoucher(record);
                    }}
                    placeholder="Arrival Number"
                    savedInspections={savedInspections}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-24 font-semibold text-slate-700">Date <span className="text-red-500">*</span></label>
                  <input
 id="arrival_date_3292" aria-label="arrival date"                    type="date"
                    name="arrival_date"
                    value={masterData.arrival_date || ''}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium focus:border-blue-500 disabled:bg-slate-100"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="mill_po_no_3303" className="w-24 font-semibold text-slate-700">Challan Receipt No.</label>
                  <input
 id="mill_po_no_3303" aria-label="Challan Receipt No."                    type="text"
                    name="mill_po_no"
                    value={masterData.mill_po_no || ''}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="Receipt No."
                    className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium disabled:bg-slate-100"
                  />
                  <button
                    type="button"
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded shrink-0 transition-colors cursor-pointer"
                  >
                    Show Wt.
                  </button>
                </div>

                {/* Date & Way Bill No. */}
                <div className="flex items-center gap-2">
                  <label htmlFor="mill_po_date_3323" className="w-28 font-semibold text-slate-700">Date</label>
                  <input
 id="mill_po_date_3323" aria-label="Date"                    type="date"
                    name="mill_po_date"
                    value={masterData.mill_po_date || masterData.arrival_date || ''}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium disabled:bg-slate-100"
                  />
                </div>
                <div className="flex items-center gap-2 lg:col-span-2">
                  <label htmlFor="mr_spcl_print_3334" className="w-24 font-semibold text-slate-700">Way Bill No.</label>
                  <input
 id="mr_spcl_print_3334" aria-label="Way Bill No."                    type="text"
                    name="mr_spcl_print"
                    value={masterData.mr_spcl_print || ''}
                    disabled={!isEditMode}
                    onChange={handleMasterChange}
                    placeholder="Enter Way Bill No."
                    className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: LORRY & SETTLEMENT DETAILS */}
          <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
            <div className="bg-slate-100 border-b border-slate-200 px-5 py-2.5 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-700" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                LORRY & SETTLEMENT DETAILS
              </h2>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs">
                {/* Left Column */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="w-36 font-semibold text-slate-700">Lorry Returned <span className="text-red-500">*</span></label>
                    <select
 id="lorry_returned_3362" aria-label="lorry returned"                      name="lorry_returned"
                      value={(masterData as any).lorry_returned || 'No'}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium disabled:bg-slate-100"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-36 font-semibold text-slate-700">Unloading Date <span className="text-red-500">*</span></label>
                    <input
 id="unloading_date_3375" aria-label="unloading date"                      type="date"
                      name="unloading_date"
                      value={masterData.unloading_date || ''}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium disabled:bg-slate-100"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-36 font-semibold text-slate-700">Advance Amount <span className="text-red-500">*</span></label>
                    <input
 id="advance_amount_3386" aria-label="0.00"                      type="number"
                      name="advance_amount"
                      value={(masterData as any).advance_amount || ''}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      placeholder="0.00"
                      className="w-28 h-8 rounded border border-slate-300 px-2.5 font-semibold text-right disabled:bg-slate-100"
                    />
                    <span className="font-semibold text-slate-600 shrink-0 text-[11px]">On-Account Advance</span>
                    <input
 id="on_account_advance_amount_3396" aria-label="Enter Amount"                      type="number"
                      name="on_account_advance_amount"
                      value={(masterData as any).on_account_advance_amount || ''}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      placeholder="Enter Amount"
                      className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-semibold text-right disabled:bg-slate-100"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label htmlFor="arrival_remarks_3408" className="w-36 font-semibold text-slate-700">Arrival Remarks</label>
                    <input
 id="arrival_remarks_3408" aria-label="Arrival Remarks"                      type="text"
                      name="arrival_remarks"
                      value={(masterData as any).arrival_remarks || masterData.remarks || ''}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      placeholder="Enter Arrival Remarks"
                      className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium disabled:bg-slate-100"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-36 font-semibold text-slate-700">Consignment No. <span className="text-red-500">*</span></label>
                    <input
 id="consignment_no_3420" aria-label="Consignment Number"                      type="text"
                      name="consignment_no"
                      value={(masterData as any).consignment_no || ''}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      placeholder="Consignment Number"
                      className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium uppercase disabled:bg-slate-100"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="w-48 font-semibold text-slate-700">Lorry Returned from Other Mill <span className="text-red-500">*</span></label>
                    <select
 id="lorry_returned_other_mill_3436" aria-label="lorry returned other mill"                      name="lorry_returned_other_mill"
                      value={(masterData as any).lorry_returned_other_mill || 'No'}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium disabled:bg-slate-100"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-48 font-semibold text-slate-700">M.R. Print Date <span className="text-red-500">*</span></label>
                    <input
 id="mr_print_date_3449" aria-label="mr print date"                      type="date"
                      name="mr_print_date"
                      value={(masterData as any).mr_print_date || masterData.mr_date || ''}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium disabled:bg-slate-100"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-48 font-semibold text-slate-700">Sent For Settlement Date <span className="text-red-500">*</span></label>
                    <input
 id="sent_settlement_date_3460" aria-label="sent settlement date"                      type="date"
                      name="sent_settlement_date"
                      value={(masterData as any).sent_settlement_date || ''}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium disabled:bg-slate-100"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-48 font-semibold text-slate-700">Settlement Amount <span className="text-red-500">*</span></label>
                    <div className="flex-1 relative flex items-center">
                      <span className="absolute left-2.5 text-slate-500 font-bold">₹</span>
                      <input
 id="settlement_amount_3473" aria-label="0.00"                        type="number"
                        name="settlement_amount"
                        value={(masterData as any).settlement_amount || ''}
                        disabled={!isEditMode}
                        onChange={handleMasterChange}
                        placeholder="0.00"
                        className="w-full h-8 rounded border border-slate-300 pl-7 pr-2.5 font-bold text-right disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-48 font-semibold text-slate-700">Consignment Date <span className="text-red-500">*</span></label>
                    <input
 id="consignment_date_3486" aria-label="consignment date"                      type="date"
                      name="consignment_date"
                      value={(masterData as any).consignment_date || masterData.arrival_date || ''}
                      disabled={!isEditMode}
                      onChange={handleMasterChange}
                      className="flex-1 h-8 rounded border border-slate-300 px-2.5 font-medium disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: INSPECTION DETAILS */}
          <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
            <div className="bg-slate-100 border-b border-slate-200 px-5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-700" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  INSPECTION DETAILS
                </h2>
              </div>
              {isEditMode && (
                <button
                  type="button"
                  onClick={() => setShowAllFourSpecs(!show3rdAnd4th)}
                  className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1"
                >
                  {show3rdAnd4th ? "- Hide 3rd & 4th Item Specifications" : "+ Show 3rd & 4th Item Specifications"}
                </button>
              )}
            </div>
            <div className="p-5 space-y-6">
              {/* Commodity Spec Blocks (Side-by-Side Cards) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[0, 1, 2, 3].map((idx) => {
                  if (idx >= 2 && !show3rdAnd4th) return null;
                  const ordinals = ["1st", "2nd", "3rd", "4th"];
                  const itemLabel = `${ordinals[idx]} Item Specification`;
                  return (
                    <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 font-bold text-blue-900">
                        <span>{itemLabel}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2">
                          <label htmlFor="grade_3785" className="w-16 font-semibold text-slate-600">Grade</label>
                          <input
 id="grade_3785" name="grade" aria-label="Grade"                            type="text"
                            list="gradesList"
                            value={detailsList[idx]?.arrival_grade || ''}
                            disabled={!isEditMode}
                            onChange={(e) => handleDetailChange(idx, 'arrival_grade', e.target.value)}
                            placeholder="Grade"
                            className="flex-1 h-7 rounded border border-slate-300 px-2 font-bold uppercase disabled:bg-slate-100"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label htmlFor="area_3797" className="w-16 font-semibold text-slate-600">Area</label>
                          <input
 id="area_3797" name="area" aria-label="Area"                            type="text"
                            list="areasList"
                            value={detailsList[idx]?.area || ''}
                            disabled={!isEditMode}
                            onChange={(e) => handleDetailChange(idx, 'area', e.target.value)}
                            placeholder="Area"
                            className="flex-1 h-7 rounded border border-slate-300 px-2 uppercase disabled:bg-slate-100"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label htmlFor="agency_3809" className="w-16 font-semibold text-slate-600">Agency</label>
                          <input
 id="agency_3809" name="agency" aria-label="Agency"                            type="text"
                            list="agenciesList"
                            value={detailsList[idx]?.agency || ''}
                            disabled={!isEditMode}
                            onChange={(e) => handleDetailChange(idx, 'agency', e.target.value)}
                            placeholder="Agency"
                            className="flex-1 h-7 rounded border border-slate-300 px-2 uppercase disabled:bg-slate-100"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label htmlFor="marks_3821" className="w-16 font-semibold text-slate-600">Marks</label>
                          <input
 id="marks_3821" name="marks" aria-label="Marks"                            type="text"
                            list="markasList"
                            value={detailsList[idx]?.marka || ''}
                            disabled={!isEditMode}
                            onChange={(e) => handleDetailChange(idx, 'marka', e.target.value)}
                            placeholder="Marka"
                            className="flex-1 h-7 rounded border border-slate-300 px-2 uppercase disabled:bg-slate-100"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label htmlFor="crop_yr_3833" className="w-16 font-semibold text-slate-600">Crop Yr.</label>
                          <input
 id="crop_yr_3833" name="crop_yr" aria-label="Crop Yr."                            type="text"
                            value={detailsList[idx]?.crop_year || '2026-2027'}
                            disabled={!isEditMode}
                            onChange={(e) => handleDetailChange(idx, 'crop_year', e.target.value)}
                            placeholder="2026-2027"
                            className="flex-1 h-7 rounded border border-slate-300 px-2 text-center font-semibold disabled:bg-slate-100"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label htmlFor="quantity_3844" className="w-16 font-semibold text-slate-600">Quantity</label>
                          <input
 id="quantity_3844" name="quantity" aria-label="Quantity"                            type="number"
                            value={detailsList[idx]?.quantity || ''}
                            disabled={!isEditMode}
                            onChange={(e) => handleDetailChange(idx, 'quantity', e.target.value)}
                            placeholder="0"
                            className="w-20 h-7 rounded border border-slate-300 px-2 font-bold text-right disabled:bg-slate-100"
                          />
                          <span className="bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                            {detailsList[idx]?.unit || 'BALES'}
                          </span>
                        </div>
                        <div className="col-span-2 flex items-center gap-2">
                          <label htmlFor="final_wt_m_ton_3858" className="w-28 font-semibold text-slate-600">Final Wt. (M.Ton)</label>
                          <input
 id="final_wt_m_ton_3858" name="final_wt_m_ton" aria-label="Final Wt. (M.Ton)"                            type="number"
                            value={detailsList[idx]?.challan_gross_wt || ''}
                            disabled={!isEditMode}
                            onChange={(e) => handleDetailChange(idx, 'challan_gross_wt', e.target.value)}
                            placeholder="0.00"
                            className="w-32 h-7 rounded border border-slate-300 px-2 font-bold text-right disabled:bg-slate-100"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quality Breakdown Matrix Table */}
              <div className="overflow-x-auto border border-blue-200 rounded-lg shadow-sm bg-white">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-[#0e2a4a] text-white font-bold text-center">
                    <tr>
                      <th rowSpan={2} className="px-3 py-2 border-r border-blue-900 min-w-[140px] text-left">
                        Item
                      </th>
                      <th colSpan={3} className="px-2 py-1.5 border-r border-blue-900 border-b border-blue-900 bg-blue-950">
                        1st (From Final Arrival)
                      </th>
                      <th colSpan={3} className="px-2 py-1.5 border-r border-blue-900 border-b border-blue-900 bg-blue-900">
                        2nd (From Final Arrival)
                      </th>
                      <th colSpan={3} className="px-2 py-1.5 border-r border-blue-900 border-b border-blue-900 bg-blue-950">
                        3rd (From Final Arrival)
                      </th>
                      <th colSpan={3} className="px-2 py-1.5 border-b border-blue-900 bg-blue-900">
                        4th (From Final Arrival)
                      </th>
                    </tr>
                    <tr className="bg-[#133863] text-[10.5px] uppercase">
                      <th className="px-2 py-1 border-r border-blue-800">Dept %</th>
                      <th className="px-2 py-1 border-r border-blue-800">Claim %</th>
                      <th className="px-2 py-1 border-r border-blue-900">Sett %</th>

                      <th className="px-2 py-1 border-r border-blue-800">Dept %</th>
                      <th className="px-2 py-1 border-r border-blue-800">Claim %</th>
                      <th className="px-2 py-1 border-r border-blue-900">Sett %</th>

                      <th className="px-2 py-1 border-r border-blue-800">Dept %</th>
                      <th className="px-2 py-1 border-r border-blue-800">Claim %</th>
                      <th className="px-2 py-1 border-r border-blue-900">Sett %</th>

                      <th className="px-2 py-1 border-r border-blue-800">Dept %</th>
                      <th className="px-2 py-1 border-r border-blue-800">Claim %</th>
                      <th className="px-2 py-1">Sett %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                    {/* Row 1: Grade Down */}
                    <tr className="hover:bg-blue-50/50">
                      <td className="px-3 py-1.5 border-r border-slate-200 flex items-center gap-1.5 font-bold text-blue-900">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        <span>Grade Down</span>
                      </td>
                      {['1st', '2nd', '3rd', '4th'].map((col, idx) => (
                        <React.Fragment key={idx}>
                          <td className="p-1 border-r border-slate-200"><input  id="qualitymatrix_grade_down__3921" name="qualitymatrix_grade_down_" aria-label="qualitymatrix grade down "type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.grade_down?.[col]?.dept || ''} onChange={(e) => updateMatrixVal('grade_down', col, 'dept', e.target.value)} className="w-full h-7 rounded border border-slate-200 text-center font-bold disabled:bg-slate-100" /></td>
                          <td className="p-1 border-r border-slate-200"><input  id="qualitymatrix_grade_down__3922" name="qualitymatrix_grade_down_" aria-label="qualitymatrix grade down "type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.grade_down?.[col]?.claim || ''} onChange={(e) => updateMatrixVal('grade_down', col, 'claim', e.target.value)} className="w-full h-7 rounded border border-slate-200 text-center font-bold text-amber-700 bg-amber-50/40 disabled:bg-slate-100" /></td>
                          <td className={`p-1 ${idx < 3 ? 'border-r border-slate-300' : ''}`}><input  id="qualitymatrix_grade_down__3923" name="qualitymatrix_grade_down_" aria-label="qualitymatrix grade down "type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.grade_down?.[col]?.sett || ''} onChange={(e) => updateMatrixVal('grade_down', col, 'sett', e.target.value)} className="w-full h-7 rounded border border-slate-200 text-center font-bold text-emerald-800 disabled:bg-slate-100" /></td>
                        </React.Fragment>
                      ))}
                    </tr>

                    {/* Row 2: Moisture */}
                    <tr className="hover:bg-blue-50/50">
                      <td className="px-3 py-1.5 border-r border-slate-200 flex items-center gap-1.5 font-bold text-cyan-900">
                        <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                        <span>Moisture</span>
                      </td>
                      {['1st', '2nd', '3rd', '4th'].map((col, idx) => (
                        <React.Fragment key={idx}>
                          <td className="p-1 border-r border-slate-200"><input  id="qualitymatrix_moisture_co_3936" name="qualitymatrix_moisture_co" aria-label="qualitymatrix moisture co"type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.moisture?.[col]?.dept || (idx === 0 ? masterData.actual_moisture : '')} onChange={(e) => { updateMatrixVal('moisture', col, 'dept', e.target.value); if(idx===0) setMasterData(m => ({...m, actual_moisture: Number(e.target.value)})); }} className="w-full h-7 rounded border border-slate-200 text-center font-bold disabled:bg-slate-100" /></td>
                          <td className="p-1 border-r border-slate-200"><input  id="qualitymatrix_moisture_co_3937" name="qualitymatrix_moisture_co" aria-label="qualitymatrix moisture co"type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.moisture?.[col]?.claim || (idx === 0 ? masterData.claim_moisture : '')} onChange={(e) => { updateMatrixVal('moisture', col, 'claim', e.target.value); if(idx===0) setMasterData(m => ({...m, claim_moisture: Number(e.target.value)})); }} className="w-full h-7 rounded border border-slate-200 text-center font-bold text-amber-700 bg-amber-50/40 disabled:bg-slate-100" /></td>
                          <td className={`p-1 ${idx < 3 ? 'border-r border-slate-300' : ''}`}><input  id="qualitymatrix_moisture_co_3938" name="qualitymatrix_moisture_co" aria-label="qualitymatrix moisture co"type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.moisture?.[col]?.sett || ''} onChange={(e) => updateMatrixVal('moisture', col, 'sett', e.target.value)} className="w-full h-7 rounded border border-slate-200 text-center font-bold text-emerald-800 disabled:bg-slate-100" /></td>
                        </React.Fragment>
                      ))}
                    </tr>

                    {/* Row 3: Dust */}
                    <tr className="hover:bg-blue-50/50">
                      <td className="px-3 py-1.5 border-r border-slate-200 flex items-center gap-1.5 font-bold text-purple-900">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        <span>Dust</span>
                      </td>
                      {['1st', '2nd', '3rd', '4th'].map((col, idx) => (
                        <React.Fragment key={idx}>
                          <td className="p-1 border-r border-slate-200"><input  id="qualitymatrix_dust_col_de_3951" name="qualitymatrix_dust_col_de" aria-label="qualitymatrix dust col de"type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.dust?.[col]?.dept || (idx === 0 ? masterData.actual_dust : '')} onChange={(e) => { updateMatrixVal('dust', col, 'dept', e.target.value); if(idx===0) setMasterData(m => ({...m, actual_dust: Number(e.target.value)})); }} className="w-full h-7 rounded border border-slate-200 text-center font-bold disabled:bg-slate-100" /></td>
                          <td className="p-1 border-r border-slate-200"><input  id="qualitymatrix_dust_col_cl_3952" name="qualitymatrix_dust_col_cl" aria-label="qualitymatrix dust col cl"type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.dust?.[col]?.claim || (idx === 0 ? masterData.claim_dust : '')} onChange={(e) => { updateMatrixVal('dust', col, 'claim', e.target.value); if(idx===0) setMasterData(m => ({...m, claim_dust: Number(e.target.value)})); }} className="w-full h-7 rounded border border-slate-200 text-center font-bold text-amber-700 bg-amber-50/40 disabled:bg-slate-100" /></td>
                          <td className={`p-1 ${idx < 3 ? 'border-r border-slate-300' : ''}`}><input  id="qualitymatrix_dust_col_se_3953" name="qualitymatrix_dust_col_se" aria-label="qualitymatrix dust col se"type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.dust?.[col]?.sett || ''} onChange={(e) => updateMatrixVal('dust', col, 'sett', e.target.value)} className="w-full h-7 rounded border border-slate-200 text-center font-bold text-emerald-800 disabled:bg-slate-100" /></td>
                        </React.Fragment>
                      ))}
                    </tr>

                    {/* Row 4: Moc */}
                    <tr className="hover:bg-blue-50/50">
                      <td className="px-3 py-1.5 border-r border-slate-200 flex items-center gap-1.5 font-bold text-emerald-900">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Moc</span>
                      </td>
                      {['1st', '2nd', '3rd', '4th'].map((col, idx) => (
                        <React.Fragment key={idx}>
                          <td className="p-1 border-r border-slate-200"><input  id="qualitymatrix_moc_col_dep_3966" name="qualitymatrix_moc_col_dep" aria-label="qualitymatrix moc col dep"type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.moc?.[col]?.dept || ''} onChange={(e) => updateMatrixVal('moc', col, 'dept', e.target.value)} className="w-full h-7 rounded border border-slate-200 text-center font-bold disabled:bg-slate-100" /></td>
                          <td className="p-1 border-r border-slate-200"><input  id="qualitymatrix_moc_col_cla_3967" name="qualitymatrix_moc_col_cla" aria-label="qualitymatrix moc col cla"type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.moc?.[col]?.claim || ''} onChange={(e) => updateMatrixVal('moc', col, 'claim', e.target.value)} className="w-full h-7 rounded border border-slate-200 text-center font-bold text-amber-700 bg-amber-50/40 disabled:bg-slate-100" /></td>
                          <td className={`p-1 ${idx < 3 ? 'border-r border-slate-300' : ''}`}><input  id="qualitymatrix_moc_col_set_3968" name="qualitymatrix_moc_col_set" aria-label="qualitymatrix moc col set"type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.moc?.[col]?.sett || ''} onChange={(e) => updateMatrixVal('moc', col, 'sett', e.target.value)} className="w-full h-7 rounded border border-slate-200 text-center font-bold text-emerald-800 disabled:bg-slate-100" /></td>
                        </React.Fragment>
                      ))}
                    </tr>

                    {/* Row 5: P.O Rate (Qtl) */}
                    <tr className="hover:bg-blue-50/50">
                      <td className="px-3 py-1.5 border-r border-slate-200 flex items-center gap-1.5 font-bold text-amber-900">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>P.O Rate (Qtl)</span>
                      </td>
                      {['1st', '2nd', '3rd', '4th'].map((col, idx) => (
                        <React.Fragment key={idx}>
                          <td className="p-1 border-r border-slate-200"><input  id="qualitymatrix_po_rate_col_3981" name="qualitymatrix_po_rate_col" aria-label="qualitymatrix po rate col"type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.po_rate?.[col]?.dept || ''} onChange={(e) => updateMatrixVal('po_rate', col, 'dept', e.target.value)} className="w-full h-7 rounded border border-slate-200 text-center font-bold disabled:bg-slate-100" /></td>
                          <td className="p-1 border-r border-slate-200"><input  id="qualitymatrix_po_rate_col_3982" name="qualitymatrix_po_rate_col" aria-label="qualitymatrix po rate col"type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.po_rate?.[col]?.claim || ''} onChange={(e) => updateMatrixVal('po_rate', col, 'claim', e.target.value)} className="w-full h-7 rounded border border-slate-200 text-center font-bold text-amber-700 bg-amber-50/40 disabled:bg-slate-100" /></td>
                          <td className={`p-1 ${idx < 3 ? 'border-r border-slate-300' : ''}`}><input  id="qualitymatrix_po_rate_col_3983" name="qualitymatrix_po_rate_col" aria-label="qualitymatrix po rate col"type="number" step="0.1" disabled={!isEditMode} value={qualityMatrix.po_rate?.[col]?.sett || ''} onChange={(e) => updateMatrixVal('po_rate', col, 'sett', e.target.value)} className="w-full h-7 rounded border border-slate-200 text-center font-bold text-emerald-800 disabled:bg-slate-100" /></td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Insp. Remarks */}
              <div className="flex items-center gap-3">
                <label htmlFor="insp_remarks_3994" className="w-28 font-bold text-slate-700 text-xs">Insp. Remarks</label>
                <input
 id="insp_remarks_3994" aria-label="Insp. Remarks"                  type="text"
                  name="insp_remarks"
                  value={(masterData as any).insp_remarks || masterData.remarks || ''}
                  disabled={!isEditMode}
                  onChange={(e) => setMasterData(m => ({ ...m, insp_remarks: e.target.value, remarks: e.target.value }))}
                  placeholder="Enter Inspection Remarks..."
                  className="flex-1 h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold focus:border-blue-600 focus:outline-none disabled:bg-slate-100"
                />
              </div>
            </div>
          </div>

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
                <span className="font-bold text-slate-800">{currentUser || 'System'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Created At :</span>
                <span className="font-bold text-slate-800">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </div>
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
 id="search_by_m_r_number_orde_5031" name="search_by_m_r_number_orde" aria-label="Search by M.R. Number, order reference, merchant, broker name..."                    type="text"
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
