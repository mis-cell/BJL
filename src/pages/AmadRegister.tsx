import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';
import { 
  Archive, 
  Search, 
  Printer, 
  ArrowLeft,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCcw,
  FileText,
  Edit,
  Trash2,
  Calendar,
  Layers,
  TrendingUp,
  Truck,
  FileSpreadsheet,
  History,
  Clock,
  CheckSquare,
  Square,
  Eye,
  X,
  CheckCircle2
} from 'lucide-react';
import { cn, sanitizeCsvData } from '../lib/utils';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import PrintModal from '../components/PrintModal';
import AmadEntry from './AmadEntry';
import { dbModule } from '../services/dbModule';
import { Amad } from '../types';
import { supabase } from '../lib/supabase';
import { enforceEditOrDeletePermission, canEditOrDelete, canViewCompletedData } from '../lib/permissions';

export const calculateNetWeightVal = (
  gross: number,
  moisture: number,
  dust: number,
  ncv: number,
  arrivalAreaName: string,
  poDateStr: string,
  generalDateStr?: string
): string => {
  if (!gross) return "";
  
  let month = 0;
  let dateToParse = poDateStr || generalDateStr;
  if (dateToParse) {
    const d = new Date(dateToParse);
    if (!isNaN(d.getTime())) {
      month = d.getMonth();
    }
  }

  const areaNameClean = String(arrivalAreaName || '').toLowerCase();
  const isDaisee = areaNameClean.includes("daisee");
  
  let moistureLimit = 16;
  const isJanToJune = month >= 0 && month <= 5;
  
  if (isJanToJune) {
    if (isDaisee) {
      moistureLimit = 18;
    } else {
      moistureLimit = 16;
    }
  } else {
    if (isDaisee) {
      moistureLimit = 20;
    } else {
      moistureLimit = 18;
    }
  }

  const moistureExcessPct = moisture > moistureLimit ? (moisture - moistureLimit) : 0;
  const totalDeductionPct = moistureExcessPct + dust + ncv;
  const netWeight = gross * (1 - totalDeductionPct / 100);
  return netWeight.toFixed(3);
};

