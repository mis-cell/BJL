import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLiveAutoRefresh } from "../hooks/useLiveAutoRefresh";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { dbModule } from "../services/dbModule";
import LegacyLayout from "../components/LegacyLayout";
import PrintModal from "../components/PrintModal";
import InspectionPrintSlip from "../components/InspectionPrintSlip";
import { InspectionActionBar } from "../components/inspection/InspectionActionBar";
import { InspectionHeaderCard } from "../components/inspection/InspectionHeaderCard";
import { InspectionDeductionsTable } from "../components/inspection/InspectionDeductionsTable";
import { InspectionDetailsTable } from "../components/inspection/InspectionDetailsTable";
import { InspectionRegisterView } from "../components/inspection/InspectionRegisterView";
import {
  DeductionRow,
  MatchedAutoDeduction,
  MoistureLogicRule,
  InspectionMasterRecord,
  InspectionDetailRow,
  DetailFieldConfig,
  detailFieldsConfig,
  InspectionProps,
} from "../types/inspection.types";
import {
  DEFAULT_DEDUCTION_TYPES,
  calculateBaleWeightDeduction,
  calculateAllMatchingDeductions,
  computeDetailRowWeights,
  calculateQtyInMt,
  calculateRowAmount,
  extractMonthFromDate,
  sanitizeDate,
  calculateClaimMoisture,
  isAutoBlocked,
  getFieldInputStyle,
} from "../utils/inspectionCalculations";

export type {
  DeductionRow,
  MatchedAutoDeduction,
  MoistureLogicRule,
  InspectionMasterRecord,
  InspectionDetailRow,
  DetailFieldConfig,
  InspectionProps,
};
export {
  DEFAULT_DEDUCTION_TYPES,
  calculateBaleWeightDeduction,
  calculateAllMatchingDeductions,
  computeDetailRowWeights,
  calculateQtyInMt,
  calculateRowAmount,
  extractMonthFromDate,
  sanitizeDate,
  calculateClaimMoisture,
  isAutoBlocked,
  getFieldInputStyle,
};

