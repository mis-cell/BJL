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
  Sparkles
} from "lucide-react";
import { supabase } from "../lib/supabase";
import LegacyLayout from "../components/LegacyLayout";

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
  marks?: string;
  crop_year?: string;
  lot?: string;
  quantity?: number;
  unit?: string;
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
  row_remarks?: string;
  jqi_remarks?: string;
  expanded?: boolean;
}

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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

      // 2. Fetch Final Arrival records (Data coming from Final Arrival)
      let faList: any[] = [];
      if (supabase) {
        try {
          const { data: faData } = await supabase
            .from("final_arrival")
            .select("*")
            .order("created_at", { ascending: false });
          if (faData && faData.length > 0) {
            faList = faData;
          }
        } catch (e) {
          console.error("Error fetching final_arrival:", e);
        }
      }

      // Local storage fallbacks for Final Arrival & Amad Register
      try {
        const cachedFa = localStorage.getItem("final_arrival_vouchers");
        if (cachedFa) {
          const parsed = JSON.parse(cachedFa);
          parsed.forEach((item: any) => {
            if (!faList.some(f => (f.final_arrival_no && f.final_arrival_no === item.final_arrival_no) || (f.final_arrival_id && f.final_arrival_id === item.final_arrival_id))) {
              faList.push(item);
            }
          });
        }
      } catch (e) {}

      try {
        const cachedAmad = localStorage.getItem("amad_records");
        if (cachedAmad) {
          const parsed = JSON.parse(cachedAmad);
          parsed.forEach((item: any) => {
            if (!faList.some(f => (f.mr_no && f.mr_no === item.amad_no) || (f.final_arrival_no && f.final_arrival_no === item.temporary_arrival_no))) {
              faList.push({
                mr_no: item.amad_no,
                final_arrival_no: item.temporary_arrival_no || item.amad_no,
                date: item.date,
                po_no: item.po_no,
                po_date: item.po_date || item.date,
                supplier: item.supplier,
                broker: item.broker,
                lorry_number: item.lorry_no,
                arrival_area_name: item.arrival_area_name || item.arrival_area || item.area_name || item.area,
                grid_details: item.grid_details || item.details || item.items
              });
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
  }, []);

  useLiveAutoRefresh(fetchInspectionRecords, [], { tables: ['material_inspection', 'material_inspection_details', 'final_arrival'] });

  const populateFromFinalArrival = (fa: any) => {
    const displayMrNo = (fa.mr_no && fa.mr_no !== "DIRECT REGISTER" && fa.mr_no.trim() !== "")
      ? fa.mr_no
      : (fa.final_arrival_no || `FA-${fa.final_arrival_id || Math.floor(1000 + Math.random() * 9000)}`);

    setHeaderForm(prev => ({
      ...prev,
      mr_no: displayMrNo,
      mr_date: fa.date || prev.mr_date || new Date().toISOString().split("T")[0],
      arrival_no: fa.final_arrival_no || fa.arrival_no || prev.arrival_no,
      arrival_date: fa.date || prev.arrival_date || new Date().toISOString().split("T")[0],
      unloading_date: fa.unloading_date || fa.date || prev.unloading_date || new Date().toISOString().split("T")[0],
      po_no: fa.po_no || fa.mr_no || prev.po_no,
      po_date: fa.po_date || fa.date || prev.po_date,
      mill_po_no: fa.mr_no || fa.po_no || fa.mill_po_no || fa.arrival_no || displayMrNo || prev.mill_po_no || "",
      mill_po_date: fa.date || fa.po_date || fa.arrival_date || prev.mill_po_date || new Date().toISOString().split("T")[0],
      broker_name: fa.broker || prev.broker_name,
      supplier_name: fa.supplier || fa.challan_supplier || prev.supplier_name,
      lorry_number: fa.lorry_number || prev.lorry_number,
      actual_moisture: Number(fa.actual_moisture) || prev.actual_moisture || 0,
      actual_dust: Number(fa.actual_dust) || prev.actual_dust || 0,
      actual_ncv: Number(fa.actual_ncv) || prev.actual_ncv || 0,
      claim_moisture: Number(fa.claim_moisture) || prev.claim_moisture || 0,
      claim_dust: Number(fa.claim_dust) || prev.claim_dust || 0,
      claim_ncv: Number(fa.claim_ncv) || prev.claim_ncv || 0,
      remarks: fa.remarks || prev.remarks
    }));

    const rawGrid = fa.grid_details || fa.details || fa.items;
    const voucherArea = (fa.arrival_area_name || fa.arrival_area || fa.area_name || fa.area || "").toUpperCase();

    if (Array.isArray(rawGrid) && rawGrid.length > 0) {
      const details: InspectionDetailRow[] = rawGrid.map((item: any, i: number) => ({
        srl_no: i + 1,
        arrival_grade: item.challan_grade_name || item.receipt_grade_name || item.grade || "",
        stock_grade_code: item.receipt_grade_code || item.stock_grade_code || "",
        stock_grade_name: item.receipt_grade_name || item.stock_grade_name || item.grade || "",
        area: (item.area_name || item.area || item.arrival_area_name || item.arrival_area || voucherArea || "").toUpperCase(),
        agency: item.agency_name || item.agency || "",
        marks: item.challan_marka_name || item.marka || item.marks || "",
        crop_year: item.crop_year || "",
        quantity: Number(item.quantity_rcpt || item.quantity_chln || item.quantity || item.bales) || 0,
        unit: item.unit || "BALES",
        challan_gross_wt: Number(item.challan_gross_wt || item.gross_weight || item.weight) || 0,
        receipt_gross_wt: Number(item.receipt_gross_wt || item.gross_weight || item.weight) || 0,
        tolerable: "Yes",
        expanded: false
      }));
      setDetailRows(details);
    } else if (voucherArea) {
      setDetailRows(prev => prev.map(r => ({ ...r, area: r.area || voucherArea })));
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
      status: "Completed"
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
    setViewMode("form");
  };

  const handleEditRecord = async (rec: InspectionMasterRecord) => {
    setHeaderForm(rec);
    setDetailRows([]);
    setViewMode("form");

    let loadedDetails: InspectionDetailRow[] = [];

    if (supabase) {
      const { data } = await supabase
        .from("material_inspection_details")
        .select("*")
        .eq("mr_no", rec.mr_no)
        .order("srl_no", { ascending: true });

      if (data && data.length > 0) {
        loadedDetails = data.map(d => ({ ...d, expanded: false }));
      } else {
        const { data: fallback } = await supabase
          .from("inspection_details")
          .select("*")
          .eq("mr_no", rec.mr_no);
        if (fallback && fallback.length > 0) {
          loadedDetails = fallback.map(d => ({ ...d, expanded: false }));
        }
      }
    }

    if (loadedDetails.length === 0) {
      // Build detail rows from grid_details if available (from Final Arrival)
      const rawGrid = rec.grid_details;
      if (Array.isArray(rawGrid) && rawGrid.length > 0) {
        loadedDetails = rawGrid.map((item: any, i: number) => ({
          srl_no: i + 1,
          arrival_grade: item.challan_grade_name || item.receipt_grade_name || item.grade || "",
          stock_grade_code: item.receipt_grade_code || item.stock_grade_code || "",
          stock_grade_name: item.receipt_grade_name || item.stock_grade_name || item.grade || "",
          area: item.area_name || item.area || "",
          agency: item.agency_name || item.agency || "",
          marks: item.challan_marka_name || item.marka || item.marks || "",
          crop_year: item.crop_year || "",
          quantity: Number(item.quantity_rcpt || item.quantity_chln || item.quantity || item.bales) || 0,
          unit: item.unit || "BALES",
          challan_gross_wt: Number(item.challan_gross_wt || item.gross_weight || item.weight) || 0,
          receipt_gross_wt: Number(item.receipt_gross_wt || item.gross_weight || item.weight) || 0,
          tolerable: "Yes",
          expanded: false
        }));
      }
    }

    if (loadedDetails.length === 0) {
      loadedDetails = [{ unit: "BALES", quantity: 0, tolerable: "Yes", expanded: false }];
    }

    setDetailRows(loadedDetails);
  };

  const handleHeaderChange = (field: keyof InspectionMasterRecord, value: any) => {
    setHeaderForm(prev => ({ ...prev, [field]: value }));
  };

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
        currentRow.lorry_read_avg = avg;
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
        currentRow.insp_read_avg = avg;
        if (avg > 0) {
          currentRow.moisture_act = avg;
        }
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
        actual_moisture: avgActMoisture || prev.actual_moisture || 0,
        claim_moisture: avgClaimMoisture || prev.claim_moisture || 0,
        actual_dust: avgActDust || prev.actual_dust || 0,
        claim_dust: avgClaimDust || prev.claim_dust || 0,
        actual_ncv: avgActNcv || prev.actual_ncv || 0,
        claim_ncv: avgClaimNcv || prev.claim_ncv || 0,
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
      const payload: InspectionMasterRecord = {
        ...headerForm,
        status: headerForm.status || "Completed",
        created_at: headerForm.created_at || new Date().toISOString()
      };

      if (supabase) {
        await supabase.from("material_inspection").upsert([payload]);
        await supabase.from("inspection_master").upsert([payload]).then(() => {}, () => {});
        
        // Clean out old detail rows
        await supabase.from("material_inspection_details").delete().eq("mr_no", headerForm.mr_no);
        await supabase.from("inspection_details").delete().eq("mr_no", headerForm.mr_no).then(() => {}, () => {});

        // Prepare detail rows
        const validDetails = detailRows.map((row, idx) => ({
          mr_no: headerForm.mr_no,
          srl_no: idx + 1,
          arrival_grade: row.arrival_grade || "",
          stock_grade_code: row.stock_grade_code || "",
          stock_grade_name: row.stock_grade_name || "",
          area: row.area || "",
          agency: row.agency || "",
          marks: row.marks || "",
          marka: row.marks || "",
          crop_year: row.crop_year || "",
          lot: row.lot || "",
          quantity: Number(row.quantity) || 0,
          unit: row.unit || "BALES",
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
          moisture_act: Number(row.moisture_act) || 0,
          moisture_claim: Number(row.moisture_claim) || 0,
          dust_act: Number(row.dust_act) || 0,
          dust_claim: Number(row.dust_claim) || 0,
          ncv_act: Number(row.ncv_act) || 0,
          ncv_claim: Number(row.ncv_claim) || 0,
          grade_down_act: Number(row.grade_down_act) || 0,
          grade_down_claim: Number(row.grade_down_claim) || 0,
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
          row_remarks: row.row_remarks || "",
          jqi_remarks: row.jqi_remarks || "",
          jci_remarks: row.jqi_remarks || ""
        }));

        if (validDetails.length > 0) {
          await supabase.from("material_inspection_details").insert(validDetails);
          await supabase.from("inspection_details").insert(validDetails).then(() => {}, () => {});
        }
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
    if (!confirm(`Are you sure you want to delete inspection record ${mr_no}?`)) return;
    try {
      if (supabase) {
        await supabase.from("material_inspection_details").delete().eq("mr_no", mr_no);
        await supabase.from("inspection_details").delete().eq("mr_no", mr_no).then(() => {}, () => {});
        await supabase.from("material_inspection").delete().eq("mr_no", mr_no);
        await supabase.from("inspection_master").delete().eq("mr_no", mr_no).then(() => {}, () => {});
      }
      setRecords(prev => prev.filter(r => r.mr_no !== mr_no));
      try {
        const cached = localStorage.getItem("material_inspection_records") || localStorage.getItem("inspection_master_records");
        if (cached) {
          const list = JSON.parse(cached).filter((r: any) => r.mr_no !== mr_no);
          localStorage.setItem("material_inspection_records", JSON.stringify(list));
          localStorage.setItem("inspection_master_records", JSON.stringify(list));
        }
      } catch (e) {}
      showToast(`Record ${mr_no} deleted.`);
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
                <button
                  onClick={() => setViewMode("dashboard")}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Register</span>
                </button>
                <button
                  onClick={handleSaveForm}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Inspection</span>
                </button>
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
                        <tr key={rec.mr_no} className="hover:bg-emerald-50/50 transition-colors">
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
                            <div className="flex items-center justify-center gap-1.5">
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
                  const faNo = String(fa.final_arrival_no || fa.mr_no || "").trim().toLowerCase();
                  const faMrNo = String(fa.mr_no || fa.final_arrival_no || "").trim().toLowerCase();
                  const faId = String(fa.final_arrival_id || "").trim().toLowerCase();

                  if (!faNo && !faMrNo && !faId) return true;

                  return !records.some(r => {
                    const rMr = String(r.mr_no || "").trim().toLowerCase();
                    const rArr = String(r.arrival_no || "").trim().toLowerCase();
                    return (
                      (faNo && (rMr === faNo || rArr === faNo)) ||
                      (faMrNo && (rMr === faMrNo || rArr === faMrNo)) ||
                      (faId && (rMr === faId || rArr === faId))
                    );
                  });
                });

                return (
                  <div className="bg-emerald-50/80 px-5 py-3 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-700" />
                      <span className="text-xs font-bold text-emerald-950">
                        Import / Pick From Final Arrival ({pendingArrivalList.length} Pending):
                      </span>
                    </div>
                    <select
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const selectedFa = finalArrivalList.find(f => 
                          (f.final_arrival_id && String(f.final_arrival_id) === e.target.value) ||
                          (f.final_arrival_no && String(f.final_arrival_no) === e.target.value) ||
                          (f.mr_no && String(f.mr_no) === e.target.value)
                        );
                        if (selectedFa) populateFromFinalArrival(selectedFa);
                      }}
                      defaultValue=""
                      className="bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-md"
                    >
                      <option value="">
                        {pendingArrivalList.length > 0 ? "-- Select Final Arrival Record --" : "-- All Final Arrivals Inspected --"}
                      </option>
                      {pendingArrivalList.map((fa, idx) => (
                        <option key={idx} value={fa.final_arrival_id || fa.final_arrival_no || fa.mr_no}>
                          Arrival #{fa.final_arrival_no || fa.mr_no || 'FA'} | Arrival No: {fa.mr_no || fa.final_arrival_no || '-'} | {fa.supplier || fa.challan_supplier || 'Supplier'} | Lorry: {fa.lorry_number || '-'}
                        </option>
                      ))}
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

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">Arrival No.</label>
                  <input
                    type="text"
                    value={headerForm.arrival_no || ""}
                    onChange={(e) => handleHeaderChange("arrival_no", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1">
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

            {/* INSPECTION DETAILS WIDE TABLE SECTION */}
            <section className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Inspection Details</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Horizontal scroll + Expand Row on every record for comprehensive quality audit details
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 text-xs font-extrabold px-3 py-1 rounded-full border border-blue-200">
                    {detailRows.length} {detailRows.length === 1 ? "Row" : "Rows"}
                  </span>
                  <button
                    onClick={handleAddRow}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Row</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[680px] border-t border-slate-200">
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
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[120px]">Add Weight M.Ton</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[120px]">Less Weight M.Ton</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px]">Reduced Weight M.Ton</th>
                      <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Lorry Moisture</th>
                      <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1e40af]">Lorry Moisture Read (%)</th>
                      <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Insp. Moisture Read (%)</th>
                      <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1e40af]">Moisture %</th>
                      <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Dust %</th>
                      <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1e40af]">NCV %</th>
                      <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Grade Down %</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[140px]">Final Receipt Wt. (Claim)</th>
                      <th colSpan={4} className="p-2 border-r border-white/20 text-center bg-[#1e40af]">Mill Settlement %</th>
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
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[140px]">Remarks</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[140px]">JCI Remarks</th>
                      <th rowSpan={2} className="p-2 text-center sticky right-0 bg-[#1e3a8a] z-20 min-w-[190px]">Row Actions</th>
                    </tr>
                    <tr className="bg-[#243b68] text-white text-[11px]">
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Code</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[120px]">Name</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Min</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Max</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Min</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Max</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Avg</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Min</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Max</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Avg</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Act.</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Claim</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Act.</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Claim</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Act.</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Claim</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Act.</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Claim</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Moisture</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Gr. Down</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Dust</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">NCV</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Weight (Kg)</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[100px]">Tot. Wt. Grd%</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Grade</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Weight (Kg)</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[100px]">Tot. Wt. Grd%</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((row, idx) => (
                      <React.Fragment key={idx}>
                        <tr className={`border-b border-slate-200 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} ${row.expanded ? "bg-blue-50/50" : ""}`}>
                          {/* Srl No */}
                          <td className="p-2 border-r border-slate-200 text-center font-extrabold text-slate-700 sticky left-0 bg-white z-10">
                            {idx + 1}
                          </td>

                          {/* Arrival Grade */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.arrival_grade || ""}
                              onChange={(e) => handleDetailChange(idx, "arrival_grade", e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                            />
                          </td>

                          {/* Stock Grade Code & Name */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.stock_grade_code || ""}
                              onChange={(e) => handleDetailChange(idx, "stock_grade_code", e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.stock_grade_name || ""}
                              onChange={(e) => handleDetailChange(idx, "stock_grade_name", e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                            />
                          </td>

                          {/* Area & Agency */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.area || ""}
                              onChange={(e) => handleDetailChange(idx, "area", e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.agency || ""}
                              onChange={(e) => handleDetailChange(idx, "agency", e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>

                          {/* Marks, Crop Year, Lot */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.marks || ""}
                              onChange={(e) => handleDetailChange(idx, "marks", e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.crop_year || ""}
                              onChange={(e) => handleDetailChange(idx, "crop_year", e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.lot || ""}
                              onChange={(e) => handleDetailChange(idx, "lot", e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>

                          {/* Quantity & Unit */}
                          <td className="p-1.5 border-r border-slate-200">
                            <div className="flex flex-col gap-0.5">
                              <input
                                type="number"
                                step="0.001"
                                value={
                                  (row.is_premium || row.premium === "Yes")
                                    ? calculateQtyInMt(row)
                                    : (row.quantity || 0)
                                }
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (row.is_premium || row.premium === "Yes") {
                                    handleDetailChange(idx, "challan_gross_wt", val);
                                    const currentUnit = (row.unit || "BALES").toUpperCase();
                                    const convertedQty = currentUnit.includes("BALE") ? Math.round(val / 0.18) : val;
                                    handleDetailChange(idx, "quantity", convertedQty);
                                  } else {
                                    handleDetailChange(idx, "quantity", val);
                                  }
                                }}
                                className={`w-full border rounded px-2 py-1 text-xs font-bold transition-all ${
                                  (row.is_premium || row.premium === "Yes")
                                    ? "border-amber-400 bg-amber-50 text-amber-950 font-black ring-1 ring-amber-300"
                                    : "border-slate-300 text-slate-900"
                                }`}
                              />
                              {(row.is_premium || row.premium === "Yes") ? (
                                <div className="flex items-center justify-between text-[9px] font-mono text-amber-900 bg-amber-100/90 px-1 py-0.5 rounded border border-amber-300 font-black">
                                  <span>⚡ MT:</span>
                                  <span>{calculateQtyInMt(row).toFixed(3)} MT</span>
                                </div>
                              ) : (
                                <span className="text-[9px] text-slate-500 font-medium">
                                  ≈ {calculateQtyInMt(row).toFixed(3)} MT
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <div className="flex flex-col gap-0.5">
                              <input
                                type="text"
                                value={
                                  (row.is_premium || row.premium === "Yes")
                                    ? "M.T."
                                    : (row.unit || "BALES")
                                }
                                onChange={(e) => handleDetailChange(idx, "unit", e.target.value)}
                                className={`w-full border rounded px-2 py-1 text-xs text-center font-bold uppercase transition-all ${
                                  (row.is_premium || row.premium === "Yes")
                                    ? "border-amber-400 bg-amber-100/80 text-amber-950 font-black"
                                    : "border-slate-300 text-slate-900"
                                }`}
                              />
                              {(row.is_premium || row.premium === "Yes") && (
                                <span className="text-[9px] font-bold text-amber-800 text-center uppercase tracking-tight">
                                  Metric Ton
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Weights */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.challan_gross_wt || 0}
                              onChange={(e) => handleDetailChange(idx, "challan_gross_wt", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.receipt_gross_wt || 0}
                              onChange={(e) => handleDetailChange(idx, "receipt_gross_wt", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.gross_weight_batch || 0}
                              onChange={(e) => handleDetailChange(idx, "gross_weight_batch", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.add_weight || 0}
                              onChange={(e) => handleDetailChange(idx, "add_weight", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.less_weight || 0}
                              onChange={(e) => handleDetailChange(idx, "less_weight", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.reduced_weight || 0}
                              onChange={(e) => handleDetailChange(idx, "reduced_weight", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                            />
                          </td>

                          {/* Lorry Moisture Min / Max */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.lorry_moisture_min || 0}
                              onChange={(e) => handleDetailChange(idx, "lorry_moisture_min", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.lorry_moisture_max || 0}
                              onChange={(e) => handleDetailChange(idx, "lorry_moisture_max", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>

                          {/* Lorry Read Min / Max / Avg */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.lorry_read_min || 0}
                              onChange={(e) => handleDetailChange(idx, "lorry_read_min", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.lorry_read_max || 0}
                              onChange={(e) => handleDetailChange(idx, "lorry_read_max", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.lorry_read_avg || 0}
                              onChange={(e) => handleDetailChange(idx, "lorry_read_avg", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-bold text-blue-700"
                            />
                          </td>

                          {/* Insp Read Min / Max / Avg */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.insp_read_min || 0}
                              onChange={(e) => handleDetailChange(idx, "insp_read_min", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.insp_read_max || 0}
                              onChange={(e) => handleDetailChange(idx, "insp_read_max", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.insp_read_avg || 0}
                              onChange={(e) => handleDetailChange(idx, "insp_read_avg", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-bold text-blue-700"
                            />
                          </td>

                          {/* Moisture Act / Claim */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.moisture_act || 0}
                              onChange={(e) => handleDetailChange(idx, "moisture_act", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-bold text-blue-800"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.moisture_claim || 0}
                              onChange={(e) => handleDetailChange(idx, "moisture_claim", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-bold text-purple-800"
                            />
                          </td>

                          {/* Dust Act / Claim */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.dust_act || 0}
                              onChange={(e) => handleDetailChange(idx, "dust_act", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-bold text-amber-800"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.dust_claim || 0}
                              onChange={(e) => handleDetailChange(idx, "dust_claim", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-bold text-purple-800"
                            />
                          </td>

                          {/* NCV Act / Claim */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.ncv_act || 0}
                              onChange={(e) => handleDetailChange(idx, "ncv_act", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-bold"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.ncv_claim || 0}
                              onChange={(e) => handleDetailChange(idx, "ncv_claim", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-bold text-purple-800"
                            />
                          </td>

                          {/* Grade Down Act / Claim */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.grade_down_act || 0}
                              onChange={(e) => handleDetailChange(idx, "grade_down_act", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.grade_down_claim || 0}
                              onChange={(e) => handleDetailChange(idx, "grade_down_claim", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>

                          {/* Final Receipt Wt */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.final_receipt_wt || 0}
                              onChange={(e) => handleDetailChange(idx, "final_receipt_wt", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold"
                            />
                          </td>

                          {/* Settlement % */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.settlement_moisture || 0}
                              onChange={(e) => handleDetailChange(idx, "settlement_moisture", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.settlement_grade_down || 0}
                              onChange={(e) => handleDetailChange(idx, "settlement_grade_down", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.settlement_dust || 0}
                              onChange={(e) => handleDetailChange(idx, "settlement_dust", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.settlement_ncv || 0}
                              onChange={(e) => handleDetailChange(idx, "settlement_ncv", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>

                          {/* Ropes */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.ropes_weight || 0}
                              onChange={(e) => handleDetailChange(idx, "ropes_weight", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.ropes_tot_wt_grd || 0}
                              onChange={(e) => handleDetailChange(idx, "ropes_tot_wt_grd", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.ropes_grade || ""}
                              onChange={(e) => handleDetailChange(idx, "ropes_grade", e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>

                          {/* Chotta & Habi Jabi */}
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.chotta_weight || 0}
                              onChange={(e) => handleDetailChange(idx, "chotta_weight", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              step="0.01"
                              value={row.chotta_tot_wt_grd || 0}
                              onChange={(e) => handleDetailChange(idx, "chotta_tot_wt_grd", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.chotta_grade || ""}
                              onChange={(e) => handleDetailChange(idx, "chotta_grade", e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>

                          {/* Tolerable */}
                          <td className="p-1.5 border-r border-slate-200">
                            <select
                              value={row.tolerable || "Yes"}
                              onChange={(e) => handleDetailChange(idx, "tolerable", e.target.value)}
                              className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white font-medium"
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
                                  placeholder="Type premium..."
                                  className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-amber-50/40 font-bold text-amber-950 text-center"
                                  title="Enter premium manually or type Yes"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const isCurrentlyPremium = row.is_premium || row.premium === "Yes";
                                    const nextVal = !isCurrentlyPremium;
                                    handleDetailChange(idx, "is_premium", nextVal);
                                    handleDetailChange(idx, "premium", nextVal ? "Yes" : "No");
                                    if (nextVal) {
                                      handleDetailChange(idx, "unit", "M.T.");
                                    }
                                  }}
                                  className={`p-1 rounded text-xs transition-all cursor-pointer shrink-0 ${
                                    row.is_premium || row.premium === "Yes"
                                      ? "bg-amber-400 text-slate-950 font-bold shadow-sm"
                                      : "bg-slate-100 hover:bg-amber-100 text-slate-600"
                                  }`}
                                  title="Toggle Premium status / MT mode"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {(row.is_premium || row.premium === "Yes" || (row.premium && row.premium.toString().toLowerCase() !== "no" && row.premium.toString().trim() !== "")) && (
                                <span className="text-[10px] font-mono font-black text-amber-900 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded shadow-inner whitespace-nowrap">
                                  {calculateQtyInMt(row).toFixed(3)} MT
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
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.jqi_remarks || ""}
                              onChange={(e) => handleDetailChange(idx, "jqi_remarks", e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
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
                                  </span>
                                  <button
                                    onClick={() => handleToggleExpand(idx)}
                                    className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                                  >
                                    Close Panel ✕
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  {detailFieldsConfig.map(cfg => (
                                    <div key={cfg.name} className="flex flex-col gap-1">
                                      <label className="text-[11px] font-extrabold text-slate-600">{cfg.label}</label>
                                      {cfg.type === "select" ? (
                                        <select
                                          value={(row[cfg.name] as string) || "Yes"}
                                          onChange={(e) => handleDetailChange(idx, cfg.name, e.target.value)}
                                          className="border border-slate-300 rounded px-2.5 py-1.5 bg-white font-medium text-slate-900"
                                        >
                                          <option value="Yes">Yes</option>
                                          <option value="No">No</option>
                                        </select>
                                      ) : (
                                        <input
                                          type={cfg.type}
                                          step={cfg.type === "number" ? "0.01" : undefined}
                                          value={(row[cfg.name] as any) ?? ""}
                                          onChange={(e) =>
                                            handleDetailChange(
                                              idx,
                                              cfg.name,
                                              cfg.type === "number" ? Number(e.target.value) : e.target.value
                                            )
                                          }
                                          className="border border-slate-300 rounded px-2.5 py-1.5 bg-white font-medium text-slate-900 focus:outline-none focus:border-blue-500"
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
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
