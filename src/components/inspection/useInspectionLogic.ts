import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLiveAutoRefresh } from "../../hooks/useLiveAutoRefresh";
import { supabase } from "../../lib/supabase";
import { dbModule } from "../../services/dbModule";
import {
  DeductionRow,
  InspectionMasterRecord,
  InspectionDetailRow,
} from "../../types/inspection.types";
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
} from "../../utils/inspectionCalculations";

export function useInspectionLogic() {
  const [records, setRecords] = useState<InspectionMasterRecord[]>([]);
  const [finalArrivalList, setFinalArrivalList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const isFetchingRecordsRef = useRef<boolean>(false);
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

  const isBaleWeightDeductionRule = (name: string) => {
    const n = String(name || "").trim().toUpperCase();
    return (n.includes("BALE") || n.includes("BALES")) && (n.includes("LESS THAN") || n.includes("WEIGHT") || n.includes("<"));
  };

  const applyAllAutoDeductions = (
    details: InspectionDetailRow[],
    hForm: Partial<InspectionMasterRecord>,
    dMaster: any[]
  ) => {
    const { matchedDeductions } = calculateAllMatchingDeductions(details, hForm, dMaster);

    setDeductionRows(prevRows => {
      let nextRows = [...prevRows];

      matchedDeductions.forEach(matched => {
        const existingIdx = nextRows.findIndex(
          r => r.deduction_type === matched.ruleName || (matched.category === "bale_weight" && isBaleWeightDeductionRule(r.deduction_type || ""))
        );

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

          const miCols = "*";
          const faCols = "*";

          const [miRes, mimRes, faRes, tmrRes, dedPrimaryRes, dedFallbackRes, dMasterRes, moistRes] = await Promise.all([
            withTimeout(Promise.resolve(supabase.from("material_inspection").select(miCols).order("created_at", { ascending: false }))),
            withTimeout(Promise.resolve(supabase.from("mill_inspection_master").select("*").order("created_at", { ascending: false }))).catch(() => ({ data: null })),
            withTimeout(Promise.resolve(supabase.from("final_arrival").select(faCols).order("created_at", { ascending: false }))),
            withTimeout(Promise.resolve(supabase.from("temporary_material_received").select("*").order("created_at", { ascending: false }))).catch(() => ({ data: null })),
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
            faList = [...faRes.data];
          }
          if (tmrRes?.data && Array.isArray(tmrRes.data)) {
            const existingFaNos = new Set(faList.map(f => (f.final_arrival_no || f.temporary_arrival_no || f.arrival_no || '').trim().toUpperCase()).filter(Boolean));
            tmrRes.data.forEach((t: any) => {
              const tNo = (t.temporary_arrival_no || t.arrival_no || '').trim().toUpperCase();
              if (tNo && !existingFaNos.has(tNo)) {
                faList.push({
                  ...t,
                  final_arrival_no: t.temporary_arrival_no || t.arrival_no,
                  arrival_no: t.temporary_arrival_no || t.arrival_no,
                  arrival_date: t.date || t.temporary_arrival_date
                });
                existingFaNos.add(tNo);
              }
            });
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

      setFinalArrivalList(faList);

      const map = new Map<string, InspectionMasterRecord>();
      inspectionList.forEach(rec => {
        const k = (rec.mr_no || rec.arrival_no || "").trim().toUpperCase();
        if (k) map.set(k, rec);
      });

      faList.forEach(fa => {
        const mrKey = (fa.mr_no || "").trim().toUpperCase();
        const arrKey = (fa.final_arrival_no || fa.arrival_no || "").trim().toUpperCase();
        const existing = (mrKey && map.get(mrKey)) || (arrKey && map.get(arrKey));

        if (existing) {
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
  }

  useEffect(() => {
    fetchInspectionRecords();
  }, []);

  useLiveAutoRefresh(fetchInspectionRecords, [], { tables: ['material_inspection', 'material_inspection_details', 'final_arrival', 'purchase_master', 'purchase_detail_master', 'temporary_material_received', 'moisture_logic', 'deduction_master'] });

  const loadDetailsForPo = async (poNo: string, overrideArrivalData?: any) => {
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

        if (pmRes.data && pmRes.data.length > 0) {
          pmData = pmRes.data[0];
          const pm = pmData;
          setHeaderForm(prev => ({
            ...prev,
            po_no: pm.po_no || prev.po_no,
            po_date: sanitizeDate(pm.po_date || pm.date) || prev.po_date,
            supplier_name: pm.supplier || pm.challan_supplier || pm.supplier_name || prev.supplier_name,
            broker_name: pm.broker || pm.broker_name || prev.broker_name,
            lorry_number: pm.lorry_no || pm.lorry_number || prev.lorry_number
          }));
        } else if (scpHeaderRes.data && scpHeaderRes.data.length > 0) {
          const scp = scpHeaderRes.data[0];
          pmData = scp;
          setHeaderForm(prev => ({
            ...prev,
            po_no: scp.po_no || prev.po_no,
            po_date: sanitizeDate(scp.po_date || scp.s_date) || prev.po_date,
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
        let resolvedUnitName = (pmData?.unit_name || pmData?.unit || overrideArrivalData?.unit_name || overrideArrivalData?.unit || "").toString().trim().toUpperCase();
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
          const gradeCode = String(item.grade_code || item.receipt_grade_code || item.stock_grade_code || item.item_code || "").trim();
          const resolvedGradeName = item.receipt_grade_name || item.challan_grade_name || item.grade_name || item.variety || item.item_name || item.grade || gradeMap[gradeCode] || gradeCode || "";
          const agencyCode = String(item.agency_code || "").trim();
          const resolvedAgencyName = item.agency_name || item.agency || agencyMap[agencyCode] || agencyCode || "";
          const markaCode = String(item.marka_code || item.challan_marka_code || "").trim();
          const resolvedMarkaName = item.marka_name || item.challan_marka_name || item.marka || item.marks || markaMap[markaCode] || markaCode || "";
          const areaName = (item.area_name || item.area || item.arrival_area_name || item.arrival_area || overrideArrivalData?.arrival_area_name || overrideArrivalData?.area || "").toUpperCase();
          const nettoVal = Number(item.netto_pnto !== undefined && item.netto_pnto !== null && item.netto_pnto !== "" ? item.netto_pnto : (item.weight_mt || item.quantity_mt || item.challan_gross_wt || item.receipt_gross_wt || item.gross_weight || item.weight || item.net_wt || 0));
          let qtyVal = 0;
          if (item.quantity_rcpt !== undefined && item.quantity_rcpt !== null && item.quantity_rcpt !== "" && Number(item.quantity_rcpt) > 0) {
            qtyVal = Number(item.quantity_rcpt);
          } else if (item.quantity_chln !== undefined && item.quantity_chln !== null && item.quantity_chln !== "" && Number(item.quantity_chln) > 0) {
            qtyVal = Number(item.quantity_chln);
          } else if (item.quantity !== undefined && item.quantity !== null && item.quantity !== "" && Number(item.quantity) > 0) {
            qtyVal = Number(item.quantity);
          } else if (item.bales !== undefined && item.bales !== null && item.bales !== "" && Number(item.bales) > 0) {
            qtyVal = Number(item.bales);
          }
          const itemUnit = (item.unit || item.unit_name || "").toString().trim().toUpperCase();
          const unitVal = (itemUnit && itemUnit !== "BALES") ? itemUnit : (resolvedUnitName || itemUnit || "BALES");
          const rateVal = Number(item.rate_qntl || item.rate || item.po_rate || 0);

          const row: InspectionDetailRow = {
            srl_no: item.srl_no || (i + 1),
            arrival_grade: resolvedGradeName,
            stock_grade_code: gradeCode,
            stock_grade_name: resolvedGradeName,
            area: areaName,
            agency: resolvedAgencyName,
            agency_code: agencyCode,
            marks: resolvedMarkaName,
            crop_year: item.crop_year || "2026-27",
            lot: item.lot || item.lot_no || item.lot_number || "",
            quantity: qtyVal,
            unit: unitVal,
            rate: rateVal,
            rate_qntl: rateVal,
            challan_gross_wt: nettoVal,
            receipt_gross_wt: nettoVal,
            gross_weight_batch: nettoVal,
            add_weight: Number(item.add_weight || 0),
            less_weight: Number(item.less_weight || 0),
            tolerable: "Yes",
            expanded: false,
            is_auto: true
          };

          const computedWeights = computeDetailRowWeights(row);
          Object.assign(row, computedWeights);
          row.qty_in_mt = calculateQtyInMt(row);
          row.amount = calculateRowAmount(row);

          return row;
        });

        if (details.length > 0) {
          setDetailRows(details);
          showToast(`Loaded ${details.length} PO detail rows.`);
        }
      }
    } catch (e) {
      console.warn("Could not load PO details:", e);
    }
  };

  const populateFromFinalArrival = async (fa: any) => {
    try {
      const arrNo = fa.final_arrival_no || fa.arrival_no || fa.temporary_arrival_no || fa.mr_no || "";
      const isLoose = (fa.unit_name || fa.unit_code || fa.unit || "").toString().trim().toUpperCase().includes("LOOSE");
      const resolvedUnit = isLoose ? "LOOSE" : (fa.unit_name || fa.unit || "BALES");
      const resolvedArea = fa.arrival_area_name || fa.area || fa.arrival_area || "";

      // 1. Update Header Form with full details from the selected arrival
      setHeaderForm(prev => {
        const next: InspectionMasterRecord = {
          ...prev,
          arrival_no: arrNo,
          arrival_date: sanitizeDate(fa.arrival_date || fa.final_arrival_date || fa.date || fa.temporary_arrival_date) || prev.arrival_date,
          po_no: fa.po_no || prev.po_no,
          po_date: sanitizeDate(fa.po_date || fa.date) || prev.po_date,
          supplier_name: fa.supplier || fa.challan_supplier || fa.supplier_name || prev.supplier_name,
          broker_name: fa.broker || fa.broker_name || prev.broker_name,
          lorry_number: fa.lorry_number || fa.lorry_no || prev.lorry_number,
          arrival_area: resolvedArea || prev.arrival_area,
          arrival_area_name: resolvedArea || prev.arrival_area_name,
          unit_name: resolvedUnit,
          unloading_date: sanitizeDate(fa.unloading_date || fa.arrival_date || fa.date) || prev.unloading_date,
          actual_moisture: Number(fa.actual_moisture) || prev.actual_moisture || 0,
          claim_moisture: Number(fa.claim_moisture) || prev.claim_moisture || 0,
          actual_dust: Number(fa.actual_dust) || prev.actual_dust || 0,
          claim_dust: Number(fa.claim_dust) || prev.claim_dust || 0,
          actual_ncv: Number(fa.actual_ncv) || prev.actual_ncv || 0,
          claim_ncv: Number(fa.claim_ncv) || prev.claim_ncv || 0,
          detention_days: Number(fa.detention_days) || prev.detention_days || 0,
          mr_spcl_print: fa.mr_spcl_print || prev.mr_spcl_print || "",
          remarks: fa.remarks || prev.remarks || ""
        };

        if (next.actual_moisture > 0 && (!next.claim_moisture || next.claim_moisture === 0)) {
          next.claim_moisture = calculateClaimMoisture(
            Number(next.actual_moisture) || 0,
            next.arrival_date,
            next.arrival_area || next.arrival_area_name || "",
            moistureLogicRules
          );
        }
        return next;
      });

      // 2. Extract detail items from fa.grid_details
      let rawGridItems: any[] = [];
      if (fa.grid_details) {
        if (Array.isArray(fa.grid_details)) {
          rawGridItems = fa.grid_details;
        } else if (typeof fa.grid_details === 'string') {
          try {
            const parsed = JSON.parse(fa.grid_details);
            if (Array.isArray(parsed)) rawGridItems = parsed;
          } catch (e) {}
        }
      }

      // If grid_details was not embedded, query Supabase for arrival record details
      if (rawGridItems.length === 0 && supabase) {
        try {
          const arrClean = arrNo.trim();
          const [faDbRes, tmrDbRes, fadRes, tmdRes] = await Promise.all([
            arrClean ? supabase.from('final_arrival').select('*').or(`final_arrival_no.eq.${arrClean},arrival_no.eq.${arrClean},temporary_arrival_no.eq.${arrClean}`).maybeSingle() : Promise.resolve({ data: null }),
            arrClean ? supabase.from('temporary_material_received').select('*').eq('temporary_arrival_no', arrClean).maybeSingle() : Promise.resolve({ data: null }),
            arrClean ? supabase.from('final_arrival_details').select('*').eq('final_arrival_no', arrClean) : Promise.resolve({ data: null }),
            arrClean ? supabase.from('temporary_material_details').select('*').eq('temporary_arrival_no', arrClean) : Promise.resolve({ data: null })
          ]);

          const foundFa = faDbRes.data;
          const foundTmr = tmrDbRes.data;

          if (foundFa?.grid_details) {
            const parsed = typeof foundFa.grid_details === 'string' ? JSON.parse(foundFa.grid_details) : foundFa.grid_details;
            if (Array.isArray(parsed) && parsed.length > 0) rawGridItems = parsed;
          } else if (foundTmr?.grid_details) {
            const parsed = typeof foundTmr.grid_details === 'string' ? JSON.parse(foundTmr.grid_details) : foundTmr.grid_details;
            if (Array.isArray(parsed) && parsed.length > 0) rawGridItems = parsed;
          } else if (fadRes.data && Array.isArray(fadRes.data) && fadRes.data.length > 0) {
            rawGridItems = fadRes.data;
          } else if (tmdRes.data && Array.isArray(tmdRes.data) && tmdRes.data.length > 0) {
            rawGridItems = tmdRes.data;
          }
        } catch (e) {
          console.warn("DB lookup error for arrival details:", e);
        }
      }

      // If we have arrival grid items, map them to InspectionDetailRow
      if (rawGridItems.length > 0) {
        let gradeMap: Record<string, string> = {};
        let agencyMap: Record<string, string> = {};
        let markaMap: Record<string, string> = {};

        if (supabase) {
          const [gradesRes, agenciesRes, markasRes] = await Promise.all([
            supabase.from('grade_master').select('*'),
            supabase.from('agency_master').select('*'),
            supabase.from('marka_master').select('*')
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
        }

        const details: InspectionDetailRow[] = rawGridItems.map((item: any, i: number) => {
          const gradeCode = String(item.receipt_grade_code || item.grade_code || item.stock_grade_code || item.item_code || "").trim();
          const resolvedGradeName = item.receipt_grade_name || item.challan_grade_name || item.grade_name || item.variety || item.grade || item.item_name || gradeMap[gradeCode] || gradeCode || "";

          const agencyCode = String(item.agency_code || "").trim();
          const resolvedAgencyName = item.agency_name || item.agency || agencyMap[agencyCode] || agencyCode || "";

          const markaCode = String(item.challan_marka_code || item.marka_code || "").trim();
          const resolvedMarkaName = item.challan_marka_name || item.marka_name || item.marks || item.marka || markaMap[markaCode] || markaCode || "";

          const areaName = (item.area_name || item.area || item.arrival_area_name || item.arrival_area || fa.arrival_area_name || fa.area || resolvedArea || "").toUpperCase();

          const qtyChln = Number(item.quantity_chln || 0);
          const qtyRcpt = Number(item.quantity_rcpt || 0);
          const qtyVal = qtyRcpt > 0 ? qtyRcpt : (qtyChln > 0 ? qtyChln : Number(item.quantity || item.bales || item.total_packets || item.qty || 0));

          const nettoVal = Number(
            item.netto_pnto !== undefined && item.netto_pnto !== null && item.netto_pnto !== ""
              ? item.netto_pnto
              : (item.weight_mt || item.quantity_mt || item.challan_gross_wt || item.receipt_gross_wt || item.gross_weight || item.weight || (item.weight_kgs ? Number(item.weight_kgs) / 1000 : 0))
          );

          const itemUnit = (item.unit || item.unit_name || fa.unit_name || fa.unit || resolvedUnit || "BALES").toString().trim().toUpperCase();
          const rateVal = Number(item.rate_qntl || item.rate || item.po_rate || 0);

          const row: InspectionDetailRow = {
            srl_no: item.srl_no || (i + 1),
            arrival_grade: resolvedGradeName,
            stock_grade_code: gradeCode,
            stock_grade_name: resolvedGradeName,
            area: areaName,
            agency: resolvedAgencyName,
            agency_code: agencyCode,
            marks: resolvedMarkaName,
            crop_year: item.crop_year || "2026-27",
            lot: item.lot || item.lot_no || item.lot_number || "",
            quantity: qtyVal,
            unit: itemUnit,
            rate: rateVal,
            rate_qntl: rateVal,
            challan_gross_wt: nettoVal,
            receipt_gross_wt: nettoVal,
            gross_weight_batch: nettoVal,
            add_weight: Number(item.add_weight || 0),
            less_weight: Number(item.less_weight || 0),
            tolerable: "Yes",
            expanded: false,
            is_auto: true
          };

          const computedWeights = computeDetailRowWeights(row);
          Object.assign(row, computedWeights);
          row.qty_in_mt = calculateQtyInMt(row);
          row.amount = calculateRowAmount(row);

          return row;
        });

        const validDetails = details.filter(r => Boolean(r.arrival_grade || r.stock_grade_name || (Number(r.quantity) > 0) || (Number(r.challan_gross_wt) > 0)));
        if (validDetails.length > 0) {
          setDetailRows(validDetails);
          showToast(`Loaded ${validDetails.length} arrival inspection detail rows.`);
          return;
        }
      }

      // Fallback: If no arrival grid items found, load from PO
      if (fa.po_no) {
        await loadDetailsForPo(fa.po_no, fa);
      }
      showToast(`Selected Final Arrival #${arrNo}`);
    } catch (e) {
      console.error("Error populating from final arrival:", e);
    }
  };

  const handleHeaderChange = (field: keyof InspectionMasterRecord, value: any) => {
    setHeaderForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'actual_moisture' || field === 'arrival_date' || field === 'arrival_area') {
        const autoClaim = calculateClaimMoisture(
          Number(next.actual_moisture) || 0,
          next.arrival_date,
          next.arrival_area || next.arrival_area_name || "",
          moistureLogicRules
        );
        next.claim_moisture = autoClaim;
      }
      return next;
    });

    if (field === 'po_no' && value) {
      loadDetailsForPo(String(value));
    }
  };

  const handleDetailChange = (index: number, field: keyof InspectionDetailRow, value: any) => {
    setDetailRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };
      
      // 1. Auto-calculate Lorry Read Avg if Min or Max present
      const lorryMin = Number(row.lorry_read_min) || 0;
      const lorryMax = Number(row.lorry_read_max) || 0;
      if (lorryMin > 0 && lorryMax > 0) {
        //row.lorry_read_avg = Number(((lorryMin + lorryMax) / 2).toFixed(2));
      } else if (lorryMin > 0 || lorryMax > 0) {
        //row.lorry_read_avg = lorryMin || lorryMax;
      }

      // 2. Auto-calculate Inspection Read Avg if Min or Max present
      /* const inspMin = Number(row.insp_read_min) || 0;
      const inspMax = Number(row.insp_read_max) || 0;
      if (inspMin > 0 && inspMax > 0) {
        row.insp_read_avg = Number(((inspMin + inspMax) / 2).toFixed(2));
      } else if (inspMin > 0 || inspMax > 0) {
        row.insp_read_avg = inspMin || inspMax;
      } */

      // 3. Auto-calculate Moisture Actual %
      const lAvg = Number(row.lorry_read_avg) || 0;
      const iAvg = Number(row.insp_read_avg) || 0;
      if (lAvg > 0 && iAvg > 0) {
        //row.moisture_act = Number(((lAvg + iAvg) / 2).toFixed(2));
      } else if (lAvg > 0 || iAvg > 0) {
        //row.moisture_act = lAvg || iAvg;
      }
      const moistureact = Number(row.lorry_read_avg) || 0;

      // 4. Auto-calculate Moisture Claim % based on Moisture Logic Rules
      const dateForRules = String(headerForm.mr_date || headerForm.arrival_date || new Date().toISOString().split('T')[0]);
      row.moisture_claim = calculateClaimMoisture(
        Number(moistureact) || 0,
        dateForRules,
        row.area || "",
        moistureLogicRules
      );

      // 5. Compute Reduced Weight & Final Receipt Weight (Claim)
      const computedWeights = computeDetailRowWeights(row);
      Object.assign(row, computedWeights);

      // 6. Compute Quantity in MT & Row Amount
      row.qty_in_mt = calculateQtyInMt(row);
      row.amount = calculateRowAmount(row);

      updated[index] = row;
      return updated;
    });
  };

  const handleToggleExpand = (index: number) => {
    setDetailRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], expanded: !updated[index].expanded };
      return updated;
    });
  };

  const handleDuplicateRow = (index: number) => {
    setDetailRows(prev => {
      const target = prev[index];
      const clone = { ...target, srl_no: prev.length + 1, id: undefined };
      return [...prev, clone];
    });
    showToast("Duplicated row.");
  };

  const handleDeleteRow = (index: number) => {
    if (detailRows.length <= 1) {
      showToast("Cannot delete last detail row.");
      return;
    }
    setDetailRows(prev => prev.filter((_, i) => i !== index));
    showToast("Row deleted.");
  };

  const handleAddRow = () => {
    setDetailRows(prev => [
      ...prev,
      {
        srl_no: prev.length + 1,
        unit: headerForm.unit_name || "BALES",
        quantity: 0,
        challan_gross_wt: 0,
        tolerable: "Yes",
        expanded: false
      }
    ]);
    showToast("Added new inspection detail row.");
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
    setDeductionRows([
      { id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }
    ]);
    setViewMode("form");
  };

  const handleEditRecord = async (record: InspectionMasterRecord) => {
    setHeaderForm({
      ...record,
      mr_date: sanitizeDate(record.mr_date || record.date),
      arrival_date: sanitizeDate(record.arrival_date || record.mr_date || record.date),
      po_date: sanitizeDate(record.po_date)
    });

    try {
      if (supabase && record.mr_no) {
        const { data: detailsData } = await supabase
          .from("material_inspection_details")
          .select("*")
          .eq("mr_no", record.mr_no)
          .order("srl_no", { ascending: true });

        if (detailsData && detailsData.length > 0) {
          setDetailRows(detailsData.map(d => ({ ...d, expanded: false })));
        } else if (record.grid_details) {
          try {
            const parsed = typeof record.grid_details === 'string' ? JSON.parse(record.grid_details) : record.grid_details;
            if (Array.isArray(parsed) && parsed.length > 0) {
              setDetailRows(parsed.map(d => ({ ...d, expanded: false })));
            }
          } catch (e) {}
        }

        const { data: dedData } = await supabase
          .from("material_inspection_deductions")
          .select("*")
          .eq("mr_no", record.mr_no);

        if (dedData && dedData.length > 0) {
          setDeductionRows(dedData.map((d, idx) => ({
            id: String(d.id || idx),
            deduction_type: d.deduction_type || "",
            deduction_rate: Number(d.deduction_rate) || 0,
            deduction_qty: Number(d.deduction_qty) || 0,
            deduction_amount: Number(d.deduction_amount) || 0,
            remarks: d.remarks || ""
          })));
        } else if (record.deductions && record.deductions.length > 0) {
          setDeductionRows(record.deductions);
        }
      }
    } catch (e) {
      console.warn("Failed to load details for edit:", e);
    }

    setViewMode("form");
  };

  const handlePrintRecord = async (record: InspectionMasterRecord) => {
    setPrintingRecord(record);
    try {
      if (supabase && record.mr_no) {
        const { data } = await supabase
          .from("material_inspection_details")
          .select("*")
          .eq("mr_no", record.mr_no)
          .order("srl_no", { ascending: true });
        setPrintingDetails(data || detailRows);
      } else {
        setPrintingDetails(detailRows);
      }
    } catch (e) {
      setPrintingDetails(detailRows);
    }
  };

  const handleSaveForm = async () => {
    if (!headerForm.mr_no) {
      alert("Inspection MR No is required.");
      return;
    }

    setIsSaving(true);
    try {
      const cleanMrNo = headerForm.mr_no.trim();
      const validDetails = detailRows.filter(r => r.arrival_grade || r.stock_grade_name || (Number(r.challan_gross_wt) > 0) || (Number(r.quantity) > 0));

      const totalReceiptGrossMt = validDetails.reduce((sum, r) => sum + (Number(r.receipt_gross_wt) || Number(r.challan_gross_wt) || 0), 0);
      const totalBalesCount = validDetails.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

      const resolvedArrivalDate = sanitizeDate(headerForm.arrival_date || headerForm.mr_date);
      const resolvedMrDate = sanitizeDate(headerForm.mr_date || headerForm.arrival_date);
      const resolvedPoDate = sanitizeDate(headerForm.po_date);

      const masterPayload = {
        mr_no: cleanMrNo,
        mr_date: resolvedMrDate,
        date: resolvedArrivalDate,
        arrival_no: headerForm.arrival_no || null,
        arrival_date: resolvedArrivalDate,
        po_no: headerForm.po_no || null,
        po_date: resolvedPoDate,
        broker_name: headerForm.broker_name || "",
        supplier_name: headerForm.supplier_name || "",
        lorry_number: headerForm.lorry_number || "",
        actual_moisture: Number(headerForm.actual_moisture) || 0,
        claim_moisture: Number(headerForm.claim_moisture) || 0,
        actual_dust: Number(headerForm.actual_dust) || 0,
        claim_dust: Number(headerForm.claim_dust) || 0,
        actual_ncv: Number(headerForm.actual_ncv) || 0,
        claim_ncv: Number(headerForm.claim_ncv) || 0,
        detention_days: Number(headerForm.detention_days) || 0,
        unloading_date: sanitizeDate(headerForm.unloading_date),
        mill_po_no: headerForm.mill_po_no || "",
        mill_po_date: sanitizeDate(headerForm.mill_po_date),
        mr_spcl_print: headerForm.mr_spcl_print || "",
        remarks: headerForm.remarks || "",
        deduction_type: headerForm.deduction_type || "",
        deduction_rate: Number(headerForm.deduction_rate) || 0,
        deduction_qty: Number(headerForm.deduction_qty) || 0,
        deduction_amount: Number(headerForm.deduction_amount) || 0,
        status: "Completed",
        grid_details: JSON.stringify(validDetails)
      };

      if (supabase) {
        await supabase.from("material_inspection").upsert(masterPayload, { onConflict: "mr_no" });

        // Save Details
        await supabase.from("material_inspection_details").delete().eq("mr_no", cleanMrNo);
        if (validDetails.length > 0) {
          const detailInserts = validDetails.map((d, i) => ({
            mr_no: cleanMrNo,
            srl_no: i + 1,
            arrival_grade: d.arrival_grade || d.stock_grade_name || "",
            stock_grade_code: d.stock_grade_code || "",
            stock_grade_name: d.stock_grade_name || d.arrival_grade || "",
            area: d.area || "",
            agency: d.agency || "",
            marks: d.marks || "",
            crop_year: d.crop_year || "2026-27",
            quantity: Number(d.quantity) || 0,
            unit: d.unit || "BALES",
            rate: Number(d.rate) || 0,
            challan_gross_wt: Number(d.challan_gross_wt) || 0,
            receipt_gross_wt: Number(d.receipt_gross_wt) || Number(d.challan_gross_wt) || 0,
            actual_moisture: Number(headerForm.actual_moisture) || 0,
            actual_dust: Number(headerForm.actual_dust) || 0,
            actual_ncv: Number(headerForm.actual_ncv) || 0,
            created_at: new Date().toISOString()
          }));
          await supabase.from("material_inspection_details").insert(detailInserts);
        }

        // Save Deductions
        const activeDeductions = deductionRows.filter(r => r.deduction_type && r.deduction_type.trim() !== "");
        await supabase.from("material_inspection_deductions").delete().eq("mr_no", cleanMrNo);
        if (activeDeductions.length > 0) {
          const dedInserts = activeDeductions.map(r => ({
            mr_no: cleanMrNo,
            deduction_type: r.deduction_type,
            deduction_rate: Number(r.deduction_rate) || 0,
            deduction_qty: Number(r.deduction_qty) || 0,
            deduction_amount: Number(r.deduction_amount) || 0,
            remarks: r.remarks || "",
            created_at: new Date().toISOString()
          }));
          await supabase.from("material_inspection_deductions").insert(dedInserts);
        }
      }

      alert("Data Saved Successfully.");
      showToast("Data Saved Successfully.");
      setViewMode("dashboard");
      fetchInspectionRecords(true);
    } catch (err: any) {
      alert("Save failed: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async (mr_no: string) => {
    if (!confirm(`Are you sure you want to delete inspection record ${mr_no}?`)) return;
    try {
      if (supabase) {
        await Promise.all([
          supabase.from("material_inspection_details").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("material_inspection_deductions").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("mill_inspection_deduction").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
        ]);
        await supabase.from("material_inspection").delete().eq("mr_no", mr_no);
      }
      setRecords(prev => prev.filter(r => r.mr_no !== mr_no));
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

  return {
    records,
    filteredRecords,
    loading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    toastMessage,
    isSaving,
    sortField,
    sortOrder,
    setSortField,
    setSortOrder,
    copyType,
    setCopyType,
    printingRecord,
    setPrintingRecord,
    printingDetails,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    headerForm,
    detailRows,
    deductionRows,
    deductionMasterList,
    totalInspections,
    avgMoisture,
    totalDeductions,
    pendingArrivalList,
    fetchInspectionRecords,
    handleHeaderChange,
    handleDetailChange,
    handleToggleExpand,
    handleDuplicateRow,
    handleDeleteRow,
    handleAddRow,
    handleOpenNewForm,
    handleEditRecord,
    handlePrintRecord,
    handleSaveForm,
    handleDeleteRecord,
    handleExportCsv,
    populateFromFinalArrival,
    handleAddDeductionRow,
    handleRemoveDeductionRow,
    handleDeductionChange,
    handleDeductionTypeChange
  };
}
