import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrivalDetailRow, FinalArrivalEntryFormData } from './finalArrivalTypes';
import { dbModule } from '../../services/dbModule';
import { supabase } from '../../lib/supabase';
import { enforceEditOrDeletePermission } from '../../lib/permissions';
import { sanitizeDate } from '../../lib/utils';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';

interface UseFinalArrivalEntryLogicProps {
  initialData?: any;
  onSave?: (d: any) => void;
  onCancel?: () => void;
}

export function useFinalArrivalEntryLogic({ initialData, onSave }: UseFinalArrivalEntryLogicProps) {
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
  const [temporaryArrivalList, setTemporaryArrivalList] = useState<any[]>([]);
  const [unitList, setUnitList] = useState<string[]>(['BALES', 'DRUMS', 'LOOSE', 'P.BALES', 'H.BALES']);

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
      const u = (d.unit || initialFA?.unit_name || '').toString().trim().toUpperCase();
      const isLoose = u.includes('LOOSE') || u === 'LOOSE';
      if (isLoose) {
        return {
          ...d,
          quantity_chln: 0,
          quantity_rcpt: 0
        };
      }
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

  const [formData, setFormData] = useState<FinalArrivalEntryFormData>(() => {
    return {
      financial_year: initialData?.financial_year || '2026-2027',
      arrival_no: initialData?.final_arrival_no || initialData?.arrival_no || '',
      mr_no: initialData?.mr_no || '',
      po_no: initialData?.po_no || '',
      po_date: initialData?.po_date || '',
      date: initialData?.date || initialData?.final_arrival_date || '',
      jci: initialData?.jci || initialData?.jci_no || 'No',
      jci_no: initialData?.jci || initialData?.jci_no || 'No',
      challan_supplier: (initialData?.challan_supplier || '').toUpperCase(),
      supplier: (initialData?.supplier || '').toUpperCase(),
      broker: (initialData?.broker || '').toUpperCase(),
      transporter_name: initialData?.transporter_name || '',
      challan_rr_no: initialData?.challan_rr_no || initialData?.challan_railway_receipt_no || initialData?.rr_gr_no || '',
      challan_railway_receipt_no: initialData?.challan_railway_receipt_no || initialData?.challan_rr_no || '',
      challan_rr_date: initialData?.challan_rr_date || '',
      lorry_number: initialData?.lorry_number || (initialData as any)?.lorry_no || (initialData as any)?.vehicle_no || '',
      pan_no: initialData?.pan_no || initialData?.part_no || '',
      part_no: initialData?.part_no || initialData?.pan_no || '',
      part_date: initialData?.part_date || '',
      consignment_note: initialData?.consignment_note || initialData?.consignment_note_no || (initialData as any)?.consignment_notice_no || '',
      consignment_note_no: initialData?.consignment_note || initialData?.consignment_note_no || (initialData as any)?.consignment_notice_no || '',
      consignment_note_date: initialData?.consignment_note_date || '',
      di_no: initialData?.di_no || '',
      di_date: initialData?.di_date || '',
      invoice_no: initialData?.invoice_no || '',
      invoice_date: initialData?.invoice_date || '',
      ptf: initialData?.ptf || initialData?.rfs || 'No',
      rfs: initialData?.rfs || initialData?.ptf || 'No',
      lorry_returned: initialData?.lorry_returned || 'No',
      lorry_returned_other_mill: initialData?.lorry_returned_other_mill || 'No',
      arrival_area_code: initialData?.arrival_area_code || '',
      arrival_area_name: (initialData?.arrival_area_name || initialData?.area || '').toUpperCase(),
      area: (initialData?.area || initialData?.arrival_area_name || '').toUpperCase(),
      unit_code: initialData?.unit_code || 'I',
      unit_name: initialData?.unit_name || 'BALES',
      way_bill_no: initialData?.way_bill_no || '',
      way_bill_date: initialData?.way_bill_date || '',
      rr_gr_no: initialData?.rr_gr_no || '',
      apmc_fees: initialData?.apmc_fees || 0,
      remarks: initialData?.remarks || '',
      temporary_arrival_no: initialData?.temporary_arrival_no || '',
      temporary_arrival_date: initialData?.temporary_arrival_date || '',

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

  const combinedPoOptions = useMemo(() => {
    const list: any[] = [];
    
    const pendingTempArrivals = (temporaryArrivalList || []).filter((ta: any) => {
      const tempMrVal = String(ta.temporary_arrival_no || ta.amad_no || ta.arrival_no || '').trim().toUpperCase();
      const tempId = String(ta.id || ta.temporary_arrival_id || '').trim().toUpperCase();

      if (!tempMrVal && !tempId) return true;

      const isCurrentMatch = initialData && (
        (initialData.temporary_arrival_no && String(initialData.temporary_arrival_no).trim().toUpperCase() === tempMrVal) ||
        (initialData.arrival_no && String(initialData.arrival_no).trim().toUpperCase() === tempMrVal)
      );
      if (isCurrentMatch) return true;

      const isAlreadyFinalized = (existingArrivals || []).some((fa: any) => {
        const faTempNo = String(fa.temporary_arrival_no || fa.amad_no || '').trim().toUpperCase();
        const faArrNo = String(fa.arrival_no || fa.mr_no || '').trim().toUpperCase();
        const faTempId = String(fa.temporary_arrival_id || '').trim().toUpperCase();

        return (
          (tempMrVal && (faTempNo === tempMrVal || faArrNo === tempMrVal)) ||
          (tempId && faTempId === tempId)
        );
      });

      return !isAlreadyFinalized;
    });

    pendingTempArrivals.forEach((ta: any, idx: number) => {
      const poVal = (ta.po_no || '').trim().toUpperCase();
      const tempMrVal = (ta.temporary_arrival_no || ta.amad_no || ta.arrival_no || '').trim().toUpperCase();
      const supplierVal = (ta.supplier || ta.challan_supplier || '').trim();
      const lorryVal = (ta.lorry_number || ta.lorry_no || ta.vehicle_no || '').trim();
      const weightVal = ta.challan_material_weight || ta.quantity || 0;
      const dateVal = ta.date || ta.temporary_arrival_date || ta.po_date || '';

      list.push({
        id: ta.id || ta.temporary_arrival_id || `temp_${idx}`,
        po_no: tempMrVal || poVal || `TEMP-${idx + 1}`,
        temp_mr_no: tempMrVal,
        display_label: tempMrVal 
          ? `Temp MR #${tempMrVal} ${poVal ? `(PO: ${poVal})` : ''} - ${supplierVal} ${lorryVal ? `[${lorryVal}]` : ''}` 
          : `${poVal} - ${supplierVal} (${weightVal} MT)`,
        supplier: supplierVal,
        challan_supplier: ta.challan_supplier || supplierVal,
        broker: ta.broker || '',
        lorry_number: lorryVal,
        po_date: dateVal,
        quantity: weightVal,
        source: 'temporary_material_received',
        raw_item: ta
      });
    });

    return list;
  }, [temporaryArrivalList, existingArrivals, initialData]);

  useEffect(() => {
    async function loadMastersAndIncrement() {
      try {
        const [brokData, suppData, areaData, agcData, gradeData, markaData, allArrivals, inspectionData, poData, tempPoData, tempArrivalData] = await Promise.all([
          dbModule.fetchAll('broker_master').catch(() => []),
          dbModule.fetchAll('supply_master').catch(() => []),
          dbModule.fetchAll('area_master').catch(() => []),
          dbModule.fetchAll('agency_master').catch(() => []),
          dbModule.fetchAll('grade_master').catch(() => []),
          dbModule.fetchAll('marka_master').catch(() => []),
          dbModule.fetchAll('final_arrival').catch(() => []),
          supabase ? supabase.from('material_inspection').select('*').order('created_at', { ascending: false }).then(r => r.data || []) : [],
          dbModule.fetchAll('purchase_master').catch(() => []),
          dbModule.fetchAll('sauda_check_point').catch(() => []),
          dbModule.fetchAll('temporary_material_received', 'created_at', false).catch(() => [])
        ]);

        setBrokers((brokData || []).map((b: any) => ({ ...b, brok_name: (b.brok_name || '').toUpperCase() })));
        setSuppliers((suppData || []).map((s: any) => ({ ...s, supp_name: (s.supp_name || '').toUpperCase() })));
        setAreas((areaData || []).map((a: any) => ({ ...a, area_name: (a.area_name || '').toUpperCase() })));
        setAgencies(agcData || []);
        setGrades(gradeData || []);
        setInspectionsList(inspectionData || []);
        setExistingArrivals(allArrivals || []);
        setTemporaryArrivalList(tempArrivalData || []);
        const normalizedTempPoData = (tempPoData || []).map(po => ({ ...po, status: po.status || 'temp' }));
        const mergedPos = [...(poData || []), ...normalizedTempPoData];
        const uniquePos = Array.from(new Map(mergedPos.map(po => [po.po_no, po])).values());

        setPurchaseOrders(uniquePos.filter((po: any) => {
          if (!po.po_no || po.status === 'cancelled') return false;
          
          const isCurrentMatch = initialData && initialData.po_no && String(po.po_no).trim().toUpperCase() === String(initialData.po_no).trim().toUpperCase();
          
          const pendingStr = String(po.pending ?? '').trim().toLowerCase();
          const statusStr = String(po.status ?? '').trim().toLowerCase();
          const receivedWt = parseFloat(po.received_weight_mt || po.received_mt) || 0;
          const contractWt = parseFloat(po.total_contract_mt || po.quantity) || 0;
          const isCompleted = po.pending === false || pendingStr === 'no' || pendingStr === 'false' || po.pending === 0 || statusStr === 'completed' || statusStr === 'settled' || (contractWt > 0 && receivedWt >= contractWt);

          if (isCurrentMatch) return true;
          return !isCompleted;
        }));

        const finalMarkas = markaData || [];
        setMarkas(finalMarkas);

        if (!initialData) {
          let nextNum = 502;
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

  const loadDetailsFromAmad = async (tempMrNo: string) => {
    if (!tempMrNo) {
      alert("Please select or enter a Temporary M.R. Number.");
      return;
    }
    try {
      const searchVal = tempMrNo.trim().toUpperCase();

      let matchedInsp = inspectionsList.find(ins => {
        const arrNo = String(ins.arrival_no || ins.ref_arrival_no || '').trim().toUpperCase();
        const mrNo = String(ins.mr_no || '').trim().toUpperCase();
        return arrNo === searchVal || mrNo === searchVal || mrNo.endsWith(`/${searchVal}`) || mrNo.includes(`/${searchVal}`);
      });

      if (!matchedInsp && supabase) {
        const { data: dbInsp } = await supabase
          .from('mill_inspection_master')
          .select('*')
          .or(`arrival_no.eq.${searchVal},ref_arrival_no.eq.${searchVal},mr_no.ilike.%${searchVal}%`);
        if (dbInsp && dbInsp.length > 0) {
          matchedInsp = dbInsp[0];
        }
      }

      if (matchedInsp) {
        await loadDetailsFromInspection(matchedInsp.mr_no);
        return;
      }

      let matchedAmad = temporaryArrivalList.find(a => 
        String(a.temporary_arrival_no || a.amad_no || a.arrival_no || a.amad_id || '').trim().toUpperCase() === searchVal
      );

      if (!matchedAmad && supabase) {
        const { data } = await supabase
          .from('temporary_material_received')
          .select('*')
          .or(`temporary_arrival_no.eq.${searchVal},amad_no.eq.${searchVal}`);
        if (data && data.length > 0) matchedAmad = data[0];
      }

      if (matchedAmad) {
        const matchedPo = purchaseOrders.find(po => String(po.po_no).trim().toUpperCase() === String(matchedAmad.po_no || '').trim().toUpperCase());

        setFormData(prev => ({
          ...prev,
          temporary_arrival_no: matchedAmad.temporary_arrival_no || matchedAmad.amad_no || matchedAmad.arrival_no || prev.temporary_arrival_no,
          arrival_no: matchedAmad.temporary_arrival_no || matchedAmad.amad_no || matchedAmad.arrival_no || prev.temporary_arrival_no,
          temporary_arrival_date: matchedAmad.date || matchedAmad.temporary_arrival_date || prev.temporary_arrival_date,
          po_no: matchedAmad.po_no || prev.po_no,
          po_date: matchedPo?.po_date || matchedPo?.s_date || matchedAmad.po_date || matchedAmad.date || prev.po_date,
          jci: matchedAmad.jci || prev.jci,
          supplier: (matchedAmad.supplier || matchedPo?.supplier || prev.supplier || '').toUpperCase(),
          challan_supplier: (matchedAmad.challan_supplier || matchedAmad.supplier || matchedPo?.challan_supplier || matchedPo?.supplier || prev.challan_supplier || '').toUpperCase(),
          broker: (matchedAmad.broker || matchedPo?.broker || prev.broker || '').toUpperCase(),
          date: matchedAmad.date || prev.date,
          lorry_number: matchedAmad.lorry_number || matchedAmad.lorry_no || matchedAmad.vehicle_no || prev.lorry_number,
          transporter_name: matchedAmad.transporter_name || prev.transporter_name,
          challan_rr_no: matchedAmad.challan_rr_no || matchedAmad.challan_railway_receipt_no || prev.challan_rr_no,
          challan_railway_receipt_no: matchedAmad.challan_railway_receipt_no || matchedAmad.challan_rr_no || prev.challan_railway_receipt_no,
          challan_rr_date: matchedAmad.challan_rr_date || matchedAmad.date || prev.challan_rr_date,
          pan_no: matchedAmad.pan_no || prev.pan_no,
          consignment_note: matchedAmad.consignment_note || matchedAmad.consignment_note_no || prev.consignment_note,
          consignment_note_no: matchedAmad.consignment_note || matchedAmad.consignment_note_no || prev.consignment_note_no,
          consignment_note_date: matchedAmad.consignment_note_date || prev.consignment_note_date,
          di_no: matchedAmad.di_no || prev.di_no,
          di_date: matchedAmad.di_date || prev.di_date,
          part_date: matchedAmad.di_date || prev.part_date,
          invoice_no: matchedAmad.invoice_no || prev.invoice_no,
          invoice_date: matchedAmad.invoice_date || prev.invoice_date,
          ptf: matchedAmad.ptf || prev.ptf,
          lorry_returned: matchedAmad.lorry_returned || prev.lorry_returned,
          lorry_returned_other_mill: matchedAmad.lorry_returned_other_mill || prev.lorry_returned_other_mill,
          arrival_area_code: matchedAmad.arrival_area_code || prev.arrival_area_code,
          arrival_area_name: (matchedAmad.arrival_area_name || prev.arrival_area_name || '').toUpperCase(),
          unit_code: matchedAmad.unit_code || prev.unit_code,
          unit_name: (matchedAmad.unit_name || prev.unit_name || '').toUpperCase(),
          way_bill_no: matchedAmad.way_bill_no || prev.way_bill_no,
          way_bill_date: matchedAmad.way_bill_date || prev.way_bill_date,
          apmc_fees: matchedAmad.apmc_fees || prev.apmc_fees,
          remarks: matchedAmad.remarks || prev.remarks,
          challan_material_weight: Number(matchedAmad.challan_material_weight) || Number(prev.challan_material_weight),
          actual_gross_weight: Number(matchedAmad.actual_gross_weight) || Number(prev.actual_gross_weight),
          supplier_challan_gross: Number(matchedAmad.supplier_challan_gross) || Number(prev.supplier_challan_gross),
          electronic_gross_weight: Number(matchedAmad.electronic_gross_weight) || Number(prev.electronic_gross_weight),
          actual_tare_weight: Number(matchedAmad.actual_tare_weight) || Number(prev.actual_tare_weight),
          supplier_tare_weight: Number(matchedAmad.supplier_tare_weight) || Number(prev.supplier_tare_weight),
          electronic_tare_weight: Number(matchedAmad.electronic_tare_weight) || Number(prev.electronic_tare_weight),
          supplier_net_weight: Number(matchedAmad.supplier_net_weight) || Number(prev.supplier_net_weight),
          electronic_net_weight: Number(matchedAmad.electronic_net_weight) || Number(prev.electronic_net_weight),
          weight_reduced: Number(matchedAmad.weight_reduced) || Number(prev.weight_reduced),
        }));

        const rawGrid = matchedAmad.grid_details || matchedAmad.details || matchedAmad.items;
        const amadUnit = (matchedAmad.unit_name || matchedAmad.unit || formData.unit_name || 'BALES').toUpperCase();
        if (rawGrid) {
          let parsedGrid: any[] = [];
          if (typeof rawGrid === 'string') {
            try { parsedGrid = JSON.parse(rawGrid); } catch (e) {}
          } else if (Array.isArray(rawGrid)) {
            parsedGrid = rawGrid;
          }
          if (parsedGrid && parsedGrid.length > 0) {
            setDetails(parsedGrid.map((row: any, idx: number) => {
              const rowUnit = (row.unit || amadUnit || 'BALES').toString().trim().toUpperCase();
              const isLoose = rowUnit.includes('LOOSE') || rowUnit === 'LOOSE';
              const rawNetto = Number(row.netto_pnto) || Number(row.quantity_mt) || Number(row.challan_gross_wt) || Number(row.net_weight) || Number(matchedAmad.supplier_net_weight) || 0;
              return { 
                ...row, 
                srl_no: idx + 1,
                unit: row.unit || amadUnit,
                quantity_chln: isLoose ? 0 : (row.quantity_chln !== undefined ? Number(row.quantity_chln) : Number(row.quantity) || 0),
                quantity_rcpt: isLoose ? 0 : (row.quantity_rcpt !== undefined ? Number(row.quantity_rcpt) : Number(row.quantity) || 0),
                netto_pnto: rawNetto
              };
            }));
          }
        }
      } else {
        alert(`No Temporary M.R record found matching "${tempMrNo}".`);
      }
    } catch (e) {
      console.error("Error loading Temporary M.R details:", e);
    }
  };

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
          po_date: matchedPo?.po_date || matchedPo?.s_date || matchedInspection.po_date || amadData?.date || amadData?.lorry_date || prev.po_date || '',
          jci: matchedInspection.jci || amadData?.jci || prev.jci || 'No',
          supplier: (matchedInspection.supplier_name || amadData?.supplier || matchedPo?.supplier || prev.supplier || '').toUpperCase(),
          challan_supplier: (matchedInspection.challan_supplier || amadData?.challan_supplier || matchedInspection.supplier_name || matchedPo?.challan_supplier || matchedPo?.supplier || prev.challan_supplier || '').toUpperCase(),
          broker: (matchedInspection.broker_name || amadData?.broker || matchedPo?.broker || prev.broker || '').toUpperCase(),
          date: matchedInspection.arrival_date || amadData?.date || prev.date,
          lorry_number: (matchedInspection as any).lorry_number || (matchedInspection as any).lorry_no || (matchedInspection as any).vehicle_no || (amadData as any)?.lorry_number || (amadData as any)?.lorry_no || (amadData as any)?.vehicle_no || prev.lorry_number,
          transporter_name: matchedInspection.transporter_name || amadData?.transporter_name || prev.transporter_name,
          challan_rr_no: matchedInspection.challan_rr_no || (matchedInspection as any).challan_railway_receipt_no || amadData?.challan_rr_no || amadData?.challan_railway_receipt_no || prev.challan_rr_no,
          challan_railway_receipt_no: (matchedInspection as any).challan_railway_receipt_no || matchedInspection.challan_rr_no || amadData?.challan_railway_receipt_no || amadData?.challan_rr_no || prev.challan_railway_receipt_no,
          challan_rr_date: matchedInspection.challan_rr_date || amadData?.lorry_date || prev.challan_rr_date,
          pan_no: matchedInspection.pan_no || amadData?.pan_no || prev.pan_no,
          consignment_note: (matchedInspection as any).consignment_note || matchedInspection.consignment_note_no || (matchedInspection as any).consignment_no || amadData?.consignment_note || amadData?.consignment_note_no || prev.consignment_note,
          consignment_note_no: (matchedInspection as any).consignment_note || matchedInspection.consignment_note_no || (matchedInspection as any).consignment_no || amadData?.consignment_note || amadData?.consignment_note_no || prev.consignment_note_no,
          consignment_note_date: (matchedInspection as any).consignment_note_date || (matchedInspection as any).consignment_date || amadData?.consignment_note_date || prev.consignment_note_date,
          di_no: matchedInspection.di_no || amadData?.di_no || prev.di_no,
          di_date: matchedInspection.di_date || amadData?.di_date || prev.di_date,
          part_date: matchedInspection.part_date || amadData?.part_date || prev.part_date,
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
          arrival_no: matchedInspection.arrival_no || amadData?.temporary_arrival_no || amadData?.amad_no || prev.temporary_arrival_no,
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

            const rowUnit = (md.unit || matchedInspection.unit_name || amadData?.unit_name || formData.unit_name || 'BALES').toString().trim().toUpperCase();
            const isLoose = rowUnit.includes('LOOSE') || rowUnit === 'LOOSE';
            const rawNetto = Number(md.challan_gross_wt) || Number(md.netto_pnto) || 0;

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
              netto_pnto: rawNetto,
              quantity_chln: isLoose ? 0 : (Number(md.quantity) || Math.round(rawNetto)),
              quantity_rcpt: isLoose ? 0 : (Number(md.quantity) || Math.round(rawNetto)),
              unit: md.unit || rowUnit,
              remarks: '',
              marks_phota: md.marks_phota || ''
            };
          });
          setDetails(newDetails);
        }
      }
    } catch (e: any) {
      alert("Error loading inspection records: " + e.message);
    }
  };

  const loadDetailsFromPo = async (poNo: string) => {
    if (!poNo) return;
    try {
      const poNoUpper = poNo.trim().toUpperCase();
      let filteredDetails: any[] = [];

      if (supabase) {
        const [pdmRes, scpRes] = await Promise.all([
          supabase.from('purchase_detail_master').select('*').eq('po_no', poNo.trim()),
          supabase.from('sauda_check_point_details').select('*').eq('po_no', poNo.trim())
        ]);
        const pdm = pdmRes.data || [];
        const scp = scpRes.data || [];

        if (pdm.length > 0) {
          filteredDetails = pdm;
        } else if (scp.length > 0) {
          filteredDetails = scp;
        } else {
          const [pdmIns, scpIns] = await Promise.all([
            supabase.from('purchase_detail_master').select('*').ilike('po_no', poNoUpper),
            supabase.from('sauda_check_point_details').select('*').ilike('po_no', poNoUpper)
          ]);
          filteredDetails = (pdmIns.data && pdmIns.data.length > 0) ? pdmIns.data : (scpIns.data || []);
        }
      }

      if (!filteredDetails || filteredDetails.length === 0) {
        const [allPdm, allScp] = await Promise.all([
          dbModule.fetchAll('purchase_detail_master').catch(() => []),
          dbModule.fetchAll('sauda_check_point_details').catch(() => [])
        ]);
        const pdm = (allPdm || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poNoUpper);
        const scp = (allScp || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poNoUpper);
        filteredDetails = pdm.length > 0 ? pdm : scp;
      }

      if (!filteredDetails || filteredDetails.length === 0) {
        const matchedPo = purchaseOrders.find((p: any) => String(p.po_no).trim().toUpperCase() === poNoUpper);
        if (matchedPo) {
          if (Array.isArray(matchedPo.items) && matchedPo.items.length > 0) {
            filteredDetails = matchedPo.items;
          } else if (Array.isArray(matchedPo.details) && matchedPo.details.length > 0) {
            filteredDetails = matchedPo.details;
          }
        }
      }

      if (filteredDetails && filteredDetails.length > 0) {
        const newDetails: ArrivalDetailRow[] = filteredDetails.map((fd: any, index: number) => {
          const gradeName = fd.grade_name || fd.variety || fd.item_name || '';
          const gradeCode = fd.grade_code || fd.item_code || '';
          const markaName = fd.marka_name || fd.marka || '';
          const markaCode = fd.marka_code || '';
          const agencyName = fd.agency_name || fd.agency || '';
          const agencyCode = fd.agency_code || '';
          const nettoVal = Number(fd.quantity_mt || fd.quantity || fd.netto_pnto || 0);
          const rowUnit = (fd.unit || formData.unit_name || 'BALES').toString().trim().toUpperCase();
          const isLoose = rowUnit.includes('LOOSE') || rowUnit === 'LOOSE';

          return {
            srl_no: index + 1,
            receipt_grade_code: gradeCode,
            receipt_grade_name: gradeName,
            crop_year: fd.crop_year || '2026-27',
            challan_grade_name: gradeName,
            agency_code: agencyCode,
            agency_name: agencyName,
            challan_marka_code: markaCode,
            challan_marka_name: markaName,
            netto_pnto: nettoVal,
            quantity_chln: isLoose ? 0 : Math.round(nettoVal),
            quantity_rcpt: isLoose ? 0 : Math.round(nettoVal),
            unit: fd.unit || rowUnit,
            remarks: fd.remarks || ''
          };
        });
        setDetails(newDetails);
      }
    } catch (err) {
      console.warn("Error loading details from PO:", err);
    }
  };

  const handleInputChange = (field: string, val: any) => {
    setFormData(prev => {
      const next = { ...prev, [field]: val };
      if (field === 'consignment_note') {
        next.consignment_note_no = val;
      } else if (field === 'consignment_note_no') {
        next.consignment_note = val;
      } else if (field === 'challan_rr_no') {
        next.challan_railway_receipt_no = val;
      } else if (field === 'challan_railway_receipt_no') {
        next.challan_rr_no = val;
      } else if (field === 'temporary_arrival_no') {
        next.arrival_no = val;
      }

      if (field === 'unit_name') {
        const uUpper = String(val || '').trim().toUpperCase();
        const isLoose = uUpper.includes('LOOSE') || uUpper === 'LOOSE';
        setDetails(prevRows => prevRows.map(r => ({
          ...r,
          unit: uUpper,
          ...(isLoose ? { quantity_chln: 0, quantity_rcpt: 0 } : {})
        })));
      }

      if (field === 'po_no' && val) {
        const valUpper = String(val).trim().toUpperCase();
        const matched = purchaseOrders.find(po => String(po.po_no).trim().toUpperCase() === valUpper);
        if (matched) {
          next.po_date = matched.po_date || matched.s_date || matched.date || next.po_date;
          next.supplier = (matched.supplier || matched.merchant || next.supplier || '').toUpperCase();
          next.challan_supplier = (matched.challan_supplier || matched.supplier || matched.merchant || next.challan_supplier || '').toUpperCase();
          next.broker = (matched.broker || next.broker || '').toUpperCase();
          next.arrival_area_name = (matched.area || next.arrival_area_name || '').toUpperCase();
          const matchedArea = areas.find(a => String(a.area_name).trim().toUpperCase() === String(matched.area).trim().toUpperCase());
          if (matchedArea) {
            next.arrival_area_code = matchedArea.area_code;
          }
        }
        loadDetailsFromPo(valUpper);
      }
      return next;
    });
  };

  const handleSelectPoOption = (item: any) => {
    handleInputChange('po_no', item.po_no);
    if (item.supplier) handleInputChange('supplier', item.supplier);
    if (item.challan_supplier) handleInputChange('challan_supplier', item.challan_supplier);
    if (item.broker) handleInputChange('broker', item.broker);
    if (item.po_date) handleInputChange('po_date', item.po_date);
    if (item.lorry_number) handleInputChange('lorry_number', item.lorry_number);
    
    if (item.temp_mr_no) {
      handleInputChange('temporary_arrival_no', item.temp_mr_no);
      loadDetailsFromAmad(item.temp_mr_no);
    } else if (item.po_no) {
      loadDetailsFromPo(item.po_no);
    }
    setShowPoDropdown(false);
  };

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
        unit: formData.unit_name || 'BALES',
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

  const handleRowChange = (index: number, field: keyof ArrivalDetailRow, val: any) => {
    const updatedDetails = [...details];
    
    if (field === 'unit') {
      const uUpper = String(val || '').trim().toUpperCase();
      const isLoose = uUpper.includes('LOOSE') || uUpper === 'LOOSE';
      updatedDetails[index] = {
        ...updatedDetails[index],
        unit: uUpper,
        ...(isLoose ? { quantity_chln: 0, quantity_rcpt: 0 } : {})
      };
    } else if (field === 'receipt_grade_code') {
      const g = grades.find(g => String(g.grade_code) === String(val));
      updatedDetails[index] = {
        ...updatedDetails[index],
        receipt_grade_code: val,
        receipt_grade_name: g ? g.grade_name : updatedDetails[index].receipt_grade_name,
        challan_grade_name: g ? g.grade_name : updatedDetails[index].challan_grade_name
      };
    } else {
      updatedDetails[index] = {
        ...updatedDetails[index],
        [field]: val
      };
    }
    
    setDetails(updatedDetails);
  };

  const calculatedLowestNetWeight = useMemo(() => {
    const elecNet = (Number(formData.electronic_gross_weight) || Number(formData.actual_gross_weight) || 0) - (Number(formData.electronic_tare_weight) || Number(formData.actual_tare_weight) || 0);
    const suppNet = (Number(formData.supplier_challan_gross) || 0) - (Number(formData.supplier_tare_weight) || 0);
    const nets = [
      Number(formData.electronic_net_weight),
      elecNet > 0 ? elecNet : 0,
      Number(formData.supplier_net_weight),
      suppNet > 0 ? suppNet : 0,
      Number(formData.challan_material_weight),
      Number(formData.weight_reduced)
    ].filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
    return nets.length > 0 ? Math.min(...nets) : '';
  }, [
    formData.electronic_net_weight,
    formData.electronic_gross_weight,
    formData.electronic_tare_weight,
    formData.actual_gross_weight,
    formData.actual_tare_weight,
    formData.supplier_net_weight,
    formData.supplier_challan_gross,
    formData.supplier_tare_weight,
    formData.challan_material_weight,
    formData.weight_reduced
  ]);

  const finalWeightDisplayValue = (formData.weight_reduced !== undefined && formData.weight_reduced !== null && Number(formData.weight_reduced) !== 0)
    ? formData.weight_reduced
    : calculatedLowestNetWeight;

  // Auto-calculate NETTO (M.T) for rows where UNIT is BALES (not LOOSE): (RCPT / Total RCPT) * Final Weight (M.TON)
  useEffect(() => {
    const finalWeight = Number(finalWeightDisplayValue) || 0;

    const isBalesRow = (row: ArrivalDetailRow) => {
      const u = (row.unit || formData.unit_name || 'BALES').toString().trim().toUpperCase();
      return u.includes('BALE') || u === 'BALES' || (!u.includes('LOOSE') && u !== 'LOOSE');
    };

    const getRowRcpt = (r: ArrivalDetailRow) => {
      const u = (r.unit || formData.unit_name || 'BALES').toString().trim().toUpperCase();
      if (u.includes('LOOSE') || u === 'LOOSE') return 0;
      return Number(r.quantity_rcpt) || Number(r.quantity_chln) || 0;
    };

    const balesIndices = details
      .map((r, i) => (isBalesRow(r) && getRowRcpt(r) > 0 ? i : -1))
      .filter(i => i !== -1);

    const sumRcpt = balesIndices.reduce((sum, idx) => sum + getRowRcpt(details[idx]), 0);

    let needsUpdate = false;
    let allocatedNetto = 0;

    const updated = details.map((row, index) => {
      const u = (row.unit || formData.unit_name || 'BALES').toString().trim().toUpperCase();
      const isLoose = u.includes('LOOSE') || u === 'LOOSE';

      if (isLoose) {
        if (row.quantity_chln !== 0 || row.quantity_rcpt !== 0) {
          needsUpdate = true;
          return { ...row, quantity_chln: 0, quantity_rcpt: 0 };
        }
        return row;
      }

      if (!isBalesRow(row)) return row;

      const rcpt = getRowRcpt(row);
      if (rcpt <= 0 || sumRcpt <= 0 || finalWeight <= 0) {
        if (Number(row.netto_pnto) !== 0) {
          needsUpdate = true;
          return { ...row, netto_pnto: 0 };
        }
        return row;
      }

      const isLastBalesRow = index === balesIndices[balesIndices.length - 1];
      let calculatedNetto = 0;
      if (isLastBalesRow) {
        calculatedNetto = Number((finalWeight - allocatedNetto).toFixed(3));
        calculatedNetto = Math.max(0, calculatedNetto);
      } else {
        calculatedNetto = Number(((rcpt / sumRcpt) * finalWeight).toFixed(3));
        allocatedNetto += calculatedNetto;
      }

      if (Number(row.netto_pnto) !== calculatedNetto) {
        needsUpdate = true;
        return { ...row, netto_pnto: calculatedNetto };
      }
      return row;
    });

    if (needsUpdate) {
      setDetails(updated);
    }
  }, [finalWeightDisplayValue, formData.unit_name, details]);

  const handleSave = async () => {
    if (initialData && !enforceEditOrDeletePermission("Edit")) {
      return;
    }
    if (!formData.arrival_no) {
      alert("Arrival No. is mandatory.");
      return;
    }

    setLoading(true);
    try {
      const activeRows = details.filter(d => 
        d.receipt_grade_name || d.receipt_grade_code || d.challan_grade_name || Number(d.netto_pnto) > 0 || Number(d.quantity_chln) > 0 || Number(d.quantity_rcpt) > 0
      );

      const totalPacketsSum = activeRows.reduce((acc, curr) => {
        const u = (curr.unit || formData.unit_name || '').toString().trim().toUpperCase();
        const isLoose = u.includes('LOOSE') || u === 'LOOSE';
        if (isLoose) return acc;
        return acc + (Number(curr.quantity_rcpt) || Number(curr.quantity_chln) || 0);
      }, 0);
      const totalWeightSum = activeRows.reduce((acc, curr) => acc + (Number(curr.netto_pnto) || 0), 0);

      const isHeaderLoose = (formData.unit_name || '').toString().trim().toUpperCase().includes('LOOSE');
      const payload = {
        financial_year: formData.financial_year,
        final_arrival_no: formData.arrival_no,
        arrival_no: formData.arrival_no,
        final_arrival_date: sanitizeDate(formData.date),
        arrival_date: sanitizeDate(formData.date),
        mr_no: formData.mr_no || null,
        po_no: formData.po_no || null,
        po_date: sanitizeDate(formData.po_date),
        date: sanitizeDate(formData.date),
        jci: formData.jci || 'No',
        jci_no: formData.jci || 'No',
        challan_supplier: formData.challan_supplier,
        supplier: formData.supplier,
        broker: formData.broker,
        transporter_name: formData.transporter_name,
        challan_rr_no: formData.challan_rr_no || formData.challan_railway_receipt_no || '',
        challan_railway_receipt_no: formData.challan_railway_receipt_no || formData.challan_rr_no || '',
        challan_rr_date: sanitizeDate(formData.challan_rr_date),
        lorry_number: formData.lorry_number,
        lorry_no: formData.lorry_number,
        pan_no: formData.pan_no || formData.part_no || '',
        part_no: formData.part_no || formData.pan_no || '',
        part_date: sanitizeDate(formData.part_date),
        consignment_note: formData.consignment_note || formData.consignment_note_no || '',
        consignment_note_no: formData.consignment_note || formData.consignment_note_no || '',
        consignment_note_date: sanitizeDate(formData.consignment_note_date),
        di_no: formData.di_no,
        di_date: sanitizeDate(formData.di_date),
        invoice_no: formData.invoice_no,
        invoice_date: sanitizeDate(formData.invoice_date),
        ptf: formData.ptf || 'No',
        rfs: formData.ptf || 'No',
        lorry_returned: formData.lorry_returned || 'No',
        lorry_returned_other_mill: formData.lorry_returned_other_mill || 'No',
        arrival_area_code: formData.arrival_area_code,
        arrival_area_name: formData.arrival_area_name,
        area: formData.arrival_area_name,
        unit_code: formData.unit_code,
        unit_name: formData.unit_name,
        way_bill_no: formData.way_bill_no,
        way_bill_date: sanitizeDate(formData.way_bill_date),
        rr_gr_no: formData.rr_gr_no || '',
        apmc_fees: formData.apmc_fees || 0,
        remarks: formData.remarks,
        temporary_arrival_no: formData.temporary_arrival_no,
        temporary_arrival_date: sanitizeDate(formData.temporary_arrival_date),
        total_packets: isHeaderLoose ? 0 : totalPacketsSum,
        weight_qtl: totalWeightSum * 10,
        grid_details: activeRows.map(row => {
          const u = (row.unit || formData.unit_name || '').toString().trim().toUpperCase();
          const isLoose = u.includes('LOOSE') || u === 'LOOSE' || isHeaderLoose;
          return {
            ...row,
            unit: row.unit || formData.unit_name || 'BALES',
            quantity_chln: isLoose ? 0 : Math.round(Number(row.quantity_chln) || 0),
            quantity_rcpt: isLoose ? 0 : Math.round(Number(row.quantity_rcpt) || 0)
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
        weight_reduced: Number(finalWeightDisplayValue) || Number(formData.weight_reduced) || 0
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

      if (supabase && formData.unit_name) {
        const u = formData.unit_name.toUpperCase();
        const keys = [formData.arrival_no, formData.mr_no, formData.temporary_arrival_no, formData.po_no].filter(Boolean);
        for (const k of keys) {
          Promise.all([
            supabase.from('material_inspection_details').update({ unit: u }).eq('mr_no', k),
            supabase.from('material_inspection').update({ unit_name: u }).eq('mr_no', k)
          ]).catch(() => {});
        }
      }

      if (onSave) onSave(payload);
    } catch (e: any) {
      alert("Failed to save final arrival voucher: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalReceiptQuantity = details.reduce((acc, curr) => {
    const u = (curr.unit || formData.unit_name || '').toString().trim().toUpperCase();
    const isLoose = u.includes('LOOSE') || u === 'LOOSE';
    return acc + (isLoose ? 0 : (Number(curr.quantity_rcpt) || 0));
  }, 0);

  const totalChallanQuantity = details.reduce((acc, curr) => {
    const u = (curr.unit || formData.unit_name || '').toString().trim().toUpperCase();
    const isLoose = u.includes('LOOSE') || u === 'LOOSE';
    return acc + (isLoose ? 0 : (Number(curr.quantity_chln) || 0));
  }, 0);

  const totalNettoWeight = details.reduce((acc, curr) => acc + (Number(curr.netto_pnto) || 0), 0);

  return {
    loading,
    containerRef,
    formData,
    setFormData,
    details,
    setDetails,
    brokers,
    suppliers,
    areas,
    agencies,
    grades,
    markas,
    purchaseOrders,
    temporaryArrivalList,
    unitList,
    showPoDropdown,
    setShowPoDropdown,
    combinedPoOptions,
    handleInputChange,
    handleAreaChange,
    handleSelectPoOption,
    loadDetailsFromAmad,
    loadDetailsFromInspection,
    loadDetailsFromPo,
    handleAddRow,
    handleDeleteRow,
    handleRowChange,
    handleSave,
    finalWeightDisplayValue,
    calculatedLowestNetWeight,
    totalReceiptQuantity,
    totalChallanQuantity,
    totalNettoWeight
  };
}