export default function Inspection({ onNavigate }: InspectionProps) {
  const [records, setRecords] = useState<InspectionMasterRecord[]>([]);
  const [finalArrivalList, setFinalArrivalList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const isFetchingRecordsRef = React.useRef<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"dashboard" | "form">("dashboard");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sorting state for arrival date, arrival no, status
  const [sortField, setSortField] = useState<"arrival_date" | "arrival_no" | "status">("arrival_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Print modal state
  const [copyType, setCopyType] = useState<string | null>('1');
  const [printingRecord, setPrintingRecord] = useState<InspectionMasterRecord | null>(null);
  const [printingDetails, setPrintingDetails] = useState<any[]>([]);

  // Pagination (100 rows per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

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
    { id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }
  ]);
  const [deductionMasterList, setDeductionMasterList] = useState<any[]>(DEFAULT_DEDUCTION_TYPES);
  const [moistureLogicRules, setMoistureLogicRules] = useState<any[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const syncHeaderDeductions = (rows: DeductionRow[]) => {
    const activeRows = rows.filter(r => (r.deduction_type && r.deduction_type.trim() !== "") || r.deduction_amount > 0 || r.deduction_rate > 0);
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

  // Helper to identify automated deduction rules
  const isAutoDeductionRule = (name: string) => {
    const n = String(name || "").trim().toUpperCase();
    return (
      ((n.includes("BALE") || n.includes("BALES")) && (n.includes("LESS THAN") || n.includes("WEIGHT") || n.includes("<"))) ||
      n.includes("DELIVERY CLAIM") || n.includes("PER DAY")
    );
  };

  // Helper to test specifically if a deduction rule is an automated bale weight rule
  const isBaleWeightDeductionRule = (name: string) => {
    const n = String(name || "").trim().toUpperCase();
    return (n.includes("BALE") || n.includes("BALES")) && (n.includes("LESS THAN") || n.includes("WEIGHT") || n.includes("<"));
  };

  // Comprehensive auto-sync of all deduction policies from deduction_master without erasing saved/user-entered rows
  const applyAllAutoDeductions = (
    details: InspectionDetailRow[],
    hForm: Partial<InspectionMasterRecord>,
    dMaster: any[]
  ) => {
    const { matchedDeductions } = calculateAllMatchingDeductions(details, hForm, dMaster);

    setDeductionRows(prevRows => {
      let nextRows = [...prevRows];

      // Keep track of which matched policies have been applied
      const matchedApplied = new Set<string>();

      // Update existing rows or prepare new rows for each matched auto policy
      matchedDeductions.forEach(matched => {
        const existingIdx = nextRows.findIndex(
          r => r.deduction_type === matched.ruleName || (matched.category === "bale_weight" && isBaleWeightDeductionRule(r.deduction_type || ""))
        );

        matchedApplied.add(matched.ruleName);

        if (existingIdx >= 0) {
          const cur = nextRows[existingIdx];
          nextRows[existingIdx] = {
            ...cur,
            deduction_type: matched.ruleName,
            deduction_rate: matched.rate,
            deduction_qty: matched.qty,
            deduction_amount: matched.amount
          };
        } else {
          // If first row is empty / placeholder
          const isFirstRowEmpty =
            nextRows.length === 1 &&
            (!nextRows[0].deduction_type ||
              nextRows[0].deduction_type.trim() === "" ||
              nextRows[0].deduction_type.includes("-- SELECT"));

          if (isFirstRowEmpty) {
            nextRows = [
              {
                id: nextRows[0].id || "1",
                deduction_type: matched.ruleName,
                deduction_rate: matched.rate,
                deduction_qty: matched.qty,
                deduction_amount: matched.amount
              }
            ];
          } else {
            // Append as a new deduction row
            nextRows.push({
              id: String(Date.now() + Math.random()),
              deduction_type: matched.ruleName,
              deduction_rate: matched.rate,
              deduction_qty: matched.qty,
              deduction_amount: matched.amount
            });
          }
        }
      });

      if (nextRows.length === 0) {
        nextRows = [{ id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }];
      }

      // Check if rows actually changed to avoid unnecessary renders
      const isSame =
        prevRows.length === nextRows.length &&
        prevRows.every(
          (r, i) =>
            r.deduction_type === nextRows[i].deduction_type &&
            Number(r.deduction_rate) === Number(nextRows[i].deduction_rate) &&
            Number(r.deduction_qty) === Number(nextRows[i].deduction_qty) &&
            Number(r.deduction_amount) === Number(nextRows[i].deduction_amount)
        );

      if (isSame) {
        return prevRows;
      }

      syncHeaderDeductions(nextRows);
      return nextRows;
    });
  };

  // Re-run auto policy evaluation whenever detailRows, header claim fields, remarks, or deduction master changes
  useEffect(() => {
    if (detailRows && detailRows.length > 0) {
      applyAllAutoDeductions(detailRows, headerForm, deductionMasterList);
    }
  }, [
    detailRows,
    headerForm.detention_days,
    headerForm.delivery_claim,
    headerForm.remarks,
    headerForm.mr_spcl_print,
    deductionMasterList
  ]);

  const handleDeductionTypeChange = (idx: number, selectedName: string) => {
    const found = deductionMasterList.find(d => d.deduction === selectedName);
    let rate = found ? (found.rate_per_unit != null ? Number(found.rate_per_unit) : (found.rate_per_qntl != null ? Number(found.rate_per_qntl) : 0)) : 0;

    const autoCalc = calculateBaleWeightDeduction(detailRows, deductionMasterList);
    const isBaleRule = isBaleWeightDeductionRule(selectedName);

    const totalGrossMt = (detailRows || []).reduce((sum, r) => {
      const wt = Number(r.receipt_gross_wt) > 0 
        ? Number(r.receipt_gross_wt) 
        : (Number(r.gross_weight_batch) > 0 ? Number(r.gross_weight_batch) : Number(r.challan_gross_wt) || 0);
      return sum + wt;
    }, 0);
    const totalItemQty = (detailRows || []).reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

    let defaultQty = 0;
    if (isBaleRule && autoCalc.totalBales > 0) {
      defaultQty = autoCalc.totalBales;
    } else if (found && found.rate_per_qntl != null && totalGrossMt > 0) {
      defaultQty = Number((totalGrossMt * 10).toFixed(2));
    } else if (selectedName.includes("DELIVERY CLAIM")) {
      const days = Number(headerForm?.detention_days) > 0 ? Number(headerForm?.detention_days) : 1;
      rate = Number((rate * days).toFixed(2));
      defaultQty = totalGrossMt > 0 ? Number((totalGrossMt * 10).toFixed(2)) : 1;
    } else if (totalItemQty > 0) {
      defaultQty = totalItemQty;
    }
    
    setDeductionRows(prev => {
      const updated = [...prev];
      const current = { ...(updated[idx] || { id: String(Date.now()), deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }) };
      current.deduction_type = selectedName;
      current.deduction_rate = rate;
      current.deduction_qty = defaultQty;
      current.deduction_amount = Number((rate * defaultQty).toFixed(2));
      updated[idx] = current;
      syncHeaderDeductions(updated);
      return updated;
    });
  };

  const handleDeductionChange = (idx: number, field: "deduction_rate" | "deduction_qty" | "deduction_amount", value: number) => {
    setDeductionRows(prev => {
      const updated = [...prev];
      const current = { ...(updated[idx] || { id: String(Date.now()), deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }) };
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
        { id: String(Date.now() + Math.random()), deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }
      ];
      syncHeaderDeductions(updated);
      return updated;
    });
    showToast("Added new deduction entry row.");
  };

  const handleRemoveDeductionRow = (idx: number) => {
    setDeductionRows(prev => {
      if (prev.length <= 1) {
        const reset = [{ id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }];
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
    if (isFetchingRecordsRef.current) return;
    isFetchingRecordsRef.current = true;
    setLoading(true);
    try {
      let inspectionList: InspectionMasterRecord[] = [];
      let faList: any[] = [];
      const dbDeductionsMap = new Map<string, DeductionRow[]>();

      if (supabase) {
        try {
          const withTimeout = (promise: Promise<any>, ms: number = 12000) => {
            return Promise.race([
              promise,
              new Promise(resolve => setTimeout(() => resolve({ data: null, error: 'timeout' }), ms))
            ]);
          };

          const miCols = "mr_no, mr_date, date, arrival_no, arrival_date, po_no, po_date, supplier_name, broker_name, lorry_number, actual_moisture, claim_moisture, actual_dust, claim_dust, actual_ncv, claim_ncv, detention_days, unloading_date, mill_po_no, mill_po_date, remarks, deduction_type, deduction_rate, deduction_qty, deduction_amount, status, created_at, updated_at, deductions, deduction_rows, deduction_types, arrival_area, arrival_area_name, arrival_area_code, unit, unit_name, agency, area, marka, marks, rate, amount, quantity, gross_weight, net_weight, actual_grade_down, claim_grade_down, final_receipt_wt, arrival_grade, stock_grade_code, stock_grade_name";

          const faCols = "final_arrival_no, arrival_no, mr_no, final_arrival_id, temporary_arrival_no, lorry_number, po_no, po_date, date, supplier, challan_supplier, broker, status, created_at, arrival_date, unit_name, unit_code, arrival_area_name, arrival_area_code, total_packets, weight_qtl, actual_gross_weight, actual_tare_weight, electronic_net_weight, grid_details";

          const [miRes, mimRes, faRes, dedPrimaryRes, dedFallbackRes, dMasterRes, moistRes] = await Promise.all([
            withTimeout(Promise.resolve(supabase.from("material_inspection").select(miCols).order("created_at", { ascending: false }))),
            withTimeout(Promise.resolve(supabase.from("mill_inspection_master").select("*").order("created_at", { ascending: false }))).catch(() => ({ data: null })),
            withTimeout(Promise.resolve(supabase.from("final_arrival").select(faCols).order("created_at", { ascending: false }))),
            withTimeout(Promise.resolve(supabase.from("material_inspection_deductions").select("*").order("created_at", { ascending: true }))).catch(() => ({ data: null })),
            withTimeout(Promise.resolve(supabase.from("mill_inspection_deduction").select("*").order("created_at", { ascending: true }))).catch(() => ({ data: null })),
            withTimeout(Promise.resolve(supabase.from("deduction_master").select("*"))).catch(() => ({ data: null })),
            withTimeout(Promise.resolve(supabase.from("moisture_logic").select("*"))).catch(() => ({ data: null }))
          ]);

          if (miRes.data && Array.isArray(miRes.data)) {
            inspectionList = [...miRes.data];
          }
          if (mimRes?.data && Array.isArray(mimRes.data)) {
            const existingKeys = new Set(inspectionList.map(r => (r.mr_no || r.arrival_no || "").trim().toUpperCase()).filter(Boolean));
            mimRes.data.forEach((r: any) => {
              const k = (r.mr_no || r.arrival_no || "").trim().toUpperCase();
              if (k && !existingKeys.has(k)) {
                inspectionList.push(r);
                existingKeys.add(k);
              }
            });
          }
          if (faRes.data && Array.isArray(faRes.data)) {
            faList = faRes.data;
          }
          if (dMasterRes && dMasterRes.data && Array.isArray(dMasterRes.data) && dMasterRes.data.length > 0) {
            setDeductionMasterList(dMasterRes.data);
          }
          if (moistRes && moistRes.data && Array.isArray(moistRes.data) && moistRes.data.length > 0) {
            setMoistureLogicRules(moistRes.data);
          }

          const dedData = (dedPrimaryRes && dedPrimaryRes.data && dedPrimaryRes.data.length > 0)
            ? dedPrimaryRes.data
            : (dedFallbackRes?.data || []);

          if (dedData && Array.isArray(dedData)) {
            dedData.forEach((d: any) => {
              const k1 = (d.mr_no || "").trim().toUpperCase();
              const k2 = (d.arrival_no || "").trim().toUpperCase();
              const row: DeductionRow = {
                id: d.id ? String(d.id) : String(Math.random()),
                deduction_type: d.deduction_type || "",
                deduction_rate: Number(d.deduction_rate) || 0,
                deduction_qty: Number(d.deduction_qty) || 0,
                deduction_amount: Number(d.deduction_amount) || 0,
                remarks: d.remarks || ""
              };
              if (k1) {
                const list = dbDeductionsMap.get(k1) || [];
                list.push(row);
                dbDeductionsMap.set(k1, list);
              }
              if (k2 && k2 !== k1) {
                const list = dbDeductionsMap.get(k2) || [];
                list.push(row);
                dbDeductionsMap.set(k2, list);
              }
            });
          }
        } catch (e) {
          console.warn("Parallel fetch error in inspection records:", e);
        }
      }

      if (inspectionList.length === 0) {
        try {
          const cached = localStorage.getItem("material_inspection_records") || localStorage.getItem("inspection_master_records");
          if (cached) inspectionList = JSON.parse(cached);
        } catch (e) {}
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

      // Enrich existing saved inspection records
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

      const displayList = Array.from(map.values()).map(rec => {
        const mrK = (rec.mr_no || "").trim().toUpperCase();
        const arrK = (rec.arrival_no || "").trim().toUpperCase();
        let attachedDeductions: DeductionRow[] = [];

        if (mrK && dbDeductionsMap.has(mrK)) {
          attachedDeductions = dbDeductionsMap.get(mrK)!;
        } else if (arrK && dbDeductionsMap.has(arrK)) {
          attachedDeductions = dbDeductionsMap.get(arrK)!;
        } else if (rec.deductions) {
          if (Array.isArray(rec.deductions) && rec.deductions.length > 0) {
            attachedDeductions = rec.deductions;
          } else if (typeof rec.deductions === 'string') {
            try {
              const p = JSON.parse(rec.deductions);
              if (Array.isArray(p) && p.length > 0) attachedDeductions = p;
            } catch (e) {}
          }
        }

        if (attachedDeductions.length === 0 && (rec as any).deduction_rows) {
          const dr = (rec as any).deduction_rows;
          if (Array.isArray(dr) && dr.length > 0) attachedDeductions = dr;
          else if (typeof dr === 'string') {
            try {
              const p = JSON.parse(dr);
              if (Array.isArray(p) && p.length > 0) attachedDeductions = p;
            } catch (e) {}
          }
        }

        if (attachedDeductions.length === 0 && (rec as any).deductions_json) {
          try {
            const p = JSON.parse((rec as any).deductions_json);
            if (Array.isArray(p) && p.length > 0) attachedDeductions = p;
          } catch (e) {}
        }

        if (attachedDeductions.length === 0 && rec.mr_no) {
          try {
            const c = localStorage.getItem(`inspection_deductions_${rec.mr_no}`);
            if (c) {
              const p = JSON.parse(c);
              if (Array.isArray(p) && p.length > 0) attachedDeductions = p;
            }
          } catch (e) {}
        }

        if (attachedDeductions.length === 0 && rec.arrival_no) {
          try {
            const c = localStorage.getItem(`inspection_deductions_${rec.arrival_no}`);
            if (c) {
              const p = JSON.parse(c);
              if (Array.isArray(p) && p.length > 0) attachedDeductions = p;
            }
          } catch (e) {}
        }

        if (attachedDeductions.length === 0 && (rec.deduction_type || Number(rec.deduction_amount) > 0)) {
          attachedDeductions = [
            {
              id: "1",
              deduction_type: rec.deduction_type || "General Deduction",
              deduction_rate: Number(rec.deduction_rate) || 0,
              deduction_qty: Number(rec.deduction_qty) || 0,
              deduction_amount: Number(rec.deduction_amount) || 0
            }
          ];
        }

        if (attachedDeductions.length > 0) {
          rec.deductions = attachedDeductions;
          (rec as any).deduction_rows = attachedDeductions;
          if (!rec.deduction_amount || Number(rec.deduction_amount) === 0) {
            rec.deduction_amount = attachedDeductions.reduce((sum, d) => sum + (Number(d.deduction_amount) || 0), 0);
          }
        }

        return rec;
      });

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
      isFetchingRecordsRef.current = false;
    }
  };

  useEffect(() => {
    fetchInspectionRecords();
  }, []);

  useLiveAutoRefresh(fetchInspectionRecords, [], { tables: ['material_inspection', 'material_inspection_details', 'final_arrival', 'purchase_master', 'purchase_detail_master', 'temporary_material_received', 'moisture_logic', 'deduction_master'] });

  const loadDetailsForPo = async (poNo: string) => {
    if (!poNo) return;
    try {
      const poClean = poNo.trim();
      const poUpper = poClean.toUpperCase();
      let matchedItems: any[] = [];
      let gradeMap: Record<string, string> = {};
      let agencyMap: Record<string, string> = {};
      let markaMap: Record<string, string> = {};
      let pmData: any = null;

      if (supabase) {
        const [pdmRes, scpRes, midRes, pmRes, gradesRes, agenciesRes, markasRes, scpHeaderRes] = await Promise.all([
          supabase.from('purchase_detail_master').select('*').or(`po_no.eq.${poClean},po_no.ilike.${poUpper}`),
          supabase.from('sauda_check_point_details').select('*').or(`po_no.eq.${poClean},po_no.ilike.${poUpper}`),
          supabase.from('material_inspection_details').select('*').or(`mr_no.eq.${poClean},mr_no.ilike.${poUpper},po_no.eq.${poClean}`),
          supabase.from('purchase_master').select('*').or(`po_no.eq.${poClean},po_no.ilike.${poUpper}`),
          supabase.from('grade_master').select('*'),
          supabase.from('agency_master').select('*'),
          supabase.from('marka_master').select('*'),
          supabase.from('sauda_check_point').select('*').or(`po_no.eq.${poClean},po_no.ilike.${poUpper}`)
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
          pmData = pmRes.data[0];
          const pm = pmData;
          setHeaderForm(prev => ({
            ...prev,
            po_no: pm.po_no || prev.po_no,
            po_date: pm.po_date || pm.date || prev.po_date,
            supplier_name: pm.supplier || pm.challan_supplier || prev.supplier_name,
            broker_name: pm.broker || prev.broker_name,
            lorry_number: pm.lorry_no || pm.lorry_number || prev.lorry_number
          }));
        } else if (scpHeaderRes.data && scpHeaderRes.data.length > 0) {
          const scp = scpHeaderRes.data[0];
          pmData = scp;
          setHeaderForm(prev => ({
            ...prev,
            po_no: scp.po_no || prev.po_no,
            po_date: scp.po_date || scp.s_date || prev.po_date,
            supplier_name: scp.supplier_name || scp.supplier || prev.supplier_name,
            broker_name: scp.broker_name || scp.broker || prev.broker_name,
            lorry_number: scp.lorry_number || prev.lorry_number
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
        let resolvedUnitName = (pmData?.unit_name || pmData?.unit || "").toString().trim().toUpperCase();
        if (!resolvedUnitName && matchedItems.length > 0) {
          for (const itm of matchedItems) {
            const u = (itm.unit || itm.unit_name || "").toString().trim().toUpperCase();
            if (u && u !== "BALES") {
              resolvedUnitName = u;
              break;
            }
          }
        }

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
          const itemUnit = (item.unit || item.unit_name || "").toString().trim().toUpperCase();
          const unitVal = (itemUnit && itemUnit !== "BALES") ? itemUnit : (resolvedUnitName || itemUnit || "BALES");
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
            add_weight: Number(item.add_weight || 0),
            less_weight: Number(item.less_weight || 0),
            ...computeDetailRowWeights({
              receipt_gross_wt: nettoVal,
              challan_gross_wt: nettoVal,
              add_weight: Number(item.add_weight || 0),
              less_weight: Number(item.less_weight || 0),
              moisture_claim: Number(item.moisture_claim || item.claim_moisture || 0),
              dust_claim: Number(item.dust_claim || item.claim_dust || 0)
            }),
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
    const mrToCheck = (fa.mr_no || fa.final_arrival_no || displayMrNo || "").trim().toUpperCase();
    const existingRec = records.find(r => 
      (r.mr_no && (r.mr_no.toUpperCase() === mrToCheck || r.mr_no.toUpperCase() === (fa.final_arrival_no || "").toUpperCase())) ||
      (r.arrival_no && (r.arrival_no.toUpperCase() === (fa.final_arrival_no || "").toUpperCase() || r.arrival_no.toUpperCase() === (fa.temporary_arrival_no || "").toUpperCase()))
    );

    let initialHeader = {
      mr_no: existingRec?.mr_no || displayMrNo,
      mr_date: existingRec?.mr_date || fa.date || fa.arrival_date || new Date().toISOString().split("T")[0],
      arrival_no: existingRec?.arrival_no || fa.final_arrival_no || fa.arrival_no || displayMrNo,
      arrival_date: existingRec?.arrival_date || fa.date || fa.arrival_date || new Date().toISOString().split("T")[0],
      unloading_date: existingRec?.unloading_date || fa.unloading_date || fa.date || fa.arrival_date || new Date().toISOString().split("T")[0],
      po_no: existingRec?.po_no || poNo,
      po_date: existingRec?.po_date || fa.po_date || fa.date || "",
      mill_po_no: existingRec?.mill_po_no || fa.mill_po_no || fa.po_no || fa.mr_no || fa.final_arrival_no || displayMrNo || "",
      mill_po_date: existingRec?.mill_po_date || fa.mill_po_date || fa.po_date || fa.date || new Date().toISOString().split("T")[0],
      broker_name: existingRec?.broker_name || fa.broker || fa.broker_name || "",
      supplier_name: existingRec?.supplier_name || fa.supplier || fa.supplier_name || fa.challan_supplier || "",
      lorry_number: existingRec?.lorry_number || fa.lorry_number || fa.lorry_no || "",
      actual_moisture: existingRec?.actual_moisture !== undefined ? Number(existingRec.actual_moisture) : Number(fa.actual_moisture || 0),
      actual_dust: existingRec?.actual_dust !== undefined ? Number(existingRec.actual_dust) : Number(fa.actual_dust || 0),
      actual_ncv: existingRec?.actual_ncv !== undefined ? Number(existingRec.actual_ncv) : Number(fa.actual_ncv || 0),
      claim_moisture: existingRec?.claim_moisture !== undefined ? Number(existingRec.claim_moisture) : Number(fa.claim_moisture || 0),
      claim_dust: existingRec?.claim_dust !== undefined ? Number(existingRec.claim_dust) : Number(fa.claim_dust || 0),
      claim_ncv: existingRec?.claim_ncv !== undefined ? Number(existingRec.claim_ncv) : Number(fa.claim_ncv || 0),
      detention_days: existingRec?.detention_days !== undefined ? Number(existingRec.detention_days) : Number(fa.detention_days || 0),
      mr_spcl_print: existingRec?.mr_spcl_print || fa.mr_spcl_print || "",
      remarks: existingRec?.remarks || fa.remarks || fa.arrival_remarks || ""
    };

    setHeaderForm(initialHeader);
    setViewMode("form");

    let rawGrid = fa.grid_details || fa.details || fa.items;
    const voucherArea = (fa.arrival_area_name || fa.arrival_area || fa.area_name || fa.area || "").toUpperCase();

    if (typeof rawGrid === "string") {
      try { rawGrid = JSON.parse(rawGrid); } catch (e) {}
    }

    // Resolve parent unit from Final Arrival or look up from DB/cache if missing
    let resolvedUnitName = (fa.unit_name || fa.unit || fa.unit_code || existingRec?.unit_name || "").toString().trim().toUpperCase();

    // Check if any row in rawGrid has a unit
    if ((!resolvedUnitName || resolvedUnitName === "BALES") && Array.isArray(rawGrid)) {
      for (const row of rawGrid) {
        const u = (row?.unit || row?.unit_name || "").toString().trim().toUpperCase();
        if (u && u !== "BALES") {
          resolvedUnitName = u;
          break;
        }
      }
    }

    // Master dictionaries for code -> name lookup
    let gradeMap: Record<string, string> = {};
    let agencyMap: Record<string, string> = {};
    let markaMap: Record<string, string> = {};
    let poRateMap: Record<string, number> = {};

    // Load master lookup tables and PO rate details
    if (supabase) {
      try {
        const [gradesRes, agenciesRes, markasRes, pdmRes, scpRes, pmRes, scpMasterRes] = await Promise.all([
          supabase.from('grade_master').select('*'),
          supabase.from('agency_master').select('*'),
          supabase.from('marka_master').select('*'),
          poNo ? supabase.from('purchase_detail_master').select('*').eq('po_no', poNo) : Promise.resolve({ data: null }),
          poNo ? supabase.from('sauda_check_point_details').select('*').eq('po_no', poNo) : Promise.resolve({ data: null }),
          poNo ? supabase.from('purchase_master').select('*').eq('po_no', poNo).maybeSingle() : Promise.resolve({ data: null }),
          poNo ? supabase.from('sauda_check_point').select('*').eq('po_no', poNo).maybeSingle() : Promise.resolve({ data: null })
        ]);

        if (gradesRes.data) {
          gradesRes.data.forEach((g: any) => {
            if (g.grade_code && g.grade_name) gradeMap[String(g.grade_code).trim()] = g.grade_name;
          });
        }
        if (agenciesRes.data) {
          agenciesRes.data.forEach((a: any) => {
            if (a.agency_code && a.agency_name) agencyMap[String(a.agency_code).trim()] = a.agency_name;
          });
        }
        if (markasRes.data) {
          markasRes.data.forEach((m: any) => {
            if (m.marka_code && m.marka_name) markaMap[String(m.marka_code).trim()] = m.marka_name;
          });
        }

        // Map PO rates
        const poItems = pdmRes.data || scpRes.data || [];
        poItems.forEach((p: any) => {
          const r = Number(p.rate_qntl || p.rate || p.b_rate || 0);
          if (r > 0) {
            if (p.grade_code) poRateMap[String(p.grade_code).trim().toUpperCase()] = r;
            if (p.grade_name) poRateMap[String(p.grade_name).trim().toUpperCase()] = r;
            if (p.item_name) poRateMap[String(p.item_name).trim().toUpperCase()] = r;
          }
        });

        const poMaster = pmRes.data || scpMasterRes.data;
        if (poMaster) {
          setHeaderForm(prev => ({
            ...prev,
            po_date: prev.po_date || poMaster.po_date || poMaster.date || prev.po_date,
            broker_name: prev.broker_name || poMaster.broker || prev.broker_name,
            supplier_name: prev.supplier_name || poMaster.supplier || poMaster.challan_supplier || prev.supplier_name
          }));
        }
      } catch (mErr) {
        console.warn("Could not load master lookup maps / PO rates:", mErr);
      }
    }

    // Check if prior material inspection details exist in DB for this MR/Arrival
    if (supabase && (mrToCheck || fa.final_arrival_no || fa.arrival_no)) {
      try {
        const searchKeys = [mrToCheck, fa.final_arrival_no, fa.arrival_no, fa.mr_no].filter(Boolean);
        const orClause = searchKeys.map(k => `mr_no.eq.${k}`).join(',');
        const { data: savedMid } = await supabase
          .from('material_inspection_details')
          .select('*')
          .or(orClause)
          .order('srl_no', { ascending: true });

        if (savedMid && savedMid.length > 0) {
          rawGrid = savedMid;
        }
      } catch (e) {
        console.warn("Could not load saved material inspection details:", e);
      }
    }

    // If arrival grid details missing or empty, fetch fresh from DB
    if (!Array.isArray(rawGrid) || rawGrid.length === 0) {
      const searchKeys = [fa.final_arrival_no, fa.arrival_no, fa.mr_no, fa.temporary_arrival_no, fa.po_no].filter(Boolean);
      if (searchKeys.length > 0 && supabase) {
        try {
          for (const key of searchKeys) {
            const cleanKey = String(key).trim();
            const upperKey = cleanKey.toUpperCase();
            const [faDb, tmrDb, matInspRes, pdmRes, scpRes, pmDb] = await Promise.all([
              supabase.from('final_arrival').select('unit_name, unit_code, grid_details, arrival_area_name, arrival_area_code').or(`final_arrival_no.eq.${cleanKey},arrival_no.eq.${cleanKey},mr_no.eq.${cleanKey}`).limit(1),
              supabase.from('temporary_material_received').select('unit_name, unit_code, grid_details').or(`mr_no.eq.${cleanKey},arrival_no.eq.${cleanKey}`).limit(1),
              supabase.from('material_inspection_details').select('*').or(`mr_no.eq.${cleanKey},mr_no.ilike.${upperKey},po_no.eq.${cleanKey}`),
              supabase.from('purchase_detail_master').select('*').or(`po_no.eq.${cleanKey},po_no.ilike.${upperKey}`),
              supabase.from('sauda_check_point_details').select('*').or(`po_no.eq.${cleanKey},po_no.ilike.${upperKey}`),
              supabase.from('purchase_master').select('unit_name, unit_code').or(`po_no.eq.${cleanKey}`).limit(1)
            ]);

            if ((!resolvedUnitName || resolvedUnitName === "BALES")) {
              const foundUnit = faDb.data?.[0]?.unit_name || tmrDb.data?.[0]?.unit_name || pmDb.data?.[0]?.unit_name;
              if (foundUnit) {
                resolvedUnitName = foundUnit.toString().trim().toUpperCase();
              }
            }

            // 1. Prioritize actual arrival grid_details from final_arrival
            let arrivalGrid = faDb.data?.[0]?.grid_details;
            if (typeof arrivalGrid === 'string') {
              try { arrivalGrid = JSON.parse(arrivalGrid); } catch (e) {}
            }
            if (Array.isArray(arrivalGrid) && arrivalGrid.length > 0) {
              rawGrid = arrivalGrid;
              break;
            }

            // 2. Try temporary_material_received grid_details
            let tmrGrid = tmrDb.data?.[0]?.grid_details;
            if (typeof tmrGrid === 'string') {
              try { tmrGrid = JSON.parse(tmrGrid); } catch (e) {}
            }
            if (Array.isArray(tmrGrid) && tmrGrid.length > 0) {
              rawGrid = tmrGrid;
              break;
            }

            // 3. Try prior material inspection details
            if (matInspRes.data && Array.isArray(matInspRes.data) && matInspRes.data.length > 0) {
              rawGrid = matInspRes.data;
              break;
            }

            // 4. Fallback to purchase detail or sauda check point
            if (pdmRes.data && Array.isArray(pdmRes.data) && pdmRes.data.length > 0) {
              rawGrid = pdmRes.data;
              break;
            }
            if (scpRes.data && Array.isArray(scpRes.data) && scpRes.data.length > 0) {
              rawGrid = scpRes.data;
              break;
            }
          }
        } catch (e) {
          console.warn("Could not load arrival details from DB:", e);
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
      let totalMoistAct = 0;
      let totalMoistClaim = 0;
      let totalDustAct = 0;
      let totalNcvAct = 0;
      let rowCount = 0;

      const details: InspectionDetailRow[] = rawGrid.map((item: any, i: number) => {
        const gradeCode = item.receipt_grade_code || item.grade_code || item.stock_grade_code || item.item_code || "";
        const gradeName = item.receipt_grade_name || item.challan_grade_name || item.arrival_grade || item.grade_name || item.stock_grade_name || item.variety || item.item_name || item.grade || (gradeCode && gradeMap[gradeCode]) || "";
        const areaName = (item.arrival_area_name || item.area || item.area_name || item.arrival_area || voucherArea || "").toUpperCase();
        const agencyCode = item.agency_code || "";
        const agencyName = item.agency_name || item.agency || (agencyCode && agencyMap[agencyCode]) || agencyCode || "";
        const markaCode = item.challan_marka_code || item.marka_code || "";
        const markaName = item.challan_marka_name || item.marka_name || item.marks_phota || item.marka || item.marks || (markaCode && markaMap[markaCode]) || markaCode || "";
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

        const itemUnit = (item.unit || item.unit_name || "").toString().trim().toUpperCase();
        const unitVal = (itemUnit && itemUnit !== "BALES") ? itemUnit : (resolvedUnitName || itemUnit || "BALES");

        const lMin = Number(item.lorry_read_min || item.lorry_moisture_min || 0);
        const lMax = Number(item.lorry_read_max || item.lorry_moisture_max || 0);
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

        const moistAct = Number(item.moisture_act || item.actual_moisture || combinedMoistAvg || 0);
        const moistClaim = Number(item.moisture_claim || item.claim_moisture || combinedMoistAvg || 0);
        const gdAct = Number(item.grade_down_act || item.grade_down || item.actual_grade_down || 0);
        const gdClaim = Number(item.grade_down_claim || item.claim_grade_down || 0);
        const dustAct = Number(item.dust_act || item.actual_dust || 0);
        const dustClaim = Number(item.dust_claim || item.claim_dust || 0);
        const ncvAct = Number(item.ncv_act || item.actual_ncv || 0);
        const ncvClaim = Number(item.ncv_claim || item.claim_ncv || 0);

        if (moistAct > 0) totalMoistAct += moistAct;
        if (moistClaim > 0) totalMoistClaim += moistClaim;
        if (dustAct > 0) totalDustAct += dustAct;
        if (ncvAct > 0) totalNcvAct += ncvAct;
        rowCount++;

        // Look up PO rate for this item
        const gKey = String(gradeName).trim().toUpperCase();
        const gCodeKey = String(gradeCode).trim().toUpperCase();
        const resolvedRate = Number(item.rate_qntl || item.rate || poRateMap[gKey] || poRateMap[gCodeKey] || item.po_rate || 0);

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
          lot: item.lot || item.lot_no || "",
          quantity: qtyVal,
          unit: unitVal,
          rate: resolvedRate,
          rate_qntl: resolvedRate,
          challan_gross_wt: nettoVal,
          receipt_gross_wt: nettoVal,
          gross_weight_batch: Number(item.gross_weight_batch || item.batch_gross_weight || nettoVal || 0),
          add_weight: Number(item.add_weight || 0),
          less_weight: Number(item.less_weight || 0),
          ...computeDetailRowWeights({
            receipt_gross_wt: nettoVal,
            challan_gross_wt: nettoVal,
            reduced_weight: item.reduced_weight !== undefined ? Number(item.reduced_weight) : undefined,
            add_weight: Number(item.add_weight || 0),
            less_weight: Number(item.less_weight || 0),
            moisture_claim: moistClaim,
            dust_claim: dustClaim
          }),
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
          grade_down_claim: gdClaim,
          dust_act: dustAct,
          dust_claim: dustClaim,
          ncv_act: ncvAct,
          ncv_claim: ncvClaim,
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

      // If header moisture / dust were zero, update with item averages
      if (rowCount > 0) {
        setHeaderForm(prev => ({
          ...prev,
          actual_moisture: prev.actual_moisture || Number((totalMoistAct / rowCount).toFixed(2)),
          claim_moisture: prev.claim_moisture || Number((totalMoistClaim / rowCount).toFixed(2)),
          actual_dust: prev.actual_dust || Number((totalDustAct / rowCount).toFixed(2)),
          actual_ncv: prev.actual_ncv || Number((totalNcvAct / rowCount).toFixed(2))
        }));
      }
    } else if (voucherArea) {
      setDetailRows(prev => prev.map(r => ({ ...r, area: r.area || voucherArea })));
    }

    let loadedDeductions: DeductionRow[] = [];
    if (existingRec && existingRec.deductions && Array.isArray(existingRec.deductions) && existingRec.deductions.length > 0) {
      loadedDeductions = existingRec.deductions;
    } else if (fa.deductions && Array.isArray(fa.deductions) && fa.deductions.length > 0) {
      loadedDeductions = fa.deductions;
    } else if (existingRec?.mr_no || mrToCheck) {
      try {
        const cached = localStorage.getItem(`inspection_deductions_${existingRec?.mr_no || mrToCheck}`);
        if (cached) {
          const p = JSON.parse(cached);
          if (Array.isArray(p) && p.length > 0) loadedDeductions = p;
        }
      } catch (e) {}
    }

    if (loadedDeductions.length > 0) {
      setDeductionRows(loadedDeductions);
    } else if (fa.deduction_type || (fa.deduction_amount && Number(fa.deduction_amount) > 0)) {
      setDeductionRows([
        {
          id: "1",
          deduction_type: fa.deduction_type || "",
          deduction_rate: Number(fa.deduction_rate) || 0,
          deduction_qty: Number(fa.deduction_qty) || 0,
          deduction_amount: Number(fa.deduction_amount) || 0
        }
      ]);
    } else if (existingRec && (existingRec.deduction_type || (existingRec.deduction_amount && Number(existingRec.deduction_amount) > 0))) {
      setDeductionRows([
        {
          id: "1",
          deduction_type: existingRec.deduction_type || "",
          deduction_rate: Number(existingRec.deduction_rate) || 0,
          deduction_qty: Number(existingRec.deduction_qty) || 0,
          deduction_amount: Number(existingRec.deduction_amount) || 0
        }
      ]);
    } else {
      setDeductionRows([
        { id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }
      ]);
    }

    if (supabase && (mrToCheck || existingRec?.mr_no)) {
      const mrTarget = existingRec?.mr_no || mrToCheck;
      const arrTarget = fa.final_arrival_no || fa.arrival_no || '';
      (async () => {
        try {
          let { data } = await supabase
            .from("mill_inspection_deduction")
            .select("*")
            .or(`mr_no.eq.${mrTarget},arrival_no.eq.${arrTarget}`)
            .order("created_at", { ascending: true });
          
          if (!data || data.length === 0) {
            const { data: fallbackData } = await supabase
              .from("material_inspection_deductions")
              .select("*")
              .or(`mr_no.eq.${mrTarget},arrival_no.eq.${arrTarget}`)
              .order("created_at", { ascending: true });
            data = fallbackData;
          }

          if (data && data.length > 0) {
            setDeductionRows(data.map((d: any, idx: number) => ({
              id: d.id ? String(d.id) : String(idx + 1),
              deduction_type: d.deduction_type || "",
              deduction_rate: Number(d.deduction_rate) || 0,
              deduction_qty: Number(d.deduction_qty) || 0,
              deduction_amount: Number(d.deduction_amount) || 0,
              remarks: d.remarks || ""
            })));
          }
        } catch (e) {}
      })();
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
      deduction_qty: 0,
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
      { id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }
    ]);
    setViewMode("form");
  };

  const handlePrintRecord = async (rec: InspectionMasterRecord) => {
    const poNo = rec.po_no || rec.mill_po_no;
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

    setPrintingRecord(rec);
    setPrintingDetails([]);

    let loadedDetails: any[] = [];

    // If currently editing this record in form view, prioritize the in-memory detailRows
    if (headerForm.mr_no === rec.mr_no && detailRows.length > 0) {
      loadedDetails = detailRows.filter(r => Number(r.quantity) > 0 || Number(r.challan_gross_wt) > 0);
    }

    if (loadedDetails.length === 0 && supabase) {
      try {
        const midRes = await supabase.from("material_inspection_details").select("*").eq("mr_no", rec.mr_no).order("srl_no", { ascending: true });
        if (midRes.data && midRes.data.length > 0) {
          loadedDetails = midRes.data;
        }
      } catch (err) {
        console.warn("Could not fetch print details from remote DB:", err);
      }
    }

    if (loadedDetails.length === 0) {
      let rawGrid = rec.grid_details;
      if (typeof rawGrid === 'string') {
        try { rawGrid = JSON.parse(rawGrid); } catch (e) {}
      }
      if (Array.isArray(rawGrid) && rawGrid.length > 0) {
        loadedDetails = rawGrid
          .filter((item: any) => Number(item.quantity_rcpt || item.quantity_chln || item.quantity || item.bales || 0) > 0 || Number(item.netto_pnto || item.weight_mt || item.challan_gross_wt || item.gross_weight || item.weight || 0) > 0)
          .map((item: any) => ({
            crop_year: item.crop_year || "2026-27",
            marka: item.challan_marka_name || item.marka_name || item.marka || item.marks || (rec as any).area || "BJC",
            stock_grade_name: item.receipt_grade_name || item.challan_grade_name || item.grade_name || item.variety || item.grade || "TD-5",
            quantity: item.quantity_rcpt || item.quantity_chln || item.quantity || item.bales || 1,
            challan_gross_wt: item.netto_pnto || item.weight_mt || item.challan_gross_wt || item.gross_weight || item.weight || "",
            moisture_claim: item.moisture_claim ?? item.claim_moisture ?? item.moisture_act ?? item.actual_moisture ?? rec.claim_moisture ?? rec.actual_moisture ?? 5,
            actual_moisture: item.moisture_act || item.actual_moisture || rec.actual_moisture || 5,
            moisture_act: item.moisture_act || item.actual_moisture || rec.actual_moisture || 5,
            dust_claim: item.dust_claim ?? item.claim_dust ?? item.dust_act ?? item.actual_dust ?? rec.claim_dust ?? rec.actual_dust ?? 0,
            actual_dust: item.dust_act || item.actual_dust || rec.actual_dust || 0,
            dust_act: item.dust_act || item.actual_dust || rec.actual_dust || 0,
            ncv_claim: item.ncv_claim ?? item.claim_ncv ?? item.ncv_act ?? item.actual_ncv ?? rec.claim_ncv ?? rec.actual_ncv ?? 0,
            actual_ncv: item.ncv_act || item.actual_ncv || rec.actual_ncv || 0,
            ncv_act: item.ncv_act || item.actual_ncv || rec.actual_ncv || 0,
            settlement_moisture: item.settlement_moisture || '',
            settlement_dust: item.settlement_dust || '',
            settlement_ncv: item.settlement_ncv || '',
            final_receipt_wt: item.final_receipt_wt || item.net_wt || item.netto_pnto || "",
            rate: item.rate || item.rate_qntl || "",
            area: item.area || item.arrival_area_name || item.purch_area_name || (rec as any).area || "",
            agency: item.agency || item.arrival_agency_name || item.purch_agency_name || (rec as any).agency || ""
          }));
      }
    }

    setPrintingDetails(loadedDetails);
  };

  const handleEditRecord = async (rec: InspectionMasterRecord) => {
    setHeaderForm(rec);
    setDetailRows([]);

    let parsedDeductions: DeductionRow[] = [];
    if (rec.deductions) {
      if (Array.isArray(rec.deductions) && rec.deductions.length > 0) {
        parsedDeductions = rec.deductions;
      } else if (typeof rec.deductions === 'string') {
        try {
          const parsed = JSON.parse(rec.deductions);
          if (Array.isArray(parsed) && parsed.length > 0) parsedDeductions = parsed;
        } catch (e) {}
      }
    }
    if (parsedDeductions.length === 0 && (rec as any).deduction_rows) {
      const dr = (rec as any).deduction_rows;
      if (Array.isArray(dr) && dr.length > 0) parsedDeductions = dr;
      else if (typeof dr === 'string') {
        try {
          const parsed = JSON.parse(dr);
          if (Array.isArray(parsed) && parsed.length > 0) parsedDeductions = parsed;
        } catch (e) {}
      }
    }
    if (parsedDeductions.length === 0 && (rec as any).deductions_json) {
      try {
        const parsed = JSON.parse((rec as any).deductions_json);
        if (Array.isArray(parsed) && parsed.length > 0) parsedDeductions = parsed;
      } catch (e) {}
    }
    if (parsedDeductions.length === 0 && rec.mr_no) {
      try {
        const cached = localStorage.getItem(`inspection_deductions_${rec.mr_no}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) parsedDeductions = parsed;
        }
      } catch (e) {}
    }
    if (parsedDeductions.length === 0 && rec.arrival_no) {
      try {
        const cached = localStorage.getItem(`inspection_deductions_${rec.arrival_no}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) parsedDeductions = parsed;
        }
      } catch (e) {}
    }

    if (parsedDeductions.length > 0) {
      setDeductionRows(parsedDeductions);
    } else if (rec.deduction_type || (rec.deduction_amount && Number(rec.deduction_amount) > 0)) {
      setDeductionRows([
        {
          id: "1",
          deduction_type: rec.deduction_type || "General Deduction",
          deduction_rate: Number(rec.deduction_rate) || 0,
          deduction_qty: Number(rec.deduction_qty) || 0,
          deduction_amount: Number(rec.deduction_amount) || 0
        }
      ]);
    } else {
      setDeductionRows([
        { id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }
      ]);
      
      // Fallback query ONLY if no deductions were found in memory or cache
      if (supabase && (rec.mr_no || rec.arrival_no)) {
        const keys = [rec.mr_no, rec.arrival_no].filter(Boolean);
        const orFilter = keys.map(k => `mr_no.eq.${k},arrival_no.eq.${k}`).join(',');
        (async () => {
          try {
            let { data } = await supabase.from("material_inspection_deductions").select("*").or(orFilter).order("created_at", { ascending: true });
            if (!data || data.length === 0) {
              const { data: fallbackData } = await supabase.from("mill_inspection_deduction").select("*").or(orFilter).order("created_at", { ascending: true });
              data = fallbackData;
            }
            if (data && data.length > 0) {
              setDeductionRows(data.map((d: any, idx: number) => ({
                id: d.id ? String(d.id) : String(idx + 1),
                deduction_type: d.deduction_type || "",
                deduction_rate: Number(d.deduction_rate) || 0,
                deduction_qty: Number(d.deduction_qty) || 0,
                deduction_amount: Number(d.deduction_amount) || 0,
                remarks: d.remarks || ""
              })));
            }
          } catch (e) {}
        })();
      }
    }

    setViewMode("form");

    let loadedDetails: InspectionDetailRow[] = [];

    if (supabase) {
      try {
        const { data: midData } = await supabase.from("material_inspection_details").select("*").eq("mr_no", rec.mr_no).order("srl_no", { ascending: true });
        if (midData && midData.length > 0) {
          loadedDetails = midData.map(d => ({ ...d, is_auto: true, expanded: false }));
        }
      } catch (err) {
        console.warn("Could not query material_inspection_details:", err);
      }
    }

    if (loadedDetails.length === 0) {
      if (!rec.grid_details && supabase && (rec.mr_no || rec.arrival_no)) {
        try {
          const key = rec.mr_no || rec.arrival_no;
          const { data: fullMi } = await supabase
            .from("material_inspection")
            .select("grid_details, details, quality_matrix")
            .or(`mr_no.eq.${key},arrival_no.eq.${key}`)
            .maybeSingle();
          if (fullMi) {
            rec.grid_details = fullMi.grid_details || fullMi.details;
            (rec as any).details = fullMi.details;
            (rec as any).quality_matrix = fullMi.quality_matrix;
          }
        } catch (e) {}
      }

      // Build detail rows from grid_details if available (from Final Arrival)
      let rawGrid = rec.grid_details;
      if (typeof rawGrid === 'string') {
        try { rawGrid = JSON.parse(rawGrid); } catch (e) {}
      }

      if (Array.isArray(rawGrid) && rawGrid.length > 0) {
        const resolvedUnitName = (rec.unit_name || (rec as any).unit || "").toString().trim().toUpperCase();
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

          const itemUnit = (item.unit || item.unit_name || "").toString().trim().toUpperCase();
          const unitVal = (itemUnit && itemUnit !== "BALES") ? itemUnit : (resolvedUnitName || itemUnit || "BALES");

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
            add_weight: Number(item.add_weight || 0),
            less_weight: Number(item.less_weight || 0),
            ...computeDetailRowWeights({
              receipt_gross_wt: nettoVal,
              challan_gross_wt: nettoVal,
              reduced_weight: item.reduced_weight !== undefined ? Number(item.reduced_weight) : undefined,
              add_weight: Number(item.add_weight || 0),
              less_weight: Number(item.less_weight || 0),
              moisture_claim: Number(item.moisture_claim || item.claim_moisture || rec.claim_moisture || 0),
              dust_claim: Number(item.dust_claim || item.claim_dust || rec.claim_dust || 0)
            }),
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
          const resolvedUnitName = (rec.unit_name || (rec as any).unit || "").toString().trim().toUpperCase();
          loadedDetails = pdm.map((item: any, i: number) => {
            const nettoVal = Number(item.weight_mt || item.quantity_mt || item.netto_pnto || item.weight || item.quantity || 0);
            const moistAct = Number(item.moisture_act || item.actual_moisture || rec.actual_moisture || 0);
            const gdAct = Number(item.grade_down_act || item.grade_down || 0);
            const dustAct = Number(item.dust_act || item.actual_dust || rec.actual_dust || 0);
            const ncvAct = Number(item.ncv_act || item.actual_ncv || rec.actual_ncv || 0);
            const itemUnit = (item.unit || item.unit_name || "").toString().trim().toUpperCase();
            const unitVal = (itemUnit && itemUnit !== "BALES") ? itemUnit : (resolvedUnitName || itemUnit || "BALES");

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
              unit: unitVal,
              challan_gross_wt: nettoVal,
              receipt_gross_wt: nettoVal,
              add_weight: Number(item.add_weight || 0),
              less_weight: Number(item.less_weight || 0),
              ...computeDetailRowWeights({
                receipt_gross_wt: nettoVal,
                challan_gross_wt: nettoVal,
                reduced_weight: item.reduced_weight !== undefined ? Number(item.reduced_weight) : undefined,
                add_weight: Number(item.add_weight || 0),
                less_weight: Number(item.less_weight || 0),
                moisture_claim: Number(item.moisture_claim || item.claim_moisture || rec.claim_moisture || 0),
                dust_claim: Number(item.dust_claim || item.claim_dust || rec.claim_dust || 0)
              }),
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

    // Resolve true unit from Final Arrival or record header
    const matchingFa = finalArrivalList.find(f => 
      (f.mr_no && (f.mr_no === rec.mr_no || f.mr_no === rec.arrival_no)) ||
      (f.final_arrival_no && (f.final_arrival_no === rec.mr_no || f.final_arrival_no === rec.arrival_no)) ||
      (f.temporary_arrival_no && (f.temporary_arrival_no === rec.mr_no || f.temporary_arrival_no === rec.arrival_no)) ||
      (f.po_no && (f.po_no === rec.po_no || f.po_no === (rec as any).mill_po_no))
    );
    let targetUnit = (matchingFa?.unit_name || matchingFa?.unit || rec.unit_name || (rec as any).unit || "").toString().trim().toUpperCase();
    if ((!targetUnit || targetUnit === "BALES") && matchingFa) {
      let rawGrid = matchingFa.grid_details || matchingFa.details || matchingFa.items;
      if (typeof rawGrid === "string") {
        try { rawGrid = JSON.parse(rawGrid); } catch (e) {}
      }
      if (Array.isArray(rawGrid)) {
        for (const row of rawGrid) {
          const u = (row?.unit || row?.unit_name || "").toString().trim().toUpperCase();
          if (u && u !== "BALES") {
            targetUnit = u;
            break;
          }
        }
      }
    }

    if (targetUnit && targetUnit !== "BALES") {
      loadedDetails = loadedDetails.map(r => ({
        ...r,
        unit: (!r.unit || r.unit === "BALES") ? targetUnit : r.unit
      }));
      if (supabase && rec.mr_no) {
        supabase.from("material_inspection_details").update({ unit: targetUnit }).eq("mr_no", rec.mr_no).then(() => {}, () => {});
        supabase.from("material_inspection").update({ unit_name: targetUnit }).eq("mr_no", rec.mr_no).then(() => {}, () => {});
      }
    }

    if (loadedDetails.length === 0) {
      loadedDetails = [{ unit: targetUnit || "BALES", quantity: 0, tolerable: "Yes", expanded: false }];
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
    } else if (field === 'arrival_date') {
      const arrDate = String(value);
      setDetailRows(prev => prev.map(r => {
        const actM = Number(r.moisture_act) || ((Number(r.lorry_read_avg) > 0 && Number(r.insp_read_avg) > 0) ? Number(((Number(r.lorry_read_avg) + Number(r.insp_read_avg)) / 2).toFixed(2)) : (Number(r.lorry_read_avg) || Number(r.insp_read_avg) || 0));
        const newClaim = calculateClaimMoisture(actM, arrDate, r.area || (headerForm as any).area, moistureLogicRules);
        let updatedRow = { ...r, moisture_claim: newClaim };
        if (Number(r.receipt_gross_wt) > 0) {
          const baseWt = Number(r.reduced_weight) || Number(r.receipt_gross_wt);
          const moisturediduct = ((baseWt / 100) * newClaim);
          updatedRow.final_receipt_wt = Number((baseWt - Number(moisturediduct.toFixed(3))).toFixed(3));
        }
        return updatedRow;
      }));
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
        currentRow.insp_read_avg = avg;
      }

      // Auto-pull AVERAGE Value between Lorry Read Avg & Insp Read Avg into Moisture % Act.
      if (
        field === "lorry_read_min" ||
        field === "lorry_read_max" ||
        //field === "lorry_read_avg" ||
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
          //currentRow.moisture_act = combinedMoistAvg;
        }
      }

      // Automatically calculate Claim Moisture % based on moisture_logic rules whenever moisture reading, moisture_act, or area changes
      /* if (
        field === "lorry_read_min" ||
        field === "lorry_read_max" ||
        field === "lorry_read_avg" ||
        field === "insp_read_min" ||
        field === "insp_read_max" ||
        field === "insp_read_avg" ||
        field === "moisture_act" ||
        field === "area"
      ) { */
        if (
          field === "lorry_read_avg" ||
          field === "area"
        ) {
        currentRow.moisture_act = currentRow.lorry_read_avg;
        const actM = Number(currentRow.moisture_act) || 0;
        const arrDate = headerForm.arrival_date || headerForm.mr_date || "";
        const rowArea = currentRow.area || (headerForm as any).area || "";
        const claimM = calculateClaimMoisture(actM, arrDate, rowArea, moistureLogicRules);
        currentRow.moisture_claim = claimM;
      }

      // Auto-pull Grade Down Act / Claim into Mill Settlement % Gr. Down
      if (field === "grade_down_act") {
        //currentRow.settlement_grade_down = Number(value) || 0;
      }
      if (field === "grade_down_claim" && (!currentRow.settlement_grade_down || currentRow.settlement_grade_down === 0)) {
        //currentRow.settlement_grade_down = Number(value) || 0;
      }

      // Auto-pull Dust Act / Claim into Mill Settlement % Dust
      if (field === "dust_act") {
        currentRow.dust_claim = Number(value) || 0;
      }

      // Auto-pull NCV Act / Claim into Mill Settlement % NCV
      if (field === "ncv_act") {
        currentRow.ncv_claim = Number(value) || 0;
      }

      // Recalculate Reduced Weight and Final Receipt Wt. (Claim)
      const weights = computeDetailRowWeights(currentRow);
      currentRow.reduced_weight = field === "reduced_weight" ? (Number(value) || 0) : weights.reduced_weight;
      if (field === "final_receipt_wt") {
        currentRow.final_receipt_wt = Number(value) || 0;
      } else {
        const base = currentRow.reduced_weight > 0 
          ? currentRow.reduced_weight 
          : (Number(currentRow.receipt_gross_wt) || Number(currentRow.challan_gross_wt) || 0);
        const mClaim = Number(currentRow.moisture_claim) || 0;
        const dClaim = Number(currentRow.dust_claim) || 0;
        const mDeduct = (base * mClaim) / 100;
        const dDeduct = (base * dClaim) / 100;
        currentRow.final_receipt_wt = Number(Math.max(0, base - mDeduct - dDeduct).toFixed(3));
      }
        
      updated[index] = currentRow;
      return updated;
    });
  };

  // Auto-sync moisture_claim and final_receipt_wt for all detail rows whenever moistureLogicRules, arrival_date, or detailRows are present
  useEffect(() => {
    if (detailRows.length > 0) {
      setDetailRows(prev => {
        let hasChanges = false;
        const updated = prev.map(row => {
          const lAvg = Number(row.lorry_read_avg) || 0;
          const iAvg = Number(row.insp_read_avg) || 0;
          const avgRead = (lAvg > 0 && iAvg > 0) ? Number(((lAvg + iAvg) / 2).toFixed(2)) : (lAvg || iAvg || 0);
          const actM = Number(row.moisture_act) || avgRead;
          
          let calculatedClaim = Number(row.moisture_claim) || 0;
          if (actM > 0 && moistureLogicRules && moistureLogicRules.length > 0) {
            calculatedClaim = calculateClaimMoisture(
              actM,
              headerForm.arrival_date || headerForm.mr_date,
              row.area || (headerForm as any).area,
              moistureLogicRules
            );
          }

          const baseWt = Number(row.reduced_weight) > 0 
            ? Number(row.reduced_weight) 
            : (Number(row.receipt_gross_wt) > 0 ? Number(row.receipt_gross_wt) : (Number(row.challan_gross_wt) || 0));
          
          const claimM = calculatedClaim > 0 ? calculatedClaim : (Number(row.moisture_claim) || 0);
          const claimD = Number(row.dust_claim) || 0;
          const moistDeduct = (baseWt * claimM) / 100;
          const dustDeduct = (baseWt * claimD) / 100;
          const expectedFinalWt = baseWt > 0 ? Number((baseWt - moistDeduct - dustDeduct).toFixed(3)) : 0;

          const currentFinalWt = Number(row.final_receipt_wt) || 0;
          const needsClaimUpdate = calculatedClaim > 0 && row.moisture_claim !== calculatedClaim;
          const needsFinalWtUpdate = baseWt > 0 && (claimM > 0 || claimD > 0) && (
            Math.abs(currentFinalWt - expectedFinalWt) > 0.001 || currentFinalWt === baseWt
          );

          if (needsClaimUpdate || needsFinalWtUpdate) {
            hasChanges = true;
            return {
              ...row,
              moisture_act: row.moisture_act || actM,
              moisture_claim: claimM,
              final_receipt_wt: expectedFinalWt
            };
          }
          return row;
        });
        return hasChanges ? updated : prev;
      });
    }
  }, [moistureLogicRules, headerForm.arrival_date]);

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
    const existingUnit = detailRows.find(r => r.unit && r.unit.trim() !== "")?.unit || (headerForm as any).unit_name || "BALES";
    setDetailRows(prev => [
      ...prev,
      {
        unit: existingUnit,
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

  // Resilient Supabase persistence helpers that automatically handle missing table columns in Supabase
  const resilientSupabaseUpsert = async (
    client: any,
    table: string,
    record: any,
    matchColumn: string = "mr_no"
  ) => {
    let payload: Record<string, any> = { ...record };
    let attempts = 0;
    while (attempts < 20) {
      attempts++;
      const matchVal = payload[matchColumn];
      const { data: existing } = await client
        .from(table)
        .select(matchColumn)
        .eq(matchColumn, matchVal)
        .maybeSingle();

      let result;
      if (existing && existing[matchColumn]) {
        result = await client.from(table).update(payload).eq(matchColumn, matchVal).select();
      } else {
        result = await client.from(table).insert(payload).select();
      }

      if (!result.error) {
        return result.data && result.data.length > 0 ? result.data[0] : payload;
      }

      const missingColMatch = result.error.message?.match(/Could not find the '([^']+)' column of/i)
        || result.error.message?.match(/column "([^"]+)" of relation "[^"]+" does not exist/i)
        || result.error.message?.match(/column '([^']+)' does not exist/i);

      if (missingColMatch && missingColMatch[1]) {
        const col = missingColMatch[1];
        console.warn(`[Supabase Resilient Save] Column '${col}' not found in table '${table}', dropping column and retrying...`);
        delete payload[col];
        continue;
      }

      throw result.error;
    }
    return payload;
  };

  const resilientSupabaseInsertRows = async (
    client: any,
    table: string,
    rows: any[]
  ) => {
    if (!rows || rows.length === 0) return [];
    let currentRows: Record<string, any>[] = rows.map(r => ({ ...r }));
    let attempts = 0;
    while (attempts < 20) {
      attempts++;
      const { data, error } = await client.from(table).insert(currentRows).select();
      if (!error) {
        return data || currentRows;
      }

      const missingColMatch = error.message?.match(/Could not find the '([^']+)' column of/i)
        || error.message?.match(/column "([^"]+)" of relation "[^"]+" does not exist/i)
        || error.message?.match(/column '([^']+)' does not exist/i);

      if (missingColMatch && missingColMatch[1]) {
        const col = missingColMatch[1];
        console.warn(`[Supabase Resilient Rows Insert] Column '${col}' not in table '${table}', dropping column and retrying...`);
        currentRows = currentRows.map(r => {
          const copy = { ...r };
          delete copy[col];
          return copy;
        });
        continue;
      }

      throw error;
    }
    return currentRows;
  };

  const handleSaveForm = async () => {
    if (!headerForm.mr_no || !headerForm.mr_no.trim()) {
      alert("Arrival No. / M. R. No. is required.");
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    try {
      const cleanMrNo = headerForm.mr_no.trim();
      const activeDeductions = deductionRows.filter(r => (r.deduction_type && r.deduction_type.trim() !== "") || Number(r.deduction_amount) > 0);
      const totalDeductionAmt = deductionRows.reduce((acc, r) => acc + (Number(r.deduction_amount) || 0), 0);
      const primaryDeduction = activeDeductions[0] || deductionRows[0] || { deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 };

      // Prepare detail rows
      const validDetails = detailRows.map((row, idx) => ({
        mr_no: cleanMrNo,
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
        unit: row.unit || (headerForm as any).unit_name || "BALES",
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
        final_receipt_wt: (() => {
          const baseWt = Number(row.reduced_weight) > 0 ? Number(row.reduced_weight) : (Number(row.receipt_gross_wt) || Number(row.challan_gross_wt) || 0);
          const mClaim = Number(row.moisture_claim || (row as any).claim_moisture || 0);
          const dClaim = Number(row.dust_claim || (row as any).claim_dust || 0);
          const calcFinal = Number((baseWt - ((baseWt * mClaim) / 100) - ((baseWt * dClaim) / 100)).toFixed(3));
          if (row.final_receipt_wt !== undefined && row.final_receipt_wt !== null && Number(row.final_receipt_wt) > 0) {
            if (Math.abs(Number(row.final_receipt_wt) - baseWt) < 0.001 && (mClaim > 0 || dClaim > 0)) {
              return calcFinal;
            }
            return Number(row.final_receipt_wt);
          }
          return calcFinal;
        })(),
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

      const resolvedMrDate = sanitizeDate(headerForm.mr_date) || sanitizeDate((headerForm as any).date) || new Date().toISOString().split("T")[0];
      const resolvedArrivalDate = sanitizeDate(headerForm.arrival_date) || resolvedMrDate;
      let resolvedPoDate = sanitizeDate(headerForm.po_date);

      if (supabase && headerForm.po_no) {
        try {
          const { data: scpData } = await supabase
            .from('purchase_master')
            .select('po_date')
            .eq('po_no', headerForm.po_no.trim())
            .maybeSingle();
          if (scpData && scpData.po_date) {
            resolvedPoDate = sanitizeDate(scpData.po_date) || resolvedPoDate;
          } else {
            const { data: scpViewData } = await supabase
              .from('sauda_check_point')
              .select('po_date, s_date')
              .eq('po_no', headerForm.po_no.trim())
              .maybeSingle();
            if (scpViewData) {
              resolvedPoDate = sanitizeDate(scpViewData.po_date || scpViewData.s_date) || resolvedPoDate;
            }
          }
        } catch (poErr) {
          console.warn("Error resolving PO Date source of truth:", poErr);
        }
      }

      const totalBalesCount = validDetails.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0) || Number((headerForm as any).total_quantity || (headerForm as any).quantity || 0);
      const totalChallanGrossMt = validDetails.reduce((sum, r) => sum + (Number(r.challan_gross_wt) || 0), 0) || Number((headerForm as any).challan_gross_wt || 0);
      const totalReceiptGrossMt = validDetails.reduce((sum, r) => sum + (Number(r.receipt_gross_wt) || 0), 0) || Number((headerForm as any).receipt_gross_wt || totalChallanGrossMt);
      const totalGrossBatch = validDetails.reduce((sum, r) => sum + (Number(r.gross_weight_batch) || 0), 0) || Number((headerForm as any).gross_weight_batch || 0);
      const totalAddWeight = validDetails.reduce((sum, r) => sum + (Number(r.add_weight) || 0), 0) || Number((headerForm as any).add_weight || 0);
      const totalLessWeight = validDetails.reduce((sum, r) => sum + (Number(r.less_weight) || 0), 0) || Number((headerForm as any).less_weight || 0);
      const totalReducedWeight = validDetails.reduce((sum, r) => sum + (Number(r.reduced_weight) || 0), 0) || Number((headerForm as any).reduced_weight || totalReceiptGrossMt);
      const totalFinalReceiptWt = validDetails.reduce((sum, r) => sum + (Number(r.final_receipt_wt) || 0), 0) || Number((headerForm as any).final_receipt_wt || totalReceiptGrossMt);
      const firstDetail = validDetails[0] || ({} as any);

      const masterPayload: any = {
        mr_no: cleanMrNo,
        mr_date: resolvedMrDate,
        date: resolvedMrDate,
        arrival_no: headerForm.arrival_no || cleanMrNo,
        arrival_date: resolvedArrivalDate,
        po_no: headerForm.po_no || null,
        po_date: resolvedPoDate,
        broker_name: headerForm.broker_name || "",
        supplier_name: headerForm.supplier_name || "",
        broker: headerForm.broker_name || "",
        supplier: headerForm.supplier_name || "",
        actual_moisture: Number(headerForm.actual_moisture) || 0,
        claim_moisture: Number(headerForm.claim_moisture) || 0,
        actual_dust: Number(headerForm.actual_dust) || 0,
        claim_dust: Number(headerForm.claim_dust) || 0,
        actual_ncv: Number(headerForm.actual_ncv) || 0,
        claim_ncv: Number(headerForm.claim_ncv) || 0,
        actual_grade_down: Number((headerForm as any).actual_grade_down) || 0,
        claim_grade_down: Number((headerForm as any).claim_grade_down) || 0,
        detention_days: Number(headerForm.detention_days) || 0,
        unloading_date: sanitizeDate(headerForm.unloading_date),
        mill_po_no: headerForm.mill_po_no || headerForm.po_no || null,
        mill_po_date: sanitizeDate(headerForm.mill_po_date) || resolvedPoDate,
        mr_spcl_print: headerForm.mr_spcl_print || null,
        remarks: headerForm.remarks || null,
        lorry_number: headerForm.lorry_number || null,
        delivery_claim: Number(headerForm.delivery_claim) || 0,
        deduction_type: activeDeductions.map(r => r.deduction_type).filter(Boolean).join(", ") || primaryDeduction.deduction_type || "",
        deduction_rate: Number(primaryDeduction.deduction_rate) || 0,
        deduction_qty: Number(primaryDeduction.deduction_qty) || 0,
        deduction_amount: Number(totalDeductionAmt) || 0,
        deductions: deductionRows,
        deduction_rows: deductionRows,
        deductions_json: JSON.stringify(deductionRows),
        deduction_types: deductionRows,
        unit_name: (headerForm as any).unit_name || validDetails[0]?.unit || "BALES",
        unit: (headerForm as any).unit_name || validDetails[0]?.unit || "BALES",
        status: headerForm.status || "Completed",
        grid_details: validDetails,
        details: validDetails,
        quantity: totalBalesCount,
        total_quantity: totalBalesCount,
        challan_gross_wt: totalChallanGrossMt,
        receipt_gross_wt: totalReceiptGrossMt,
        gross_weight_batch: totalGrossBatch,
        add_weight: totalAddWeight,
        less_weight: totalLessWeight,
        reduced_weight: totalReducedWeight,
        final_receipt_wt: totalFinalReceiptWt,
        arrival_grade: firstDetail.arrival_grade || (headerForm as any).arrival_grade || "",
        stock_grade_code: firstDetail.stock_grade_code || (headerForm as any).stock_grade_code || "",
        stock_grade_name: firstDetail.stock_grade_name || (headerForm as any).stock_grade_name || "",
        area: firstDetail.area || (headerForm as any).area || "",
        agency: firstDetail.agency || (headerForm as any).agency || "",
        agency_code: firstDetail.agency_code || (headerForm as any).agency_code || "",
        marks: firstDetail.marks || (headerForm as any).marks || "",
        marka: firstDetail.marka || firstDetail.marks || (headerForm as any).marka || "",
        crop_year: firstDetail.crop_year || (headerForm as any).crop_year || "2026-27",
        lot: firstDetail.lot || (headerForm as any).lot || "",
        company_id: (headerForm as any).company_id || null,
        unit_id: (headerForm as any).unit_id || null,
        machine_id: (headerForm as any).machine_id || null,
        shift: (headerForm as any).shift || null,
        department: (headerForm as any).department || null,
        production_id: (headerForm as any).production_id || (headerForm as any).production_ref || null,
        production_ref: (headerForm as any).production_ref || null,
        created_at: headerForm.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log("[INSPECTION REGISTER - FULL PAYLOAD BEFORE DATABASE SAVE]", masterPayload);
      console.log("[INSPECTION REGISTER - FRONTEND BEFORE SAVE & PRODUCTION VALIDATION]", {
        timestamp: new Date().toISOString(),
        cleanMrNo,
        arrival_no: headerForm.arrival_no,
        po_no: headerForm.po_no,
        production_id: masterPayload.production_id,
        production_ref: masterPayload.production_ref,
        mandatoryFieldsCheck: {
          mr_no: cleanMrNo,
          mr_date: resolvedMrDate,
          arrival_no: headerForm.arrival_no || cleanMrNo,
          arrival_date: resolvedArrivalDate,
          supplier_name: headerForm.supplier_name || "",
          broker_name: headerForm.broker_name || "",
          unit: masterPayload.unit,
          status: masterPayload.status
        },
        detailRowsCount: validDetails.length,
        deductionsCount: deductionRows.length
      });

      let savedDbRecord: any = null;
      let apiSuccess = false;
      let affectedRows = 0;

      // Primary Save Flow: Attempt Backend API route unless on static hosting (e.g. GitHub Pages)
      const isStaticHost = typeof window !== "undefined" && (
        window.location.hostname.includes("github.io") ||
        window.location.protocol === "file:" ||
        window.location.hostname.endsWith(".pages.dev")
      );

      if (!isStaticHost) {
        try {
          const response = await fetch("/api/inspection-register/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(masterPayload)
          });

          if (response.ok) {
            const resJson = await response.json();
            const isSuccess = Boolean(resJson && resJson.success === true);
            const rowCount = Number(resJson?.affectedRows ?? resJson?.rowCount ?? (resJson?.data ? 1 : 0));
            const returnedId = resJson?.recordId || resJson?.data?.id || resJson?.data?.mr_no;

            if (isSuccess && rowCount > 0 && resJson.data && returnedId && !resJson.error) {
              savedDbRecord = resJson.data;
              affectedRows = rowCount;
              apiSuccess = true;
            } else {
              const errMsg = resJson?.error || "Unable to save Inspection Module Register. Database returned invalid record ID or 0 affected rows. Data was not saved.";
              alert(errMsg);
              return;
            }
          } else if (response.status === 405 || response.status === 404 || response.status === 502) {
            // Method Not Allowed / Not Found on static host or GitHub Pages - seamlessly continue to direct Supabase
            console.warn(`[INSPECTION SAVE] Backend endpoint returned ${response.status} (static host/proxy). Switching automatically to direct Supabase transaction.`);
          } else if (response.status === 422 || response.status === 400) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData?.error || `Unable to save Inspection Module Register. Server returned status ${response.status}.`;
            alert(errMsg);
            return;
          } else {
            console.warn(`[INSPECTION SAVE] Backend API returned status ${response.status}, switching to direct Supabase transaction.`);
          }
        } catch (netErr) {
          console.warn("[INSPECTION SAVE] Backend API route unreachable, executing direct verified Supabase transaction:", netErr);
        }
      }

      // Supabase Direct Transaction (for GitHub Pages / static hosting or when API route unreachable)
      if (!apiSuccess && supabase) {
        // Step 0: Verify that the production row actually exists before allowing the INSERT/UPDATE ONLY IF a valid production_id is present
        const prodIdToCheck = String(masterPayload.production_id || masterPayload.production_ref || "").trim();
        if (prodIdToCheck && prodIdToCheck !== "null" && prodIdToCheck !== "undefined") {
          const { data: pCheck } = await supabase
            .from("production_records")
            .select("id, batch_no, production_no, lot_no")
            .or(`id.eq.${prodIdToCheck},batch_no.eq.${prodIdToCheck},production_no.eq.${prodIdToCheck},lot_no.eq.${prodIdToCheck}`)
            .limit(1)
            .maybeSingle();

          if (!pCheck) {
            throw new Error(`Unable to save Inspection Module Register: Required Production row '${prodIdToCheck}' not found in database.`);
          }
        }

        // Resilient save to material_inspection
        const masterSaveRes = await resilientSupabaseUpsert(supabase, "material_inspection", masterPayload, "mr_no");
        savedDbRecord = masterSaveRes;
        affectedRows = 1;

        // Child Details
        try {
          await supabase.from("material_inspection_details").delete().eq("mr_no", cleanMrNo);
          if (validDetails.length > 0) {
            await resilientSupabaseInsertRows(supabase, "material_inspection_details", validDetails);
          }
        } catch (cErr) {
          console.warn("Child details error:", cErr);
        }

        // All Deduction Fields for material_inspection_deductions
        try {
          const calculatedAvgBaleWeight = totalBalesCount > 0 ? (totalReceiptGrossMt * 1000) / totalBalesCount : 0;

          // Build complete deduction records with ALL fields from this app
          const allDeductionRows = deductionRows
            .filter(r => (r.deduction_type && r.deduction_type.trim() !== "") || Number(r.deduction_amount) > 0 || Number(r.deduction_rate) > 0)
            .map(r => ({
              mr_no: cleanMrNo,
              mr_date: resolvedMrDate,
              po_no: headerForm.po_no || null,
              po_date: resolvedPoDate,
              arrival_no: headerForm.arrival_no || cleanMrNo,
              arrival_date: resolvedArrivalDate,
              supplier: headerForm.supplier_name || "",
              supplier_name: headerForm.supplier_name || "",
              broker: headerForm.broker_name || "",
              broker_name: headerForm.broker_name || "",
              lorry_number: headerForm.lorry_number || "",
              deduction_type: r.deduction_type || "",
              deduction_rate: Number(r.deduction_rate) || 0,
              deduction_qty: Number(r.deduction_qty) || 0,
              deduction_amount: Number(r.deduction_amount) || 0,
              unit: (headerForm as any).unit_name || validDetails[0]?.unit || "BALES",
              gross_weight_mt: totalReceiptGrossMt,
              total_bales: totalBalesCount,
              avg_bale_weight: calculatedAvgBaleWeight,
              remarks: (r as any).remarks || headerForm.remarks || "",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));

          // Primary Table: material_inspection_deductions
          await supabase.from("material_inspection_deductions").delete().eq("mr_no", cleanMrNo);
          if (allDeductionRows.length > 0) {
            await resilientSupabaseInsertRows(supabase, "material_inspection_deductions", allDeductionRows);
          }

          // Also sync to mill_inspection_deduction for compatibility
          try {
            await supabase.from("mill_inspection_deduction").delete().eq("mr_no", cleanMrNo);
            if (allDeductionRows.length > 0) {
              await resilientSupabaseInsertRows(supabase, "mill_inspection_deduction", allDeductionRows);
            }
          } catch (mErr) {}
        } catch (allDedErr) {
          console.warn("Error persisting deductions:", allDedErr);
        }

        try {
          const mrNoKey = cleanMrNo;
          const arrNoKey = headerForm.arrival_no ? headerForm.arrival_no.trim() : "";
          if (mrNoKey) {
            await supabase.from("final_arrival").update({
              status: "Completed",
              grid_details: validDetails
            }).or(`mr_no.eq.${mrNoKey},final_arrival_no.eq.${mrNoKey}${arrNoKey ? `,final_arrival_no.eq.${arrNoKey}` : ""}`);
          }
        } catch (faErr) {}

        // Verification Query
        const { data: verifiedRow, error: verifyErr } = await supabase
          .from("material_inspection")
          .select("*")
          .eq("mr_no", cleanMrNo)
          .maybeSingle();

        if (verifyErr || !verifiedRow) {
          throw new Error("Unable to save Inspection Module Register. Data was not saved in database.");
        }
        savedDbRecord = verifiedRow;
      }

      // Check strictly: Only proceed if record exists, has a valid ID, and affected rows > 0
      const validRecordId = savedDbRecord?.mr_no || savedDbRecord?.id;
      if (!savedDbRecord || !validRecordId || affectedRows <= 0) {
        throw new Error("Unable to save Inspection Module Register. Database returned invalid record ID or 0 affected rows. Data was not saved.");
      }

      // Step 9: Commit verified - Update in-memory state, caches and show success
      const finalCommittedRecord = savedDbRecord || masterPayload;

      console.log("[INSPECTION REGISTER - FRONTEND AFTER SAVE SUCCESS & VERIFIED]", {
        timestamp: new Date().toISOString(),
        status: "COMMITTED",
        recordId: validRecordId,
        affectedRows,
        mr_no: cleanMrNo,
        savedRecord: finalCommittedRecord
      });

      setRecords(prev => {
        const filtered = prev.filter(r => r.mr_no !== finalCommittedRecord.mr_no && (r.arrival_no ? r.arrival_no !== finalCommittedRecord.arrival_no : true));
        return [finalCommittedRecord, ...filtered];
      });

      try {
        localStorage.setItem(`inspection_deductions_${finalCommittedRecord.mr_no}`, JSON.stringify(deductionRows));
        const cached = localStorage.getItem("material_inspection_records") || localStorage.getItem("inspection_master_records");
        let list: InspectionMasterRecord[] = cached ? JSON.parse(cached) : [];
        list = [finalCommittedRecord, ...list.filter((r: any) => r.mr_no !== finalCommittedRecord.mr_no)];
        localStorage.setItem("material_inspection_records", JSON.stringify(list));
        localStorage.setItem("inspection_master_records", JSON.stringify(list));
      } catch (e) {}

      window.dispatchEvent(new Event("app-data-updated"));
      // Strictly fire the alert only after successful database response with valid record ID and affected rows > 0
      alert("Data Saved Successfully.");
      showToast("Data Saved Successfully.");
      setViewMode("dashboard");
      fetchInspectionRecords();

    } catch (err: any) {
      console.error("Save failure:", err);
      // On failure, keep the entered information in headerForm and detailRows so user can correct and retry
      alert(err.message || "Unable to save Inspection Module Register. Data was not saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async (mr_no: string) => {
    if (!confirm(`Are you sure you want to delete inspection record ${mr_no}? This will remove it from all inspection tables.`)) return;
    try {
      if (supabase) {
        // Cascade delete: first remove child details & deductions, then remove master
        await Promise.all([
          supabase.from("material_inspection_details").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("material_inspection_deductions").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("mill_inspection_deduction").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
        ]);
        await supabase.from("material_inspection").delete().eq("mr_no", mr_no);
      }
      setRecords(prev => prev.filter(r => r.mr_no !== mr_no));
      try {
        localStorage.removeItem(`inspection_deductions_${mr_no}`);
        const cached = localStorage.getItem("material_inspection_records") || localStorage.getItem("inspection_master_records");
        if (cached) {
          const list = JSON.parse(cached).filter((r: any) => r.mr_no !== mr_no);
          localStorage.setItem("material_inspection_records", JSON.stringify(list));
        }
        localStorage.removeItem("AUTOSAVE_MATERIAL_INSPECTION");
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: 'material_inspection', mr_no } }));
      window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: 'material_inspection_details', mr_no } }));

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
      (r.arrival_no || "").toLowerCase().includes(query) ||
      (r.po_no || "").toLowerCase().includes(query) ||
      (r.supplier_name || "").toLowerCase().includes(query) ||
      (r.broker_name || "").toLowerCase().includes(query) ||
      (r.lorry_number || "").toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "all" ||
      (r.status || "Completed").toLowerCase() === statusFilter.toLowerCase();

    return matchesQuery && matchesStatus;
  }).sort((a, b) => {
    if (sortField === "arrival_date") {
      const dateA = new Date(a.arrival_date || a.mr_date || 0).getTime();
      const dateB = new Date(b.arrival_date || b.mr_date || 0).getTime();
      if (dateA !== dateB) {
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      }
    } else if (sortField === "arrival_no") {
      const arrNoA = (a.arrival_no || a.mr_no || '').toUpperCase();
      const arrNoB = (b.arrival_no || b.mr_no || '').toUpperCase();
      const diff = arrNoA.localeCompare(arrNoB, undefined, { numeric: true, sensitivity: 'base' });
      if (diff !== 0) {
        return sortOrder === "asc" ? diff : -diff;
      }
    } else if (sortField === "status") {
      const statusA = (a.status || 'Completed').toUpperCase();
      const statusB = (b.status || 'Completed').toUpperCase();
      const diff = statusA.localeCompare(statusB);
      if (diff !== 0) {
        return sortOrder === "asc" ? diff : -diff;
      }
    }

    const defaultTimeA = new Date(a.arrival_date || a.mr_date || 0).getTime();
    const defaultTimeB = new Date(b.arrival_date || b.mr_date || 0).getTime();
    return defaultTimeB - defaultTimeA;
  });

  const totalInspections = records.length;
  const avgMoisture = records.length > 0 ? (records.reduce((acc, r) => acc + (Number(r.actual_moisture) || 0), 0) / records.length).toFixed(1) : "0.0";
  const totalDeductions = records.reduce((acc, r) => acc + (Number(r.deduction_amount) || 0), 0);

  const pendingArrivalList = useMemo(() => {
    return finalArrivalList.filter(fa => {
      const normalize = (s: any) => String(s || "").trim().toLowerCase().replace(/^#/, '');

      const faNo = normalize(fa.final_arrival_no || fa.arrival_no);
      const faMrNo = normalize(fa.mr_no);
      const faId = normalize(fa.final_arrival_id);
      const faTempNo = normalize(fa.temporary_arrival_no);
      const faLorry = String(fa.lorry_number || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

      const isAlreadyInspected = records.some(r => {
        const rMr = normalize(r.mr_no);
        const rArr = normalize(r.arrival_no);
        const rTemp = normalize((r as any).temporary_arrival_no);
        const rLorry = String(r.lorry_number || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

        if (faNo && (rMr === faNo || rArr === faNo)) return true;
        if (faMrNo && (rMr === faMrNo || rArr === faMrNo)) return true;
        if (faId && (rMr === faId || rArr === faId || rMr === `fa-${faId}` || rArr === `fa-${faId}`)) return true;
        if (faTempNo && (rTemp === faTempNo || rMr === faTempNo || rArr === faTempNo)) return true;

        if (faLorry && rLorry && faLorry === rLorry) {
          if (faNo && (rMr.includes(faNo) || rArr.includes(faNo))) return true;
          if (faMrNo && (rMr.includes(faMrNo) || rArr.includes(faMrNo))) return true;
        }

        return false;
      });

      return !isAlreadyInspected;
    });
  }, [finalArrivalList, records]);

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
        <InspectionActionBar
          viewMode={viewMode}
          onBack={() => setViewMode("dashboard")}
          onOpenNewForm={handleOpenNewForm}
          onRefresh={() => fetchInspectionRecords(true)}
          loading={loading}
        />

        {/* VIEW MODE SWITCH */}
        {viewMode === "dashboard" ? (
          <InspectionRegisterView
            filteredRecords={filteredRecords}
            loading={loading}
            totalInspections={totalInspections}
            avgMoisture={avgMoisture}
            totalDeductions={totalDeductions}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sortField={sortField}
            sortOrder={sortOrder}
            onToggleSort={(field) => {
              if (field === sortField) {
                setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
              } else {
                setSortField(field as any);
                setSortOrder("desc");
              }
            }}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onExportCsv={handleExportCsv}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            onEditRecord={handleEditRecord}
            onPrintRecord={handlePrintRecord}
            onDeleteRecord={handleDeleteRecord}
          />
        ) : (
          <div className="space-y-6">
            {/* HEADER / MILL INFORMATION SECTION */}
            <InspectionHeaderCard
              headerForm={headerForm}
              onHeaderChange={handleHeaderChange}
              pendingArrivalList={pendingArrivalList}
              onSelectPendingArrival={populateFromFinalArrival}
            />

            {/* DEDUCTIONS & PENALTIES CARD */}
            {(() => {
              const { matchedDeductions, baleAudit } = calculateAllMatchingDeductions(
                detailRows,
                headerForm,
                deductionMasterList
              );
              return (
                <InspectionDeductionsTable
                  deductionRows={deductionRows}
                  deductionMasterList={deductionMasterList}
                  totalDeductionAmount={headerForm.deduction_amount || 0}
                  matchedDeductions={matchedDeductions}
                  baleAudit={baleAudit}
                  onAddDeductionRow={handleAddDeductionRow}
                  onRemoveDeductionRow={handleRemoveDeductionRow}
                  onDeductionChange={handleDeductionChange}
                  onDeductionTypeChange={handleDeductionTypeChange}
                />
              );
            })()}

            {/* INSPECTION DETAILS WIDE TABLE SECTION */}
            <InspectionDetailsTable
              detailRows={detailRows}
              headerForm={headerForm}
              isSaving={isSaving}
              onDetailChange={handleDetailChange}
              onToggleExpand={handleToggleExpand}
              onDuplicateRow={handleDuplicateRow}
              onDeleteRow={handleDeleteRow}
              onAddRow={handleAddRow}
              onPrintRecord={() => handlePrintRecord(headerForm)}
              onSaveForm={handleSaveForm}
            />
          </div>
        )}

                {/* PRINT MODAL (MARKS & QUALITY RECEIVED - MILL COPY) */}
        <PrintModal
          isOpen={printingRecord !== null}
          onClose={() => setPrintingRecord(null)}
          title={`MARKS & QUALITY RECEIVED - M.R. NO: ${printingRecord?.mr_no || ""}`}
          copyType={copyType}
          setCopyType={setCopyType}
        >
          {printingRecord && (
            <InspectionPrintSlip
              master={printingRecord}
              details={printingDetails}
              copyType={copyType}
            />
          )}
        </PrintModal>

      </div>
    </LegacyLayout>
  );
}
