import { useState, useEffect, useRef } from 'react';
import { dbModule } from '../../services/dbModule';
import { supabase } from '../../lib/supabase';
import { poService } from '../../services/poService';
import { calculateWeightTolerance } from '../../lib/weightTolerance';
import { getCurrentUserContext, isUserAdmin, isL5OrAdmin } from '../../lib/permissions';
import { formatPoNumber, compareQualities, EXCEL_SEED_DATA } from '../../utils/purchaseOrderCalculations';
import { PoFormData, PoCalcData, PoItemRow } from '../../types/purchaseOrder';

interface UsePurchaseOrderFormLogicProps {
  isTempPo: boolean;
  isArchiveView: boolean;
  selectedYear?: string;
  MASTER_TABLE: string;
  DETAIL_TABLE: string;
  poList: any[];
  setPoList: React.Dispatch<React.SetStateAction<any[]>>;
  brokerList: any[];
  supplierList: any[];
  areaList: any[];
  saudaList: any[];
  gradeList: any[];
  markaList: any[];
  agencyList: any[];
  sattaBaseRates: any[];
  sattaCalculatedRates: any[];
  sattaDifferentials: any[];
  allFinalArrivals: any[];
  matchResults: Record<string, any>;
  isPoMismatchResolved: (po: any) => boolean;
  fetchPosAndMasters: () => Promise<void>;
  setViewMode: (mode: 'register' | 'form') => void;
  setSelectedPoNo: (poNo: string | null) => void;
  setEmailNotification: (notif: any) => void;
}

