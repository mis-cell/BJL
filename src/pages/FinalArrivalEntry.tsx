import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  X, 
  Plus, 
  Trash2, 
  RefreshCw,
  Archive,
  ChevronDown,
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Amad, ArrivalDetailRow } from '../types';
import { dbModule } from '../services/dbModule';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { enforceEditOrDeletePermission } from '../lib/permissions';
import { supabase } from '../lib/supabase';

interface FinalArrivalEntryProps {
  onSave?: (d: any) => void;
  onCancel?: () => void;
  initialData?: any;
}

export default function FinalArrivalEntry({ onSave, onCancel, initialData }: FinalArrivalEntryProps) {
  const [loading, setLoading] = useState(false);
  const [showPoDropdown, setShowPoDropdown] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  useKeyboardNavigation(containerRef, () => {
    handleSave();
  });

  const [brokers, setBrokers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [markas, setMarkas] = useState<any[]>([]);
  const [inspectionsList, setInspectionsList] = useState<any[]>([]);
  const [existingArrivals, setExistingArrivals] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  const getPaddedDetails = (initialFA?: any) => {
    let pDetails: ArrivalDetailRow[] = [];
    if (initialFA && initialFA.grid_details) {
      if (typeof initialFA.grid_details === 'string') {
        try {
          const parsed = initialFA.grid_details === 'undefined' || initialFA.grid_details === 'null' ? [] : JSON.parse(initialFA.grid_details === "undefined" ? "null" : initialFA.grid_details);
          if (Array.isArray(parsed)) {
            pDetails = parsed;
          }
        } catch (e) {
          console.error("Error parsing grid_details JSON:", e);
        }
      } else if (Array.isArray(initialFA.grid_details)) {
        pDetails = initialFA.grid_details;
      }
    }
    
    // Backfill quantity_chln and quantity_rcpt from netto_pnto if missing
    pDetails = pDetails.map(d => {
      if (Number(d.netto_pnto) > 0 && (!d.quantity_chln || !d.quantity_rcpt)) {
        const roundedNetto = Math.round(Number(d.netto_pnto));
        return {
          ...d,
          quantity_chln: d.quantity_chln || roundedNetto,
          quantity_rcpt: d.quantity_rcpt || roundedNetto
        };
      }
      return d;
    });

    const padded = [...pDetails];
    if (padded.length === 0) {
      padded.push({
        srl_no: 1,
        receipt_grade_code: '',
        receipt_grade_name: '',
        crop_year: '2026-27',
        challan_grade_name: '',
        agency_code: '',
        agency_name: '',
        challan_marka_code: '',
        challan_marka_name: '',
        netto_pnto: 0,
        quantity_chln: 0,
        quantity_rcpt: 0,
        unit: 'BALES',
        remarks: '',
        marks_phota: ''
      });
    }
    return padded.map((row, idx) => ({ ...row, srl_no: idx + 1 }));
  };

  const [details, setDetails] = useState<ArrivalDetailRow[]>(() => getPaddedDetails(initialData));

  const handleAddRow = () => {
    setDetails(prev => [
      ...prev,
      {
        srl_no: prev.length + 1,
        receipt_grade_code: '',
        receipt_grade_name: '',
        crop_year: '2026-27',
        challan_grade_name: '',
        agency_code: '',
        agency_name: '',
        challan_marka_code: '',
        challan_marka_name: '',
        netto_pnto: 0,
        quantity_chln: 0,
        quantity_rcpt: 0,
        unit: 'BALES',
        remarks: '',
        marks_phota: ''
      }
    ]);
  };

  const handleDeleteRow = () => {
    setDetails(prev => {
      if (prev.length <= 1) return prev;
      const copy = prev.slice(0, -1);
      return copy.map((row, idx) => ({ ...row, srl_no: idx + 1 }));
    });
  };

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState(() => {
    return {
      financial_year: initialData?.financial_year || '2026-2027',
      arrival_no: initialData?.final_arrival_no || '',
      mr_no: initialData?.mr_no || '',
      po_no: initialData?.po_no || '',
      po_date: initialData?.po_date || today,
      date: initialData?.date || today,
      jci: initialData?.jci || 'No',
      challan_supplier: (initialData?.challan_supplier || '').toUpperCase(),
      supplier: (initialData?.supplier || '').toUpperCase(),
      broker: (initialData?.broker || '').toUpperCase(),
      transporter_name: initialData?.transporter_name || '',
      challan_rr_no: initialData?.challan_rr_no || '',
      challan_rr_date: initialData?.challan_rr_date || today,
      lorry_number: initialData?.lorry_number || (initialData as any)?.lorry_no || (initialData as any)?.vehicle_no || '',
      pan_no: initialData?.pan_no || '',
      consignment_note_no: initialData?.consignment_note_no || '',
      consignment_note_date: initialData?.consignment_note_date || today,
      di_no: initialData?.di_no || '',
      di_date: initialData?.di_date || today,
      invoice_no: initialData?.invoice_no || '',
      invoice_date: initialData?.invoice_date || today,
      ptf: initialData?.ptf || 'No',
      lorry_returned: initialData?.lorry_returned || 'No',
      lorry_returned_other_mill: initialData?.lorry_returned_other_mill || 'No',
      arrival_area_code: initialData?.arrival_area_code || '',
      arrival_area_name: (initialData?.arrival_area_name || '').toUpperCase(),
      unit_code: initialData?.unit_code || 'I',
      unit_name: initialData?.unit_name || 'BALES',
      way_bill_no: initialData?.way_bill_no || '',
      way_bill_date: initialData?.way_bill_date || today,
      apmc_fees: initialData?.apmc_fees || 0,
      remarks: initialData?.remarks || '',
      temporary_arrival_no: initialData?.temporary_arrival_no || '',
      temporary_arrival_date: initialData?.temporary_arrival_date || today,

      // Weighments
      challan_material_weight: initialData?.challan_material_weight || 0,
      actual_gross_weight: initialData?.actual_gross_weight || 0,
      actual_tare_weight: initialData?.actual_tare_weight || 0,
      supplier_net_weight: initialData?.supplier_net_weight || 0,
      supplier_challan_gross: initialData?.supplier_challan_gross || 0,
      supplier_tare_weight: initialData?.supplier_tare_weight || 0,
      electronic_net_weight: initialData?.electronic_net_weight || 0,
      electronic_gross_weight: initialData?.electronic_gross_weight || 0,
      electronic_tare_weight: initialData?.electronic_tare_weight || 0,
      weight_reduced: initialData?.weight_reduced || 0
    };
  });

  const [unitList, setUnitList] = useState<string[]>(['BALES', 'DRUMS', 'LOOSE', 'P.BALES', 'H.BALES']);

  useEffect(() => {
    async function loadUnits() {
      try {
        if (supabase) {
          const { data } = await supabase.from('unit_master').select('unit_name').order('unit_name');
          if (data && data.length > 0) {
            const fetched = data.map((u: any) => u.unit_name).filter(Boolean);
            setUnitList(prev => Array.from(new Set([...fetched, ...prev])));
          }
        }
      } catch (err) {
        console.warn("Failed to fetch unit_master in FinalArrivalEntry", err);
      }
    }
    loadUnits();
  }, []);

  // Load master registers on startup
  useEffect(() => {
    async function loadMastersAndIncrement() {
      try {
        const [brokData, suppData, areaData, agcData, gradeData, markaData, allArrivals, inspectionData, poData, tempPoData] = await Promise.all([
          dbModule.fetchAll('broker_master').catch(() => []),
          dbModule.fetchAll('supply_master').catch(() => []),
          dbModule.fetchAll('area_master').catch(() => []),
          dbModule.fetchAll('agency_master').catch(() => []),
          dbModule.fetchAll('grade_master').catch(() => []),
          dbModule.fetchAll('marka_master').catch(() => []),
          dbModule.fetchAll('final_arrival').catch(() => []),
          supabase ? supabase.from('mill_inspection_master').select('*').order('created_at', { ascending: false }).then(r => r.data || []) : [],
          dbModule.fetchAll('purchase_master').catch(() => []),
          dbModule.fetchAll('sauda_check_point').catch(() => [])
        ]);

        setBrokers((brokData || []).map((b: any) => ({ ...b, brok_name: (b.brok_name || '').toUpperCase() })));
        setSuppliers((suppData || []).map((s: any) => ({ ...s, supp_name: (s.supp_name || '').toUpperCase() })));
        setAreas((areaData || []).map((a: any) => ({ ...a, area_name: (a.area_name || '').toUpperCase() })));
        setAgencies(agcData || []);
        setGrades(gradeData || []);
        setInspectionsList(inspectionData || []);
        setExistingArrivals(allArrivals || []);
        const normalizedTempPoData = (tempPoData || []).map(po => ({ ...po, status: po.status || 'temp' }));
        const mergedPos = [...(poData || []), ...normalizedTempPoData];
        const uniquePos = Array.from(new Map(mergedPos.map(po => [po.po_no, po])).values());

        setPurchaseOrders(uniquePos.filter((po: any) => {
          if (!po.po_no || po.status === 'cancelled') return false;
          
          // Only show POs from Final P.O. (status: 'final')
          const isFinal = po.status === 'final' || po.status === 'moved_to_final';
          const isCurrentMatch = initialData && initialData.po_no && String(po.po_no).trim().toUpperCase() === String(initialData.po_no).trim().toUpperCase();
          
          if (!isFinal && !isCurrentMatch) return false;
          
          const pendingStr = String(po.pending ?? '').trim().toLowerCase();
          const statusStr = String(po.status ?? '').trim().toLowerCase();
          const receivedWt = parseFloat(po.received_weight_mt || po.received_mt) || 0;
          const contractWt = parseFloat(po.total_contract_mt || po.quantity) || 0;
          const isCompleted = po.pending === false || pendingStr === 'no' || pendingStr === 'false' || po.pending === 0 || statusStr === 'completed' || statusStr === 'settled' || (contractWt > 0 && receivedWt >= contractWt);

          if (isCurrentMatch) return true;
          return !isCompleted;
        }));

        let finalMarkas = markaData || [];
        setMarkas(finalMarkas);

        if (!initialData) {
          let nextNum = 501;
          if (allArrivals && allArrivals.length > 0) {
            let lastNum = 500;
            allArrivals.forEach((a: any) => {
              const an = a.final_arrival_no || '';
              const num = parseInt(an.replace(/[^0-9]/g, ''), 10);
              if (!isNaN(num) && num > lastNum) {
                lastNum = num;
              }
            });
            nextNum = lastNum + 1;
          }
          
          setFormData(prev => ({
            ...prev,
            arrival_no: `FA-${nextNum}`
          }));
        }
      } catch (err) {
        console.error("Failed to load schema collections:", err);
      }
    }
    loadMastersAndIncrement();
  }, [initialData]);

  const loadDetailsFromInspection = async (mrNo: string) => {
    if (!mrNo) {
      alert("Please enter or select a Material Inspection M.R. Number first.");
      return;
    }
    try {
      const mrNoUpper = mrNo.trim().toUpperCase();
      const matchedInspection = inspectionsList.find(ins => String(ins.mr_no).trim().toUpperCase() === mrNoUpper);

      if (matchedInspection) {
        let matchedDetails: any[] = [];
        let amadData: any = null;

        if (supabase) {
          const { data } = await supabase
            .from('mill_inspection_detail')
            .select('*')
            .eq('mr_no', mrNoUpper)
            .order('srl_no', { ascending: true });
          if (data) matchedDetails = data;

          if (matchedInspection.arrival_no || matchedInspection.ref_arrival_no) {
            const arrNo = (matchedInspection.arrival_no || matchedInspection.ref_arrival_no).trim();
            const { data: tDataList, error: tErr } = await supabase
              .from('temporary_material_received')
              .select('*')
              .eq('temporary_arrival_no', arrNo);

            if (tErr) console.warn("Could not fetch temporary_arrival mapping:", tErr);
            
            if (tDataList && tDataList.length > 0) {
              amadData = tDataList[0];
            }
          }
        }

        const finalPoNo = matchedInspection.po_no || amadData?.po_no || '';
        const matchedPo = purchaseOrders.find(po => String(po.po_no).trim().toUpperCase() === String(finalPoNo).trim().toUpperCase());

        setFormData(prev => ({
          ...prev,
          mr_no: matchedInspection.mr_no,
          po_no: finalPoNo || prev.po_no || '',
          po_date: matchedInspection.po_date || matchedPo?.po_date || matchedPo?.date || amadData?.date || amadData?.lorry_date || prev.po_date || '',
          jci: matchedInspection.jci || amadData?.jci || prev.jci || 'No',
          supplier: (matchedInspection.supplier_name || amadData?.supplier || matchedPo?.supplier || prev.supplier || '').toUpperCase(),
          challan_supplier: (matchedInspection.challan_supplier || amadData?.challan_supplier || matchedInspection.supplier_name || matchedPo?.challan_supplier || matchedPo?.supplier || prev.challan_supplier || '').toUpperCase(),
          broker: (matchedInspection.broker_name || amadData?.broker || matchedPo?.broker || prev.broker || '').toUpperCase(),
          date: matchedInspection.arrival_date || amadData?.date || prev.date,
          lorry_number: (matchedInspection as any).lorry_number || (matchedInspection as any).lorry_no || (matchedInspection as any).vehicle_no || (amadData as any)?.lorry_number || (amadData as any)?.lorry_no || (amadData as any)?.vehicle_no || prev.lorry_number,
          transporter_name: matchedInspection.transporter_name || amadData?.transporter_name || prev.transporter_name,
          challan_rr_no: matchedInspection.challan_rr_no || amadData?.challan_rr_no || prev.challan_rr_no,
          challan_rr_date: matchedInspection.challan_rr_date || amadData?.lorry_date || prev.challan_rr_date,
          pan_no: matchedInspection.pan_no || amadData?.pan_no || prev.pan_no,
          consignment_note_no: matchedInspection.consignment_note_no || amadData?.consignment_note_no || prev.consignment_note_no,
          di_no: matchedInspection.di_no || amadData?.di_no || prev.di_no,
          di_date: matchedInspection.di_date || amadData?.di_date || prev.di_date,
          invoice_no: matchedInspection.invoice_no || amadData?.invoice_no || prev.invoice_no,
          invoice_date: matchedInspection.invoice_date || amadData?.invoice_date || prev.invoice_date,
          ptf: matchedInspection.ptf || amadData?.ptf || prev.ptf,
          lorry_returned: matchedInspection.lorry_returned || amadData?.lorry_returned || prev.lorry_returned,
          lorry_returned_other_mill: matchedInspection.lorry_returned_other_mill || amadData?.lorry_returned_other_mill || prev.lorry_returned_other_mill,
          arrival_area_code: matchedInspection.arrival_area_code || amadData?.arrival_area_code || prev.arrival_area_code,
          arrival_area_name: matchedInspection.arrival_area_name || amadData?.arrival_area_name || prev.arrival_area_name,
          unit_code: matchedInspection.unit_code || amadData?.unit_code || prev.unit_code,
          unit_name: matchedInspection.unit_name || amadData?.unit_name || prev.unit_name,
          way_bill_no: matchedInspection.way_bill_no || amadData?.way_bill_no || prev.way_bill_no,
          way_bill_date: matchedInspection.way_bill_date || amadData?.way_bill_date || prev.way_bill_date,
          apmc_fees: matchedInspection.apmc_fees || amadData?.apmc_fees || prev.apmc_fees,
          remarks: matchedInspection.remarks || amadData?.remarks || prev.remarks,
          temporary_arrival_no: matchedInspection.arrival_no || amadData?.temporary_arrival_no || amadData?.amad_no || prev.temporary_arrival_no,
          temporary_arrival_date: matchedInspection.arrival_date || amadData?.date || prev.temporary_arrival_date,
          challan_material_weight: Number(matchedInspection.challan_material_weight) || Number(amadData?.challan_material_weight) || Number(prev.challan_material_weight),
          actual_gross_weight: Number(matchedInspection.actual_gross_weight) || Number(amadData?.actual_gross_weight) || Number(prev.actual_gross_weight),
          actual_tare_weight: Number(matchedInspection.actual_tare_weight) || Number(amadData?.actual_tare_weight) || Number(prev.actual_tare_weight),
          supplier_net_weight: Number(matchedInspection.supplier_net_weight) || Number(amadData?.supplier_net_weight) || Number(prev.supplier_net_weight),
          supplier_challan_gross: Number(matchedInspection.supplier_challan_gross) || Number(amadData?.supplier_challan_gross) || Number(prev.supplier_challan_gross),
          supplier_tare_weight: Number(matchedInspection.supplier_tare_weight) || Number(amadData?.supplier_tare_weight) || Number(prev.supplier_tare_weight),
          electronic_net_weight: Number(matchedInspection.electronic_net_weight) || Number(amadData?.electronic_net_weight) || Number(prev.electronic_net_weight),
          electronic_gross_weight: Number(matchedInspection.electronic_gross_weight) || Number(amadData?.electronic_gross_weight) || Number(prev.electronic_gross_weight),
          electronic_tare_weight: Number(matchedInspection.electronic_tare_weight) || Number(amadData?.electronic_tare_weight) || Number(prev.electronic_tare_weight),
          weight_reduced: Number(matchedInspection.weight_reduced) || Number(amadData?.weight_reduced) || Number(prev.weight_reduced)
        }));

        if (matchedDetails && matchedDetails.length > 0) {
          const newDetails = matchedDetails.map((md: any, index: number) => {
            const matchingGrade = grades.find(g => 
              String(g.grade_code).trim().toUpperCase() === String(md.stock_grade_code).trim().toUpperCase() || 
              String(g.grade_name).trim().toUpperCase() === String(md.stock_grade_code).trim().toUpperCase() ||
              String(g.grade_name).trim().toUpperCase() === String(md.arrival_grade).trim().toUpperCase()
            );
            const gradeName = matchingGrade ? matchingGrade.grade_name : (md.stock_grade_name || md.arrival_grade || '');
            const gradeCode = matchingGrade ? matchingGrade.grade_code : (md.stock_grade_code || '');

            const matchingMarka = markas.find(m => 
              String(m.marka_code).trim().toUpperCase() === String(md.marka).trim().toUpperCase() || 
              String(m.marka_name).trim().toUpperCase() === String(md.marka).trim().toUpperCase()
            );
            const markaName = matchingMarka ? matchingMarka.marka_name : (md.marka || 'NO MARK');
            const markaCode = matchingMarka ? matchingMarka.marka_code : (md.marka || '01');

            return {
              srl_no: index + 1,
              receipt_grade_code: gradeCode,
              receipt_grade_name: gradeName,
              crop_year: md.crop_year || '2026-27',
              challan_grade_name: gradeName,
              agency_code: '',
              agency_name: md.agency || '',
              challan_marka_code: markaCode,
              challan_marka_name: markaName,
              netto_pnto: Number(md.challan_gross_wt) || 0,
              quantity_chln: Number(md.quantity) || Math.round(Number(md.challan_gross_wt) || 0),
              quantity_rcpt: Number(md.quantity) || Math.round(Number(md.challan_gross_wt) || 0),
              unit: md.unit || 'BALES',
              remarks: '',
              marks_phota: md.marks_phota || ''
            };
          });
          setDetails(newDetails);
          alert(`Successfully mapped details & weights from Quality Inspection Report #${mrNoUpper}!`);
        } else {
          alert(`Quality inspection header found for #${mrNoUpper}, but no detailed row elements exist.`);
        }
      } else {
        alert(`Could not find an active Material Inspection with M.R. Number "${mrNoUpper}". Please select a valid inspection.`);
      }
    } catch (e: any) {
      alert("Error loading inspection records: " + e.message);
    }
  };

  // Live Automatic Weight Calc logic
  useEffect(() => {
    let totalNetto = 0;
    details.forEach(d => {
      totalNetto += Number(d.netto_pnto) || 0;
    });

    const calculatedElectronicNet = (Number(formData.electronic_gross_weight) || 0) - (Number(formData.electronic_tare_weight) || 0);

    setFormData(prev => {
      const calculatedChallanWeight = Number(totalNetto.toFixed(3));
      const updatedChallanWeight = prev.challan_material_weight === 0 || prev.challan_material_weight === "" || !prev.challan_material_weight
        ? (calculatedChallanWeight > 0 ? calculatedChallanWeight : 0)
        : prev.challan_material_weight;
      
      const calculatedSupplierNet = (Number(prev.supplier_challan_gross) || 0) - (Number(prev.supplier_tare_weight) || 0);
      const updatedSupplierWeight = prev.supplier_net_weight === 0 || prev.supplier_net_weight === "" || !prev.supplier_net_weight
        ? (Number(calculatedSupplierNet.toFixed(3)) > 0 ? Number(calculatedSupplierNet.toFixed(3)) : 0)
        : prev.supplier_net_weight;

      const updatedElectronicWeight = prev.electronic_net_weight === 0 || prev.electronic_net_weight === "" || !prev.electronic_net_weight
        ? (Number(calculatedElectronicNet.toFixed(3)) > 0 ? Number(calculatedElectronicNet.toFixed(3)) : 0)
        : prev.electronic_net_weight;

      return {
        ...prev,
        challan_material_weight: updatedChallanWeight,
        supplier_net_weight: updatedSupplierWeight,
        electronic_net_weight: updatedElectronicWeight
      };
    });
  }, [
    details, 
    formData.supplier_challan_gross, 
    formData.supplier_tare_weight, 
    formData.electronic_gross_weight, 
    formData.electronic_tare_weight
  ]);

  const handleRowChange = (index: number, field: keyof ArrivalDetailRow, val: any) => {
    const updatedDetails = [...details];
    
    // Auto-fill grade name on grade code select change
    if (field === 'receipt_grade_code') {
      const g = grades.find(g => String(g.grade_code) === String(val));
      if (g) {
        updatedDetails[index].receipt_grade_name = g.grade_name;
        updatedDetails[index].challan_grade_name = g.grade_name;
      }
    }
    
    // Auto-fill marka name on code change
    if (field === 'challan_marka_code') {
      const m = markas.find(m => String(m.marka_code) === String(val));
      if (m) {
        updatedDetails[index].challan_marka_name = m.marka_name;
      }
    }

    updatedDetails[index] = {
      ...updatedDetails[index],
      [field]: val
    } as ArrivalDetailRow;

    if (field === 'quantity_chln') {
      updatedDetails[index].quantity_rcpt = val;
    }
    
    if (field === 'netto_pnto') {
      const rounded = Math.round(Number(val) || 0);
      updatedDetails[index].quantity_rcpt = rounded;
      updatedDetails[index].quantity_chln = rounded;
    }

    setDetails(updatedDetails);
  };

  const handleInputChange = (field: string, val: any) => {
    setFormData(prev => {
      const next = { ...prev, [field]: val };
      if (field === 'challan_material_weight') {
        next.supplier_net_weight = val;
        next.electronic_net_weight = val;
      }
      if (field === 'po_no' && val) {
        const valUpper = String(val).trim().toUpperCase();
        const matched = purchaseOrders.find(po => String(po.po_no).trim().toUpperCase() === valUpper);
        if (matched) {
          next.po_date = matched.po_date || matched.date || next.po_date;
          next.supplier = (matched.supplier || matched.merchant || next.supplier || '').toUpperCase();
          next.challan_supplier = (matched.challan_supplier || matched.supplier || matched.merchant || next.challan_supplier || '').toUpperCase();
          next.broker = (matched.broker || next.broker || '').toUpperCase();
          next.arrival_area_name = (matched.area || next.arrival_area_name || '').toUpperCase();
          const matchedArea = areas.find(a => String(a.area_name).trim().toUpperCase() === String(matched.area).trim().toUpperCase());
          if (matchedArea) {
            next.arrival_area_code = matchedArea.area_code;
          }
        }
      }
      return next;
    });
  };

  // Double direction linkages
  const handleAreaChange = (val: string) => {
    const upperVal = val.toUpperCase();
    setFormData(prev => {
      const matched = areas.find(a => String(a.area_name).toUpperCase() === upperVal || `${a.area_code} - ${a.area_name}`.toUpperCase() === upperVal);
      return {
        ...prev,
        arrival_area_name: matched ? String(matched.area_name).toUpperCase() : upperVal,
        arrival_area_code: matched ? matched.area_code : prev.arrival_area_code
      };
    });
  };

  const handleAreaCodeChange = (val: string) => {
    const upperVal = val.toUpperCase();
    setFormData(prev => {
      const matched = areas.find(a => String(a.area_code).toUpperCase() === upperVal);
      return {
        ...prev,
        arrival_area_code: upperVal,
        arrival_area_name: matched ? String(matched.area_name).toUpperCase() : prev.arrival_area_name
      };
    });
  };

  const handleUnitCodeChange = (val: string) => {
    setFormData(prev => {
      const matched = val.toUpperCase() === 'I' ? 'BALES' : (val.toUpperCase() === 'II' ? 'LOOSE' : prev.unit_name);
      return {
        ...prev,
        unit_code: val.toUpperCase(),
        unit_name: matched
      };
    });
  };

  const handleUnitNameChange = (val: string) => {
    setFormData(prev => {
      const matched = val.toUpperCase() === 'BALES' ? 'I' : (val.toUpperCase() === 'LOOSE' ? 'II' : prev.unit_code);
      return {
        ...prev,
        unit_name: val.toUpperCase(),
        unit_code: matched
      };
    });
  };

  const handleSave = async () => {
    if (initialData && !enforceEditOrDeletePermission("Edit")) {
      return;
    }
    if (loading) return;
    setLoading(true);

    try {
      const missingFields: string[] = [];
      if (!formData.arrival_no && !formData.mr_no) missingFields.push("Arrival No / Temporary M.R number");
      if (!formData.supplier) missingFields.push("Supplier");
      if ((Number(formData.challan_material_weight) || 0) <= 0) {
        missingFields.push("Challan Material Weight (M.T)");
      }
      if ((Number(formData.supplier_net_weight) || 0) <= 0) {
        missingFields.push("Supplier Net Weight (M.Ton)");
      }
      if ((Number(formData.electronic_net_weight) || 0) <= 0) {
        missingFields.push("Electronic Weighbridge Net");
      }

      const activeRows = details.filter(row => 
        row.receipt_grade_code || 
        row.challan_marka_name || 
        row.quantity_rcpt > 0 || 
        row.netto_pnto > 0 ||
        row.challan_grade_name
      );

      if (activeRows.length === 0) {
        missingFields.push("At least one valid grade row in receipt grid");
      }

      if (missingFields.length > 0) {
        alert("Please complete the required fields for Final M.R:\n\n• " + missingFields.join("\n• "));
        setLoading(false);
        return;
      }

      // Check to insert markas automatically
      const uniqueNewMarkas: string[] = [];
      activeRows.forEach(row => {
        const markaName = (row.challan_marka_name || '').trim();
        if (markaName) {
          const exists = markas.some(m => (m.marka_name || '').trim().toUpperCase() === markaName.toUpperCase());
          if (!exists && !uniqueNewMarkas.some(n => n.toUpperCase() === markaName.toUpperCase())) {
            uniqueNewMarkas.push(markaName);
          }
        }
      });

      if (uniqueNewMarkas.length > 0) {
        let maxMarkaCode = markas.reduce((acc, m) => {
          const codeVal = parseInt(m.marka_code || '0', 10);
          return isNaN(codeVal) ? acc : Math.max(acc, codeVal);
        }, 170);

        for (const name of uniqueNewMarkas) {
          maxMarkaCode += 1;
          const codeStr = String(maxMarkaCode).padStart(2, '0');
          try {
            await dbModule.insert('marka_master', {
              marka_code: codeStr,
              marka_name: name.toUpperCase()
            });
            activeRows.forEach(r => {
              if ((r.challan_marka_name || '').trim().toUpperCase() === name.toUpperCase()) {
                r.challan_marka_code = codeStr;
                r.challan_marka_name = name.toUpperCase();
              }
            });
          } catch (e) {
            console.error("Failed to insert new marka name:", name, e);
          }
        }
      }

      const totalPacketsSum = Math.round(activeRows.reduce((acc, curr) => acc + (Number(curr.quantity_rcpt) || 0), 0));
      const totalWeightSum = activeRows.reduce((acc, curr) => acc + (Number(curr.netto_pnto) || 0), 0);

      const payload = {
        financial_year: formData.financial_year,
        final_arrival_no: formData.arrival_no,
        mr_no: formData.mr_no,
        po_no: formData.po_no,
        po_date: formData.po_date || null,
        date: formData.date,
        jci: formData.jci,
        challan_supplier: formData.challan_supplier,
        supplier: formData.supplier,
        broker: formData.broker,
        transporter_name: formData.transporter_name,
        challan_rr_no: formData.challan_rr_no,
        challan_rr_date: formData.challan_rr_date || null,
        lorry_number: formData.lorry_number,
        pan_no: formData.pan_no,
        consignment_note_no: formData.consignment_note_no,
        consignment_note_date: formData.consignment_note_date || null,
        di_no: formData.di_no,
        di_date: formData.di_date || null,
        invoice_no: formData.invoice_no,
        invoice_date: formData.invoice_date || null,
        ptf: formData.ptf,
        lorry_returned: formData.lorry_returned,
        lorry_returned_other_mill: formData.lorry_returned_other_mill,
        arrival_area_code: formData.arrival_area_code,
        arrival_area_name: formData.arrival_area_name,
        unit_code: formData.unit_code,
        unit_name: formData.unit_name,
        way_bill_no: formData.way_bill_no,
        way_bill_date: formData.way_bill_date || null,
        apmc_fees: formData.apmc_fees || 0,
        remarks: formData.remarks,
        temporary_arrival_no: formData.temporary_arrival_no,
        temporary_arrival_date: formData.temporary_arrival_date || null,
        total_packets: totalPacketsSum,
        weight_qtl: totalWeightSum * 10,
        grid_details: activeRows.map(row => {
          return {
            ...row,
            quantity_chln: Math.round(Number(row.quantity_chln) || 0),
            quantity_rcpt: Math.round(Number(row.quantity_rcpt) || 0)
          };
        }),

        // Weighments
        challan_material_weight: formData.challan_material_weight || 0,
        actual_gross_weight: formData.actual_gross_weight || 0,
        actual_tare_weight: formData.actual_tare_weight || 0,
        supplier_net_weight: formData.supplier_net_weight || 0,
        supplier_challan_gross: formData.supplier_challan_gross || 0,
        supplier_tare_weight: formData.supplier_tare_weight || 0,
        electronic_net_weight: formData.electronic_net_weight || 0,
        electronic_gross_weight: formData.electronic_gross_weight || 0,
        electronic_tare_weight: formData.electronic_tare_weight || 0,
        weight_reduced: formData.weight_reduced || 0
      };

      try {
        if (initialData && initialData.final_arrival_id) {
          await dbModule.update('final_arrival', 'final_arrival_id', initialData.final_arrival_id, payload);
          alert(`Final Arrival Voucher #${formData.arrival_no} updated successfully!`);
        } else {
          await dbModule.insert('final_arrival', payload);
          alert(`Final Arrival Register Saved successfully!\nAdded under Final Arrival Voucher #${formData.arrival_no}`);
        }
      } catch (saveErr: any) {
        if (saveErr?.message?.includes('lorry_number') || saveErr?.message?.includes('schema cache')) {
          try {
            await supabase?.rpc("exec_sql", { 
              query: `
                ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_number TEXT;
                NOTIFY pgrst, 'reload schema';
              ` 
            });
            if (initialData && initialData.final_arrival_id) {
              await dbModule.update('final_arrival', 'final_arrival_id', initialData.final_arrival_id, payload);
              alert(`Final Arrival Voucher #${formData.arrival_no} updated successfully!`);
            } else {
              await dbModule.insert('final_arrival', payload);
              alert(`Final Arrival Register Saved successfully!\nAdded under Final Arrival Voucher #${formData.arrival_no}`);
            }
          } catch (retryErr: any) {
            // Fallback: strip lorry_number if column is absent in legacy DB schema cache
            const { lorry_number, ...fallbackPayload } = payload as any;
            if (initialData && initialData.final_arrival_id) {
              await dbModule.update('final_arrival', 'final_arrival_id', initialData.final_arrival_id, fallbackPayload);
              alert(`Final Arrival Voucher #${formData.arrival_no} updated successfully!`);
            } else {
              await dbModule.insert('final_arrival', fallbackPayload);
              alert(`Final Arrival Register Saved successfully!\nAdded under Final Arrival Voucher #${formData.arrival_no}`);
            }
          }
        } else {
          throw saveErr;
        }
      }

      if (onSave) onSave(payload);
    } catch (e: any) {
      alert("Failed to save final arrival voucher: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalReceiptQuantity = details.reduce((acc, curr) => acc + (Number(curr.quantity_rcpt) || 0), 0);
  const totalChallanQuantity = details.reduce((acc, curr) => acc + (Number(curr.quantity_chln) || 0), 0);
  const totalNettoQuantity = details.reduce((acc, curr) => acc + (Number(curr.netto_pnto) || 0), 0);

  const resetFormToBlank = () => {
    let nextNum = 501;
    setFormData({
      financial_year: '2026-2027',
      arrival_no: `FA-${nextNum}`,
      mr_no: '',
      po_no: '',
      po_date: today,
      date: today,
      jci: 'No',
      challan_supplier: '',
      supplier: '',
      broker: '',
      transporter_name: '',
      challan_rr_no: '',
      challan_rr_date: today,
      lorry_number: '',
      pan_no: '',
      consignment_note_no: '',
      consignment_note_date: today,
      di_no: '',
      di_date: today,
      invoice_no: '',
      invoice_date: today,
      ptf: 'No',
      lorry_returned: 'No',
      lorry_returned_other_mill: 'No',
      arrival_area_code: '',
      arrival_area_name: '',
      unit_code: 'I',
      unit_name: 'BALES',
      way_bill_no: '',
      way_bill_date: today,
      apmc_fees: 0,
      remarks: '',
      temporary_arrival_no: '',
      temporary_arrival_date: today,
      challan_material_weight: 0,
      actual_gross_weight: 0,
      actual_tare_weight: 0,
      supplier_net_weight: 0,
      supplier_challan_gross: 0,
      supplier_tare_weight: 0,
      electronic_net_weight: 0,
      electronic_gross_weight: 0,
      electronic_tare_weight: 0,
      weight_reduced: 0
    });
    setDetails(getPaddedDetails(null));
  };

  const deleteCurrentVoucher = async () => {
    if (!initialData || !initialData.final_arrival_id) {
      alert("No persistent voucher loaded to delete.");
      return;
    }
    if (window.confirm(`Are you sure you want to completely delete Final Arrival Voucher #${formData.arrival_no}?`)) {
      try {
        await dbModule.delete('final_arrival', 'final_arrival_id', initialData.final_arrival_id);
        alert("Voucher deleted successfully.");
        if (onCancel) onCancel();
      } catch (err: any) {
        alert("Delete failed: " + err.message);
      }
    }
  };

  return (
    <LegacyLayout title="FINAL ARRIVAL" subtitle="ARRIVAL WORKSTATION" onClose={onCancel}>
      <div className="bg-[#eae7e1]  text-xs font-sans min-h-full flex flex-col">

        {/* ERP Sync Integration Bar */}
        <div className="shrink-0 bg-[#f0ece6] border-b border-[#c0c0c0] px-4 py-1.5 flex flex-wrap gap-2 items-center text-xs text-gray-700 ">
        <span className="font-bold text-[#ac0000]">Quality Sync Integration:</span>
        <select
          value={formData.mr_no}
          onChange={(e) => {
            handleInputChange('mr_no', e.target.value);
            loadDetailsFromInspection(e.target.value);
          }}
          className="border border-[#808080] bg-white px-2 py-0.5 text-xs text-gray-800 focus:bg-amber-50 outline-none"
        >
          <option value="">-- Sync Quality Inspection Record --</option>
          {inspectionsList
            .filter((ins) => {
              const isCurrentlySelected = formData.mr_no && String(formData.mr_no).trim().toUpperCase() === String(ins.mr_no).trim().toUpperCase();
              const isCurrentlyLinked = initialData && initialData.mr_no && String(initialData.mr_no).trim().toUpperCase() === String(ins.mr_no).trim().toUpperCase();
              if (isCurrentlySelected || isCurrentlyLinked) return true;

              const isAlreadySynced = existingArrivals.some(arr => 
                arr.mr_no && 
                String(arr.mr_no).trim().toUpperCase() === String(ins.mr_no).trim().toUpperCase() &&
                (!initialData || arr.final_arrival_id !== initialData.final_arrival_id)
              );
              return !isAlreadySynced;
            })
            .map((ins) => (
              <option key={ins.mr_no} value={ins.mr_no}>
                MR: {ins.mr_no} - PO: {ins.po_no || 'N/A'} [Supp: {ins.supplier_name}]
              </option>
            ))}
        </select>
        
        <button
          type="button"
          onClick={() => loadDetailsFromInspection(formData.mr_no)}
          disabled={!formData.mr_no}
          className="bg-[#e4e0d8] border border-[#808080] px-2 py-0.5 text-[11px] font-bold text-gray-800 active:border-black disabled:opacity-50 font-sans"
        >
          Force Sync
        </button>

        {formData.mr_no && (
          <span className="text-emerald-800 font-bold px-2 py-0.5 bg-emerald-100 border border-emerald-400 text-[10px]">
            Linked MR #{formData.mr_no}
          </span>
        )}
      </div>

      <div className="flex-1 p-4 flex flex-col gap-3">
        {/* Title Heading */}
        <div className="text-center py-1">
          <h1 className="text-3xl font-bold tracking-wide text-[#ac0000] font-sans">Final Approval</h1>
        </div>

        {/* Master Details Frame Mockup */}
        <div className="shrink-0 border border-[#808080] p-4 bg-white flex flex-col gap-1.5 shadow-sm">
          {/* Row 1 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>Temporary M.R No</span>
            <input 
              type="text" 
              value={formData.temporary_arrival_no || ''} 
              onChange={(e) => handleInputChange('temporary_arrival_no', e.target.value)}
              className="w-[180px] h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 focus:border-black focus:bg-amber-50"
            />
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '50px' }}>Date</span>
            <input 
              type="date" 
              value={formData.temporary_arrival_date || ''} 
              onChange={(e) => handleInputChange('temporary_arrival_date', e.target.value)}
              className="w-[130px] h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 text-center focus:border-black focus:bg-amber-50"
            />
          </div>

          {/* Row 2 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>Arrival No</span>
            <input 
              type="text" 
              value={formData.arrival_no || ''} 
              onChange={(e) => handleInputChange('arrival_no', e.target.value)}
              className="w-[180px] h-6 bg-white border border-[#ac0000] px-2 outline-none font-mono text-xs text-red-900 font-bold focus:bg-amber-50"
            />
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '50px' }}>Date</span>
            <input 
              type="date" 
              value={formData.date || ''} 
              onChange={(e) => handleInputChange('date', e.target.value)}
              className="w-[130px] h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 text-center focus:border-black focus:bg-amber-50"
            />
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '100px' }}>Mill P.O No.</span>
            <div className="relative flex items-center">
              <div className="relative w-[180px]">
                <input 
                  type="text" 
                  value={formData.po_no || ''} 
                  onChange={(e) => handleInputChange('po_no', e.target.value)}
                  onFocus={() => setShowPoDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPoDropdown(false), 200)}
                  autoComplete="new-password"
                  placeholder="-- SELECT PO --"
                  className="w-full h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 focus:border-black focus:bg-amber-50 uppercase pr-6"
                />
                <div 
                  className="absolute right-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-pointer text-gray-500 hover:text-black"
                  onMouseDown={(e) => { e.preventDefault(); setShowPoDropdown(!showPoDropdown); }}
                >
                  <ChevronDown size={14} />
                </div>
                {showPoDropdown && purchaseOrders.length > 0 && (
                   <div className="absolute top-6 left-0 w-[400px] bg-white border border-gray-400 max-h-48 overflow-y-auto z-[9999] shadow-2xl">
                      {purchaseOrders
                        .filter(po => !formData.po_no || po.po_no.toLowerCase().includes(formData.po_no.toLowerCase()))
                        .map(po => (
                          <div 
                             key={po.po_id || po.po_no} 
                             className="px-2 py-1 text-xs font-mono cursor-pointer hover:bg-blue-100 uppercase border-b border-gray-100 last:border-b-0"
                             onClick={() => {
                                 handleInputChange('po_no', po.po_no);
                                 handleInputChange('supplier', po.supplier || po.merchant || formData.supplier);
                                 handleInputChange('broker', po.broker || formData.broker);
                                 handleInputChange('po_date', po.po_date || formData.po_date);
                                 setShowPoDropdown(false);
                             }}
                          >
                             <span className="font-bold text-indigo-900">{po.po_no}</span> - <span className="text-gray-600">{po.supplier || po.merchant}</span> <span className="text-gray-400">({po.quantity || po.total_contract_mt} MT)</span>
                          </div>
                      ))}
                   </div>
                )}
              </div>
            </div>
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '50px' }}>Date</span>
            <input 
              type="date" 
              value={formData.po_date || ''} 
              onChange={(e) => handleInputChange('po_date', e.target.value)}
              className="w-[130px] h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 text-center focus:border-black focus:bg-amber-50"
            />
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '50px' }}>J.C.I</span>
            <select 
              value={formData.jci || 'No'} 
              onChange={(e) => handleInputChange('jci', e.target.value)}
              className="w-[80px] h-6 bg-white border border-[#808080] px-1 outline-none font-sans text-xs text-slate-800 focus:border-black focus:bg-amber-50"
            >
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </div>

          {/* Row 3 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>Challan Supplier</span>
            <input 
              type="text" 
              list="suppliers_dl"
              value={formData.challan_supplier || ''} 
              onChange={(e) => handleInputChange('challan_supplier', e.target.value.toUpperCase())}
              className="flex-1 h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 focus:border-black focus:bg-amber-50"
            />
          </div>

          {/* Row 4 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>Supplier</span>
            <input 
              type="text" 
              list="suppliers_dl"
              value={formData.supplier || ''} 
              onChange={(e) => handleInputChange('supplier', e.target.value.toUpperCase())}
              className="flex-1 h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 focus:border-black focus:bg-amber-50"
            />
          </div>

          {/* Row 5 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>Broker</span>
            <input 
              type="text" 
              list="brokers_dl"
              value={formData.broker || ''} 
              onChange={(e) => handleInputChange('broker', e.target.value.toUpperCase())}
              className="flex-1 h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 focus:border-black focus:bg-amber-50"
            />
          </div>

          {/* Row 6 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>Transporter Name</span>
            <input 
              type="text" 
              value={formData.transporter_name || ''} 
              onChange={(e) => handleInputChange('transporter_name', e.target.value)}
              className="flex-1 h-6 bg-white border border-[#808080] px-2 outline-none font-sans text-xs text-slate-800 focus:border-black focus:bg-amber-50"
            />
          </div>

          {/* Row 7 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>Challan / Railway Receipt No.</span>
              <input 
                type="text" 
                value={formData.challan_rr_no || ''} 
                onChange={(e) => handleInputChange('challan_rr_no', e.target.value)}
                className="flex-1 h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 focus:border-black focus:bg-amber-50"
              />
            </div>
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '50px' }}>Date</span>
            <input 
              type="date" 
              value={formData.challan_rr_date || ''} 
              onChange={(e) => handleInputChange('challan_rr_date', e.target.value)}
              className="w-[130px] h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 text-center focus:border-black focus:bg-amber-50"
            />
          </div>

          {/* Row 8 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>Lorry Number</span>
            <input 
              type="text" 
              value={formData.lorry_number || ''} 
              onChange={(e) => handleInputChange('lorry_number', e.target.value.toUpperCase())}
              placeholder="e.g. WB-25K-9901"
              className="w-[200px] h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 font-bold focus:border-black focus:bg-amber-50"
            />
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '80px' }}>Pan No</span>
            <input 
              type="text" 
              value={formData.pan_no || ''} 
              onChange={(e) => handleInputChange('pan_no', e.target.value.toUpperCase())}
              className="flex-1 h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 focus:border-black focus:bg-amber-50"
            />
          </div>

          {/* Row 9 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>Consignment Note No.</span>
              <input 
                type="text" 
                value={formData.consignment_note_no || ''} 
                onChange={(e) => handleInputChange('consignment_note_no', e.target.value)}
                className="flex-1 h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 focus:border-black focus:bg-amber-50"
              />
            </div>
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '50px' }}>Date</span>
            <input 
              type="date" 
              value={formData.consignment_note_date || ''} 
              onChange={(e) => handleInputChange('consignment_note_date', e.target.value)}
              className="w-[130px] h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 text-center focus:border-black focus:bg-amber-50"
            />
          </div>

          {/* Row 10 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>D.I. No.</span>
              <input 
                type="text" 
                value={formData.di_no || ''} 
                onChange={(e) => handleInputChange('di_no', e.target.value)}
                className="flex-1 h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 focus:border-black focus:bg-amber-50"
              />
            </div>
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '50px' }}>Date</span>
            <input 
              type="date" 
              value={formData.di_date || ''} 
              onChange={(e) => handleInputChange('di_date', e.target.value)}
              className="w-[130px] h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 text-center focus:border-black focus:bg-amber-50"
            />
          </div>

          {/* Row 11 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>Invoice No.</span>
              <input 
                type="text" 
                value={formData.invoice_no || ''} 
                onChange={(e) => handleInputChange('invoice_no', e.target.value)}
                className="flex-1 h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 focus:border-black focus:bg-amber-50"
              />
            </div>
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '50px' }}>Date</span>
            <input 
              type="date" 
              value={formData.invoice_date || ''} 
              onChange={(e) => handleInputChange('invoice_date', e.target.value)}
              className="w-[130px] h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 text-center focus:border-black focus:bg-amber-50"
            />
          </div>

          {/* Row 12 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>P.T.F</span>
            <select 
              onChange={(e) => {
                handleInputChange('ptf', e.target.value);
              }}
              className="w-[80px] h-6 bg-white border border-[#808080] px-1 outline-none text-xs focus:border-black focus:bg-amber-50"
            >
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '140px' }}>Lorry Returned</span>
            <select 
              value={formData.lorry_returned || 'No'} 
              onChange={(e) => handleInputChange('lorry_returned', e.target.value)}
              className="w-[80px] h-6 bg-white border border-[#808080] px-1 outline-none text-xs focus:border-black focus:bg-amber-50"
            >
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '240px' }}>Lorry Returned from Other Mill</span>
            <select 
              value={formData.lorry_returned_other_mill || 'No'} 
              onChange={(e) => handleInputChange('lorry_returned_other_mill', e.target.value)}
              className="w-[80px] h-6 bg-white border border-[#808080] px-1 outline-none text-xs focus:border-black focus:bg-amber-50"
            >
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </div>

          {/* Row 13 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>Arrival Area</span>
            <input 
              type="text" 
              value={formData.arrival_area_code || ''} 
              onChange={(e) => handleAreaCodeChange(e.target.value)}
              className="bg-white border border-[#808080] px-2 h-6 outline-none font-mono text-xs w-[50px] text-center"
            />
            <input 
              type="text" 
              list="areas_dl"
              value={formData.arrival_area_name || ''} 
              onChange={(e) => handleAreaChange(e.target.value)}
              placeholder="SEARCH / CHOOSE TRANSIT AREA"
              className="flex-1 h-6 bg-white border border-[#808080] px-2 outline-none text-xs font-bold text-slate-800 uppercase focus:border-black focus:bg-amber-50"
            />
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '50px' }}>Unit</span>
            <input 
              type="text" 
              value={formData.unit_code || ''} 
              onChange={(e) => handleUnitCodeChange(e.target.value)}
              className="border border-[#808080] px-2 h-6 outline-none font-mono text-xs w-[50px] text-center bg-slate-50"
              readOnly
            />
            <select 
              value={formData.unit_name || 'BALES'} 
              onChange={(e) => handleUnitNameChange(e.target.value)}
              className="border border-[#808080] px-1 h-6 outline-none text-xs w-[120px] bg-white font-bold cursor-pointer"
            >
              {Array.from(new Set([...unitList, formData.unit_name].filter(Boolean))).map((u: string) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Row 14 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>Way Bill No.</span>
              <input 
                type="text" 
                value={formData.way_bill_no || ''} 
                onChange={(e) => handleInputChange('way_bill_no', e.target.value)}
                className="flex-1 h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 focus:border-black focus:bg-amber-50"
              />
            </div>
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '50px' }}>Date</span>
            <input 
              type="date" 
              value={formData.way_bill_date || ''} 
              onChange={(e) => handleInputChange('way_bill_date', e.target.value)}
              className="w-[130px] h-6 bg-white border border-[#808080] px-2 outline-none font-mono text-xs text-slate-800 text-center focus:border-black focus:bg-amber-50"
            />
          </div>

          {/* Row 15 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '180px' }}>A.P.M.C Fees</span>
            <input 
              type="number" 
              step="any"
              value={formData.apmc_fees || ''} 
              onChange={(e) => handleInputChange('apmc_fees', e.target.value === '' ? '' : Number(e.target.value))}
              className="bg-white border border-[#808080] px-2 h-6 outline-none font-mono text-xs w-[120px] text-right focus:border-black focus:bg-amber-50"
            />
            
            <span className="text-xs font-semibold text-gray-800 text-right shrink-0" style={{ width: '80px' }}>Remarks</span>
            <input 
              type="text" 
              value={formData.remarks || ''} 
              onChange={(e) => handleInputChange('remarks', e.target.value)}
              className="flex-1 h-6 bg-white border border-[#808080] px-2 outline-none text-xs text-slate-800 focus:border-black focus:bg-amber-50"
            />
          </div>
        </div>

        {/* Dual level Receipt Grid Table */}
        <div className="flex-1 min-h-[180px] border border-slate-400 bg-[#dfdfdf] shadow-sm overflow-auto">
          <div className="flex items-center justify-between p-1.5 bg-[#d4d0c8] border-b border-slate-400">
             <span className="text-[10px] font-bold uppercase text-slate-800">Final MR Receipt Grid Items</span>
             <div className="flex items-center gap-1.5">
                <button
                   type="button"
                   onClick={handleAddRow}
                   className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                >
                   + Spawn Row
                </button>
                <button
                   type="button"
                   onClick={handleDeleteRow}
                   className="bg-rose-800 hover:bg-rose-900 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                >
                   - Delete Row
                </button>
             </div>
          </div>
          <table className="w-full table-fixed min-w-[950px]">
            <thead className="bg-[#ac0000] text-white font-sans text-[10px] uppercase border-b border-slate-500">
              <tr className="border-b border-red-800 text-center font-bold">
                <th rowSpan={2} className="border-r border-red-800 w-10 text-center py-1">Srl. No</th>
                <th colSpan={2} className="border-r border-red-800 text-center py-0.5">Receipt Grade</th>
                <th rowSpan={2} className="border-r border-red-800 w-20 text-center py-1">Crop Year</th>
                <th rowSpan={2} className="border-r border-red-800 w-32 text-left py-1 pl-2">Challan Grade Name</th>
                <th colSpan={2} className="border-r border-red-800 text-center py-0.5">Agency</th>
                <th colSpan={2} className="border-r border-red-800 text-center py-0.5">Challan Marka</th>
                <th rowSpan={2} className="border-r border-red-800 w-24 text-center py-1">Marks (Phota)</th>
                <th colSpan={2} className="border-r border-red-800 text-center py-0.5">Quantity</th>
                <th rowSpan={2} className="border-r border-red-800 w-16 text-center py-1">Unit</th>
                <th rowSpan={2} className="text-left py-1 pl-2">Remarks</th>
              </tr>
              <tr className="text-center font-semibold">
                <th className="border-r border-red-800 w-12 py-0.5">Code</th>
                <th className="border-r border-red-800 w-28 text-left pl-2">Name</th>
                <th className="border-r border-red-800 w-12 py-0.5">Code</th>
                <th className="border-r border-red-800 w-28 text-left pl-2">Name</th>
                <th className="border-r border-red-800 w-12 py-0.5">Code</th>
                <th className="border-r border-red-800 w-28 text-left pl-2">Name</th>
                <th className="border-r border-red-800 w-14 text-right pr-2">Chln.</th>
                <th className="border-r border-red-800 w-14 text-right pr-2">Rcpt.</th>
              </tr>
            </thead>
            <tbody>
              {details.map((row, index) => (
                <tr key={index} className="border-b border-slate-300 hover:bg-amber-50/30 transition-colors h-7 text-xs font-mono">
                  {/* Srl. No */}
                  <td className="bg-slate-200 border-r border-slate-300 text-center font-bold text-gray-700 text-[11px]">
                    {row.srl_no}
                  </td>
                  
                  {/* Receipt Grade Code */}
                  <td className="border-r border-slate-300">
                    <select
                      value={row.receipt_grade_code}
                      onChange={(e) => handleRowChange(index, 'receipt_grade_code', e.target.value)}
                      className="w-full h-full bg-slate-50 border-0 outline-none px-1 text-center font-bold text-slate-800 text-[11px]"
                    >
                      <option value="">--</option>
                      {grades.map(g => (
                        <option key={g.grade_code} value={g.grade_code}>{g.grade_code}</option>
                      ))}
                    </select>
                  </td>

                  {/* Receipt Grade Name */}
                  <td className="border-r border-slate-300">
                    <input 
                      type="text"
                      list="grades_dl"
                      value={row.receipt_grade_name}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        const matched = grades.find(g => String(g.grade_name).toUpperCase() === val);
                        setDetails(prev => {
                          const next = [...prev];
                          next[index] = {
                            ...next[index],
                            receipt_grade_name: val,
                            receipt_grade_code: matched ? matched.grade_code : next[index].receipt_grade_code,
                            challan_grade_name: matched ? matched.grade_name : next[index].challan_grade_name
                          };
                          return next;
                        });
                      }}
                      className="w-full h-full bg-white border-0 outline-none px-1 uppercase text-[11px]"
                    />
                  </td>

                  {/* Crop Year */}
                  <td className="border-r border-slate-300">
                    <input 
                      type="text"
                      value={row.crop_year}
                      onChange={(e) => handleRowChange(index, 'crop_year', e.target.value)}
                      className="w-full h-full bg-white border-0 outline-none px-1 text-center text-[11px]"
                    />
                  </td>

                  {/* Challan Grade Name */}
                  <td className="border-r border-slate-300">
                    <input 
                      type="text"
                      value={row.challan_grade_name}
                      onChange={(e) => handleRowChange(index, 'challan_grade_name', e.target.value.toUpperCase())}
                      className="w-full h-full bg-white border-0 outline-none px-2 uppercase text-[11px]"
                    />
                  </td>

                  {/* Agency Code */}
                  <td className="border-r border-slate-300">
                    <input 
                      type="text"
                      value={row.agency_code || ''}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        const matched = agencies.find(a => String(a.agency_code).toUpperCase() === val);
                        setDetails(prev => {
                          const next = [...prev];
                          next[index] = {
                            ...next[index],
                            agency_code: val,
                            agency_name: matched ? String(matched.agency_name).toUpperCase() : next[index].agency_name
                          };
                          return next;
                        });
                      }}
                      className="w-full h-full bg-[#ffffd2] border-0 outline-none px-1 text-center font-bold text-[11px]"
                    />
                  </td>

                  {/* Agency Name */}
                  <td className="border-r border-slate-300">
                    <input 
                      type="text"
                      list="agencies_dl"
                      value={row.agency_name || ''}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        const matched = agencies.find(a => String(a.agency_name).toUpperCase() === val);
                        setDetails(prev => {
                          const next = [...prev];
                          next[index] = {
                            ...next[index],
                            agency_name: val,
                            agency_code: matched ? String(matched.agency_code).toUpperCase() : next[index].agency_code
                          };
                          return next;
                        });
                      }}
                      className="w-full h-full bg-white border-0 outline-none px-2 uppercase text-[11px]"
                    />
                  </td>

                  {/* Challan Marka Code */}
                  <td className="border-r border-slate-300">
                    <input 
                      type="text"
                      value={row.challan_marka_code || ''}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        const matched = markas.find(m => String(m.marka_code).toUpperCase() === val);
                        setDetails(prev => {
                          const next = [...prev];
                          next[index] = {
                            ...next[index],
                            challan_marka_code: val,
                            challan_marka_name: matched ? String(matched.marka_name).toUpperCase() : next[index].challan_marka_name
                          };
                          return next;
                        });
                      }}
                      className="w-full h-full bg-[#ffffd2] border-0 outline-none px-1 text-center font-bold text-[11px]"
                    />
                  </td>

                  {/* Challan Marka Name */}
                  <td className="border-r border-slate-300">
                    <input 
                      type="text"
                      list="markas_dl"
                      value={row.challan_marka_name || ''}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        const matched = markas.find(m => String(m.marka_name).toUpperCase() === val);
                        setDetails(prev => {
                          const next = [...prev];
                          next[index] = {
                            ...next[index],
                            challan_marka_name: val,
                            challan_marka_code: matched ? String(matched.marka_code).toUpperCase() : next[index].challan_marka_code
                          };
                          return next;
                        });
                      }}
                      className="w-full h-full bg-white border-0 outline-none px-2 uppercase text-[11px]"
                    />
                  </td>

                  {/* Marks (Phota) */}
                  <td className="border-r border-slate-300">
                    <input 
                      type="text"
                      value={row.marks_phota || ''}
                      onChange={(e) => handleRowChange(index, 'marks_phota', e.target.value)}
                      className="w-full h-full bg-white border-0 outline-none px-2 text-[11px]"
                    />
                  </td>

                  {/* Quantity Chln. */}
                  <td className="border-r border-slate-300">
                    <input 
                      type="number"
                      step="1"
                      value={row.quantity_chln !== undefined ? row.quantity_chln : 0}
                      onChange={(e) => handleRowChange(index, 'quantity_chln', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full h-full bg-white border-0 outline-none px-1 text-right text-[11px] font-bold"
                    />
                  </td>

                  {/* Quantity Rcpt. */}
                  <td className="border-r border-slate-300">
                    <input 
                      type="number"
                      step="1"
                      value={row.quantity_rcpt !== undefined ? row.quantity_rcpt : 0}
                      onChange={(e) => handleRowChange(index, 'quantity_rcpt', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full h-full bg-amber-50 border-0 outline-none px-1 text-right text-[11px] font-bold text-indigo-950"
                    />
                  </td>

                  {/* Unit */}
                  <td className="border-r border-slate-300">
                    <select
                      value={row.unit || 'BALES'}
                      onChange={(e) => handleRowChange(index, 'unit', e.target.value)}
                      className="w-full h-full bg-white border-0 outline-none px-1 text-[10px] uppercase font-bold text-slate-700 cursor-pointer"
                    >
                      {Array.from(new Set([...unitList, row.unit].filter(Boolean))).map((u: string) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>

                  {/* Remarks */}
                  <td>
                    <input 
                      type="text"
                      value={row.remarks}
                      onChange={(e) => handleRowChange(index, 'remarks', e.target.value)}
                      className="w-full h-full bg-white border-0 outline-none px-2 text-[11px]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Grid Total Footer summary row */}
            <tfoot className="bg-slate-200 border-t border-slate-400 text-xs font-sans text-gray-700 h-8">
              <tr className="font-bold">
                <td colSpan={10} className="text-right pr-4 font-bold uppercase text-[10px]">Grid Total:</td>
                <td className="text-right pr-2 border-r border-slate-300 text-slate-800 font-mono font-black">{totalChallanQuantity}</td>
                <td className="text-right pr-2 border-r border-slate-300 text-blue-900 font-mono font-black">{totalReceiptQuantity}</td>
                <td className="border-r border-slate-300"></td>
                <td className="pl-4 uppercase text-[9px] text-gray-500">Auto-Calculated Summary</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Triple Column Bottom Weighments Desk precisely matching Jute Screen layout */}
        <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Column 1 */}
          <div className="border border-slate-400 bg-[#e4e0d8] p-3 flex flex-col gap-2 shadow-sm">
            <h3 className="text-[10px] font-bold text-gray-700 uppercase tracking-wide border-b border-gray-400 pb-1 flex items-center justify-between">
              <span>Supplier Weights Reference</span>
              <span className="text-[9px] text-red-600 font-bold lowercase font-sans">* mandatory</span>
            </h3>
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-800 w-52 flex items-center gap-1">
                  Challan Material Weight (M.T): <span className="text-red-600 font-bold">*</span>
                </span>
                <input 
                  type="number"
                  step="any"
                  value={formData.challan_material_weight || 0}
                  onChange={(e) => handleInputChange('challan_material_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-white border border-slate-400 font-mono text-right px-2 py-0.5 outline-none w-28 text-xs font-bold text-slate-900 focus:bg-amber-50" 
                  required
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-800 w-52 flex items-center gap-1">
                  Supplier Net Weight (M.Ton): <span className="text-red-600 font-bold">*</span>
                </span>
                <input 
                  type="number"
                  step="any"
                  value={formData.supplier_net_weight || 0}
                  onChange={(e) => handleInputChange('supplier_net_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-[#f0fff0] border border-emerald-400 font-mono text-right px-2 py-0.5 outline-none w-28 text-xs font-bold text-emerald-950 focus:bg-amber-50" 
                  required
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-800 w-52 flex items-center gap-1">
                  Electronic Weighbridge Net: <span className="text-red-600 font-bold">*</span>
                </span>
                <input 
                  type="number"
                  step="any"
                  value={formData.electronic_net_weight || 0}
                  onChange={(e) => handleInputChange('electronic_net_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-[#fff0f0] border border-red-400 font-mono text-right px-2 py-0.5 outline-none w-28 text-xs font-bold text-red-950 focus:bg-[#ffffd2]" 
                  required
                />
              </div>
            </div>
          </div>

          {/* Column 2 */}
          <div className="border border-slate-400 bg-[#e4e0d8] p-3 flex flex-col gap-2 shadow-sm">
            <h3 className="text-[10px] font-bold text-gray-700 uppercase tracking-wide border-b border-gray-400 pb-1">Actual Weighbridge Metrics</h3>
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-800 w-52">Actual Gross Weight (Lorry+RAW):</span>
                <input 
                  type="number"
                  step="any"
                  value={formData.actual_gross_weight || ''}
                  onChange={(e) => handleInputChange('actual_gross_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-white border border-slate-400 font-mono text-right px-2 py-0.5 outline-none w-28 text-xs focus:bg-amber-50" 
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-800 w-52">Supplier Challan Gross (M.Ton):</span>
                <input 
                  type="number"
                  step="any"
                  value={formData.supplier_challan_gross || ''}
                  onChange={(e) => handleInputChange('supplier_challan_gross', e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-white border border-slate-400 font-mono text-right px-2 py-0.5 outline-none w-28 text-xs focus:bg-amber-50" 
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-800 w-52">Electronic Gross Weight Scale:</span>
                <input 
                  type="number"
                  step="any"
                  value={formData.electronic_gross_weight || ''}
                  onChange={(e) => handleInputChange('electronic_gross_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-white border border-slate-400 font-mono text-right px-2 py-0.5 outline-none w-28 text-xs focus:bg-[#ffffd2]" 
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#ac0000] w-52">Weight Reduced (Moisture Red M.T):</span>
                <input 
                  type="number"
                  step="any"
                  value={formData.weight_reduced || ''}
                  onChange={(e) => handleInputChange('weight_reduced', e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-[#ffffdf] border border-amber-400 font-mono text-right px-2 py-0.5 outline-none w-28 text-xs text-amber-900 font-bold focus:bg-amber-50" 
                />
              </div>
            </div>
          </div>

          {/* Column 3 */}
          <div className="border border-slate-400 bg-[#e4e0d8] p-3 flex flex-col gap-2 shadow-sm">
            <h3 className="text-[10px] font-bold text-gray-700 uppercase tracking-wide border-b border-gray-400 pb-1">Empty Lorry Tare Metrics</h3>
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-800 w-52">Actual Tare Weight (Empty Lorry):</span>
                <input 
                  type="number"
                  step="any"
                  value={formData.actual_tare_weight || ''}
                  onChange={(e) => handleInputChange('actual_tare_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-white border border-slate-400 font-mono text-right px-2 py-0.5 outline-none w-28 text-xs focus:bg-amber-50" 
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-800 w-52">Supplier Tare Weight (M.Ton):</span>
                <input 
                  type="number"
                  step="any"
                  value={formData.supplier_tare_weight || ''}
                  onChange={(e) => handleInputChange('supplier_tare_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-white border border-slate-400 font-mono text-right px-2 py-0.5 outline-none w-28 text-xs focus:bg-amber-50" 
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-800 w-52">Electronic Tare Weight Scale:</span>
                <input 
                  type="number"
                  step="any"
                  value={formData.electronic_tare_weight || ''}
                  onChange={(e) => handleInputChange('electronic_tare_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-white border border-slate-400 font-mono text-right px-2 py-0.5 outline-none w-28 text-xs focus:bg-[#ffffd2]" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Operational Flow Button bar strictly based on Jute Screen visuals */}
        <div className="bg-[#dfdfdf] border border-slate-400 p-2.5 flex flex-wrap justify-between items-center gap-2 shadow-inner">
          <div className="flex gap-2.5">
            <LegacyButton
              onClick={resetFormToBlank}
              icon={Plus}
              variant="default"
              className="bg-white border-2 border-[#808080] border-r-black border-b-black uppercase px-4 h-8 font-bold font-sans text-gray-800 active:border-t-black active:border-l-black active:bg-gray-100"
            >
              Add New
            </LegacyButton>

            {initialData && (
              <LegacyButton
                onClick={deleteCurrentVoucher}
                icon={Trash2}
                variant="danger"
                className="bg-red-50 border-2 border-red-500 uppercase px-4 h-8 font-bold font-sans text-red-900 hover:bg-red-100 active:border-red-900"
              >
                Delete
              </LegacyButton>
            )}
          </div>

          <div className="flex gap-2.5">
            <LegacyButton
              onClick={handleSave}
              icon={Save}
              variant="default"
              disabled={loading}
              className="bg-[#ac0000] text-white border-2 border-[#800000] border-r-black border-b-black uppercase px-6 h-8 font-black hover:bg-red-800 font-sans active:border-t-black active:border-l-black"
            >
              {loading ? "SAVING..." : "Save"}
            </LegacyButton>

            <LegacyButton
              onClick={onCancel}
              icon={X}
              variant="default"
              className="bg-[#e4e0d8] border-2 border-[#808080] border-r-black border-b-black uppercase px-5 h-8 font-bold font-sans text-gray-800 active:border-t-black active:border-l-black"
            >
              Cancel
            </LegacyButton>

            <LegacyButton
              onClick={onCancel}
              icon={Archive}
              variant="default"
              className="bg-[#e4e0d8] border-2 border-[#808080] border-r-black border-b-black uppercase px-5 h-8 font-bold font-sans text-gray-800 active:border-t-black active:border-l-black"
            >
              Exit
            </LegacyButton>

            <LegacyButton
              onClick={onCancel}
              icon={Layers}
              variant="default"
              className="bg-slate-100 border-2 border-[#808080] border-r-black border-b-black uppercase px-5 h-8 font-bold font-sans text-teal-950 active:border-t-black active:border-l-black"
            >
              View List
            </LegacyButton>
          </div>
        </div>

      </div>

      {/* Structured suggestions Datalists for premium user flow experience */}
      <datalist id="brokers_dl">
        {brokers.map((b, idx) => (
          <option key={b.id || idx} value={String(b.brok_name).toUpperCase()} />
        ))}
      </datalist>

      <datalist id="suppliers_dl">
        {suppliers.map((s, idx) => (
          <option key={s.id || idx} value={String(s.supp_name).toUpperCase()} />
        ))}
      </datalist>

      <datalist id="areas_dl">
        {areas.map((a, idx) => (
          <option key={a.id || idx} value={String(a.area_name).toUpperCase()} />
        ))}
      </datalist>

      <datalist id="agencies_dl">
        {agencies.map((agency, idx) => (
          <option key={agency.id || idx} value={String(agency.agency_name).toUpperCase()} />
        ))}
      </datalist>

      <datalist id="grades_dl">
        {grades.map((g, idx) => (
          <option key={g.id || idx} value={String(g.grade_name).toUpperCase()} />
        ))}
      </datalist>

      <datalist id="markas_dl">
        {markas.map((m, idx) => (
          <option key={m.id || idx} value={String(m.marka_name).toUpperCase()} />
        ))}
      </datalist>
      </div>
    </LegacyLayout>
  );
}