export default function AmadRegister({ onClose, onNew, onCreateFinalMr }: { onClose?: () => void; onNew?: () => void; onCreateFinalMr?: (amad: Amad) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [amadList, setAmadList] = useState<Amad[]>([]);
  const [editingAmad, setEditingAmad] = useState<Amad | null>(null);
  const [selectedAmadId, setSelectedAmadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  // Modern Printing Form State System for "MARKS & QUALITY RECEIVED"
  const [printData, setPrintData] = useState<any | null>(null);
  const [isPrintingModalOpen, setIsPrintingModalOpen] = useState(false);

  // Audit Modal trail system
      
  // Column picker selection state
  const [printColumns, setPrintColumns] = useState({
    crop_year: true,
    marka: true,
    quality: true,
    quantity_rcpt: true,
    claim: true,
    gross_wt: true,
    moisture_pct: true,
    dust_pct: true,
    ncv_pct: true,
    net_wt: true,
    settlement: true,
    rate: true
  });

  // Pending PO Arrivals State & Tab Selection
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [inspectionsList, setInspectionsList] = useState<any[]>([]);

  const updatePrintRow = (idx: number, field: string, val: any) => {
    if (!printData) return;
    const updatedRows = [...printData.rows];
    updatedRows[idx] = { ...updatedRows[idx], [field]: val };

    // Calculate Net Wt on parameter change inputs
    if (field === 'gross_wt' || field === 'moisture_pct' || field === 'dust_pct' || field === 'ncv_pct') {
      const gross = Number(updatedRows[idx].gross_wt) || 0;
      const moisture = Number(updatedRows[idx].moisture_pct) || 0;
      const dust = Number(updatedRows[idx].dust_pct) || 0;
      const ncv = Number(updatedRows[idx].ncv_pct) || 0;
      
      updatedRows[idx].net_wt = calculateNetWeightVal(
        gross,
        moisture,
        dust,
        ncv,
        printData.arrival_area_name || '',
        printData.po_date || '',
        printData.date || ''
      );
    }

    setPrintData({ ...printData, rows: updatedRows });
  };

  const handlePreparePrint = async (amad: Amad) => {
    setLoading(true);
    try {
      let inspectionMaster: any = null;
      let inspectionDetails: any[] = [];
      let mrSettlementMaster: any = null;
      let mrSettlementDetails: any[] = [];

      if (supabase) {
        const { data: mMaster, error: mMasterErr } = await supabase
          .from('mill_inspection_master')
          .select('*')
          .eq('arrival_no', amad.amad_no)
          .maybeSingle();

        if (!mMasterErr && mMaster) {
          inspectionMaster = mMaster;
          const { data: mDetails } = await supabase
            .from('mill_inspection_detail')
            .select('*')
            .eq('mr_no', mMaster.mr_no)
            .order('srl_no', { ascending: true });
          if (mDetails) inspectionDetails = mDetails;

          const { data: sMaster } = await supabase
            .from('mr_settlement_master')
            .select('*')
            .eq('mr_no', mMaster.mr_no)
            .maybeSingle();
          if (sMaster) {
            mrSettlementMaster = sMaster;
            const { data: sDetails } = await supabase
              .from('mr_settlement_detail')
              .select('*')
              .eq('mr_no', mMaster.mr_no)
              .order('srl_no', { ascending: true });
            if (sDetails) mrSettlementDetails = sDetails;
          }
        }
      }

      let parsedGrid: any[] = [];
      if (amad.grid_details) {
        if (typeof amad.grid_details === 'string') {
          try {
            const parsed = amad.grid_details === 'undefined' || amad.grid_details === 'null' ? [] : JSON.parse(amad.grid_details === "undefined" ? "null" : amad.grid_details);
            if (Array.isArray(parsed)) {
              parsedGrid = parsed;
            }
          } catch(e) {}
        } else if (Array.isArray(amad.grid_details)) {
          parsedGrid = amad.grid_details;
        }
      }

      const parsedAgencyNames = parsedGrid
        .map((row: any) => (row.agency_name || '').trim())
        .filter(Boolean);
      if (amad.agency_name) {
        parsedAgencyNames.push(amad.agency_name.trim());
      }
      const uniqueAgencies = Array.from(new Set(parsedAgencyNames));
      let finalArrivalAreaName = amad.arrival_area_name || '';
      const agencyNameStr = uniqueAgencies.join(", ");
      if (agencyNameStr && !finalArrivalAreaName.includes(agencyNameStr)) {
        finalArrivalAreaName = `${finalArrivalAreaName} / ${agencyNameStr}`;
      }

      const mappedRows: any[] = (inspectionDetails.length > 0) ? inspectionDetails.map((det, i) => {
        const settRow = mrSettlementDetails.find(s => s.srl_no === det.srl_no);
        const gross = Number(det.challan_gross_wt) || 0;
        const moisture = Number(inspectionMaster?.actual_moisture) || 0;
        const dust = Number(inspectionMaster?.actual_dust) || 0;
        const ncv = Number(inspectionMaster?.actual_ncv) || 0;
        const netStr = calculateNetWeightVal(
          gross,
          moisture,
          dust,
          ncv,
          finalArrivalAreaName,
          amad.po_no || '',
          amad.date || ''
        );

        return {
          crop_year: det.crop_year || '2026-27',
          marka: det.marka || '',
          quality: det.stock_grade_name || '',
          quantity_rcpt: Number(det.quantity) || 0,
          gross_wt: gross || '',
          moisture_pct: moisture || '',
          dust_pct: dust || '',
          ncv_pct: ncv || '',
          net_wt: netStr || '',
          settlement_grade: settRow?.sett_grade || det.stock_grade_name || '',
          settlement_moisture: settRow?.sett_moisture_deduction || '',
          settlement_dust: settRow?.sett_dust_deduction || '',
          settlement_prem_less: settRow?.sett_all_diff || '',
          rate: mrSettlementMaster?.summary_rate_qtel || ''
        };
      }) : parsedGrid.filter(row => row.receipt_grade_name || row.challan_marka_name).map((p, i) => {
        return {
          crop_year: p.crop_year || '2026-27',
          marka: p.challan_marka_name || '',
          quality: p.receipt_grade_name || '',
          quantity_rcpt: p.quantity_rcpt || p.quantity_chln || p.quantity || 0,
          gross_wt: p.netto_pnto || p.weight || '',
          moisture_pct: '',
          dust_pct: '',
          ncv_pct: '',
          net_wt: p.netto_pnto || p.weight || '',
          settlement_grade: p.receipt_grade_name || '',
          settlement_moisture: '',
          settlement_dust: '',
          settlement_prem_less: '',
          rate: ''
        };
      });

      while (mappedRows.length < 8) {
        mappedRows.push({
          crop_year: '',
          marka: '',
          quality: '',
          quantity_rcpt: '',
          gross_wt: '',
          moisture_pct: '',
          dust_pct: '',
          ncv_pct: '',
          net_wt: '',
          settlement_grade: '',
          settlement_moisture: '',
          settlement_dust: '',
          settlement_prem_less: '',
          rate: ''
        });
      }

      const rawMrNo = inspectionMaster?.mr_no || `MR/ARR/${amad.amad_no}`;
      let formattedMrNo = rawMrNo;
      if (rawMrNo && rawMrNo.includes('/')) {
        const parts = rawMrNo.split('/');
        if (parts[0].toUpperCase() === 'MR') {
          const lastPart = parts[parts.length - 1];
          if (lastPart) {
            formattedMrNo = `MR${lastPart}`;
          }
        }
      }

      setPrintData({
        amad_no: amad.amad_no,
        date: amad.date,
        po_no: amad.po_no || '',
        po_date: amad.lorry_date || amad.date,
        mr_no: formattedMrNo,
        mr_date: inspectionMaster?.mr_date || amad.date,
        transporter_name: amad.transporter_name || '',
        challan_rr_no: amad.challan_rr_no || '',
        lorry_number: amad.lorry_number || (amad as any).lorry_no || (amad as any).vehicle_no || '',
        arrival_area_name: finalArrivalAreaName,
        supplier: amad.supplier || '',
        remarks: amad.remarks || inspectionMaster?.remarks || '',
        rows: mappedRows
      });

      setIsPrintingModalOpen(true);
    } catch(e) {
      console.error("Error setting up print view:", e);
      alert("Failed to load full inspection details, loading basic data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAmads = async () => {
    setLoading(true);
    setRefreshMessage(null);
    try {
      const [data, poData, inspectionData] = await Promise.all([
        dbModule.fetchAll('temporary_material_received', 'created_at', false),
        dbModule.fetchAll('purchase_master').catch(() => []),
        dbModule.fetchAll('mill_inspection_master').catch(() => [])
      ]);

      const normalized = (data || []).map((item: any) => {
        const tempNo = item.temporary_arrival_no || item.amad_no || item.arrival_no || item.mr_no || (item.amad_id ? String(item.amad_id).slice(0, 8) : '');
        return {
          ...item,
          temporary_arrival_no: tempNo,
          amad_no: tempNo
        };
      });

      setAmadList(normalized);
      setPurchaseOrders(poData || []);
      setInspectionsList(inspectionData || []);
      
      setRefreshMessage(`Database sync complete: successfully fetched ${data?.length || 0} active arrivals & ${poData?.length || 0} purchase contracts!`);
      setTimeout(() => setRefreshMessage(null), 4500);
    } catch(e: any) {
      console.error("Error fetching arrivals:", e);
      setRefreshMessage(`Sync failed: ${e.message || e}`);
      setTimeout(() => setRefreshMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmads();
  }, []);

  const handleEditAmad = (amad: Amad) => {
    if (!enforceEditOrDeletePermission("Edit")) return;
    setEditingAmad(amad);
  };

  const handleDelete = async (id: string, amad_no: string) => {
    if (!enforceEditOrDeletePermission("Delete")) {
      return;
    }

    if (confirm(`Are you sure you want to completely delete Arrival Voucher #${amad_no}?`)) {
      try {
        await Promise.all([
          dbModule.delete('temporary_material_received', 'amad_id', id),
          dbModule.delete('issue_master', 'amad_id', id).catch(() => null)
        ]);
        alert(`Arrival Voucher #${amad_no} deleted permanently.`);
        fetchAmads();
        if (selectedAmadId === id) setSelectedAmadId(null);
      } catch (e) {
        console.error(e);
        alert("Failed to delete arrival voucher");
      }
    }
  };

  if (editingAmad) {
    return (
      <AmadEntry 
        initialData={editingAmad} 
        onCancel={() => setEditingAmad(null)} 
        onSave={() => { setEditingAmad(null); fetchAmads(); }} 
      />
    );
  }

  // Filter list
  const filteredAmads = amadList.filter(a => {
    // Check if status is cancelled. We can choose to hide or show them. Let's show them but marked.
    const term = searchTerm.toLowerCase();
    const matchSearch = 
      (a.temporary_arrival_no || a.amad_no || '').toLowerCase().includes(term) ||
      (a.supplier || '').toLowerCase().includes(term) ||
      (a.broker || '').toLowerCase().includes(term) ||
      (a.lorry_number || (a as any).lorry_no || (a as any).vehicle_no || '').toLowerCase().includes(term) ||
      (a.arrival_area_name || '').toLowerCase().includes(term) ||
      (a.status === 'cancelled' && term === 'void');
    
    let matchDateRange = true;
    if (startDateFilter && endDateFilter) {
      matchDateRange = a.date >= startDateFilter && a.date <= endDateFilter;
    } else if (startDateFilter) {
      matchDateRange = a.date >= startDateFilter;
    } else if (endDateFilter) {
      matchDateRange = a.date <= endDateFilter;
    }

    if (!canViewCompletedData()) {
      const isInspected = inspectionsList.some(
        (insp) => String(insp.arrival_no || '').trim().toUpperCase() === String(a.amad_no || a.temporary_arrival_no || '').trim().toUpperCase()
      );
      if (isInspected) return false;
    }

    return matchSearch && matchDateRange;
  });

  const handleExportToExcel = () => {
    if (filteredAmads.length === 0) {
      alert("No data available to export.");
      return;
    }

    const dataToExport = filteredAmads.map((amad) => {
      const formattedDate = amad.date ? new Date(amad.date).toLocaleDateString('en-GB') : '';
      const bales = Number(amad.total_packets || amad.packets || 0);
      const weightMt = (Number(amad.weight_qtl || amad.weight || 0) / 10);

      return {
        "Voucher Date": formattedDate,
        "Temporary M.R No": (amad.temporary_arrival_no || amad.amad_no) ? `#${amad.temporary_arrival_no || amad.amad_no}` : '',
        "P.O. Number": amad.po_no || '',
        "Supplier": amad.supplier || '',
        "Broker": amad.broker || 'DIRECT',
        "Lorry Number": amad.lorry_number || (amad as any).lorry_no || (amad as any).vehicle_no || '',
        "Unit": amad.unit_name || amad.unit_code || 'BALES',
        "Qty": bales,
        "Weight": weightMt.toFixed(3),
        "Transporter": amad.transporter_name || '',
        "Challan/RR No.": amad.challan_rr_no || '',
        "Lorry Date": amad.lorry_date || '',
        "Arrival Area": amad.arrival_area_name || '',
        "Unit Name": amad.unit_name || '',
        "Way Bill No.": amad.way_bill_no || '',
        "APMC Fees (Rs)": amad.apmc_fees || 0,
        "Remarks": amad.remarks || ''
      };
    });

    try {
      const sanitizedData = sanitizeCsvData(dataToExport);
      const csv = Papa.unparse(sanitizedData);
      const csvContent = "\uFEFF" + csv; // UTF-8 BOM
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Arrival_Register_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export. Please try again.");
    }
  };

  // Calculate top quick summaries based on filtered list
  const totalBales = filteredAmads.reduce((acc, a) => acc + (Number(a.total_packets || a.packets || 0)), 0);
  // Weight is stored in qtl (quintals); 10 Quintals = 1 M.T
  const totalWeightMt = filteredAmads.reduce((acc, a) => acc + (Number(a.weight_qtl || a.weight || 0) / 10), 0);

  // Group by Date for the "Date Wise Show total Arrival Report" Card
  const dateWiseArrivalsMap: { [date: string]: { count: number; packets: number; weight: number } } = {};
  amadList.forEach(a => {
    const d = a.date || 'No Date';
    if (!dateWiseArrivalsMap[d]) {
      dateWiseArrivalsMap[d] = { count: 0, packets: 0, weight: 0 };
    }
    dateWiseArrivalsMap[d].count += 1;
    dateWiseArrivalsMap[d].packets += Number(a.total_packets || a.packets || 0);
    dateWiseArrivalsMap[d].weight += (Number(a.weight_qtl || a.weight || 0) / 10);
  });

  // Convert map to sorted list of objects
  const dateWiseArrivalList = Object.entries(dateWiseArrivalsMap)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => b.date.localeCompare(a.date)); // descending dates

  // Calculate totals for active printData slip in parent scope to avoid JSX parse issues
  const printTotalQty = printData && printData.rows
    ? printData.rows.reduce((sum: number, r: any) => sum + (Number(r.quantity_rcpt) || 0), 0)
    : 0;
  const printTotalGrossWt = printData && printData.rows
    ? printData.rows.reduce((sum: number, r: any) => sum + (Number(r.gross_wt) || 0), 0)
    : 0;
  const printTotalNetWt = printData && printData.rows
    ? printData.rows.reduce((sum: number, r: any) => sum + (Number(r.net_wt) || 0), 0)
    : 0;

  return (
    <LegacyLayout title="Temporary M.R" subtitle="" onClose={onClose}>
      <div className="space-y-4">
        
        {/* Top Operational Metrics Hub */}
        <div className="grid grid-cols-12 gap-3">
          {/* Card 1: Cumulative Statistics */}
          <div className="col-span-12 md:col-span-4 bg-[#d4d0c8] border border-white border-b-gray-600 border-r-gray-600 p-2 shadow-sm">
            <h3 className="text-xs font-bold text-gray-700 border-b border-gray-400 pb-1 mb-1.5 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-blue-800" /> Operational Overview
            </h3>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-white border border-gray-400 p-1">
                <p className="text-[9px] font-bold text-gray-500 uppercase">Filtered Loads</p>
                <p className="text-sm font-black text-gray-900 font-mono">{filteredAmads.length} Lorries</p>
              </div>
              <div className="bg-white border border-gray-400 p-1">
                <p className="text-[9px] font-bold text-gray-500 uppercase">Total Packets</p>
                <p className="text-sm font-black text-blue-800 font-mono">{totalBales.toLocaleString()} Bales</p>
              </div>
              <div className="bg-white border border-gray-400 p-1 col-span-2">
                <p className="text-[9px] font-bold text-gray-500 uppercase">Total Weight</p>
                <p className="text-sm font-black text-red-700 font-mono">{totalWeightMt.toFixed(3)} MT</p>
              </div>
            </div>
          </div>

          {/* Card 2: Date-Wise Total Arrival Hub Card */}
          <div className="col-span-12 md:col-span-8 bg-[#d4d0c8] border border-white border-b-gray-600 border-r-gray-600 p-2 shadow-sm flex flex-col">
            <div className="flex justify-between items-center border-b border-gray-400 pb-1 mb-1.5">
              <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-red-700" /> Date Wise Total Arrival Report (Global Summary)
              </h3>
              <span className="text-[8px] uppercase tracking-wider font-extrabold text-gray-500 bg-white/50 px-1 border border-gray-300">Latest Days</span>
            </div>
            
            {/* Scrollable list inside the report card */}
            <div className="bg-white border border-gray-400 h-[83px] overflow-y-auto">
              <table className="w-full text-left text-[9px] border-collapse font-mono">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 sticky top-0 font-bold text-gray-600 ">
                    <th className="px-2 py-0.5 border-r border-gray-200">Arrival Date</th>
                    <th className="px-2 py-0.5 text-center border-r border-gray-200">Lorry Count</th>
                    <th className="px-2 py-0.5 text-right border-r border-gray-200">Total Bales (Rcpt)</th>
                    <th className="px-2 py-0.5 text-right">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dateWiseArrivalList.map((rep) => {
                    const isSelectedDate = startDateFilter === rep.date && endDateFilter === rep.date;
                    return (
                      <tr 
                        key={rep.date} 
                        className="hover:bg-blue-50 cursor-pointer"
                        onClick={() => { setStartDateFilter(rep.date); setEndDateFilter(rep.date); }}
                      >
                        <td className="px-2 py-0.5 font-bold text-gray-700 flex items-center gap-1">
                          <span className={cn("w-1.5 h-1.5 rounded-full bg-blue-600 inline-block", isSelectedDate && "bg-red-600 animate-pulse")} />
                          {new Date(rep.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-2 py-0.5 text-center font-black text-slate-800">{rep.count} Trucks</td>
                        <td className="px-2 py-0.5 text-right font-black text-blue-700">{rep.packets}</td>
                        <td className="px-2 py-0.5 text-right font-black text-red-600">{rep.weight.toFixed(3)} MT</td>
                      </tr>
                    );
                  })}
                  {dateWiseArrivalList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-gray-400 uppercase font-bold text-[9px]">No historical calendar data loaded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-1 text-[8px] text-gray-500 font-bold ">
              <span>* Click on any date row to immediately load that day's files in the ledger table.</span>
              {(startDateFilter || endDateFilter) && (
                <button 
                  onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                  className="text-red-700 font-extrabold border border-red-300 hover:bg-red-50 px-1 bg-white"
                >
                  Clear Date Filter {startDateFilter === endDateFilter ? `(${new Date(startDateFilter).toLocaleDateString('en-GB')})` : `(${startDateFilter} to ${endDateFilter})`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls & Searching Strip */}
        <div className="flex bg-[#c0c0c0] p-1 border border-black/20 gap-2 items-center flex-wrap">
          {/* SEARCH FIELD */}
          <div className="flex bg-white border border-gray-400 p-px flex-1 min-w-[200px]">
            <input 
              className="flex-1 text-xs px-2 outline-none py-1 font-sans" 
              placeholder="Search by Voucher No, Supplier, Broker Name or Lorry plate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="bg-[#d4d0c8] px-2 border-l border-gray-400 flex items-center justify-center">
              <Search className="h-3.5 w-3.5 text-gray-600" />
            </div>
          </div>

          {/* DATE RANGE FILTER FIELDS */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-400 p-px">
            <span className="text-[9px] font-black uppercase text-gray-500 pl-1">From:</span>
            <input 
              type="date"
              className="text-xs px-1 py-0.5 outline-none font-bold"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
            />
            <span className="text-[9px] font-black uppercase text-gray-500">To:</span>
            <input 
              type="date"
              className="text-xs px-1 py-0.5 outline-none font-bold"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
            />
            {(startDateFilter || endDateFilter) && (
              <button 
                onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                className="text-gray-400 hover:text-red-600 px-1.5 border-l border-gray-200 font-bold"
                title="Clear date range"
              >
                ×
              </button>
            )}
          </div>

          {/* ACT BUTTONS */}
          <div className="flex gap-1">
            <button 
              onClick={handleExportToExcel} 
              className="bg-[#24a148] hover:bg-[#1e853c] text-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3 text-[10px] font-bold h-6 flex items-center gap-1.5 active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] transition-colors"
              title="Download filtered records as CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-100" /> Export to CSV
            </button>
            <button 
              onClick={() => { setSearchTerm(''); setStartDateFilter(''); setEndDateFilter(''); }} 
              className="bg-[#d4d0c8] border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3 text-[10px] font-bold h-6 flex items-center gap-1 active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] hover:bg-[#c8c4bc]"
              title="Clear Search & Filters"
            >
              <X className="h-3 w-3" /> Clear
            </button>
            <button 
              onClick={fetchAmads} 
              className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3 text-[10px] font-bold h-6 flex items-center gap-1.5 active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] transition-colors disabled:opacity-50"
              title="Refresh records"
              disabled={loading}
            >
              <RefreshCcw className={`h-3.5 w-3.5 text-emerald-100 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        {/* Primary Command Desk Launcher */}
        <div className="flex gap-1 items-center">
          <LegacyButton icon={Plus} label="New Arrival Entry" onClick={onNew} />
          
          
          
          
          {true && (
            <LegacyButton 
              icon={Printer} 
              label="Print Selected Slip" 
              onClick={() => {
                if (selectedAmadId) {
                  const target = amadList.find(a => a.amad_id === selectedAmadId);
                  if (target) {
                    handlePreparePrint(target);
                  } else {
                    alert("Selected Arrival record not found.");
                  }
                } else {
                  alert("Please select an Arrival row in the table first.");
                }
              }} 
            />
          )}
          
          <div className="flex-1" />
          <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5 bg-gray-100 border border-gray-200 px-3 py-1.5 shadow-[inset_1px_1px_0_white]">
            <Truck className="w-4 h-4 text-gray-600" /> 
            {true ? (
              <>
                Total Filtered Metric Tons : 
                <span className="text-blue-800 font-extrabold">{totalWeightMt.toFixed(3)} MT</span>
              </>
            ) : (
              <>
                Total Outstanding Balance : 
                <span className="text-red-800 font-extrabold">
                  {(() => {
                    const amadPoNosSet = new Set(amadList.map(a => String(a.po_no || '').trim().toUpperCase()).filter(Boolean));
                    const pendingPOs = purchaseOrders.filter(po => {
                      const cleanPoNo = String(po.po_no || '').trim().toUpperCase();
                      return cleanPoNo && !amadPoNosSet.has(cleanPoNo);
                    });
                    return pendingPOs.reduce((sum, po) => sum + (Number(po.pending_received || 0)), 0);
                  })().toFixed(3)} MT
                </span>
              </>
            )}
          </div>
        </div>

        {refreshMessage && (
          <div className={cn(
            "mb-2.5 px-4 py-2 border-2 text-[11.5px] font-black uppercase tracking-wider flex items-center justify-between shadow-[2px_2px_0_0_rgba(0,0,0,0.15)] rounded border-white",
            refreshMessage.includes("failed") || refreshMessage.includes("Sync failed")
              ? "bg-[#fee2e2] text-red-900 border-red-400"
              : "bg-[#e2f0d9] text-[#1e4620] border-emerald-400"
          )}>
            <div className="flex items-center gap-2">
              <span className={refreshMessage.includes("failed") || refreshMessage.includes("Sync failed") ? "text-red-600 animate-pulse font-extrabold" : "text-emerald-600 animate-pulse font-extrabold text-base"}>●</span>
              <span>{refreshMessage}</span>
            </div>
            <button 
              onClick={() => setRefreshMessage(null)} 
              className="text-gray-500 hover:text-gray-800 font-extrabold cursor-pointer px-1.5 py-0.5 rounded hover:bg-black/5"
            >
              [ CLOSE ]
            </button>
          </div>
        )}

        {/* Ledger Table Container */}
        <div className="border border-gray-400 bg-white overflow-x-auto min-h-[350px] shadow-sm relative">
          {loading && (
            <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] flex flex-col items-center justify-center z-40 ">
              <div className="bg-[#d4d0c8] border-2 border-white shadow-lg p-5 flex flex-col items-center gap-3">
                <RefreshCcw className="h-6 w-6 text-[#0d47a1] animate-spin" />
                <span className="text-[10px] uppercase font-black tracking-widest text-[#0d47a1]">Syncing with Supabase Live Ledger...</span>
              </div>
            </div>
          )}
          {true ? (
            <table className="w-full border-collapse text-xs font-sans">
              <thead className="bg-[#c0c0c0] sticky top-0 z-10 ">
                <tr className="border-b border-gray-400 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)] h-9">
                  <th className="px-2 border-r border-gray-300 font-bold text-center text-gray-800 w-24 whitespace-nowrap">Voucher Date</th>
                  <th className="px-2 border-r border-gray-300 font-bold text-center text-gray-800 w-20 whitespace-nowrap">Temp Arrival #</th>
                  <th className="px-2 border-r border-gray-300 font-bold text-center text-gray-800 w-26 whitespace-nowrap">PO #</th>
                  <th className="px-3 border-r border-gray-300 font-bold text-left text-gray-800 whitespace-nowrap">Supplier Name</th>
                  <th className="px-3 border-r border-gray-300 font-bold text-left text-gray-800 whitespace-nowrap">Broker Reference</th>
                  <th className="px-2 border-r border-gray-300 font-bold text-center text-gray-800 w-28 whitespace-nowrap">Lorry Number</th>
                  <th className="px-2 border-r border-gray-300 font-bold text-center text-gray-800 w-20 whitespace-nowrap">Unit</th>
                  <th className="px-2 border-r border-gray-300 font-bold text-right text-gray-800 w-20 whitespace-nowrap">Qty</th>
                  <th className="px-2 border-r border-gray-300 font-bold text-right text-gray-800 w-24 bg-red-50/50 text-red-900 whitespace-nowrap">Weight</th>
                  <th className="px-2 border-r border-gray-300 font-bold text-center text-gray-800 w-28 whitespace-nowrap">Inspection Status</th>
                  <th className="px-2 font-bold text-center text-gray-800 w-24 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono text-xs">
                {filteredAmads.map((amad, idx) => {
                  const isSelected = selectedAmadId === amad.amad_id;
                  const formattedDate = amad.date ? new Date(amad.date).toLocaleDateString('en-GB') : '--';
                  const bales = Number(amad.total_packets || amad.packets || 0);
                  const weightMt = (Number(amad.weight_qtl || amad.weight || 0) / 10);
                  const isVoid = amad.status === 'cancelled';
                  
                  return (
                    <tr 
                      key={amad.amad_id || idx} 
                      onClick={() => setSelectedAmadId(amad.amad_id || null)}
                      onDoubleClick={() => { if(!isVoid) handleEditAmad(amad); }}
                      className={cn(
                        "h-9.5 cursor-pointer group hover:bg-[#ffffd0]/60 text-xs", 
                        isSelected ? "bg-indigo-50 text-indigo-950 font-bold border-y border-indigo-200" : 
                        isVoid ? "bg-red-50/40 text-gray-400 line-through decoration-red-500/50" :
                        (idx % 2 === 0 ? "bg-white text-gray-900" : "bg-gray-50/40 text-gray-900")
                      )}
                    >
                      {/* Voucher Date */}
                      <td className={cn("text-center font-bold whitespace-nowrap", isSelected ? "text-indigo-900" : isVoid ? "text-red-400" : "text-gray-500")}>
                        {formattedDate}
                      </td>

                      {/* Arrival ID/No. */}
                      <td className={cn("text-center font-black whitespace-nowrap", isSelected ? "text-indigo-950" : "text-gray-900")}>
                        #{amad.temporary_arrival_no || amad.amad_no || (amad as any).arrival_no || (amad as any).mr_no || amad.amad_id || '--'}
                      </td>

                      {/* PO No. */}
                      <td className={cn("text-center font-bold font-mono text-xs px-1 whitespace-nowrap", isSelected ? "text-indigo-950 bg-indigo-100/40" : "text-amber-800 bg-amber-50/10")}>
                        {amad.po_no || '--'}
                      </td>

                      {/* Supplier */}
                      <td className="px-3 truncate uppercase font-sans font-semibold text-left whitespace-nowrap max-w-[200px]">
                        {amad.supplier || '--'}
                        {amad.agency_name && (
                          <span className={cn("text-[10px] ml-1.5 px-1.5 py-0.5 rounded font-mono uppercase font-normal border", isSelected ? "bg-indigo-100 border-indigo-200 text-indigo-900" : "bg-indigo-50 border-indigo-100 text-indigo-700")}>
                            {amad.agency_name}
                          </span>
                        )}
                      </td>

                      {/* Broker */}
                      <td className={cn("px-3 truncate uppercase font-sans text-left whitespace-nowrap max-w-[150px]", isSelected ? "text-indigo-900/90" : "text-gray-600")}>
                        {amad.broker || 'DIRECT'}
                      </td>

                      {/* Lorry Number */}
                      <td className="text-center font-extrabold uppercase whitespace-nowrap">
                        {amad.lorry_number || (amad as any).lorry_no || (amad as any).vehicle_no || '--'}
                      </td>

                      {/* Unit */}
                      <td className="text-center whitespace-nowrap">
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border bg-blue-50 text-blue-800 border-blue-200"
                        )}>
                          {amad.unit_name || amad.unit_code || 'BALES'}
                        </span>
                      </td>

                      {/* Total Packets (Chln/Rcpt) */}
                      <td className={cn("text-right px-2 font-black tabular-nums font-mono whitespace-nowrap", isSelected ? "text-indigo-950" : "text-blue-700 group-hover:text-blue-900")}>
                        {bales}
                      </td>

                      {/* Total Weight in Net MT */}
                      <td className={cn("text-right px-2 font-black tabular-nums font-mono whitespace-nowrap", isSelected ? "text-red-800 bg-red-100/50" : "text-red-700 bg-red-50/20")}>
                        {weightMt.toFixed(3)}
                      </td>

                      {/* Inspection Status */}
                      <td className="text-center whitespace-nowrap">
                        {(() => {
                          const isInspected = inspectionsList.some(
                            (insp) => String(insp.arrival_no || '').trim().toUpperCase() === String(amad.amad_no || '').trim().toUpperCase()
                          );
                          return (
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded font-black uppercase border tracking-wider",
                              isInspected 
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-rose-100 text-rose-800 border-rose-200"
                            )}>
                              {isInspected ? '✓ DONE' : '⏳ PENDING'}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        {isVoid ? (
                           <div className="flex items-center justify-center gap-2">
                             <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px] uppercase border border-red-200">VOID</span>
                             {canEditOrDelete() && (
                               <button
                                 onClick={(e) => { e.stopPropagation(); handleDelete(amad.amad_id, amad.amad_no); }}
                                 className="p-1 text-red-600 hover:text-red-800 hover:bg-black/10 rounded transition-colors"
                                 title="Delete Permanently"
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                             )}
                           </div>
                        ) : (
                        <div className="flex justify-center gap-1.5">
                          {onCreateFinalMr && (
                            <button 
                              onClick={() => onCreateFinalMr(amad)} 
                              className={cn(
                                "p-1 hover:bg-black/15 rounded transition-colors text-emerald-600 hover:text-emerald-800",
                                isSelected && "text-emerald-300 hover:text-white"
                              )}
                              title="Convert to Final M.R"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button 
                            onClick={() => handlePreparePrint(amad)} 
                            className={cn(
                              "p-1 hover:bg-black/15 rounded transition-colors",
                              isSelected ? "text-red-200 hover:text-white" : "text-red-600 hover:text-red-800"
                            )}
                            title="Print Marks & Quality Received Slip"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {canEditOrDelete() && (
                            <>
                              <button 
                                onClick={() => handleEditAmad(amad)} 
                                className={cn(
                                  "p-1 hover:bg-black/15 rounded transition-colors",
                                  isSelected ? "text-blue-200 hover:text-white" : "text-blue-600 hover:text-blue-800"
                                )}
                                title="Edit Voucher Details"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDelete(amad.amad_id!, amad.amad_no)} 
                                className={cn(
                                  "p-1 hover:bg-black/15 rounded transition-colors",
                                  isSelected ? "text-gray-200 hover:text-red-200" : "text-gray-500 hover:text-red-700"
                                )}
                                title="Cancel Voucher"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredAmads.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-gray-500 font-bold uppercase text-[11px] leading-relaxed">
                      No Registered Arrival Vouchers Found Matching Search Constraints.
                    </td>
                  </tr>
                )}
                
                {/* Vertical padding space for retro feel */}
                {Array.from({ length: Math.max(0, 10 - filteredAmads.length) }).map((_, i) => (
                  <tr key={i} className="h-8.5 border-b border-gray-100 opacity-25">
                    <td colSpan={11}></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse text-[11px] font-sans">
              <thead className="bg-[#c0c0c0] sticky top-0 z-10 ">
                <tr className="border-b border-gray-400 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)] h-8">
                  <th className="px-2 border-r border-gray-300 font-bold text-center text-gray-800 w-24">P.O. Date</th>
                  <th className="px-2 border-r border-gray-300 font-bold text-center text-gray-800 w-32">P.O. Reference</th>
                  <th className="px-3 border-r border-gray-300 font-bold text-left text-gray-800">Supplier Name</th>
                  <th className="px-3 border-r border-gray-300 font-bold text-left text-gray-800">Broker Reference</th>
                  <th className="px-2 border-r border-gray-300 font-bold text-right text-gray-800 w-36">Contract Weight (M.T)</th>
                  <th className="px-2 border-r border-gray-300 font-bold text-right text-gray-800 w-36 bg-red-50/50 text-red-900">Outstanding Bal (M.T)</th>
                  <th className="px-2 font-bold text-center text-gray-800 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {(() => {
                  const amadPoNosSet = new Set(
                    amadList
                      .filter(a => a.status !== 'cancelled')
                      .map(a => String(a.po_no || '').trim().toUpperCase())
                      .filter(Boolean)
                  );
                  const pendingPOs = purchaseOrders.filter(po => {
                    const cleanPoNo = String(po.po_no || '').trim().toUpperCase();
                    if (!cleanPoNo) return false;
                    const hasNoArrival = !amadPoNosSet.has(cleanPoNo);
                    if (!hasNoArrival) return false;

                    if (searchTerm.trim()) {
                      const term = searchTerm.toLowerCase();
                      const matchPo = cleanPoNo.toLowerCase().includes(term);
                      const matchSupplier = String(po.supplier || '').toLowerCase().includes(term);
                      const matchBroker = String(po.broker || '').toLowerCase().includes(term);
                      return matchPo || matchSupplier || matchBroker;
                    }
                    return true;
                  });

                  return (
                    <>
                      {pendingPOs.map((po, idx) => {
                        const formattedDate = po.po_date ? new Date(po.po_date).toLocaleDateString('en-GB') : '--';
                        return (
                          <tr key={po.po_id || po.po_no || idx} className="h-8.5 hover:bg-amber-50/40 transition-colors border-b border-gray-100">
                            <td className="text-center font-bold text-gray-500">
                              {formattedDate}
                            </td>
                            <td className="text-center font-black">
                              #{po.po_no}
                            </td>
                            <td className="px-3 font-sans font-bold uppercase truncate max-w-[200px]" title={po.supplier}>
                              {po.supplier || 'N/A'}
                            </td>
                            <td className="px-3 font-sans text-stone-600 truncate max-w-[150px]" title={po.broker}>
                              {po.broker || '-'}
                            </td>
                            <td className="text-right pr-3 font-black text-sky-850">
                              {Number(po.total_contract_mt || 0).toFixed(3)} MT
                            </td>
                            <td className="text-right pr-3 font-black text-red-700 bg-red-50/10">
                              {Number(po.pending_received || 0).toFixed(3)} MT
                            </td>
                            <td className="text-center">
                              <button
                                onClick={() => {
                                  const fakeAmad: Amad = {
                                    financial_year: "",
                                    amad_no: "",
                                    po_no: po.po_no,
                                    supplier: po.supplier,
                                    broker: po.broker,
                                    date: new Date().toISOString().split('T')[0]
                                  };
                                  setEditingAmad(fakeAmad);
                                }}
                                className="bg-[#0a246a] hover:bg-blue-800 text-white font-black text-[9px] uppercase px-2.5 py-1 shadow-[1px_1px_0_0_black] border border-white active:shadow-[inset_1px_1px_0_0_black] rounded cursor-pointer transition-colors"
                              >
                                Receive Arrival
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {pendingPOs.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-gray-500 font-bold uppercase text-[11px] leading-relaxed">
                            No Outstanding Pending POs Found. All contracted purchase orders have recorded arrivals.
                          </td>
                        </tr>
                      )}
                      
                      {/* Vertical padding space for retro feel */}
                      {Array.from({ length: Math.max(0, 10 - pendingPOs.length) }).map((_, i) => (
                        <tr key={i} className="h-8.5 border-b border-gray-100 opacity-25">
                          <td colSpan={7}></td>
                        </tr>
                      ))}
                    </>
                  );
                })()}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary aggregate footer panel */}
        <div className="bg-[#808080] p-1 flex justify-between gap-1 border border-black/10 shadow-[inset_1px_1px_1px_rgba(0,0,0,0.2)] ">
          <div className="flex gap-1 h-full">
            <div className="bg-white px-3 py-1 border border-gray-400 min-w-[120px]">
              <p className="text-[8px] font-bold text-gray-400 leading-none uppercase">Cumulative Loads</p>
              <p className="text-xs font-black">{filteredAmads.length} Lorries</p>
            </div>
            <div className="bg-white px-3 py-1 border border-gray-400 min-w-[120px]">
              <p className="text-[8px] font-bold text-gray-400 leading-none uppercase">Cumulative Packets</p>
              <p className="text-xs font-black text-blue-800">{totalBales} Bales</p>
            </div>
            <div className="bg-white px-3 py-1 border border-gray-400 min-w-[150px]">
              <p className="text-[8px] font-bold text-gray-400 leading-none uppercase">Cumulative Net Weight</p>
              <p className="text-xs font-black text-red-700">{totalWeightMt.toFixed(3)} MT</p>
            </div>
          </div>
          <div className="bg-[#d4d0c8] px-3 py-1 border border-white text-right flex items-center justify-center">
            <span className="text-[10px] font-bold uppercase text-gray-700 font-sans tracking-wide">STATUS: OPERATIONAL HUB ONLINE</span>
          </div>
        </div>

      </div>

      {/* =========================================================================
          HIGH-FIDELITY PRINT PREVIEW OVERLAY: MARKS & QUALITY RECEIVED (MILL COPY) 
          ========================================================================= */}
      <PrintModal
        isOpen={isPrintingModalOpen}
        onClose={() => setIsPrintingModalOpen(false)}
        title="MARKS & QUALITY RECEIVED [MILL COPY - CONTINUOUS PRINT FORM]"
        showTip={false}
      >
        {printData && (
            <div className="p-4 bg-[#a0a0a0] flex justify-center overflow-x-auto print:bg-white print:p-0">
              <div className="print-continuous-paper-container flex bg-white shadow-2xl border border-gray-400 select-text pr-px print:shadow-none print:border-none">
                    
                    {/* Left Tractor Feed band with holes */}
                    <div id="tractor-feed-holes-left" className="w-[32px] bg-[#fdfaf2] border-r border-red-200 flex flex-col justify-between py-6 shrink-0 ">
                      {Array.from({ length: 18 }).map((_, i) => (
                        <div key={i} className="w-3.5 h-3.5 bg-[#403c34]/50 rounded-full mx-auto shadow-[inset_1.5px_1.5px_2.5px_rgba(0,0,0,0.7)] opacity-85 border border-amber-900/10"></div>
                      ))}
                    </div>

                    {/* Main Print Slip Sheet */}
                    <div id="print-sheet-wrapper" className="w-[840px] bg-white p-6 md:p-8 flex flex-col justify-between select-text text-black print:p-0 print:w-full">
                      
                      {/* Slip Header */}
                      <div>
                        <div className="flex justify-between items-start">
                          <div className="text-left max-w-[320px]">
                            <h1 className="font-sans font-black text-xl tracking-tight text-red-600 leading-none">BALLY JUTE COMPANY LIMITED</h1>
                            <p className="text-[10px] font-bold text-red-700/95 tracking-wide mt-1 uppercase font-mono">AUTHORIZED MILL PREMISES</p>
                          </div>
                          
                          <div className="text-center shrink-0 border-b-2 border-red-600 pb-1.5 px-4">
                            <h2 className="font-serif font-black text-[20px] text-red-600 uppercase tracking-widest leading-none">Temporary M.R</h2>
                            <p className="text-[10px] font-black tracking-widest text-red-700 uppercase mt-1">MARKS & QUALITY RECEIVED</p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-extrabold text-[11px] text-red-700 uppercase border-2 border-red-600 px-2 py-0.5 tracking-widest font-mono">MILL COPY</span>
                          </div>
                        </div>

                        {/* Master Metadata Box-Wise Grid */}
                        <div className="border border-red-600 mt-5 text-[11px] font-bold text-red-700 bg-white">
                          {/* Row 1 */}
                          <div className="grid grid-cols-12 border-b border-red-600">
                            <div className="col-span-8 flex items-center px-2 py-1.5 border-r border-red-600">
                              <span className="shrink-0 font-black uppercase text-[10px] tracking-wider text-red-800 mr-2">FROM :</span>
                              <input 
                                value={printData.supplier || ''} 
                                onChange={(e) => setPrintData({...printData, supplier: e.target.value})}
                                className="flex-1 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none uppercase text-black font-black text-[11.5px]"
                              />
                            </div>
                            <div className="col-span-4 flex items-center px-2 py-1.5">
                              <span className="shrink-0 font-black uppercase text-[10px] tracking-wider text-red-800 mr-2">M.R. NO. :</span>
                              <input 
                                value={printData.mr_no || ''} 
                                onChange={(e) => setPrintData({...printData, mr_no: e.target.value})}
                                className="flex-1 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none uppercase text-black font-mono font-black text-[11.5px]"
                              />
                            </div>
                          </div>
                          {/* Row 2 */}
                          <div className="grid grid-cols-12">
                            <div className="col-span-4 flex items-center px-2 py-1.5 border-r border-red-600">
                              <span className="shrink-0 font-black uppercase text-[10px] tracking-wider text-red-800 mr-2">DATE :</span>
                              <input 
                                type="date"
                                value={printData.mr_date || ''} 
                                onChange={(e) => setPrintData({...printData, mr_date: e.target.value})}
                                className="flex-1 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none text-black font-black text-xs"
                              />
                            </div>
                            <div className="col-span-4 flex items-center px-2 py-1.5 border-r border-red-600">
                              <span className="shrink-0 font-black uppercase text-[10px] tracking-wider text-red-800 mr-2">ORDER NO. :</span>
                              <input 
                                value={printData.po_no || ''} 
                                onChange={(e) => setPrintData({...printData, po_no: e.target.value})}
                                className="flex-1 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none uppercase text-black font-mono font-black text-[11.5px]"
                              />
                            </div>
                            <div className="col-span-4 flex items-center px-2 py-1.5">
                              <span className="shrink-0 font-black uppercase text-[10px] tracking-wider text-red-800 mr-2">DATE :</span>
                              <input 
                                type="date"
                                value={printData.po_date || ''} 
                                onChange={(e) => setPrintData({...printData, po_date: e.target.value})}
                                className="flex-1 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none text-black font-black text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Table Container */}
                        <div className="mt-4 border border-red-600 bg-white">
                          <table className="w-full border-collapse text-[10px]">
                            <thead>
                              {/* Row 1 of headers */}
                              <tr className="bg-red-600 text-white font-extrabold border-b border-red-600 shrink-0 h-9">
                                {printColumns.crop_year && <th className="border-r border-red-600 text-center uppercase p-0.5 w-[50px] text-[9.5px]" rowSpan={2}>Crop</th>}
                                {printColumns.marka && <th className="border-r border-red-600 text-center uppercase p-0.5 w-[65px] text-[9.5px]" rowSpan={2}>Mark</th>}
                                {printColumns.quality && <th className="border-r border-red-600 text-left uppercase pl-2 p-0.5 w-[140px] text-[9.5px]" rowSpan={2}>Quality</th>}
                                {printColumns.quantity_rcpt && <th className="border-r border-red-600 text-right uppercase pr-2 p-0.5 w-[65px] text-[9.5px]" rowSpan={2}>Quantity</th>}
                                {printColumns.claim && <th className="border-r border-red-600 text-center uppercase p-0.5 w-[60px] text-[9.5px]" rowSpan={2}>Claim</th>}
                                {printColumns.gross_wt && <th className="border-r border-red-600 text-right uppercase pr-2 p-0.5 w-[75px] text-[9.5px]" rowSpan={2}>Gross Wt.</th>}
                                {printColumns.moisture_pct && <th className="border-r border-red-600 text-center uppercase p-0.5 w-[50px] text-[8.5px] no-print" rowSpan={2}>Moisture<br/>% Kg.</th>}
                                {printColumns.dust_pct && <th className="border-r border-red-600 text-center uppercase p-0.5 w-[50px] text-[8.5px] no-print" rowSpan={2}>Dust<br/>% Kg.</th>}
                                {printColumns.ncv_pct && <th className="border-r border-red-600 text-center uppercase p-0.5 w-[50px] text-[8.5px] no-print" rowSpan={2}>NCV<br/>% Kg.</th>}
                                {printColumns.net_wt && <th className="border-r border-red-600 text-right uppercase pr-2 p-0.5 w-[75px] text-[9.5px]" rowSpan={2}>Net Wt.</th>}
                                {printColumns.settlement && <th className="border-r border-red-600 text-center uppercase p-0.5" colSpan={4}>Settlement</th>}
                                {printColumns.rate && <th className="text-right uppercase pr-2 p-0.5 w-[60px] text-[9.5px]" rowSpan={2}>Rate</th>}
                              </tr>
                              {/* Row 2 of headers for settlement subdivisions */}
                              {printColumns.settlement && (
                                <tr className="bg-red-600 text-white font-bold border-b border-red-600 h-6">
                                  <th className="border-r border-red-500 text-center p-0.5 text-[8.2px] uppercase w-[55px]">Grade</th>
                                  <th className="border-r border-red-500 text-center p-0.5 text-[8.2px] uppercase w-[50px] no-print">Moisture</th>
                                  <th className="border-r border-red-500 text-center p-0.5 text-[8.2px] uppercase w-[45px] no-print">Dust</th>
                                  <th className="border-r border-red-600 text-center p-0.5 text-[8.2px] uppercase w-[55px]">Prem./Less</th>
                                </tr>
                              )}
                            </thead>
                            <tbody className="divide-y divide-red-200">
                              {printData.rows.map((row: any, rIdx: number) => {
                                const isRowEmpty = !row.crop_year && !row.marka && !row.quality;
                                return (
                                  <tr key={rIdx} className="h-7.5 hover:bg-red-50/50">
                                    {/* Crop Year */}
                                    {printColumns.crop_year && (
                                      <td className="border-r border-red-200 text-center p-0">
                                        <input 
                                          value={row.crop_year || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'crop_year', e.target.value)}
                                          className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-black"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Marka */}
                                    {printColumns.marka && (
                                      <td className="border-r border-red-200 text-center p-0">
                                        <input 
                                          value={row.marka || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'marka', e.target.value)}
                                          className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold uppercase text-black"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Quality */}
                                    {printColumns.quality && (
                                      <td className="border-r border-red-200 px-1 p-0">
                                        <input 
                                          value={row.quality || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'quality', e.target.value)}
                                          className="w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-[10px] uppercase font-bold text-black pl-1.5"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Quantity / Packet Bales */}
                                    {printColumns.quantity_rcpt && (
                                      <td className="border-r border-red-200 text-right p-0">
                                        <input 
                                          type={isRowEmpty ? "text" : "number"}
                                          value={row.quantity_rcpt || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'quantity_rcpt', e.target.value)}
                                          className="w-full bg-transparent text-right border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-blue-800 pr-1.5"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Claim */}
                                    {printColumns.claim && (
                                      <td className="border-r border-red-200 text-center p-0">
                                        <input 
                                          value={row.claim_val || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'claim_val', e.target.value)}
                                          className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[9.5px] text-black"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Gross Wt */}
                                    {printColumns.gross_wt && (
                                      <td className="border-r border-red-200 text-right p-0">
                                        <input 
                                          value={row.gross_wt || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'gross_wt', e.target.value)}
                                          className="w-full bg-transparent text-right border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-black pr-1.5"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Moisture % */}
                                    {printColumns.moisture_pct && (
                                      <td className="border-r border-red-200 text-center p-0 no-print">
                                        <input 
                                          value={row.moisture_pct || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'moisture_pct', e.target.value)}
                                          className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-black"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Dust % */}
                                    {printColumns.dust_pct && (
                                      <td className="border-r border-red-200 text-center p-0 no-print">
                                        <input 
                                          value={row.dust_pct || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'dust_pct', e.target.value)}
                                          className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-black"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* NCV % */}
                                    {printColumns.ncv_pct && (
                                      <td className="border-r border-red-200 text-center p-0 no-print">
                                        <input 
                                          value={row.ncv_pct || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'ncv_pct', e.target.value)}
                                          className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-black"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Net Wt */}
                                    {printColumns.net_wt && (
                                      <td className="border-r border-red-200 text-right p-0">
                                        <input 
                                          value={row.net_wt || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'net_wt', e.target.value)}
                                          className="w-full bg-transparent text-right border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-black font-mono text-red-700 pr-1.5"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Settlement: Grade, Moisture, Dust, Premium */}
                                    {printColumns.settlement && (
                                      <>
                                        <td className="border-r border-red-200 p-0 text-center">
                                          <input 
                                            value={row.settlement_grade || ''} 
                                            onChange={(e) => updatePrintRow(rIdx, 'settlement_grade', e.target.value)}
                                            className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[9.5px] uppercase"
                                            placeholder="--"
                                          />
                                        </td>
                                        <td className="border-r border-red-200 p-0 text-center no-print">
                                          <input 
                                            value={row.settlement_moisture || ''} 
                                            onChange={(e) => updatePrintRow(rIdx, 'settlement_moisture', e.target.value)}
                                            className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[9.5px]"
                                            placeholder="--"
                                          />
                                        </td>
                                        <td className="border-r border-red-200 p-0 text-center no-print">
                                          <input 
                                            value={row.settlement_dust || ''} 
                                            onChange={(e) => updatePrintRow(rIdx, 'settlement_dust', e.target.value)}
                                            className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[9.5px]"
                                            placeholder="--"
                                          />
                                        </td>
                                        <td className="border-r border-red-200 p-0 text-center">
                                          <input 
                                            value={row.settlement_prem_less || ''} 
                                            onChange={(e) => updatePrintRow(rIdx, 'settlement_prem_less', e.target.value)}
                                            className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[9.5px]"
                                            placeholder="--"
                                          />
                                        </td>
                                      </>
                                    )}
                                    {/* Rate */}
                                    {printColumns.rate && (
                                      <td className="text-right p-0">
                                        <input 
                                          value={row.rate || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'rate', e.target.value)}
                                          className="w-full bg-transparent text-right border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-black pr-1.5"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}

                              {/* TOTAL ROW */}
                              <tr className="h-8.5 border-t-2 border-red-600 bg-red-50/30 text-red-700 font-extrabold ">
                                {((printColumns.crop_year ? 1 : 0) + (printColumns.marka ? 1 : 0) + (printColumns.quality ? 1 : 0)) > 0 && (
                                  <td className="border-r border-red-600 text-center border-b border-red-600" colSpan={(printColumns.crop_year ? 1 : 0) + (printColumns.marka ? 1 : 0) + (printColumns.quality ? 1 : 0)}>
                                    <span className="text-[10px] tracking-widest font-black uppercase">TOTALS:</span>
                                  </td>
                                )}
                                {/* Total Qty (bales) */}
                                {printColumns.quantity_rcpt && (
                                  <td className="border-r border-red-600 text-right pr-1.5 font-mono text-black font-black text-[11px]">
                                    {printTotalQty > 0 ? printTotalQty.toLocaleString() : '--'}
                                  </td>
                                )}
                                {printColumns.claim && <td className="border-r border-red-600 border-b border-red-600"></td>}
                                {/* Total Gross Wt. */}
                                {printColumns.gross_wt && (
                                  <td className="border-r border-red-600 text-right pr-1.5 font-mono text-black font-black text-[11px]">
                                    {printTotalGrossWt > 0 ? printTotalGrossWt.toFixed(3) : '--'}
                                  </td>
                                )}
                                {/* Deduction Column spacers */}
                                {printColumns.moisture_pct && <td className="border-r border-red-200 border-b border-red-600 no-print"></td>}
                                {printColumns.dust_pct && <td className="border-r border-red-200 border-b border-red-600 no-print"></td>}
                                {printColumns.ncv_pct && <td className="border-r border-red-600 border-b border-red-600 no-print"></td>}
                                {/* Total Net Wt. */}
                                {printColumns.net_wt && (
                                  <td className="border-r border-red-600 text-right pr-1.5 font-mono text-red-700 font-black text-[11.5px]">
                                    {printTotalNetWt > 0 ? printTotalNetWt.toFixed(3) : '--'}
                                  </td>
                                )}
                                {/* Right subdivisions and Rate spacers */}
                                {printColumns.settlement && <td className="border-r border-red-600 border-b border-red-600" colSpan={4}></td>}
                                {printColumns.rate && <td className="text-right border-b border-red-600"></td>}
                              </tr>
                            </tbody>
                          </table>
                        </div>



                        {/* Remarks Section */}
                        <div className="mt-3 text-[11px] font-bold text-red-700">
                          <div className="flex items-start gap-1.5">
                            <span className="shrink-0 mt-0.5 uppercase tracking-wide">Remarks:</span>
                            <textarea 
                              rows={2}
                              value={printData.remarks || ''} 
                              onChange={(e) => setPrintData({...printData, remarks: e.target.value})}
                              className="flex-1 bg-transparent border-b border-dashed border-red-300 p-0 focus:ring-0 focus:outline-none text-black text-[11px] font-black h-11 w-full resize-none leading-tight"
                              placeholder="No remarks registered. Click to write any custom remarks or specifications on-form..."
                            />
                          </div>
                        </div>

                        {/* Sub Footer Box */}
                        <div className="grid grid-cols-12 border border-red-600 mt-4 text-[10px] font-bold text-red-700 divide-x divide-red-600">
                          <div className="col-span-5 p-2 flex flex-col justify-center">
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0 uppercase">Challan No & Date :</span>
                              <input 
                                value={printData.challan_rr_no || ''} 
                                onChange={(e) => setPrintData({...printData, challan_rr_no: e.target.value})}
                                className="flex-1 bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-black font-extrabold uppercase text-[10.5px]"
                              />
                            </div>
                          </div>
                          <div className="col-span-4 p-2 flex flex-col justify-center">
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0 uppercase">Lorry Number :</span>
                              <input 
                                value={printData?.lorry_number || (printData as any)?.lorry_no || (printData as any)?.vehicle_no || ''} 
                                onChange={(e) => setPrintData({...printData, lorry_number: e.target.value})}
                                className="flex-1 bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-black font-extrabold font-mono uppercase text-[10.5px]"
                              />
                            </div>
                          </div>
                          <div className="col-span-3 p-2 flex flex-col justify-center">
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0 uppercase">Stations :</span>
                              <input 
                                value={printData.arrival_area_name || ''} 
                                onChange={(e) => setPrintData({...printData, arrival_area_name: e.target.value})}
                                className="flex-1 bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-black font-extrabold uppercase text-[10.5px]"
                              />
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Notes Terms & Conditions & Signatures Section */}
                      <div className="grid grid-cols-12 mt-4 text-[8.2px] leading-tight text-red-700/90 pt-2.5">
                        <div className="col-span-7 flex flex-col gap-1 border-r border-red-300 pr-4">
                          <p className="font-black uppercase tracking-wider text-[8.5px] text-red-800">Note:</p>
                          <p>1. Initiate your offer of settlement at an early date failing which we shall refer the matter to B.C.C.I for arbitrator.</p>
                          <p>2. Seller must remove the bales within three days from the date of serving the Mill Receipt if the rates given on the Mill Receipt by the Buyers are not acceptable to them, failing which Buyer will treat the consignment as having been accepted and will not be responsible for its being used up.</p>
                          <p>3. Net weight is reduced from gross weight to account for seasonal moisture excess exceeding DAISEE or standard limits, along with dust allowances. Deductions are determined strictly from authorized material inspections.</p>
                          <p className="font-extrabold text-[9px] text-red-700 uppercase tracking-wide mt-1">ORIGINAL MUST BE ATTACHED WITH BILL/COPY</p>
                        </div>
                        <div className="col-span-5 flex flex-col justify-between pl-4 text-center">
                          <p className="font-black text-[12px] tracking-wide uppercase font-sans text-red-800/90">For, BALLY JUTE COMPANY LIMITED</p>
                          <div className="mt-7 flex flex-col items-center">
                            <div className="w-56 border-t border-dashed border-red-400"></div>
                            <p className="font-bold text-[9px] mt-1 text-red-700/80 uppercase">Authorised Signatory</p>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Right Tractor Feed band with holes */}
                    <div id="tractor-feed-holes-right" className="w-[32px] bg-[#fdfaf2] border-l border-[#dcd8cc] flex flex-col justify-between py-6 shrink-0 ">
                      {Array.from({ length: 18 }).map((_, i) => (
                        <div key={i} className="w-3.5 h-3.5 bg-[#403c34]/50 rounded-full mx-auto shadow-[inset_1.5px_1.5px_2.5px_rgba(0,0,0,0.7)] opacity-85 border border-amber-900/10"></div>
                      ))}
                    </div>
                  </div>
                </div>
        )}
      </PrintModal>



      

    </LegacyLayout>
  );
}

function Th({ label, className }: { label: string; className?: string }) {
  return (
    <th className={cn("px-4 py-2 border-r border-gray-300 font-bold text-[#202020] uppercase  text-center", className)}>
      {label}
    </th>
  );
}