export function usePurchaseOrderFormLogic({
  isTempPo,
  isArchiveView,
  selectedYear,
  MASTER_TABLE,
  DETAIL_TABLE,
  poList,
  setPoList,
  brokerList,
  supplierList,
  areaList,
  saudaList,
  gradeList,
  markaList,
  agencyList,
  sattaBaseRates,
  sattaCalculatedRates,
  sattaDifferentials,
  allFinalArrivals,
  matchResults,
  isPoMismatchResolved,
  fetchPosAndMasters,
  setViewMode,
  setSelectedPoNo,
  setEmailNotification
}: UsePurchaseOrderFormLogicProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  const getCropYear = () => {
    if (selectedYear) {
      if (selectedYear.includes('-')) {
        const parts = selectedYear.split('-');
        if (parts.length === 2 && parts[1].length === 4) {
          return `${parts[0]}-${parts[1].substring(2)}`;
        }
      }
      return selectedYear;
    }
    return '2026-27';
  };

  const [loading, setLoading] = useState(false);
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [selectedItemSrl, setSelectedItemSrl] = useState<number | null>(null);

  const [formData, setFormData] = useState<PoFormData>({
    is_ptf: false,
    purchase_order: 'FINAL PO',
    po_type: 'Normal',
    ptf_no: '',
    pending: 'Yes',
    no: '',
    date: todayStr,
    broker_code: '',
    broker: '',
    supplier_code: '',
    supplier: '',
    challan_supplier_code: '',
    challan_supplier: '',
    area_code: '',
    area: '', 
    trans_paid_by: 'PARTY',
    weight_unit_kgs: '147.5',
    against_cancellation: 'No',
    purchase_unit_code: '1',
    purchase_unit_name: 'BALES',
    total_no_of_lorries: '',
    units_per_lorry: '',
    total_units: '',
    weight_per_lorry: '',
    total_contract_mt: '',
    marka_type: 'Normal',
    marka_penalty: '0',
    qty_penalty: '5',
    delivery_from: todayStr,
    delivery_to: todayStr,
    grace_days: '0',
    delivery_penalty: '0',
    contract_po_no: '',
    contract_date: todayStr,
    rate_detail: '',
    delivery_schedule: '',
    terms_condition: '',
    remarks: '',
    po_identification: 'Direct Advance Payment',
    b_rate: '',
    s_date: todayStr, 
    items: []
  });

  const [calcData, setCalcData] = useState<PoCalcData>({
    total_lorries: '1',
    units_per_lorry: '200',
    total_units: '200',
    weight_per_lorry: '29.500'
  });

  const lookupSattaBaseRate = (sDateStr: string, bases: any[] = sattaBaseRates) => {
    const sDate = sDateStr || todayStr;
    const sortedBases = [...bases]
      .filter(b => b.start_date && b.start_date <= sDate)
      .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));

    if (sortedBases.length > 0 && sortedBases[0].base_rate) {
      return String(sortedBases[0].base_rate);
    }
    if (bases.length > 0 && bases[0].base_rate) {
      return String(bases[0].base_rate);
    }
    return '';
  };

  const getSattaRateForRow = (
    rowAgencyName: string,
    rowGradeName: string,
    sDateStr: string,
    bRateStr: string,
    bases: any[] = sattaBaseRates,
    calcs: any[] = sattaCalculatedRates,
    diffs: any[] = sattaDifferentials,
    overrideArea?: string
  ) => {
    const sDate = sDateStr || todayStr;
    const bRate = parseFloat(bRateStr) || 0;

    const normAgency = (rowAgencyName || '').trim().toUpperCase();
    const normGrade = (rowGradeName || '').trim().toUpperCase();
    const normArea = (overrideArea || formData?.area || '').trim().toUpperCase();

    if (!normGrade) return null;
    if (!normAgency && !normArea) return null;

    let differential = 0;
    let found = false;

    const sortedBases = [...bases]
      .filter(b => b.start_date && b.start_date <= sDate)
      .sort((a, b) => b.start_date.localeCompare(a.start_date));

    const activeBase = sortedBases[0];

    const lookupInSatta = (areaToLookup: string) => {
      if (!areaToLookup) return null;

      if (activeBase && calcs.length > 0) {
        const match = calcs.find(c => 
          c.start_date === activeBase.start_date &&
          (c.area || '').trim().toUpperCase() === areaToLookup &&
          (c.grade || '').trim().toUpperCase() === normGrade
        );
        if (match) {
          return parseFloat(match.differential) || 0;
        }
      }

      if (diffs.length > 0) {
        const match = diffs.find(d => 
          (d.area || '').trim().toUpperCase() === areaToLookup &&
          (d.grade || '').trim().toUpperCase() === normGrade
        );
        if (match) {
          return parseFloat(match.differential) || 0;
        }
      }

      const matchArea = EXCEL_SEED_DATA.find(a => a.area.toUpperCase() === areaToLookup);
      if (matchArea && matchArea.diffs) {
        const diffVal = matchArea.diffs[normGrade];
        if (diffVal !== undefined) {
          return diffVal;
        }
      }

      return null;
    };

    let diffVal = lookupInSatta(normAgency);
    if (diffVal !== null) {
      differential = diffVal;
      found = true;
    } else if (normArea && normArea !== normAgency) {
      diffVal = lookupInSatta(normArea);
      if (diffVal !== null) {
        differential = diffVal;
        found = true;
      }
    }

    if (found) {
      const baseToUse = bRate > 0 ? bRate : (activeBase ? parseFloat(activeBase.base_rate) || 0 : 0);
      return baseToUse + differential;
    }

    return null;
  };

  const recalculateAllRates = (
    items: any[], 
    sDate: string, 
    bRate: string, 
    bases: any[] = sattaBaseRates, 
    calcs: any[] = sattaCalculatedRates, 
    diffs: any[] = sattaDifferentials,
    overrideArea?: string
  ) => {
    return items.map(row => {
      const computed = getSattaRateForRow(
        row.agency_name,
        row.grade_name,
        sDate,
        bRate,
        bases,
        calcs,
        diffs,
        overrideArea
      );
      if (computed !== null) {
        return { ...row, rate: computed };
      }
      return row;
    });
  };

  const recalculateItemWeights = (items: any[], unitWeightKgs: number) => {
    return items.map(item => ({
      ...item,
      weight: parseFloat(((item.qty * unitWeightKgs) / 1000).toFixed(3))
    }));
  };

  const handlePurchaseUnitChange = (name: string, code: string) => {
    const isDrums = name.toUpperCase() === 'DRUMS';
    const weightUnitKgs = isDrums ? '50' : '147.5';
    const unitWtVal = parseFloat(weightUnitKgs);

    if (formData.is_ptf) {
      setFormData(prev => ({
        ...prev,
        purchase_unit_name: name,
        purchase_unit_code: code,
        weight_unit_kgs: weightUnitKgs
      }));
      return;
    }

    const lorries = parseFloat(formData.total_no_of_lorries) || 0;
    const unitsPerLorry = parseFloat(formData.units_per_lorry) || 0;
    const totalUnits = lorries * unitsPerLorry;
    const wtPerLorry = (unitsPerLorry * unitWtVal) / 1000;
    const totalContractMt = (totalUnits * unitWtVal) / 1000;

    const updatedItems = recalculateItemWeights(formData.items, unitWtVal);

    setFormData(prev => ({
      ...prev,
      purchase_unit_name: name,
      purchase_unit_code: code,
      weight_unit_kgs: weightUnitKgs,
      weight_per_lorry: wtPerLorry > 0 ? wtPerLorry.toFixed(3) : prev.weight_per_lorry,
      total_contract_mt: totalContractMt > 0 ? totalContractMt.toFixed(3) : prev.total_contract_mt,
      total_units: totalUnits > 0 ? totalUnits.toString() : prev.total_units,
      items: updatedItems
    }));
  };

  // Auto-sync B. Rate from Satta Base Rate for given S Date
  useEffect(() => {
    if (sattaBaseRates.length > 0 && formData.s_date) {
      const activeBase = lookupSattaBaseRate(formData.s_date, sattaBaseRates);
      if (activeBase && (!formData.b_rate || formData.b_rate === '0' || formData.b_rate === '')) {
        const hasExistingRates = formData.items && formData.items.some(item => Number(item.rate) > 0);
        if (!hasExistingRates && !formData.no) {
          const updatedItems = recalculateAllRates(formData.items, formData.s_date, activeBase);
          setFormData(prev => ({
            ...prev,
            b_rate: activeBase,
            items: updatedItems
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            b_rate: activeBase
          }));
        }
      }
    }
  }, [sattaBaseRates, formData.s_date]);

  const handleSaudaSelect = async (saudaNo: string) => {
    if (!saudaNo) {
      setFormData(prev => ({ ...prev, no: '' }));
      return;
    }
    const sauda = saudaList.find(s => 
      s.sauda_no === saudaNo || 
      s.session === saudaNo || 
      formatPoNumber(s) === saudaNo
    );
    if (!sauda) {
      setFormData(prev => ({ ...prev, no: saudaNo }));
      return;
    }

    const brokerObj = brokerList.find(b => b.brok_name === sauda.broker || b.brok_code === sauda.broker);
    const supplierObj = supplierList.find(s => s.supp_name === sauda.supplier || s.supp_code === sauda.supplier);
    const challanSuppObj = supplierList.find(s => s.supp_name === sauda.challan_supplier || s.supp_code === sauda.challan_supplier);
    const areaObj = areaList.find(a => a.area_name === sauda.area || a.area_code === sauda.area);

    let mappedItems: any[] = [];
    const isBales = (sauda.unit_type || '').toUpperCase() === 'BALES';
    const sDate = sauda.date || todayStr;
    const autoBRate = lookupSattaBaseRate(sDate, sattaBaseRates);
    const selectedBRate = (sauda.b_rate && Number(sauda.b_rate) > 0) ? sauda.b_rate.toString() : autoBRate;

    if (supabase) {
      try {
        const { data: qDetails } = await supabase
          .from('sauda_quality_details')
          .select('*')
          .eq('sauda_id', sauda.sauda_id);

        if (qDetails && qDetails.length > 0) {
          const sortedDetails = [...qDetails].sort((a: any, b: any) => compareQualities(a.quality || '', b.quality || ''));
          mappedItems = sortedDetails.map((item: any, index: number) => {
            const matchingGrade = gradeList.find(g => {
              const clean = (s: string) => (s || '').trim().replace(/\.$/, '').toUpperCase();
              return clean(g.grade_name) === clean(item.quality) || clean(g.grade_code) === clean(item.quality);
            });
            const itemWt = isBales 
              ? (item.qty * 147.5) / 1000 
              : (sauda.total_unit > 0 ? (item.qty / sauda.total_unit) * sauda.total_wt_in_ton : 0);
            const rowAgency = item.agency || sauda.agency || '';
            const agencyObj = agencyList.find(ag => ag.agency_name === rowAgency || ag.agency_code === rowAgency);
            const rowMarka = item.marka || sauda.marks || '';
            const markaObj = markaList.find(m => m.marka_name === rowMarka || m.marka_code === rowMarka);

            const rowGradeName = matchingGrade?.grade_name || item.quality || '';
            const rowAgencyName = agencyObj?.agency_name || rowAgency;

            const computedSattaRate = getSattaRateForRow(rowAgencyName, rowGradeName, sDate, selectedBRate, sattaBaseRates, sattaCalculatedRates, sattaDifferentials, sauda.area);
            const saudaItemRate = (item.rs !== undefined && item.rs !== null && Number(item.rs) > 0) ? Number(item.rs) : 0;

            return {
              srl: index + 1,
              crop: sauda.crop_year || getCropYear(),
              grade_code: matchingGrade ? matchingGrade.grade_code : (item.quality || ''),
              grade_name: matchingGrade ? matchingGrade.grade_name : (item.quality || ''),
              agency_code: agencyObj ? agencyObj.agency_code : (item.agency || sauda.agency || ''),
              agency_name: agencyObj ? agencyObj.agency_name : (item.agency || sauda.agency || ''),
              marka_code: markaObj ? markaObj.marka_code : (item.marka || sauda.marks || ''),
              marka_name: markaObj ? markaObj.marka_name : (item.marka || sauda.marks || ''),
              qty: item.qty || 0,
              weight: parseFloat(itemWt.toFixed(3)),
              rate: computedSattaRate !== null ? computedSattaRate : saudaItemRate,
              premium: item.premium || 0
            };
          });
        }
      } catch (err) {
        console.warn("Failed to query sauda_quality_details", err);
      }
    }

    if (mappedItems.length === 0) {
      const computedSattaRate = getSattaRateForRow(sauda.agency || '', sauda.quality || '', sDate, selectedBRate, sattaBaseRates, sattaCalculatedRates, sattaDifferentials, sauda.area);
      const saudaItemRate = (sauda.rate !== undefined && sauda.rate !== null && Number(sauda.rate) > 0) ? Number(sauda.rate) : 0;
      mappedItems = [
        {
          srl: 1,
          crop: sauda.crop_year || getCropYear(),
          grade_code: sauda.quality || '',
          grade_name: sauda.quality || '',
          agency_code: sauda.agency || '',
          agency_name: sauda.agency || '',
          marka_code: sauda.marks || '',
          marka_name: sauda.marks || '',
          qty: sauda.total_unit || 0,
          weight: sauda.total_wt_in_ton || 0,
          rate: computedSattaRate !== null ? computedSattaRate : saudaItemRate,
          premium: 0
        }
      ];
    }

    const unitWtKgs = isBales ? '147.5' : '50';
    const resolvedPoDisplayNo = formatPoNumber(sauda) || sauda.sauda_no || sauda.session || '';

    setFormData(prev => ({
      ...prev,
      is_ptf: false,
      no: resolvedPoDisplayNo,
      date: sauda.date || todayStr,
      broker_code: brokerObj ? brokerObj.brok_code : sauda.broker || '',
      broker: (sauda.broker || '').toUpperCase(),
      supplier_code: supplierObj ? supplierObj.supp_code : sauda.supplier || '',
      supplier: (sauda.supplier || '').toUpperCase(),
      challan_supplier_code: challanSuppObj ? challanSuppObj.supp_code : (sauda.challan_supplier || supplierObj?.supp_code || ''),
      challan_supplier: (sauda.challan_supplier || sauda.supplier || '').toUpperCase(),
      area_code: areaObj ? areaObj.area_code : sauda.area || '',
      area: (sauda.area || '').toUpperCase(),
      purchase_unit_name: (sauda.unit_type || 'BALES').toUpperCase(),
      weight_unit_kgs: unitWtKgs,
      total_no_of_lorries: sauda.no_of_lorries ? sauda.no_of_lorries.toString() : '1',
      units_per_lorry: (sauda.total_unit && sauda.no_of_lorries) ? (sauda.total_unit / sauda.no_of_lorries).toString() : sauda.total_unit?.toString() || '0',
      total_units: sauda.total_unit ? sauda.total_unit.toString() : '0',
      weight_per_lorry: sauda.wt_per_lorry ? Number(sauda.wt_per_lorry).toFixed(3) : (sauda.total_wt_in_ton ? Number(sauda.total_wt_in_ton).toFixed(3) : '0.000'),
      total_contract_mt: sauda.total_wt_in_ton ? Number(sauda.total_wt_in_ton).toFixed(3) : '0.000',
      contract_po_no: sauda.contract_no || sauda.sauda_no || resolvedPoDisplayNo,
      contract_date: sauda.date || todayStr,
      delivery_from: sauda.shipment_date || todayStr,
      delivery_to: sauda.shipment_date || todayStr,
      grace_days: sauda.shipment_days ? sauda.shipment_days.toString() : '0',
      delivery_penalty: sauda.shipment_penalty ? sauda.shipment_penalty.toString() : '0',
      b_rate: selectedBRate,
      s_date: sDate,
      remarks: sauda.remarks || prev.remarks,
      items: mappedItems
    }));
  };

  const handleAddItem = () => {
    const nextSrl = formData.items.length > 0 
      ? Math.max(...formData.items.map(it => Number(it.srl) || 0)) + 1 
      : 1;

    const firstItem = formData.items[0];
    const newItem: PoItemRow = {
      srl: nextSrl,
      crop: firstItem ? firstItem.crop : getCropYear(),
      grade_code: '',
      grade_name: '',
      agency_code: firstItem ? firstItem.agency_code : '',
      agency_name: firstItem ? firstItem.agency_name : '',
      marka_code: firstItem ? firstItem.marka_code : '',
      marka_name: firstItem ? firstItem.marka_name : '',
      qty: 0,
      weight: 0,
      rate: 0,
      premium: 0
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setSelectedItemSrl(nextSrl);
  };

  const handleDeleteItem = () => {
    if (selectedItemSrl === null) {
      alert("Please select a row from the items table to delete.");
      return;
    }
    if (formData.items.length <= 1) {
      alert("At least one item is required in the Purchase Order.");
      return;
    }

    const updated = formData.items
      .filter(it => it.srl !== selectedItemSrl)
      .map((it, idx) => ({ ...it, srl: idx + 1 }));

    setFormData(prev => ({
      ...prev,
      items: updated
    }));
    setSelectedItemSrl(updated.length > 0 ? updated[0].srl : null);
  };

  const handleSyncFromSource = async () => {
    if (formData.is_ptf) {
      alert("Source Synchronization is available for Sauda-linked contracts.");
      return;
    }
    if (!formData.no) {
      alert("Please select a Sauda contract first.");
      return;
    }

    const sauda = saudaList.find(s => 
      s.sauda_no === formData.no || 
      s.session === formData.no || 
      formatPoNumber(s) === formData.no
    );
    if (!sauda) {
      alert(`Source Sauda record for "${formData.no}" not found.`);
      return;
    }

    let sourceItems: any[] = [];
    const isBales = (sauda.unit_type || formData.purchase_unit_name || '').toUpperCase() === 'BALES';

    if (supabase) {
      try {
        const { data: qDetails } = await supabase
          .from('sauda_quality_details')
          .select('*')
          .eq('sauda_id', sauda.sauda_id);

        if (qDetails && qDetails.length > 0) {
          const sortedDetails = [...qDetails].sort((a: any, b: any) => compareQualities(a.quality || '', b.quality || ''));
          sourceItems = sortedDetails.map((item: any, index: number) => {
            const matchingGrade = gradeList.find(g => {
              const clean = (s: string) => (s || '').trim().replace(/\.$/, '').toUpperCase();
              return clean(g.grade_name) === clean(item.quality) || clean(g.grade_code) === clean(item.quality);
            });
            const itemWt = isBales 
              ? (item.qty * 147.5) / 1000 
              : (sauda.total_unit > 0 ? (item.qty / sauda.total_unit) * sauda.total_wt_in_ton : 0);
            const rowAgency = item.agency || sauda.agency || '';
            const agencyObj = agencyList.find(ag => ag.agency_name === rowAgency || ag.agency_code === rowAgency);
            const rowMarka = item.marka || sauda.marks || '';
            const markaObj = markaList.find(m => m.marka_name === rowMarka || m.marka_code === rowMarka);

            const rowGradeName = matchingGrade?.grade_name || item.quality || '';
            const rowAgencyName = agencyObj?.agency_name || rowAgency;
            const computedSattaRate = getSattaRateForRow(rowAgencyName, rowGradeName, sauda.date || todayStr, formData.b_rate || sauda.b_rate || '0', sattaBaseRates, sattaCalculatedRates, sattaDifferentials, sauda.area);

            return {
              srl: index + 1,
              crop: sauda.crop_year || getCropYear(),
              grade_code: matchingGrade ? matchingGrade.grade_code : (item.quality || ''),
              grade_name: matchingGrade ? matchingGrade.grade_name : (item.quality || ''),
              agency_code: agencyObj ? agencyObj.agency_code : (item.agency || sauda.agency || ''),
              agency_name: agencyObj ? agencyObj.agency_name : (item.agency || sauda.agency || ''),
              marka_code: markaObj ? markaObj.marka_code : (item.marka || sauda.marks || ''),
              marka_name: markaObj ? markaObj.marka_name : (item.marka || sauda.marks || ''),
              qty: item.qty || 0,
              weight: parseFloat(itemWt.toFixed(3)),
              rate: computedSattaRate !== null ? computedSattaRate : (Number(item.rs) || 0),
              premium: item.premium || 0
            };
          });
        }
      } catch (err) {
        console.warn("Failed to re-sync sauda_quality_details", err);
      }
    }

    if (sourceItems.length > 0) {
      setFormData(prev => ({
        ...prev,
        items: sourceItems
      }));
      alert(`Synchronized ${sourceItems.length} line items from Sauda contract ${formData.no}`);
    } else {
      alert("No additional line items found in source contract.");
    }
  };

  const generateNextPtfNo = (list: any[] = poList) => {
    const finYear = '2026-2027';
    let maxNum = 0;
    list.forEach(item => {
      const ptfStr = String(item.ptf_no || item.po_no || '').trim();
      if (!ptfStr) return;
      const m1 = ptfStr.match(/BJCL\/\d{4}-\d{4}\/(\d+)\(PTF\)/i);
      if (m1) {
        const num = parseInt(m1[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
        return;
      }
      const m2 = ptfStr.match(/PTF\/(\d+)\/\d+/i);
      if (m2) {
        const num = parseInt(m2[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
        return;
      }
      const m3 = ptfStr.match(/(\d+)\(PTF\)/i);
      if (m3) {
        const num = parseInt(m3[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
        return;
      }
    });

    const nextNum = maxNum > 0 ? maxNum + 1 : 67;
    return `BJCL/${finYear}/${String(nextNum).padStart(4, '0')}(PTF)`;
  };

  const handleGlobalAdd = () => {
    const defaultSDate = todayStr;
    const defaultBRate = lookupSattaBaseRate(defaultSDate, sattaBaseRates);

    setFormData({
      is_ptf: true,
      purchase_order: 'FINAL PO',
      po_type: 'Normal',
      ptf_no: generateNextPtfNo(poList),
      pending: 'Yes',
      no: '',
      date: todayStr,
      broker_code: '',
      broker: '',
      supplier_code: '',
      supplier: '',
      challan_supplier_code: '',
      challan_supplier: '',
      area_code: '',
      area: '', 
      trans_paid_by: 'PARTY',
      weight_unit_kgs: '147.5',
      against_cancellation: 'No',
      purchase_unit_code: '1',
      purchase_unit_name: 'BALES',
      total_no_of_lorries: '1',
      units_per_lorry: '200',
      total_units: '200',
      weight_per_lorry: '29.500',
      total_contract_mt: '29.500',
      marka_type: 'Normal',
      marka_penalty: '0',
      qty_penalty: '5',
      delivery_from: todayStr,
      delivery_to: todayStr,
      grace_days: '0',
      delivery_penalty: '0',
      contract_po_no: '',
      contract_date: todayStr,
      rate_detail: '',
      delivery_schedule: '',
      terms_condition: 'Penalty Rs 5/- perday',
      remarks: 'Area, Agency Grade, Grade differential can change as per market.',
      po_identification: 'Direct Advance Payment',
      b_rate: defaultBRate,
      s_date: defaultSDate, 
      items: [
        {
          srl: 1,
          crop: getCropYear(),
          grade_code: '',
          grade_name: '',
          agency_code: '',
          agency_name: '',
          marka_code: '',
          marka_name: '',
          qty: 200,
          weight: 29.5,
          rate: 0,
          premium: 0
        }
      ]
    });
    setSelectedItemSrl(1);
    setViewMode('form');
  };

  const handleLoadSelectedPo = async (poHeader: any) => {
    const userCtx = getCurrentUserContext();
    const currentUserRole = (userCtx.userRole || (userCtx as any).role || "USER").toUpperCase();
    const currentUserLevel = (userCtx.userLevel || (userCtx as any).level || "L1").toUpperCase();
    const isAdminUser = isUserAdmin(userCtx) || currentUserRole === "ADMIN" || currentUserRole === "ADMINISTRATOR" || Boolean((userCtx as any).isAdmin) || currentUserLevel === "ADMIN";
    const isL4L5User = isL5OrAdmin() || currentUserLevel === "L4" || currentUserLevel === "L5" || currentUserLevel === "MAX";
    const canBypassLock = isAdminUser || isL4L5User;

    const mrLock = matchResults[poHeader.po_no];

    if (!canBypassLock && isTempPo && mrLock && mrLock.hasInspection && mrLock.status === 'mismatch' && !isPoMismatchResolved(poHeader.po_no)) {
      setEmailNotification({
        type: 'warning',
        title: 'Material Mismatch Review',
        message: `P.O ${poHeader.po_no} has a Material Mismatch. Details loaded for review.`
      });
    }

    setLoading(true);
    try {
      const poNoClean = String(poHeader.po_no || '').trim();
      const poNoUpper = poNoClean.toUpperCase();
      
      let filteredDetails: any[] = [];
      if (supabase) {
        try {
          const { data: directDetails } = await supabase
            .from(DETAIL_TABLE)
            .select('*')
            .eq('po_no', poNoClean)
            .order('srl_no', { ascending: true });
          if (directDetails && directDetails.length > 0) {
            filteredDetails = directDetails;
          } else {
            const { data: ilikeDetails } = await supabase
              .from(DETAIL_TABLE)
              .select('*')
              .ilike('po_no', poNoClean)
              .order('srl_no', { ascending: true });
            if (ilikeDetails && ilikeDetails.length > 0) {
              filteredDetails = ilikeDetails;
            }
          }
        } catch (e) {
          console.warn(`Direct query on ${DETAIL_TABLE} failed:`, e);
        }
      }

      if (!filteredDetails || filteredDetails.length === 0) {
        const allDetails = await dbModule.fetchAll(DETAIL_TABLE).catch(() => []);
        filteredDetails = (allDetails || [])
          .filter((d: any) => String(d.po_no || '').trim().toUpperCase() === poNoUpper)
          .sort((a: any, b: any) => (Number(a.srl_no || a.srl || 0) - Number(b.srl_no || b.srl || 0)));
      }
      
      if (!filteredDetails || filteredDetails.length === 0) {
        if (supabase) {
          const { data: scpDet } = await supabase.from('sauda_check_point_details').select('*').ilike('po_no', poNoClean).order('srl_no', { ascending: true });
          if (scpDet && scpDet.length > 0) {
            filteredDetails = scpDet;
          } else {
            const { data: pdmDet } = await supabase.from('purchase_detail_master').select('*').ilike('po_no', poNoClean).order('srl_no', { ascending: true });
            if (pdmDet && pdmDet.length > 0) {
              filteredDetails = pdmDet;
            }
          }
        }
      }

      if (!filteredDetails || filteredDetails.length === 0) {
        let tempArr: any = null;
        if (supabase) {
          const { data } = await supabase
            .from('temporary_material_received')
            .select('*')
            .or(`po_no.eq.${poNoClean},ptf_no.eq.${poNoClean},temporary_arrival_no.eq.${poNoClean}`)
            .limit(1)
            .maybeSingle();
          tempArr = data;
        }
        if (!tempArr) {
          const allAmads = await dbModule.fetchAll('temporary_material_received').catch(() => []);
          tempArr = (allAmads || []).find((am: any) => 
            String(am.po_no || '').trim().toUpperCase() === poNoUpper ||
            String(am.ptf_no || '').trim().toUpperCase() === poNoUpper ||
            String(am.temporary_arrival_no || '').trim().toUpperCase() === poNoUpper ||
            String(am.amad_no || '').trim().toUpperCase() === poNoUpper
          );
        }

        if (tempArr && Array.isArray(tempArr.grid_details) && tempArr.grid_details.length > 0) {
          filteredDetails = tempArr.grid_details.map((gd: any, i: number) => ({
            po_no: poHeader.po_no,
            srl_no: i + 1,
            crop_year: gd.crop_year || '2026-27',
            grade_code: gd.receipt_grade_code || gd.grade_code || gd.challan_grade || '',
            grade_name: gd.receipt_grade_name || gd.grade_name || gd.challan_grade_name || gd.challan_grade || '',
            agency_code: gd.agency_code || '',
            agency_name: gd.agency_name || '',
            marka_code: gd.challan_marka_code || gd.marka_code || '',
            marka_name: gd.challan_marka_name || gd.marka_name || '',
            quantity: Number(gd.quantity_rcpt || gd.quantity_chln || gd.quantity || gd.qty || 0),
            weight_mt: (gd.netto_pnto !== undefined && gd.netto_pnto !== null && Number(gd.netto_pnto) > 0)
              ? Number(gd.netto_pnto)
              : Number(gd.netto_mt || gd.weight || 0),
            rate_qntl: Number(gd.rate || 0),
            premium: gd.premium !== undefined && gd.premium !== null ? Number(gd.premium) : 0
          }));
        } else {
          const saudaToken = (poHeader.contract_po_no || poHeader.po_no || '').split('/').pop() || '';
          if (supabase) {
            const { data: saudaRec } = await supabase.from('sauda_master').select('*').or(`session.eq.${poHeader.po_no},sauda_no.eq.${saudaToken}`).maybeSingle();
            if (saudaRec) {
              const { data: qDet } = await supabase.from('sauda_quality_details').select('*').eq('sauda_id', saudaRec.sauda_id);
              if (qDet && qDet.length > 0) {
                filteredDetails = qDet.map((qd: any, i: number) => ({
                  po_no: poHeader.po_no,
                  srl_no: i + 1,
                  crop_year: '2026-27',
                  grade_code: qd.quality,
                  agency_code: qd.agency,
                  marka_code: qd.marka,
                  quantity: Number(qd.qty || 0),
                  rate_qntl: Number(qd.rs || 0),
                  weight_mt: Number(qd.weight || 0),
                  premium: Number(qd.premium || 0)
                }));
              }
            }
          }
        }
      }

      const isBales = (poHeader.purchase_unit_name || 'BALES') === 'BALES';

      const seenItemKeys = new Set<string>();
      const dedupedDetails = (filteredDetails || []).filter((d: any, idx: number) => {
        const rawG = d.grade_code || d.quality || d.grade || '';
        const rawA = d.agency_code || d.agency || '';
        const rawM = d.marka_code || d.marka || '';
        const srl = d.srl_no || d.srl || (idx + 1);
        const key = `${rawG}_${rawA}_${rawM}_${srl}`;
        if (!rawG && !rawA && !rawM) return true;
        if (seenItemKeys.has(key)) return false;
        seenItemKeys.add(key);
        return true;
      });

      const mappedItems = dedupedDetails.map((d: any, idx: number) => {
        const gMatch = gradeList.find(g => g.grade_code === d.grade_code || g.grade_name?.trim().toUpperCase() === d.grade_code?.trim().toUpperCase());
        const aMatch = agencyList.find(a => a.agency_code === d.agency_code || a.agency_name?.trim().toUpperCase() === d.agency_code?.trim().toUpperCase());
        const mMatch = markaList.find(m => m.marka_code === d.marka_code || m.marka_name?.trim().toUpperCase() === d.marka_code?.trim().toUpperCase());

        const qtyVal = Number(d.quantity || d.qty || 0);
        const weightVal = (d.weight_mt !== undefined && d.weight_mt !== null && !isNaN(Number(d.weight_mt)) && Number(d.weight_mt) > 0)
          ? Number(d.weight_mt)
          : (isBales ? parseFloat(((qtyVal * 147.5) / 1000).toFixed(3)) : Number(d.weight || 0));

        return {
          srl: d.srl_no || (idx + 1),
          crop: d.crop_year || getCropYear(),
          grade_code: gMatch ? gMatch.grade_code : (d.grade_code || ''),
          grade_name: gMatch ? gMatch.grade_name : (d.grade_name || d.grade_code || ''),
          agency_code: aMatch ? aMatch.agency_code : (d.agency_code || ''),
          agency_name: aMatch ? aMatch.agency_name : (d.agency_name || d.agency_code || ''),
          marka_code: mMatch ? mMatch.marka_code : (d.marka_code || ''),
          marka_name: mMatch ? mMatch.marka_name : (d.marka_name || d.marka_code || ''),
          qty: qtyVal,
          weight: weightVal,
          rate: Number(d.rate_qntl || d.rate || 0),
          premium: Number(d.premium || 0)
        };
      });

      const isPtfEntry = Boolean(poHeader.ptf_no || String(poHeader.po_no || '').toUpperCase().includes('(PTF)'));

      setFormData({
        is_ptf: isPtfEntry,
        purchase_order: poHeader.purchase_order || 'FINAL PO',
        po_type: poHeader.po_type || 'Normal',
        ptf_no: poHeader.ptf_no || (isPtfEntry ? poHeader.po_no : ''),
        pending: poHeader.pending ? 'Yes' : 'No',
        no: isPtfEntry ? '' : poHeader.po_no,
        date: poHeader.po_date || poHeader.date || todayStr,
        broker_code: poHeader.broker_code || '',
        broker: (poHeader.broker || '').toUpperCase(),
        supplier_code: poHeader.supplier_code || '',
        supplier: (poHeader.supplier || '').toUpperCase(),
        challan_supplier_code: poHeader.challan_supplier_code || '',
        challan_supplier: (poHeader.challan_supplier || poHeader.supplier || '').toUpperCase(),
        area_code: poHeader.area_code || '',
        area: (poHeader.area || '').toUpperCase(),
        trans_paid_by: poHeader.trans_paid_by || 'PARTY',
        weight_unit_kgs: poHeader.weight_unit_kgs?.toString() || (isBales ? '147.5' : '50'),
        against_cancellation: poHeader.against_cancellation || 'No',
        purchase_unit_code: poHeader.purchase_unit_code || '1',
        purchase_unit_name: (poHeader.purchase_unit_name || 'BALES').toUpperCase(),
        total_no_of_lorries: poHeader.total_lorries?.toString() || '0',
        units_per_lorry: poHeader.units_per_lorry?.toString() || '0',
        total_units: poHeader.total_units?.toString() || '0',
        weight_per_lorry: poHeader.weight_per_lorry !== undefined && poHeader.weight_per_lorry !== null && !isNaN(Number(poHeader.weight_per_lorry)) && Number(poHeader.weight_per_lorry) > 0
          ? Number(poHeader.weight_per_lorry).toFixed(3)
          : (poHeader.weight_per_lorry?.toString() || '0.000'),
        total_contract_mt: poHeader.total_contract_mt?.toString() || '0.000',
        marka_type: poHeader.marka_type || 'Normal',
        marka_penalty: poHeader.marka_penalty?.toString() || '0',
        qty_penalty: poHeader.qty_penalty?.toString() || '5',
        delivery_from: poHeader.delivery_from || todayStr,
        delivery_to: poHeader.delivery_to || todayStr,
        grace_days: poHeader.grace_days?.toString() || '0',
        delivery_penalty: poHeader.delivery_penalty?.toString() || '0',
        contract_po_no: poHeader.contract_po_no || '',
        contract_date: poHeader.contract_date || todayStr,
        rate_detail: poHeader.rate_detail || '',
        delivery_schedule: poHeader.delivery_schedule || '',
        terms_condition: poHeader.terms_condition || '',
        remarks: poHeader.remarks || '',
        po_identification: poHeader.po_identification || 'Direct Advance Payment',
        b_rate: poHeader.b_rate?.toString() || '',
        s_date: poHeader.s_date || todayStr,
        items: mappedItems.length > 0 ? mappedItems : [
          {
            srl: 1,
            crop: getCropYear(),
            grade_code: '',
            grade_name: '',
            agency_code: '',
            agency_name: '',
            marka_code: '',
            marka_name: '',
            qty: parseFloat(poHeader.total_units) || 0,
            weight: parseFloat(poHeader.total_contract_mt) || 0,
            rate: 0,
            premium: 0
          }
        ]
      });

      setCalcData({
        total_lorries: poHeader.total_lorries?.toString() || '1',
        units_per_lorry: poHeader.units_per_lorry?.toString() || '200',
        total_units: poHeader.total_units?.toString() || '200',
        weight_per_lorry: poHeader.weight_per_lorry !== undefined && poHeader.weight_per_lorry !== null && !isNaN(Number(poHeader.weight_per_lorry)) && Number(poHeader.weight_per_lorry) > 0
          ? Number(poHeader.weight_per_lorry).toFixed(3)
          : (poHeader.weight_per_lorry?.toString() || '29.500')
      });

      setSelectedPoNo(poHeader.po_no);
      setSelectedItemSrl(1);
      setViewMode('form');
    } catch (err: any) {
      console.error(err);
      alert("Failed to load PO details: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalAmend = () => {
    const activePoNo = formData.is_ptf ? formData.ptf_no : formData.no;
    if (!activePoNo) {
      alert("No active PO loaded to amend.");
      return;
    }
    const amendedNo = activePoNo.endsWith('-A') ? activePoNo : `${activePoNo}-A`;
    setFormData(prev => ({
      ...prev,
      no: prev.is_ptf ? prev.no : amendedNo,
      ptf_no: prev.is_ptf ? amendedNo : prev.ptf_no,
      po_type: 'Special',
      remarks: prev.remarks ? `${prev.remarks} (Amended)` : 'Amended Contract Details.'
    }));
    alert(`Amending Contract! The PO number is updated to ${amendedNo} in Special/Amend mode.`);
  };

  const handleCalculateOk = () => {
    if (formData.is_ptf) {
      const manualLorries = calcData.total_lorries;
      const manualUnitsPerLorry = calcData.units_per_lorry;
      const manualTotalUnits = calcData.total_units;
      const manualWeightPerLorry = calcData.weight_per_lorry;
      
      const lorriesNum = parseFloat(manualLorries) || 1;
      const wtLorryNum = parseFloat(manualWeightPerLorry) || 0;
      const manualTotalContractMt = lorriesNum > 1
        ? (lorriesNum * wtLorryNum).toFixed(3)
        : (manualWeightPerLorry || (formData.total_contract_mt || '0.000'));

      let updatedItems = [...formData.items];
      if (updatedItems.length === 1) {
        updatedItems[0] = {
          ...updatedItems[0],
          qty: parseFloat(manualTotalUnits) || updatedItems[0].qty || 0,
          weight: parseFloat(manualTotalContractMt) || parseFloat(manualWeightPerLorry) || updatedItems[0].weight || 0
        };
      }

      setFormData(prev => ({
        ...prev,
        total_no_of_lorries: manualLorries,
        units_per_lorry: manualUnitsPerLorry,
        total_units: manualTotalUnits,
        weight_per_lorry: manualWeightPerLorry,
        total_contract_mt: manualTotalContractMt,
        items: updatedItems
      }));
      setIsCalcOpen(false);
      return;
    }

    const lorries = parseFloat(calcData.total_lorries) || 0;
    const unitsPerLorry = parseFloat(calcData.units_per_lorry) || 0;
    const totalUnits = parseFloat(calcData.total_units) || (lorries * unitsPerLorry);
    const isDrums = (formData.purchase_unit_name || '').toUpperCase() === 'DRUMS';
    const unitWtVal = isDrums ? 50 : 147.5;
    const weightUnitKgs = unitWtVal.toString();

    const totalContractMt = totalUnits > 0
      ? ((totalUnits * unitWtVal) / 1000).toFixed(3)
      : (parseFloat(calcData.weight_per_lorry) || 0).toFixed(3);

    const wtPerLorryFormatted = lorries > 0
      ? (parseFloat(totalContractMt) / lorries).toFixed(3)
      : (calcData.weight_per_lorry && !isNaN(Number(calcData.weight_per_lorry)) 
          ? Number(calcData.weight_per_lorry).toFixed(3) 
          : calcData.weight_per_lorry);
    
    let updatedItems = recalculateItemWeights(formData.items, unitWtVal);
    
    if (updatedItems.length === 1) {
      updatedItems[0].qty = totalUnits;
      updatedItems[0].weight = parseFloat(totalContractMt);
    }

    setFormData(prev => ({
      ...prev,
      total_no_of_lorries: calcData.total_lorries,
      units_per_lorry: calcData.units_per_lorry,
      total_units: calcData.total_units.toString(),
      weight_per_lorry: wtPerLorryFormatted,
      total_contract_mt: totalContractMt,
      weight_unit_kgs: weightUnitKgs,
      items: updatedItems
    }));
    setIsCalcOpen(false);
  };

  const handleSave = async () => {
    const userCtx = getCurrentUserContext();
    const currentUserRole = (userCtx.userRole || (userCtx as any).role || "USER").toUpperCase();
    const currentUserLevel = (userCtx.userLevel || (userCtx as any).level || "L1").toUpperCase();
    const isAdminUser = isUserAdmin(userCtx) || currentUserRole === "ADMIN" || currentUserRole === "ADMINISTRATOR" || Boolean((userCtx as any).isAdmin) || currentUserLevel === "ADMIN" || currentUserLevel === "L5" || isL5OrAdmin();

    if (!isAdminUser) {
      alert(`🔒 Access Denied: Only Admin users are authorized to edit or save Sauda records.`);
      return;
    }

    const upperBroker = (formData.broker || '').trim().toUpperCase();
    const isValidBroker = brokerList.length > 0
      ? brokerList.some(b => (b.brok_name && b.brok_name.toUpperCase() === upperBroker) || (b.brok_code && b.brok_code.toUpperCase() === (formData.broker_code || '').trim().toUpperCase()))
      : Boolean(upperBroker);

    if (!upperBroker || !isValidBroker) {
      alert("Please select a valid option for Broker.");
      return;
    }

    const upperSupplier = (formData.supplier || '').trim().toUpperCase();
    const isValidSupplier = supplierList.length > 0
      ? supplierList.some(s => (s.supp_name && s.supp_name.toUpperCase() === upperSupplier) || (s.supp_code && s.supp_code.toUpperCase() === (formData.supplier_code || '').trim().toUpperCase()))
      : Boolean(upperSupplier);

    if (!upperSupplier || !isValidSupplier) {
      alert("Please select a valid option for Supplier.");
      return;
    }

    const upperChallanSupplier = (formData.challan_supplier || '').trim().toUpperCase();
    if (upperChallanSupplier && supplierList.length > 0) {
      const isValidChallan = supplierList.some(s => 
        (s.supp_name && s.supp_name.toUpperCase() === upperChallanSupplier) || 
        (s.supp_code && s.supp_code.toUpperCase() === (formData.challan_supplier_code || '').trim().toUpperCase())
      );
      if (!isValidChallan) {
        alert("Please select a valid option for Challan Supplier.");
        return;
      }
    }

    const upperArea = (formData.area || '').trim().toUpperCase();
    const isValidArea = areaList.length > 0
      ? areaList.some(a => (a.area_name && a.area_name.toUpperCase() === upperArea) || (a.area_code && a.area_code.toUpperCase() === (formData.area_code || '').trim().toUpperCase()))
      : Boolean(upperArea);

    if (!upperArea || !isValidArea) {
      alert("Please select a valid option for Area.");
      return;
    }

    setLoading(true);
    try {
      let finalPoNo = String(formData.no || (formData.is_ptf ? formData.ptf_no : '') || '').trim();
      if (!finalPoNo) {
        finalPoNo = formData.is_ptf && formData.ptf_no
          ? formData.ptf_no
          : `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const exactPoNo = (a: any, b: any) => {
        const x = String(a || '').trim().toUpperCase();
        const y = String(b || '').trim().toUpperCase();
        return x !== '' && x === y;
      };
      const matchingFinal = (allFinalArrivals || []).filter((ar: any) => exactPoNo(finalPoNo, ar.po_no));
      const weightOf = (ar: any) => Number(ar.weight_qtl || ar.weight || ar.electronic_net_weight || 0) / 10;
      const totalReceivedMt = matchingFinal.reduce((sum: number, ar: any) => sum + weightOf(ar), 0);

      const contractWeight = parseFloat(formData.total_contract_mt) || 0;
      const unit = formData.purchase_unit_name || (formData as any).unit_type || formData.po_type || 'BALES';
      const tol = calculateWeightTolerance(contractWeight, totalReceivedMt, unit);
      const isWeightCompleted = tol.isCompleted;
      const isPendingVal = isWeightCompleted ? false : (formData.pending === 'Yes');
      
      const payload = {
        financial_year: '2026-2027',
        purchase_order: formData.purchase_order,
        po_type: formData.po_type,
        status: isTempPo ? 'temp' : 'final',
        ptf_no: formData.is_ptf ? formData.ptf_no : null,
        pending: isPendingVal,
        po_no: finalPoNo,
        po_date: formData.date || todayStr,
        broker: (formData.broker || '').toUpperCase(),
        supplier: (formData.supplier || '').toUpperCase(),
        challan_supplier: (formData.challan_supplier || '').toUpperCase(),
        area: (formData.area || '').toUpperCase(),
        trans_paid_by: formData.trans_paid_by,
        weight_unit_kgs: parseFloat(formData.weight_unit_kgs) || 50,
        against_cancellation: formData.against_cancellation,
        purchase_unit_code: formData.purchase_unit_code,
        purchase_unit_name: formData.purchase_unit_name,
        total_lorries: parseFloat(formData.total_no_of_lorries) || 0,
        units_per_lorry: parseFloat(formData.units_per_lorry) || 0,
        total_units: parseFloat(formData.total_units) || 0,
        weight_per_lorry: parseFloat(formData.weight_per_lorry) || 0,
        total_contract_mt: parseFloat(formData.total_contract_mt) || 0,
        marka_type: formData.marka_type,
        marka_penalty: parseFloat(formData.marka_penalty) || 0,
        qty_penalty: parseFloat(formData.qty_penalty) || 0,
        delivery_from: formData.delivery_from || null,
        delivery_to: formData.delivery_to || null,
        grace_days: parseInt(formData.grace_days) || 0,
        delivery_penalty: parseFloat(formData.delivery_penalty) || 0,
        contract_po_no: formData.contract_po_no,
        contract_date: formData.contract_date || null,
        rate_detail: formData.rate_detail,
        delivery_schedule: formData.delivery_schedule,
        terms_condition: formData.terms_condition,
        remarks: formData.remarks,
        po_identification: formData.po_identification,
        b_rate: parseFloat(formData.b_rate) || 0,
        s_date: formData.s_date || null
      };

      const alreadyExists = (poList || []).some((p: any) => String(p.po_no).trim().toUpperCase() === finalPoNo.toUpperCase());

      if (supabase) {
        try {
          await supabase.from(MASTER_TABLE).upsert(payload, { onConflict: 'po_no' });
        } catch (e) {
          console.warn(`Supabase upsert into ${MASTER_TABLE} warning:`, e);
        }
      }

      if (alreadyExists) {
        try {
          await dbModule.update(MASTER_TABLE, 'po_no', finalPoNo, payload);
        } catch {
          await dbModule.insert(MASTER_TABLE, payload).catch(() => {});
        }
      } else {
        await dbModule.insert(MASTER_TABLE, payload).catch(() => {});
      }

      await poService.savePoDetails(DETAIL_TABLE, finalPoNo, formData.items, {
        gradeList,
        agencyList,
        markaList
      });
      
      window.dispatchEvent(new CustomEvent('app-data-updated'));
      alert(`Purchase Order ${finalPoNo} saved successfully!`);
      setViewMode('register');
      fetchPosAndMasters();
    } catch (err: any) {
      console.error(err);
      alert("PO Save failed: " + (err.message || "Database error."));
    } finally {
      setLoading(false);
    }
  };

  const isSaudaActive = !formData.is_ptf && !!formData.no;

  const getCleanSaudaDigits = (str: string) => {
    if (!str) return '';
    const clean = String(str).trim().toUpperCase();
    const withoutPrefix = clean
      .replace(/^BJCL\//i, '')
      .replace(/^BJC\//i, '')
      .replace(/^BJC/i, '')
      .replace(/^PO[-/]/i, '')
      .replace(/^PTF[-/]/i, '');
    const withoutYear = withoutPrefix
      .replace(/20\d{2}-20\d{2}/g, '')
      .replace(/20\d{2}\/20\d{2}/g, '')
      .replace(/20\d{2}20\d{2}/g, '')
      .replace(/\/\d{2}-\d{2}$/g, '')
      .replace(/^\d{2}-\d{2}\//g, '')
      .replace(/[^0-9]/g, '');
    return withoutYear.replace(/^0+/, '');
  };

  const displaySaudas = saudaList.filter(s => {
    const isPending = !s.status || String(s.status).trim().toLowerCase() !== 'completed';
    const saudaPoDisplayNo = (formatPoNumber(s) || '').trim().toUpperCase();
    const saudaNo = String(s.sauda_no || '').trim().toUpperCase();
    const saudaSession = String(s.session || '').trim().toUpperCase();
    const sDigits = getCleanSaudaDigits(saudaNo) || getCleanSaudaDigits(saudaPoDisplayNo) || getCleanSaudaDigits(saudaSession);

    const currentFormNo = (formData.no || formData.contract_po_no || '').trim().toUpperCase();
    const currentFormDigits = getCleanSaudaDigits(currentFormNo);
    const isCurrentlySelectedInForm = currentFormNo && (
      currentFormNo === saudaPoDisplayNo ||
      currentFormNo === saudaSession ||
      currentFormNo === saudaNo ||
      (sDigits && currentFormDigits === sDigits)
    );

    if (isCurrentlySelectedInForm) {
      return true;
    }

    const isAlreadyUsed = poList.some(p => {
      const sId = String(s.sauda_id || s.id || '').trim().toUpperCase();
      const pSaudaId = String(p.sauda_id || p.sauda_id_ref || '').trim().toUpperCase();
      if (sId && pSaudaId && sId === pSaudaId) {
        return true;
      }

      const pPo = String(p.po_no || '').trim().toUpperCase();
      const pContract = String(p.contract_po_no || '').trim().toUpperCase();
      const pSaudaNo = String(p.sauda_no || p.po_contract || p.contract_no || '').trim().toUpperCase();
      const pPtf = String(p.ptf_no || '').trim().toUpperCase();

      const pContractRefs = [pContract, pSaudaNo, pPo, pPtf].filter(Boolean);
      if (pContractRefs.some(ref => 
        ref === saudaPoDisplayNo || 
        ref === saudaSession || 
        ref === saudaNo ||
        (s.sauda_no && ref === String(s.sauda_no).trim().toUpperCase())
      )) {
        return true;
      }

      if (sDigits) {
        const pContractDigits = getCleanSaudaDigits(pContract);
        const pSaudaDigits = getCleanSaudaDigits(pSaudaNo);
        if (pContractDigits && pContractDigits === sDigits) return true;
        if (pSaudaDigits && pSaudaDigits === sDigits) return true;
      }

      return false;
    });

    const meetsPending = formData.pending === 'Yes' ? isPending : !isPending;
    return meetsPending && !isAlreadyUsed;
  }).map(s => ({
    ...s,
    po_display_no: formatPoNumber(s)
  }));

  return {
    todayStr,
    getCropYear,
    loading,
    setLoading,
    isCalcOpen,
    setIsCalcOpen,
    selectedItemSrl,
    setSelectedItemSrl,
    formData,
    setFormData,
    calcData,
    setCalcData,
    lookupSattaBaseRate,
    getSattaRateForRow,
    recalculateAllRates,
    recalculateItemWeights,
    handlePurchaseUnitChange,
    handleSaudaSelect,
    handleAddItem,
    handleDeleteItem,
    handleSyncFromSource,
    generateNextPtfNo,
    handleGlobalAdd,
    handleLoadSelectedPo,
    handleGlobalAmend,
    handleCalculateOk,
    handleSave,
    isSaudaActive,
    displaySaudas
  };
}
