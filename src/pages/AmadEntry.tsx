import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  X, 
  Plus, 
  Trash2,
  RefreshCw,
  Archive,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Amad, ArrivalDetailRow } from '../types';
import { dbModule } from '../services/dbModule';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { supabase } from '../lib/supabase';
import { enforceEditOrDeletePermission, getCurrentUserContext } from '../lib/permissions';

export default function AmadEntry({ onSave, onCancel, initialData }: { onSave?: (d: any) => void; onCancel?: () => void; initialData?: Amad }) {
  const [loading, setLoading] = useState(false);
  const [showPoDropdown, setShowPoDropdown] = useState(false);

  const amadContainerRef = useRef<HTMLDivElement>(null);
  useKeyboardNavigation(amadContainerRef, () => {
    handleSave();
  });
  const [brokers, setBrokers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [markas, setMarkas] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  // We can write a parseDetails helper
  const getPaddedDetails = (initialAmad?: Amad) => {
    let pDetails: ArrivalDetailRow[] = [];
    if (initialAmad && initialAmad.grid_details) {
      if (typeof initialAmad.grid_details === 'string') {
        try {
          const parsed = initialAmad.grid_details === 'undefined' || initialAmad.grid_details === 'null' ? [] : JSON.parse(initialAmad.grid_details === "undefined" ? "null" : initialAmad.grid_details);
          if (Array.isArray(parsed)) {
            pDetails = parsed;
          }
        } catch (e) {
          console.error("Error parsing grid_details JSON:", e);
        }
      } else if (Array.isArray(initialAmad.grid_details)) {
        pDetails = initialAmad.grid_details;
      }
    }
    
    // Backfill quantity_chln and quantity_rcpt from netto_pnto if missing & normalize agency
    pDetails = pDetails.map(d => {
      const agencyName = d.agency_name || (d as any).agency || '';
      const agencyCode = d.agency_code || '';
      const updatedD = { ...d, agency_name: agencyName, agency_code: agencyCode };
      if (Number(d.netto_pnto) > 0 && (!d.quantity_chln || !d.quantity_rcpt)) {
        const roundedNetto = Math.round(Number(d.netto_pnto));
        return {
          ...updatedD,
          quantity_chln: d.quantity_chln || roundedNetto,
          quantity_rcpt: d.quantity_rcpt || roundedNetto
        };
      }
      return updatedD;
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
        remarks: ''
      });
    }
    return padded.map((row, idx) => ({ ...row, srl_no: idx + 1 }));
  };

  const [details, setDetails] = useState<ArrivalDetailRow[]>(() => getPaddedDetails(initialData));
  const [unitList, setUnitList] = useState<string[]>(['BALES', 'DRUMS', 'LOOSE', 'P.BALES', 'H.BALES']);

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
        remarks: ''
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
        console.warn("Failed to fetch unit_master in AmadEntry", err);
      }
    }
    loadUnits();
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const parseLorry = (lorry?: string) => {
    let prefix = '';
    let suffix = '';
    if (lorry) {
      const parts = lorry.split('-');
      if (parts.length > 1) {
        prefix = parts[0];
        suffix = parts.slice(1).join('-');
      } else {
        prefix = lorry;
      }
    }
    return { prefix, suffix };
  };

  const [formData, setFormData] = useState(() => {
    const lorryInfo = parseLorry(initialData?.lorry_number || (initialData as any)?.lorry_no || (initialData as any)?.vehicle_no);
    return {
      financial_year: initialData?.financial_year || '2026-2027',
      arrival_no: initialData?.temporary_arrival_no || initialData?.amad_no || '',
      po_no: initialData?.po_no || '',
      date: initialData?.date || today,
      jci: initialData?.jci || 'No',
      challan_supplier: (initialData?.challan_supplier || '').toUpperCase(),
      supplier: (initialData?.supplier || '').toUpperCase(),
      broker: (initialData?.broker || '').toUpperCase(),
      transporter_name: initialData?.transporter_name || '',
      challan_rr_no: initialData?.challan_rr_no || '',
      lorry_prefix: lorryInfo.prefix,
      lorry_suffix: lorryInfo.suffix,
      pan_no: initialData?.pan_no || '',
      lorry_date: initialData?.lorry_date || today,
      consignment_note_no: initialData?.consignment_note_no || '',
      di_no: initialData?.di_no || '',
      di_date: initialData?.di_date || '',
      invoice_no: initialData?.invoice_no || '',
      invoice_date: initialData?.invoice_date || '',
      ptf: initialData?.ptf || 'No',
      lorry_returned: initialData?.lorry_returned || 'No',
      lorry_returned_other_mill: initialData?.lorry_returned_other_mill || 'No',
      arrival_area_code: initialData?.arrival_area_code || '',
      arrival_area_name: (initialData?.arrival_area_name || '').toUpperCase(),
      unit_code: initialData?.unit_code || 'I',
      unit_name: initialData?.unit_name || 'BALES',
      way_bill_no: initialData?.way_bill_no || '',
      way_bill_date: initialData?.way_bill_date || '',
      apmc_fees: initialData?.apmc_fees || 0,
      remarks: initialData?.remarks || '',

      // Bottom weights
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

  const fetchPurchaseOrders = async () => {
    try {
      const [poRes, tempPoRes] = await Promise.all([
        supabase ? supabase.from('purchase_master').select('*').order('created_at', { ascending: false }) : dbModule.fetchAll('purchase_master', 'created_at', false).then(d => ({ data: d, error: null })),
        supabase ? supabase.from('sauda_check_point').select('*').order('created_at', { ascending: false }) : dbModule.fetchAll('sauda_check_point', 'created_at', false).then(d => ({ data: d, error: null }))
      ]);

      const poData = poRes?.data || [];
      const tempPoData = (tempPoRes?.data || []).map((po: any) => ({ ...po, status: po.status || 'temp' }));

      const mergedPos = [...poData, ...tempPoData];
      // Deduplicate by po_no
      const uniqueMap = new Map<string, any>();
      mergedPos.forEach((po: any) => {
        if (po && po.po_no) {
          const key = String(po.po_no).trim().toUpperCase();
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, po);
          }
        }
      });

      const uniquePos = Array.from(uniqueMap.values());

      const filtered = uniquePos
        .filter((po: any) => {
          if (!po.po_no || po.status === 'cancelled') return false;

          const isCurrentMatch = initialData && initialData.po_no && String(po.po_no).trim().toUpperCase() === String(initialData.po_no).trim().toUpperCase();

          const pendingStr = String(po.pending ?? '').trim().toLowerCase();
          const statusStr = String(po.status ?? '').trim().toLowerCase();
          const receivedWt = parseFloat(po.received_weight_mt || po.received_mt) || 0;
          const contractWt = parseFloat(po.total_contract_mt || po.quantity) || 0;
          const isCompleted = po.pending === false || pendingStr === 'no' || pendingStr === 'false' || po.pending === 0 || statusStr === 'completed' || statusStr === 'settled' || (contractWt > 0 && receivedWt >= contractWt);

          if (isCurrentMatch) return true;
          return !isCompleted;
        })
        .map((po: any) => ({
          ...po,
          po_no: String(po.po_no).trim(),
          broker: (po.broker || '').toUpperCase(),
          supplier: (po.supplier || po.party_name || po.merchant || '').toUpperCase(),
          challan_supplier: (po.challan_supplier || po.supplier || po.party_name || po.merchant || '').toUpperCase(),
          area: (po.area || '').toUpperCase()
        }));

      setPurchaseOrders(filtered);
    } catch (err) {
      console.warn("Error in fetchPurchaseOrders from purchase_master:", err);
    }
  };

  // Load master records and set up real-time PO query subscription
  useEffect(() => {
    async function loadMastersAndIncrement() {
      try {
        const [brokData, suppData, areaData, agcData, gradeData, markaData, allAmads] = await Promise.all([
          dbModule.fetchAll('broker_master').catch(() => []),
          dbModule.fetchAll('supply_master').catch(() => []),
          dbModule.fetchAll('area_master').catch(() => []),
          dbModule.fetchAll('agency_master').catch(() => []),
          dbModule.fetchAll('grade_master').catch(() => []),
          dbModule.fetchAll('marka_master').catch(() => []),
          dbModule.fetchAll('temporary_material_received').catch(() => [])
        ]);

        setBrokers((brokData || []).map((b: any) => ({ ...b, brok_name: (b.brok_name || '').toUpperCase() })));
        setSuppliers((suppData || []).map((s: any) => ({ ...s, supp_name: (s.supp_name || '').toUpperCase() })));
        setAreas((areaData || []).map((a: any) => ({ ...a, area_name: (a.area_name || '').toUpperCase() })));
        setAgencies(agcData || []);
        setGrades(gradeData || []);

        await fetchPurchaseOrders();

        let finalMarkas = markaData || [];
        if (finalMarkas.length === 0) {
          const fallbackNames = ["NO MARK", "SH", "CHANGE", "MJ", "BSP", "RT", "PUROHIT", "DB", "KK", "C.M", "BS", "IM", "NI", "RIEEM", "MAA", "V VISHNU", "KR", "SUNIL", "SARTAJ", "J.S.J", "PK", "ANAND", "RR", "HARI", "PS", "RS", "MR", "GOPAL", "A.P.J.S", "SUN", "SAHEB", "C.R.D", "SM", "SA", "AM", "RABI", "AD", "ML", "RK", "MUBIN", "AMAN", "SKB", "ANTIMA", "SHM", "JMP", "HM", "SN", "KT", "LN", "RAJU", "RA", "SS", "SR", "RAHA", "TT", "USHA", "OP", "ST", "PB", "SK", "BAHETI", "DR", "ROHIT", "BK", "KAMAL", "JM", "CHAIN", "SSB", "SANVI", "BR", "UDM", "JAYA", "MM", "SANGITA", "S", "HBGM", "DHRUV", "SD", "AS", "BALAJI", "AJAY", "SG", "GS", "SB", "RE", "JS", "RM", "RBT", "BD", "MS", "RAEEM", "TS", "TOSH", "LC", "SUMAN", "VANSH", "DK", "BHAWANI", "BP", "SHIV", "SHREE HARI", "A", "KS", "KJ", "VK", "JK", "ARHAM", "SOVA", "KM", "PRAMOD", "PUJA", "DURGA", "JSB", "NS", "JAY HANUMAN", "MB", "MANOJ", "SHUBHAM", "KISHAN", "JAY", "AX", "SKC", "YUNUS", "BIJOY", "BN", "A.J.P", "J/MU/DK", "J/MU/HP", "AP", "ANISH", "RISHAV", "SKS", "BUL BUL", "KEDIA", "SMB", "NAIZA", "MH", "BULBUL", "RAKHECHA", "R.JAIN", "MKC", "NC", "MRR", "P", "J.A.K.", "JAK", "GOBINDA", "RAM", "TULSI G", "PP", "HARI OM", "MOTI", "GK", "KRISHNA", "SANJOY", "AA", "MP", "TANU", "ASHA", "DNJ(BHOWMICK)", "SUMIT", "TULSI/H", "KP", "K.L.K", "SWASTIK", "JC", "PM", "BB", "GM", "SHREE"];
          // Try to async insert them to the DB so they are persistent
          try {
            await Promise.all(
              fallbackNames.map((name, i) => {
                const codeStr = String(i + 1).padStart(2, '0');
                return dbModule.insert('marka_master', { marka_code: codeStr, marka_name: name }).catch(() => null);
              })
            );
          } catch(e) {
            console.warn("Could not insert seed markas to DB:", e);
          }
          finalMarkas = fallbackNames.map((name, i) => ({
            id: i + 1,
            marka_code: String(i + 1).padStart(2, '0'),
            marka_name: name
          }));
        }
        setMarkas(finalMarkas);

        if (!initialData) {
          // Dynamic auto-increment to establish a clean reference voucher serial
          let nextNum = 168; // default base starting number
          if (allAmads && allAmads.length > 0) {
            let lastNum = 167;
            allAmads.forEach((a: any) => {
              const an = String(a.temporary_arrival_no || a.amad_no || '');
              const num = parseInt(an.replace(/[^0-9]/g, ''), 10);
              if (!isNaN(num) && num > lastNum) {
                lastNum = num;
              }
            });
            nextNum = lastNum + 1;
          }
          
          setFormData(prev => ({
            ...prev,
            arrival_no: initialData?.temporary_arrival_no || initialData?.amad_no || '',
            challan_supplier: '',
            supplier: '',
            agency_name: '',
            broker: '',
            arrival_area_name: '',
            arrival_area_code: ''
          }));
        }
      } catch (e) {
        console.error("Error loading master templates:", e);
      }
    }
    loadMastersAndIncrement();

    const handleLocalUpdate = () => {
      fetchPurchaseOrders();
    };
    window.addEventListener('app-data-updated', handleLocalUpdate);

    let poSub: any = null;
    if (supabase) {
      poSub = supabase
        .channel('amad_entry_po_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_master' }, () => {
          fetchPurchaseOrders();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_check_point' }, () => {
          fetchPurchaseOrders();
        })
        .subscribe();
    }

    return () => {
      window.removeEventListener('app-data-updated', handleLocalUpdate);
      if (poSub) {
        supabase.removeChannel(poSub);
      }
    };
  }, [initialData]);

  // Draft features disabled to ensure form is always a fresh blank form on click, per user request
  useEffect(() => {
    // Left empty intentionally to prevent restoring old drafts
  }, [initialData]);

  // Sync and dynamically calculate net weights based on grid and scale inputs (supporting manual overwrites)
  useEffect(() => {
    let totalNetto = 0;
    details.forEach(d => {
      totalNetto += Number(d.netto_pnto) || 0;
    });

    setFormData(prev => {
      const calculatedNetWeight = totalNetto;
      const calculatedSupplierNet = (Number(prev.supplier_challan_gross) || 0) - (Number(prev.supplier_tare_weight) || 0);
      const calculatedElectronicNet = (Number(prev.electronic_gross_weight) || 0) - (Number(prev.electronic_tare_weight) || 0);

      const updatedChallanWeight = Number(calculatedNetWeight.toFixed(3));

      const updatedSupplierWeight = !prev.supplier_net_weight || Number(prev.supplier_net_weight) === 0
        ? (Number(calculatedSupplierNet.toFixed(3)) > 0 ? Number(calculatedSupplierNet.toFixed(3)) : 0)
        : prev.supplier_net_weight;

      const updatedElectronicWeight = !prev.electronic_net_weight || Number(prev.electronic_net_weight) === 0
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

  const loadDetailsFromPo = async (poNo: string) => {
    if (!poNo || !poNo.trim()) return;
    try {
      const poNoUpper = poNo.trim().toUpperCase();
      let filteredDetails: any[] = [];

      // 1. Query Supabase directly if available
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
          // Case insensitive fallback
          const [pdmIns, scpIns] = await Promise.all([
            supabase.from('purchase_detail_master').select('*').ilike('po_no', poNoUpper),
            supabase.from('sauda_check_point_details').select('*').ilike('po_no', poNoUpper)
          ]);
          filteredDetails = (pdmIns.data && pdmIns.data.length > 0) ? pdmIns.data : (scpIns.data || []);
        }
      }

      // 2. Query dbModule fallback if still empty
      if (!filteredDetails || filteredDetails.length === 0) {
        const [allPdm, allScp] = await Promise.all([
          dbModule.fetchAll('purchase_detail_master').catch(() => []),
          dbModule.fetchAll('sauda_check_point_details').catch(() => [])
        ]);
        const pdm = (allPdm || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poNoUpper);
        const scp = (allScp || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poNoUpper);
        filteredDetails = pdm.length > 0 ? pdm : scp;
      }

      // 3. Fallback to embedded items in purchaseOrders list
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
          const rawGrade = String(fd.grade_code || fd.grade_name || fd.grade || '').trim();
          const matchingGrade = grades.find(g => 
            String(g.grade_code || '').trim().toUpperCase() === rawGrade.toUpperCase() || 
            String(g.grade_name || '').trim().toUpperCase() === rawGrade.toUpperCase()
          );
          const gradeName = matchingGrade ? matchingGrade.grade_name : rawGrade;
          const gradeCode = matchingGrade ? matchingGrade.grade_code : rawGrade;

          const rawMarka = String(fd.marka_code || fd.marka_name || fd.marka || fd.challan_marka_name || fd.challan_marka_code || '').trim();
          const matchingMarka = markas.find(m => 
            String(m.marka_code || '').trim().toUpperCase() === rawMarka.toUpperCase() || 
            String(m.marka_name || '').trim().toUpperCase() === rawMarka.toUpperCase()
          );
          const markaName = matchingMarka ? matchingMarka.marka_name : (rawMarka || 'NO MARK');
          const markaCode = matchingMarka ? matchingMarka.marka_code : (rawMarka || '01');

          const rawAgency = String(fd.agency_code || fd.agency_name || fd.agency || '').trim();
          const matchingAgency = agencies.find(a =>
            String(a.agency_code || '').trim().toUpperCase() === rawAgency.toUpperCase() ||
            String(a.agency_name || '').trim().toUpperCase() === rawAgency.toUpperCase()
          );
          const agencyName = matchingAgency ? matchingAgency.agency_name : rawAgency;
          const agencyCode = matchingAgency ? matchingAgency.agency_code : rawAgency;

          const weightVal = parseFloat(fd.weight_mt || fd.netto_pnto || fd.weight || 0) || 0;
          const qtyVal = parseInt(fd.quantity || fd.quantity_rcpt || fd.quantity_chln || 0, 10) || 0;

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
            netto_pnto: weightVal,
            quantity_chln: qtyVal,
            quantity_rcpt: qtyVal,
            remarks: fd.remarks || ''
          };
        });
        setDetails(newDetails);
      }
    } catch (e) {
      console.warn("Error loading details from PO:", e);
    }
  };

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (name === 'broker' || name === 'supplier' || name === 'challan_supplier' || name === 'arrival_area_name') {
      finalValue = (value || '').toUpperCase();
    }
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: name.includes('weight') || name.includes('fees') ? (finalValue === '' ? '' : Number(finalValue)) : finalValue
      };

      if (name === 'challan_material_weight') {
        const numVal = Number(finalValue) || 0;
        updated.supplier_net_weight = numVal;
        updated.electronic_net_weight = numVal;
      }

      if (name === 'po_no' && finalValue) {
        const matched = purchaseOrders.find((po: any) => String(po.po_no).trim().toUpperCase() === String(finalValue).trim().toUpperCase());
        if (matched) {
          updated.supplier = (matched.supplier || prev.supplier || '').toUpperCase();
          updated.challan_supplier = (matched.challan_supplier || matched.supplier || prev.challan_supplier || '').toUpperCase();
          updated.broker = (matched.broker || prev.broker || '').toUpperCase();
          updated.arrival_area_name = (matched.area || prev.arrival_area_name || '').toUpperCase();
          const matchedArea = areas.find((a: any) => String(a.area_name).trim().toUpperCase() === String(matched.area).trim().toUpperCase());
          if (matchedArea) {
            updated.arrival_area_code = matchedArea.area_code;
          }
          updated.unit_code = matched.purchase_unit_code || prev.unit_code || 'I';
          updated.unit_name = matched.purchase_unit_name || prev.unit_name || 'BALES';
          updated.ptf = (matched.ptf_no || matched.is_ptf) ? 'Yes' : 'No';
        }
        
        // Pull details from purchase_detail_master / sauda_check_point_details
        loadDetailsFromPo(finalValue);
      }

      return updated;
    });
  };

  const handleDetailChange = (index: number, field: keyof ArrivalDetailRow, value: any) => {
    setDetails(prev => {
      const updated = [...prev];

      updated[index] = {
        ...updated[index],
        [field]: value
      };

      // Auto-update grade labels and code when selected by Name
      if (field === 'receipt_grade_name') {
        const foundGrade = grades.find(g => g.grade_name === value);
        if (foundGrade) {
          updated[index].receipt_grade_code = foundGrade.grade_code || '';
          updated[index].challan_grade_name = foundGrade.grade_name || '';
        } else {
          updated[index].receipt_grade_code = '';
          updated[index].challan_grade_name = '';
        }
      }

      if (field === 'quantity_rcpt') {
        updated[index].quantity_rcpt = Number(value) || 0;
      }

      if (field === 'quantity_chln') {
        updated[index].quantity_chln = Number(value) || 0;
      }

      // Auto-update marka labels and code when selected by Name
      if (field === 'challan_marka_name') {
        const inputVal = (value || '').trim().toUpperCase();
        const foundMarka = markas.find(m => (m.marka_name || '').trim().toUpperCase() === inputVal);
        if (foundMarka) {
          updated[index].challan_marka_code = foundMarka.marka_code || '';
          updated[index].challan_marka_name = foundMarka.marka_name; // preserve the standard casing
        } else {
          updated[index].challan_marka_code = ''; // manually typed entry - code will be assigned on save
          updated[index].challan_marka_name = value ? value.toUpperCase() : ''; // keep as uppercase custom marka
        }
      }

      if (field === 'agency_name') {
        const inputVal = (value || '').trim().toUpperCase();
        const foundAgency = agencies.find(a => (a.agency_name || '').trim().toUpperCase() === inputVal);
        if (foundAgency) {
          updated[index].agency_code = foundAgency.agency_code || '';
          updated[index].agency_name = foundAgency.agency_name;
        } else {
          updated[index].agency_code = updated[index].agency_code || '';
          updated[index].agency_name = value ? value.toUpperCase() : '';
        }
      }

      if (field === 'agency_code') {
        const inputCode = (value || '').trim().toUpperCase();
        const foundAgency = agencies.find(a => String(a.agency_code || '').trim().toUpperCase() === inputCode);
        if (foundAgency) {
          updated[index].agency_code = foundAgency.agency_code || inputCode;
          updated[index].agency_name = foundAgency.agency_name || updated[index].agency_name;
        } else {
          updated[index].agency_code = inputCode;
        }
      }

      if (field === 'netto_pnto') {
        updated[index].netto_pnto = Number(value) || 0;
      }

      return updated;
    });
  };

  const clearForm = () => {
    setDetails([{
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
      remarks: ''
    }]);
    setFormData(prev => ({
      ...prev,
      po_no: '',
      transporter_name: '',
      challan_rr_no: '',
      lorry_prefix: '',
      lorry_suffix: '',
      pan_no: '',
      consignment_note_no: '',
      di_no: '',
      di_date: '',
      invoice_no: '',
      invoice_date: '',
      ptf: 'No',
      lorry_returned: 'No',
      lorry_returned_other_mill: 'No',
      way_bill_no: '',
      way_bill_date: '',
      apmc_fees: 0,
      remarks: '',
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
    }));
    localStorage.removeItem('amad_draft_form');
    localStorage.removeItem('amad_draft_details');
  };

  const handleSave = async () => {
    if (initialData && !enforceEditOrDeletePermission("Edit")) {
      return;
    }
    setLoading(true);
    try {
      const missingFields: string[] = [];
      if (!formData.arrival_no || !formData.arrival_no.trim()) missingFields.push("Temporary M.R No.");
      if (!formData.po_no || !formData.po_no.trim()) missingFields.push("P.O. Number");
      if (!formData.date || !formData.date.trim()) missingFields.push("Receipt Date");
      if (!formData.challan_supplier || !formData.challan_supplier.trim()) missingFields.push("Challan Supplier");
      if (!formData.supplier || !formData.supplier.trim()) missingFields.push("Supplier");
      if (!formData.broker || !formData.broker.trim()) missingFields.push("Broker");

      const fullLorry = ((formData.lorry_prefix || '') + (formData.lorry_suffix || '')).trim();
      if (!fullLorry) missingFields.push("Lorry Number");

      if (!formData.lorry_date || !formData.lorry_date.trim()) missingFields.push("Lorry Dispatch Date");
      if (!formData.ptf || !formData.ptf.trim()) missingFields.push("P.T.F");
      if (!formData.arrival_area_name || !formData.arrival_area_name.trim()) missingFields.push("Arrival Area");
      if (!formData.unit_name || !formData.unit_name.trim()) missingFields.push("Unit");

      if ((Number(formData.challan_material_weight) || 0) <= 0) {
        missingFields.push("CHALLAN WEIGHT (M.T)");
      }
      if ((Number(formData.supplier_net_weight) || 0) <= 0) {
        missingFields.push("SUPPLIER NET WT (M.T)");
      }
      if ((Number(formData.electronic_net_weight) || 0) <= 0) {
        missingFields.push("ELECTRONIC SCALE NET (M.T)");
      }

      const activeRows = details.filter(row => 
        row.receipt_grade_code || 
        row.receipt_grade_name ||
        Number(row.quantity_rcpt) > 0 || 
        Number(row.quantity_chln) > 0 ||
        Number(row.netto_pnto) > 0 || 
        row.challan_grade_name || 
        row.challan_marka_name
      );

      if (activeRows.length === 0) {
        missingFields.push("At least one grade row in Receipt Grid with Grade");
      } else {
        activeRows.forEach(row => {
          if (!row.receipt_grade_code && !row.receipt_grade_name) {
            missingFields.push(`Receipt Grade (Code/Name) is mandatory for grid row ${row.srl_no}`);
          }
          if (!row.crop_year || !row.crop_year.trim()) {
            missingFields.push(`Crop Year is mandatory for grid row ${row.srl_no}`);
          }
          if (!row.challan_grade_name || !row.challan_grade_name.trim()) {
            missingFields.push(`Challan Grade is mandatory for grid row ${row.srl_no}`);
          }
          if (!row.challan_marka_code && !row.challan_marka_name) {
            missingFields.push(`Challan Marka (Code/Name) is mandatory for grid row ${row.srl_no}`);
          }
          if (!row.quantity_chln || Number(row.quantity_chln) <= 0) {
            missingFields.push(`Quantity (Chln) is mandatory for grid row ${row.srl_no}`);
          }
        });
      }

      if (missingFields.length > 0) {
        alert("Please complete the required fields for Temporary M.R:\n\n• " + missingFields.join("\n• "));
        setLoading(false);
        return;
      }

      // Check if there are any new manual marks to insert into the database
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
              marka_name: name.toUpperCase() // Save nicely as uppercase standard
            });
            // Update in activeRows detail so it saves with the newly generated code str
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
      const lorryCombined = `${formData.lorry_prefix}-${formData.lorry_suffix}`.trim();

      const payload = {
        financial_year: formData.financial_year,
        amad_no: formData.arrival_no,
        temporary_arrival_no: formData.arrival_no,
        po_no: formData.po_no,
        date: formData.date,
        jci: formData.jci,
        challan_supplier: formData.challan_supplier,
        supplier: formData.supplier,
        broker: formData.broker,
        transporter_name: formData.transporter_name,
        challan_rr_no: formData.challan_rr_no,
        lorry_number: lorryCombined,
        pan_no: formData.pan_no,
        lorry_date: formData.lorry_date || null,
        consignment_note_no: formData.consignment_note_no,
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
        total_packets: totalPacketsSum,
        weight_qtl: totalWeightSum * 10,
        grid_details: activeRows.map(row => {
          return {
            ...row,
            agency_code: row.agency_code || '',
            agency_name: row.agency_name || '',
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
        weight_reduced: formData.weight_reduced || 0,

        // Backward compatibility properties
        packets: totalPacketsSum,
        weight: totalWeightSum * 10,
        commodity: 'RAW JUTE',
        variety: activeRows[0]?.receipt_grade_name || 'TOSSA',
        grading: activeRows[0]?.receipt_grade_name || 'TD-5',
        marka: activeRows[0]?.challan_marka_name || 'DIRECT',
        status: 'Active'
      };

      let changesSummaryArr: string[] = [];
      if (initialData) {
        const keysToCompare = [
          { key: 'po_no', label: 'PO No' },
          { key: 'date', label: 'Date' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'lorry_number', label: 'Lorry Number' },
          { key: 'total_packets', label: 'Total Packets' },
          { key: 'remarks', label: 'Remarks' },
          { key: 'actual_gross_weight', label: 'Gross Weight' },
          { key: 'actual_tare_weight', label: 'Tare Weight' }
        ];

        keysToCompare.forEach(({ key, label }) => {
          const oldVal = (initialData as any)[key];
          const newVal = (payload as any)[key];
          if (String(oldVal || '').trim() !== String(newVal || '').trim()) {
            changesSummaryArr.push(`${label}: "${oldVal ?? ''}" → "${newVal ?? ''}"`);
          }
        });
      }

      // Prepare standard database payload
      const dbPayload = { ...payload };

      const tryDbOperation = async (operation: () => Promise<any>) => {
        try {
          return await operation();
        } catch (e: any) {
          if (e.message?.includes('amad_no')) {
            delete (dbPayload as any).amad_no;
            return await operation();
          }
          if (e.message?.includes('temporary_arrival_no')) {
            delete (dbPayload as any).temporary_arrival_no;
            return await operation();
          }
          throw e;
        }
      };

      if (initialData && initialData.amad_id) {
        await Promise.all([
          tryDbOperation(() => dbModule.update('temporary_material_received', 'amad_id', initialData.amad_id, dbPayload)).catch((e) => {
            console.error("Error updating temporary_material_received:", e);
            throw e;
          }),
          tryDbOperation(() => dbModule.update('issue_master', 'amad_id', initialData.amad_id, dbPayload)).catch((e) => {
            console.warn("Could not sync with issue_master or issue_master didn't exist for update, skipping:", e);
          })
        ]);

        // Insert audit trail for update
        const historyLog = {
          amad_no: formData.arrival_no || 'UNKNOWN',
          amad_id: initialData.amad_id,
          action_type: 'UPDATE',
          modified_by: getCurrentUserContext().username || 'ADMIN',
          old_values: JSON.stringify(initialData),
          new_values: JSON.stringify(payload),
          changes_summary: changesSummaryArr.join(', ') || 'Voucher record updated (re-saved)'
        };
        await dbModule.insert('amad_change_history', historyLog).catch((e) => {
          console.error("Failed to write update log:", e);
        });

        alert(`Arrival Register Voucher #${formData.arrival_no} updated successfully!`);
      } else {
        let insertAmadError: any = null;
        let insertIssueError: any = null;
        await Promise.all([
          tryDbOperation(() => dbModule.insert('temporary_material_received', dbPayload)).catch((e) => { insertAmadError = e; return null; }),
          tryDbOperation(() => dbModule.insert('issue_master', dbPayload)).catch((e) => { insertIssueError = e; return null; })
        ]);
        if (insertAmadError) {
          alert(`Failed to save to Database: ${insertAmadError.message || insertAmadError}`);
          return;
        }

        // Insert audit trail for insert
        const historyLog = {
          amad_no: formData.arrival_no || 'UNKNOWN',
          amad_id: formData.arrival_no,
          action_type: 'INSERT',
          modified_by: getCurrentUserContext().username || 'ADMIN',
          old_values: null,
          new_values: JSON.stringify(payload),
          changes_summary: `New Arrival Voucher registered by ${getCurrentUserContext().username || 'ADMIN'} containing ${payload.total_packets} Packets`
        };
        await dbModule.insert('amad_change_history', historyLog).catch((e) => {
          console.error("Failed to write insert log:", e);
        });

        alert(`Arrival Register Saved successfully!\nAdded under Arrival Voucher #${formData.arrival_no}`);
      }

      // Dynamically calculate and update status of PO & Sauda based on total received quantities/weights
      const currentPoNo = formData.po_no ? formData.po_no.trim().toUpperCase() : '';
      if (currentPoNo) {
        try {
          const allPos = await dbModule.fetchAll('purchase_master', 'created_at', false).catch(() => []);
          const matchedPo = allPos.find((po: any) => String(po.po_no).trim().toUpperCase() === currentPoNo);

          if (matchedPo) {
            const allAmads = await dbModule.fetchAll('temporary_material_received').catch(() => []);
            let totalReceivedMt = 0;
            allAmads.forEach((am: any) => {
              // Ensure we don't count the current saved record twice if it is already indexed in allAmads
              if (payload && (formData.arrival_no === am.amad_no || formData.arrival_no === am.amad_id || formData.arrival_no === am.temporary_arrival_no)) return;
              if (initialData && initialData.amad_id === am.amad_id) return;
              if (am.po_no && String(am.po_no).trim().toUpperCase() === currentPoNo) {
                totalReceivedMt += (Number(am.weight_qtl) || 0) / 10;
              }
            });

            totalReceivedMt += totalWeightSum;

            const contractWeight = Number(matchedPo.total_contract_mt) || 0;
            const isComplete = contractWeight > 0 && totalReceivedMt >= (contractWeight - 0.01);
            console.log(`[PO STATUS TRIGGER] Checking fulfillment for PO ${currentPoNo || 'unknown'}: Cumulative Received ${totalReceivedMt.toFixed(3)} MT / Contract Weight ${contractWeight.toFixed(3)} MT. Complete: ${isComplete}`);
            const newStatus = isComplete ? 'completed' : 'in progress';

            const prevPendingStatus = matchedPo.pending;
            const prevTextStatus = matchedPo.status || 'pending';
            
            console.log(`[PO STATUS TRANSITION AUDIT] PO No: ${currentPoNo} during M.R. Entry. Contract: ${contractWeight} MT. Added weight: ${totalWeightSum} MT. Total received weight: ${totalReceivedMt} MT. Complete: ${isComplete}. Transition: pending ${prevPendingStatus} -> ${!isComplete}, status '${prevTextStatus}' -> '${newStatus}'`);

            // Save status transition trace into user_activity_logs for auditing
            dbModule.insert('user_activity_logs', {
              username: getCurrentUserContext().username || 'ADMIN',
              action_type: 'PO_STATUS_TRANSITION',
              action_details: `PO ${currentPoNo} updated during material receipt save. Weight added: ${totalWeightSum} MT. Total cumulative receipts: ${totalReceivedMt.toFixed(3)} MT / ${contractWeight.toFixed(3)} MT. Transitioned from '${prevTextStatus}' (pending: ${prevPendingStatus}) to '${newStatus}' (pending: ${!isComplete}).`,
              ip_address: 'Client Sync Service'
            }).catch((err) => {
              console.warn("Could not insert PO status transition track in user_activity_logs, skipping:", err);
            });

            await dbModule.update('purchase_master', 'po_id', matchedPo.po_id, {
              pending: !isComplete,
              status: newStatus
            }).catch((err) => console.warn("Failed to update purchase_master status:", err));

            const allSaudas = await dbModule.fetchAll('sauda_master').catch(() => []);
            const matchedSauda = allSaudas.find((s: any) => {
              const saudaPoNo = `PO-${s.sauda_no}/${s.financial_year ? s.financial_year.split('-')[1].substring(2) : '26'}`.toUpperCase();
              return saudaPoNo === currentPoNo || String(s.sauda_no) === currentPoNo.replace(/[^0-9]/g, '');
            });

            if (matchedSauda) {
              await dbModule.update('sauda_master', 'sauda_id', matchedSauda.sauda_id, {
                status: newStatus
              }).catch((err) => console.warn("Failed to update sauda_master status:", err));
            }
          }
        } catch (err) {
          console.warn("Error running PO/Sauda status trigger logic:", err);
        }
      }

      localStorage.removeItem('amad_draft_form');
      localStorage.removeItem('amad_draft_details');
      window.dispatchEvent(new CustomEvent('app-data-updated'));
      window.dispatchEvent(new CustomEvent('storage'));
      onSave?.(payload);
    } catch (e: any) {
      console.error(e);
      alert("Error saving Arrival voucher: " + (e.message || "Could not write transaction."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LegacyLayout title="Temporary M.R" subtitle="ARRIVAL WORKSTATION" onClose={onCancel}>
      <div ref={amadContainerRef} className="flex flex-col min-h-full gap-3  p-2">
        
        {/* Core Inputs layout styled matching exact SaudaEntry themes */}
        <div className="grid grid-cols-12 gap-3 shrink-0">
          
          {/* Column Group 1 - Primary Details */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-2">
            <LegacyFieldset legend="Receipt Voucher Info">
              <div className="grid grid-cols-12 gap-x-3 gap-y-1.5 text-[11px] items-center">
                
                <span className="col-span-4 font-bold text-gray-800 text-right">Temporary M.R No.</span>
                <input 
                  type="text" 
                  name="arrival_no" 
                  value={formData.arrival_no} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6" 
                />

                <span className="col-span-4 font-bold text-gray-800 text-right">P.O. Number</span>
                <div className="col-span-8 flex gap-1 relative overflow-visible">
                  <div className="flex-1 flex relative">
                    <input
                      type="text"
                      name="po_no"
                      value={formData.po_no}
                      onChange={(e) => {
                        handleChange(e);
                        setShowPoDropdown(true);
                      }}
                      onFocus={() => {
                        setShowPoDropdown(true);
                        fetchPurchaseOrders();
                      }}
                      onBlur={() => setTimeout(() => setShowPoDropdown(false), 200)}
                      autoComplete="off"
                      placeholder="-- TYPE OR SELECT P.O. --"
                      className="w-full border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6 font-mono text-xs uppercase pr-6"
                    />
                    <div 
                      className="absolute right-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-pointer text-gray-500 hover:text-black"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const nextState = !showPoDropdown;
                        setShowPoDropdown(nextState);
                        if (nextState) fetchPurchaseOrders();
                      }}
                    >
                      <ChevronDown size={14} />
                    </div>
                  </div>
                  {showPoDropdown && (
                     <div className="absolute top-6 left-0 min-w-[360px] w-full max-w-[480px] bg-white border border-gray-400 max-h-56 overflow-y-auto z-[9999] shadow-2xl rounded border-2 border-indigo-600">
                        {purchaseOrders.length === 0 ? (
                          <div className="p-3 text-xs text-gray-500 italic text-center">
                            No active P.O. records found in purchase_master
                          </div>
                        ) : (
                          (() => {
                            const filteredList = purchaseOrders.filter(po => {
                              if (!formData.po_no) return true;
                              const search = formData.po_no.toLowerCase().trim();
                              const poNo = String(po.po_no || '').toLowerCase();
                              const supp = String(po.supplier || po.party_name || po.merchant || '').toLowerCase();
                              const brok = String(po.broker || '').toLowerCase();
                              return poNo.includes(search) || supp.includes(search) || brok.includes(search);
                            });

                            if (filteredList.length === 0) {
                              return (
                                <div className="p-3 text-xs text-gray-500 italic text-center">
                                  No matching P.O. found for "{formData.po_no}"
                                </div>
                              );
                            }

                            return filteredList.map(po => (
                              <div 
                                 key={po.po_id || po.po_no} 
                                 className="px-2.5 py-1.5 text-xs font-mono cursor-pointer hover:bg-indigo-50 hover:text-indigo-900 uppercase border-b border-gray-100 last:border-b-0 transition-colors"
                                 onMouseDown={(e) => {
                                     e.preventDefault();
                                     const poSupplier = (po.supplier || po.party_name || po.merchant || '').toUpperCase();
                                     const poBroker = (po.broker || '').toUpperCase();
                                     const poChallanSupplier = (po.challan_supplier || poSupplier).toUpperCase();
                                     const poArea = (po.area || '').toUpperCase();

                                     setFormData(prev => {
                                       const updated = {
                                         ...prev,
                                         po_no: po.po_no,
                                         supplier: poSupplier || prev.supplier,
                                         challan_supplier: poChallanSupplier || poSupplier || prev.challan_supplier,
                                         broker: poBroker || prev.broker,
                                         arrival_area_name: poArea || prev.arrival_area_name,
                                         jci: 'No'
                                       };

                                       const matchedArea = areas.find((a: any) => String(a.area_name).trim().toUpperCase() === poArea);
                                       if (matchedArea) {
                                         updated.arrival_area_code = matchedArea.area_code;
                                       }
                                       if (po.purchase_unit_code) updated.unit_code = po.purchase_unit_code;
                                       if (po.purchase_unit_name) updated.unit_name = po.purchase_unit_name;
                                       if (po.ptf_no || po.is_ptf) updated.ptf = 'Yes';

                                       return updated;
                                     });

                                     loadDetailsFromPo(po.po_no);
                                     setShowPoDropdown(false);
                                 }}
                              >
                                 <div className="flex items-center justify-between font-bold text-indigo-950">
                                   <span>P.O. #{po.po_no}</span>
                                   <span className="text-[10px] text-gray-500 font-normal">{po.po_date || ''}</span>
                                 </div>
                                 <div className="text-[11px] text-gray-600 flex items-center justify-between gap-2 mt-0.5">
                                   <span className="truncate">Supp: <strong className="text-gray-800">{po.supplier || po.party_name || po.merchant || 'N/A'}</strong></span>
                                   <span className="shrink-0 font-semibold text-emerald-700">{po.total_contract_mt || po.quantity || 0} MT</span>
                                 </div>
                              </div>
                            ));
                          })()
                        )}
                     </div>
                  )}
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Receipt Date</span>
                <input 
                  type="date" 
                  name="date" 
                  value={formData.date} 
                  onChange={handleChange}
                  className="col-span-4 border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6" 
                />

                <div className="col-span-4 flex items-center justify-end gap-2">
                  <span className="font-bold text-red-700">J.C.I</span>
                  <select 
                    name="jci" 
                    value={formData.jci} 
                    onChange={handleChange}
                    className="border border-gray-400 bg-white px-1 py-0.5 font-bold outline-none h-6 w-16"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Challan Supplier</span>
                <div className="col-span-8 flex gap-1 relative overflow-visible">
                  <input
                    type="text"
                    name="challan_supplier"
                    value={formData.challan_supplier}
                    onChange={handleChange}
                    list="challan_supplier_list"
                    placeholder="-- TYPE OR SELECT CHALLAN SUPPLIER --"
                    className="flex-1 border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6 uppercase font-mono text-xs"
                  />
                  <datalist id="challan_supplier_list">
                    {suppliers.map(s => (
                      <option key={s.id || s.supp_name} value={s.supp_name}>
                        {s.supp_name}
                      </option>
                    ))}
                  </datalist>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Supplier</span>
                <div className="col-span-8 flex gap-1 relative overflow-visible">
                  <input
                    type="text"
                    name="supplier"
                    value={formData.supplier}
                    onChange={handleChange}
                    list="supplier_list"
                    placeholder="-- TYPE OR SELECT ACTUAL SUPPLIER --"
                    className="flex-1 border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6 uppercase font-mono text-xs"
                  />
                  <datalist id="supplier_list">
                    {suppliers.map(s => (
                      <option key={s.id || s.supp_name} value={s.supp_name}>
                        {s.supp_name}
                      </option>
                    ))}
                  </datalist>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Broker</span>
                <div className="col-span-8 flex gap-1 relative overflow-visible">
                  <input
                    type="text"
                    name="broker"
                    value={formData.broker}
                    onChange={handleChange}
                    list="broker_list"
                    placeholder="-- TYPE OR SELECT BROKER --"
                    className="flex-1 border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6 uppercase font-mono text-xs"
                  />
                  <datalist id="broker_list">
                    <option value="DIRECT" />
                    {brokers.map(b => (
                      <option key={b.id || b.brok_name} value={b.brok_name}>
                        {b.brok_name}
                      </option>
                    ))}
                  </datalist>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Transporter Name</span>
                <input 
                  type="text" 
                  name="transporter_name" 
                  value={formData.transporter_name} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold h-6" 
                />

                <span className="col-span-4 font-bold text-gray-800 text-right">Challan / R.R. No.</span>
                <input 
                  type="text" 
                  name="challan_rr_no" 
                  value={formData.challan_rr_no} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold h-6" 
                />

                <span className="col-span-4 font-bold text-gray-800 text-right">Lorry Number</span>
                <div className="col-span-8 flex gap-1">
                  <input 
                    type="text" 
                    name="lorry_prefix" 
                    placeholder="PREFIX"
                    value={formData.lorry_prefix} 
                    onChange={handleChange}
                    className="w-1/3 text-center uppercase border border-gray-400 px-2 py-0.5 font-bold outline-none h-6" 
                  />
                  <span className="font-extrabold flex items-center justify-center">-</span>
                  <input 
                    type="text" 
                    name="lorry_suffix" 
                    placeholder="SUFFIX"
                    value={formData.lorry_suffix} 
                    onChange={handleChange}
                    className="flex-1 text-center uppercase border border-gray-400 px-2 py-0.5 font-bold outline-none h-6" 
                  />
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Pan No.</span>
                <input 
                  type="text" 
                  name="pan_no" 
                  value={formData.pan_no} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold font-mono h-6" 
                />

                <span className="col-span-4 font-bold text-gray-800 text-right">Lorry Dispatch Date</span>
                <input 
                  type="date" 
                  name="lorry_date" 
                  value={formData.lorry_date} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6" 
                />
              </div>
            </LegacyFieldset>
          </div>

          {/* Column Group 2 - Delivery and Invoicing */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-2">
            <LegacyFieldset legend="Logistics & Compliance Tracker">
              <div className="grid grid-cols-12 gap-x-3 gap-y-1.5 text-[11px] items-center">
                
                <span className="col-span-4 font-bold text-gray-800 text-right">Consignment Note No.</span>
                <input 
                  type="text" 
                  name="consignment_note_no" 
                  value={formData.consignment_note_no} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold h-6" 
                />

                <span className="col-span-4 font-bold text-gray-800 text-right">D.I. No.</span>
                <input 
                  type="text" 
                  name="di_no" 
                  value={formData.di_no} 
                  onChange={handleChange}
                  className="col-span-4 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold h-6" 
                />

                <div className="col-span-4 flex items-center gap-1.5 pl-1 justify-end">
                  <span className="font-bold text-gray-700">DI Date</span>
                  <input 
                    type="date" 
                    name="di_date" 
                    value={formData.di_date} 
                    onChange={handleChange}
                    className="w-28 border border-gray-400 bg-white px-1 py-0.5 font-bold outline-none h-6 text-center" 
                  />
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Invoice No.</span>
                <input 
                  type="text" 
                  name="invoice_no" 
                  value={formData.invoice_no} 
                  onChange={handleChange}
                  className="col-span-4 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold h-6" 
                />

                <div className="col-span-4 flex items-center gap-1.5 pl-1 justify-end">
                  <span className="font-bold text-gray-700">Inv. Date</span>
                  <input 
                    type="date" 
                    name="invoice_date" 
                    value={formData.invoice_date} 
                    onChange={handleChange}
                    className="w-28 border border-gray-400 bg-white px-1 py-0.5 font-bold outline-none h-6 text-center" 
                  />
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">P.T.F</span>
                <select 
                  name="ptf" 
                  value={formData.ptf} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 font-bold text-gray-900 outline-none h-6"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>

                <span className="col-span-4 font-bold text-gray-800 text-right">Lorry Returned</span>
                <select 
                  name="lorry_returned" 
                  value={formData.lorry_returned} 
                  onChange={handleChange}
                  className="col-span-3 border border-gray-400 bg-white px-2 py-0.5 font-bold text-gray-900 outline-none h-6"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>

                <div className="col-span-5 flex items-center justify-end gap-2">
                  <span className="font-bold text-gray-700 text-[10px] whitespace-nowrap">Ret. Other Mill</span>
                  <select 
                    name="lorry_returned_other_mill" 
                    value={formData.lorry_returned_other_mill} 
                    onChange={handleChange}
                    className="border border-gray-400 bg-white px-1 py-0.5 font-bold text-gray-900 outline-none h-6 w-16"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Arrival Area</span>
                <div className="col-span-8 flex gap-1">
                  <input 
                    type="text" 
                    name="arrival_area_code"
                    value={formData.arrival_area_code}
                    readOnly
                    placeholder="CODE"
                    className="w-16 text-center font-bold bg-slate-100 border border-gray-400 py-0.5 h-6" 
                  />
                  <select
                    name="arrival_area_name"
                    value={formData.arrival_area_name}
                    onChange={(e) => {
                      const matchedArea = areas.find(a => a.area_name === e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        arrival_area_name: e.target.value,
                        arrival_area_code: matchedArea ? matchedArea.area_code : prev.arrival_area_code
                      }));
                    }}
                    className="flex-1 bg-white border border-gray-400 py-0.5 outline-none font-bold h-6 text-xs"
                  >
                    <option value="">-- SELECT AREA --</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.area_name}>{a.area_name}</option>
                    ))}
                  </select>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Unit</span>
                <div className="col-span-8 flex gap-1">
                  <input 
                    type="text" 
                    name="unit_code"
                    value={formData.unit_code}
                    onChange={handleChange}
                    className="w-16 text-center font-bold border border-gray-400 py-0.5 h-6 text-xs bg-slate-50" 
                    readOnly
                  />
                  <select 
                    name="unit_name"
                    value={formData.unit_name || 'BALES'}
                    onChange={(e) => {
                      const uVal = e.target.value;
                      const codeMap: Record<string, string> = { 'BALES': 'I', 'LOOSE': 'II', 'DRUMS': '2', 'P.BALES': '4', 'H.BALES': '5' };
                      setFormData(prev => ({
                        ...prev,
                        unit_name: uVal,
                        unit_code: codeMap[uVal] || prev.unit_code || '1'
                      }));
                    }}
                    className="flex-1 border border-gray-400 py-0.5 px-1 uppercase font-bold h-6 text-xs bg-white outline-none cursor-pointer" 
                  >
                    {Array.from(new Set([...unitList, formData.unit_name].filter(Boolean))).map((u: string) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Way Bill No.</span>
                <input 
                  type="text" 
                  name="way_bill_no" 
                  value={formData.way_bill_no} 
                  onChange={handleChange}
                  className="col-span-4 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold h-6" 
                />

                <div className="col-span-4 flex items-center gap-1.5 pl-1 justify-end">
                  <span className="font-bold text-gray-700">W.B. Date</span>
                  <input 
                    type="date" 
                    name="way_bill_date" 
                    value={formData.way_bill_date} 
                    onChange={handleChange}
                    className="w-28 border border-gray-400 bg-white px-1 py-0.5 font-bold outline-none h-6 text-center" 
                  />
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right flex items-center justify-end gap-1">
                  A.P.M.C Fees (Rs.)
                </span>
                <input 
                  type="number" 
                  name="apmc_fees" 
                  placeholder="0.00"
                  value={formData.apmc_fees || ''} 
                  onChange={handleChange}
                  className="col-span-3 border border-gray-400 bg-white px-2 py-0.5 outline-none font-mono text-right font-bold h-6 focus:border-blue-600 focus:ring-1 focus:ring-blue-600" 
                />

                <div className="col-span-5 flex items-center justify-end gap-1.5">
                  <span className="font-bold text-gray-800 text-[10px] shrink-0">Remarks</span>
                  <input 
                    type="text" 
                    name="remarks" 
                    placeholder="REMARKS"
                    value={formData.remarks} 
                    onChange={handleChange}
                    className="flex-1 border border-gray-400 bg-white px-1 py-0.5 outline-none font-bold h-6" 
                  />
                </div>
              </div>
            </LegacyFieldset>
          </div>
        </div>

        {/* TRANS-GRADE BATCH LEDGER TABLE */}
        <div className="flex-1 min-h-[180px] border-2 border-slate-300 overflow-x-auto bg-white">
          <div className="flex items-center justify-between p-1.5 bg-slate-200 border-b border-slate-300">
             <span className="text-[10px] font-bold uppercase text-slate-700">Receipt Grid Items</span>
             <div className="flex items-center gap-1.5">
                <button
                   type="button"
                   onClick={handleAddRow}
                   className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                >
                   + Spawn Row
                </button>
                <button
                   type="button"
                   onClick={handleDeleteRow}
                   className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                >
                   - Delete Row
                </button>
             </div>
          </div>
          <table className="w-full table-fixed min-w-[950px] border-collapse text-left text-[11px] font-sans">
            <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
              <tr className="bg-slate-800 text-white font-bold uppercase text-[9px]/tight text-center">
                <th className="p-1 border border-gray-400 w-10 shrink-0" rowSpan={2}>Srl</th>
                <th className="p-1 border border-gray-400 text-center w-52" colSpan={2}>Receipt Grade</th>
                <th className="p-1 border border-gray-400 w-24" rowSpan={2}>Crop Year</th>
                <th className="p-1 border border-gray-400 w-28" rowSpan={2}>Challan Grade</th>
                <th className="p-1 border border-gray-400 text-center w-48" colSpan={2}>Agency</th>
                <th className="p-1 border border-gray-400 text-center w-48" colSpan={2}>Challan Marka</th>
                <th className="p-1 border border-gray-400 w-24" rowSpan={2}>Netto (M.T)</th>
                <th className="p-1 border border-gray-400 w-32" colSpan={2}>Quantity</th>
                <th className="p-1 border border-gray-400 w-36" rowSpan={2}>Remarks</th>
              </tr>
              <tr className="bg-slate-200 text-black font-extrabold text-[8px] text-center border-b border-gray-400">
                <th className="p-0.5 border border-gray-400 w-16">Code</th>
                <th className="p-0.5 border border-gray-400 w-36">Name</th>
                <th className="p-0.5 border border-gray-400 w-14">Code</th>
                <th className="p-0.5 border border-gray-400 w-34">Name</th>
                <th className="p-0.5 border border-gray-400 w-14">Code</th>
                <th className="p-0.5 border border-gray-400 w-34">Name</th>
                <th className="p-0.5 border border-gray-400 w-16">Chln</th>
                <th className="p-0.5 border border-gray-400 w-16">Rcpt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {details.map((detail, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors h-7 text-[10.5px]">
                  {/* Srl */}
                  <td className="p-1 text-center font-bold text-gray-900 border border-gray-300 bg-slate-100 w-10">{detail.srl_no}</td>

                  {/* Receipt Grade Code */}
                  <td className="p-0.5 border border-gray-300 w-16 bg-slate-50 text-center">
                    <input
                      type="text"
                      value={detail.receipt_grade_code}
                      readOnly
                      placeholder="--"
                      className="w-full bg-transparent border-0 p-0 text-center font-bold text-gray-800 outline-none"
                    />
                  </td>

                  {/* Receipt Grade Name */}
                  <td className="p-0.5 border border-gray-300 w-36">
                    <select
                      value={detail.receipt_grade_name}
                      onChange={(e) => handleDetailChange(idx, 'receipt_grade_name', e.target.value)}
                      className="w-full bg-white border border-gray-300 p-0 text-left font-bold text-gray-900 outline-none h-6"
                    >
                      <option value=""></option>
                      {detail.receipt_grade_name && !grades.some(g => g.grade_name === detail.receipt_grade_name) && (
                        <option value={detail.receipt_grade_name}>{detail.receipt_grade_name}</option>
                      )}
                      {grades.map(g => (
                        <option key={g.id || g.grade_code} value={g.grade_name}>{g.grade_name}</option>
                      ))}
                    </select>
                  </td>

                  {/* Crop Year */}
                  <td className="p-0.5 border border-gray-300 w-24">
                    <select 
                      value={detail.crop_year} 
                      onChange={(e) => handleDetailChange(idx, 'crop_year', e.target.value)}
                      className="w-full bg-white border border-gray-300 p-0 text-center font-bold text-gray-900 outline-none h-6 text-xs" 
                    >
                      <option value=""></option>
                      {detail.crop_year && !['2024-25', '2025-26', '2026-27', '2027-28', '2028-29'].includes(detail.crop_year) && (
                        <option value={detail.crop_year}>{detail.crop_year}</option>
                      )}
                      <option value="2024-25">2024-25</option>
                      <option value="2025-26">2025-26</option>
                      <option value="2026-27">2026-27</option>
                      <option value="2027-28">2027-28</option>
                      <option value="2028-29">2028-29</option>
                    </select>
                  </td>

                  {/* Challan Grade Name */}
                  <td className="p-0.5 border border-gray-300 w-28">
                    <input 
                      type="text" 
                      value={detail.challan_grade_name} 
                      onChange={(e) => handleDetailChange(idx, 'challan_grade_name', e.target.value)}
                      className="w-full bg-transparent border-0 p-0 outline-none px-1" 
                    />
                  </td>

                  {/* Agency Code */}
                  <td className="p-0.5 border border-gray-300 w-14 bg-slate-50 text-center">
                    <input
                      type="text"
                      value={detail.agency_code || ''}
                      onChange={(e) => handleDetailChange(idx, 'agency_code', e.target.value)}
                      placeholder="--"
                      className="w-full bg-transparent border-0 p-0 text-center font-bold text-gray-800 outline-none uppercase font-mono"
                    />
                  </td>

                  {/* Agency Name */}
                  <td className="p-0.5 border border-gray-300 w-34">
                    <input
                      type="text"
                      list="agencies_list"
                      placeholder="Type/Select Agency..."
                      value={detail.agency_name || ''}
                      onChange={(e) => handleDetailChange(idx, 'agency_name', e.target.value)}
                      className="w-full bg-white text-left font-bold text-gray-900 outline-none px-1 h-6 uppercase font-mono border-0"
                    />
                  </td>

                  {/* Challan Marka Code */}
                  <td className="p-0.5 border border-gray-300 w-14 bg-slate-50 text-center">
                    <input
                      type="text"
                      value={detail.challan_marka_code}
                      readOnly
                      placeholder="--"
                      className="w-full bg-transparent border-0 p-0 text-center font-bold text-gray-800 outline-none"
                    />
                  </td>

                  {/* Challan Marka Name */}
                  <td className="p-0.5 border border-gray-300 w-34">
                    <input
                      type="text"
                      list="markas_list"
                      placeholder="Type/Select Marka..."
                      value={detail.challan_marka_name || ''}
                      onChange={(e) => handleDetailChange(idx, 'challan_marka_name', e.target.value)}
                      className="w-full bg-white text-left font-bold text-gray-900 outline-none px-1 h-6 uppercase font-mono border-0"
                    />
                  </td>

                  {/* Netto Pnto */}
                  <td className="p-0.5 border border-gray-300 w-24">
                    <input 
                      type="number" 
                      step="0.001"
                      placeholder="0.000"
                      value={detail.netto_pnto ? detail.netto_pnto : ''} 
                      onChange={(e) => {
                        const val = e.target.value;
                        handleDetailChange(idx, 'netto_pnto', val === '' ? 0 : Number(val));
                      }}
                      className="w-full bg-white border border-gray-300 p-0 text-right font-bold text-gray-900 outline-none pr-1 focus:border-blue-600 focus:ring-1 focus:ring-blue-600" 
                    />
                  </td>

                  {/* Quantity Chln */}
                  <td className="p-0.5 border border-gray-300 w-16">
                    <input 
                      type="number" 
                      step="1"
                      placeholder="0"
                      value={detail.quantity_chln ? detail.quantity_chln : ''} 
                      onChange={(e) => {
                        const val = e.target.value;
                        handleDetailChange(idx, 'quantity_chln', val === '' ? 0 : Number(val));
                      }}
                      className="w-full bg-white border border-blue-200 p-0 text-center font-bold text-blue-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" 
                    />
                  </td>

                  {/* Quantity Rcpt */}
                  <td className="p-0.5 border border-gray-300 w-16">
                    <input 
                      type="number" 
                      step="1"
                      placeholder="0"
                      value={detail.quantity_rcpt ? detail.quantity_rcpt : ''} 
                      onChange={(e) => {
                        const val = e.target.value;
                        handleDetailChange(idx, 'quantity_rcpt', val === '' ? 0 : Number(val));
                      }}
                      className="w-full bg-white border border-indigo-200 p-0 text-center font-bold text-indigo-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600" 
                    />
                  </td>

                  {/* Remarks */}
                  <td className="p-0.5 border border-gray-300 w-36">
                    <input 
                      type="text" 
                      value={detail.remarks} 
                      onChange={(e) => handleDetailChange(idx, 'remarks', e.target.value)}
                      className="w-full bg-transparent border-0 p-0 text-left outline-none px-1" 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* WEIGHMENT SCALE BLOCKS */}
        <div className="shrink-0">
          <LegacyFieldset legend="Automatic Weighment Ledger & Verification Weights (in metric tons)">
            <div className="grid grid-cols-12 gap-4 text-[10.5px] items-center">
              
              {/* Box Column 1 */}
              <div className="col-span-12 md:col-span-4 bg-slate-100/50 p-2 border border-gray-300 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">CHALLAN WEIGHT</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="challan_material_weight"
                    value={formData.challan_material_weight || 0}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono font-bold bg-white" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">SUPPLIER NET WT</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="supplier_net_weight"
                    value={formData.supplier_net_weight || 0}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono font-bold bg-white" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">ELECTRONIC SCALE NET</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="electronic_net_weight"
                    value={formData.electronic_net_weight || 0}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono bg-white font-bold" 
                  />
                </div>
              </div>

              {/* Box Column 2 */}
              <div className="col-span-12 md:col-span-4 bg-slate-100/50 p-2 border border-gray-300 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">ACTUAL GROSS (LORRY+TARE)</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="actual_gross_weight"
                    value={formData.actual_gross_weight || ''}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono font-bold bg-white" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">SUPPLIER CHALLAN GROSS</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="supplier_challan_gross"
                    value={formData.supplier_challan_gross || ''}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono font-bold bg-white" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">ELECTRONIC SCALE GROSS</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="electronic_gross_weight"
                    value={formData.electronic_gross_weight || ''}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono bg-white" 
                  />
                </div>
              </div>

              {/* Box Column 3 */}
              <div className="col-span-12 md:col-span-4 bg-slate-100/50 p-2 border border-gray-300 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">ACTUAL TARE (EMPTY LORRY)</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="actual_tare_weight"
                    value={formData.actual_tare_weight || ''}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono font-bold bg-white" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">SUPPLIER TARE WEIGHT</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="supplier_tare_weight"
                    value={formData.supplier_tare_weight || ''}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono font-bold bg-white" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">ELECTRONIC SCALE TARE</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="electronic_tare_weight"
                    value={formData.electronic_tare_weight || ''}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono bg-white" 
                  />
                </div>
              </div>

            </div>

            {/* Weight Shortage reduction info helper bottom centered */}
            <div className="mt-2.5 flex justify-center border-t border-gray-200 pt-2.5">
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-800 text-[10.5px]">WEIGHT REDUCED IN DISCREPANCY (M.Ton)</span>
                <input 
                  type="number" 
                  step="0.001"
                  name="weight_reduced"
                  value={formData.weight_reduced || ''}
                  onChange={handleChange}
                  className="w-32 border border-gray-400 text-right px-2 py-0.5 font-mono font-black text-rose-700 bg-white" 
                />
              </div>
            </div>
          </LegacyFieldset>
        </div>

        {/* UNIFIED RETRO TASK ACTION BAR */}
        <div className="flex bg-[#c0c0c0] p-1 border border-black/20 gap-1 shrink-0">
          <LegacyButton icon={Plus} label="Clear (F2)" onClick={clearForm} />
          <div className="flex-1" />
          <LegacyButton icon={X} label="Exit (Esc)" onClick={onCancel} />
          <LegacyButton icon={Save} label={loading ? "SAVING..." : "SAVE ARRIVAL"} active={!loading} onClick={handleSave} />
        </div>

        {/* Dynamic Global Datalist for Brand/Markas Auto-Complete Dropdown */}
        <datalist id="markas_list">
          {markas.map((m, mIdx) => (
            <option key={m.id || mIdx} value={m.marka_name} />
          ))}
        </datalist>

        {/* Dynamic Global Datalist for Agencies Auto-Complete Dropdown */}
        <datalist id="agencies_list">
          {agencies.map((a, aIdx) => (
            <option key={a.id || aIdx} value={a.agency_name} />
          ))}
        </datalist>

      </div>
    </LegacyLayout>
  );
}
