import React, { useState, useEffect } from "react";
import { useLiveAutoRefresh } from "../hooks/useLiveAutoRefresh";
import {
  ShieldCheck,
  Search,
  Filter,
  Plus,
  Printer,
  Download,
  Eye,
  CheckCircle2,
  RefreshCw,
  FileText,
  Layers,
  X,
  Trash2,
  Percent,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Copy,
  ArrowLeft,
  Save,
  RotateCcw,
  Sparkles,
  Lock
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { dbModule } from "../services/dbModule";
import LegacyLayout from "../components/LegacyLayout";

export interface DeductionRow {
  id: string;
  deduction_type: string;
  deduction_rate: number;
  deduction_qty: number;
  deduction_amount: number;
}

export const DEFAULT_DEDUCTION_TYPES = [
  { deduction: "GODOWN DAMAGE FOR BALES", rate_per_unit: 400, rate_per_qntl: null },
  { deduction: "RAIN WET FOR BALES", rate_per_unit: 200, rate_per_qntl: null },
  { deduction: "RTCH DAMAGE FOR BALES", rate_per_unit: 400, rate_per_qntl: null },
  { deduction: "CT FOR HABIJABI / CHATTA / ROPE", rate_per_unit: null, rate_per_qntl: 1500 },
  { deduction: "RAIN WET FOR DRUMS", rate_per_unit: 200, rate_per_qntl: null },
  { deduction: "GODOWN DAMAGE FOR DRUMS", rate_per_unit: 200, rate_per_qntl: null },
  { deduction: "GODOWN DAMAGE FOR HALF BALES", rate_per_unit: 200, rate_per_qntl: null },
  { deduction: "GODOWN DAMAGE FOR LOOSE", rate_per_unit: null, rate_per_qntl: 400 }
];

interface InspectionMasterRecord {
  mr_no: string;
  mr_date?: string;
  arrival_no?: string;
  arrival_date?: string;
  po_no?: string;
  po_date?: string;
  broker_name?: string;
  supplier_name?: string;
  actual_moisture?: number;
  claim_moisture?: number;
  actual_dust?: number;
  claim_dust?: number;
  actual_ncv?: number;
  claim_ncv?: number;
  detention_days?: number;
  unloading_date?: string;
  mill_po_no?: string;
  mill_po_date?: string;
  mr_spcl_print?: string;
  remarks?: string;
  lorry_number?: string;
  delivery_claim?: number;
  deduction_type?: string;
  deduction_rate?: number;
  deduction_qty?: number;
  deduction_amount?: number;
  deductions?: DeductionRow[];
  status?: string;
  created_at?: string;
  grid_details?: any;
}

interface InspectionDetailRow {
  id?: number;
  mr_no?: string;
  srl_no?: number;
  arrival_grade?: string;
  stock_grade_code?: string;
  stock_grade_name?: string;
  area?: string;
  agency?: string;
  agency_code?: string;
  marks?: string;
  marka?: string;
  crop_year?: string;
  lot?: string;
  quantity?: number;
  unit?: string;
  rate?: number | string;
  rate_qntl?: number | string;
  challan_gross_wt?: number;
  receipt_gross_wt?: number;
  gross_weight_batch?: number;
  add_weight?: number;
  less_weight?: number;
  reduced_weight?: number;
  lorry_moisture_min?: number;
  lorry_moisture_max?: number;
  lorry_read_min?: number;
  lorry_read_max?: number;
  lorry_read_avg?: number;
  insp_read_min?: number;
  insp_read_max?: number;
  insp_read_avg?: number;
  moisture_act?: number;
  moisture_claim?: number;
  dust_act?: number;
  dust_claim?: number;
  ncv_act?: number;
  ncv_claim?: number;
  grade_down_act?: number;
  grade_down_claim?: number;
  actual_moisture?: number;
  claim_moisture?: number;
  actual_dust?: number;
  claim_dust?: number;
  actual_ncv?: number;
  claim_ncv?: number;
  actual_grade_down?: number;
  claim_grade_down?: number;
  final_receipt_wt?: number;
  settlement_moisture?: number;
  settlement_grade_down?: number;
  settlement_dust?: number;
  settlement_ncv?: number;
  ropes_weight?: number;
  ropes_tot_wt_grd?: number;
  ropes_grade?: string;
  chotta_weight?: number;
  chotta_tot_wt_grd?: number;
  chotta_grade?: string;
  tolerable?: string;
  premium?: string;
  is_premium?: boolean;
  amount?: number;
  row_remarks?: string;
  jqi_remarks?: string;
  jci_remarks?: string;
  expanded?: boolean;
  is_auto?: boolean;
  auto_fields?: string[];
}

// Calculate Row Amount in ₹
export const calculateRowAmount = (row: InspectionDetailRow): number => {
  if (row.amount !== undefined && row.amount !== null && Number(row.amount) > 0) {
    return Number(Number(row.amount).toFixed(2));
  }
  const rate = Number(row.rate) || Number(row.rate_qntl) || 0;
  const wtMt = calculateQtyInMt(row);
  if (rate > 0 && wtMt > 0) {
    const ratePerMt = rate < 1000 ? rate * 1000 : rate * 10;
    return Number((wtMt * ratePerMt).toFixed(2));
  }
  return 0;
};

export const isAutoBlocked = (row: InspectionDetailRow, field: keyof InspectionDetailRow): boolean => {
  if (row.is_auto === false) return false;
  if (field === "lorry_read_avg" || field === "insp_read_avg") return true;
  if (row.auto_fields && Array.isArray(row.auto_fields) && row.auto_fields.includes(field as string)) {
    return true;
  }
  if (row.is_auto) {
    const defaultAutoFields: (keyof InspectionDetailRow)[] = [
      "arrival_grade",
      "stock_grade_code",
      "stock_grade_name",
      "area",
      "agency",
      "agency_code",
      "marks",
      "crop_year",
      "quantity",
      "unit",
      "challan_gross_wt",
      "receipt_gross_wt",
      "rate",
      "rate_qntl"
    ];
    if (defaultAutoFields.includes(field)) {
      return true;
    }
  }
  return false;
};

export const getFieldInputStyle = (isBlocked: boolean, customClasses = "") => {
  if (isBlocked) {
    return `w-full border border-blue-300/90 bg-blue-50/90 text-blue-950 font-bold rounded px-2 py-1 text-xs cursor-not-allowed select-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] transition-all ${customClasses}`;
  }
  return `w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 transition-all ${customClasses}`;
};

// Calculate Quantity in Metric Tons (MT)
export const calculateQtyInMt = (row: InspectionDetailRow): number => {
  if (row.challan_gross_wt && Number(row.challan_gross_wt) > 0) {
    return Number(Number(row.challan_gross_wt).toFixed(3));
  }
  if (row.receipt_gross_wt && Number(row.receipt_gross_wt) > 0) {
    return Number(Number(row.receipt_gross_wt).toFixed(3));
  }
  const qty = Number(row.quantity) || 0;
  const unit = (row.unit || "BALES").toUpperCase();
  if (unit.includes("BALE") || unit.includes("BALES")) {
    return Number((qty * 0.18).toFixed(3)); // 1 Standard Jute Bale = ~180 kg = 0.180 MT
  }
  if (unit.includes("KG")) {
    return Number((qty * 0.001).toFixed(3));
  }
  if (unit.includes("QTL") || unit.includes("QUINTAL")) {
    return Number((qty * 0.10).toFixed(3));
  }
  if (unit.includes("DRUM")) {
    return Number((qty * 0.20).toFixed(3));
  }
  if (unit.includes("BAG")) {
    return Number((qty * 0.05).toFixed(3));
  }
  return Number(qty.toFixed(3));
};

// Calculate Premium Quantity in Metric Tons (MT)
export const getPremiumMt = (row: InspectionDetailRow): number => {
  const available = calculateQtyInMt(row);
  if (!row.premium && !row.is_premium) return 0;
  const pStr = String(row.premium || "").trim();
  if (pStr.toLowerCase() === "yes" || pStr === "true") {
    return available;
  }
  const num = parseFloat(pStr);
  if (!isNaN(num) && num > 0) {
    return Math.min(num, available);
  }
  if (row.is_premium) {
    return available;
  }
  return 0;
};

interface InspectionProps {
  onNavigate?: (page: string) => void;
}

const detailFieldsConfig: { name: keyof InspectionDetailRow; label: string; type: "text" | "number" | "select" }[] = [
  { name: "arrival_grade", label: "Arrival Grade", type: "text" },
  { name: "stock_grade_code", label: "Stock Grade Code", type: "text" },
  { name: "stock_grade_name", label: "Stock Grade Name", type: "text" },
  { name: "area", label: "Area", type: "text" },
  { name: "agency", label: "Agency", type: "text" },
  { name: "marks", label: "Marks / Marka", type: "text" },
  { name: "crop_year", label: "Crop Year", type: "text" },
  { name: "lot", label: "Lot", type: "text" },
  { name: "quantity", label: "Quantity", type: "number" },
  { name: "unit", label: "Unit", type: "text" },
  { name: "challan_gross_wt", label: "Challan Gross Wt. MT.", type: "number" },
  { name: "receipt_gross_wt", label: "Receipt Gross Wt. MT.", type: "number" },
  { name: "gross_weight_batch", label: "Gross Weight (Batch)", type: "number" },
  { name: "add_weight", label: "Add Weight M.Ton", type: "number" },
  { name: "less_weight", label: "Less Weight M.Ton", type: "number" },
  { name: "reduced_weight", label: "Reduced Weight M.Ton", type: "number" },
  { name: "lorry_moisture_min", label: "Lorry Moisture Min", type: "number" },
  { name: "lorry_moisture_max", label: "Lorry Moisture Max", type: "number" },
  { name: "lorry_read_min", label: "Lorry Moisture Read Min", type: "number" },
  { name: "lorry_read_max", label: "Lorry Moisture Read Max", type: "number" },
  { name: "lorry_read_avg", label: "Lorry Moisture Read Avg", type: "number" },
  { name: "insp_read_min", label: "Insp. Moisture Read Min", type: "number" },
  { name: "insp_read_max", label: "Insp. Moisture Read Max", type: "number" },
  { name: "insp_read_avg", label: "Insp. Moisture Read Avg", type: "number" },
  { name: "moisture_act", label: "Moisture % Actual", type: "number" },
  { name: "moisture_claim", label: "Moisture % Claim", type: "number" },
  { name: "dust_act", label: "Dust % Actual", type: "number" },
  { name: "dust_claim", label: "Dust % Claim", type: "number" },
  { name: "ncv_act", label: "NCV % Actual", type: "number" },
  { name: "ncv_claim", label: "NCV % Claim", type: "number" },
  { name: "grade_down_act", label: "Grade Down % Actual", type: "number" },
  { name: "grade_down_claim", label: "Grade Down % Claim", type: "number" },
  { name: "final_receipt_wt", label: "Final Receipt Wt. (Claim)", type: "number" },
  { name: "settlement_moisture", label: "Mill Settlement % Moisture", type: "number" },
  { name: "settlement_grade_down", label: "Mill Settlement % Gr. Down", type: "number" },
  { name: "settlement_dust", label: "Mill Settlement % Dust", type: "number" },
  { name: "settlement_ncv", label: "Mill Settlement % NCV", type: "number" },
  { name: "ropes_weight", label: "Ropes Weight (Kg)", type: "number" },
  { name: "ropes_tot_wt_grd", label: "Ropes Tot. Wt. Grd%", type: "number" },
  { name: "ropes_grade", label: "Ropes Grade", type: "text" },
  { name: "chotta_weight", label: "Chotta & Habi Jabi Weight (Kg)", type: "number" },
  { name: "chotta_tot_wt_grd", label: "Chotta & Habi Jabi Tot. Wt. Grd%", type: "number" },
  { name: "chotta_grade", label: "Chotta & Habi Jabi Grade", type: "text" },
  { name: "tolerable", label: "Tolerable", type: "select" },
  { name: "premium", label: "Premium (MT Mode)", type: "select" },
  { name: "amount", label: "Amount (₹)", type: "number" },
  { name: "row_remarks", label: "Remarks", type: "text" },
  { name: "jqi_remarks", label: "JCI Remarks", type: "text" }
];

export default function Inspection({ onNavigate }: InspectionProps) {
  const [records, setRecords] = useState<InspectionMasterRecord[]>([]);
  const [finalArrivalList, setFinalArrivalList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"dashboard" | "form">("dashboard");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [headerForm, setHeaderForm] = useState<InspectionMasterRecord>({
    mr_no: `MRRC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    mr_date: new Date().toISOString().split("T")[0],
    arrival_no: "",
    arrival_date: new Date().toISOString().split("T")[0],
    po_no: "",
    po_date: new Date().toISOString().split("T")[0],
    broker_name: "",
    supplier_name: "",
    actual_moisture: 0,
    claim_moisture: 0,
    actual_dust: 0,
    claim_dust: 0,
    actual_ncv: 0,
    claim_ncv: 0,
    detention_days: 0,
    unloading_date: "",
    mill_po_no: "",
    mill_po_date: "",
    mr_spcl_print: "",
    remarks: "",
    lorry_number: "",
    status: "Completed"
  });

  const [detailRows, setDetailRows] = useState<InspectionDetailRow[]>([
    {
      unit: "BALES",
      quantity: 0,
      challan_gross_wt: 0,
      tolerable: "Yes",
      expanded: false
    }
  ]);

  // Deduction state for multiple deduction rows
  const [deductionRows, setDeductionRows] = useState<DeductionRow[]>([
    { id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 1, deduction_amount: 0 }
  ]);
  const [deductionMasterList, setDeductionMasterList] = useState<any[]>(DEFAULT_DEDUCTION_TYPES);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const syncHeaderDeductions = (rows: DeductionRow[]) => {
    const activeRows = rows.filter(r => (r.deduction_type && r.deduction_type.trim() !== "") || r.deduction_amount > 0);
    const totalAmt = rows.reduce((acc, r) => acc + (Number(r.deduction_amount) || 0), 0);
    const primaryRow = activeRows[0] || rows[0] || { deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 };

    setHeaderForm(prev => ({
      ...prev,
      deduction_type: activeRows.map(r => r.deduction_type).filter(Boolean).join(", ") || primaryRow.deduction_type || "",
      deduction_rate: primaryRow.deduction_rate || 0,
      deduction_qty: primaryRow.deduction_qty || 0,
      deduction_amount: totalAmt,
      deductions: rows
    }));
  };

  const handleDeductionTypeChange = (idx: number, selectedName: string) => {
    const found = deductionMasterList.find(d => d.deduction === selectedName);
    const rate = found ? (found.rate_per_unit != null ? Number(found.rate_per_unit) : (found.rate_per_qntl != null ? Number(found.rate_per_qntl) : 0)) : 0;

    setDeductionRows(prev => {
      const updated = [...prev];
      const current = { ...(updated[idx] || { id: String(Date.now()), deduction_type: "", deduction_rate: 0, deduction_qty: 1, deduction_amount: 0 }) };
      current.deduction_type = selectedName;
      current.deduction_rate = rate;
      const qty = current.deduction_qty > 0 ? current.deduction_qty : 1;
      current.deduction_qty = qty;
      current.deduction_amount = Number((rate * qty).toFixed(2));
      updated[idx] = current;
      syncHeaderDeductions(updated);
      return updated;
    });
  };

  const handleDeductionChange = (idx: number, field: "deduction_rate" | "deduction_qty" | "deduction_amount", value: number) => {
    setDeductionRows(prev => {
      const updated = [...prev];
      const current = { ...(updated[idx] || { id: String(Date.now()), deduction_type: "", deduction_rate: 0, deduction_qty: 1, deduction_amount: 0 }) };
      if (field === "deduction_rate") current.deduction_rate = value;
      if (field === "deduction_qty") current.deduction_qty = value;
      if (field === "deduction_amount") {
        current.deduction_amount = value;
      } else {
        current.deduction_amount = Number(((current.deduction_rate || 0) * (current.deduction_qty || 0)).toFixed(2));
      }
      updated[idx] = current;
      syncHeaderDeductions(updated);
      return updated;
    });
  };

  const handleAddDeductionRow = () => {
    setDeductionRows(prev => {
      const updated = [
        ...prev,
        { id: String(Date.now() + Math.random()), deduction_type: "", deduction_rate: 0, deduction_qty: 1, deduction_amount: 0 }
      ];
      syncHeaderDeductions(updated);
      return updated;
    });
    showToast("Added new deduction entry row.");
  };

  const handleRemoveDeductionRow = (idx: number) => {
    setDeductionRows(prev => {
      if (prev.length <= 1) {
        const reset = [{ id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 1, deduction_amount: 0 }];
        syncHeaderDeductions(reset);
        return reset;
      }
      const updated = prev.filter((_, i) => i !== idx);
      syncHeaderDeductions(updated);
      return updated;
    });
    showToast("Deduction entry removed.");
  };

  async function fetchInspectionRecords(isManual: boolean = false) {
    setLoading(true);
    try {
      // 1. Fetch saved material_inspection records
      let inspectionList: InspectionMasterRecord[] = [];
      if (supabase) {
        const { data, error } = await supabase
          .from("material_inspection")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          inspectionList = data;
        } else {
          // Fallback check
          const { data: fallback } = await supabase
            .from("inspection_master")
            .select("*")
            .order("created_at", { ascending: false });
          if (fallback && fallback.length > 0) inspectionList = fallback;
        }
      }

      if (inspectionList.length === 0) {
        try {
          const cached = localStorage.getItem("material_inspection_records") || localStorage.getItem("inspection_master_records");
          if (cached) inspectionList = JSON.parse(cached);
        } catch (e) {}
      }

      // 2. Fetch Final Arrival records (Actual physical arrivals received at the mill)
      let faList: any[] = [];
      if (supabase) {
        try {
          const faRes = await supabase
            .from("final_arrival")
            .select("*")
            .order("created_at", { ascending: false });

          if (faRes.data && faRes.data.length > 0) {
            faList.push(...faRes.data);
          }
        } catch (e) {
          console.error("Error fetching arrivals from final_arrival:", e);
        }
      }

      // Local storage fallbacks for Final Arrival Vouchers
      try {
        const cachedFa = localStorage.getItem("final_arrival_vouchers");
        if (cachedFa) {
          const parsed = JSON.parse(cachedFa);
          parsed.forEach((item: any) => {
            if (!faList.some(f => (f.final_arrival_no && f.final_arrival_no === item.final_arrival_no) || (f.final_arrival_id && f.final_arrival_id === item.final_arrival_id) || (f.mr_no && f.mr_no === item.mr_no))) {
              faList.push(item);
            }
          });
        }
      } catch (e) {}

      setFinalArrivalList(faList);

      // 3. Enrich existing saved inspection records if missing details, but do NOT auto-create unsaved rows
      const map = new Map<string, InspectionMasterRecord>();

      inspectionList.forEach(rec => {
        const k = (rec.mr_no || rec.arrival_no || "").trim().toUpperCase();
        if (k) map.set(k, rec);
      });

      // Enrich saved records with info from Final Arrival if available
      faList.forEach(fa => {
        const mrKey = (fa.mr_no || "").trim().toUpperCase();
        const arrKey = (fa.final_arrival_no || fa.arrival_no || "").trim().toUpperCase();

        const existing = (mrKey && map.get(mrKey)) || (arrKey && map.get(arrKey));

        if (existing) {
          // Fill missing header attributes from Final Arrival record
          if (!existing.po_no && fa.po_no) existing.po_no = fa.po_no;
          if (!existing.po_date && (fa.po_date || fa.date)) existing.po_date = fa.po_date || fa.date;
          if (!existing.supplier_name && (fa.supplier || fa.challan_supplier)) existing.supplier_name = fa.supplier || fa.challan_supplier;
          if (!existing.broker_name && fa.broker) existing.broker_name = fa.broker;
          if (!existing.lorry_number && fa.lorry_number) existing.lorry_number = fa.lorry_number;
          if (!existing.arrival_no && fa.final_arrival_no) existing.arrival_no = fa.final_arrival_no;
          if (!existing.arrival_date && fa.date) existing.arrival_date = fa.date;
          if (!existing.grid_details) existing.grid_details = fa.grid_details || fa.items || fa.details;
        }
      });

      const displayList = Array.from(map.values());
      setRecords(displayList);

      try {
        localStorage.setItem("material_inspection_records", JSON.stringify(displayList));
        localStorage.setItem("inspection_master_records", JSON.stringify(displayList));
      } catch (e) {}

      if (isManual) {
        showToast("Inspection register data refreshed successfully.");
      }
    } catch (err) {
      console.error("Error fetching material_inspection records:", err);
      if (isManual) {
        showToast("Failed to refresh records from database.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspectionRecords();
    if (supabase) {
      supabase.from("deduction_master").select("*").then(r => {
        if (r.data && r.data.length > 0) {
          setDeductionMasterList(r.data);
        }
      }, () => {});
    }
  }, []);

  useLiveAutoRefresh(fetchInspectionRecords, [], { tables: ['material_inspection', 'material_inspection_details', 'final_arrival', 'purchase_master', 'purchase_detail_master', 'mill_inspection_master', 'temporary_material_received'] });

  const loadDetailsForPo = async (poNo: string) => {
    if (!poNo) return;
    try {
      const poClean = poNo.trim();
      const poUpper = poClean.toUpperCase();
      let matchedItems: any[] = [];
      let gradeMap: Record<string, string> = {};
      let agencyMap: Record<string, string> = {};
      let markaMap: Record<string, string> = {};

      if (supabase) {
        const [pdmRes, scpRes, midRes, pmRes, gradesRes, agenciesRes, markasRes] = await Promise.all([
          supabase.from('purchase_detail_master').select('*').or(`po_no.eq.${poClean},po_no.ilike.${poUpper}`),
          supabase.from('sauda_check_point_details').select('*').or(`po_no.eq.${poClean},po_no.ilike.${poUpper}`),
          supabase.from('mill_inspection_detail').select('*').or(`mr_no.eq.${poClean},mr_no.ilike.${poUpper},po_no.eq.${poClean}`),
          supabase.from('purchase_master').select('*').or(`po_no.eq.${poClean},po_no.ilike.${poUpper}`),
          supabase.from('grade_master').select('*'),
          supabase.from('agency_master').select('*'),
          supabase.from('marka_master').select('*')
        ]);

        if (gradesRes.data) {
          gradesRes.data.forEach((g: any) => {
            if (g.grade_code && g.grade_name) gradeMap[g.grade_code] = g.grade_name;
          });
        }
        if (agenciesRes.data) {
          agenciesRes.data.forEach((a: any) => {
            if (a.agency_code && a.agency_name) agencyMap[a.agency_code] = a.agency_name;
          });
        }
        if (markasRes.data) {
          markasRes.data.forEach((m: any) => {
            if (m.marka_code && m.marka_name) markaMap[m.marka_code] = m.marka_name;
          });
        }

        if (pmRes.data && pmRes.data.length > 0) {
          const pm = pmRes.data[0];
          setHeaderForm(prev => ({
            ...prev,
            po_no: pm.po_no || prev.po_no,
            po_date: pm.date || pm.po_date || prev.po_date,
            supplier_name: pm.supplier || pm.challan_supplier || prev.supplier_name,
            broker_name: pm.broker || prev.broker_name,
            lorry_number: pm.lorry_no || pm.lorry_number || prev.lorry_number
          }));
        }

        matchedItems = (pdmRes.data && pdmRes.data.length > 0)
          ? pdmRes.data
          : ((scpRes.data && scpRes.data.length > 0)
              ? scpRes.data
              : (midRes.data || []));
      }

      if (!matchedItems || matchedItems.length === 0) {
        const [allPdm, allScp] = await Promise.all([
          dbModule.fetchAll('purchase_detail_master').catch(() => []),
          dbModule.fetchAll('sauda_check_point_details').catch(() => [])
        ]);
        const pdm = (allPdm || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poUpper);
        const scp = (allScp || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poUpper);
        matchedItems = pdm.length > 0 ? pdm : scp;
      }

      if (matchedItems && matchedItems.length > 0) {
        const details: InspectionDetailRow[] = matchedItems.map((item: any, i: number) => {
          const gradeCode = item.grade_code || item.receipt_grade_code || item.stock_grade_code || item.item_code || "";
          const resolvedGradeName = gradeMap[gradeCode] || item.grade_name || item.receipt_grade_name || item.challan_grade_name || item.variety || item.item_name || item.grade || gradeCode;
          const agencyCode = item.agency_code || "";
          const resolvedAgencyName = agencyMap[agencyCode] || item.agency_name || item.agency || agencyCode;
          const markaCode = item.marka_code || item.challan_marka_code || "";
          const resolvedMarkaName = markaMap[markaCode] || item.marka_name || item.challan_marka_name || item.marka || item.marks || markaCode;
          const areaName = (item.area_name || item.area || item.arrival_area_name || item.arrival_area || "").toUpperCase();
          const nettoVal = Number(item.netto_pnto !== undefined && item.netto_pnto !== null && item.netto_pnto !== "" ? item.netto_pnto : (item.weight_mt || item.quantity_mt || item.challan_gross_wt || item.receipt_gross_wt || item.gross_weight || item.weight || item.net_wt || 0));
          let qtyVal = 0;
          if (item.quantity_rcpt !== undefined && item.quantity_rcpt !== null && item.quantity_rcpt !== "") {
            qtyVal = Number(item.quantity_rcpt);
          } else if (item.quantity_chln !== undefined && item.quantity_chln !== null && item.quantity_chln !== "") {
            qtyVal = Number(item.quantity_chln);
          } else if (item.quantity !== undefined && item.quantity !== null && item.quantity !== "") {
            qtyVal = Number(item.quantity);
          } else if (item.bales !== undefined && item.bales !== null && item.bales !== "") {
            qtyVal = Number(item.bales);
          }
          const unitVal = (item.unit || item.unit_name || "BALES").toString().trim().toUpperCase();
          const rateVal = Number(item.rate_qntl || item.rate || item.po_rate || 0);

          const lMin = Number(item.lorry_read_min || 0);
          const lMax = Number(item.lorry_read_max || 0);
          const lAvg = Number(item.lorry_read_avg || (lMin > 0 && lMax > 0 ? (lMin + lMax) / 2 : (lMin || lMax)) || 0);

          const iMin = Number(item.insp_read_min || 0);
          const iMax = Number(item.insp_read_max || 0);
          const iAvg = Number(item.insp_read_avg || (iMin > 0 && iMax > 0 ? (iMin + iMax) / 2 : (iMin || iMax)) || 0);

          let combinedMoistAvg = 0;
          if (lAvg > 0 && iAvg > 0) {
            combinedMoistAvg = Number(((lAvg + iAvg) / 2).toFixed(2));
          } else if (lAvg > 0 || iAvg > 0) {
            combinedMoistAvg = Number((lAvg || iAvg).toFixed(2));
          }

          const moistAct = Number(item.moisture_act || combinedMoistAvg || 0);
          const moistClaim = Number(item.moisture_claim || combinedMoistAvg || 0);
          const gdAct = Number(item.grade_down_act || item.grade_down || 0);
          const dustAct = Number(item.dust_act || 0);
          const ncvAct = Number(item.ncv_act || 0);

          return {
            srl_no: item.srl_no || (i + 1),
            arrival_grade: resolvedGradeName,
            stock_grade_code: gradeCode,
            stock_grade_name: resolvedGradeName,
            area: areaName,
            agency: resolvedAgencyName,
            agency_code: agencyCode,
            marks: resolvedMarkaName,
            crop_year: item.crop_year || "2026-27",
            quantity: qtyVal,
            unit: unitVal,
            rate: rateVal,
            rate_qntl: rateVal,
            challan_gross_wt: nettoVal,
            receipt_gross_wt: nettoVal,
            final_receipt_wt: nettoVal,
            reduced_weight: nettoVal,
            moisture_act: moistAct,
            moisture_claim: Number(item.moisture_claim || item.claim_moisture || 0),
            grade_down_act: gdAct,
            grade_down_claim: Number(item.grade_down_claim || 0),
            dust_act: dustAct,
            dust_claim: Number(item.dust_claim || item.claim_dust || 0),
            ncv_act: ncvAct,
            ncv_claim: Number(item.ncv_claim || item.claim_ncv || 0),
            settlement_moisture: Number(item.settlement_moisture !== undefined && item.settlement_moisture !== null && item.settlement_moisture !== "" ? item.settlement_moisture : moistAct),
            settlement_grade_down: Number(item.settlement_grade_down !== undefined && item.settlement_grade_down !== null && item.settlement_grade_down !== "" ? item.settlement_grade_down : gdAct),
            settlement_dust: Number(item.settlement_dust !== undefined && item.settlement_dust !== null && item.settlement_dust !== "" ? item.settlement_dust : dustAct),
            settlement_ncv: Number(item.settlement_ncv !== undefined && item.settlement_ncv !== null && item.settlement_ncv !== "" ? item.settlement_ncv : ncvAct),
            tolerable: item.tolerable || "Yes",
            premium: item.premium !== undefined && item.premium !== null ? String(item.premium) : "",
            is_premium: item.is_premium || item.premium === "Yes",
            row_remarks: item.remarks || item.row_remarks || "",
            is_auto: true,
            expanded: false
          };
        });
        setDetailRows(details);
        showToast(`Loaded ${details.length} item(s) from purchase_detail_master.`);
      }
    } catch (e) {
      console.warn("Error loading details from PO:", e);
    }
  };

  const populateFromFinalArrival = async (fa: any) => {
    const displayMrNo = (fa.mr_no && fa.mr_no !== "DIRECT REGISTER" && fa.mr_no.trim() !== "")
      ? fa.mr_no
      : (fa.final_arrival_no || `FA-${fa.final_arrival_id || Math.floor(1000 + Math.random() * 9000)}`);

    const poNo = fa.po_no || fa.mr_no || "";

    setHeaderForm(prev => ({
      ...prev,
      mr_no: displayMrNo,
      mr_date: fa.date || prev.mr_date || new Date().toISOString().split("T")[0],
      arrival_no: fa.final_arrival_no || fa.arrival_no || prev.arrival_no,
      arrival_date: fa.date || prev.arrival_date || new Date().toISOString().split("T")[0],
      unloading_date: fa.unloading_date || fa.date || prev.unloading_date || new Date().toISOString().split("T")[0],
      po_no: poNo || prev.po_no,
      po_date: fa.po_date || fa.date || prev.po_date,
      mill_po_no: fa.mr_no || fa.po_no || fa.mill_po_no || fa.arrival_no || displayMrNo || prev.mill_po_no || "",
      mill_po_date: fa.date || fa.po_date || fa.arrival_date || prev.mill_po_date || new Date().toISOString().split("T")[0],
      broker_name: fa.broker || prev.broker_name,
      supplier_name: fa.supplier || fa.challan_supplier || prev.supplier_name,
      lorry_number: fa.lorry_number || prev.lorry_number,
      actual_moisture: 0,
      actual_dust: 0,
      actual_ncv: 0,
      claim_moisture: 0,
      claim_dust: 0,
      claim_ncv: 0,
      remarks: fa.remarks || prev.remarks
    }));

    let rawGrid = fa.grid_details || fa.details || fa.items;
    const voucherArea = (fa.arrival_area_name || fa.arrival_area || fa.area_name || fa.area || "").toUpperCase();

    if (typeof rawGrid === "string") {
      try { rawGrid = JSON.parse(rawGrid); } catch (e) {}
    }

    // Query purchase_detail_master / sauda_check_point_details / mill_inspection_detail if missing or empty
    if (!Array.isArray(rawGrid) || rawGrid.length === 0) {
      const searchKeys = [fa.po_no, fa.mr_no, fa.final_arrival_no, fa.arrival_no].filter(Boolean);
      if (searchKeys.length > 0 && supabase) {
        try {
          for (const key of searchKeys) {
            const cleanKey = String(key).trim();
            const upperKey = cleanKey.toUpperCase();
            const [pdmRes, scpRes, midRes] = await Promise.all([
              supabase.from('purchase_detail_master').select('*').or(`po_no.eq.${cleanKey},po_no.ilike.${upperKey}`),
              supabase.from('sauda_check_point_details').select('*').or(`po_no.eq.${cleanKey},po_no.ilike.${upperKey}`),
              supabase.from('mill_inspection_detail').select('*').or(`mr_no.eq.${cleanKey},mr_no.ilike.${upperKey},po_no.eq.${cleanKey}`)
            ]);

            const found = (pdmRes.data && pdmRes.data.length > 0)
              ? pdmRes.data
              : ((scpRes.data && scpRes.data.length > 0)
                  ? scpRes.data
                  : (midRes.data || []));

            if (found.length > 0) {
              rawGrid = found;
              break;
            }
          }
        } catch (e) {
          console.warn("Could not load from purchase_detail_master:", e);
        }
      }

      if (!rawGrid || rawGrid.length === 0) {
        try {
          const [allPdm, allScp] = await Promise.all([
            dbModule.fetchAll('purchase_detail_master').catch(() => []),
            dbModule.fetchAll('sauda_check_point_details').catch(() => [])
          ]);
          const poUpper = String(poNo || '').trim().toUpperCase();
          const pdm = (allPdm || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poUpper);
          const scp = (allScp || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poUpper);
          rawGrid = pdm.length > 0 ? pdm : scp;
        } catch (e) {}
      }
    }

    if (Array.isArray(rawGrid) && rawGrid.length > 0) {
      const details: InspectionDetailRow[] = rawGrid.map((item: any, i: number) => {
        const gradeName = item.receipt_grade_name || item.challan_grade_name || item.grade_name || item.variety || item.item_name || item.grade || "";
        const gradeCode = item.receipt_grade_code || item.grade_code || item.stock_grade_code || item.item_code || "";
        const areaName = (item.area_name || item.area || item.arrival_area_name || item.arrival_area || voucherArea || "").toUpperCase();
        const agencyName = item.agency_name || item.agency || "";
        const agencyCode = item.agency_code || "";
        const markaName = item.challan_marka_name || item.marka_name || item.marks_phota || item.marka || item.marks || "";
        const nettoVal = Number(item.netto_pnto !== undefined && item.netto_pnto !== null && item.netto_pnto !== "" ? item.netto_pnto : (item.weight_mt || item.quantity_mt || item.challan_gross_wt || item.receipt_gross_wt || item.gross_weight || item.weight || item.net_wt || 0));
        
        let qtyVal = 0;
        if (item.quantity_rcpt !== undefined && item.quantity_rcpt !== null && item.quantity_rcpt !== "") {
          qtyVal = Number(item.quantity_rcpt);
        } else if (item.quantity_chln !== undefined && item.quantity_chln !== null && item.quantity_chln !== "") {
          qtyVal = Number(item.quantity_chln);
        } else if (item.quantity !== undefined && item.quantity !== null && item.quantity !== "") {
          qtyVal = Number(item.quantity);
        } else if (item.bales !== undefined && item.bales !== null && item.bales !== "") {
          qtyVal = Number(item.bales);
        }

        const unitVal = (item.unit || item.unit_name || "BALES").toString().trim().toUpperCase();

        const lMin = Number(item.lorry_read_min || 0);
        const lMax = Number(item.lorry_read_max || 0);
        const lAvg = Number(item.lorry_read_avg || (lMin > 0 && lMax > 0 ? (lMin + lMax) / 2 : (lMin || lMax)) || 0);

        const iMin = Number(item.insp_read_min || 0);
        const iMax = Number(item.insp_read_max || 0);
        const iAvg = Number(item.insp_read_avg || (iMin > 0 && iMax > 0 ? (iMin + iMax) / 2 : (iMin || iMax)) || 0);

        let combinedMoistAvg = 0;
        if (lAvg > 0 && iAvg > 0) {
          combinedMoistAvg = Number(((lAvg + iAvg) / 2).toFixed(2));
        } else if (lAvg > 0 || iAvg > 0) {
          combinedMoistAvg = Number((lAvg || iAvg).toFixed(2));
        }

        const moistAct = Number(item.moisture_act || combinedMoistAvg || 0);
        const moistClaim = Number(item.moisture_claim || combinedMoistAvg || 0);
        const gdAct = Number(item.grade_down_act || item.grade_down || 0);
        const dustAct = Number(item.dust_act || 0);
        const ncvAct = Number(item.ncv_act || 0);

        return {
          srl_no: item.srl_no || (i + 1),
          arrival_grade: gradeName,
          stock_grade_code: gradeCode,
          stock_grade_name: gradeName,
          area: areaName,
          agency: agencyName,
          agency_code: agencyCode,
          marks: markaName,
          crop_year: item.crop_year || "2026-27",
          quantity: qtyVal,
          unit: unitVal,
          challan_gross_wt: nettoVal,
          receipt_gross_wt: nettoVal,
          reduced_weight: nettoVal,
          final_receipt_wt: nettoVal,
          lorry_moisture_min: lMin,
          lorry_moisture_max: lMax,
          lorry_read_min: lMin,
          lorry_read_max: lMax,
          lorry_read_avg: lAvg,
          insp_read_min: iMin,
          insp_read_max: iMax,
          insp_read_avg: iAvg,
          moisture_act: moistAct,
          moisture_claim: moistClaim,
          grade_down_act: gdAct,
          grade_down_claim: Number(item.grade_down_claim || 0),
          dust_act: dustAct,
          dust_claim: Number(item.dust_claim || 0),
          ncv_act: ncvAct,
          ncv_claim: Number(item.ncv_claim || 0),
          settlement_moisture: Number(item.settlement_moisture !== undefined && item.settlement_moisture !== null && item.settlement_moisture !== "" ? item.settlement_moisture : moistAct),
          settlement_grade_down: Number(item.settlement_grade_down !== undefined && item.settlement_grade_down !== null && item.settlement_grade_down !== "" ? item.settlement_grade_down : gdAct),
          settlement_dust: Number(item.settlement_dust !== undefined && item.settlement_dust !== null && item.settlement_dust !== "" ? item.settlement_dust : dustAct),
          settlement_ncv: Number(item.settlement_ncv !== undefined && item.settlement_ncv !== null && item.settlement_ncv !== "" ? item.settlement_ncv : ncvAct),
          tolerable: item.tolerable || "Yes",
          premium: item.premium !== undefined && item.premium !== null ? String(item.premium) : "",
          is_premium: item.is_premium || item.premium === "Yes",
          row_remarks: item.remarks || item.row_remarks || "",
          is_auto: true,
          expanded: false
        };
      });
      setDetailRows(details);
    } else if (voucherArea) {
      setDetailRows(prev => prev.map(r => ({ ...r, area: r.area || voucherArea })));
    }

    if (fa.deductions && Array.isArray(fa.deductions) && fa.deductions.length > 0) {
      setDeductionRows(fa.deductions);
    } else if (fa.deduction_type || (fa.deduction_amount && Number(fa.deduction_amount) > 0)) {
      setDeductionRows([
        {
          id: "1",
          deduction_type: fa.deduction_type || "",
          deduction_rate: Number(fa.deduction_rate) || 0,
          deduction_qty: Number(fa.deduction_qty) || 1,
          deduction_amount: Number(fa.deduction_amount) || 0
        }
      ]);
    } else {
      setDeductionRows([
        { id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 1, deduction_amount: 0 }
      ]);
    }

    showToast(`Loaded Final Arrival ${fa.final_arrival_no || displayMrNo} into inspection form.`);
  };

  const handleOpenNewForm = () => {
    setHeaderForm({
      mr_no: `MRRC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      mr_date: new Date().toISOString().split("T")[0],
      arrival_no: "",
      arrival_date: new Date().toISOString().split("T")[0],
      po_no: "",
      po_date: new Date().toISOString().split("T")[0],
      broker_name: "",
      supplier_name: "",
      actual_moisture: 0,
      claim_moisture: 0,
      actual_dust: 0,
      claim_dust: 0,
      actual_ncv: 0,
      claim_ncv: 0,
      detention_days: 0,
      unloading_date: "",
      mill_po_no: "",
      mill_po_date: "",
      mr_spcl_print: "",
      remarks: "",
      lorry_number: "",
      status: "Completed",
      deduction_type: "",
      deduction_rate: 0,
      deduction_qty: 1,
      deduction_amount: 0
    });
    setDetailRows([
      {
        unit: "BALES",
        quantity: 0,
        challan_gross_wt: 0,
        tolerable: "Yes",
        expanded: false
      }
    ]);
    setDeductionRows([
      { id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 1, deduction_amount: 0 }
    ]);
    setViewMode("form");
  };

  const handleEditRecord = async (rec: InspectionMasterRecord) => {
    setHeaderForm(rec);
    setDetailRows([]);

    if (rec.deductions && Array.isArray(rec.deductions) && rec.deductions.length > 0) {
      setDeductionRows(rec.deductions);
    } else if (rec.deduction_type || (rec.deduction_amount && Number(rec.deduction_amount) > 0)) {
      setDeductionRows([
        {
          id: "1",
          deduction_type: rec.deduction_type || "",
          deduction_rate: Number(rec.deduction_rate) || 0,
          deduction_qty: Number(rec.deduction_qty) || 1,
          deduction_amount: Number(rec.deduction_amount) || 0
        }
      ]);
    } else {
      setDeductionRows([
        { id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 1, deduction_amount: 0 }
      ]);
    }

    setViewMode("form");

    let loadedDetails: InspectionDetailRow[] = [];

    if (supabase) {
      const [midRes, inspRes, millDetRes] = await Promise.all([
        supabase.from("material_inspection_details").select("*").eq("mr_no", rec.mr_no).order("srl_no", { ascending: true }),
        supabase.from("inspection_details").select("*").eq("mr_no", rec.mr_no),
        supabase.from("mill_inspection_detail").select("*").eq("mr_no", rec.mr_no)
      ]);

      if (midRes.data && midRes.data.length > 0) {
        loadedDetails = midRes.data.map(d => ({ ...d, is_auto: true, expanded: false }));
      } else if (inspRes.data && inspRes.data.length > 0) {
        loadedDetails = inspRes.data.map(d => ({ ...d, is_auto: true, expanded: false }));
      } else if (millDetRes.data && millDetRes.data.length > 0) {
        loadedDetails = millDetRes.data.map(d => ({ ...d, is_auto: true, expanded: false }));
      }
    }

    if (loadedDetails.length === 0) {
      // Build detail rows from grid_details if available (from Final Arrival)
      let rawGrid = rec.grid_details;
      if (typeof rawGrid === 'string') {
        try { rawGrid = JSON.parse(rawGrid); } catch (e) {}
      }

      if (Array.isArray(rawGrid) && rawGrid.length > 0) {
        loadedDetails = rawGrid.map((item: any, i: number) => {
          const nettoVal = Number(item.netto_pnto !== undefined && item.netto_pnto !== null && item.netto_pnto !== "" ? item.netto_pnto : (item.weight_mt || item.quantity_mt || item.challan_gross_wt || item.receipt_gross_wt || item.gross_weight || item.weight || item.net_wt || 0));
          
          let qtyVal = 0;
          if (item.quantity_rcpt !== undefined && item.quantity_rcpt !== null && item.quantity_rcpt !== "") {
            qtyVal = Number(item.quantity_rcpt);
          } else if (item.quantity_chln !== undefined && item.quantity_chln !== null && item.quantity_chln !== "") {
            qtyVal = Number(item.quantity_chln);
          } else if (item.quantity !== undefined && item.quantity !== null && item.quantity !== "") {
            qtyVal = Number(item.quantity);
          } else if (item.bales !== undefined && item.bales !== null && item.bales !== "") {
            qtyVal = Number(item.bales);
          }

          const unitVal = (item.unit || item.unit_name || "BALES").toString().trim().toUpperCase();

          const moistAct = Number(item.moisture_act || item.actual_moisture || item.insp_read_avg || rec.actual_moisture || 0);
          const gdAct = Number(item.grade_down_act || item.grade_down || 0);
          const dustAct = Number(item.dust_act || item.actual_dust || rec.actual_dust || 0);
          const ncvAct = Number(item.ncv_act || item.actual_ncv || rec.actual_ncv || 0);

          return {
            srl_no: item.srl_no || (i + 1),
            arrival_grade: item.receipt_grade_name || item.challan_grade_name || item.grade_name || item.variety || item.grade || "",
            stock_grade_code: item.receipt_grade_code || item.grade_code || item.stock_grade_code || item.item_code || "",
            stock_grade_name: item.receipt_grade_name || item.challan_grade_name || item.grade_name || item.variety || item.grade || "",
            area: (item.area_name || item.area || "").toUpperCase(),
            agency: item.agency_name || item.agency || "",
            agency_code: item.agency_code || "",
            marks: item.challan_marka_name || item.marka_name || item.marks_phota || item.marka || item.marks || "",
            crop_year: item.crop_year || "2026-27",
            quantity: qtyVal,
            unit: unitVal,
            challan_gross_wt: nettoVal,
            receipt_gross_wt: nettoVal,
            reduced_weight: nettoVal,
            final_receipt_wt: nettoVal,
            moisture_act: moistAct,
            moisture_claim: Number(item.moisture_claim || item.claim_moisture || rec.claim_moisture || 0),
            grade_down_act: gdAct,
            grade_down_claim: Number(item.grade_down_claim || 0),
            dust_act: dustAct,
            dust_claim: Number(item.dust_claim || item.claim_dust || rec.claim_dust || 0),
            ncv_act: ncvAct,
            ncv_claim: Number(item.ncv_claim || item.claim_ncv || rec.claim_ncv || 0),
            settlement_moisture: Number(item.settlement_moisture !== undefined && item.settlement_moisture !== null && item.settlement_moisture !== "" ? item.settlement_moisture : moistAct),
            settlement_grade_down: Number(item.settlement_grade_down !== undefined && item.settlement_grade_down !== null && item.settlement_grade_down !== "" ? item.settlement_grade_down : gdAct),
            settlement_dust: Number(item.settlement_dust !== undefined && item.settlement_dust !== null && item.settlement_dust !== "" ? item.settlement_dust : dustAct),
            settlement_ncv: Number(item.settlement_ncv !== undefined && item.settlement_ncv !== null && item.settlement_ncv !== "" ? item.settlement_ncv : ncvAct),
            tolerable: item.tolerable || "Yes",
            premium: item.premium !== undefined && item.premium !== null ? String(item.premium) : "",
            is_premium: item.is_premium || item.premium === "Yes",
            row_remarks: item.remarks || item.row_remarks || "",
            is_auto: true,
            expanded: false
          };
        });
      }
    }

    // If still empty, attempt to load from purchase_detail_master by PO number
    if (loadedDetails.length === 0 && rec.po_no) {
      if (supabase) {
        const poClean = rec.po_no.trim();
        const { data: pdm } = await supabase.from('purchase_detail_master').select('*').eq('po_no', poClean);
        if (pdm && pdm.length > 0) {
          loadedDetails = pdm.map((item: any, i: number) => {
            const nettoVal = Number(item.weight_mt || item.quantity_mt || item.netto_pnto || item.weight || item.quantity || 0);
            const moistAct = Number(item.moisture_act || item.actual_moisture || rec.actual_moisture || 0);
            const gdAct = Number(item.grade_down_act || item.grade_down || 0);
            const dustAct = Number(item.dust_act || item.actual_dust || rec.actual_dust || 0);
            const ncvAct = Number(item.ncv_act || item.actual_ncv || rec.actual_ncv || 0);

            return {
              srl_no: item.srl_no || (i + 1),
              arrival_grade: item.grade_name || item.variety || item.grade || "",
              stock_grade_code: item.grade_code || "",
              stock_grade_name: item.grade_name || item.variety || item.grade || "",
              area: (item.area || "").toUpperCase(),
              agency: item.agency || item.agency_name || "",
              marks: item.marka || item.marka_name || "",
              crop_year: item.crop_year || "2026-27",
              quantity: Number(item.quantity || (nettoVal > 0 ? Math.round(nettoVal) : 0)) || 0,
              unit: item.unit || "BALES",
              challan_gross_wt: nettoVal,
              receipt_gross_wt: nettoVal,
              reduced_weight: nettoVal,
              final_receipt_wt: nettoVal,
              moisture_act: moistAct,
              moisture_claim: Number(item.moisture_claim || item.claim_moisture || rec.claim_moisture || 0),
              grade_down_act: gdAct,
              grade_down_claim: Number(item.grade_down_claim || 0),
              dust_act: dustAct,
              dust_claim: Number(item.dust_claim || item.claim_dust || rec.claim_dust || 0),
              ncv_act: ncvAct,
              ncv_claim: Number(item.ncv_claim || item.claim_ncv || rec.claim_ncv || 0),
              settlement_moisture: Number(item.settlement_moisture !== undefined && item.settlement_moisture !== null && item.settlement_moisture !== "" ? item.settlement_moisture : moistAct),
              settlement_grade_down: Number(item.settlement_grade_down !== undefined && item.settlement_grade_down !== null && item.settlement_grade_down !== "" ? item.settlement_grade_down : gdAct),
              settlement_dust: Number(item.settlement_dust !== undefined && item.settlement_dust !== null && item.settlement_dust !== "" ? item.settlement_dust : dustAct),
              settlement_ncv: Number(item.settlement_ncv !== undefined && item.settlement_ncv !== null && item.settlement_ncv !== "" ? item.settlement_ncv : ncvAct),
              tolerable: "Yes",
              is_auto: true,
              expanded: false
            };
          });
        }
      }
    }

    if (loadedDetails.length === 0) {
      loadedDetails = [{ unit: "BALES", quantity: 0, tolerable: "Yes", expanded: false }];
    }

    setDetailRows(loadedDetails);
  };

  const handleHeaderChange = (field: keyof InspectionMasterRecord, value: any) => {
    setHeaderForm(prev => ({ ...prev, [field]: value }));
    if (field === 'po_no' && value) {
      loadDetailsForPo(value);
    } else if ((field === 'mr_no' || field === 'arrival_no') && value) {
      const cleanVal = String(value).trim().toUpperCase();
      const match = finalArrivalList.find(fa => 
        String(fa.mr_no || '').trim().toUpperCase() === cleanVal ||
        String(fa.final_arrival_no || '').trim().toUpperCase() === cleanVal ||
        String(fa.arrival_no || '').trim().toUpperCase() === cleanVal
      );
      if (match) {
        populateFromFinalArrival(match);
      }
    } else if (field === 'actual_moisture' || field === 'claim_moisture') {
      const numVal = Number(value) || 0;
      setDetailRows(prev => prev.map(r => ({
        ...r,
        moisture_act: r.moisture_act || numVal,
        settlement_moisture: (r.settlement_moisture && r.settlement_moisture > 0) ? r.settlement_moisture : numVal
      })));
    } else if (field === 'actual_dust' || field === 'claim_dust') {
      const numVal = Number(value) || 0;
      setDetailRows(prev => prev.map(r => ({
        ...r,
        dust_act: r.dust_act || numVal,
        settlement_dust: (r.settlement_dust && r.settlement_dust > 0) ? r.settlement_dust : numVal
      })));
    } else if (field === 'actual_ncv' || field === 'claim_ncv') {
      const numVal = Number(value) || 0;
      setDetailRows(prev => prev.map(r => ({
        ...r,
        ncv_act: r.ncv_act || numVal,
        settlement_ncv: (r.settlement_ncv && r.settlement_ncv > 0) ? r.settlement_ncv : numVal
      })));
    }
  };
  let totalrow = '';
  const handleDetailChange = (index: number, field: keyof InspectionDetailRow, value: any) => {
    setDetailRows(prev => {
      const updated = [...prev];
      const currentRow = { ...updated[index], [field]: value };

      // Auto Calculate Lorry Moisture Read Avg from Min & Max
      if (field === "lorry_read_min" || field === "lorry_read_max") {
        const min = field === "lorry_read_min" ? Number(value) || 0 : Number(currentRow.lorry_read_min) || 0;
        const max = field === "lorry_read_max" ? Number(value) || 0 : Number(currentRow.lorry_read_max) || 0;
        let avg = 0;
        if (min > 0 && max > 0) {
          avg = Number(((min + max) / 2).toFixed(2));
        } else if (min > 0 || max > 0) {
          avg = min || max;
        }
        //currentRow.lorry_read_avg = avg;
      }

      // Auto Calculate Insp. Moisture Read Avg from Min & Max
      if (field === "insp_read_min" || field === "insp_read_max") {
        const min = field === "insp_read_min" ? Number(value) || 0 : Number(currentRow.insp_read_min) || 0;
        const max = field === "insp_read_max" ? Number(value) || 0 : Number(currentRow.insp_read_max) || 0;
        let avg = 0;
        if (min > 0 && max > 0) {
          avg = Number(((min + max) / 2).toFixed(2));
        } else if (min > 0 || max > 0) {
          avg = min || max;
        }
        //currentRow.insp_read_avg = avg;
      }

      // Auto-pull AVERAGE Value between Lorry Read Avg & Insp Read Avg into Moisture % Act., Claim, and Mill Settlement % Moisture
      if (
        field === "lorry_read_min" ||
        field === "lorry_read_max" ||
        field === "lorry_read_avg" ||
        field === "insp_read_min" ||
        field === "insp_read_max" ||
        field === "insp_read_avg"
      ) {
        const lorryAvg = Number(currentRow.lorry_read_avg) || 0;
        const inspAvg = Number(currentRow.insp_read_avg) || 0;
        let combinedMoistAvg = 0;
        if (lorryAvg > 0 && inspAvg > 0) {
          combinedMoistAvg = Number(((lorryAvg + inspAvg) / 2).toFixed(2));
        } else if (lorryAvg > 0 || inspAvg > 0) {
          combinedMoistAvg = Number((lorryAvg || inspAvg).toFixed(2));
        }
        if (combinedMoistAvg > 0) {
          currentRow.moisture_act = combinedMoistAvg;
          //currentRow.moisture_claim = combinedMoistAvg;
          currentRow.settlement_moisture = combinedMoistAvg;
        }
      }

      // Auto-pull Moisture Act / Claim into Mill Settlement % Moisture
      if (field === "moisture_act") {
        currentRow.settlement_moisture = Number(value) || 0;
      }
      if (field === "moisture_claim" && (!currentRow.settlement_moisture || currentRow.settlement_moisture === 0)) {
        currentRow.settlement_moisture = Number(value) || 0;
      }

      // Auto-pull Grade Down Act / Claim into Mill Settlement % Gr. Down
      if (field === "grade_down_act") {
        currentRow.settlement_grade_down = Number(value) || 0;
      }
      if (field === "grade_down_claim" && (!currentRow.settlement_grade_down || currentRow.settlement_grade_down === 0)) {
        currentRow.settlement_grade_down = Number(value) || 0;
      }

      // Auto-pull Dust Act / Claim into Mill Settlement % Dust
      if (field === "dust_act") {
        currentRow.settlement_dust = Number(value) || 0;
      }
      if (field === "dust_claim" && (!currentRow.settlement_dust || currentRow.settlement_dust === 0)) {
        currentRow.settlement_dust = Number(value) || 0;
      }

      // Auto-pull NCV Act / Claim into Mill Settlement % NCV
      if (field === "ncv_act") {
        currentRow.settlement_ncv = Number(value) || 0;
      }
      if (field === "ncv_claim" && (!currentRow.settlement_ncv || currentRow.settlement_ncv === 0)) {
        currentRow.settlement_ncv = Number(value) || 0;
      }
      // remarks show simul
      /* if (field === "row_remarks" ) {
        if(currentRow.srl_no === '1'){
          totalrow += currentRow.row_remarks
        }
        else{
          totalrow += ' ,'+currentRow.row_remarks
        }
        

        handleHeaderChange("remarks", totalrow)
        console.log(currentRow.row_remarks+'****************111111111111111111')
      } */ 
      //reduced weight
      if ((Number(currentRow.receipt_gross_wt) > 0) && (field === "add_weight" || field === "less_weight") ) {
   
        if ((currentRow.less_weight as any) === 'undefined' || currentRow.less_weight === undefined || isNaN(currentRow.less_weight)) {
          currentRow.less_weight = 0;
        }
        if ((currentRow.add_weight as any) === 'undefined' || currentRow.add_weight === undefined || isNaN(currentRow.add_weight)) {
          currentRow.add_weight = 0;
        }
        let reducewtt = Number(currentRow.receipt_gross_wt) + Number(currentRow.add_weight) - Number(currentRow.less_weight)
        currentRow.reduced_weight = Number(reducewtt.toFixed(3));
        currentRow.final_receipt_wt = Number(reducewtt.toFixed(3));
      }

      if ((Number(currentRow.receipt_gross_wt) > 0) && (field === "moisture_claim") ) {
        let moisturediduct = ((Number(currentRow.receipt_gross_wt)/100) * Number(currentRow.moisture_claim))
        let finalrecieptwt = Number(currentRow.receipt_gross_wt) - Number(moisturediduct.toFixed(3))
        currentRow.final_receipt_wt = Number(finalrecieptwt.toFixed(3));
      }
      
        
      updated[index] = currentRow;
      return updated;
    });
  };

  // Auto calculate Actual/Claim Moisture %, Dust %, NCV % header averages from detail rows
  useEffect(() => {
    if (!detailRows || detailRows.length === 0) return;

    let totalActMoisture = 0, countActMoisture = 0;
    let totalClaimMoisture = 0, countClaimMoisture = 0;
    let totalActDust = 0, countActDust = 0;
    let totalClaimDust = 0, countClaimDust = 0;
    let totalActNcv = 0, countActNcv = 0;
    let totalClaimNcv = 0, countClaimNcv = 0;

    detailRows.forEach(row => {
      const actM = Number(row.moisture_act) || Number(row.insp_read_avg) || 0;
      if (actM > 0) { totalActMoisture += actM; countActMoisture++; }

      const claimM = Number(row.moisture_claim) || 0;
      if (claimM > 0) { totalClaimMoisture += claimM; countClaimMoisture++; }

      const actD = Number(row.dust_act) || 0;
      if (actD > 0) { totalActDust += actD; countActDust++; }

      const claimD = Number(row.dust_claim) || 0;
      if (claimD > 0) { totalClaimDust += claimD; countClaimDust++; }

      const actN = Number(row.ncv_act) || 0;
      if (actN > 0) { totalActNcv += actN; countActNcv++; }

      const claimN = Number(row.ncv_claim) || 0;
      if (claimN > 0) { totalClaimNcv += claimN; countClaimNcv++; }
    });

    const avgActMoisture = countActMoisture > 0 ? Number((totalActMoisture / countActMoisture).toFixed(2)) : 0;
    const avgClaimMoisture = countClaimMoisture > 0 ? Number((totalClaimMoisture / countClaimMoisture).toFixed(2)) : 0;
    const avgActDust = countActDust > 0 ? Number((totalActDust / countActDust).toFixed(2)) : 0;
    const avgClaimDust = countClaimDust > 0 ? Number((totalClaimDust / countClaimDust).toFixed(2)) : 0;
    const avgActNcv = countActNcv > 0 ? Number((totalActNcv / countActNcv).toFixed(2)) : 0;
    const avgClaimNcv = countClaimNcv > 0 ? Number((totalClaimNcv / countClaimNcv).toFixed(2)) : 0;

    setHeaderForm(prev => {
      if (
        prev.actual_moisture === avgActMoisture &&
        prev.claim_moisture === avgClaimMoisture &&
        prev.actual_dust === avgActDust &&
        prev.claim_dust === avgClaimDust &&
        prev.actual_ncv === avgActNcv &&
        prev.claim_ncv === avgClaimNcv
      ) {
        return prev;
      }
      return {
        ...prev,
        actual_moisture: avgActMoisture,
        claim_moisture: avgClaimMoisture,
        actual_dust: avgActDust,
        claim_dust: avgClaimDust,
        actual_ncv: avgActNcv,
        claim_ncv: avgClaimNcv
      };
    });
  }, [detailRows]);

  const handleAddRow = () => {
    setDetailRows(prev => [
      ...prev,
      {
        unit: "BALES",
        quantity: 0,
        challan_gross_wt: 0,
        tolerable: "Yes",
        expanded: false
      }
    ]);
    showToast("New inspection row added.");
  };

  const handleDuplicateRow = (index: number) => {
    const rowToCopy = detailRows[index];
    setDetailRows(prev => [
      ...prev.slice(0, index + 1),
      { ...rowToCopy, id: undefined, expanded: false },
      ...prev.slice(index + 1)
    ]);
    showToast("Inspection row duplicated.");
  };

  const handleDeleteRow = (index: number) => {
    if (detailRows.length <= 1) {
      showToast("At least one inspection row must remain.");
      return;
    }
    setDetailRows(prev => prev.filter((_, i) => i !== index));
    showToast("Inspection row removed.");
  };

  const handleToggleExpand = (index: number) => {
    setDetailRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], expanded: !updated[index].expanded };
      return updated;
    });
  };

  const handleSaveForm = async () => {
    if (!headerForm.mr_no.trim()) {
      alert("M. R. No. is required.");
      return;
    }

    try {
      const activeDeductions = deductionRows.filter(r => (r.deduction_type && r.deduction_type.trim() !== "") || r.deduction_amount > 0);
      const totalDeductionAmt = deductionRows.reduce((acc, r) => acc + (Number(r.deduction_amount) || 0), 0);
      const primaryDeduction = activeDeductions[0] || deductionRows[0] || { deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 };

      // Prepare detail rows
      const validDetails = detailRows.map((row, idx) => ({
        mr_no: headerForm.mr_no,
        srl_no: row.srl_no || idx + 1,
        arrival_grade: row.arrival_grade || row.stock_grade_name || "",
        stock_grade_code: row.stock_grade_code || "",
        stock_grade_name: row.stock_grade_name || row.arrival_grade || "",
        area: row.area || "",
        agency: row.agency || "",
        agency_code: (row as any).agency_code || "",
        marks: row.marks || (row as any).marka || "",
        marka: row.marks || (row as any).marka || "",
        crop_year: row.crop_year || "2026-27",
        lot: row.lot || "",
        quantity: Number(row.quantity) || 0,
        unit: row.unit || "BALES",
        rate: Number((row as any).rate || (row as any).rate_qntl || 0) || 0,
        rate_qntl: Number((row as any).rate_qntl || (row as any).rate || 0) || 0,
        challan_gross_wt: Number(row.challan_gross_wt) || 0,
        receipt_gross_wt: Number(row.receipt_gross_wt) || 0,
        gross_weight_batch: Number(row.gross_weight_batch) || 0,
        add_weight: Number(row.add_weight) || 0,
        less_weight: Number(row.less_weight) || 0,
        reduced_weight: Number(row.reduced_weight) || 0,
        lorry_moisture_min: Number(row.lorry_moisture_min) || 0,
        lorry_moisture_max: Number(row.lorry_moisture_max) || 0,
        lorry_read_min: Number(row.lorry_read_min) || 0,
        lorry_read_max: Number(row.lorry_read_max) || 0,
        lorry_read_avg: Number(row.lorry_read_avg) || 0,
        insp_read_min: Number(row.insp_read_min) || 0,
        insp_read_max: Number(row.insp_read_max) || 0,
        insp_read_avg: Number(row.insp_read_avg) || 0,
        moisture_act: Number(row.moisture_act || (row as any).actual_moisture || 0) || 0,
        moisture_claim: Number(row.moisture_claim || (row as any).claim_moisture || 0) || 0,
        dust_act: Number(row.dust_act || (row as any).actual_dust || 0) || 0,
        dust_claim: Number(row.dust_claim || (row as any).claim_dust || 0) || 0,
        ncv_act: Number(row.ncv_act || (row as any).actual_ncv || 0) || 0,
        ncv_claim: Number(row.ncv_claim || (row as any).claim_ncv || 0) || 0,
        grade_down_act: Number(row.grade_down_act || (row as any).actual_grade_down || 0) || 0,
        grade_down_claim: Number(row.grade_down_claim || (row as any).claim_grade_down || 0) || 0,
        actual_moisture: Number(row.moisture_act || (row as any).actual_moisture || 0) || 0,
        claim_moisture: Number(row.moisture_claim || (row as any).claim_moisture || 0) || 0,
        actual_dust: Number(row.dust_act || (row as any).actual_dust || 0) || 0,
        claim_dust: Number(row.dust_claim || (row as any).claim_dust || 0) || 0,
        actual_ncv: Number(row.ncv_act || (row as any).actual_ncv || 0) || 0,
        claim_ncv: Number(row.ncv_claim || (row as any).claim_ncv || 0) || 0,
        actual_grade_down: Number(row.grade_down_act || (row as any).actual_grade_down || 0) || 0,
        claim_grade_down: Number(row.grade_down_claim || (row as any).claim_grade_down || 0) || 0,
        final_receipt_wt: Number(row.final_receipt_wt) || 0,
        settlement_moisture: Number(row.settlement_moisture) || 0,
        settlement_grade_down: Number(row.settlement_grade_down) || 0,
        settlement_dust: Number(row.settlement_dust) || 0,
        settlement_ncv: Number(row.settlement_ncv) || 0,
        ropes_weight: Number(row.ropes_weight) || 0,
        ropes_tot_wt_grd: Number(row.ropes_tot_wt_grd) || 0,
        ropes_grade: row.ropes_grade || "",
        chotta_weight: Number(row.chotta_weight) || 0,
        chotta_tot_wt_grd: Number(row.chotta_tot_wt_grd) || 0,
        chotta_grade: row.chotta_grade || "",
        tolerable: row.tolerable || "Yes",
        premium: row.premium !== undefined && row.premium !== null ? String(row.premium) : (row.is_premium ? "Yes" : "No"),
        is_premium: Boolean(row.is_premium || row.premium === "Yes" || (row.premium && String(row.premium).trim() !== "" && String(row.premium).toLowerCase() !== "no")),
        amount: Number(row.amount !== undefined && row.amount !== null && !isNaN(Number(row.amount)) ? row.amount : calculateRowAmount(row)) || 0,
        row_remarks: row.row_remarks || "",
        jqi_remarks: row.jqi_remarks || "",
        jci_remarks: row.jci_remarks || row.jqi_remarks || ""
      }));

      const payload: any = {
        ...headerForm,
        deduction_type: activeDeductions.map(r => r.deduction_type).filter(Boolean).join(", ") || primaryDeduction.deduction_type || "",
        deduction_rate: primaryDeduction.deduction_rate || 0,
        deduction_qty: primaryDeduction.deduction_qty || 0,
        deduction_amount: totalDeductionAmt,
        deductions: deductionRows,
        deduction_types: deductionRows,
        date: headerForm.mr_date || (headerForm as any).date || new Date().toISOString().split("T")[0],
        broker: headerForm.broker_name || (headerForm as any).broker || "",
        supplier: headerForm.supplier_name || (headerForm as any).supplier || "",
        status: headerForm.status || "Completed",
        grid_details: validDetails,
        details: validDetails,
        created_at: headerForm.created_at || new Date().toISOString()
      };

      if (supabase) {
        try {
          const { error: masterErr } = await supabase.from("material_inspection").upsert([payload]);
          if (masterErr) {
            console.warn("Error upserting to material_inspection:", masterErr);
          }
        } catch (mErr) {
          console.warn("Exception upserting material_inspection:", mErr);
        }
        try { await supabase.from("mill_inspection_master").upsert([payload]); } catch {}
        try { await supabase.from("inspection_master").upsert([payload]); } catch {}
        try { await supabase.from("inspection_checklist").upsert([payload]); } catch {}
        
        // Clean out old detail rows
        try {
          await supabase.from("material_inspection_details").delete().eq("mr_no", headerForm.mr_no);
        } catch (e) {}
        try { await supabase.from("inspection_details").delete().eq("mr_no", headerForm.mr_no); } catch {}
        try { await supabase.from("inspection_checklist_details").delete().eq("mr_no", headerForm.mr_no); } catch {}
        try { await supabase.from("mill_inspection_detail").delete().eq("mr_no", headerForm.mr_no); } catch {}

        if (validDetails.length > 0) {
          try {
            const { error: insErr } = await supabase.from("material_inspection_details").insert(validDetails);
            if (insErr) {
              console.warn("material_inspection_details insert returned error:", insErr);
            }
          } catch (dErr) {
            console.warn("Exception inserting material_inspection_details:", dErr);
          }
          try { await supabase.from("inspection_details").insert(validDetails); } catch {}
          try { await supabase.from("inspection_checklist_details").insert(validDetails); } catch {}
          try { await supabase.from("mill_inspection_detail").insert(validDetails); } catch {}
        }

        // Sync with final_arrival table
        try {
          await supabase.from("final_arrival").upsert({
            mr_no: headerForm.mr_no,
            mr_date: headerForm.mr_date || null,
            temporary_arrival_no: headerForm.arrival_no,
            arrival_date: headerForm.arrival_date || null,
            date: headerForm.arrival_date || headerForm.mr_date || null,
            po_no: headerForm.po_no,
            po_date: headerForm.po_date || null,
            broker: headerForm.broker_name,
            supplier: headerForm.supplier_name,
            lorry_number: headerForm.lorry_number,
            grid_details: validDetails,
            details: validDetails,
            status: 'Completed'
          });
        } catch (faErr) {}
      }

      // Update local storage cache
      try {
        const cached = localStorage.getItem("material_inspection_records") || localStorage.getItem("inspection_master_records");
        let list: InspectionMasterRecord[] = cached ? JSON.parse(cached) : [];
        list = [payload, ...list.filter((r: any) => r.mr_no !== payload.mr_no)];
        localStorage.setItem("material_inspection_records", JSON.stringify(list));
        localStorage.setItem("inspection_master_records", JSON.stringify(list));
      } catch (e) {}

      window.dispatchEvent(new Event("app-data-updated"));
      showToast(`Inspection ${headerForm.mr_no} saved successfully.`);
      fetchInspectionRecords();
      setViewMode("dashboard");
    } catch (err: any) {
      alert("Failed to save inspection: " + err.message);
    }
  };

  const handleDeleteRecord = async (mr_no: string) => {
    if (!confirm(`Are you sure you want to delete inspection record ${mr_no}? This will remove it from all inspection tables.`)) return;
    try {
      if (supabase) {
        await Promise.all([
          supabase.from("inspection_checklist_details").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("inspection_details").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("mill_inspection_detail").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("material_inspection_details").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("inspection_checklist").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("inspection_master").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("mill_inspection_master").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("material_inspection").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("mill_inspection_print_logs").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
        ]);
      }
      setRecords(prev => prev.filter(r => r.mr_no !== mr_no));
      try {
        const cached = localStorage.getItem("material_inspection_records") || localStorage.getItem("inspection_master_records");
        if (cached) {
          const list = JSON.parse(cached).filter((r: any) => r.mr_no !== mr_no);
          localStorage.setItem("material_inspection_records", JSON.stringify(list));
          localStorage.setItem("inspection_master_records", JSON.stringify(list));
        }
        localStorage.removeItem("AUTOSAVE_MATERIAL_INSPECTION");
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: 'inspection_master', mr_no } }));
      window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: 'mill_inspection_master', mr_no } }));
      window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: 'inspection_checklist', mr_no } }));

      showToast(`Record ${mr_no} completely deleted from all respective tables.`);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleExportCsv = () => {
    if (records.length === 0) return alert("No records to export");
    const headers = ["MR No", "MR Date", "PO No", "Supplier", "Broker", "Lorry No", "Moisture %", "Dust %", "Deductions", "Status"];
    const rows = filteredRecords.map(r => [
      r.mr_no,
      r.mr_date || "",
      r.po_no || "",
      `"${r.supplier_name || ""}"`,
      `"${r.broker_name || ""}"`,
      r.lorry_number || "",
      r.actual_moisture || 0,
      r.actual_dust || 0,
      r.deduction_amount || 0,
      r.status || "Completed"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Mill_Inspection_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecords = records.filter(r => {
    const query = searchQuery.toLowerCase();
    const matchesQuery =
      (r.mr_no || "").toLowerCase().includes(query) ||
      (r.po_no || "").toLowerCase().includes(query) ||
      (r.supplier_name || "").toLowerCase().includes(query) ||
      (r.broker_name || "").toLowerCase().includes(query) ||
      (r.lorry_number || "").toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "all" ||
      (r.status || "Completed").toLowerCase() === statusFilter.toLowerCase();

    return matchesQuery && matchesStatus;
  });

  const totalInspections = records.length;
  const avgMoisture = records.length > 0 ? (records.reduce((acc, r) => acc + (Number(r.actual_moisture) || 0), 0) / records.length).toFixed(1) : "0.0";
  const totalDeductions = records.reduce((acc, r) => acc + (Number(r.deduction_amount) || 0), 0);

  return (
    <LegacyLayout title="Mill Inspection Information" subtitle="Quality inspection register & entry module">
      <div className="flex-1 flex flex-col font-sans text-slate-800 space-y-4 w-full pb-10 px-2 sm:px-4">

        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* HEADER TOOLBAR */}
        <div className="bg-[#174C2C] text-white px-6 py-4 rounded-xl shadow-lg flex flex-wrap items-center justify-between border border-[#0F351E] gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800/40 border border-emerald-400/40 flex items-center justify-center text-amber-300 shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-bold text-white tracking-wide">
                {viewMode === "form" ? "Mill Inspection Information Entry" : "INSPECTION MODULE REGISTER"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {viewMode === "form" ? (
              <>
                {/* <button
                  onClick={() => setViewMode("dashboard")}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back </span>
                </button> */}
                <div className="relative z-10 flex items-center gap-3">
                  <button
                    type="button"
                    className="px-3.5 py-1.5 bg-[#103A20] hover:bg-[#1C5130] text-amber-300 border border-[#235E39] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
                    title="Back to Sauda Desk (Esc)"
                    onClick={() => setViewMode("dashboard")}
                  >
                    <ArrowLeft className="h-4 w-4 text-amber-300" />
                    <span>Back</span>
                  </button>
                </div>
                {/* <button
                  onClick={handleSaveForm}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Inspection</span>
                </button> */}
              </>
            ) : (
              <>
                <button
                  onClick={handleOpenNewForm}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4 text-amber-300" />
                  <span>New Inspection Form</span>
                </button>

                <button
                  onClick={() => fetchInspectionRecords(true)}
                  disabled={loading}
                  className="p-2 bg-[#0b2415]/80 hover:bg-[#123920] active:scale-95 border border-emerald-400/50 rounded-lg text-white transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-4 h-4 text-amber-300 ${loading ? "animate-spin" : ""}`} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* VIEW MODE SWITCH */}
        {viewMode === "dashboard" ? (
          <>
            {/* KPI STATS BAR */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Audits</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{totalInspections}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">material_inspection records</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Moisture %</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{avgMoisture}%</p>
                  <p className="text-[11px] text-blue-600 font-semibold mt-0.5">Quality Parameter</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Percent className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Deductions</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">₹ {totalDeductions.toLocaleString()}</p>
                  <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Quality Claims</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <TrendingDown className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sync Status</p>
                  <p className="text-xl font-black text-emerald-700 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Live DB
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Synced with Supabase</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <Layers className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* SEARCH & FILTERS BAR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Arrival No, P.O. No, Supplier, Lorry No..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/50 bg-slate-50/50"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <button
                  onClick={handleExportCsv}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* REGISTER TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead>
                    <tr className="bg-[#174C2C] text-white font-extrabold uppercase tracking-wider text-[11px] border-b border-[#0F351E]">
                      <th className="py-3 px-4">Arrival No</th>
                      <th className="py-3 px-4">Arrival Date</th>
                      <th className="py-3 px-4">P.O. No</th>
                      <th className="py-3 px-4">Supplier Name</th>
                      <th className="py-3 px-4">Broker Name</th>
                      <th className="py-3 px-4">Lorry No</th>
                      <th className="py-3 px-4 text-center">Act. Moisture %</th>
                      <th className="py-3 px-4 text-center">Act. Dust %</th>
                      <th className="py-3 px-4 text-right">Deduction (₹)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-700 mb-2" />
                          Loading inspection records...
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400">
                          No inspection records found matching your query.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((rec) => (
                        <tr
                          key={rec.mr_no}
                          onDoubleClick={() => handleEditRecord(rec)}
                          className="hover:bg-emerald-50/50 transition-colors cursor-pointer select-none"
                          title="Double-click to open edit mode for this record"
                        >
                          <td className="py-3 px-4 font-black text-emerald-950 font-mono">{rec.mr_no}</td>
                          <td className="py-3 px-4 text-slate-600">
                            {rec.mr_date ? new Date(rec.mr_date).toLocaleDateString("en-GB") : "-"}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{rec.po_no || "N/A"}</td>
                          <td className="py-3 px-4 font-bold text-slate-900 max-w-[180px] truncate">
                            {rec.supplier_name || "-"}
                          </td>
                          <td className="py-3 px-4 text-slate-700">{rec.broker_name || "-"}</td>
                          <td className="py-3 px-4 font-mono text-slate-700">{rec.lorry_number || "-"}</td>
                          <td className="py-3 px-4 text-center font-bold text-blue-700">
                            {rec.actual_moisture ? `${rec.actual_moisture}%` : "-"}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-amber-700">
                            {rec.actual_dust ? `${rec.actual_dust}%` : "-"}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-rose-700">
                            {rec.deduction_amount ? `₹ ${Number(rec.deduction_amount).toLocaleString()}` : "₹ 0"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                              {rec.status || "Completed"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleEditRecord(rec)}
                                className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded font-bold text-[11px] flex items-center gap-1"
                                title="Edit Record & Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(rec.mr_no)}
                                className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* FULL MODERN FORM VIEW BASED ON SPECIFICATION */
          <div className="space-y-6">
            {/* HEADER / MILL INFORMATION SECTION */}
            <section className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Inspection Header / Mill Information</h2>
                  <p className="text-xs text-slate-500 mt-0.5">All fields from the original mill inspection form are preserved</p>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold border border-emerald-200">
                  Header Form
                </span>
              </div>

              {/* Pick Final Arrival Banner */}
              {finalArrivalList.length > 0 && (() => {
                const pendingArrivalList = finalArrivalList.filter(fa => {
                  const faNo = String(fa.final_arrival_no || fa.arrival_no || "").trim().toLowerCase();
                  const faMrNo = String(fa.mr_no || "").trim().toLowerCase();
                  const faId = String(fa.final_arrival_id || "").trim().toLowerCase();
                  const faPoNo = String(fa.po_no || "").trim().toLowerCase();
                  const faLorry = String(fa.lorry_number || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

                  if (fa.status === "Completed" || fa.status === "Inspected" || fa.status === "INSPECTED") {
                    const hasInsp = records.some(r => {
                      const rMr = String(r.mr_no || "").trim().toLowerCase();
                      const rPo = String(r.po_no || "").trim().toLowerCase();
                      return (faPoNo && rPo === faPoNo) || (faMrNo && rMr === faMrNo) || (faNo && rMr === faNo);
                    });
                    if (hasInsp) return false;
                  }

                  return !records.some(r => {
                    const rMr = String(r.mr_no || "").trim().toLowerCase();
                    const rArr = String(r.arrival_no || "").trim().toLowerCase();
                    const rPo = String(r.po_no || "").trim().toLowerCase();
                    const rLorry = String(r.lorry_number || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

                    // 1. Direct arrival / MR number match
                    if (faNo && (rMr === faNo || rArr === faNo || rMr.includes(faNo) || rArr.includes(faNo))) return true;
                    if (faMrNo && (rMr === faMrNo || rArr === faMrNo)) return true;
                    if (faId && (rMr === faId || rArr === faId || rMr === `fa-${faId}` || rArr === `fa-${faId}`)) return true;

                    // 2. Direct PO number match
                    if (faPoNo && rPo && faPoNo === rPo) {
                      if (!faLorry || !rLorry || faLorry === rLorry) return true;
                      if (faNo && (rArr === faNo || rMr === faNo)) return true;
                    }

                    return false;
                  });
                });

                return (
                  <div className="bg-emerald-50/80 px-5 py-3 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-700" />
                      <span className="text-xs font-bold text-emerald-950">
                        Import / Pick From Final Arrival:
                      </span>
                      {pendingArrivalList.length > 0 ? (
                        <span className="bg-emerald-200 text-emerald-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          {pendingArrivalList.length} Pending
                        </span>
                      ) : (
                        <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          All Arrivals Inspected
                        </span>
                      )}
                    </div>
                    <select
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const selectedFa = pendingArrivalList.find(f => 
                          (f.final_arrival_id && String(f.final_arrival_id) === e.target.value) ||
                          (f.final_arrival_no && String(f.final_arrival_no) === e.target.value) ||
                          (f.mr_no && String(f.mr_no) === e.target.value) ||
                          (f.po_no && String(f.po_no) === e.target.value)
                        );
                        if (selectedFa) populateFromFinalArrival(selectedFa);
                      }}
                      defaultValue=""
                      className="bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-md"
                    >
                      {pendingArrivalList.length > 0 ? (
                        <>
                          <option value="">-- Select Pending Arrival Record to Auto-Fill --</option>
                          {pendingArrivalList.map((fa, idx) => (
                            <option key={`p-${idx}`} value={fa.final_arrival_id || fa.final_arrival_no || fa.mr_no || fa.po_no}>
                              Arrival #{fa.final_arrival_no || fa.mr_no || 'FA'} | PO: {fa.po_no || '-'} | {fa.supplier || fa.challan_supplier || 'Supplier'} | Lorry: {fa.lorry_number || '-'}
                            </option>
                          ))}
                        </>
                      ) : (
                        <option value="" disabled>-- No Pending Arrivals (All Already Inspected) --</option>
                      )}
                    </select>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">Arrival No.</label>
                  <input
                    type="text"
                    value={headerForm.mr_no || ""}
                    onChange={(e) => handleHeaderChange("mr_no", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">Arrival Date</label>
                  <input
                    type="date"
                    value={headerForm.mr_date || ""}
                    onChange={(e) => handleHeaderChange("mr_date", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1" style={{ display: "none" }}>
                  <label className="text-xs font-extrabold text-slate-700">Arrival No.</label>
                  <input
                    type="text"
                    value={headerForm.arrival_no || ""}
                    onChange={(e) => handleHeaderChange("arrival_no", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1" style={{ display: "none" }}>
                  <label className="text-xs font-extrabold text-slate-700">Arrival Date</label>
                  <input
                    type="date"
                    value={headerForm.arrival_date || ""}
                    onChange={(e) => handleHeaderChange("arrival_date", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">P.O. No.</label>
                  <input
                    type="text"
                    value={headerForm.po_no || ""}
                    onChange={(e) => handleHeaderChange("po_no", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">P.O. Date</label>
                  <input
                    type="date"
                    value={headerForm.po_date || ""}
                    onChange={(e) => handleHeaderChange("po_date", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2 md:col-span-4">
                  <label className="text-xs font-extrabold text-slate-700">Broker Name</label>
                  <input
                    type="text"
                    value={headerForm.broker_name || ""}
                    onChange={(e) => handleHeaderChange("broker_name", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2 md:col-span-4">
                  <label className="text-xs font-extrabold text-slate-700">Supplier Name</label>
                  <input
                    type="text"
                    value={headerForm.supplier_name || ""}
                    onChange={(e) => handleHeaderChange("supplier_name", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* Left group */}
                <div className="flex flex-col gap-1 border-l-4 border-blue-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Actual Moisture %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={headerForm.actual_moisture || 0}
                    onChange={(e) => handleHeaderChange("actual_moisture", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-blue-700 bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1 border-l-4 border-blue-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Actual Dust %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={headerForm.actual_dust || 0}
                    onChange={(e) => handleHeaderChange("actual_dust", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-amber-700 bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1 border-l-4 border-blue-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Actual NCV %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={headerForm.actual_ncv || 0}
                    onChange={(e) => handleHeaderChange("actual_ncv", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1 border-l-4 border-blue-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Detention Days</label>
                  <input
                    type="number"
                    step="1"
                    value={headerForm.detention_days || 0}
                    onChange={(e) => handleHeaderChange("detention_days", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Right group */}
                <div className="flex flex-col gap-1 border-l-4 border-purple-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Claim Moisture %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={headerForm.claim_moisture || 0}
                    onChange={(e) => handleHeaderChange("claim_moisture", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-purple-700 bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex flex-col gap-1 border-l-4 border-purple-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Claim Dust %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={headerForm.claim_dust || 0}
                    onChange={(e) => handleHeaderChange("claim_dust", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-purple-700 bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex flex-col gap-1 border-l-4 border-purple-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Claim NCV %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={headerForm.claim_ncv || 0}
                    onChange={(e) => handleHeaderChange("claim_ncv", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-purple-700 bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex flex-col gap-1 border-l-4 border-purple-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Unloading Date</label>
                  <input
                    type="date"
                    value={headerForm.unloading_date || ""}
                    onChange={(e) => handleHeaderChange("unloading_date", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">Mill P.O. No.</label>
                  <input
                    type="text"
                    value={headerForm.mill_po_no || ""}
                    onChange={(e) => handleHeaderChange("mill_po_no", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">Mill P.O. Date</label>
                  <input
                    type="date"
                    value={headerForm.mill_po_date || ""}
                    onChange={(e) => handleHeaderChange("mill_po_date", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">MR. Spcl Print</label>
                  <input
                    type="text"
                    value={headerForm.mr_spcl_print || ""}
                    onChange={(e) => handleHeaderChange("mr_spcl_print", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">Lorry Number</label>
                  <input
                    type="text"
                    value={headerForm.lorry_number || ""}
                    onChange={(e) => handleHeaderChange("lorry_number", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold bg-white text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2 md:col-span-4">
                  <label className="text-xs font-extrabold text-slate-700">Remarks</label>
                  <textarea
                    rows={2}
                    value={headerForm.remarks || ""}
                    onChange={(e) => handleHeaderChange("remarks", e.target.value)}
                    placeholder="General mill inspection notes..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </section>

            {/* DEDUCTIONS & PENALTIES CARD (Compact & Sleek Layout) */}
            <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-rose-100 text-rose-700 rounded-md border border-rose-200">
                    <Percent className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">Deduction Details &amp; Penalties</h2>
                  <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-rose-200">
                    {deductionRows.length} {deductionRows.length === 1 ? "Option" : "Options"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {headerForm.deduction_amount ? (
                    <div className="bg-rose-50 text-rose-900 border border-rose-200 px-2.5 py-0.5 rounded-md text-xs font-black flex items-center gap-1">
                      <span className="text-[10px] font-bold text-rose-700 uppercase">Total Claim:</span>
                      <span className="font-mono text-xs text-rose-900">-₹{Number(headerForm.deduction_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleAddDeductionRow}
                    className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Deduction</span>
                  </button>
                </div>
              </div>

              <div className="p-3 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-600">
                      <th className="py-1.5 px-2.5 w-10 text-center">#</th>
                      <th className="py-1.5 px-2.5">Deduction Type</th>
                      <th className="py-1.5 px-2.5 w-32 text-right">Deduction Rate (₹)</th>
                      <th className="py-1.5 px-2.5 w-28 text-right">Qty / Units</th>
                      <th className="py-1.5 px-2.5 w-36 text-right">Deduction Amount (-)</th>
                      <th className="py-1.5 px-2 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deductionRows.map((dRow, idx) => (
                      <tr key={dRow.id || idx} className="hover:bg-rose-50/30 transition-colors">
                        <td className="py-1.5 px-2.5 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2.5">
                          <select
                            value={dRow.deduction_type || ""}
                            onChange={(e) => handleDeductionTypeChange(idx, e.target.value)}
                            className="bg-white border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 rounded-md px-2 py-1 font-sans text-xs font-bold text-slate-800 w-full shadow-2xs outline-none"
                          >
                            <option value="">-- SELECT DEDUCTION TYPE --</option>
                            {deductionMasterList.map((d, dIdx) => (
                              <option key={dIdx} value={d.deduction}>
                                {d.deduction} {d.rate_per_unit ? `(₹${d.rate_per_unit}/Unit)` : d.rate_per_qntl ? `(₹${d.rate_per_qntl}/Qtl)` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 px-2.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={dRow.deduction_rate || ""}
                            onChange={(e) => handleDeductionChange(idx, "deduction_rate", parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="bg-white border border-slate-300 rounded-md px-2 py-1 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                          />
                        </td>
                        <td className="py-1.5 px-2.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={dRow.deduction_qty || ""}
                            onChange={(e) => handleDeductionChange(idx, "deduction_qty", parseFloat(e.target.value) || 0)}
                            placeholder="1"
                            className="bg-white border border-slate-300 rounded-md px-2 py-1 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                          />
                        </td>
                        <td className="py-1.5 px-2.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={dRow.deduction_amount || ""}
                            onChange={(e) => handleDeductionChange(idx, "deduction_amount", parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="bg-rose-50 border border-rose-300 rounded-md px-2 py-1 text-right font-mono font-black text-xs text-rose-800 shadow-2xs focus:outline-none w-full"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          {deductionRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDeductionRow(idx)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors inline-flex items-center justify-center cursor-pointer"
                              title="Remove deduction"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-100/90">
                    <tr className="font-extrabold text-slate-800">
                      <td colSpan={3} className="py-2 px-2.5 text-right uppercase text-[11px] tracking-wide text-slate-700">
                        Total Deductions &amp; Penalties:
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-black text-xs text-slate-900">
                        {deductionRows.reduce((sum, r) => sum + (Number(r.deduction_qty) || 0), 0)}
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <span className="inline-block w-full bg-rose-100 text-rose-900 border border-rose-300 rounded px-2 py-1 font-mono font-black text-xs text-right shadow-2xs">
                          -₹{deductionRows.reduce((sum, r) => sum + (Number(r.deduction_amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-2 px-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* INSPECTION DETAILS WIDE TABLE SECTION */}
            <section className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-extrabold text-slate-900">Inspection Details</h2>
                    <span className="bg-blue-100 text-blue-800 text-xs font-extrabold px-3 py-0.5 rounded-full border border-blue-200">
                      {detailRows.length} {detailRows.length === 1 ? "Row" : "Rows"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Horizontal scroll + Expand Row on every record for comprehensive quality audit details
                  </p>
                </div>

                {/* Color Legend & Add Row */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs text-[11px]">
                    <span className="font-bold text-slate-500 mr-1">Field Legend:</span>
                    <span className="inline-flex items-center gap-1 bg-blue-100/90 text-blue-900 border border-blue-300 px-2 py-0.5 rounded font-extrabold shadow-2xs" title="Auto-populated from Arrival / PO / Master (Protected from manual edits)">
                      <Lock className="w-3 h-3 text-blue-700" />
                      Auto-Populated &amp; Blocked
                    </span>
                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded font-medium">
                      Manual Entry Allowed
                    </span>
                  </div>

                  <button
                    onClick={handleAddRow}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Row</span>
                  </button>
                </div>
              </div>

              <div className="overflow-auto max-h-[calc(100vh-180px)] border-t border-slate-200">
                <table className="min-w-[4300px] w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1e3a8a] text-white text-[12px] font-bold">
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center sticky left-0 bg-[#1e3a8a] z-20 min-w-[50px]">Srl No.</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[120px]">Arrival Grade</th>
                      <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Stock Grade</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Area</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Agency</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Marks</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Crop Year</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Lot</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Quantity</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Unit</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px]">Challan Gross Wt. MT.</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px]">Receipt Gross Wt. MT.</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px]">Gross Weight (Batch)</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[120px] bg-gradient-to-b from-[#065f46] to-[#047857] text-white font-extrabold shadow-inner">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span>Add Weight</span>
                          <span className="text-[9px] font-semibold text-emerald-200">M.Ton</span>
                        </div>
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[120px] bg-gradient-to-b from-[#991b1b] to-[#b91c1c] text-white font-extrabold shadow-inner">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span>Less Weight</span>
                          <span className="text-[9px] font-semibold text-rose-200">M.Ton</span>
                        </div>
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px] bg-gradient-to-b from-[#3730a3] to-[#4338ca] text-white font-extrabold shadow-inner">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span>Reduced Weight</span>
                          <span className="text-[9px] font-semibold text-indigo-200">M.Ton</span>
                        </div>
                      </th>
                      {/* <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Lorry Moisture</th> */}
                      <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1e40af]">Lorry Moisture Read (%)</th>
                      <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Insp. Moisture Read (%)</th>
                      <th colSpan={2} className="p-2 border-r border-blue-400 text-center bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white font-black shadow-inner">
                        <div className="flex items-center justify-center gap-1">
                          <Sparkles className="w-3 h-3 text-cyan-300 fill-cyan-300" />
                          <span className="tracking-wide">Moisture %</span>
                        </div>
                      </th>
                      <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Dust %</th>
                      <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1e40af]">NCV %</th>
                      <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Grade Down %</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[140px]">Final Receipt Wt. (Claim)</th>
                      <th colSpan={4} className="p-2 border-r border-emerald-400 text-center bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-black shadow-inner">
                        <div className="flex items-center justify-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                          <span className="tracking-wide">Mill Settlement %</span>
                        </div>
                      </th>
                      <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Ropes</th>
                      <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1e40af]">Chotta &amp; Habi Jabi</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[90px]">Tolerable</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px] bg-gradient-to-b from-[#1d4ed8] to-[#1e3a8a] text-amber-300">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className="font-black flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                            Premium
                          </span>
                          <span className="text-[9px] font-semibold text-blue-100 opacity-90">(Show Qty in MT)</span>
                        </div>
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[125px] bg-gradient-to-b from-[#1e40af] to-[#1e3a8a] text-white font-extrabold shadow-inner">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span>Amount</span>
                          <span className="text-[9px] font-semibold text-amber-300 font-mono">₹ Total</span>
                        </div>
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[140px]">Remarks</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[140px]">JCI Remarks</th>
                      <th rowSpan={2} className="p-2 text-center sticky right-0 bg-[#1e3a8a] z-20 min-w-[190px]">Row Actions</th>
                    </tr>
                    <tr className="bg-[#243b68] text-white text-[11px]">
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Code</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[120px]">Name</th>
                      {/* <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Min</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Max</th> */}
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Min</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Max</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Avg</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Min</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Max</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Avg</th>
                      <th className="p-1.5 border-r border-blue-500 text-center min-w-[90px] bg-blue-900 text-blue-100 font-black" title="Auto-pulled highest value between Lorry Avg and Insp Avg">Act.</th>
                      <th className="p-1.5 border-r border-blue-500 text-center min-w-[90px] bg-blue-900 text-blue-100 font-black" title="Auto-pulled highest value between Lorry Avg and Insp Avg">Claim</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Act.</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Claim</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Act.</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Claim</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Act.</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Claim</th>
                      <th className="p-1.5 border-r border-emerald-500 text-center min-w-[90px] bg-emerald-800 text-emerald-100 font-black" title="Auto-pulled from Moisture % Act.">Moisture</th>
                      <th className="p-1.5 border-r border-emerald-500 text-center min-w-[90px] bg-emerald-800 text-emerald-100 font-black" title="Auto-pulled from Grade Down % Act.">Gr. Down</th>
                      <th className="p-1.5 border-r border-emerald-500 text-center min-w-[90px] bg-emerald-800 text-emerald-100 font-black" title="Auto-pulled from Dust % Act.">Dust</th>
                      <th className="p-1.5 border-r border-emerald-500 text-center min-w-[90px] bg-emerald-800 text-emerald-100 font-black" title="Auto-pulled from NCV % Act.">NCV</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Weight (Kg)</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[100px]">Tot. Wt. Grd%</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Grade</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Weight (Kg)</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[100px]">Tot. Wt. Grd%</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((row, idx) => {
                      const isArrivalGradeBlocked = isAutoBlocked(row, "arrival_grade");
                      const isStockGradeCodeBlocked = isAutoBlocked(row, "stock_grade_code");
                      const isStockGradeNameBlocked = isAutoBlocked(row, "stock_grade_name");
                      const isAreaBlocked = isAutoBlocked(row, "area");
                      const isAgencyBlocked = isAutoBlocked(row, "agency");
                      const isMarksBlocked = isAutoBlocked(row, "marks");
                      const isCropYearBlocked = isAutoBlocked(row, "crop_year");
                      const isLotBlocked = isAutoBlocked(row, "lot");
                      const isQuantityBlocked = isAutoBlocked(row, "quantity");
                      const isUnitBlocked = isAutoBlocked(row, "unit");
                      const isChallanGrossWtBlocked = isAutoBlocked(row, "challan_gross_wt");
                      const isReceiptGrossWtBlocked = isAutoBlocked(row, "receipt_gross_wt");
                      const isGrossWeightBatchBlocked = isAutoBlocked(row, "gross_weight_batch");
                      const isAddWeightBlocked = isAutoBlocked(row, "add_weight");
                      const isLessWeightBlocked = isAutoBlocked(row, "less_weight");
                      const isReducedWeightBlocked = isAutoBlocked(row, "reduced_weight");
                      const isLorryMoistureMinBlocked = isAutoBlocked(row, "lorry_moisture_min");
                      const isLorryMoistureMaxBlocked = isAutoBlocked(row, "lorry_moisture_max");
                      const isLorryReadMinBlocked = isAutoBlocked(row, "lorry_read_min");
                      const isLorryReadMaxBlocked = isAutoBlocked(row, "lorry_read_max");
                      const isInspReadMinBlocked = isAutoBlocked(row, "insp_read_min");
                      const isInspReadMaxBlocked = isAutoBlocked(row, "insp_read_max");
                      const isMoistureActBlocked = isAutoBlocked(row, "moisture_act");
                      const isMoistureClaimBlocked = isAutoBlocked(row, "moisture_claim");
                      const isDustActBlocked = isAutoBlocked(row, "dust_act");
                      const isDustClaimBlocked = isAutoBlocked(row, "dust_claim");
                      const isNcvActBlocked = isAutoBlocked(row, "ncv_act");
                      const isNcvClaimBlocked = isAutoBlocked(row, "ncv_claim");
                      const isGradeDownActBlocked = isAutoBlocked(row, "grade_down_act");
                      const isGradeDownClaimBlocked = isAutoBlocked(row, "grade_down_claim");
                      const isFinalReceiptWtBlocked = isAutoBlocked(row, "final_receipt_wt");
                      const isSettlementMoistureBlocked = isAutoBlocked(row, "settlement_moisture");
                      const isSettlementGradeDownBlocked = isAutoBlocked(row, "settlement_grade_down");
                      const isSettlementDustBlocked = isAutoBlocked(row, "settlement_dust");
                      const isSettlementNcvBlocked = isAutoBlocked(row, "settlement_ncv");
                      const isRopesWeightBlocked = isAutoBlocked(row, "ropes_weight");
                      const isRopesTotWtGrdBlocked = isAutoBlocked(row, "ropes_tot_wt_grd");
                      const isRopesGradeBlocked = isAutoBlocked(row, "ropes_grade");
                      const isChottaWeightBlocked = isAutoBlocked(row, "chotta_weight");
                      const isChottaTotWtGrdBlocked = isAutoBlocked(row, "chotta_tot_wt_grd");
                      const isChottaGradeBlocked = isAutoBlocked(row, "chotta_grade");

                      return (
                        <React.Fragment key={idx}>
                          <tr className={`border-b border-slate-200 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} ${row.expanded ? "bg-blue-50/50" : ""}`}>
                            {/* Srl No */}
                            <td className="p-2 border-r border-slate-200 text-center font-extrabold text-slate-700 sticky left-0 bg-white z-10">
                              <div className="flex items-center justify-center gap-1">
                                <span>{idx + 1}</span>
                                {row.is_auto && (
                                  <span title="Auto-filled from Arrival / PO">
                                    <Lock className="w-2.5 h-2.5 text-blue-600 inline" />
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Arrival Grade */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isArrivalGradeBlocked}
                                tabIndex={isArrivalGradeBlocked ? -1 : 0}
                                title={isArrivalGradeBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.arrival_grade || ""}
                                onChange={(e) => !isArrivalGradeBlocked && handleDetailChange(idx, "arrival_grade", e.target.value)}
                                className={getFieldInputStyle(isArrivalGradeBlocked)}
                              />
                            </td>

                            {/* Stock Grade Code & Name */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isStockGradeCodeBlocked}
                                tabIndex={isStockGradeCodeBlocked ? -1 : 0}
                                title={isStockGradeCodeBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.stock_grade_code || ""}
                                onChange={(e) => !isStockGradeCodeBlocked && handleDetailChange(idx, "stock_grade_code", e.target.value)}
                                className={getFieldInputStyle(isStockGradeCodeBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isStockGradeNameBlocked}
                                tabIndex={isStockGradeNameBlocked ? -1 : 0}
                                title={isStockGradeNameBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.stock_grade_name || ""}
                                onChange={(e) => !isStockGradeNameBlocked && handleDetailChange(idx, "stock_grade_name", e.target.value)}
                                className={getFieldInputStyle(isStockGradeNameBlocked)}
                              />
                            </td>

                            {/* Area & Agency */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isAreaBlocked}
                                tabIndex={isAreaBlocked ? -1 : 0}
                                title={isAreaBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.area || ""}
                                onChange={(e) => !isAreaBlocked && handleDetailChange(idx, "area", e.target.value)}
                                className={getFieldInputStyle(isAreaBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isAgencyBlocked}
                                tabIndex={isAgencyBlocked ? -1 : 0}
                                title={isAgencyBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.agency || ""}
                                onChange={(e) => !isAgencyBlocked && handleDetailChange(idx, "agency", e.target.value)}
                                className={getFieldInputStyle(isAgencyBlocked)}
                              />
                            </td>

                            {/* Marks, Crop Year, Lot */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isMarksBlocked}
                                tabIndex={isMarksBlocked ? -1 : 0}
                                title={isMarksBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.marks || ""}
                                onChange={(e) => !isMarksBlocked && handleDetailChange(idx, "marks", e.target.value)}
                                className={getFieldInputStyle(isMarksBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isCropYearBlocked}
                                tabIndex={isCropYearBlocked ? -1 : 0}
                                title={isCropYearBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.crop_year || ""}
                                onChange={(e) => !isCropYearBlocked && handleDetailChange(idx, "crop_year", e.target.value)}
                                className={getFieldInputStyle(isCropYearBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isLotBlocked}
                                tabIndex={isLotBlocked ? -1 : 0}
                                title={isLotBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.lot || ""}
                                onChange={(e) => !isLotBlocked && handleDetailChange(idx, "lot", e.target.value)}
                                className={getFieldInputStyle(isLotBlocked)}
                              />
                            </td>

                            {/* Quantity & Unit */}
                            <td className="p-1.5 border-r border-slate-200">
                              <div className="flex flex-col gap-0.5">
                                <input
                                  type="number"
                                  step="1"
                                  readOnly={isQuantityBlocked}
                                  tabIndex={isQuantityBlocked ? -1 : 0}
                                  title={isQuantityBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                  value={row.quantity !== undefined && row.quantity !== null ? row.quantity : 0}
                                  onChange={(e) => {
                                    if (isQuantityBlocked) return;
                                    const val = Number(e.target.value);
                                    handleDetailChange(idx, "quantity", val);
                                  }}
                                  className={getFieldInputStyle(isQuantityBlocked, "font-bold font-mono text-right")}
                                />
                                <span className="text-[9px] text-slate-500 font-medium">
                                  ≈ {calculateQtyInMt(row).toFixed(3)} MT
                                </span>
                              </div>
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <div className="flex flex-col gap-0.5">
                                <input
                                  type="text"
                                  readOnly={isUnitBlocked}
                                  tabIndex={isUnitBlocked ? -1 : 0}
                                  title={isUnitBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                  value={row.unit || "BALES"}
                                  onChange={(e) => !isUnitBlocked && handleDetailChange(idx, "unit", e.target.value.toUpperCase())}
                                  className={getFieldInputStyle(isUnitBlocked, "text-center uppercase font-bold")}
                                />
                              </div>
                            </td>

                            {/* Weights */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isChallanGrossWtBlocked}
                                tabIndex={isChallanGrossWtBlocked ? -1 : 0}
                                title={isChallanGrossWtBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.challan_gross_wt || 0}
                                onChange={(e) => !isChallanGrossWtBlocked && handleDetailChange(idx, "challan_gross_wt", Number(e.target.value))}
                                className={getFieldInputStyle(isChallanGrossWtBlocked, "font-mono font-bold")}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isReceiptGrossWtBlocked}
                                tabIndex={isReceiptGrossWtBlocked ? -1 : 0}
                                title={isReceiptGrossWtBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.receipt_gross_wt || 0}
                                onChange={(e) => !isReceiptGrossWtBlocked && handleDetailChange(idx, "receipt_gross_wt", Number(e.target.value))}
                                className={getFieldInputStyle(isReceiptGrossWtBlocked, "font-mono font-bold")}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isGrossWeightBatchBlocked}
                                tabIndex={isGrossWeightBatchBlocked ? -1 : 0}
                                title={isGrossWeightBatchBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.gross_weight_batch || 0}
                                onChange={(e) => !isGrossWeightBatchBlocked && handleDetailChange(idx, "gross_weight_batch", Number(e.target.value))}
                                className={getFieldInputStyle(isGrossWeightBatchBlocked, "font-mono")}
                              />
                            </td>
                            <td className="p-1.5 border-r border-emerald-200 bg-emerald-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isAddWeightBlocked}
                                tabIndex={isAddWeightBlocked ? -1 : 0}
                                title={isAddWeightBlocked ? "Auto-populated (Manual edit blocked)" : "Add Weight M.Ton"}
                                value={row.add_weight || 0}
                                onChange={(e) => !isAddWeightBlocked && handleDetailChange(idx, "add_weight", Number(e.target.value))}
                                className={`w-full border border-emerald-300 rounded px-2 py-1 text-xs font-mono font-bold text-center bg-emerald-50/80 text-emerald-950 focus:ring-2 focus:ring-emerald-500 ${isAddWeightBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>
                            <td className="p-1.5 border-r border-rose-200 bg-rose-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isLessWeightBlocked}
                                tabIndex={isLessWeightBlocked ? -1 : 0}
                                title={isLessWeightBlocked ? "Auto-populated (Manual edit blocked)" : "Less Weight M.Ton"}
                                value={row.less_weight || 0}
                                onChange={(e) => !isLessWeightBlocked && handleDetailChange(idx, "less_weight", Number(e.target.value))}
                                className={`w-full border border-rose-300 rounded px-2 py-1 text-xs font-mono font-bold text-center bg-rose-50/80 text-rose-950 focus:ring-2 focus:ring-rose-500 ${isLessWeightBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>
                            <td className="p-1.5 border-r border-indigo-200 bg-indigo-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isReducedWeightBlocked}
                                tabIndex={isReducedWeightBlocked ? -1 : 0}
                                title={isReducedWeightBlocked ? "Auto-populated (Manual edit blocked)" : "Reduced Weight M.Ton"}
                                value={row.reduced_weight || 0}
                                onChange={(e) => !isReducedWeightBlocked && handleDetailChange(idx, "reduced_weight", Number(e.target.value))}
                                className={`w-full border border-indigo-300 rounded px-2 py-1 text-xs font-mono font-bold text-center bg-indigo-50/80 text-indigo-950 focus:ring-2 focus:ring-indigo-500 ${isReducedWeightBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>

                            {/* Lorry Moisture Min / Max */}
                           {/*  <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isLorryMoistureMinBlocked}
                                tabIndex={isLorryMoistureMinBlocked ? -1 : 0}
                                title={isLorryMoistureMinBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.lorry_moisture_min || 0}
                                onChange={(e) => !isLorryMoistureMinBlocked && handleDetailChange(idx, "lorry_moisture_min", Number(e.target.value))}
                                className={getFieldInputStyle(isLorryMoistureMinBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isLorryMoistureMaxBlocked}
                                tabIndex={isLorryMoistureMaxBlocked ? -1 : 0}
                                title={isLorryMoistureMaxBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.lorry_moisture_max || 0}
                                onChange={(e) => !isLorryMoistureMaxBlocked && handleDetailChange(idx, "lorry_moisture_max", Number(e.target.value))}
                                className={getFieldInputStyle(isLorryMoistureMaxBlocked)}
                              />
                            </td> */}

                            {/* Lorry Read Min / Max / Avg */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isLorryReadMinBlocked}
                                tabIndex={isLorryReadMinBlocked ? -1 : 0}
                                title={isLorryReadMinBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.lorry_read_min || 0}
                                onChange={(e) => !isLorryReadMinBlocked && handleDetailChange(idx, "lorry_read_min", Number(e.target.value))}
                                className={getFieldInputStyle(isLorryReadMinBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isLorryReadMaxBlocked}
                                tabIndex={isLorryReadMaxBlocked ? -1 : 0}
                                title={isLorryReadMaxBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.lorry_read_max || 0}
                                onChange={(e) => !isLorryReadMaxBlocked && handleDetailChange(idx, "lorry_read_max", Number(e.target.value))}
                                className={getFieldInputStyle(isLorryReadMaxBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={false}
                                tabIndex={-1}
                                title="Auto-calculated average (Locked)"
                                value={row.lorry_read_avg || 0}
                                onChange={(e) => handleDetailChange(idx, "lorry_read_avg", Number(e.target.value))}
                                className={getFieldInputStyle(false, "text-blue-900 font-black")}
                              />
                            </td>

                            {/* Insp Read Min / Max / Avg */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isInspReadMinBlocked}
                                tabIndex={isInspReadMinBlocked ? -1 : 0}
                                title={isInspReadMinBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.insp_read_min || 0}
                                onChange={(e) => !isInspReadMinBlocked && handleDetailChange(idx, "insp_read_min", Number(e.target.value))}
                                className={getFieldInputStyle(isInspReadMinBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isInspReadMaxBlocked}
                                tabIndex={isInspReadMaxBlocked ? -1 : 0}
                                title={isInspReadMaxBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.insp_read_max || 0}
                                onChange={(e) => !isInspReadMaxBlocked && handleDetailChange(idx, "insp_read_max", Number(e.target.value))}
                                className={getFieldInputStyle(isInspReadMaxBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={false}
                                tabIndex={-1}
                                title="Auto-calculated average (Locked)"
                                value={row.insp_read_avg || 0}
                                onChange={(e) => handleDetailChange(idx, "insp_read_avg", Number(e.target.value))}
                                className={getFieldInputStyle(false, "text-blue-900 font-black")}
                              />
                            </td>

                            {/* Moisture Act / Claim (Highlighted in Blue Theme with Auto Average Value) */}
                            <td className="p-1.5 border-r border-blue-200 bg-blue-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isMoistureActBlocked}
                                tabIndex={isMoistureActBlocked ? -1 : 0}
                                title={isMoistureActBlocked ? "Auto-populated (Manual edit blocked)" : "Moisture % Act. (Auto-calculated average of Lorry Read Avg & Insp. Read Avg)"}
                                value={row.moisture_act !== undefined && row.moisture_act !== null && Number(row.moisture_act) > 0 ? row.moisture_act : ((Number(row.lorry_read_avg) > 0 && Number(row.insp_read_avg) > 0) ? Number(((Number(row.lorry_read_avg) + Number(row.insp_read_avg)) / 2).toFixed(2)) : (Number(row.lorry_read_avg) || Number(row.insp_read_avg) || 0))}
                                onChange={(e) => !isMoistureActBlocked && handleDetailChange(idx, "moisture_act", Number(e.target.value))}
                                className={`w-full border border-blue-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 bg-blue-50/70 text-blue-950 font-black text-center ${isMoistureActBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>
                            <td className="p-1.5 border-r border-blue-200 bg-blue-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isMoistureClaimBlocked}
                                tabIndex={isMoistureClaimBlocked ? -1 : 0}
                                title={isMoistureClaimBlocked ? "Auto-populated (Manual edit blocked)" : "Moisture % Claim (Auto-calculated average of Lorry Read Avg & Insp. Read Avg)"}
                                //value={row.moisture_claim !== undefined && row.moisture_claim !== null && Number(row.moisture_claim) > 0 ? row.moisture_claim : (row.moisture_act || ((Number(row.lorry_read_avg) > 0 && Number(row.insp_read_avg) > 0) ? Number(((Number(row.lorry_read_avg) + Number(row.insp_read_avg)) / 2).toFixed(2)) : (Number(row.lorry_read_avg) || Number(row.insp_read_avg) || 0)))}
                                value={row.moisture_claim || 0}
                                onChange={(e) => !isMoistureClaimBlocked && handleDetailChange(idx, "moisture_claim", Number(e.target.value))}
                                className={`w-full border border-blue-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 bg-blue-50/70 text-indigo-950 font-black text-center ${isMoistureClaimBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>

                            {/* Dust Act / Claim */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isDustActBlocked}
                                tabIndex={isDustActBlocked ? -1 : 0}
                                title={isDustActBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.dust_act || 0}
                                onChange={(e) => !isDustActBlocked && handleDetailChange(idx, "dust_act", Number(e.target.value))}
                                className={getFieldInputStyle(isDustActBlocked, "text-amber-900 font-bold")}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isDustClaimBlocked}
                                tabIndex={isDustClaimBlocked ? -1 : 0}
                                title={isDustClaimBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.dust_claim || 0}
                                onChange={(e) => !isDustClaimBlocked && handleDetailChange(idx, "dust_claim", Number(e.target.value))}
                                className={getFieldInputStyle(isDustClaimBlocked, "text-purple-900 font-bold")}
                              />
                            </td>

                            {/* NCV Act / Claim */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isNcvActBlocked}
                                tabIndex={isNcvActBlocked ? -1 : 0}
                                title={isNcvActBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.ncv_act || 0}
                                onChange={(e) => !isNcvActBlocked && handleDetailChange(idx, "ncv_act", Number(e.target.value))}
                                className={getFieldInputStyle(isNcvActBlocked, "text-emerald-900 font-bold")}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isNcvClaimBlocked}
                                tabIndex={isNcvClaimBlocked ? -1 : 0}
                                title={isNcvClaimBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.ncv_claim || 0}
                                onChange={(e) => !isNcvClaimBlocked && handleDetailChange(idx, "ncv_claim", Number(e.target.value))}
                                className={getFieldInputStyle(isNcvClaimBlocked, "text-purple-900 font-bold")}
                              />
                            </td>

                            {/* Grade Down Act / Claim */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isGradeDownActBlocked}
                                tabIndex={isGradeDownActBlocked ? -1 : 0}
                                title={isGradeDownActBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.grade_down_act || 0}
                                onChange={(e) => !isGradeDownActBlocked && handleDetailChange(idx, "grade_down_act", Number(e.target.value))}
                                className={getFieldInputStyle(isGradeDownActBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isGradeDownClaimBlocked}
                                tabIndex={isGradeDownClaimBlocked ? -1 : 0}
                                title={isGradeDownClaimBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.grade_down_claim || 0}
                                onChange={(e) => !isGradeDownClaimBlocked && handleDetailChange(idx, "grade_down_claim", Number(e.target.value))}
                                className={getFieldInputStyle(isGradeDownClaimBlocked)}
                              />
                            </td>

                            {/* Final Receipt Wt */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isFinalReceiptWtBlocked}
                                tabIndex={isFinalReceiptWtBlocked ? -1 : 0}
                                title={isFinalReceiptWtBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.final_receipt_wt || 0}
                                onChange={(e) => !isFinalReceiptWtBlocked && handleDetailChange(idx, "final_receipt_wt", Number(e.target.value))}
                                className={getFieldInputStyle(isFinalReceiptWtBlocked, "font-mono font-bold")}
                              />
                            </td>

                            {/* Settlement % (Highlighted in Emerald Theme) */}
                            <td className="p-1.5 border-r border-emerald-200 bg-emerald-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isSettlementMoistureBlocked}
                                tabIndex={isSettlementMoistureBlocked ? -1 : 0}
                                title={isSettlementMoistureBlocked ? "Auto-populated (Manual edit blocked)" : "Mill Settlement % Moisture (Auto-pulled from Act. Moisture)"}
                                value={row.settlement_moisture !== undefined && row.settlement_moisture !== null && Number(row.settlement_moisture) > 0 ? row.settlement_moisture : (row.moisture_act || row.moisture_claim || ((Number(row.lorry_read_avg) > 0 && Number(row.insp_read_avg) > 0) ? Number(((Number(row.lorry_read_avg) + Number(row.insp_read_avg)) / 2).toFixed(2)) : (Number(row.lorry_read_avg) || Number(row.insp_read_avg) || 0)))}
                                onChange={(e) => !isSettlementMoistureBlocked && handleDetailChange(idx, "settlement_moisture", Number(e.target.value))}
                                className={`w-full border border-emerald-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500 bg-emerald-50/70 text-emerald-950 font-black text-center ${isSettlementMoistureBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>
                            <td className="p-1.5 border-r border-emerald-200 bg-emerald-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isSettlementGradeDownBlocked}
                                tabIndex={isSettlementGradeDownBlocked ? -1 : 0}
                                title={isSettlementGradeDownBlocked ? "Auto-populated (Manual edit blocked)" : "Mill Settlement % Gr. Down (Auto-pulled from Act. Grade Down)"}
                                value={row.settlement_grade_down !== undefined && row.settlement_grade_down !== null && Number(row.settlement_grade_down) > 0 ? row.settlement_grade_down : (row.grade_down_act || row.grade_down_claim || 0)}
                                onChange={(e) => !isSettlementGradeDownBlocked && handleDetailChange(idx, "settlement_grade_down", Number(e.target.value))}
                                className={`w-full border border-emerald-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500 bg-emerald-50/70 text-emerald-950 font-black text-center ${isSettlementGradeDownBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>
                            <td className="p-1.5 border-r border-emerald-200 bg-emerald-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isSettlementDustBlocked}
                                tabIndex={isSettlementDustBlocked ? -1 : 0}
                                title={isSettlementDustBlocked ? "Auto-populated (Manual edit blocked)" : "Mill Settlement % Dust (Auto-pulled from Act. Dust)"}
                                value={row.settlement_dust !== undefined && row.settlement_dust !== null && Number(row.settlement_dust) > 0 ? row.settlement_dust : (row.dust_act || row.dust_claim || headerForm.actual_dust || headerForm.claim_dust || 0)}
                                onChange={(e) => !isSettlementDustBlocked && handleDetailChange(idx, "settlement_dust", Number(e.target.value))}
                                className={`w-full border border-emerald-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500 bg-emerald-50/70 text-emerald-950 font-black text-center ${isSettlementDustBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>
                            <td className="p-1.5 border-r border-emerald-200 bg-emerald-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isSettlementNcvBlocked}
                                tabIndex={isSettlementNcvBlocked ? -1 : 0}
                                title={isSettlementNcvBlocked ? "Auto-populated (Manual edit blocked)" : "Mill Settlement % NCV (Auto-pulled from Act. NCV)"}
                                value={row.settlement_ncv !== undefined && row.settlement_ncv !== null && Number(row.settlement_ncv) > 0 ? row.settlement_ncv : (row.ncv_act || row.ncv_claim || headerForm.actual_ncv || headerForm.claim_ncv || 0)}
                                onChange={(e) => !isSettlementNcvBlocked && handleDetailChange(idx, "settlement_ncv", Number(e.target.value))}
                                className={`w-full border border-emerald-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500 bg-emerald-50/70 text-emerald-950 font-black text-center ${isSettlementNcvBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>

                            {/* Ropes */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isRopesWeightBlocked}
                                tabIndex={isRopesWeightBlocked ? -1 : 0}
                                title={isRopesWeightBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.ropes_weight || 0}
                                onChange={(e) => !isRopesWeightBlocked && handleDetailChange(idx, "ropes_weight", Number(e.target.value))}
                                className={getFieldInputStyle(isRopesWeightBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isRopesTotWtGrdBlocked}
                                tabIndex={isRopesTotWtGrdBlocked ? -1 : 0}
                                title={isRopesTotWtGrdBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.ropes_tot_wt_grd || 0}
                                onChange={(e) => !isRopesTotWtGrdBlocked && handleDetailChange(idx, "ropes_tot_wt_grd", Number(e.target.value))}
                                className={getFieldInputStyle(isRopesTotWtGrdBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isRopesGradeBlocked}
                                tabIndex={isRopesGradeBlocked ? -1 : 0}
                                title={isRopesGradeBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.ropes_grade || ""}
                                onChange={(e) => !isRopesGradeBlocked && handleDetailChange(idx, "ropes_grade", e.target.value)}
                                className={getFieldInputStyle(isRopesGradeBlocked)}
                              />
                            </td>

                            {/* Chotta & Habi Jabi */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isChottaWeightBlocked}
                                tabIndex={isChottaWeightBlocked ? -1 : 0}
                                title={isChottaWeightBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.chotta_weight || 0}
                                onChange={(e) => !isChottaWeightBlocked && handleDetailChange(idx, "chotta_weight", Number(e.target.value))}
                                className={getFieldInputStyle(isChottaWeightBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isChottaTotWtGrdBlocked}
                                tabIndex={isChottaTotWtGrdBlocked ? -1 : 0}
                                title={isChottaTotWtGrdBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.chotta_tot_wt_grd || 0}
                                onChange={(e) => !isChottaTotWtGrdBlocked && handleDetailChange(idx, "chotta_tot_wt_grd", Number(e.target.value))}
                                className={getFieldInputStyle(isChottaTotWtGrdBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isChottaGradeBlocked}
                                tabIndex={isChottaGradeBlocked ? -1 : 0}
                                title={isChottaGradeBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.chotta_grade || ""}
                                onChange={(e) => !isChottaGradeBlocked && handleDetailChange(idx, "chotta_grade", e.target.value)}
                                className={getFieldInputStyle(isChottaGradeBlocked)}
                              />
                            </td>

                            {/* Tolerable */}
                            <td className="p-1.5 border-r border-slate-200">
                              <select
                                value={row.tolerable || "Yes"}
                                onChange={(e) => handleDetailChange(idx, "tolerable", e.target.value)}
                                className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white font-medium focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </td>

                            {/* Premium (Manual Input / Qty in MT) */}
                            <td className="p-1.5 border-r border-slate-200 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1 w-full">
                                  <input
                                    type="text"
                                    value={row.premium !== undefined && row.premium !== null ? row.premium : (row.is_premium ? "Yes" : "")}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      handleDetailChange(idx, "premium", val);
                                      if (val.trim() !== "" && val.toLowerCase() !== "no") {
                                        handleDetailChange(idx, "is_premium", true);
                                      } else {
                                        handleDetailChange(idx, "is_premium", false);
                                      }
                                    }}
                                    placeholder={`e.g. 1.000 (Max ${calculateQtyInMt(row).toFixed(3)})`}
                                    className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-amber-50/40 font-bold text-amber-950 text-center"
                                    title="Enter numeric MT premium value or Yes (defaults to max available)"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const maxMt = calculateQtyInMt(row).toFixed(3);
                                      const currentPrem = getPremiumMt(row);
                                      const isFull = currentPrem >= Number(maxMt);
                                      if (isFull) {
                                        handleDetailChange(idx, "premium", "");
                                        handleDetailChange(idx, "is_premium", false);
                                      } else {
                                        handleDetailChange(idx, "premium", maxMt);
                                        handleDetailChange(idx, "is_premium", true);
                                        handleDetailChange(idx, "unit", "M.T.");
                                      }
                                    }}
                                    className={`p-1 rounded text-xs transition-all cursor-pointer shrink-0 ${
                                      getPremiumMt(row) > 0
                                        ? "bg-amber-400 text-slate-950 font-bold shadow-sm"
                                        : "bg-slate-100 hover:bg-amber-100 text-slate-600"
                                    }`}
                                    title="Click to fill Max Available MT Premium"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {getPremiumMt(row) > 0 && (
                                  <span className="text-[10px] font-mono font-black text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shadow-inner whitespace-nowrap flex items-center gap-1">
                                    <span>{getPremiumMt(row).toFixed(3)} MT</span>
                                    <span className="text-[8px] text-slate-500 font-normal">/ {calculateQtyInMt(row).toFixed(3)} max</span>
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Amount (₹) */}
                            <td className="p-1.5 border-r border-slate-200 text-center min-w-[125px]">
                              <div className="flex flex-col items-center gap-1">
                                <div className="relative w-full">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={row.amount !== undefined && row.amount !== null ? row.amount : (calculateRowAmount(row) > 0 ? calculateRowAmount(row) : "")}
                                    onChange={(e) => handleDetailChange(idx, "amount", parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full border border-slate-300 rounded pl-5 pr-2 py-1 text-xs bg-amber-50/20 font-mono font-bold text-slate-900 text-right focus:ring-1 focus:ring-blue-500"
                                    title="Amount in ₹"
                                  />
                                </div>
                                {calculateRowAmount(row) > 0 && (!row.amount || Number(row.amount) === calculateRowAmount(row)) && (
                                  <span className="text-[9px] font-mono text-emerald-700 font-bold">
                                    ₹{calculateRowAmount(row).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Remarks */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                value={row.row_remarks || ""}
                                onChange={(e) => handleDetailChange(idx, "row_remarks", e.target.value)}
                                className="w-full border border-slate-300 rounded px-2 py-1 text-xs bg-white"
                                placeholder="Row remarks..."
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                value={row.jqi_remarks || ""}
                                onChange={(e) => handleDetailChange(idx, "jqi_remarks", e.target.value)}
                                className="w-full border border-slate-300 rounded px-2 py-1 text-xs bg-white"
                                placeholder="JCI remarks..."
                              />
                            </td>

                            {/* Row Actions Sticky Cell */}
                            <td className="p-2 sticky right-0 bg-white z-10 text-center border-l border-slate-200">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleToggleExpand(idx)}
                                  className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 ${
                                    row.expanded ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-blue-600 text-white hover:bg-blue-700"
                                  }`}
                                >
                                  {row.expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  <span>{row.expanded ? "Collapse" : "Expand"}</span>
                                </button>
                                <button
                                  onClick={() => handleDuplicateRow(idx)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-bold"
                                  title="Duplicate Row"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRow(idx)}
                                  className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-[11px] font-bold"
                                  title="Delete Row"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* EXPANDED ROW PANEL */}
                          {row.expanded && (
                            <tr className="bg-slate-50 border-b-2 border-blue-200">
                              <td colSpan={48} className="p-4">
                                <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-inner">
                                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                                    <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                                      <Layers className="w-4 h-4 text-blue-600" />
                                      Expanded Inspection Detail View for Row #{idx + 1}
                                      {row.is_auto && (
                                        <span className="ml-2 inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-blue-200">
                                          <Lock className="w-2.5 h-2.5" /> Auto-populated data locked
                                        </span>
                                      )}
                                    </span>
                                    <button
                                      onClick={() => handleToggleExpand(idx)}
                                      className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                                    >
                                      Close Panel ✕
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    {detailFieldsConfig.map(cfg => {
                                      const isBlocked = isAutoBlocked(row, cfg.name);
                                      return (
                                        <div key={cfg.name} className="flex flex-col gap-1">
                                          <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-extrabold text-slate-600">{cfg.label}</label>
                                            {isBlocked && (
                                              <span className="text-[10px] text-blue-700 flex items-center gap-0.5 font-bold">
                                                <Lock className="w-2.5 h-2.5" /> Locked
                                              </span>
                                            )}
                                          </div>
                                          {cfg.type === "select" ? (
                                            <select
                                              disabled={isBlocked}
                                              value={(row[cfg.name] as string) || "Yes"}
                                              onChange={(e) => !isBlocked && handleDetailChange(idx, cfg.name, e.target.value)}
                                              className={isBlocked ? "border border-blue-300 bg-blue-50/90 text-blue-950 font-bold rounded px-2.5 py-1.5 text-xs cursor-not-allowed" : "border border-slate-300 rounded px-2.5 py-1.5 bg-white font-medium text-slate-900"}
                                            >
                                              <option value="Yes">Yes</option>
                                              <option value="No">No</option>
                                            </select>
                                          ) : (
                                            <input
                                              type={cfg.type}
                                              step={cfg.type === "number" ? "0.01" : undefined}
                                              readOnly={isBlocked}
                                              tabIndex={isBlocked ? -1 : 0}
                                              value={(row[cfg.name] as any) ?? ""}
                                              onChange={(e) =>
                                                !isBlocked && handleDetailChange(
                                                  idx,
                                                  cfg.name,
                                                  cfg.type === "number" ? Number(e.target.value) : e.target.value
                                                )
                                              }
                                              className={getFieldInputStyle(isBlocked, "px-2.5 py-1.5")}
                                            />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* FOOTER BAR */}
              <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  Tip: Use <b className="text-blue-700">Expand</b> to edit/view the complete row without losing the wide-table structure. <b className="text-rose-700">Delete</b> removes only that inspection row.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddRow}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>＋ Add New Inspection Row</span>
                  </button>
                  <button
                    onClick={handleSaveForm}
                    className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1.5 shadow-md"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Inspection</span>
                  </button>
                </div>
              </div>
            </section>

          </div>
        )}

      </div>
    </LegacyLayout>
  );
}
